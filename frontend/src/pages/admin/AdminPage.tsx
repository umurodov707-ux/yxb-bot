import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useParams } from 'react-router-dom';
import { AdminDeptHome, DeptGroupPage } from '../DeptHome';
import { MessagesSquare, UserPlus, Users, Megaphone, BarChart3, ClipboardCheck } from 'lucide-react';
import { AdminTasks, AdminTaskDetail } from '../TasksPages';
import RequestsTab from './RequestsTab';
import UsersTab from './UsersTab';
import SvodkaTab from './SvodkaTab';
import BroadcastTab from './BroadcastTab';
import FeedPage from '../FeedPage';
import UnitsInbox from '../UnitsInbox';
import AppHeader from '../../components/ui/AppHeader';
import { getPendingRequests, getDeptSummary, getTasks } from '../../api';

const NAV = [
  { path: '/admin/feed',      label: 'Lenta',     Icon: MessagesSquare, badge: 'unread' },
  { path: '/admin/tasks',     label: 'Ijro',      Icon: ClipboardCheck, badge: 'tasks' },
  { path: '/admin/requests',  label: 'Arizalar',  Icon: UserPlus, badge: 'pending' },
  { path: '/admin/users',     label: 'Xodimlar',  Icon: Users },
  { path: '/admin/broadcast', label: 'Yuborish',  Icon: Megaphone },
  { path: '/admin/svodka',    label: 'Nazorat',   Icon: BarChart3 },
];

function DeptFeed() {
  const { deptId } = useParams();
  return <FeedPage key={deptId} embedded fixedDeptId={Number(deptId)} />;
}

function AdminUnits() {
  const { deptId } = useParams();
  const id = Number(deptId);
  return <UnitsInbox key={id} admin deptId={id} base={`/admin/feed/${id}/units`} backTo={`/admin/feed/${id}`} />;
}

function AdminThread() {
  const { deptId, unitId } = useParams();
  const id = Number(deptId);
  return (
    <FeedPage key={`${id}-${unitId}`} embedded fixedDeptId={id} threadUnitId={Number(unitId)}
              backTo={`/admin/feed/${id}/units`} />
  );
}

function AdminGeneral() {
  const { deptId } = useParams();
  const id = Number(deptId);
  return <FeedPage key={`g-${id}`} embedded fixedDeptId={id} backTo={`/admin/feed/${id}/units`} />;
}

export default function AdminPage() {
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const [toReview, setToReview] = useState(0);

  useEffect(() => {
    const load = () => {
      getPendingRequests().then(r => setPending(r.data.length)).catch(() => {});
      getDeptSummary().then(r => setUnread(r.data.reduce((n, d) => n + d.unread, 0))).catch(() => {});
      getTasks().then(r => setToReview(r.data.reduce((n, t) => n + (t.submitted ?? 0), 0))).catch(() => {});
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
              {badge === 'tasks' && toReview > 0 && <span className="nav-badge">{toReview}</span>}
            </NavLink>
          ))}
        </nav>
      </AppHeader>

      <Routes>
        <Route path="/" element={<AdminDeptHome />} />
        <Route path="/feed" element={<AdminDeptHome />} />
        <Route path="/feed/g/:code" element={<DeptGroupPage />} />
        <Route path="/feed/:deptId" element={<DeptFeed />} />
        <Route path="/feed/:deptId/units" element={<AdminUnits />} />
        <Route path="/feed/:deptId/units/general" element={<AdminGeneral />} />
        <Route path="/feed/:deptId/units/:unitId" element={<AdminThread />} />
        <Route path="/all" element={<FeedPage embedded />} />
        <Route path="/tasks" element={<AdminTasks />} />
        <Route path="/tasks/:taskId" element={<AdminTaskDetail />} />
        <Route path="/requests" element={<RequestsTab />} />
        <Route path="/users" element={<UsersTab />} />
        <Route path="/svodka" element={<SvodkaTab />} />
        <Route path="/broadcast" element={<BroadcastTab />} />
      </Routes>
    </>
  );
}
