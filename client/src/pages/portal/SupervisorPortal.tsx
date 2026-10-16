import { Route, Routes } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { PortalShell } from './Portal';
import { SiteRota } from './ClientPortal';

const PAGES = [
  { to: '/', label: 'Site rota', icon: CalendarDays, end: true },
];

// View-only supervisors (5.1-5.4): today's/this week's rota, printable for the wall.
export default function SupervisorPortal() {
  return (
    <PortalShell title="Site supervisor" pages={PAGES}>
      <Routes>
        <Route path="/" element={<SiteRota />} />
      </Routes>
    </PortalShell>
  );
}
