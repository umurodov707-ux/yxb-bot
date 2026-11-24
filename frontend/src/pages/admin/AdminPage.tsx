import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import RequestsTab from './RequestsTab';
import UsersTab from './UsersTab';
import SvodkaTab from './SvodkaTab';
import BroadcastTab from './BroadcastTab';
import FeedPage from '../FeedPage';

const NAV = [
  { path: '/admin/requests', label: '📋 Arizalar' },
  { path: '/admin/users',    label: '👥 Xodimlar' },
  { path: '/admin/svodka',   label: '📊 Nazorat' },
  { path: '/admin/broadcast',label: '📢 Yuborish' },
  { path: '/feed',           label: '📂 Lenta' },
];

export default function AdminPage() {
  return (
    <div>
      {/* Top nav */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 16px', display: 'flex', overflowX: 'auto', gap: 4,
      }}>
        {NAV.map(n => (
          <NavLink
            key={n.path}
            to={n.path}
            style={({ isActive }) => ({
              padding: '12px 14px', fontSize: 13, fontWeight: 600,
              color: isActive ? 'var(--accent)' : 'var(--text-mute)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              whiteSpace: 'nowrap', textDecoration: 'none',
            })}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<RequestsTab />} />
        <Route path="/requests" element={<RequestsTab />} />
        <Route path="/users" element={<UsersTab />} />
        <Route path="/svodka" element={<SvodkaTab />} />
        <Route path="/broadcast" element={<BroadcastTab />} />
      </Routes>
    </div>
  );
}
