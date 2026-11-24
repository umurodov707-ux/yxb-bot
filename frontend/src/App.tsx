import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider, useAuth } from './hooks/useAuth';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import AdminPage from './pages/admin/AdminPage';
import PendingPage from './pages/PendingPage';
import { EmployeeHome } from './pages/DeptHome';
import UnitsInbox from './pages/UnitsInbox';
import AppHeader from './components/ui/AppHeader';
import { useParams } from 'react-router-dom';

function UserDeptFeed() {
  const { deptId } = useParams();
  return <FeedPage key={deptId} fixedDeptId={Number(deptId)} backTo="/" />;
}

function HeadInbox() {
  const { user } = useAuth();
  if (!user?.is_dept_head || !user.department_id) return <Navigate to="/" replace />;
  return (
    <>
      <AppHeader />
      <UnitsInbox deptId={user.department_id} base="/inbox" backTo="/" />
    </>
  );
}

function HeadThread() {
  const { user } = useAuth();
  const { unitId } = useParams();
  if (!user?.is_dept_head || !user.department_id) return <Navigate to="/" replace />;
  return <FeedPage key={unitId} fixedDeptId={user.department_id} threadUnitId={Number(unitId)} backTo="/inbox" />;
}

function HeadGeneral() {
  const { user } = useAuth();
  if (!user?.department_id) return <Navigate to="/" replace />;
  return <FeedPage fixedDeptId={user.department_id} backTo="/inbox" />;
}

function AppRoutes() {
  const { user, loading, error, refetch } = useAuth();

  if (loading) return <div className="spinner" />;

  if (!user && error === 'not_registered') {
    return (
      <Routes>
        <Route path="*" element={<RegisterPage onRegistered={refetch} />} />
      </Routes>
    );
  }
  if (!user && error === 'pending') return <PendingPage status="pending" />;
  if (!user && error === 'rejected') return <PendingPage status="rejected" />;
  if (!user) return <PendingPage status="error" />;
  if (user.reg_status === 'pending') return <PendingPage status="pending" />;
  if (user.reg_status === 'rejected') return <PendingPage status="rejected" />;

  return (
    <Routes>
      {user.role === 'admin' ? (
        <>
          <Route path="/" element={<Navigate to="/admin/feed" replace />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="/feed" element={<FeedPage />} />
        </>
      ) : (
        <>
          <Route path="/" element={<EmployeeHome />} />
          <Route path="/d/:deptId" element={<UserDeptFeed />} />
          <Route path="/inbox" element={<HeadInbox />} />
          <Route path="/inbox/general" element={<HeadGeneral />} />
          <Route path="/inbox/:unitId" element={<HeadThread />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

export default function App() {
  const authState = useAuthProvider();
  return (
    <AuthContext.Provider value={authState}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
