import { NextResponse } from 'next/server';
import { getDatabase } from '@netlify/database';
import { LocalGame } from '@/lib/localEngine';

export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code')?.trim().toUpperCase();
  if (!code) return reply({ error: 'Missing code' }, 400);
  try {
    const db = getDatabase();
    const [room] = await db.sql`
      SELECT revision, event,
        white_seen > now() - interval '15 seconds' AS white_online,
        black_seen > now() - interval '15 seconds' AS black_online
      FROM room_sync WHERE code = ${code}
    `;
    return reply({
      ...room, revision: room?.revision ?? 0,
      event: room?.event ?? {
        type: 'move-made', pieces: new LocalGame().getPieces(), turn: 'white',
        whiteMs: 180000, blackMs: 180000, status: 'active',
        winner: null, resultReason: null, ply: 0, by: 'white', captures: [],
      },
    });
  } catch {
    return reply({ error: 'Room synchronization unavailable' }, 503);
  }
}

export async function POST(req: Request) {
  try {
    const { code: rawCode, role, event, revision } = await req.json();
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code || !['white', 'black'].includes(role) || !event?.type) {
      return reply({ error: 'Invalid room event' }, 400);
    }
    const db = getDatabase();
    await db.sql`INSERT INTO room_sync (code) VALUES (${code}) ON CONFLICT DO NOTHING`;
    await db.sql`
      UPDATE room_sync SET
        white_seen = CASE WHEN ${role} = 'white' THEN now() ELSE white_seen END,
        black_seen = CASE WHEN ${role} = 'black' THEN now() ELSE black_seen END
      WHERE code = ${code}
    `;
    if (event.type !== 'move-made') return reply({ ok: true });
    if (event.by !== role || !Array.isArray(event.pieces) ||
        !['white', 'black'].includes(event.turn) || !Number.isInteger(revision)) {
      return reply({ error: 'Invalid move' }, 400);
    }
    const [room] = await db.sql`
      UPDATE room_sync SET event = ${JSON.stringify(event)}::jsonb, revision = revision + 1
      WHERE code = ${code} AND revision = ${revision}
      RETURNING revision, event
    `;
    if (!room) return reply({ error: 'Room changed; synchronizing again' }, 409);
    return reply(room);
  } catch {
    return reply({ error: 'Unable to save room update' }, 503);
  }
}
