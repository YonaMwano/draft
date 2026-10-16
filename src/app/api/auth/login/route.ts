import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password, remember } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, password_hash, password_salt, username, is_guest
      FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = rows[0] as any;
    if (!user.password_hash || !user.password_salt) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createSession(user.id, !!remember);
    const res = NextResponse.json({ ok: true, username: user.username });
    res.cookies.set(setSessionCookie(token, !!remember));
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
