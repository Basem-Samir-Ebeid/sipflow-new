-- Add inventory table migration
-- This script adds inventory management to the database

-- Create inventory table if it doesn't exist
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_id UUID NOT NULL UNIQUE REFERENCES drinks(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on inventory table
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for inventory
CREATE POLICY IF NOT EXISTS "Allow public read inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert inventory" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update inventory" ON inventory FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow public delete inventory" ON inventory FOR DELETE USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_drink_id ON inventory(drink_id);

-- Insert initial inventory data for all existing drinks
INSERT INTO inventory (drink_id, quantity)
SELECT id, 50 FROM drinks
ON CONFLICT (drink_id) DO NOTHING;
