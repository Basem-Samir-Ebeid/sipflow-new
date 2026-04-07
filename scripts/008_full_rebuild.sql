-- =============================================
-- COMPLETE DATABASE REBUILD SCRIPT
-- This script drops all existing tables and recreates them with all features
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
DROP TABLE IF EXISTS staff_users CASCADE;

-- =============================================
-- CREATE DRINKS TABLE
-- =============================================
CREATE TABLE drinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  image_url TEXT,
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  table_number TEXT,
  role TEXT DEFAULT 'customer',
  assigned_tables TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE STAFF USERS TABLE
-- =============================================
CREATE TABLE staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE SESSIONS TABLE
-- =============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- CREATE ORDERS TABLE (with all columns)
-- =============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  total_price DECIMAL(10, 2) DEFAULT 0,
  sugar_level TEXT DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CREATE ADMIN MESSAGES TABLE
-- =============================================
CREATE TABLE admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  message TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_from_admin BOOLEAN DEFAULT TRUE,
  is_broadcast BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- =============================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_orders_session_id ON orders(session_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_drink_id ON orders(drink_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_inventory_drink_id ON inventory(drink_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_admin_messages_created_at ON admin_messages(created_at DESC);
CREATE INDEX idx_staff_users_username ON staff_users(username);

-- =============================================
-- INSERT DEFAULT SETTINGS
-- =============================================
INSERT INTO app_settings (key, value) VALUES ('max_order_receivers', '5');

-- =============================================
-- INSERT SAMPLE DRINKS DATA
-- =============================================
INSERT INTO drinks (name, price, category, sort_order) VALUES 
  ('شاي', 5, 'hot', 1),
  ('قهوة عربي', 10, 'hot', 2),
  ('نسكافيه', 15, 'hot', 3),
  ('كابتشينو', 20, 'hot', 4),
  ('لاتيه', 25, 'hot', 5),
  ('موكا', 25, 'hot', 6),
  ('هوت شوكليت', 20, 'hot', 7),
  ('عصير برتقال', 15, 'cold', 8),
  ('عصير مانجو', 20, 'cold', 9),
  ('ليمون بالنعناع', 15, 'cold', 10);

-- =============================================
-- INSERT INITIAL INVENTORY DATA (50 for each drink)
-- =============================================
INSERT INTO inventory (drink_id, quantity)
SELECT id, 50 FROM drinks;

-- =============================================
-- INSERT DEFAULT ADMIN USER
-- =============================================
INSERT INTO users (name, password, role) VALUES 
  ('admin', 'admin123', 'admin');

-- =============================================
-- INSERT DEFAULT STAFF USER
-- =============================================
INSERT INTO staff_users (username, password, name) VALUES 
  ('staff', 'staff123', 'موظف افتراضي');
