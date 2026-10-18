import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, RefreshCw, Send, Star, UserCheck, X, Ban, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '../lib/api';
import { fmtDate } from '../lib/format';
import { pipelineGroups, STAGES } from '../lib/pipeline';
import { Client, ShiftRequest } from '../lib/types';
import { Badge, Card, CardHeader, EmptyState, HScroller, PageHeader, Spinner, btnPrimary, btnGhost, inputCls, fmtStatus } from '../components/ui';
import { BlockReason, BookingGap, BookingConflict } from '../components/BlockReason';

interface EligibleWorker {
  id: number; name: string; role: string; status: string; phone: string | null;
  compliant: boolean; compliance_gaps: string[] | null;
  avail_status: string | null; avail_type: string | null;
  willing_here: boolean; continuity: 'site' | 'individual' | null;
  worked_at_client: string; worked_with_individual: string;
  block_reason: string | null; offer_status: string | null;
  first_choice_since: string | null; preferred_shift: string | null;
}

interface AvailRow {
  candidate_id: number; candidate_name: string; role: string;
  availability_id: number | null; shift_type: string | null;
  availability_status: string | null; source: string | null;
  first_choice_since: string | null;
}

const SHIFT_TYPES = ['day', 'night', 'early', 'late', 'long_day', 'sleep_in'];
const ROLES = ['Registered Nurse', 'Senior Nurse', 'Healthcare Assistant', 'Senior HCA', 'Support Worker'];

export default function Requests() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'pipeline' | 'requests' | 'availability'>(() => {
    const t = searchParams.get('tab');
    return t === 'requests' || t === 'availability' ? t : 'pipeline';
  });
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(() => searchParams.get('new') === '1');
  const [allocating, setAllocating] = useState<ShiftRequest | null>(null);

  const load = useCallback(() => {
    api.get<ShiftRequest[]>('/requests').then((r) => { setRequests(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
    api.get<Client[]>('/clients').then(setClients).catch(() => {});
  }, [load]);

  const stats = {
    open: requests.filter((r) => r.status === 'pending').length,
    urgent: requests.filter((r) => r.status === 'pending' && r.urgency === 'urgent').length,
    filled: requests.filter((r) => r.status === 'filled').length,
  };

  return (
    <div>
      <PageHeader
        title="Shift requests & allocation"
        subtitle="Client requests come in by portal or office entry — you decide who goes out (3.8)."
      >
        <button className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" /></button>
        <button className={btnPrimary} onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Log request</button>
      </PageHeader>

      <div className="scroll-thin mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-900/5 p-1">
        {(['pipeline', 'requests', 'availability'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-medium capitalize',
              tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {t === 'pipeline' ? 'Pipeline' : t === 'requests' ? `Requests (${stats.open} open)` : 'Availability board'}
          </button>
        ))}
      </div>

      {tab === 'pipeline' ? (
        loading ? <Spinner /> : <PipelineBoard requests={requests} onAllocate={setAllocating} />
      ) : tab === 'requests' ? (
        loading ? <Spinner /> : (
          <Card>
            {!requests.length ? (
              <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No requests" hint="Log a client request to start allocating." />
            ) : (
              <ul className="divide-y divide-slate-200/50">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        {r.client_name} — {fmtDate(r.date)}
                        {r.urgency === 'urgent' && r.status === 'pending' && <Badge value="expired" label="Urgent cover" />}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.shift_type && fmtStatus(r.shift_type)}{r.start_time && ` · ${r.start_time.slice(0, 5)}–${r.end_time?.slice(0, 5)}`}
                        {r.role && ` · ${r.role}`}{r.qty > 1 && ` · ×${r.qty}`}
                        {r.individual_name && ` · for ${r.individual_name}`}
                        <span className="text-slate-300"> · via {r.source}</span>
                      </p>
                      {r.filled_by && (
                        <p className="mt-0.5 text-xs font-medium text-emerald-600">Booked: {r.filled_by}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === 'pending' && (
                        <span className="text-xs text-slate-400">{r.filled_count ?? 0}/{r.qty} filled{r.pending_offers ? ` · ${r.pending_offers} offered` : ''}</span>
                      )}
                      <Badge value={r.status === 'filled' ? 'completed' : r.status === 'cancelled' ? 'cancelled' : 'pending'} />
                      {r.status === 'pending' && <button className={btnPrimary} onClick={() => setAllocating(r)}>Allocate</button>}
                      {r.status === 'pending' && (
                        <button className={btnGhost} onClick={async () => {
                          const reason = window.prompt('Reason for cancelling? (recorded for the audit trail)');
                          if (reason !== null) { await api.post(`/requests/${r.id}/cancel`, { reason }); load(); }
                        }}><X className="h-4 w-4" /></button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      ) : (
        <AvailabilityBoard />
      )}

      {newOpen && <NewRequest clients={clients} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); load(); }} />}
      {allocating && <AllocateDrawer request={allocating} onClose={() => setAllocating(null)} onDone={() => { setAllocating(null); load(); }} />}
    </div>
  );
}

// Colour-coded kanban of the request workflow — new → offered → filled →
// booked → timesheet → invoice → paid. Each card sits in its earliest
// outstanding stage; Allocate opens the allocation drawer in place.
function PipelineBoard({ requests, onAllocate }: { requests: ShiftRequest[]; onAllocate: (r: ShiftRequest) => void }) {
  const groups = pipelineGroups(requests);
  const visible = STAGES.filter((s) => s.key !== 'cancelled' || groups.get('cancelled')!.length);
  return (
    <HScroller className="flex gap-3 pb-3">
      {visible.map((stage) => {
        const rows = groups.get(stage.key)!;
        return (
          <div key={stage.key} className="w-56 shrink-0 sm:w-64">
            <div className={clsx('h-1 rounded-t-xl', stage.bar)} />
            <div className={clsx('rounded-b-xl bg-slate-900/[0.035] p-2.5 min-h-32', stage.key === 'cancelled' && 'opacity-70')}>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  <span className={clsx('h-2 w-2 rounded-full', stage.dot)} />{stage.label}
                </p>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm">{rows.length}</span>
              </div>
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className={clsx('rounded-lg border border-slate-200/70 border-l-4 bg-white p-2.5 shadow-sm', stage.card)}>
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-ink leading-tight">{r.client_name}</p>
                      {r.urgency === 'urgent' && r.status === 'pending' && <Badge value="expired" label="Urgent" />}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {fmtDate(r.date)} · {fmtStatus(r.shift_type)}
                      {r.start_time && ` ${r.start_time.slice(0, 5)}–${r.end_time?.slice(0, 5)}`}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {r.role ?? 'Any role'}{r.qty > 1 && ` · ${r.filled_count ?? 0}/${r.qty} filled`}
                      {!!+(r.pending_offers ?? 0) && ` · ${r.pending_offers} offer${+r.pending_offers! > 1 ? 's' : ''} out`}
                      {r.individual_name && ` · ${r.individual_name}`}
                    </p>
                    {r.filled_by && <p className="mt-1 text-[11px] font-medium text-emerald-600">{r.filled_by}</p>}
                    <div className="mt-2 flex items-center justify-end">
                      {(stage.key === 'new' || stage.key === 'offered' || stage.key === 'part_filled') && (
                        <button className={clsx(btnPrimary, 'px-2.5 py-1 text-[11px]')} onClick={() => onAllocate(r)}>Allocate</button>
                      )}
                      {stage.key === 'booked' && <Link to="/shifts" className="text-[11px] font-medium text-brand-600 hover:underline">Shift calendar →</Link>}
                      {stage.key === 'awaiting_ts' && <Link to="/timesheets" className="text-[11px] font-medium text-brand-600 hover:underline">Approve timesheet →</Link>}
                      {stage.key === 'to_invoice' && <Link to="/invoices" className="text-[11px] font-medium text-brand-600 hover:underline">Invoice →</Link>}
                    </div>
                  </div>
                ))}
                {!rows.length && <p className="px-1 pb-2 text-[11px] text-slate-400">Nothing here</p>}
              </div>
            </div>
          </div>
        );
      })}
    </HScroller>
  );
}

function NewRequest({ clients, onClose, onSaved }: { clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ client_id: '', date: '', start_time: '07:30', end_time: '20:00', shift_type: 'day', role: '', qty: 1, urgency: 'normal', source: 'email', notes: '', individual_id: '' });
  const [individuals, setIndividuals] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (f.client_id) api.get<{ id: number; name: string }[]>(`/clients/${f.client_id}/individuals`).then(setIndividuals).catch(() => {});
  }, [f.client_id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/requests', { ...f, client_id: +f.client_id, individual_id: f.individual_id ? +f.individual_id : null, qty: +f.qty });
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold">Log a shift request</h2>
        <p className="mt-1 text-xs text-slate-500">For requests that arrive by phone or email (portal requests appear automatically, 3.0).</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Client *" full>
            <select className={inputCls} value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
              <option value="">Select…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
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
            <Field label="For specific resident/individual" full>
              <select className={inputCls} value={f.individual_id} onChange={(e) => setF({ ...f, individual_id: e.target.value })}>
                <option value="">—</option>
                {individuals.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Urgency">
            <select className={inputCls} value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value })}>
              <option value="normal">Normal</option><option value="urgent">Urgent cover (4.9)</option>
            </select>
          </Field>
          <Field label="Received via">
            <select className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              <option value="email">Email</option><option value="phone">Phone</option><option value="office">Other</option>
            </select>
          </Field>
          <Field label="Notes" full><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={saving || !f.client_id || !f.date} onClick={save}>
            {saving ? 'Saving…' : 'Log request'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AllocateDrawer({ request, onClose, onDone }: { request: ShiftRequest; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<{ workers: EligibleWorker[]; auto_ranking: boolean } | null>(null);
  const [error, setError] = useState('');
  const [block, setBlock] = useState<{ message: string; gaps?: BookingGap[]; conflicts?: BookingConflict[]; candidateId?: number } | null>(null);

  const load = useCallback(() => {
    api.get<{ workers: EligibleWorker[]; auto_ranking: boolean }>(`/requests/${request.id}/eligible`)
      .then(setData).catch((e) => setError(e.message));
  }, [request.id]);
  useEffect(load, [load]);

  const offer = async (cid: number) => {
    await api.post(`/requests/${request.id}/offer`, { candidate_ids: [cid] }).catch((e) =>
      setBlock({ message: e instanceof Error ? e.message : 'Could not send offer', candidateId: cid }));
    load();
  };
  const allocate = async (cid: number) => {
    try {
      setBlock(null);
      await api.post(`/requests/${request.id}/allocate`, { candidate_id: cid });
      onDone();
    } catch (e) {
      const ae = e instanceof ApiError ? e.body as { gaps?: BookingGap[]; conflicts?: BookingConflict[] } : {};
      setBlock({
        message: e instanceof Error ? e.message : 'Could not allocate',
        gaps: ae.gaps, conflicts: ae.conflicts, candidateId: cid,
      });
      load();
    }
  };

  const workers = data?.workers ?? [];
  const ready = workers.filter((w) => w.avail_status === 'available' && w.compliant && !w.block_reason && w.willing_here);
  const maybe = workers.filter((w) => !ready.includes(w) && !w.block_reason);
  const blocked = workers.filter((w) => w.block_reason);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-950/35 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-pop h-full w-full max-w-xl overflow-y-auto p-6 animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Allocate — {request.client_name}</h2>
            <p className="text-xs text-slate-500">
              {fmtDate(request.date)} · {fmtStatus(request.shift_type)}{request.start_time && ` ${request.start_time.slice(0, 5)}–${request.end_time?.slice(0, 5)}`}
              {request.individual_name && ` · for ${request.individual_name}`}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              The system shows eligibility context — you make the call. {data?.auto_ranking ? 'Auto-ordering is ON (settings).' : 'No automatic ranking (3.8).'}
            </p>
          </div>
          <button className={btnGhost} onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {block && (
          <div className="mt-3">
            <BlockReason message={block.message} gaps={block.gaps} conflicts={block.conflicts}
              candidateId={block.candidateId} clientId={request.client_id} />
          </div>
        )}
        {!data ? <Spinner /> : (
          <>
            <WorkerGroup title={`Available & clear (${ready.length})`} workers={ready} onOffer={offer} onAllocate={allocate} />
            <WorkerGroup title={`Needs a look (${maybe.length})`} workers={maybe} onOffer={offer} onAllocate={allocate} muted />
            {!!blocked.length && <WorkerGroup title={`Do-not-offer (${blocked.length})`} workers={blocked} onOffer={offer} onAllocate={allocate} muted />}
          </>
        )}
      </div>
    </div>
  );
}

function WorkerGroup({ title, workers, onOffer, onAllocate, muted }: {
  title: string; workers: EligibleWorker[];
  onOffer: (id: number) => void; onAllocate: (id: number) => void; muted?: boolean;
}) {
  if (!workers.length) return null;
  return (
    <div className="mt-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="space-y-2">
        {workers.map((w) => (
          <li key={w.id} className={clsx('rounded-lg border px-3 py-2.5', muted ? 'border-slate-200/60 bg-slate-900/[0.02]' : 'border-slate-200')}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Link to={`/candidates/${w.id}`} className="hover:underline">{w.name}</Link>
                  {w.first_choice_since && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="First choice (3.9)" />}
                </p>
                <p className="text-[11px] text-slate-500">
                  {w.role}
                  {w.avail_type && w.avail_status === 'available' && ` · avail: ${w.avail_type === 'any' ? 'any shift' : w.avail_type}`}
                  {!w.avail_status && ' · no reply yet'}
                  {w.avail_status === 'unavailable' && ' · said unavailable'}
                  {w.continuity === 'individual' && ' · worked with this individual (3.7)'}
                  {w.continuity === 'site' && ` · worked here ${w.worked_at_client}×`}
                  {w.preferred_shift && ` · prefers ${w.preferred_shift}`}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-1">
                  {w.compliant ? <Badge value="compliant" /> : <Badge value="expired" label={`Not clear: ${(w.compliance_gaps ?? []).join(', ') || 'missing docs'}`} />}
                  {!w.willing_here && <Badge value="pending" label="Not on willing list" />}
                  {w.block_reason && <Badge value="do_not_use" label={`Blocked: ${w.block_reason}`} />}
                  {w.offer_status && <Badge value={w.offer_status === 'accepted' ? 'approved' : w.offer_status === 'declined' ? 'declined' : 'sent'} label={`Offer ${w.offer_status}`} />}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {!w.offer_status && <button className={btnGhost} onClick={() => onOffer(w.id)}><Send className="h-3.5 w-3.5" /> Offer</button>}
                {w.compliant && !w.block_reason && (
                  <button className={btnPrimary} onClick={() => onAllocate(w.id)}><UserCheck className="h-3.5 w-3.5" /> Book</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AvailabilityBoard() {
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [rows, setRows] = useState<AvailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.get<{ workers: AvailRow[] }>(`/availability?date=${date}`)
      .then((r) => { setRows(r.workers); setLoading(false); }).catch(() => setLoading(false));
  }, [date]);
  useEffect(load, [load]);

  const replied = rows.filter((r) => r.availability_id);
  const noReply = rows.filter((r) => !r.availability_id);

  const record = async (row: AvailRow, status: 'available' | 'unavailable') => {
    await api.post('/availability', { candidate_id: row.candidate_id, date, shift_type: 'any', status });
    load();
  };

  return (
    <Card>
      <CardHeader
        title="Who can work — all replies in one list (3.2)"
        subtitle="Record a telephone reply for any worker directly (3.4)."
        action={<input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />}
      />
      {loading ? <Spinner /> : (
        <ul className="divide-y divide-slate-200/50">
          {[...replied, ...noReply].map((w) => (
            <li key={w.candidate_id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">
                  {w.candidate_name}
                  {w.first_choice_since && <Star className="ml-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                </p>
                <p className="text-[11px] text-slate-400">
                  {w.role}{w.shift_type && w.shift_type !== 'any' ? ` · ${w.shift_type} only` : ''}
                  {w.source === 'office' && ' · recorded by office'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {w.availability_status === 'available' && <Badge value="valid" label="Available" />}
                {w.availability_status === 'unavailable' && <Badge value="missing" label="Not available" />}
                {!w.availability_status && <Badge value="sent" label="No reply yet" />}
                <button title="Mark available" className="rounded p-1 text-emerald-600 hover:bg-emerald-50" onClick={() => record(w, 'available')}><CheckCircle2 className="h-4 w-4" /></button>
                <button title="Mark unavailable" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => record(w, 'unavailable')}><Ban className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
          {!rows.length && <li className="px-5 py-4 text-xs text-slate-400">No active workers.</li>}
        </ul>
      )}
    </Card>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={clsx('block', full && 'sm:col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
