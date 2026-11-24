import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useParams } from 'react-router-dom';
import DeptListPage from './DeptListPage';
import { MessagesSquare, UserPlus, Users, Megaphone, BarChart3 } from 'lucide-react';
import RequestsTab from './RequestsTab';
import UsersTab from './UsersTab';
import SvodkaTab from './SvodkaTab';
import BroadcastTab from './BroadcastTab';
import FeedPage from '../FeedPage';
import AppHeader from '../../components/ui/AppHeader';
import { getPendingRequests, getDeptSummary } from '../../api';

const NAV = [
  { path: '/admin/feed',      label: 'Lenta',     Icon: MessagesSquare, badge: 'unread' },
  { path: '/admin/requests',  label: 'Arizalar',  Icon: UserPlus, badge: 'pending' },
  { path: '/admin/users',     label: 'Xodimlar',  Icon: Users },
  { path: '/admin/broadcast', label: 'Yuborish',  Icon: Megaphone },
  { path: '/admin/svodka',    label: 'Nazorat',   Icon: BarChart3 },
];

function DeptFeed() {
  const { deptId } = useParams();
  return <FeedPage key={deptId} embedded fixedDeptId={Number(deptId)} />;
}

export default function AdminPage() {
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () => {
      getPendingRequests().then(r => setPending(r.data.length)).catch(() => {});
      getDeptSummary().then(r => setUnread(r.data.reduce((n, d) => n + d.unread, 0))).catch(() => {});
    };
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
              {badge === 'pending' && pending > 0 && <span className="nav-badge">{pending}</span>}
              {badge === 'unread' && unread > 0 && <span className="nav-badge">{unread}</span>}
            </NavLink>
          ))}
        </nav>
      </AppHeader>

      <Routes>
        <Route path="/" element={<DeptListPage />} />
        <Route path="/feed" element={<DeptListPage />} />
        <Route path="/feed/:deptId" element={<DeptFeed />} />
        <Route path="/all" element={<FeedPage embedded />} />
        <Route path="/requests" element={<RequestsTab />} />
        <Route path="/users" element={<UsersTab />} />
        <Route path="/svodka" element={<SvodkaTab />} />
        <Route path="/broadcast" element={<BroadcastTab />} />
      </Routes>
    </>
  );
}
