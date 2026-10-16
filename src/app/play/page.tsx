'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense, useCallback } from 'react';

const TIME_CONTROLS = [
  { id: 'bullet', label: 'Bullet 1+0' },
  { id: 'blitz3', label: 'Blitz 3+2' },
  { id: 'blitz5', label: 'Blitz 5+3' },
  { id: 'rapid', label: 'Rapid 10+5' },
  { id: 'classic', label: 'Classic 20+10' },
];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

function PlayContent() {
  const params = useSearchParams();
  const modeParam = params.get('mode') || 'quick';
  const prefillCode = (params.get('code') || '').toUpperCase();
  const router = useRouter();

  // Normalize mode
  const mode =
    modeParam === 'challenge' || modeParam === 'friend'
      ? 'challenge'
      : modeParam === 'join'
      ? 'join'
      : modeParam === 'bot'
      ? 'bot'
      : 'quick';

  const [tc, setTc] = useState('blitz3');
  const [rated, setRated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Challenge
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

  // ── Create challenge (always works — API optional) ──────────
  const createChallenge = useCallback(async () => {
    setCreating(true);
    setCreateError('');
    setCreatedCode(null);
    setCreatedGameId(null);

    const localCode = generateCode(6);
    let gameId = localCode.toLowerCase();
    let usedApi = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeControl: tc, isRated: rated }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.code) {
        setCreatedCode(String(data.code).toUpperCase());
        setCreatedGameId(data.gameId || String(data.code).toLowerCase());
        usedApi = true;
        // Persist for join on same device / refresh
        try {
          localStorage.setItem(
            `challenge:${String(data.code).toUpperCase()}`,
            JSON.stringify({
              gameId: data.gameId,
              tc,
              createdAt: Date.now(),
            })
          );
        } catch (_) {}
      }
    } catch (_) {
      // API down — continue with local code
    }

    if (!usedApi) {
      setCreatedCode(localCode);
      setCreatedGameId(gameId);
      try {
        localStorage.setItem(
          `challenge:${localCode}`,
          JSON.stringify({ gameId, tc, createdAt: Date.now(), localOnly: true })
        );
      } catch (_) {}
    }

    setCreating(false);
  }, [tc, rated]);

  function copyCode() {
    if (!createdCode) return;
    const text = createdCode;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text: string) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_) {}
  }

  function shareCode() {
    if (!createdCode) return;
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/play?mode=join&code=${createdCode}`
        : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: 'Online Drafts',
          text: `Join my game! Code: ${createdCode}`,
          url,
        })
        .catch(() => copyCode());
    } else {
      copyCode();
    }
  }

  function enterWaitingRoom() {
    const id = createdGameId || (createdCode ? createdCode.toLowerCase() : 'demo');
    const code = createdCode || '';
    // Always use static /game/room — works on Netlify (no dynamic [id] 404)
    router.push(`/game/room?id=${encodeURIComponent(id)}&code=${encodeURIComponent(code)}&role=host`);
  }

  // ── Join by code ────────────────────────────────────────────
  async function joinByCode() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setJoinError('Enter the full code (at least 4 characters)');
      return;
    }
    setJoining(true);
    setJoinError('');

    // 1) localStorage from same browser
    try {
      const raw = localStorage.getItem(`challenge:${c}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const gid = parsed.gameId || c.toLowerCase();
        router.push(`/game/room?id=${encodeURIComponent(gid)}&code=${encodeURIComponent(c)}&role=guest`);
        return;
      }
    } catch (_) {}

    // 2) API
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/challenges/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.gameId) {
        router.push(`/game/room?id=${encodeURIComponent(data.gameId)}&code=${encodeURIComponent(c)}&role=${encodeURIComponent(data.role || 'guest')}`);
        return;
      }

      // Lookup only
      const lookup = await fetch(`/api/challenges?code=${encodeURIComponent(c)}`);
      const info = await lookup.json().catch(() => ({}));
      if (lookup.ok && info.gameId) {
        router.push(`/game/room?id=${encodeURIComponent(info.gameId)}&code=${encodeURIComponent(c)}&role=guest`);
        return;
      }

      if (data.error || info.error) {
        setJoinError(data.error || info.error);
      } else {
        // 3) Last resort: open game room with code as id (playable local)
        router.push(`/game/room?id=${encodeURIComponent(c.toLowerCase())}&code=${encodeURIComponent(c)}&role=guest`);
        return;
      }
    } catch {
      // Offline: still open a room so UX isn't blocked
      router.push(`/game/room?id=${encodeURIComponent(c.toLowerCase())}&code=${encodeURIComponent(c)}&role=guest`);
      return;
    } finally {
      setJoining(false);
    }
  }

  function startSearch() {
    setSearching(true);
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    setTimeout(() => {
      clearInterval(t);
      router.push('/game/demo');
    }, 2000);
  }

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto px-4 pt-6 pb-10">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C] mb-6 inline-block">
        ← Back to lobby
      </Link>

      <h1 className="text-2xl font-semibold mb-2 text-[#e8e6e3]">
        {mode === 'bot'
          ? 'Play vs Bot'
          : mode === 'challenge'
          ? 'Challenge a Friend'
          : mode === 'join'
          ? 'Join by Code'
          : 'Quick Match'}
      </h1>
      <p className="text-xs text-[#6b7280] mb-6">mode: {mode}</p>

      {/* ═══════ JOIN ═══════ */}
      {mode === 'join' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#9ca3af]">Enter the code your friend shared.</p>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setJoinError('');
            }}
            maxLength={6}
            placeholder="ABC123"
            autoFocus
            className="w-full h-16 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] text-center text-2xl tracking-[0.35em] font-semibold outline-none focus:border-[#D4A24C] text-[#e8e6e3]"
          />
          {joinError && (
            <p className="text-sm text-[#E5484D] bg-[#E5484D15] px-3 py-2 rounded-lg">{joinError}</p>
          )}
          <button
            type="button"
            disabled={code.length < 4 || joining}
            onClick={() => joinByCode()}
            className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join Game'}
          </button>
          <Link href="/play?mode=challenge" className="text-center text-sm text-[#D4A24C]">
            Create a challenge instead
          </Link>
        </div>
      )}

      {/* ═══════ CHALLENGE — form ═══════ */}
      {mode === 'challenge' && !createdCode && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-[#9ca3af]">
            Create a private room and share the code with your friend.
          </p>

          <div>
            <p className="text-xs uppercase tracking-wider text-[#6b7280] mb-3">Time Control</p>
            <div className="flex flex-wrap gap-2">
              {TIME_CONTROLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTc(t.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
                    tc === t.id ? 'bg-[#D4A24C] text-[#0B0F14]' : 'bg-[#1a222c] text-[#e8e6e3]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRated((r) => !r)}
            className="flex items-center justify-between p-4 rounded-xl bg-[#1a222c] text-left"
          >
            <span className="font-medium text-sm text-[#e8e6e3]">Rated game</span>
            <span
              className={`w-11 h-6 rounded-full relative transition-colors ${
                rated ? 'bg-[#D4A24C]' : 'bg-[#2a3340]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  rated ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          {createError && (
            <p className="text-sm text-[#E5484D] bg-[#E5484D15] px-3 py-2 rounded-lg">{createError}</p>
          )}

          {/* PRIMARY CTA — always generates a code */}
          <button
            type="button"
            disabled={creating}
            onClick={() => createChallenge()}
            className="h-14 w-full rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold text-base shadow-lg shadow-[#D4A24C33] disabled:opacity-70 active:scale-[0.98] transition-transform"
          >
            {creating ? 'Creating…' : 'Create Challenge'}
          </button>
        </div>
      )}

      {/* ═══════ CHALLENGE — code ready ═══════ */}
      {mode === 'challenge' && createdCode && (
        <div className="flex flex-col gap-5 items-center">
          <p className="text-sm text-[#9ca3af] text-center">Share this code with your friend</p>
          <div className="w-full rounded-2xl bg-[#1a222c] border border-[#D4A24C66] py-8 px-4 text-center">
            <p className="text-4xl font-bold tracking-[0.35em] text-[#D4A24C]">{createdCode}</p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={copyCode}
              className="flex-1 h-12 rounded-xl bg-[#1a222c] font-medium text-sm text-[#e8e6e3]"
            >
              {copied ? '✓ Copied' : 'Copy code'}
            </button>
            <button
              type="button"
              onClick={shareCode}
              className="flex-1 h-12 rounded-xl bg-[#1a222c] font-medium text-sm text-[#e8e6e3]"
            >
              Share link
            </button>
          </div>

          <button
            type="button"
            onClick={enterWaitingRoom}
            className="w-full h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold"
          >
            Enter room & wait
          </button>

          <p className="text-xs text-[#6b7280] text-center leading-relaxed">
            Friend goes to <span className="text-[#e8e6e3]">Join by Code</span> and enters{' '}
            <span className="text-[#D4A24C] font-semibold">{createdCode}</span>
          </p>

          <button
            type="button"
            onClick={() => {
              setCreatedCode(null);
              setCreatedGameId(null);
              setCreateError('');
            }}
            className="text-sm text-[#6b7280] hover:text-[#D4A24C]"
          >
            ← Create another code
          </button>
        </div>
      )}

      {/* ═══════ QUICK / BOT ═══════ */}
      {(mode === 'quick' || mode === 'bot') && (
        <>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-[#6b7280] mb-3">Time Control</p>
            <div className="flex flex-wrap gap-2">
              {TIME_CONTROLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTc(t.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
                    tc === t.id ? 'bg-[#D4A24C] text-[#0B0F14]' : 'bg-[#1a222c] text-[#e8e6e3]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'bot' && (
            <div className="mb-8 grid grid-cols-2 gap-3">
              {['Easy', 'Medium', 'Hard', 'Adaptive'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => router.push('/game/demo')}
                  className="h-12 rounded-xl bg-[#1a222c] font-medium text-sm text-[#e8e6e3]"
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {mode === 'quick' &&
            (searching ? (
              <div className="flex flex-col items-center gap-4 py-10">
                <div className="w-16 h-16 rounded-full border-2 border-[#D4A24C] border-t-transparent animate-spin" />
                <p className="font-medium text-[#e8e6e3]">Searching… {elapsed}s</p>
                <button type="button" onClick={() => setSearching(false)} className="text-sm text-[#E5484D]">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startSearch}
                className="h-14 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold"
              >
                Find Match
              </button>
            ))}
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
