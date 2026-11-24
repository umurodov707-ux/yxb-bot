import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, Paperclip, ChevronRight } from 'lucide-react';
import { getDeptSummary } from '../../api';
import type { DeptSummary } from '../../types';
import { TYPE_META } from '../../components/ui/RecordCard';
import { parseDate } from '../../lib/files';

const PC_PARENT = 7;
const PMS_PARENT = 8;

type Group = 'pc' | 'pms' | 'main';
const GROUPS: { key: Group; label: string }[] = [
  { key: 'pc', label: 'ПЧ' },
  { key: 'pms', label: 'ПМС / ОПМС' },
  { key: 'main', label: 'Boʻlimlar' },
];

const groupOf = (d: DeptSummary): Group =>
  d.parent_id === PC_PARENT ? 'pc' : d.parent_id === PMS_PARENT ? 'pms' : 'main';

function when(iso: string | null) {
  if (!iso) return '';
  const d = parseDate(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Kecha';
  return format(d, 'dd.MM');
}

const DEPT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e', '#6366f1', '#84cc16'];

function shortCode(name: string) {
  const m = name.match(/(ПЧ|ПМС|ОПМС)-?(\d+)/);
  if (m) return m[2];
  return name.replace(/[^A-Za-zА-Яа-яЎўҚқҒғҲҳ]/g, '').slice(0, 2).toUpperCase();
}

export default function DeptListPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<DeptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group>(() => {
    try { return (sessionStorage.getItem('deptGroup') as Group) || 'pc'; } catch { return 'pc'; }
  });
  const [q, setQ] = useState('');

  useEffect(() => {
    const load = () => getDeptSummary().then(r => setRows(r.data)).finally(() => setLoading(false));
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { try { sessionStorage.setItem('deptGroup', group); } catch { /* ignore */ } }, [group]);

  const unreadBy = useMemo(() => {
    const u: Record<Group, number> = { pc: 0, pms: 0, main: 0 };
    rows.forEach(r => { if (r.department_id !== PC_PARENT && r.department_id !== PMS_PARENT) u[groupOf(r)] += r.unread; });
    return u;
  }, [rows]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r =>
      (term ? true : groupOf(r) === group) &&
      (term ? r.name.toLowerCase().includes(term) : r.department_id !== PC_PARENT && r.department_id !== PMS_PARENT),
    );
  }, [rows, group, q]);

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="search mb-3">
        <Search size={17} />
        <input placeholder="Boʻlimni qidirish (masalan: ПЧ-7)" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {!q && (
        <div className="seg mb-3">
          {GROUPS.map(g => (
            <button key={g.key} className={`seg-btn${group === g.key ? ' active' : ''}`} onClick={() => setGroup(g.key)}>
              {g.label}
              {unreadBy[g.key] > 0 && <span className="nav-badge">{unreadBy[g.key]}</span>}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        [0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 68, marginBottom: 8, borderRadius: 14 }} />)
      ) : (
        <div className="chat-list">
          {list.map((d, i) => (
            <button key={d.department_id} className="chat-row" onClick={() => nav(`/admin/feed/${d.department_id}`)}>
              <div className="chat-ava" style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }}>
                {shortCode(d.name)}
              </div>
              <div className="chat-mid">
                <div className="chat-top">
                  <span className="chat-name">{d.name}</span>
                  <span className={`chat-time${d.unread ? ' hot' : ''}`}>{when(d.last_at)}</span>
                </div>
                <div className="chat-bottom">
                  <span className="chat-preview">
                    {d.last_title ? (
                      <>
                        {d.last_author && <b>{d.last_author.split(' ')[0]}: </b>}
                        {d.last_type === 'urgent' && '🚨 '}
                        {d.last_has_files && <Paperclip size={12} style={{ verticalAlign: -1, marginRight: 3 }} />}
                        {d.last_title}
                      </>
                    ) : (
                      <span className="text-mute">Hali xabar yoʻq</span>
                    )}
                  </span>
                  {d.unread > 0 ? (
                    <span className="unread">{d.unread}</span>
                  ) : d.today > 0 ? (
                    <span className="today-pill">{d.today} bugun</span>
                  ) : (
                    <ChevronRight size={16} color="var(--text-mute)" />
                  )}
                </div>
              </div>
            </button>
          ))}
          {list.length === 0 && <div className="empty"><div className="empty-title">Topilmadi</div></div>}
        </div>
      )}
      <div className="text-xs text-mute mt-3" style={{ textAlign: 'center' }}>
        {Object.values(TYPE_META).map(m => m.icon).join(' ')} — boʻlimni bosing, faqat oʻsha boʻlim xabarlari ochiladi
      </div>
    </div>
  );
}
