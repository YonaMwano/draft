'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalGame, type Color, type Move } from '@/lib/localEngine';
import { useGameStore } from '@/store/gameStore';
import type { RoomState } from '../../db/schema';
export type ConnStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type Snapshot = { role: Color; version: number; state: RoomState; initialMs: number; incrementMs: number; opponentOnline: boolean; error?: string };

/** Server-authoritative state, synchronized across devices every 750ms. */
export function useMultiplayer(code: string) {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [opponentOnline, setOpponentOnline] = useState(false);
  const [role, setRole] = useState<Color>('white');
  const [roomStatus, setRoomStatus] = useState<RoomState['status']>('waiting');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialMs, setInitialMs] = useState(180000);
  const version = useRef(-1);
  const inFlight = useRef(false);
  const generation = useRef(0);

  const sync = useCallback(async (action = 'sync', move?: Move) => {
    if (!code || inFlight.current) return;
    inFlight.current = true;
    const currentGeneration = generation.current;
    setBusy(true);
    try {
      const token = sessionStorage.getItem(`room-token:${code}`);
      if (!token) throw new Error('Join this room with its code to restore your seat.');
      const response = await fetch('/api/games/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, token, version: version.current, action, move }),
        signal: AbortSignal.timeout(8000), cache: 'no-store',
      });
      const data: Snapshot = await response.json();
      if (currentGeneration !== generation.current) return;
      if (!response.ok && !data.state) throw new Error(data.error || 'Connection lost. Reconnecting…');
      version.current = data.version;
      setRole(data.role); setRoomStatus(data.state.status); setOpponentOnline(data.opponentOnline);
      setInitialMs(data.initialMs); setStatus('connected'); setError(data.error || '');
      const engine = new LocalGame();
      engine.pieces = data.state.pieces.map(p => ({ ...p })); engine.turn = data.state.turn;
      engine.winner = data.state.winner; engine.resultReason = data.state.resultReason;
      const legalMoves = engine.legalMoves();
      const maxCaptures = Math.max(0, ...legalMoves.map(m => m.captures.length));
      const old = useGameStore.getState();
      const changed = old.turn !== data.state.turn || JSON.stringify(old.pieces) !== JSON.stringify(data.state.pieces);
      useGameStore.setState({
        engine, pieces: engine.getPieces(), turn: engine.turn, myColor: data.role,
        status: data.state.status === 'waiting' ? 'idle' : data.state.status,
        winner: data.state.winner, resultReason: data.state.resultReason,
        whiteMs: data.state.whiteMs, blackMs: data.state.blackMs,
        incrementMs: data.incrementMs, lastTick: Date.now(), legalMoves,
        captureRequired: maxCaptures > 0, maxCaptures,
        ...(changed ? { selected: null, legalDestinations: [], hopPath: [] } : {}),
      });
    } catch (err) {
      if (currentGeneration !== generation.current) return;
      setStatus('disconnected'); setOpponentOnline(false);
      setError(err instanceof Error ? err.message : 'Connection lost. Reconnecting…');
    } finally {
      inFlight.current = false;
      if (currentGeneration === generation.current) setBusy(false);
    }
  }, [code]);

  useEffect(() => {
    generation.current++;
    version.current = -1;
    useGameStore.setState({ status: 'idle', selected: null, legalDestinations: [] });
    void sync();
    const timer = setInterval(() => void sync(), 750);
    const reconnect = () => void sync();
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', reconnect);
    return () => { generation.current++; clearInterval(timer); window.removeEventListener('online', reconnect); window.removeEventListener('focus', reconnect); };
  }, [sync]);

  // Intercept completed selections before any local mutation; only the server applies moves.
  const selectSquare = useCallback((sq: number) => {
    const state = useGameStore.getState();
    if (busy || status !== 'connected' || roomStatus !== 'active' || state.turn !== role) return;
    if (state.selected !== null && state.legalDestinations.includes(sq)) {
      const move = state.legalMoves.find(m => m.from === state.selected && m.path[m.path.length - 1] === sq);
      if (move) void sync('move', move);
      return;
    }
    state.selectSquare(sq);
  }, [busy, status, roomStatus, role, sync]);
  return { status, opponentOnline, role, roomStatus, error, busy, initialMs, selectSquare, resign: () => sync('resign') };
}
