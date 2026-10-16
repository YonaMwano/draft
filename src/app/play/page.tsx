'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';

const TIME_CONTROLS = [
  { id: 'bullet', label: 'Bullet 1+0' },
  { id: 'blitz3', label: 'Blitz 3+2' },
  { id: 'blitz5', label: 'Blitz 5+3' },
  { id: 'rapid', label: 'Rapid 10+5' },
  { id: 'classic', label: 'Classic 20+10' },
];

function PlayContent() {
  const params = useSearchParams();
  const mode = params.get('mode') || 'quick';
  const router = useRouter();
  const [tc, setTc] = useState('blitz3');
  const [rated, setRated] = useState(true);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [code, setCode] = useState('');

  function startSearch() {
    setSearching(true);
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    setTimeout(() => {
      clearInterval(t);
      router.push('/game/demo');
    }, 3500);
  }

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto px-4 pt-6 pb-10">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C] mb-6 inline-block">
        ← Back to lobby
      </Link>

      <h1 className="text-2xl font-semibold mb-6 capitalize">
        {mode === 'bot'
          ? 'Play vs Bot'
          : mode === 'challenge'
          ? 'Challenge Friend'
          : mode === 'join'
          ? 'Join by Code'
          : 'Quick Match'}
      </h1>

      {mode === 'join' ? (
        <div className="flex flex-col gap-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Enter 6-character code"
            className="w-full h-14 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] text-center text-xl tracking-[0.3em] font-medium outline-none focus:border-[#D4A24C] text-[#e8e6e3]"
          />
          <button
            disabled={code.length < 6}
            onClick={() => router.push(`/game/${code}`)}
            className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold disabled:opacity-50"
          >
            Join Game
          </button>
        </div>
      ) : mode === 'challenge' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#9ca3af]">Create a private room and share the link or code.</p>
          <button className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold">
            Create Challenge
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-[#6b7280] mb-3">Time Control</p>
            <div className="flex flex-wrap gap-2">
              {TIME_CONTROLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTc(t.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    tc === t.id ? 'bg-[#D4A24C] text-[#0B0F14]' : 'bg-[#1a222c] text-[#e8e6e3]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {mode !== 'bot' && (
            <label className="flex items-center justify-between mb-8 p-4 rounded-xl bg-[#1a222c] cursor-pointer">
              <span className="font-medium text-sm">Rated game</span>
              <div
                className={`w-11 h-6 rounded-full transition-colors relative ${rated ? 'bg-[#D4A24C]' : 'bg-[#2a3340]'}`}
                onClick={() => setRated(!rated)}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    rated ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          )}

          {mode === 'bot' && (
            <div className="mb-8 grid grid-cols-2 gap-3">
              {['Easy', 'Medium', 'Hard', 'Adaptive'].map((d) => (
                <button key={d} className="h-12 rounded-xl bg-[#1a222c] font-medium text-sm active:scale-[0.98]">
                  {d}
                </button>
              ))}
            </div>
          )}

          {searching ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-16 h-16 rounded-full border-2 border-[#D4A24C] border-t-transparent animate-spin" />
              <p className="font-medium">Searching for opponent…</p>
              <p className="text-sm text-[#6b7280] tabular">{elapsed}s · rating window expanding</p>
              <button onClick={() => setSearching(false)} className="mt-4 text-sm text-[#E5484D] hover:underline">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startSearch}
              className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold text-base shadow-lg shadow-[#D4A24C33] active:scale-[0.98] transition-transform"
            >
              {mode === 'bot' ? 'Start Game' : 'Find Match'}
            </button>
          )}
        </>
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-[#9ca3af]">Loading…</div>}>
      <PlayContent />
    </Suspense>
  );
}
