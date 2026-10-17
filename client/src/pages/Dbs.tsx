import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, UploadCloud, RefreshCw, Trash2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Spinner, btnGhost, btnPrimary, inputCls } from '../components/ui';

interface Connection { provider: string; endpoint: string | null; org_ref: string | null; has_key: boolean; saved_at: string }
interface Batch { id: number; filename: string; row_count: number; status: string; summary: any; created_at: string; committed_at: string | null }
interface Status {
  beta: boolean; api_note: string; recheck_days: number;
  connection: Connection | null;
  stats: { workers: string; with_dbs_doc: string; on_update_service: string; checked_recently: string; never_checked: string; needs_attention: string };
  batches: Batch[];
}
interface WorkerRow {
  candidate_id: number; first_name: string; last_name: string; role: string | null; candidate_status: string;
  doc_id: number | null; doc_type: string | null; doc_status: string | null; reference_no: string | null; expiry_date: string | null;
  dbs_update_service: boolean | null; last_checked_at: string | null; check_result: string | null;
  check_id: number | null; last_check_at: string | null; last_check_result: string | null; review_due: string | null;
  last_check_source: string | null; attention: 'no_doc' | 'never_checked' | 'review_due' | 'stale' | 'ok' | string;
}
interface ImportRow {
  row: number; candidate_id: number | null; worker: string | null; certificate_no: string | null;
  result: string | null; check_date: string | null; review_due: string | null; update_service: boolean | null;
  action: 'insert' | 'skip' | 'reject'; errors: string[]; warnings: string[];
}
interface Preview { batch_id: number; header: string[]; summary: { total: number; insert: number; skip: number; reject: number }; rows: ImportRow[] }

const BETA = 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-300';

const ATTENTION: Record<string, { label: string; chip: string }> = {
  no_doc:        { label: 'No DBS on file',  chip: 'bg-red-50 text-red-700 ring-red-200' },
  never_checked: { label: 'Never checked',   chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  attention:     { label: 'New information', chip: 'bg-red-50 text-red-700 ring-red-200' },
  not_found:     { label: 'Not found',       chip: 'bg-red-50 text-red-700 ring-red-200' },
  lapsed:        { label: 'Lapsed',          chip: 'bg-red-50 text-red-700 ring-red-200' },
  error:         { label: 'Check error',     chip: 'bg-red-50 text-red-700 ring-red-200' },
  review_due:    { label: 'Review due',      chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  stale:         { label: 'Re-check due',    chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ok:            { label: 'In date',         chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

const PROVIDERS = [
  'gov.uk DBS Update Service',
  'uCheck',
  'Personnel Checks',
  'Care Check',
  'Verifile',
  'Other umbrella body',
];

export default function Dbs() {
  const [status, setStatus] = useState<Status | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[] | null>(null);
  const [filter, setFilter] = useState<'attention' | 'all'>('attention');
  const load = useCallback(() => {
    api.get<Status>('/dbs/status').then(setStatus).catch(() => setStatus(null));
    api.get<WorkerRow[]>('/dbs/workers').then(setWorkers).catch(() => setWorkers([]));
  }, []);
  useEffect(load, [load]);

  const s = status?.stats;
  const shown = workers ? (filter === 'attention' ? workers.filter((w) => w.attention !== 'ok') : workers) : null;

  return (
    <div>
      <PageHeader title="DBS checks" subtitle="Track Disclosure & Barring Service checks across the workforce — manual today, provider API when available.">
        <span className={BETA}>Beta</span>
        <button className={btnGhost} onClick={load}><RefreshCw className="h-4 w-4" /></button>
      </PageHeader>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">
          The gov.uk DBS Update Service is browser-only — there's no public API to poll. If Sanitas uses an
          umbrella body (uCheck, Personnel Checks, etc.) it may expose an API or let you export CSVs.
          Save the provider details below to keep the connection profile ready, and use
          <b> CSV import</b> to land check results against workers in the meantime.
        </p>
      </div>

      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Workers', value: s.workers },
            { label: 'DBS on file', value: s.with_dbs_doc },
            { label: 'On Update Service', value: s.on_update_service },
            { label: `Checked <${status!.recheck_days}d`, value: s.checked_recently },
            { label: 'Never checked', value: s.never_checked, warn: +s.never_checked > 0 },
            { label: 'Need attention', value: s.needs_attention, warn: +s.needs_attention > 0 },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3">
              <p className={clsx('text-xl font-bold font-display', t.warn ? 'text-amber-600' : 'text-ink')}>{t.value}</p>
              <p className="text-[11px] font-medium text-slate-500">{t.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ConnectionCard connection={status?.connection ?? null} onChanged={load} />
        <ImportCard onDone={load} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Workforce DBS board" subtitle="Latest certificate + Update Service check per worker."
            action={
              <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium">
                {(['attention', 'all'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={clsx('rounded-md px-2.5 py-1', filter === f ? 'bg-white text-ink shadow-sm' : 'text-slate-500')}>
                    {f === 'attention' ? 'Needs attention' : 'All workers'}
                  </button>
                ))}
              </div>
            } />
          {!shown ? <Spinner /> : !shown.length ? (
            <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title={filter === 'attention' ? 'Everyone in date' : 'No workers'} hint={filter === 'attention' ? 'All DBS checks are current.' : undefined} />
          ) : (
            <ul className="scroll-thin max-h-96 divide-y divide-slate-200/50 overflow-y-auto">
              {shown.map((w) => {
                const a = ATTENTION[w.attention] ?? ATTENTION.ok;
                return (
                  <li key={w.candidate_id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        <Link to={`/candidates/${w.candidate_id}`} className="hover:text-brand-600">{w.first_name} {w.last_name}</Link>
                        {w.dbs_update_service && <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">Update Service</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {w.reference_no ? `cert ${w.reference_no} · ` : ''}
                        {w.last_check_at
                          ? `checked ${fmtDate(w.last_check_at)} — ${w.last_check_result}${w.last_check_source === 'csv_import' ? ' (csv)' : ''}`
                          : w.expiry_date ? `doc expires ${fmtDate(w.expiry_date)}` : 'no check recorded'}
                        {w.review_due && <span className="text-amber-600"> · review {fmtDate(w.review_due)}</span>}
                      </p>
                    </div>
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', a.chip)}>{a.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Import history" subtitle="Result batches brought in via CSV (auditable)" />
          {!status ? <Spinner /> : !status.batches.length ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No imports yet</p>
          ) : (
            <ul className="divide-y divide-slate-200/50">
              {status.batches.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-ink">#{b.id} — {b.filename} <span className="text-[11px] text-slate-400">· {b.row_count} rows</span></span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{b.summary?.result?.inserted ?? b.summary?.insert ?? 0} recorded</span>
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
  const [f, setF] = useState({ provider: '', endpoint: '', org_ref: '', api_key: '' });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ reachable: boolean; http_status: number | null; note: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (connection) setF((p) => ({ ...p, provider: connection.provider, endpoint: connection.endpoint ?? '', org_ref: connection.org_ref ?? '' }));
  }, [connection]);

  const save = async () => {
    setBusy(true); setErr('');
    try { await api.post('/dbs/connect', f); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setTesting(true); setErr(''); setResult(null);
    try { setResult(await api.post('/dbs/sync', {})); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Test failed'); }
    finally { setTesting(false); }
  };
  const disconnect = async () => {
    if (!window.confirm('Remove the stored DBS provider profile?')) return;
    await api.del('/dbs/connect'); setF({ provider: '', endpoint: '', org_ref: '', api_key: '' }); setResult(null); onChanged();
  };

  const govUk = /gov\.uk|update service/i.test(f.provider);

  return (
    <Card>
      <CardHeader title="Automatic connection" subtitle="Beta — provider profile ready for when an API exists."
        action={<Badge value={connection ? 'valid' : 'pending'} label={connection ? 'Configured' : 'Not configured'} />} />
      <div className="space-y-3 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">DBS provider</span>
            <select className={inputCls} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>
              <option value="">Who runs your checks?…</option>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select></label>
          <label className="sm:col-span-2 block"><span className="mb-1 block text-xs font-medium text-slate-600">API endpoint URL <span className="font-normal text-slate-400">(if the provider offers one)</span></span>
            <input className={inputCls} placeholder={govUk ? 'gov.uk has no API — leave blank' : 'https://api.provider.co.uk/…'}
              value={f.endpoint} onChange={(e) => setF({ ...f, endpoint: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Organisation ref</span>
            <input className={inputCls} value={f.org_ref} onChange={(e) => setF({ ...f, org_ref: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">API key {connection?.has_key && <span className="text-emerald-600">(saved — leave blank to keep)</span>}</span>
            <input type="password" className={inputCls} value={f.api_key} onChange={(e) => setF({ ...f, api_key: e.target.value })} placeholder={connection?.has_key ? '••••••' : 'From the provider'} /></label>
        </div>
        {govUk && (
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            Direct gov.uk checks are manual — log in to the employer portal, run the check, then record it on the
            worker or import the results below.
          </p>
        )}
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
          <button className={btnPrimary} disabled={busy || !f.provider} onClick={save}>{busy ? 'Saving…' : connection ? 'Update provider' : 'Save provider'}</button>
        </div>
      </div>
    </Card>
  );
}

function ImportCard({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
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
        res = await api.upload<Preview>('/dbs/import/preview', form);
      } else {
        res = await api.post<Preview>('/dbs/import/preview', { csv });
      }
      setPreview(res);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Preview failed'); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!preview) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post<{ inserted: number; skipped: number; rejected: number }>(`/dbs/import/${preview.batch_id}/commit`, {});
      setDoneMsg(`Recorded ${r.inserted} check${r.inserted === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} already on file` : ''}${r.rejected ? `, ${r.rejected} skipped` : ''}. Results are stamped on each worker's compliance file.`);
      setPreview(null); setCsv(''); if (fileRef.current) fileRef.current.value = '';
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Import failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Import check results" subtitle="CSV exported from your provider — results land on workers' records." />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void previewFile(f); }} />
          <button className={btnPrimary} disabled={busy} onClick={() => fileRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> {busy ? 'Reading…' : 'Choose CSV'}
          </button>
          <span className="text-[11px] text-slate-400">or paste below — needs a worker column (email, name or id) plus a result or certificate number</span>
        </div>
        <textarea className={clsx(inputCls, 'h-20 font-mono text-[11px]')} placeholder={'email,certificate_no,result,check_date\njane@example.com,0017723456,clear,15/10/2026'}
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
                Preview — {preview.summary.insert} to record
                {preview.summary.skip ? `, ${preview.summary.skip} already on file` : ''}
                {preview.summary.reject ? `, ${preview.summary.reject} rejected` : ''}
              </p>
              <div className="flex gap-2">
                <button className={btnGhost} onClick={async () => { await api.post(`/dbs/import/${preview.batch_id}/discard`, {}); setPreview(null); }}>Discard</button>
                <button className={btnPrimary} disabled={busy || !preview.summary.insert} onClick={commit}>{busy ? 'Importing…' : `Record ${preview.summary.insert}`}</button>
              </div>
            </div>
            <ul className="scroll-thin max-h-56 divide-y divide-slate-200/50 overflow-y-auto">
              {preview.rows.map((r) => (
                <li key={r.row} className={clsx('px-3 py-2 text-xs', r.action === 'reject' && 'bg-red-50/40')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ink">
                      <span className="text-slate-400">#{r.row}</span> {r.worker ?? '—'}
                      {r.certificate_no && <span> · cert <b>{r.certificate_no}</b></span>}
                      {r.result && <span> · {r.result}</span>}
                      {r.check_date && <span> · {r.check_date}</span>}
                      {r.update_service === true && <span className="text-emerald-600"> · update service</span>}
                    </span>
                    <Badge
                      value={r.action === 'insert' ? 'valid' : r.action === 'skip' ? 'pending' : 'expired'}
                      label={r.action === 'insert' ? 'Record' : r.action === 'skip' ? 'On file' : 'Reject'} />
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
