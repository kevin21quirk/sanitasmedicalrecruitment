import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ClipboardList, Mail, MessageSquare, RefreshCcw, UserCheck } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { Badge, Card, CardHeader, EmptyState, Modal, Spinner, btnPrimary, fmtStatus } from '../../components/ui';
import { BlockReason, BookingGap } from '../../components/BlockReason';
import { PortalShell } from './Portal';
import { SiteRota } from './ClientPortal';

const PAGES = [
  { to: '/', label: 'Requests', icon: ClipboardList, end: true },
  { to: '/rota', label: 'Site rota', icon: CalendarDays },
];

interface SiteRequest {
  id: number; date: string; start_time: string | null; end_time: string | null;
  shift_type: string; role: string | null; qty: number; status: string;
  urgency: string; notes: string | null; filled_count: number; filled_by: string | null;
  individual_name: string | null; cancel_reason: string | null;
}

interface Eligible {
  id: number; name: string; role: string; avail_type: string | null; avail_status: string | null;
  worked_at_client: string; worked_with_individual: string; block_reason: string | null;
  compliant: boolean; compliance_gaps: BookingGap[] | null;
}

interface OutboxLink { channel: string; to_name: string | null; wa_link: string | null; mailto_link: string | null }

function AllocateModal({ request, onClose, onDone }: { request: SiteRequest; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<{ workers: Eligible[] } | null>(null);
  const [block, setBlock] = useState<{ message: string; gaps?: BookingGap[]; candidateId?: number } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [contacted, setContacted] = useState<Record<number, string>>({});
  const [contactErr, setContactErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ worker: string; notifications: OutboxLink[] } | null>(null);

  const load = useCallback(() => {
    api.get<{ workers: Eligible[] }>(`/portal/client/requests/${request.id}/eligible`)
      .then(setData).catch(() => setData({ workers: [] }));
  }, [request.id]);
  useEffect(load, [load]);

  const contact = async (w: Eligible, channel: 'whatsapp' | 'email') => {
    setContactErr(null);
    try {
      const res = await api.post<{ message: OutboxLink }>(`/portal/client/requests/${request.id}/contact-worker`,
        { candidate_id: w.id, channel });
      const link = res.message.wa_link || res.message.mailto_link;
      if (link) window.open(link, '_blank');
      setContacted((c) => ({ ...c, [w.id]: channel }));
    } catch (e) { setContactErr(e instanceof Error ? e.message : 'Could not contact worker'); }
  };

  const allocate = async (w: Eligible) => {
    setBusy(w.id); setBlock(null);
    try {
      const res = await api.post<{ notifications?: OutboxLink[] }>(`/portal/client/requests/${request.id}/allocate`,
        { candidate_id: w.id });
      setDone({ worker: w.name, notifications: res.notifications ?? [] });
    } catch (e) {
      const b = e instanceof ApiError ? e.body as { gaps?: BookingGap[] } : {};
      setBlock({ message: e instanceof Error ? e.message : 'Could not allocate', gaps: b.gaps, candidateId: w.id });
    } finally { setBusy(null); }
  };

  const workers = data?.workers ?? [];
  const clear = workers.filter((w) => w.compliant && !w.block_reason);
  const rest = workers.filter((w) => !w.compliant || w.block_reason);

  const row = (w: Eligible, muted = false) => (
    <li key={w.id} className={clsx('flex flex-wrap items-center justify-between gap-2 px-4 py-2.5', muted && 'opacity-60')}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {w.name} <span className="text-xs font-normal text-slate-400">· {w.role}</span>
        </p>
        <p className="text-[11px] text-slate-500">
          {w.avail_status === 'available' ? 'Available that day' : w.avail_status === 'unavailable' ? 'Marked unavailable' : 'Availability not recorded'}
          {+w.worked_at_client > 0 && ` · worked here ${w.worked_at_client}×`}
          {+w.worked_with_individual > 0 && ` · worked with ${request.individual_name ?? 'resident'} ${w.worked_with_individual}×`}
          {w.block_reason && ` · blocked: ${w.block_reason}`}
        </p>
        {contacted[w.id] && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-brand-600">
            <CheckCircle2 className="h-3 w-3" /> Contacted by {contacted[w.id] === 'whatsapp' ? 'WhatsApp' : 'email'} — offer sent to their portal too
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {w.compliant ? <Badge value="valid" label="Compliant" /> : <Badge value="expired" label="Not compliant" />}
        {w.compliant && !w.block_reason && (
          <>
            <button className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-emerald-50/60 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
              title="WhatsApp the worker about this shift" onClick={() => contact(w, 'whatsapp')}>
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </button>
            <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300/80 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white"
              title="Email the worker about this shift" onClick={() => contact(w, 'email')}>
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
            <button className={btnPrimary} disabled={busy === w.id} onClick={() => allocate(w)}>
              {busy === w.id ? 'Booking…' : 'Allocate'}
            </button>
          </>
        )}
      </div>
    </li>
  );

  return (
    <Modal open onClose={done ? onDone : onClose} title={`Allocate — ${fmtDate(request.date)}`}
      subtitle={`${fmtStatus(request.shift_type)}${request.start_time ? ` ${request.start_time.slice(0, 5)}–${request.end_time?.slice(0, 5)}` : ''}${request.role ? ` · ${request.role}` : ''}${request.individual_name ? ` · for ${request.individual_name}` : ''}`}
      size="lg">
      {done ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> {done.worker} is booked
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              They've been messaged in their portal to confirm. Now let your site's contacts know who's coming:
            </p>
          </div>
          {done.notifications.length ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notify the site</p>
              {done.notifications.map((n, i) => (
                <button key={i}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition',
                    n.channel === 'whatsapp'
                      ? 'border-emerald-300/80 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-300/80 bg-white/60 text-slate-700 hover:bg-white')}
                  onClick={() => window.open(n.wa_link || n.mailto_link || '', '_blank')}>
                  {n.channel === 'whatsapp' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  {n.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} {n.to_name ?? 'the site'} — shift covered
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No site contacts have a phone or email on file — the office can notify them from the request.</p>
          )}
          <div className="flex justify-end">
            <button className={btnPrimary} onClick={onDone}>Done</button>
          </div>
        </div>
      ) : (
      <>
      <p className="mb-3 text-[11px] text-slate-400">
        Contact workers about the shift first, or allocate straight away — they get messaged either way.
        Only compliant workers can be allocated; rates stay with the office.
      </p>
      {contactErr && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{contactErr}</p>}
      {block && (
        <div className="mb-3">
          <BlockReason message={block.message} gaps={block.gaps} />
        </div>
      )}
      {!data ? <Spinner /> : (
        <div className="space-y-4">
          {!!clear.length && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Can work ({clear.length})</p>
              <ul className="divide-y divide-slate-200/60 rounded-xl border border-slate-200/70">{clear.map((w) => row(w))}</ul>
            </div>
          )}
          {!!rest.length && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Not eligible ({rest.length})</p>
              <ul className="divide-y divide-slate-200/60 rounded-xl border border-slate-200/70">{rest.map((w) => row(w, true))}</ul>
            </div>
          )}
          {!workers.length && <EmptyState title="No workers on file" hint="The office manages the worker pool." />}
        </div>
      )}
      </>
      )}
    </Modal>
  );
}

function SiteRequests() {
  const [rows, setRows] = useState<SiteRequest[] | null>(null);
  const [allocFor, setAllocFor] = useState<SiteRequest | null>(null);
  const load = useCallback(() => {
    api.get<SiteRequest[]>('/portal/client/requests').then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);
  // refetch when the tab regains focus — workers may accept offers while the page sits open
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (!rows) return <Spinner />;
  const open = rows.filter((r) => r.status === 'pending' && +r.filled_count < r.qty);
  const past = rows.filter((r) => !open.includes(r));

  return (
    <div className="space-y-5">
      {!!open.length && (
        <Card className="border-l-4 border-l-brand-500 px-5 py-4">
          <p className="text-sm font-semibold text-ink">
            {open.length} request{open.length > 1 ? 's' : ''} need{open.length === 1 ? 's' : ''} a worker
          </p>
          <p className="text-xs text-slate-500">Pick a compliant worker below — the office is notified and the worker is messaged automatically.</p>
        </Card>
      )}

      <Card>
        <CardHeader title="Requests needing cover" subtitle="Logged by your site — allocate a worker or leave it to the office"
          action={<button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/80 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white" onClick={load}><RefreshCcw className="h-3.5 w-3.5" /> Refresh</button>} />
        {!open.length ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nothing waiting" hint="New requests from your site appear here." />
        ) : (
          <ul className="divide-y divide-slate-200/50">
            {open.map((r) => (
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
                  {r.notes && <p className="mt-0.5 text-[11px] text-slate-400">{r.notes}</p>}
                  {+r.filled_count > 0 && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {+r.filled_count >= r.qty ? 'Fully covered' : `${r.filled_count} of ${r.qty} covered`}
                      {r.filled_by ? ` — ${r.filled_by}` : ''}
                    </p>
                  )}
                </div>
                <button className={btnPrimary} onClick={() => setAllocFor(r)}>
                  <UserCheck className="h-4 w-4" /> Allocate worker
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!!past.length && (
        <Card>
          <CardHeader title="Filled & closed" />
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

      {allocFor && (
        <AllocateModal request={allocFor} onClose={() => setAllocFor(null)} onDone={() => { setAllocFor(null); load(); }} />
      )}
    </div>
  );
}

// Supervisors see their site's open requests and can allocate a compliant
// worker; the rota stays as the printable wall view (5.1-5.4).
export default function SupervisorPortal() {
  return (
    <PortalShell title="Site supervisor" pages={PAGES}>
      <Routes>
        <Route path="/" element={<SiteRequests />} />
        <Route path="/rota" element={<SiteRota />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalShell>
  );
}
