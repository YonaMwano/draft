import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { LocalGame } from '@/lib/localEngine';

/** POST /api/games — create a new game (challenge or vs bot) */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'bot'; // 'bot' | 'open' | 'challenge'
    const timeControl = body.timeControl || 'blitz';
    const initialMs = body.initialMs ?? 180000;
    const incrementMs = body.incrementMs ?? 2000;
    const isRated = body.isRated !== false && mode !== 'bot';

    const game = new LocalGame();
    const piecesJson = JSON.stringify(game.getPieces());
    const id = randomUUID();

    const whiteId = user?.id ?? null;
    const blackId = mode === 'bot' ? null : null; // bot has no user id

    try {
      await sql`
        INSERT INTO games (
          id, white_id, black_id, status, time_control,
          initial_ms, increment_ms, is_rated,
          current_fen, ply_count, white_ms_left, black_ms_left, last_move_at
        ) VALUES (
          ${id},
          ${whiteId},
          ${blackId},
          ${mode === 'bot' ? 'active' : 'waiting'},
          ${timeControl},
          ${initialMs},
          ${incrementMs},
          ${isRated},
          ${piecesJson},
          0,
          ${initialMs},
          ${initialMs},
          ${new Date().toISOString()}
        )
      `;
    } catch (e: any) {
      // If games table missing, still return a playable local game id
      console.error('games insert:', e?.message);
      return NextResponse.json({
        id,
        mode,
        status: mode === 'bot' ? 'active' : 'waiting',
        localOnly: true,
        message: 'DB unavailable — playing local only',
      });
    }

    return NextResponse.json({
      id,
      mode,
      status: mode === 'bot' ? 'active' : 'waiting',
      whiteId,
      timeControl,
      initialMs,
      incrementMs,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || 'Failed to create game' }, { status: 500 });
  }
}
