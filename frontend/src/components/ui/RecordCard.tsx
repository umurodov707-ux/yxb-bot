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

  const isPhoto = (filename?: string | null) => {
    if (!filename) return false;
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
  };

  return (
    <div
      style={{
        marginBottom: 14,
        background: 'linear-gradient(145deg, #1e2230 0%, #171a24 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
        position: 'relative',
      }}
    >
      {/* Telegram style Chat Bubble Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f8ef7 0%, #2954a3 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(79, 142, 247, 0.4)'
            }}
          >
            {record.author_name ? record.author_name[0].toUpperCase() : 'Й'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.2px' }}>
              {record.author_name || 'Noma\'lum xodim'}
            </div>
            {record.department_name && (
              <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>
                🏢 {record.department_name}
              </div>
            )}
          </div>
        </div>
        <span className={`badge ${meta.cls}`} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6 }}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {/* Yuborilgan rasmlar (Telegram photo gallery preview) */}
      {record.files.filter(f => isPhoto(f.original_name) || isPhoto(f.local_path)).length > 0 && (
        <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden' }}>
          {record.files.filter(f => isPhoto(f.original_name) || isPhoto(f.local_path)).map(f => {
            const fileName = f.local_path ? f.local_path.replace(/\\/g, '/').split('/').pop() : f.tg_file_id;
            const fileUrl = `/uploads/${fileName}`;
            return (
              <a key={f.id} href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                <img
                  src={fileUrl}
                  alt={f.original_name || 'Rasm'}
                  style={{
                    width: '100%',
                    maxHeight: 280,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)',
                    transition: 'transform 0.2s',
                  }}
                  onError={(e) => {
                    // Agar rasm hali yuklanmagan bo'lsa
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </a>
            );
          })}
        </div>
      )}

      {/* Body / Izoh matni */}
      {record.body && (
        <div
          style={{
            fontSize: 13.5,
            color: '#cbd5e1',
            lineHeight: 1.45,
            marginBottom: 8,
            whiteSpace: 'pre-wrap',
            background: 'rgba(0,0,0,0.18)',
            padding: '8px 10px',
            borderRadius: 8,
          }}
        >
          {record.body}
        </div>
      )}

      {/* Boshqa biriktirilgan hujjat fayllar (PDF, Word, Excel) */}
      {record.files.filter(f => !isPhoto(f.original_name) && !isPhoto(f.local_path)).length > 0 && (
        <div style={{ marginTop: 6, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {record.files.filter(f => !isPhoto(f.original_name) && !isPhoto(f.local_path)).map(f => {
            const fileName = f.local_path ? f.local_path.replace(/\\/g, '/').split('/').pop() : f.tg_file_id;
            return (
              <a
                key={f.id}
                href={`/uploads/${fileName}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(79, 142, 247, 0.12)',
                  border: '1px solid rgba(79, 142, 247, 0.3)',
                  borderRadius: 8,
                  color: '#93c5fd',
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: 16 }}>📄</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.original_name || 'Hujjatni yuklab olish'}
                </span>
                <span style={{ fontSize: 11, color: '#60a5fa' }}>⬇️ Yuklab olish</span>
              </a>
            );
          })}
        </div>
      )}

      {/* Footer: Vaqt va Ko'rilganlik belgisi (Telegram double tick) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
        <span>🕒 {timeAgo}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {record.status === 'seen_by_admin' ? (
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>✓✓ Ko‘rildi</span>
          ) : (
            <span>✓ Yetkazildi</span>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => { if (window.confirm('Hujjatni o\'chirishni xohlaysizmi?')) onDelete(record.id); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: 12,
                cursor: 'pointer',
                marginLeft: 10
              }}
            >
              🗑 O‘chirish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
