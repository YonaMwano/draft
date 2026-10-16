-- Run this in Neon SQL Editor to fix the missing column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Also make sure other useful columns exist
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_seed TEXT DEFAULT encode(gen_random_bytes(8), 'hex');

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country CHAR(2);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
