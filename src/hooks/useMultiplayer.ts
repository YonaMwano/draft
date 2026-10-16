'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Piece, Color } from '@/lib/localEngine';

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

// Shared database snapshots work across devices without a third-party relay.
export function useMultiplayer(roomId: string, code: string, role: string) {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [opponentOnline, setOpponentOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const handlers = useRef(new Set<(event: MpEvent) => void>());
  const revision = useRef(0);
  const pending = useRef(false);
  const refresh = useRef<() => Promise<void>>(async () => {});
  const onEvent = useCallback((handler: (event: MpEvent) => void) => {
    handlers.current.add(handler);
    return () => { handlers.current.delete(handler); };
  }, []);

  const broadcast = useCallback(async (event: MpEvent) => {
    if (!code) return;
    pending.current = true;
    setSyncing(true);
    try {
      const response = await fetch('/api/games/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, role, event, revision: revision.current }),
      });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      if (data.revision) revision.current = data.revision;
      setStatus('connected');
    } catch {
      // Force an authoritative snapshot, including our previous saved move.
      revision.current = -1;
      setStatus('error');
    } finally {
      pending.current = false;
      setSyncing(false);
      await refresh.current();
    }
  }, [code, role]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let reading = false;
    revision.current = -1;
    setStatus('connecting');
    setOpponentOnline(false);
    const poll = async () => {
      if (reading || pending.current || cancelled) return;
      reading = true;
      try {
        const response = await fetch(`/api/games/sync?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Sync failed');
        const data = await response.json();
        if (cancelled || pending.current) return;
        if (data.revision > revision.current) {
          revision.current = data.revision;
          if (data.event) handlers.current.forEach(handler => handler(data.event));
        }
        setOpponentOnline(Boolean(role === 'white' ? data.black_online : data.white_online));
        setStatus('connected');
      } catch {
        if (!cancelled) setStatus('error');
      } finally { reading = false; }
    };
    refresh.current = poll;
    const cycle = async () => {
      await poll();
      if (!cancelled) timer = setTimeout(cycle, 500);
    };
    void cycle();
    const heartbeat = async () => {
      try {
        await fetch('/api/games/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, role, event: { type: 'heartbeat' } }),
        });
      } catch { /* Polling reports connection failures. */ }
    };
    void heartbeat();
    const interval = setInterval(heartbeat, 5000);
    const wake = () => { void poll(); void heartbeat(); };
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
    };
  }, [code, role]);

  return { status, opponentOnline, onEvent, broadcast, setOpponentOnline, syncing };
}
