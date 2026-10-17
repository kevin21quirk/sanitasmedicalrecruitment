import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlugZap, UploadCloud, RefreshCw, Trash2, FileDown, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { requestStage, stageOf } from '../lib/pipeline';
import { Client, ShiftRequest } from '../lib/types';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Spinner, btnGhost, btnPrimary, fmtStatus, inputCls } from '../components/ui';

interface Connection { endpoint: string; org_ref: string | null; has_key: boolean; saved_at: string }
interface Batch { id: number; filename: string; row_count: number; status: string; summary: any; created_at: string; committed_at: string | null }
interface Status {
  beta: boolean; api_note: string;
  connection: Connection | null;
  stats: { imported: string; open: string; filled: string; last_imported: string | null };
  batches: Batch[];
}
interface ImportRow {
  row: number; reference: string | null; client_id: number | null; client: string | null;
  date: string | null; shift_type: string; start_time: string | null; end_time: string | null;
  hours: number | null; role: string | null; qty: number; urgency: string; notes: string | null;
  action: 'insert' | 'reject'; errors: string[]; warnings: string[];
}
interface Preview { batch_id: number; header: string[]; summary: { total: number; insert: number; reject: number }; rows: ImportRow[] }

const BETA = 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-300';

export default function Neuven() {
  const [status, setStatus] = useState<Status | null>(null);
  const [jobs, setJobs] = useState<ShiftRequest[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const load = useCallback(() => {
    api.get<Status>('/neuven/status').then(setStatus).catch(() => setStatus(null));
    api.get<ShiftRequest[]>('/neuven/jobs').then(setJobs).catch(() => setJobs([]));
    api.get<Client[]>('/clients').then(setClients).catch(() => {});
  }, []);
  useEffect(load, [load]);

  return (
    <div>
      <PageHeader title="Neuven feed" subtitle="Neutral-vendor shift feed — CSV import today, live API sync when Neuven grant access.">
        <span className={BETA}>Beta</span>
        <button className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" /></button>
      </PageHeader>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
        <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">
          Neuven don't publish a public API, so automatic sync needs an integration agreement with them.
          The connection profile below is ready for when that lands — <b>CSV import works today</b> and drops
          Neuven jobs straight into the allocation pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ConnectionCard connection={status?.connection ?? null} onChanged={load} />
        <ImportCard clients={clients} onDone={load} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Imported Neuven jobs" subtitle="They flow through the normal allocation pipeline."
            action={<Link to="/requests" className="text-xs font-medium text-brand-600 hover:text-brand-700">Pipeline →</Link>} />
          {!jobs ? <Spinner /> : !jobs.length ? (
            <EmptyState icon={<FileDown className="h-5 w-5" />} title="Nothing imported yet" hint="Preview a CSV above to bring in Neuven shifts." />
          ) : (
            <ul className="scroll-thin max-h-80 divide-y divide-slate-200/50 overflow-y-auto">
              {jobs.map((j) => {
                const st = stageOf(requestStage(j));
                return (
                  <li key={j.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {j.client_name} — {fmtDate(j.date)}
                        {j.external_ref && <span className="ml-1.5 text-[10px] text-slate-400">ref {j.external_ref}</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmtStatus(j.shift_type)}{j.role && ` · ${j.role}`}{j.qty > 1 && ` · ×${j.qty}`}
                        {j.filled_by && <span className="text-emerald-600"> · {j.filled_by}</span>}
                      </p>
                    </div>
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', st.chip)}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Import history" subtitle="Preview → commit batches (auditable)" />
          {!status ? <Spinner /> : !status.batches.length ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No imports yet</p>
          ) : (
            <ul className="divide-y divide-slate-200/50">
              {status.batches.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-ink">#{b.id} — {b.filename} <span className="text-[11px] text-slate-400">· {b.row_count} rows</span></span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{b.summary?.result?.inserted ?? b.summary?.insert ?? 0} created{b.summary?.result?.rejected ?? b.summary?.reject ? `, ${b.summary?.result?.rejected ?? b.summary?.reject} rejected` : ''}</span>
                    <Badge value={b.status === 'committed' ? 'approved' : b.status === 'discarded' ? 'cancelled' : 'pending'} label={b.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ConnectionCard({ connection, onChanged }: { connection: Connection | null; onChanged: () => void }) {
  const [f, setF] = useState({ endpoint: '', org_ref: '', api_key: '' });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ reachable: boolean; http_status: number | null; note: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { if (connection) setF((p) => ({ ...p, endpoint: connection.endpoint, org_ref: connection.org_ref ?? '' })); }, [connection]);

  const save = async () => {
    setBusy(true); setErr('');
    try { await api.post('/neuven/connect', f); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setTesting(true); setErr(''); setResult(null);
    try { setResult(await api.post('/neuven/sync', {})); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Test failed'); }
    finally { setTesting(false); }
  };
  const disconnect = async () => {
    if (!window.confirm('Remove the stored Neuven connection profile?')) return;
    await api.del('/neuven/connect'); setF({ endpoint: '', org_ref: '', api_key: '' }); setResult(null); onChanged();
  };

  return (
    <Card>
      <CardHeader title="Automatic connection" subtitle="Beta — live sync once Neuven provide API access."
        action={<Badge value={connection ? 'valid' : 'pending'} label={connection ? 'Configured' : 'Not connected'} />} />
      <div className="space-y-3 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">Feed endpoint URL</span>
            <input className={inputCls} placeholder="https://api.neuven.co.uk/…" value={f.endpoint} onChange={(e) => setF({ ...f, endpoint: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Organisation / site ref</span>
            <input className={inputCls} value={f.org_ref} onChange={(e) => setF({ ...f, org_ref: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">API key {connection?.has_key && <span className="text-emerald-600">(saved — leave blank to keep)</span>}</span>
            <input type="password" className={inputCls} value={f.api_key} onChange={(e) => setF({ ...f, api_key: e.target.value })} placeholder={connection?.has_key ? '••••••' : 'Provided by Neuven'} /></label>
        </div>
        {result && (
          <p className={clsx('flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
            result.reachable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
            {result.reachable ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            {result.note}
          </p>
        )}
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {connection && <button className={btnGhost} onClick={disconnect}><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
          {connection && <button className={btnGhost} disabled={testing} onClick={test}>{testing ? 'Testing…' : 'Test connection'}</button>}
          <button className={btnPrimary} disabled={busy || !f.endpoint} onClick={save}>{busy ? 'Saving…' : connection ? 'Update connection' : 'Save connection'}</button>
        </div>
      </div>
    </Card>
  );
}

function ImportCard({ clients, onDone }: { clients: Client[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [clientId, setClientId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  const previewFile = async (file?: File) => {
    setBusy(true); setErr(''); setDoneMsg('');
    try {
      let res: Preview;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        if (clientId) form.append('client_id', clientId);
        res = await api.upload<Preview>('/neuven/import/preview', form);
      } else {
        res = await api.post<Preview>('/neuven/import/preview', { csv, client_id: clientId || undefined });
      }
      setPreview(res);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Preview failed'); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!preview) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post<{ inserted: number; rejected: number }>(`/neuven/import/${preview.batch_id}/commit`, {});
      setDoneMsg(`Imported ${r.inserted} job${r.inserted === 1 ? '' : 's'}${r.rejected ? ` — ${r.rejected} row${r.rejected === 1 ? '' : 's'} skipped` : ''}. They're on the pipeline board now.`);
      setPreview(null); setCsv(''); if (fileRef.current) fileRef.current.value = '';
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Import failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="CSV import" subtitle="Export from Neuven, drop it here — jobs become shift requests." />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void previewFile(f); }} />
          <button className={btnPrimary} disabled={busy} onClick={() => fileRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> {busy ? 'Reading…' : 'Choose CSV'}
          </button>
          <span className="text-[11px] text-slate-400">or paste below</span>
          <select className={clsx(inputCls, 'w-auto')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Client column in file…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>Fallback: {c.name}</option>)}
          </select>
        </div>
        <textarea className={clsx(inputCls, 'h-20 font-mono text-[11px]')} placeholder={'reference,client,date,shift_type,role,qty\nNV-1001,Chestnut Grange,2026-10-20,night,Registered Nurse,1'}
          value={csv} onChange={(e) => setCsv(e.target.value)} />
        {csv.trim() && !preview && (
          <div className="flex justify-end"><button className={btnPrimary} disabled={busy} onClick={() => previewFile()}>{busy ? 'Checking…' : 'Preview import'}</button></div>
        )}
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        {doneMsg && <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {doneMsg}</p>}

        {preview && (
          <div className="rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between border-b border-slate-200/60 px-3 py-2">
              <p className="text-xs font-semibold text-ink">
                Preview — {preview.summary.insert} to import{preview.summary.reject ? `, ${preview.summary.reject} rejected` : ''}
              </p>
              <div className="flex gap-2">
                <button className={btnGhost} onClick={async () => { await api.post(`/neuven/import/${preview.batch_id}/discard`, {}); setPreview(null); }}>Discard</button>
                <button className={btnPrimary} disabled={busy || !preview.summary.insert} onClick={commit}>{busy ? 'Importing…' : `Import ${preview.summary.insert}`}</button>
              </div>
            </div>
            <ul className="scroll-thin max-h-56 divide-y divide-slate-200/50 overflow-y-auto">
              {preview.rows.map((r) => (
                <li key={r.row} className={clsx('px-3 py-2 text-xs', r.action === 'reject' && 'bg-red-50/40')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink">
                      <span className="text-slate-400">#{r.row}</span> {r.reference && <b>{r.reference}</b>} {r.client ?? '—'} · {r.date ?? '?'} · {fmtStatus(r.shift_type)}
                      {r.role && ` · ${r.role}`}{r.qty > 1 && ` ×${r.qty}`}{r.urgency === 'urgent' && <span className="ml-1 font-semibold text-red-600">urgent</span>}
                    </span>
                    <Badge value={r.action === 'insert' ? 'valid' : 'expired'} label={r.action === 'insert' ? 'Import' : 'Reject'} />
                  </div>
                  {(r.errors.length || r.warnings.length > 0) && (
                    <p className="mt-0.5 text-[11px]">
                      {r.errors.map((e, i) => <span key={`e${i}`} className="mr-2 text-red-600">{e}</span>)}
                      {r.warnings.map((w, i) => <span key={`w${i}`} className="mr-2 text-amber-600">{w}</span>)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
