-- Drop existing policies first
DROP POLICY IF EXISTS "Allow all access to drinks" ON drinks;
DROP POLICY IF EXISTS "Allow all access to users" ON users;
DROP POLICY IF EXISTS "Allow all access to sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all access to orders" ON orders;

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS drinks CASCADE;

-- Create drinks table
CREATE TABLE drinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id, drink_id)
);

-- Insert default drinks
INSERT INTO drinks (name, price, image_url, sort_order) VALUES
  ('شاي', 5.00, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200', 1),
  ('قهوة', 10.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200', 2),
  ('نسكافيه', 8.00, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=200', 3),
  ('كابتشينو', 15.00, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=200', 4),
  ('ينسون', 5.00, 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=200', 5),
  ('كركديه', 5.00, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200', 6);

-- Enable Row Level Security
ALTER TABLE drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a simple app without auth)
CREATE POLICY "Allow all access to drinks" ON drinks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to orders" ON orders FOR ALL USING (true) WITH CHECK (true);
