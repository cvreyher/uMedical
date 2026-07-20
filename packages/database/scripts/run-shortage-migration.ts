import 'dotenv/config'
import pg from 'pg'

const { Client } = pg

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Check and add columns one by one
    const columns = [
      { name: 'slug', type: 'TEXT UNIQUE' },
      { name: 'source_authority', type: "TEXT DEFAULT 'EMA'" },
      { name: 'region', type: "TEXT DEFAULT 'EU'" },
      { name: 'substance_id', type: 'INTEGER REFERENCES substances(id)' },
      { name: 'inn', type: 'TEXT' },
      { name: 'category', type: 'TEXT' },
      { name: 'medicine_affected', type: 'TEXT' },
      { name: 'therapeutic_area_mesh', type: 'TEXT' },
      { name: 'pharmaceutical_forms_affected', type: 'TEXT' },
      { name: 'strengths_affected', type: 'TEXT' },
      { name: 'availability_of_alternatives', type: 'TEXT' },
      { name: 'start_of_shortage_date', type: 'DATE' },
      { name: 'first_published_date', type: 'DATE' },
      { name: 'last_updated_date', type: 'DATE' },
      { name: 'shortage_data', type: 'JSONB' },
      { name: 'content_hash', type: 'TEXT' },
      { name: 'source_document_id', type: 'TEXT' },
    ]

    for (const col of columns) {
      try {
        // Check if column exists
        const checkResult = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'shortages' AND column_name = $1
        `, [col.name])

        if (checkResult.rows.length === 0) {
          await client.query(`ALTER TABLE shortages ADD COLUMN ${col.name} ${col.type}`)
          console.log(`✓ Added column: ${col.name}`)
        } else {
          console.log(`○ Column already exists: ${col.name}`)
        }
      } catch (err) {
        console.error(`✗ Error adding column ${col.name}:`, err instanceof Error ? err.message : err)
      }
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS shortages_authority_idx ON shortages(source_authority)',
      'CREATE INDEX IF NOT EXISTS shortages_region_idx ON shortages(region)',
      'CREATE INDEX IF NOT EXISTS shortages_inn_idx ON shortages(inn)',
      'CREATE INDEX IF NOT EXISTS shortages_substance_idx ON shortages(substance_id)',
      'CREATE INDEX IF NOT EXISTS shortages_start_date_idx ON shortages(start_of_shortage_date)',
      'CREATE INDEX IF NOT EXISTS shortages_slug_idx ON shortages(slug)',
      'CREATE INDEX IF NOT EXISTS shortages_authority_status_idx ON shortages(source_authority, status)',
    ]

    for (const idx of indexes) {
      try {
        await client.query(idx)
        console.log(`✓ Created index: ${idx.split(' ')[5]}`)
      } catch (err) {
        console.log(`○ Index may already exist: ${err instanceof Error ? err.message : err}`)
      }
    }

    // Show current table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'shortages'
      ORDER BY ordinal_position
    `)

    console.log('\n--- Current shortages table structure ---')
    for (const row of result.rows) {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`)
    }

    console.log('\n✓ Migration complete!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
