import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider, useAuth } from './hooks/useAuth';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import AdminPage from './pages/admin/AdminPage';
import PendingPage from './pages/PendingPage';

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
          <Route path="/" element={<Navigate to="/admin/requests" replace />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="/feed" element={<FeedPage />} />
        </>
      ) : (
        <>
          <Route path="/" element={<FeedPage />} />
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
