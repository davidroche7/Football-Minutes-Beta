import { config } from 'dotenv';
import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function runMigration() {
  try {
    const migrationSQL = readFileSync(join(process.cwd(), 'server/db/migrations/0001_init.sql'), 'utf-8');

    console.log('Running database migration...');
    await sql.query(migrationSQL);
    console.log('✅ Migration completed successfully!');

    // Check if tables exist
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('\n📊 Database tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
