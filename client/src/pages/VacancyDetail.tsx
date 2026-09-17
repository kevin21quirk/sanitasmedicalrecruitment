import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, ChevronDown, ChevronUp, PencilLine,
  ShieldCheck, UserPlus, Users,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { ago, fmtDate, gbp2 } from '../lib/format';
import type {
  Activity, Candidate, Placement, PlacementStage, Vacancy, VacancyStage,
} from '../lib/types';
import {
  Avatar, Badge, btnGhost, btnPrimary, Card, CardHeader, ComplianceBar,
  EmptyState, fmtStatus, inputCls, Modal, Spinner,
} from '../components/ui';
import { ActivityFeed } from '../components/ActivityFeed';

type PipelinePlacement = Placement & { compliance_score?: number };

interface DetailResponse extends Partial<Vacancy> {
  vacancy?: Vacancy;
  pipeline?: PipelinePlacement[];
  activities?: Activity[];
}

const VACANCY_STAGES: VacancyStage[] = [
  'open', 'sourcing', 'shortlisted', 'interview', 'offer', 'filled', 'on_hold', 'lost',
];

const PIPELINE_GROUPS: { label: string; stages: PlacementStage[] }[] = [
  { label: 'Submitted', stages: ['submitted'] },
  { label: 'Screening', stages: ['screening'] },
  { label: 'Compliance Check', stages: ['compliance_check'] },
  { label: 'Interview', stages: ['interview'] },
  { label: 'Offer', stages: ['offer'] },
  { label: 'Placed / Active', stages: ['placed', 'active'] },
];
const CLOSED_PLACEMENT_STAGES: PlacementStage[] = ['ended', 'rejected'];
const ALL_PLACEMENT_STAGES: PlacementStage[] = [
  'submitted', 'screening', 'compliance_check', 'interview', 'offer',
  'placed', 'active', 'ended', 'rejected',
];

const CQC_STYLES: Record<string, string> = {
  outstanding: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'requires improvement': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  inadequate: 'bg-red-50 text-red-700 ring-red-600/20',
};

const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'sms'] as const;
const EMP_TYPES = ['temporary', 'permanent', 'temp_to_perm'];
const SHIFT_PATTERNS = ['days', 'nights', 'mixed', 'weekends'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

export default function VacancyDetail() {
  const { id } = useParams<{ id: string }>();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [pipeline, setPipeline] = useState<PipelinePlacement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', stage: 'open', priority: 'medium', employment_type: 'temporary',
    shift_pattern: '', pay_rate: '', charge_rate: '', hours_per_week: '',
    openings: '1', start_date: '', closes_at: '', description: '',
  });
  const [saving, setSaving] = useState(false);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [submitForm, setSubmitForm] = useState({ candidate_id: '', pay_rate: '', charge_rate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  const [act, setAct] = useState({ type: 'note' as string, subject: '', body: '' });
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DetailResponse>(`/vacancies/${id}`);
      setVacancy((res.vacancy ?? res) as Vacancy);
      setPipeline(res.pipeline ?? []);
      setActivities(res.activities ?? []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!submitOpen) return;
    api.get<Candidate[] | { data: Candidate[] }>('/candidates?limit=100')
      .then((res) => setCandidates(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => setCandidates([]));
  }, [submitOpen]);

  const grouped = useMemo(() => {
    const open = PIPELINE_GROUPS.map((g) => ({
      ...g,
      items: pipeline.filter((p) => g.stages.includes(p.stage)),
    }));
    const closed = pipeline.filter((p) => CLOSED_PLACEMENT_STAGES.includes(p.stage));
    return { open, closed };
  }, [pipeline]);

  const changeStage = (stage: VacancyStage) => {
    if (!vacancy) return;
    setVacancy({ ...vacancy, stage });
    api.patch(`/vacancies/${vacancy.id}`, { stage }).catch(load);
  };

  const movePlacement = (pid: number, stage: PlacementStage) => {
    setPipeline((prev) => prev.map((p) => (p.id === pid ? { ...p, stage } : p)));
    api.patch(`/placements/${pid}`, { stage }).catch(load);
  };

  const openEdit = () => {
    if (!vacancy) return;
    setEditForm({
      title: vacancy.title,
      stage: vacancy.stage,
      priority: vacancy.priority,
      employment_type: vacancy.employment_type,
      shift_pattern: vacancy.shift_pattern ?? '',
      pay_rate: vacancy.pay_rate ?? '',
      charge_rate: vacancy.charge_rate ?? '',
      hours_per_week: vacancy.hours_per_week != null ? String(vacancy.hours_per_week) : '',
      openings: String(vacancy.openings),
      start_date: vacancy.start_date?.slice(0, 10) ?? '',
      closes_at: vacancy.closes_at?.slice(0, 10) ?? '',
      description: vacancy.description ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vacancy) return;
    setSaving(true);
    try {
      await api.patch(`/vacancies/${vacancy.id}`, {
        title: editForm.title,
        stage: editForm.stage,
        priority: editForm.priority,
        employment_type: editForm.employment_type,
        shift_pattern: editForm.shift_pattern || null,
        pay_rate: editForm.pay_rate ? Number(editForm.pay_rate) : null,
        charge_rate: editForm.charge_rate ? Number(editForm.charge_rate) : null,
        hours_per_week: editForm.hours_per_week ? Number(editForm.hours_per_week) : null,
        openings: Number(editForm.openings) || 1,
        start_date: editForm.start_date || null,
        closes_at: editForm.closes_at || null,
        description: editForm.description || null,
      });
      setEditOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const openSubmit = () => {
    if (!vacancy) return;
    setSubmitForm({
      candidate_id: '',
      pay_rate: vacancy.pay_rate ?? '',
      charge_rate: vacancy.charge_rate ?? '',
    });
    setSubmitErr('');
    setSubmitOpen(true);
  };

  const submitCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!vacancy) return;
    setSubmitting(true);
    setSubmitErr('');
    try {
      await api.post('/placements', {
        vacancy_id: vacancy.id,
        candidate_id: Number(submitForm.candidate_id),
        client_id: vacancy.client_id,
        pay_rate: submitForm.pay_rate ? Number(submitForm.pay_rate) : null,
        charge_rate: submitForm.charge_rate ? Number(submitForm.charge_rate) : null,
        owner_id: vacancy.owner_id,
      });
      setSubmitOpen(false);
      load();
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : 'Failed to submit candidate');
    } finally {
      setSubmitting(false);
    }
  };

  const postActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!vacancy) return;
    setPosting(true);
    try {
      await api.post('/activities', {
        entity_type: 'vacancy',
        entity_id: vacancy.id,
        type: act.type,
        subject: act.subject || null,
        body: act.body || null,
        user_id: 2,
      });
      setAct({ type: 'note', subject: '', body: '' });
      load();
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <Spinner label="Loading vacancy…" />;
  if (notFound || !vacancy) {
    return (
      <div>
        <Link to="/vacancies" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Vacancies
        </Link>
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="Vacancy not found"
            hint="It may have been removed, or the link is incorrect."
          />
        </Card>
      </div>
    );
  }

  const v = vacancy;
  const pay = v.pay_rate != null ? Number(v.pay_rate) : null;
  const charge = v.charge_rate != null ? Number(v.charge_rate) : null;
  const marginPct = pay != null && charge ? Math.round(((charge - pay) / charge) * 100) : null;

  return (
    <div>
      <Link to="/vacancies" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Vacancies
      </Link>

      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-ink">{v.title}</h1>
              <Badge value={v.stage} />
              <Badge value={v.priority} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Link to={`/clients/${v.client_id}`} className="flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
                <Building2 className="h-3.5 w-3.5" /> {v.client_name}
              </Link>
              {v.client_town && <span>· {v.client_town}</span>}
              {v.cqc_rating && (
                <span className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                  CQC_STYLES[v.cqc_rating.toLowerCase()] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
                )}>
                  <ShieldCheck className="h-3 w-3" /> CQC {v.cqc_rating}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={v.stage}
              onChange={(e) => changeStage(e.target.value as VacancyStage)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {VACANCY_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
            <button className={btnGhost} onClick={openEdit}>
              <PencilLine className="h-4 w-4" /> Edit
            </button>
            <button className={btnPrimary} onClick={openSubmit}>
              <UserPlus className="h-4 w-4" /> Submit Candidate
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-5 xl:grid-cols-10">
          <Stat label="Pay Rate">{gbp2(v.pay_rate)}/hr</Stat>
          <Stat label="Charge Rate">{gbp2(v.charge_rate)}/hr</Stat>
          <Stat label="Margin">{marginPct != null ? `${marginPct}%` : '—'}</Stat>
          <Stat label="Shift">{v.shift_pattern ? fmtStatus(v.shift_pattern) : '—'}</Stat>
          <Stat label="Hours / Week">{v.hours_per_week ?? '—'}</Stat>
          <Stat label="Openings">{v.openings}</Stat>
          <Stat label="Start Date">{fmtDate(v.start_date)}</Stat>
          <Stat label="Posted">{ago(v.posted_at)}</Stat>
          <Stat label="Closes">{fmtDate(v.closes_at)}</Stat>
          <Stat label="Owner">
            <span className="flex items-center gap-1.5">
              <Avatar initials={v.owner_initials} color={v.owner_color} name={v.owner_name} size="xs" />
              <span className="truncate text-xs">{v.owner_name ?? '—'}</span>
            </span>
          </Stat>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Candidate pipeline */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Candidate Pipeline"
            subtitle={`${pipeline.length} candidate${pipeline.length === 1 ? '' : 's'} submitted`}
            action={
              <button onClick={openSubmit} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                <UserPlus className="h-3.5 w-3.5" /> Submit Candidate
              </button>
            }
          />
          <div className="space-y-5 px-5 py-4">
            {!pipeline.length && (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No candidates submitted yet"
                hint="Submit a candidate to start filling this vacancy."
              />
            )}
            {grouped.open.map((g) => g.items.length > 0 && (
              <div key={g.label}>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.label}</h4>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {g.items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {g.items.map((p) => (
                    <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/candidates/${p.candidate_id}`} className="truncate text-sm font-medium text-ink hover:text-brand-600">
                          {p.candidate_name}
                        </Link>
                        <Badge value={p.stage} />
                      </div>
                      {p.candidate_role && <p className="mt-0.5 text-xs text-slate-500">{p.candidate_role}</p>}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <ComplianceBar score={p.compliance_score ?? 0} />
                        <select
                          value={p.stage}
                          onChange={(e) => movePlacement(p.id, e.target.value as PlacementStage)}
                          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 focus:border-brand-500 focus:outline-none"
                        >
                          {ALL_PLACEMENT_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
                        </select>
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400">submitted {ago(p.submitted_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {grouped.closed.length > 0 && (
              <div>
                <button
                  onClick={() => setShowClosed((s) => !s)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
                >
                  {showClosed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Ended / Rejected
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {grouped.closed.length}
                  </span>
                </button>
                {showClosed && (
                  <div className="mt-2 space-y-2">
                    {grouped.closed.map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 opacity-80">
                        <div className="flex items-center justify-between gap-2">
                          <Link to={`/candidates/${p.candidate_id}`} className="truncate text-sm font-medium text-slate-600 hover:text-brand-600">
                            {p.candidate_name}
                          </Link>
                          <Badge value={p.stage} />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] text-slate-400">submitted {ago(p.submitted_at)}</p>
                          <select
                            value={p.stage}
                            onChange={(e) => movePlacement(p.id, e.target.value as PlacementStage)}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 focus:border-brand-500 focus:outline-none"
                          >
                            {ALL_PLACEMENT_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" subtitle={v.role} />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Employment type</span>
                <span className="font-medium text-ink">{fmtStatus(v.employment_type)}</span>
              </div>
              {(v.requirements?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Requirements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {v.requirements.map((r) => (
                      <span key={r} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Description</p>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                  {v.description || 'No description provided.'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" subtitle="Calls, emails and notes" />
            <div className="border-b border-slate-100 px-5 py-4">
              <form onSubmit={postActivity} className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={act.type}
                    onChange={(e) => setAct((a) => ({ ...a, type: e.target.value }))}
                    className={clsx(inputCls, 'w-28')}
                  >
                    {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{fmtStatus(t)}</option>)}
                  </select>
                  <input
                    value={act.subject}
                    onChange={(e) => setAct((a) => ({ ...a, subject: e.target.value }))}
                    placeholder="Subject"
                    className={inputCls}
                  />
                </div>
                <textarea
                  rows={2}
                  value={act.body}
                  onChange={(e) => setAct((a) => ({ ...a, body: e.target.value }))}
                  placeholder="Add a note about this vacancy…"
                  className={inputCls}
                />
                <div className="flex justify-end">
                  <button type="submit" disabled={posting} className={clsx(btnPrimary, posting && 'opacity-60')}>
                    {posting ? 'Posting…' : 'Log Activity'}
                  </button>
                </div>
              </form>
            </div>
            <div className="scroll-thin max-h-96 overflow-y-auto px-5 py-4">
              <ActivityFeed activities={activities} />
            </div>
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Vacancy" wide>
        <form onSubmit={saveEdit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Title">
              <input required value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Stage">
            <select value={editForm.stage} onChange={(e) => setEditForm((f) => ({ ...f, stage: e.target.value }))} className={inputCls}>
              {VACANCY_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={editForm.priority} onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{fmtStatus(p)}</option>)}
            </select>
          </Field>
          <Field label="Employment Type">
            <select value={editForm.employment_type} onChange={(e) => setEditForm((f) => ({ ...f, employment_type: e.target.value }))} className={inputCls}>
              {EMP_TYPES.map((t) => <option key={t} value={t}>{fmtStatus(t)}</option>)}
            </select>
          </Field>
          <Field label="Shift Pattern">
            <select value={editForm.shift_pattern} onChange={(e) => setEditForm((f) => ({ ...f, shift_pattern: e.target.value }))} className={inputCls}>
              <option value="">—</option>
              {SHIFT_PATTERNS.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Pay Rate (£/hr)">
            <input type="number" min="0" step="0.01" value={editForm.pay_rate} onChange={(e) => setEditForm((f) => ({ ...f, pay_rate: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Charge Rate (£/hr)">
            <input type="number" min="0" step="0.01" value={editForm.charge_rate} onChange={(e) => setEditForm((f) => ({ ...f, charge_rate: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Hours / Week">
            <input type="number" min="0" value={editForm.hours_per_week} onChange={(e) => setEditForm((f) => ({ ...f, hours_per_week: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Openings">
            <input type="number" min="1" value={editForm.openings} onChange={(e) => setEditForm((f) => ({ ...f, openings: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Start Date">
            <input type="date" value={editForm.start_date} onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Closes">
            <input type="date" value={editForm.closes_at} onChange={(e) => setEditForm((f) => ({ ...f, closes_at: e.target.value }))} className={inputCls} />
          </Field>
          <div className="col-span-2">
            <Field label="Description">
              <textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className={btnGhost} onClick={() => setEditOpen(false)}>Cancel</button>
            <button type="submit" disabled={saving} className={clsx(btnPrimary, saving && 'opacity-60')}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit candidate modal */}
      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit Candidate">
        <form onSubmit={submitCandidate} className="space-y-4">
          <Field label="Candidate *">
            <select
              required
              value={submitForm.candidate_id}
              onChange={(e) => setSubmitForm((f) => ({ ...f, candidate_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Select candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {c.role}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pay Rate (£/hr)">
              <input type="number" min="0" step="0.01" value={submitForm.pay_rate} onChange={(e) => setSubmitForm((f) => ({ ...f, pay_rate: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Charge Rate (£/hr)">
              <input type="number" min="0" step="0.01" value={submitForm.charge_rate} onChange={(e) => setSubmitForm((f) => ({ ...f, charge_rate: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          {submitErr && <p className="text-xs font-medium text-red-600">{submitErr}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className={btnGhost} onClick={() => setSubmitOpen(false)}>Cancel</button>
            <button type="submit" disabled={submitting} className={clsx(btnPrimary, submitting && 'opacity-60')}>
              {submitting ? 'Submitting…' : 'Submit Candidate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
