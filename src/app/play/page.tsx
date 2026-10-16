'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

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
  const prefillCode = (params.get('code') || '').toUpperCase();
  const router = useRouter();

  const [tc, setTc] = useState('blitz3');
  const [rated, setRated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Challenge create
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');
  const [copied, setCopied] = useState(false);

  // Join
  const [code, setCode] = useState(prefillCode);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (prefillCode) setCode(prefillCode);
  }, [prefillCode]);

  // ── Quick match → demo for now ──────────────────────────────
  function startSearch() {
    setSearching(true);
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    setTimeout(() => {
      clearInterval(t);
      router.push('/game/demo');
    }, 2500);
  }

  // ── Create challenge ────────────────────────────────────────
  async function createChallenge() {
    setCreating(true);
    setCreateError('');
    setCreatedCode(null);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeControl: tc, isRated: rated }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Could not create challenge');
        return;
      }
      setCreatedCode(data.code);
      setCreatedGameId(data.gameId);
    } catch {
      setCreateError('Network error. Is the server running?');
    } finally {
      setCreating(false);
    }
  }

  function copyCode() {
    if (!createdCode) return;
    const text = createdCode;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function shareCode() {
    if (!createdCode) return;
    const url = `${window.location.origin}/play?mode=join&code=${createdCode}`;
    if (navigator.share) {
      navigator.share({
        title: 'Online Drafts challenge',
        text: `Join my draughts game! Code: ${createdCode}`,
        url,
      }).catch(() => copyCode());
    } else {
      copyCode();
    }
  }

  function enterWaitingRoom() {
    if (createdGameId) {
      router.push(`/game/${createdGameId}?code=${createdCode}&role=host`);
    } else if (createdCode) {
      router.push(`/game/${createdCode}?role=host`);
    }
  }

  // ── Join by code ────────────────────────────────────────────
  async function joinByCode() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setJoinError('Enter the full code');
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      // Lookup first
      const lookup = await fetch(`/api/challenges?code=${encodeURIComponent(c)}`);
      const info = await lookup.json();
      if (!lookup.ok) {
        setJoinError(info.error || 'Code not found');
        setJoining(false);
        return;
      }

      // Join seat
      const res = await fetch('/api/challenges/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Could not join');
        setJoining(false);
        return;
      }

      router.push(`/game/${data.gameId}?code=${c}&role=${data.role || 'guest'}`);
    } catch {
      setJoinError('Network error. Try again.');
      setJoining(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto px-4 pt-6 pb-10">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C] mb-6 inline-block">
        ← Back to lobby
      </Link>

      <h1 className="text-2xl font-semibold mb-6 text-[#e8e6e3]">
        {mode === 'bot'
          ? 'Play vs Bot'
          : mode === 'challenge'
          ? 'Challenge a Friend'
          : mode === 'join'
          ? 'Join by Code'
          : 'Quick Match'}
      </h1>

      {/* ════════ JOIN BY CODE ════════ */}
      {mode === 'join' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#9ca3af]">
            Enter the 6-character code your friend shared.
          </p>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setJoinError('');
            }}
            maxLength={6}
            placeholder="ABC123"
            autoFocus
            className="w-full h-16 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] text-center text-2xl tracking-[0.35em] font-semibold outline-none focus:border-[#D4A24C] text-[#e8e6e3] tabular"
          />
          {joinError && (
            <p className="text-sm text-[#E5484D] bg-[#E5484D15] px-3 py-2 rounded-lg">{joinError}</p>
          )}
          <button
            disabled={code.length < 4 || joining}
            onClick={joinByCode}
            className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {joining ? 'Joining…' : 'Join Game'}
          </button>
          <p className="text-center text-xs text-[#6b7280]">
            Don’t have a code?{' '}
            <Link href="/play?mode=challenge" className="text-[#D4A24C] hover:underline">
              Create a challenge
            </Link>
          </p>
        </div>
      )}

      {/* ════════ CREATE CHALLENGE ════════ */}
      {mode === 'challenge' && !createdCode && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-[#9ca3af]">
            Create a private room. Share the code so your friend can join.
          </p>

          <div>
            <p className="text-xs uppercase tracking-wider text-[#6b7280] mb-3">Time Control</p>
            <div className="flex flex-wrap gap-2">
              {TIME_CONTROLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
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

          <label className="flex items-center justify-between p-4 rounded-xl bg-[#1a222c] cursor-pointer">
            <span className="font-medium text-sm text-[#e8e6e3]">Rated game</span>
            <div
              role="switch"
              aria-checked={rated}
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

          {createError && (
            <p className="text-sm text-[#E5484D] bg-[#E5484D15] px-3 py-2 rounded-lg">{createError}</p>
          )}

          <button
            type="button"
            disabled={creating}
            onClick={createChallenge}
            className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {creating ? 'Creating…' : 'Create Challenge'}
          </button>
        </div>
      )}

      {/* ════════ CODE CREATED ════════ */}
      {mode === 'challenge' && createdCode && (
        <div className="flex flex-col gap-5 items-center">
          <p className="text-sm text-[#9ca3af] text-center">Share this code with your friend</p>
          <div className="w-full rounded-2xl bg-[#1a222c] border border-[#D4A24C44] py-8 px-4 text-center">
            <p className="text-4xl font-bold tracking-[0.4em] text-[#D4A24C] tabular">{createdCode}</p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={copyCode}
              className="flex-1 h-12 rounded-xl bg-[#1a222c] font-medium text-sm text-[#e8e6e3]"
            >
              {copied ? 'Copied!' : 'Copy code'}
            </button>
            <button
              type="button"
              onClick={shareCode}
              className="flex-1 h-12 rounded-xl bg-[#1a222c] font-medium text-sm text-[#e8e6e3]"
            >
              Share
            </button>
          </div>

          <button
            type="button"
            onClick={enterWaitingRoom}
            className="w-full h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold active:scale-[0.98] transition-transform"
          >
            Enter room & wait
          </button>

          <p className="text-xs text-[#6b7280] text-center">
            Friend opens Join by Code and enters <span className="text-[#D4A24C] font-medium">{createdCode}</span>
          </p>

          <button
            type="button"
            onClick={() => {
              setCreatedCode(null);
              setCreatedGameId(null);
            }}
            className="text-sm text-[#6b7280] hover:text-[#D4A24C]"
          >
            Create another
          </button>
        </div>
      )}

      {/* ════════ QUICK / BOT ════════ */}
      {(mode === 'quick' || mode === 'bot' || !['join', 'challenge'].includes(mode)) && (
        <>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-[#6b7280] mb-3">Time Control</p>
            <div className="flex flex-wrap gap-2">
              {TIME_CONTROLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
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
              <span className="font-medium text-sm text-[#e8e6e3]">Rated game</span>
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
                <button
                  key={d}
                  type="button"
                  onClick={() => router.push('/game/demo')}
                  className="h-12 rounded-xl bg-[#1a222c] font-medium text-sm text-[#e8e6e3] active:scale-[0.98]"
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {searching ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-16 h-16 rounded-full border-2 border-[#D4A24C] border-t-transparent animate-spin" />
              <p className="font-medium text-[#e8e6e3]">Searching for opponent…</p>
              <p className="text-sm text-[#6b7280] tabular">{elapsed}s</p>
              <button
                type="button"
                onClick={() => setSearching(false)}
                className="mt-4 text-sm text-[#E5484D] hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : mode !== 'bot' ? (
            <button
              type="button"
              onClick={startSearch}
              className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold text-base shadow-lg shadow-[#D4A24C33] active:scale-[0.98] transition-transform"
            >
              Find Match
            </button>
          ) : null}
        </>
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center text-[#9ca3af]">Loading…</div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
