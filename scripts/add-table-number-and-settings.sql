-- Add table_number to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS table_number INTEGER;

-- Create settings table for admin configurations
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default max_order_receivers setting
INSERT INTO app_settings (key, value) 
VALUES ('max_order_receivers', '5')
ON CONFLICT (key) DO NOTHING;
