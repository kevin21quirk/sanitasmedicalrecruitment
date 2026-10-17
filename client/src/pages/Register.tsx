import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { inputCls, btnPrimary, btnGhost } from '../components/ui';

interface RegField { key: string; label: string; type: string; options?: string[] }
interface ClientLite { id: number; name: string; town: string | null }
interface Uploaded { id: number; filename: string; label: string }

const STEPS = ['You', 'Contact & RTW', 'Work', 'Sites & extras', 'Documents'] as const;

const ROLES = ['Registered Nurse', 'Senior Nurse', 'Healthcare Assistant', 'Senior HCA', 'Support Worker'];
const RTW = ['British/Irish citizen', 'Settled / pre-settled status', 'Indefinite leave to remain', 'Visa — limited right to work', 'Other'];
const DOC_UPLOADS = ['DBS Enhanced', 'Right to Work', 'Passport/ID', 'Mandatory Training', 'CV'];

const fieldCls = 'mb-1 block text-xs font-medium text-slate-600';

export default function Register() {
  const { token: urlToken } = useParams();
  const [token, setToken] = useState<string | null>(urlToken ?? localStorage.getItem('sanitas_reg'));
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [fields, setFields] = useState<RegField[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // create or resume the draft
  useEffect(() => {
    (async () => {
      const res = await api.post<{ token: string }>('/public/register', { token });
      setToken(res.token);
      localStorage.setItem('sanitas_reg', res.token);
      const reg = await api.get<{ status: string; payload: Record<string, any>; files: Uploaded[] }>(`/public/register/${res.token}`);
      setP(reg.payload || {});
      setFiles(reg.files || []);
      setStatus(reg.status as 'draft' | 'submitted');
    })().catch(() => setError('Could not start registration — please refresh.'));
    api.get<{ fields: RegField[] }>('/public/register-fields').then((r) => setFields(r.fields)).catch(() => {});
    api.get<ClientLite[]>('/public/register-clients').then(setClients).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave (1.7)
  const persist = useCallback((next: Record<string, any>) => {
    if (!token) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put(`/public/register/${token}`, { payload: next }).catch(() => {});
    }, 600);
  }, [token]);

  const set = (k: string, v: any) => {
    setP((prev) => { const next = { ...prev, [k]: v }; persist(next); return next; });
  };

  const uploadDoc = async (label: string, file: File) => {
    if (!token) return;
    const form = new FormData();
    form.append('file', file);
    form.append('label', label);
    const res = await api.upload<Uploaded>(`/public/register/${token}/upload`, form);
    setFiles((f) => [...f, res]);
  };

  const submit = async () => {
    setSaving(true); setError('');
    try {
      await api.post(`/public/register/${token}/submit`, {});
      localStorage.removeItem('sanitas_reg');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
      setSaving(false);
    }
  };

  if (done || status === 'submitted') {
    return (
      <Shell>
        <div className="py-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Registration submitted</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Thank you — we've received your details and will be in touch shortly. You'll get a confirmation email and WhatsApp message.
          </p>
        </div>
      </Shell>
    );
  }

  const isNurse = (p.role || '').includes('Nurse');

  return (
    <Shell>
      {/* steps */}
      <div className="mb-6 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col">
            <button
              onClick={() => setStep(i)}
              className={clsx(
                'h-1.5 rounded-full',
                i <= step ? 'bg-brand-500' : 'bg-slate-200'
              )}
            />
            <span className={clsx('mt-1.5 text-[10px] font-medium', i === step ? 'text-brand-600' : 'text-slate-400')}>{s}</span>
          </div>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {step === 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name *"><input className={inputCls} value={p.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} /></Field>
          <Field label="Last name *"><input className={inputCls} value={p.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} /></Field>
          <Field label="Role *" full>
            <select className={inputCls} value={p.role ?? ''} onChange={(e) => set('role', e.target.value)}>
              <option value="">Select…</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          {isNurse && (
            <Field label="NMC PIN" full>
              <input className={inputCls} value={p.nmc_pin ?? ''} onChange={(e) => set('nmc_pin', e.target.value)} placeholder="e.g. 12A3456E" />
            </Field>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email"><input type="email" className={inputCls} value={p.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Mobile (WhatsApp) *"><input className={inputCls} value={p.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Address" full><input className={inputCls} value={p.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="Town"><input className={inputCls} value={p.town ?? ''} onChange={(e) => set('town', e.target.value)} /></Field>
          <Field label="Postcode"><input className={inputCls} value={p.postcode ?? ''} onChange={(e) => set('postcode', e.target.value)} /></Field>
          <Field label="Next of kin — name"><input className={inputCls} value={p.next_of_kin_name ?? ''} onChange={(e) => set('next_of_kin_name', e.target.value)} /></Field>
          <Field label="Next of kin — phone"><input className={inputCls} value={p.next_of_kin_phone ?? ''} onChange={(e) => set('next_of_kin_phone', e.target.value)} /></Field>
          <Field label="Right to work status *" full>
            <select className={inputCls} value={p.rtw_status ?? ''} onChange={(e) => set('rtw_status', e.target.value)}>
              <option value="">Select…</option>
              {RTW.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          {p.rtw_status?.includes('Visa') && (
            <Field label="Visa / RTW expiry" full>
              <input type="date" className={inputCls} value={p.rtw_expiry ?? ''} onChange={(e) => set('rtw_expiry', e.target.value)} />
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Preferred shifts">
            <select className={inputCls} value={p.preferred_shift ?? ''} onChange={(e) => set('preferred_shift', e.target.value)}>
              <option value="">Flexible</option>
              <option value="days">Days</option><option value="nights">Nights</option>
            </select>
          </Field>
          <Field label="Employment preference">
            <select className={inputCls} value={p.employment_pref ?? ''} onChange={(e) => set('employment_pref', e.target.value)}>
              <option value="">Either</option>
              <option value="temporary">Temporary</option><option value="permanent">Permanent</option>
            </select>
          </Field>
          <Field label="How far will you travel (miles)?">
            <input type="number" className={inputCls} value={p.travel_miles ?? ''} onChange={(e) => set('travel_miles', +e.target.value)} />
          </Field>
          <Field label="Own transport?">
            <select className={inputCls} value={String(p.has_transport ?? '')} onChange={(e) => set('has_transport', e.target.value === 'true')}>
              <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
            </select>
          </Field>
        </div>
      )}

      {step === 3 && (
        <div>
          <Field label="Client sites you're willing to travel to" full>
            <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
              {clients.map((cl) => {
                const sel = (p.willing_client_ids ?? []).includes(cl.id);
                return (
                  <label key={cl.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => set('willing_client_ids',
                        sel ? p.willing_client_ids.filter((x: number) => x !== cl.id) : [...(p.willing_client_ids ?? []), cl.id])}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-500"
                    />
                    {cl.name}{cl.town ? ` (${cl.town})` : ''}
                  </label>
                );
              })}
            </div>
          </Field>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Do you drive / car share?">
              <select className={inputCls} value={p.driving ?? ''} onChange={(e) => set('driving', e.target.value)}>
                <option value="">—</option>
                <option value="drives">I drive</option>
                <option value="car_share">I car share</option>
                <option value="neither">Neither</option>
              </select>
            </Field>
            <Field label="Uniform size">
              <input className={inputCls} value={p.uniform_size ?? ''} onChange={(e) => set('uniform_size', e.target.value)} placeholder="e.g. M, 12" />
            </Field>
            {/* 1.2 — agency-defined custom fields from settings */}
            {fields.filter((f) => !['driving', 'uniform_size'].includes(f.key)).map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === 'select' ? (
                  <select className={inputCls} value={p.custom_fields?.[f.key] ?? ''}
                    onChange={(e) => set('custom_fields', { ...(p.custom_fields ?? {}), [f.key]: e.target.value })}>
                    <option value="">—</option>
                    {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className={inputCls} value={p.custom_fields?.[f.key] ?? ''}
                    onChange={(e) => set('custom_fields', { ...(p.custom_fields ?? {}), [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <p className="mb-3 text-xs text-slate-500">
            Upload your documents (1.3). You can finish on another device — everything is saved as you go (1.7).
          </p>
          <div className="space-y-2">
            {DOC_UPLOADS.map((label) => {
              const uploaded = files.filter((f) => f.label === label);
              return (
                <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{label}</p>
                    {uploaded.map((u) => (
                      <p key={u.id} className="flex items-center gap-1 text-[11px] text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> {u.filename}
                      </p>
                    ))}
                  </div>
                  <label className={clsx(btnGhost, 'cursor-pointer px-3 py-1.5 text-xs')}>
                    <Upload className="h-3.5 w-3.5" /> Upload
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(label, f); e.target.value = ''; }} />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button className={btnGhost} disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Progress saved automatically</span>
          {step < STEPS.length - 1 ? (
            <button className={btnPrimary} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button className={btnPrimary} disabled={saving || !p.first_name || !p.last_name} onClick={submit}>
              {saving ? 'Submitting…' : 'Submit registration'}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <img src="/sanitaslogo.png" alt="Sanitas Medical Recruitment" className="h-10 w-auto" />
          <a href="/" className="text-xs text-slate-400 hover:text-slate-600"><X className="inline h-4 w-4" /></a>
        </div>
        <div className="glass-pop rounded-3xl p-6 animate-pop-in sm:p-8">
          <h1 className="mb-1 font-display text-xl font-bold text-ink">Register with Sanitas</h1>
          <p className="mb-6 text-sm text-slate-500">Nurses, HCAs and support workers — join our agency.</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={clsx('block', full && 'sm:col-span-2')}>
      <span className={fieldCls}>{label}</span>
      {children}
    </label>
  );
}
