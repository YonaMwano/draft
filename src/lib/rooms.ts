import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db';
import { multiplayerRooms, type RoomState } from '../../db/schema';

export { db, multiplayerRooms, and, eq, gt };
export const hashSeat = (token: string) => createHash('sha256').update(token).digest('hex');
export const newSeat = () => randomBytes(32).toString('hex');
export const seatCookie = (code: string, token: string) => ({
  name: `room-${code}`, value: token, httpOnly: true, sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 14400,
});
export async function findRoom(code: string) {
  const [room] = await db.select().from(multiplayerRooms).where(and(
    eq(multiplayerRooms.code, code), gt(multiplayerRooms.expiresAt, new Date())
  )).limit(1);
  return room;
}
export async function seatRole(room: typeof multiplayerRooms.$inferSelect) {
  const token = (await cookies()).get(`room-${room.code}`)?.value;
  if (!token) return null;
  const hash = hashSeat(token);
  return hash === room.hostHash ? 'white' : hash === room.guestHash ? 'black' : null;
}
export function clockState(state: RoomState): RoomState {
  if (state.status !== 'active') return state;
  const elapsed = Math.max(0, Date.now() - state.updatedAt);
  const key = state.turn === 'white' ? 'whiteMs' : 'blackMs';
  const left = Math.max(0, state[key] - elapsed);
  return { ...state, [key]: left, updatedAt: Date.now(), ...(left === 0 ? {
    status: 'finished' as const, winner: state.turn === 'white' ? 'black' as const : 'white' as const,
    resultReason: 'timeout',
  } : {}) };
}
export function roomReply(room: typeof multiplayerRooms.$inferSelect, role: 'white' | 'black') {
  const seen = role === 'white' ? room.guestSeen : room.hostSeen;
  return { ok: true, gameId: room.id, code: room.code, role, version: room.version,
    incrementMs: room.incrementMs, state: clockState(room.state),
    opponentOnline: !!seen && Date.now() - seen.getTime() < 12000 };
}
