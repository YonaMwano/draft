import { eq } from 'drizzle-orm';
import { db } from '../../../../../db';
import { onlineRooms } from '../../../../../db/schema';
import { clockState, findRoom, roleFor, saveState, snapshot } from '@/lib/onlineRooms';
import { LocalGame } from '@/lib/localEngine';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let room = await findRoom(String(body.code).toUpperCase());
    const role = roleFor(room, String(body.token || ''));
    await db.update(onlineRooms).set(role === 'white' ? { hostSeen: Date.now() } : { guestSeen: Date.now() }).where(eq(onlineRooms.id, room.id));
    const state = clockState(room);
    if (body.action === 'move' || body.action === 'resign') {
      if (body.version !== room.version || state.status !== 'active') return Response.json({ error: 'Game changed. Please sync.', ...snapshot(room, role) }, { status: 409 });
      if (body.action === 'resign') {
        state.status = 'finished'; state.winner = role === 'white' ? 'black' : 'white'; state.resultReason = 'resignation';
      } else {
        if (state.turn !== role) return Response.json({ error: 'It is not your turn' }, { status: 403 });
        const engine = new LocalGame(); engine.pieces = state.pieces.map(p => ({ ...p })); engine.turn = state.turn;
        const move = engine.legalMoves().find(m => m.from === body.move?.from && JSON.stringify(m.path) === JSON.stringify(body.move?.path));
        if (!move) return Response.json({ error: 'Illegal move' }, { status: 400 });
        engine.applyMove(move);
        if (role === 'white') state.whiteMs += room.incrementMs; else state.blackMs += room.incrementMs;
        state.pieces = engine.getPieces(); state.turn = engine.turn; state.ply++;
        state.winner = engine.winner === 'draw' ? null : engine.winner; state.resultReason = engine.resultReason;
        state.status = engine.winner ? 'finished' : 'active'; state.lastMoveAt = Date.now();
      }
      room = await saveState(room, state);
    } else if (state.status === 'finished' && room.state.status === 'active') {
      room = await saveState(room, state);
    }
    return Response.json(snapshot(room, role), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Online connection unavailable. Reconnecting…' }, { status: 503 }); }
}
