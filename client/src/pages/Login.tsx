import { useState, FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { inputCls, btnPrimary } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <img src="/sanitaslogo.png" alt="Sanitas Medical Recruitment" className="h-12 w-auto" />
        </div>
        <h1 className="mb-1 text-center font-display text-xl font-bold text-ink">Sign in</h1>
        <p className="mb-6 text-center text-xs text-slate-500">
          Staff, worker, client and supervisor accounts all sign in here.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
            <input
              type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputCls}
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full justify-center`}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-[11px] text-slate-400">
          New worker? <a href="/register" className="text-brand-600 hover:underline">Register online</a>
        </p>
      </div>
    </div>
  );
}
