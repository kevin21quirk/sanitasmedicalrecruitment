import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, FileText, Plus, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDate, gbp2 } from '../lib/format';
import { Client } from '../lib/types';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Spinner, btnPrimary, btnGhost, inputCls, fmtStatus } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Invoice {
  id: number; client_id: number; client_name: string; number: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled'; issue_date: string; due_date: string | null;
  subtotal: string; days_overdue: number; sent_at: string | null; paid_at: string | null;
}
interface AgedRow { client_name: string; invoice_id: number; number: string; issue_date: string; due_date: string | null; subtotal: string; bucket: string }
interface MarginLine { shift_id: number; date: string; worker: string; client: string; hours: number | string; charge: number | string; pay: number | string; ni: number | string; fee: number | string; margin: number | string; multiplier?: string }

const BUCKET_STYLE: Record<string, string> = {
  current: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  '1-30': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  '31-60': 'bg-orange-50 text-orange-700 ring-orange-600/20',
  '60+': 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function Invoices() {
  const { account } = useAuth();
  const canFinance = account?.accessRole === 'admin' || account?.accessRole === 'finance';
  const [tab, setTab] = useState<'invoices' | 'debtors' | 'payroll' | 'margin'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<(Invoice & { lines: any[]; client_address?: string; billing_email?: string }) | null>(null);

  const load = useCallback(() => {
    api.get<Invoice[]>('/invoices').then(setInvoices).catch(() => setInvoices([]));
  }, []);
  useEffect(() => {
    load();
    api.get<Client[]>('/clients').then(setClients).catch(() => {});
  }, [load]);

  const setStatus = async (id: number, status: string, extra?: Record<string, unknown>) => {
    try {
      const res = await api.patch<Invoice & { mailto_link?: string }>(`/invoices/${id}`, { status, ...extra });
      if (res.mailto_link) window.open(res.mailto_link, '_blank');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };
  const openDetail = async (id: number) => {
    try { setDetail(await api.get(`/invoices/${id}`)); }
    catch (e) { alert(e instanceof Error ? e.message : 'Could not load invoice'); }
  };

  return (
    <div>
      <PageHeader title="Invoicing & payroll" subtitle="Invoices build only from approved timesheets (6.10c).">
        <button className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" /></button>
        <button className={btnPrimary} onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New invoice</button>
      </PageHeader>

      <div className="scroll-thin mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-900/5 p-1">
        {(['invoices', 'debtors', 'payroll', 'margin'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-medium capitalize',
              tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {t === 'debtors' ? 'Aged debtors' : t === 'payroll' ? 'Payroll export' : t === 'margin' ? 'Margin' : 'Invoices'}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        !invoices ? <Spinner /> : (
          <Card>
            {!invoices.length ? (
              <EmptyState icon={<FileText className="h-5 w-5" />} title="No invoices yet" hint="Approve timesheets, then generate an invoice per client." />
            ) : (
              <ul className="divide-y divide-slate-200/50">
                {invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <button className="text-left" onClick={() => openDetail(i.id)}>
                      <p className="text-sm font-medium text-ink hover:text-brand-600">{i.number} — {i.client_name}</p>
                      <p className="text-xs text-slate-500">
                        Issued {fmtDate(i.issue_date)}{i.due_date && ` · due ${fmtDate(i.due_date)}`}
                        {i.status !== 'paid' && i.status !== 'cancelled' && i.days_overdue > 0 && (
                          <span className="ml-1 text-red-600">{i.days_overdue}d overdue</span>
                        )}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{gbp2(i.subtotal)}</span>
                      <Badge value={i.status === 'paid' ? 'paid' : i.status === 'sent' ? 'sent' : i.status === 'draft' ? 'pending' : 'cancelled'} />
                      {i.status === 'draft' && <button className={btnGhost} onClick={() => setStatus(i.id, 'sent')}>Mark sent</button>}
                      {i.status === 'sent' && <button className={btnGhost} onClick={() => setStatus(i.id, 'paid')}>Mark paid</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      )}

      {tab === 'debtors' && (canFinance ? <AgedDebtors /> : <NoAccess />)}
      {tab === 'payroll' && (canFinance ? <Payroll /> : <NoAccess />)}
      {tab === 'margin' && (canFinance ? <Margin /> : <NoAccess />)}

      {newOpen && <NewInvoice clients={clients} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); load(); }} />}
      {detail && (
        <InvoiceDetail
          inv={detail}
          onClose={() => setDetail(null)}
          onChanged={() => { load(); openDetail(detail.id); }}
        />
      )}
    </div>
  );
}

function NoAccess() {
  return (
    <Card className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">Finance/admin role required (8.4)</p>
      <p className="mt-1 text-xs text-slate-400">Payroll, margin and debtor data are restricted to the finance and admin roles.</p>
    </Card>
  );
}

function NewInvoice({ clients, onClose, onSaved }: { clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ client_id: '', from: '', to: '', due_days: 30, notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.post('/invoices', { ...f, client_id: +f.client_id, notes: f.notes || undefined });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold">Generate invoice</h2>
        <p className="mt-1 text-xs text-slate-500">Pulls all approved, uninvoiced timesheets for the client in the period (6.6).</p>
        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Client</span>
            <select className={inputCls} value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
              <option value="">Select…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">From</span>
            <input type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">To</span>
            <input type="date" className={inputCls} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Payment terms (days)</span>
            <input type="number" className={inputCls} value={f.due_days} onChange={(e) => setF({ ...f, due_days: +e.target.value })} /></label>
          <label className="sm:col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</span>
            <input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. October week 2 invoice" /></label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={saving || !f.client_id || !f.from || !f.to} onClick={save}>{saving ? 'Building…' : 'Generate'}</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetail({ inv, onClose, onChanged }: {
  inv: Invoice & { lines: any[]; client_address?: string; billing_email?: string; notes?: string | null };
  onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));

  const act = async (status: string, extra?: Record<string, unknown>) => {
    setBusy(true); setErr('');
    try {
      const res = await api.patch<{ mailto_link?: string }>(`/invoices/${inv.id}`, { status, ...extra });
      if (res.mailto_link) window.open(res.mailto_link, '_blank');
      onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete draft invoice ${inv.number}? Its shifts become invoiceable again.`)) return;
    setBusy(true); setErr('');
    try { await api.del(`/invoices/${inv.id}`); onChanged(); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  };
  const cancel = () => {
    if (!window.confirm(`Cancel invoice ${inv.number}? The shifts will be released for re-invoicing.`)) return;
    void act('cancelled');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">{inv.number}</h2>
            <p className="text-xs text-slate-500">{inv.client_name} · issued {fmtDate(inv.issue_date)} · due {fmtDate(inv.due_date)}</p>
            {inv.status === 'paid' && inv.paid_at && <p className="mt-0.5 text-xs text-emerald-600">Paid {fmtDate(inv.paid_at)}</p>}
            {inv.billing_email && <p className="mt-0.5 text-xs text-slate-400">Bills to {inv.billing_email}</p>}
          </div>
          <Badge value={inv.status} />
        </div>
        {inv.notes && <p className="mt-2 rounded-lg bg-slate-900/[0.035] px-3 py-2 text-xs text-slate-600">{inv.notes}</p>}
        <div className="scroll-thin mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200/60 text-left text-[10px] uppercase tracking-wide text-slate-400">
            <th className="py-2">Description</th><th>Hours</th><th>Rate</th><th className="text-right">Amount</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200/50">
            {inv.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2 pr-2 text-xs text-ink">{l.description}</td>
                <td className="text-xs">{l.hours}</td>
                <td className="text-xs">{gbp2(l.rate)}</td>
                <td className="text-right text-xs font-medium">{gbp2(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-slate-200">
            <td colSpan={3} className="py-2 text-xs font-semibold text-slate-500">Total</td>
            <td className="text-right text-sm font-bold text-ink">{gbp2(inv.subtotal)}</td>
          </tr></tfoot>
        </table>
        </div>
        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
        {inv.status === 'sent' && (
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            Payment received on
            <input type="date" className={clsx(inputCls, 'w-auto')} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </label>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {inv.status === 'draft' && (
            <>
              <button className={btnGhost} disabled={busy} onClick={remove}>Delete draft</button>
              <button className={btnPrimary} disabled={busy} onClick={() => act('sent')}>
                {inv.billing_email ? 'Send to client' : 'Mark sent'}
              </button>
            </>
          )}
          {inv.status === 'sent' && (
            <button className={btnPrimary} disabled={busy} onClick={() => act('paid', { paid_date: paidDate })}>Mark paid</button>
          )}
          {(inv.status === 'draft' || inv.status === 'sent') && (
            <button className={btnGhost} disabled={busy} onClick={cancel}>Cancel invoice</button>
          )}
          <button className={btnGhost} onClick={() => window.open(`/invoices/${inv.id}/print`, '_blank')}>Print / PDF</button>
          <button className={btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AgedDebtors() {
  const [rows, setRows] = useState<AgedRow[] | null>(null);
  useEffect(() => { api.get<AgedRow[]>('/invoices/aged-debtors').then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <Spinner />;
  const buckets = ['current', '1-30', '31-60', '60+'];
  const totals = Object.fromEntries(buckets.map((b) => [b, rows.filter((r) => r.bucket === b).reduce((s, r) => s + +r.subtotal, 0)]));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {buckets.map((b) => (
          <Card key={b} className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{b === 'current' ? 'Not yet due' : `${b} days`}</p>
            <p className="mt-1 text-lg font-bold text-ink">{gbp2(totals[b])}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Outstanding invoices" subtitle="6.11 — chase anything past 30 days" />
        <ul className="divide-y divide-slate-200/50">
          {rows.map((r) => (
            <li key={r.invoice_id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{r.number} — {r.client_name}</p>
                <p className="text-xs text-slate-500">Due {r.due_date ? fmtDate(r.due_date) : '—'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-ink">{gbp2(r.subtotal)}</span>
                <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', BUCKET_STYLE[r.bucket])}>
                  {r.bucket === 'current' ? 'current' : `${r.bucket}d`}
                </span>
              </div>
            </li>
          ))}
          {!rows.length && <li className="px-5 py-4 text-xs text-slate-400">No outstanding invoices.</li>}
        </ul>
      </Card>
    </div>
  );
}

interface PayrollPreview {
  format: string; columns: string[]; paye: PayrollRow[]; ltd: PayrollRow[];
  rejected: { paye: RejectedRow[]; ltd: RejectedRow[] };
  totals: { paye_hours: number; paye_amount: number | string; ltd_hours: number; ltd_amount: number | string };
}
interface PayrollRow { shift_id: number; worker: string; payroll_ref: string | null; date: string; shift_type: string; hours: string | null; uplift_rule: string; uplift_multiplier: string; amount: string; client: string }
interface RejectedRow extends PayrollRow { reasons: string[]; already_exported?: boolean }
interface PayrollRun { id: number; engagement: string; period_from: string; period_to: string; shift_count: number; total: string; rejected: { shift_id: number; reasons: string[] }[]; created_by_name?: string; created_at: string }

function Payroll() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<PayrollPreview | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const loadRuns = () => api.get<PayrollRun[]>('/payroll/runs').then(setRuns).catch(() => {});
  const run = async (open = false) => {
    setPreviewing(true); setErr(''); setNotice('');
    try {
      const d = await api.get<PayrollPreview>(`/payroll?from=${from}&to=${to}`);
      setData(d);
      if (open) setPreviewOpen(true);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Preview failed'); }
    finally { setPreviewing(false); }
  };
  useEffect(() => { void run(); void loadRuns(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doExport = async (engagement: 'paye' | 'ltd') => {
    setExporting(engagement); setErr('');
    try {
      const res = await api.post<{ run: PayrollRun; rejected: RejectedRow[] }>(`/payroll/export`, { from, to, engagement });
      window.open(`/api/payroll/runs/${res.run.id}/csv`, '_blank');
      setPreviewOpen(false);
      setNotice(`Exported ${res.run.shift_count} ${engagement.toUpperCase()} shifts — run #${res.run.id} (${gbp2(res.run.total)}). CSV opened in a new tab.`);
      void run(); void loadRuns();
    } catch (e) { setErr((e as Error).message); }
    finally { setExporting(null); }
  };

  const groupCard = (key: 'paye' | 'ltd', title: string, sub: string) => {
    const rows = data?.[key] ?? [];
    const rejected = data?.rejected[key] ?? [];
    return (
      <Card key={key}>
        <CardHeader title={title} subtitle={sub}
          action={<button className={btnPrimary} disabled={exporting === key || !rows.length} onClick={() => doExport(key)}>
            <Download className="h-4 w-4" /> {exporting === key ? 'Exporting…' : `Export CSV (${rows.length})`}
          </button>} />
        <ul className="divide-y divide-slate-200/50">
          {rows.map((o) => (
            <li key={o.shift_id} className="flex items-center justify-between px-5 py-2 text-sm">
              <span className="text-ink">{o.worker} <span className="text-[11px] text-slate-400">· {o.payroll_ref ?? 'no ref'} · {fmtDate(o.date)} · {fmtStatus(o.shift_type)}{o.uplift_rule && o.uplift_rule !== 'none' ? ` · ${o.uplift_rule} ×${o.uplift_multiplier}` : ''}</span></span>
              <span className="text-xs text-slate-600">{o.hours}h = <b>{gbp2(o.amount)}</b></span>
            </li>
          ))}
          {!rows.length && <li className="px-5 py-4 text-xs text-slate-400">None exportable in this period.</li>}
          {rejected.map((r2) => (
            <li key={r2.shift_id} className={clsx('flex items-center justify-between gap-3 px-5 py-2 text-sm', !r2.already_exported && 'bg-red-50/50')}>
              <span className={r2.already_exported ? 'text-slate-400' : 'text-ink'}>{r2.worker} <span className="text-[11px] text-slate-400">· {fmtDate(r2.date)}</span></span>
              {r2.already_exported
                ? <span className="text-[11px] text-slate-400">{r2.reasons.join('; ')}</span>
                : <span className="flex items-center gap-1 text-[11px] font-medium text-red-600"><AlertTriangle className="h-3 w-3" /> {r2.reasons.join('; ')}</span>}
            </li>
          ))}
        </ul>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Payroll export" subtitle="Preview is free — exporting stamps each shift so it can't be paid twice (6.8). Provisional column format." />
        <div className="flex flex-wrap items-end gap-2 px-5 py-4">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          <button className={btnPrimary} disabled={previewing} onClick={() => run(true)}>{previewing ? 'Loading…' : 'Preview'}</button>
        </div>
        {err && <p className="mx-5 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        {notice && <p className="mx-5 mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{notice}</p>}
      </Card>
      {data && ['paye', 'ltd'].map((g) => groupCard(g as 'paye' | 'ltd',
        g === 'paye' ? 'PAYE workers' : 'Limited company workers',
        g === 'paye' ? `${data.totals.paye_hours}h · ${gbp2(data.totals.paye_amount)}` : `${data.totals.ltd_hours}h · ${gbp2(data.totals.ltd_amount)}`))}
      {!!runs.length && (
        <Card>
          <CardHeader title="Export history" subtitle="Each run is recorded and auditable; shifts can't appear in two runs" />
          <ul className="divide-y divide-slate-200/50">
            {runs.map((r2) => (
              <li key={r2.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-ink">Run #{r2.id} — {r2.engagement.toUpperCase()} · {fmtDate(r2.period_from)}–{fmtDate(r2.period_to)}
                  <span className="text-[11px] text-slate-400"> · {r2.shift_count} shifts · {gbp2(r2.total)} · {r2.rejected.length} rejected · by {r2.created_by_name}</span></span>
                <a href={`/api/payroll/runs/${r2.id}/csv`} className={btnGhost}><Download className="h-3.5 w-3.5" /> CSV</a>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {previewOpen && data && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:items-center" onClick={() => setPreviewOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto glass-pop rounded-3xl p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">Payroll preview</h2>
            <p className="mt-1 text-xs text-slate-500">
              {fmtDate(from)} – {fmtDate(to)} · provisional-v1 · PAYE {data.paye.length} rows ({data.totals.paye_hours}h · {gbp2(data.totals.paye_amount)}) · Ltd {data.ltd.length} rows ({data.totals.ltd_hours}h · {gbp2(data.totals.ltd_amount)})
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['paye', 'ltd'] as const).map((g) => {
                const accepted = data[g], rejected = data.rejected[g];
                return (
                  <div key={g} className="rounded-2xl bg-slate-900/[0.035] p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{g === 'paye' ? 'PAYE' : 'Ltd'} · {accepted.length} exportable</h3>
                      <button className={btnPrimary} disabled={exporting === g || !accepted.length} onClick={() => doExport(g)}>
                        {exporting === g ? 'Exporting…' : 'Export'}
                      </button>
                    </div>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {accepted.map((o) => (
                        <li key={o.shift_id} className="flex items-center justify-between text-xs">
                          <span className="text-ink">{o.worker} <span className="text-slate-400">· {fmtDate(o.date)}</span></span>
                          <span className="font-medium text-ink">{gbp2(o.amount)}</span>
                        </li>
                      ))}
                      {!accepted.length && <li className="text-[11px] text-slate-400">None exportable.</li>}
                    </ul>
                    {!!rejected.filter((r2) => !r2.already_exported).length && (
                      <div className="mt-2 border-t border-red-200/60 pt-2">
                        {rejected.filter((r2) => !r2.already_exported).map((r2) => (
                          <p key={r2.shift_id} className="flex items-start gap-1 text-[11px] text-red-600">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {r2.worker} · {fmtDate(r2.date)} — {r2.reasons.join('; ')}
                          </p>
                        ))}
                      </div>
                    )}
                    {!!rejected.filter((r2) => r2.already_exported).length && (
                      <div className="mt-2 border-t border-slate-200/60 pt-2">
                        {rejected.filter((r2) => r2.already_exported).map((r2) => (
                          <p key={r2.shift_id} className="text-[11px] text-slate-400">
                            {r2.worker} · {fmtDate(r2.date)} — {r2.reasons.join('; ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
            <div className="mt-4 flex justify-end">
              <button className={btnGhost} onClick={() => setPreviewOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MarginData {
  assumptions: Record<string, unknown> & { note?: string };
  totals: { charge: string; pay: string; ni: string; fee: string; margin: string; margin_pct: string | null; actual: number; estimated: number; unavailable: number };
  by_client: { client: string; charge: string; pay: string; margin: string; margin_pct: string | null; shifts: number }[];
  lines: (MarginLine & { basis: 'actual' | 'estimated' | 'unavailable'; problems: string[]; uplift: string | null; engagement: string })[];
}

const BASIS_STYLE = {
  actual: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  estimated: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  unavailable: 'bg-red-50 text-red-700 ring-red-600/20',
};

function Margin() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<MarginData | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setRunning(true); setErr('');
    try { setData(await api.get<MarginData>(`/margin?from=${from}&to=${to}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load margin'); }
    finally { setRunning(false); }
  };
  useEffect(() => { void run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Gross margin" subtitle="Charge minus pay, employer NI and bureau fee (6.12). Actual = frozen at approval; estimated = computed from today's settings." />
        <div className="flex flex-wrap items-end gap-2 px-5 py-4">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          <button className={btnPrimary} disabled={running} onClick={() => run()}>{running ? 'Running…' : 'Run'}</button>
        </div>
        {err && <p className="mx-5 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        {data && (
          <div className="px-5 pb-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              {[['Charge', data.totals.charge], ['Pay', data.totals.pay], ['Employer NI', data.totals.ni], ['Bureau fees', data.totals.fee], ['Margin', data.totals.margin], ['Margin %', data.totals.margin_pct ? `${data.totals.margin_pct}%` : '—']].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-slate-900/[0.035] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{k}</p>
                  <p className={clsx('text-sm font-bold', k === 'Margin' ? 'text-emerald-600' : 'text-ink')}>{k === 'Margin %' ? v : gbp2(v)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {data.totals.actual} actual · {data.totals.estimated} estimated · {data.totals.unavailable} unavailable
              {data.assumptions.note && ` · ${data.assumptions.note}`}
            </p>
          </div>
        )}
      </Card>
      {data && !!data.by_client.length && (
        <Card>
          <CardHeader title="By client" />
          <ul className="divide-y divide-slate-200/50">
            {data.by_client.map((c) => (
              <li key={c.client} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-medium text-ink">{c.client} <span className="text-[11px] text-slate-400">{c.shifts} shifts</span></span>
                <span className="text-xs text-slate-600">{gbp2(c.charge)} → <b className="text-emerald-600">{gbp2(c.margin)}</b>{c.margin_pct ? ` (${c.margin_pct}%)` : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data && (
        <Card>
          <CardHeader title="Per shift" />
          <ul className="divide-y divide-slate-200/50">
            {data.lines.map((l) => (
              <li key={l.shift_id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                <span className="min-w-0 text-ink">{fmtDate(l.date)} — {l.worker} <span className="text-[11px] text-slate-400">@ {l.client} · {l.engagement}</span>
                  {l.uplift && l.uplift !== 'none' && <span className="ml-1 text-[10px] text-accent-600">×{l.multiplier} {l.uplift}</span>}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset capitalize', BASIS_STYLE[l.basis])}>{l.basis}</span>
                  {l.basis === 'unavailable'
                    ? <span className="text-[11px] text-red-600">{l.problems.join(', ')}</span>
                    : <span className="text-xs text-slate-600">{gbp2(l.charge)} − {gbp2(+l.pay + +l.ni + +l.fee)} = <b className="text-emerald-600">{gbp2(l.margin)}</b></span>}
                </span>
              </li>
            ))}
            {!data.lines.length && <li className="px-5 py-4 text-xs text-slate-400">No completed shifts in this period.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
