import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getPusherServer } from '@/lib/pusher-server';
import { channels } from '@/lib/pusher';

/** POST /api/challenges/join — { code } → sit as black (or free seat) and start game */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const code = String(body.code || '').toUpperCase().trim();
    if (code.length < 4) {
      return NextResponse.json({ error: 'Enter a valid code' }, { status: 400 });
    }

    let rows: any[] = [];
    try {
      rows = await sql`
        SELECT * FROM games WHERE challenge_code = ${code} ORDER BY created_at DESC LIMIT 1
      `;
    } catch (e: any) {
      // Offline fallback
      return NextResponse.json({
        ok: true,
        gameId: code.toLowerCase(),
        status: 'active',
        localOnly: true,
        code,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Code not found. Ask your friend for a new code.' }, { status: 404 });
    }

    const g = rows[0];
    if (g.status === 'finished' || g.status === 'aborted') {
      return NextResponse.json({ error: 'This game has already ended' }, { status: 400 });
    }

    // If already full and you're not a player
    if (g.white_id && g.black_id) {
      if (user && (user.id === g.white_id || user.id === g.black_id)) {
        return NextResponse.json({ ok: true, gameId: g.id, status: g.status, code });
      }
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }

    // Sit in empty seat
    if (user?.id) {
      if (!g.white_id) {
        await sql`UPDATE games SET white_id = ${user.id}, status = 'waiting' WHERE id = ${g.id}`;
      } else if (!g.black_id && g.white_id !== user.id) {
        await sql`UPDATE games SET black_id = ${user.id}, status = 'active', last_move_at = ${new Date().toISOString()} WHERE id = ${g.id}`;
      } else if (g.white_id === user.id) {
        // Creator rejoining
        return NextResponse.json({ ok: true, gameId: g.id, status: g.status, code, role: 'white' });
      }
    } else {
      // Guest: mark active so they can play
      await sql`UPDATE games SET status = 'active', last_move_at = ${new Date().toISOString()} WHERE id = ${g.id}`;
    }

    const updated = await sql`SELECT id, status, white_id, black_id FROM games WHERE id = ${g.id} LIMIT 1`;
    const u = updated[0] as any;

    try {
      await getPusherServer().trigger(channels.game(g.id), 'player-joined', {
        gameId: g.id,
        status: u.status,
        whiteId: u.white_id,
        blackId: u.black_id,
      });
    } catch (_) {}

    return NextResponse.json({
      ok: true,
      gameId: g.id,
      status: u.status,
      code,
      role: user && u.white_id === user.id ? 'white' : 'black',
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || 'Join failed' }, { status: 500 });
  }
}
