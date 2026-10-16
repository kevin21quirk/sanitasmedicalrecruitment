import { ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';

// ---------- status colour maps ----------
export const STATUS_STYLES: Record<string, string> = {
  // candidate status
  compliant: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  on_assignment: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  dormant: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  do_not_use: 'bg-red-50 text-red-700 ring-red-600/20',
  // client status
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  prospect: 'bg-accent-500/10 text-accent-600 ring-accent-500/30',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  // doc status
  valid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  expiring: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  expired: 'bg-red-50 text-red-700 ring-red-600/20',
  pending: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  missing: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  // shift status
  booked: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-500/20',
  no_show: 'bg-red-50 text-red-700 ring-red-600/20',
  // timesheet
  not_submitted: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  submitted: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  queried: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  approved: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  sent: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  declined: 'bg-red-50 text-red-700 ring-red-600/20',
  // priority
  low: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  medium: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  high: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  urgent: 'bg-red-50 text-red-700 ring-red-600/20',
  // placement / vacancy stages
  open: 'bg-accent-500/10 text-accent-600 ring-accent-500/30',
  sourcing: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  shortlisted: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  interview: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  offer: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  filled: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  on_hold: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  lost: 'bg-red-50 text-red-700 ring-red-600/20',
  screening: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  compliance_check: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  placed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ended: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  // task
  in_progress_task: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

export const fmtStatus = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function Badge({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap',
      STATUS_STYLES[value] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20',
      className
    )}>
      {label ?? fmtStatus(value)}
    </span>
  );
}

// ---------- surfaces ----------
export function Card({ children, className, solid }: { children: ReactNode; className?: string; solid?: boolean }) {
  return (
    <div className={clsx('rounded-2xl', solid ? 'glass-strong' : 'glass', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4">
      <div>
        <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- avatars & photos ----------
export const photoUrl = (fileId?: number | null) => (fileId ? `/api/files/${fileId}/view` : null);

export function Avatar({ name, initials: init, color, size = 'md', photoId, className, square }: {
  name?: string; initials?: string | null; color?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; photoId?: number | null; className?: string; square?: boolean;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs',
    lg: 'h-14 w-14 text-lg', xl: 'h-24 w-24 text-2xl',
  };
  const text = init ?? (name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?');
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [photoId]);
  const src = broken ? null : photoUrl(photoId);
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white ring-2 ring-white/80',
        square ? 'rounded-xl' : 'rounded-full', sizes[size], className
      )}
      style={{ backgroundColor: color ?? '#1863dc' }}
      title={name}
    >
      {src ? <img src={src} alt={name ?? ''} className="h-full w-full object-cover" onError={() => setBroken(true)} /> : text}
    </span>
  );
}

// Click-to-upload avatar. Posts multipart `file` to `endpoint`, then calls onDone.
export function PhotoUpload({ endpoint, name, photoId, color, size = 'xl', square, onDone, disabled }: {
  endpoint: string; name?: string; photoId?: number | null; color?: string | null;
  size?: 'lg' | 'xl'; square?: boolean; onDone?: () => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api${endpoint}`, { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error || 'Upload failed');
    } else onDone?.();
    setBusy(false);
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => ref.current?.click()}
        className={clsx('photo-upload shrink-0 disabled:cursor-default', square ? 'rounded-xl' : 'rounded-full')}
        title="Change photo"
      >
        <Avatar name={name} photoId={photoId} color={color} size={size} square={square} />
        {!disabled && (
          <span className={clsx('photo-overlay', square ? 'rounded-xl' : 'rounded-full')}>
            {busy ? <span className="text-[10px] font-medium">Uploading…</span> : <Camera className="h-5 w-5" />}
          </span>
        )}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {err && <span className="max-w-40 text-center text-xs font-medium text-red-600">{err}</span>}
    </div>
  );
}

// ---------- loading / empty ----------
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-48 items-center justify-center gap-3 text-sm text-slate-500">
      <svg className="h-5 w-5 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600">{icon}</div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------- popups ----------
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

const MODAL_SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export function Modal({ open, onClose, title, subtitle, children, wide, size, footer, icon }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode;
  wide?: boolean; size?: keyof typeof MODAL_SIZES; footer?: ReactNode; icon?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  const sz = MODAL_SIZES[size ?? (wide ? 'lg' : 'md')];
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-950/35 p-3 backdrop-blur-sm animate-fade-in sm:p-6"
      onClick={onClose}
    >
      <div
        className={clsx('glass-pop mt-4 w-full rounded-3xl animate-pop-in sm:mt-12', sz)}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-6 py-4">
          <div className="flex items-start gap-3">
            {icon && <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">{icon}</span>}
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900/5 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// Right-hand slide-over for detail/allocation panels.
export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-xl', footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; width?: string; footer?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-950/35 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className={clsx('glass-pop flex h-full w-full flex-col animate-slide-in-right', width)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900/5 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- page chrome ----------
export function PageHeader({ title, subtitle, children, eyebrow }: {
  title: string; subtitle?: string; children?: ReactNode; eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-slide-up">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600/80">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-xl bg-slate-900/5 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors',
            value === t.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {t.label}
          {t.count != null && (
            <span className={clsx('rounded-full px-1.5 text-[10px] font-semibold',
              value === t.key ? 'bg-brand-500/10 text-brand-600' : 'bg-slate-900/5 text-slate-500')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, sub, tint }: {
  label: string; value: ReactNode; icon: React.ComponentType<{ className?: string }>; sub?: string; tint?: string;
}) {
  return (
    <Card className="p-4">
      <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl', tint ?? 'bg-brand-500/10 text-brand-600')}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </Card>
  );
}

export function ComplianceBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-900/10">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600">{score}%</span>
    </div>
  );
}

// ---------- data grid primitives ----------
export function SortTh({ label, col, sort, dir, onSort, className }: {
  label: string; col?: string; sort?: string; dir?: 'asc' | 'desc'; onSort?: (col: string) => void; className?: string;
}) {
  const sortable = !!col && !!onSort;
  const active = sortable && sort === col;
  return (
    <th className={clsx('px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500', className)}>
      {sortable ? (
        <button onClick={() => onSort!(col!)} className={clsx('inline-flex items-center gap-1 hover:text-ink', active && 'text-brand-600')}>
          {label}
          {active
            ? (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
            : <ArrowUpDown className="h-3 w-3 text-slate-300" />}
        </button>
      ) : label}
    </th>
  );
}

// A row of per-column filter inputs beneath the header (like the reference grid).
export function FilterTh({ value, onChange, options, placeholder = 'Search', className }: {
  value: string; onChange: (v: string) => void; options?: { value: string; label: string }[]; placeholder?: string; className?: string;
}) {
  const cls = 'w-full rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-[11px] text-ink placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15';
  return (
    <th className={clsx('px-3 py-1.5', className)}>
      {options ? (
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input className={cls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </th>
  );
}

export function Pagination({ page, pages, total, limit, onPage, onLimit, label = 'entries' }: {
  page: number; pages: number; total: number; limit: number;
  onPage: (p: number) => void; onLimit?: (n: number) => void; label?: string;
}) {
  const nums: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = start; i <= Math.min(pages, start + 4); i++) nums.push(i);
  const btn = 'inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 px-4 py-2.5">
      <p className="text-[11px] text-slate-500">
        {total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0'} {label}
      </p>
      <div className="flex items-center gap-3">
        {onLimit && (
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            Show
            <select value={limit} onChange={(e) => onLimit(+e.target.value)}
              className="rounded-md border border-slate-200/80 bg-white/70 px-1.5 py-0.5 text-[11px] focus:outline-none">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center gap-0.5">
          <button className={clsx(btn, 'text-slate-500 hover:bg-slate-900/5')} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></button>
          {nums.map((n) => (
            <button key={n} onClick={() => onPage(n)}
              className={clsx(btn, n === page ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-900/5')}>{n}</button>
          ))}
          <button className={clsx(btn, 'text-slate-500 hover:bg-slate-900/5')} disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

// Simple client-side helper for tables that load everything at once.
export function useLocalGrid<T>(rows: T[], opts: { pageSize?: number } = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(opts.pageSize ?? 10);
  const pages = Math.max(1, Math.ceil(rows.length / limit));
  const safePage = Math.min(page, pages);
  const slice = rows.slice((safePage - 1) * limit, safePage * limit);
  return { page: safePage, pages, limit, slice, setPage, setLimit: (n: number) => { setLimit(n); setPage(1); }, total: rows.length };
}

// ---------- form bits ----------
export const inputCls =
  'w-full rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-brand-500/25 hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/70 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnDanger =
  'inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50';

export function Field({ label, children, full, hint }: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <label className={clsx('block', full && 'col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}
