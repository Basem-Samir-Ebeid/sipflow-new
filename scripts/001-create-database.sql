-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS admin_messages CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS staff_users CASCADE;
DROP TABLE IF EXISTS drinks CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  table_number VARCHAR(50),
  device_id VARCHAR(255),
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'order_receiver', 'admin')),
  assigned_tables TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create drinks table
CREATE TABLE drinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) DEFAULT 0,
  category VARCHAR(100) DEFAULT 'general',
  image_url TEXT,
  available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  drink_id UUID NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  sugar_level VARCHAR(50) DEFAULT 'normal',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'completed', 'cancelled')),
  total_price DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_messages table
CREATE TABLE admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255),
  message TEXT NOT NULL,
  is_from_admin BOOLEAN DEFAULT true,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create staff_users table
CREATE TABLE staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create app_settings table
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_orders_session_id ON orders(session_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_drink_id ON orders(drink_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_drinks_sort_order ON drinks(sort_order);
CREATE INDEX idx_admin_messages_created_at ON admin_messages(created_at);
CREATE INDEX idx_app_settings_key ON app_settings(key);

-- Insert default settings
INSERT INTO app_settings (key, value) VALUES ('max_order_receivers', '5');

-- Insert sample drinks
INSERT INTO drinks (name, price, sort_order, category) VALUES 
  ('شاي', 5, 1, 'hot'),
  ('قهوة', 10, 2, 'hot'),
  ('نسكافيه', 15, 3, 'hot'),
  ('كابتشينو', 20, 4, 'hot'),
  ('لاتيه', 25, 5, 'hot'),
  ('شاي أخضر', 8, 6, 'hot'),
  ('عصير برتقال', 15, 7, 'cold'),
  ('عصير مانجو', 18, 8, 'cold'),
  ('ليمون نعناع', 12, 9, 'cold'),
  ('موهيتو', 20, 10, 'cold');
