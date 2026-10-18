import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from 'recharts';
import {
  Users, Building2, Briefcase, TrendingUp, ShieldAlert, ShieldCheck,
  ArrowUpRight, CalendarDays, CircleCheck, Circle, AlertTriangle, ClipboardList, Percent, Stethoscope, HeartHandshake,
} from 'lucide-react';
import { api } from '../lib/api';
import { gbp, fmtDate, ago, isOverdue } from '../lib/format';
import { pipelineGroups, requestStage, STAGES } from '../lib/pipeline';
import { Activity, Task, ComplianceDoc, ShiftRequest } from '../lib/types';
import { Card, CardHeader, Badge, Avatar, Spinner, PageHeader, ComplianceBar } from '../components/ui';
import { KpiTile, SplitStat, StackedBar, Donut, HBars, StatusCell, VIZ, VIZ_SERIES, TOOLTIP_STYLE, TOOLTIP_CURSOR, num, pct } from '../components/charts';
import { ActivityFeed } from '../components/ActivityFeed';
import clsx from 'clsx';

interface DashboardData {
  kpis: {
    active_candidates: string; new_candidates_30d: string; active_clients: string;
    open_vacancies: string; active_placements: string; revenue_mtd: string;
    margin_mtd: string; compliance_alerts: string;
  };
  revenue: { month: string; revenue: string; margin: string }[];
  placementsByMonth: { month: string; count: string }[];
  complianceAlerts: ComplianceDoc[];
  recentActivity: Activity[];
  tasksDue: Task[];
  pipeline: { stage: string; count: string }[];
  shiftsThisWeek: { shift_date: string; shift_type: string; status: string; candidate_name: string; client_name: string }[];
  candidatesByRole: { role: string; count: string }[];
  candidatesBySource: { source: string; count: string }[];
  candidatesByStatus: { status: string; count: string }[];
  requestStats: { pending: string; filled: string; cancelled: string; urgent: string; this_month: string; filled_this_month: string };
  shiftOutcomes: { completed: string; booked: string; cancelled: string; no_show: string };
  recentCandidates: { id: number; name: string; role: string; status: string; source: string | null; registered_at: string; last_worked_at: string | null; compliance_score: number; photo_file_id: number | null }[];
}

const isNurse = (role: string) => /nurse|rn|rmn|rgn/i.test(role);

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then(setData);
    api.get<ShiftRequest[]>('/requests').then(setRequests).catch(() => {});
  }, []);

  if (!data) return <Spinner label="Loading dashboard…" />;
  const { kpis, requestStats: rq, shiftOutcomes: so } = data;
  const reqGroups = pipelineGroups(requests);
  const liveTotal = requests.filter((r) => requestStage(r) !== 'cancelled').length || 1;

  const statusCount = (s: string) => num(data.candidatesByStatus.find((x) => x.status === s)?.count);
  const totalCandidates = data.candidatesByStatus.reduce((s, x) => s + num(x.count), 0);
  const nurses = data.candidatesByRole.filter((r) => isNurse(r.role)).reduce((s, r) => s + num(r.count), 0);
  const carers = data.candidatesByRole.filter((r) => !isNurse(r.role)).reduce((s, r) => s + num(r.count), 0);
  const fillRate = pct(num(rq.filled), num(rq.filled) + num(rq.pending) + num(rq.cancelled));

  const byRole = data.candidatesByRole.map((r, i) => ({ label: r.role, value: num(r.count), color: VIZ[VIZ_SERIES[i % VIZ_SERIES.length]] }));
  const bySource = data.candidatesBySource.map((r, i) => ({ label: r.source, value: num(r.count), color: VIZ[VIZ_SERIES[i % VIZ_SERIES.length]] }));
  const outcomes = [
    { label: 'Completed', value: num(so.completed), color: VIZ.mint },
    { label: 'Booked', value: num(so.booked), color: VIZ.brand },
    { label: 'Cancelled', value: num(so.cancelled), color: VIZ.amber },
    { label: 'No show', value: num(so.no_show), color: VIZ.coral },
  ];
  const statusBars = [
    { label: 'Compliant', value: statusCount('compliant'), color: VIZ.mint },
    { label: 'On assignment', value: statusCount('on_assignment'), color: VIZ.brand },
    { label: 'In progress', value: statusCount('in_progress'), color: VIZ.amber },
    { label: 'Dormant', value: statusCount('dormant'), color: VIZ.slate },
    { label: 'Do not use', value: statusCount('do_not_use'), color: VIZ.coral },
  ];

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Recruitment Dashboard" subtitle="Live overview of candidates, clients, placements and compliance." />

      {/* KPI tiles — coloured header band, big number */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Link to="/candidates"><KpiTile label="Total Candidates" value={totalCandidates} icon={Users} tint="violet" sub={`+${kpis.new_candidates_30d} this month`} className="h-full" /></Link>
        <Link to="/candidates?status=compliant"><KpiTile label="Compliant" value={kpis.active_candidates} icon={ShieldCheck} tint="mint" sub="ready to work" className="h-full" /></Link>
        <Link to="/placements"><KpiTile label="On Placement" value={kpis.active_placements} icon={Briefcase} tint="brand" sub="active workers" className="h-full" /></Link>
        <Link to="/requests"><KpiTile label="Open Requests" value={rq.pending} icon={ClipboardList} tint={num(rq.urgent) ? 'coral' : 'amber'} sub={num(rq.urgent) ? `${rq.urgent} urgent` : 'awaiting allocation'} className="h-full" /></Link>
        <Link to="/reports"><KpiTile label="Fill Rate" value={`${fillRate}%`} icon={Percent} tint="accent" sub={`${rq.filled_this_month}/${rq.this_month} this month`} className="h-full" /></Link>
        <Link to="/compliance" className="col-span-2 md:col-span-1">
          <KpiTile label="Compliance Alerts" value={kpis.compliance_alerts} icon={ShieldAlert} tint={num(kpis.compliance_alerts) ? 'coral' : 'mint'} sub="expired / expiring" className="h-full" />
        </Link>
      </div>

      {/* Second row — revenue, clients and workforce split */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link to="/reports">
          <Card className="tile tile-brand tile-ring flex h-full items-center gap-4 p-4">
            <span className="tile-band flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"><TrendingUp className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Revenue MTD</p>
              <p className="font-display text-2xl font-bold text-ink">{gbp(kpis.revenue_mtd)}</p>
              <p className="text-[11px] text-slate-500">{gbp(kpis.margin_mtd)} margin</p>
            </div>
            <ArrowUpRight className="ml-auto h-4 w-4 text-slate-300" />
          </Card>
        </Link>
        <Link to="/clients">
          <Card className="tile tile-accent tile-ring flex h-full items-center gap-4 p-4">
            <span className="tile-band flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"><Building2 className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Care Homes</p>
              <p className="font-display text-2xl font-bold text-ink">{kpis.active_clients}</p>
              <p className="text-[11px] text-slate-500">{kpis.open_vacancies} open vacancies</p>
            </div>
            <ArrowUpRight className="ml-auto h-4 w-4 text-slate-300" />
          </Card>
        </Link>
        <KpiTile label="Workforce by Discipline" icon={Users} tint="navy" className="h-full">
          <SplitStat items={[
            { label: 'Nurses', value: nurses, tint: 'brand', icon: Stethoscope },
            { label: 'Care staff', value: carers, tint: 'mint', icon: HeartHandshake },
          ]} />
        </KpiTile>
      </div>

      {/* Workflow pipeline — colour-coded stages from request to paid */}
      <Card className="mb-6">
        <CardHeader
          title="Workflow pipeline"
          subtitle="Request → offers → booked → timesheet → invoice"
          action={<Link to="/requests" className="text-xs font-medium text-brand-600 hover:text-brand-700">Open pipeline</Link>}
        />
        <div className="px-5 pb-4 pt-3">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-900/5 ring-1 ring-white/70">
            {STAGES.filter((s) => s.key !== 'cancelled').map((s) => {
              const count = (reqGroups.get(s.key) ?? []).length;
              return <div key={s.key} className={clsx('h-full', s.bar)} style={{ width: `${(count / liveTotal) * 100}%` }} title={`${s.label}: ${count}`} />;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STAGES.map((s) => {
              const count = (reqGroups.get(s.key) ?? []).length;
              const urgent = s.key === 'new' ? (reqGroups.get('new') ?? []).filter((r) => r.urgency === 'urgent').length : 0;
              return (
                <Link key={s.key} to="/requests" title={s.hint}
                  className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset', s.chip)}>
                  <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} />
                  {s.label} · {count}
                  {!!urgent && <span className="text-red-600">({urgent} urgent)</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Analytics row — stacked bar + recent candidates | donut + outcomes */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Candidates by Role" subtitle="Active register split by discipline" />
            <div className="px-5 pb-5 pt-3"><StackedBar segments={byRole} /></div>
          </Card>

          <Card>
            <CardHeader
              title="Recent Registrations"
              subtitle="Latest candidates to join the register"
              action={<Link to="/candidates" className="text-xs font-medium text-brand-600 hover:text-brand-700">All candidates</Link>}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="grid-head">
                  <tr>
                    {['Candidate', 'Registered', 'Role', 'Status', 'Source', 'Compliance', 'Last worked'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[11px] font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50">
                  {data.recentCandidates.map((c) => (
                    <tr key={c.id} className="grid-row">
                      <td className="px-4 py-2">
                        <Link to={`/candidates/${c.id}`} className="flex items-center gap-2 font-medium text-ink hover:text-brand-600">
                          <Avatar name={c.name} photoId={c.photo_file_id} size="xs" />
                          <span className="truncate">{c.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{fmtDate(c.registered_at)}</td>
                      <td className="px-4 py-2 text-slate-600">{c.role}</td>
                      <td className="px-4 py-2"><StatusCell value={c.status} /></td>
                      <td className="px-4 py-2 text-slate-600">{c.source || '—'}</td>
                      <td className="px-4 py-2"><ComplianceBar score={c.compliance_score} /></td>
                      <td className="px-4 py-2 text-slate-500">{c.last_worked_at ? fmtDate(c.last_worked_at) : '—'}</td>
                    </tr>
                  ))}
                  {!data.recentCandidates.length && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No candidates yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Candidates by Source" subtitle="Where the register comes from" />
            <div className="px-5 pb-5 pt-3"><Donut data={bySource} /></div>
          </Card>

          <Card>
            <CardHeader title="Shift Outcomes" subtitle="Last 90 days" action={<Link to="/shifts" className="text-xs font-medium text-brand-600 hover:text-brand-700">Calendar</Link>} />
            <div className="px-5 pb-5 pt-3"><HBars rows={outcomes} /></div>
          </Card>

          <Card>
            <CardHeader title="Register Status" subtitle="All candidates by status" />
            <div className="px-5 pb-5 pt-3"><HBars rows={statusBars} /></div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Revenue chart */}
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue & Margin" subtitle="Completed shifts, billed at charge rate" />
          <div className="h-64 px-4 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIZ.brand} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={VIZ.brand} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="mar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIZ.accent} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={VIZ.accent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => gbp(Number(v ?? 0))} contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={VIZ.brand} strokeWidth={2.5} fill="url(#rev)" />
                <Area type="monotone" dataKey="margin" name="Margin" stroke={VIZ.accent} strokeWidth={2.5} fill="url(#mar)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Placements per month */}
        <Card>
          <CardHeader title="Placements" subtitle="New placements per month" />
          <div className="h-64 px-4 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.placementsByMonth} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="plc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIZ.accent} />
                    <stop offset="100%" stopColor={VIZ.brand} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={TOOLTIP_CURSOR} />
                <Bar dataKey="count" fill="url(#plc)" radius={[6, 6, 0, 0]} name="Placements" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Compliance alerts */}
        <Card>
          <CardHeader
            title="Compliance Alerts"
            subtitle="Expired & expiring documents"
            action={<Link to="/compliance" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all</Link>}
          />
          <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
            {data.complianceAlerts.map((d) => (
              <Link to={`/candidates/${d.candidate_id}`} key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-500/5">
                <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', d.status === 'expired' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500')}>
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{d.candidate_name}</p>
                  <p className="truncate text-xs text-slate-500">{d.type} · {d.candidate_role}</p>
                </div>
                <div className="text-right">
                  <Badge value={d.status} />
                  <p className="mt-0.5 text-[10px] text-slate-400">{d.expiry_date ? fmtDate(d.expiry_date) : 'no date'}</p>
                </div>
              </Link>
            ))}
            {!data.complianceAlerts.length && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">All documents in order</p>
            )}
          </div>
        </Card>

        {/* Tasks due */}
        <Card>
          <CardHeader title="Tasks Due" subtitle="Across the team" />
          <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
            {data.tasksDue.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-5 py-3">
                {t.status === 'done'
                  ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  : <Circle className={clsx('mt-0.5 h-4 w-4 shrink-0', isOverdue(t.due_date) ? 'text-red-400' : 'text-slate-300')} />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <Avatar initials={t.initials} color={t.color} size="xs" />
                    <span>{t.user_name}</span>
                    <span>·</span>
                    <span className={clsx(isOverdue(t.due_date) && 'font-medium text-red-500')}>
                      {t.due_date ? ago(t.due_date) : 'no due date'}
                    </span>
                  </div>
                </div>
                <Badge value={t.priority} />
              </div>
            ))}
            {!data.tasksDue.length && <p className="px-5 py-8 text-center text-sm text-slate-400">Nothing outstanding</p>}
          </div>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader title="Recent Activity" subtitle="Latest team touchpoints" />
          <div className="scroll-thin max-h-80 overflow-y-auto px-5 py-4">
            <ActivityFeed activities={data.recentActivity} showEntity />
          </div>
        </Card>

        {/* This week's shifts */}
        <Card className="xl:col-span-3">
          <CardHeader
            title="This Week's Shifts"
            subtitle="Booked and completed shifts"
            action={<Link to="/shifts" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"><CalendarDays className="h-3.5 w-3.5" /> Calendar</Link>}
          />
          <div className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
            {data.shiftsThisWeek.map((s, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-2.5">
                <div className="w-20 shrink-0 text-xs font-medium text-slate-500">{fmtDate(s.shift_date)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.candidate_name}</p>
                  <p className="truncate text-xs text-slate-500">{s.client_name}</p>
                </div>
                <Badge value={s.shift_type} />
                <StatusCell value={s.status} />
              </div>
            ))}
            {!data.shiftsThisWeek.length && <p className="px-5 py-8 text-center text-sm text-slate-400">No shifts booked this week</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
