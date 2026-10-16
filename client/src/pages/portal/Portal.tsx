import { ReactNode, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { LogOut, Menu, X, LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth, Account } from '../../lib/auth';
import { Avatar } from '../../components/ui';
import WorkerPortal from './WorkerPortal';
import ClientPortal from './ClientPortal';
import SupervisorPortal from './SupervisorPortal';

export interface PortalPage {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function PortalShell({ title, pages, children }: {
  title: string; pages: PortalPage[]; children?: ReactNode;
}) {
  const { account, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-20 !rounded-none !border-x-0 !border-t-0">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <img src="/sanitaslogo.png" alt="Sanitas" className="h-7 w-auto" />
            <span className="hidden text-xs font-medium text-slate-500 sm:block">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={account?.name} photoId={account?.photoFileId} size="sm" />
            <span className="hidden text-xs font-medium text-ink sm:block">{account?.name}</span>
            <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-900/5" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
            <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-900/5 sm:hidden">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav className={clsx('mx-auto max-w-3xl gap-1 px-4 pb-2 sm:flex', open ? 'flex flex-col' : 'hidden')}>
          {pages.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium',
                isActive ? 'bg-brand-500/10 text-brand-700' : 'text-slate-500 hover:bg-slate-900/5 hover:text-slate-700'
              )}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 animate-fade-in">{children}</main>
    </div>
  );
}

export default function Portal({ account }: { account: Account }) {
  if (account.kind === 'worker') return <WorkerPortal />;
  if (account.kind === 'client') return <ClientPortal />;
  if (account.kind === 'supervisor') return <SupervisorPortal />;
  return <Routes><Route path="*" element={<p className="p-8 text-sm text-slate-500">Unknown account type.</p>} /></Routes>;
}
