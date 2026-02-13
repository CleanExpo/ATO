/**
 * Migration Applier - Executes SQL migration against Supabase PostgreSQL
 *
 * Usage: node apply-migration.js [DB_PASSWORD]
 *
 * If no password provided, reads from SUPABASE_DB_PASSWORD env var
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'xwqymjisxmtcmaebcehw';
const DB_HOST = `db.${PROJECT_REF}.supabase.co`;
const DB_PORT = 5432;
const DB_NAME = 'postgres';
const DB_USER = 'postgres';

async function main() {
  const password = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;

  if (!password) {
    console.error('Usage: node apply-migration.js <DB_PASSWORD>');
    console.error('  Or set SUPABASE_DB_PASSWORD environment variable');
    console.error('');
    console.error('Find your database password in Supabase Dashboard:');
    console.error('  Project Settings > Database > Connection string > Password');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, 'ato-app', 'supabase', 'migrations', '20260210_consolidated_missing_tables.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Read migration file: ${sql.length} chars`);

  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`Connecting to ${DB_HOST}:${DB_PORT}/${DB_NAME}...`);
    await client.connect();
    console.log('Connected successfully!');

    // Split migration into chunks at the section markers to provide progress
    const sections = sql.split(/-- ={50,}/);
    let sectionNum = 0;

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      sectionNum++;
      // Extract section title from first comment line
      const titleMatch = trimmed.match(/^--\s*\d+\.\s*(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : `Section ${sectionNum}`;

      console.log(`\n[${sectionNum}/${sections.length}] Executing: ${title}...`);

      try {
        await client.query(trimmed);
        console.log(`  OK`);
      } catch (err) {
        // Some errors are expected (IF NOT EXISTS, duplicate objects, etc.)
        if (err.message.includes('already exists') ||
            err.message.includes('duplicate key') ||
            err.message.includes('already a partition')) {
          console.log(`  SKIPPED (already exists): ${err.message.substring(0, 80)}`);
        } else {
          console.error(`  ERROR: ${err.message}`);
          // Continue with other sections - don't abort
        }
      }
    }

    // Verify: count tables
    const { rows } = await client.query(`
      SELECT count(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log(`\n========================================`);
    console.log(`Migration complete! Total public tables: ${rows[0].count}`);
    console.log(`========================================`);

  } catch (err) {
    console.error('Connection/execution error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
