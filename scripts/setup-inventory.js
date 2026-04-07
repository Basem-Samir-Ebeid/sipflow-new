import { sql } from '@vercel/postgres';

async function setupInventory() {
  try {
    console.log('[v0] Checking if inventory table exists...');
    
    // Check if table exists
    const checkTable = await sql`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'inventory'
      )
    `;
    
    const tableExists = checkTable.rows[0]?.exists;
    
    if (!tableExists) {
      console.log('[v0] Creating inventory table...');
      await sql`
        CREATE TABLE inventory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          drink_id UUID NOT NULL UNIQUE REFERENCES drinks(id) ON DELETE CASCADE,
          quantity INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      console.log('[v0] Inventory table created!');
    } else {
      console.log('[v0] Inventory table already exists!');
    }
    
    console.log('[v0] Enabling RLS...');
    await sql`ALTER TABLE inventory ENABLE ROW LEVEL SECURITY`;
    
    console.log('[v0] Creating RLS policies...');
    await sql`CREATE POLICY IF NOT EXISTS "Allow public read inventory" ON inventory FOR SELECT USING (true)`;
    await sql`CREATE POLICY IF NOT EXISTS "Allow public insert inventory" ON inventory FOR INSERT WITH CHECK (true)`;
    await sql`CREATE POLICY IF NOT EXISTS "Allow public update inventory" ON inventory FOR UPDATE USING (true)`;
    await sql`CREATE POLICY IF NOT EXISTS "Allow public delete inventory" ON inventory FOR DELETE USING (true)`;
    
    console.log('[v0] Creating index...');
    await sql`CREATE INDEX IF NOT EXISTS idx_inventory_drink_id ON inventory(drink_id)`;
    
    console.log('[v0] Populating initial inventory...');
    await sql`
      INSERT INTO inventory (drink_id, quantity)
      SELECT id, 50 FROM drinks
      ON CONFLICT (drink_id) DO NOTHING
    `;
    
    console.log('[v0] ✓ Inventory system setup complete!');
  } catch (error) {
    console.error('[v0] Error:', error.message);
    throw error;
  }
}

setupInventory();
