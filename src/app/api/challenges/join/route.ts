import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db, onlineRooms, seatIdentity, roomResponse, withSeat } from '@/lib/onlineRoom';
export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    const seat = await seatIdentity();
    const [room] = await db.select().from(onlineRooms).where(eq(onlineRooms.code, String(code || '').trim().toUpperCase()));
    if (!room || (room.status === 'waiting' && room.expiresAt < new Date())) return NextResponse.json({ error: 'Code not found or expired' }, { status: 404 });
    if (room.whiteSeat === seat || room.blackSeat === seat) return withSeat(roomResponse(room, seat), seat);
    if (room.status !== 'waiting') return NextResponse.json({ error: 'Room is full or has ended' }, { status: 409 });
    const [joined] = await db.update(onlineRooms).set({ blackSeat: seat, status: 'active', updatedAt: new Date(), revision: room.revision + 1 }).where(and(eq(onlineRooms.id, room.id), isNull(onlineRooms.blackSeat), eq(onlineRooms.status, 'waiting'))).returning();
    if (!joined) return NextResponse.json({ error: 'Room is full' }, { status: 409 });
    return withSeat(roomResponse(joined, seat), seat);
  } catch { return NextResponse.json({ error: 'Unable to join. Please check your connection and retry.' }, { status: 503 }); }
}
