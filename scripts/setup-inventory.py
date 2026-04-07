#!/usr/bin/env python3
import os
import psycopg2
from psycopg2.extras import execute_values

# Get database connection string from environment
db_url = os.getenv('POSTGRES_URL')
if not db_url:
    raise ValueError("POSTGRES_URL environment variable not set")

# Connect to database
conn = psycopg2.connect(db_url)
cursor = conn.cursor()

try:
    print("[v0] Checking if inventory table exists...")
    cursor.execute("""
        SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'inventory'
        )
    """)
    table_exists = cursor.fetchone()[0]
    
    if table_exists:
        print("[v0] Inventory table already exists, skipping creation...")
    else:
        print("[v0] Creating inventory table...")
        cursor.execute("""
            CREATE TABLE inventory (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                drink_id UUID NOT NULL UNIQUE REFERENCES drinks(id) ON DELETE CASCADE,
                quantity INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        conn.commit()
        print("[v0] Inventory table created successfully!")
    
    print("[v0] Enabling RLS on inventory table...")
    cursor.execute("ALTER TABLE inventory ENABLE ROW LEVEL SECURITY")
    conn.commit()
    
    print("[v0] Creating RLS policies...")
    policies = [
        'CREATE POLICY IF NOT EXISTS "Allow public read inventory" ON inventory FOR SELECT USING (true)',
        'CREATE POLICY IF NOT EXISTS "Allow public insert inventory" ON inventory FOR INSERT WITH CHECK (true)',
        'CREATE POLICY IF NOT EXISTS "Allow public update inventory" ON inventory FOR UPDATE USING (true)',
        'CREATE POLICY IF NOT EXISTS "Allow public delete inventory" ON inventory FOR DELETE USING (true)'
    ]
    
    for policy in policies:
        cursor.execute(policy)
    conn.commit()
    print("[v0] RLS policies created!")
    
    print("[v0] Creating index on drink_id...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inventory_drink_id ON inventory(drink_id)")
    conn.commit()
    
    print("[v0] Populating initial inventory data...")
    cursor.execute("""
        INSERT INTO inventory (drink_id, quantity)
        SELECT id, 50 FROM drinks
        ON CONFLICT (drink_id) DO NOTHING
    """)
    conn.commit()
    print("[v0] Inventory data populated!")
    
    print("[v0] ✓ Inventory system setup complete!")
    
except Exception as e:
    conn.rollback()
    print(f"[v0] ERROR: {str(e)}")
    raise
finally:
    cursor.close()
    conn.close()
