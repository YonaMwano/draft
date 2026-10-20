import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, onlineRooms, seatIdentity, roomResponse, type Room } from '@/lib/onlineRoom';
import { LocalGame } from '@/lib/localEngine';
export const dynamic = 'force-dynamic';

async function handle(req: Request, mutate: boolean) {
  try {
    const body = mutate ? await req.json() : {};
    const id = mutate ? body.id : new URL(req.url).searchParams.get('id');
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid room' }, { status: 400 });
    const seat = await seatIdentity();
    let [room] = await db.select().from(onlineRooms).where(eq(onlineRooms.id, id));
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const color = room.whiteSeat === seat ? 'white' : room.blackSeat === seat ? 'black' : null;
    if (!color) return NextResponse.json({ error: 'Join this room using its code first.' }, { status: 403 });
    if (room.status === 'waiting' && room.expiresAt < new Date()) return NextResponse.json({ error: 'Room expired. Create a new code.' }, { status: 410 });
    const now = new Date();
    const elapsed = room.status === 'active' ? Math.max(0, now.getTime() - room.updatedAt.getTime()) : 0;
    const remaining = (room.turn === 'white' ? room.whiteMs : room.blackMs) - elapsed;
    let changes: Partial<Room> | null = null;
    if (room.status === 'active' && remaining <= 0) {
      changes = { status: 'finished', winner: room.turn === 'white' ? 'black' : 'white', reason: 'timeout', [room.turn === 'white' ? 'whiteMs' : 'blackMs']: 0 };
    } else if (mutate) {
      if (room.status !== 'active' || body.revision !== room.revision) return NextResponse.json({ error: 'Game changed. Synchronizing…' }, { status: 409 });
      if (body.action === 'resign') {
        changes = { status: 'finished', winner: color === 'white' ? 'black' : 'white', reason: 'resignation' };
      } else {
        if (color !== room.turn) return NextResponse.json({ error: 'Wait for your turn' }, { status: 403 });
        const engine = new LocalGame();
        engine.pieces = room.pieces;
        engine.turn = room.turn as 'white' | 'black';
        engine.history = room.history;
        const move = engine.legalMoves().find(m => m.from === body.move?.from && JSON.stringify(m.path) === JSON.stringify(body.move?.path));
        if (!move) return NextResponse.json({ error: 'Illegal move' }, { status: 400 });
        engine.applyMove(move);
        changes = { pieces: engine.getPieces(), history: engine.history, turn: engine.turn, winner: engine.winner, reason: engine.resultReason, status: engine.winner ? 'finished' : 'active', [color === 'white' ? 'whiteMs' : 'blackMs']: remaining + room.incrementMs };
      }
      if (body.action === 'resign') changes[room.turn === 'white' ? 'whiteMs' : 'blackMs'] = remaining;
    }
    if (changes) {
      const [updated] = await db.update(onlineRooms).set({ ...changes, updatedAt: now, revision: room.revision + 1 }).where(and(eq(onlineRooms.id, id), eq(onlineRooms.revision, room.revision))).returning();
      if (!updated) return NextResponse.json({ error: 'Game changed. Synchronizing…' }, { status: 409 });
      room = updated;
    }
    return roomResponse(room, seat);
  } catch { return NextResponse.json({ error: 'Connection interrupted. Reconnecting…' }, { status: 503 }); }
}
export async function GET(req: Request) { return handle(req, false); }
export async function POST(req: Request) { return handle(req, true); }
