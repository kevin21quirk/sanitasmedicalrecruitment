import { ShiftRequest } from './types';

export type StageKey =
  | 'new' | 'offered' | 'part_filled' | 'booked'
  | 'awaiting_ts' | 'to_invoice' | 'complete' | 'cancelled';

export interface Stage {
  key: StageKey;
  label: string;
  hint: string;
  dot: string;   // small colour dot
  chip: string;  // badge classes
  bar: string;   // column top bar / progress fill
  card: string;  // card accent border
}

export const STAGES: Stage[] = [
  { key: 'new',         label: 'New request',        hint: 'Received — send offers or allocate',   dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 ring-blue-600/20',       bar: 'bg-blue-500',    card: 'border-l-blue-500' },
  { key: 'offered',     label: 'Offers out',         hint: 'Waiting on worker replies',            dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 ring-amber-600/20',    bar: 'bg-amber-500',   card: 'border-l-amber-500' },
  { key: 'part_filled', label: 'Part-filled',        hint: 'Some booked — more workers needed',    dot: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700 ring-orange-600/20', bar: 'bg-orange-500',  card: 'border-l-orange-500' },
  { key: 'booked',      label: 'Booked',             hint: 'Workers confirmed — upcoming',         dot: 'bg-cyan-500',    chip: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',       bar: 'bg-cyan-500',    card: 'border-l-cyan-500' },
  { key: 'awaiting_ts', label: 'Awaiting timesheet', hint: 'Shift done — needs office approval',   dot: 'bg-violet-500',  chip: 'bg-violet-50 text-violet-700 ring-violet-600/20', bar: 'bg-violet-500',  card: 'border-l-violet-500' },
  { key: 'to_invoice',  label: 'Ready to invoice',   hint: 'Approved — waiting to be billed',      dot: 'bg-teal-500',    chip: 'bg-teal-50 text-teal-700 ring-teal-600/20',       bar: 'bg-teal-500',    card: 'border-l-teal-500' },
  { key: 'complete',    label: 'Complete',           hint: 'Invoiced / paid — nothing left to do', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', bar: 'bg-emerald-500', card: 'border-l-emerald-500' },
  { key: 'cancelled',   label: 'Cancelled',          hint: 'Withdrawn requests',                   dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-500 ring-slate-400/20',   bar: 'bg-slate-400',   card: 'border-l-slate-300' },
];

const STAGE_MAP = new Map(STAGES.map((s) => [s.key, s]));
export const stageOf = (k: StageKey): Stage => STAGE_MAP.get(k)!;

const n = (v: unknown) => +(v ?? 0);

// First unmet step wins — a card sits in the earliest stage still outstanding.
export function requestStage(r: ShiftRequest): StageKey {
  if (r.status === 'cancelled') return 'cancelled';
  const filled = n(r.filled_count);
  if (filled < r.qty) {
    if (filled > 0) return 'part_filled';
    if (n(r.pending_offers) > 0) return 'offered';
    return 'new';
  }
  if (n(r.booked_count) > 0) return 'booked';
  if (n(r.awaiting_ts) > 0) return 'awaiting_ts';
  if (n(r.to_invoice) > 0) return 'to_invoice';
  return 'complete';
}

export function pipelineGroups(requests: ShiftRequest[]) {
  const groups = new Map<StageKey, ShiftRequest[]>(STAGES.map((s) => [s.key, []]));
  for (const r of requests) groups.get(requestStage(r))!.push(r);
  return groups;
}
