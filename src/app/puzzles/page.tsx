import Link from 'next/link';

export default function PuzzlesPage() {
  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pt-6 pb-10">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C]">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-2">Daily Puzzle</h1>
      <p className="text-[#9ca3af] text-sm mb-8">Streak · 0 · Coming fully next</p>
      <div className="rounded-2xl bg-[#1a222c] h-64 flex items-center justify-center text-[#6b7280]">
        Puzzle board placeholder
      </div>
      <button className="mt-6 w-full h-12 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold">
        Solve
      </button>
    </main>
  );
}
