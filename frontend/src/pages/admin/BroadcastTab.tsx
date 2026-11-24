import React, { useEffect, useRef, useState } from 'react';
import { getDeptFlat, broadcastRecord } from '../../api';
import type { Department, RecordType } from '../../types';

export default function BroadcastTab() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<RecordType>('broadcast');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDeptFlat().then(r => setDepts(r.data));
  }, []);

  // Children departments (ПЧ-* and ПМС-*)
  const pcChildren = depts.filter(d =>
    depts.some(p => p.id === d.parent_id && p.code === 'PC')
  );
  const pmsChildren = depts.filter(d =>
    depts.some(p => p.id === d.parent_id && p.code === 'PMS')
  );

  const toggleAll = (list: Department[]) => {
    const ids = list.map(d => d.id);
    const allSelected = ids.every(id => selected.has(id));
    const next = new Set(selected);
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
    setSelected(next);
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selected.size === 0) {
      setError('Sarlavha va kamida 1 ta bo\'lim tanlang.');
      return;
    }
    setLoading(true); setError(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('body', body);
      fd.append('record_type', type);
      fd.append('department_ids', Array.from(selected).join(','));
      files.forEach(f => fd.append('files', f));
      const res = await broadcastRecord(fd);
      setSuccess(`✅ ${res.data.length} ta bo'limga yuborildi.`);
      setTitle(''); setBody(''); setFiles([]); setSelected(new Set());
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      setError(ax.response?.data?.detail || 'Xato yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const DeptGroup = ({ list, label }: { list: Department[]; label: string }) => (
    <div style={{ marginBottom: 12 }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="section-title" style={{ marginBottom: 0 }}>{label}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => toggleAll(list)}
        >
          {list.every(d => selected.has(d.id)) ? 'Barchasini olib tashlash' : 'Barchasini tanlash'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => toggleOne(d.id)}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '1px solid',
              borderColor: selected.has(d.id) ? 'var(--accent)' : 'var(--border)',
              background: selected.has(d.id) ? 'rgba(79,142,247,.18)' : 'var(--surface2)',
              color: selected.has(d.id) ? 'var(--accent)' : 'var(--text-mute)',
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}
          >
            {d.name}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">📢 Ko'p bo'limga yuborish</div>
        <div className="page-sub">Telegramma, prikas yoki boshqa umumiy xabar</div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Bo'limlar tanlov */}
        <div className="card mb-3">
          <DeptGroup list={pcChildren} label="ПЧ bo'linmalari" />
          <DeptGroup list={pmsChildren} label="ПМС / ОПМС bo'linmalari" />
          <div className="text-sm" style={{ color: 'var(--accent)', marginTop: 4 }}>
            {selected.size} ta bo'lim tanlandi
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tur</label>
          <select value={type} onChange={e => setType(e.target.value as RecordType)}>
            <option value="broadcast">Telegramma / Prikas</option>
            <option value="urgent">Shoshilinch xabar</option>
            <option value="message">Oddiy xabar</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Sarlavha *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Xabar sarlavhasi" required />
        </div>

        <div className="form-group">
          <label className="form-label">Matn</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} style={{ resize: 'vertical' }} />
        </div>

        <div className="form-group">
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
            onChange={e => setFiles(Array.from(e.target.files || []))} />
          <button type="button" className="btn btn-ghost w-full" onClick={() => fileRef.current?.click()}>
            📎 Fayl biriktirish {files.length > 0 ? `(${files.length} ta)` : ''}
          </button>
        </div>

        {error && <div className="form-error mb-3">{error}</div>}
        {success && <div style={{ color: 'var(--success)', marginBottom: 12, fontWeight: 600 }}>{success}</div>}

        <button type="submit" className="btn btn-primary w-full" disabled={loading || selected.size === 0}>
          {loading ? '⏳ Yuborilmoqda...' : `📤 ${selected.size} ta bo'limga yuborish`}
        </button>
      </form>
    </div>
  );
}
