import { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Download } from 'lucide-react';
import type { FeedRecord, RecordType, AttachedFile } from '../../types';

export const TYPE_META: Record<RecordType, { label: string; cls: string; icon: string }> = {
  spravka:   { label: 'Spravka',      cls: 'badge-blue',   icon: '📋' },
  document:  { label: 'Hujjat',       cls: 'badge-purple', icon: '📄' },
  message:   { label: 'Xabar',        cls: 'badge-green',  icon: '💬' },
  urgent:    { label: 'Shoshilinch',  cls: 'badge-red',    icon: '🚨' },
  broadcast: { label: 'Telegramma',   cls: 'badge-orange', icon: '📢' },
};

const AVATAR_COLORS = [
  'linear-gradient(135deg,#3b82f6,#22d3ee)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#10b981,#84cc16)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#06b6d4,#6366f1)',
  'linear-gradient(135deg,#f43f5e,#a855f7)',
];

export function avatarBg(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function initials(name?: string | null) {
  if (!name) return 'Й';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'Й';
}

const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const isPhoto = (f: AttachedFile) =>
  (f.mime_type?.startsWith('image/') ?? false) || IMG_RE.test(f.original_name ?? '') || IMG_RE.test(f.local_path ?? '');

const fileUrl = (f: AttachedFile) =>
  `/uploads/${f.local_path ? f.local_path.replace(/\\/g, '/').split('/').pop() : f.tg_file_id}`;

function fileKind(name: string) {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return { label: 'PDF', bg: '#ef4444' };
  if (['doc', 'docx'].includes(ext)) return { label: 'DOC', bg: '#3b82f6' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'XLS', bg: '#10b981' };
  if (['zip', 'rar', '7z'].includes(ext)) return { label: 'ZIP', bg: '#f59e0b' };
  return { label: (ext || 'FILE').slice(0, 4).toUpperCase(), bg: '#64748b' };
}

function fmtSize(b?: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  record: FeedRecord;
  mine?: boolean;
  showDept?: boolean;
  onDelete?: (id: number) => void;
}

export default function RecordCard({ record, mine, showDept = true, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const meta = TYPE_META[record.record_type] ?? TYPE_META.message;
  const photos = record.files.filter(isPhoto);
  const docs = record.files.filter(f => !isPhoto(f));
  const body = record.body?.trim() ?? '';
  const titleIsBody = body && body.startsWith(record.title.replace(/\.\.\.$/, ''));
  const long = body.length > 280;
  const author = record.author_name || "Noma'lum xodim";
  const time = (() => { try { return format(new Date(record.created_at || record.record_date), 'HH:mm'); } catch { return ''; } })();

  return (
    <div className={`msg${mine ? ' mine' : ''}`}>
      <div className="avatar" style={{ background: avatarBg(author) }}>{initials(author)}</div>

      <div className={`bubble ${record.record_type === 'urgent' ? 'urgent' : ''} ${record.record_type === 'broadcast' ? 'broadcast' : ''}`}>
        <div className="bubble-head">
          <span className="bubble-author">{mine ? 'Siz' : author}</span>
          {showDept && record.department_name && <span className="bubble-dept">{record.department_name}</span>}
          <span className={`badge ${meta.cls}`} style={{ marginLeft: 'auto' }}>{meta.icon} {meta.label}</span>
        </div>

        {!titleIsBody && <div className="bubble-title">{record.title}</div>}

        {photos.length > 0 && (
          <div className={`gallery${photos.length > 1 ? ' g2' : ''}`}>
            {photos.map(f => (
              <a key={f.id} href={fileUrl(f)} target="_blank" rel="noopener noreferrer">
                <img
                  src={fileUrl(f)}
                  alt={f.original_name || 'Rasm'}
                  loading="lazy"
                  onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              </a>
            ))}
          </div>
        )}

        {body && (
          <>
            <div className={`bubble-body${long && !expanded ? ' clamp' : ''}`}>{body}</div>
            {long && (
              <button className="link-btn" onClick={() => setExpanded(v => !v)}>
                {expanded ? 'Yigʻish' : 'Toʻliq oʻqish'}
              </button>
            )}
          </>
        )}

        {docs.map(f => {
          const k = fileKind(f.original_name || '');
          return (
            <a key={f.id} className="file-chip" href={fileUrl(f)} target="_blank" rel="noopener noreferrer">
              <div className="file-ico" style={{ background: k.bg }}>{k.label}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="file-name">{f.original_name || 'Hujjat'}</div>
                <div className="file-size">{fmtSize(f.file_size)}</div>
              </div>
              <Download size={18} color="var(--text-mute)" />
            </a>
          );
        })}

        <div className="bubble-foot">
          {onDelete && (
            confirmDel ? (
              <>
                <button className="link-btn" style={{ color: 'var(--danger)' }} onClick={() => onDelete(record.id)}>Oʻchirish</button>
                <button className="link-btn" style={{ color: 'var(--text-mute)' }} onClick={() => setConfirmDel(false)}>Bekor</button>
              </>
            ) : (
              <button className="link-btn" style={{ color: 'var(--text-mute)' }} onClick={() => setConfirmDel(true)} aria-label="Oʻchirish">
                <Trash2 size={14} />
              </button>
            )
          )}
          <span>{time}</span>
          {record.status === 'seen_by_admin' && <span style={{ color: 'var(--accent-2)' }}>✓✓</span>}
        </div>
      </div>
    </div>
  );
}
