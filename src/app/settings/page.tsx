import Link from 'next/link';

export default function SettingsPage() {
  return (
    <main className="min-h-dvh max-w-lg mx-auto px-4 pt-6 pb-10">
      <Link href="/home" className="text-sm text-[#6b7280] hover:text-[#D4A24C]">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4 mb-6">Settings</h1>
      <div className="space-y-3">
        {[
          'Board Theme (Classic / Neon)',
          'Camera Default',
          'Sound Volume',
          'Haptics',
          'Auto-flip Board',
          'Move Confirmation',
          'Coordinate Labels',
          'Reduced Motion',
          'High-contrast Pieces',
          'Language',
          'Change Password',
          'Delete Account',
        ].map((item) => (
          <div
            key={item}
            className="p-4 rounded-xl bg-[#1a222c] flex justify-between items-center cursor-pointer active:scale-[0.99] transition-transform"
          >
            <span className="text-sm font-medium">{item}</span>
            <span className="text-[#6b7280]">›</span>
          </div>
        ))}
      </div>
    </main>
  );
}
