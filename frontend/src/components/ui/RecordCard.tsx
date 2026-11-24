import { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Download } from 'lucide-react';
import type { FeedRecord, RecordType, AttachedFile } from '../../types';
import Lightbox from './Lightbox';
import { openFile, parseDate } from '../../lib/files';

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

const IMG_RE = /\.(jpe?g|png|webp|gif|bmp|heic)$/i;
const VID_RE = /\.(mp4|mov|webm|m4v)$/i;
const AUD_RE = /\.(ogg|oga|mp3|m4a|wav|opus)$/i;
const isPhoto = (f: AttachedFile) =>
  (f.mime_type?.startsWith('image/') ?? false) || IMG_RE.test(f.original_name ?? '') || IMG_RE.test(f.url ?? '');
const isVideo = (f: AttachedFile) => (f.mime_type?.startsWith('video/') ?? false) || VID_RE.test(f.original_name ?? '');
const isAudio = (f: AttachedFile) => (f.mime_type?.startsWith('audio/') ?? false) || AUD_RE.test(f.original_name ?? '');

const fileUrl = (f: AttachedFile) => f.url ?? '';

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
  const [lightbox, setLightbox] = useState<number | null>(null);
  const files = record.files.filter(f => !!f.url);
  const photos = files.filter(isPhoto);
  const videos = files.filter(f => !isPhoto(f) && isVideo(f));
  const audios = files.filter(f => !isPhoto(f) && !isVideo(f) && isAudio(f));
  const docs = files.filter(f => !isPhoto(f) && !isVideo(f) && !isAudio(f));
  const shown = photos.slice(0, 4);
  const extra = photos.length - shown.length;
  const body = record.body?.trim() ?? '';
  const titleIsBody =
    (body && body.startsWith(record.title.replace(/\.\.\.$/, ''))) ||
    record.files.some(f => f.original_name === record.title) ||
    record.title === "Tezkor ma'lumot" ||
    record.title === '📸 Rasm';
  const long = body.length > 280;
  const author = record.author_name || "Noma'lum xodim";
  const time = (() => { try { return format(parseDate(record.created_at || record.record_date), 'HH:mm'); } catch { return ''; } })();

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

        {shown.length > 0 && (
          <div className={`gallery g${shown.length}`}>
            {shown.map((f, idx) => (
              <button key={f.id} className="g-cell" onClick={() => setLightbox(idx)} aria-label="Rasmni ochish">
                <img src={fileUrl(f)} alt={f.original_name || 'Rasm'} loading="lazy" />
                {idx === shown.length - 1 && extra > 0 && <span className="g-more">+{extra}</span>}
              </button>
            ))}
          </div>
        )}

        {videos.map(f => (
          <video key={f.id} className="media-video" src={fileUrl(f)} controls playsInline preload="metadata" />
        ))}

        {audios.map(f => (
          <div key={f.id} className="media-audio">
            <audio src={fileUrl(f)} controls preload="metadata" />
          </div>
        ))}

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
            <button key={f.id} className="file-chip" onClick={() => openFile(f.download_url ?? fileUrl(f), f.original_name || 'hujjat')}>
              <div className="file-ico" style={{ background: k.bg }}>{k.label}</div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div className="file-name">{f.original_name || 'Hujjat'}</div>
                <div className="file-size">{fmtSize(f.file_size)}{f.file_size ? ' · ' : ''}Ochish</div>
              </div>
              <Download size={18} color="var(--accent-2)" />
            </button>
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

      {lightbox !== null && (
        <Lightbox
          items={photos.map(f => ({ url: fileUrl(f), downloadUrl: f.download_url ?? fileUrl(f), name: f.original_name || 'rasm.jpg' }))}
          start={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
