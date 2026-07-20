import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
  console.log('Applying shortages schema migration for multi-source support...')

  try {
    // Check if table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'shortages'
      );
    `)

    const exists = (tableExists.rows[0] as { exists: boolean })?.exists

    if (!exists) {
      // Create the full table if it doesn't exist
      console.log('Creating shortages table...')
      await db.execute(sql`
        CREATE TABLE "shortages" (
          "id" serial PRIMARY KEY NOT NULL,
          "slug" text UNIQUE,
          "source_authority" text NOT NULL DEFAULT 'EMA',
          "region" text NOT NULL DEFAULT 'EU',
          "product_id" integer REFERENCES "medicinal_products_extended"("id"),
          "substance_id" integer REFERENCES "substances"("id"),
          "inn" text,
          "category" text,
          "medicine_affected" text,
          "therapeutic_area_mesh" text,
          "pharmaceutical_forms_affected" text,
          "strengths_affected" text,
          "availability_of_alternatives" text,
          "shortage_number" text UNIQUE,
          "title" text NOT NULL,
          "description" text,
          "affected_products" text,
          "reason" text,
          "status" text NOT NULL,
          "severity" text,
          "start_of_shortage_date" date,
          "expected_resolution_date" date,
          "actual_resolution_date" date,
          "first_published_date" date,
          "last_updated_date" date,
          "reported_date" date NOT NULL,
          "affected_countries" text,
          "alternative_treatments" text,
          "actions_taken" text,
          "shortage_data" jsonb,
          "source_url" text,
          "source_document_id" text,
          "source_ema_source_id" integer,
          "content_hash" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `)
      console.log('✓ Created shortages table')
    } else {
      // Add new columns if they don't exist
      console.log('Adding new columns to shortages table...')

      const columnsToAdd = [
        { name: 'slug', type: 'text UNIQUE' },
        { name: 'source_authority', type: "text NOT NULL DEFAULT 'EMA'" },
        { name: 'region', type: "text NOT NULL DEFAULT 'EU'" },
        { name: 'substance_id', type: 'integer REFERENCES "substances"("id")' },
        { name: 'inn', type: 'text' },
        { name: 'category', type: 'text' },
        { name: 'medicine_affected', type: 'text' },
        { name: 'therapeutic_area_mesh', type: 'text' },
        { name: 'pharmaceutical_forms_affected', type: 'text' },
        { name: 'strengths_affected', type: 'text' },
        { name: 'availability_of_alternatives', type: 'text' },
        { name: 'start_of_shortage_date', type: 'date' },
        { name: 'first_published_date', type: 'date' },
        { name: 'last_updated_date', type: 'date' },
        { name: 'shortage_data', type: 'jsonb' },
        { name: 'source_document_id', type: 'text' },
        { name: 'content_hash', type: 'text' },
      ]

      for (const col of columnsToAdd) {
        try {
          await db.execute(sql.raw(`ALTER TABLE "shortages" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`))
          console.log(`  ✓ Added column ${col.name}`)
        } catch (error) {
          // Column might already exist or have conflicts
          console.log(`  - Column ${col.name}: skipped (may already exist)`)
        }
      }
    }

    // Create indexes
    console.log('\nCreating indexes...')

    const indexes = [
      'CREATE INDEX IF NOT EXISTS "shortages_product_idx" ON "shortages" ("product_id")',
      'CREATE INDEX IF NOT EXISTS "shortages_substance_idx" ON "shortages" ("substance_id")',
      'CREATE INDEX IF NOT EXISTS "shortages_inn_idx" ON "shortages" ("inn")',
      'CREATE INDEX IF NOT EXISTS "shortages_status_idx" ON "shortages" ("status")',
      'CREATE INDEX IF NOT EXISTS "shortages_reported_date_idx" ON "shortages" ("reported_date")',
      'CREATE INDEX IF NOT EXISTS "shortages_severity_idx" ON "shortages" ("severity")',
      'CREATE INDEX IF NOT EXISTS "shortages_authority_idx" ON "shortages" ("source_authority")',
      'CREATE INDEX IF NOT EXISTS "shortages_region_idx" ON "shortages" ("region")',
      'CREATE INDEX IF NOT EXISTS "shortages_authority_status_idx" ON "shortages" ("source_authority", "status")',
      'CREATE INDEX IF NOT EXISTS "shortages_start_date_idx" ON "shortages" ("start_of_shortage_date")',
      'CREATE INDEX IF NOT EXISTS "shortages_slug_idx" ON "shortages" ("slug")',
    ]

    for (const idx of indexes) {
      await db.execute(sql.raw(idx))
    }
    console.log('✓ Created all indexes')

    console.log('\n✅ Shortages schema migration completed successfully!')

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

main()
