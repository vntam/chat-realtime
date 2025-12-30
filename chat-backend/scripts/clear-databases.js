/**
 * Script to clear all databases for testing
 * Run: node scripts/clear-databases.js
 */

const { Client } = require('pg');
const { MongoClient } = require('mongodb');

// PostgreSQL connection
const PG_CONFIG = {
  host: 'localhost',
  port: 9018,
  user: 'postgres',
  password: '123',
  database: 'chat_user_service',
};

// MongoDB connections
const MONGO_CHAT_URL = 'mongodb+srv://admin:123@vantamnguyen.03cbtwn.mongodb.net/chat_db?appName=vantamnguyen';
const MONGO_NOTIFICATION_URL = 'mongodb+srv://admin:123@vantamnguyen.03cbtwn.mongodb.net/notification_db?appName=vantamnguyen';

async function clearPostgreSQL() {
  console.log('\n🗑️  Clearing PostgreSQL (User Service)...');
  const client = new Client(PG_CONFIG);

  try {
    await client.connect();

    // First, check existing tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('  📋 Existing tables:', tablesResult.rows.map(r => r.table_name).join(', '));

    // Clear all tables in correct order (respect foreign keys)
    // Tables: users, user_roles, tokens
    const tables = ['user_roles', 'tokens', 'users'];

    for (const table of tables) {
      try {
        const result = await client.query(`DELETE FROM "${table}";`);
        console.log(`  ✓ Cleared table: ${table} (${result.rowCount} rows)`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`  ⚠️  Table "${table}" does not exist, skipping...`);
        } else {
          throw err;
        }
      }
    }

    // Reset sequences
    try {
      await client.query('ALTER SEQUENCE users_user_id_seq RESTART WITH 1;');
      console.log('  ✓ Reset sequence: users_user_id_seq');
    } catch (err) {
      console.log('  ⚠️  Could not reset sequence:', err.message);
    }

    console.log('✅ PostgreSQL cleared successfully!\n');
  } catch (error) {
    console.error('❌ PostgreSQL error:', error.message);
  } finally {
    await client.end();
  }
}

async function clearMongoDB(url, dbName, collections) {
  console.log(`\n🗑️  Clearing MongoDB (${dbName})...`);
  const client = new MongoClient(url);

  try {
    await client.connect();
    const db = client.db(dbName);

    for (const collection of collections) {
      const result = await db.collection(collection).deleteMany({});
      console.log(`  ✓ Cleared ${collection}: ${result.deletedCount} documents`);
    }

    console.log(`✅ ${dbName} cleared successfully!\n`);
  } catch (error) {
    console.error(`❌ MongoDB error (${dbName}):`, error.message);
  } finally {
    await client.close();
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('🧹 DATABASE CLEANER');
  console.log('='.repeat(50));

  await clearPostgreSQL();
  await clearMongoDB(MONGO_CHAT_URL, 'chat_db', ['conversation', 'message', 'presence']);
  await clearMongoDB(MONGO_NOTIFICATION_URL, 'notification_db', ['notification']);

  console.log('='.repeat(50));
  console.log('✅ ALL DATABASES CLEARED!');
  console.log('='.repeat(50));
  console.log('\nYou can now create fresh accounts.\n');
}

main().catch(console.error);
