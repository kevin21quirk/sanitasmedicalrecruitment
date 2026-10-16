import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CalendarDays, ClipboardList, UserCheck } from 'lucide-react';
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

function AllocateModal({ request, onClose, onDone }: { request: SiteRequest; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<{ workers: Eligible[] } | null>(null);
  const [block, setBlock] = useState<{ message: string; gaps?: BookingGap[]; candidateId?: number } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    api.get<{ workers: Eligible[] }>(`/portal/client/requests/${request.id}/eligible`)
      .then(setData).catch(() => setData({ workers: [] }));
  }, [request.id]);
  useEffect(load, [load]);

  const allocate = async (cid: number) => {
    setBusy(cid); setBlock(null);
    try {
      await api.post(`/portal/client/requests/${request.id}/allocate`, { candidate_id: cid });
      onDone();
    } catch (e) {
      const b = e instanceof ApiError ? e.body as { gaps?: BookingGap[] } : {};
      setBlock({ message: e instanceof Error ? e.message : 'Could not allocate', gaps: b.gaps, candidateId: cid });
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
      </div>
      <div className="flex items-center gap-2">
        {w.compliant ? <Badge value="valid" label="Compliant" /> : <Badge value="expired" label="Not compliant" />}
        {w.compliant && !w.block_reason && (
          <button className={btnPrimary} disabled={busy === w.id} onClick={() => allocate(w.id)}>
            {busy === w.id ? 'Booking…' : 'Allocate'}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <Modal open onClose={onClose} title={`Allocate — ${fmtDate(request.date)}`}
      subtitle={`${fmtStatus(request.shift_type)}${request.start_time ? ` ${request.start_time.slice(0, 5)}–${request.end_time?.slice(0, 5)}` : ''}${request.role ? ` · ${request.role}` : ''}${request.individual_name ? ` · for ${request.individual_name}` : ''}`}
      size="lg">
      <p className="mb-3 text-[11px] text-slate-400">
        Only compliant workers can be allocated. Rates are set by the office — you'll never see pay or charge figures.
      </p>
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
        <CardHeader title="Requests needing cover" subtitle="Logged by your site — allocate a worker or leave it to the office" />
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
                  {+r.filled_count > 0 && <p className="mt-0.5 text-xs text-emerald-600">{r.filled_count}/{r.qty} filled{r.filled_by ? ` — ${r.filled_by}` : ''}</p>}
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
