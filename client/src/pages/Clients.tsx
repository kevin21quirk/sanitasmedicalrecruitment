import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, Building2, MapPin, BedDouble, Users, KanbanSquare, Briefcase,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { Client, User } from '../lib/types';
import {
  Badge, Card, Avatar, Spinner, EmptyState, Modal, PageHeader,
  inputCls, btnPrimary, btnGhost, fmtStatus,
} from '../components/ui';

const CLIENT_TYPES = ['Nursing Home', 'Residential Home', 'Dementia Care', 'Supported Living'];
const CQC_RATINGS = ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate'];
const STATUSES = ['active', 'prospect', 'inactive'];

const CQC_STYLES: Record<string, string> = {
  Outstanding: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Good: 'bg-brand-50 text-brand-700 ring-brand-600/20',
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

  return (
    <div>
      <PageHeader title="Care Homes" subtitle="Client organisations and referral partners">
        <button className={btnPrimary} onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-5 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={clsx(inputCls, 'pl-9')}
            placeholder="Search care homes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select className={clsx(inputCls, 'w-auto')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={clsx(inputCls, 'w-auto')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
        </select>
        <select className={clsx(inputCls, 'w-auto')} value={cqc} onChange={(e) => setCqc(e.target.value)}>
          <option value="">All CQC ratings</option>
          {CQC_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Card>

      {/* Grid */}
      {!clients ? (
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
                  <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
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
