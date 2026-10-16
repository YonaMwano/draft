import Link from 'next/link';

export default function SocialPage() {
  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pt-6 pb-24">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C]">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-6">Friends</h1>
      <p className="text-[#9ca3af] text-sm mb-4">Your turn · 0 correspondence games</p>
      <div className="rounded-xl bg-[#1a222c] p-6 text-center text-[#6b7280] text-sm">
        No friends yet. Challenge someone from the lobby!
      </div>
    </main>
  );
}
