import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';

// Prefer the Neon serverless driver for edge/serverless environments.
// Fall back to classic pg Pool when running long-lived Node processes.

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_iqvp0txLzR2D@ep-young-unit-b5ed0dyi-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Serverless-friendly query helper (HTTP / WebSocket)
export const sql = neon(connectionString);

// Classic Pool for scripts / long-running handlers that need transactions
let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

export type User = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_seed: string;
  country: string | null;
  is_guest: boolean;
  created_at: string;
  last_seen_at: string;
};

export type GameRow = {
  id: string;
  white_id: string | null;
  black_id: string | null;
  status: 'waiting' | 'active' | 'finished' | 'aborted';
  result: string | null;
  result_reason: string | null;
  time_control: string;
  initial_ms: number;
  increment_ms: number;
  is_rated: boolean;
  current_fen: string;
  ply_count: number;
  white_ms_left: number | null;
  black_ms_left: number | null;
  last_move_at: string | null;
  created_at: string;
  finished_at: string | null;
  challenge_code: string | null;
};
