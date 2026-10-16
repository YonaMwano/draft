import { NextResponse } from 'next/server';
import { validateTransition } from '@/lib/multiplayerRules';
import { db, multiplayerRooms, eq, and, findRoom, seatRole, roomReply, clockState } from '@/lib/rooms';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const room = await findRoom(String(body.code || '').trim().toUpperCase());
    if (!room) return NextResponse.json({ error: 'Room not found or expired.' }, { status: 404 });
    const role = await seatRole(room);
    if (!role) return NextResponse.json({ error: 'Join this room before playing.' }, { status: 403 });
    const presence = role === 'white' ? { hostSeen: new Date() } : { guestSeen: new Date() };
    let state = clockState(room.state);
    if (body.event) {
      if (body.version !== room.version || state.status !== 'active') {
        return NextResponse.json(roomReply(room, role), { status: 409 });
      }
      if (body.event.type === 'resign') {
        state = { ...state, status: 'finished', winner: role === 'white' ? 'black' : 'white', resultReason: 'resignation' };
      } else if (body.event.type === 'move-made' && state.turn === role) {
        const engine = validateTransition(state.pieces, state.turn, body.event.pieces);
        if (!engine) return NextResponse.json({ error: 'Illegal move.' }, { status: 400 });
        state = { ...state, pieces: engine.getPieces(), turn: engine.turn, ply: state.ply + 1,
          status: engine.winner ? 'finished' : 'active', winner: engine.winner, resultReason: engine.resultReason,
          [role === 'white' ? 'whiteMs' : 'blackMs']: state[role === 'white' ? 'whiteMs' : 'blackMs'] + room.incrementMs };
      } else return NextResponse.json({ error: 'It is not your turn.' }, { status: 409 });
    }
    const changed = !!body.event || state.status !== room.state.status;
    const [updated] = await db.update(multiplayerRooms).set({ ...presence,
      ...(changed ? { state, version: room.version + 1 } : {}),
    }).where(and(eq(multiplayerRooms.id, room.id), eq(multiplayerRooms.version, room.version))).returning();
    if (!updated) return NextResponse.json({ error: 'State changed. Reconnecting…' }, { status: 409 });
    return NextResponse.json(roomReply(updated, role), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Connection interrupted. Retrying…' }, { status: 503 });
  }
}
