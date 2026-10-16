'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalGame, type Color } from '@/lib/localEngine';
import { useGameStore } from '@/store/gameStore';
import type { RoomState } from '../../db/schema';

type Reply = { state: RoomState; version: number; role: Color; opponentOnline: boolean; incrementMs: number; error?: string };
export function useMultiplayer(_roomId: string, code: string, _role: string) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [opponentOnline, setOpponentOnline] = useState(false);
  const [role, setRole] = useState<Color>('white');
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<(event?: unknown) => Promise<void>>(async () => {});
  const retry = useCallback(() => { void requestRef.current(); }, []);
  const resign = useCallback(() => { void requestRef.current({ type: 'resign' }); }, []);

  useEffect(() => {
    if (!code) return;
    let stopped = false;
    let busy = false;
    let queued: unknown;
    let applying = false;
    let version = -1;
    let myRole: Color = 'white';
    let initialized = false;
    const controller = new AbortController();
    setReady(false);
    setStatus('connecting');
    const apply = (data: Reply, force = false) => {
      const state = data.state;
      const current = useGameStore.getState();
      if (force || data.version !== version || !initialized || current.status !== (state.status === 'waiting' ? 'idle' : state.status)) {
        const engine = new LocalGame();
        engine.pieces = state.pieces.map(p => ({ ...p }));
        engine.turn = state.turn;
        engine.winner = state.winner;
        engine.resultReason = state.resultReason;
        const legalMoves = engine.legalMoves();
        const maxCaptures = Math.max(0, ...legalMoves.map(m => m.captures.length));
        applying = true;
        useGameStore.setState({ engine, pieces: engine.getPieces(), turn: state.turn,
          status: state.status === 'waiting' ? 'idle' : state.status,
          winner: state.winner, resultReason: state.resultReason,
          selected: null, legalDestinations: [], hopPath: [], legalMoves,
          captureRequired: maxCaptures > 0, maxCaptures,
          whiteMs: state.whiteMs, blackMs: state.blackMs, lastTick: Date.now(), incrementMs: data.incrementMs,
        });
        applying = false;
      } else {
        // Preserve a player's selected piece while correcting clock drift.
        useGameStore.setState({ whiteMs: state.whiteMs, blackMs: state.blackMs, lastTick: Date.now() });
      }
      version = data.version;
      initialized = true;
      myRole = data.role;
      setRole(data.role);
      setOpponentOnline(data.opponentOnline);
      setReady(true);
      setStatus('connected');
      setError('');
    };
    const request = async (event?: unknown) => {
      if (stopped) return;
      if (busy) {
        if (event) { queued = event; setPending(true); }
        return;
      }
      busy = true;
      if (event) setPending(true);
      try {
        const response = await fetch('/api/games/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
          body: JSON.stringify({ code, version, event }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        const data = await response.json();
        if (stopped) return;
        if (data.state) { if (!queued) apply(data, !!event); }
        else if (!response.ok) throw new Error(data.error || 'Unable to synchronize.');
      } catch (cause) {
        if (stopped) return;
        setReady(false);
        setStatus(navigator.onLine ? 'error' : 'disconnected');
        setOpponentOnline(false);
        setError(cause instanceof Error ? cause.message : 'Connection interrupted. Retrying…');
        // Force the next snapshot to repair any unacknowledged local move.
        initialized = false;
      } finally {
        busy = false;
        if (!stopped) {
          const next = queued;
          queued = undefined;
          if (next) void request(next);
          else setPending(false);
        }
      }
    };
    requestRef.current = request;
    const unsubscribe = useGameStore.subscribe((state, previous) => {
      if (applying || !initialized || busy) return;
      if (state.pieces !== previous.pieces && previous.turn === myRole && state.turn !== previous.turn) {
        void request({ type: 'move-made', pieces: state.pieces });
      }
    });
    void request();
    const timer = setInterval(() => { void request(); }, 1000);
    const wake = () => { if (!document.hidden) void request(); };
    const offline = () => { setStatus('disconnected'); setReady(false); setOpponentOnline(false); };
    window.addEventListener('online', wake);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
      unsubscribe();
      window.removeEventListener('online', wake);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [code]);
  return { status, opponentOnline, role, ready, pending, error, retry, resign };
}
