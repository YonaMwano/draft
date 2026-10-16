import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '../../db';
import { onlineRooms } from '../../db/schema';

export { db, onlineRooms };
export type Room = typeof onlineRooms.$inferSelect;
export async function seatIdentity() {
  const jar = await cookies();
  const existing = jar.get('draft_player')?.value;
  return existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();
}
export function roomResponse(room: Room, seat: string) {
  const elapsed = room.status === 'active' ? Math.max(0, Date.now() - room.updatedAt.getTime()) : 0;
  return NextResponse.json({
    gameId: room.id, code: room.code, status: room.status,
    role: room.whiteSeat === seat ? 'white' : room.blackSeat === seat ? 'black' : null,
    pieces: room.pieces, history: room.history, turn: room.turn,
    winner: room.winner, reason: room.reason, revision: room.revision,
    initialMs: room.initialMs, incrementMs: room.incrementMs,
    whiteMs: Math.max(0, room.whiteMs - (room.turn === 'white' ? elapsed : 0)),
    blackMs: Math.max(0, room.blackMs - (room.turn === 'black' ? elapsed : 0)),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
export function withSeat(response: NextResponse, seat: string) {
  response.cookies.set('draft_player', seat, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return response;
}
