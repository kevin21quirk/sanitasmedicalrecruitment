import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, Building2, ClipboardList, PlugZap, Clock3,
  PoundSterling, Wallet, TrendingUp, ShieldCheck, MonitorSmartphone, Fingerprint,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Stage, Count, Spark, CycleChip,
  Frame, AppBtn, AppChip, AppStat, AppRow, LName,
  TField, SField, AppModal, Drawer, CheckItem, TabBar, PipeCol, Phone, Toast,
} from './visuals';

export interface Scene { title: string; caption: string; secs?: number; visual: ReactNode }
export interface Module {
  id: string; title: string; subtitle: string; icon: LucideIcon;
  tint: string; scenes: Scene[];
}

const PIPE_CHIPS = [
  { l: 'New', c: '#38bdf8', n: 4 }, { l: 'Offers', c: '#fbbf24', n: 3 }, { l: 'Part', c: '#fb923c', n: 2 },
  { l: 'Booked', c: '#2dd4bf', n: 6 }, { l: 'Timesheet', c: '#a78bfa', n: 3 }, { l: 'Invoice', c: '#14b8a6', n: 2 }, { l: 'Done', c: '#34d399', n: 9 },
];

export const MODULES: Module[] = [
  // ── 1 · Dashboard ─────────────────────────────────────────────────────────
  {
    id: 'dashboard', title: 'Dashboard & Pipeline', subtitle: 'Your whole operation at a glance', icon: LayoutDashboard, tint: 'from-sky-500 to-blue-600',
    scenes: [
      {
        title: 'Every morning starts here',
        caption: 'The dashboard opens on live totals and the colour-coded pipeline strip — click any stage to jump to the board.',
        visual: (
          <Stage title="The Dashboard screen" narration="This is the real dashboard the office sees each morning — live tiles for workers, homes, revenue and margin, with the colour-coded pipeline underneath showing how many requests sit at each stage. Watch the cursor click the amber Offers stage — it jumps straight to that work on the Requests board.">
            <Frame nav="Dashboard" url="" title="Recruitment Dashboard" sub="Live overview of candidates, clients, placements and compliance."
              cursor={[{ x: 55, y: 90, at: 200 }, { x: 40, y: 47, at: 4200, click: true }]}>
              <div className="grid grid-cols-4 gap-1.5">
                <AppStat label="Active workers" value={<Count to={47} />} at={100} />
                <AppStat label="Care homes" value={<Count to={7} />} at={250} />
                <AppStat label="Revenue MTD" value={<Count to={14.4} prefix="£" suffix="k" decimals={1} />} at={400} tone="text-emerald-600" />
                <AppStat label="Margin MTD" value={<Count to={3.1} prefix="£" suffix="k" decimals={1} />} at={550} tone="text-teal-600" />
              </div>
              <div className="tr-rise mt-2 rounded-lg border border-slate-200/70 bg-white p-2" style={{ animationDelay: '700ms' }}>
                <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wide text-slate-400">Workflow pipeline</p>
                <div className="flex h-1.5 overflow-hidden rounded-full">
                  {PIPE_CHIPS.map((s) => <div key={s.l} style={{ background: s.c, width: `${s.n * 4}%` }} />)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {PIPE_CHIPS.map((s, i) => (
                    <span key={s.l} className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ring-1 ring-inset ${i === 1 ? 'tr-hit' : ''}`}
                      style={{ color: s.c, background: `${s.c}18`, ['--tw-ring-color' as any]: `${s.c}40`, animationDelay: i === 1 ? '4200ms' : undefined }}>
                      {s.l} {s.n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <AppRow at={900} className="col-span-2"><LName name="Chloe Stan" sub="Chestnut Grange · tonight" /><AppChip tone="teal">Booked</AppChip></AppRow>
                <AppRow at={1050}><span className="text-[8px] text-amber-600">2 docs expiring</span></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'This week & alerts',
        caption: 'Shifts booked this week, tasks due, and compliance alerts surfaced before they become problems.',
        visual: (
          <Stage title="Dashboard · this week & alerts" narration="Scroll down and the week is laid out — every booked shift with its worker and home on the left, and anything needing attention on the right: documents expiring, open timesheet queries, tasks due today. Problems surface here before they reach a rota.">
            <Frame nav="Dashboard" url="" title="Recruitment Dashboard" sub="This week">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="col-span-2 space-y-1 rounded-lg border border-slate-200/70 bg-white p-2">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">This week's shifts</p>
                  <AppRow at={100}><LName name="Chloe Stan" sub="Chestnut Grange · Mon night" /><AppChip tone="teal">Booked</AppChip></AppRow>
                  <AppRow at={250}><LName name="Mary Begum" sub="Oaks Lodge · Tue day" /><AppChip tone="teal">Booked</AppChip></AppRow>
                  <AppRow at={400}><LName name="Adebayo Bello" sub="Ferndale · Thu long day" /><AppChip tone="sky">Offered</AppChip></AppRow>
                  <AppRow at={550}><LName name="Emmanuel Nwosu" sub="Meadow View · Sat night" /><AppChip tone="teal">Booked</AppChip></AppRow>
                </div>
                <div className="space-y-1 rounded-lg border border-slate-200/70 bg-white p-2">
                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Attention</p>
                  <p className="tr-rise rounded bg-amber-50 px-1.5 py-1 text-[8px] text-amber-700 ring-1 ring-amber-600/20" style={{ animationDelay: '800ms' }}>2 documents expiring &lt;60d</p>
                  <p className="tr-rise rounded bg-red-50 px-1.5 py-1 text-[8px] text-red-600 ring-1 ring-red-600/20" style={{ animationDelay: '1100ms' }}>1 timesheet query open</p>
                  <p className="tr-rise rounded bg-sky-50 px-1.5 py-1 text-[8px] text-sky-700 ring-1 ring-sky-600/20" style={{ animationDelay: '1400ms' }}>3 tasks due today</p>
                </div>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Revenue & activity',
        caption: 'Revenue trend chart and the live activity feed — bookings, invoices sent, checks recorded.',
        visual: (
          <Stage title="Dashboard · charts & activity" narration="The revenue chart draws the month as it happens, and the activity feed streams everything underneath — bookings, invoices sent, register checks, imports. If something happened in the system, it's on this feed.">
            <Frame nav="Dashboard" url="" title="Recruitment Dashboard" sub="Revenue & activity">
              <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">Revenue trend</p>
                <Spark points={[8, 9.4, 8.8, 10.2, 11.8, 11.1, 13.2, 14.4]} tone="#1863dc" h={64} />
              </div>
              <div className="mt-2 space-y-1 rounded-lg border border-slate-200/70 bg-white p-2">
                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Recent activity</p>
                <AppRow at={100}><span className="text-[8px] text-slate-600">Chloe Stan booked — Chestnut Grange night</span><span className="text-[7px] text-slate-400">2m</span></AppRow>
                <AppRow at={300}><span className="text-[8px] text-slate-600">INV-2026-0002 sent to Ferndale Court</span><span className="text-[7px] text-slate-400">18m</span></AppRow>
                <AppRow at={500}><span className="text-[8px] text-slate-600">DBS check recorded — Emmanuel Nwosu</span><span className="text-[7px] text-slate-400">1h</span></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
    ],
  },
  // ── 2 · Candidates ──────────────────────────────────────────────────────────
  {
    id: 'candidates', title: 'Candidates', subtitle: 'Add a worker, end to end', icon: Users, tint: 'from-violet-500 to-purple-600',
    scenes: [
      {
        title: 'The Candidates screen',
        caption: 'Every worker in one searchable list with live compliance. Watch the cursor hit Add Candidate.',
        secs: 8,
        visual: (
          <Stage title="Candidates · the list" narration="This is the real Candidates screen: stat cards across the top, a search and filters on the toolbar, and every worker in the table with status and compliance score. Watch the cursor — it moves to the Add Candidate button and clicks it.">
            <Frame nav="Candidates" url="candidates" eyebrow="Recruitment" title="Candidates" sub="Nurses, HCAs and support workers on the Sanitas books."
              actions={<><AppBtn>Export</AppBtn><AppBtn primary hit={5400}>+ Add Candidate</AppBtn></>}
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 90, y: 13, at: 4800, click: true }]}>
              <div className="grid grid-cols-5 gap-1.5">
                <AppStat label="Total" value={<Count to={50} />} at={100} />
                <AppStat label="Compliant" value={<Count to={44} />} at={200} tone="text-emerald-600" />
                <AppStat label="On assign." value={<Count to={23} />} at={300} />
                <AppStat label="In progress" value={<Count to={4} />} at={400} tone="text-amber-600" />
                <AppStat label="New (30d)" value={<Count to={2} />} at={500} tone="text-brand-600" />
              </div>
              <div className="tr-rise mt-2 flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-2 py-1.5" style={{ animationDelay: '650ms' }}>
                <span className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[8px] text-slate-400">Search name, email, town, NMC PIN…</span>
                <span className="rounded-md border border-slate-200 px-2 py-1 text-[8px] text-slate-500">All compliance ▾</span>
                <span className="text-[7px] text-slate-400">50 results</span>
              </div>
              <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                <div className="grid grid-cols-5 gap-2 border-b border-slate-200/70 bg-slate-50/80 px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Candidate</span><span>Role</span><span>Status</span><span>Compliance</span><span>Rate</span>
                </div>
                {[
                  { n: 'Chloe Stan', r: 'Registered Nurse', s: 'compliant', t: 'emerald' as const, c: '96%', p: '£22–24/hr' },
                  { n: 'Mary Begum', r: 'Healthcare Assistant', s: 'on assignment', t: 'teal' as const, c: '92%', p: '£14–16/hr' },
                  { n: 'Emmanuel Nwosu', r: 'Support Worker', s: 'compliant', t: 'emerald' as const, c: '88%', p: '£13–15/hr' },
                  { n: 'Adebayo Bello', r: 'Senior HCA', s: 'compliant', t: 'emerald' as const, c: '90%', p: '£15–17/hr' },
                ].map((w, i) => (
                  <div key={w.n} className="tr-left grid grid-cols-5 items-center gap-2 border-b border-slate-100 px-2 py-1.5 last:border-0" style={{ animationDelay: `${800 + i * 180}ms` }}>
                    <LName name={w.n} /><span className="text-[8px] text-slate-600">{w.r}</span>
                    <AppChip tone={w.t}>{w.s}</AppChip>
                    <span className="text-[8px] font-semibold text-emerald-600">{w.c}</span>
                    <span className="text-[8px] text-slate-600">{w.p}</span>
                  </div>
                ))}
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'The Add Candidate form',
        caption: 'The modal opens and every field fills in one at a time — watch the cursor work through it.',
        secs: 11,
        visual: (
          <Stage title="Candidates · Add Candidate" narration="The Add Candidate modal opens and each field completes in turn — name, contact, role, location, pay preferences, source and NMC PIN for nurses. The cursor finishes on Create candidate; next scene is the compliance checklist.">
            <Frame nav="Candidates" url="candidates" eyebrow="Recruitment" title="Candidates" sub="Nurses, HCAs and support workers on the Sanitas books."
              actions={<><AppBtn>Export</AppBtn><AppBtn primary>+ Add Candidate</AppBtn></>}
              cursor={[
                { x: 36, y: 33, at: 600 }, { x: 62, y: 33, at: 1550 }, { x: 36, y: 41, at: 2150 },
                { x: 62, y: 41, at: 2850 }, { x: 36, y: 49, at: 3500 }, { x: 62, y: 49, at: 4150 },
                { x: 36, y: 57, at: 4750 }, { x: 62, y: 57, at: 5350 }, { x: 36, y: 65, at: 5950 },
                { x: 62, y: 65, at: 6550 }, { x: 62, y: 79, at: 8200, click: true },
              ]}>
              <div className="grid grid-cols-5 gap-1.5">
                <AppStat label="Total" value="50" /><AppStat label="Compliant" value="44" />
                <AppStat label="On assign." value="23" /><AppStat label="In progress" value="4" /><AppStat label="New (30d)" value="2" />
              </div>
              <AppModal title="Add Candidate" sub="Core details now; documents and compliance later." at={500}
                footer={<><AppBtn>Cancel</AppBtn><AppBtn primary hit={8300}>Create candidate</AppBtn></>}>
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                  <TField label="First name" value="Sophie" at={950} />
                  <TField label="Last name" value="Turner" at={1600} />
                  <TField label="Email" value="sophie.turner@mail.com" at={2200} />
                  <TField label="Phone" value="07700 900461" at={2900} />
                  <SField label="Role" value="Registered Nurse" at={3550} />
                  <TField label="Town" value="Colchester" at={4200} />
                  <TField label="Postcode" value="CO4 3XY" at={4800} />
                  <SField label="Preferred shift" value="Nights" at={5400} />
                  <SField label="Source" value="Indeed" at={6000} />
                  <TField label="NMC PIN" value="12A3456B" at={6600} />
                </div>
              </AppModal>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Compliance requirements',
        caption: 'Straight after creation, the required documents are listed — record what you have, the rest is flagged.',
        secs: 8,
        visual: (
          <Stage title="Candidates · compliance checklist" narration="Straight after Create, the modal moves to the compliance checklist — everything a nurse needs on file before they can be booked. Record what the worker has — here DBS, right-to-work and training go in — and anything skipped is logged and flagged amber on the profile until it arrives.">
            <Frame nav="Candidates" url="candidates" eyebrow="Recruitment" title="Candidates" sub="Nurses, HCAs and support workers on the Sanitas books."
              cursor={[{ x: 60, y: 40, at: 300 }, { x: 63, y: 80, at: 6100, click: true }]}>
              <AppModal title="Compliance requirements" sub="Sophie Turner needs these on file before she can be booked." at={400}
                footer={<><AppBtn>Skip for now (logged)</AppBtn><AppBtn primary hit={6200}>Continue</AppBtn></>}>
                <div className="space-y-1.5">
                  <CheckItem label="DBS Enhanced" detail="cert 0017823456 · exp 2031" at={1100} />
                  <CheckItem label="Right to Work" detail="share code verified" at={1900} />
                  <CheckItem label="Mandatory Training" detail="expires 14/09/2027" at={2700} />
                  <CheckItem label="NMC PIN" detail="12A3456B · checked" at={3500} />
                  <CheckItem label="References ×2" at={99999} />
                </div>
                <p className="tr-rise mt-2 text-[8px] text-slate-400" style={{ animationDelay: '4300ms' }}>References not yet received — will stay flagged on the profile.</p>
              </AppModal>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Photo & portal login',
        caption: 'Optional photo, then create the worker\'s portal login so they can see shifts and offers.',
        secs: 7,
        visual: (
          <Stage title="Candidates · portal login" narration="Last step offers a portal login — email and a temporary password — so Sophie can see her offers, submit timesheets and upload documents from her phone. Skip it and you can always add one later from Settings → Accounts.">
            <Frame nav="Candidates" url="candidates" eyebrow="Recruitment" title="Candidates" sub="Nurses, HCAs and support workers on the Sanitas books."
              cursor={[{ x: 40, y: 55, at: 300 }, { x: 63, y: 78, at: 4800, click: true }]}>
              <AppModal title="Portal login" sub="Give Sophie a sign-in for shifts, offers and documents in the worker portal." at={400}
                footer={<><AppBtn>Skip</AppBtn><AppBtn primary hit={4900}>Done — open profile</AppBtn></>}>
                <div className="space-y-2">
                  <TField label="Email (login)" value="sophie.turner@mail.com" at={1000} />
                  <TField label="Temporary password" value="••••••••••" at={2100} cps={20} />
                  <p className="tr-rise rounded-md bg-sky-50 px-2 py-1.5 text-[8px] text-sky-700 ring-1 ring-sky-600/20" style={{ animationDelay: '3100ms' }}>
                    She'll be asked to set her own password on first sign-in.
                  </p>
                </div>
              </AppModal>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'The finished profile',
        caption: 'The candidate record — contact, payroll details, and the live compliance ring with documents listed.',
        visual: (
          <Stage title="Candidates · the profile" narration="And here's Sophie on the books. Her record holds everything payroll and invoicing will ever need — payroll ref, engagement type, bank — plus the live compliance ring at 75%: DBS, right-to-work and training all valid, references still flagged until they arrive. That flag is why she can't be booked quite yet.">
            <Frame nav="Candidates" url="candidates/51" eyebrow="Recruitment" title="Sophie Turner" sub="Registered Nurse · Colchester"
              actions={<><AppBtn>Compliance file</AppBtn><AppBtn primary>Edit</AppBtn></>}>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="col-span-2 space-y-1.5">
                  <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                    <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">Details</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[8px] text-slate-600">
                      <span className="tr-rise" style={{ animationDelay: '400ms' }}>Payroll ref: <b className="text-ink">SAN-051</b></span>
                      <span className="tr-rise" style={{ animationDelay: '550ms' }}>Engagement: <b className="text-ink">PAYE</b></span>
                      <span className="tr-rise" style={{ animationDelay: '700ms' }}>Email: <b className="text-ink">sophie.turner@…</b></span>
                      <span className="tr-rise" style={{ animationDelay: '850ms' }}>Phone: <b className="text-ink">07700 900461</b></span>
                      <span className="tr-rise" style={{ animationDelay: '1000ms' }}>NMC PIN: <b className="text-ink">12A3456B</b></span>
                      <span className="tr-rise" style={{ animationDelay: '1150ms' }}>Preferred: <b className="text-ink">Nights</b></span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                    <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">Documents</p>
                    <AppRow at={300}><span className="text-[8px] text-slate-600">DBS Enhanced · 0017823456</span><AppChip tone="emerald">Valid</AppChip></AppRow>
                    <AppRow at={450}><span className="text-[8px] text-slate-600">Right to Work</span><AppChip tone="emerald">Valid</AppChip></AppRow>
                    <AppRow at={600}><span className="text-[8px] text-slate-600">Mandatory Training</span><AppChip tone="emerald">Valid</AppChip></AppRow>
                    <AppRow at={750}><span className="text-[8px] text-slate-600">References</span><AppChip tone="amber" blink>Missing</AppChip></AppRow>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/70 bg-white p-2 text-center">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">Compliance</p>
                  <div className="relative mx-auto h-16 w-16">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(15 23 42 / .08)" strokeWidth="11" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#f59e0b" strokeWidth="11" strokeLinecap="round"
                        pathLength={100} strokeDasharray="75 100" className="tr-draw" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-ink"><Count to={75} suffix="%" /></span>
                  </div>
                  <AppChip tone="amber" at={900}>In progress</AppChip>
                </div>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Shifts get applied',
        caption: 'Once compliant, Sophie appears in the allocation drawer — offer, accept, booked.',
        secs: 9,
        visual: (
          <Stage title="Candidates · getting booked" narration="Once her references land, Sophie goes compliant and appears automatically in allocation drawers. Here a night-shift request comes in — she's ranked by distance and continuity — the office taps Offer, she accepts on her phone, and the shift writes itself onto her record. That's the whole journey: added, compliant, booked, paid.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="Client requests come in by portal or office entry."
              cursor={[{ x: 50, y: 85, at: 300 }, { x: 84, y: 52, at: 3400, click: true }, { x: 40, y: 60, at: 6200 }, { x: 47, y: 66, at: 7000, click: true }]}>
              <div className="grid grid-cols-4 gap-1.5">
                <PipeCol label="New" color="#38bdf8" cards={['Chestnut Grange · Night ×2']} />
                <PipeCol label="Offers out" color="#fbbf24" cards={['Oaks Lodge · Day']} />
                <PipeCol label="Booked" color="#2dd4bf" cards={['Ferndale · LD', 'Meadow · Night']} />
                <PipeCol label="Invoice" color="#14b8a6" cards={['Chestnut · Day']} />
              </div>
              <Drawer title="Allocate — Night, 20 Oct" at={1500}>
                <p className="mb-1.5 text-[7px] font-bold uppercase tracking-wide text-slate-400">Eligible workers</p>
                <div className="space-y-1">
                  <AppRow at={1700}><LName name="Sophie Turner" sub="8 min · nights" /><AppBtn primary hit={3500}>Offer</AppBtn></AppRow>
                  <AppRow at={1850}><LName name="Mary Begum" sub="14 min" /><AppBtn>Offer</AppBtn></AppRow>
                  <AppRow at={2000} className="opacity-50"><LName name="Test Worker" sub="blocked" /><AppChip tone="red">Refs missing</AppChip></AppRow>
                </div>
                <p className="tr-rise mt-2 text-[7px] text-slate-400" style={{ animationDelay: '2400ms' }}>Ranked by distance & continuity — you always choose.</p>
              </Drawer>
              <div className="absolute bottom-2 left-[11%] right-2 flex items-center gap-2">
                <Phone title="Worker portal" at={6300}>
                  <p className="text-[7px] text-slate-500">Night · Chestnut Grange · 20 Oct</p>
                  <span className="inline-flex rounded-md bg-brand-600 px-2 py-1 text-[8px] font-semibold text-white tr-hit" style={{ animationDelay: '7100ms' }}>Accept</span>
                </Phone>
                <div className="tr-pop rounded-md bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20" style={{ animationDelay: '7600ms' }}>
                  Sophie Turner — shift booked ✓
                </div>
              </div>
            </Frame>
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
        title: 'Every home on file',
        caption: 'The Care Homes list — click through to a client record.',
        visual: (
          <Stage title="Care homes · the list" narration="Care Homes is your client book — each home with its contact, site type and open requests. The cursor opens Chestnut Grange; next scene shows what's on a client record.">
            <Frame nav="Care Homes" url="clients" eyebrow="Recruitment" title="Care Homes" sub="Client organisations and referral partners"
              actions={<AppBtn primary>+ New client</AppBtn>}
              cursor={[{ x: 55, y: 90, at: 300 }, { x: 40, y: 45, at: 4600, click: true }]}>
              <div className="space-y-1.5">
                <AppRow at={150} className="ring-2 ring-brand-500/40"><LName name="Chestnut Grange" sub="Colchester · Nursing home · 3 open requests" /><AppChip tone="sky">Active</AppChip></AppRow>
                <AppRow at={300}><LName name="Oaks Lodge" sub="Chelmsford · Residential" /><AppChip tone="sky">Active</AppChip></AppRow>
                <AppRow at={450}><LName name="Ferndale Court" sub="Ipswich · EMI unit" /><AppChip tone="sky">Active</AppChip></AppRow>
                <AppRow at={600}><LName name="Meadow View" sub="Braintree · Dementia care" /><AppChip tone="sky">Active</AppChip></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'The client record',
        caption: 'Contacts, billing, site requirements layered on the agency baseline, and live stats.',
        visual: (
          <Stage title="Care homes · client record" narration="Open a home and you get the full relationship — billing email and contacts, fill stats, and crucially the site requirements layered on top of the agency baseline. Chestnut Grange adds PMVA training and immunisation history — the compliance checker applies both layers automatically whenever anyone is allocated there.">
            <Frame nav="Care Homes" url="clients/3" eyebrow="Recruitment" title="Chestnut Grange" sub="Colchester · Nursing home"
              actions={<><AppBtn>Portal access</AppBtn><AppBtn primary>Edit</AppBtn></>}>
              <div className="grid grid-cols-3 gap-1.5">
                <AppStat label="Shifts this month" value={<Count to={34} />} at={100} />
                <AppStat label="Fill rate" value={<Count to={96} suffix="%" />} at={250} />
                <AppStat label="Outstanding" value="£1,142" at={400} />
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">Agency baseline</p>
                  <p className="text-[8px] leading-relaxed text-slate-600">DBS Enhanced · Right to Work · ID · Mandatory Training · NMC for nurses</p>
                </div>
                <div className="tr-rise rounded-lg border border-amber-200 bg-amber-50/60 p-2" style={{ animationDelay: '600ms' }}>
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-amber-700">Chestnut Grange adds</p>
                  <p className="text-[8px] leading-relaxed text-amber-800">+ PMVA trained<br />+ Immunisation history<br />+ Proof of address</p>
                </div>
              </div>
              <div className="mt-1.5 rounded-lg border border-slate-200/70 bg-white p-2">
                <AppRow at={800}><span className="text-[8px] text-slate-600">Sarah Mills — Manager</span><span className="text-[8px] text-slate-500">billing@chestnut…</span></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Requests from the portal',
        caption: 'Homes raise requests in their own portal — it lands on your pipeline instantly.',
        visual: (
          <Stage title="Care homes · portal to pipeline" narration="When the home needs cover, they don't phone — they raise it in their portal: date, shift type, how many workers, urgent if needed. It lands on your pipeline board as a New card, ready to allocate. No phone tag, nothing lost in email.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="A portal request arriving live">
              <div className="grid grid-cols-4 gap-1.5">
                <PipeCol label="New" color="#38bdf8" cards={['Oaks Lodge · Day']} glow />
                <PipeCol label="Offers out" color="#fbbf24" cards={['Ferndale · Night']} />
                <PipeCol label="Booked" color="#2dd4bf" cards={['Chestnut · LD', 'Meadow · Day']} />
                <PipeCol label="Invoice" color="#14b8a6" cards={['Oaks · Night']} />
              </div>
              <div className="absolute bottom-2 left-[11%] flex items-end gap-2">
                <Phone title="Client portal" at={400}>
                  <p className="text-[7px] font-semibold text-ink">New request</p>
                  <p className="text-[7px] text-slate-500">2 × Night RN — 20–21 Oct</p>
                  <AppChip tone="red" at={900}>Urgent</AppChip>
                  <span className="mt-1 inline-flex rounded-md bg-brand-600 px-2 py-1 text-[8px] font-semibold text-white">Send request</span>
                </Phone>
                <div className="tr-pop mb-1 rounded-md bg-white px-2 py-1 text-[8px] font-semibold text-ink shadow ring-1 ring-slate-200" style={{ animationDelay: '2600ms' }}>
                  Chestnut Grange · Night ×2 <span className="text-sky-600">→ New</span>
                </div>
              </div>
            </Frame>
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
        caption: 'Colour-coded columns by stage — cards move themselves as work progresses.',
        visual: (
          <Stage title="Requests · the board" narration="The Requests page opens on the pipeline board — every request a card in a colour-coded column, from blue New through amber Offers to teal Booked and beyond. Cards move themselves as work happens. The cursor clicks Allocate on the night-cover card.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="Client requests come in by portal or office entry — you decide who goes out."
              actions={<><AppBtn>↻</AppBtn><AppBtn primary>+ Log request</AppBtn></>}
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 21, y: 40, at: 4800, click: true }]}>
              <TabBar tabs={['Pipeline', 'Requests (3 open)', 'Availability board']} active="Pipeline" />
              <div className="grid grid-cols-4 gap-1.5">
                <div className="min-w-0 rounded-lg bg-slate-200/50 p-1">
                  <p className="mb-1 border-t-2 border-sky-400 px-1 pt-1 text-[7px] font-bold uppercase tracking-wide text-slate-600">New 2</p>
                  <div className="space-y-1">
                    <div className="rounded bg-white p-1 shadow-sm ring-1 ring-brand-400/60">
                      <p className="truncate text-[7px] font-semibold text-ink">Chestnut Grange · Night ×2</p>
                      <p className="text-[6px] text-slate-400">Mon 20 Oct · RN · <span className="font-bold text-red-500">URGENT</span></p>
                      <span className="mt-0.5 inline-flex rounded-md bg-brand-600 px-1.5 py-0.5 text-[7px] font-semibold text-white tr-hit" style={{ animationDelay: '4900ms' }}>Allocate</span>
                    </div>
                    <div className="rounded bg-white p-1 shadow-sm ring-1 ring-slate-200/60">
                      <p className="truncate text-[7px] font-semibold text-ink">Meadow View · Day</p>
                      <p className="text-[6px] text-slate-400">Wed 22 Oct · HCA</p>
                    </div>
                  </div>
                </div>
                <PipeCol label="Offers out" color="#fbbf24" cards={['Oaks Lodge · Day', 'Ferndale · Early']} />
                <PipeCol label="Booked" color="#2dd4bf" cards={['Chestnut · LD', 'Meadow · Night', 'Oaks · Night']} />
                <PipeCol label="Invoice" color="#14b8a6" cards={['Ferndale · Day']} />
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Choosing who to offer',
        caption: 'The allocation drawer lists only free, compliant workers — ranked by distance and continuity.',
        secs: 8,
        visual: (
          <Stage title="Requests · the allocation drawer" narration="The drawer lists only workers who are free that night and compliant for that home — ranked by travel time and continuity, first-choice workers flagged. Sophie tops the list at 8 minutes; a worker missing references can't even be offered — the system says exactly why. The cursor taps Offer on Sophie.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="Allocate — Chestnut Grange · Night, Mon 20 Oct"
              cursor={[{ x: 50, y: 88, at: 300 }, { x: 88, y: 34, at: 4200, click: true }]}>
              <TabBar tabs={['Pipeline', 'Requests (3 open)', 'Availability board']} active="Pipeline" />
              <div className="grid grid-cols-4 gap-1.5 opacity-60">
                <PipeCol label="New" color="#38bdf8" cards={['Chestnut · Night ×2']} />
                <PipeCol label="Offers out" color="#fbbf24" cards={['Oaks · Day']} />
                <PipeCol label="Booked" color="#2dd4bf" cards={['Chestnut · LD']} />
                <PipeCol label="Invoice" color="#14b8a6" cards={['Ferndale · Day']} />
              </div>
              <Drawer title="Eligible workers" at={400}>
                <p className="mb-1.5 text-[7px] text-slate-500">Night · 20 Oct · Registered Nurse · Chestnut Grange</p>
                <div className="space-y-1">
                  <AppRow at={700} className="ring-1 ring-emerald-300">
                    <LName name="Sophie Turner" sub="8 min · worked here 12×" />
                    <span className="flex items-center gap-1"><AppChip tone="emerald">1st choice</AppChip><AppBtn primary hit={4300}>Offer</AppBtn></span>
                  </AppRow>
                  <AppRow at={900}><LName name="Mary Begum" sub="14 min · worked here 3×" /><AppBtn>Offer</AppBtn></AppRow>
                  <AppRow at={1100}><LName name="Adebayo Bello" sub="22 min" /><AppBtn>Offer</AppBtn></AppRow>
                  <AppRow at={1500} className="opacity-55"><LName name="Test Worker" sub="cannot be offered" /><AppChip tone="red">Refs missing</AppChip></AppRow>
                </div>
                <div className="tr-pop mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-[8px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20" style={{ animationDelay: '5100ms' }}>
                  Offer sent — WhatsApp + email queued
                </div>
              </Drawer>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Offer → accept → booked',
        caption: 'The worker taps Accept on their phone — the shift writes itself and the card turns teal.',
        secs: 8,
        visual: (
          <Stage title="Requests · offer to booked" narration="Sophie's phone gets the offer with the shift details. One tap on Accept — and watch the board: the card flips to teal Booked, the shift lands on the calendar, and it's on her profile. One acceptance, three things done, no re-keying.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="Chestnut Grange · Night ×2"
              cursor={[{ x: 30, y: 60, at: 300 }, { x: 28, y: 66, at: 4000, click: true }]}>
              <div className="grid grid-cols-4 gap-1.5">
                <PipeCol label="New" color="#38bdf8" cards={['Meadow · Day']} />
                <div className="min-w-0 rounded-lg bg-slate-200/50 p-1">
                  <p className="mb-1 border-t-2 border-amber-400 px-1 pt-1 text-[7px] font-bold uppercase tracking-wide text-slate-600">Offers out 1</p>
                  <div className="rounded bg-white p-1 shadow-sm ring-1 ring-slate-200/60">
                    <p className="truncate text-[7px] font-semibold text-ink">Chestnut · Night</p>
                    <p className="text-[6px] text-slate-400">Sophie Turner</p>
                    <CycleChip states={[{ label: 'Offered', tone: 'amber' }, { label: 'Offered', tone: 'amber' }, { label: 'Offered', tone: 'amber' }, { label: 'Accepted ✓', tone: 'emerald' }]} ms={1100} />
                  </div>
                </div>
                <PipeCol label="Booked" color="#2dd4bf" cards={['Chestnut · LD', 'Meadow · Night']} />
                <PipeCol label="Invoice" color="#14b8a6" cards={['Ferndale · Day']} />
              </div>
              <div className="absolute bottom-2 left-[11%] flex items-end gap-2">
                <Phone title="Worker portal — Sophie" at={300}>
                  <p className="text-[7px] font-bold text-ink">Shift offer</p>
                  <p className="text-[7px] text-slate-500">Chestnut Grange · Night<br />Mon 20 Oct · 19:00–07:30</p>
                  <span className="inline-flex rounded-md bg-brand-600 px-2 py-1 text-[8px] font-semibold text-white tr-hit" style={{ animationDelay: '4100ms' }}>Accept</span>
                  <span className="ml-1 inline-flex rounded-md bg-white px-2 py-1 text-[8px] font-semibold text-slate-400 ring-1 ring-slate-200">Decline</span>
                </Phone>
                <div className="tr-pop mb-1 rounded-md bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20" style={{ animationDelay: '5200ms' }}>
                  Booked → shift created, card → Booked ✓
                </div>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Logging a request manually',
        caption: 'Office staff can key a request directly — same card, same pipeline.',
        secs: 9,
        visual: (
          <Stage title="Requests · Log request" narration="Phone-ins work too — Log request opens the same form the client portal submits: home, date, shift type, role, how many, urgent flag. Whatever the source, it lands as an identical card on the board, ready for allocation.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="Office entry"
              actions={<><AppBtn>↻</AppBtn><AppBtn primary>+ Log request</AppBtn></>}
              cursor={[{ x: 55, y: 85, at: 300 }, { x: 36, y: 38, at: 900 }, { x: 62, y: 38, at: 2000 }, { x: 36, y: 46, at: 3100 }, { x: 62, y: 46, at: 4000 }, { x: 36, y: 54, at: 4900 }, { x: 63, y: 76, at: 7000, click: true }]}>
              <AppModal title="Log request" sub="Client asks for cover — key it here and it lands on the board." at={400}
                footer={<><AppBtn>Cancel</AppBtn><AppBtn primary hit={7100}>Create request</AppBtn></>}>
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                  <SField label="Care home" value="Oaks Lodge" at={950} />
                  <TField label="Date" value="23/10/2026" at={2100} />
                  <SField label="Shift type" value="Long day" at={3150} />
                  <SField label="Role" value="Healthcare Assistant" at={4100} />
                  <TField label="Workers needed" value="2" at={5000} />
                  <SField label="Urgency" value="Normal" at={5700} />
                </div>
              </AppModal>
            </Frame>
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
        title: 'The Neuven page',
        caption: 'Beta section — CSV import working today, connection profile ready for API access.',
        visual: (
          <Stage title="Neuven · the page" narration="Neuven is marked Beta — honest about where it stands. CSV import works today: export your Neuven jobs and drop the file in. Below, the connection profile stores the endpoint and key ready for the day Neuven grant API access — Test connection probes it for real, so the plumbing is proven, not promised.">
            <Frame nav="Requests" url="neuven" title="Neuven feed" sub="Neutral-vendor shift feed — CSV import today, live API sync when Neuven grant access.">
              <div className="tr-rise flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5" style={{ animationDelay: '200ms' }}>
                <AppChip tone="amber">Beta</AppChip>
                <span className="text-[8px] text-amber-800">No public API — CSV import is live; automatic sync awaits Neuven's integration agreement.</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">Connection profile</p>
                  <p className="text-[8px] text-slate-600">Endpoint: <b className="text-ink">api.neuven…</b> · Key stored</p>
                  <div className="mt-1.5"><CycleChip states={[{ label: 'Probing…', tone: 'amber' }, { label: 'Unreachable', tone: 'red' }, { label: 'CSV active', tone: 'emerald' }]} ms={1500} /></div>
                </div>
                <div className="rounded-lg border border-slate-200/70 bg-white p-2">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">CSV import</p>
                  <p className="text-[8px] text-slate-600">Drop a Neuven export — every row validated before it lands.</p>
                  <AppBtn primary className="mt-1.5">Choose CSV…</AppBtn>
                </div>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Import preview → commit',
        caption: 'Every row validated before anything is written — green rows land, red rows say why not.',
        secs: 8,
        visual: (
          <Stage title="Neuven · import preview" narration="The preview shows exactly what the file will do before it does it: green rows name the shift they'll create; red rows say why they're rejected — no matching client, duplicate reference. The cursor commits — two jobs land on the pipeline, tagged with their Neuven refs so they can never import twice.">
            <Frame nav="Requests" url="neuven" title="Neuven feed" sub="Import preview — 4 rows"
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 86, y: 82, at: 4600, click: true }]}>
              <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                <div className="grid grid-cols-4 gap-2 border-b border-slate-200/70 bg-slate-50/80 px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Ref</span><span>Job</span><span>Shift</span><span>Result</span>
                </div>
                {[
                  { ref: 'NV-9001', j: 'Chestnut Grange', s: 'Night · 20 Oct', ok: true, msg: 'Import — night ×2' },
                  { ref: 'NV-9002', j: 'Chestnut Grange', s: 'Long day · 21 Oct', ok: true, msg: 'Import — long day' },
                  { ref: 'NV-9003', j: '"Nowhere Home"', s: 'Day · 22 Oct', ok: false, msg: 'No client match' },
                  { ref: 'NV-9001', j: 'Chestnut Grange', s: '—', ok: false, msg: 'Duplicate ref' },
                ].map((r, i) => (
                  <div key={i} className="tr-left grid grid-cols-4 items-center gap-2 border-b border-slate-100 px-2 py-1.5 last:border-0" style={{ animationDelay: `${400 + i * 250}ms` }}>
                    <span className="font-mono text-[8px] text-slate-500">{r.ref}</span>
                    <span className="text-[8px] text-ink">{r.j}</span>
                    <span className="text-[8px] text-slate-500">{r.s}</span>
                    <AppChip tone={r.ok ? 'emerald' : 'red'}>{r.msg}</AppChip>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <AppBtn>Discard</AppBtn>
                <AppBtn primary hit={4700}>Import 2 jobs</AppBtn>
              </div>
              <Toast at={5400}>2 requests created → pipeline</Toast>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Straight onto the board',
        caption: 'Committed jobs become real pending requests — allocate them like any other work.',
        visual: (
          <Stage title="Neuven · jobs become requests" narration="Committed rows are real pending requests — on the board as New, tagged with their Neuven reference. They allocate exactly like internal work, and the reference doubles as a lock: the same Neuven job can never be imported twice.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="Imported jobs tagged NV-">
              <TabBar tabs={['Pipeline', 'Requests (4 open)', 'Availability board']} active="Pipeline" />
              <div className="grid grid-cols-4 gap-1.5">
                <div className="min-w-0 rounded-lg bg-slate-200/50 p-1">
                  <p className="mb-1 border-t-2 border-sky-400 px-1 pt-1 text-[7px] font-bold uppercase tracking-wide text-slate-600">New 3</p>
                  <div className="space-y-1">
                    {['Chestnut · Night ×2 · NV-9001', 'Chestnut · Long day · NV-9002', 'Meadow View · Day'].map((c, i) => (
                      <div key={i} className="tr-rise rounded bg-white px-1.5 py-1 text-[7px] font-medium text-ink shadow-sm ring-1 ring-slate-200/60" style={{ animationDelay: `${400 + i * 250}ms` }}>{c}</div>
                    ))}
                  </div>
                </div>
                <PipeCol label="Offers out" color="#fbbf24" cards={['Oaks · Day']} />
                <PipeCol label="Booked" color="#2dd4bf" cards={['Chestnut · LD']} />
                <PipeCol label="Invoice" color="#14b8a6" cards={['Ferndale · Day']} />
              </div>
            </Frame>
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
        title: 'The timesheets queue',
        caption: 'Every completed shift waiting for its three signatures.',
        visual: (
          <Stage title="Timesheets · the queue" narration="The Timesheets page is the approval queue — every completed shift with its signature state. Submitted means the worker's hours are in; signed means the site countersigned by phone link; approved means the office locked it. The cursor opens Chloe's shift.">
            <Frame nav="Timesheets" url="timesheets" title="Timesheets" sub="Approve and pay completed shifts."
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 45, y: 46, at: 4600, click: true }]}>
              <TabBar tabs={['Awaiting approval (3)', 'Approved', 'Queries']} active="Awaiting approval (3)" />
              <div className="space-y-1">
                <AppRow at={200} className="ring-2 ring-brand-500/40"><LName name="Chloe Stan" sub="Chestnut Grange · Night · 13.5h" /><span className="flex gap-1"><AppChip tone="sky">Worker ✓</AppChip><AppChip tone="violet">Site ✓</AppChip><AppChip tone="amber" blink>Approve</AppChip></span></AppRow>
                <AppRow at={400}><LName name="Mary Begum" sub="Oaks Lodge · Day · 11h" /><span className="flex gap-1"><AppChip tone="sky">Worker ✓</AppChip><AppChip tone="slate">Site pending</AppChip></span></AppRow>
                <AppRow at={600}><LName name="Adebayo Bello" sub="Ferndale · Long day · 12h" /><span className="flex gap-1"><AppChip tone="sky">Worker ✓</AppChip><AppChip tone="violet">Site ✓</AppChip><AppChip tone="amber" blink>Approve</AppChip></span></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Three signatures, one gate',
        caption: 'Worker submits, site countersigns by phone link, office approves — approval freezes the money.',
        secs: 9,
        visual: (
          <Stage title="Timesheets · approve" narration="Three signatures in order — worker submits, site countersigns by a secure phone link, office approves. Approval is the gate: it freezes the pay and charge snapshot forever, so a rate change next month can never rewrite this shift's numbers. The cursor hits Approve.">
            <Frame nav="Timesheets" url="timesheets" title="Timesheets" sub="Chloe Stan — Night, 14 Oct · Chestnut Grange"
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 88, y: 74, at: 5400, click: true }]}>
              <div className="rounded-lg border border-slate-200/70 bg-white p-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-sky-50 p-2 ring-1 ring-sky-600/20">
                    <p className="text-[7px] font-bold uppercase text-sky-700">Worker</p>
                    <p className="text-[8px] text-ink">Submitted · 13.5h</p>
                    <AppChip tone="sky" at={300}>Signed</AppChip>
                  </div>
                  <div className="rounded-md bg-violet-50 p-2 ring-1 ring-violet-600/20">
                    <p className="text-[7px] font-bold uppercase text-violet-700">Site sign-off</p>
                    <p className="text-[8px] text-ink">Phone link · S. Mills</p>
                    <AppChip tone="violet" at={600}>Signed</AppChip>
                  </div>
                  <div className="rounded-md bg-amber-50 p-2 ring-1 ring-amber-600/20">
                    <p className="text-[7px] font-bold uppercase text-amber-700">Office</p>
                    <p className="text-[8px] text-ink">Jill — awaiting</p>
                    <AppChip tone="amber" at={900}>Pending</AppChip>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-slate-50 p-2 text-[8px] text-slate-600">
                  Sat night → ×1.25 uplift · Pay <b className="text-ink">£354.38</b> · Charge <b className="text-ink">£531.56</b>
                  <span className="tr-pop ml-1 rounded bg-amber-100 px-1 text-[7px] font-bold text-amber-700" style={{ animationDelay: '5800ms' }}>SNAPSHOT FROZEN</span>
                </div>
                <div className="mt-2 flex justify-end gap-1.5">
                  <AppBtn>Raise query</AppBtn>
                  <AppBtn primary hit={5500}>Approve timesheet</AppBtn>
                </div>
              </div>
              <Toast at={6300}>Approved — snapshot frozen ✓</Toast>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Queries pause one line',
        caption: 'Wrong hours? Query pauses that timesheet alone — the rest of the week flows through.',
        visual: (
          <Stage title="Timesheets · raising a query" narration="If hours look wrong, query that one timesheet — it pauses alone while the rest of the week keeps approving. Resolve it, the worker resubmits, and it rejoins the queue with the whole exchange on the audit trail.">
            <Frame nav="Timesheets" url="timesheets" title="Timesheets" sub="One queried, the rest flow through">
              <div className="space-y-1">
                <AppRow at={200} className="border-amber-300 bg-amber-50/50"><LName name="Mary Begum" sub="Day · 21 Oct · client says 9h not 11h" /><AppChip tone="amber" blink>Query open</AppChip></AppRow>
                <AppRow at={450}><LName name="Chloe Stan" sub="Night · 20 Oct" /><AppChip tone="emerald">Approved</AppChip></AppRow>
                <AppRow at={700}><LName name="Adebayo Bello" sub="Early · 22 Oct" /><AppChip tone="emerald">Approved</AppChip></AppRow>
                <AppRow at={950}><LName name="Emmanuel Nwosu" sub="Night · 23 Oct" /><AppChip tone="emerald">Approved</AppChip></AppRow>
              </div>
            </Frame>
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
        title: 'The invoices tab',
        caption: 'Every invoice with its state — draft, sent, paid — and overdue counts.',
        secs: 8,
        visual: (
          <Stage title="Invoicing · the list" narration="Invoicing & payroll — four tabs across the top. The list shows every invoice with its status and days overdue in red. The cursor clicks New invoice — next scene builds one.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="Invoices build only from approved timesheets (6.10c)."
              actions={<><AppBtn>↻</AppBtn><AppBtn primary hit={5000}>+ New invoice</AppBtn></>}
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 90, y: 13, at: 4400, click: true }]}>
              <TabBar tabs={['Invoices', 'Aged debtors', 'Payroll export', 'Margin']} active="Invoices" />
              <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                {[
                  { n: 'INV-2026-0001 — Ferndale Court', d: 'Issued 12 Oct · due 26 Oct', v: '£1,142.00', s: 'paid' as const },
                  { n: 'INV-2026-0002 — Chestnut Grange', d: 'Issued 15 Oct · due 29 Oct', v: '£926.25', s: 'sent' as const },
                  { n: 'INV-2026-0003 — Oaks Lodge', d: 'Issued 02 Sep · due 16 Sep · 34d overdue', v: '£2,310.00', s: 'sent' as const, od: true },
                  { n: 'INV-2026-0004 — Meadow View', d: 'Draft', v: '£410.40', s: 'draft' as const },
                ].map((r, i) => (
                  <div key={r.n} className="tr-left flex items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-2 last:border-0" style={{ animationDelay: `${300 + i * 200}ms` }}>
                    <span><span className="block text-[9px] font-medium text-ink">{r.n}</span>
                      <span className={`block text-[7px] ${r.od ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{r.d}</span></span>
                    <span className="flex items-center gap-1.5"><span className="text-[9px] font-semibold text-ink">{r.v}</span><AppChip tone={r.s === 'paid' ? 'emerald' : r.s === 'sent' ? 'sky' : 'slate'}>{r.s}</AppChip></span>
                  </div>
                ))}
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Building an invoice',
        caption: 'Pick a client and period — every approved unbilled shift becomes a line.',
        secs: 9,
        visual: (
          <Stage title="Invoicing · New invoice" narration="New invoice asks for three things — client, period, notes. The moment you pick Chestnut Grange it pulls every approved, unbilled shift as a line item with hours, rate and uplift already resolved from the frozen snapshots. Numbering is automatic; the total counts itself.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="Invoices build only from approved timesheets (6.10c)."
              cursor={[{ x: 55, y: 85, at: 300 }, { x: 40, y: 40, at: 800 }, { x: 40, y: 50, at: 2400 }, { x: 62, y: 50, at: 3400 }, { x: 60, y: 80, at: 6800, click: true }]}>
              <AppModal title="New invoice" sub="Approved, unbilled shifts become line items automatically." at={400}
                footer={<><AppBtn>Cancel</AppBtn><AppBtn primary hit={6900}>Create invoice</AppBtn></>}>
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                  <SField label="Client" value="Chestnut Grange" at={850} className="col-span-2" />
                  <TField label="From" value="13/10/2026" at={2500} />
                  <TField label="To" value="19/10/2026" at={3500} />
                </div>
                <div className="tr-rise mt-2 space-y-1 rounded-md bg-slate-50 p-2" style={{ animationDelay: '4600ms' }}>
                  <p className="text-[7px] font-bold uppercase tracking-wide text-slate-400">3 shifts found</p>
                  <div className="flex justify-between text-[8px] text-slate-600"><span>Chloe Stan · 14 Oct · night 13.5h</span><b className="text-ink">£425.25</b></div>
                  <div className="flex justify-between text-[8px] text-slate-600"><span>Mary Begum · 15 Oct · long day 12h</span><b className="text-ink">£312.00</b></div>
                  <div className="flex justify-between text-[8px] text-slate-600"><span>Adebayo Bello · 16 Oct · day 9h</span><b className="text-ink">£189.00</b></div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 text-[9px] font-bold text-ink"><span>Total</span><span><Count to={926.25} prefix="£" decimals={2} dur={1000} /></span></div>
                </div>
              </AppModal>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Send, print, get paid',
        caption: 'The detail view — send by email, print a PDF, mark paid with the real date.',
        secs: 9,
        visual: (
          <Stage title="Invoicing · the detail" narration="Open the invoice — full line items, client address, totals. The cursor marks it sent, which queues the pre-filled email to the client's billing address; then when the money lands, Mark paid takes the real payment date. That's what drives reconciliation and clears it off aged debtors.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="INV-2026-0001 — Ferndale Court"
              cursor={[{ x: 55, y: 85, at: 300 }, { x: 47, y: 76, at: 3200, click: true }, { x: 66, y: 76, at: 5900, click: true }]}>
              <div className="mx-auto max-w-md rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <div><p className="font-display text-xs font-bold text-ink">INV-2026-0001</p><p className="text-[8px] text-slate-500">Ferndale Court · Ipswich</p></div>
                  <CycleChip states={[{ label: 'Draft', tone: 'slate' }, { label: 'Draft', tone: 'slate' }, { label: 'Draft', tone: 'slate' }, { label: 'Sent', tone: 'sky' }, { label: 'Paid', tone: 'emerald' }]} ms={1400} />
                </div>
                <div className="mt-2 space-y-1 border-y border-slate-100 py-1.5">
                  <div className="flex justify-between text-[8px] text-slate-600"><span>Chloe Stan · 12 Oct · night</span><b className="text-ink">£425.25</b></div>
                  <div className="flex justify-between text-[8px] text-slate-600"><span>Emmanuel Nwosu · 13 Oct · day ×2</span><b className="text-ink">£716.75</b></div>
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] font-bold text-ink"><span>Total</span><span>£1,142.00</span></div>
                <div className="mt-2.5 flex justify-end gap-1.5">
                  <AppBtn>Print PDF</AppBtn>
                  <AppBtn hit={3300}>Mark sent</AppBtn>
                  <AppBtn primary hit={6000}>Mark paid</AppBtn>
                </div>
              </div>
              <Toast at={6700}>Paid 18 Oct — off aged debtors ✓</Toast>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Aged debtors',
        caption: 'Every sent-but-unpaid invoice stacks into ageing buckets — chasing becomes a report.',
        visual: (
          <Stage title="Invoicing · aged debtors" narration="The aged debtors tab stacks every sent-but-unpaid invoice into ageing buckets — current, one to thirty, thirty to sixty, sixty-plus — with the client and amount on each. Chasing is a report you open, not a list you remember; drafts never count because they aren't debt yet.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="Sent but unpaid — by age">
              <TabBar tabs={['Invoices', 'Aged debtors', 'Payroll export', 'Margin']} active="Aged debtors" />
              <div className="grid grid-cols-4 gap-1.5">
                <AppStat label="Current" value="£890" at={100} />
                <AppStat label="1–30 days" value="£926" at={250} tone="text-amber-600" />
                <AppStat label="31–60 days" value="£2,310" at={400} tone="text-orange-600" />
                <AppStat label="60+ days" value="£0" at={550} tone="text-red-600" />
              </div>
              <div className="mt-1.5 space-y-1">
                <AppRow at={700}><span className="text-[8px] text-ink">Oaks Lodge · INV-2026-0003 · £2,310</span><AppChip tone="orange">34 days</AppChip></AppRow>
                <AppRow at={900}><span className="text-[8px] text-ink">Chestnut Grange · INV-2026-0002 · £926</span><AppChip tone="amber">12 days</AppChip></AppRow>
                <AppRow at={1100}><span className="text-[8px] text-ink">Meadow View · INV-2026-0005 · £890</span><AppChip tone="emerald">Current</AppChip></AppRow>
              </div>
            </Frame>
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
        caption: 'Set the period, hit Preview — the modal shows exactly what will export.',
        secs: 8,
        visual: (
          <Stage title="Payroll export · preview" narration="On the payroll tab, set the period and hit Preview — the modal shows the two runs it will create: PAYE and Ltd, with rows, hours and totals, plus any rejected rows with their reasons. Nothing exports until you click Export inside it.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="Bureau-ready payroll runs"
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 80, y: 31, at: 4200, click: true }]}>
              <TabBar tabs={['Invoices', 'Aged debtors', 'Payroll export', 'Margin']} active="Payroll export" />
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-2 py-1.5">
                <span className="text-[8px] text-slate-500">From <b className="text-ink">01/10/2026</b></span>
                <span className="text-[8px] text-slate-500">To <b className="text-ink">31/10/2026</b></span>
                <AppBtn primary hit={4300} className="ml-auto">Preview</AppBtn>
              </div>
              <div className="mt-1.5 rounded-lg border border-slate-200/70 bg-white p-2">
                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Recent runs</p>
                <AppRow at={600}><span className="text-[8px] text-ink">Run #23 · Ltd · 9 shifts</span><span className="text-[8px] font-semibold text-ink">£1,759.76</span></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'The preview modal',
        caption: 'PAYE and Ltd groups, rejected rows with reasons — Export inside the modal.',
        secs: 9,
        visual: (
          <Stage title="Payroll export · inside the preview" narration="Inside the preview: PAYE and Ltd groups with every row's hours and amount, and rejected rows greyed with their reason — so nothing is silently dropped. The cursor exports the PAYE run — the CSV downloads for the bureau and every shift is stamped paid against run #24.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="Payroll preview — 01–31 Oct 2026"
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 74, y: 83, at: 5600, click: true }]}>
              <AppModal title="Payroll preview" sub="01 Oct – 31 Oct 2026" at={400} wide
                footer={<><AppBtn>Close</AppBtn><AppBtn primary hit={5700}>Export PAYE CSV</AppBtn><AppBtn primary>Export Ltd CSV</AppBtn></>}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-slate-50 p-1.5">
                    <p className="mb-1 text-[7px] font-bold uppercase text-slate-500">PAYE · 36 rows · 417h · £9,117.54</p>
                    <div className="space-y-0.5 text-[8px] text-slate-600">
                      <p className="flex justify-between"><span>SAN-001 · Chloe Stan · 13.5h</span><b className="text-ink">£283.50</b></p>
                      <p className="flex justify-between"><span>SAN-005 · Mary Begum · 11h</span><b className="text-ink">£231.00</b></p>
                      <p className="flex justify-between"><span>SAN-051 · Sophie Turner · 12h</span><b className="text-ink">£252.00</b></p>
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-1.5">
                    <p className="mb-1 text-[7px] font-bold uppercase text-slate-500">Ltd · 23 rows · 250.5h · £5,322.23</p>
                    <div className="space-y-0.5 text-[8px] text-slate-600">
                      <p className="flex justify-between"><span>SAN-012 · Emmanuel Nwosu · 24h</span><b className="text-ink">£504.00</b></p>
                      <p className="flex justify-between"><span>SAN-008 · Adebayo Bello · 11h</span><b className="text-ink">£264.00</b></p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-0.5 rounded-md bg-slate-50 p-1.5">
                  <p className="text-[7px] font-bold uppercase text-slate-400">Already exported — skipped</p>
                  <p className="text-[8px] text-slate-500">Run #22 · 11 shifts — cannot double-pay</p>
                </div>
              </AppModal>
              <Toast at={6400}>Exported 36 PAYE shifts — run #24 · £9,117.54</Toast>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Every run is auditable',
        caption: 'Run history — who exported, when, how many shifts, the total, and the CSV.',
        visual: (
          <Stage title="Payroll export · run history" narration="Every export is on record — who ran it, when, PAYE or Ltd, how many shifts, the total — with the CSV re-downloadable any time. A shift marked paid against a run can never export twice: double-pay is structurally impossible, not just warned about.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="Export history">
              <TabBar tabs={['Invoices', 'Aged debtors', 'Payroll export', 'Margin']} active="Payroll export" />
              <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                {[
                  { r: 'Run #24', t: 'PAYE', s: '36 shifts · 417h', v: '£9,117.54', d: 'today 14:02 · Jill' },
                  { r: 'Run #23', t: 'Ltd', s: '9 shifts · 96h', v: '£1,759.76', d: 'today 13:32 · Jill' },
                  { r: 'Run #22', t: 'PAYE', s: '11 shifts · 121h', v: '£2,855.74', d: 'today 13:32 · Jill' },
                  { r: 'Run #21', t: 'PAYE', s: '14 shifts · 154h', v: '£3,104.20', d: '30 Sep · Jill' },
                ].map((r, i) => (
                  <div key={r.r} className="tr-left flex items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-1.5 last:border-0" style={{ animationDelay: `${300 + i * 200}ms` }}>
                    <span><span className="block text-[9px] font-medium text-ink">{r.r} · <span className="text-slate-400">{r.t}</span></span>
                      <span className="block text-[7px] text-slate-400">{r.d}</span></span>
                    <span className="flex items-center gap-2"><span className="text-[8px] text-slate-500">{r.s}</span><b className="text-[9px] text-ink">{r.v}</b><AppBtn>CSV</AppBtn></span>
                  </div>
                ))}
              </div>
            </Frame>
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
        title: 'Running margin',
        caption: 'Set a period, hit Run — actuals from frozen snapshots, estimates flagged.',
        secs: 8,
        visual: (
          <Stage title="Margin · run a period" narration="The margin tab takes a date range — hit Run and every completed shift is costed honestly: charge minus pay minus employer NI minus bureau fee. Rows with frozen approval snapshots are actuals; anything priced on live rates is flagged as an estimate so fact never blends with guidance.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="True cost per shift"
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 80, y: 31, at: 4200, click: true }]}>
              <TabBar tabs={['Invoices', 'Aged debtors', 'Payroll export', 'Margin']} active="Margin" />
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-2 py-1.5">
                <span className="text-[8px] text-slate-500">From <b className="text-ink">01/10/2026</b></span>
                <span className="text-[8px] text-slate-500">To <b className="text-ink">31/10/2026</b></span>
                <span className="text-[8px] text-slate-500">Group <b className="text-ink">Client</b></span>
                <AppBtn primary hit={4300} className="ml-auto">Run</AppBtn>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <AppStat label="Actual shifts" value={<Count to={31} />} at={5000} />
                <AppStat label="Estimated" value={<Count to={6} />} at={5150} tone="text-amber-600" />
                <AppStat label="Total margin" value={<Count to={3.1} prefix="£" suffix="k" decimals={1} />} at={5300} tone="text-emerald-600" />
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Where margin is made',
        caption: 'Per-client breakdown — charge, pay, NI, fee and the margin left.',
        visual: (
          <Stage title="Margin · per client" narration="Grouped by client, the answer is instant — Chestnut Grange returns the most, Meadow View the least, with every shift's charge-pay-NI-fee split visible underneath. The shortest bar is worth a conversation about rates; this is the report that tells you which homes are worth the effort.">
            <Frame nav="Invoicing" url="invoices" title="Invoicing & payroll" sub="Margin by client · October">
              <TabBar tabs={['Invoices', 'Aged debtors', 'Payroll export', 'Margin']} active="Margin" />
              <div className="space-y-1.5 rounded-lg border border-slate-200/70 bg-white p-2">
                {[
                  { c: 'Chestnut Grange', m: '£1,240', p: 92, t: 'bg-emerald-500' },
                  { c: 'Oaks Lodge', m: '£860', p: 64, t: 'bg-teal-500' },
                  { c: 'Ferndale Court', m: '£645', p: 48, t: 'bg-sky-500' },
                  { c: 'Meadow View', m: '£285', p: 21, t: 'bg-amber-500' },
                ].map((r, i) => (
                  <div key={r.c} className="tr-left" style={{ animationDelay: `${200 + i * 180}ms` }}>
                    <div className="flex justify-between text-[8px]"><span className="font-medium text-ink">{r.c}</span><b className="text-emerald-600">{r.m}</b></div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`tr-fill h-full rounded-full ${r.t}`} style={{ ['--w' as any]: `${r.p}%`, animationDelay: `${300 + i * 180}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                <div className="grid grid-cols-6 gap-1 border-b border-slate-200/70 bg-slate-50/80 px-2 py-1 text-[6px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Shift</span><span>Charge</span><span>Pay</span><span>NI</span><span>Fee</span><span>Margin</span>
                </div>
                {[
                  { s: 'C. Stan · 14 Oct', c: '£425.25', p: '£283.50', ni: '£31.20', f: '£4.10', m: '£106.45' },
                  { s: 'M. Begum · 15 Oct', c: '£312.00', p: '£231.00', ni: '£22.60', f: '£4.10', m: '£54.30' },
                ].map((r, i) => (
                  <div key={r.s} className="tr-left grid grid-cols-6 gap-1 border-b border-slate-100 px-2 py-1.5 text-[8px] text-slate-600 last:border-0" style={{ animationDelay: `${1400 + i * 200}ms` }}>
                    <span className="text-ink">{r.s}</span><span>{r.c}</span><span>{r.p}</span><span>{r.ni}</span><span>{r.f}</span><b className="text-emerald-600">{r.m}</b>
                  </div>
                ))}
              </div>
            </Frame>
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
        title: 'The compliance board',
        caption: 'Every document across the workforce — valid, expiring, expired, missing.',
        visual: (
          <Stage title="Compliance · the board" narration="The Compliance page counts every document across the workforce — valid, expiring inside sixty days, expired, missing — and each status flips itself as dates pass. Nobody ticks a flag; this board is always the current truth.">
            <Frame nav="Compliance" url="compliance" title="Compliance" sub="DBS, NMC PIN, right-to-work and training documents across all candidates.">
              <div className="grid grid-cols-4 gap-1.5">
                <AppStat label="Valid" value={<Count to={412} />} at={100} tone="text-emerald-600" />
                <AppStat label="Expiring" value={<Count to={9} />} at={250} tone="text-amber-600" />
                <AppStat label="Expired" value={<Count to={3} />} at={400} tone="text-red-600" />
                <AppStat label="Missing" value={<Count to={4} />} at={550} tone="text-red-600" />
              </div>
              <div className="mt-1.5 space-y-1">
                <AppRow at={700}><LName name="Emmanuel Nwosu" sub="Mandatory Training" /><AppChip tone="amber">Expires in 38d</AppChip></AppRow>
                <AppRow at={900}><LName name="Test Worker" sub="DBS Enhanced" /><AppChip tone="red">Missing</AppChip></AppRow>
                <AppRow at={1100}><LName name="Sofia Reyes" sub="Right to Work" /><AppChip tone="red">Expired</AppChip></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Recording a document',
        caption: 'Upload or key a document — reference, dates, file — the board updates itself.',
        secs: 8,
        visual: (
          <Stage title="Compliance · recording a document" narration="Recording a document takes seconds — type, reference number, expiry date, the file itself. Save it and three things happen at once: the board counts it, the worker's score recalculates, and the reminder engine arms itself for sixty, thirty, fourteen and seven days before expiry.">
            <Frame nav="Compliance" url="compliance" title="Compliance" sub="Emmanuel Nwosu — Mandatory Training"
              cursor={[{ x: 55, y: 85, at: 300 }, { x: 40, y: 38, at: 900 }, { x: 40, y: 48, at: 2300 }, { x: 62, y: 48, at: 3400 }, { x: 62, y: 78, at: 5400, click: true }]}>
              <AppModal title="Record document" sub="Emmanuel Nwosu — upload or key the details." at={400}
                footer={<><AppBtn>Cancel</AppBtn><AppBtn primary hit={5500}>Save document</AppBtn></>}>
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                  <SField label="Document type" value="Mandatory Training" at={950} className="col-span-2" />
                  <TField label="Reference" value="MT-2026-8841" at={2400} />
                  <TField label="Expiry date" value="14/09/2027" at={3500} />
                  <div className="tr-rise col-span-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-center text-[8px] text-slate-400" style={{ animationDelay: '4300ms' }}>
                    certificate.pdf — attached
                  </div>
                </div>
              </AppModal>
              <Toast at={6200}>Saved — reminders armed at 60/30/14/7 days</Toast>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'The booking gate',
        caption: 'Missing a required document? The shift refuses to save and names the gap.',
        secs: 8,
        visual: (
          <Stage title="Compliance · the hard gate" narration="At the moment of allocation the compliance check runs — and if a required document is missing or expired the shift refuses to save, naming the gap. There's no override button; staff fix the document, the score recomputes, and the worker is bookable within seconds.">
            <Frame nav="Requests" url="requests" title="Shift requests & allocation" sub="Trying to book a non-compliant worker"
              cursor={[{ x: 55, y: 85, at: 300 }, { x: 88, y: 46, at: 3800, click: true }]}>
              <TabBar tabs={['Pipeline', 'Requests (3 open)', 'Availability board']} active="Pipeline" />
              <div className="grid grid-cols-4 gap-1.5 opacity-60">
                <PipeCol label="New" color="#38bdf8" cards={['Chestnut · Night ×2']} />
                <PipeCol label="Offers" color="#fbbf24" cards={['Oaks · Day']} />
                <PipeCol label="Booked" color="#2dd4bf" cards={['Ferndale · LD']} />
                <PipeCol label="Invoice" color="#14b8a6" cards={['Meadow · Day']} />
              </div>
              <Drawer title="Allocate — Night, 20 Oct" at={400}>
                <div className="space-y-1">
                  <AppRow at={700}><LName name="Sophie Turner" sub="8 min · compliant" /><AppBtn>Offer</AppBtn></AppRow>
                  <AppRow at={1000} className="border-red-200 bg-red-50/40"><LName name="Test Worker" sub="0.2 mi away" /><AppBtn primary hit={3900}>Offer</AppBtn></AppRow>
                </div>
                <div className="tr-pop mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[8px] font-semibold text-red-600 ring-1 ring-red-600/20" style={{ animationDelay: '4600ms' }}>
                  422 — Cannot book: References missing, DBS missing
                </div>
                <p className="tr-rise mt-1.5 text-[7px] text-slate-400" style={{ animationDelay: '5600ms' }}>Fix the documents on their profile → bookable again in seconds.</p>
              </Drawer>
            </Frame>
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
        title: 'Three apps, three jobs',
        caption: 'Workers self-serve, homes manage their cover, supervisors run the floor.',
        visual: (
          <Stage title="The three portals" narration="Three portals, three jobs. Workers set availability, accept offers and submit timesheets. Homes raise requests and countersign timesheets. Supervisors see tonight's rota and check workers in as they arrive. Each sees exactly their slice — never rates, margins, or each other's money.">
            <StageBare>
              <div className="flex items-end justify-center gap-4 pt-2">
                <Phone title="Worker portal" at={100}>
                  <p className="text-[7px] font-bold text-ink">Hi Sophie</p>
                  <div className="rounded-md bg-white p-1 ring-1 ring-slate-200"><p className="text-[6px] text-slate-500">Offer · Chestnut night</p><span className="mt-0.5 inline-flex rounded bg-brand-600 px-1.5 py-0.5 text-[6px] font-semibold text-white">Accept</span></div>
                  <div className="rounded-md bg-white p-1 ring-1 ring-slate-200"><p className="text-[6px] text-slate-500">Timesheet due</p></div>
                </Phone>
                <Phone title="Client portal" at={400}>
                  <p className="text-[7px] font-bold text-ink">Chestnut Grange</p>
                  <div className="rounded-md bg-white p-1 ring-1 ring-slate-200"><p className="text-[6px] text-slate-500">Night cover · filled ✓</p></div>
                  <div className="rounded-md bg-white p-1 ring-1 ring-slate-200"><p className="text-[6px] text-slate-500">Sign timesheet — Chloe</p></div>
                </Phone>
                <Phone title="Supervisor" at={700}>
                  <p className="text-[7px] font-bold text-ink">Tonight's rota</p>
                  <div className="rounded-md bg-white p-1 ring-1 ring-slate-200"><p className="text-[6px] text-slate-500">S. Turner · 19:00 <b className="text-emerald-600">✓ in</b></p></div>
                  <div className="rounded-md bg-white p-1 ring-1 ring-slate-200"><p className="text-[6px] text-slate-500">M. Begum · 19:00 · awaiting</p></div>
                </Phone>
              </div>
            </StageBare>
          </Stage>
        ),
      },
      {
        title: 'The worker journey',
        caption: 'Offer arrives → accept → work the shift → submit timesheet → paid.',
        secs: 8,
        visual: (
          <Stage title="Worker portal · the full loop" narration="The worker's whole loop on one phone: an offer arrives with the shift details — she taps Accept — after the shift her timesheet is ready to submit — and when payroll runs, it's marked paid. She never sees the client's charge or anyone else's details.">
            <StageBare>
              <div className="mx-auto flex max-w-sm items-end gap-3">
                <Phone title="Worker portal" at={100}>
                  <div className="rounded-md bg-white p-1.5 ring-1 ring-slate-200">
                    <p className="text-[6px] font-bold text-ink">Shift offer</p>
                    <p className="text-[6px] text-slate-500">Night · Chestnut Grange<br />20 Oct · 19:00–07:30</p>
                    <span className="mt-1 inline-flex rounded bg-brand-600 px-1.5 py-0.5 text-[6px] font-semibold text-white tr-hit" style={{ animationDelay: '1800ms' }}>Accept</span>
                  </div>
                  <div className="rounded-md bg-white p-1.5 ring-1 ring-slate-200" style={{ animationDelay: '3000ms' }}>
                    <p className="text-[6px] font-bold text-ink">Timesheet</p>
                    <p className="text-[6px] text-slate-500">13.5h · ready</p>
                    <span className="mt-0.5 inline-flex rounded bg-brand-600 px-1.5 py-0.5 text-[6px] font-semibold text-white tr-hit" style={{ animationDelay: '4200ms' }}>Submit</span>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-1.5 ring-1 ring-emerald-600/20" style={{ animationDelay: '5400ms' }}>
                    <p className="text-[6px] font-bold text-emerald-700">Paid · £354.38 — run #24 ✓</p>
                  </div>
                </Phone>
                <div className="mb-4 flex-1 space-y-1">
                  {['Offer → accept', 'Work the shift', 'Submit timesheet', 'Site signs', 'Paid via payroll'].map((s, i) => (
                    <p key={s} className="tr-rise flex items-center gap-1.5 text-[9px] font-medium text-white/80" style={{ animationDelay: `${800 + i * 500}ms` }}>
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent-500 text-[7px] font-bold text-white">{i + 1}</span>{s}
                    </p>
                  ))}
                </div>
              </div>
            </StageBare>
          </Stage>
        ),
      },
      {
        title: 'What they never see',
        caption: 'Boundaries are deliberate — workers never see charge rates, homes never see pay.',
        visual: (
          <Stage title="Portals · the boundaries" narration="The boundaries are deliberate and enforced server-side, not just hidden buttons: workers never see charge rates or margins; homes never see what the worker is paid; supervisors see tonight's rota and nothing else. It's one database with three clean windows into it.">
            <StageBare>
              <div className="mx-auto grid max-w-md grid-cols-3 gap-2 pt-2">
                {[
                  { p: 'Worker', sees: 'Offers · timesheets · documents · own pay', never: 'Charge rates · margins · other workers' },
                  { p: 'Client', sees: 'Requests · rota · sign-offs · own invoices', never: 'Worker pay · other homes' },
                  { p: 'Supervisor', sees: "Tonight's rota · check-ins", never: 'Pay · billing · office tools' },
                ].map((x, i) => (
                  <div key={x.p} className="tr-rise rounded-lg bg-white/10 p-2 ring-1 ring-white/10" style={{ animationDelay: `${200 + i * 250}ms` }}>
                    <p className="text-[8px] font-bold uppercase tracking-wide text-accent-300">{x.p}</p>
                    <p className="mt-1 text-[7px] font-semibold text-emerald-300">Sees</p>
                    <p className="text-[7px] leading-snug text-white/70">{x.sees}</p>
                    <p className="mt-1 text-[7px] font-semibold text-red-300">Never</p>
                    <p className="text-[7px] leading-snug text-white/50">{x.never}</p>
                  </div>
                ))}
              </div>
            </StageBare>
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
        title: 'The DBS board',
        caption: 'Every worker\'s DBS position, colour-coded — renewals chased before they lapse.',
        visual: (
          <Stage title="DBS checks · the board" narration="The DBS board colour-codes every worker — emerald in date, amber re-check due, red flagged or no DBS on file at all. Renewals get chased before they lapse, not discovered after the home asks.">
            <Frame nav="Compliance" url="dbs" title="DBS checks" sub="Track Disclosure & Barring Service checks across the workforce."
              actions={<AppBtn primary>Import results</AppBtn>}>
              <div className="grid grid-cols-4 gap-1.5">
                <AppStat label="Workers" value={<Count to={50} />} at={100} />
                <AppStat label="On file" value={<Count to={46} />} at={250} />
                <AppStat label="Update Service" value={<Count to={19} />} at={400} tone="text-brand-600" />
                <AppStat label="Attention" value={<Count to={3} />} at={550} tone="text-red-600" />
              </div>
              <div className="mt-1.5 space-y-1">
                <AppRow at={700}><LName name="Mary Begum" sub="cert 0017123456 · checked 15 Oct" /><AppChip tone="emerald">In date</AppChip></AppRow>
                <AppRow at={900}><LName name="Adebayo Bello" sub="last check 7 months ago" /><AppChip tone="amber">Re-check due</AppChip></AppRow>
                <AppRow at={1100}><LName name="Test Worker" sub="result: new information" /><AppChip tone="red" blink>Attention</AppChip></AppRow>
                <AppRow at={1300}><LName name="New applicant" sub="no DBS document yet" /><AppChip tone="red">No DBS</AppChip></AppRow>
              </div>
            </Frame>
          </Stage>
        ),
      },
      {
        title: 'Importing provider results',
        caption: 'Export from gov.uk or an umbrella body — CSV in, audited register checks out.',
        secs: 8,
        visual: (
          <Stage title="DBS checks · CSV import" narration="Whoever runs the checks — gov.uk direct or an umbrella body — export their CSV and drop it in. Each row matches a worker by email, id or name, and lands as an audited register check marked honestly as an import — never claimed as system-verified. Duplicates and unknown workers are rejected in preview.">
            <Frame nav="Compliance" url="dbs" title="DBS checks" sub="Import preview — provider CSV"
              cursor={[{ x: 55, y: 88, at: 300 }, { x: 84, y: 82, at: 4800, click: true }]}>
              <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-white">
                <div className="grid grid-cols-4 gap-2 border-b border-slate-200/70 bg-slate-50/80 px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Worker</span><span>Certificate</span><span>Result</span><span>Outcome</span>
                </div>
                {[
                  { w: 'Mary Begum', c: '0017123456', r: 'Clear', ok: true, m: 'Record check' },
                  { w: 'Emmanuel Nwosu', c: '0017441201', r: 'Clear', ok: true, m: 'Record check' },
                  { w: 'J. Smith', c: '—', r: '—', ok: false, m: 'No worker match' },
                  { w: 'Mary Begum', c: '0017123456', r: 'Clear', ok: false, m: 'Already recorded' },
                ].map((r, i) => (
                  <div key={i} className="tr-left grid grid-cols-4 items-center gap-2 border-b border-slate-100 px-2 py-1.5 last:border-0" style={{ animationDelay: `${400 + i * 250}ms` }}>
                    <span className="text-[8px] text-ink">{r.w}</span>
                    <span className="font-mono text-[8px] text-slate-500">{r.c}</span>
                    <span className="text-[8px] text-slate-500">{r.r}</span>
                    <AppChip tone={r.ok ? 'emerald' : 'red'}>{r.m}</AppChip>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-1.5"><AppBtn>Discard</AppBtn><AppBtn primary hit={4900}>Commit 2 checks</AppBtn></div>
              <Toast at={5600}>2 register checks recorded — audited</Toast>
            </Frame>
          </Stage>
        ),
      },
    ],
  },
];

// Wrapper so Phone-based scenes (no Frame) still sit correctly in the stage
function StageBare({ children }: { children: ReactNode }) {
  return <div className="h-full">{children}</div>;
}
