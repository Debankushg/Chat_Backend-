CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1:1 chats. The pair is stored in canonical order (user_a_id < user_b_id)
-- so the UNIQUE constraint guarantees exactly one chat per pair.
CREATE TABLE IF NOT EXISTS chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chats_distinct_users CHECK (user_a_id < user_b_id),
  CONSTRAINT chats_pair_unique UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id   UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_members_user_idx ON chat_members (user_id);
