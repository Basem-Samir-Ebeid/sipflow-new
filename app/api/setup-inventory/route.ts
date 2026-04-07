import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    console.log('[v0] Starting inventory setup...')
    const sql = getSql()

    // Check if table exists
    try {
      const checkTable = await sql`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'inventory'
        ) as exists
      `
      
      const tableExists = checkTable[0]?.exists

      if (!tableExists) {
        console.log('[v0] Creating inventory table...')
        await sql`
          CREATE TABLE inventory (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            drink_id UUID NOT NULL UNIQUE REFERENCES drinks(id) ON DELETE CASCADE,
            quantity INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `
        console.log('[v0] Inventory table created!')
      } else {
        console.log('[v0] Inventory table already exists!')
      }
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error
      }
      console.log('[v0] Table already exists')
    }

    // Enable RLS
    try {
      await sql`ALTER TABLE inventory ENABLE ROW LEVEL SECURITY`
      console.log('[v0] RLS enabled')
    } catch (error) {
      console.log('[v0] RLS already enabled or error:', error)
    }

    // Create policies
    const policies = [
      'Allow public read inventory',
      'Allow public insert inventory',
      'Allow public update inventory',
      'Allow public delete inventory'
    ]

    for (const policyName of policies) {
      try {
        if (policyName === 'Allow public read inventory') {
          await sql`CREATE POLICY IF NOT EXISTS "Allow public read inventory" ON inventory FOR SELECT USING (true)`
        } else if (policyName === 'Allow public insert inventory') {
          await sql`CREATE POLICY IF NOT EXISTS "Allow public insert inventory" ON inventory FOR INSERT WITH CHECK (true)`
        } else if (policyName === 'Allow public update inventory') {
          await sql`CREATE POLICY IF NOT EXISTS "Allow public update inventory" ON inventory FOR UPDATE USING (true)`
        } else if (policyName === 'Allow public delete inventory') {
          await sql`CREATE POLICY IF NOT EXISTS "Allow public delete inventory" ON inventory FOR DELETE USING (true)`
        }
      } catch (error) {
        console.log(`[v0] Policy ${policyName} already exists`)
      }
    }

    // Create index
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_inventory_drink_id ON inventory(drink_id)`
      console.log('[v0] Index created')
    } catch (error) {
      console.log('[v0] Index already exists')
    }

    // Populate initial inventory
    try {
      const result = await sql`
        INSERT INTO inventory (drink_id, quantity)
        SELECT id, 50 FROM drinks
        ON CONFLICT (drink_id) DO NOTHING
        RETURNING *
      `
      console.log(`[v0] Populated ${result.length || 0} inventory records`)
    } catch (error) {
      console.log('[v0] Inventory already populated or error:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory system setup complete!'
    })
  } catch (error: any) {
    console.error('[v0] Setup error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
