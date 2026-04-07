-- Create messages table for admin to send messages to users
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_broadcast BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_target_user ON messages(target_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_broadcast ON messages(is_broadcast);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
