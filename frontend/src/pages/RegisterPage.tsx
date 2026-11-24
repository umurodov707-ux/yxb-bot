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
    <div className="page" style={{ paddingTop: 20, maxWidth: 440 }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <img 
            src="/logo.jpg" 
            alt="ЙХБ Logo" 
            style={{ 
              width: 105, 
              height: 105, 
              borderRadius: '50%', 
              objectFit: 'cover',
              boxShadow: '0 8px 24px rgba(79, 142, 247, 0.35)',
              border: '3px solid rgba(255, 215, 0, 0.6)'
            }} 
          />
        </div>
        <div className="page-title" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.3px', background: 'linear-gradient(135deg, #fff 30%, #a5c4ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          TEMIRYO‘LINFRATUZILMA AJ
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#4f8ef7', marginTop: 2, marginBottom: 6 }}>
          Yo‘l xo‘jaligi boshqarmasi
        </div>
        <div className="page-sub" style={{ fontSize: 13, color: '#8b94b2' }}>
          Tizimga kirish uchun xodim arizasini to‘ldiring
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>👤 F.I.Sh. (To‘liq ism) *</label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Masalan: Karimov Anvar Ravshanovich"
            required
            style={{ borderRadius: 8, padding: '11px 14px' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>💼 Lavozim *</label>
          <input
            value={position}
            onChange={e => setPosition(e.target.value)}
            placeholder="Muhandis, Bosh mutaxassis..."
            required
            style={{ borderRadius: 8, padding: '11px 14px' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>🏢 Bo‘lim / Quyi bo‘linma *</label>
          <select 
            value={deptId} 
            onChange={e => setDeptId(e.target.value ? Number(e.target.value) : '')} 
            required
            style={{ borderRadius: 8, padding: '11px 14px', cursor: 'pointer' }}
          >
            <option value="">— Bo‘limni tanlang —</option>
            {grouped.parents.map(p => {
              const ch = grouped.children.filter(c => c.parent_id === p.id);
              if (ch.length === 0) {
                return (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                );
              }
              return (
                <optgroup key={p.id} label={`📂 ${p.name}`}>
                  <option value={p.id}>• {p.name} (Bosh apparat)</option>
                  {ch.map(c => (
                    <option key={c.id} value={c.id}>
                      &nbsp;&nbsp;↳ {c.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>📱 Telefon raqami (ixtiyoriy)</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998901234567"
            style={{ borderRadius: 8, padding: '11px 14px' }}
          />
        </div>

        {error && (
          <div style={{ 
            color: '#ff6b6b', 
            fontSize: 13, 
            marginBottom: 12, 
            padding: '8px 12px', 
            background: 'rgba(255,107,107,0.12)', 
            borderRadius: 6,
            border: '1px solid rgba(255,107,107,0.25)' 
          }}>
            ⚠️ {error}
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '13px', 
            borderRadius: 8, 
            fontWeight: 700, 
            fontSize: 15,
            boxShadow: '0 4px 15px rgba(79, 142, 247, 0.4)',
            marginTop: 8
          }}
        >
          {loading ? '⏳ Yuborilmoqda...' : '🚀 Arizani yuborish'}
        </button>
      </form>
    </div>
  );
}
