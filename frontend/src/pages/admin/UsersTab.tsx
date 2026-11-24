import React, { useCallback, useEffect, useState } from 'react';
import { getUsers, blockUser, transferUser, getDeptFlat } from '../../api';
import type { User, Department } from '../../types';

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [transfering, setTransfering] = useState<{userId: number; deptId: number | ''} | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ur, dr] = await Promise.all([getUsers(), getDeptFlat()]);
      setUsers(ur.data);
      setDepts(dr.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.position.toLowerCase().includes(search.toLowerCase()) ||
    (u.department_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleBlock = async (u: User) => {
    await blockUser(u.id, !u.is_blocked);
    setUsers(us => us.map(x => x.id === u.id ? { ...x, is_blocked: !x.is_blocked } : x));
  };

  const handleTransfer = async (userId: number, deptId: number) => {
    await transferUser(userId, deptId);
    setTransfering(null);
    load();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">👥 Xodimlar boshqaruvi</div>
        <div className="page-sub">{users.length} ta foydalanuvchi</div>
      </div>

      <input
        className="mb-3"
        placeholder="🔍 Qidirish..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {filtered.map(u => (
        <div key={u.id} className="card" style={{ marginBottom: 10 }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span style={{ fontWeight: 700 }}>{u.full_name}</span>
              {u.role === 'admin' && (
                <span className="badge badge-orange" style={{ marginLeft: 8 }}>Admin</span>
              )}
              {u.is_blocked && (
                <span className="badge badge-red" style={{ marginLeft: 8 }}>Bloklangan</span>
              )}
            </div>
            <span className={`badge ${u.reg_status === 'approved' ? 'badge-green' : u.reg_status === 'pending' ? 'badge-orange' : 'badge-red'}`}>
              {u.reg_status === 'approved' ? 'Tasdiqlangan' : u.reg_status === 'pending' ? 'Kutilmoqda' : 'Rad etilgan'}
            </span>
          </div>
          <div className="text-sm text-mute">💼 {u.position}</div>
          <div className="text-sm text-mute">🏢 {u.department_name ?? '—'}</div>
          {u.phone && <div className="text-sm text-mute">📞 {u.phone}</div>}

          {/* Transfer */}
          {transfering?.userId === u.id ? (
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <select
                value={transfering.deptId}
                onChange={e => setTransfering({ userId: u.id, deptId: Number(e.target.value) })}
                style={{ flex: 1 }}
              >
                <option value="">— Bo'lim tanlang —</option>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-sm"
                disabled={!transfering.deptId}
                onClick={() => transfering.deptId && handleTransfer(u.id, Number(transfering.deptId))}
              >
                ✓
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setTransfering(null)}>✕</button>
            </div>
          ) : (
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setTransfering({ userId: u.id, deptId: '' })}
              >
                🔄 Bo'lim o'zgartirish
              </button>
              <button
                className={`btn btn-sm ${u.is_blocked ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => handleBlock(u)}
              >
                {u.is_blocked ? '🔓 Blokdan chiqarish' : '🔒 Bloklash'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
