import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { sql } from './db';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me-in-production-32chars!!';
const SESSION_DAYS_LONG = 30;
const SESSION_DAYS_SHORT = 1;

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  if (derived.length !== hashBuf.length) return false;
  return timingSafeEqual(derived, hashBuf);
}

function hmacToken(token: string): string {
  return createHash('sha256').update(token + SESSION_SECRET).digest('hex');
}

export async function createSession(
  userId: string,
  rememberMe = false,
  userAgent?: string,
  ip?: string
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hmacToken(token);
  const days = rememberMe ? SESSION_DAYS_LONG : SESSION_DAYS_SHORT;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_hash)
    VALUES (${userId}, ${tokenHash}, ${expires.toISOString()}, ${userAgent ?? null}, ${ip ? createHash('sha256').update(ip).digest('hex') : null})
  `;

  return token;
}

export async function getSessionUser(): Promise<{ id: string; username: string | null; is_guest: boolean } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;

  const tokenHash = hmacToken(token);
  const rows = await sql`
    SELECT u.id, u.username, u.is_guest
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > now()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rows[0] as any;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return;
  const tokenHash = hmacToken(token);
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
  cookieStore.delete('session');
}

export function setSessionCookie(token: string, rememberMe: boolean) {
  // Called from Route Handlers
  const days = rememberMe ? SESSION_DAYS_LONG : SESSION_DAYS_SHORT;
  const maxAge = days * 24 * 60 * 60;
  return {
    name: 'session',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function createGuestUser(): Promise<{ id: string; token: string }> {
  const id = randomUUID();
  const seed = randomBytes(8).toString('hex');
  await sql`
    INSERT INTO users (id, is_guest, avatar_seed, username)
    VALUES (${id}, true, ${seed}, ${'guest_' + seed.slice(0, 6)})
  `;
  // seed ratings
  for (const tc of ['bullet', 'blitz', 'rapid', 'classic']) {
    await sql`INSERT INTO ratings (user_id, time_control) VALUES (${id}, ${tc}) ON CONFLICT DO NOTHING`;
  }
  const token = await createSession(id, false);
  return { id, token };
}
