import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ShieldCheck, ShieldAlert, Clock3, FileClock, FileQuestion,
  UserX, Search, Check, RotateCcw,
} from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, daysUntil } from '../lib/format';
import { ComplianceDoc } from '../lib/types';
import { Badge, Card, CardHeader, Avatar, Spinner, PageHeader, EmptyState, inputCls } from '../components/ui';

interface TypeStat {
  type: string;
  valid: string;
  expiring: string;
  expired: string;
  pending: string;
  missing: string;
}

interface Overview {
  summary: {
    valid: string; expiring: string; expired: string;
    pending: string; missing: string; candidates_blocked: string;
  };
  attention: ComplianceDoc[];
  byType: TypeStat[];
}

const SEGMENTS = [
  { key: 'valid', label: 'Valid', cls: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'expiring', label: 'Expiring', cls: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 'expired', label: 'Expired', cls: 'bg-red-500', dot: 'bg-red-500' },
  { key: 'pending', label: 'Pending', cls: 'bg-brand-500', dot: 'bg-brand-500' },
  { key: 'missing', label: 'Missing', cls: 'bg-slate-300', dot: 'bg-slate-300' },
] as const;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'expired', label: 'Expired' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'pending', label: 'Pending' },
  { key: 'missing', label: 'Missing' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function ExpiryCell({ date }: { date: string | null }) {
  const d = daysUntil(date);
  const cls = d == null ? 'text-slate-400' : d < 0 ? 'text-red-600' : d < 60 ? 'text-amber-600' : 'text-slate-600';
  const rel = d == null ? null : d < 0 ? `${-d}d ago` : d === 0 ? 'today' : `in ${d}d`;
  return (
    <div>
      <p className={clsx('text-sm font-medium', cls)}>{fmtDate(date)}</p>
      {rel && <p className={clsx('text-[11px]', cls)}>{rel}</p>}
    </div>
  );
}

export default function Compliance() {
  const [data, setData] = useState<Overview | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => api.get<Overview>('/compliance/overview').then(setData);
  useEffect(() => { load(); }, []);

  async function act(doc: ComplianceDoc, status: ComplianceDoc['status'], verify = false) {
    setBusyId(doc.id);
    try {
      await api.patch(`/compliance/documents/${doc.id}`, verify ? { status, verified_by: 5 } : { status });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.attention.filter((d) => {
      if (filter !== 'all' && d.status !== filter) return false;
      if (q && !(d.candidate_name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filter, search]);

  if (!data) return <Spinner label="Loading compliance…" />;

  const { summary } = data;
  const blocked = +summary.candidates_blocked;

  const kpis = [
    { label: 'Valid', value: +summary.valid, icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-600', sub: 'in date' },
    { label: 'Expiring', value: +summary.expiring, icon: Clock3, cls: 'bg-amber-50 text-amber-600', sub: 'within 60 days' },
    { label: 'Expired', value: +summary.expired, icon: ShieldAlert, cls: 'bg-red-50 text-red-500', sub: 'needs renewal' },
    { label: 'Pending', value: +summary.pending, icon: FileClock, cls: 'bg-brand-50 text-brand-600', sub: 'awaiting verification' },
    { label: 'Missing', value: +summary.missing, icon: FileQuestion, cls: 'bg-slate-100 text-slate-500', sub: 'not on file' },
  ];

  return (
    <div>
      <PageHeader title="Compliance" subtitle="DBS, NMC PIN, right-to-work and training documents across all candidates." />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, cls, sub }) => (
          <Card key={label} className="p-4">
            <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', cls)}>
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
          </Card>
        ))}
        {blocked > 0 && (
          <Card className="p-4 ring-1 ring-red-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white">
              <UserX className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-bold tracking-tight text-red-600">{blocked}</p>
            <p className="text-xs font-medium text-red-600">Candidates blocked</p>
            <p className="mt-0.5 text-[11px] text-red-400">expired or missing docs</p>
          </Card>
        )}
      </div>

      {/* Document health by type */}
      <Card className="mb-6">
        <CardHeader title="Document health by type" subtitle="Share of each status per document type" />
        <div className="space-y-4 px-5 py-5">
          {data.byType.map((t) => {
            const counts = {
              valid: +t.valid, expiring: +t.expiring, expired: +t.expired,
              pending: +t.pending, missing: +t.missing,
            };
            const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
            return (
              <div key={t.type} className="flex items-center gap-4">
                <p className="w-44 shrink-0 truncate text-xs font-medium text-slate-600" title={t.type}>{t.type}</p>
                <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  {SEGMENTS.map((s) =>
                    counts[s.key] > 0 && (
                      <div
                        key={s.key}
                        className={clsx('h-full', s.cls)}
                        style={{ width: `${(counts[s.key] / total) * 100}%` }}
                        title={`${s.label}: ${counts[s.key]}`}
                      />
                    )
                  )}
                </div>
                <p className="w-10 shrink-0 text-right text-xs font-semibold text-ink">{total}</p>
              </div>
            );
          })}
          {!data.byType.length && <p className="py-4 text-center text-sm text-slate-400">No documents recorded</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
            {SEGMENTS.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className={clsx('h-2 w-2 rounded-sm', s.dot)} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Requires attention */}
      <Card>
        <CardHeader
          title="Requires attention"
          subtitle={`${rows.length} document${rows.length === 1 ? '' : 's'} — sorted worst first`}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidate…"
                className={clsx(inputCls, 'w-52 py-1.5 pl-8 text-xs')}
              />
            </div>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          {FILTERS.map((f) => {
            const count = f.key === 'all'
              ? data.attention.length
              : data.attention.filter((d) => d.status === f.key).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                  active
                    ? 'bg-brand-500 text-white ring-brand-500'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                )}
              >
                {f.label} · {count}
              </button>
            );
          })}
        </div>

        {rows.length ? (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-3 py-3">Document</th>
                  <th className="px-3 py-3">Reference</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Expiry</th>
                  <th className="px-3 py-3">Candidate status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={d.candidate_name} size="sm" />
                        <div className="min-w-0">
                          <Link
                            to={`/candidates/${d.candidate_id}`}
                            className="block truncate text-sm font-medium text-ink hover:text-brand-600"
                          >
                            {d.candidate_name}
                          </Link>
                          <p className="truncate text-[11px] text-slate-400">{d.candidate_role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-700">{d.type}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{d.reference_no ?? '—'}</td>
                    <td className="px-3 py-3"><Badge value={d.status} /></td>
                    <td className="px-3 py-3"><ExpiryCell date={d.expiry_date} /></td>
                    <td className="px-3 py-3">
                      {d.candidate_status ? <Badge value={d.candidate_status} /> : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {d.status === 'pending' && (
                        <button
                          disabled={busyId === d.id}
                          onClick={() => act(d, 'valid', true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {busyId === d.id ? 'Saving…' : 'Verify'}
                        </button>
                      )}
                      {d.status === 'missing' && (
                        <button
                          disabled={busyId === d.id}
                          onClick={() => act(d, 'pending')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <FileClock className="h-3.5 w-3.5" />
                          {busyId === d.id ? 'Saving…' : 'Mark requested'}
                        </button>
                      )}
                      {(d.status === 'expired' || d.status === 'expiring') && (
                        <button
                          disabled={busyId === d.id}
                          onClick={() => act(d, 'pending')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {busyId === d.id ? 'Saving…' : 'Re-request'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Nothing needs attention"
            hint={filter === 'all' && !search ? 'All compliance documents are in order.' : 'No documents match this filter.'}
          />
        )}
      </Card>
    </div>
  );
}
