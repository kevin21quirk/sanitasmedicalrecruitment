import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, Globe, BedDouble, Receipt,
  Pencil, Star, Plus, Users, KanbanSquare, Briefcase, CalendarDays,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDate, gbp2 } from '../lib/format';
import { Activity, Client, ClientContact, Placement, Shift, User, Vacancy } from '../lib/types';
import {
  Badge, Card, CardHeader, Avatar, Spinner, EmptyState, Modal,
  inputCls, btnPrimary, btnGhost, fmtStatus,
} from '../components/ui';
import { ActivityFeed } from '../components/ActivityFeed';

interface ClientDetailData extends Client {
  contacts: ClientContact[];
  vacancies: Vacancy[];
  placements: Placement[];
  activities: Activity[];
  shifts: Shift[];
}

const TABS = ['Overview', 'Contacts', 'Vacancies', 'Workers', 'Shifts', 'Activity'] as const;
type Tab = (typeof TABS)[number];

const STATUSES = ['active', 'prospect', 'inactive'];
const CQC_RATINGS = ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate'];

const CQC_STYLES: Record<string, string> = {
  Outstanding: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Good: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  'Requires Improvement': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Inadequate: 'bg-red-50 text-red-700 ring-red-600/20',
};

const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
const thCls = 'px-5 py-2.5';
const tdCls = 'px-5 py-3';

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

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {cols.map((c) => <th key={c} className={thCls}>{c}</th>)}
      </tr>
    </thead>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState<ClientDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('Overview');
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({
    status: '', phone: '', email: '', cqc_rating: '', account_manager_id: '', notes: '',
  });

  // contact modal
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState({ name: '', role: '', email: '', phone: '', is_primary: false });

  // activity composer
  const [act, setAct] = useState({ type: 'note', subject: '', body: '' });
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    api.get<ClientDetailData>(`/clients/${id}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<User[]>('/users').then(setUsers).catch(() => {}); }, []);

  const openEdit = () => {
    if (!data) return;
    setEdit({
      status: data.status,
      phone: data.phone ?? '',
      email: data.email ?? '',
      cqc_rating: data.cqc_rating ?? '',
      account_manager_id: data.account_manager_id ? String(data.account_manager_id) : '',
      notes: data.notes ?? '',
    });
    setSaveError('');
    setEditOpen(true);
  };

  const updEdit = (k: keyof typeof edit) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEdit((f) => ({ ...f, [k]: e.target.value }));

  const updContact = (k: 'name' | 'role' | 'email' | 'phone') =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setContact((f) => ({ ...f, [k]: e.target.value }));

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await api.patch(`/clients/${id}`, {
        status: edit.status,
        phone: edit.phone.trim() || null,
        email: edit.email.trim() || null,
        cqc_rating: edit.cqc_rating || null,
        account_manager_id: edit.account_manager_id ? Number(edit.account_manager_id) : null,
        notes: edit.notes.trim() || null,
      });
      setEditOpen(false);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addContact = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/clients/${id}/contacts`, {
        name: contact.name.trim(),
        role: contact.role.trim() || null,
        email: contact.email.trim() || null,
        phone: contact.phone.trim() || null,
        is_primary: contact.is_primary,
      });
      setContactOpen(false);
      setContact({ name: '', role: '', email: '', phone: '', is_primary: false });
      load();
    } finally {
      setSaving(false);
    }
  };

  const postActivity = async (e: FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      await api.post(`/clients/${id}/activities`, {
        type: act.type,
        subject: act.subject.trim(),
        body: act.body.trim() || null,
        user_id: 2,
      });
      setAct({ type: 'note', subject: '', body: '' });
      load();
    } finally {
      setPosting(false);
    }
  };

  const backLink = (
    <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600">
      <ArrowLeft className="h-4 w-4" /> Care Homes
    </Link>
  );

  if (notFound) {
    return (
      <div>
        {backLink}
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="Care home not found"
            hint="It may have been removed or the link is invalid."
          />
        </Card>
      </div>
    );
  }
  if (!data) return <Spinner label="Loading care home…" />;

  const tabCounts: Partial<Record<Tab, number>> = {
    Contacts: data.contacts.length,
    Vacancies: data.vacancies.length,
    Workers: data.placements.length,
    Shifts: data.shifts.length,
    Activity: data.activities.length,
  };

  const stats = [
    {
      label: 'Open vacancies',
      value: data.open_vacancies ?? data.vacancies.filter((v) => !['filled', 'lost'].includes(v.stage)).length,
      icon: KanbanSquare,
    },
    {
      label: 'Active workers',
      value: data.active_workers ?? data.placements.filter((p) => ['placed', 'active'].includes(p.stage)).length,
      icon: Briefcase,
    },
    { label: 'Total shifts', value: data.shifts.length, icon: CalendarDays },
  ];

  const address = [data.address, data.town, data.postcode].filter(Boolean).join(', ');

  return (
    <div>
      {backLink}

      {/* Header card */}
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold text-ink">{data.name}</h1>
              {data.group_name && <p className="mt-0.5 text-xs text-slate-500">Part of {data.group_name}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge value={data.status} />
                <Badge value={data.type} />
                {data.cqc_rating && <CqcChip rating={data.cqc_rating} />}
              </div>
            </div>
          </div>
          <button className={btnGhost} onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
          {address && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />{address}
            </span>
          )}
          {data.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />{data.phone}
            </span>
          )}
          {data.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />{data.email}
            </span>
          )}
          {data.website && (
            <a href={data.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-600 hover:underline">
              <Globe className="h-3.5 w-3.5" />{data.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {data.beds != null && (
            <span className="flex items-center gap-1.5">
              <BedDouble className="h-3.5 w-3.5 text-slate-400" />{data.beds} beds
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-slate-400" />Net {data.payment_terms} days
          </span>
          <span className="flex items-center gap-1.5">
            <Avatar initials={data.am_initials} color={data.am_color} name={data.am_name} size="xs" />
            {data.am_name ?? 'Unassigned'}
          </span>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {t}
            {tabCounts[t] != null && <span className="ml-1 text-xs text-slate-400">({tabCounts[t]})</span>}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <Card>
              <CardHeader title="Details" subtitle="Organisation information" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3">
                <Detail label="Type">{data.type}</Detail>
                <Detail label="Status"><Badge value={data.status} /></Detail>
                <Detail label="CQC rating">{data.cqc_rating ? <CqcChip rating={data.cqc_rating} /> : '—'}</Detail>
                <Detail label="Beds">{data.beds ?? '—'}</Detail>
                <Detail label="Payment terms">Net {data.payment_terms} days</Detail>
                <Detail label="Group">{data.group_name ?? '—'}</Detail>
                <Detail label="Account manager">{data.am_name ?? 'Unassigned'}</Detail>
                <Detail label="Client since">{fmtDate(data.created_at)}</Detail>
                <Detail label="Address">{address || '—'}</Detail>
              </dl>
            </Card>
            <Card>
              <CardHeader title="Notes" />
              <div className="px-5 py-4">
                {data.notes
                  ? <p className="whitespace-pre-wrap text-sm text-slate-600">{data.notes}</p>
                  : <p className="text-sm text-slate-400">No notes recorded.</p>}
              </div>
            </Card>
          </div>
          <div className="space-y-5">
            <Card>
              <CardHeader title="At a glance" />
              <div className="divide-y divide-slate-50">
                {stats.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-lg font-bold leading-tight text-ink">{value}</p>
                      <p className="text-[11px] text-slate-500">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Recent Activity" subtitle="Latest touchpoints" />
              <div className="scroll-thin max-h-96 overflow-y-auto px-5 py-4">
                <ActivityFeed activities={data.activities.slice(0, 5)} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Contacts */}
      {tab === 'Contacts' && (
        <Card>
          <CardHeader
            title="Contacts"
            subtitle="Key people at this organisation"
            action={
              <button className={btnPrimary} onClick={() => setContactOpen(true)}>
                <Plus className="h-4 w-4" /> Add Contact
              </button>
            }
          />
          {data.contacts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHead cols={['Name', 'Role', 'Email', 'Phone', 'Primary']} />
                <tbody className="divide-y divide-slate-50">
                  {data.contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className={clsx(tdCls, 'font-medium text-ink')}>{c.name}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{c.role ?? '—'}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{c.email ?? '—'}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{c.phone ?? '—'}</td>
                      <td className={tdCls}>
                        {c.is_primary && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Users className="h-5 w-5" />} title="No contacts" hint="Add the home manager or rota coordinator." />
          )}
        </Card>
      )}

      {/* Vacancies */}
      {tab === 'Vacancies' && (
        <Card>
          <CardHeader title="Vacancies" subtitle="Roles at this care home" />
          {data.vacancies.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHead cols={['Title', 'Role', 'Shift Pattern', 'Pay', 'Charge', 'Stage', 'Priority', 'Submissions']} />
                <tbody className="divide-y divide-slate-50">
                  {data.vacancies.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className={tdCls}>
                        <Link to={`/vacancies/${v.id}`} className="font-medium text-brand-600 hover:underline">
                          {v.title}
                        </Link>
                        {v.owner_name && <p className="text-[11px] text-slate-400">{v.owner_name}</p>}
                      </td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{v.role}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{v.shift_pattern ?? '—'}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{gbp2(v.pay_rate)}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{gbp2(v.charge_rate)}</td>
                      <td className={tdCls}><Badge value={v.stage} /></td>
                      <td className={tdCls}><Badge value={v.priority} /></td>
                      <td className={clsx(tdCls, 'text-center text-slate-600')}>{v.submissions ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<KanbanSquare className="h-5 w-5" />} title="No vacancies" hint="Roles for this home will appear here." />
          )}
        </Card>
      )}

      {/* Workers */}
      {tab === 'Workers' && (
        <Card>
          <CardHeader title="Workers" subtitle="Candidate placements at this home" />
          {data.placements.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHead cols={['Candidate', 'Role', 'Stage', 'Start Date', 'Pay', 'Charge']} />
                <tbody className="divide-y divide-slate-50">
                  {data.placements.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className={tdCls}>
                        <Link to={`/candidates/${p.candidate_id}`} className="font-medium text-brand-600 hover:underline">
                          {p.candidate_name ?? `Candidate #${p.candidate_id}`}
                        </Link>
                      </td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{p.candidate_role ?? '—'}</td>
                      <td className={tdCls}><Badge value={p.stage} /></td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{fmtDate(p.start_date)}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{gbp2(p.pay_rate)}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{gbp2(p.charge_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Briefcase className="h-5 w-5" />} title="No workers" hint="Placed candidates will appear here." />
          )}
        </Card>
      )}

      {/* Shifts */}
      {tab === 'Shifts' && (
        <Card>
          <CardHeader title="Shifts" subtitle="Booked and completed shifts at this home" />
          {data.shifts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHead cols={['Date', 'Candidate', 'Type', 'Hours', 'Status', 'Timesheet']} />
                <tbody className="divide-y divide-slate-50">
                  {data.shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className={clsx(tdCls, 'font-medium text-ink')}>{fmtDate(s.shift_date)}</td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{s.candidate_name ?? '—'}</td>
                      <td className={tdCls}><Badge value={s.shift_type} /></td>
                      <td className={clsx(tdCls, 'text-slate-600')}>{s.hours}h</td>
                      <td className={tdCls}><Badge value={s.status} /></td>
                      <td className={tdCls}><Badge value={s.timesheet_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No shifts" hint="Shifts at this home will appear here." />
          )}
        </Card>
      )}

      {/* Activity */}
      {tab === 'Activity' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="h-fit">
            <CardHeader title="Log Activity" subtitle="Call, email, meeting or note" />
            <form onSubmit={postActivity} className="space-y-3 px-5 py-4">
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={act.type} onChange={(e) => setAct({ ...act, type: e.target.value })}>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="note">Note</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Subject *</label>
                <input
                  required
                  className={inputCls}
                  value={act.subject}
                  onChange={(e) => setAct({ ...act, subject: e.target.value })}
                  placeholder="e.g. Booking confirmation call"
                />
              </div>
              <div>
                <label className={labelCls}>Details</label>
                <textarea
                  rows={4}
                  className={inputCls}
                  value={act.body}
                  onChange={(e) => setAct({ ...act, body: e.target.value })}
                  placeholder="Notes from the conversation…"
                />
              </div>
              <button type="submit" className={btnPrimary} disabled={posting}>
                {posting ? 'Saving…' : 'Log Activity'}
              </button>
            </form>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader title="Activity History" subtitle={`${data.activities.length} entries`} />
            <div className="scroll-thin max-h-[560px] overflow-y-auto px-5 py-4">
              <ActivityFeed activities={data.activities} />
            </div>
          </Card>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Client">
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={edit.status} onChange={updEdit('status')}>
              {STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={edit.phone} onChange={updEdit('phone')} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={edit.email} onChange={updEdit('email')} />
          </div>
          <div>
            <label className={labelCls}>CQC rating</label>
            <select className={inputCls} value={edit.cqc_rating} onChange={updEdit('cqc_rating')}>
              <option value="">Not rated</option>
              {CQC_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Account manager</label>
            <select className={inputCls} value={edit.account_manager_id} onChange={updEdit('account_manager_id')}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={4} className={inputCls} value={edit.notes} onChange={updEdit('notes')} />
          </div>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setEditOpen(false)}>Cancel</button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add contact modal */}
      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="Add Contact">
        <form onSubmit={addContact} className="space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input required className={inputCls} value={contact.name} onChange={updContact('name')} placeholder="e.g. Jane Cooper" />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <input className={inputCls} value={contact.role} onChange={updContact('role')} placeholder="e.g. Home Manager" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={contact.email} onChange={updContact('email')} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={contact.phone} onChange={updContact('phone')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/30"
              checked={contact.is_primary}
              onChange={(e) => setContact((f) => ({ ...f, is_primary: e.target.checked }))}
            />
            Primary contact
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setContactOpen(false)}>Cancel</button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Add Contact'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
