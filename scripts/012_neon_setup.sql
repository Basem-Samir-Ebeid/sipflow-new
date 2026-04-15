-- =============================================
-- NEON DATABASE COMPLETE SETUP SCRIPT
-- Creates all tables with all features including places (multi-tenant)
-- =============================================

-- Drop existing tables if they exist (for fresh start)
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS dev_notifications CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS admin_messages CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS company_employees CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS staff_users CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS drinks CASCADE;
DROP TABLE IF EXISTS places CASCADE;

-- =============================================
-- CREATE PLACES TABLE (Multi-tenant support)
-- =============================================
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  logo_url TEXT,
  table_count INTEGER DEFAULT 10,
  service_charge NUMERIC(5,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  reservations_enabled BOOLEAN DEFAULT false,
  order_tracking_enabled BOOLEAN DEFAULT true,
  place_type TEXT DEFAULT 'cafe',
  free_drinks_count INTEGER DEFAULT 0,
  free_drink_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
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
  name TEXT NOT NULL,
  password TEXT,
  table_number TEXT,
  role TEXT DEFAULT 'customer',
  assigned_tables TEXT[],
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
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
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'cashier',
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
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- CREATE COMPANY EMPLOYEES TABLE
-- =============================================
CREATE TABLE company_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  status TEXT DEFAULT 'pending',
  total_price DECIMAL(10, 2) DEFAULT 0,
  sugar_level TEXT DEFAULT 'medium',
  notes TEXT,
  customer_name TEXT,
  table_number TEXT,
  customer_phone TEXT,
  employee_id UUID REFERENCES company_employees(id) ON DELETE SET NULL,
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
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
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
-- CREATE CLIENTS TABLE (for dev admin)
-- =============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  place_name TEXT,
  subscription TEXT DEFAULT 'monthly',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CREATE DEV NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE dev_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT,
  place_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CREATE RESERVATIONS TABLE
-- =============================================
CREATE TABLE reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  reserved_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  table_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
CREATE INDEX idx_drinks_place_id ON drinks(place_id);
CREATE INDEX idx_users_place_id ON users(place_id);
CREATE INDEX idx_sessions_place_id ON sessions(place_id);
CREATE INDEX idx_admin_messages_place_id ON admin_messages(place_id);
CREATE INDEX idx_reservations_place_id ON reservations(place_id);

-- =============================================
-- INSERT DEFAULT SETTINGS
-- =============================================
INSERT INTO app_settings (key, value) VALUES ('max_order_receivers', '5')
ON CONFLICT (key) DO NOTHING;
