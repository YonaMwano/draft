'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [user, setUser] = useState<{ username: string | null; is_guest: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-dvh flex flex-col max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D4A24C] to-[#8A6440] flex items-center justify-center text-[#0B0F14] font-bold text-lg">
            {user?.username?.[0]?.toUpperCase() || 'G'}
          </div>
          <div>
            <p className="font-medium text-[15px]">{user?.username || 'Guest'}</p>
            <p className="text-xs text-[#6b7280] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3FB98A]" />
              Online · Unrated
            </p>
          </div>
        </div>
        <Link href="/settings" className="w-10 h-10 rounded-xl bg-[#1a222c] flex items-center justify-center text-[#9ca3af]">
          ⋮
        </Link>
      </header>

      {/* Primary actions */}
      <div className="flex flex-col gap-3 mb-8">
        <Link
          href="/play?mode=quick"
          className="h-16 rounded-2xl bg-[#D4A24C] text-[#0B0F14] font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#D4A24C22] active:scale-[0.98] transition-transform"
        >
          <span>⚡</span> Quick Match
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/play?mode=challenge" className="h-14 rounded-xl bg-[#1a222c] font-medium text-sm flex items-center justify-center active:scale-[0.98]">
            Challenge Friend
          </Link>
          <Link href="/play?mode=join" className="h-14 rounded-xl bg-[#1a222c] font-medium text-sm flex items-center justify-center active:scale-[0.98]">
            Join by Code
          </Link>
        </div>
        <Link href="/play?mode=bot" className="h-14 rounded-xl bg-[#1a222c] font-medium text-sm flex items-center justify-center active:scale-[0.98]">
          Play vs Bot
        </Link>
      </div>

      {/* Secondary */}
      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-wider text-[#6b7280] mb-3">More</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/puzzles" className="p-4 rounded-xl bg-[#1a222c] active:scale-[0.98]">
            <p className="font-medium text-sm">Daily Puzzle</p>
            <p className="text-xs text-[#6b7280] mt-0.5">Streak · 0</p>
          </Link>
          <Link href="/leaderboard" className="p-4 rounded-xl bg-[#1a222c] active:scale-[0.98]">
            <p className="font-medium text-sm">Leaderboard</p>
            <p className="text-xs text-[#6b7280] mt-0.5">Global</p>
          </Link>
        </div>
      </section>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-[#1a222c] bg-[#0B0F14ee] backdrop-blur-md">
        <div className="max-w-lg mx-auto flex justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {[
            { href: '/home', label: 'Home', icon: '⌂' },
            { href: '/play', label: 'Play', icon: '♟' },
            { href: '/social', label: 'Social', icon: '◎' },
            { href: '/profile', label: 'Profile', icon: '☺' },
          ].map((t) => (
            <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5 px-4 py-1 text-[#9ca3af] hover:text-[#D4A24C]">
              <span className="text-lg">{t.icon}</span>
              <span className="text-[10px] font-medium">{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
