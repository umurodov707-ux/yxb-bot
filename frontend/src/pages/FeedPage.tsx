import React, { useCallback, useEffect, useState } from 'react';
import { getRecords, deleteRecord } from '../api';
import type { FeedRecord, RecordType } from '../types';
import RecordCard from '../components/ui/RecordCard';
import NewRecordModal from '../components/ui/NewRecordModal';
import { useAuth } from '../hooks/useAuth';

const TYPE_OPTIONS: { value: '' | RecordType; label: string }[] = [
  { value: '', label: 'Barchasi' },
  { value: 'spravka',  label: 'Spravka' },
  { value: 'document', label: 'Hujjat' },
  { value: 'message',  label: 'Xabar' },
  { value: 'urgent',   label: 'Shoshilinch' },
  { value: 'broadcast', label: 'Telegramma' },
];

export default function FeedPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | RecordType>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecords({
        keyword: keyword || undefined,
        record_type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 100,
      });
      setRecords(res.data);
    } finally {
      setLoading(false);
    }
  }, [keyword, typeFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    await deleteRecord(id);
    setRecords(r => r.filter(x => x.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header flex items-center justify-between">
        <div>
          <div className="page-title">📂 Lenta</div>
          <div className="page-sub">{user?.department_name ?? 'Barcha bo\'limlar'}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Yangi
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-3" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input
            placeholder="🔍 Qidirish..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as RecordType | '')}>
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label className="form-label">Dan</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Gacha</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Records list */}
      {loading ? (
        <div className="spinner" />
      ) : records.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-mute)' }}>
          <div style={{ fontSize: 36 }}>📭</div>
          <div style={{ marginTop: 10 }}>Yozuvlar topilmadi</div>
        </div>
      ) : (
        records.map(r => (
          <RecordCard
            key={r.id}
            record={r}
            isAdmin={user?.role === 'admin'}
            onDelete={user?.role === 'admin' ? handleDelete : undefined}
          />
        ))
      )}

      {showModal && (
        <NewRecordModal
          departmentId={user?.department_id ?? undefined}
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
