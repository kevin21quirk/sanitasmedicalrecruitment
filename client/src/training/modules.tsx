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
          <Stage title="Dashboard · KPI tiles" narration="These tiles pull live totals straight from the database — active workers, care homes, and this month's revenue and margin. They count themselves up when the page loads, so what you see is always now, never last week's export.">
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
          <Stage title="Dashboard · workflow pipeline" narration="Watch a request card travel: blue is new, amber means offers are out waiting on replies, teal is booked and emerald is complete. If work slips backwards — a filled request whose shifts get cancelled — the card drops back to New automatically, so the board never lies.">
            <KanbanMove cols={PIPE_FULL} card={<span>Chestnut Grange · Night ×2</span>} dwell={1100} />
            <div className="mt-8 space-y-2">
              <Row i={1}><span className="text-xs text-white">Oaks Lodge · urgent day cover</span><Chip tone="red" blink>Urgent</Chip></Row>
              <Row i={2}><span className="text-xs text-white">Ferndale Court · 3 shifts approved</span><Chip tone="teal">Ready to invoice</Chip></Row>
            </div>
          </Stage>
        ),
      },
      {
        title: 'This week\'s shifts & alerts',
        caption: 'Below the pipeline: every shift booked this week, tasks due, and compliance alerts — anything expiring or missing is surfaced before it becomes a problem.',
        visual: (
          <Stage title="Dashboard · shifts & alerts" narration="Below the pipeline sit three things that matter today: every shift booked this week with who's covering it, tasks that are due, and compliance warnings — documents expiring or open timesheet queries — surfaced before they become problems, not after.">
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
        title: 'The workforce list',
        caption: 'Every worker in one searchable, filterable list — by role, status or compliance state — so finding the right person for a call takes seconds, not a trawl through spreadsheets.',
        visual: (
          <Stage title="Candidates · the list" narration="This is your whole workforce in one list. Search by name, filter by role or status, and the compliance state rides along on every row — so before you even open a profile you can see who's fully bookable and who has a document expiring.">
            <div className="space-y-2">
              <Row i={0}><NameBar name="Chloe Stan" sub="Registered Nurse · SAN-001" /><Chip tone="emerald" i={1}>Compliant</Chip></Row>
              <Row i={1}><NameBar name="Mary Begum" sub="HCA · SAN-005" /><Chip tone="emerald" i={2}>Compliant</Chip></Row>
              <Row i={2}><NameBar name="Emmanuel Nwosu" sub="Support Worker · SAN-012" /><Chip tone="amber" i={3}>1 doc expiring</Chip></Row>
              <Row i={3}><NameBar name="Adebayo Bello" sub="HCA · SAN-008" /><Chip tone="emerald" i={4}>Compliant</Chip></Row>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Adding a candidate',
        caption: 'New workers can be keyed in by the office — name, role, contact, pay band, engagement type — or they register themselves through a public link and land in a review queue.',
        visual: (
          <Stage title="Candidates · adding a worker" narration="Two ways in: the office can key a worker directly — name, role, phone, email, pay expectations — or share a registration link and let the worker complete their own profile and upload documents. Either way it lands in one queue for review.">
            <Panel title="New candidate" className="tr-pop" scan>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-white/70">
                <span className="tr-rise" style={delay(1)}>Name: <b className="text-white">Test Worker</b></span>
                <span className="tr-rise" style={delay(2)}>Role: <b className="text-white">HCA</b></span>
                <span className="tr-rise" style={delay(3)}>Email: <b className="text-white">test@…</b></span>
                <span className="tr-rise" style={delay(4)}>Pay: <b className="text-white">£14–16/h</b></span>
                <span className="tr-rise" style={delay(5)}>Engagement: <b className="text-white">PAYE</b></span>
                <span className="tr-rise" style={delay(6)}>Source: <b className="text-white">Referral</b></span>
              </div>
            </Panel>
            <div className="mt-4 flex items-center gap-2">
              <Chip tone="sky" i={7}>Public link — worker self-registers</Chip>
              <Chip tone="slate" i={8}>Office keys it directly</Chip>
            </div>
          </Stage>
        ),
      },
      {
        title: 'The complete record',
        caption: 'Each profile holds contact details, payroll reference, bank details, engagement type and the full compliance file — everything invoicing and payroll will later need is captured here once.',
        visual: (
          <Stage title="Candidates · inside a profile" narration="Open a worker and everything payroll and invoicing will need is already on the record — payroll reference, bank details, engagement type, NMC PIN for nurses. Capture it once here and payroll export never has to ask again.">
            <Panel title="Chloe Stan · Registered Nurse" scan>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] text-white/70">
                <span>Payroll ref: <b className="text-white">SAN-001</b></span><span>Engagement: <b className="text-white">PAYE</b></span>
                <span>NMC PIN: <b className="text-white">on file</b></span><span>Bank: <b className="text-white">04-00-04 ••••</b></span>
                <span>Pay band: <b className="text-white">£21–24/h</b></span><span>Travel: <b className="text-white">15 miles</b></span>
                <span>Transport: <b className="text-white">Own car</b></span><span>Preferred: <b className="text-white">Nights</b></span>
              </div>
            </Panel>
            <div className="mt-3 flex gap-2"><Chip tone="emerald" i={2}>Payroll-ready</Chip><Chip tone="sky" i={3}>NMC verified</Chip></div>
          </Stage>
        ),
      },
      {
        title: 'Compliance built in',
        caption: 'The ring on each profile is the worker\'s live compliance score — it drops when a required document lapses and climbs back the moment staff fix the gap.',
        visual: (
          <Stage title="Candidates · compliance score" narration="The ring is the worker's live compliance score — every required document feeds it. When mandatory training hits 38 days out it turns amber; if it lapses, the score drops and bookings refuse until it's fixed. It recalculates itself on every document change.">
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
        title: 'Shifts applied & history',
        caption: 'Scroll down a profile and the whole working relationship is there — shifts worked, timesheets submitted, offers pending, documents and check history — one timeline per worker.',
        visual: (
          <Stage title="Candidates · shifts & history" narration="Scroll down the profile and the worker's whole history is in front of you — shifts they've worked, timesheets submitted, offers still pending, and every register check. When a client calls about a worker, the answer is already on screen.">
            <div className="space-y-2">
              <Row i={0}><span className="text-[11px] text-white">Chestnut Grange · Night · 14 Oct</span><Chip tone="emerald" i={1}>Paid</Chip></Row>
              <Row i={1}><span className="text-[11px] text-white">Oaks Lodge · Day · 17 Oct</span><Chip tone="teal" i={2}>Approved</Chip></Row>
              <Row i={2}><span className="text-[11px] text-white">Ferndale · Long day · 24 Oct</span><Chip tone="sky" i={3}>Booked</Chip></Row>
              <Row i={3}><span className="text-[11px] text-white">DBS Update Service check</span><Chip tone="emerald" i={4}>Clear · 15 Oct</Chip></Row>
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
          <Stage title="Care homes · site requirements" narration="Every client carries the agency baseline plus its own rules on top — this home adds PMVA training, immunisation history and proof of address. The checker applies both layers automatically on every allocation, so a worker missing PMVA can't be booked here but stays bookable everywhere else.">
            <Row i={0}><NameBar name="Chestnut Grange" sub="Colchester · Nursing" /><Chip tone="sky">Active client</Chip></Row>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Panel title="Agency baseline"><p className="text-[10px] leading-relaxed text-white/60">DBS Enhanced · Right to Work · Passport/ID · Mandatory Training · NMC for nurses</p></Panel>
              <Panel title="Chestnut Grange adds"><p className="tr-rise text-[10px] leading-relaxed text-amber-300/90" style={delay(1)}>+ PMVA trained<br />+ Immunisation history<br />+ Proof of address</p></Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Requests arrive pre-structured',
        caption: 'Homes raise requests through their own portal — date, shift type, role, quantity — and they land on your pipeline board instantly. No phone tag, no lost emails.',
        visual: (
          <Stage title="Care homes · portal requests" narration="Homes raise requests in their own portal — date, shift type, role, how many workers — and it lands on your pipeline board as a structured card. No phone tag, no scribbled notes; the request is ready to allocate the second it arrives.">
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
          </Stage>
        ),
      },
      {
        title: 'Full history per client',
        caption: 'Invoices, shifts, contacts and request history live on the client record — so when a home calls, you have the whole relationship in front of you.',
        visual: (
          <Stage title="Care homes · client record" narration="The client record is the whole relationship on one page: shifts this month, fill rate, invoices outstanding, and every request they've raised. When the home calls, the answer is already on your screen — no digging through email.">
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
          <Stage title="Requests · the board" narration="Every request is a card in a colour-coded column — New in blue, Offers out in amber, Part-filled in orange, Booked in teal. Cards move themselves as work progresses, so the board is always the true state of play, not a stale list someone forgot to update.">
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
          <Stage title="Requests · the allocation drawer" narration="Open a request and the drawer lists only workers who are free and compliant for that home — ranked by travel time and continuity, with first-choice workers flagged. The system filters and suggests; a human always makes the call. Non-compliant workers never even reach the list.">
            <Panel title="Eligible for Chestnut Grange · Night" scan>
              <div className="space-y-1.5">
                <Row i={0}><NameBar name="Chloe Stan" sub="8 min away" /><Chip tone="emerald" i={1}>First choice</Chip></Row>
                <Row i={1}><NameBar name="Mary Begum" sub="14 min away" /><Chip tone="sky" i={2}>Available</Chip></Row>
                <Row i={2}><NameBar name="Emmanuel Nwosu" sub="31 min" /><Chip tone="amber" i={3}>Far</Chip></Row>
              </div>
            </Panel>
          </Stage>
        ),
      },
      {
        title: 'Offer → accept → booked',
        caption: 'Send the offer by WhatsApp or email from the outbox. When the worker accepts in their portal, the shift is created, the calendar updates and the pipeline card turns teal — all in one motion.',
        visual: (
          <Stage title="Requests · offer to booked" narration="Send the offer by WhatsApp or email straight from the outbox. The worker taps Accept on their phone, the shift writes itself onto the calendar, and the pipeline card turns teal — one acceptance, three things done, no re-keying.">
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
          <Stage title="Neuven · import preview" narration="Export your Neuven jobs to CSV and drop it in — every row is validated before anything is written. Green rows name the shift they'll create; red rows say exactly why they're rejected — no matching client, a duplicate — so a bad file can never sneak through.">
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
          <Stage title="Neuven · onto the board" narration="Committed rows become real pending requests on the pipeline, tagged with their Neuven reference — they allocate exactly like internal work. And the reference doubles as a lock: the same Neuven job can never be imported twice.">
            <div className="flex items-center gap-2">
              <Panel className="w-44" title="Neuven CSV"><p className="text-xs text-white/70">NV-9001 · Night ×2</p><p className="mt-1 text-xs text-white/70">NV-9002 · Long day</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Requests board">
                <Row i={2}><span className="text-xs text-white">Chestnut Grange · Night ×2 <span className="text-white/40">NV-9001</span></span><Chip tone="sky" i={3}>New</Chip></Row>
              </Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Automatic sync, when it exists',
        caption: 'Neuven don\'t publish a public API — so the connection profile stores endpoint and credentials ready for the day access is agreed. Test connection probes it live so the plumbing is proven, not promised.',
        visual: (
          <Stage title="Neuven · automatic connection" narration="Neuven don't publish a public API — so the connection profile stores endpoint, org ref and key ready for the day access is agreed. Test connection really probes the endpoint so the plumbing is proven, not promised; until then CSV import does the job.">
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
          <Stage title="Timesheets · the sign-off chain" narration="Three signatures in order: the worker submits hours, the site countersigns by a secure phone link — no app needed — and the office approves. That approval is the gate: it freezes the pay and charge snapshot so reports can never be rewritten by a later rate change.">
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
          <Stage title="Timesheets · automatic uplifts" narration="Night, weekend and bank-holiday multipliers apply themselves — highest-wins by default — and they apply to both the worker's pay and the client's charge at once. Nobody reaches for a calculator; the uplift rule stamps onto the snapshot at approval.">
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
          <Stage title="Timesheets · raising a query" narration="Hours look wrong? Query that one timesheet and it pauses alone — the rest of the week keeps flowing to approval. Resolve the query, the worker resubmits, and it rejoins the queue with the whole exchange on the audit trail.">
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
          <Stage title="Invoicing · creating an invoice" narration="Pick a client and a period — every approved, unbilled shift becomes a line item with hours, rate and uplift already resolved from the frozen snapshot. The total counts itself and numbering is automatic, so an invoice takes seconds, not an afternoon.">
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
          <Stage title="Invoicing · send & reconcile" narration="Send opens a pre-filled email to the client's billing address; Print produces a clean standalone PDF — no app chrome. Marking paid takes the real payment date, which is what drives reconciliation and clears the invoice off aged debtors.">
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
          <Stage title="Invoicing · aged debtors" narration="Every sent-but-unpaid invoice stacks into an ageing bucket — current, one to thirty, thirty to sixty, sixty-plus — with the client's name attached. Chasing becomes a report you open, not a list you remember; drafts never count, because they aren't debt yet.">
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
          <Stage title="Payroll · the preview" narration="Preview splits the period's approved timesheets into PAYE and Ltd runs — rows, hours and totals — and every rejected row names its reason: not approved, no payroll ref, marked paid manually. Nothing exports until you say so, and nothing is silently dropped.">
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
          <Stage title="Payroll · the export" narration="Export writes a payroll run, stamps every shift paid against that run ID, and downloads the bureau-formatted CSV — payroll ref, hours, uplift, amount. Try it again on the same period and the rows politely refuse: double-pay is structurally impossible, not just warned about.">
            <div className="relative">
              <Panel title="Run #22 · PAYE" scan>
                <Row i={0}><span className="text-[11px] text-white">SAN-001 · Chloe Stan · 13.5h</span><Chip tone="emerald" i={1}>£283.50</Chip></Row>
                <div className="mt-1.5" /><Row i={1}><span className="text-[11px] text-white">SAN-005 · Mary Begum · 11h</span><Chip tone="emerald" i={2}>£231.00</Chip></Row>
                <p className="mt-2 text-[10px] text-sky-200/60">payroll_ref · hours · uplift · amount — bureau format</p>
              </Panel>
              <Stamp tone="sky" delay={1700}>Exported</Stamp>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Every run is auditable',
        caption: 'Run history lists each export — who ran it, when, which engagement, how many shifts, total value — with the CSV re-downloadable at any point.',
        visual: (
          <Stage title="Payroll · run history" narration="Every export is on record — who ran it, when, PAYE or Ltd, how many shifts and the total value — with the CSV re-downloadable at any point. If the bureau ever queries a payment, the answer is already filed.">
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
          <Stage title="Margin · the honest breakdown" narration="Margin is charge minus the true cost — worker pay, employer NI and the bureau fee — read from the frozen approval snapshot, not today's rates. The numbers from October can't drift when December's rates change, so this report is always trustworthy.">
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
          <Stage title="Margin · running a period" narration="Run any date range and results split into three honest buckets — actuals from frozen snapshots, estimates clearly flagged as estimates, and rows with no data named rather than hidden. You always know which margin figures are fact and which are guidance.">
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
          <Stage title="Margin · per client" narration="Group by client and the answer is instant — which homes return real margin and where uplifts are quietly eating the spread. The longest bar is your best client; the shortest is worth a conversation about rates.">
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
          <Stage title="Compliance · the overview" narration="Every document in the workforce has a live status — valid, expiring inside sixty days, expired, or missing — and it flips itself as dates pass. Nobody ticks a flag; the overview is always the current truth, and blocked workers surface before they reach a rota.">
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
          <Stage title="Compliance · automatic reminders" narration="At sixty, thirty, fourteen and seven days before expiry, reminder messages write themselves into the outbox — WhatsApp and email, addressed to the worker — plus a monthly digest for the compliance team. Deduped per document per day, so nothing ever sends twice.">
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
          <Stage title="Compliance · the hard gate" narration="At the moment of allocation the compliance check runs — and a missing or expired required document makes the shift refuse to save, with the gap named. There is no override button; staff fix the document, the score recomputes, and the worker is bookable again within seconds.">
            <div className="flex items-center gap-2">
              <Panel className="flex-1" title="Allocate"><Row i={0}><NameBar name="Test Worker" /><Chip tone="red" i={1}>References missing</Chip></Row></Panel>
              <FlowArrow i={2} />
              <Panel className="w-44" title="Result"><Chip tone="red" i={3}>422 — blocked</Chip></Panel>
            </div>
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
          <Stage title="Portals · the worker app" narration="Workers run themselves: set availability, accept or decline offers, submit timesheets, upload documents and export their own data — all from their phone. What they never see is just as deliberate: charge rates, margins and anyone else's details.">
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
          <Stage title="Portals · the client app" narration="The home sees its own operation: raise a request, watch it fill live, review the rota and countersign timesheets. They get transparency about their service — and never a glimpse of what the worker is paid.">
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
          <Stage title="Portals · the supervisor app" narration="On the floor, the supervisor sees tonight's rota and taps workers in as they arrive — the office watches arrivals land in real time. A worker who hasn't checked in by start time stays flagged, so a no-show is caught at 19:00, not 07:00.">
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
          <Stage title="DBS · the workforce board" narration="Every worker's DBS position in one colour-coded list — emerald means in date, amber means a re-check is due, red means a flagged result or no DBS on file at all. Renewals get chased before they lapse, not discovered after.">
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
          <Stage title="DBS · importing results" narration="Export check results from whoever runs them — gov.uk or an umbrella body — and drop the CSV in. Each row matches an existing worker and lands as an audited register check on their file, marked honestly as an import, never claimed as system-verified.">
            <div className="flex items-center gap-2">
              <Panel className="w-44" title="Provider CSV"><p className="text-[10px] text-white/60">email · cert · result · date</p></Panel>
              <FlowArrow i={1} />
              <Panel className="flex-1" title="Worker's record" scan>
                <Row i={2}><span className="text-[10px] text-white">DBS Update Service · clear · 15 Oct</span><Chip tone="emerald" i={3}>csv import</Chip></Row>
              </Panel>
            </div>
          </Stage>
        ),
      },
      {
        title: 'Ready for an API, honest about today',
        caption: 'The connection profile stores provider, endpoint, org ref and key — and Test connection probes for real. Until a provider confirms API access, the page says exactly that; no fake green lights.',
        visual: (
          <Stage title="DBS · the provider profile" narration="Save the provider profile — gov.uk direct or an umbrella body — and Test connection probes the endpoint for real. Until a provider confirms API access the page says exactly that. No fake green lights; the automatic path is plumbed, never pretended.">
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
