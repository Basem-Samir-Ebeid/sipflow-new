-- Ensure customer_name and table_number columns exist in orders table
-- These columns store the customer name and table number entered during order submission

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number TEXT;

-- Add indexes for faster lookups on these columns
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_table_number ON orders(table_number);

-- Create an index on (customer_name, table_number) for grouping in the bar
CREATE INDEX IF NOT EXISTS idx_orders_customer_table ON orders(customer_name, table_number);
