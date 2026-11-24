import React, { useRef, useState } from 'react';
import type { RecordType } from '../../types';
import { createRecord } from '../../api';

interface Props {
  departmentId?: number;
  onClose: () => void;
  onCreated: () => void;
}

const TYPES: { value: RecordType; label: string; icon: string }[] = [
  { value: 'spravka',  label: 'Spravka / Hisobot', icon: '📋' },
  { value: 'document', label: 'Fayl / Hujjat',     icon: '📄' },
  { value: 'message',  label: 'Oddiy xabar',        icon: '💬' },
  { value: 'urgent',   label: 'Shoshilinch xabar',  icon: '🚨' },
];

export default function NewRecordModal({ departmentId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<RecordType>('message');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Sarlavha kiritilmagan.'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('body', body);
      fd.append('record_type', type);
      if (departmentId) fd.append('department_id', String(departmentId));
      files.forEach(f => fd.append('files', f));
      await createRecord(fd);
      onCreated();
      onClose();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      setError(ax.response?.data?.detail || 'Xato yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: 600,
          borderRadius: '14px 14px 0 0',
          padding: 20, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontWeight: 700, fontSize: 16 }}>➕ Yangi yozuv</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type selector */}
          <div className="form-group">
            <label className="form-label">Tur</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, border: '1px solid',
                    borderColor: type === t.value ? 'var(--accent)' : 'var(--border)',
                    background: type === t.value ? 'rgba(79,142,247,.12)' : 'var(--surface2)',
                    color: type === t.value ? 'var(--accent)' : 'var(--text)',
                    fontWeight: 600, fontSize: 13, textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Sarlavha *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Yozuv sarlavhasi" required />
          </div>

          <div className="form-group">
            <label className="form-label">Izoh (ixtiyoriy)</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Qo'shimcha ma'lumot..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fayllar (ixtiyoriy)</label>
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => setFiles(Array.from(e.target.files || []))}
            />
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => fileRef.current?.click()}
            >
              📎 Fayl biriktirish {files.length > 0 ? `(${files.length} ta)` : ''}
            </button>
            {files.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {files.map((f, i) => (
                  <span key={i} className="badge badge-blue">{f.name}</span>
                ))}
              </div>
            )}
          </div>

          {error && <div className="form-error mb-3">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? '⏳ Yuborilmoqda...' : '📤 Yuborish'}
          </button>
        </form>
      </div>
    </div>
  );
}
