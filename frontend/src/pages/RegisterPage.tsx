import React, { useEffect, useState } from 'react';
import { getDeptFlat, register } from '../api';
import type { Department } from '../types';

interface Props {
  onRegistered: () => void;
}

export default function RegisterPage({ onRegistered }: Props) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [deptId, setDeptId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load departments (no auth needed for tree — we bypass via /api/v1/departments/flat)
    // Note: in DEV_MODE set DEV_TG_ID in localStorage first
    getDeptFlat().then(r => setDepts(r.data)).catch(() => {});
  }, []);

  const grouped = React.useMemo(() => {
    const parents = depts.filter(d => d.parent_id === null);
    const children = depts.filter(d => d.parent_id !== null);
    return { parents, children };
  }, [depts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !position.trim() || !deptId) {
      setError('Barcha majburiy maydonlarni to\'ldiring.');
      return;
    }
    setLoading(true); setError('');
    try {
      await register({ full_name: fullName, position, department_id: Number(deptId), phone: phone || undefined });
      setSubmitted(true);
      setTimeout(() => onRegistered(), 2000);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      setError(ax.response?.data?.detail || 'Xato yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Ariza yuborildi!</div>
          <div className="text-mute text-sm">Admin tasdiqlashini kuting.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      <div className="page-header">
        <div style={{ fontSize: 28, marginBottom: 8 }}>🏗️</div>
        <div className="page-title">ЙХБ Tizimiga Kirish</div>
        <div className="page-sub">Ro'yxatdan o'tish uchun ma'lumotlaringizni kiriting</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">F.I.Sh. *</label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Ismingiz Familiyangiz"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Lavozim *</label>
          <input
            value={position}
            onChange={e => setPosition(e.target.value)}
            placeholder="Muhandis, Mas'ul xodim..."
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Bo'lim / Quyi bo'linma *</label>
          <select value={deptId} onChange={e => setDeptId(Number(e.target.value))} required>
            <option value="">— Tanlang —</option>
            {grouped.parents.map(p => (
              <optgroup key={p.id} label={p.name}>
                {/* If parent itself is selectable (no children) */}
                {grouped.children.filter(c => c.parent_id === p.id).length === 0 && (
                  <option value={p.id}>{p.name}</option>
                )}
                {grouped.children
                  .filter(c => c.parent_id === p.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Telefon raqami (ixtiyoriy)</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998901234567"
          />
        </div>

        {error && <div className="form-error mb-3">{error}</div>}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? '⏳ Yuborilmoqda...' : '📤 Ariza yuborish'}
        </button>
      </form>
    </div>
  );
}
