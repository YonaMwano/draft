import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

/** Relay multiplayer events via Pusher (works across devices). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const roomId = String(body.roomId || body.code || '');
    const event = body.event;
    if (!roomId || !event?.type) {
      return NextResponse.json({ error: 'Missing roomId or event' }, { status: 400 });
    }

    const channel = `game-${roomId}`;
    try {
      await pusherServer.trigger(channel, event.type, event);
      return NextResponse.json({ ok: true, via: 'pusher' });
    } catch (e: any) {
      // Pusher not configured — client still has BroadcastChannel fallback
      return NextResponse.json({
        ok: true,
        via: 'local',
        warning: e?.message || 'Pusher unavailable',
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'sync failed' }, { status: 500 });
  }
}
