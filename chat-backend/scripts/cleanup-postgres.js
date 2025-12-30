/**
 * PostgreSQL Database Cleanup Script for Render
 * Run: node scripts/cleanup-postgres.js
 *
 * This script cleans up old data to free up storage space
 */

const { Client } = require('pg');

const PG_CONFIG = {
  // Get from Render Dashboard → User Service → Environment → DATABASE_URL
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:9018/chat_user_service',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function cleanupDatabase() {
  console.log('='.repeat(60));
  console.log('🧹 POSTGRESQL DATABASE CLEANUP');
  console.log('='.repeat(60));

  const client = new Client(PG_CONFIG);

  try {
    await client.connect();
    console.log('\n✅ Connected to PostgreSQL\n');

    // 1. Check current database size
    console.log('📊 Current database size:');
    const sizeResult = await client.query("SELECT pg_size_pretty(pg_database_size('chat_user_service')) as size;");
    console.log(`   Database size: ${sizeResult.rows[0].size}\n`);

    // 2. Check table sizes
    console.log('📊 Table sizes before cleanup:');
    const tablesResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `);
    tablesResult.rows.forEach(row => {
      console.log(`   ${row.tablename}: ${row.size}`);
    });
    console.log('');

    // 3. Delete old tokens (older than 7 days)
    console.log('🗑️  Cleaning up old tokens...');
    const tokensResult = await client.query(`
      DELETE FROM tokens
      WHERE created_at < NOW() - INTERVAL '7 days'
      RETURNING token_id;
    `);
    console.log(`   ✓ Deleted ${tokensResult.rowCount} old tokens\n`);

    // 4. Delete inactive users (optional - comment out if you want to keep all users)
    console.log('🗑️  Cleaning up inactive users (status != active)...');
    const inactiveUsersResult = await client.query(`
      DELETE FROM users
      WHERE status != 'active'
      AND created_at < NOW() - INTERVAL '30 days'
      RETURNING user_id, username;
    `);
    console.log(`   ✓ Deleted ${inactiveUsersResult.rowCount} inactive users`);
    if (inactiveUsersResult.rowCount > 0) {
      inactiveUsersResult.rows.forEach(row => {
        console.log(`     - User ID ${row.user_id}: ${row.username}`);
      });
    }
    console.log('');

    // 5. Delete orphaned user_roles (users that don't exist)
    console.log('🗑️  Cleaning up orphaned user_roles...');
    const orphanRolesResult = await client.query(`
      DELETE FROM user_role
      WHERE user_id NOT IN (SELECT user_id FROM users);
    `);
    console.log(`   ✓ Deleted ${orphanRolesResult.rowCount} orphaned user_roles\n`);

    // 6. VACUUM to reclaim space
    console.log('🧹 Running VACUUM to reclaim disk space...');
    console.log('   This may take a while...');
    await client.query('VACUUM FULL;');
    console.log('   ✓ VACUUM completed\n');

    // 7. Check new database size
    console.log('📊 Database size after cleanup:');
    const newSizeResult = await client.query("SELECT pg_size_pretty(pg_database_size('chat_user_service')) as size;");
    console.log(`   Database size: ${newSizeResult.rows[0].size}\n`);

    // 8. Check remaining users
    const usersCount = await client.query('SELECT COUNT(*) as count FROM users;');
    console.log(`📊 Total users: ${usersCount.rows[0].count}\n`);

    console.log('='.repeat(60));
    console.log('✅ CLEANUP COMPLETED!');
    console.log('='.repeat(60));
    console.log('\n💡 Tips to prevent storage full in the future:');
    console.log('   - Regularly cleanup old tokens (run this script weekly)');
    console.log('   - Set up automatic cleanup with cron jobs');
    console.log('   - Consider upgrading to paid Render plan for more storage');
    console.log('   - Or migrate to free alternatives: Supabase, Neon, ElephantSQL\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanupDatabase();
