'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  function goToStep2() {
    setError('');
    setDetail('');
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setStep(2);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDetail('');
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        setError('Server returned an invalid response (status ' + res.status + ')');
        return;
      }

      if (!res.ok) {
        setError(data.error || `Registration failed (${res.status})`);
        if (data.detail) setDetail(data.detail);
        return;
      }

      router.push('/home');
    } catch (err: any) {
      console.error(err);
      setError('Network error. Is the server running?');
      setDetail(err?.message || '');
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

        <div className="flex gap-2 mb-6">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step >= n ? 'bg-[#D4A24C]' : 'bg-[#1a222c]'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold mb-1 text-[#e8e6e3]">Create account</h1>
            <p className="text-sm text-[#9ca3af] mb-8">Email & password</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-[#9ca3af] mb-1.5">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] outline-none focus:border-[#D4A24C] text-[#e8e6e3] transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9ca3af] mb-1.5">Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] outline-none focus:border-[#D4A24C] text-[#e8e6e3] transition-colors"
                  placeholder="At least 8 characters"
                />
                <div className="flex gap-1 mt-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        strength > i
                          ? strength <= 1
                            ? 'bg-[#E5484D]'
                            : strength <= 2
                            ? 'bg-[#F5A524]'
                            : 'bg-[#3FB98A]'
                          : 'bg-[#1a222c]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-sm text-[#E5484D] bg-[#E5484D15] px-3 py-2 rounded-lg">
                  <p>{error}</p>
                  {detail && <p className="text-xs mt-1 opacity-80 break-all">{detail}</p>}
                </div>
              )}

              <button
                type="button"
                onClick={goToStep2}
                className="h-12 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold mt-2 active:scale-[0.98] transition-transform"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold mb-1 text-[#e8e6e3]">Choose identity</h1>
            <p className="text-sm text-[#9ca3af] mb-8">Username & display name</p>

            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-[#9ca3af] mb-1.5">Username</label>
                <input
                  required
                  minLength={3}
                  maxLength={16}
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  className="w-full h-12 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] outline-none focus:border-[#D4A24C] text-[#e8e6e3] transition-colors"
                  placeholder="3–16 characters"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9ca3af] mb-1.5">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-[#1a222c] border border-[#2a3340] outline-none focus:border-[#D4A24C] text-[#e8e6e3] transition-colors"
                  placeholder="How others see you"
                />
              </div>

              {error && (
                <div className="text-sm text-[#E5484D] bg-[#E5484D15] px-3 py-2 rounded-lg">
                  <p className="font-medium">{error}</p>
                  {detail && (
                    <p className="text-xs mt-1 opacity-80 break-all font-mono">{detail}</p>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setDetail('');
                    setStep(1);
                  }}
                  className="h-12 flex-1 rounded-xl bg-[#1a222c] font-medium text-[#e8e6e3]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || username.length < 3}
                  className="h-12 flex-1 rounded-xl bg-[#D4A24C] text-[#0B0F14] font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {loading ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </>
        )}

        <p className="text-center text-sm text-[#6b7280] mt-8">
          Already have an account?{' '}
          <Link href="/login" className="text-[#D4A24C] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
