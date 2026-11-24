import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import RequestsTab from './RequestsTab';
import UsersTab from './UsersTab';
import SvodkaTab from './SvodkaTab';
import BroadcastTab from './BroadcastTab';
import FeedPage from '../FeedPage';

const NAV = [
  { path: '/admin/feed',      label: '💬 Chat / Lenta' },
  { path: '/admin/requests',  label: '📋 Arizalar' },
  { path: '/admin/users',     label: '👥 Xodimlar' },
  { path: '/admin/broadcast', label: '📢 Yuborish' },
  { path: '/admin/svodka',    label: '📊 Nazorat' },
];

export default function AdminPage() {
  return (
    <div>
      {/* Top nav */}
      <nav style={{
        background: '#1a1d27', borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 12px', display: 'flex', overflowX: 'auto', gap: 6,
      }}>
        {NAV.map(n => (
          <NavLink
            key={n.path}
            to={n.path}
            style={({ isActive }) => ({
              padding: '12px 14px', fontSize: 13, fontWeight: 700,
              color: isActive ? '#38bdf8' : '#94a3b8',
              borderBottom: isActive ? '3px solid #38bdf8' : '3px solid transparent',
              whiteSpace: 'nowrap', textDecoration: 'none',
              transition: 'all 0.2s',
            })}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/requests" element={<RequestsTab />} />
        <Route path="/users" element={<UsersTab />} />
        <Route path="/svodka" element={<SvodkaTab />} />
        <Route path="/broadcast" element={<BroadcastTab />} />
      </Routes>
    </div>
  );
}
