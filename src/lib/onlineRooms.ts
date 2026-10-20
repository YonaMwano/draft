import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { onlineRooms, type RoomState } from '../../db/schema';
import { LocalGame } from './localEngine';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const controls: Record<string, [number, number]> = { bullet: [60000, 0], blitz3: [180000, 2000], blitz5: [300000, 3000], rapid: [600000, 5000], classic: [1200000, 10000] };
export async function findRoom(code: string) {
  const [room] = await db.select().from(onlineRooms).where(eq(onlineRooms.code, code));
  if (!room || room.expiresAt < Date.now()) throw new Error('Room not found or expired');
  return room;
}
export type Room = Awaited<ReturnType<typeof findRoom>>;
export function roleFor(room: Room, token: string) {
  const hash = hashToken(token);
  if (hash === room.hostHash) return 'white' as const;
  if (hash === room.guestHash) return 'black' as const;
  throw new Error('This browser does not have a seat in this room. Join with the code first.');
}
export function clockState(room: Room): RoomState {
  const state = { ...room.state };
  if (state.status === 'active') {
    const key = state.turn === 'white' ? 'whiteMs' : 'blackMs';
    state[key] = Math.max(0, state[key] - Math.max(0, Date.now() - state.lastMoveAt));
    if (!state[key]) { state.status = 'finished'; state.winner = state.turn === 'white' ? 'black' : 'white'; state.resultReason = 'timeout'; }
  }
  return state;
}
export function snapshot(room: Room, role: 'white' | 'black') {
  return { gameId: room.id, code: room.code, role, version: room.version, state: clockState(room), initialMs: room.initialMs, incrementMs: room.incrementMs, opponentOnline: Date.now() - (role === 'white' ? room.guestSeen ?? 0 : room.hostSeen) < 15000 };
}
export async function saveState(room: Room, state: RoomState) {
  const [updated] = await db.update(onlineRooms).set({ state, version: room.version + 1 }).where(and(eq(onlineRooms.id, room.id), eq(onlineRooms.version, room.version))).returning();
  if (!updated) throw new Error('Game changed. Sync and try again.');
  return updated;
}
export async function createRoom(tc: string) {
  const [initialMs, incrementMs] = controls[tc] || controls.blitz3;
  const token = newToken();
  const code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  const [room] = await db.insert(onlineRooms).values({ id: randomUUID(), code, hostHash: hashToken(token), initialMs, incrementMs, hostSeen: Date.now(), expiresAt: Date.now() + 86400000, state: { pieces: new LocalGame().getPieces(), turn: 'white', whiteMs: initialMs, blackMs: initialMs, status: 'waiting', winner: null, resultReason: null, lastMoveAt: Date.now(), ply: 0 } }).returning();
  return { ...snapshot(room, 'white'), token };
}
