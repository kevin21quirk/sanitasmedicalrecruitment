import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock3, Send, CheckCheck, Banknote, Info } from 'lucide-react';
import { api } from '../lib/api';
import { gbp2, fmtDate } from '../lib/format';
import { Shift } from '../lib/types';
import { Badge, Card, Spinner, EmptyState, PageHeader, btnPrimary, btnGhost } from '../components/ui';
import clsx from 'clsx';

type TsStatus = Shift['timesheet_status'];

const TABS: { key: TsStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not_submitted', label: 'Not Submitted' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
];

const NEXT_ACTION: Partial<Record<TsStatus, { label: string; next: TsStatus }>> = {
  not_submitted: { label: 'Mark submitted', next: 'submitted' },
  submitted: { label: 'Approve', next: 'approved' },
  approved: { label: 'Mark paid', next: 'paid' },
};

const actionBtn =
  'rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors';

export default function Timesheets() {
  const [rows, setRows] = useState<Shift[] | null>(null);
  const [tab, setTab] = useState<TsStatus | 'all'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const fetchRows = () => {
    api.get<Shift[]>('/shifts/timesheets').then(setRows).catch(() => setRows([]));
  };

  useEffect(fetchRows, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const list = rows ?? [];
    const c: Record<string, number> = { all: list.length };
    for (const t of TABS) if (t.key !== 'all') c[t.key] = list.filter((r) => r.timesheet_status === t.key).length;
    return c;
  }, [rows]);

  const summary = useMemo(() => {
    const list = rows ?? [];
    const month = format(new Date(), 'yyyy-MM');
    return {
      awaiting: list.filter((r) => r.timesheet_status === 'not_submitted').length,
      submitted: list.filter((r) => r.timesheet_status === 'submitted').length,
      approved: list.filter((r) => r.timesheet_status === 'approved').length,
      paidThisMonth: list
        .filter((r) => r.timesheet_status === 'paid' && r.shift_date?.startsWith(month))
        .reduce((sum, r) => sum + Number(r.pay_amount || 0), 0),
    };
  }, [rows]);

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => tab === 'all' || r.timesheet_status === tab),
    [rows, tab]
  );

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const patchStatus = async (id: number, timesheet_status: TsStatus) => {
    try {
      await api.patch(`/shifts/${id}`, { timesheet_status });
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, timesheet_status } : r)) ?? prev);
    } catch {
      fetchRows();
    }
  };

  const bulkUpdate = async (from: TsStatus, next: TsStatus) => {
    setBusy(true);
    const targets = filtered.filter((r) => selected.has(r.id) && r.timesheet_status === from);
    for (const r of targets) {
      try {
        await api.patch(`/shifts/${r.id}`, { timesheet_status: next });
      } catch {
        // continue with the rest; a refetch below reconciles state
      }
    }
    setSelected(new Set());
    setBusy(false);
    fetchRows();
  };

  if (!rows) return <Spinner label="Loading timesheets…" />;

  const cards = [
    { label: 'Awaiting Submission', value: summary.awaiting, icon: Clock3, sub: 'completed shifts' },
    { label: 'Submitted', value: summary.submitted, icon: Send, sub: 'awaiting approval' },
    { label: 'Awaiting Payroll', value: summary.approved, icon: CheckCheck, sub: 'approved, unpaid' },
    { label: 'Paid This Month', value: gbp2(summary.paidThisMonth), icon: Banknote, sub: 'worker pay' },
  ];

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Approve and pay completed shifts." />

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label} className="p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSelected(new Set()); }}
            className={clsx(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            )}
          >
            {label}
            <span className={clsx(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              tab === key ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'
            )}>
              {counts[key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-xs font-medium text-brand-700">{selected.size} selected</span>
          <button className={clsx(btnPrimary, 'px-2.5 py-1.5 text-xs')} disabled={busy} onClick={() => bulkUpdate('submitted', 'approved')}>
            Approve selected
          </button>
          <button className={clsx(btnGhost, 'px-2.5 py-1.5 text-xs')} disabled={busy} onClick={() => bulkUpdate('approved', 'paid')}>
            Mark paid selected
          </button>
          <button className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Shift</th>
                <th className="px-4 py-3 font-medium">Hours</th>
                <th className="px-4 py-3 font-medium">Pay</th>
                <th className="px-4 py-3 font-medium">Charge</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((r) => {
                const action = NEXT_ACTION[r.timesheet_status];
                return (
                  <tr key={r.id} className={clsx('hover:bg-slate-50/60', selected.has(r.id) && 'bg-brand-50/40')}>
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{fmtDate(r.shift_date)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/candidates/${r.candidate_id}`} className="font-medium text-ink hover:text-brand-600">
                        {r.candidate_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/clients/${r.client_id}`} className="text-xs text-slate-600 hover:text-brand-600">
                        {r.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><Badge value={r.shift_type} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.hours}h</td>
                    <td className="px-4 py-3 text-xs font-medium text-ink">{gbp2(r.pay_amount)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-ink">{gbp2(r.charge_amount)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Badge value={r.timesheet_status} />
                        {action && (
                          <button className={actionBtn} onClick={() => patchStatus(r.id, action.next)}>
                            {action.label}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <EmptyState
              icon={<Clock3 className="h-5 w-5" />}
              title="No timesheets here"
              hint="Completed shifts will appear once workers finish their assignments."
            />
          )}
        </div>
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Info className="h-3.5 w-3.5" />
        Workers are paid within 2 working days of timesheet approval (Sanitas policy).
      </p>
    </div>
  );
}
