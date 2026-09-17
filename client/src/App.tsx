import { NavLink, Route, Routes } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, Briefcase,
  CalendarDays, ShieldCheck, Inbox, BarChart3, Search, Bell, Clock3,
} from 'lucide-react';
import clsx from 'clsx';

import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import CandidateDetail from './pages/CandidateDetail';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Vacancies from './pages/Vacancies';
import VacancyDetail from './pages/VacancyDetail';
import Placements from './pages/Placements';
import ShiftsCalendar from './pages/ShiftsCalendar';
import Timesheets from './pages/Timesheets';
import Compliance from './pages/Compliance';
import InboxPage from './pages/Inbox';
import Reports from './pages/Reports';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/clients', label: 'Care Homes', icon: Building2 },
  { to: '/vacancies', label: 'Vacancies', icon: KanbanSquare },
  { to: '/placements', label: 'Placements', icon: Briefcase },
  { to: '/shifts', label: 'Shift Calendar', icon: CalendarDays },
  { to: '/timesheets', label: 'Timesheets', icon: Clock3 },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { to: '/inbox', label: 'Communications', icon: Inbox },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 font-display text-lg font-bold text-white ring-1 ring-white/20">
        S
      </span>
      <div className="leading-tight">
        <p className="font-display text-[15px] font-bold tracking-wide text-white">SANITAS</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-brand-200">Medical Recruitment</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950">
        <Logo />
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white shadow-inner'
                    : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-300">Sanitas CRM v1.0</p>
          <p className="mt-0.5 text-[11px] text-brand-200">0800 999 8222</p>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search candidates, clients, vacancies…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (e.target as HTMLInputElement).value;
                  if (q) window.location.href = `/candidates?search=${encodeURIComponent(q)}`;
                }
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/compliance" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell className="h-4.5 w-4.5" />
            </NavLink>
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">SM</span>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-ink">Sarah Mitchell</p>
                <p className="text-[10px] text-slate-500">Director</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">
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
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
