import { NextResponse } from 'next/server';
import { randomInt, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, onlineRooms, seatIdentity, roomResponse, withSeat } from '@/lib/onlineRoom';
import { LocalGame } from '@/lib/localEngine';
export const dynamic = 'force-dynamic';
const controls: Record<string, [number, number]> = { bullet: [60000, 0], blitz3: [180000, 2000], blitz5: [300000, 3000], rapid: [600000, 5000], classic: [1200000, 10000] };
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const [initialMs, incrementMs] = controls[body.timeControl] || controls.blitz3;
    const seat = await seatIdentity();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
      const [room] = await db.insert(onlineRooms).values({ id: randomUUID(), code, whiteSeat: seat, pieces: new LocalGame().getPieces(), history: [], initialMs, incrementMs, whiteMs: initialMs, blackMs: initialMs, expiresAt: new Date(Date.now() + 3600000) }).onConflictDoNothing().returning();
      if (room) return withSeat(roomResponse(room, seat), seat);
    }
    throw new Error('Code allocation failed');
  } catch {
    return NextResponse.json({ error: 'Unable to create an online room. Please try again.' }, { status: 503 });
  }
}
export async function GET(req: Request) {
  try {
    const code = (new URL(req.url).searchParams.get('code') || '').trim().toUpperCase();
    const [room] = await db.select().from(onlineRooms).where(eq(onlineRooms.code, code));
    if (!room || (room.status === 'waiting' && room.expiresAt < new Date())) return NextResponse.json({ error: 'Code not found or expired' }, { status: 404 });
    return roomResponse(room, await seatIdentity());
  } catch { return NextResponse.json({ error: 'Connection unavailable. Please retry.' }, { status: 503 }); }
}
