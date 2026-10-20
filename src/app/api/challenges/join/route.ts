import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../../../db';
import { onlineRooms } from '../../../../../db/schema';
import { findRoom, hashToken, newToken, roleFor, snapshot } from '@/lib/onlineRooms';
export async function POST(req: Request) {
  try {
    const { code, token: existing } = await req.json();
    const room = await findRoom(String(code).trim().toUpperCase());
    if (existing) {
      try { return Response.json({ ...snapshot(room, roleFor(room, existing)), token: existing }); } catch { /* claim free seat */ }
    }
    if (room.guestHash || room.state.status !== 'waiting') return Response.json({ error: 'Room is full or has ended' }, { status: 409 });
    const token = newToken();
    const [updated] = await db.update(onlineRooms).set({ guestHash: hashToken(token), guestSeen: Date.now(), version: room.version + 1, state: { ...room.state, status: 'active', lastMoveAt: Date.now() } }).where(and(eq(onlineRooms.id, room.id), isNull(onlineRooms.guestHash))).returning();
    if (!updated) return Response.json({ error: 'Room is full' }, { status: 409 });
    return Response.json({ ...snapshot(updated, 'black'), token });
  } catch { return Response.json({ error: 'Unable to join. Check the code and try again.' }, { status: 400 }); }
}
