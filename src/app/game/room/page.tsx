'use client';

import Link from 'next/link';
import Board3D from '@/components/Board3D';
import { useGameStore, CameraMode } from '@/store/gameStore';
import { playMoveSound, playCaptureSound, playPromoteSound } from '@/lib/sound';
import { useMultiplayer, type MpEvent } from '@/hooks/useMultiplayer';
import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

function formatMs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function clockColor(ms: number, isTurn: boolean) {
  if (ms <= 10000) return '#E5484D';
  if (ms <= 20000) return '#F5A524';
  return isTurn ? '#D4A24C' : '#9ca3af';
}

function GameRoomInner() {
  const searchParams = useSearchParams();
  const roomCode = (searchParams.get('code') || '').toUpperCase();
  const roleParam = searchParams.get('role') || 'host';
  const roomId = searchParams.get('id') || roomCode.toLowerCase() || 'local';

  // Host / creator = white; joiner = black (pink pieces)
  const myRole = roleParam === 'guest' || roleParam === 'black' ? 'black' : 'white';
  const isHost = myRole === 'white';
  const isOnlineRoom = !!roomCode;

  const {
    newGame,
    pieces,
    turn,
    status,
    winner,
    resultReason,
    whiteMs,
    blackMs,
    camera,
    setCamera,
    tick,
    resign,
    captureRequired,
    engine,
    selectSquare,
    soundEnabled,
  } = useGameStore();

  const { status: connStatus, opponentOnline, onEvent, broadcast, setOpponentOnline, syncing } =
    useMultiplayer(roomId, roomCode, myRole);

  const [boardSize, setBoardSize] = useState(340);
  const [showResult, setShowResult] = useState(false);
  const [liveMode, setLiveMode] = useState(false); // true when opponent connected → no bot
  const botThinking = useRef(false);
  const lastMovePly = useRef(0);
  const applyingRemote = useRef(false);

  // Start game once
  useEffect(() => {
    newGame();
    lastMovePly.current = 0;
  }, [newGame]);

  // Board size — rAF for smooth resize
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const size = Math.min(window.innerWidth - 24, window.innerHeight - 250, 520);
        setBoardSize(Math.max(280, size));
      });
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Clocks — light interval
  useEffect(() => {
    if (status !== 'active') return;
    const id = setInterval(() => tick(), 250);
    return () => clearInterval(id);
  }, [status, tick]);

  useEffect(() => {
    if (status === 'finished') {
      const t = setTimeout(() => setShowResult(true), 400);
      return () => clearTimeout(t);
    }
    setShowResult(false);
  }, [status]);

  // Listen for remote moves
  useEffect(() => {
    return onEvent((ev: MpEvent) => {
      if (ev.type === 'player-joined' || ev.type === 'heartbeat') {
        if (ev.role !== myRole) {
          setOpponentOnline(true);
          setLiveMode(true);
        }
        return;
      }
      if (ev.type !== 'move-made') return;


      setLiveMode(true);
      setOpponentOnline(true);
      applyingRemote.current = true;

      // Sound for opponent move
      if (soundEnabled !== false) {
        if (ev.captures?.length) playCaptureSound();
        else playMoveSound();
      }

      useGameStore.setState({
        pieces: ev.pieces,
        turn: ev.turn,
        selected: null,
        legalDestinations: [],
        legalMoves: [],
        hopPath: [],
        whiteMs: ev.whiteMs,
        blackMs: ev.blackMs,
        status: (ev.status as any) || 'active',
        winner: ev.winner ?? null,
        resultReason: ev.resultReason ?? null,
        lastTick: Date.now(),
        captureRequired: false,
      });

      // Rebuild legal moves from engine if possible
      const eng = useGameStore.getState().engine;
      if (eng) {
        eng.pieces = ev.pieces.map((p) => ({ ...p }));
        eng.turn = ev.turn;
        eng.winner = ev.winner ?? null;
        eng.resultReason = ev.resultReason ?? null;
        const moves = eng.legalMoves();
        const maxCap = Math.max(0, ...moves.map((m) => m.captures.length));
        useGameStore.setState({
          legalMoves: moves,
          captureRequired: maxCap > 0,
          maxCaptures: maxCap,
        });
      }

      lastMovePly.current = ev.ply || lastMovePly.current + 1;
      applyingRemote.current = false;
    });
  }, [onEvent, myRole, soundEnabled, setOpponentOnline]);

  // Subscribe synchronously so remote snapshots cannot be echoed as local moves.
  useEffect(() => useGameStore.subscribe((s, previous) => {
    if (!isOnlineRoom || applyingRemote.current || !s.engine) return;
    if (s.pieces === previous.pieces && s.status === previous.status) return;
    lastMovePly.current += 1;
    void broadcast({
      type: 'move-made', from: 0, path: [], captures: [],
      pieces: s.pieces, turn: s.turn, whiteMs: s.whiteMs, blackMs: s.blackMs,
      status: s.status, winner: s.winner, resultReason: s.resultReason,
      ply: lastMovePly.current, by: myRole,
    });
  }), [isOnlineRoom, myRole, broadcast]);

  // Bot only when NOT live multiplayer (solo practice in room)
  useEffect(() => {
    if (isOnlineRoom || liveMode || opponentOnline) return; // real opponent — no bot
    if (!isHost) return; // guest waits; no bot on guest side when alone is ok — guest can also practice
    if (status !== 'active' || turn !== 'black' || !engine || botThinking.current) return;

    botThinking.current = true;
    const delay = 500 + Math.random() * 700;
    const t = setTimeout(() => {
      const moves = engine.legalMoves('black');
      if (moves.length === 0) {
        botThinking.current = false;
        return;
      }
      const caps = moves.filter((m) => m.captures.length > 0);
      const pool = caps.length > 0 ? caps : moves;
      const move = pool[Math.floor(Math.random() * pool.length)];

      if (useGameStore.getState().soundEnabled) {
        if (move.promote) playPromoteSound();
        else if (move.captures.length > 0) playCaptureSound();
        else playMoveSound();
      }

      engine.applyMove(move);
      const nextMoves = engine.legalMoves();
      const maxCap = Math.max(0, ...nextMoves.map((m) => m.captures.length));

      useGameStore.setState({
        pieces: engine.getPieces(),
        turn: engine.turn,
        selected: null,
        legalMoves: nextMoves,
        legalDestinations: [],
        hopPath: [],
        status: engine.winner ? 'finished' : 'active',
        winner: engine.winner,
        resultReason: engine.resultReason,
        blackMs: useGameStore.getState().blackMs + useGameStore.getState().incrementMs,
        lastTick: Date.now(),
        captureRequired: maxCap > 0,
        maxCaptures: maxCap,
      });
      botThinking.current = false;
    }, delay);

    return () => {
      clearTimeout(t);
      botThinking.current = false;
    };
  }, [turn, status, engine, liveMode, opponentOnline, isHost, isOnlineRoom]);

  const cycleCamera = useCallback(() => {
    const modes: CameraMode[] = ['tilted', 'immersive', 'tactical', 'topdown'];
    const idx = modes.indexOf(camera);
    setCamera(modes[(idx + 1) % modes.length]);
  }, [camera, setCamera]);

  // I can move only on my color's turn
  const canMove =
    status === 'active' &&
    (!isOnlineRoom || (connStatus === 'connected' && !syncing && opponentOnline)) &&
    ((myRole === 'white' && turn === 'white') || (myRole === 'black' && turn === 'black'));

  // For guest (black), flip board so pink pieces are at bottom
  const flipBoard = myRole === 'black';

  const whiteCaptured = 20 - pieces.filter((p) => p.color === 'black').length;
  const blackCaptured = 20 - pieces.filter((p) => p.color === 'white').length;

  const connLabel =
    connStatus === 'connected'
      ? opponentOnline || liveMode
        ? 'Live'
        : 'Connected · waiting'
      : connStatus === 'connecting'
      ? 'Connecting…'
      : connStatus === 'error'
      ? 'Reconnecting…'
      : 'Offline';

  const connColor =
    connStatus === 'connected' && (opponentOnline || liveMode)
      ? '#3FB98A'
      : connStatus === 'connected'
      ? '#F5A524'
      : connStatus === 'connecting'
      ? '#9ca3af'
      : '#E5484D';

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto bg-[#0B0F14] relative overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <Link
          href="/home"
          className="w-10 h-10 rounded-xl bg-[#1a222c] flex items-center justify-center text-[#e8e6e3] text-lg"
        >
          ←
        </Link>
        <div className="text-center min-w-0">
          <p className="text-sm font-medium text-[#e8e6e3] truncate">
            {isOnlineRoom
              ? isHost
                ? opponentOnline || liveMode
                  ? 'Opponent (pink)'
                  : 'Waiting for opponent'
                : 'Host (white)'
              : 'Black (Bot)'}
          </p>
          <p className="text-xs text-[#6b7280] flex items-center justify-center gap-1.5">
            {roomCode ? (
              <>
                <span className="text-[#D4A24C] font-semibold tracking-wider">{roomCode}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: connColor }} />
                  {connLabel}
                </span>
              </>
            ) : (
              <>
                Demo · <span className="w-1.5 h-1.5 rounded-full bg-[#3FB98A] inline-block" />
              </>
            )}
          </p>
        </div>
        <button
          onClick={cycleCamera}
          className="w-10 h-10 rounded-xl bg-[#1a222c] flex items-center justify-center text-xs text-[#9ca3af] font-medium"
        >
          3D
        </button>
      </div>

      {/* You are playing as */}
      {isOnlineRoom && (
        <div className="px-4 pb-1 shrink-0">
          <p className="text-[11px] text-center text-[#6b7280]">
            You are{' '}
            <span className="font-semibold" style={{ color: isHost ? '#e8dcc8' : '#ff7eb3' }}>
              {isHost ? 'White' : 'Pink (Black)'}
            </span>
            {canMove ? ' · your turn' : turn === (isHost ? 'black' : 'white') ? " · opponent's turn" : ''}
          </p>
        </div>
      )}

      {/* Top clock = opponent relative to me */}
      <div className="px-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-0.5 items-center">
            {Array.from({ length: Math.min(isHost ? whiteCaptured : blackCaptured, 10) }).map(
              (_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: isHost
                      ? 'linear-gradient(145deg, #fffef9, #d4c4a0)'
                      : 'linear-gradient(145deg, #ffc0d9, #e84393)',
                  }}
                />
              )
            )}
          </div>
          <p
            className="text-sm tabular font-medium"
            style={{
              color: clockColor(isHost ? blackMs : whiteMs, turn === (isHost ? 'black' : 'white')),
            }}
          >
            {formatMs(isHost ? blackMs : whiteMs)}
          </p>
        </div>
        <div className="clock-bar">
          <div
            style={{
              width: `${Math.min(100, ((isHost ? blackMs : whiteMs) / 180000) * 100)}%`,
              background: clockColor(
                isHost ? blackMs : whiteMs,
                turn === (isHost ? 'black' : 'white')
              ),
              transition: 'width 0.25s linear',
            }}
          />
        </div>
      </div>

      <div className="text-center py-1 shrink-0 h-6">
        {status === 'active' && (
          <p className="text-xs font-medium" style={{ color: canMove ? '#D4A24C' : '#9ca3af' }}>
            {canMove
              ? captureRequired
                ? 'Capture required — tap piece'
                : 'Your turn — tap a piece'
              : liveMode || opponentOnline
              ? 'Opponent thinking…'
              : isHost
              ? 'Bot thinking…'
              : 'Waiting for host…'}
          </p>
        )}
      </div>

      {/* Board */}
      <div
        className="flex-1 flex items-center justify-center px-2 min-h-0"
        style={{
          transform: flipBoard ? 'rotate(180deg)' : undefined,
        }}
      >
        <Board3D
          boardSize={boardSize}
          interactive={canMove}
          flipPieces={flipBoard}
        />
      </div>

      {/* Bottom clock = me */}
      <div className="px-4 shrink-0 mt-1">
        <div className="flex items-center justify-between mb-1">
          <p
            className="text-sm tabular font-medium"
            style={{
              color: clockColor(isHost ? whiteMs : blackMs, canMove),
            }}
          >
            {formatMs(isHost ? whiteMs : blackMs)}
          </p>
          <div className="flex gap-0.5 items-center">
            {Array.from({ length: Math.min(isHost ? blackCaptured : whiteCaptured, 10) }).map(
              (_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: isHost
                      ? 'linear-gradient(145deg, #ffc0d9, #e84393)'
                      : 'linear-gradient(145deg, #fffef9, #d4c4a0)',
                  }}
                />
              )
            )}
          </div>
        </div>
        <div className="clock-bar">
          <div
            style={{
              width: `${Math.min(100, ((isHost ? whiteMs : blackMs) / 180000) * 100)}%`,
              background: clockColor(isHost ? whiteMs : blackMs, canMove),
              transition: 'width 0.25s linear',
              boxShadow: canMove ? '0 0 8px #D4A24C55' : undefined,
            }}
          />
        </div>
      </div>

      <div className="action-bar mt-2 shrink-0">
        <button type="button" className="action-btn" onClick={cycleCamera}>
          <span className="text-base">↻</span>
          <span>3D</span>
        </button>
        <button
          type="button"
          className="action-btn"
          disabled={isOnlineRoom && (syncing || connStatus !== 'connected')}
          onClick={() => {
            newGame();

          }}
        >
          <span className="text-base">⟲</span>
          <span>New</span>
        </button>
        <button
          type="button"
          className="action-btn danger"
          onClick={() => {
            if (!isOnlineRoom) { resign(); return; }
            useGameStore.setState({ status: 'finished', winner: myRole === 'white' ? 'black' : 'white', resultReason: 'resignation' });
          }}
          disabled={status !== 'active' || (isOnlineRoom && (syncing || connStatus !== 'connected'))}
        >
          <span className="text-base">🏳</span>
          <span>Resign</span>
        </button>
      </div>

      {showResult && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl bg-[#131A22] border-t border-[#2a3340] p-6 pb-10">
            <div className="w-10 h-1 rounded-full bg-[#2a3340] mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-center text-[#e8e6e3]">
              {winner === myRole ? 'Victory!' : winner && winner !== 'draw' ? 'Defeat' : 'Draw'}
            </h2>
            <p className="text-center text-sm text-[#9ca3af] mt-1 capitalize">
              {resultReason?.replace(/_/g, ' ') || ''}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                disabled={isOnlineRoom && (syncing || connStatus !== 'connected')}
                onClick={() => {
                  setShowResult(false);
                  newGame();
                }}
                className="flex-1 h-12 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold"
              >
                Rematch
              </button>
              <Link
                href="/home"
                className="flex-1 h-12 rounded-xl bg-[#1a222c] font-medium flex items-center justify-center text-[#e8e6e3]"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GameRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center text-[#9ca3af]">Loading room…</div>
      }
    >
      <GameRoomInner />
    </Suspense>
  );
}
