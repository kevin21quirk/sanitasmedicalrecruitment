import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Building2, MapPin, BedDouble, Users, KanbanSquare, Briefcase, LayoutGrid, List,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { Client, User } from '../lib/types';
import {
  Badge, Card, Avatar, Spinner, EmptyState, Modal, PageHeader, FilterTh, SortTh, Pagination, useLocalGrid,
  inputCls, btnPrimary, btnGhost, fmtStatus,
} from '../components/ui';

const CLIENT_TYPES = ['Nursing Home', 'Residential Home', 'Dementia Care', 'Supported Living'];
const CQC_RATINGS = ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate'];
const STATUSES = ['active', 'prospect', 'inactive'];

const CQC_STYLES: Record<string, string> = {
  Outstanding: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Good: 'bg-brand-500/10 text-brand-700 ring-brand-600/20',
  'Requires Improvement': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Inadequate: 'bg-red-50 text-red-700 ring-red-600/20',
};

const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function CqcChip({ rating }: { rating: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
      CQC_STYLES[rating] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
    )}>
      CQC {rating}
    </span>
  );
}

interface ClientForm {
  name: string;
  group_name: string;
  type: string;
  town: string;
  postcode: string;
  phone: string;
  email: string;
  beds: string;
  cqc_rating: string;
  account_manager_id: string;
}

const EMPTY_FORM: ClientForm = {
  name: '', group_name: '', type: 'Nursing Home', town: '', postcode: '',
  phone: '', email: '', beds: '', cqc_rating: '', account_manager_id: '',
};

export default function Clients() {
  const navigate = useNavigate();
  const [view, setView] = useState<'grid' | 'cards'>('grid');
  const [townFilter, setTownFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'town' | 'beds' | 'active_workers'>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [clients, setClients] = useState<Client[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [cqc, setCqc] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (cqc) params.set('cqc', cqc);
    const qs = params.toString();
    api.get<Client[]>(`/clients${qs ? `?${qs}` : ''}`).then(setClients).catch(() => setClients([]));
  }, [search, type, status, cqc]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<User[]>('/users').then(setUsers).catch(() => {}); }, []);

  const upd = (k: keyof ClientForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/clients', {
        name: form.name.trim(),
        group_name: form.group_name.trim() || null,
        type: form.type,
        town: form.town.trim() || null,
        postcode: form.postcode.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        beds: form.beds ? Number(form.beds) : null,
        cqc_rating: form.cqc_rating || null,
        account_manager_id: form.account_manager_id ? Number(form.account_manager_id) : null,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  const filtered = (clients ?? [])
    .filter((c) => !townFilter || (c.town ?? '').toLowerCase().includes(townFilter.toLowerCase()))
    .sort((a, b) => {
      const av = a[sort] ?? '', bv = b[sort] ?? '';
      const cmp = typeof av === 'number' || !isNaN(+av) && !isNaN(+bv) && av !== '' && bv !== ''
        ? +av - +bv : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  const grid = useLocalGrid(filtered, { pageSize: 10 });
  const toggleSort = (col: string) => {
    const c = col as typeof sort;
    if (sort === c) setDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSort(c); setDir('asc'); }
  };

  return (
    <div>
      <PageHeader eyebrow="Recruitment" title="Care Homes" subtitle="Client organisations and referral partners">
        <div className="hidden items-center gap-0.5 rounded-xl bg-slate-900/5 p-1 sm:flex">
          <button onClick={() => setView('grid')} className={clsx('rounded-lg p-1.5', view === 'grid' ? 'bg-white text-ink shadow-sm' : 'text-slate-500')} title="Grid"><List className="h-4 w-4" /></button>
          <button onClick={() => setView('cards')} className={clsx('rounded-lg p-1.5', view === 'cards' ? 'bg-white text-ink shadow-sm' : 'text-slate-500')} title="Cards"><LayoutGrid className="h-4 w-4" /></button>
        </div>
        <button className={btnPrimary} onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </PageHeader>

      {view === 'grid' ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/60 px-4 py-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={clsx(inputCls, 'pl-9')} placeholder="Search care homes…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <select className={clsx(inputCls, 'w-auto')} value={cqc} onChange={(e) => setCqc(e.target.value)}>
              <option value="">All CQC ratings</option>
              {CQC_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="text-xs text-slate-400">{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
          </div>
          {!clients ? <Spinner label="Loading care homes…" /> : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="grid-head">
                  <tr className="border-b border-slate-200/60">
                    <SortTh label="Care home" col="name" sort={sort} dir={dir} onSort={toggleSort} className="min-w-60" />
                    <SortTh label="Type" />
                    <SortTh label="Location" col="town" sort={sort} dir={dir} onSort={toggleSort} />
                    <SortTh label="CQC" />
                    <SortTh label="Beds" col="beds" sort={sort} dir={dir} onSort={toggleSort} />
                    <SortTh label="Contacts" />
                    <SortTh label="Vacancies" />
                    <SortTh label="Workers" col="active_workers" sort={sort} dir={dir} onSort={toggleSort} />
                    <SortTh label="Account manager" />
                    <SortTh label="Status" />
                  </tr>
                  <tr className="border-b border-slate-200/60">
                    <FilterTh value={searchInput} onChange={setSearchInput} placeholder="Search name…" />
                    <FilterTh value={type} onChange={setType} options={CLIENT_TYPES.map((t) => ({ value: t, label: t }))} />
                    <FilterTh value={townFilter} onChange={setTownFilter} placeholder="Town…" />
                    <th /><th /><th /><th /><th /><th />
                    <FilterTh value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: fmtStatus(s) }))} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50">
                  {grid.slice.map((c) => (
                    <tr key={c.id} className="grid-row cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                      <td className="px-4 py-2.5">
                        <Link to={`/clients/${c.id}`} className="group flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          {c.logo_file_id
                            ? <Avatar name={c.name} photoId={c.logo_file_id} size="sm" square />
                            : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600"><Building2 className="h-4 w-4" /></span>}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink group-hover:text-brand-600">{c.name}</p>
                            {c.group_name && <p className="truncate text-[11px] text-slate-400">{c.group_name}</p>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{c.type}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{[c.town, c.postcode].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-4 py-2.5">{c.cqc_rating ? <CqcChip rating={c.cqc_rating} /> : <span className="text-xs text-slate-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{c.beds ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{c.contact_count ?? 0}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{c.open_vacancies ?? 0}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{c.active_workers ?? 0}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <Avatar initials={c.am_initials} color={c.am_color} name={c.am_name} size="xs" />
                          <span className="truncate text-xs text-slate-600">{c.am_name ?? 'Unassigned'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><Badge value={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && <EmptyState icon={<Building2 className="h-5 w-5" />} title="No care homes found" hint="Try adjusting the filters or add a new client." />}
            </div>
          )}
          {clients && <Pagination page={grid.page} pages={grid.pages} total={grid.total} limit={grid.limit} onPage={grid.setPage} onLimit={grid.setLimit} label="care homes" />}
        </Card>
      ) : !clients ? (
        <Spinner label="Loading care homes…" />
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No care homes found"
            hint="Try adjusting the filters or add a new client."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} to={`/clients/${c.id}`} className="group">
              <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-[15px] font-semibold text-ink group-hover:text-brand-600">
                      {c.name}
                    </h3>
                    {c.group_name && <p className="truncate text-[11px] text-slate-400">{c.group_name}</p>}
                  </div>
                  <Badge value={c.status} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge value={c.type} />
                  {c.cqc_rating && <CqcChip rating={c.cqc_rating} />}
                </div>

                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{[c.town, c.postcode].filter(Boolean).join(', ') || 'No location'}</span>
                </p>

                <div className="mt-auto">
                  <div className="mt-4 flex items-center gap-4 border-t border-slate-200/60 pt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1" title="Beds">
                      <BedDouble className="h-3.5 w-3.5 text-slate-400" />{c.beds ?? '—'}
                    </span>
                    <span className="flex items-center gap-1" title="Contacts">
                      <Users className="h-3.5 w-3.5 text-slate-400" />{c.contact_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1" title="Open vacancies">
                      <KanbanSquare className="h-3.5 w-3.5 text-slate-400" />{c.open_vacancies ?? 0}
                    </span>
                    <span className="flex items-center gap-1" title="Active workers">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />{c.active_workers ?? 0}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar initials={c.am_initials} color={c.am_color} name={c.am_name} size="xs" />
                    <span className="truncate text-[11px] text-slate-500">{c.am_name ?? 'Unassigned'}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add client modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Client" wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Home name *</label>
            <input required className={inputCls} value={form.name} onChange={upd('name')} placeholder="e.g. Meadowview Care Home" />
          </div>
          <div>
            <label className={labelCls}>Group</label>
            <input className={inputCls} value={form.group_name} onChange={upd('group_name')} placeholder="e.g. Barchester" />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={form.type} onChange={upd('type')}>
              {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Town</label>
            <input className={inputCls} value={form.town} onChange={upd('town')} />
          </div>
          <div>
            <label className={labelCls}>Postcode</label>
            <input className={inputCls} value={form.postcode} onChange={upd('postcode')} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone} onChange={upd('phone')} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={upd('email')} />
          </div>
          <div>
            <label className={labelCls}>Beds</label>
            <input type="number" min={0} className={inputCls} value={form.beds} onChange={upd('beds')} />
          </div>
          <div>
            <label className={labelCls}>CQC rating</label>
            <select className={inputCls} value={form.cqc_rating} onChange={upd('cqc_rating')}>
              <option value="">Not rated</option>
              {CQC_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Account manager</label>
            <select className={inputCls} value={form.account_manager_id} onChange={upd('account_manager_id')}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className={btnGhost} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
