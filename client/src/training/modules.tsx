import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, Building2, ClipboardList, PlugZap, Clock3,
  PoundSterling, Wallet, TrendingUp, ShieldCheck, MonitorSmartphone, Fingerprint,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Stage, Stat, Row, NameBar, Chip, Stamp, FlowArrow, Panel, Bar, Count, delay } from './visuals';

export interface Scene { title: string; caption: string; visual: ReactNode }
export interface Module {
  id: string; title: string; subtitle: string; icon: LucideIcon;
  tint: string; scenes: Scene[];
}

const pipeChip = (label: string, tone: any) => <Chip tone={tone}>{label}</Chip>;

export const MODULES: Module[] = [
  {
    id: 'dashboard', title: 'Dashboard', subtitle: 'Your day at a glance', icon: LayoutDashboard, tint: 'from-sky-500 to-blue-600',
    scenes: [
      {
        title: 'KPIs that update themselves',
        caption: 'The dashboard opens with live totals — active workers, care homes, this month\'s revenue and margin — so you always know where the business stands.',
        visual: (
          <Stage caption="Live KPIs across the top — revenue, margin, workers and compliance in one glance.">
            <div className="grid grid-cols-4 gap-3">
              <Stat i={0} label="Active workers" value={<Count to={47} />} />
              <Stat i={1} label="Care homes" value={<Count to={7} />} />
              <Stat i={2} label="Revenue MTD" value={<Count to={14.4} prefix="£" suffix="k" decimals={1} />} tone="text-emerald-300" />
              <Stat i={3} label="Margin MTD" value={<Count to={3.1} prefix="£" suffix="k" decimals={1} />} tone="text-teal-300" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Panel title="Pipeline"><p className="text-xs text-white/70">7 requests in progress — New, Offers out, Part-filled…</p></Panel>
              <Panel title="This week's shifts"><p className="text-xs text-white/70">Chestnut Grange · Night · Chloe Stan</p><p className="mt-1 text-xs text-white/70">Oaks Lodge · Day · Mary Begum</p></Panel>
              <Panel title="Compliance alerts"><p className="tr-blink text-xs text-amber-300">2 documents expiring soon</p></Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'The workflow pipeline',
        caption: 'A colour-coded strip shows every client request at its current stage — click any stage to jump straight to the board.',
        visual: (
          <Stage caption="Each colour is a stage — blue is new, emerald is done. Counts update live.">
            <div className="flex flex-wrap items-center gap-2">
              {pipeChip('New · 3', 'sky')}{pipeChip('Offers out · 2', 'amber')}{pipeChip('Part-filled · 1', 'orange')}
              {pipeChip('Booked · 4', 'teal')}{pipeChip('Awaiting TS · 5', 'violet')}{pipeChip('Invoice · 6', 'teal')}{pipeChip('Complete · 31', 'emerald')}
            </div>
            <div className="mt-6 space-y-2">
              <Row i={0}><NameBar name="Chestnut Grange" sub="Night · 20 Oct · ×2" />{pipeChip('New', 'sky')}</Row>
              <Row i={1}><NameBar name="Oaks Lodge" sub="Long day · 21 Oct" />{pipeChip('Booked', 'teal')}</Row>
              <Row i={2}><NameBar name="Ferndale Court" sub="Day · 19 Oct" />{pipeChip('Ready to invoice', 'emerald')}</Row>
            </div>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'candidates', title: 'Candidates', subtitle: 'Your workforce records', icon: Users, tint: 'from-violet-500 to-purple-600',
    scenes: [
      {
        title: 'One record per worker',
        caption: 'Every nurse, HCA and support worker has a full profile — contact details, pay expectations, payroll reference, bank details and their complete compliance file.',
        visual: (
          <Stage caption="Search, filter and open any worker — everything about them lives in one place.">
            <div className="space-y-2">
              <Row i={0}><NameBar name="Chloe Stan" sub="Registered Nurse · SAN-001" /><Chip tone="emerald" i={1}>Compliant</Chip></Row>
              <Row i={1}><NameBar name="Mary Begum" sub="HCA · SAN-005" /><Chip tone="emerald" i={2}>Compliant</Chip></Row>
              <Row i={2}><NameBar name="Emmanuel Nwosu" sub="Support Worker · SAN-012" /><Chip tone="amber" i={3}>1 doc expiring</Chip></Row>
            </div>
            <Panel className="mt-5" title="Worker profile">
              <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70">
                <span className="tr-rise" style={delay(2)}>Payroll ref: SAN-001</span>
                <span className="tr-rise" style={delay(3)}>Engagement: PAYE</span>
                <span className="tr-rise" style={delay(4)}>NMC PIN recorded</span>
                <span className="tr-rise" style={delay(5)}>Bank details on file</span>
              </div>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Compliance built in',
        caption: 'Each worker\'s documents are tracked against what their clients require — expired or missing items block booking automatically.',
        visual: (
          <Stage caption="The system hard-blocks booking when a required document is missing or expired.">
            <div className="grid grid-cols-2 gap-2">
              <Row i={0}><span className="text-xs text-white">DBS Enhanced</span><Chip tone="emerald">Valid</Chip></Row>
              <Row i={1}><span className="text-xs text-white">Right to Work</span><Chip tone="emerald">Valid</Chip></Row>
              <Row i={2}><span className="text-xs text-white">Mandatory Training</span><Chip tone="amber">Expiring</Chip></Row>
              <Row i={3}><span className="text-xs text-white">References</span><Chip tone="red">Missing</Chip></Row>
            </div>
            <p className="tr-rise mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-[11px] text-red-300 ring-1 ring-red-400/20" style={delay(5)}>
              Allocation blocked — "References: missing". Fix the document and the worker is bookable again.
            </p>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'clients', title: 'Care Homes', subtitle: 'Clients & site requirements', icon: Building2, tint: 'from-teal-500 to-emerald-600',
    scenes: [
      {
        title: 'Every home, its own rules',
        caption: 'Client records hold contacts, billing details and any extra compliance requirements — the checker applies them on top of the baseline for every booking.',
        visual: (
          <Stage caption="Baseline docs for everyone — plus whatever each home adds on top.">
            <Row i={0}><NameBar name="Chestnut Grange" sub="Colchester · Nursing home" /><Chip tone="sky">Active</Chip></Row>
            <Panel className="mt-4" title="Site requirements">
              <div className="space-y-1.5 text-[11px] text-white/70">
                <p className="tr-rise" style={delay(1)}>Baseline: DBS Enhanced · Right to Work · Passport/ID · Mandatory Training</p>
                <p className="tr-rise" style={delay(2)}>+ PMVA required at this home</p>
                <p className="tr-rise" style={delay(3)}>+ Immunisation history</p>
              </div>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Requests flow in from clients',
        caption: 'Homes raise shift requests themselves through the client portal — they land on your board instantly, no phone calls needed.',
        visual: (
          <Stage caption="Client portal → your requests board. New work arrives pre-structured.">
            <div className="flex items-center gap-3">
              <Panel title="Client portal" className="flex-1"><p className="text-xs text-white/70">"Need 2 nights covered, 20–21 Oct"</p></Panel>
              <FlowArrow i={2} />
              <Panel title="Your board" className="flex-1"><Row i={3}><span className="text-xs text-white">Chestnut Grange · Night ×2</span><Chip tone="sky">New</Chip></Row></Panel>
            </div>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'requests', title: 'Requests & Allocation', subtitle: 'From ask to filled shift', icon: ClipboardList, tint: 'from-blue-500 to-indigo-600',
    scenes: [
      {
        title: 'Watch work move through the pipeline',
        caption: 'Open a request, see eligible workers with availability and compliance context, send offers, and allocate — the card moves along the colour-coded board as it fills.',
        visual: (
          <Stage caption="New → Offers out → Booked. The pipeline colours tell you exactly where everything sits.">
            <div className="flex items-center gap-2">
              <Panel className="flex-1" title="Eligible workers">
                <Row i={0}><NameBar name="Chloe Stan" /><Chip tone="emerald" i={1}>Available</Chip></Row>
                <Row i={1}><NameBar name="Mary Begum" /><Chip tone="amber" i={2}>25 min travel</Chip></Row>
              </Panel>
              <FlowArrow i={2} />
              <Panel className="w-40" title="Offer sent"><p className="tr-blink text-xs text-amber-300">Waiting on reply…</p></Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Booked in two clicks',
        caption: 'When a worker accepts, the shift is created, locked to the request and pushed to the calendar — with compliance already verified by the offer gate.',
        visual: (
          <Stage caption="Accept → shift created on the calendar → pipeline card turns teal.">
            <div className="flex items-center gap-3">
              <Panel className="w-44" title="Offer"><Chip tone="emerald" i={0}>Accepted</Chip><p className="mt-1 text-xs text-white/70">Chloe Stan · Night</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Shift calendar">
                <Row i={2}><span className="text-xs text-white">Mon 20 Oct · Chestnut Grange</span><Chip tone="teal" i={3}>Booked</Chip></Row>
              </Panel>
            </div>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'neuven', title: 'Neuven Feed', subtitle: 'Import jobs in seconds — Beta', icon: PlugZap, tint: 'from-amber-500 to-orange-600',
    scenes: [
      {
        title: 'Drop a Neuven CSV in',
        caption: 'Export your Neuven jobs, upload here and every row is validated — matched to clients, dates parsed, duplicates flagged — before anything is written.',
        visual: (
          <Stage caption="Preview first: valid rows go in, problem rows tell you exactly why.">
            <Panel title="Import preview">
              <Row i={0}><span className="text-xs text-white">NV-9001 · Chestnut Grange · Night</span><Chip tone="emerald" i={1}>Import</Chip></Row>
              <div className="mt-2" /><Row i={1}><span className="text-xs text-white">NV-9002 · Unknown Home · Day</span><Chip tone="red" i={2}>No matching client</Chip></Row>
              <div className="mt-2" /><Row i={2}><span className="text-xs text-white">NV-9001 · duplicate in file</span><Chip tone="red" i={3}>Reject</Chip></Row>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Jobs land on the pipeline',
        caption: 'Committed rows become real pending shift requests tagged as Neuven — they flow through offers and allocation like any other request.',
        visual: (
          <Stage caption="Imported jobs appear on the board as 'New' — allocate them like any request.">
            <div className="flex items-center gap-3">
              <Panel className="w-40" title="Neuven CSV"><p className="text-xs text-white/70">NV-9001 · Night ×2</p><p className="mt-1 text-xs text-white/70">NV-9002 · Long day</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Requests board">
                <Row i={2}><span className="text-xs text-white">Chestnut Grange · Night ×2 <span className="text-white/40">ref NV-9001</span></span><Chip tone="sky" i={3}>New</Chip></Row>
              </Panel>
            </div>
            <p className="tr-rise mt-4 text-[11px] text-sky-200/60" style={delay(5)}>The same Neuven reference can never be imported twice — deduped automatically.</p>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'timesheets', title: 'Timesheets', subtitle: 'The approval gate', icon: Clock3, tint: 'from-cyan-500 to-sky-600',
    scenes: [
      {
        title: 'Two signatures, then office approval',
        caption: 'Workers submit hours, the site signs off via a secure link, and the office approves — that approval freezes the pay and charge snapshot.',
        visual: (
          <Stage caption="Worker submits → client signs → you approve. Approval locks the money.">
            <div className="flex items-center gap-2">
              <Panel className="flex-1" title="Worker"><Chip tone="sky" i={0}>Submitted</Chip><p className="mt-1 text-xs text-white/70">13.5h night</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Client sign"><Chip tone="violet" i={2}>Signed</Chip></Panel>
              <FlowArrow i={3} />
              <Panel className="flex-1" title="Office"><Chip tone="emerald" i={4}>Approve</Chip></Panel>
            </div>
            <div className="relative mt-5"><Panel title="Financial snapshot" className="tr-sweep"><p className="text-xs text-white/70">Pay £283.50 · Charge £425.25 · frozen at approval</p></Panel><Stamp delay={1800}>Approved</Stamp></div>
          </Stage>
        ),
      },
      {
        title: 'Queries without the phone tag',
        caption: 'Dispute a line in-app — it pauses that timesheet while the rest of the week keeps moving.',
        visual: (
          <Stage caption="Raise a query on a single line; everything else keeps flowing.">
            <Row i={0}><NameBar name="Mary Begum" sub="Day · 21 Oct · 11h" /><Chip tone="amber" i={1}>Query raised</Chip></Row>
            <div className="mt-2" /><Row i={1}><NameBar name="Chloe Stan" sub="Night · 20 Oct · 13.5h" /><Chip tone="emerald" i={2}>Approved</Chip></Row>
            <p className="tr-rise mt-4 text-[11px] text-white/60" style={delay(4)}>Resolve it → resubmit → approve. Audit trail kept throughout.</p>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'invoicing', title: 'Invoicing', subtitle: 'Bill clients, track payment', icon: PoundSterling, tint: 'from-emerald-500 to-green-600',
    scenes: [
      {
        title: 'Approved timesheets become invoices',
        caption: 'Pick a client and period — every approved, unbilled shift is pulled into line items with rates and uplifts already calculated.',
        visual: (
          <Stage caption="Select client + period → lines build themselves from approved shifts.">
            <Panel title="INV-2026-0002 — Chestnut Grange">
              <Row i={0}><span className="text-xs text-white">Chloe Stan · 14 Oct · night 13.5h</span><span className="tr-rise text-xs text-emerald-300" style={delay(1)}>£425.25</span></Row>
              <div className="mt-2" /><Row i={1}><span className="text-xs text-white">Mary Begum · 15 Oct · long_day 12h</span><span className="tr-rise text-xs text-emerald-300" style={delay(2)}>£312.00</span></Row>
              <div className="mt-3 border-t border-white/10 pt-2 text-right"><span className="tr-rise font-display text-lg font-bold text-white" style={delay(3)}>Total £737.25</span></div>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Send, print, reconcile',
        caption: 'Send generates a pre-filled email to the client\'s billing address; print produces a clean PDF; marking paid with a date feeds aged debtors automatically.',
        visual: (
          <Stage caption="Draft → Sent → Paid. Aged debtors watches everything outstanding.">
            <div className="relative">
              <Panel title="INV-2026-0001 — Ferndale Court">
                <p className="text-xs text-white/70">Sent 12 Oct · due 26 Oct · £1,142.00</p>
                <p className="tr-rise mt-2 text-[11px] text-amber-300" style={delay(3)}>Aged debtors: 5 days outstanding</p>
              </Panel>
              <Stamp delay={1600}>Paid</Stamp>
            </div>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'payroll', title: 'Payroll Export', subtitle: 'PAYE & Ltd in one run', icon: Wallet, tint: 'from-lime-500 to-emerald-600',
    scenes: [
      {
        title: 'Preview before you pay',
        caption: 'The preview groups approved timesheets by engagement type and flags anything unsafe — missing payroll refs, unapproved sheets, or manually-paid rows.',
        visual: (
          <Stage caption="PAYE and Ltd split automatically — rejections explain themselves.">
            <div className="grid grid-cols-2 gap-3">
              <Panel title="PAYE"><Stat label="Rows" value={<Count to={36} />} i={0} /><p className="mt-1 text-[10px] text-white/60">417h · £9,117.54</p></Panel>
              <Panel title="Ltd"><Stat label="Rows" value={<Count to={23} />} i={1} /><p className="mt-1 text-[10px] text-white/60">250.5h · £5,322.23</p></Panel>
            </div>
            <div className="mt-3"><Row i={2}><span className="text-xs text-white">No payroll ref</span><Chip tone="red" i={3}>Rejected — fix & rerun</Chip></Row></div>
          </Stage>
        ),
      },
      {
        title: 'Double-pay is impossible',
        caption: 'Each export is run-tracked; exported shifts are marked paid with the run ID, so the same period can never be exported twice.',
        visual: (
          <Stage caption="Run #22 created → shifts stamped paid → a second export refuses them.">
            <div className="relative">
              <Panel title="Payroll run #22">
                <Row i={0}><span className="text-xs text-white">SAN-001 · Chloe Stan · 13.5h</span><Chip tone="emerald" i={1}>Exported</Chip></Row>
                <div className="mt-2" /><Row i={1}><span className="text-xs text-white">CSV opened in new tab</span><Chip tone="sky" i={2}>Bureau ready</Chip></Row>
              </Panel>
              <Stamp tone="sky" delay={1600}>Exported</Stamp>
            </div>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'margin', title: 'Margin', subtitle: 'What each shift earns you', icon: TrendingUp, tint: 'from-teal-500 to-cyan-600',
    scenes: [
      {
        title: 'Charge minus true cost',
        caption: 'Margin reads the frozen snapshot — charge less pay, employer NI and bureau fees — so the numbers never shift under you.',
        visual: (
          <Stage caption="Actuals from frozen snapshots — NI and bureau fees included.">
            <div className="flex items-end justify-center gap-6">
              <Bar h={90} tone="bg-sky-400/80" i={0} label="Charge £425" />
              <Bar h={60} tone="bg-amber-400/80" i={1} label="Pay £284" />
              <Bar h={18} tone="bg-orange-400/80" i={2} label="NI £43" />
              <Bar h={30} tone="bg-emerald-400/80" i={3} label="Margin £95" />
            </div>
          </Stage>
        ),
      },
      {
        title: 'Run it for any period',
        caption: 'Hit Run with a date range — rows group by client and worker so you can see exactly where margin is made or lost.',
        visual: (
          <Stage caption="Run any period — grouped, honest margins per client and worker.">
            <Row i={0}><span className="text-xs text-white">Chestnut Grange · 12 shifts</span><span className="tr-rise text-xs text-emerald-300" style={delay(1)}>+£1,140 margin</span></Row>
            <div className="mt-2" /><Row i={1}><span className="text-xs text-white">Oaks Lodge · 8 shifts</span><span className="tr-rise text-xs text-emerald-300" style={delay(2)}>+£620 margin</span></Row>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'compliance', title: 'Compliance & DBS', subtitle: 'Documents and register checks', icon: ShieldCheck, tint: 'from-red-500 to-rose-600',
    scenes: [
      {
        title: 'Every document, one status',
        caption: 'The compliance overview counts valid, expiring, expired and missing documents across the whole workforce — and reminds workers automatically.',
        visual: (
          <Stage caption="Expiring and missing items surface automatically — reminders queue themselves.">
            <div className="grid grid-cols-4 gap-3">
              <Stat i={0} label="Valid" value={<Count to={412} />} tone="text-emerald-300" />
              <Stat i={1} label="Expiring" value={<Count to={9} />} tone="text-amber-300" />
              <Stat i={2} label="Expired" value={<Count to={3} />} tone="text-red-300" />
              <Stat i={3} label="Blocked" value={<Count to={4} />} tone="text-red-300" />
            </div>
            <p className="tr-rise mt-5 rounded-lg bg-sky-400/10 px-3 py-2 text-[11px] text-sky-300 ring-1 ring-sky-400/20" style={delay(4)}>
              Reminder messages queue to the outbox at 60 / 30 / 14 / 7 days before expiry.
            </p>
          </Stage>
        ),
      },
      {
        title: 'DBS checks — beta board',
        caption: 'The DBS section tracks each worker\'s certificate and latest Update Service check, flags who needs re-checking, and imports provider CSVs — ready for an API when one exists.',
        visual: (
          <Stage caption="Colour-coded DBS board — red needs fixing, amber needs a re-check.">
            <Row i={0}><NameBar name="Mary Begum" sub="cert 0017123456 · checked 15 Oct" /><Chip tone="emerald" i={1}>In date</Chip></Row>
            <div className="mt-2" /><Row i={1}><NameBar name="Test Worker" sub="result: new information" /><Chip tone="red" i={2}>Attention</Chip></Row>
            <div className="mt-2" /><Row i={2}><NameBar name="Adebayo Bello" sub="last check 7 months ago" /><Chip tone="amber" i={3}>Re-check due</Chip></Row>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'portals', title: 'Portals', subtitle: 'Workers, clients & supervisors', icon: MonitorSmartphone, tint: 'from-indigo-500 to-violet-600',
    scenes: [
      {
        title: 'Workers self-serve',
        caption: 'Staff set availability, accept offers, submit timesheets and upload documents from their own portal — no calls, no paper.',
        visual: (
          <Stage caption="Worker portal: availability, offers, timesheets and documents.">
            <div className="grid grid-cols-2 gap-3">
              <Panel title="Worker sees"><p className="text-xs text-white/70">Offer: Night · Chestnut Grange · Sat</p><div className="mt-2 flex gap-2"><Chip tone="emerald" i={1}>Accept</Chip><Chip tone="slate" i={2}>Decline</Chip></div></Panel>
              <Panel title="Worker never sees"><p className="text-xs text-red-300/80">Rates · margins · other workers' details</p></Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Clients stay in the loop',
        caption: 'Homes raise requests, see their rota and sign timesheets from their portal; supervisors get a rota view and check workers in on site.',
        visual: (
          <Stage caption="Client portal for requests & rotas; supervisor portal for on-site check-in.">
            <div className="flex items-center gap-3">
              <Panel className="flex-1" title="Client"><p className="text-xs text-white/70">Rota · Requests · Timesheets</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Supervisor"><p className="text-xs text-white/70">Tonight's rota · check-in</p><Chip tone="teal" i={2}>Arrived</Chip></Panel>
            </div>
          </Stage>
        ),
      },
    ],
  },
  {
    id: 'dbs-beta', title: 'DBS Checks (Beta)', subtitle: 'Provider profile + imports', icon: Fingerprint, tint: 'from-slate-500 to-slate-700',
    scenes: [
      {
        title: 'Save your provider details',
        caption: 'Whether checks run on gov.uk directly or through an umbrella body like uCheck, store the profile — endpoint, org ref and API key — ready for the day an API is available.',
        visual: (
          <Stage caption="One profile: provider name, endpoint if they have one, credentials kept server-side.">
            <Panel title="Provider profile">
              <div className="space-y-1.5 text-[11px] text-white/70">
                <p className="tr-rise" style={delay(0)}>Provider: gov.uk DBS Update Service</p>
                <p className="tr-rise" style={delay(1)}>Endpoint: — (browser only)</p>
                <p className="tr-rise" style={delay(2)}>Status: CSV import active · API pending</p>
              </div>
            </Panel>
            <p className="tr-rise mt-4 text-[11px] text-sky-200/60" style={delay(4)}>Honest by design — the app never claims a connection that doesn't exist.</p>
          </Stage>
        ),
      },
      {
        title: 'CSV in, records updated',
        caption: 'Export results from your provider, drop the file in, and each row lands as an audited register check on the matched worker.',
        visual: (
          <Stage caption="Provider CSV → validated preview → audited check on each worker's file.">
            <div className="flex items-center gap-3">
              <Panel className="w-44" title="Provider CSV"><p className="text-xs text-white/70">email, cert, result, date</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Worker record">
                <Row i={2}><span className="text-xs text-white">DBS check · clear</span><Chip tone="emerald" i={3}>csv import</Chip></Row>
              </Panel>
            </div>
          </Stage>
        ),
      },
    ],
  },
];
