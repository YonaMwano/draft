'use client';

import Link from 'next/link';
import Board3D from '@/components/Board3D';
import { useGameStore, CameraMode } from '@/store/gameStore';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useEffect, useState, useCallback, Suspense } from 'react';
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
  const isOnlineRoom = !!roomCode;
  const { pieces, turn, status, winner, resultReason, whiteMs, blackMs, camera, setCamera, captureRequired } = useGameStore();
  const { status: connStatus, opponentOnline, role: myRole, roomStatus, error, busy, initialMs, selectSquare, resign } = useMultiplayer(roomCode);
  const isHost = myRole === 'white';
  const [boardSize, setBoardSize] = useState(340);
  const [showResult, setShowResult] = useState(false);
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

  useEffect(() => {
    setShowResult(status === 'finished');
  }, [status]);

  const cycleCamera = useCallback(() => {
    const modes: CameraMode[] = ['tilted', 'immersive', 'tactical', 'topdown'];
    const idx = modes.indexOf(camera);
    setCamera(modes[(idx + 1) % modes.length]);
  }, [camera, setCamera]);

  // I can move only on my color's turn
  const canMove =
    status === 'active' && connStatus === 'connected' && !busy &&
    ((myRole === 'white' && turn === 'white') || (myRole === 'black' && turn === 'black'));

  // For guest (black), flip board so pink pieces are at bottom
  const flipBoard = myRole === 'black';

  const whiteCaptured = 20 - pieces.filter((p) => p.color === 'black').length;
  const blackCaptured = 20 - pieces.filter((p) => p.color === 'white').length;

  const connLabel =
    connStatus === 'connected'
      ? opponentOnline
        ? 'Live'
        : 'Connected · waiting'
      : connStatus === 'connecting'
      ? 'Connecting…'
      : connStatus === 'error'
      ? 'Reconnecting…'
      : 'Offline';

  const connColor =
    connStatus === 'connected' && (opponentOnline)
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
                ? opponentOnline
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
              width: `${Math.min(100, ((isHost ? blackMs : whiteMs) / initialMs) * 100)}%`,
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
              : opponentOnline
              ? 'Opponent thinking…'
              : 'Waiting for opponent…'}
          </p>
        )}
      </div>

      {(error || roomStatus === 'waiting') && (
        <p role="status" className="px-4 py-2 text-center text-xs text-[#F5A524]">
          {error || 'Share your code. The game starts when your opponent joins.'}
        </p>
      )}
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
          onSquareClick={selectSquare}
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
              width: `${Math.min(100, ((isHost ? whiteMs : blackMs) / initialMs) * 100)}%`,
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
        <Link href="/play?mode=challenge" className="action-btn"><span>⟲</span><span>New room</span></Link>
        <button
          type="button"
          className="action-btn danger"
          onClick={() => void resign()}
          disabled={status !== 'active' || connStatus !== 'connected' || busy}
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
              <Link href="/play?mode=challenge" className="flex-1 h-12 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold flex items-center justify-center">New room</Link>
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
