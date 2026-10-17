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
  .tr-sweep  { position: relative; overflow: hidden; }
  .tr-sweep::after { content:''; position:absolute; inset:0; transform:translateX(-100%);
    background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.22) 50%, transparent 70%);
    animation: tr-sweep 2.2s ease-in-out infinite; }
  .tr-stamp  { opacity: 0; transform: scale(1.7) rotate(-14deg); animation: tr-stamp .5s cubic-bezier(.16,1,.3,1) forwards; }
  .tr-blink  { animation: tr-blink 1.4s ease-in-out infinite; }
  .tr-dash   { stroke-dasharray: 6 6; animation: tr-dash 1s linear infinite; }
  .tr-row    { transition: transform .45s cubic-bezier(.16,1,.3,1), opacity .45s; }
  @keyframes tr-rise  { to { opacity:1; transform:translateY(0) } }
  @keyframes tr-left  { to { opacity:1; transform:translateX(0) } }
  @keyframes tr-pop   { to { opacity:1; transform:scale(1) } }
  @keyframes tr-grow  { to { transform:scaleY(1) } }
  @keyframes tr-sweep { to { transform:translateX(100%) } }
  @keyframes tr-stamp { 60% { opacity:1; transform:scale(.92) rotate(-8deg) } to { opacity:1; transform:scale(1) rotate(-8deg) } }
  @keyframes tr-blink { 0%,100% { opacity:1 } 50% { opacity:.35 } }
  @keyframes tr-dash  { to { stroke-dashoffset: -12 } }
  @media (prefers-reduced-motion: reduce) {
    .tr-rise,.tr-left,.tr-pop,.tr-grow,.tr-stamp { animation-duration:.01s }
    .tr-sweep::after,.tr-blink,.tr-dash { animation: none }
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
    <div className={`tr-left flex items-center justify-between gap-3 rounded-lg bg-white/8 px-3 py-2 ring-1 ring-white/10 ${tone ?? ''}`} style={d(i)}>
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
export function Chip({ children, tone = 'sky', i = 0, blink }: {
  children: ReactNode; i?: number; blink?: boolean;
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
    <span className={`tr-pop inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${tones[tone]} ${blink ? 'tr-blink' : ''}`} style={d(i, 300)}>
      {children}
    </span>
  );
}

// Rubber-stamp overlay (APPROVED / PAID / EXPORTED)
export function Stamp({ children, tone = 'emerald', delay = 1400 }: {
  children: ReactNode; tone?: 'emerald' | 'sky' | 'red'; delay?: number;
}) {
  const tones = { emerald: 'border-emerald-400 text-emerald-300', sky: 'border-sky-400 text-sky-300', red: 'border-red-400 text-red-300' };
  return (
    <span className={`tr-stamp pointer-events-none absolute right-4 top-3 rounded-md border-[3px] px-3 py-1 font-display text-lg font-black uppercase tracking-widest ${tones[tone]}`}
      style={{ animationDelay: `${delay}ms` }}>{children}</span>
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

// Mini browser/app panel frame
export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white/8 p-3 ring-1 ring-white/10 backdrop-blur-sm ${className}`}>
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

// Dark stage wrapper every scene renders inside
export function Stage({ children, caption }: { children: ReactNode; caption: ReactNode }) {
  return (
    <div className="tr-stage flex h-full flex-col">
      <div className="flex-1 overflow-hidden p-6 sm:p-8">{children}</div>
      <div className="border-t border-white/10 bg-black/25 px-6 py-3">
        <p className="text-center text-[13px] font-medium leading-snug text-sky-100/90">{caption}</p>
      </div>
    </div>
  );
}

export const delay = d;
