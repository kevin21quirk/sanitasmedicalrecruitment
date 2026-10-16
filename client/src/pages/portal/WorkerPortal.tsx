import { useCallback, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CalendarDays, FileText, LayoutDashboard, User2, Download, PenLine, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { Availability, Offer, OhRecord, ComplianceDoc } from '../../lib/types';
import { Badge, Card, CardHeader, EmptyState, PhotoUpload, btnPrimary, btnGhost, inputCls, fmtStatus } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { PortalShell } from './Portal';

const PAGES = [
  { to: '/', label: 'My shifts', icon: LayoutDashboard, end: true },
  { to: '/availability', label: 'Availability', icon: CalendarDays },
  { to: '/documents', label: 'My documents', icon: FileText },
  { to: '/messages', label: 'Messages', icon: Inbox },
  { to: '/details', label: 'My details', icon: User2 },
];

interface PortalShift {
  id: number; shift_date: string; start_time: string; end_time: string; hours: string;
  actual_start: string | null; actual_end: string | null; actual_hours: string | null;
  shift_type: string; status: string; timesheet_status: string;
  worker_confirmed_at: string | null; signatory_notes: string | null;
  worker_sig_at: string | null; client_sig_at: string | null; timesheet_locked: boolean;
  client_name: string; client_address: string | null; standing_instructions: string | null;
  individual_name: string | null; acked_instructions_at: string | null;
}

function MyShifts() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [shifts, setShifts] = useState<PortalShift[]>([]);
  const [declineReason, setDeclineReason] = useState<Record<number, string>>({});
  const [signing, setSigning] = useState<PortalShift | null>(null);
  const [signForm, setSignForm] = useState({ actual_start: '', actual_end: '', actual_hours: '' });

  const load = useCallback(() => {
    api.get<Offer[]>('/portal/offers').then(setOffers).catch(() => {});
    api.get<PortalShift[]>('/portal/shifts').then(setShifts).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const respond = async (offerId: number, action: 'accept' | 'decline') => {
    await api.post(`/portal/offers/${offerId}/respond`, { action, reason: declineReason[offerId] || null });
    load();
  };

  const confirm = (shiftId: number) => api.post(`/portal/shifts/${shiftId}/confirm`, {}).then(load);
  const ack = (shiftId: number) => api.post(`/portal/shifts/${shiftId}/ack-instructions`, {}).then(load);

  const sign = async () => {
    if (!signing) return;
    await api.post(`/portal/shifts/${signing.id}/sign`, {
      actual_start: signForm.actual_start || null,
      actual_end: signForm.actual_end || null,
      actual_hours: signForm.actual_hours ? +signForm.actual_hours : null,
    });
    setSigning(null);
    load();
  };

  const pending = offers.filter((o) => o.status === 'sent');
  const upcoming = shifts.filter((s) => s.status === 'booked');
  const unsigned = shifts.filter((s) => s.status === 'completed' && !s.worker_sig_at);

  return (
    <div className="space-y-5">
      {!!pending.length && (
        <Card className="ring-1 ring-brand-200">
          <CardHeader title={`${pending.length} shift offer${pending.length > 1 ? 's' : ''} waiting`} subtitle="Accept or decline" />
          <ul className="divide-y divide-slate-200/50">
            {pending.map((o) => (
              <li key={o.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{o.client_name ?? 'Client'} — {fmtDate(o.request_date ?? '')}</p>
                    <p className="text-xs text-slate-500">
                      {o.start_time?.slice(0, 5)}–{o.end_time?.slice(0, 5)} · {fmtStatus(o.shift_type ?? 'day')}
                      {o.individual_name && ` · with ${o.individual_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={btnPrimary} onClick={() => respond(o.id, 'accept')}>Accept</button>
                    <button className={btnGhost} onClick={() => respond(o.id, 'decline')}>Decline</button>
                  </div>
                </div>
                <input
                  className={`${inputCls} mt-2 text-xs`}
                  placeholder="Decline reason (optional) — helps the office"
                  value={declineReason[o.id] ?? ''}
                  onChange={(e) => setDeclineReason((d) => ({ ...d, [o.id]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Upcoming shifts" subtitle="Confirm you can attend — details confirmed by the office" />
        {!upcoming.length ? (
          <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing booked" hint="New bookings appear here when the office allocates you." />
        ) : (
          <ul className="divide-y divide-slate-200/50">
            {upcoming.map((s) => (
              <li key={s.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{fmtDate(s.shift_date)} — {s.client_name}</p>
                    <p className="text-xs text-slate-500">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {fmtStatus(s.shift_type)}
                      {s.individual_name && ` · with ${s.individual_name}`}
                    </p>
                  </div>
                  {s.worker_confirmed_at
                    ? <Badge value="compliant" label="Confirmed" />
                    : <button className={btnPrimary} onClick={() => confirm(s.id)}>Confirm attendance</button>}
                </div>
                {s.standing_instructions && (
                  <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="font-medium">Site instructions</p>
                    <p className="whitespace-pre-wrap">{s.standing_instructions}</p>
                    {!s.acked_instructions_at && (
                      <button className="mt-1.5 font-semibold text-amber-700 underline" onClick={() => ack(s.id)}>
                        I've read these — acknowledge
                      </button>
                    )}
                    {s.acked_instructions_at && <p className="mt-1 text-emerald-700">Acknowledged ✓</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Timesheets to sign" subtitle="Completed shifts — sign to confirm your hours" />
        {!unsigned.length ? (
          <p className="px-5 pb-4 text-xs text-slate-400">Nothing awaiting your signature.</p>
        ) : (
          <ul className="divide-y divide-slate-200/50">
            {unsigned.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{fmtDate(s.shift_date)} — {s.client_name}</p>
                  <p className="text-xs text-slate-500">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {Number(s.hours)}h booked</p>
                </div>
                <button className={btnPrimary} onClick={() => { setSignForm({ actual_start: s.start_time.slice(0, 5), actual_end: s.end_time.slice(0, 5), actual_hours: String(s.hours) }); setSigning(s); }}>
                  <PenLine className="h-3.5 w-3.5" /> Sign
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>

      <Card>
        <CardHeader title="Past shifts & site notes" subtitle="Notes recorded by the site signatory (6.10b)" />
        <ul className="divide-y divide-slate-200/50">
          {shifts.filter((s) => s.status === 'completed').slice(0, 15).map((s) => (
            <li key={s.id} className="px-5 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{fmtDate(s.shift_date)} — {s.client_name}</span>
                <div className="flex items-center gap-1.5">
                  {s.worker_sig_at && <Badge value="valid" label="You signed" />}
                  {s.client_sig_at && <Badge value="approved" label="Client signed" />}
                </div>
              </div>
              {s.signatory_notes && <p className="mt-1 rounded bg-slate-900/[0.035] px-2 py-1 text-xs text-slate-600">Site note: {s.signatory_notes}</p>}
            </li>
          ))}
          {!shifts.filter((s) => s.status === 'completed').length && (
            <li className="px-5 py-4 text-xs text-slate-400">No completed shifts yet.</li>
          )}
        </ul>
      </Card>

      {/* sign modal */}
      {signing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={() => setSigning(null)}>
          <div className="w-full max-w-md glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">Sign timesheet</h2>
            <p className="mt-1 text-xs text-slate-500">
              {fmtDate(signing.shift_date)} — {signing.client_name}. Booked {signing.start_time.slice(0, 5)}–{signing.end_time.slice(0, 5)} ({signing.hours}h).
            </p>
            <p className="mt-3 text-xs text-slate-500">Adjust below if your actual times differed (6.9):</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="block"><span className="mb-1 block text-[10px] font-medium text-slate-500">Start</span>
                <input type="time" className={inputCls} value={signForm.actual_start} onChange={(e) => setSignForm((f) => ({ ...f, actual_start: e.target.value }))} /></label>
              <label className="block"><span className="mb-1 block text-[10px] font-medium text-slate-500">End</span>
                <input type="time" className={inputCls} value={signForm.actual_end} onChange={(e) => setSignForm((f) => ({ ...f, actual_end: e.target.value }))} /></label>
              <label className="block"><span className="mb-1 block text-[10px] font-medium text-slate-500">Hours</span>
                <input type="number" step="0.25" className={inputCls} value={signForm.actual_hours} onChange={(e) => setSignForm((f) => ({ ...f, actual_hours: e.target.value }))} /></label>
            </div>
            <p className="mt-4 rounded-lg bg-slate-900/[0.035] px-3 py-2 text-[11px] text-slate-500">
              By signing you confirm these hours are accurate. Your name is recorded as the signature.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setSigning(null)}>Cancel</button>
              <button className={btnPrimary} onClick={sign}>Sign timesheet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyAvailability() {
  const [rows, setRows] = useState<Availability[]>([]);
  const [form, setForm] = useState({ date: '', shift_type: 'any', status: 'available' });
  const load = useCallback(() => { api.get<Availability[]>('/portal/availability').then(setRows).catch(() => {}); }, []);
  useEffect(load, [load]);

  const submit = async () => {
    if (!form.date) return;
    await api.post('/portal/availability', [{ ...form }]);
    setForm({ ...form, date: '' });
    load();
  };

  const upcoming = rows.filter((r) => r.status === 'available');
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Tell us when you can work" subtitle="Updates are instant — change anytime (3.1/3.3)" />
        <div className="flex flex-wrap items-end gap-2 px-5 py-4">
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
            <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Shift type</span>
            <select className={inputCls} value={form.shift_type} onChange={(e) => setForm({ ...form, shift_type: e.target.value })}>
              <option value="any">Any</option><option value="day">Day</option><option value="night">Night</option>
              <option value="early">Early</option><option value="late">Late</option><option value="long_day">Long day</option>
            </select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">You are</span>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="available">Available</option><option value="unavailable">Not available</option>
            </select></label>
          <button className={btnPrimary} onClick={submit}>Save</button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Your availability" subtitle="Upcoming dates the office can see" />
        <ul className="divide-y divide-slate-200/50">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-ink">{fmtDate(r.date)}</span>
              <span className="flex items-center gap-2">
                <Badge value={r.shift_type === 'any' ? 'medium' : 'booked'} label={r.shift_type === 'any' ? 'Any shift' : fmtStatus(r.shift_type)} />
                <Badge value={r.status === 'available' ? 'valid' : 'missing'} />
                <button className="text-xs text-slate-400 hover:text-red-500"
                  onClick={() => api.post('/portal/availability', [{ date: r.date, shift_type: r.shift_type, status: 'unavailable' }]).then(load)}>
                  remove
                </button>
              </span>
            </li>
          ))}
          {!upcoming.length && !rows.length && <li className="px-5 py-4 text-xs text-slate-400">No availability recorded — add dates above.</li>}
        </ul>
      </Card>
    </div>
  );
}

function MyDocuments() {
  const [docs, setDocs] = useState<ComplianceDoc[]>([]);
  const [oh, setOh] = useState<OhRecord[]>([]);
  useEffect(() => {
    api.get<ComplianceDoc[]>('/portal/documents').then(setDocs).catch(() => {});
    api.get<OhRecord[]>('/portal/oh').then(setOh).catch(() => {});
  }, []);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Your documents" subtitle="Everything on your compliance file (2.5)" />
        <ul className="divide-y divide-slate-200/50">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{d.type}</p>
                <p className="text-[11px] text-slate-400">{d.reference_no ?? ''} {d.expiry_date ? `· expires ${fmtDate(d.expiry_date)}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge value={d.status} />
                {d.file_id && <a href={`/api/files/${d.file_id}/download`} className="text-xs text-brand-600 hover:underline">View</a>}
              </div>
            </li>
          ))}
          {!docs.length && <li className="px-5 py-4 text-xs text-slate-400">No documents on file yet.</li>}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Occupational health" subtitle="Only you and our compliance team can see this (2.9)" />
        <ul className="divide-y divide-slate-200/50">
          {oh.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-ink">{o.name} <span className="text-[11px] text-slate-400">({o.kind})</span></span>
              <span className="text-xs text-slate-500">{fmtDate(o.record_date)}{o.result ? ` · ${o.result}` : ''}</span>
            </li>
          ))}
          {!oh.length && <li className="px-5 py-4 text-xs text-slate-400">No OH records.</li>}
        </ul>
      </Card>
    </div>
  );
}

function MyDetails() {
  const [me, setMe] = useState<any>(null);
  useEffect(() => { api.get('/portal/me').then(setMe).catch(() => {}); }, []);
  const exportData = async () => {
    const data = await api.get('/portal/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-sanitas-data.json';
    a.click();
  };
  const p = me?.profile;
  const { refresh } = useAuth();
  return (
    <Card>
      <CardHeader title="Your details" subtitle="What we hold about you" />
      {p && (
        <div className="flex items-center gap-4 border-b border-slate-200/60 px-5 py-4">
          <PhotoUpload endpoint="/portal/me/photo" name={`${p.first_name} ${p.last_name}`} photoId={p.photo_file_id} size="lg"
            onDone={() => { api.get('/portal/me').then(setMe); refresh(); }} />
          <div>
            <p className="text-sm font-medium text-ink">{p.first_name} {p.last_name}</p>
            <p className="text-xs text-slate-500">Click your photo to change it — clients see this on your shared profile.</p>
          </div>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
        {p && [
          ['Name', `${p.first_name} ${p.last_name}`], ['Role', p.role], ['Email', p.email], ['Phone', p.phone],
          ['Status', fmtStatus(p.status)], ['Right to work', p.rtw_status], ['Engagement', p.engagement_type === 'ltd' ? 'Limited company' : 'PAYE'],
          ['Preferred shifts', p.preferred_shift ?? 'Flexible'], ['Uniform', p.uniform_size ?? '—'],
        ].map(([k, v]) => (
          <div key={k as string}><dt className="text-[11px] uppercase tracking-wide text-slate-400">{k}</dt><dd className="text-sm text-ink">{v ?? '—'}</dd></div>
        ))}
      </dl>
      <div className="border-t border-slate-200/60 px-5 py-4">
        <button className={btnGhost} onClick={exportData}>
          <Download className="h-4 w-4" /> Download a copy of all my data (8.6)
        </button>
        <p className="mt-2 text-[11px] text-slate-400">To correct or erase your data, contact the office — 0800 999 8222.</p>
      </div>
    </Card>
  );
}

interface PortalMessage {
  id: number; channel: string; subject: string | null; body: string;
  created_at: string; read_at: string | null; from_email: string | null;
}

function MyMessages() {
  const [rows, setRows] = useState<PortalMessage[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const load = () => api.get<PortalMessage[]>('/portal/me/messages').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const open = async (m: PortalMessage) => {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.read_at) { await api.post(`/portal/me/messages/${m.id}/read`, {}); load(); }
  };
  return (
    <Card>
      <CardHeader title="Messages" subtitle="Secure messages from the office — nothing personal is emailed or texted" />
      {!rows ? <p className="px-5 pb-4 text-xs text-slate-400">Loading…</p>
        : !rows.length ? <EmptyState icon={<Inbox className="h-5 w-5" />} title="No messages yet" />
        : (
          <ul className="divide-y divide-slate-200/50">
            {rows.map((m) => (
              <li key={m.id}>
                <button className="w-full px-5 py-3 text-left" onClick={() => open(m)}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={m.read_at ? 'text-sm text-ink' : 'text-sm font-semibold text-ink'}>
                      {!m.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-500" />}
                      {m.subject ?? 'Message from Sanitas'}
                    </p>
                    <span className="shrink-0 text-[11px] text-slate-400">{fmtDate(m.created_at)}</span>
                  </div>
                  {openId !== m.id && <p className="mt-0.5 truncate text-xs text-slate-500">{m.body}</p>}
                </button>
                {openId === m.id && <p className="whitespace-pre-wrap bg-brand-500/5 px-5 py-3 text-sm text-slate-700">{m.body}</p>}
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}

export default function WorkerPortal() {
  return (
    <PortalShell title="Worker portal" pages={PAGES}>
      <Routes>
        <Route path="/" element={<MyShifts />} />
        <Route path="/availability" element={<MyAvailability />} />
        <Route path="/documents" element={<MyDocuments />} />
        <Route path="/messages" element={<MyMessages />} />
        <Route path="/details" element={<MyDetails />} />
      </Routes>
    </PortalShell>
  );
}
