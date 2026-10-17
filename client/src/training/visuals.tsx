import { useEffect, useRef, useState, type ReactNode } from 'react';

// ── Training-scene animation primitives ─────────────────────────────────────
// Self-contained CSS — injected once by Training.tsx via <TrainingStyles/>.
export const TR_CSS = `
  .tr-stage { position: relative; overflow: hidden; border-radius: 1rem;
    background:
      radial-gradient(600px 300px at 20% 0%, rgb(24 99 220 / 0.28), transparent 60%),
      radial-gradient(500px 260px at 90% 100%, rgb(1 174 240 / 0.18), transparent 60%),
      linear-gradient(160deg, #0b1b30 0%, #0e2543 55%, #0b1b30 100%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); }
  .tr-rise   { opacity: 0; transform: translateY(14px); animation: tr-rise .55s cubic-bezier(.16,1,.3,1) forwards; }
  .tr-left   { opacity: 0; transform: translateX(-18px); animation: tr-left .5s cubic-bezier(.16,1,.3,1) forwards; }
  .tr-pop    { opacity: 0; transform: scale(.85); animation: tr-pop .45s cubic-bezier(.34,1.56,.64,1) forwards; }
  .tr-grow   { transform-origin: bottom; transform: scaleY(0); animation: tr-grow .7s cubic-bezier(.16,1,.3,1) forwards; }
  .tr-stamp  { opacity: 0; transform: scale(1.7) rotate(-14deg); animation: tr-stamp .5s cubic-bezier(.16,1,.3,1) forwards; }
  .tr-blink  { animation: tr-blink 1.4s ease-in-out infinite; }
  .tr-dash   { stroke-dasharray: 6 6; animation: tr-dash 1s linear infinite; }
  .tr-sweep::after { content:''; position:absolute; inset:0; transform:translateX(-100%);
    background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.18) 50%, transparent 70%);
    animation: tr-sweep 2.4s ease-in-out infinite; }
  .tr-sweep  { position: relative; overflow: hidden; }
  .tr-float  { animation: tr-float 3.2s ease-in-out infinite; }
  .tr-fill   { width: 0; animation: tr-fill 1.1s cubic-bezier(.16,1,.3,1) forwards; }
  .tr-draw   { stroke-dasharray: 100; stroke-dashoffset: 100; animation: tr-draw 1.6s ease-out forwards; }
  .tr-scan   { position:absolute; top:0; bottom:0; width:34%;
    background: linear-gradient(90deg, transparent, rgb(1 174 240 / 0.14), transparent);
    animation: tr-scan 3s ease-in-out infinite; }
  .tr-marquee { display:flex; gap:2rem; width:max-content; animation: tr-marquee 18s linear infinite; }
  .tr-pulse-ring { animation: tr-pulse-ring 1.8s ease-out infinite; }
  @keyframes tr-rise  { to { opacity:1; transform:translateY(0) } }
  @keyframes tr-left  { to { opacity:1; transform:translateX(0) } }
  @keyframes tr-pop   { to { opacity:1; transform:scale(1) } }
  @keyframes tr-grow  { to { transform:scaleY(1) } }
  @keyframes tr-sweep { to { transform:translateX(100%) } }
  @keyframes tr-stamp { 60% { opacity:1; transform:scale(.92) rotate(-8deg) } to { opacity:1; transform:scale(1) rotate(-8deg) } }
  @keyframes tr-blink { 0%,100% { opacity:1 } 50% { opacity:.3 } }
  @keyframes tr-dash  { to { stroke-dashoffset: -12 } }
  @keyframes tr-float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-6px) } }
  @keyframes tr-fill  { to { width: var(--w, 100%) } }
  @keyframes tr-draw  { to { stroke-dashoffset: 0 } }
  @keyframes tr-scan  { 0%,100% { left:-35% } 50% { left:101% } }
  @keyframes tr-marquee { to { transform:translateX(-50%) } }
  @keyframes tr-pulse-ring { 0% { box-shadow:0 0 0 0 rgb(52 211 153 / .5) } 70% { box-shadow:0 0 0 8px transparent } 100% { box-shadow:0 0 0 0 transparent } }

  /* ── Screen-replica kit (light UI inside the dark stage) ───────────────── */
  .tr-cursor { position:absolute; z-index:60; pointer-events:none;
    transition: left .55s cubic-bezier(.4,0,.2,1), top .55s cubic-bezier(.4,0,.2,1); }
  .tr-click { position:absolute; left:-3px; top:-3px; width:12px; height:12px; border-radius:50%;
    background: rgb(24 99 220 / .4); animation: tr-click .5s ease-out forwards; }
  .tr-hit { animation: tr-hit .8s ease-out; }
  .tr-right { opacity:0; transform:translateX(28px); animation: tr-right .5s cubic-bezier(.16,1,.3,1) forwards; }
  .tr-caret::after { content:''; display:inline-block; width:1.5px; height:.85em; margin-left:1px;
    background:#1863dc; vertical-align:-1px; animation: tr-blink .9s step-end infinite; }
  @keyframes tr-click { from { transform:scale(.5); opacity:1 } to { transform:scale(3.4); opacity:0 } }
  @keyframes tr-right { to { opacity:1; transform:translateX(0) } }
  @keyframes tr-hit { 0% { box-shadow:0 0 0 0 rgb(24 99 220 / .55) } 55% { box-shadow:0 0 0 5px rgb(24 99 220 / .28) } 100% { box-shadow:0 0 0 9px transparent } }
  @media (prefers-reduced-motion: reduce) {
    .tr-rise,.tr-left,.tr-right,.tr-pop,.tr-grow,.tr-stamp,.tr-draw,.tr-fill { animation-duration:.01s; animation-fill-mode:forwards }
    .tr-sweep::after,.tr-blink,.tr-dash,.tr-float,.tr-scan,.tr-marquee,.tr-pulse-ring { animation: none }
  }
`;

export function TrainingStyles() { return <style>{TR_CSS}</style>; }

// Animated count-up
export function Count({ to, prefix = '', suffix = '', dur = 900, decimals = 0 }: {
  to: number; prefix?: string; suffix?: string; dur?: number; decimals?: number;
}) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, dur]);
  return <span>{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

const d = (i: number, base = 120, step = 130) => ({ animationDelay: `${base + i * step}ms` });
export const delay = d;

// Mini KPI tile on the dark stage
export function Stat({ label, value, i = 0, tone = 'text-white' }: {
  label: string; value: ReactNode; i?: number; tone?: string;
}) {
  return (
    <div className="tr-rise rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/10" style={d(i)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/70">{label}</p>
      <p className={`mt-0.5 font-display text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

// Fake list/table row
export function Row({ i = 0, children, tone }: { i?: number; children: ReactNode; tone?: string }) {
  return (
    <div className={`tr-left flex items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/10 ${tone ?? ''}`} style={d(i)}>
      {children}
    </div>
  );
}

export function AvatarDot({ name }: { name: string }) {
  const hues = [210, 160, 280, 20, 330, 45];
  const h = hues[name.length % hues.length];
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ background: `hsl(${h} 65% 45%)` }}>{initials}</span>
  );
}

export function NameBar({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className="min-w-0 flex items-center gap-2">
      <AvatarDot name={name} />
      <span className="truncate">
        <span className="block truncate text-xs font-semibold text-white">{name}</span>
        {sub && <span className="block truncate text-[10px] text-sky-200/60">{sub}</span>}
      </span>
    </span>
  );
}

// Coloured chip
export function Chip({ children, tone = 'sky', i = 0, blink, pulse }: {
  children: ReactNode; i?: number; blink?: boolean; pulse?: boolean;
  tone?: 'sky' | 'emerald' | 'amber' | 'red' | 'violet' | 'orange' | 'teal' | 'slate';
}) {
  const tones: Record<string, string> = {
    sky: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',
    emerald: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
    amber: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
    red: 'bg-red-400/15 text-red-300 ring-red-400/30',
    violet: 'bg-violet-400/15 text-violet-300 ring-violet-400/30',
    orange: 'bg-orange-400/15 text-orange-300 ring-orange-400/30',
    teal: 'bg-teal-400/15 text-teal-300 ring-teal-400/30',
    slate: 'bg-white/10 text-white/60 ring-white/15',
  };
  return (
    <span className={`tr-pop inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${tones[tone]} ${blink ? 'tr-blink' : ''} ${pulse ? 'tr-pulse-ring' : ''}`} style={d(i, 300)}>
      {children}
    </span>
  );
}

// Rubber-stamp overlay (APPROVED / PAID / EXPORTED)
export function Stamp({ children, tone = 'emerald', delay: dl = 1400 }: {
  children: ReactNode; tone?: 'emerald' | 'sky' | 'red'; delay?: number;
}) {
  const tones = { emerald: 'border-emerald-400 text-emerald-300', sky: 'border-sky-400 text-sky-300', red: 'border-red-400 text-red-300' };
  return (
    <span className={`tr-stamp pointer-events-none absolute right-4 top-3 rounded-md border-[3px] px-3 py-1 font-display text-lg font-black uppercase tracking-widest ${tones[tone]}`}
      style={{ animationDelay: `${dl}ms` }}>{children}</span>
  );
}

// Animated chevron between flow steps
export function FlowArrow({ i = 0 }) {
  return (
    <svg className="tr-pop h-4 w-8 shrink-0 text-sky-400/70" style={d(i, 400, 200)} viewBox="0 0 32 16" fill="none">
      <path d="M0 8h26" stroke="currentColor" strokeWidth="2" className="tr-dash" />
      <path d="M22 3l6 5-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mini panel frame
export function Panel({ title, children, className = '', scan }: {
  title?: string; children: ReactNode; className?: string; scan?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur-sm ${className}`}>
      {scan && <div className="tr-scan" />}
      {title && <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-200/70">{title}</p>}
      {children}
    </div>
  );
}

// Growing bar for charts
export function Bar({ h, tone = 'bg-sky-400/70', i = 0, label }: { h: number; tone?: string; i?: number; label?: string }) {
  return (
    <div className="flex w-8 flex-col items-center gap-1">
      <div className="flex h-24 w-full items-end rounded-t bg-white/5">
        <div className={`tr-grow w-full rounded-t ${tone}`} style={{ height: `${h}%`, animationDelay: `${150 + i * 140}ms` }} />
      </div>
      {label && <span className="text-[9px] text-sky-200/60">{label}</span>}
    </div>
  );
}

// ── New: continuously-moving elements ───────────────────────────────────────

// Activity ticker — infinite marquee of live-feed items
export function Ticker({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden rounded-lg bg-black/25 py-1.5 ring-1 ring-white/10">
      <div className="tr-marquee">
        {doubled.map((t, i) => (
          <span key={i} className="flex shrink-0 items-center gap-1.5 text-[10px] text-sky-200/70">
            <span className="h-1 w-1 rounded-full bg-accent-400" />{t}
          </span>
        ))}
      </div>
    </div>
  );
}

// Sparkline that draws itself, with a glowing end dot
export function Spark({ points, tone = '#34d399', h = 56 }: { points: number[]; tone?: string; h?: number }) {
  const max = Math.max(...points), min = Math.min(...points);
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 90 - ((p - min) / (max - min || 1)) * 80;
    return `${x},${y}`;
  }).join(' ');
  const lastX = 100, lastY = 90 - ((points[points.length - 1] - min) / (max - min || 1)) * 80;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        pathLength={100} className="tr-draw" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="3.5" fill={tone} className="tr-blink" />
    </svg>
  );
}

// A request card that physically travels across pipeline columns
export function KanbanMove({ cols, card, dwell = 1400 }: { cols: { label: string; color: string }[]; card: ReactNode; dwell?: number }) {
  const [col, setCol] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCol((c) => (c + 1) % cols.length), dwell);
    return () => clearInterval(t);
  }, [cols.length, dwell]);
  return (
    <div className="relative">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols.length},1fr)` }}>
        {cols.map((c, i) => (
          <div key={i} className={`rounded-lg border-t-2 px-1.5 pb-1.5 pt-1 text-center text-[8px] font-bold uppercase tracking-wide transition-colors ${i === col ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-white/60'}`}
            style={{ borderColor: c.color }}>
            {c.label}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute top-6 px-0.5 transition-transform duration-700"
        style={{ transform: `translateX(${col * 100}%)`, width: `${100 / cols.length}%`, transitionTimingFunction: 'cubic-bezier(.16,1,.3,1)' }}>
        <div className="rounded-md bg-white/95 px-2 py-1.5 text-[10px] font-semibold text-ink shadow-lg">{card}</div>
      </div>
    </div>
  );
}

// Filling progress bar
export function FillBar({ pct, tone = 'bg-accent-400', i = 0, label }: { pct: number; tone?: string; i?: number; label?: string }) {
  return (
    <div>
      {label && <p className="mb-0.5 text-[9px] font-medium text-sky-200/60">{label}</p>}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`tr-fill h-full rounded-full ${tone}`} style={{ ['--w' as any]: `${pct}%`, animationDelay: `${200 + i * 200}ms` }} />
      </div>
    </div>
  );
}

// Cycling status badge — flips through states on an interval
export function CycleChip({ states, ms = 1400 }: { states: { label: string; tone: any }[]; ms?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % states.length), ms);
    return () => clearInterval(t);
  }, [states.length, ms]);
  return <Chip tone={states[i].tone}>{states[i].label}</Chip>;
}

// Dark stage wrapper every scene renders inside. `title` is an in-scene
// eyebrow heading; `narration` fills the big bubble docked at the bottom —
// the single explanation box for the whole scene (never overlays visuals).
export function Stage({ children, title, narration }: {
  children: ReactNode; title?: string; narration: ReactNode;
}) {
  return (
    <div className="tr-stage flex h-full flex-col">
      {title && (
        <p className="tr-rise shrink-0 px-6 pt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-400 sm:px-8">{title}</p>
      )}
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-6 pb-4 pt-3 sm:px-8">{children}</div>
      <div className="shrink-0 px-5 pb-5">
        <div className="tr-rise rounded-2xl bg-white/95 px-5 py-3.5 shadow-xl" style={delay(1, 400)}>
          <p className="text-[13px] font-medium leading-relaxed text-ink">{narration}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Screen-replica kit — light, faithful mock-ups of the real app UI.
//  Everything inside <Frame> looks like the real screen, not an abstraction.
// ═══════════════════════════════════════════════════════════════════════════

export interface CursorStep { x: number; y: number; at: number; click?: boolean }

// A mouse cursor that tours waypoints; `click: true` fires a ripple there.
export function Cursor({ path }: { path: CursorStep[] }) {
  const [i, setI] = useState(0);
  const [clk, setClk] = useState(0);
  useEffect(() => {
    const ts: number[] = [];
    path.forEach((p, k) => {
      ts.push(window.setTimeout(() => {
        setI(k);
        if (p.click) setClk(k + 1);
      }, p.at));
    });
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const p = path[Math.min(i, path.length - 1)];
  return (
    <div className="tr-cursor tr-pop" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: '300ms' }}>
      {clk > 0 && <span key={clk} className="tr-click" />}
      <svg width="15" height="15" viewBox="0 0 24 24" className="drop-shadow-[0_2px_3px_rgb(0_0_0/.55)]">
        <path d="M5 3.5 19.5 12l-6.2 1.3L9.8 19 5 3.5z" fill="#0b1b30" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const MOCK_NAV = ['Dashboard', 'Candidates', 'Care Homes', 'Requests', 'Timesheets', 'Invoicing', 'Compliance', 'Reports'];

// Light "browser window" replica of the app — sidebar, topbar, page header.
// `cursor` waypoints are % of the whole frame.
export function Frame({ nav, url = '', eyebrow, title, sub, actions, children, cursor }: {
  nav?: string; url?: string; eyebrow?: string; title: string; sub?: string;
  actions?: ReactNode; children: ReactNode; cursor?: CursorStep[];
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-[#eef2f8] shadow-2xl ring-1 ring-black/40">
      {/* browser chrome */}
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" /><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="ml-1.5 flex-1 truncate rounded bg-slate-100 px-2 py-0.5 text-[7px] text-slate-400">sanitasmedicalrecruitment-acop.vercel.app/{url}</span>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <div className="flex w-[84px] shrink-0 flex-col bg-gradient-to-b from-[#081c38] to-[#0c2c56] px-1.5 py-1.5">
          <div className="rounded-md bg-white/95 px-1.5 py-1 text-center ring-1 ring-white/60">
            <span className="text-[7px] font-black tracking-tight text-brand-700">SANITAS</span>
          </div>
          <div className="mt-2 space-y-px">
            {MOCK_NAV.map((n) => (
              <div key={n} className={`truncate rounded px-1.5 py-[3px] text-[7px] font-medium ${n === nav ? 'bg-white/15 text-white ring-1 ring-white/15' : 'text-brand-200/45'}`}>{n}</div>
            ))}
          </div>
        </div>
        {/* content column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-6 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/80 px-2.5">
            <div className="w-28 rounded-md bg-slate-100 px-1.5 py-0.5 text-[7px] text-slate-400">Search candidates, clients…</div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-slate-200" />
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-brand-600 text-[5px] font-bold text-white">J</span>
            </div>
          </div>
          <div className="flex shrink-0 items-start justify-between gap-2 px-3 pt-2">
            <div className="min-w-0">
              {eyebrow && <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>}
              <p className="truncate font-display text-[13px] font-bold leading-tight text-ink">{title}</p>
              {sub && <p className="truncate text-[8px] text-slate-500">{sub}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-0.5">{actions}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-3 py-2">{children}</div>
        </div>
      </div>
      {cursor && <Cursor path={cursor} />}
    </div>
  );
}

// ── Light UI replicas ────────────────────────────────────────────────────────

// Button replica; `hit` = ms when the cursor-click glow fires.
export function AppBtn({ children, primary, hit, className = '' }: { children: ReactNode; primary?: boolean; hit?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[9px] font-semibold ${primary ? 'bg-brand-600 text-white' : 'bg-white text-ink ring-1 ring-slate-200'} ${hit != null ? 'tr-hit' : ''} ${className}`}
      style={hit != null ? { animationDelay: `${hit}ms` } : undefined}>{children}</span>
  );
}

const LTONES: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-600 ring-red-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
};

export function AppChip({ children, tone = 'slate', at = 0, blink }: { children: ReactNode; tone?: keyof typeof LTONES; at?: number; blink?: boolean }) {
  return (
    <span className={`tr-pop inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide ring-1 ring-inset ${LTONES[tone]} ${blink ? 'tr-blink' : ''}`}
      style={{ animationDelay: `${at}ms` }}>{children}</span>
  );
}

export function AppStat({ label, value, at = 0, tone = 'text-ink' }: { label: string; value: ReactNode; at?: number; tone?: string }) {
  return (
    <div className="tr-rise rounded-lg border border-slate-200/70 bg-white px-2 py-1.5 shadow-sm" style={{ animationDelay: `${at}ms` }}>
      <p className="text-[7px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`font-display text-sm font-bold leading-tight ${tone}`}>{value}</p>
    </div>
  );
}

export function AppRow({ children, at = 0, className = '' }: { children: ReactNode; at?: number; className?: string }) {
  return (
    <div className={`tr-left flex items-center justify-between gap-2 rounded-md border border-slate-200/60 bg-white px-2 py-1.5 ${className}`} style={{ animationDelay: `${at}ms` }}>
      {children}
    </div>
  );
}

export function LAvatar({ name }: { name: string }) {
  const hues = [210, 160, 280, 20, 330, 45];
  const h = hues[name.length % hues.length];
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[6px] font-bold text-white"
      style={{ background: `hsl(${h} 60% 45%)` }}>{name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
  );
}

export function LName({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <LAvatar name={name} />
      <span className="min-w-0">
        <span className="block truncate text-[9px] font-semibold leading-tight text-ink">{name}</span>
        {sub && <span className="block truncate text-[7px] leading-tight text-slate-400">{sub}</span>}
      </span>
    </span>
  );
}

// Text input replica — value types itself in starting at `at` ms.
export function TField({ label, value, at = 0, cps = 34, className = '' }: { label: string; value: string; at?: number; cps?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let iv = 0;
    const t0 = window.setTimeout(() => {
      iv = window.setInterval(() => {
        setN((x) => { if (x >= value.length) { clearInterval(iv); return x; } return x + 1; });
      }, 1000 / cps);
    }, at);
    return () => { clearTimeout(t0); clearInterval(iv); };
  }, [value, at, cps]);
  const typing = n > 0 && n < value.length;
  return (
    <div className={className}>
      <p className="mb-0.5 text-[8px] font-semibold text-slate-500">{label}</p>
      <div className={`flex h-6 items-center rounded-md border bg-white px-1.5 text-[10px] transition-colors ${typing ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200'}`}>
        <span className={`truncate ${n ? 'text-ink' : ''} ${typing ? 'tr-caret' : ''}`}>{n ? value.slice(0, n) : ''}</span>
      </div>
    </div>
  );
}

// Select replica — value pops in at `at` ms as if chosen from the dropdown.
export function SField({ label, value, at = 0, className = '' }: { label: string; value: string; at?: number; className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setOn(true), at); return () => clearTimeout(t); }, [at]);
  return (
    <div className={className}>
      <p className="mb-0.5 text-[8px] font-semibold text-slate-500">{label}</p>
      <div className={`flex h-6 items-center justify-between rounded-md border bg-white px-1.5 text-[10px] transition-colors ${on ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200'}`}>
        <span key={String(on)} className={`truncate ${on ? 'tr-pop text-ink' : 'text-slate-300'}`}>{on ? value : 'Select…'}</span>
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
      </div>
    </div>
  );
}

// Modal replica — scrim + white card popping in at `at` ms, over the whole frame.
export function AppModal({ title, sub, at = 0, children, footer, wide }: {
  title: string; sub?: string; at?: number; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="tr-rise absolute inset-0 z-40 flex items-center justify-center bg-[#0b1b30]/45 p-3 backdrop-blur-[1px]" style={{ animationDelay: `${at}ms` }}>
      <div className={`tr-pop max-h-full w-full overflow-y-auto rounded-xl bg-white p-3 shadow-2xl ${wide ? 'max-w-lg' : 'max-w-sm'}`} style={{ animationDelay: `${at + 90}ms` }}>
        <p className="font-display text-xs font-bold text-ink">{title}</p>
        {sub && <p className="mt-0.5 text-[8px] leading-snug text-slate-500">{sub}</p>}
        <div className="mt-2.5">{children}</div>
        {footer && <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5">{footer}</div>}
      </div>
    </div>
  );
}

// Right-hand drawer replica (allocation drawer etc.)
export function Drawer({ title, at = 0, children }: { title: string; at?: number; children: ReactNode }) {
  return (
    <div className="tr-right absolute inset-y-0 right-0 z-40 w-60 overflow-hidden border-l border-slate-200 bg-white p-2.5 shadow-2xl" style={{ animationDelay: `${at}ms` }}>
      <p className="font-display text-[11px] font-bold text-ink">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// Checklist row that ticks itself at `at` ms (compliance requirements step).
export function CheckItem({ label, at = 0, detail }: { label: string; at?: number; detail?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setDone(true), at); return () => clearTimeout(t); }, [at]);
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 transition-colors ${done ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200/70 bg-white'}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-black ${done ? 'tr-pop bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>✓</span>
        <span className="truncate text-[9px] font-medium text-ink">{label}</span>
      </span>
      {detail && done && <span className="shrink-0 text-[7px] text-slate-500">{detail}</span>}
    </div>
  );
}

// Segmented tab bar replica (Invoicing / Requests pages)
export function TabBar({ tabs, active }: { tabs: string[]; active: string }) {
  return (
    <div className="mb-2 flex w-fit gap-0.5 rounded-lg bg-slate-900/5 p-0.5">
      {tabs.map((t) => (
        <span key={t} className={`rounded-md px-2.5 py-0.5 text-[8px] font-medium ${t === active ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}>{t}</span>
      ))}
    </div>
  );
}

// Light pipeline column for board replicas
export function PipeCol({ label, color, cards, glow }: { label: string; color: string; cards: string[]; glow?: boolean }) {
  return (
    <div className={`min-w-0 rounded-lg bg-slate-200/50 p-1 ${glow ? 'tr-pulse-ring' : ''}`}>
      <p className="mb-1 truncate border-t-2 px-1 pt-1 text-[7px] font-bold uppercase tracking-wide text-slate-600" style={{ borderColor: color }}>
        {label} <span className="font-normal text-slate-400">{cards.length}</span>
      </p>
      <div className="space-y-1">
        {cards.map((c, i) => <div key={i} className="truncate rounded bg-white px-1.5 py-1 text-[7px] font-medium text-ink shadow-sm ring-1 ring-slate-200/60">{c}</div>)}
      </div>
    </div>
  );
}

// Phone frame for portal replicas
export function Phone({ title, children, at = 0 }: { title: string; children: ReactNode; at?: number }) {
  return (
    <div className="tr-rise w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-50 shadow-xl" style={{ animationDelay: `${at}ms` }}>
      <div className="bg-slate-700 px-2 py-1 text-center"><span className="text-[6px] font-semibold uppercase tracking-widest text-white/70">{title}</span></div>
      <div className="space-y-1.5 p-1.5">{children}</div>
    </div>
  );
}

// Green success toast replica
export function Toast({ children, at = 0 }: { children: ReactNode; at?: number }) {
  return (
    <div className="tr-pop absolute left-1/2 top-2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 py-1 text-[8px] font-semibold text-white shadow-lg" style={{ animationDelay: `${at}ms` }}>
      {children}
    </div>
  );
}
