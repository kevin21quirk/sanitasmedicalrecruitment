import { useCallback, useEffect, useState } from 'react';
import { Download, History, RefreshCw, Save, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { Card, CardHeader, PageHeader, PhotoUpload, Spinner, btnPrimary, btnGhost, inputCls } from '../components/ui';
import { useAuth } from '../lib/auth';

interface AuditRow {
  id: number; actor_name: string | null; action: string; entity_type: string | null;
  entity_id: number | null; detail: Record<string, unknown>; created_at: string;
}

const SETTING_LABELS: Record<string, { label: string; hint: string; type: 'number' | 'boolean' | 'json' | 'text' }> = {
  auto_ranking: { label: 'Automatic matching/ranking (3.8)', hint: 'Off by default — allocation is a human decision. Turn on only to sort the eligible list.', type: 'boolean' },
  night_uplift: { label: 'Night shift uplift ×', hint: '6.7 — applied to night/sleep-in shifts', type: 'number' },
  weekend_uplift: { label: 'Weekend uplift ×', hint: '6.7 — Saturday and Sunday', type: 'number' },
  bank_holiday_uplift: { label: 'Bank holiday uplift ×', hint: '6.7 — highest priority', type: 'number' },
  employers_ni_pct: { label: 'Employer NI %', hint: '6.12 margin model', type: 'number' },
  payroll_fee_per_worker_week: { label: 'Payroll fee / worker / shift £', hint: '6.12 margin model', type: 'number' },
  reminder_days: { label: 'Reminder windows (days)', hint: '2.2 — e.g. [60,30,14,7]', type: 'json' },
  monthly_digest: { label: 'Monthly compliance digest', hint: '2.2 — queues a digest to the outbox', type: 'boolean' },
  retention_never_worked_months: { label: 'Auto-delete never-worked after (months)', hint: '8.5 retention', type: 'number' },
  registration_ack_subject: { label: 'Registration ack — subject', hint: '1.4', type: 'text' },
  registration_ack_body: { label: 'Registration ack — body', hint: '1.4 — {name} is replaced with the first name', type: 'text' },
  registration_fields: { label: 'Registration custom fields', hint: '1.2 — JSON array of {key,label,type,options?}', type: 'json' },
};

interface AccountRow {
  id: number; kind: string; email: string; is_active: boolean; last_login_at: string | null;
  user_id: number | null; candidate_id: number | null; client_id: number | null;
  staff_name: string | null; access_role: string | null; worker_name: string | null;
  client_name: string | null; contact_name: string | null;
}

export default function Settings() {
  const { account, refresh } = useAuth();
  const isAdmin = account?.accessRole === 'admin';
  const [tab, setTab] = useState<'profile' | 'accounts' | 'settings' | 'audit' | 'data'>('profile');
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [dirty, setDirty] = useState<Record<string, any>>({});
  const [auditRows, setAuditRows] = useState<AuditRow[] | null>(null);
  const [auditFilter, setAuditFilter] = useState('');
  const [purgePreview, setPurgePreview] = useState<any | null>(null);

  const load = useCallback(() => {
    api.get<Record<string, any>>('/admin/settings').then(setSettings).catch(() => setSettings({}));
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadAudit = useCallback(() => {
    api.get<AuditRow[]>(`/admin/audit${auditFilter ? `?action=${encodeURIComponent(auditFilter)}` : ''}`)
      .then(setAuditRows).catch(() => setAuditRows([]));
  }, [auditFilter]);

  const save = async () => {
    try {
      const parsed: Record<string, any> = {};
      for (const [k, v] of Object.entries(dirty)) {
        parsed[k] = SETTING_LABELS[k]?.type === 'json' ? JSON.parse(v) : v;
      }
      await api.put('/admin/settings', parsed);
      setDirty({});
      load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Save failed (check JSON)'); }
  };

  const purge = async (apply: boolean) => {
    const res = await api.post('/admin/retention/purge-never-worked', { dry_run: !apply });
    setPurgePreview(res);
    if (apply) setPurgePreview(null);
  };

  const exportAll = () => window.open('/api/admin/export-all', '_blank');

  const sar = async () => {
    const id = window.prompt('Candidate ID for the data export/erasure?');
    if (!id) return;
    const which = window.prompt('Type "export" for a copy, or "erase" to anonymise (admin only):');
    try {
      if (which === 'export') {
        const data = await api.get(`/admin/candidates/${id}/export`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `sar-candidate-${id}.json`; a.click();
      } else if (which === 'erase') {
        if (!window.confirm(`Permanently anonymise candidate ${id}? Signed timesheets keep legal references.`)) return;
        await api.post(`/admin/candidates/${id}/erase`, {});
        alert('Erased.');
      }
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Settings & data" subtitle="Your profile, accounts, configuration, audit trail and data rights">
        <div className="flex gap-1 rounded-xl bg-slate-900/5 p-1">
          {(['profile', 'accounts', 'settings', 'audit', 'data'] as const).map((t) => (
            <button key={t} disabled={!['profile', 'accounts'].includes(t) && !isAdmin}
              onClick={() => { setTab(t); if (t === 'audit' && !auditRows) loadAudit(); }}
              className={clsx('rounded-lg px-4 py-1.5 text-xs font-medium capitalize disabled:opacity-40',
                tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'audit' ? 'Audit log' : t === 'data' ? 'Data rights' : t === 'settings' ? 'Settings' : t === 'profile' ? 'My profile' : 'Accounts'}
            </button>
          ))}
        </div>
      </PageHeader>

      {tab === 'profile' && account && (
        <Card className="max-w-xl">
          <CardHeader title="My profile" subtitle="How you appear across the system" />
          <div className="flex items-center gap-5 px-5 py-5">
            <PhotoUpload endpoint={`/users/${account.userId}/photo`} name={account.name} photoId={account.photoFileId} color={account.color} size="xl" onDone={refresh} />
            <div>
              <p className="font-display text-lg font-semibold text-ink">{account.name}</p>
              <p className="text-sm text-slate-500">{account.email}</p>
              <p className="mt-1 text-xs capitalize text-slate-400">{account.accessRole} access</p>
              <p className="mt-3 text-[11px] text-slate-400">Click the avatar to upload a photo (JPG/PNG, under 3MB).</p>
            </div>
          </div>
        </Card>
      )}

      {tab === 'accounts' && <AccountsTab isAdmin={isAdmin} />}

      {tab === 'settings' && (
        <Card>
          <CardHeader title="Configuration" subtitle="Changes apply immediately and are audited"
            action={<button className={btnPrimary} disabled={!Object.keys(dirty).length} onClick={save}><Save className="h-4 w-4" /> Save</button>} />
          {!settings ? <Spinner /> : (
            <div className="divide-y divide-slate-200/50">
              {Object.entries(SETTING_LABELS).map(([key, meta]) => {
                const val = key in dirty ? dirty[key] : settings[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{meta.label}</p>
                      <p className="text-[11px] text-slate-400">{meta.hint}</p>
                    </div>
                    <div className="w-64 shrink-0">
                      {meta.type === 'boolean' ? (
                        <select className={inputCls} value={String(!!val)} onChange={(e) => setDirty({ ...dirty, [key]: e.target.value === 'true' })}>
                          <option value="true">On</option><option value="false">Off</option>
                        </select>
                      ) : meta.type === 'number' ? (
                        <input type="number" step="0.01" className={inputCls} value={val ?? ''}
                          onChange={(e) => setDirty({ ...dirty, [key]: +e.target.value })} />
                      ) : meta.type === 'json' ? (
                        <input className={inputCls} value={typeof val === 'string' ? val : JSON.stringify(val)}
                          onChange={(e) => setDirty({ ...dirty, [key]: e.target.value })} />
                      ) : meta.type === 'text' && key.includes('body') ? (
                        <textarea rows={2} className={clsx(inputCls, 'resize-none text-xs')} value={val ?? ''}
                          onChange={(e) => setDirty({ ...dirty, [key]: e.target.value })} />
                      ) : (
                        <input className={inputCls} value={val ?? ''} onChange={(e) => setDirty({ ...dirty, [key]: e.target.value })} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'audit' && (
        <Card>
          <CardHeader title="Audit log" subtitle="Who did what — allocations, approvals, rate changes, exports (8.9)"
            action={
              <div className="flex gap-2">
                <input className={clsx(inputCls, 'w-48')} placeholder="Filter action…" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} />
                <button className={btnGhost} onClick={loadAudit}><RefreshCw className="h-4 w-4" /></button>
              </div>
            } />
          {!auditRows ? <Spinner /> : (
            <ul className="scroll-thin max-h-[34rem] divide-y divide-slate-200/50 overflow-y-auto">
              {auditRows.map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink"><b>{a.actor_name ?? 'System'}</b> · {a.action}</span>
                    <span className="text-[11px] text-slate-400">{fmtDateTime(a.created_at)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {a.entity_type && `${a.entity_type} #${a.entity_id}`}
                    {Object.keys(a.detail ?? {}).length > 0 && ` · ${JSON.stringify(a.detail)}`}
                  </p>
                </li>
              ))}
              {!auditRows.length && <li className="px-5 py-6 text-center text-xs text-slate-400">No audit entries yet.</li>}
            </ul>
          )}
        </Card>
      )}

      {tab === 'data' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Full data export" subtitle="Everything the agency owns — records, bookings, audit, documents list (0.6/8.7)" />
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500">Exports every table as JSON — free, any time, in a form another supplier can import.</p>
              <button className={btnPrimary + ' mt-3'} onClick={exportAll}><Download className="h-4 w-4" /> Download full export</button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Worker data request" subtitle="Export or erase one worker's data (8.6)" />
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500">Erasure anonymises the record; signed timesheets keep their legal references. Blocked while the worker has upcoming shifts.</p>
              <button className={btnGhost + ' mt-3'} onClick={sar}><Download className="h-4 w-4" /> SAR / erasure</button>
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Retention — never-worked candidates" subtitle="Auto-delete per the configured window (8.5)" />
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <button className={btnGhost} onClick={() => purge(false)}><History className="h-4 w-4" /> Preview purge</button>
                {purgePreview && (
                  <>
                    <p className="text-xs text-slate-600">
                      <b>{purgePreview.count}</b> candidate{purgePreview.count !== 1 ? 's' : ''} never worked and older than {purgePreview.months} months
                    </p>
                    <button className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700"
                      onClick={() => { if (window.confirm(`Delete ${purgePreview.count} never-worked candidates? This cannot be undone.`)) purge(true); }}>
                      <Trash2 className="h-4 w-4" /> Delete {purgePreview.count}
                    </button>
                  </>
                )}
              </div>
              {!!purgePreview?.candidates?.length && (
                <ul className="mt-3 max-h-40 overflow-y-auto text-xs text-slate-500">
                  {purgePreview.candidates.map((c: any) => <li key={c.id}>#{c.id} {c.name}</li>)}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Login accounts for workers, client contacts and supervisors ───────────
function AccountsTab({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<AccountRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ kind: 'worker', email: '', password: '', candidate_id: '', client_id: '', contact_id: '', user_id: '', access_role: 'office' });
  const [candidates, setCandidates] = useState<{ id: number; label: string }[]>([]);
  const [clients, setClients] = useState<{ id: number; label: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: number; label: string }[]>([]);
  const [users, setUsers] = useState<{ id: number; label: string }[]>([]);

  const load = useCallback(() => {
    api.get<AccountRow[]>('/accounts').then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!creating) return;
    api.get<{ data: any[] }>('/candidates?limit=500')
      .then((r) => setCandidates((r.data ?? r as any).map((c: any) => ({ id: c.id, label: `${c.first_name} ${c.last_name}` })))).catch(() => {});
    api.get<any[]>('/clients').then((r) => setClients(r.map((c) => ({ id: c.id, label: c.name })))).catch(() => {});
    api.get<any[]>('/users').then((r) => setUsers(r.map((u) => ({ id: u.id, label: u.name })))).catch(() => {});
  }, [creating]);

  useEffect(() => {
    if (f.kind === 'client' && f.client_id) {
      api.get<any>(`/clients/${f.client_id}`)
        .then((r) => setContacts((r.contacts ?? []).map((c: any) => ({ id: c.id, label: `${c.name}${c.is_signatory ? ' ✓signatory' : ''}` })))).catch(() => setContacts([]));
    }
  }, [f.kind, f.client_id]);

  const create = async () => {
    try {
      await api.post('/accounts', {
        kind: f.kind, email: f.email, password: f.password,
        candidate_id: f.candidate_id ? +f.candidate_id : null,
        client_id: f.client_id ? +f.client_id : null,
        contact_id: f.contact_id ? +f.contact_id : null,
        user_id: f.user_id ? +f.user_id : null,
      });
      if (f.kind === 'staff' && f.user_id) {
        await api.patch(`/accounts/users/${f.user_id}/access`, { access_role: f.access_role }).catch(() => {});
      }
      setCreating(false);
      setF({ ...f, email: '', password: '' });
      load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const toggle = async (a: AccountRow) => {
    await api.patch(`/accounts/${a.id}`, { is_active: !a.is_active });
    load();
  };

  if (!rows) return <Spinner />;
  return (
    <Card>
      <CardHeader title="Login accounts" subtitle="Issue and revoke portal logins — deactivation kills live sessions instantly (5.3)"
        action={<button className={btnPrimary} onClick={() => setCreating(true)}>New account</button>} />
      <ul className="divide-y divide-slate-200/50">
        {rows.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-5 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">
                {a.staff_name ?? a.worker_name ?? a.contact_name ?? a.client_name ?? a.email}
                <span className="ml-2 text-[11px] font-normal text-slate-400">{a.email}</span>
              </p>
              <p className="text-[11px] text-slate-400">
                {a.kind}{a.access_role ? ` · ${a.access_role}` : ''}{a.client_name && ` · ${a.client_name}`}
                {a.last_login_at && ` · last login ${fmtDateTime(a.last_login_at)}`}
              </p>
            </div>
            <button className={a.is_active ? 'text-xs text-slate-400 hover:text-red-500' : 'text-xs text-emerald-600 hover:underline'}
              onClick={() => toggle(a)}>
              {a.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </li>
        ))}
      </ul>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">New login account</h2>
            <div className="mt-4 space-y-3">
              <select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="worker">Worker portal</option>
                <option value="client">Client contact / signatory</option>
                <option value="supervisor">Site supervisor (view only)</option>
                {isAdmin && <option value="staff">Office staff</option>}
              </select>
              {f.kind === 'worker' && (
                <select className={inputCls} value={f.candidate_id} onChange={(e) => setF({ ...f, candidate_id: e.target.value })}>
                  <option value="">Select worker…</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              {(f.kind === 'client' || f.kind === 'supervisor') && (
                <select className={inputCls} value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value, contact_id: '' })}>
                  <option value="">Select care home…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              {f.kind === 'client' && f.client_id && (
                <select className={inputCls} value={f.contact_id} onChange={(e) => setF({ ...f, contact_id: e.target.value })}>
                  <option value="">Contact (must be a signatory to sign timesheets)…</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              {f.kind === 'staff' && (
                <>
                  <select className={inputCls} value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
                    <option value="">Select staff member…</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                  <select className={inputCls} value={f.access_role} onChange={(e) => setF({ ...f, access_role: e.target.value })}>
                    {['office', 'compliance', 'finance', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </>
              )}
              <input className={inputCls} type="email" placeholder="Login email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <input className={inputCls} type="password" placeholder="Temporary password (min 8 chars)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setCreating(false)}>Cancel</button>
              <button className={btnPrimary} onClick={create} disabled={!f.email || f.password.length < 8}>Create</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
