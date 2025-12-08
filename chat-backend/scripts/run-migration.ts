import { DataSource } from 'typeorm';
import { RemoveGroupTables1733299200000 } from '../apps/user-service/migrations/1733299200000-RemoveGroupTables';
import dataSource from '../apps/user-service/typeorm.config';

async function runMigration() {
  try {
    // Initialize connection
    await dataSource.initialize();
    console.log('✅ Database connected');

    // Run migration
    const migration = new RemoveGroupTables1733299200000();
    await migration.up(dataSource.createQueryRunner());
    console.log('✅ Migration completed: RemoveGroupTables');

    await dataSource.destroy();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
