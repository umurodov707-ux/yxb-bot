import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import type { FeedRecord, RecordType } from '../../types';

const TYPE_META: Record<RecordType, { label: string; cls: string; icon: string }> = {
  spravka:   { label: 'Spravka',   cls: 'badge-blue',   icon: '📋' },
  document:  { label: 'Hujjat',    cls: 'badge-purple', icon: '📄' },
  message:   { label: 'Xabar',     cls: 'badge-green',  icon: '💬' },
  urgent:    { label: 'Shoshilinch', cls: 'badge-red',  icon: '🚨' },
  broadcast: { label: 'Telegramma/Prikas', cls: 'badge-orange', icon: '📢' },
};

interface Props {
  record: FeedRecord;
  onDelete?: (id: number) => void;
  isAdmin?: boolean;
}

export default function RecordCard({ record, onDelete, isAdmin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[record.record_type] ?? TYPE_META.message;

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(record.record_date), { addSuffix: true, locale: uz });
    } catch {
      return '';
    }
  })();

  return (
    <div
      className="card"
      style={{
        marginBottom: 10,
        borderLeft: record.record_type === 'urgent' ? '3px solid var(--urgent)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>{meta.icon}</span>
          <span
            style={{
              fontWeight: 700, fontSize: 14,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {record.title}
          </span>
        </div>
        <span className={`badge ${meta.cls}`} style={{ flexShrink: 0 }}>{meta.label}</span>
      </div>

      {/* Meta */}
      <div className="flex gap-3 text-xs text-mute" style={{ marginBottom: record.body || record.files.length ? 8 : 0 }}>
        {record.department_name && (
          <span>🏢 {record.department_name}</span>
        )}
        {record.author_name && (
          <span>👤 {record.author_name}</span>
        )}
        <span>🕐 {timeAgo}</span>
        {record.status === 'seen_by_admin' && (
          <span style={{ color: 'var(--success)' }}>👁 Ko'rildi</span>
        )}
      </div>

      {/* Body */}
      {record.body && (
        <div
          style={{
            fontSize: 13, color: 'var(--text-mute)',
            maxHeight: expanded ? 'none' : '60px',
            overflow: 'hidden',
          }}
        >
          {record.body}
        </div>
      )}
      {record.body && record.body.length > 120 && (
        <button
          className="btn-ghost btn btn-sm"
          style={{ marginTop: 6, padding: '4px 10px' }}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? '▲ Yigʻrish' : '▼ Koʻproq'}
        </button>
      )}

      {/* Files */}
      {record.files.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {record.files.map(f => (
            <a
              key={f.id}
              href={`/uploads/${f.local_path?.split('/').pop() ?? f.tg_file_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="badge badge-blue"
              style={{ textDecoration: 'none' }}
            >
              📎 {f.original_name ?? 'fayl'}
            </a>
          ))}
        </div>
      )}

      {/* Admin actions */}
      {isAdmin && onDelete && (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => { if (window.confirm('O\'chirishni tasdiqlaysizmi?')) onDelete(record.id); }}
          >
            🗑 O'chirish
          </button>
        </div>
      )}
    </div>
  );
}
