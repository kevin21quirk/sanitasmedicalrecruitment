import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Briefcase, CircleCheck, Clock3, Download, FileWarning, LayoutGrid, List, Plus, Search, Star, UserCheck, UserPlus, Users,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDate, gbp2 } from '../lib/format';
import { Candidate, User } from '../lib/types';
import {
  Avatar, Badge, Card, ComplianceBar, EmptyState, Field, FilterTh, Modal, PageHeader, Pagination,
  PhotoUpload, SortTh, Spinner, StatCard, btnGhost, btnPrimary, fmtStatus, inputCls,
} from '../components/ui';

interface CandidateStats { total: string; compliant: string; on_assignment: string; in_progress: string; new_30d: string }
interface CandidateListResponse { data: Candidate[]; total: number; page: number; limit: number }

const ROLES = ['Registered Nurse', 'Senior Nurse', 'Healthcare Assistant', 'Senior HCA', 'Support Worker'];
const SHIFTS = ['days', 'nights', 'flexible'];
const SOURCES = ['Website', 'Referral', 'Indeed', 'Reed', 'Facebook', 'Word of Mouth'];
const STATUSES = ['compliant', 'on_assignment', 'in_progress', 'dormant', 'do_not_use'];

const emptyForm = {
  first_name: '', last_name: '', email: '', phone: '',
  role: ROLES[0], town: '', postcode: '', preferred_shift: '', source: '', owner_id: '', nmc_pin: '',
};

export default function Candidates() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<'grid' | 'cards'>('grid');

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [debounced, setDebounced] = useState(search);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [compliance, setCompliance] = useState('');
  const [owner, setOwner] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<Candidate | null>(null);
  const [step, setStep] = useState<'form' | 'docs' | 'photo' | 'login'>('form');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginSaved, setLoginSaved] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [reqs, setReqs] = useState<string[]>([]);
  const [recorded, setRecorded] = useState<Set<string>>(new Set());
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [reqForm, setReqForm] = useState<{ issue_date: string; expiry_date: string; reference_no: string; file: File | null }>(
    { issue_date: '', expiry_date: '', reference_no: '', file: null });
  const [reqSaving, setReqSaving] = useState(false);
  const [reqErr, setReqErr] = useState('');

  useEffect(() => { api.get<CandidateStats>('/candidates/stats').then(setStats).catch(() => {}); }, []);
  useEffect(() => { api.get<User[]>('/users').then(setUsers).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit), sort, dir });
    if (debounced) p.set('search', debounced);
    if (role) p.set('role', role);
    if (status) p.set('status', status);
    if (compliance) p.set('compliance', compliance);
    if (owner) p.set('owner_id', owner);
    api.get<CandidateListResponse>(`/candidates?${p}`)
      .then((r) => { setRows(r.data); setTotal(r.total); })
      .catch(() => setRows([]));
  };
  useEffect(load, [debounced, role, status, compliance, owner, page, limit, sort, dir]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = (col: string) => {
    if (sort === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setDir(col === 'name' ? 'asc' : 'desc'); }
  };

  const submit = async () => {
    setSaving(true); setFormError(null);
    try {
      const c = await api.post<Candidate>('/candidates', {
        ...form,
        email: form.email || null, phone: form.phone || null, town: form.town || null, postcode: form.postcode || null,
        preferred_shift: form.preferred_shift || null, source: form.source || null, nmc_pin: form.nmc_pin || null,
        owner_id: form.owner_id ? +form.owner_id : null,
      });
      setCreated(c);
      setForm(emptyForm);
      load();
      api.get<CandidateStats>('/candidates/stats').then(setStats).catch(() => {});
      setLoginForm({ email: c.email ?? '', password: '' });
      setLoginSaved(false); setLoginErr('');
      const reqList = await api.get<string[]>(`/candidates/requirements?role=${encodeURIComponent(form.role)}`).catch(() => [] as string[]);
      setReqs(reqList);
      setRecorded(new Set());
      setStep(reqList.length ? 'docs' : 'photo');
    } catch (e) { setFormError((e as Error).message); }
    finally { setSaving(false); }
  };

  const recordReq = async (type: string) => {
    if (!created) return;
    setReqSaving(true); setReqErr('');
    try {
      const fd = new FormData();
      fd.append('type', type);
      if (reqForm.reference_no) fd.append('reference_no', reqForm.reference_no);
      if (reqForm.issue_date) fd.append('issue_date', reqForm.issue_date);
      if (reqForm.expiry_date) fd.append('expiry_date', reqForm.expiry_date);
      if (reqForm.file) fd.append('file', reqForm.file);
      await api.upload(`/candidates/${created.id}/documents/upload`, fd);
      setRecorded((s) => new Set(s).add(type));
      setOpenReq(null);
      setReqForm({ issue_date: '', expiry_date: '', reference_no: '', file: null });
    } catch (e) { setReqErr(e instanceof Error ? e.message : 'Could not save'); }
    finally { setReqSaving(false); }
  };

  // Leaving the docs step with gaps is logged (candidate.onboarding_deferred).
  const proceedFromDocs = async () => {
    if (created) await api.post(`/candidates/${created.id}/onboarding-deferred`, {}).catch(() => {});
    setStep('photo');
  };

  const createLogin = async () => {
    if (!created) return;
    setLoginBusy(true); setLoginErr('');
    try {
      await api.post('/accounts', {
        kind: 'worker', candidate_id: created.id,
        email: loginForm.email, password: loginForm.password,
      });
      setLoginSaved(true);
    } catch (e) { setLoginErr(e instanceof Error ? e.message : 'Could not create login'); }
    finally { setLoginBusy(false); }
  };

  const closeAdd = () => {
    setShowAdd(false); setCreated(null); setFormError(null);
    setStep('form'); setReqs([]); setRecorded(new Set()); setOpenReq(null); setReqErr('');
    setLoginForm({ email: '', password: '' }); setLoginSaved(false); setLoginErr('');
  };

  const pages = Math.max(1, Math.ceil(total / limit));
  const ownerOpts = useMemo(() => users.map((u) => ({ value: String(u.id), label: u.name })), [users]);

  const exportCsv = () => {
    if (!rows) return;
    const head = 'name,role,email,phone,town,status,compliance,owner,registered';
    const lines = rows.map((c) => [`${c.first_name} ${c.last_name}`, c.role, c.email ?? '', c.phone ?? '', c.town ?? '', c.status, c.compliance_score, c.owner_name ?? '', c.registered_at?.slice(0, 10)]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','));
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'candidates.csv'; a.click();
  };

  return (
    <div>
      <PageHeader eyebrow="Recruitment" title="Candidates" subtitle="Nurses, HCAs and support workers on the Sanitas books.">
        <div className="hidden items-center gap-0.5 rounded-xl bg-slate-900/5 p-1 sm:flex">
          <button onClick={() => setView('grid')} className={clsx('rounded-lg p-1.5', view === 'grid' ? 'bg-white text-ink shadow-sm' : 'text-slate-500')} title="Grid"><List className="h-4 w-4" /></button>
          <button onClick={() => setView('cards')} className={clsx('rounded-lg p-1.5', view === 'cards' ? 'bg-white text-ink shadow-sm' : 'text-slate-500')} title="Cards"><LayoutGrid className="h-4 w-4" /></button>
        </div>
        <button className={btnGhost} onClick={exportCsv}><Download className="h-4 w-4" /> Export</button>
        <button className={btnPrimary} onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Candidate</button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Candidates" value={stats?.total ?? '—'} icon={Users} />
        <StatCard label="Compliant" value={stats?.compliant ?? '—'} icon={UserCheck} tint="bg-emerald-500/10 text-emerald-600" />
        <StatCard label="On Assignment" value={stats?.on_assignment ?? '—'} icon={Briefcase} />
        <StatCard label="In Progress" value={stats?.in_progress ?? '—'} icon={Clock3} tint="bg-amber-500/10 text-amber-600" />
        <StatCard label="New (30 days)" value={stats?.new_30d ?? '—'} icon={UserPlus} tint="bg-accent-500/10 text-accent-600" />
      </div>

      <Card className="overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/60 px-4 py-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, town, NMC PIN…" className={clsx(inputCls, 'pl-9')} />
          </div>
          <select value={compliance} onChange={(e) => { setCompliance(e.target.value); setPage(1); }} className={clsx(inputCls, 'w-auto')}>
            <option value="">All compliance</option>
            <option value="compliant">Compliant (≥80%)</option>
            <option value="attention">Needs attention (&lt;80%)</option>
          </select>
          <span className="text-xs text-slate-400">{total} result{total === 1 ? '' : 's'}</span>
        </div>

        {rows === null ? <Spinner label="Loading candidates…" /> : view === 'cards' ? (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => (
              <button key={c.id} onClick={() => navigate(`/candidates/${c.id}`)} className="glass-strong group flex items-center gap-3 rounded-2xl p-4 text-left transition-shadow hover:shadow-glass-lg">
                <Avatar name={`${c.first_name} ${c.last_name}`} photoId={c.photo_file_id} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink group-hover:text-brand-600">{c.first_name} {c.last_name}</p>
                  <p className="truncate text-xs text-slate-500">{c.role} · {c.town ?? '—'}</p>
                  <div className="mt-1.5 flex items-center gap-2"><Badge value={c.status} /><ComplianceBar score={c.compliance_score} /></div>
                </div>
              </button>
            ))}
            {!rows.length && <div className="col-span-full"><EmptyState icon={<Users className="h-5 w-5" />} title="No candidates found" /></div>}
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="grid-head">
                <tr className="border-b border-slate-200/60">
                  <SortTh label="Candidate" col="name" sort={sort} dir={dir} onSort={toggleSort} className="min-w-56" />
                  <SortTh label="Role" />
                  <SortTh label="Contact" />
                  <SortTh label="Location" />
                  <SortTh label="Status" />
                  <SortTh label="Compliance" col="compliance" sort={sort} dir={dir} onSort={toggleSort} />
                  <SortTh label="Rate" />
                  <SortTh label="Rating" col="rating" sort={sort} dir={dir} onSort={toggleSort} />
                  <SortTh label="Owner" />
                  <SortTh label="Registered" col="created_at" sort={sort} dir={dir} onSort={toggleSort} />
                </tr>
                <tr className="border-b border-slate-200/60">
                  <FilterTh value={search} onChange={setSearch} placeholder="Search name…" />
                  <FilterTh value={role} onChange={(v) => { setRole(v); setPage(1); }} options={ROLES.map((r) => ({ value: r, label: r }))} />
                  <th /><th />
                  <FilterTh value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUSES.map((s) => ({ value: s, label: fmtStatus(s) }))} />
                  <th /><th /><th />
                  <FilterTh value={owner} onChange={(v) => { setOwner(v); setPage(1); }} options={ownerOpts} />
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {rows.map((c) => {
                  const full = `${c.first_name} ${c.last_name}`;
                  const attention = Number(c.docs_attention ?? 0) > 0;
                  return (
                    <tr key={c.id} className="grid-row cursor-pointer" onClick={() => navigate(`/candidates/${c.id}`)}>
                      <td className="px-4 py-2.5">
                        <Link to={`/candidates/${c.id}`} className="group flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Avatar name={full} photoId={c.photo_file_id} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink group-hover:text-brand-600">{full}</p>
                            {c.nmc_pin && <p className="truncate text-[11px] text-slate-400">NMC {c.nmc_pin}</p>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{c.role}</td>
                      <td className="px-4 py-2.5">
                        <p className="truncate text-xs text-slate-600">{c.email ?? '—'}</p>
                        <p className="truncate text-[11px] text-slate-400">{c.phone ?? ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-slate-600">{c.town ?? '—'}</p>
                        <p className="text-[11px] text-slate-400">{c.postcode ?? ''}</p>
                      </td>
                      <td className="px-4 py-2.5"><Badge value={c.status} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <ComplianceBar score={c.compliance_score} />
                          {attention && <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-label="Documents need attention" />}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">
                        {c.pay_min || c.pay_max ? `${gbp2(c.pay_min ?? c.pay_max)}${c.pay_min && c.pay_max ? `–${gbp2(c.pay_max)}` : ''}/hr` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.rating ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(c.rating).toFixed(1)}
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.owner_name ? (
                          <span className="flex items-center gap-2">
                            <Avatar initials={c.owner_initials} color={c.owner_color} photoId={c.owner_photo_file_id} size="xs" />
                            <span className="truncate text-xs text-slate-600">{c.owner_name}</span>
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{fmtDate(c.registered_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <EmptyState icon={<Users className="h-5 w-5" />} title="No candidates found" hint="Try adjusting your search or filters." />}
          </div>
        )}
        {rows && <Pagination page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={(n) => { setLimit(n); setPage(1); }} label="candidates" />}
      </Card>

      <Modal
        open={showAdd} onClose={closeAdd} size="lg"
        title={step === 'docs' ? 'Compliance requirements' : step === 'photo' ? 'Add a profile photo' : step === 'login' ? 'Portal login' : 'Add Candidate'}
        subtitle={
          step === 'docs' ? 'Record what the worker has now — anything left is logged and flagged on their profile.'
          : step === 'photo' ? 'Optional — you can do this later from the profile.'
          : step === 'login' ? 'Give them a sign-in so they can see shifts, offers and documents in the worker portal — or skip and do it later from Settings → Accounts.'
          : 'Core details now; documents and compliance later.'}
        icon={<UserPlus className="h-4 w-4" />}
        footer={step === 'docs' ? (
          <>
            <button className={btnGhost} onClick={proceedFromDocs}>
              {reqs.every((t) => recorded.has(t)) ? 'Continue' : 'Skip for now (logged)'}
            </button>
            <button className={btnPrimary} onClick={proceedFromDocs}>Continue</button>
          </>
        ) : step === 'photo' ? (
          <>
            <button className={btnGhost} onClick={closeAdd}>Skip all</button>
            <button className={btnPrimary} onClick={() => setStep('login')}>Continue</button>
          </>
        ) : step === 'login' ? (
          <>
            {!loginSaved && <button className={btnGhost} onClick={closeAdd}>Skip</button>}
            <button className={btnPrimary} onClick={() => { closeAdd(); navigate(`/candidates/${created!.id}`); }}>
              {loginSaved ? 'Done — open profile' : 'Done'}
            </button>
          </>
        ) : (
          <>
            <button className={btnGhost} onClick={closeAdd}>Cancel</button>
            <button className={btnPrimary} disabled={saving || !form.first_name.trim() || !form.last_name.trim()} onClick={submit}>
              {saving ? 'Saving…' : 'Create candidate'}
            </button>
          </>
        )}
      >
        {step === 'docs' && created ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              <span className="font-medium text-ink">{created.first_name} {created.last_name}</span> needs these on file
              before they can be booked. Record what you have — the rest stays flagged on the profile.
            </p>
            <ul className="divide-y divide-slate-200/60 rounded-xl border border-slate-200/70">
              {reqs.map((t) => {
                const done = recorded.has(t);
                const open = openReq === t;
                return (
                  <li key={t} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        {done
                          ? <CircleCheck className="h-4 w-4 text-emerald-500" />
                          : <FileWarning className="h-4 w-4 text-amber-500" />}
                        {t}
                        {done && <span className="text-[10px] font-semibold uppercase text-emerald-600">recorded</span>}
                      </p>
                      {!done && (
                        <button className="text-xs font-medium text-brand-600 hover:underline"
                          onClick={() => { setOpenReq(open ? null : t); setReqErr(''); }}>
                          {open ? 'Close' : 'Record'}
                        </button>
                      )}
                    </div>
                    {open && !done && (
                      <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg bg-slate-900/[0.03] p-2.5 sm:grid-cols-2">
                        <Field label="Issue date"><input type="date" className={inputCls} value={reqForm.issue_date}
                          onChange={(e) => setReqForm({ ...reqForm, issue_date: e.target.value })} /></Field>
                        <Field label="Expiry date"><input type="date" className={inputCls} value={reqForm.expiry_date}
                          onChange={(e) => setReqForm({ ...reqForm, expiry_date: e.target.value })} /></Field>
                        <Field label="Reference"><input className={inputCls} value={reqForm.reference_no}
                          onChange={(e) => setReqForm({ ...reqForm, reference_no: e.target.value })} /></Field>
                        <Field label="Document file" hint="optional">
                          <input type="file" className="w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-500/10 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-700"
                            onChange={(e) => setReqForm({ ...reqForm, file: e.target.files?.[0] ?? null })} />
                        </Field>
                        <div className="flex justify-end sm:col-span-2">
                          <button className={btnPrimary} disabled={reqSaving} onClick={() => recordReq(t)}>
                            {reqSaving ? 'Saving…' : 'Save record'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {reqErr && <p className="text-xs font-medium text-red-600">{reqErr}</p>}
            <p className="text-[11px] text-slate-400">
              Records are added as <em>pending</em> — compliance marks them valid after review. Sites may add extra requirements.
            </p>
          </div>
        ) : step === 'photo' && created ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <PhotoUpload endpoint={`/candidates/${created.id}/photo`} name={`${created.first_name} ${created.last_name}`} photoId={created.photo_file_id}
              onDone={() => api.get<{ photo_file_id: number }>(`/candidates/${created.id}`).then((c) => setCreated({ ...created, photo_file_id: c.photo_file_id })).then(load)} />
            <p className="text-sm font-medium text-ink">{created.first_name} {created.last_name}</p>
            <p className="text-xs text-slate-500">Click the avatar to upload a photo (JPG/PNG, under 3MB).</p>
          </div>
        ) : step === 'login' && created ? (
          <div className="space-y-3">
            {loginSaved ? (
              <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
                <p className="font-semibold">Login created for {loginForm.email}</p>
                <p className="mt-1 text-xs">They sign in on the main login page and must choose their own password on first sign-in. You'll find the account under Settings → Accounts.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Login email *"><input type="email" className={inputCls} value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} /></Field>
                  <Field label="Temporary password *" hint="min 8 chars — they'll be asked to change it">
                    <input type="text" className={inputCls} value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /></Field>
                </div>
                {loginErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{loginErr}</p>}
                <div className="flex justify-end">
                  <button className={btnPrimary} disabled={loginBusy || !loginForm.email.trim() || loginForm.password.length < 8} onClick={createLogin}>
                    {loginBusy ? 'Creating…' : 'Create login'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First name *"><input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
            <Field label="Last name *"><input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
            <Field label="Role">
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="NMC PIN" hint="Nurses only"><input className={inputCls} value={form.nmc_pin} onChange={(e) => setForm({ ...form, nmc_pin: e.target.value })} /></Field>
            <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Town"><input className={inputCls} value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} /></Field>
            <Field label="Postcode"><input className={inputCls} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></Field>
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
            {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 sm:col-span-2">{formError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
