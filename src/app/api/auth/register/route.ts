import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || username).trim();

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Email, password and username are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (username.length < 3 || username.length > 16) {
      return NextResponse.json({ error: 'Username must be 3–16 characters' }, { status: 400 });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: 'Username can only contain letters, numbers and underscore' }, { status: 400 });
    }

    // Test connection
    try {
      await sql`SELECT 1`;
    } catch (e: any) {
      return NextResponse.json({
        error: 'Cannot connect to database. Check DATABASE_URL in .env.local',
        detail: e?.message || String(e),
      }, { status: 503 });
    }

    // Check users table
    try {
      await sql`SELECT 1 FROM users LIMIT 0`;
    } catch (e: any) {
      return NextResponse.json({
        error: 'Database tables missing. Run schema.sql in Neon SQL Editor.',
        detail: e?.message || String(e),
      }, { status: 503 });
    }

    // Uniqueness
    const existing = await sql`
      SELECT id FROM users
      WHERE email = ${email} OR username = ${username}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email or username already taken' }, { status: 409 });
    }

    const id = randomUUID();
    const { hash, salt } = hashPassword(password);
    const seed = Math.random().toString(16).slice(2, 10);

    // Insert — try with display_name first, fall back without it
    try {
      await sql`
        INSERT INTO users (id, email, username, display_name, password_hash, password_salt, avatar_seed, is_guest)
        VALUES (${id}, ${email}, ${username}, ${displayName}, ${hash}, ${salt}, ${seed}, false)
      `;
    } catch (e: any) {
      if (e?.message?.includes('display_name') || e?.code === '42703') {
        // Column missing — insert without it
        await sql`
          INSERT INTO users (id, email, username, password_hash, password_salt, is_guest)
          VALUES (${id}, ${email}, ${username}, ${hash}, ${salt}, false)
        `;
      } else {
        throw e;
      }
    }

    // Seed ratings (non-fatal)
    for (const tc of ['bullet', 'blitz', 'rapid', 'classic']) {
      try {
        await sql`INSERT INTO ratings (user_id, time_control) VALUES (${id}, ${tc}) ON CONFLICT DO NOTHING`;
      } catch (_) {}
    }

    // Session
    let token: string;
    try {
      token = await createSession(id, true);
    } catch (e: any) {
      console.error('createSession failed:', e);
      return NextResponse.json({
        ok: true,
        username,
        warning: 'Account created but session failed. Try logging in.',
        detail: e?.message || String(e),
      });
    }

    const cookie = setSessionCookie(token, true);
    const res = NextResponse.json({ ok: true, username });
    res.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAge,
    });
    return res;
  } catch (e: any) {
    console.error('Register unexpected error:', e);
    return NextResponse.json({
      error: 'Server error during registration',
      detail: e?.message || String(e),
      code: e?.code || null,
    }, { status: 500 });
  }
}
