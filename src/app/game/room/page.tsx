'use client';

import Link from 'next/link';
import Board3D from '@/components/Board3D';
import { useGameStore, CameraMode } from '@/store/gameStore';
import { playMoveSound, playCaptureSound, playPromoteSound } from '@/lib/sound';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
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
  const roomCode = searchParams.get('code') || '';
  const role = searchParams.get('role') || 'host';
  const roomId = searchParams.get('id') || '';

  const store = useGameStore();
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
    maxCaptures,
    engine,
  } = store;

  const [boardSize, setBoardSize] = useState(340);
  const [showResult, setShowResult] = useState(false);
  const botThinking = useRef(false);

  useEffect(() => {
    newGame();
  }, [newGame]);

  useEffect(() => {
    const update = () => {
      const size = Math.min(window.innerWidth - 24, window.innerHeight - 240, 520);
      setBoardSize(Math.max(280, size));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (status !== 'active') return;
    const id = setInterval(() => tick(), 200);
    return () => clearInterval(id);
  }, [status, tick]);

  useEffect(() => {
    if (status === 'finished') {
      const t = setTimeout(() => setShowResult(true), 500);
      return () => clearTimeout(t);
    }
    setShowResult(false);
  }, [status]);

  // Simple bot: when it's black's turn, pick a random legal move after a short delay
  useEffect(() => {
    if (status !== 'active' || turn !== 'black' || !engine || botThinking.current) return;

    botThinking.current = true;
    const delay = 600 + Math.random() * 900;

    const t = setTimeout(() => {
      const moves = engine.legalMoves('black');
      if (moves.length === 0) {
        botThinking.current = false;
        return;
      }
      // Prefer captures, otherwise random
      const caps = moves.filter((m) => m.captures.length > 0);
      const pool = caps.length > 0 ? caps : moves;
      const move = pool[Math.floor(Math.random() * pool.length)];

      // Sound for bot move
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
  }, [turn, status, engine]);

  const cycleCamera = useCallback(() => {
    const modes: CameraMode[] = ['tilted', 'immersive', 'tactical', 'topdown'];
    const idx = modes.indexOf(camera);
    setCamera(modes[(idx + 1) % modes.length]);
  }, [camera, setCamera]);

  const whiteCaptured = 20 - pieces.filter((p) => p.color === 'black').length;
  const blackCaptured = 20 - pieces.filter((p) => p.color === 'white').length;

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
        <div className="text-center">
          <p className="text-sm font-medium text-[#e8e6e3]">
            {roomCode ? (role === 'host' || role === 'white' ? 'Waiting for opponent' : 'Friend') : 'Black (Bot)'}
          </p>
          <p className="text-xs text-[#6b7280] flex items-center justify-center gap-1.5">
            {roomCode ? (
              <>Code <span className="text-[#D4A24C] font-semibold tracking-wider">{roomCode}</span></>
            ) : (
              <>Demo · <span className="w-1.5 h-1.5 rounded-full bg-[#3FB98A] inline-block" /></>
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

      {/* Opponent clock */}
      <div className="px-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-0.5 items-center">
            {Array.from({ length: Math.min(whiteCaptured, 10) }).map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: 'linear-gradient(145deg, #f8f4ec, #d4c4a8)' }}
              />
            ))}
            {whiteCaptured > 10 && (
              <span className="text-[10px] text-[#9ca3af] ml-0.5">+{whiteCaptured - 10}</span>
            )}
          </div>
          <p className="text-sm tabular font-medium" style={{ color: clockColor(blackMs, turn === 'black') }}>
            {formatMs(blackMs)}
          </p>
        </div>
        <div className="clock-bar">
          <div
            style={{
              width: `${Math.min(100, (blackMs / 180000) * 100)}%`,
              background: clockColor(blackMs, turn === 'black'),
              transition: 'width 0.2s linear',
            }}
          />
        </div>
      </div>

      {/* Turn banner */}
      <div className="text-center py-1.5 shrink-0 h-7">
        {status === 'active' && (
          <p className="text-xs font-medium" style={{ color: turn === 'white' ? '#D4A24C' : '#9ca3af' }}>
            {turn === 'white' ? 'Your turn — tap a piece' : 'Bot is thinking…'}
            {captureRequired && turn === 'white' && (
              <span className="ml-2 text-[#F5A524]">· Capture required</span>
            )}
          </p>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-2 min-h-0">
        <Board3D boardSize={boardSize} interactive={status === 'active' && turn === 'white'} />
      </div>

      {/* Your clock */}
      <div className="px-4 shrink-0 mt-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm tabular font-medium" style={{ color: clockColor(whiteMs, turn === 'white') }}>
            {formatMs(whiteMs)}
          </p>
          <div className="flex gap-0.5 items-center">
            {Array.from({ length: Math.min(blackCaptured, 10) }).map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: 'linear-gradient(145deg, #3a3a3a, #1a1a1a)' }}
              />
            ))}
            {blackCaptured > 10 && (
              <span className="text-[10px] text-[#9ca3af] ml-0.5">+{blackCaptured - 10}</span>
            )}
          </div>
        </div>
        <div className="clock-bar">
          <div
            style={{
              width: `${Math.min(100, (whiteMs / 180000) * 100)}%`,
              background: clockColor(whiteMs, turn === 'white'),
              transition: 'width 0.2s linear',
              boxShadow: turn === 'white' ? '0 0 8px #D4A24C55' : undefined,
            }}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="action-bar mt-2 shrink-0">
        <button className="action-btn" onClick={cycleCamera}>
          <span className="text-base">↻</span>
          <span>3D</span>
        </button>
        <button className="action-btn" onClick={() => newGame()}>
          <span className="text-base">⟲</span>
          <span>New</span>
        </button>
        <button className="action-btn" disabled>
          <span className="text-base">☰</span>
          <span>Moves</span>
        </button>
        <button className="action-btn danger" onClick={resign} disabled={status !== 'active'}>
          <span className="text-base">🏳</span>
          <span>Resign</span>
        </button>
      </div>

      {/* Result sheet */}
      {showResult && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl bg-[#131A22] border-t border-[#2a3340] p-6 pb-10">
            <div className="w-10 h-1 rounded-full bg-[#2a3340] mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-center text-[#e8e6e3]">
              {winner === 'white' ? 'Victory!' : winner === 'black' ? 'Defeat' : 'Draw'}
            </h2>
            <p className="text-center text-sm text-[#9ca3af] mt-1 capitalize">
              {resultReason?.replace(/_/g, ' ') || ''}
            </p>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="rounded-xl bg-[#1a222c] p-3 text-center">
                <p className="text-xs text-[#6b7280]">You captured</p>
                <p className="text-lg font-semibold tabular mt-0.5">{blackCaptured}</p>
              </div>
              <div className="rounded-xl bg-[#1a222c] p-3 text-center">
                <p className="text-xs text-[#6b7280]">Left</p>
                <p className="text-lg font-semibold tabular mt-0.5">
                  {pieces.filter((p) => p.color === 'white').length}
                </p>
              </div>
              <div className="rounded-xl bg-[#1a222c] p-3 text-center">
                <p className="text-xs text-[#6b7280]">Kings</p>
                <p className="text-lg font-semibold tabular mt-0.5">
                  {pieces.filter((p) => p.color === 'white' && p.isKing).length}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
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
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-[#9ca3af]">Loading room…</div>}>
      <GameRoomInner />
    </Suspense>
  );
}
