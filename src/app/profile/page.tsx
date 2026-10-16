import Link from 'next/link';

export default function ProfilePage() {
  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pt-6 pb-24">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C]">
        ← Back
      </Link>
      <div className="flex items-center gap-4 mt-6 mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4A24C] to-[#8A6440] flex items-center justify-center text-2xl font-bold text-[#0B0F14]">
          G
        </div>
        <div>
          <h1 className="text-xl font-semibold">Guest</h1>
          <p className="text-sm text-[#6b7280]">Member since today</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {['Bullet', 'Blitz', 'Rapid', 'Classic'].map((tc) => (
          <div key={tc} className="p-4 rounded-xl bg-[#1a222c]">
            <p className="text-xs text-[#6b7280]">{tc}</p>
            <p className="text-xl font-semibold tabular mt-1">1500</p>
          </div>
        ))}
      </div>
      <h2 className="text-sm font-medium text-[#9ca3af] mb-3">Recent Games</h2>
      <div className="rounded-xl bg-[#1a222c] p-6 text-center text-[#6b7280] text-sm">
        No games yet
      </div>
    </main>
  );
}
