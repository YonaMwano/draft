'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Board3D from '@/components/Board3D';
import { useGameStore } from '@/store/gameStore';

export default function LandingPage() {
  const newGame = useGameStore((s) => s.newGame);
  const setCamera = useGameStore((s) => s.setCamera);
  const [ready, setReady] = useState(false);
  const [boardSize, setBoardSize] = useState(320);

  useEffect(() => {
    newGame();
    setCamera('immersive');
    setReady(true);
    const update = () => setBoardSize(Math.min(360, window.innerWidth - 48));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [newGame, setCamera]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-between px-4 py-8 relative overflow-hidden">
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #D4A24C18 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-md flex flex-col items-center gap-2 z-10">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#8A6440] font-medium">
          v1.0 · 10×10 International
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-center text-[#e8e6e3]">
          Online Drafts
        </h1>
        <p className="text-sm text-[#9ca3af] text-center max-w-xs">
          Premium arena. Flying kings. Majority capture. Real-time.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center w-full max-w-[420px] py-6 z-10">
        {ready && <Board3D boardSize={boardSize} interactive={false} />}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3 z-10">
        <Link
          href="/play"
          className="w-full h-14 rounded-2xl bg-[#D4A24C] text-[#0B0F14] font-semibold text-base flex items-center justify-center shadow-lg shadow-[#D4A24C33] active:scale-[0.98] transition-transform"
        >
          Play Now
        </Link>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="flex-1 h-12 rounded-xl bg-[#1a222c] text-[#e8e6e3] font-medium text-sm flex items-center justify-center active:scale-[0.98] transition-transform"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="flex-1 h-12 rounded-xl bg-[#1a222c] text-[#e8e6e3] font-medium text-sm flex items-center justify-center active:scale-[0.98] transition-transform"
          >
            Create Account
          </Link>
        </div>
        <button
          onClick={async () => {
            try {
              const res = await fetch('/api/auth/guest', { method: 'POST' });
              if (res.ok) window.location.href = '/home';
              else window.location.href = '/home';
            } catch {
              window.location.href = '/home';
            }
          }}
          className="text-xs text-[#6b7280] underline underline-offset-2 py-2"
        >
          Play as Guest
        </button>
      </div>
    </main>
  );
}
