import Link from 'next/link';

export default function LeaderboardPage() {
  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pt-6 pb-10">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C]">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-6">Leaderboard</h1>
      <div className="flex gap-2 mb-6">
        {['Global', 'This Week', 'Friends'].map((tab, i) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              i === 0 ? 'bg-[#D4A24C] text-[#0B0F14]' : 'bg-[#1a222c] text-[#e8e6e3]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((rank) => (
          <div key={rank} className="p-3 rounded-xl bg-[#1a222c] flex items-center gap-3">
            <span className="w-6 text-center font-medium text-[#D4A24C]">{rank}</span>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4A24C] to-[#8A6440]" />
            <div className="flex-1">
              <p className="text-sm font-medium">Player {rank}</p>
              <p className="text-xs text-[#6b7280]">Blitz</p>
            </div>
            <span className="tabular font-medium text-sm">{2100 - rank * 40}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
