import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join } from 'path'

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const sql = neon(databaseUrl)
  
  console.log('Running database migration...')
  
  try {
    const migrationPath = join(__dirname, '001-create-database.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    // Split by semicolons and filter empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      if (statement) {
        console.log('Executing:', statement.substring(0, 50) + '...')
        await sql([statement] as unknown as TemplateStringsArray)
      }
    }
    
    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
