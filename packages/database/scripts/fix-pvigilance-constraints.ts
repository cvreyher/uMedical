import 'dotenv/config'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
  console.log('Fixing pvigilance unique constraints...')

  try {
    // 1. Check and fix pvigilance_event_products
    console.log('\n1. Checking pvigilance_event_products...')
    
    // Check if constraint already exists
    const productsConstraintExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pvigilance_event_products_unique'
      )
    `)
    
    const constraintExists = (productsConstraintExists.rows[0] as { exists: boolean })?.exists
    
    if (!constraintExists) {
      console.log('  Constraint does not exist. Checking for duplicates...')
      
      // Find duplicates
      const duplicates = await db.execute(sql`
        SELECT event_id, product_id, COUNT(*) as count, array_agg(id ORDER BY id) as ids
        FROM pvigilance_event_products
        GROUP BY event_id, product_id
        HAVING COUNT(*) > 1
      `)
      
      if (duplicates.rows.length > 0) {
        console.log(`  Found ${duplicates.rows.length} duplicate groups. Removing duplicates...`)
        
        // Keep the first record (lowest id) and delete the rest
        for (const row of duplicates.rows) {
          const ids = row.ids as number[]
          const keepId = ids[0]
          const deleteIds = ids.slice(1)
          
          if (deleteIds.length > 0) {
            await pool.query(
              'DELETE FROM pvigilance_event_products WHERE id = ANY($1)',
              [deleteIds]
            )
            console.log(`  Removed ${deleteIds.length} duplicates for event_id=${row.event_id}, product_id=${row.product_id}`)
          }
        }
      }
      
      // Now add the constraint
      console.log('  Adding unique constraint...')
      await db.execute(sql`
        ALTER TABLE pvigilance_event_products
        ADD CONSTRAINT pvigilance_event_products_unique 
        UNIQUE (event_id, product_id)
      `)
      console.log('  ✓ Added pvigilance_event_products_unique constraint')
    } else {
      console.log('  ✓ Constraint already exists')
    }

    // 2. Check and fix pvigilance_event_substances
    console.log('\n2. Checking pvigilance_event_substances...')
    
    const substancesConstraintExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pvigilance_event_substances_unique'
      )
    `)
    
    const substancesConstraintExistsResult = (substancesConstraintExists.rows[0] as { exists: boolean })?.exists
    
    if (!substancesConstraintExistsResult) {
      console.log('  Constraint does not exist. Checking for duplicates...')
      
      // Find duplicates
      const duplicates = await db.execute(sql`
        SELECT event_id, inn, COUNT(*) as count, array_agg(id ORDER BY id) as ids
        FROM pvigilance_event_substances
        GROUP BY event_id, inn
        HAVING COUNT(*) > 1
      `)
      
      if (duplicates.rows.length > 0) {
        console.log(`  Found ${duplicates.rows.length} duplicate groups. Removing duplicates...`)
        
        // Keep the first record (lowest id) and delete the rest
        for (const row of duplicates.rows) {
          // array_agg returns as string, parse it
          const ids = typeof row.ids === 'string'
            ? JSON.parse(row.ids.replace(/{/g, '[').replace(/}/g, ']')) as number[]
            : (row.ids as number[])
          const keepId = ids[0]
          const deleteIds = ids.slice(1)
          
          if (deleteIds.length > 0) {
            await pool.query(
              'DELETE FROM pvigilance_event_substances WHERE id = ANY($1)',
              [deleteIds]
            )
            console.log(`  Removed ${deleteIds.length} duplicates for event_id=${row.event_id}, inn=${row.inn}`)
          }
        }
      }
      
      // Now add the constraint
      console.log('  Adding unique constraint...')
      await db.execute(sql`
        ALTER TABLE pvigilance_event_substances
        ADD CONSTRAINT pvigilance_event_substances_unique 
        UNIQUE (event_id, inn)
      `)
      console.log('  ✓ Added pvigilance_event_substances_unique constraint')
    } else {
      console.log('  ✓ Constraint already exists')
    }

    console.log('\n✅ All constraints fixed successfully!')
  } catch (error) {
    console.error('❌ Error fixing constraints:', error)
    throw error
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
