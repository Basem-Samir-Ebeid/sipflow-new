-- Migration: Add multi-tenant places system
-- Run once to add places support

-- 1. Create places table
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add place_id to existing tables (nullable so existing data is not broken)
ALTER TABLE drinks ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE CASCADE;
ALTER TABLE admin_messages ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id) ON DELETE CASCADE;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drinks_place_id ON drinks(place_id);
CREATE INDEX IF NOT EXISTS idx_users_place_id ON users(place_id);
CREATE INDEX IF NOT EXISTS idx_sessions_place_id ON sessions(place_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_place_id ON admin_messages(place_id);
