import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `)
  console.log('Existing tables:', result.rows.map((r) => r.table_name))

  const hasImportLogs = result.rows.some((r) => r.table_name === 'import_logs')

  if (!hasImportLogs) {
    console.log('Creating import_logs table...')
    await pool.query(`
      CREATE TABLE "import_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "source" text NOT NULL,
        "source_url" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "started_at" timestamp DEFAULT now() NOT NULL,
        "completed_at" timestamp,
        "total_fetched" integer DEFAULT 0,
        "products_created" integer DEFAULT 0,
        "products_updated" integer DEFAULT 0,
        "substances_created" integer DEFAULT 0,
        "companies_created" integer DEFAULT 0,
        "error_count" integer DEFAULT 0,
        "errors" jsonb,
        "metadata" jsonb
      );
    `)
    console.log('Created import_logs table')
  } else {
    console.log('import_logs table already exists')
  }

  await pool.end()
}

main().catch(console.error)
