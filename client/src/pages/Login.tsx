import { useState, FormEvent } from 'react';
import { LockKeyhole, ShieldCheck, Users, CalendarCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { inputCls, btnPrimary } from '../components/ui';

const POINTS = [
  { icon: ShieldCheck, text: 'Compliance checked before every booking' },
  { icon: CalendarCheck, text: 'Human-led allocation, no black-box matching' },
  { icon: Users, text: 'Worker, client and supervisor portals in one place' },
];

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-pop grid w-full max-w-4xl overflow-hidden rounded-3xl animate-pop-in md:grid-cols-5">
        {/* brand panel */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-brand-950 p-8 text-white md:col-span-2 md:flex">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-500/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex rounded-2xl bg-white px-3 py-2 shadow-sm">
              <img src="/sanitaslogo.png" alt="Sanitas Medical Recruitment" className="h-9 w-auto" />
            </div>
            <h2 className="mt-8 font-display text-2xl font-bold leading-tight">Staffing operations,<br />done properly.</h2>
            <p className="mt-2 text-sm text-brand-100/80">Nurses, HCAs and support workers into care homes across the South East.</p>
          </div>
          <ul className="relative space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-brand-50/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icon className="h-4 w-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* form */}
        <div className="p-8 sm:p-10 md:col-span-3">
          <div className="mb-6 flex justify-center md:hidden">
            <img src="/sanitaslogo.png" alt="Sanitas Medical Recruitment" className="h-12 w-auto" />
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600"><LockKeyhole className="h-5 w-5" /></span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Staff, worker, client and supervisor accounts all sign in here.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 animate-fade-in">{error}</p>}
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full justify-center py-2.5`}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-[11px] text-slate-400">
            New worker? <a href="/register" className="font-medium text-brand-600 hover:underline">Register online</a>
          </p>
        </div>
      </div>
    </div>
  );
}
