'use client';
import { useEffect, useRef, useState } from 'react';
import { LocalGame, type Move, type Piece, type Color } from '@/lib/localEngine';
import { useGameStore } from '@/store/gameStore';

type Snapshot = {
  role: Color; status: string; pieces: Piece[]; history: Move[]; turn: Color;
  winner: Color | 'draw' | null; reason: string | null; revision: number;
  whiteMs: number; blackMs: number; incrementMs: number; initialMs: number;
};
export function useOnlineRoom(id: string, enabled: boolean) {
  const [connection, setConnection] = useState('Connecting…');
  const [waiting, setWaiting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [initialMs, setInitialMs] = useState(180000);
  const resignRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let pending = false;
    let polling: Promise<void> | null = null;
    let revision = -1;
    let timeout: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    useGameStore.setState({ status: 'idle', pieces: [], engine: null, selected: null, legalDestinations: [] });
    function apply(data: Snapshot) {
      if (disposed || data.revision < revision) return;
      const changed = data.revision !== revision;
      revision = data.revision;
      const engine = new LocalGame();
      engine.pieces = data.pieces;
      engine.turn = data.turn;
      engine.history = data.history;
      engine.winner = data.winner;
      engine.resultReason = data.reason;
      const moves = engine.legalMoves();
      const max = Math.max(0, ...moves.map(m => m.captures.length));
      useGameStore.setState({
        engine, pieces: data.pieces, turn: data.turn, myColor: data.role,
        status: data.status === 'waiting' ? 'idle' : data.status === 'finished' ? 'finished' : 'active',
        winner: data.winner, resultReason: data.reason, whiteMs: data.whiteMs, blackMs: data.blackMs,
        incrementMs: data.incrementMs, lastTick: Date.now(), legalMoves: moves,
        captureRequired: max > 0, maxCaptures: max,
        ...(changed ? { selected: null, legalDestinations: [], hopPath: [] } : {}),
      });
      setInitialMs(data.initialMs);
      setWaiting(data.status === 'waiting');
      setConnection('Connected');
    }
    async function request(action?: string, move?: Move) {
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 8000);
      try {
        const res = await fetch(action ? '/api/games/state' : `/api/games/state?id=${encodeURIComponent(id)}`, {
          method: action ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
          ...(action ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, revision, action, move }) } : {}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Reconnecting…');
        apply(data);
      } catch (error) {
        if (!disposed) setConnection(error instanceof Error ? error.message : 'Reconnecting…');
      } finally { clearTimeout(deadline); }
    }
    async function poll() {
      if (disposed) return;
      if (!pending) {
        polling = request();
        await polling;
        polling = null;
      }
      if (!disposed) timeout = setTimeout(poll, 750);
    }
    async function submit(action: string, move?: Move) {
      if (pending || disposed) return;
      pending = true;
      setBusy(true);
      if (polling) await polling;
      if (disposed) return;
      await request(action, move);
      await request();
      pending = false;
      if (!disposed) setBusy(false);
    }
    useGameStore.setState({ onlineMove: move => { void submit('move', move); } });
    resignRef.current = () => { void submit('resign'); };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller?.abort();
      useGameStore.setState({ onlineMove: null, status: 'idle' });
    };
  }, [id, enabled]);
  return { connection, waiting, busy, initialMs, resignOnline: () => resignRef.current() };
}
