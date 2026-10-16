import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { LocalGame } from '@/lib/localEngine';

function makeCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  let s = '';
  for (let i = 0; i < len; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

const TC_MS: Record<string, { initial: number; inc: number }> = {
  bullet: { initial: 60_000, inc: 0 },
  blitz3: { initial: 180_000, inc: 2_000 },
  blitz5: { initial: 300_000, inc: 3_000 },
  rapid: { initial: 600_000, inc: 5_000 },
  classic: { initial: 1_200_000, inc: 10_000 },
};

/** POST /api/challenges — create a private room with a 6-char code */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const body = await req.json().catch(() => ({}));
    const tcKey = body.timeControl || 'blitz3';
    const isRated = !!body.isRated;
    const { initial, inc } = TC_MS[tcKey] || TC_MS.blitz3;

    const code = makeCode(6);
    const gameId = randomUUID();
    const engine = new LocalGame();
    const piecesJson = JSON.stringify(engine.getPieces());
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Try DB; fall back to in-memory-style response if tables missing
    try {
      await sql`
        INSERT INTO games (
          id, white_id, black_id, status, time_control,
          initial_ms, increment_ms, is_rated,
          current_fen, ply_count, white_ms_left, black_ms_left,
          last_move_at, challenge_code
        ) VALUES (
          ${gameId},
          ${user?.id ?? null},
          ${null},
          'waiting',
          ${tcKey},
          ${initial},
          ${inc},
          ${isRated},
          ${piecesJson},
          0,
          ${initial},
          ${initial},
          ${new Date().toISOString()},
          ${code}
        )
      `;

      // Optional challenges table
      try {
        await sql`
          INSERT INTO challenges (id, code, challenger_id, time_control, is_rated, expires_at)
          VALUES (${randomUUID()}, ${code}, ${user?.id ?? randomUUID()}, ${tcKey}, ${isRated}, ${expires.toISOString()})
        `;
      } catch (_) {}
    } catch (e: any) {
      console.warn('challenge DB insert failed, returning local code:', e?.message);
      // Still return a usable code so UI works offline / without schema
      return NextResponse.json({
        ok: true,
        code,
        gameId,
        timeControl: tcKey,
        initialMs: initial,
        incrementMs: inc,
        expiresAt: expires.toISOString(),
        localOnly: true,
        shareUrl: `/play?mode=join&code=${code}`,
      });
    }

    return NextResponse.json({
      ok: true,
      code,
      gameId,
      timeControl: tcKey,
      initialMs: initial,
      incrementMs: inc,
      expiresAt: expires.toISOString(),
      shareUrl: `/play?mode=join&code=${code}`,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || 'Failed to create challenge' }, { status: 500 });
  }
}

/** GET /api/challenges?code=XXXXXX — lookup a waiting room */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get('code') || '').toUpperCase().trim();
    if (code.length < 4) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    try {
      const rows = await sql`
        SELECT id, status, time_control, initial_ms, increment_ms, is_rated,
               white_id, black_id, challenge_code, created_at
        FROM games
        WHERE challenge_code = ${code}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Code not found or expired' }, { status: 404 });
      }
      const g = rows[0] as any;
      return NextResponse.json({
        ok: true,
        gameId: g.id,
        status: g.status,
        timeControl: g.time_control,
        initialMs: g.initial_ms,
        incrementMs: g.increment_ms,
        isRated: g.is_rated,
        hasWhite: !!g.white_id,
        hasBlack: !!g.black_id,
        code: g.challenge_code,
      });
    } catch (e: any) {
      // DB missing — allow join by treating code as game path id for demo
      return NextResponse.json({
        ok: true,
        gameId: code.toLowerCase(),
        status: 'waiting',
        timeControl: 'blitz3',
        localOnly: true,
        code,
        message: 'DB offline — joining local room by code',
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Lookup failed' }, { status: 500 });
  }
}
