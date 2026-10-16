import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, RotateCcw, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { Modal, inputCls, btnPrimary, btnGhost } from './ui';

const FIELD_LABELS: Record<string, string> = {
  email: 'Worker email', candidate_id: 'Worker ID', worker_name: 'Worker name',
  doc_type: 'Training / course name', issue_date: 'Issue / completed date',
  expiry_date: 'Expiry date', reference_no: 'Certificate ref',
};

interface PreviewRow {
  row: number; candidate_id: number | null; worker: string | null;
  doc_type: string; issue_date: string | null; expiry_date: string | null;
  reference_no: string | null; action: 'insert' | 'update' | 'skip' | 'reject';
  errors: string[]; warnings: string[];
}
interface Preview {
  batch_id: number; header: string[]; mapping: Record<string, number | null>;
  fields: string[]; summary: { total: number; insert: number; update: number; skip: number; reject: number };
  rows: PreviewRow[];
}

const ACTION_CHIP: Record<PreviewRow['action'], string> = {
  insert: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  update: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  skip: 'bg-slate-900/5 text-slate-600 ring-slate-500/20',
  reject: 'bg-red-50 text-red-700 ring-red-600/20',
};

export function ImportWizard({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; rejected: number } | null>(null);

  useEffect(() => { if (open) { setFile(null); setPreview(null); setError(''); setResult(null); } }, [open]);

  const doPreview = async (f: File) => {
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('file', f);
      setPreview(await api.upload<Preview>('/compliance/import-training/preview', form));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const remap = async (field: string, col: number | null) => {
    if (!preview) return;
    const mapping = { ...preview.mapping, [field]: col };
    setBusy(true);
    try {
      setPreview(await api.post<Preview>(`/compliance/import-training/${preview.batch_id}/remap`, { mapping }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      setResult(await api.post(`/compliance/import-training/${preview.batch_id}/commit`, {}));
      onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const s = preview?.summary;
  return (
    <Modal open={open} onClose={onClose} size="xl" title="Import training records" icon={<FileUp className="h-4 w-4" />}
      subtitle="CSV with one row per worker per course. Nothing is saved until you confirm."
      footer={result ? (
        <button className={btnPrimary} onClick={onClose}>Done</button>
      ) : preview ? (
        <>
          <button className={btnGhost} onClick={() => setPreview(null)}><RotateCcw className="h-4 w-4" /> Start over</button>
          <button className={btnPrimary} disabled={busy || !s || s.insert + s.update === 0} onClick={commit}>
            {busy ? 'Importing…' : `Import ${s ? s.insert + s.update : 0} record${s && s.insert + s.update === 1 ? '' : 's'}`}
          </button>
        </>
      ) : null}>
      {result ? (
        <div className="space-y-3 py-2">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Import complete</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {([['New', result.inserted], ['Updated', result.updated], ['Unchanged', result.skipped], ['Rejected', result.rejected]] as const).map(([k, v]) => (
              <div key={k} className="glass rounded-xl px-3 py-3"><p className="text-xl font-bold text-ink">{v}</p><p className="text-[11px] text-slate-500">{k}</p></div>
            ))}
          </div>
        </div>
      ) : !preview ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300/80 bg-white/40 px-6 py-12 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); doPreview(f); } }}
        >
          <FileUp className="h-8 w-8 text-brand-500" />
          <p className="mt-3 text-sm font-medium text-ink">{busy ? 'Analysing file…' : 'Drop a CSV here'}</p>
          <p className="mt-1 text-xs text-slate-500">Columns are detected automatically; you can fix the mapping on the next step.</p>
          <label className={clsx(btnPrimary, 'mt-4 cursor-pointer')}>
            Choose file
            <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); doPreview(f); } }} />
          </label>
          {file && !preview && !busy && <p className="mt-2 text-xs text-slate-500">{file.name}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {/* summary strip */}
          <div className="grid grid-cols-5 gap-2 text-center">
            {([['Rows', s!.total, 'text-ink'], ['New', s!.insert, 'text-emerald-600'], ['Updates', s!.update, 'text-amber-600'], ['Unchanged', s!.skip, 'text-slate-500'], ['Rejected', s!.reject, 'text-red-600']] as const).map(([k, v, c]) => (
              <div key={k} className="glass rounded-xl px-2 py-2"><p className={clsx('text-lg font-bold', c)}>{v}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">{k}</p></div>
            ))}
          </div>
          {/* mapping */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Column mapping</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {preview.fields.map((f) => (
                <label key={f} className="block">
                  <span className="mb-0.5 block text-[11px] font-medium text-slate-600">{FIELD_LABELS[f] ?? f}</span>
                  <select className={clsx(inputCls, 'py-1.5 text-xs')} disabled={busy}
                    value={preview.mapping[f] ?? ''} onChange={(e) => remap(f, e.target.value === '' ? null : +e.target.value)}>
                    <option value="">— not mapped —</option>
                    {preview.header.map((h, i) => <option key={i} value={i}>{h || `column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Dates accept yyyy-mm-dd or dd/mm/yyyy. Workers are matched by email, ID or exact name — the import never creates new workers.</p>
          </div>
          {/* row preview */}
          <div className="scroll-thin max-h-72 overflow-y-auto rounded-xl border border-slate-200/60">
            <table className="w-full text-xs">
              <thead className="grid-head">
                <tr className="border-b border-slate-200/60">
                  {['#', 'Worker', 'Course', 'Issued', 'Expires', 'Action', 'Notes'].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {preview.rows.map((r) => (
                  <tr key={r.row} className={clsx(r.action === 'reject' && 'bg-red-50/50')}>
                    <td className="px-3 py-2 text-slate-400">{r.row}</td>
                    <td className="px-3 py-2 font-medium text-ink">{r.worker ?? '—'}</td>
                    <td className="px-3 py-2">{r.doc_type}</td>
                    <td className="px-3 py-2">{r.issue_date ?? '—'}</td>
                    <td className="px-3 py-2">{r.expiry_date ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset', ACTION_CHIP[r.action])}>
                        {r.action === 'reject' ? <XCircle className="h-3 w-3" /> : r.action === 'skip' ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      {r.errors.map((e) => <p key={e} className="flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3 shrink-0" />{e}</p>)}
                      {r.warnings.map((w) => <p key={w} className="text-amber-600">{w}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
    </Modal>
  );
}
