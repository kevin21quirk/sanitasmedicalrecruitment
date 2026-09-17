import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Briefcase, ChevronLeft,
  ChevronRight, Clock3, Plus, Search, Star, UserCheck, UserPlus, Users,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDate, gbp2 } from '../lib/format';
import { Candidate, User } from '../lib/types';
import {
  Avatar, Badge, Card, ComplianceBar, EmptyState, Modal, PageHeader, Spinner,
  btnGhost, btnPrimary, fmtStatus, inputCls,
} from '../components/ui';

interface CandidateStats {
  total: string;
  compliant: string;
  on_assignment: string;
  in_progress: string;
  new_30d: string;
}

interface CandidateListResponse {
  data: Candidate[];
  total: number;
  page: number;
  limit: number;
}

const ROLES = ['Registered Nurse', 'Senior Nurse', 'Healthcare Assistant', 'Senior HCA'];
const SHIFTS = ['days', 'nights', 'flexible'];
const SOURCES = ['Website', 'Referral', 'Indeed', 'Reed', 'Facebook', 'Word of Mouth'];
const STATUSES = ['compliant', 'on_assignment', 'in_progress', 'dormant'];
const LIMIT = 20;

const selectCls =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const emptyForm = {
  first_name: '', last_name: '', email: '', phone: '',
  role: ROLES[0], town: '', preferred_shift: '', source: '', owner_id: '',
};

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={clsx('block', full && 'col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function SortableTh({ label, col, sort, dir, onSort }: {
  label: string; col: string; sort: string; dir: 'asc' | 'desc'; onSort: (col: string) => void;
}) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <button onClick={() => onSort(col)} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        {sort === col
          ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 text-slate-300" />}
      </button>
    </th>
  );
}

function Th({ label }: { label: string }) {
  return <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</th>;
}

export default function Candidates() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [compliance, setCompliance] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { api.get<CandidateStats>('/candidates/stats').then(setStats).catch(() => {}); }, []);
  useEffect(() => { api.get<User[]>('/users').then(setUsers).catch(() => {}); }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (compliance) params.set('compliance', compliance);
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    params.set('sort', sort);
    params.set('dir', dir);
    api.get<CandidateListResponse>(`/candidates?${params.toString()}`)
      .then((r) => { setRows(r.data); setTotal(r.total); })
      .catch(() => setRows([]));
  };
  useEffect(load, [debouncedSearch, role, status, compliance, page, sort, dir]);

  const toggleSort = (col: string) => {
    if (sort === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setDir(col === 'name' ? 'asc' : 'desc'); }
  };

  const refreshStats = () => api.get<CandidateStats>('/candidates/stats').then(setStats).catch(() => {});

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/candidates', {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
        town: form.town || null,
        preferred_shift: form.preferred_shift || null,
        source: form.source || null,
        owner_id: form.owner_id ? +form.owner_id : null,
      });
      setShowAdd(false);
      setForm(emptyForm);
      load();
      refreshStats();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const statCards = [
    { label: 'Total Candidates', value: stats?.total ?? '—', icon: Users },
    { label: 'Compliant', value: stats?.compliant ?? '—', icon: UserCheck },
    { label: 'On Assignment', value: stats?.on_assignment ?? '—', icon: Briefcase },
    { label: 'In Progress', value: stats?.in_progress ?? '—', icon: Clock3 },
    { label: 'New (30 days)', value: stats?.new_30d ?? '—', icon: UserPlus },
  ];

  return (
    <div>
      <PageHeader title="Candidates" subtitle="Nurses and healthcare assistants on the Sanitas books.">
        <button className={btnPrimary} onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Candidate
        </button>
      </PageHeader>

      {/* Stats strip */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
            <p className="text-xs font-medium text-slate-600">{label}</p>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, town, NMC PIN…"
            className={clsx(inputCls, 'pl-9')}
          />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
        </select>
        <select value={compliance} onChange={(e) => { setCompliance(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All compliance</option>
          <option value="compliant">Compliant (≥80%)</option>
          <option value="attention">Needs attention (&lt;80%)</option>
        </select>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {rows === null ? (
          <Spinner label="Loading candidates…" />
        ) : !rows.length ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No candidates found" hint="Try adjusting your search or filters." />
        ) : (
          <>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <SortableTh label="Name" col="name" sort={sort} dir={dir} onSort={toggleSort} />
                    <Th label="Contact" />
                    <Th label="Location" />
                    <Th label="Status" />
                    <SortableTh label="Compliance" col="compliance" sort={sort} dir={dir} onSort={toggleSort} />
                    <Th label="Rate" />
                    <Th label="Rating" />
                    <Th label="Owner" />
                    <SortableTh label="Registered" col="created_at" sort={sort} dir={dir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((c) => {
                    const full = `${c.first_name} ${c.last_name}`;
                    const attention = Number(c.docs_attention ?? 0) > 0;
                    return (
                      <tr key={c.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link to={`/candidates/${c.id}`} className="group flex items-center gap-3">
                            <Avatar name={full} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink group-hover:text-brand-600">{full}</p>
                              <p className="truncate text-xs text-slate-500">{c.role}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <p className="truncate text-xs text-slate-600">{c.email ?? '—'}</p>
                          <p className="truncate text-xs text-slate-400">{c.phone ?? ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-600">{c.town ?? '—'}</p>
                          <p className="text-xs text-slate-400">{c.postcode ?? ''}</p>
                        </td>
                        <td className="px-4 py-3"><Badge value={c.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <ComplianceBar score={c.compliance_score} />
                            {attention && <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-label="Documents need attention" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {c.pay_min || c.pay_max
                            ? `${gbp2(c.pay_min ?? c.pay_max)}${c.pay_min && c.pay_max ? `–${gbp2(c.pay_max)}` : ''}/hr`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.rating ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {Number(c.rating).toFixed(1)}
                            </span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {c.owner_name ? (
                            <span className="flex items-center gap-2">
                              <Avatar initials={c.owner_initials} color={c.owner_color} size="xs" />
                              <span className="text-xs text-slate-600">{c.owner_name}</span>
                            </span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(c.registered_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                {total} candidate{total === 1 ? '' : 's'} · Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  className={clsx(btnGhost, 'px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40')}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  className={clsx(btnGhost, 'px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40')}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Add candidate modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Candidate" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Town">
            <input className={inputCls} value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} />
          </Field>
          <Field label="Preferred shift">
            <select className={inputCls} value={form.preferred_shift} onChange={(e) => setForm({ ...form, preferred_shift: e.target.value })}>
              <option value="">Any</option>
              {SHIFTS.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="">Unknown</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Owner" full>
            <select className={inputCls} value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        {formError && <p className="mt-3 text-xs font-medium text-red-600">{formError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setShowAdd(false)}>Cancel</button>
          <button
            className={clsx(btnPrimary, 'disabled:opacity-50')}
            disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
            onClick={submit}
          >
            {saving ? 'Saving…' : 'Add Candidate'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
