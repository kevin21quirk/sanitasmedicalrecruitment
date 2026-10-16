import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ArrowRight, CalendarDays, ClipboardList, LayoutDashboard, PenLine, Users } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { Badge, Card, CardHeader, EmptyState, Spinner, btnPrimary, btnGhost, inputCls, fmtStatus } from '../../components/ui';
import { PortalShell } from './Portal';

const PAGES = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/requests', label: 'Requests', icon: ClipboardList },
  { to: '/rota', label: 'Site rota', icon: CalendarDays },
  { to: '/timesheets', label: 'Timesheets', icon: PenLine },
  { to: '/workers', label: 'Our workers', icon: Users },
];

interface ClientRequest {
  id: number; date: string; start_time: string | null; end_time: string | null;
  shift_type: string; role: string | null; qty: number; status: string;
  urgency: string; notes: string | null; filled_count: number; filled_by: string | null;
  individual_name: string | null; cancel_reason: string | null;
}
interface RotaRow {
  id: number; shift_date: string; start_time: string; end_time: string;
  shift_type: string; status: string; worker_name: string; worker_role: string;
  individual_name: string | null;
}
interface ClientTimesheet {
  id: number; shift_date: string; start_time: string; end_time: string; hours: string;
  actual_hours: string | null; shift_type: string; worker_sig_at: string | null;
  client_sig_at: string | null; signatory_notes: string | null; timesheet_status: string;
  worker_name: string; worker_role: string;
}
interface SharedWorker {
  id: number; name: string; role: string | null; compliance_score: number | null;
  nmc_pin: string | null; uniform_size: string | null; location: string | null; transport: boolean | null;
}

const SHIFT_TYPES = ['day', 'night', 'early', 'late', 'long_day', 'sleep_in'];
const ROLES = ['Registered Nurse', 'Senior Nurse', 'Healthcare Assistant', 'Senior HCA', 'Support Worker'];

function Home() {
  const [requests, setRequests] = useState<ClientRequest[] | null>(null);
  const [rota, setRota] = useState<RotaRow[] | null>(null);
  const [sheets, setSheets] = useState<ClientTimesheet[] | null>(null);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    api.get<ClientRequest[]>('/portal/client/requests').then(setRequests).catch(() => setRequests([]));
    api.get<RotaRow[]>(`/portal/client/rota?from=${today}&to=${in7}`).then(setRota).catch(() => setRota([]));
    api.get<ClientTimesheet[]>('/portal/client/timesheets').then(setSheets).catch(() => setSheets([]));
  }, []);

  if (!requests || !rota || !sheets) return <Spinner />;
  const open = requests.filter((r) => r.status === 'pending');
  const unsigned = sheets.filter((t) => !t.client_sig_at);
  const next = rota[0];
  const tiles = [
    { to: '/requests', n: open.length, label: `open request${open.length !== 1 ? 's' : ''}`, urgent: open.some((r) => r.urgency === 'urgent') },
    { to: '/rota', n: rota.length, label: 'shift' + (rota.length !== 1 ? 's' : '') + ' this week', urgent: false },
    { to: '/timesheets', n: unsigned.length, label: `timesheet${unsigned.length !== 1 ? 's' : ''} to sign`, urgent: unsigned.length > 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}
            className={clsx('glass rounded-2xl px-4 py-3.5 text-center transition hover:-translate-y-0.5',
              t.urgent && 'ring-1 ring-amber-400/60')}>
            <p className={clsx('font-display text-2xl font-bold', t.urgent ? 'text-amber-600' : 'text-brand-700')}>{t.n}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">{t.label}</p>
          </Link>
        ))}
      </div>

      {!!open.length && (
        <Card className="border-l-4 border-l-brand-500 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">
                {open.length} request{open.length > 1 ? 's' : ''} waiting for cover
              </p>
              <p className="text-xs text-slate-500">
                {open.map((r) => `${fmtDate(r.date)} (${fmtStatus(r.shift_type)})`).join(' · ')}
              </p>
            </div>
            <Link to="/requests" className={btnPrimary}>View <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Next shift at your site" />
        {!next ? (
          <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing booked this week"
            hint="Use Requests → Request cover to ask for a worker." />
        ) : (
          <div className="px-5 pb-4">
            <p className="text-sm font-medium text-ink">
              {next.worker_name} <span className="font-normal text-slate-400">({next.worker_role})</span>
            </p>
            <p className="text-xs text-slate-500">
              {fmtDate(next.shift_date)} · {next.start_time?.slice(0, 5)}–{next.end_time?.slice(0, 5)} · {fmtStatus(next.shift_type)}
              {next.individual_name && ` · with ${next.individual_name}`}
            </p>
            <Link to="/rota" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              Full rota <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </Card>

      {!!unsigned.length && (
        <Card className="border-l-4 border-l-amber-400 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{unsigned.length} timesheet{unsigned.length > 1 ? 's' : ''} need your signature</p>
              <p className="text-xs text-slate-500">Signing confirms the hours worked and locks the timesheet.</p>
            </div>
            <Link to="/timesheets" className={btnPrimary}>Sign now <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function Requests() {
  const [rows, setRows] = useState<ClientRequest[] | null>(null);
  const [individuals, setIndividuals] = useState<{ id: number; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: '', start_time: '07:30', end_time: '20:00', shift_type: 'day', role: '', qty: 1, individual_id: '', urgency: 'normal', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<ClientRequest[]>('/portal/client/requests').then(setRows).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    api.get<{ id: number; name: string }[]>('/portal/client/individuals').then(setIndividuals).catch(() => {});
  }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/portal/client/requests', { ...f, qty: +f.qty, individual_id: f.individual_id ? +f.individual_id : null });
      setOpen(false);
      setF({ ...f, date: '', notes: '', individual_id: '' });
      load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    setSaving(false);
  };

  const cancel = async (id: number) => {
    const reason = window.prompt('Reason for cancelling this request?');
    if (reason === null) return;
    await api.post(`/portal/client/requests/${id}/cancel`, { reason });
    load();
  };

  if (!rows) return <Spinner />;
  const open_ = rows.filter((r) => r.status === 'pending');
  const past = rows.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{open_.length} open request{open_.length !== 1 ? 's' : ''}</p>
        <button className={btnPrimary} onClick={() => setOpen(true)}>Request cover</button>
      </div>

      <Card>
        <CardHeader title="Open requests" subtitle="You'll see here as soon as a worker accepts or the office books one (4.8)" />
        {!open_.length ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nothing open" hint="Use “Request cover” for urgent or planned shifts (4.9)." />
        ) : (
          <ul className="divide-y divide-slate-200/50">
            {open_.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {fmtDate(r.date)}
                    {r.urgency === 'urgent' && <Badge value="urgent" label="Urgent" />}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmtStatus(r.shift_type)}{r.start_time && ` · ${r.start_time.slice(0, 5)}–${r.end_time?.slice(0, 5)}`}
                    {r.role && ` · ${r.role}`}{r.qty > 1 && ` · ×${r.qty}`}
                    {r.individual_name && ` · for ${r.individual_name}`}
                  </p>
                  {+r.filled_count > 0 && <p className="mt-0.5 text-xs text-emerald-600">{r.filled_count}/{r.qty} filled{r.filled_by ? ` — ${r.filled_by}` : ''}</p>}
                </div>
                <button className={btnGhost} onClick={() => cancel(r.id)}>Cancel</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!!past.length && (
        <Card>
          <CardHeader title="History" />
          <ul className="divide-y divide-slate-200/50">
            {past.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <div>
                  <span className="text-ink">{fmtDate(r.date)} · {fmtStatus(r.shift_type)}{r.role && ` · ${r.role}`}</span>
                  {r.filled_by && <p className="text-[11px] text-slate-400">Filled by {r.filled_by}</p>}
                  {r.cancel_reason && <p className="text-[11px] text-slate-400">Cancelled: {r.cancel_reason}</p>}
                </div>
                <Badge value={r.status === 'filled' ? 'completed' : 'cancelled'} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">Request cover</h2>
            <p className="mt-1 text-xs text-slate-500">Email to the office works too — requests land in the same list (4.7).</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Date *"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
              <Field label="Shift type">
                <select className={inputCls} value={f.shift_type} onChange={(e) => setF({ ...f, shift_type: e.target.value })}>
                  {SHIFT_TYPES.map((t) => <option key={t} value={t}>{fmtStatus(t)}</option>)}
                </select>
              </Field>
              <Field label="Start"><input type="time" className={inputCls} value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></Field>
              <Field label="End"><input type="time" className={inputCls} value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></Field>
              <Field label="Role needed">
                <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                  <option value="">Any</option>{ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="How many"><input type="number" min={1} className={inputCls} value={f.qty} onChange={(e) => setF({ ...f, qty: +e.target.value })} /></Field>
              {!!individuals.length && (
                <Field label="For specific resident" full>
                  <select className={inputCls} value={f.individual_id} onChange={(e) => setF({ ...f, individual_id: e.target.value })}>
                    <option value="">—</option>
                    {individuals.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Urgency" full>
                <select className={inputCls} value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value })}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent — needed ASAP (4.9)</option>
                </select>
              </Field>
              <Field label="Notes for the office" full>
                <textarea className={clsx(inputCls, 'resize-none')} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              <button className={btnPrimary} disabled={saving || !f.date} onClick={submit}>{saving ? 'Sending…' : 'Send request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Rota({ printMode }: { printMode?: boolean }) {
  const [rows, setRows] = useState<RotaRow[] | null>(null);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  useEffect(() => {
    api.get<RotaRow[]>(`/portal/client/rota?from=${from}&to=${to}`).then(setRows).catch(() => setRows([]));
  }, [from, to]);
  if (!rows) return <Spinner />;

  const byDate = rows.reduce<Record<string, RotaRow[]>>((acc, r) => {
    (acc[r.shift_date] ??= []).push(r);
    return acc;
  }, {});

  return (
    <Card className={printMode ? 'border-0 shadow-none' : ''}>
      {!printMode && (
        <CardHeader
          title="Site rota" subtitle="Who's coming in — view only (5.1-5.3)"
          action={
            <div className="flex items-center gap-2">
              <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
              <button className={btnGhost} onClick={() => window.print()}>Print</button>
            </div>
          }
        />
      )}
      {!rows.length ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No shifts booked" hint="Booked workers appear here." />
      ) : (
        <div className="divide-y divide-slate-100">
          {Object.entries(byDate).map(([date, shifts]) => (
            <div key={date} className="px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{fmtDate(date)}</p>
              <ul className="mt-1.5 space-y-1">
                {shifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink">
                      {s.worker_name} <span className="text-slate-400">({s.worker_role})</span>
                      {s.individual_name && <span className="text-slate-400"> — with {s.individual_name}</span>}
                    </span>
                    <span className="text-xs text-slate-500">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)} · {fmtStatus(s.shift_type)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Timesheets() {
  const [rows, setRows] = useState<ClientTimesheet[] | null>(null);
  const [signing, setSigning] = useState<ClientTimesheet | null>(null);
  const [notes, setNotes] = useState('');
  const [actual, setActual] = useState('');
  const load = useCallback(() => {
    api.get<ClientTimesheet[]>('/portal/client/timesheets').then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const sign = async () => {
    if (!signing) return;
    try {
      await api.post(`/portal/client/sign/${signing.id}`, { signatory_notes: notes || null, actual_hours: actual ? +actual : null });
      setSigning(null); setNotes(''); setActual('');
      load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Could not sign'); }
  };

  if (!rows) return <Spinner />;
  const unsigned = rows.filter((t) => !t.client_sig_at);
  const signed = rows.filter((t) => t.client_sig_at);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Awaiting your signature" subtitle="Authorised signatories only — sign to confirm hours worked (6.2)" />
        {!unsigned.length ? <p className="px-5 pb-4 text-xs text-slate-400">Nothing to sign.</p> : (
          <ul className="divide-y divide-slate-200/50">
            {unsigned.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{fmtDate(t.shift_date)} — {t.worker_name}</p>
                  <p className="text-xs text-slate-500">{t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)} · {Number(t.actual_hours ?? t.hours)}h{t.worker_sig_at ? ' · worker signed' : ''}</p>
                </div>
                <button className={btnPrimary} onClick={() => { setSigning(t); setActual(String(t.actual_hours ?? t.hours)); }}><PenLine className="h-3.5 w-3.5" /> Sign</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!!signed.length && (
        <Card>
          <CardHeader title="Signed" />
          <ul className="divide-y divide-slate-200/50">
            {signed.map((t) => (
              <li key={t.id} className="px-5 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink">{fmtDate(t.shift_date)} — {t.worker_name} · {Number(t.actual_hours ?? t.hours)}h</span>
                  <Badge value="approved" label="Signed" />
                </div>
                {t.signatory_notes && <p className="mt-0.5 text-[11px] text-slate-500">Your note: {t.signatory_notes}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {signing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={() => setSigning(null)}>
          <div className="w-full max-w-md glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">Sign timesheet</h2>
            <p className="mt-1 text-xs text-slate-500">{fmtDate(signing.shift_date)} — {signing.worker_name}, booked {signing.hours}h.</p>
            <div className="mt-4 space-y-3">
              <Field label="Actual hours worked"><input type="number" step="0.25" className={inputCls} value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
              <Field label="Note to the worker (optional, 6.10b)">
                <textarea className={clsx(inputCls, 'resize-none')} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Arrived 15 min early, great support with personal care." />
              </Field>
            </div>
            <p className="mt-4 rounded-lg bg-slate-900/[0.035] px-3 py-2 text-[11px] text-slate-500">Your name is recorded as the authorised signature. Once signed, the timesheet locks (6.5).</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setSigning(null)}>Cancel</button>
              <button className={btnPrimary} onClick={sign}>Sign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Workers() {
  const [data, setData] = useState<{ fields: Record<string, boolean>; workers: SharedWorker[] } | null>(null);
  useEffect(() => { api.get<{ fields: Record<string, boolean>; workers: SharedWorker[] }>('/portal/client/workers').then(setData).catch(() => setData({ fields: {}, workers: [] })); }, []);
  if (!data) return <Spinner />;
  return (
    <Card>
      <CardHeader title="Workers who've covered your site" subtitle="Profiles shared per your agreement (4.5)" />
      {!data.workers.length ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No workers yet" hint="Profiles appear after a worker's first shift at your site." />
      ) : (
        <ul className="divide-y divide-slate-200/50">
          {data.workers.map((w) => (
            <li key={w.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{w.name}</p>
                {w.compliance_score != null && <Badge value="compliant" label={`Compliance ${w.compliance_score}%`} />}
              </div>
              <p className="text-xs text-slate-500">
                {w.role ?? 'Care worker'}{w.nmc_pin && ` · NMC ${w.nmc_pin}`}{w.location && ` · ${w.location}`}
                {w.transport != null && (w.transport ? ' · own transport' : ' · no transport')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ClientPortal() {
  return (
    <PortalShell title="Client portal" pages={PAGES}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/rota" element={<Rota />} />
        <Route path="/timesheets" element={<Timesheets />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalShell>
  );
}

// exported for the supervisor's printable rota (5.4)
export { Rota as SiteRota };

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={clsx('block', full && 'col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
