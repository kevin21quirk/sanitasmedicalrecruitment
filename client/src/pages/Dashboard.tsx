import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from 'recharts';
import {
  Users, Building2, KanbanSquare, Briefcase, TrendingUp, ShieldAlert,
  ArrowUpRight, CalendarDays, CircleCheck, Circle, AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { gbp, fmtDate, ago, isOverdue } from '../lib/format';
import { Activity, Task, ComplianceDoc } from '../lib/types';
import { Card, CardHeader, Badge, Avatar, Spinner, PageHeader } from '../components/ui';
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
}

const STAGE_ORDER = ['open', 'sourcing', 'shortlisted', 'interview', 'offer', 'filled'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => { api.get<DashboardData>('/dashboard').then(setData); }, []);

  if (!data) return <Spinner label="Loading dashboard…" />;
  const { kpis } = data;
  const pipeline = STAGE_ORDER.map((s) => ({ stage: s, count: +(data.pipeline.find((p) => p.stage === s)?.count ?? 0) }));
  const maxPipe = Math.max(...pipeline.map((p) => p.count), 1);

  const cards = [
    { label: 'Revenue MTD', value: gbp(kpis.revenue_mtd), icon: TrendingUp, sub: `${gbp(kpis.margin_mtd)} margin`, to: '/reports' },
    { label: 'Active Workers', value: kpis.active_placements, icon: Briefcase, sub: 'on placement now', to: '/placements' },
    { label: 'Open Vacancies', value: kpis.open_vacancies, icon: KanbanSquare, sub: 'across all clients', to: '/vacancies' },
    { label: 'Compliant Candidates', value: kpis.active_candidates, icon: Users, sub: `+${kpis.new_candidates_30d} this month`, to: '/candidates' },
    { label: 'Active Clients', value: kpis.active_clients, icon: Building2, sub: 'care homes', to: '/clients' },
    { label: 'Compliance Alerts', value: kpis.compliance_alerts, icon: ShieldAlert, sub: 'docs expired / expiring', to: '/compliance', alert: +kpis.compliance_alerts > 0 },
  ];

  return (
    <div>
      <PageHeader title="Recruitment Dashboard" subtitle="Live overview of candidates, clients, placements and compliance." />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon, sub, to, alert }) => (
          <Link key={label} to={to}>
            <Card className={clsx('group h-full p-4 transition-shadow hover:shadow-md', alert && 'ring-1 ring-red-200')}>
              <div className="flex items-center justify-between">
                <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', alert ? 'bg-red-50 text-red-500' : 'bg-brand-50 text-brand-600')}>
                  <Icon className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand-500" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
              <p className="text-xs font-medium text-slate-600">{label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
            </Card>
          </Link>
        ))}
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
                    <stop offset="0%" stopColor="#1863dc" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1863dc" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="mar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#01aef0" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#01aef0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => gbp(Number(v ?? 0))} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Area type="monotone" dataKey="revenue" stroke="#1863dc" strokeWidth={2.5} fill="url(#rev)" />
                <Area type="monotone" dataKey="margin" stroke="#01aef0" strokeWidth={2.5} fill="url(#mar)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHeader title="Vacancy Pipeline" subtitle="Live roles by stage" />
          <div className="space-y-3 px-5 py-4">
            {pipeline.map(({ stage, count }) => (
              <div key={stage}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-slate-600">{stage}</span>
                  <span className="font-semibold text-ink">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400 transition-all"
                    style={{ width: `${(count / maxPipe) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.placementsByMonth} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" fill="#1863dc" radius={[4, 4, 0, 0]} name="Placements" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Compliance alerts */}
        <Card>
          <CardHeader
            title="Compliance Alerts"
            subtitle="Expired & expiring documents"
            action={<Link to="/compliance" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all</Link>}
          />
          <div className="scroll-thin max-h-80 divide-y divide-slate-50 overflow-y-auto">
            {data.complianceAlerts.map((d) => (
              <Link to={`/candidates/${d.candidate_id}`} key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
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
          <div className="scroll-thin max-h-80 divide-y divide-slate-50 overflow-y-auto">
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
        <Card className="xl:col-span-2">
          <CardHeader
            title="This Week's Shifts"
            subtitle="Booked and completed shifts"
            action={<Link to="/shifts" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"><CalendarDays className="h-3.5 w-3.5" /> Calendar</Link>}
          />
          <div className="scroll-thin max-h-80 divide-y divide-slate-50 overflow-y-auto">
            {data.shiftsThisWeek.map((s, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-2.5">
                <div className="w-20 shrink-0 text-xs font-medium text-slate-500">{fmtDate(s.shift_date)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.candidate_name}</p>
                  <p className="truncate text-xs text-slate-500">{s.client_name}</p>
                </div>
                <Badge value={s.shift_type} />
                <Badge value={s.status} />
              </div>
            ))}
            {!data.shiftsThisWeek.length && <p className="px-5 py-8 text-center text-sm text-slate-400">No shifts booked this week</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
