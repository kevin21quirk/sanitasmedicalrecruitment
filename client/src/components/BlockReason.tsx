import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarX, FileWarning, UserX } from 'lucide-react';
import { Modal, btnGhost, btnPrimary } from './ui';

export interface BookingGap { type: string; problem: string; expiry_date?: string | null }
export interface BookingConflict { id: number; shift_date: string; start_time: string; end_time: string; client_name?: string }

function explain(g: BookingGap): { title: string; detail: string; fix: string } {
  switch (g.problem) {
    case 'missing':
      return {
        title: `${g.type} — missing`,
        detail: `This care home requires ${g.type}, and there is no ${g.type} record on file for this worker.`,
        fix: `Upload a valid ${g.type} on the worker's Compliance tab. If it genuinely doesn't apply to this home, remove it from the home's requirements list.`,
      };
    case 'expired':
      return {
        title: `${g.type} — expired`,
        detail: `The ${g.type} on file expired${g.expiry_date ? ` on ${g.expiry_date}` : ''}, so it no longer satisfies this home's requirements.`,
        fix: `Record a renewed ${g.type} (new expiry date) on the worker's Compliance tab.`,
      };
    case 'pending verification':
      return {
        title: `${g.type} — awaiting verification`,
        detail: `A ${g.type} document has been uploaded but hasn't been reviewed yet.`,
        fix: `A user with compliance access must open the document and mark it valid before this worker can be booked here.`,
      };
    default:
      return {
        title: g.type === 'status' || g.type === 'record' ? 'Worker status' : g.type,
        detail: g.problem,
        fix: `Update the worker's status/details on their record, then try booking again.`,
      };
  }
}

/** Renders a rejection reason as a clickable line that opens an explainer popup. */
export function BlockReason({ message, gaps, conflicts, candidateId, clientId }: {
  message: string;
  gaps?: BookingGap[] | null;
  conflicts?: BookingConflict[] | null;
  candidateId?: number;
  clientId?: number;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(gaps?.length || conflicts?.length);

  return (
    <>
      {hasDetail ? (
        <button type="button" onClick={() => setOpen(true)}
          className="text-left text-xs font-medium text-red-600 underline decoration-red-300 underline-offset-2 hover:text-red-700">
          {message} — see why
        </button>
      ) : (
        <p className="text-xs font-medium text-red-600">{message}</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Why can't this be booked?" icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}>
        <div className="space-y-4">
          {!!gaps?.length && (
            <div className="space-y-3">
              {gaps.map((g, i) => {
                const e = explain(g);
                return (
                  <div key={i} className="rounded-xl border border-red-100 bg-red-50/60 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
                      {g.type === 'status' || g.type === 'record' ? <UserX className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
                      {e.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{e.detail}</p>
                    <p className="mt-1.5 text-xs font-medium text-slate-800">
                      <span className="text-red-700">To fix:</span> {e.fix}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {!!conflicts?.length && (
            <div className="space-y-2">
              {conflicts.map((c) => (
                <div key={c.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                    <CalendarX className="h-4 w-4" /> Already booked
                  </p>
                  <p className="mt-1 text-xs text-slate-700">
                    {String(c.shift_date).slice(0, 10)} · {String(c.start_time).slice(0, 5)}–{String(c.end_time).slice(0, 5)}
                    {c.client_name ? ` at ${c.client_name}` : ''}
                  </p>
                  <p className="mt-1.5 text-xs font-medium text-slate-800">
                    <span className="text-amber-700">To fix:</span> pick a different date, or cancel the overlapping shift first.
                  </p>
                </div>
              ))}
            </div>
          )}

          {!hasDetail && <p className="text-sm text-slate-600">{message}</p>}

          {(candidateId || clientId) && (
            <div className="flex flex-wrap gap-2 border-t border-slate-200/60 pt-3">
              {candidateId && <Link to={`/candidates/${candidateId}`} className={btnPrimary}>Open worker record</Link>}
              {clientId && <Link to={`/clients/${clientId}`} className={btnGhost}>Open care-home requirements</Link>}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
