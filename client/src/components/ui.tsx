import { ReactNode } from 'react';
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
  approved: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
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

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, initials: init, color, size = 'md' }: {
  name?: string; initials?: string | null; color?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-lg' };
  const text = init ?? (name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?');
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', sizes[size])}
      style={{ backgroundColor: color ?? '#1863dc' }}
      title={name}
    >
      {text}
    </span>
  );
}

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

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">{icon}</div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-950/40 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className={clsx('mt-4 w-full rounded-2xl bg-white shadow-2xl sm:mt-10', wide ? 'max-w-3xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function ComplianceBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600">{score}%</span>
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 transition-colors';
export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors';
