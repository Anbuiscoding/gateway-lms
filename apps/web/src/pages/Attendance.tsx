import React, { useState } from 'react';
import { Check, Download, LogIn, LogOut, Plus } from 'lucide-react';
import { api, download, useApi, useSession } from '../session';
import { EmptyState, ErrorNote, Modal, Ring, useNow, useToast } from '../ui';

interface Rec { status: string | null; date: string; checkIn?: string | null; checkOut?: string | null; minutes?: number | null; note?: string }
interface Me { today: Rec | null; records: Rec[]; summary: { present: number; late: number; absent: number; leave: number } }
interface Roster { date: string; rows: (Rec & { user: { id: string; name: string; studentId?: string; batch?: string } })[]; summary: { total: number; present: number; late: number; absent: number; leave: number; unmarked: number } }
interface Leave { id: string; student?: { id: string; name: string; studentId?: string; batch?: string }; from: string; to: string; type: string; reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; decisionNote?: string }
interface Report { from: string; to: string; workingDays: number; rows: { id: string; name: string; studentId?: string; batch?: string; present: number; late: number; absent: number; leave: number; notMarked: number; hours: number; percent: number }[] }
const STATUS: [string, string][] = [['PRESENT', 'Present'], ['LATE', 'Late'], ['ABSENT', 'Absent'], ['LEAVE', 'Leave']];
const key = (d: Date) => d.toLocaleDateString('en-CA');
const t12 = (t?: string | null) => { if (!t) return '–'; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const dur = (m?: number | null) => (m == null ? '–' : `${Math.floor(m / 60)}h ${m % 60}m`);
const dayLabel = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const range = (l: Leave) => (l.from === l.to ? dayLabel(l.from) : `${dayLabel(l.from)} to ${dayLabel(l.to)}`);
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/* ---------------- Student ---------------- */
function LeaveForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = key(new Date());
  const [f, setF] = useState({ from: t, to: t, type: 'CASUAL', reason: '' });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setMsg(''); try { await api('/leaves', { method: 'POST', body: f }); onDone(); } catch (x) { setMsg(err(x)); } finally { setBusy(false); } }
  return (
    <Modal title="Apply for leave" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="two">
          <label>From<input type="date" required min={t} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></label>
          <label>To<input type="date" required min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        </div>
        <label>Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="CASUAL">Casual</option><option value="SICK">Sick</option><option value="OTHER">Other</option></select></label>
        <label>Reason<textarea className="plain" required minLength={3} maxLength={500} rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="A short reason helps your trainer decide quickly" /></label>
        <p className="muted">Weekends are not counted. Approved days appear as leave on your calendar.</p>
        {msg && <p className="auth-error" role="alert">{msg}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></div>
      </form>
    </Modal>
  );
}

function StudentAttendance() {
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const { data, error } = useApi<Me>('/attendance/me?r=' + tick);
  const leaves = useApi<Leave[]>('/leaves?r=' + tick);
  const [msg, setMsg] = useState(''); const [applying, setApplying] = useState(false);
  const now = useNow(1000);
  const act = async (p: string) => { setMsg(''); try { await api(p, { method: 'POST', body: {} }); toast.success(p.endsWith('check-in') ? 'You are checked in. Have a great session!' : 'You are checked out. See you next time!'); setTick((n) => n + 1); } catch (e) { setMsg(err(e)); toast.error(err(e)); } };
  const withdraw = async (l: Leave) => { if (confirm('Withdraw this leave request?')) { try { await api('/leaves/' + l.id, { method: 'DELETE' }); toast.success('Leave request withdrawn'); setTick((n) => n + 1); } catch (e) { setMsg(err(e)); } } };
  const days = Array.from({ length: 35 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (34 - i)); return d; });
  const by = new Map<string, Rec>((data?.records ?? []).map((r): [string, Rec] => [r.date, r]));
  const checked = !!data?.today?.checkIn, out = !!data?.today?.checkOut;
  const total = data ? data.summary.present + data.summary.late + data.summary.absent : 0;
  return <>
    <section className="panel spot att-me">
      <div className="att-clock">
        <p className="eyebrow">Today</p>
        <h2>{new Date(now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</h2>
        <p className="muted">{new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div className="actions left">
          <button className="btn glow" disabled={checked} onClick={() => act('/attendance/check-in')}><LogIn size={16} /> {checked ? `Checked in ${t12(data?.today?.checkIn)}` : 'Check in'}</button>
          <button className="btn ghost" disabled={!checked || out} onClick={() => act('/attendance/check-out')}><LogOut size={16} /> {out ? `Out ${t12(data?.today?.checkOut)}` : 'Check out'}</button>
        </div>
        {data?.today?.status === 'LATE' && <p className="muted">Marked late today.</p>}
        {data?.today?.status === 'LEAVE' && <p className="muted">You are on approved leave today.</p>}
        {(msg || error) && <p className="auth-error" role="alert">{msg || error}</p>}
      </div>
      <div className="att-heat">
        <p className="eyebrow">Last 5 weeks</p>
        <div className="heat" role="img" aria-label="Attendance calendar">{days.map((d) => { const r = by.get(key(d)); return <i key={key(d)} title={`${key(d)}: ${r?.status?.toLowerCase() ?? 'no record'}`} className={'h ' + (r?.status?.toLowerCase() ?? '') + ([0, 6].includes(d.getDay()) ? ' we' : '')} />; })}</div>
        <div className="legend"><span><i className="h present" /> Present</span><span><i className="h late" /> Late</span><span><i className="h absent" /> Absent</span><span><i className="h leave" /> Leave</span></div>
      </div>
      <Ring value={total ? Math.round(((data!.summary.present + data!.summary.late) / total) * 100) : 0} size={110} stroke={10} />
    </section>
    <section className="panel spot">
      <header><div><p className="eyebrow">Time off</p><h2>My leave</h2></div><button className="btn" onClick={() => setApplying(true)}><Plus size={15} /> Apply for leave</button></header>
      {leaves.data?.length ? leaves.data.map((l) => (
        <div className="row" key={l.id}>
          <div className="grow"><h3>{range(l)} · {l.type.toLowerCase()}</h3><p>{l.reason}{l.decisionNote ? ` · Trainer note: ${l.decisionNote}` : ''}</p></div>
          <span className={'tag ' + l.status.toLowerCase()}>{l.status.toLowerCase()}</span>
          {l.status === 'PENDING' && <button className="btn ghost sm" onClick={() => withdraw(l)}>Withdraw</button>}
        </div>)) : <p className="empty">No leave requests yet.</p>}
    </section>
    {applying && <LeaveForm onClose={() => setApplying(false)} onDone={() => { setApplying(false); setTick((n) => n + 1); toast.success('Leave request sent. Your trainer will review it.'); }} />}
  </>;
}

/* ---------------- Trainer and admin ---------------- */
function Daily() {
  const toast = useToast();
  const [date, setDate] = useState(key(new Date()));
  const [batchInput, setBatchInput] = useState(''); const [batch, setBatch] = useState('');
  const [tick, setTick] = useState(0); const [msg, setMsg] = useState('');
  const { data, loading, error } = useApi<Roster>(`/attendance?date=${date}&batch=${encodeURIComponent(batch)}&r=${tick}`);
  const save = async (userId: string, body: Record<string, unknown>, quiet = false) => { setMsg(''); try { await api('/attendance/mark', { method: 'POST', body: { userId, date, ...body } }); if (!quiet) toast.success('Attendance saved'); setTick((n) => n + 1); } catch (e) { setMsg(err(e)); toast.error(err(e)); setTick((n) => n + 1); } };
  const time = (r: Roster['rows'][number], field: 'checkIn' | 'checkOut', v: string) => { if ((r[field] || '') !== v) save(r.user.id, { [field]: v || null }); };
  const allPresent = async () => { const todo = (data?.rows ?? []).filter((r) => !r.status); if (!todo.length) { toast.info('Everyone is already marked'); return; } await Promise.all(todo.map((r) => save(r.user.id, { status: 'PRESENT' }, true))); toast.success(`${todo.length} student${todo.length > 1 ? 's' : ''} marked present`); };
  return (
    <section className="panel spot">
      <header><div><p className="eyebrow">Learners</p><h2>Daily attendance</h2></div>
        <form className="actions left" onSubmit={(e) => { e.preventDefault(); setBatch(batchInput.trim()); }}>
          <input type="date" value={date} max={key(new Date())} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <input value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder="Batch (optional)" aria-label="Batch" className="narrow" />
          <button className="btn ghost sm">Filter</button>
          <button type="button" className="btn ghost sm" onClick={allPresent}><Check size={14} /> Mark unmarked present</button>
        </form>
      </header>
      {data && <div className="chips"><span className="tag">{data.summary.present} present</span><span className="tag warn">{data.summary.late} late</span><span className="tag absent">{data.summary.absent} absent</span><span className="tag leave">{data.summary.leave} on leave</span><span className="tag">{data.summary.unmarked} not marked</span></div>}
      {loading && !data && <div className="skeleton tall" />}
      {(error || msg) && <ErrorNote text={error || msg} onRetry={() => setTick((n) => n + 1)} />}
      {data && !data.rows.length && <EmptyState compact title="No active students" text={batch ? `Nobody is in batch ${batch}. Clear the filter to see everyone.` : 'Add students first, then mark their attendance here.'} />}
      <div className="roster">{data?.rows.map((r) => (
        <div className="row" key={r.user.id}>
          <i className="avatar sm">{r.user.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</i>
          <div className="grow"><h3>{r.user.name}</h3><p>{r.user.studentId} · {r.user.batch || 'No batch'}</p></div>
          <label className="tm">In<input type="time" defaultValue={r.checkIn || ''} key={r.user.id + 'i' + (r.checkIn || '')} onBlur={(e) => time(r, 'checkIn', e.target.value)} aria-label={`Check-in for ${r.user.name}`} /></label>
          <label className="tm">Out<input type="time" defaultValue={r.checkOut || ''} key={r.user.id + 'o' + (r.checkOut || '')} onBlur={(e) => time(r, 'checkOut', e.target.value)} aria-label={`Check-out for ${r.user.name}`} /></label>
          <span className="hrs">{dur(r.minutes)}</span>
          <div className="seg small" role="group" aria-label={`Status for ${r.user.name}`}>{STATUS.map(([s, l]) => <button key={s} className={(r.status === s ? 'on ' : '') + s.toLowerCase()} onClick={() => save(r.user.id, { status: s })} aria-pressed={r.status === s}>{l}</button>)}</div>
        </div>))}</div>
    </section>
  );
}

function Leaves() {
  const toast = useToast();
  const [tick, setTick] = useState(0); const [all, setAll] = useState(false);
  const { data, loading, error } = useApi<Leave[]>(`/leaves?${all ? '' : 'status=PENDING&'}r=${tick}`);
  const [deciding, setDeciding] = useState<{ l: Leave; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState(''); const [msg, setMsg] = useState('');
  async function confirm() {
    if (!deciding) return;
    try { await api(`/leaves/${deciding.l.id}/decide`, { method: 'POST', body: { decision: deciding.decision, note: note || undefined } }); setDeciding(null); setNote(''); setTick((n) => n + 1); toast.success(deciding.decision === 'APPROVED' ? 'Leave approved and added to attendance' : 'Leave request rejected'); } catch (e) { setMsg(err(e)); }
  }
  return (
    <section className="panel spot">
      <header><div><p className="eyebrow">Time off</p><h2>Leave requests</h2></div><div className="seg"><button className={!all ? 'on' : ''} onClick={() => setAll(false)}>Pending</button><button className={all ? 'on' : ''} onClick={() => setAll(true)}>All</button></div></header>
      {loading && !data && <div className="skeleton tall" />}
      {error && <ErrorNote text={error} onRetry={() => setTick((n) => n + 1)} />}
      {data && !data.length && <EmptyState compact title={all ? 'No leave requests yet' : 'Nothing is waiting'} text={all ? 'Requests from students appear here.' : 'You are all caught up on leave requests.'} />}
      {data?.map((l) => (
        <div className="row" key={l.id}>
          <i className="avatar sm">{(l.student?.name ?? '?').split(' ').map((x) => x[0]).slice(0, 2).join('')}</i>
          <div className="grow"><h3>{l.student?.name} · {range(l)}</h3><p>{l.type.toLowerCase()} · {l.reason}{l.decisionNote ? ` · Note: ${l.decisionNote}` : ''}</p></div>
          {l.status === 'PENDING'
            ? <div className="actions"><button className="btn sm" onClick={() => setDeciding({ l, decision: 'APPROVED' })}>Approve</button><button className="btn ghost sm" onClick={() => setDeciding({ l, decision: 'REJECTED' })}>Reject</button></div>
            : <span className={'tag ' + l.status.toLowerCase()}>{l.status.toLowerCase()}</span>}
        </div>))}
      {deciding && (
        <Modal title={deciding.decision === 'APPROVED' ? 'Approve leave' : 'Reject leave'} onClose={() => setDeciding(null)}>
          <div className="form">
            <p><b>{deciding.l.student?.name}</b> · {range(deciding.l)}<br /><span className="muted">{deciding.l.reason}</span></p>
            {deciding.decision === 'APPROVED' && <p className="muted">Weekdays in this range will be marked as leave in attendance.</p>}
            <label>Note for the student (optional)<textarea className="plain" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {msg && <p className="auth-error" role="alert">{msg}</p>}
            <div className="actions"><button className="btn ghost" onClick={() => setDeciding(null)}>Cancel</button><button className="btn" onClick={confirm}>{deciding.decision === 'APPROVED' ? 'Approve' : 'Reject'}</button></div>
          </div>
        </Modal>)}
    </section>
  );
}

function Reports() {
  const toast = useToast();
  const today = new Date();
  const [from, setFrom] = useState(key(new Date(today.getFullYear(), today.getMonth(), 1))); const [to, setTo] = useState(key(today));
  const [batchInput, setBatchInput] = useState(''); const [batch, setBatch] = useState(''); const [msg, setMsg] = useState('');
  const q = `from=${from}&to=${to}&batch=${encodeURIComponent(batch)}`;
  const { data, loading, error } = useApi<Report>('/attendance/report?' + q);
  const get = async (type: 'summary' | 'detail') => { setMsg(''); try { await download(`/attendance/export?${q}&type=${type}`, `attendance-${type}.csv`); toast.success('Your CSV file is downloading'); } catch (e) { setMsg(err(e)); } };
  return (
    <section className="panel spot">
      <header><div><p className="eyebrow">Reports</p><h2>Attendance report</h2></div>
        <form className="actions left" onSubmit={(e) => { e.preventDefault(); setBatch(batchInput.trim()); }}>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <input type="date" value={to} min={from} max={key(today)} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <input value={batchInput} onChange={(e) => setBatchInput(e.target.value)} placeholder="Batch (optional)" aria-label="Batch" className="narrow" />
          <button className="btn ghost sm">Apply</button>
        </form>
      </header>
      <div className="actions left exports"><button className="btn" onClick={() => get('summary')}><Download size={15} /> Summary CSV</button><button className="btn ghost" onClick={() => get('detail')}><Download size={15} /> Daily records CSV</button>{data && <small className="muted">{data.workingDays} working days in this range (Monday to Friday)</small>}</div>
      {(error || msg) && <p className="notice" role="alert">{error || msg}</p>}
      {loading && !data && <div className="skeleton tall" />}
      {data && <div className="tablewrap"><table>
        <thead><tr><th>Student</th><th>Batch</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th><th>Not marked</th><th>Hours</th><th>Attendance</th></tr></thead>
        <tbody>{data.rows.map((r) => <tr key={r.id}><td><b>{r.name}</b><br /><small>{r.studentId}</small></td><td>{r.batch}</td><td>{r.present}</td><td>{r.late}</td><td>{r.absent}</td><td>{r.leave}</td><td>{r.notMarked}</td><td>{r.hours}</td><td><div className="pbar"><i style={{ width: Math.min(100, r.percent) + '%' }} /><span>{r.percent}%</span></div></td></tr>)}
          {!data.rows.length && <tr><td colSpan={9} className="empty">No students match.</td></tr>}</tbody>
      </table></div>}
    </section>
  );
}

function StaffAttendance() {
  const [tab, setTab] = useState<'daily' | 'leave' | 'report'>('daily');
  return <>
    <div className="seg tabs"><button className={tab === 'daily' ? 'on' : ''} onClick={() => setTab('daily')}>Daily</button><button className={tab === 'leave' ? 'on' : ''} onClick={() => setTab('leave')}>Leave requests</button><button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>Reports and export</button></div>
    {tab === 'daily' && <Daily />}{tab === 'leave' && <Leaves />}{tab === 'report' && <Reports />}
  </>;
}

export function AttendanceView() {
  const { session } = useSession();
  if (!session) return null;
  const student = session.user.role === 'STUDENT';
  return <>
    <div className="pagehead"><p className="eyebrow">Attendance</p><h1>{student ? 'My attendance' : 'Student attendance'}</h1><p className="intro">{student ? 'Check in when you start and check out when you finish. Apply for leave below.' : 'Check student times, correct them if needed, handle leave requests and export reports. Staff attendance is kept in the HR workspace.'}</p></div>
    {student ? <StudentAttendance /> : <StaffAttendance />}
  </>;
}
