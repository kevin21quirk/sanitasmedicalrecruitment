import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Briefcase, KanbanSquare, CircleCheck, Ban } from 'lucide-react';
import { api } from '../lib/api';
import { gbp2, fmtDate, ago } from '../lib/format';
import { Placement, PlacementStage, Candidate, Client, Vacancy } from '../lib/types';
import {
  Badge, Card, Avatar, Spinner, EmptyState, Modal, PageHeader,
  inputCls, btnPrimary, btnGhost, fmtStatus,
} from '../components/ui';
import clsx from 'clsx';

const PIPELINE_STAGES: PlacementStage[] = ['submitted', 'screening', 'compliance_check', 'interview', 'offer'];
const ACTIVE_STAGES: PlacementStage[] = ['placed', 'active'];
const ALL_STAGES: PlacementStage[] = [...PIPELINE_STAGES, ...ACTIVE_STAGES, 'ended', 'rejected'];

const STAGE_GROUPS: Record<string, PlacementStage[]> = {
  'group:pipeline': PIPELINE_STAGES,
  'group:active': ACTIVE_STAGES,
  'group:ended': ['ended'],
  'group:rejected': ['rejected'],
};

const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

export default function Placements() {
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [form, setForm] = useState({
    candidate_id: '', client_id: '', vacancy_id: '', pay_rate: '', charge_rate: '', start_date: '',
  });

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPlacements = () => {
    const q = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : '';
    api.get<Placement[]>(`/placements${q}`).then(setPlacements).catch(() => setPlacements([]));
  };

  useEffect(fetchPlacements, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load modal options once
  useEffect(() => {
    api.get<{ data: Candidate[] }>('/candidates?limit=200').then((r) => setCandidates(r.data)).catch(() => {});
    api.get<Client[]>('/clients').then(setClients).catch(() => {});
    api.get<Vacancy[]>('/vacancies').then(setVacancies).catch(() => {});
  }, []);

  const rows = useMemo(() => {
    if (!placements) return [];
    if (!stageFilter) return placements;
    const group = STAGE_GROUPS[stageFilter];
    if (group) return placements.filter((p) => group.includes(p.stage));
    return placements.filter((p) => p.stage === stageFilter);
  }, [placements, stageFilter]);

  const stats = useMemo(() => {
    const list = placements ?? [];
    return {
      pipeline: list.filter((p) => PIPELINE_STAGES.includes(p.stage)).length,
      active: list.filter((p) => ACTIVE_STAGES.includes(p.stage)).length,
      ended: list.filter((p) => p.stage === 'ended').length,
      rejected: list.filter((p) => p.stage === 'rejected').length,
    };
  }, [placements]);

  const updateStage = async (p: Placement, stage: PlacementStage) => {
    setPlacements((prev) => prev?.map((x) => (x.id === p.id ? { ...x, stage } : x)) ?? prev);
    try {
      await api.patch(`/placements/${p.id}`, { stage });
    } catch {
      fetchPlacements();
    }
  };

  const filteredVacancies = form.client_id
    ? vacancies.filter((v) => v.client_id === +form.client_id)
    : vacancies;

  const pickVacancy = (vacancyId: string) => {
    const v = vacancies.find((x) => x.id === +vacancyId);
    setForm((f) => ({
      ...f,
      vacancy_id: vacancyId,
      client_id: v ? String(v.client_id) : f.client_id,
      pay_rate: v?.pay_rate ?? f.pay_rate,
      charge_rate: v?.charge_rate ?? f.charge_rate,
      start_date: v?.start_date?.slice(0, 10) ?? f.start_date,
    }));
  };

  const submit = async () => {
    if (!form.candidate_id || !form.client_id) {
      setError('Candidate and care home are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/placements', {
        candidate_id: +form.candidate_id,
        client_id: +form.client_id,
        vacancy_id: form.vacancy_id ? +form.vacancy_id : null,
        pay_rate: form.pay_rate || null,
        charge_rate: form.charge_rate || null,
        start_date: form.start_date || null,
      });
      setShowModal(false);
      setForm({ candidate_id: '', client_id: '', vacancy_id: '', pay_rate: '', charge_rate: '', start_date: '' });
      fetchPlacements();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create placement');
    } finally {
      setSaving(false);
    }
  };

  if (!placements) return <Spinner label="Loading placements…" />;

  const statCards = [
    { label: 'In Pipeline', value: stats.pipeline, icon: KanbanSquare, sub: 'submitted → offer' },
    { label: 'Active Workers', value: stats.active, icon: Briefcase, sub: 'placed & on assignment' },
    { label: 'Ended', value: stats.ended, icon: CircleCheck, sub: 'completed placements' },
    { label: 'Rejected', value: stats.rejected, icon: Ban, sub: 'not progressed' },
  ];

  return (
    <div>
      <PageHeader title="Placements" subtitle="Candidate submissions, placements and active workers.">
        <button className={btnPrimary} onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> New Placement
        </button>
      </PageHeader>

      {/* Stats strip */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate, client or vacancy…"
            className={clsx(inputCls, 'pl-9')}
          />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={clsx(inputCls, 'w-auto')}>
          <option value="">All stages</option>
          <optgroup label="Stage groups">
            <option value="group:pipeline">In pipeline</option>
            <option value="group:active">Active</option>
            <option value="group:ended">Ended</option>
            <option value="group:rejected">Rejected</option>
          </optgroup>
          <optgroup label="Individual stages">
            {ALL_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
          </optgroup>
        </select>
        <span className="text-xs text-slate-400">{rows.length} placement{rows.length === 1 ? '' : 's'}</span>
      </div>

      {/* Table */}
      <Card>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Vacancy / Client</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Rates</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-5 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((p) => {
                const margin = p.pay_rate != null && p.charge_rate != null
                  ? Number(p.charge_rate) - Number(p.pay_rate)
                  : null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.candidate_name} size="sm" />
                        <div className="min-w-0">
                          <Link to={`/candidates/${p.candidate_id}`} className="block truncate font-medium text-ink hover:text-brand-600">
                            {p.candidate_name}
                          </Link>
                          <p className="truncate text-xs text-slate-500">{p.candidate_role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.vacancy_id && p.vacancy_title ? (
                        <Link to={`/vacancies/${p.vacancy_id}`} className="block truncate font-medium text-ink hover:text-brand-600">
                          {p.vacancy_title}
                        </Link>
                      ) : (
                        <span className="block truncate text-slate-400">No vacancy</span>
                      )}
                      <Link to={`/clients/${p.client_id}`} className="block truncate text-xs text-slate-500 hover:text-brand-600">
                        {p.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={p.stage} />
                      <select
                        value={p.stage}
                        onChange={(e) => updateStage(p, e.target.value as PlacementStage)}
                        className="mt-1 block w-32 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 focus:border-brand-500 focus:outline-none"
                      >
                        {ALL_STAGES.map((s) => <option key={s} value={s}>{fmtStatus(s)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-600">
                        Pay <span className="font-medium text-ink">{gbp2(p.pay_rate)}/hr</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        Charge <span className="font-medium text-ink">{gbp2(p.charge_rate)}/hr</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {margin != null ? `${gbp2(margin)}/hr margin` : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{ago(p.submitted_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(p.start_date)}</td>
                    <td className="px-5 py-3">
                      {p.owner_name ? (
                        <Avatar name={p.owner_name} initials={p.owner_initials} color={p.owner_color} size="xs" />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title="No placements found"
              hint="Try a different search or stage filter, or create a new placement."
            />
          )}
        </div>
      </Card>

      {/* New placement modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Placement">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Candidate *</label>
            <select
              value={form.candidate_id}
              onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}
              className={inputCls}
            >
              <option value="">Select candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Care Home *</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value, vacancy_id: '' })}
              className={inputCls}
            >
              <option value="">Select care home…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vacancy {form.client_id ? '(filtered by care home)' : ''}</label>
            <select
              value={form.vacancy_id}
              onChange={(e) => pickVacancy(e.target.value)}
              className={inputCls}
            >
              <option value="">No linked vacancy</option>
              {filteredVacancies.map((v) => (
                <option key={v.id} value={v.id}>{v.title} — {v.client_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Pay rate £/hr</label>
              <input
                type="number" step="0.01" min="0" value={form.pay_rate}
                onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
                className={inputCls} placeholder="14.50"
              />
            </div>
            <div>
              <label className={labelCls}>Charge rate £/hr</label>
              <input
                type="number" step="0.01" min="0" value={form.charge_rate}
                onChange={(e) => setForm({ ...form, charge_rate: e.target.value })}
                className={inputCls} placeholder="19.00"
              />
            </div>
            <div>
              <label className={labelCls}>Start date</label>
              <input
                type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className={btnGhost} onClick={() => setShowModal(false)}>Cancel</button>
            <button className={btnPrimary} onClick={submit} disabled={saving}>
              {saving ? 'Creating…' : 'Create Placement'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
