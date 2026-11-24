import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { uz } from 'date-fns/locale';
import {
  Search, SlidersHorizontal, Send, Paperclip, X, Inbox, MessageSquareText,
  FileStack, Siren, CalendarDays, ArrowDown, Building2, CheckCircle2,
} from 'lucide-react';
import { getRecords, deleteRecord, createRecord, getDeptFlat } from '../api';
import type { Department, FeedRecord, RecordType } from '../types';
import RecordCard, { TYPE_META } from '../components/ui/RecordCard';
import AppHeader from '../components/ui/AppHeader';
import { useAuth } from '../hooks/useAuth';

const FILTERS: ('' | RecordType)[] = ['', 'message', 'spravka', 'document', 'urgent', 'broadcast'];
const SEND_TYPES: RecordType[] = ['message', 'spravka', 'document', 'urgent'];
const POLL_MS = 15000;

function dayLabel(d: Date) {
  if (isToday(d)) return 'Bugun';
  if (isYesterday(d)) return 'Kecha';
  return format(d, 'd MMMM yyyy', { locale: uz });
}

export default function FeedPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | RecordType>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [depts, setDepts] = useState<Department[]>([]);
  const [deptId, setDeptId] = useState<number | ''>('');

  const [text, setText] = useState('');
  const [sendType, setSendType] = useState<RecordType>('message');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [newCount, setNewCount] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    if (isAdmin) getDeptFlat().then(r => setDepts(r.data)).catch(() => {});
  }, [isAdmin]);

  const nearBottom = () => window.innerHeight + window.scrollY > document.body.scrollHeight - 240;
  const scrollBottom = (smooth = true) =>
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' }));

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const res = await getRecords({
        keyword: keyword || undefined,
        record_type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        department_id: deptId || undefined,
        limit: 200,
      });
      const list = [...res.data].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const maxId = list.reduce((m, r) => Math.max(m, r.id), 0);
      const wasBottom = nearBottom();
      if (silent && maxId > lastIdRef.current && lastIdRef.current) {
        const fresh = list.filter(r => r.id > lastIdRef.current).length;
        if (wasBottom) scrollBottom(); else setNewCount(c => c + fresh);
      }
      lastIdRef.current = maxId;
      setRecords(list);
      if (!silent) scrollBottom(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [keyword, typeFilter, dateFrom, dateTo, deptId]);

  useEffect(() => {
    const t = setTimeout(() => load(), keyword ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, keyword]);

  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(true); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onScroll = () => { if (nearBottom()) setNewCount(0); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const stats = useMemo(() => {
    const today = records.filter(r => isToday(new Date(r.created_at))).length;
    const urgent = records.filter(r => r.record_type === 'urgent').length;
    const fileCount = records.reduce((n, r) => n + r.files.length, 0);
    return { today, urgent, fileCount };
  }, [records]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': records.length };
    records.forEach(r => { c[r.record_type] = (c[r.record_type] ?? 0) + 1; });
    return c;
  }, [records]);

  const groups = useMemo(() => {
    const out: { label: string; items: FeedRecord[] }[] = [];
    records.forEach(r => {
      const label = dayLabel(new Date(r.created_at));
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(r); else out.push({ label, items: [r] });
    });
    return out;
  }, [records]);

  const targetDept = isAdmin ? deptId : user?.department_id;
  const canSend = !!targetDept && (text.trim().length > 0 || files.length > 0) && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const t = text.trim();
      const title = t ? t.split('\n')[0].slice(0, 60) + (t.length > 60 ? '...' : '') : files[0]?.name ?? 'Fayl';
      const fd = new FormData();
      fd.append('title', title);
      fd.append('body', t);
      fd.append('record_type', sendType);
      fd.append('department_id', String(targetDept));
      files.forEach(f => fd.append('files', f));
      await createRecord(fd);
      setText(''); setFiles([]); setSendType('message');
      setToast('Yuborildi');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      await load(true);
      scrollBottom();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      setToast(ax.response?.data?.detail || 'Xato yuz berdi');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteRecord(id);
    setRecords(r => r.filter(x => x.id !== id));
    setToast('Oʻchirildi');
  };

  const activeFilters = [dateFrom, dateTo, deptId].filter(Boolean).length;

  return (
    <>
      {!embedded && (
        <AppHeader onRefresh={() => load(true)} refreshing={refreshing} />
      )}

      <div className="page">
        <div className="stats">
          <div className="stat" style={{ ['--c' as string]: '#22d3ee' }}>
            <div className="stat-ico"><MessageSquareText size={17} /></div>
            <div className="stat-val">{stats.today}</div>
            <div className="stat-label">Bugun</div>
          </div>
          <div className="stat" style={{ ['--c' as string]: '#8b5cf6' }}>
            <div className="stat-ico"><FileStack size={17} /></div>
            <div className="stat-val">{stats.fileCount}</div>
            <div className="stat-label">Fayllar</div>
          </div>
          <div className="stat" style={{ ['--c' as string]: '#f43f5e' }}>
            <div className="stat-ico"><Siren size={17} /></div>
            <div className="stat-val">{stats.urgent}</div>
            <div className="stat-label">Shoshilinch</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="search">
            <Search size={17} />
            <input placeholder="Xabarlar va hujjatlarni qidirish" value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>
          <button
            className={`icon-btn${showFilters || activeFilters ? ' on' : ''}`}
            style={{ height: 44, width: 44 }}
            onClick={() => setShowFilters(v => !v)}
            aria-label="Filtrlar"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="card filters-panel mb-3" style={{ padding: 14 }}>
            {isAdmin && (
              <div className="form-group">
                <label className="form-label"><Building2 size={12} style={{ verticalAlign: -1 }} /> Boʻlim</label>
                <select value={deptId} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Barcha boʻlimlar</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.parent_id ? '— ' : ''}{d.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="form-label"><CalendarDays size={12} style={{ verticalAlign: -1 }} /> Dan</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="form-label"><CalendarDays size={12} style={{ verticalAlign: -1 }} /> Gacha</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            {activeFilters > 0 && (
              <button className="btn btn-ghost btn-sm mt-3" onClick={() => { setDateFrom(''); setDateTo(''); setDeptId(''); }}>
                <X size={14} /> Tozalash
              </button>
            )}
          </div>
        )}

        <div className="chips mb-3">
          {FILTERS.map(f => (
            <button key={f || 'all'} className={`chip${typeFilter === f ? ' active' : ''}`} onClick={() => setTypeFilter(f)}>
              {f ? `${TYPE_META[f].icon} ${TYPE_META[f].label}` : 'Barchasi'}
              {!!counts[f] && <span className="count">{counts[f]}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <>
            {[0, 1, 2].map(i => (
              <div key={i} className="msg">
                <div className="avatar skeleton" />
                <div className="skeleton" style={{ height: 84 + i * 20, flex: 1, maxWidth: '78%' }} />
              </div>
            ))}
          </>
        ) : records.length === 0 ? (
          <div className="empty">
            <div className="empty-ico"><Inbox size={32} /></div>
            <div className="empty-title">Hozircha yozuvlar yoʻq</div>
            <div className="text-sm">Pastdagi maydon orqali birinchi xabar yoki hujjatni yuboring</div>
          </div>
        ) : (
          groups.map(g => (
            <section key={g.label}>
              <div className="day-sep"><span>{g.label}</span></div>
              {g.items.map(r => (
                <RecordCard
                  key={r.id}
                  record={r}
                  mine={r.author_id === user?.id}
                  showDept={isAdmin && !deptId}
                  onDelete={isAdmin ? handleDelete : undefined}
                />
              ))}
            </section>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {newCount > 0 && (
        <button className="new-pill" onClick={() => { setNewCount(0); scrollBottom(); }}>
          <ArrowDown size={15} /> {newCount} ta yangi xabar
        </button>
      )}

      <div className="composer">
        <div className="composer-inner">
          {isAdmin && !deptId ? (
            <div className="text-sm text-mute" style={{ textAlign: 'center', padding: '6px 0' }}>
              Yozish uchun filtrdan boʻlim tanlang yoki <b>Yuborish</b> boʻlimidan foydalaning
            </div>
          ) : (
            <>
              <div className="composer-types">
                {SEND_TYPES.map(t => (
                  <button key={t} className={`chip${sendType === t ? ' active' : ''}`} onClick={() => setSendType(t)}>
                    {TYPE_META[t].icon} {TYPE_META[t].label}
                  </button>
                ))}
              </div>
              {files.length > 0 && (
                <div className="attach-list">
                  {files.map((f, i) => (
                    <span key={i} className="tag">
                      📎 {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
                      <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} aria-label="Olib tashlash"><X size={13} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="composer-row">
                <button className="attach-btn" onClick={() => fileRef.current?.click()} aria-label="Fayl biriktirish">
                  <Paperclip size={21} />
                </button>
                <input
                  ref={fileRef} type="file" multiple hidden
                  onChange={e => { setFiles(fs => [...fs, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }}
                />
                <textarea
                  rows={1}
                  placeholder="Xabar, spravka yoki izoh yozing…"
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
                />
                <button className="send-btn" disabled={!canSend} onClick={handleSend} aria-label="Yuborish">
                  {sending ? <span className="spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} /> : <Send size={19} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast"><CheckCircle2 size={16} color="var(--success)" /> {toast}</div>}
    </>
  );
}
