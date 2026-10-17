import { useState, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, Briefcase,
  CalendarDays, ShieldCheck, Inbox, BarChart3, Search, Bell, Clock3, Menu, X, LogOut, ClipboardList, PoundSterling, Settings2, PlugZap,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { AuthProvider, useAuth } from './lib/auth';
import { api } from './lib/api';
import { Avatar } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import SignPage from './pages/SignPage';
import Portal from './pages/portal/Portal';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import CandidateDetail from './pages/CandidateDetail';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Vacancies from './pages/Vacancies';
import VacancyDetail from './pages/VacancyDetail';
import Placements from './pages/Placements';
import ShiftsCalendar from './pages/ShiftsCalendar';
import Requests from './pages/Requests';
import Neuven from './pages/Neuven';
import Timesheets from './pages/Timesheets';
import Invoices from './pages/Invoices';
import Compliance from './pages/Compliance';
import ComplianceFile from './pages/ComplianceFile';
import InvoicePrint from './pages/InvoicePrint';
import InboxPage from './pages/Inbox';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; beta?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/clients', label: 'Care Homes', icon: Building2 },
  { to: '/vacancies', label: 'Vacancies', icon: KanbanSquare },
  { to: '/placements', label: 'Placements', icon: Briefcase },
  { to: '/shifts', label: 'Shift Calendar', icon: CalendarDays },
  { to: '/requests', label: 'Requests', icon: ClipboardList },
  { to: '/neuven', label: 'Neuven', icon: PlugZap, beta: true },
  { to: '/timesheets', label: 'Timesheets', icon: Clock3 },
  { to: '/invoices', label: 'Invoicing', icon: PoundSterling },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { to: '/inbox', label: 'Communications', icon: Inbox },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

function Logo() {
  return (
    <div className="px-4 pt-5 pb-4">
      <div className="flex items-center justify-center rounded-2xl bg-white/95 px-3 py-2.5 shadow-sm ring-1 ring-white/60">
        <img src="/sanitaslogo.png" alt="Sanitas Medical Recruitment" className="h-10 w-auto" />
      </div>
    </div>
  );
}

const NAV_GROUPS: { label: string; items: typeof NAV }[] = [
  { label: 'Overview', items: NAV.filter((n) => ['/'].includes(n.to)) },
  { label: 'Recruitment', items: NAV.filter((n) => ['/candidates', '/clients', '/vacancies', '/placements'].includes(n.to)) },
  { label: 'Operations', items: NAV.filter((n) => ['/shifts', '/requests', '/neuven', '/timesheets', '/invoices', '/compliance'].includes(n.to)) },
  { label: 'Workspace', items: NAV.filter((n) => ['/inbox', '/reports', '/settings'].includes(n.to)) },
];

function StaffApp() {
  const [navOpen, setNavOpen] = useState(false);
  const { account, logout } = useAuth();
  const location = useLocation();

  // Close the drawer whenever the route changes
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  const initials = account?.initials ??
    (account?.name ? account.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?');

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-brand-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — off-canvas drawer on mobile, fixed rail on desktop */}
      <aside className={clsx(
        'glass-dark fixed inset-y-0 left-0 z-40 flex w-60 flex-col transition-transform duration-200 ease-out',
        navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="relative">
          <Logo />
          <button
            onClick={() => setNavOpen(false)}
            className="absolute right-3 top-6 rounded-lg p-1.5 text-brand-200 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="scroll-thin flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-200/60">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map(({ to, label, icon: Icon, end, beta }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      clsx(
                        'group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all',
                        isActive
                          ? 'bg-white/15 text-white shadow-inner ring-1 ring-white/15'
                          : 'text-brand-100/75 hover:bg-white/8 hover:text-white'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                    {beta && (
                      <span className="ml-auto rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-inset ring-amber-400/30">Beta</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-300">Sanitas Ops v2.0</p>
          <p className="mt-0.5 text-[11px] text-brand-200">0800 999 8222</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-60">
        <header className="glass sticky top-0 z-20 flex h-14 items-center justify-between gap-3 !rounded-none !border-x-0 !border-t-0 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <img src="/sanitaslogo.png" alt="Sanitas" className="h-6 w-auto lg:hidden" />
            <div className="relative hidden w-80 max-w-full sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search candidates, clients, vacancies…"
                className="w-full rounded-xl border border-slate-200/70 bg-white/60 py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = (e.target as HTMLInputElement).value;
                    if (q) window.location.href = `/candidates?search=${encodeURIComponent(q)}`;
                  }
                }}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NavLink to="/compliance" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell className="h-4.5 w-4.5" />
            </NavLink>
            <div className="flex items-center gap-2.5 border-l border-slate-200/70 pl-3">
              <NavLink to="/settings" title="My profile">
                <Avatar name={account?.name} initials={initials} color={account?.color} photoId={account?.photoFileId} size="sm" />
              </NavLink>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-semibold text-ink">{account?.name}</p>
                <p className="text-[10px] capitalize text-slate-500">{account?.accessRole || 'staff'}</p>
              </div>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 animate-fade-in" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidates/:id" element={<CandidateDetail />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/vacancies" element={<Vacancies />} />
            <Route path="/vacancies/:id" element={<VacancyDetail />} />
            <Route path="/placements" element={<Placements />} />
            <Route path="/shifts" element={<ShiftsCalendar />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/neuven" element={<Neuven />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// Forced password change when an account was created/reset by staff (must_reset).
function ForceReset() {
  const { account, logout, refresh } = useAuth();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.next !== f.confirm) return setErr('New passwords do not match');
    if (f.next.length < 8) return setErr('Password must be at least 8 characters');
    setBusy(true); setErr('');
    try {
      await api.post('/auth/change-password', { current: f.current, next: f.next });
      await refresh();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Failed'); setBusy(false); }
  };
  const inp = 'w-full rounded-xl border border-slate-300/60 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="glass-pop w-full max-w-sm rounded-3xl p-7 animate-pop-in">
        <img src="/sanitaslogo.png" alt="Sanitas" className="h-9 w-auto" />
        <h1 className="mt-4 font-display text-xl font-semibold">Set your password</h1>
        <p className="mt-1 text-xs text-slate-500">
          {account?.name}, your password was set by the office — choose a new one to continue.
        </p>
        <div className="mt-4 space-y-3">
          <input className={inp} type="password" placeholder="Temporary password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
          <input className={inp} type="password" placeholder="New password (min 8 chars)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
          <input className={inp} type="password" placeholder="Confirm new password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        </div>
        <button className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" disabled={busy}>
          {busy ? 'Saving…' : 'Set password & continue'}
        </button>
        <button type="button" onClick={logout} className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600">Sign out</button>
      </form>
    </div>
  );
}

function Gate() {
  const { account, loading } = useAuth();
  const location = useLocation();

  // Public routes don't need an account.
  if (location.pathname.startsWith('/register') || location.pathname.startsWith('/sign/')) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/register/:token" element={<Register />} />
        <Route path="/sign/:token" element={<SignPage />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (!account) return <Login />;
  if (account.mustReset) return <ForceReset />;
  if (account.kind !== 'staff') return <Portal account={account} />;
  // Printable documents render without the app shell (2.11)
  if (/^\/candidates\/\d+\/file$/.test(location.pathname) || /^\/invoices\/\d+\/print$/.test(location.pathname)) {
    return (
      <Routes>
        <Route path="/candidates/:id/file" element={<ComplianceFile />} />
        <Route path="/invoices/:id/print" element={<InvoicePrint />} />
      </Routes>
    );
  }
  return <StaffApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
