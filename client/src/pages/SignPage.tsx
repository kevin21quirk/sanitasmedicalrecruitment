import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, PenLine } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { inputCls, btnPrimary } from '../components/ui';

interface SignInfo {
  kind: 'worker_signature' | 'client_signature';
  used: boolean;
  already_signed: boolean;
  locked: boolean;
  shift: {
    id: number; date: string; start: string; end: string; hours: number; type: string;
    worker_name: string; client_name: string; instructions: string | null;
  };
}

// 6.2 — public phone-signing link for timesheets. No login required; the
// token itself is the authorisation. Deliberately shows no rates (6.1).
export default function SignPage() {
  const { token } = useParams();
  const [info, setInfo] = useState<SignInfo | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<SignInfo>(`/public/sign/${token}`).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  const sign = async () => {
    setBusy(true); setError('');
    try {
      await api.post(`/public/sign/${token}`, { name, notes: notes || null });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign');
      setBusy(false);
    }
  };

  const isClient = info?.kind === 'client_signature';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <img src="/sanitaslogo.png" alt="Sanitas Medical Recruitment" className="h-9 w-auto" />
        <h1 className="mt-4 font-display text-xl font-bold text-ink">Timesheet signature</h1>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!info && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

        {info && (done || info.used || info.already_signed) ? (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-sm font-medium text-ink">Signed — thank you.</p>
            <p className="mt-1 text-xs text-slate-500">Your signature is recorded. This link can now be closed.</p>
          </div>
        ) : info && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-ink">{info.shift.worker_name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {info.shift.client_name} · {fmtDate(info.shift.date)} · {info.shift.start?.slice(0, 5)}–{info.shift.end?.slice(0, 5)}
                {' '}· {info.shift.hours}h
              </p>
              {info.shift.instructions && (
                <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                  <span className="font-medium">Site instructions:</span> {info.shift.instructions}
                </p>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {isClient ? 'Your name (authorised signatory)' : 'Your name'}
              </span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {isClient ? 'Note for the worker (optional)' : 'Note (optional)'}
              </span>
              <textarea className={clsx(inputCls, 'resize-none')} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <button className={clsx(btnPrimary, 'w-full justify-center')} disabled={busy || !name.trim()} onClick={sign}>
              <PenLine className="h-4 w-4" /> {busy ? 'Signing…' : 'Sign timesheet'}
            </button>
            <p className="text-center text-[10px] text-slate-400">
              Sanitas Medical Recruitment · signing records your name and the time · once both parties sign the timesheet locks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
