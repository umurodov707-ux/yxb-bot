import React, { useCallback, useEffect, useState } from 'react';
import { getPendingRequests, reviewRequest } from '../../api';
import type { RegistrationRequest } from '../../types';
import { formatDistanceToNow } from 'date-fns';

export default function RequestsTab() {
  const [reqs, setReqs] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getPendingRequests();
      setReqs(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handle = async (id: number, approve: boolean) => {
    setBusy(id);
    try {
      await reviewRequest({ request_id: id, approve });
      setReqs(r => r.filter(x => x.id !== id));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">📋 Ro'yxatdan o'tish arizalari</div>
        <div className="page-sub">{reqs.length} ta kutilmoqda</div>
      </div>

      {reqs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-mute)' }}>
          <div style={{ fontSize: 36 }}>✅</div>
          <div style={{ marginTop: 10 }}>Barcha arizalar ko'rib chiqildi</div>
        </div>
      ) : (
        reqs.map(r => (
          <div key={r.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              👤 {r.full_name}
            </div>
            <div className="text-sm text-mute" style={{ marginBottom: 2 }}>💼 {r.position}</div>
            <div className="text-sm text-mute" style={{ marginBottom: 2 }}>
              🏢 {r.department_name ?? `Bo'lim ID: ${r.department_id}`}
            </div>
            {r.phone && <div className="text-sm text-mute" style={{ marginBottom: 2 }}>📞 {r.phone}</div>}
            {r.username && <div className="text-sm text-mute" style={{ marginBottom: 2 }}>🔗 @{r.username}</div>}
            <div className="text-xs text-mute" style={{ marginBottom: 10 }}>
              🕐 {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={busy === r.id}
                onClick={() => handle(r.id, true)}
              >
                ✅ Tasdiqlash
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                disabled={busy === r.id}
                onClick={() => handle(r.id, false)}
              >
                ❌ Rad etish
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
