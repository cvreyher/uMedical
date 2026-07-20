import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
  console.log('Applying pvigilance schema migration...')

  try {
    // Create pvigilance_feed_sources table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "pvigilance_feed_sources" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "authority" text NOT NULL,
        "region" text NOT NULL,
        "feed_type" text NOT NULL,
        "feed_url" text NOT NULL,
        "feed_config" jsonb,
        "is_enabled" boolean DEFAULT true NOT NULL,
        "is_healthy" boolean DEFAULT true NOT NULL,
        "poll_interval_minutes" integer DEFAULT 60 NOT NULL,
        "last_fetched_at" timestamp,
        "last_success_at" timestamp,
        "last_error" text,
        "consecutive_failures" integer DEFAULT 0 NOT NULL,
        "total_fetches" integer DEFAULT 0 NOT NULL,
        "total_items_processed" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "pvigilance_feed_sources_slug_unique" UNIQUE("slug")
      )
    `)
    console.log('✓ Created pvigilance_feed_sources table')

    // Create pvigilance_feed_logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "pvigilance_feed_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "feed_source_id" integer NOT NULL REFERENCES "pvigilance_feed_sources"("id") ON DELETE CASCADE,
        "status" text NOT NULL,
        "fetched_at" timestamp DEFAULT now() NOT NULL,
        "duration_ms" integer,
        "items_fetched" integer DEFAULT 0 NOT NULL,
        "items_created" integer DEFAULT 0 NOT NULL,
        "items_updated" integer DEFAULT 0 NOT NULL,
        "items_skipped" integer DEFAULT 0 NOT NULL,
        "http_status" integer,
        "response_size" integer,
        "error_message" text,
        "error_details" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `)
    console.log('✓ Created pvigilance_feed_logs table')

    // Create pvigilance_events table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "pvigilance_events" (
        "id" serial PRIMARY KEY NOT NULL,
        "slug" text NOT NULL,
        "source_authority" text NOT NULL,
        "region" text NOT NULL,
        "event_type" text NOT NULL,
        "event_category" text NOT NULL,
        "severity" text DEFAULT 'medium' NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "event_date" date NOT NULL,
        "event_data" jsonb,
        "source_url" text NOT NULL,
        "source_document_id" text,
        "source_feed_id" integer REFERENCES "pvigilance_feed_sources"("id"),
        "content_hash" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "pvigilance_events_slug_unique" UNIQUE("slug")
      )
    `)
    console.log('✓ Created pvigilance_events table')

    // Create pvigilance_event_products table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "pvigilance_event_products" (
        "id" serial PRIMARY KEY NOT NULL,
        "event_id" integer NOT NULL REFERENCES "pvigilance_events"("id") ON DELETE CASCADE,
        "product_id" integer NOT NULL REFERENCES "medicinal_products"("id") ON DELETE CASCADE,
        "match_type" text NOT NULL,
        "match_confidence" real DEFAULT 1 NOT NULL,
        "match_source" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "pvigilance_event_products_unique" UNIQUE("event_id","product_id")
      )
    `)
    console.log('✓ Created pvigilance_event_products table')

    // Create pvigilance_event_substances table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "pvigilance_event_substances" (
        "id" serial PRIMARY KEY NOT NULL,
        "event_id" integer NOT NULL REFERENCES "pvigilance_events"("id") ON DELETE CASCADE,
        "substance_id" integer REFERENCES "substances"("id") ON DELETE SET NULL,
        "inn" text NOT NULL,
        "match_type" text NOT NULL,
        "match_confidence" real DEFAULT 1 NOT NULL,
        "match_source" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "pvigilance_event_substances_unique" UNIQUE("event_id","inn")
      )
    `)
    console.log('✓ Created pvigilance_event_substances table')

    // Create regional_authorizations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "regional_authorizations" (
        "id" serial PRIMARY KEY NOT NULL,
        "product_id" integer REFERENCES "medicinal_products"("id") ON DELETE CASCADE,
        "substance_id" integer REFERENCES "substances"("id") ON DELETE CASCADE,
        "inn" text NOT NULL,
        "region" text NOT NULL,
        "authority" text NOT NULL,
        "status" text NOT NULL,
        "brand_name" text,
        "local_product_code" text,
        "authorization_date" date,
        "authorization_holder" text,
        "therapeutic_indication" text,
        "source_url" text,
        "last_verified_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "regional_authorizations_product_region" UNIQUE("product_id","region")
      )
    `)
    console.log('✓ Created regional_authorizations table')

    // Create regional_authorization_history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "regional_authorization_history" (
        "id" serial PRIMARY KEY NOT NULL,
        "authorization_id" integer NOT NULL REFERENCES "regional_authorizations"("id") ON DELETE CASCADE,
        "previous_status" text,
        "new_status" text NOT NULL,
        "change_reason" text,
        "changed_at" date NOT NULL,
        "source_url" text,
        "source_event_id" integer,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `)
    console.log('✓ Created regional_authorization_history table')

    // Create indexes
    console.log('\nCreating indexes...')

    const indexes = [
      'CREATE INDEX IF NOT EXISTS "pvigilance_feed_sources_authority_idx" ON "pvigilance_feed_sources" ("authority")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_feed_sources_enabled_idx" ON "pvigilance_feed_sources" ("is_enabled")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_feed_logs_feed_idx" ON "pvigilance_feed_logs" ("feed_source_id")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_feed_logs_status_idx" ON "pvigilance_feed_logs" ("status")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_events_authority_idx" ON "pvigilance_events" ("source_authority")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_events_region_idx" ON "pvigilance_events" ("region")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_events_type_idx" ON "pvigilance_events" ("event_type")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_events_severity_idx" ON "pvigilance_events" ("severity")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_events_date_idx" ON "pvigilance_events" ("event_date")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_event_products_event_idx" ON "pvigilance_event_products" ("event_id")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_event_products_product_idx" ON "pvigilance_event_products" ("product_id")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_event_substances_event_idx" ON "pvigilance_event_substances" ("event_id")',
      'CREATE INDEX IF NOT EXISTS "pvigilance_event_substances_inn_idx" ON "pvigilance_event_substances" ("inn")',
      'CREATE INDEX IF NOT EXISTS "regional_authorizations_inn_idx" ON "regional_authorizations" ("inn")',
      'CREATE INDEX IF NOT EXISTS "regional_authorizations_region_idx" ON "regional_authorizations" ("region")',
    ]

    for (const idx of indexes) {
      await db.execute(sql.raw(idx))
    }
    console.log('✓ Created all indexes')

    console.log('\n✅ Pvigilance schema migration completed successfully!')

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

main()
