import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Plus, RefreshCw } from 'lucide-react';
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
interface MarginLine { shift_id: number; date: string; worker: string; client: string; hours: number; charge: number; pay: number; ni: number; fee: number; margin: number }

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

  const setStatus = async (id: number, status: string) => {
    await api.patch(`/invoices/${id}`, { status });
    load();
  };
  const openDetail = async (id: number) => setDetail(await api.get(`/invoices/${id}`));

  return (
    <div>
      <PageHeader title="Invoicing & payroll" subtitle="Invoices build only from approved timesheets (6.10c).">
        <button className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" /></button>
        <button className={btnPrimary} onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New invoice</button>
      </PageHeader>

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {(['invoices', 'debtors', 'payroll', 'margin'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('rounded-md px-4 py-1.5 text-xs font-medium capitalize',
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
              <ul className="divide-y divide-slate-50">
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
      {detail && <InvoiceDetail inv={detail} onClose={() => setDetail(null)} />}
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
  const [f, setF] = useState({ client_id: '', from: '', to: '', due_days: 30 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.post('/invoices', { ...f, client_id: +f.client_id });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold">Generate invoice</h2>
        <p className="mt-1 text-xs text-slate-500">Pulls all approved, uninvoiced timesheets for the client in the period (6.6).</p>
        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Client</span>
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
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={saving || !f.client_id || !f.from || !f.to} onClick={save}>{saving ? 'Building…' : 'Generate'}</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetail({ inv, onClose }: { inv: Invoice & { lines: any[]; client_address?: string; billing_email?: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">{inv.number}</h2>
            <p className="text-xs text-slate-500">{inv.client_name} · issued {fmtDate(inv.issue_date)} · due {fmtDate(inv.due_date)}</p>
          </div>
          <Badge value={inv.status} />
        </div>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
            <th className="py-2">Description</th><th>Hours</th><th>Rate</th><th className="text-right">Amount</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
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
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Close</button>
          <button className={btnGhost} onClick={() => window.print()}>Print / PDF</button>
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
        <ul className="divide-y divide-slate-50">
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

function Payroll() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any | null>(null);
  const run = () => api.get(`/payroll?from=${from}&to=${to}`).then(setData).catch(() => setData(null));
  useEffect(() => { void run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const csv = () => window.open(`/api/payroll?from=${from}&to=${to}&format=csv`, '_blank');
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Payroll export" subtitle="PAYE and Limited-company workers split automatically (6.8)" />
        <div className="flex flex-wrap items-end gap-2 px-5 py-4">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          <button className={btnPrimary} onClick={run}>Run</button>
          <button className={btnGhost} onClick={csv}><Download className="h-4 w-4" /> CSV</button>
        </div>
      </Card>
      {data && ['paye', 'ltd'].map((group) => (
        <Card key={group}>
          <CardHeader title={group === 'paye' ? 'PAYE workers' : 'Limited company workers'}
            subtitle={group === 'paye'
              ? `${data.totals.paye_hours}h · ${gbp2(data.totals.paye_amount)}`
              : `${data.totals.ltd_hours}h · ${gbp2(data.totals.ltd_amount)}`} />
          <ul className="divide-y divide-slate-50">
            {(group === 'paye' ? data.paye : data.ltd).map((o: any) => (
              <li key={o.shift_id} className="flex items-center justify-between px-5 py-2 text-sm">
                <span className="text-ink">{o.worker} <span className="text-[11px] text-slate-400">· {fmtDate(o.date)} · {fmtStatus(o.shift_type)}{o.uplift > 1 ? ` · ${o.uplift}× uplift` : ''}</span></span>
                <span className="text-xs text-slate-600">{o.hours}h × {gbp2(o.rate)} = <b>{gbp2(o.amount)}</b></span>
              </li>
            ))}
            {!(group === 'paye' ? data.paye : data.ltd).length && <li className="px-5 py-4 text-xs text-slate-400">None in this period.</li>}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Margin() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ lines: MarginLine[]; totals: any } | null>(null);
  const run = () => api.get<{ lines: MarginLine[]; totals: any }>(`/margin?from=${from}&to=${to}`).then(setData).catch(() => setData(null));
  useEffect(() => { void run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Margin per shift" subtitle="Charge minus pay, employer NI and payroll cost (6.12)" />
        <div className="flex flex-wrap items-end gap-2 px-5 py-4">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          <button className={btnPrimary} onClick={run}>Run</button>
        </div>
        {data && (
          <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-5">
            {[['Charge', data.totals.charge], ['Pay', data.totals.pay], ["Employer NI", data.totals.ni], ['Payroll fees', data.totals.fee], ['Margin', data.totals.margin]].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{k}</p>
                <p className={clsx('text-sm font-bold', k === 'Margin' ? 'text-emerald-600' : 'text-ink')}>{gbp2(v as number)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      {data && (
        <Card>
          <ul className="divide-y divide-slate-50">
            {data.lines.map((l) => (
              <li key={l.shift_id} className="flex items-center justify-between px-5 py-2 text-sm">
                <span className="text-ink">{fmtDate(l.date)} — {l.worker} <span className="text-[11px] text-slate-400">@ {l.client}</span></span>
                <span className="text-xs text-slate-600">{gbp2(l.charge)} − {gbp2(l.pay + l.ni + l.fee)} = <b className="text-emerald-600">{gbp2(l.margin)}</b></span>
              </li>
            ))}
            {!data.lines.length && <li className="px-5 py-4 text-xs text-slate-400">No approved timesheets in this period.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
