import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, fmtDateTime } from '../lib/format';
import { ComplianceDoc, OhRecord, RegisterCheck } from '../lib/types';
import { Badge, Spinner, EmptyState, fmtStatus } from '../components/ui';

interface ComplianceFileData {
  candidate: {
    id: number; first_name: string; last_name: string; role: string;
    nmc_pin: string | null; status: string; compliance_score: number;
    rtw_status: string | null; rtw_expiry: string | null; registered_at: string;
  };
  documents: (ComplianceDoc & { live_status: string })[];
  register_checks: RegisterCheck[];
  oh_records?: OhRecord[];
  generated_at: string;
}

export default function ComplianceFile() {
  const { id } = useParams();
  const [data, setData] = useState<ComplianceFileData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.get<ComplianceFileData>(`/candidates/${id}/compliance-file`).then(setData).catch(() => setErr(true));
  }, [id]);

  if (err) return <EmptyState title="Could not load compliance file" />;
  if (!data) return <Spinner label="Preparing compliance file…" />;

  const c = data.candidate;

  return (
    <div className="mx-auto max-w-3xl bg-white p-4 sm:p-8 print:p-0">
      <div className="mb-6 flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <div>
          <img src="/sanitaslogo.png" alt="Sanitas" className="h-10 w-auto print:h-8" />
          <p className="mt-2 text-xs text-slate-500">
            Worker compliance file · produced {fmtDateTime(data.generated_at)}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 print:hidden"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Worker</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ['Name', `${c.first_name} ${c.last_name}`],
              ['Role', c.role],
              ['Status', fmtStatus(c.status)],
              ['NMC PIN', c.nmc_pin ?? '—'],
              ['Right to work', c.rtw_status ? `${c.rtw_status}${c.rtw_expiry ? ` (expires ${fmtDate(c.rtw_expiry)})` : ''}` : '—'],
              ['Registered with agency', fmtDate(c.registered_at)],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100">
                <td className="w-44 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{k}</td>
                <td className="py-1.5 text-sm text-slate-800">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Documents & checks</h2>
        <div className="overflow-x-auto print:overflow-x-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-3">Document</th>
              <th className="py-1.5 pr-3">Reference</th>
              <th className="py-1.5 pr-3">Status</th>
              <th className="py-1.5 pr-3">Issued</th>
              <th className="py-1.5 pr-3">Expires</th>
              <th className="py-1.5">Verified by</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((d) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-medium text-slate-800">
                  {d.type}
                  {d.dbs_update_service && <span className="ml-1 text-[10px] text-emerald-600">(Update Service)</span>}
                </td>
                <td className="py-1.5 pr-3 text-xs text-slate-600">{d.reference_no ?? '—'}</td>
                <td className="py-1.5 pr-3"><Badge value={d.live_status} /></td>
                <td className="py-1.5 pr-3 text-xs text-slate-600">{fmtDate(d.issue_date)}</td>
                <td className="py-1.5 pr-3 text-xs text-slate-600">{fmtDate(d.expiry_date)}</td>
                <td className="py-1.5 text-xs text-slate-600">{d.verified_by_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {!!data.register_checks.length && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
            Register checks
            <span className="ml-2 text-[10px] font-normal normal-case text-slate-400">recorded by staff — not independently verified by this system</span>
          </h2>
          <div className="overflow-x-auto print:overflow-x-visible">
          <table className="w-full text-sm">
            <tbody>
              {data.register_checks.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="w-44 py-1.5 text-xs uppercase text-slate-500">{r.register === 'nmc' ? 'NMC' : 'DBS Update Service'}</td>
                  <td className="py-1.5 text-xs text-slate-600">{r.identifier ?? '—'}</td>
                  <td className="py-1.5 text-xs text-slate-600">{fmtDateTime(r.checked_at)}</td>
                  <td className="py-1.5"><Badge value={r.result === 'clear' ? 'valid' : r.result === 'lapsed' ? 'expired' : 'pending'} label={`${r.result} (${r.source === 'csv_import' ? 'csv import' : 'staff-recorded'})`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      {data.oh_records && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
            Occupational health <span className="ml-2 text-[10px] font-normal normal-case text-slate-400">restricted section</span>
          </h2>
          <div className="overflow-x-auto print:overflow-x-visible">
          <table className="w-full text-sm">
            <tbody>
              {data.oh_records.map((o) => (
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="w-44 py-1.5 text-sm text-slate-800">{o.name}</td>
                  <td className="py-1.5 text-xs capitalize text-slate-500">{o.kind}</td>
                  <td className="py-1.5 text-xs text-slate-600">{fmtDate(o.record_date)}</td>
                  <td className="py-1.5 text-xs text-slate-600">{o.expiry_date ? `exp ${fmtDate(o.expiry_date)}` : ''}</td>
                  <td className="py-1.5 text-xs text-slate-600">{o.result ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <p className="mt-8 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
        Generated by Sanitas CRM for inspection or client compliance requests. Contains personal data — handle per the agency's data protection policy.
      </p>
    </div>
  );
}
