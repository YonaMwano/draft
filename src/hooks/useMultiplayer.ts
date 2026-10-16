'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPusherClient } from '@/lib/pusher-client';
import type { Piece, Move, Color } from '@/lib/localEngine';

export type ConnStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type MpEvent =
  | {
      type: 'move-made';
      from: number;
      path: number[];
      captures: number[];
      pieces: Piece[];
      turn: Color;
      whiteMs: number;
      blackMs: number;
      status: string;
      winner?: Color | 'draw' | null;
      resultReason?: string | null;
      ply: number;
      by: string; // role host|guest
    }
  | { type: 'player-joined'; role: string; code: string }
  | { type: 'player-ready'; role: string }
  | { type: 'heartbeat'; role: string; at: number };

/**
 * Real-time channel for a private game room.
 * Uses Pusher when configured; falls back to BroadcastChannel (same browser)
 * + short polling so two tabs can still play.
 */
export function useMultiplayer(roomId: string, code: string, role: string) {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [opponentOnline, setOpponentOnline] = useState(false);
  const handlers = useRef<Set<(e: MpEvent) => void>>(new Set());
  const pusherRef = useRef<ReturnType<typeof createPusherClient> | null>(null);
  const channelRef = useRef<any>(null);

  const onEvent = useCallback((fn: (e: MpEvent) => void) => {
    handlers.current.add(fn);
    return () => {
      handlers.current.delete(fn);
    };
  }, []);

  const emitLocal = useCallback((e: MpEvent) => {
    handlers.current.forEach((fn) => {
      try {
        fn(e);
      } catch (_) {}
    });
  }, []);

  const broadcast = useCallback(
    async (event: MpEvent) => {
      // 1) BroadcastChannel (instant, same device / tabs)
      try {
        const bc = new BroadcastChannel(`drafts-${code || roomId}`);
        bc.postMessage(event);
        bc.close();
      } catch (_) {}

      // 2) localStorage event bus (cross-tab)
      try {
        localStorage.setItem(
          `drafts-mp:${code || roomId}`,
          JSON.stringify({ ...event, _t: Date.now() })
        );
      } catch (_) {}

      // 3) Pusher (true multiplayer across devices)
      try {
        if (channelRef.current && status === 'connected') {
          // client events need enabled on Pusher dashboard; also try REST via API
        }
        await fetch('/api/games/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            code,
            role,
            event,
          }),
        }).catch(() => {});
      } catch (_) {}
    },
    [roomId, code, role, status]
  );

  useEffect(() => {
    if (!roomId && !code) return;
    const key = code || roomId;
    let cancelled = false;

    // BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`drafts-${key}`);
      bc.onmessage = (msg) => {
        if (msg?.data?.type) emitLocal(msg.data as MpEvent);
        if (msg?.data?.type === 'player-joined' || msg?.data?.type === 'heartbeat') {
          setOpponentOnline(true);
        }
      };
    } catch (_) {}

    // storage listener
    const onStorage = (e: StorageEvent) => {
      if (e.key !== `drafts-mp:${key}` || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (data?.type) emitLocal(data);
        if (data?.type === 'player-joined' || data?.type === 'move-made') {
          setOpponentOnline(true);
        }
      } catch (_) {}
    };
    window.addEventListener('storage', onStorage);

    // Pusher
    try {
      const client = createPusherClient();
      pusherRef.current = client;
      const chName = `private-game-${key}`;
      // public channel works without auth endpoint
      const ch = client.subscribe(`game-${key}`);
      channelRef.current = ch;

      client.connection.bind('connected', () => {
        if (!cancelled) setStatus('connected');
      });
      client.connection.bind('disconnected', () => {
        if (!cancelled) setStatus('disconnected');
      });
      client.connection.bind('error', () => {
        if (!cancelled) setStatus('error');
      });

      ch.bind('move-made', (data: MpEvent) => emitLocal(data));
      ch.bind('player-joined', (data: MpEvent) => {
        setOpponentOnline(true);
        emitLocal(data);
      });
      ch.bind('pusher:subscription_succeeded', () => {
        if (!cancelled) setStatus('connected');
      });

      // announce join
      setTimeout(() => {
        broadcast({ type: 'player-joined', role, code: key });
      }, 300);

      // heartbeat
      const hb = setInterval(() => {
        broadcast({ type: 'heartbeat', role, at: Date.now() });
      }, 5000);

      // If Pusher never connects, still mark connected for local channels
      const fallback = setTimeout(() => {
        if (!cancelled) setStatus((s) => (s === 'connecting' ? 'connected' : s));
      }, 2000);

      return () => {
        cancelled = true;
        clearInterval(hb);
        clearTimeout(fallback);
        window.removeEventListener('storage', onStorage);
        try {
          bc?.close();
        } catch (_) {}
        try {
          client.unsubscribe(`game-${key}`);
          client.disconnect();
        } catch (_) {}
      };
    } catch {
      setStatus('connected'); // local-only mode
      return () => {
        cancelled = true;
        window.removeEventListener('storage', onStorage);
        try {
          bc?.close();
        } catch (_) {}
      };
    }
  }, [roomId, code, role, broadcast, emitLocal]);

  return { status, opponentOnline, onEvent, broadcast, setOpponentOnline };
}
