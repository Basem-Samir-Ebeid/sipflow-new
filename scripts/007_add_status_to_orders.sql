-- Add status column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add total_price column if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2) DEFAULT 0;

-- Add sugar_level column if it doesn't exist  
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sugar_level TEXT DEFAULT 'medium';

-- Add notes column if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add updated_at column if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Drop the unique constraint that prevents multiple orders of same drink
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_session_id_user_id_drink_id_key;
