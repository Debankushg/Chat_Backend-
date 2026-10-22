-- Group chats reuse the chats / chat_members tables.
ALTER TABLE chats ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE chats ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE chats ALTER COLUMN user_a_id DROP NOT NULL;
ALTER TABLE chats ALTER COLUMN user_b_id DROP NOT NULL;

ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_distinct_users;
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_type_check;
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_shape;
ALTER TABLE chats ADD CONSTRAINT chats_type_check CHECK (type IN ('direct', 'group'));
ALTER TABLE chats ADD CONSTRAINT chats_shape CHECK (
  (type = 'direct' AND user_a_id IS NOT NULL AND user_b_id IS NOT NULL AND user_a_id < user_b_id)
  OR
  (type = 'group' AND user_a_id IS NULL AND user_b_id IS NULL AND name IS NOT NULL)
);

ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE chat_members DROP CONSTRAINT IF EXISTS chat_members_role_check;
ALTER TABLE chat_members ADD CONSTRAINT chat_members_role_check CHECK (role IN ('admin', 'member'));
