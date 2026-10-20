import { pgTable, uuid, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import type { Piece, Move } from '../src/lib/localEngine';

export const onlineRooms = pgTable('online_rooms', {
  id: uuid('id').primaryKey(),
  code: text('code').notNull().unique(),
  whiteSeat: uuid('white_seat').notNull(),
  blackSeat: uuid('black_seat'),
  status: text('status').notNull().default('waiting'),
  pieces: jsonb('pieces').$type<Piece[]>().notNull(),
  history: jsonb('history').$type<Move[]>().notNull(),
  turn: text('turn').notNull().default('white'),
  winner: text('winner'),
  reason: text('reason'),
  revision: integer('revision').notNull().default(0),
  initialMs: integer('initial_ms').notNull(),
  incrementMs: integer('increment_ms').notNull(),
  whiteMs: integer('white_ms').notNull(),
  blackMs: integer('black_ms').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
