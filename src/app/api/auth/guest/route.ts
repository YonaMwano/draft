import { NextResponse } from 'next/server';
import { createGuestUser, setSessionCookie } from '@/lib/auth';

export async function POST() {
  try {
    const { token } = await createGuestUser();
    const cookie = setSessionCookie(token, false);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookie);
    return res;
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 });
  }
}
