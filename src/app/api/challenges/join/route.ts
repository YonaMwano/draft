import { NextResponse } from 'next/server';
import { isNull } from 'drizzle-orm';
import { db, multiplayerRooms, eq, and, findRoom, seatRole, newSeat, hashSeat, seatCookie } from '@/lib/rooms';
export async function POST(req: Request) {
  try {
    const { code: raw } = await req.json();
    const code = String(raw || '').trim().toUpperCase();
    const room = await findRoom(code);
    if (!room) return NextResponse.json({ error: 'Code not found or expired.' }, { status: 404 });
    const role = await seatRole(room);
    if (role) return NextResponse.json({ gameId: room.id, code, role });
    if (room.guestHash || room.state.status !== 'waiting') {
      return NextResponse.json({ error: 'This room is full or has ended.' }, { status: 409 });
    }
    const token = newSeat();
    const [joined] = await db.update(multiplayerRooms).set({ guestHash: hashSeat(token),
      guestSeen: new Date(), version: room.version + 1,
      state: { ...room.state, status: 'active', updatedAt: Date.now() },
    }).where(and(eq(multiplayerRooms.id, room.id), isNull(multiplayerRooms.guestHash))).returning();
    if (!joined) return NextResponse.json({ error: 'Another player just joined this room.' }, { status: 409 });
    const response = NextResponse.json({ gameId: room.id, code, role: 'black' });
    response.cookies.set(seatCookie(code, token));
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to join. Please retry when connected.' }, { status: 503 });
  }
}
