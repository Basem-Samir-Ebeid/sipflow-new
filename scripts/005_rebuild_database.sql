-- =============================================
-- COMPLETE DATABASE REBUILD SCRIPT
-- This script drops all existing tables and recreates them
-- =============================================

-- Drop all existing tables with cascade
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS drinks CASCADE;
DROP TABLE IF EXISTS admin_messages CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- =============================================
-- CREATE DRINKS TABLE
-- =============================================
CREATE TABLE drinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE INVENTORY TABLE
-- =============================================
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_id UUID NOT NULL UNIQUE REFERENCES drinks(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE USERS TABLE
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  password TEXT,
  table_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE SESSIONS TABLE
-- =============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE ORDERS TABLE
-- =============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id, drink_id)
);

-- =============================================
-- CREATE ADMIN MESSAGES TABLE
-- =============================================
CREATE TABLE admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_admin_messages_created_at ON admin_messages(created_at DESC);

-- =============================================
-- CREATE APP SETTINGS TABLE
-- =============================================
CREATE TABLE app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (key, value) VALUES ('max_order_receivers', '5');

-- =============================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_orders_session_id ON orders(session_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_drink_id ON orders(drink_id);
CREATE INDEX idx_inventory_drink_id ON inventory(drink_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_users_name ON users(name);

-- =============================================
-- DISABLE ROW LEVEL SECURITY FOR PUBLIC ACCESS
-- (This app uses custom auth, not Supabase Auth)
-- =============================================
ALTER TABLE drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this app doesn't use Supabase Auth)
CREATE POLICY "Allow public read drinks" ON drinks FOR SELECT USING (true);
CREATE POLICY "Allow public insert drinks" ON drinks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update drinks" ON drinks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete drinks" ON drinks FOR DELETE USING (true);

CREATE POLICY "Allow public read inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "Allow public insert inventory" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update inventory" ON inventory FOR UPDATE USING (true);
CREATE POLICY "Allow public delete inventory" ON inventory FOR DELETE USING (true);

CREATE POLICY "Allow public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete users" ON users FOR DELETE USING (true);

CREATE POLICY "Allow public read sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update sessions" ON sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete sessions" ON sessions FOR DELETE USING (true);

CREATE POLICY "Allow public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete orders" ON orders FOR DELETE USING (true);

CREATE POLICY "Allow public read admin_messages" ON admin_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert admin_messages" ON admin_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update admin_messages" ON admin_messages FOR UPDATE USING (true);
CREATE POLICY "Allow public delete admin_messages" ON admin_messages FOR DELETE USING (true);

CREATE POLICY "Allow public read app_settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_settings" ON app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_settings" ON app_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete app_settings" ON app_settings FOR DELETE USING (true);

-- =============================================
-- INSERT SAMPLE DRINKS DATA
-- =============================================
INSERT INTO drinks (name, price, sort_order) VALUES 
  ('شاي', 5, 1),
  ('قهوة عربي', 10, 2),
  ('نسكافيه', 15, 3),
  ('كابتشينو', 20, 4),
  ('لاتيه', 25, 5),
  ('موكا', 25, 6),
  ('هوت شوكليت', 20, 7),
  ('عصير برتقال', 15, 8),
  ('عصير مانجو', 20, 9),
  ('ليمون بالنعناع', 15, 10);

-- =============================================
-- INSERT INITIAL INVENTORY DATA
-- =============================================
INSERT INTO inventory (drink_id, quantity)
SELECT id, 50 FROM drinks;
