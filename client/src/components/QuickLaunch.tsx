import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Building2, ClipboardList, CalendarCheck, Clock3, ShieldAlert, LayoutDashboard, Zap, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from './ui';
import type { VizKey } from './charts';

// Six-button launcher shown once per sign-in so office staff can jump
// straight into a job without navigating the dashboard first.
const ACTIONS: { label: string; hint: string; to: string; icon: LucideIcon; tint: VizKey }[] = [
  { label: 'Create worker', hint: 'Register a new nurse, HCA or support worker', to: '/candidates?new=1', icon: UserPlus, tint: 'brand' },
  { label: 'Create care home', hint: 'Add a new client site and contacts', to: '/clients?new=1', icon: Building2, tint: 'accent' },
  { label: 'New shift request', hint: 'Log a request from a care home', to: '/requests?new=1&tab=requests', icon: ClipboardList, tint: 'violet' },
  { label: 'Allocate shifts', hint: 'Match open requests to available workers', to: '/requests?tab=requests', icon: CalendarCheck, tint: 'mint' },
  { label: 'Outstanding timesheets', hint: 'Submitted timesheets awaiting approval', to: '/timesheets?status=submitted', icon: Clock3, tint: 'amber' },
  { label: 'Compliance alerts', hint: 'Expired and expiring documents', to: '/compliance', icon: ShieldAlert, tint: 'coral' },
];

const SEEN_KEY = 'sanitas.quicklaunch.seen';   // sessionStorage: shown once per sign-in
const OFF_KEY = 'sanitas.quicklaunch.off';     // localStorage: user opted out

export function useQuickLaunch(accountId?: number) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!accountId) return;
    const seen = sessionStorage.getItem(SEEN_KEY) === String(accountId);
    const off = localStorage.getItem(OFF_KEY) === '1';
    if (!seen && !off) setOpen(true);
    sessionStorage.setItem(SEEN_KEY, String(accountId));
  }, [accountId]);
  return { open, setOpen };
}

export function QuickLaunchButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Quick launch" aria-label="Quick launch"
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-500/15 transition-colors hover:bg-brand-500/15">
      <Zap className="h-4 w-4" /><span className="hidden md:inline">Quick launch</span>
    </button>
  );
}

export function QuickLaunch({ open, onClose, name }: { open: boolean; onClose: () => void; name?: string }) {
  const navigate = useNavigate();
  const [off, setOff] = useState(() => localStorage.getItem(OFF_KEY) === '1');
  const go = (to: string) => { onClose(); navigate(to); };
  const toggleOff = (v: boolean) => { setOff(v); localStorage.setItem(OFF_KEY, v ? '1' : '0'); };
  const first = name?.split(' ')[0];
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={<Zap className="h-4.5 w-4.5" />}
      title={first ? `Welcome back, ${first}` : 'Quick launch'} subtitle="Where do you want to start? Pick a job to jump straight in."
      footer={<>
        <label className="mr-auto flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" checked={off} onChange={(e) => toggleOff(e.target.checked)} />
          Don't show this when I sign in
        </label>
        <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-900/5">
          <LayoutDashboard className="h-4 w-4" /> Go to dashboard
        </button>
      </>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ label, hint, to, icon: Icon, tint }) => (
          <button key={to} onClick={() => go(to)}
            className={clsx('tile group flex flex-col items-start gap-3 rounded-2xl bg-white/60 p-4 text-left ring-1 ring-white/80 transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-lg hover:shadow-brand-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', `tile-${tint}`)}>
            <span className="tile-band flex h-11 w-11 items-center justify-center rounded-xl"><Icon className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
