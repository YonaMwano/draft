-- ============================================================
-- Online Drafts — 10×10 International  |  Neon Postgres Schema
-- Paste this entire file into Neon SQL Editor and run it.
-- ============================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE,
  username        CITEXT UNIQUE,
  display_name    TEXT,
  password_hash   TEXT,
  password_salt   TEXT,
  avatar_seed     TEXT NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  country         CHAR(2),
  is_guest        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_username_len CHECK (username IS NULL OR (char_length(username) BETWEEN 3 AND 16))
);

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_users_guest ON users (is_guest) WHERE is_guest = true;

-- ------------------------------------------------------------
-- SESSIONS (hand-rolled, HMAC-signed cookies reference these)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  user_agent      TEXT,
  ip_hash         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- ------------------------------------------------------------
-- OAUTH ACCOUNTS (Google / Apple via hand-rolled PKCE)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,          -- 'google' | 'apple'
  provider_account_id TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);

-- ------------------------------------------------------------
-- RATINGS (per time-control Elo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_control    TEXT NOT NULL CHECK (time_control IN ('bullet','blitz','rapid','classic','correspondence')),
  rating          INTEGER NOT NULL DEFAULT 1500,
  rd              INTEGER NOT NULL DEFAULT 350,   -- Glicko rating deviation (kept for future)
  games_played    INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, time_control)
);

CREATE INDEX IF NOT EXISTS idx_ratings_leaderboard
  ON ratings (time_control, rating DESC);

-- ------------------------------------------------------------
-- GAMES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_id        UUID REFERENCES users(id),
  black_id        UUID REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','active','finished','aborted')),
  result          TEXT CHECK (result IN ('1-0','0-1','1/2-1/2','*')),
  result_reason   TEXT,                          -- 'resignation','timeout','no_moves','25_move','threefold', etc.
  time_control    TEXT NOT NULL DEFAULT 'blitz',
  initial_ms      INTEGER NOT NULL DEFAULT 180000, -- 3 min
  increment_ms    INTEGER NOT NULL DEFAULT 2000,   -- +2s
  is_rated        BOOLEAN NOT NULL DEFAULT true,
  current_fen     TEXT NOT NULL DEFAULT '',        -- cache; source of truth is moves
  ply_count       INTEGER NOT NULL DEFAULT 0,
  white_ms_left   INTEGER,
  black_ms_left   INTEGER,
  last_move_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  challenge_code  TEXT UNIQUE                     -- for private challenges
);

CREATE INDEX IF NOT EXISTS idx_games_status_created ON games (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_white ON games (white_id);
CREATE INDEX IF NOT EXISTS idx_games_black ON games (black_id);
CREATE INDEX IF NOT EXISTS idx_games_challenge ON games (challenge_code) WHERE challenge_code IS NOT NULL;

-- ------------------------------------------------------------
-- MOVES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moves (
  id              BIGSERIAL PRIMARY KEY,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply             INTEGER NOT NULL,
  from_sq         SMALLINT NOT NULL,             -- 0-49 (dark squares only) or algebraic
  to_sq           SMALLINT NOT NULL,
  path            JSONB NOT NULL DEFAULT '[]',   -- full hop path for multi-captures
  captures        JSONB NOT NULL DEFAULT '[]',   -- squares of captured pieces
  is_king_move    BOOLEAN NOT NULL DEFAULT false,
  ms_spent        INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, ply)
);

CREATE INDEX IF NOT EXISTS idx_moves_game_ply ON moves (game_id, ply);

-- ------------------------------------------------------------
-- RATING HISTORY
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rating_history (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  time_control    TEXT NOT NULL,
  before_rating   INTEGER NOT NULL,
  after_rating    INTEGER NOT NULL,
  delta           INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history (user_id, created_at DESC);

-- ------------------------------------------------------------
-- FRIENDSHIPS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','blocked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships (friend_id, status);

-- ------------------------------------------------------------
-- CHALLENGES (room links / codes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,          -- 6-char uppercase
  challenger_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id     UUID REFERENCES users(id),
  time_control    TEXT NOT NULL DEFAULT 'blitz',
  is_rated        BOOLEAN NOT NULL DEFAULT true,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_code ON challenges (code);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges (expires_at);

-- ------------------------------------------------------------
-- CHAT MESSAGES (last 200 per game retained by app logic)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id              BIGSERIAL PRIMARY KEY,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_game_created ON chat_messages (game_id, created_at DESC);

-- ------------------------------------------------------------
-- PUZZLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS puzzles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fen             TEXT NOT NULL,
  solution_path   JSONB NOT NULL,                -- array of moves
  difficulty      SMALLINT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  times_solved    INTEGER NOT NULL DEFAULT 0,
  times_attempted INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- ACHIEVEMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,                 -- e.g. 'first_king', '5_win_streak'
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- ------------------------------------------------------------
-- REPORTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID NOT NULL REFERENCES users(id),
  reported_id     UUID NOT NULL REFERENCES users(id),
  game_id         UUID REFERENCES games(id),
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','actioned','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- HELPER: purge old guest accounts (run periodically)
-- ------------------------------------------------------------
-- DELETE FROM users WHERE is_guest = true AND last_seen_at < now() - INTERVAL '30 days';

-- ------------------------------------------------------------
-- HELPER: seed initial ratings for a new user
-- ------------------------------------------------------------
-- INSERT INTO ratings (user_id, time_control) VALUES
--   ($1, 'bullet'), ($1, 'blitz'), ($1, 'rapid'), ($1, 'classic');

COMMENT ON TABLE games IS 'Source of truth for finished games is the moves table; current_fen is a cache.';
COMMENT ON COLUMN moves.path IS 'Full sequence of squares for multi-hop captures, e.g. [32, 23, 14]';
