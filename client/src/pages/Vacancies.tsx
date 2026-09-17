import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  Briefcase, ChevronsLeft, ChevronsRight, KanbanSquare, List,
  MapPin, Plus, Search, Users,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { ago, gbp2 } from '../lib/format';
import type { Client, Vacancy, VacancyStage } from '../lib/types';
import {
  Avatar, Badge, btnGhost, btnPrimary, EmptyState, fmtStatus,
  inputCls, Modal, PageHeader, Spinner,
} from '../components/ui';

const STAGES: VacancyStage[] = ['open', 'sourcing', 'shortlisted', 'interview', 'offer', 'filled'];
const CLOSED_STAGES: VacancyStage[] = ['on_hold', 'lost'];
const ALL_STAGES: VacancyStage[] = [...STAGES, ...CLOSED_STAGES];

const STAGE_ACCENT: Record<VacancyStage, string> = {
  open: 'border-t-accent-500',
  sourcing: 'border-t-brand-500',
  shortlisted: 'border-t-violet-500',
  interview: 'border-t-amber-500',
  offer: 'border-t-orange-500',
  filled: 'border-t-emerald-500',
  on_hold: 'border-t-slate-400',
  lost: 'border-t-red-500',
};

const ROLES = ['Registered Nurse', 'Senior Nurse', 'Healthcare Assistant', 'Senior HCA'];
const EMP_TYPES = ['temporary', 'permanent', 'temp_to_perm'];
const SHIFT_PATTERNS = ['days', 'nights', 'mixed', 'weekends'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const EMPTY_FORM = {
  client_id: '', title: '', role: ROLES[0], employment_type: 'temporary',
  shift_pattern: 'days', hours_per_week: '', pay_rate: '', charge_rate: '',
  priority: 'medium', openings: '1', start_date: '', description: '',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function VacancyCard({ v }: { v: Vacancy }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <Link to={`/vacancies/${v.id}`} className="line-clamp-2 text-sm font-semibold text-ink hover:text-brand-600">
        {v.title}
      </Link>
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
        <MapPin className="h-3 w-3 shrink-0" />
        {v.client_name}{v.client_town ? ` · ${v.client_town}` : ''}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {v.role}{v.shift_pattern ? ` · ${fmtStatus(v.shift_pattern)}` : ''}
      </p>
      <p className="mt-1.5 text-xs font-semibold text-ink">
        {gbp2(v.pay_rate)}–{gbp2(v.charge_rate)}<span className="font-normal text-slate-400">/hr</span>
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge value={v.priority} />
          {v.openings > 1 && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {v.openings} openings
            </span>
          )}
        </div>
        <Avatar initials={v.owner_initials} color={v.owner_color} name={v.owner_name} size="xs" />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
        <span>posted {ago(v.posted_at)}</span>
        <span className="flex items-center gap-1" title="Candidate submissions">
          <Users className="h-3 w-3" /> {v.submissions ?? 0}
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ v }: { v: Vacancy }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: v.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={clsx('touch-none', isDragging && 'opacity-30')}
    >
      <VacancyCard v={v} />
    </div>
  );
}

function StageColumn({ stage, vacancies, collapsed, onToggle }: {
  stage: VacancyStage;
  vacancies: Vacancy[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        onClick={onToggle}
        title={`Expand ${fmtStatus(stage)}`}
        className={clsx(
          'flex w-12 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl border border-slate-200 border-t-4 bg-slate-50 py-3 transition-colors hover:bg-slate-100',
          STAGE_ACCENT[stage],
          isOver && 'bg-brand-50 ring-2 ring-brand-300'
        )}
      >
        <ChevronsRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[11px] font-medium text-slate-500 [writing-mode:vertical-rl]">
          {fmtStatus(stage)}
        </span>
        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {vacancies.length}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 border-t-4 bg-slate-100/60',
        STAGE_ACCENT[stage],
        isOver && 'bg-brand-50/60 ring-2 ring-brand-300'
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{fmtStatus(stage)}</h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
            {vacancies.length}
          </span>
        </div>
        {CLOSED_STAGES.includes(stage) && (
          <button onClick={onToggle} title="Collapse" className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-2.5 px-2.5 pb-3">
        {vacancies.map((v) => <DraggableCard key={v.id} v={v} />)}
        {!vacancies.length && (
          <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-[11px] text-slate-400">
            Drop vacancies here
          </p>
        )}
      </div>
    </div>
  );
}

export default function Vacancies() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [priority, setPriority] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [expandedClosed, setExpandedClosed] = useState<Partial<Record<VacancyStage, boolean>>>({});
  const [activeDrag, setActiveDrag] = useState<Vacancy | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debounced) params.set('search', debounced);
    if (role) params.set('role', role);
    if (priority) params.set('priority', priority);
    setLoading(true);
    api.get<Vacancy[]>(`/vacancies?${params.toString()}`)
      .then(setVacancies)
      .catch(() => setVacancies([]))
      .finally(() => setLoading(false));
  }, [debounced, role, priority]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.get<Client[] | { data: Client[] }>('/clients')
      .then((res) => setClients(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => setClients([]));
  }, []);

  const byStage = useMemo(() => {
    const m = new Map<VacancyStage, Vacancy[]>(ALL_STAGES.map((s): [VacancyStage, Vacancy[]] => [s, []]));
    vacancies.forEach((v) => m.get(v.stage)?.push(v));
    return m;
  }, [vacancies]);

  const changeStage = (id: number, stage: VacancyStage) => {
    setVacancies((prev) => prev.map((v) => (v.id === id ? { ...v, stage } : v)));
    api.patch(`/vacancies/${id}`, { stage }).catch(load);
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveDrag(vacancies.find((v) => v.id === e.active.id) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const vacancy = vacancies.find((v) => v.id === active.id);
    const stage = over.id as VacancyStage;
    if (!vacancy || vacancy.stage === stage || !ALL_STAGES.includes(stage)) return;
    changeStage(vacancy.id, stage);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormErr('');
    try {
      await api.post('/vacancies', {
        client_id: Number(form.client_id),
        title: form.title,
        role: form.role,
        employment_type: form.employment_type,
        shift_pattern: form.shift_pattern || null,
        hours_per_week: form.hours_per_week ? Number(form.hours_per_week) : null,
        pay_rate: form.pay_rate ? Number(form.pay_rate) : null,
        charge_rate: form.charge_rate ? Number(form.charge_rate) : null,
        priority: form.priority,
        openings: Number(form.openings) || 1,
        start_date: form.start_date || null,
        description: form.description || null,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Failed to create vacancy');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader title="Vacancy Pipeline" subtitle="Live roles across all care homes — drag cards between stages.">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {([['kanban', KanbanSquare], ['list', List]] as const).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                view === v ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {v}
            </button>
          ))}
        </div>
        <button className={btnPrimary} onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> New Vacancy
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or client…"
            className={clsx(inputCls, 'pl-9')}
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={clsx(inputCls, 'w-auto')}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={clsx(inputCls, 'w-auto')}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{fmtStatus(p)}</option>)}
        </select>
      </div>

      {loading ? <Spinner label="Loading vacancies…" /> : !vacancies.length ? (
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="No vacancies found"
          hint="Try adjusting your filters, or create a new vacancy."
        />
      ) : view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="scroll-thin flex items-start gap-3 overflow-x-auto pb-4">
            {STAGES.map((s) => (
              <StageColumn
                key={s}
                stage={s}
                vacancies={byStage.get(s) ?? []}
                collapsed={false}
                onToggle={() => undefined}
              />
            ))}
            {CLOSED_STAGES.map((s) => (
              <StageColumn
                key={s}
                stage={s}
                vacancies={byStage.get(s) ?? []}
                collapsed={!expandedClosed[s]}
                onToggle={() => setExpandedClosed((p) => ({ ...p, [s]: !p[s] }))}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDrag ? <div className="w-72 rotate-2 opacity-90"><VacancyCard v={activeDrag} /></div> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view */
        <div className="scroll-thin overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Vacancy</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Rates /hr</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Openings</th>
                <th className="px-4 py-3">Subs</th>
                <th className="px-4 py-3">Posted</th>
                <th className="px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {vacancies.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link to={`/vacancies/${v.id}`} className="font-medium text-ink hover:text-brand-600">
                      {v.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.client_name}
                    {v.client_town && <p className="text-[11px] text-slate-400">{v.client_town}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.role}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtStatus(v.employment_type)}</td>
                  <td className="px-4 py-3 text-slate-600">{v.shift_pattern ? fmtStatus(v.shift_pattern) : '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{gbp2(v.pay_rate)}–{gbp2(v.charge_rate)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={v.stage}
                      onChange={(e) => changeStage(v.id, e.target.value as VacancyStage)}
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 focus:border-brand-500 focus:outline-none"
                    >
                      {ALL_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><Badge value={v.priority} /></td>
                  <td className="px-4 py-3 text-slate-600">{v.openings}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Users className="h-3.5 w-3.5 text-slate-400" /> {v.submissions ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{ago(v.posted_at)}</td>
                  <td className="px-4 py-3">
                    <Avatar initials={v.owner_initials} color={v.owner_color} name={v.owner_name} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New vacancy modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Vacancy" wide>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field label="Care Home *">
            <select required value={form.client_id} onChange={set('client_id')} className={inputCls}>
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.town ? ` — ${c.town}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Vacancy Title *">
            <input required value={form.title} onChange={set('title')} placeholder="e.g. Nights RN — Weekends" className={inputCls} />
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={set('role')} className={inputCls}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Employment Type">
            <select value={form.employment_type} onChange={set('employment_type')} className={inputCls}>
              {EMP_TYPES.map((t) => <option key={t} value={t}>{fmtStatus(t)}</option>)}
            </select>
          </Field>
          <Field label="Shift Pattern">
            <select value={form.shift_pattern} onChange={set('shift_pattern')} className={inputCls}>
              {SHIFT_PATTERNS.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
            </select>
          </Field>
          <Field label="Hours / Week">
            <input type="number" min="0" value={form.hours_per_week} onChange={set('hours_per_week')} className={inputCls} />
          </Field>
          <Field label="Pay Rate (£/hr)">
            <input type="number" min="0" step="0.01" value={form.pay_rate} onChange={set('pay_rate')} className={inputCls} />
          </Field>
          <Field label="Charge Rate (£/hr)">
            <input type="number" min="0" step="0.01" value={form.charge_rate} onChange={set('charge_rate')} className={inputCls} />
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={set('priority')} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{fmtStatus(p)}</option>)}
            </select>
          </Field>
          <Field label="Openings">
            <input type="number" min="1" value={form.openings} onChange={set('openings')} className={inputCls} />
          </Field>
          <Field label="Start Date">
            <input type="date" value={form.start_date} onChange={set('start_date')} className={inputCls} />
          </Field>
          <div className="col-span-2">
            <Field label="Description">
              <textarea rows={3} value={form.description} onChange={set('description')} className={inputCls} />
            </Field>
          </div>
          {formErr && <p className="col-span-2 text-xs font-medium text-red-600">{formErr}</p>}
          <div className="col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className={btnGhost} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" disabled={saving} className={clsx(btnPrimary, saving && 'opacity-60')}>
              {saving ? 'Creating…' : 'Create Vacancy'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
