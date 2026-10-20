import { pgTable, text, integer, jsonb, bigint } from 'drizzle-orm/pg-core';
import type { Piece, Color } from '../src/lib/localEngine';
export type RoomState = { pieces: Piece[]; turn: Color; whiteMs: number; blackMs: number; status: 'waiting' | 'active' | 'finished'; winner: Color | null; resultReason: string | null; lastMoveAt: number; ply: number };
export const onlineRooms = pgTable('online_rooms', {
  id: text().primaryKey(), code: text().notNull().unique(),
  hostHash: text('host_hash').notNull(), guestHash: text('guest_hash'),
  state: jsonb().$type<RoomState>().notNull(), version: integer().notNull().default(0),
  incrementMs: integer('increment_ms').notNull(), initialMs: integer('initial_ms').notNull(),
  hostSeen: bigint('host_seen', { mode: 'number' }).notNull(), guestSeen: bigint('guest_seen', { mode: 'number' }),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
});
