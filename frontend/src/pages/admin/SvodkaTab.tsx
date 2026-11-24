import React, { useCallback, useEffect, useState } from 'react';
import { getSvodka } from '../../api';
import type { SvodkaRow } from '../../types';
import { format } from 'date-fns';

export default function SvodkaTab() {
  const [group, setGroup] = useState<'PC' | 'PMS'>('PC');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<SvodkaRow[]>([]);
  const [stats, setStats] = useState({ total: 0, submitted: 0, pending: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getSvodka({
        group,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        date_to: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
      });
      setRows(r.data.rows);
      setStats({ total: r.data.total, submitted: r.data.submitted, pending: r.data.pending });
    } finally {
      setLoading(false);
    }
  }, [group, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const pct = stats.total ? Math.round((stats.submitted / stats.total) * 100) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">📊 Topshirish nazorati (Svodka)</div>
      </div>

      {/* Filters */}
      <div className="card mb-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label className="form-label">Guruh</label>
          <select value={group} onChange={e => setGroup(e.target.value as 'PC' | 'PMS')}>
            <option value="PC">ПЧ</option>
            <option value="PMS">ПМС / ОПМС</option>
          </select>
        </div>
        <div>
          <label className="form-label">Dan</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Gacha</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Jami',       value: stats.total,     color: 'var(--accent)'   },
          { label: 'Topshirdi',  value: stats.submitted, color: 'var(--success)'  },
          { label: 'Topshirmadi',value: stats.pending,   color: 'var(--warning)'  },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div className="text-xs text-mute" style={{ marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="flex justify-between text-sm mb-2">
            <span>Topshirish darajasi</span>
            <span style={{ fontWeight: 700, color: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${pct}%`,
              background: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)',
              transition: 'width .4s',
            }} />
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <div className="spinner" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(row => (
            <div
              key={row.department_id}
              className="card"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                borderLeft: `3px solid ${row.has_submitted ? 'var(--success)' : 'var(--warning)'}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{row.department_name}</div>
                {row.last_at && (
                  <div className="text-xs text-mute" style={{ marginTop: 2 }}>
                    Oxirgi: {format(new Date(row.last_at), 'dd.MM.yyyy HH:mm')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                {row.has_submitted ? (
                  <span style={{ fontSize: 20 }}>✅</span>
                ) : (
                  <span style={{ fontSize: 20 }}>⏳</span>
                )}
                <div className="text-xs text-mute">{row.record_count} ta</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
