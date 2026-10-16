import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import type { Piece, Color } from '../src/lib/localEngine';

export type RoomState = {
  pieces: Piece[]; turn: Color; status: 'waiting' | 'active' | 'finished';
  winner: Color | 'draw' | null; resultReason: string | null;
  whiteMs: number; blackMs: number; ply: number; updatedAt: number;
};
export const multiplayerRooms = pgTable('multiplayer_rooms', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  hostHash: text('host_hash').notNull(),
  guestHash: text('guest_hash'),
  timeControl: text('time_control').notNull(),
  incrementMs: integer('increment_ms').notNull(),
  state: jsonb('state').$type<RoomState>().notNull(),
  version: integer('version').notNull().default(0),
  hostSeen: timestamp('host_seen', { withTimezone: true }).notNull().defaultNow(),
  guestSeen: timestamp('guest_seen', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
