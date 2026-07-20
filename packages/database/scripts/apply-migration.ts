import 'dotenv/config'
import { readFileSync } from 'fs'
import { Pool } from 'pg'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const migrationPath = join(__dirname, '../drizzle/0002_spooky_boomerang.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  // Split by statement breakpoint
  const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)

  console.log(`Found ${statements.length} statements to execute`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (!stmt) continue

    // Skip if it's trying to create a table that already exists
    const createTableMatch = stmt.match(/CREATE TABLE "(\w+)"/)
    if (createTableMatch) {
      const tableName = createTableMatch[1]
      const exists = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [tableName]
      )
      if (exists.rows[0]?.exists) {
        console.log(`Skipping: Table "${tableName}" already exists`)
        continue
      }
    }

    // Skip if it's an ALTER TABLE for a constraint that might already exist
    const alterTableMatch = stmt.match(/ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)"/)
    if (alterTableMatch) {
      const constraintName = alterTableMatch[2]
      const exists = await pool.query(
        `SELECT EXISTS (SELECT FROM pg_constraint WHERE conname = $1)`,
        [constraintName]
      )
      if (exists.rows[0]?.exists) {
        console.log(`Skipping: Constraint "${constraintName}" already exists`)
        continue
      }
    }

    // Skip if it's a CREATE INDEX for an index that might already exist
    const createIndexMatch = stmt.match(/CREATE INDEX "(\w+)"/)
    if (createIndexMatch) {
      const indexName = createIndexMatch[1]
      const exists = await pool.query(
        `SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = $1)`,
        [indexName]
      )
      if (exists.rows[0]?.exists) {
        console.log(`Skipping: Index "${indexName}" already exists`)
        continue
      }
    }

    try {
      await pool.query(stmt)
      console.log(`✓ Executed statement ${i + 1}/${statements.length}`)
    } catch (error) {
      console.error(`✗ Failed statement ${i + 1}:`, error instanceof Error ? error.message : error)
      console.error('Statement:', stmt.substring(0, 100) + '...')
    }
  }

  // Insert default categories
  const categoriesExist = await pool.query(
    `SELECT COUNT(*) FROM product_categories`
  )
  if (parseInt(categoriesExist.rows[0]?.count) === 0) {
    console.log('Inserting default categories...')
    await pool.query(`
      INSERT INTO product_categories (slug, name, description) VALUES
      ('human', 'Human', 'Human medicinal products'),
      ('veterinary', 'Veterinary', 'Veterinary medicinal products')
      ON CONFLICT (slug) DO NOTHING
    `)
  }

  console.log('Migration completed!')
  await pool.end()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
