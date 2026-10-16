'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid email or password');
        return;
      }
      router.push('/home');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-[#6b7280] hover:text-[#D4A24C] mb-8 inline-block">
          ← Back
        </Link>

        <h1 className="text-2xl font-semibold mb-1">Welcome back</h1>
        <p className="text-sm text-[#9ca3af] mb-8">Log in to continue playing</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[#9ca3af] mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] text-[#e8e6e3] outline-none focus:border-[#D4A24C] transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-[#9ca3af] mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] text-[#e8e6e3] outline-none focus:border-[#D4A24C] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded accent-[#D4A24C]"
              />
              <span className="text-[#9ca3af]">Remember me</span>
            </label>
            <span className="text-[#D4A24C] opacity-60 cursor-not-allowed">Forgot password?</span>
          </div>

          {error && (
            <p className="text-sm text-[#E5484D] bg-[#E5484D15] px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-[#6b7280] mt-8">
          Don’t have an account?{' '}
          <Link href="/register" className="text-[#D4A24C] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
