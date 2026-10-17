import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, Building2, ClipboardList, PlugZap, Clock3,
  PoundSterling, Wallet, TrendingUp, ShieldCheck, MonitorSmartphone, Fingerprint,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Stage, Stat, Row, NameBar, Chip, Stamp, FlowArrow, Panel, Bar, Count,
  delay, Ticker, Spark, KanbanMove, FillBar, CycleChip,
} from './visuals';

export interface Scene { title: string; caption: string; visual: ReactNode }
export interface Module {
  id: string; title: string; subtitle: string; icon: LucideIcon;
  tint: string; scenes: Scene[];
}

const PIPE = [
  { label: 'New', color: '#38bdf8' }, { label: 'Offers out', color: '#fbbf24' },
  { label: 'Part-filled', color: '#fb923c' }, { label: 'Booked', color: '#2dd4bf' },
];

const PIPE_FULL = [
  { label: 'New', color: '#38bdf8' }, { label: 'Offers out', color: '#fbbf24' },
  { label: 'Part-filled', color: '#fb923c' }, { label: 'Booked', color: '#2dd4bf' },
  { label: 'Awaiting TS', color: '#a78bfa' }, { label: 'Invoice', color: '#14b8a6' },
  { label: 'Complete', color: '#34d399' },
];

export const MODULES: Module[] = [
  // ── 1 · Dashboard ─────────────────────────────────────────────────────────
  {
    id: 'dashboard', title: 'Dashboard & Pipeline', subtitle: 'Your whole operation at a glance', icon: LayoutDashboard, tint: 'from-sky-500 to-blue-600',
    scenes: [
      {
        title: 'Live numbers, always current',
        caption: 'The dashboard opens on real-time totals — workers on the books, care homes you serve, this month\'s revenue and margin — so the business position is never more than a glance away.',
        visual: (
          <Stage caption="KPI tiles count themselves up from the live database — revenue and margin included.">
            <div className="grid grid-cols-4 gap-3">
              <Stat i={0} label="Active workers" value={<Count to={47} />} />
              <Stat i={1} label="Care homes" value={<Count to={7} />} />
              <Stat i={2} label="Revenue MTD" value={<Count to={14.4} prefix="£" suffix="k" decimals={1} />} tone="text-emerald-300" />
              <Stat i={3} label="Margin MTD" value={<Count to={3.1} prefix="£" suffix="k" decimals={1} />} tone="text-teal-300" />
            </div>
            <Panel className="mt-4" title="Revenue trend">
              <Spark points={[8, 9.4, 8.8, 10.2, 11.8, 11.1, 13.2, 14.4]} tone="#38bdf8" />
            </Panel>
            <div className="mt-4"><Ticker items={[
              'Chloe Stan booked — Chestnut Grange night', 'Invoice INV-2026-0002 sent to Ferndale Court',
              'Mary Begum timesheet approved', 'New request — Oaks Lodge, 2 × day shifts',
              'Payroll run #22 exported (PAYE)', 'DBS check recorded — Emmanuel Nwosu',
            ]} /></div>
          </Stage>
        ),
      },
      {
        title: 'The colour-coded pipeline',
        caption: 'Every client request travels through seven colour-coded stages. The dashboard strip shows live counts at each stage — click any one to jump to the board filtered to exactly that work.',
        visual: (
          <Stage caption="Watch a request travel: blue is new, amber needs chasing, emerald is done and invoiced.">
            <KanbanMove cols={PIPE_FULL} card={<span>Chestnut Grange · Night ×2</span>} dwell={1100} />
            <div className="mt-8 space-y-2">
              <Row i={1}><span className="text-xs text-white">Oaks Lodge · urgent day cover</span><Chip tone="red" blink>Urgent</Chip></Row>
              <Row i={2}><span className="text-xs text-white">Ferndale Court · 3 shifts approved</span><Chip tone="teal">Ready to invoice</Chip></Row>
            </div>
            <p className="tr-rise mt-4 text-[11px] text-sky-200/60" style={delay(5)}>Requests that slip backwards — e.g. a filled request whose shifts get cancelled — drop back to "New" automatically.</p>
          </Stage>
        ),
      },
      {
        title: 'This week\'s shifts & alerts',
        caption: 'Below the pipeline: every shift booked this week, tasks due, and compliance alerts — anything expiring or missing is surfaced before it becomes a problem.',
        visual: (
          <Stage caption="Shifts this week, tasks due, and compliance warnings — nothing hides.">
            <div className="grid grid-cols-3 gap-3">
              <Panel title="This week" className="col-span-2">
                <Row i={0}><NameBar name="Chloe Stan" sub="Chestnut Grange · Mon night" /><Chip tone="teal">Booked</Chip></Row>
                <div className="mt-1.5" /><Row i={1}><NameBar name="Mary Begum" sub="Oaks Lodge · Tue day" /><Chip tone="teal">Booked</Chip></Row>
                <div className="mt-1.5" /><Row i={2}><NameBar name="Adebayo Bello" sub="Ferndale · Thu long day" /><Chip tone="sky">Offered</Chip></Row>
              </Panel>
              <Panel title="Attention">
                <p className="tr-rise text-[11px] text-amber-300" style={delay(1)}>2 docs expiring &lt;60d</p>
                <p className="tr-rise mt-1.5 text-[11px] text-red-300" style={delay(2)}>1 timesheet query open</p>
                <p className="tr-rise mt-1.5 text-[11px] text-sky-200/70" style={delay(3)}>3 tasks due today</p>
              </Panel>
            </div>
          </Stage>
        ),
      },
    ],
  },
  // ── 2 · Candidates ──────────────────────────────────────────────────────────
  {
    id: 'candidates', title: 'Candidates', subtitle: 'Your workforce, fully profiled', icon: Users, tint: 'from-violet-500 to-purple-600',
    scenes: [
      {
        title: 'The complete worker record',
        caption: 'Each nurse, HCA and support worker gets a living profile — contact details, pay expectations, payroll reference, bank details, photo and full compliance file. Everything payroll and invoicing needs is already on the record.',
        visual: (
          <Stage caption="One record per worker — searchable, filterable, always up to date.">
            <div className="space-y-2">
              <Row i={0}><NameBar name="Chloe Stan" sub="Registered Nurse · SAN-001" /><Chip tone="emerald" i={1}>Compliant</Chip></Row>
              <Row i={1}><NameBar name="Mary Begum" sub="HCA · SAN-005" /><Chip tone="emerald" i={2}>Compliant</Chip></Row>
              <Row i={2}><NameBar name="Emmanuel Nwosu" sub="Support Worker · SAN-012" /><Chip tone="amber" i={3}>1 doc expiring</Chip></Row>
            </div>
            <Panel className="tr-pop mt-4" title="Inside a profile" scan>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] text-white/70">
                <span>Payroll ref: <b className="text-white">SAN-001</b></span><span>Engagement: <b className="text-white">PAYE</b></span>
                <span>NMC PIN: <b className="text-white">on file</b></span><span>Bank: <b className="text-white">04-00-04 ••••</b></span>
                <span>Pay band: <b className="text-white">£21–24/h</b></span><span>Travel: <b className="text-white">15 miles</b></span>
              </div>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Compliance score, live',
        caption: 'The ring on each profile is the worker\'s compliance score — it drops the moment a required document lapses and climbs back as staff fix gaps.',
        visual: (
          <Stage caption="The compliance ring recalculates itself every time a document changes.">
            <div className="flex items-center gap-6">
              <div className="relative h-28 w-28">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth="10" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#34d399" strokeWidth="10" strokeLinecap="round"
                    pathLength={100} strokeDasharray="92 100" className="tr-draw" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-white"><Count to={92} suffix="%" /></span>
              </div>
              <div className="flex-1 space-y-1.5">
                <FillBar i={0} pct={100} label="DBS Enhanced — valid" tone="bg-emerald-400/80" />
                <FillBar i={1} pct={100} label="Right to Work — valid" tone="bg-emerald-400/80" />
                <FillBar i={2} pct={62} label="Mandatory Training — 38 days left" tone="bg-amber-400/80" />
                <FillBar i={3} pct={88} label="NMC PIN — verified" tone="bg-emerald-400/80" />
              </div>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Registration without admin',
        caption: 'New workers self-register through a public link — drafting documents and details themselves — and land in the pipeline for office review instead of an inbox.',
        visual: (
          <Stage caption="Public registration link → worker uploads their own docs → office reviews.">
            <div className="flex items-center gap-2">
              <Panel className="flex-1" title="Worker's phone">
                <p className="text-[11px] text-white/70">Registration form</p>
                <FillBar i={1} pct={80} tone="bg-sky-400/80" label="4 of 5 sections" />
                <p className="mt-1.5 text-[10px] text-sky-200/60">Passport uploaded ✓</p>
              </Panel>
              <FlowArrow i={2} />
              <Panel className="flex-1" title="Office queue">
                <Row i={3}><NameBar name="New applicant" /><Chip tone="sky" i={4}>Review</Chip></Row>
              </Panel>
            </div>
          </Stage>
        ),
      },
    ],
  },
  // ── 3 · Care Homes ─────────────────────────────────────────────────────────
  {
    id: 'clients', title: 'Care Homes', subtitle: 'Clients, contacts & site rules', icon: Building2, tint: 'from-teal-500 to-emerald-600',
    scenes: [
      {
        title: 'One record per home',
        caption: 'Every client holds contacts, billing email, address — and its own compliance requirements layered on top of the agency baseline. Bookings check both automatically.',
        visual: (
          <Stage caption="Baseline + site-specific requirements — enforced on every allocation.">
            <Row i={0}><NameBar name="Chestnut Grange" sub="Colchester · Nursing" /><Chip tone="sky">Active client</Chip></Row>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Panel title="Agency baseline"><p className="text-[10px] leading-relaxed text-white/60">DBS Enhanced · Right to Work · Passport/ID · Mandatory Training · NMC for nurses</p></Panel>
              <Panel title="Chestnut Grange adds"><p className="tr-rise text-[10px] leading-relaxed text-amber-300/90" style={delay(1)}>+ PMVA trained<br />+ Immunisation history<br />+ Proof of address</p></Panel>
            </div>
            <p className="tr-rise mt-3 rounded-lg bg-sky-400/10 px-3 py-2 text-[11px] text-sky-300 ring-1 ring-sky-400/20" style={delay(3)}>
              A worker missing PMVA can't be booked here — but stays bookable elsewhere.
            </p>
          </Stage>
        ),
      },
      {
        title: 'Requests arrive pre-structured',
        caption: 'Homes raise requests through their own portal — date, shift type, role, quantity — and they land on your pipeline board instantly. No phone tag, no lost emails.',
        visual: (
          <Stage caption="Client portal → your pipeline board. Structured requests in, not scribbled notes.">
            <div className="flex items-center gap-2">
              <Panel className="w-52" title="Client portal" scan>
                <p className="text-[11px] text-white/70">"2 × night RN, 20–21 Oct"</p>
                <Chip tone="amber" i={1}>Urgent</Chip>
              </Panel>
              <FlowArrow i={2} />
              <Panel className="flex-1" title="Pipeline — New">
                <Row i={3}><span className="text-xs text-white">Chestnut Grange · Night ×2</span><Chip tone="sky" i={4}>New</Chip></Row>
              </Panel>
            </div>
            <div className="mt-4"><Ticker items={[
              'Requests carry their own audit trail', 'Client sees live fill status in their portal',
              'Urgent requests flagged red on the board', 'Part-filled requests stay visible until covered',
            ]} /></div>
          </Stage>
        ),
      },
      {
        title: 'Full history per client',
        caption: 'Invoices, shifts, contacts and request history live on the client record — so when a home calls, you have the whole relationship in front of you.',
        visual: (
          <Stage caption="Invoices, rotas and contacts — the whole client relationship on one page.">
            <div className="grid grid-cols-3 gap-2">
              <Panel title="Shifts"><Stat label="This month" value={<Count to={34} />} i={0} /></Panel>
              <Panel title="Invoiced"><Stat label="Outstanding" value={<Count to={2} />} i={1} /></Panel>
              <Panel title="Fill rate"><Stat label="October" value={<Count to={96} suffix="%" />} i={2} /></Panel>
            </div>
            <Row i={3}><span className="text-xs text-white">INV-2026-0001 · £1,142.00</span><Chip tone="emerald" i={4}>Paid</Chip></Row>
          </Stage>
        ),
      },
    ],
  },
  // ── 4 · Requests & Allocation ───────────────────────────────────────────────
  {
    id: 'requests', title: 'Requests & Allocation', subtitle: 'From ask to filled shift', icon: ClipboardList, tint: 'from-blue-500 to-indigo-600',
    scenes: [
      {
        title: 'The pipeline board',
        caption: 'Requests sit in colour-coded columns by their furthest outstanding stage — New, Offers out, Part-filled, Booked — so the room can see at a glance what needs doing.',
        visual: (
          <Stage caption="Cards physically move as work progresses — no status ever goes stale.">
            <KanbanMove cols={PIPE} card={<span>Ferndale Court · Day ×1</span>} dwell={1200} />
            <div className="mt-8 grid grid-cols-2 gap-2 text-[10px] text-white/60">
              <p className="tr-rise" style={delay(1)}>▸ Cards show fill progress (1/7), offers out, worker names</p>
              <p className="tr-rise" style={delay(2)}>▸ Allocate button on cards that still need workers</p>
              <p className="tr-rise" style={delay(3)}>▸ Awaiting-timesheet cards jump straight to Timesheets</p>
              <p className="tr-rise" style={delay(4)}>▸ Ready-to-invoice cards jump to Invoicing</p>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Eligible workers, ranked by context',
        caption: 'Open a request and the allocation drawer lists workers who are free, compliant and closest — with travel distance, continuity and first-choice flags. You pick; the system never auto-assigns.',
        visual: (
          <Stage caption="Human allocation: the drawer ranks eligible workers — you decide who gets the offer.">
            <Panel title="Eligible for Chestnut Grange · Night" scan>
              <div className="space-y-1.5">
                <Row i={0}><NameBar name="Chloe Stan" sub="8 min away" /><Chip tone="emerald" i={1}>First choice</Chip></Row>
                <Row i={1}><NameBar name="Mary Begum" sub="14 min away" /><Chip tone="sky" i={2}>Available</Chip></Row>
                <Row i={2}><NameBar name="Emmanuel Nwosu" sub="31 min" /><Chip tone="amber" i={3}>Far</Chip></Row>
              </div>
            </Panel>
            <p className="tr-rise mt-3 text-[11px] text-sky-200/60" style={delay(4)}>Non-compliant or blocked workers are filtered out before you ever see them.</p>
          </Stage>
        ),
      },
      {
        title: 'Offer → accept → booked',
        caption: 'Send the offer by WhatsApp or email from the outbox. When the worker accepts in their portal, the shift is created, the calendar updates and the pipeline card turns teal — all in one motion.',
        visual: (
          <Stage caption="One acceptance creates the shift, updates the calendar and moves the pipeline card.">
            <div className="flex items-center gap-2">
              <Panel className="flex-1" title="Worker's phone"><p className="text-[10px] text-white/60">Night · Chestnut Grange</p><Chip tone="emerald" i={0} pulse>Accept</Chip></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Shift created"><Row i={2}><span className="text-[10px] text-white">Mon 20 Oct · Night</span><Chip tone="teal" i={3}>Booked</Chip></Row></Panel>
              <FlowArrow i={4} />
              <Panel className="w-28" title="Pipeline"><Chip tone="teal" i={5}>Booked</Chip></Panel>
            </div>
          </Stage>
        ),
      },
    ],
  },
  // ── 5 · Neuven ──────────────────────────────────────────────────────────────
  {
    id: 'neuven', title: 'Neuven Feed (Beta)', subtitle: 'External jobs, imported clean', icon: PlugZap, tint: 'from-amber-500 to-orange-600',
    scenes: [
      {
        title: 'CSV in, jobs out',
        caption: 'Export your Neuven allocations to CSV and drop it in. Every row is validated live — client matched, date parsed, shift type normalised — before a single request is created.',
        visual: (
          <Stage caption="Preview shows exactly what each row will do — green goes in, red explains why not.">
            <Panel title="Import preview" scan>
              <div className="space-y-1.5">
                <Row i={0}><span className="text-xs text-white">NV-9001 · Chestnut Grange · 20 Oct · Night</span><Chip tone="emerald" i={1}>Import</Chip></Row>
                <Row i={1}><span className="text-xs text-white">NV-9002 · Chestnut Grange · 21 Oct · Long day</span><Chip tone="emerald" i={2}>Import</Chip></Row>
                <Row i={2}><span className="text-xs text-white">NV-9003 · "Nowhere Home" · Day</span><Chip tone="red" i={3}>No client match</Chip></Row>
                <Row i={3}><span className="text-xs text-white">NV-9001 · repeated row</span><Chip tone="red" i={4}>Duplicate</Chip></Row>
              </div>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Straight into the pipeline',
        caption: 'Committed rows become real pending requests, tagged with their Neuven reference — they appear on the board as New and go through the same offer-and-allocate flow as anything else.',
        visual: (
          <Stage caption="Imported jobs are first-class requests — allocate them exactly like internal ones.">
            <div className="flex items-center gap-2">
              <Panel className="w-44" title="Neuven CSV"><p className="text-xs text-white/70">NV-9001 · Night ×2</p><p className="mt-1 text-xs text-white/70">NV-9002 · Long day</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Requests board">
                <Row i={2}><span className="text-xs text-white">Chestnut Grange · Night ×2 <span className="text-white/40">NV-9001</span></span><Chip tone="sky" i={3}>New</Chip></Row>
              </Panel>
            </div>
            <p className="tr-rise mt-4 text-[11px] text-sky-200/60" style={delay(5)}>external_ref dedup means the same Neuven job can never be imported twice.</p>
          </Stage>
        ),
      },
      {
        title: 'Automatic sync, when it exists',
        caption: 'Neuven don\'t publish a public API — so the connection profile stores endpoint and credentials ready for the day access is agreed. Test connection probes it live so the plumbing is proven, not promised.',
        visual: (
          <Stage caption="A real probe against the saved endpoint — honest status, never theatre.">
            <Panel title="Connection profile">
              <div className="space-y-1.5 text-[11px] text-white/70">
                <p className="tr-rise" style={delay(0)}>Endpoint: <b className="text-white">api.neuven…</b></p>
                <p className="tr-rise" style={delay(1)}>Org ref: <b className="text-white">SANITAS-001</b></p>
                <p className="tr-rise" style={delay(2)}>API key: <b className="text-white">stored server-side</b></p>
              </div>
              <div className="mt-3"><CycleChip states={[{ label: 'Probing…', tone: 'amber' }, { label: 'Unreachable', tone: 'red' }, { label: 'CSV active', tone: 'emerald' }]} ms={1600} /></div>
            </Panel>
          </Stage>
        ),
      },
    ],
  },
  // ── 6 · Timesheets ──────────────────────────────────────────────────────────
  {
    id: 'timesheets', title: 'Timesheets', subtitle: 'Signatures, approval, audit', icon: Clock3, tint: 'from-cyan-500 to-sky-600',
    scenes: [
      {
        title: 'Three-way sign-off',
        caption: 'The worker submits hours, the site supervisor countersigns by secure phone link, and the office approves. Each step is timestamped and locked behind the last.',
        visual: (
          <Stage caption="Submit → client signs → office approves. Approval freezes the money.">
            <div className="flex items-center gap-1.5">
              <Panel className="flex-1" title="Worker"><Chip tone="sky" i={0}>Submitted</Chip><p className="mt-1 text-[10px] text-white/60">13.5h · night</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Site sign"><Chip tone="violet" i={2}>Signed</Chip></Panel>
              <FlowArrow i={3} />
              <Panel className="flex-1" title="Office"><Chip tone="emerald" i={4} pulse>Approve</Chip></Panel>
            </div>
            <div className="relative mt-4">
              <Panel title="Financial snapshot" scan><p className="text-xs text-white/70">Pay £283.50 · Charge £425.25 · NI + fee — frozen</p></Panel>
              <Stamp delay={2000}>Approved</Stamp>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Uplifts calculated for you',
        caption: 'Night, weekend and bank-holiday multipliers apply automatically — highest-wins by default — so a Saturday night is priced correctly without anyone reaching for a calculator.',
        visual: (
          <Stage caption="Night ×1.15, weekend ×1.25, bank holiday ×1.5 — highest wins automatically.">
            <div className="space-y-2">
              <Row i={0}><span className="text-xs text-white">Mon day · 11h</span><span className="tr-rise text-xs text-white/70" style={delay(1)}>£231.00</span></Row>
              <Row i={1}><span className="text-xs text-white">Sat night · 13.5h</span><span className="tr-rise text-xs text-amber-300" style={delay(2)}>×1.25 → £354.38</span></Row>
              <Row i={2}><span className="text-xs text-white">Bank holiday · 12h</span><span className="tr-rise text-xs text-orange-300" style={delay(3)}>×1.50 → £378.00</span></Row>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Queries pause one line, not the week',
        caption: 'Wrong hours? Raise a query against that single timesheet — it pauses while the rest of the week flows through. Resolve, resubmit, approve, with the audit trail intact.',
        visual: (
          <Stage caption="One queried line doesn't hold up everyone else's pay.">
            <div className="space-y-2">
              <Row i={0}><NameBar name="Mary Begum" sub="Day · 21 Oct · client says 9h not 11h" /><Chip tone="amber" i={1} blink>Query open</Chip></Row>
              <Row i={1}><NameBar name="Chloe Stan" sub="Night · 20 Oct" /><Chip tone="emerald" i={2}>Approved</Chip></Row>
              <Row i={2}><NameBar name="Adebayo Bello" sub="Early · 22 Oct" /><Chip tone="emerald" i={3}>Approved</Chip></Row>
            </div>
          </Stage>
        ),
      },
    ],
  },
  // ── 7 · Invoicing ───────────────────────────────────────────────────────────
  {
    id: 'invoicing', title: 'Invoicing', subtitle: 'Bill, send, reconcile', icon: PoundSterling, tint: 'from-emerald-500 to-green-600',
    scenes: [
      {
        title: 'Invoices build themselves',
        caption: 'Pick a client and a period — every approved, unbilled shift becomes a line item with hours, rate and uplift already resolved. Totals count themselves; numbering is automatic.',
        visual: (
          <Stage caption="Approved shifts → line items → running total. Nothing is typed twice.">
            <Panel title="INV-2026-0002 — Chestnut Grange" className="tr-sweep">
              <div className="space-y-1.5">
                <Row i={0}><span className="text-[11px] text-white">Chloe Stan · 14 Oct · night 13.5h</span><span className="text-[11px] text-emerald-300">£425.25</span></Row>
                <Row i={1}><span className="text-[11px] text-white">Mary Begum · 15 Oct · long day 12h</span><span className="text-[11px] text-emerald-300">£312.00</span></Row>
                <Row i={2}><span className="text-[11px] text-white">Adebayo Bello · 16 Oct · day 9h</span><span className="text-[11px] text-emerald-300">£189.00</span></Row>
              </div>
              <div className="mt-3 flex justify-end border-t border-white/10 pt-2">
                <span className="font-display text-lg font-bold text-white">Total <Count to={926.25} prefix="£" decimals={2} dur={1200} /></span>
              </div>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Send, print, get paid',
        caption: 'Send queues a pre-filled email to the client\'s billing address with the PDF attached-ready print view. Marking paid takes a real payment date — that\'s what feeds reconciliation.',
        visual: (
          <Stage caption="Draft → Sent → Paid, with a clean printable PDF in between.">
            <div className="relative">
              <Panel title="INV-2026-0001 — Ferndale Court">
                <p className="text-xs text-white/70">£1,142.00 · issued 12 Oct · due 26 Oct</p>
                <div className="mt-2 flex gap-2">
                  <Chip tone="sky" i={1}>Send → mailto</Chip><Chip tone="slate" i={2}>Print PDF</Chip><Chip tone="emerald" i={3}>Mark paid</Chip>
                </div>
              </Panel>
              <Stamp delay={1900}>Paid</Stamp>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Aged debtors watches everything',
        caption: 'Sent-but-unpaid invoices stack into ageing buckets — current, 1–30, 31–60, 60+ — with the client names on each, so chasing is a report, not a memory test.',
        visual: (
          <Stage caption="Only issued invoices count as debt — drafts never pollute the numbers.">
            <div className="flex items-end justify-center gap-5">
              <Bar h={35} tone="bg-emerald-400/80" i={0} label="Current" />
              <Bar h={70} tone="bg-amber-400/80" i={1} label="1–30d" />
              <Bar h={45} tone="bg-orange-400/80" i={2} label="31–60d" />
              <Bar h={20} tone="bg-red-400/80" i={3} label="60d+" />
            </div>
            <div className="mt-4"><Ticker items={[
              'Ferndale Court · £1,142 · 5 days', 'Oaks Lodge · £2,310 · 34 days', 'Meadow View · £890 · current',
            ]} /></div>
          </Stage>
        ),
      },
    ],
  },
  // ── 8 · Payroll ─────────────────────────────────────────────────────────────
  {
    id: 'payroll', title: 'Payroll Export', subtitle: 'PAYE & Ltd, bureau-ready', icon: Wallet, tint: 'from-lime-500 to-emerald-600',
    scenes: [
      {
        title: 'Preview before anything moves',
        caption: 'The preview splits approved timesheets into PAYE and Ltd runs with totals and hours — and lists every rejected row with its exact reason before you commit.',
        visual: (
          <Stage caption="Two clean runs per period — and rejections that explain themselves.">
            <div className="grid grid-cols-2 gap-3">
              <Panel title="PAYE run"><Stat label="Rows" value={<Count to={36} />} i={0} /><p className="mt-1 text-[10px] text-white/60">417h · <Count to={9117.54} prefix="£" decimals={2} dur={1200} /></p></Panel>
              <Panel title="Ltd run"><Stat label="Rows" value={<Count to={23} />} i={1} /><p className="mt-1 text-[10px] text-white/60">250.5h · <Count to={5322.23} prefix="£" decimals={2} dur={1200} /></p></Panel>
            </div>
            <div className="mt-3 space-y-1.5">
              <Row i={2}><span className="text-[11px] text-white">Timesheet not approved</span><Chip tone="red" i={3}>Rejected</Chip></Row>
              <Row i={3}><span className="text-[11px] text-white">No payroll ref on file</span><Chip tone="red" i={4}>Rejected</Chip></Row>
            </div>
          </Stage>
        ),
      },
      {
        title: 'One click, one run, never twice',
        caption: 'Export writes a payroll run, marks the shifts paid against that run ID, and downloads the bureau CSV. Run it again on the same period and the rows refuse — double-pay is structurally impossible.',
        visual: (
          <Stage caption="Export → run recorded → shifts stamped paid → re-export refused.">
            <div className="relative">
              <Panel title="Run #22 · PAYE" scan>
                <Row i={0}><span className="text-[11px] text-white">SAN-001 · Chloe Stan · 13.5h</span><Chip tone="emerald" i={1}>£283.50</Chip></Row>
                <div className="mt-1.5" /><Row i={1}><span className="text-[11px] text-white">SAN-005 · Mary Begum · 11h</span><Chip tone="emerald" i={2}>£231.00</Chip></Row>
                <p className="mt-2 text-[10px] text-sky-200/60">payroll_ref · hours · uplift · amount — bureau format</p>
              </Panel>
              <Stamp tone="sky" delay={1700}>Exported</Stamp>
            </div>
            <p className="tr-rise mt-3 text-[11px] text-sky-200/60" style={delay(5)}>Already-exported rows show as neutral "in run #22", never as errors.</p>
          </Stage>
        ),
      },
      {
        title: 'Every run is auditable',
        caption: 'Run history lists each export — who ran it, when, which engagement, how many shifts, total value — with the CSV re-downloadable at any point.',
        visual: (
          <Stage caption="Full export history — re-download any run's CSV any time.">
            <div className="space-y-2">
              <Row i={0}><span className="text-xs text-white">Run #23 · Ltd · 9 shifts</span><span className="text-[11px] text-emerald-300">£1,759.76</span></Row>
              <Row i={1}><span className="text-xs text-white">Run #22 · PAYE · 11 shifts</span><span className="text-[11px] text-emerald-300">£2,855.74</span></Row>
              <Row i={2}><span className="text-xs text-white">Run #21 · PAYE · 14 shifts</span><span className="text-[11px] text-emerald-300">£3,104.20</span></Row>
            </div>
          </Stage>
        ),
      },
    ],
  },
  // ── 9 · Margin ──────────────────────────────────────────────────────────────
  {
    id: 'margin', title: 'Margin', subtitle: 'Profit per shift, honestly', icon: TrendingUp, tint: 'from-teal-500 to-cyan-600',
    scenes: [
      {
        title: 'True cost, not just pay',
        caption: 'Margin reads the frozen approval snapshot — charge minus pay minus employer NI minus bureau fee — so historical numbers can\'t drift when rates change later.',
        visual: (
          <Stage caption="Charge − pay − NI − fee = real margin. From frozen snapshots, not live rates.">
            <div className="flex items-end justify-center gap-6">
              <Bar h={92} tone="bg-sky-400/80" i={0} label="Charge" />
              <Bar h={62} tone="bg-amber-400/80" i={1} label="Pay" />
              <Bar h={14} tone="bg-orange-400/80" i={2} label="NI" />
              <Bar h={8} tone="bg-violet-400/80" i={3} label="Fee" />
              <Bar h={34} tone="bg-emerald-400/90" i={4} label="Margin" />
            </div>
          </Stage>
        ),
      },
      {
        title: 'Run any period, drill anywhere',
        caption: 'Hit Run on a date range and results group by client and worker — actuals where snapshots exist, estimates flagged as estimates, unavailable rows named rather than hidden.',
        visual: (
          <Stage caption="Actual / estimated / unavailable are labelled separately — nothing is silently guessed.">
            <div className="grid grid-cols-3 gap-2">
              <Panel title="Actual"><Stat label="Shifts" value={<Count to={31} />} i={0} /><p className="text-[10px] text-emerald-300">frozen snapshots</p></Panel>
              <Panel title="Estimated"><Stat label="Shifts" value={<Count to={6} />} i={1} /><p className="text-[10px] text-amber-300">live rates</p></Panel>
              <Panel title="No data"><Stat label="Shifts" value={<Count to={2} />} i={2} /><p className="text-[10px] text-red-300">flagged</p></Panel>
            </div>
            <Panel className="mt-3" title="Margin trend"><Spark points={[6, 8, 7.2, 9.5, 9, 11, 12.4, 13.1]} tone="#2dd4bf" /></Panel>
          </Stage>
        ),
      },
      {
        title: 'Where margin is made',
        caption: 'Group results by client to see which homes are worth the effort, or by worker to spot where uplifts are eating the spread.',
        visual: (
          <Stage caption="Per-client margins — see instantly who earns their fee.">
            <div className="space-y-2">
              <div><p className="text-[10px] text-white/60">Chestnut Grange</p><FillBar i={0} pct={92} tone="bg-emerald-400/80" /></div>
              <div><p className="text-[10px] text-white/60">Oaks Lodge</p><FillBar i={1} pct={64} tone="bg-teal-400/80" /></div>
              <div><p className="text-[10px] text-white/60">Ferndale Court</p><FillBar i={2} pct={48} tone="bg-sky-400/80" /></div>
              <div><p className="text-[10px] text-white/60">Meadow View</p><FillBar i={3} pct={21} tone="bg-amber-400/80" /></div>
            </div>
          </Stage>
        ),
      },
    ],
  },
  // ── 10 · Compliance ─────────────────────────────────────────────────────────
  {
    id: 'compliance', title: 'Compliance', subtitle: 'Documents that police themselves', icon: ShieldCheck, tint: 'from-red-500 to-rose-600',
    scenes: [
      {
        title: 'A live status per document',
        caption: 'The overview counts valid, expiring, expired and missing documents across the workforce — statuses refresh themselves as dates pass, with nobody needing to flip a flag.',
        visual: (
          <Stage caption="Expiring flips itself at 60 days; expired flips the day after — automatically.">
            <div className="grid grid-cols-4 gap-3">
              <Stat i={0} label="Valid" value={<Count to={412} />} tone="text-emerald-300" />
              <Stat i={1} label="Expiring" value={<Count to={9} />} tone="text-amber-300" />
              <Stat i={2} label="Expired" value={<Count to={3} />} tone="text-red-300" />
              <Stat i={3} label="Blocked" value={<Count to={4} />} tone="text-red-300" />
            </div>
            <div className="mt-4 space-y-1.5">
              <Row i={1}><NameBar name="Emmanuel Nwosu" sub="Mandatory Training" /><Chip tone="amber" i={2}>38 days</Chip></Row>
              <Row i={2}><NameBar name="Test Worker" sub="DBS Enhanced" /><Chip tone="red" i={3}>Missing</Chip></Row>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Reminders queue themselves',
        caption: 'At 60, 30, 14 and 7 days before expiry the system writes reminder messages to the outbox — WhatsApp and email, addressed to the worker — and logs a monthly digest to compliance staff.',
        visual: (
          <Stage caption="60 / 30 / 14 / 7-day reminders into the outbox — deduped per document per day.">
            <div className="flex items-center gap-2">
              <Panel className="w-40" title="Expiry clock">
                <div className="space-y-1.5"><FillBar i={0} pct={100} label="60d" tone="bg-sky-400/70" /><FillBar i={1} pct={70} label="30d" tone="bg-amber-400/70" /><FillBar i={2} pct={40} label="14d" tone="bg-orange-400/70" /><FillBar i={3} pct={20} label="7d" tone="bg-red-400/70" /></div>
              </Panel>
              <FlowArrow i={4} />
              <Panel className="flex-1" title="Outbox" scan>
                <Row i={5}><span className="text-[10px] text-white">"Hi Emmanuel — Mandatory Training expires…"</span><Chip tone="sky" i={6}>WhatsApp</Chip></Row>
              </Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Booking is hard-gated',
        caption: 'workerComplianceFor runs at allocation time — a missing or expired required document makes the shift refuse to save. There is no override; staff must fix the document.',
        visual: (
          <Stage caption="HTTP 422 — the shift literally will not create while a required doc is missing.">
            <div className="flex items-center gap-2">
              <Panel className="flex-1" title="Allocate"><Row i={0}><NameBar name="Test Worker" /><Chip tone="red" i={1}>References missing</Chip></Row></Panel>
              <FlowArrow i={2} />
              <Panel className="w-44" title="Result"><Chip tone="red" i={3}>422 — blocked</Chip></Panel>
            </div>
            <p className="tr-rise mt-4 text-[11px] text-sky-200/60" style={delay(4)}>Fix the document → score recomputes → worker is bookable again within seconds.</p>
          </Stage>
        ),
      },
    ],
  },
  // ── 11 · Portals ────────────────────────────────────────────────────────────
  {
    id: 'portals', title: 'Portals', subtitle: 'Worker, client & supervisor apps', icon: MonitorSmartphone, tint: 'from-indigo-500 to-violet-600',
    scenes: [
      {
        title: 'Workers self-serve',
        caption: 'Staff set availability, accept offers, submit timesheets, upload documents and export their own data from the worker portal — rates and margins stay invisible to them.',
        visual: (
          <Stage caption="Availability → offers → timesheets → documents → data export. All self-serve.">
            <div className="grid grid-cols-2 gap-3">
              <Panel title="Worker portal" scan>
                <div className="space-y-1.5">
                  <Row i={0}><span className="text-[10px] text-white">Offer: Sat night</span><CycleChip states={[{ label: 'Pending', tone: 'amber' }, { label: 'Accepted', tone: 'emerald' }]} ms={1500} /></Row>
                  <Row i={1}><span className="text-[10px] text-white">Timesheet due</span><Chip tone="sky" i={2}>Submit</Chip></Row>
                  <Row i={2}><span className="text-[10px] text-white">Availability</span><Chip tone="teal" i={3}>Set days</Chip></Row>
                </div>
              </Panel>
              <Panel title="Never visible to workers">
                <p className="text-[11px] leading-relaxed text-red-300/80">Charge rates · margins · other workers · client billing details</p>
              </Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Clients see their operation',
        caption: 'Homes raise requests, watch fill status live, review their rota and countersign timesheets from the client portal — without ever seeing worker pay.',
        visual: (
          <Stage caption="Requests, rota, timesheet signing — the client's own view of their service.">
            <div className="flex items-center gap-2">
              <Panel className="flex-1" title="Client portal">
                <div className="space-y-1.5">
                  <Row i={0}><span className="text-[10px] text-white">Night cover · Mon</span><Chip tone="teal" i={1}>Filled</Chip></Row>
                  <Row i={1}><span className="text-[10px] text-white">Day ×2 · Fri</span><Chip tone="amber" i={2}>1 pending</Chip></Row>
                </div>
              </Panel>
              <FlowArrow i={2} />
              <Panel className="w-40" title="Timesheet"><Chip tone="violet" i={3}>Sign off</Chip></Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Supervisors on the floor',
        caption: 'Supervisors get tonight\'s rota and check workers in on site — arrival confirmations feed back to the office in real time.',
        visual: (
          <Stage caption="On-site check-in — the office sees arrivals as they happen.">
            <div className="space-y-2">
              <Row i={0}><NameBar name="Chloe Stan" sub="Night · 19:00 start" /><Chip tone="emerald" i={1} pulse>Checked in 18:52</Chip></Row>
              <Row i={1}><NameBar name="Mary Begum" sub="Night · 19:00 start" /><Chip tone="amber" i={2} blink>Awaiting arrival</Chip></Row>
            </div>
          </Stage>
        ),
      },
    ],
  },
  // ── 12 · DBS ────────────────────────────────────────────────────────────────
  {
    id: 'dbs-beta', title: 'DBS Checks (Beta)', subtitle: 'Provider profile & imports', icon: Fingerprint, tint: 'from-slate-500 to-slate-700',
    scenes: [
      {
        title: 'One board for every worker\'s DBS',
        caption: 'The board colour-codes each worker — no DBS on file, never checked, re-check overdue, or flagged results — so renewals are chased before they lapse, not after.',
        visual: (
          <Stage caption="Red needs fixing, amber needs re-checking, emerald is current.">
            <div className="space-y-2">
              <Row i={0}><NameBar name="Mary Begum" sub="cert 0017123456 · checked 15 Oct" /><Chip tone="emerald" i={1}>In date</Chip></Row>
              <Row i={1}><NameBar name="Adebayo Bello" sub="last check 7 months ago" /><Chip tone="amber" i={2}>Re-check due</Chip></Row>
              <Row i={2}><NameBar name="Test Worker" sub="result: new information" /><Chip tone="red" i={3}>Attention</Chip></Row>
              <Row i={3}><NameBar name="New applicant" sub="no DBS doc yet" /><Chip tone="red" i={4}>No DBS on file</Chip></Row>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Provider results via CSV',
        caption: 'Whatever provider you use — gov.uk direct or an umbrella body — export their CSV and drop it in. Rows match workers by email, id or name and land as audited register checks.',
        visual: (
          <Stage caption="Provider CSV → matched to workers → register_checks with 'csv import' provenance.">
            <div className="flex items-center gap-2">
              <Panel className="w-44" title="Provider CSV"><p className="text-[10px] text-white/60">email · cert · result · date</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Worker's record" scan>
                <Row i={2}><span className="text-[10px] text-white">DBS Update Service · clear · 15 Oct</span><Chip tone="emerald" i={3}>csv import</Chip></Row>
                <p className="mt-1.5 text-[9px] text-sky-200/50">honest provenance — the file shows it was imported, not "system verified"</p>
              </Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Ready for an API, honest about today',
        caption: 'The connection profile stores provider, endpoint, org ref and key — and Test connection probes for real. Until a provider confirms API access, the page says exactly that; no fake green lights.',
        visual: (
          <Stage caption="Saved profile + live probe — the automatic path is plumbed, never pretended.">
            <Panel title="Provider profile">
              <div className="space-y-1.5 text-[11px] text-white/70">
                <p className="tr-rise" style={delay(0)}>Provider: <b className="text-white">uCheck / gov.uk / umbrella body</b></p>
                <p className="tr-rise" style={delay(1)}>Endpoint: <b className="text-white">saved server-side</b></p>
                <p className="tr-rise" style={delay(2)}>Key: <b className="text-white">masked, never re-shown</b></p>
              </div>
              <div className="mt-3"><CycleChip states={[{ label: 'Probing endpoint…', tone: 'amber' }, { label: 'No API yet — CSV active', tone: 'sky' }, { label: 'Ready when they are', tone: 'emerald' }]} ms={1700} /></div>
            </Panel>
          </Stage>
        ),
      },
    ],
  },
];
