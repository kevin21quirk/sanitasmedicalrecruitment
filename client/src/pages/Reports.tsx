import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Timer, Clock3, CircleCheck, Ban, AlertTriangle, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { gbp } from '../lib/format';
import { Card, CardHeader, Avatar, Spinner, PageHeader, ComplianceBar, btnPrimary, btnGhost } from '../components/ui';

interface ReportsData {
  revenueByClient: { name: string; revenue: string; hours: string }[];
  recruiterBoard: { name: string; initials: string; color: string; placements: string; submissions: string }[];
  avgTimeToFill: string | null;
  complianceByRole: { role: string; avg_score: string; compliant: string; total: string }[];
  shiftStats: { completed: string; cancelled: string; no_show: string; booked: string; hours_completed: string };
  monthlyRevenue: { month: string; revenue: string; pay: string; margin: string }[];
}

import { TOOLTIP_STYLE, TOOLTIP_CURSOR } from '../components/charts';

export default function Reports() {
  const [tab, setTab] = useState<'performance' | 'operations'>('performance');
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => { api.get<ReportsData>('/reports').then(setData); }, []);

  const monthly = (data?.monthlyRevenue ?? []).map((m) => ({
    month: m.month, revenue: +m.revenue, pay: +m.pay, margin: +m.margin,
  }));

  const clients10 = (data?.revenueByClient ?? []).slice(0, 10).map((c) => ({
    name: c.name.length > 22 ? `${c.name.slice(0, 21)}…` : c.name,
    revenue: +c.revenue,
    hours: +c.hours,
  }));

  const recruiters = (data?.recruiterBoard ?? []).map((r) => ({
    ...r,
    placements: +r.placements,
    submissions: +r.submissions,
  }));
  const maxPlacements = Math.max(...recruiters.map((r) => r.placements), 1);

  const pie = [
    { name: 'Completed', value: +(data?.shiftStats.completed ?? 0), color: '#2fbf9a' },
    { name: 'Booked', value: +(data?.shiftStats.booked ?? 0), color: '#1863dc' },
    { name: 'Cancelled', value: +(data?.shiftStats.cancelled ?? 0), color: '#94a3b8' },
    { name: 'No show', value: +(data?.shiftStats.no_show ?? 0), color: '#f0707a' },
  ];
  const totalShifts = pie.reduce((s, p) => s + p.value, 0);

  const compTotal = (data?.complianceByRole ?? []).reduce((s, r) => s + +r.total, 0);
  const avgCompliance = compTotal
    ? Math.round((data?.complianceByRole ?? []).reduce((s, r) => s + +r.avg_score * +r.total, 0) / compTotal)
    : 0;

  const kpis: { label: string; value: string | number; icon: typeof Timer; sub: string; tint?: string }[] = [
    { label: 'Avg days-to-fill', value: data?.avgTimeToFill ? `${Number(data.avgTimeToFill)}` : '—', icon: Timer, sub: 'submission to placement' },
    { label: 'Hours completed', value: (+(data?.shiftStats.hours_completed ?? 0)).toLocaleString('en-GB'), icon: Clock3, sub: 'shifts worked' },
    { label: 'Shifts completed', value: +(data?.shiftStats.completed ?? 0), icon: CircleCheck, sub: 'filled successfully', tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Cancelled', value: +(data?.shiftStats.cancelled ?? 0), icon: Ban, sub: 'by client or worker', tint: 'bg-slate-100 text-slate-500' },
    { label: 'No shows', value: +(data?.shiftStats.no_show ?? 0), icon: AlertTriangle, sub: 'worker did not attend', tint: 'bg-red-50 text-red-500' },
    { label: 'Avg compliance', value: `${avgCompliance}%`, icon: ShieldCheck, sub: `${(data?.complianceByRole ?? []).reduce((s, r) => s + +r.compliant, 0)} of ${compTotal} compliant` },
  ];

  if (!data) return <Spinner label="Loading reports…" />;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Agency performance — revenue, recruiters, compliance and shift outcomes.">
        <div className="scroll-thin flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-900/5 p-1">
          {(['performance', 'operations'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-medium capitalize',
                tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'operations' ? 'Shift operations (7.x)' : 'Performance'}
            </button>
          ))}
        </div>
      </PageHeader>

      {tab === 'operations' && <OperationsReport />}

      {tab === 'performance' && (<>
      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, sub, tint }) => (
          <Card key={label} className="p-4">
            <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', tint ?? 'bg-brand-500/10 text-brand-600')}>
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Revenue vs pay vs margin */}
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue vs Pay vs Margin" subtitle="Completed shifts by month" />
          <div className="h-72 px-4 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => gbp(Number(v ?? 0))} contentStyle={TOOLTIP_STYLE} cursor={TOOLTIP_CURSOR} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
                <Bar dataKey="revenue" name="Revenue" fill="#1863dc" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pay" name="Pay" fill="#8b7cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="margin" name="Margin" fill="#01aef0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Shift outcomes donut */}
        <Card>
          <CardHeader title="Shift Outcomes" subtitle="All recorded shifts" />
          <div className="px-5 py-4">
            <div className="relative h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold tracking-tight text-ink">{totalShifts}</p>
                <p className="text-[11px] text-slate-400">total shifts</p>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {pie.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 text-slate-600">{p.name}</span>
                  <span className="font-semibold text-ink">{p.value}</span>
                  <span className="w-10 text-right text-[11px] text-slate-400">
                    {totalShifts ? `${Math.round((p.value / totalShifts) * 100)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Revenue by client */}
        <Card>
          <CardHeader title="Revenue by Client" subtitle="Top 10 care homes by billed revenue" />
          <div className="h-80 px-4 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clients10} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => gbp(Number(v ?? 0))} contentStyle={TOOLTIP_STYLE} cursor={TOOLTIP_CURSOR} />
                <Bar dataKey="revenue" name="Revenue" fill="#1863dc" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recruiter leaderboard */}
        <Card>
          <CardHeader title="Recruiter Leaderboard" subtitle="Placements and submissions by consultant" />
          <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
            {recruiters.map((r, i) => {
              const conv = r.submissions ? Math.round((r.placements / r.submissions) * 100) : 0;
              return (
                <div key={r.name} className="flex items-center gap-3 px-5 py-3">
                  <span className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  )}>
                    {i + 1}
                  </span>
                  <Avatar initials={r.initials} color={r.color} name={r.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400"
                        style={{ width: `${(r.placements / maxPlacements) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-ink">{r.placements} <span className="text-[11px] font-normal text-slate-400">placed</span></p>
                    <p className="text-[11px] text-slate-400">{r.submissions} subs · {conv}%</p>
                  </div>
                </div>
              );
            })}
            {!recruiters.length && <p className="px-5 py-8 text-center text-sm text-slate-400">No recruiter data</p>}
          </div>
        </Card>

        {/* Compliance by role */}
        <Card>
          <CardHeader title="Compliance by Role" subtitle="Average compliance score per candidate role" />
          <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
            {data.complianceByRole.map((r) => (
              <div key={r.role} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{r.role}</p>
                  <p className="text-[11px] text-slate-400">{+r.compliant} of {+r.total} fully compliant</p>
                </div>
                <ComplianceBar score={Math.round(+r.avg_score)} />
              </div>
            ))}
            {!data.complianceByRole.length && <p className="px-5 py-8 text-center text-sm text-slate-400">No candidate data</p>}
          </div>
        </Card>
      </div>
      </>)}
    </div>
  );
}

// ─── 7.x operational reports ────────────────────────────────────────────────
interface OpsData {
  drops: { worker: string; dropped: string; no_shows: string; completed: string }[];
  reoffer_fill_hours: string | null;
  reoffer_filled_count: number;
  withdrawals: { reason: string | null; count: string; worker: string }[];
  non_placeable: { id: number; worker: string; role: string; gaps: string }[];
  timesheet_notes: { shift_id: number; shift_date: string; client_name: string; worker_name: string; note: string }[];
  fill_rate: { client: string; week: string; requested: number; filled: number; pct: number }[];
}

function OperationsReport() {
  const [d, setD] = useState<OpsData | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  useEffect(() => { api.get<OpsData>('/admin/operational').then(setD).catch(() => setD(null)); }, []);
  if (!d) return <Spinner label="Loading operational reports…" />;

  const sendDigest = async () => {
    setDigestBusy(true);
    try {
      await api.post('/admin/digest', {});
      alert('Digest queued in the outbox — open Communications → Outbox to send it.');
    } finally { setDigestBusy(false); }
  };

  // 7.3 — group withdrawal reasons
  const reasons = d.withdrawals.reduce<Record<string, number>>((a, w) => {
    const k = w.reason || 'No reason given';
    a[k] = (a[k] ?? 0) + +w.count;
    return a;
  }, {});

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Fill rate by client & week" subtitle="Requested vs filled (7.5)" />
        <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
          {d.fill_rate.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <div>
                <span className="text-ink">{r.client}</span>
                <span className="ml-2 text-[11px] text-slate-400">w/c {String(r.week).slice(0, 10)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{r.filled}/{r.requested}</span>
                <span className={clsx('w-10 rounded px-1 text-center text-[11px] font-semibold',
                  r.pct >= 80 ? 'bg-emerald-50 text-emerald-600' : r.pct >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600')}>
                  {r.pct}%
                </span>
              </div>
            </div>
          ))}
          {!d.fill_rate.length && <p className="px-5 py-6 text-center text-xs text-slate-400">No requests yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Dropped confirmed shifts" subtitle="Cancellations & no-shows by worker (7.1)" />
        <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
          {d.drops.map((w) => {
            const total = +w.dropped + +w.no_shows + +w.completed;
            const pct = total ? Math.round(((+w.dropped + +w.no_shows) / total) * 100) : 0;
            return (
              <div key={w.worker} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-ink">{w.worker}</span>
                <span className="text-xs text-slate-500">{w.dropped} dropped · {w.no_shows} no-show · {pct}% of {total}</span>
              </div>
            );
          })}
          {!d.drops.length && <p className="px-5 py-6 text-center text-xs text-slate-400">No completed/dropped shifts yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Withdrawal reasons" subtitle="Why workers decline or withdraw (7.3)" />
        <div className="px-5 py-4">
          {Object.entries(reasons).map(([reason, n]) => (
            <div key={reason} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-slate-600">{reason}</span>
              <span className="font-semibold text-ink">{n}</span>
            </div>
          ))}
          {!Object.keys(reasons).length && <p className="text-xs text-slate-400">No declined offers yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Non-placeable workers" subtitle={`${d.non_placeable.length} blocked by lapsed/missing docs (7.4)`} />
        <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
          {d.non_placeable.map((w) => (
            <div key={w.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="text-ink">{w.worker} <span className="text-[11px] text-slate-400">{w.role}</span></span>
              <span className="text-xs text-red-600">{w.gaps} gap{+w.gaps !== 1 ? 's' : ''}</span>
            </div>
          ))}
          {!d.non_placeable.length && <p className="px-5 py-6 text-center text-xs text-slate-400">Everyone's clear.</p>}
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader title="Site signatory notes" subtitle="Recorded at signing — searchable patterns by worker or client (6.10b)" />
        <div className="scroll-thin max-h-60 divide-y divide-slate-200/50 overflow-y-auto">
          {d.timesheet_notes.map((n) => (
            <div key={n.shift_id} className="px-5 py-2.5 text-sm">
              <p className="text-ink">{n.worker_name} <span className="text-[11px] text-slate-400">@ {n.client_name} · {String(n.shift_date).slice(0, 10)}</span></p>
              <p className="text-xs text-slate-500">{n.note}</p>
            </div>
          ))}
          {!d.timesheet_notes.length && <p className="px-5 py-6 text-center text-xs text-slate-400">No signatory notes yet.</p>}
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader title="Re-offer speed & export" subtitle="How quickly dropped shifts refill (7.2), plus exports & digests (7.6)" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-slate-600">
            Re-offered shifts fill in <b className="text-ink">{d.reoffer_fill_hours ? `${d.reoffer_fill_hours}h` : '—'}</b> on average
            <span className="text-slate-400"> (across {d.reoffer_filled_count} filled requests)</span>
          </p>
          <div className="flex gap-2">
            <a href="/api/admin/operational.csv" className={btnGhost}>Export fill-rate CSV</a>
            <button className={btnPrimary} disabled={digestBusy} onClick={sendDigest}>
              {digestBusy ? 'Queueing…' : 'Queue weekly digest email'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
