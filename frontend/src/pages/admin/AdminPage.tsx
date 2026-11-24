import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { MessagesSquare, UserPlus, Users, Megaphone, BarChart3 } from 'lucide-react';
import RequestsTab from './RequestsTab';
import UsersTab from './UsersTab';
import SvodkaTab from './SvodkaTab';
import BroadcastTab from './BroadcastTab';
import FeedPage from '../FeedPage';
import AppHeader from '../../components/ui/AppHeader';
import { getPendingRequests } from '../../api';

const NAV = [
  { path: '/admin/feed',      label: 'Lenta',     Icon: MessagesSquare },
  { path: '/admin/requests',  label: 'Arizalar',  Icon: UserPlus, badge: true },
  { path: '/admin/users',     label: 'Xodimlar',  Icon: Users },
  { path: '/admin/broadcast', label: 'Yuborish',  Icon: Megaphone },
  { path: '/admin/svodka',    label: 'Nazorat',   Icon: BarChart3 },
];

export default function AdminPage() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const load = () => getPendingRequests().then(r => setPending(r.data.length)).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <AppHeader subtitle="Administrator paneli">
        <nav className="admin-nav">
          {NAV.map(({ path, label, Icon, badge }) => (
            <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={17} />
              {label}
              {badge && pending > 0 && <span className="nav-badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>
      </AppHeader>

      <Routes>
        <Route path="/" element={<FeedPage embedded />} />
        <Route path="/feed" element={<FeedPage embedded />} />
        <Route path="/requests" element={<RequestsTab />} />
        <Route path="/users" element={<UsersTab />} />
        <Route path="/svodka" element={<SvodkaTab />} />
        <Route path="/broadcast" element={<BroadcastTab />} />
      </Routes>
    </>
  );
}
