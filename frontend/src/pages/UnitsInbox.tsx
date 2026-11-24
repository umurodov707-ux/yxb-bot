import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { ArrowLeft, BellRing, CheckCircle2, Clock3, AlertTriangle, Paperclip, Megaphone } from 'lucide-react';
import { getUnits, remindUnits, getDeptFlat } from '../api';
import type { UnitRow } from '../types';
import { deptMeta, gradient, unitNumber } from '../lib/deptMeta';
import { parseDate } from '../lib/files';

/** Kunlik spravka muddati (mahalliy vaqt). */
const DEADLINE_HOUR = 9;

type Filter = 'all' | 'missing' | 'unread';

function when(iso: string | null) {
  if (!iso) return '';
  const d = parseDate(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Kecha';
  return format(d, 'dd.MM');
}

export default function UnitsInbox({ deptId, base, backTo, admin = false }: { deptId: number; base: string; backTo: string; admin?: boolean }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [deptName, setDeptName] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(() => getUnits(deptId).then(r => setRows(r.data)).finally(() => setLoading(false)), [deptId]);

  useEffect(() => {
    load();
    getDeptFlat().then(r => setDeptName(r.data.find(d => d.id === deptId)?.name ?? '')).catch(() => {});
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [load, deptId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const late = new Date().getHours() >= DEADLINE_HOUR;
  const sent = rows.filter(r => r.today_in > 0);
  const missing = rows.filter(r => r.today_in === 0);
  const unreadTotal = rows.reduce((n, r) => n + r.unread, 0);
  const pct = rows.length ? Math.round((sent.length / rows.length) * 100) : 0;

  const list = useMemo(() => {
    const base_ = filter === 'missing' ? missing : filter === 'unread' ? rows.filter(r => r.unread > 0) : rows;
    const order = new Map(rows.map((r, i) => [r.department_id, i]));
    const ts = (r: UnitRow) => (r.last_at ? parseDate(r.last_at).getTime() : 0);
    return [...base_].sort((a, b) =>
      (b.unread - a.unread) || (ts(b) - ts(a)) || ((order.get(a.department_id) ?? 0) - (order.get(b.department_id) ?? 0)));
  }, [rows, filter, missing]);

  const doRemind = async () => {
    setConfirm(false);
    try {
      const r = await remindUnits(deptId, missing.map(m => m.department_id));
      setToast(r.data.msg);
    } catch {
      setToast('Eslatma yuborilmadi');
    }
  };

  return (
    <>
      <div className={`chat-head${admin ? '' : ' no-nav'}`}>
        <button className="icon-btn" onClick={() => nav(backTo)} aria-label="Orqaga"><ArrowLeft size={19} /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="chat-head-name">{deptName || 'Boʻlim'}</div>
          <div className="text-xs text-mute">Boʻlinmalardan kelgan xabarlar</div>
        </div>
        <button className="icon-btn" onClick={() => nav(`${base}/general`)} aria-label="Umumiy eʼlon"><Megaphone size={18} /></button>
      </div>

      <div className="page" style={{ paddingBottom: 40 }}>
        {/* Bugungi nazorat */}
        <div className="control-card">
          <div className="ring" style={{ ['--p' as string]: pct }}>
            <span>{sent.length}<small>/{rows.length}</small></span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="control-title">Bugungi spravka</div>
            <div className="control-sub">
              <Clock3 size={13} /> Muddat {String(DEADLINE_HOUR).padStart(2, '0')}:00 ·{' '}
              {missing.length === 0 ? <b className="ok">hammasi yubordi</b>
                : <b className={late ? 'bad' : 'warn'}>{missing.length} ta {late ? 'kechikdi' : 'kutilmoqda'}</b>}
            </div>
            {missing.length > 0 && !confirm && (
              <button className="btn btn-sm remind-btn" onClick={() => setConfirm(true)}>
                <BellRing size={15} /> Yubormaganlarga eslatma
              </button>
            )}
            {confirm && (
              <div className="confirm-row">
                <span>{missing.length} ta boʻlinmaga yuborilsinmi?</span>
                <button className="btn btn-primary btn-sm" onClick={doRemind}>Ha</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Yoʻq</button>
              </div>
            )}
          </div>
        </div>

        <div className="chips mb-3 mt-3">
          <button className={`chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
            Hammasi <span className="count">{rows.length}</span>
          </button>
          <button className={`chip${filter === 'missing' ? ' active' : ''}`} onClick={() => setFilter('missing')}>
            Yubormagan <span className="count">{missing.length}</span>
          </button>
          <button className={`chip${filter === 'unread' ? ' active' : ''}`} onClick={() => setFilter('unread')}>
            Oʻqilmagan <span className="count">{unreadTotal}</span>
          </button>
        </div>

        {loading ? (
          [0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 68, marginBottom: 8, borderRadius: 14 }} />)
        ) : list.length === 0 ? (
          <div className="empty"><div className="empty-ico"><CheckCircle2 size={30} /></div><div className="empty-title">Bu yerda hech narsa yoʻq</div></div>
        ) : (
          <div className="chat-list">
            {list.map((u, i) => {
              const m = deptMeta(u.code, u.parent_id ? (u.name.startsWith('ПЧ') ? 'PC' : 'PMS') : null);
              const num = unitNumber(u.name);
              const done = u.today_in > 0;
              return (
                <button key={u.department_id} className="chat-row" style={{ animationDelay: `${i * 20}ms` }}
                        onClick={() => nav(`${base}/${u.department_id}`)}>
                  <div className="chat-ava" style={{ background: gradient(m) }}>
                    {num ? <span className="ava-num">{num}</span> : <m.Icon size={22} />}
                    <span className={`ava-status ${done ? 'ok' : late ? 'bad' : 'warn'}`}>
                      {done ? <CheckCircle2 size={13} /> : late ? <AlertTriangle size={12} /> : <Clock3 size={12} />}
                    </span>
                  </div>
                  <div className="chat-mid">
                    <div className="chat-top">
                      <span className="chat-name">{u.name}</span>
                      <span className={`chat-time${u.unread ? ' hot' : ''}`}>{when(u.last_at)}</span>
                    </div>
                    <div className="chat-bottom">
                      <span className="chat-preview">
                        {u.last_title ? (
                          <>
                            {u.last_is_reply ? <b>Siz: </b> : u.last_author && <b>{u.last_author.split(' ')[0]}: </b>}
                            {u.last_has_files && <Paperclip size={12} style={{ verticalAlign: -1, marginRight: 3 }} />}
                            {u.last_title}
                          </>
                        ) : <span className="text-mute">Hali yozishma yoʻq</span>}
                      </span>
                      {u.unread > 0 ? <span className="unread">{u.unread}</span>
                        : <span className={`state-pill ${done ? 'ok' : late ? 'bad' : 'warn'}`}>{done ? 'yubordi' : late ? 'kechikdi' : 'kutilmoqda'}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {toast && <div className="toast"><BellRing size={16} color="var(--accent-2)" /> {toast}</div>}
    </>
  );
}
