import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, CalendarDays, CircleCheck, Clock3, Inbox, Mail,
  MapPin, Pencil, Phone, Plus, ShieldAlert, ShieldCheck, Star,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { ago, daysUntil, fmtDate, gbp2 } from '../lib/format';
import { Activity, Candidate, ComplianceDoc, Placement, PlacementStage, Shift, User } from '../lib/types';
import {
  Avatar, Badge, Card, CardHeader, EmptyState, Modal, Spinner,
  btnGhost, btnPrimary, fmtStatus, inputCls,
} from '../components/ui';
import { ActivityFeed } from '../components/ActivityFeed';

interface CandidateDetailData extends Candidate {
  documents: ComplianceDoc[];
  placements: Placement[];
  activities: Activity[];
  shifts: Shift[];
}

type Tab = 'overview' | 'compliance' | 'placements' | 'shifts' | 'activity';

const PLACEMENT_STAGES: PlacementStage[] = [
  'submitted', 'screening', 'compliance_check', 'interview', 'offer', 'placed', 'active', 'ended', 'rejected',
];
const DOC_TYPES = [
  'DBS Enhanced', 'NMC PIN', 'Right to Work', 'Passport/ID', 'Mandatory Training',
  'Practical Training', 'References', 'CV', 'Immunisation History', 'Proof of Address',
];
const DOC_STATUSES = ['pending', 'valid', 'expiring', 'expired', 'missing'];
const CANDIDATE_STATUSES = ['compliant', 'on_assignment', 'in_progress', 'dormant', 'do_not_use'];
const SHIFTS = ['days', 'nights', 'flexible'];
const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'sms'];

const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset';

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={clsx('block', full && 'col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(score, 100) / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">{score}%</span>
    </div>
  );
}

function Stars({ rating }: { rating: string | null }) {
  const v = rating ? parseFloat(rating) : 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={clsx('h-4 w-4', i <= Math.round(v) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
      ))}
      {rating && <span className="ml-1 text-xs font-medium text-slate-500">{v.toFixed(1)}</span>}
    </div>
  );
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CandidateDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<Tab>('overview');

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ status: '', email: '', phone: '', pay_min: '', pay_max: '', preferred_shift: '', owner_id: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const [showDoc, setShowDoc] = useState(false);
  const [docForm, setDocForm] = useState({ type: DOC_TYPES[0], status: 'pending', reference_no: '', issue_date: '', expiry_date: '' });

  const [actForm, setActForm] = useState({ type: 'note', subject: '', body: '' });
  const [postingAct, setPostingAct] = useState(false);

  const load = useCallback(() => {
    if (!id) { setNotFound(true); return; }
    api.get<CandidateDetailData>(`/candidates/${id}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => { setData(null); setNotFound(false); load(); }, [load]);
  useEffect(() => { api.get<User[]>('/users').then(setUsers).catch(() => {}); }, []);

  const backLink = (
    <Link to="/candidates" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600">
      <ArrowLeft className="h-4 w-4" /> Candidates
    </Link>
  );

  if (notFound) {
    return (
      <div>
        {backLink}
        <Card>
          <EmptyState icon={<Inbox className="h-5 w-5" />} title="Candidate not found" hint="This candidate may have been removed, or the link is incorrect." />
        </Card>
      </div>
    );
  }
  if (!data) return <Spinner label="Loading candidate…" />;

  const c = data;
  const full = `${c.first_name} ${c.last_name}`;
  const docsAttention = data.documents.filter((d) => d.status === 'expired' || d.status === 'missing').length;

  const openEdit = () => {
    setEditForm({
      status: c.status,
      email: c.email ?? '',
      phone: c.phone ?? '',
      pay_min: c.pay_min ?? '',
      pay_max: c.pay_max ?? '',
      preferred_shift: c.preferred_shift ?? '',
      owner_id: c.owner_id ? String(c.owner_id) : '',
      notes: c.notes ?? '',
    });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/candidates/${id}`, {
        status: editForm.status,
        email: editForm.email || null,
        phone: editForm.phone || null,
        pay_min: editForm.pay_min || null,
        pay_max: editForm.pay_max || null,
        preferred_shift: editForm.preferred_shift || null,
        owner_id: editForm.owner_id ? +editForm.owner_id : null,
        notes: editForm.notes || null,
      });
      setShowEdit(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    await api.patch(`/candidates/${id}`, { notes: notesDraft || null });
    setEditingNotes(false);
    load();
  };

  const addDoc = async () => {
    setSaving(true);
    try {
      await api.post(`/candidates/${id}/documents`, {
        type: docForm.type,
        status: docForm.status,
        reference_no: docForm.reference_no || null,
        issue_date: docForm.issue_date || null,
        expiry_date: docForm.expiry_date || null,
      });
      setShowDoc(false);
      setDocForm({ type: DOC_TYPES[0], status: 'pending', reference_no: '', issue_date: '', expiry_date: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const markVerified = (docId: number) =>
    api.patch(`/compliance/documents/${docId}`, { status: 'valid', verified_by: 5 }).then(load);

  const advanceStage = (placementId: number, stage: string) =>
    api.patch(`/placements/${placementId}`, { stage }).then(load);

  const postActivity = async () => {
    setPostingAct(true);
    try {
      await api.post(`/candidates/${id}/activities`, {
        type: actForm.type,
        subject: actForm.subject || null,
        body: actForm.body || null,
        user_id: 2,
      });
      setActForm({ type: 'note', subject: '', body: '' });
      load();
    } finally {
      setPostingAct(false);
    }
  };

  const statCards = [
    { label: 'Placements', value: String(data.placements.length), icon: Briefcase },
    { label: 'Shifts', value: String(data.shifts.length), icon: CalendarDays },
    { label: 'Docs Attention', value: String(docsAttention), icon: ShieldAlert, alert: docsAttention > 0 },
    { label: 'Last Worked', value: c.last_worked_at ? ago(c.last_worked_at) : 'Never', icon: Clock3 },
  ];

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'compliance', label: 'Compliance', count: data.documents.length },
    { key: 'placements', label: 'Placements', count: data.placements.length },
    { key: 'shifts', label: 'Shifts', count: data.shifts.length },
    { key: 'activity', label: 'Activity', count: data.activities.length },
  ];

  const payRange = c.pay_min || c.pay_max
    ? `${gbp2(c.pay_min ?? c.pay_max)}${c.pay_min && c.pay_max ? ` – ${gbp2(c.pay_max)}` : ''} / hr`
    : '—';

  return (
    <div>
      {backLink}

      {/* Header card */}
      <Card className="mb-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-5">
            <Avatar name={full} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-ink">{full}</h1>
                <Badge value={c.status} />
                <span className={clsx(chip, 'bg-brand-50 text-brand-700 ring-brand-600/20')}>{c.role}</span>
                {c.nmc_pin && (
                  <span className={clsx(chip, 'bg-violet-50 text-violet-700 ring-violet-600/20')}>
                    <ShieldCheck className="h-3 w-3" /> NMC {c.nmc_pin}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
                {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</span>}
                {(c.town || c.postcode) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />{[c.town, c.postcode].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <Stars rating={c.rating} />
                {c.tags.map((t) => (
                  <span key={t} className={clsx(chip, 'bg-slate-100 text-slate-600 ring-slate-500/20')}>{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center">
              <ScoreRing score={c.compliance_score} />
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Compliance</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Avatar initials={c.owner_initials} color={c.owner_color} size="xs" />
                <span className="text-xs text-slate-600">{c.owner_name ?? 'Unassigned'}</span>
              </div>
              <p className="text-xs text-slate-400">Registered {fmtDate(c.registered_at)}</p>
              <button className={clsx(btnGhost, 'px-3 py-1.5 text-xs')} onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Compact stat row */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, alert }) => (
          <Card key={label} className={clsx('flex items-center gap-3 p-4', alert && 'ring-1 ring-red-200')}>
            <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', alert ? 'bg-red-50 text-red-500' : 'bg-brand-50 text-brand-600')}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{value}</p>
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-ink'
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader title="Details" subtitle="Pay, availability & preferences" />
            <dl className="divide-y divide-slate-50 px-5 py-2">
              <DetailRow label="Pay range" value={payRange} />
              <DetailRow label="Preferred shift" value={c.preferred_shift ? fmtStatus(c.preferred_shift) : '—'} />
              <DetailRow label="Employment" value={c.employment_pref ? fmtStatus(c.employment_pref) : '—'} />
              <DetailRow label="Travel" value={c.travel_miles != null ? `${c.travel_miles} miles` : '—'} />
              <DetailRow label="Transport" value={c.has_transport ? 'Yes' : 'No'} />
              <DetailRow label="Source" value={c.source ?? '—'} />
            </dl>
          </Card>
          <Card>
            <CardHeader
              title="Notes"
              action={!editingNotes ? (
                <button
                  onClick={() => { setNotesDraft(c.notes ?? ''); setEditingNotes(true); }}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              ) : undefined}
            />
            <div className="px-5 py-4">
              {editingNotes ? (
                <div>
                  <textarea
                    className={clsx(inputCls, 'min-h-28 resize-y')}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Add notes about this candidate…"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button className={clsx(btnGhost, 'px-3 py-1.5 text-xs')} onClick={() => setEditingNotes(false)}>Cancel</button>
                    <button className={clsx(btnPrimary, 'px-3 py-1.5 text-xs')} onClick={saveNotes}>Save</button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-600">{c.notes || 'No notes yet.'}</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Recent Activity"
              action={<button onClick={() => setTab('activity')} className="text-xs font-medium text-brand-600 hover:text-brand-700">View all</button>}
            />
            <div className="px-5 py-4">
              <ActivityFeed activities={data.activities.slice(0, 5)} />
            </div>
          </Card>
        </div>
      )}

      {/* Compliance */}
      {tab === 'compliance' && (
        <Card>
          <CardHeader
            title="Compliance Documents"
            subtitle="Right to work, DBS, training & registrations"
            action={<button className={clsx(btnPrimary, 'px-3 py-1.5 text-xs')} onClick={() => setShowDoc(true)}><Plus className="h-3.5 w-3.5" /> Add Document</button>}
          />
          {!data.documents.length ? (
            <EmptyState icon={<Inbox className="h-5 w-5" />} title="No documents on file" hint="Add compliance documents to get this candidate work-ready." />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Type</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">Verified by</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.documents.map((d) => {
                    const du = daysUntil(d.expiry_date);
                    return (
                      <tr key={d.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-medium text-ink">{d.type}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{d.reference_no ?? '—'}</td>
                        <td className="px-4 py-3"><Badge value={d.status} /></td>
                        <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(d.issue_date)}</td>
                        <td className={clsx(
                          'px-4 py-3 text-xs',
                          du != null && du < 0 ? 'font-medium text-red-600' : du != null && du <= 60 ? 'font-medium text-amber-600' : 'text-slate-600'
                        )}>
                          {fmtDate(d.expiry_date)}
                          {du != null && du < 0 && <span className="ml-1 text-[10px] uppercase">expired</span>}
                          {du != null && du >= 0 && du <= 60 && <span className="ml-1 text-[10px]">({du}d)</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{d.verified_by_name ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {(d.status === 'pending' || d.status === 'missing') && (
                            <button
                              onClick={() => markVerified(d.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              <CircleCheck className="h-3 w-3 text-emerald-500" /> Mark verified
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Placements */}
      {tab === 'placements' && (
        <Card>
          <CardHeader title="Placements" subtitle="Submissions and engagements for this candidate" />
          {!data.placements.length ? (
            <EmptyState icon={<Briefcase className="h-5 w-5" />} title="No placements yet" hint="Submit this candidate to an open vacancy to get started." />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Vacancy</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Pay / Charge</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Start date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.placements.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium">
                        {p.vacancy_id ? (
                          <Link to={`/vacancies/${p.vacancy_id}`} className="text-ink hover:text-brand-600">
                            {p.vacancy_title ?? 'Untitled vacancy'}
                          </Link>
                        ) : (
                          <span className="text-ink">{p.vacancy_title ?? 'Direct placement'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/clients/${p.client_id}`} className="text-xs text-slate-600 hover:text-brand-600">
                          {p.client_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge value={p.stage} />
                          <select
                            value={p.stage}
                            onChange={(e) => advanceStage(p.id, e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            title="Move stage"
                          >
                            {PLACEMENT_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {gbp2(p.pay_rate)}/hr · {gbp2(p.charge_rate)}/hr
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(p.submitted_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(p.start_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Shifts */}
      {tab === 'shifts' && (
        <Card>
          <CardHeader title="Shifts" subtitle="Recent booked and completed shifts" />
          {!data.shifts.length ? (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No shifts recorded" hint="Booked shifts for this candidate will appear here." />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Times</th>
                    <th className="px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Timesheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.shifts.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3 text-xs font-medium text-ink whitespace-nowrap">{fmtDate(s.shift_date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{s.client_name}</td>
                      <td className="px-4 py-3"><Badge value={s.shift_type} /></td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{Number(s.hours)}h</td>
                      <td className="px-4 py-3"><Badge value={s.status} /></td>
                      <td className="px-4 py-3"><Badge value={s.timesheet_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Activity */}
      {tab === 'activity' && (
        <div>
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={actForm.type}
                onChange={(e) => setActForm({ ...actForm, type: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{fmtStatus(t)}</option>)}
              </select>
              <input
                className={clsx(inputCls, 'min-w-56 flex-1')}
                placeholder="Subject…"
                value={actForm.subject}
                onChange={(e) => setActForm({ ...actForm, subject: e.target.value })}
              />
              <button
                className={clsx(btnPrimary, 'disabled:opacity-50')}
                disabled={postingAct || (!actForm.subject.trim() && !actForm.body.trim())}
                onClick={postActivity}
              >
                {postingAct ? 'Logging…' : 'Log activity'}
              </button>
            </div>
            <textarea
              className={clsx(inputCls, 'mt-2 min-h-20 resize-y')}
              placeholder="Details…"
              value={actForm.body}
              onChange={(e) => setActForm({ ...actForm, body: e.target.value })}
            />
          </Card>
          <Card>
            <div className="px-5 py-4">
              <ActivityFeed activities={data.activities} />
            </div>
          </Card>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit ${full}`} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className={inputCls} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              {CANDIDATE_STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Preferred shift">
            <select className={inputCls} value={editForm.preferred_shift} onChange={(e) => setEditForm({ ...editForm, preferred_shift: e.target.value })}>
              <option value="">Any</option>
              {SHIFTS.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          </Field>
          <Field label="Pay min (£/hr)">
            <input type="number" step="0.5" min="0" className={inputCls} value={editForm.pay_min} onChange={(e) => setEditForm({ ...editForm, pay_min: e.target.value })} />
          </Field>
          <Field label="Pay max (£/hr)">
            <input type="number" step="0.5" min="0" className={inputCls} value={editForm.pay_max} onChange={(e) => setEditForm({ ...editForm, pay_max: e.target.value })} />
          </Field>
          <Field label="Owner" full>
            <select className={inputCls} value={editForm.owner_id} onChange={(e) => setEditForm({ ...editForm, owner_id: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Notes" full>
            <textarea className={clsx(inputCls, 'min-h-20 resize-y')} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setShowEdit(false)}>Cancel</button>
          <button className={clsx(btnPrimary, 'disabled:opacity-50')} disabled={saving} onClick={saveEdit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </Modal>

      {/* Add document modal */}
      <Modal open={showDoc} onClose={() => setShowDoc(false)} title="Add Document">
        <div className="space-y-3">
          <Field label="Document type">
            <select className={inputCls} value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={docForm.status} onChange={(e) => setDocForm({ ...docForm, status: e.target.value })}>
              {DOC_STATUSES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Reference number">
            <input className={inputCls} value={docForm.reference_no} onChange={(e) => setDocForm({ ...docForm, reference_no: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date">
              <input type="date" className={inputCls} value={docForm.issue_date} onChange={(e) => setDocForm({ ...docForm, issue_date: e.target.value })} />
            </Field>
            <Field label="Expiry date">
              <input type="date" className={inputCls} value={docForm.expiry_date} onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setShowDoc(false)}>Cancel</button>
          <button className={clsx(btnPrimary, 'disabled:opacity-50')} disabled={saving} onClick={addDoc}>
            {saving ? 'Saving…' : 'Add Document'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
