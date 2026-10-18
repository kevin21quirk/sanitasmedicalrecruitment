import { ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import clsx from 'clsx';
import { Card } from './ui';

// ---------- palette ----------
// Brand blues first, then a small analytic set — kept in step with the
// --color-viz-* tokens in index.css so SVG charts and CSS tiles match.
export const VIZ = {
  brand: '#1863dc', accent: '#01aef0', navy: '#0c56a4',
  mint: '#2fbf9a', coral: '#f0707a', amber: '#f4b942', violet: '#8b7cf6', slate: '#94a3b8',
} as const;
export type VizKey = keyof typeof VIZ;
export const VIZ_SERIES: VizKey[] = ['brand', 'accent', 'mint', 'amber', 'coral', 'violet', 'navy', 'slate'];

export const TOOLTIP_STYLE = {
  fontSize: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.9)',
  background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px) saturate(1.5)',
  boxShadow: '0 16px 40px -16px rgba(12,86,164,0.35)',
};
export const TOOLTIP_CURSOR = { fill: 'rgba(24,99,220,0.06)' };

export const num = (v: unknown) => +(v ?? 0);
export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

// ---------- KPI tile (reference dashboard: coloured header band, big number) ----------
export function KpiTile({ label, value, icon: Icon, tint = 'brand', sub, className, children }: {
  label: string; value?: ReactNode; icon?: React.ComponentType<{ className?: string }>;
  tint?: VizKey; sub?: string; className?: string; children?: ReactNode;
}) {
  return (
    <Card className={clsx('tile overflow-hidden tile-ring', `tile-${tint}`, className)}>
      <div className="tile-band flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-wide">
        {Icon && <Icon className="h-3.5 w-3.5 opacity-90" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
        {children ?? <p className="font-display text-3xl font-bold tracking-tight text-ink">{value}</p>}
        {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
      </div>
    </Card>
  );
}

// Two-way split inside a tile (reference: Applicants by Gender)
export function SplitStat({ items }: { items: { label: string; value: ReactNode; tint: VizKey; icon?: React.ComponentType<{ className?: string }> }[] }) {
  return (
    <div className="flex items-center justify-center gap-6">
      {items.map(({ label, value, tint, icon: Icon }) => (
        <div key={label} className={clsx('tile flex items-center gap-2.5', `tile-${tint}`)}>
          {Icon && <span className="tile-soft flex h-10 w-10 items-center justify-center rounded-full"><Icon className="h-5 w-5" /></span>}
          <div className="text-left leading-tight">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="font-display text-xl font-bold" style={{ color: VIZ[tint] }}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Legend ----------
export function Legend({ items, className }: { items: { label: string; color: string; value?: ReactNode }[]; className?: string }) {
  return (
    <ul className={clsx('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600', className)}>
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: i.color }} />
          <span>{i.label}</span>
          {i.value != null && <span className="font-semibold text-ink">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

// ---------- Stacked horizontal bar (reference: Recruitment by Department) ----------
export function StackedBar({ segments, height = 'h-8', showLabels = true, className }: {
  segments: { label: string; value: number; color: string }[]; height?: string; showLabels?: boolean; className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={className}>
      <div className={clsx('flex w-full overflow-hidden rounded-xl bg-slate-900/5 ring-1 ring-white/70', height)}>
        {total === 0 && <div className="flex w-full items-center justify-center text-[11px] text-slate-400">No data</div>}
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} title={`${s.label}: ${s.value}`}
            className="flex items-center justify-center text-[11px] font-semibold text-white transition-[width] duration-500"
            style={{ width: `${(s.value / total) * 100}%`, background: `linear-gradient(180deg, ${s.color}, color-mix(in srgb, ${s.color} 82%, black))` }}>
            {showLabels && (s.value / total) > 0.07 && s.value}
          </div>
        ))}
      </div>
      <Legend className="mt-3" items={segments.map((s) => ({ label: s.label, color: s.color, value: s.value }))} />
    </div>
  );
}

// ---------- Horizontal bar list (reference: Reason for Candidate Decline) ----------
export function HBars({ rows, color = VIZ.coral, className }: {
  rows: { label: string; value: number; color?: string }[]; color?: string; className?: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={clsx('space-y-3', className)}>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
          <span className="truncate text-right text-xs text-slate-600">{r.label}</span>
          <div className="relative h-7 overflow-hidden rounded-lg bg-slate-900/5 ring-1 ring-white/70">
            <div className="h-full rounded-lg transition-[width] duration-500"
              style={{ width: `${Math.max((r.value / max) * 100, r.value ? 6 : 0)}%`, background: `linear-gradient(90deg, ${r.color ?? color}, color-mix(in srgb, ${r.color ?? color} 70%, white))` }} />
            <span className="absolute inset-y-0 right-2 flex items-center rounded-md bg-white/80 px-1.5 text-[10px] font-semibold text-ink shadow-sm backdrop-blur">
              {r.value} | {pct(r.value, total)}%
            </span>
          </div>
        </div>
      ))}
      {!rows.length && <p className="py-6 text-center text-xs text-slate-400">No data</p>}
    </div>
  );
}

// ---------- Donut (reference: Recruitment by Source) ----------
export function Donut({ data, size = 180, centre, className }: {
  data: { label: string; value: number; color: string }[]; size?: number; centre?: ReactNode; className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const live = data.filter((d) => d.value > 0);
  return (
    <div className={clsx('flex flex-wrap items-center justify-center gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={live.length ? live : [{ label: 'None', value: 1, color: '#cbd5e1' }]} dataKey="value" nameKey="label"
              innerRadius="58%" outerRadius="92%" paddingAngle={live.length > 1 ? 2 : 0} stroke="rgba(255,255,255,0.85)" strokeWidth={2}
              startAngle={90} endAngle={-270} isAnimationActive>
              {(live.length ? live : [{ color: '#cbd5e1' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {live.length > 0 && <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} (${pct(Number(v), total)}%)`, '']} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centre ?? (<>
            <p className="font-display text-2xl font-bold text-ink">{total}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">total</p>
          </>)}
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: d.color }} />
            <span className="w-28 truncate text-slate-600">{d.label}</span>
            <span className="font-semibold text-ink">{pct(d.value, total)}%</span>
            <span className="text-slate-400">({d.value})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Status-tinted table cell ----------
const CELL_TINT: Record<string, string> = {
  compliant: 'cell-mint', on_assignment: 'cell-brand', in_progress: 'cell-amber', dormant: 'cell-slate', do_not_use: 'cell-coral',
  valid: 'cell-mint', expiring: 'cell-amber', expired: 'cell-coral', pending: 'cell-accent', missing: 'cell-slate',
  booked: 'cell-brand', completed: 'cell-mint', cancelled: 'cell-slate', no_show: 'cell-coral',
  filled: 'cell-mint', active: 'cell-mint', approved: 'cell-brand', paid: 'cell-mint', queried: 'cell-amber', submitted: 'cell-accent',
  placed: 'cell-mint', rejected: 'cell-coral', offer: 'cell-amber', interview: 'cell-violet', shortlisted: 'cell-amber',
};
export function StatusCell({ value, label }: { value: string; label?: string }) {
  return (
    <span className={clsx('cell-tint inline-block min-w-[5.5rem] rounded-md px-2 py-0.5 text-[11px]', CELL_TINT[value] ?? 'cell-slate')}>
      {label ?? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}
