import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, Plus, ScrollText, Clock3, CheckCircle2, AlertTriangle, Undo2, Hourglass,
  BellRing, Paperclip, X, Send, ChevronRight, FileCheck2,
} from 'lucide-react';
import {
  getTasks, getTask, createTask, submitTask, reviewTask, remindTask, getTaskUnits,
} from '../api';
import type { TaskListItem, TaskDetail, TaskStatus, TaskUnit, AssignmentRow } from '../types';
import RecordCard from '../components/ui/RecordCard';
import { parseDate } from '../lib/files';
import { useAuth } from '../hooks/useAuth';

/* ── Holat belgilari ─────────────────────────────────────────────── */
const STATUS: Record<TaskStatus | 'overdue', { label: string; cls: string; Icon: typeof Clock3 }> = {
  pending:   { label: 'Yangi',          cls: 'st-new',  Icon: Hourglass },
  submitted: { label: 'Tekshiruvda',    cls: 'st-rev',  Icon: Clock3 },
  accepted:  { label: 'Qabul qilindi',  cls: 'st-ok',   Icon: CheckCircle2 },
  returned:  { label: 'Qaytarildi',     cls: 'st-ret',  Icon: Undo2 },
  overdue:   { label: 'Muddati oʻtdi',  cls: 'st-bad',  Icon: AlertTriangle },
};

function StatusPill({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  const m = overdue ? STATUS.overdue : STATUS[status];
  return <span className={`st-pill ${m.cls}`}><m.Icon size={12} /> {m.label}</span>;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '';
  try { return format(parseDate(iso), 'dd.MM.yyyy HH:mm'); } catch { return ''; }
}

function timeLeft(iso: string | null) {
  if (!iso) return null;
  const ms = parseDate(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000), h = Math.floor((abs % 86400000) / 3600000), m = Math.floor((abs % 3600000) / 60000);
  const txt = d > 0 ? `${d} kun ${h} soat` : h > 0 ? `${h} soat ${m} daq` : `${m} daq`;
  return ms >= 0 ? { late: false, txt: `${txt} qoldi` } : { late: true, txt: `${txt} oʻtdi` };
}

function useToast() {
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  const node = toast ? <div className="toast"><CheckCircle2 size={16} color="var(--success)" /> {toast}</div> : null;
  return { setToast, node };
}

const errText = (e: unknown) =>
  (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Xato yuz berdi';

/* ── Fayl tanlash yordamchisi ────────────────────────────────────── */
function FilePicker({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" multiple hidden onChange={e => {
        const picked = Array.from(e.target.files ?? []);
        e.target.value = '';
        setFiles([...files, ...picked]);
      }} />
      <button type="button" className="dropzone w-full" onClick={() => ref.current?.click()}>
        <Paperclip size={16} style={{ verticalAlign: -3 }} /> Fayl biriktirish (PDF, Word, rasm)
      </button>
      {files.length > 0 && (
        <div className="attach-list mt-2">
          {files.map((f, i) => (
            <span key={i} className="tag">
              📎 {f.name.length > 26 ? f.name.slice(0, 24) + '…' : f.name}
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Olib tashlash"><X size={13} /></button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/* ══ ADMIN: telegrammalar ro'yxati ═══════════════════════════════ */
export function AdminTasks() {
  const nav = useNavigate();
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { setToast, node } = useToast();

  const load = useCallback(() => getTasks().then(r => setItems(r.data)).finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="page-header flex items-center justify-between">
        <div>
          <div className="page-title">Telegramma ijrosi</div>
          <div className="page-sub">Kim bajardi, kim bajarmadi — bir joyda</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={17} /> Yangi</button>
      </div>

      {loading ? (
        [0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 112, marginBottom: 10, borderRadius: 18 }} />)
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="empty-ico"><ScrollText size={30} /></div>
          <div className="empty-title">Hali telegramma yoʻq</div>
          <div className="text-sm">«Yangi» tugmasi bilan telegramma joylang va ijrochilarni belgilang</div>
        </div>
      ) : items.map((t, i) => {
        const total = t.total ?? 0;
        const seg = (n = 0) => `${total ? (n / total) * 100 : 0}%`;
        const left = timeLeft(t.deadline);
        return (
          <button key={t.id} className="task-card" style={{ animationDelay: `${i * 30}ms` }} onClick={() => nav(`/admin/tasks/${t.id}`)}>
            <div className="task-top">
              <div className="task-ico"><ScrollText size={20} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="task-title">{t.title}</div>
                <div className="task-meta">
                  {t.deadline && <span className={left?.late && (t.accepted ?? 0) < total ? 'bad' : ''}><Clock3 size={12} /> {fmt(t.deadline)}</span>}
                  {t.has_files && <span><Paperclip size={12} /> fayl</span>}
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-mute)" />
            </div>
            <div className="progress">
              <span className="p-ok" style={{ width: seg(t.accepted) }} />
              <span className="p-rev" style={{ width: seg(t.submitted) }} />
              <span className="p-ret" style={{ width: seg(t.returned) }} />
            </div>
            <div className="task-stats">
              <b>{t.accepted ?? 0}/{total}</b> qabul qilindi
              {!!t.submitted && <span className="st-pill st-rev">{t.submitted} tekshiruvda</span>}
              {!!t.overdue && <span className="st-pill st-bad">{String(t.overdue)} muddati oʻtdi</span>}
            </div>
          </button>
        );
      })}

      {creating && (
        <NewTaskSheet
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setToast('Telegramma yuborildi'); load(); nav(`/admin/tasks/${id}`); }}
        />
      )}
      {node}
    </div>
  );
}

/* ── Yangi telegramma ───────────────────────────────────────────── */
function NewTaskSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deadline, setDeadline] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getTaskUnits().then(r => setUnits(r.data)); }, []);

  const groups = useMemo(() => ({
    PC: units.filter(u => u.group === 'PC'),
    PMS: units.filter(u => u.group === 'PMS'),
    RSP: units.filter(u => u.group === 'RSP'),
  }), [units]);

  const toggleMany = (ids: number[]) => setPicked(prev => {
    const all = ids.every(id => prev.has(id));
    const next = new Set(prev);
    ids.forEach(id => (all ? next.delete(id) : next.add(id)));
    return next;
  });
  const toggle = (id: number) => toggleMany([id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Sarlavhani yozing.');
    if (picked.size === 0) return setError('Kamida bitta ijrochini tanlang.');
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('body', body.trim());
      fd.append('unit_ids', Array.from(picked).join(','));
      if (deadline) fd.append('deadline', new Date(deadline).toISOString());
      files.forEach(f => fd.append('files', f));
      const r = await createTask(fd);
      onCreated(r.data.id);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const QUICK: { label: string; ids: number[] }[] = [
    { label: `Barcha ПЧ (${groups.PC.length})`, ids: groups.PC.map(u => u.id) },
    { label: `ПМС/ОПМС (${groups.PMS.length})`, ids: groups.PMS.map(u => u.id) },
    { label: 'РСП', ids: groups.RSP.map(u => u.id) },
    { label: `Hammasi (${units.length})`, ids: units.map(u => u.id) },
  ];

  return (
    <div className="sheet-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="sheet" onSubmit={submit}>
        <div className="sheet-grip" />
        <div className="flex items-center justify-between mb-3">
          <div className="page-title" style={{ fontSize: 19 }}>Yangi telegramma</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="form-group">
          <label className="form-label">Sarlavha</label>
          <input placeholder="Masalan: Telegramma №112 — qor tozalash" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Mazmuni</label>
          <textarea placeholder="Nima bajarilishi kerak…" value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Ijro muddati</label>
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Ijrochilar — {picked.size} ta tanlandi</label>
          <div className="chips mb-2" style={{ flexWrap: 'wrap' }}>
            {QUICK.map(q => (
              <button key={q.label} type="button"
                      className={`chip${q.ids.length && q.ids.every(id => picked.has(id)) ? ' active' : ''}`}
                      onClick={() => toggleMany(q.ids)}>{q.label}</button>
            ))}
            {picked.size > 0 && <button type="button" className="chip" onClick={() => setPicked(new Set())}>Tozalash</button>}
          </div>
          {(['PC', 'PMS', 'RSP'] as const).map(g => groups[g].length > 0 && (
            <div key={g} className="unit-grid">
              {groups[g].map(u => (
                <button key={u.id} type="button" className={`unit-chip${picked.has(u.id) ? ' on' : ''}`} onClick={() => toggle(u.id)}>
                  {picked.has(u.id) && <CheckCircle2 size={13} />} {u.name}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="form-group"><FilePicker files={files} setFiles={setFiles} /></div>
        {error && <div className="form-error mb-2">{error}</div>}
        <button className="btn btn-primary w-full" disabled={busy}>
          <Send size={17} /> {busy ? 'Yuborilmoqda…' : `Yuborish (${picked.size} ta bo'linmaga)`}
        </button>
      </form>
    </div>
  );
}

/* ══ ADMIN: bitta telegramma ijrosi ══════════════════════════════ */
type Filter = 'all' | 'submitted' | 'todo' | 'accepted';

export function AdminTaskDetail() {
  const nav = useNavigate();
  const { taskId } = useParams();
  const id = Number(taskId);
  const [data, setData] = useState<TaskDetail | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [returning, setReturning] = useState<number | null>(null);
  const [confirmRemind, setConfirmRemind] = useState(false);
  const { setToast, node } = useToast();

  const load = useCallback(() => getTask(id).then(r => setData(r.data)), [id]);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <div className="spinner" />;
  const c = data.counts!;
  const rows = data.assignments ?? [];
  const todo = rows.filter(r => r.status === 'pending' || r.status === 'returned');
  const shown = rows.filter(r =>
    filter === 'all' ? true : filter === 'todo' ? (r.status === 'pending' || r.status === 'returned') : r.status === filter);
  const pct = c.total ? Math.round((c.accepted / c.total) * 100) : 0;
  const left = timeLeft(data.deadline);

  const review = async (row: AssignmentRow, accept: boolean) => {
    try {
      const r = await reviewTask(id, row.unit_id, accept, accept ? undefined : note);
      setToast(r.data.msg); setReturning(null); setNote(''); load();
    } catch (e) { setToast(errText(e)); }
  };
  const remind = async () => {
    setConfirmRemind(false);
    try { setToast((await remindTask(id)).data.msg); } catch (e) { setToast(errText(e)); }
  };

  return (
    <>
      <div className="chat-head">
        <button className="icon-btn" onClick={() => nav('/admin/tasks')} aria-label="Orqaga"><ArrowLeft size={19} /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="chat-head-name">{data.task.title}</div>
          <div className="text-xs text-mute">Ijro nazorati</div>
        </div>
      </div>
      <div className="page" style={{ paddingBottom: 40 }}>
        <RecordCard record={data.task} showDept={false} />

        <div className="control-card mb-3">
          <div className="ring" style={{ ['--p' as string]: pct }}><span>{c.accepted}<small>/{c.total}</small></span></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="control-title">Ijro holati</div>
            <div className="control-sub">
              {data.deadline ? <><Clock3 size={13} /> {fmt(data.deadline)} · <b className={left?.late ? 'bad' : 'ok'}>{left?.txt}</b></> : 'Muddat belgilanmagan'}
            </div>
            <div className="task-stats" style={{ marginTop: 0 }}>
              {c.submitted > 0 && <span className="st-pill st-rev">{c.submitted} tekshiruvda</span>}
              {c.overdue > 0 && <span className="st-pill st-bad">{c.overdue} kechikdi</span>}
              {c.returned > 0 && <span className="st-pill st-ret">{c.returned} qaytarilgan</span>}
            </div>
            {todo.length > 0 && !confirmRemind && (
              <button className="btn btn-sm remind-btn mt-2" onClick={() => setConfirmRemind(true)}>
                <BellRing size={15} /> Bajarmaganlarga eslatma ({todo.length})
              </button>
            )}
            {confirmRemind && (
              <div className="confirm-row mt-2">
                <span>{todo.length} ta boʻlinmaga yuborilsinmi?</span>
                <button className="btn btn-primary btn-sm" onClick={remind}>Ha</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemind(false)}>Yoʻq</button>
              </div>
            )}
          </div>
        </div>

        <div className="chips mb-3">
          {([['all', `Hammasi ${c.total}`], ['submitted', `Tekshiruvda ${c.submitted}`], ['todo', `Bajarilmagan ${c.pending + c.returned}`], ['accepted', `Qabul ${c.accepted}`]] as [Filter, string][])
            .map(([k, l]) => <button key={k} className={`chip${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
        </div>

        {shown.map(r => {
          const expandable = !!r.report_text;
          const isOpen = open === r.unit_id || r.status === 'submitted';
          return (
            <div key={r.unit_id} className={`as-row${r.status === 'submitted' ? ' hot' : ''}`}>
              <button className="as-head" onClick={() => expandable && setOpen(open === r.unit_id ? null : r.unit_id)}>
                <span className="as-name">{r.unit_name}</span>
                <StatusPill status={r.status} overdue={r.overdue} />
              </button>
              {r.submitted_at && (
                <div className="as-sub">{r.submitted_by} · {fmt(r.submitted_at)}</div>
              )}
              {isOpen && r.report_text && (
                <div className="as-body">
                  {r.report ? <RecordCard record={r.report} showDept={false} /> : <div className="bubble-body">{r.report_text}</div>}
                  {r.review_note && <div className="as-note"><Undo2 size={13} /> {r.review_note}</div>}
                  {r.status === 'submitted' && (
                    returning === r.unit_id ? (
                      <div className="as-actions col">
                        <textarea placeholder="Qaytarish sababi (majburiy)…" value={note} onChange={e => setNote(e.target.value)} />
                        <div className="as-actions">
                          <button className="btn btn-danger btn-sm" disabled={!note.trim()} onClick={() => review(r, false)}><Undo2 size={15} /> Qaytarish</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setReturning(null); setNote(''); }}>Bekor</button>
                        </div>
                      </div>
                    ) : (
                      <div className="as-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => review(r, true)}><CheckCircle2 size={15} /> Qabul qilish</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setReturning(r.unit_id)}><Undo2 size={15} /> Qaytarish</button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {node}
    </>
  );
}

/* ══ BO'LINMA: ijro uchun telegrammalar (bosh sahifa bo'limi) ═══ */
export function UnitTasksSection() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<TaskListItem[]>([]);
  useEffect(() => { getTasks().then(r => setItems(r.data)).catch(() => {}); }, []);
  if (user?.role === 'admin' || items.length === 0) return null;
  const active = items.filter(t => t.status !== 'accepted');
  const show = active.length ? active : items.slice(0, 3);
  return (
    <>
      <div className="section-title">
        Ijro uchun telegrammalar {active.length > 0 && <span className="nav-badge" style={{ display: 'inline-grid', marginLeft: 6 }}>{active.length}</span>}
      </div>
      {show.map((t, i) => {
        const left = timeLeft(t.deadline);
        return (
          <button key={t.id} className="task-card" style={{ animationDelay: `${i * 30}ms` }} onClick={() => nav(`/tasks/${t.id}`)}>
            <div className="task-top">
              <div className="task-ico"><ScrollText size={20} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="task-title">{t.title}</div>
                <div className="task-meta">
                  {t.deadline && <span className={left?.late && t.status !== 'accepted' ? 'bad' : ''}><Clock3 size={12} /> {left?.txt}</span>}
                </div>
              </div>
              <StatusPill status={t.status!} overdue={!!t.overdue} />
            </div>
          </button>
        );
      })}
    </>
  );
}

/* ══ BO'LINMA: telegramma va "Bajarildi" ═════════════════════════ */
export function UnitTaskDetail() {
  const nav = useNavigate();
  const { taskId } = useParams();
  const id = Number(taskId);
  const [data, setData] = useState<TaskDetail | null>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setToast, node } = useToast();

  const load = useCallback(() => getTask(id).then(r => setData(r.data)).catch(e => setError(errText(e))), [id]);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <div className="page"><div className="empty"><div className="empty-title">{error}</div></div></div> : <div className="spinner" />;
  const mine = data.mine!;
  const left = timeLeft(data.deadline);
  const canSubmit = mine.status === 'pending' || mine.status === 'returned';

  const submit = async () => {
    if (!text.trim()) return setError('Nima bajarilganini qisqacha yozing.');
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('report_text', text.trim());
      files.forEach(f => fd.append('files', f));
      const r = await submitTask(id, fd);
      setToast(r.data.msg); setText(''); setFiles([]);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      load();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="chat-head no-nav">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="Orqaga"><ArrowLeft size={19} /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="chat-head-name">Telegramma ijrosi</div>
          <div className="text-xs text-mute">{mine.unit_name}</div>
        </div>
        <StatusPill status={mine.status} overdue={mine.overdue} />
      </div>
      <div className="page" style={{ paddingBottom: 40 }}>
        <RecordCard record={data.task} showDept={false} />

        {data.deadline && (
          <div className={`deadline-bar${left?.late && canSubmit ? ' late' : ''}`}>
            <Clock3 size={16} /> Muddat: <b>{fmt(data.deadline)}</b> <span>· {left?.txt}</span>
          </div>
        )}

        {mine.status === 'returned' && mine.review_note && (
          <div className="banner ret"><Undo2 size={16} /> <div><b>Qaytarildi:</b> {mine.review_note}</div></div>
        )}
        {mine.status === 'submitted' && (
          <div className="banner rev"><Clock3 size={16} /> <div>Hisobotingiz yuborildi — admin tekshirmoqda.</div></div>
        )}
        {mine.status === 'accepted' && (
          <div className="banner ok"><FileCheck2 size={16} /> <div><b>Ijro qabul qilindi.</b> Rahmat!</div></div>
        )}

        {mine.report && !canSubmit && (
          <>
            <div className="section-title">Sizning hisobotingiz</div>
            <RecordCard record={mine.report} showDept={false} mine />
          </>
        )}

        {canSubmit && (
          <div className="card mt-3">
            <div className="control-title mb-2">Bajarilganini belgilash</div>
            <div className="form-group">
              <label className="form-label">Nima bajarildi? (majburiy)</label>
              <textarea placeholder="Masalan: 3 ta greyder koʻrikdan oʻtkazildi, brigada tayyor…" value={text} onChange={e => setText(e.target.value)} />
            </div>
            <div className="form-group"><FilePicker files={files} setFiles={setFiles} /></div>
            {error && <div className="form-error mb-2">{error}</div>}
            <button className="btn btn-primary w-full" disabled={busy || !text.trim()} onClick={submit}>
              <CheckCircle2 size={17} /> {busy ? 'Yuborilmoqda…' : 'Bajarildi'}
            </button>
          </div>
        )}
      </div>
      {node}
    </>
  );
}
