import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, gbp2 } from '../lib/format';
import { Spinner, EmptyState } from '../components/ui';

interface InvoicePrintData {
  id: number; number: string; status: string;
  issue_date: string; due_date: string | null; subtotal: string;
  notes: string | null; paid_at: string | null;
  client_name: string; client_address: string | null; client_town: string | null;
  client_postcode: string | null; billing_email: string | null;
  lines: { id: number; description: string; hours: string | null; rate: string | null; amount: string }[];
}

export default function InvoicePrint() {
  const { id } = useParams();
  const [inv, setInv] = useState<InvoicePrintData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.get<InvoicePrintData>(`/invoices/${id}`).then(setInv).catch(() => setErr(true));
  }, [id]);

  if (err) return <EmptyState title="Could not load invoice" />;
  if (!inv) return <Spinner label="Preparing invoice…" />;

  const billTo = [inv.client_address, inv.client_town, inv.client_postcode].filter(Boolean).join('\n');
  const statusLabel = inv.status === 'paid' ? `PAID ${inv.paid_at ? fmtDate(inv.paid_at) : ''}`
    : inv.status === 'cancelled' ? 'CANCELLED' : inv.status === 'sent' ? 'SENT' : 'DRAFT';

  return (
    <div className="mx-auto max-w-3xl bg-white p-4 sm:p-8 print:p-0">
      <div className="mb-8 flex items-start justify-between border-b-2 border-slate-800 pb-5">
        <div>
          <img src="/sanitaslogo.png" alt="Sanitas" className="h-10 w-auto print:h-8" />
          <p className="mt-2 text-xs text-slate-500">Sanitas Medical Recruitment</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">INVOICE</h1>
          <p className="mt-1 text-sm font-medium text-slate-700">{inv.number}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{statusLabel}</p>
          <button
            onClick={() => window.print()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 print:hidden"
          >
            <Printer className="h-3.5 w-3.5" /> Print / Save PDF
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Bill to</h2>
          <p className="text-sm font-semibold text-slate-800">{inv.client_name}</p>
          {billTo && <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600">{billTo}</p>}
          {inv.billing_email && <p className="mt-0.5 text-xs text-slate-600">{inv.billing_email}</p>}
        </div>
        <div className="text-right">
          <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Details</h2>
          <p className="text-xs text-slate-600">Issued <span className="font-medium text-slate-800">{fmtDate(inv.issue_date)}</span></p>
          <p className="text-xs text-slate-600">Due <span className="font-medium text-slate-800">{fmtDate(inv.due_date)}</span></p>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-x-visible">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4 text-right">Hours</th>
            <th className="py-2 pr-4 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="py-2.5 pr-4 text-slate-800">{l.description}</td>
              <td className="py-2.5 pr-4 text-right text-slate-600">{l.hours ?? '—'}</td>
              <td className="py-2.5 pr-4 text-right text-slate-600">{l.rate ? gbp2(l.rate) : '—'}</td>
              <td className="py-2.5 text-right font-medium text-slate-800">{gbp2(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800">
            <td colSpan={3} className="py-3 text-sm font-semibold text-slate-600">Total due</td>
            <td className="py-3 text-right text-lg font-bold text-slate-900">{gbp2(inv.subtotal)}</td>
          </tr>
        </tfoot>
      </table>
      </div>

      {inv.notes && (
        <div className="mt-6">
          <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Notes</h2>
          <p className="whitespace-pre-line text-xs text-slate-600">{inv.notes}</p>
        </div>
      )}

      <p className="mt-10 border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-400">
        Payment is due by the date shown above. Please quote invoice number {inv.number} on all payments and remittances.
        Timesheets supporting this invoice have been signed and approved. Queries: accounts@sanitasmedicalrecruitment.co.uk
      </p>
    </div>
  );
}
