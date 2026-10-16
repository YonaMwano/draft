import { NextResponse } from 'next/server';
import { randomUUID, randomInt } from 'node:crypto';
import { LocalGame } from '@/lib/localEngine';
import { db, multiplayerRooms, newSeat, hashSeat, seatCookie, findRoom } from '@/lib/rooms';
const controls: Record<string, [number, number]> = {
  bullet: [60000, 0], blitz3: [180000, 2000], blitz5: [300000, 3000],
  rapid: [600000, 5000], classic: [1200000, 10000],
};
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tc = Object.hasOwn(controls, body.timeControl) ? body.timeControl : 'blitz3';
    const [initial, increment] = controls[tc];
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const id = randomUUID();
    const token = newSeat();
    await db.insert(multiplayerRooms).values({ id, code, hostHash: hashSeat(token),
      timeControl: tc, incrementMs: increment, expiresAt: new Date(Date.now() + 14400000),
      state: { pieces: new LocalGame().getPieces(), turn: 'white', status: 'waiting',
        winner: null, resultReason: null, whiteMs: initial, blackMs: initial, ply: 0, updatedAt: Date.now() },
    });
    const response = NextResponse.json({ ok: true, code, gameId: id });
    response.cookies.set(seatCookie(code, token));
    return response;
  } catch {
    return NextResponse.json({ error: 'Room creation is unavailable. Please try again.' }, { status: 503 });
  }
}
export async function GET(req: Request) {
  try {
    const code = (new URL(req.url).searchParams.get('code') || '').trim().toUpperCase();
    const room = await findRoom(code);
    if (!room) return NextResponse.json({ error: 'Code not found or expired' }, { status: 404 });
    return NextResponse.json({ gameId: room.id, code, status: room.state.status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Room lookup is unavailable.' }, { status: 503 });
  }
}
