CREATE TABLE IF NOT EXISTS room_sync (
  code text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  event jsonb,
  white_seen timestamptz,
  black_seen timestamptz
);
