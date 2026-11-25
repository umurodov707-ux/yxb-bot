import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, ChevronRight, ArrowLeft, Lock, Paperclip, PenLine, Crown } from 'lucide-react';
import { getDeptSummary } from '../api';
import type { DeptSummary } from '../types';
import { deptMeta, gradient, unitNumber } from '../lib/deptMeta';
import { parseDate } from '../lib/files';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/ui/AppHeader';
import { UnitTasksSection } from './TasksPages';

const GROUP_CODES = ['PC', 'PMS'];

function when(iso: string | null) {
  if (!iso) return '';
  const d = parseDate(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Kecha';
  return format(d, 'dd.MM');
}

function useSummary() {
  const [rows, setRows] = useState<DeptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = () => getDeptSummary().then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, []);
  return { rows, loading };
}

interface Agg { today: number; unread: number; total: number; count: number; last_at: string | null; last_title: string | null }

function aggregate(children: DeptSummary[]): Agg {
  return children.reduce<Agg>((a, c) => {
    const newer = c.last_at && (!a.last_at || parseDate(c.last_at) > parseDate(a.last_at));
    return {
      today: a.today + c.today,
      unread: a.unread + c.unread,
      total: a.total + c.total,
      count: a.count + 1,
      last_at: newer ? c.last_at : a.last_at,
      last_title: newer ? `${c.name}: ${c.last_title ?? ''}` : a.last_title,
    };
  }, { today: 0, unread: 0, total: 0, count: 0, last_at: null, last_title: null });
}

/* ── Tile ─────────────────────────────────────────────────────────── */
function DeptTile({
  index, name, code, today, unread, sub, readOnly, wide, onClick, delay = 0,
}: {
  index?: number; name: string; code: string; today: number; unread: number;
  sub?: string; readOnly?: boolean; wide?: boolean; onClick: () => void; delay?: number;
}) {
  const m = deptMeta(code);
  const { Icon } = m;
  return (
    <button
      className={`tile${wide ? ' tile-wide' : ''}`}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms`, ['--g1' as string]: m.g[0], ['--g2' as string]: m.g[1] }}
    >
      <div className="tile-glow" />
      <div className="tile-top">
        <div className="tile-ico" style={{ background: gradient(m) }}>
          <Icon size={wide ? 26 : 22} strokeWidth={2.1} />
        </div>
        {index !== undefined && <span className="tile-num">{String(index).padStart(2, '0')}</span>}
        {unread > 0 && <span className="unread tile-unread">{unread}</span>}
      </div>
      <div className="tile-name">{name}</div>
      <div className="tile-meta">
        {readOnly && <span className="tile-chip"><Lock size={11} /> eʼlon</span>}
        {sub && <span>{sub}</span>}
        {today > 0 && <span className="tile-today">{today} bugun</span>}
      </div>
    </button>
  );
}

/* ── Admin: bosh sahifa ───────────────────────────────────────────── */
export function AdminDeptHome() {
  const nav = useNavigate();
  const { rows, loading } = useSummary();
  const [q, setQ] = useState('');

  const roots = useMemo(() => rows.filter(r => r.parent_id === null).sort((a, b) => a.sort_order - b.sort_order), [rows]);
  const childrenOf = (id: number) => rows.filter(r => r.parent_id === id);
  const term = q.trim().toLowerCase();
  const found = term ? rows.filter(r => !GROUP_CODES.includes(r.code) && r.name.toLowerCase().includes(term)) : [];

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="search mb-3">
        <Search size={17} />
        <input placeholder="Boʻlim yoki ПЧ qidirish (masalan: ПЧ-7)" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {term ? (
        <ChatList rows={found} onOpen={id => nav(`/admin/feed/${id}`)} />
      ) : loading ? (
        <div className="tile-grid">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="tile skeleton" />)}</div>
      ) : (
        <div className="tile-grid">
          {roots.map((r, i) => {
            if (GROUP_CODES.includes(r.code)) {
              const kids = childrenOf(r.department_id);
              const a = aggregate([r, ...kids]);
              return (
                <DeptTile
                  key={r.department_id} index={r.sort_order} name={r.name} code={r.code}
                  today={a.today} unread={a.unread} sub={`${kids.length} ta boʻlinma`} delay={i * 35}
                  onClick={() => nav(`/admin/feed/g/${r.code}`)}
                />
              );
            }
            return (
              <DeptTile
                key={r.department_id} index={r.sort_order} name={r.name} code={r.code}
                today={r.today} unread={r.unread} readOnly={r.read_only} delay={i * 35}
                sub={r.last_at ? when(r.last_at) : undefined}
                onClick={() => nav(r.read_only ? `/admin/feed/${r.department_id}` : `/admin/feed/${r.department_id}/units`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Admin: ПЧ / ПМС ichki ro'yxati ───────────────────────────────── */
export function DeptGroupPage() {
  const nav = useNavigate();
  const { code } = useParams();
  const { rows, loading } = useSummary();
  const parent = rows.find(r => r.code === code);
  const kids = parent ? rows.filter(r => r.parent_id === parent.department_id) : [];
  const m = deptMeta(code ?? '');

  return (
    <>
      <div className="chat-head">
        <button className="icon-btn" onClick={() => nav('/admin/feed')} aria-label="Orqaga"><ArrowLeft size={19} /></button>
        <div className="tile-ico sm" style={{ background: gradient(m) }}><m.Icon size={18} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="chat-head-name">{parent?.name ?? '…'}</div>
          <div className="text-xs text-mute">{kids.length} ta boʻlinma</div>
        </div>
      </div>
      <div className="page" style={{ paddingBottom: 40 }}>
        {parent && (parent.total > 0) && (
          <ChatList rows={[{ ...parent, name: `${parent.name} — umumiy` }]} onOpen={id => nav(`/admin/feed/${id}`)} />
        )}
        {loading ? (
          [0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 68, marginBottom: 8, borderRadius: 14 }} />)
        ) : (
          <ChatList rows={kids} onOpen={id => nav(`/admin/feed/${id}`)} />
        )}
      </div>
    </>
  );
}

function ChatList({ rows, onOpen }: { rows: DeptSummary[]; onOpen: (id: number) => void }) {
  if (rows.length === 0) return <div className="empty"><div className="empty-title">Topilmadi</div></div>;
  return (
    <div className="chat-list">
      {rows.map((d, i) => {
        const m = deptMeta(d.code);
        const num = unitNumber(d.name);
        return (
          <button key={d.department_id} className="chat-row" style={{ animationDelay: `${i * 25}ms` }} onClick={() => onOpen(d.department_id)}>
            <div className="chat-ava" style={{ background: gradient(m) }}>
              {num ? <span className="ava-num">{num}</span> : <m.Icon size={22} />}
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
                  ) : <span className="text-mute">Hali xabar yoʻq</span>}
                </span>
                {d.unread > 0 ? <span className="unread">{d.unread}</span>
                  : d.today > 0 ? <span className="today-pill">{d.today} bugun</span>
                  : <ChevronRight size={16} color="var(--text-mute)" />}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Xodim: bosh sahifa ───────────────────────────────────────────── */
export function EmployeeHome() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { rows, loading } = useSummary();
  const own = rows.find(r => r.department_id === user?.department_id);
  const shared = rows.filter(r => r.read_only && r.department_id !== user?.department_id);
  const targets = rows
    .filter(r => r.parent_id === null && !r.read_only && !GROUP_CODES.includes(r.code) && r.department_id !== user?.department_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <AppHeader />
      <div className="page" style={{ paddingBottom: 40 }}>
        <div className="hello">
          <div className="hello-hi">Assalomu alaykum,</div>
          <div className="hello-name">{user?.full_name?.split(' ').slice(0, 2).join(' ')}</div>
        </div>

        <UnitTasksSection />

        <div className="section-title">
          Mening boʻlimim {user?.is_dept_head && <span className="head-badge"><Crown size={11} /> Rahbar</span>}
        </div>
        {loading || !own ? (
          <div className="tile tile-wide skeleton" />
        ) : user?.is_dept_head ? (
          <DeptTile
            wide name={own.name} code={own.code} today={own.today} unread={own.unread}
            sub="Boʻlinmalardan kelgan xabarlar va bugungi nazorat"
            onClick={() => nav('/inbox')}
          />
        ) : (
          <DeptTile
            wide name={own.name} code={own.code} today={own.today} unread={0}
            sub={own.last_at ? `Oxirgi: ${when(own.last_at)}` : 'Hali xabar yoʻq'}
            onClick={() => nav(`/d/${own.department_id}`)}
          />
        )}
        {own && targets.length === 0 && (
          <button className="btn btn-primary w-full mt-3" onClick={() => nav(`/d/${own.department_id}`)}>
            <PenLine size={17} /> Spravka yoki xabar yuborish
          </button>
        )}

        {targets.length > 0 && (
          <>
            <div className="section-title">Qayerga yuborasiz?</div>
            <div className="tile-grid">
              {targets.map((r, i) => (
                <DeptTile
                  key={r.department_id} index={r.sort_order} name={r.name} code={r.code}
                  today={r.today} unread={0} delay={i * 35}
                  sub={r.total > 0 ? `${r.total} ta yozishma` : undefined}
                  onClick={() => nav(`/d/${r.department_id}`)}
                />
              ))}
            </div>
          </>
        )}

        {shared.length > 0 && (
          <>
            <div className="section-title">Umumiy eʼlonlar</div>
            <div className="tile-grid">
              {shared.map((r, i) => (
                <DeptTile
                  key={r.department_id} name={r.name} code={r.code} today={r.today} unread={0}
                  readOnly delay={i * 40} sub={r.last_at ? when(r.last_at) : undefined}
                  onClick={() => nav(`/d/${r.department_id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
