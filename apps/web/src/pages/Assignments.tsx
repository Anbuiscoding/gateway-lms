import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, useApi, useSession } from '../session';
import { EmptyState, ErrorNote, Modal, Ring, useNow, useToast } from '../ui';

interface My { status: 'SUBMITTED' | 'GRADED'; submittedAt: string; late: boolean; marks?: number; feedback?: string; answer?: string; link?: string }
interface A { id: string; title: string; instructions: string; batch: string; dueAt: string; maxMarks: number; allowLate: boolean; createdBy: { id: string; name: string }; state?: 'TODO' | 'OVERDUE' | 'SUBMITTED' | 'GRADED'; my?: My | null; total?: number; submitted?: number; graded?: number }
interface Detail extends A { canManage?: boolean; rows?: { student: { id: string; name: string; studentId?: string; batch?: string }; submission: My | null }[] }

const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
function dueText(iso: string, now: number) {
  const d = new Date(iso).getTime() - now, a = Math.abs(d), m = Math.floor(a / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24);
  const span = days ? `${days}d ${h % 24}h` : h ? `${h}h ${m % 60}m` : `${m}m`;
  return d >= 0 ? `Due in ${span}` : `Overdue by ${span}`;
}

/* ---------------- Student ---------------- */
function Work({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const { data, loading, error } = useApi<Detail>('/assignments/' + id);
  const [answer, setAnswer] = useState<string | null>(null); const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const now = useNow(60000);
  if (loading) return <Modal title="Assignment" onClose={onClose}><div className="skeleton tall" /></Modal>;
  if (!data) return <Modal title="Assignment" onClose={onClose}><p className="notice" role="alert">{error}</p></Modal>;
  const my = data.my; const graded = my?.status === 'GRADED';
  const closed = !my && !data.allowLate && new Date(data.dueAt) < new Date();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try { await api(`/assignments/${id}/submit`, { method: 'POST', body: { answer: answer ?? my?.answer ?? '', link: link ?? my?.link ?? '' } }); onDone(); } catch (x) { setMsg(err(x)); } finally { setBusy(false); }
  }
  return (
    <Modal title={data.title} onClose={onClose}>
      <div className="form">
        <p className="muted">{data.createdBy.name} · {dueText(data.dueAt, now)} ({when(data.dueAt)}) · {data.maxMarks} marks{!data.allowLate && ' · no late submissions'}</p>
        {data.instructions && <p className="prewrap">{data.instructions}</p>}
        {graded && <div className="grade-card"><Ring value={Math.round(((my!.marks ?? 0) / data.maxMarks) * 100)} size={90} stroke={9} label={`${my!.marks}/${data.maxMarks}`} /><div><b>Graded</b><p className="prewrap">{my!.feedback || 'No written feedback.'}</p></div></div>}
        {closed ? <p className="notice" role="alert">The deadline has passed and late submissions are not accepted for this assignment.</p> : (
          <form className="form" onSubmit={submit}>
            <label>Your answer<textarea className="plain mono" rows={8} disabled={graded} value={answer ?? my?.answer ?? ''} onChange={(e) => setAnswer(e.target.value)} placeholder="Paste your code or write your answer" /></label>
            <label>Link (optional)<input type="url" disabled={graded} value={link ?? my?.link ?? ''} onChange={(e) => setLink(e.target.value)} placeholder="https://github.com/you/project" /></label>
            {my && <p className="muted">Submitted {when(my.submittedAt)}{my.late && ' (late)'}. {graded ? 'Graded work cannot be changed.' : 'You can update it until it is graded.'}</p>}
            {msg && <p className="auth-error" role="alert">{msg}</p>}
            {!graded && <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Close</button><button className="btn" disabled={busy}>{busy ? 'Submitting…' : my ? 'Update submission' : 'Submit'}</button></div>}
          </form>)}
      </div>
    </Modal>
  );
}

function StudentView() {
  const toast = useToast();
  const [tick, setTick] = useState(0); const [open, setOpen] = useState('');
  const { data, loading, error, reload } = useApi<A[]>('/assignments?r=' + tick);
  const now = useNow(60000);
  const group = (...s: string[]) => (data ?? []).filter((a) => s.includes(a.state ?? ''));
  const card = (a: A) => (
    <button key={a.id} className={'ticket asg spot ' + (a.state === 'OVERDUE' ? 'warn' : a.state === 'GRADED' ? 'ok' : '')} onClick={() => setOpen(a.id)}>
      <b>{a.title}</b><p>{a.createdBy.name} · {a.maxMarks} marks</p>
      {a.state === 'GRADED' ? <time>{a.my?.marks}/{a.maxMarks}</time> : a.state === 'SUBMITTED' ? <time>Submitted{a.my?.late ? ' late' : ''}</time> : <time>{dueText(a.dueAt, now)}</time>}
    </button>
  );
  const sect = (title: string, list: A[], empty: string) => <><h2 className="sect">{title} {list.length > 0 && <span className="count">{list.length}</span>}</h2>{list.length ? <div className="tickets">{list.map(card)}</div> : <p className="empty">{empty}</p>}</>;
  return <>
    {loading && !data && <div className="skeleton tall" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && !data.length && <section className="panel"><EmptyState compact title="No assignments yet" text="When your trainer sets work, it appears here with its deadline." /></section>}
    {data && data.length > 0 && <>{sect('To do', group('TODO', 'OVERDUE'), 'You are all caught up.')}{sect('Waiting for grading', group('SUBMITTED'), 'Nothing waiting.')}{sect('Graded', group('GRADED'), 'Graded work will show here.')}</>}
    {open && <Work id={open} onClose={() => setOpen('')} onDone={() => { setOpen(''); setTick((n) => n + 1); toast.success('Submitted. Your trainer will grade it soon.'); }} />}
  </>;
}

/* ---------------- Trainer and admin ---------------- */
function Editor({ a, onClose, onDone }: { a: A | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: a?.title ?? '', instructions: a?.instructions ?? '', batch: a?.batch ?? '', maxMarks: String(a?.maxMarks ?? 100), allowLate: a?.allowLate ?? true, dueAt: localInput(a ? new Date(a.dueAt) : new Date(Date.now() + 3 * 864e5)) });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try { await api(a ? '/assignments/' + a.id : '/assignments', { method: a ? 'PATCH' : 'POST', body: { ...f, maxMarks: Number(f.maxMarks), dueAt: new Date(f.dueAt).toISOString() } }); onDone(); } catch (x) { setMsg(err(x)); } finally { setBusy(false); }
  }
  return (
    <Modal title={a ? 'Edit assignment' : 'New assignment'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Title<input required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label>Instructions<textarea className="plain" rows={5} maxLength={5000} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} placeholder="What should students do? Include what to submit." /></label>
        <div className="two">
          <label>Deadline<input type="datetime-local" required value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></label>
          <label>Total marks<input type="number" min={1} max={1000} required value={f.maxMarks} onChange={(e) => setF({ ...f, maxMarks: e.target.value })} /></label>
          <label>Batch (leave empty for everyone)<input value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} placeholder="e.g. DS-AI-24" /></label>
          <label className="check"><input type="checkbox" checked={f.allowLate} onChange={(e) => setF({ ...f, allowLate: e.target.checked })} /> Accept late submissions</label>
        </div>
        {msg && <p className="auth-error" role="alert">{msg}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Saving…' : a ? 'Save changes' : 'Create assignment'}</button></div>
      </form>
    </Modal>
  );
}

function Submissions({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const { data, loading, error } = useApi<Detail>(`/assignments/${id}?r=${tick}`);
  const [sel, setSel] = useState(''); const [marks, setMarks] = useState<string | null>(null); const [fb, setFb] = useState<string | null>(null);
  const [only, setOnly] = useState(false); const [msg, setMsg] = useState('');
  if (loading && !data) return <Modal title="Submissions" onClose={onClose}><div className="skeleton tall" /></Modal>;
  if (!data) return <Modal title="Submissions" onClose={onClose}><p className="notice" role="alert">{error}</p></Modal>;
  const rows = (data.rows ?? []).filter((r) => !only || r.submission?.status === 'SUBMITTED');
  const cur = data.rows?.find((r) => r.student.id === sel);
  const pick = (sid: string) => { setSel(sid); setMarks(null); setFb(null); setMsg(''); };
  async function grade(e: React.FormEvent) {
    e.preventDefault(); if (!cur) return; setMsg('');
    try { await api(`/assignments/${id}/grade`, { method: 'POST', body: { studentId: cur.student.id, marks: Number(marks ?? cur.submission?.marks ?? 0), feedback: fb ?? cur.submission?.feedback ?? '' } }); setTick((n) => n + 1); onChanged(); setMarks(null); setFb(null); toast.success('Grade saved'); } catch (x) { setMsg(err(x)); }
  }
  return (
    <Modal title={data.title} onClose={onClose}>
      <div className="subs">
        <div className="sublist">
          <label className="check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Needs grading only</label>
          {rows.map((r) => <button key={r.student.id} className={'subrow' + (sel === r.student.id ? ' on' : '')} onClick={() => pick(r.student.id)}>
            <span><b>{r.student.name}</b><small>{r.student.studentId}</small></span>
            <span className={'tag ' + (r.submission ? (r.submission.status === 'GRADED' ? 'approved' : 'warn') : 'absent')}>{r.submission ? (r.submission.status === 'GRADED' ? `${r.submission.marks}/${data.maxMarks}` : 'To grade') : 'Missing'}</span>
          </button>)}
          {!rows.length && <p className="empty">Nothing to show.</p>}
        </div>
        <div className="subview">
          {!cur && <p className="empty">Select a student to read their work.</p>}
          {cur && !cur.submission && <p className="empty">{cur.student.name} has not submitted yet.</p>}
          {cur?.submission && <form className="form" onSubmit={grade}>
            <p className="muted">Submitted {when(cur.submission.submittedAt)}{cur.submission.late && ' (late)'}</p>
            {cur.submission.answer && <pre className="answer">{cur.submission.answer}</pre>}
            {cur.submission.link && <p><a href={cur.submission.link} target="_blank" rel="noopener noreferrer">Open the submitted link</a></p>}
            {data.canManage ? <>
              <label>Marks (out of {data.maxMarks})<input type="number" min={0} max={data.maxMarks} step="0.5" required value={marks ?? cur.submission.marks ?? ''} onChange={(e) => setMarks(e.target.value)} /></label>
              <label>Feedback<textarea className="plain" rows={3} maxLength={2000} value={fb ?? cur.submission.feedback ?? ''} onChange={(e) => setFb(e.target.value)} placeholder="What went well, and what to improve" /></label>
              {msg && <p className="auth-error" role="alert">{msg}</p>}
              <div className="actions"><button className="btn">{cur.submission.status === 'GRADED' ? 'Update grade' : 'Save grade'}</button></div>
            </> : <p className="muted">Only the trainer who created this assignment can grade it.</p>}
          </form>}
        </div>
      </div>
    </Modal>
  );
}

function StaffView() {
  const toast = useToast();
  const [tick, setTick] = useState(0); const [edit, setEdit] = useState<A | 'new' | null>(null); const [view, setView] = useState('');
  const { data, loading, error } = useApi<A[]>('/assignments?r=' + tick);
  const now = useNow(60000); const [msg, setMsg] = useState('');
  const remove = async (a: A) => { if (confirm(`Delete “${a.title}” and all its submissions?`)) { try { await api('/assignments/' + a.id, { method: 'DELETE' }); toast.success('Assignment deleted'); setTick((n) => n + 1); } catch (e) { setMsg(err(e)); } } };
  return <>
    <div className="pagehead row-between">
      <div><p className="eyebrow">Evaluation</p><h1>Assignments</h1><p className="intro">Create work, collect submissions and give marks with feedback.</p></div>
      <button className="btn glow" onClick={() => setEdit('new')}><Plus size={16} /> New assignment</button>
    </div>
    {loading && !data && <div className="skeleton tall" />}
    {(error || msg) && <p className="notice" role="alert">{error || msg}</p>}
    {data && !data.length && <section className="panel"><EmptyState compact title="No assignments yet" text="Create the first one, set a deadline and students will see it at once."><button className="btn" onClick={() => setEdit('new')}>New assignment</button></EmptyState></section>}
    <div className="cards">{data?.map((a) => {
      const toGrade = (a.submitted ?? 0) - (a.graded ?? 0);
      return (
        <article className="panel spot asgcard" key={a.id}>
          <span className="tag">{a.batch || 'All students'}</span>
          <h3>{a.title}</h3>
          <p className="muted">{dueText(a.dueAt, now)} · {a.maxMarks} marks · {a.createdBy.name}</p>
          <div className="progress"><i style={{ width: (a.total ? ((a.submitted ?? 0) / a.total) * 100 : 0) + '%' }} /></div>
          <p className="muted">{a.submitted ?? 0} of {a.total ?? 0} submitted · {a.graded ?? 0} graded{toGrade > 0 && <> · <b className="needs">{toGrade} to grade</b></>}</p>
          <div className="actions left"><button className="btn" onClick={() => setView(a.id)}>Submissions</button><button className="btn ghost sm" onClick={() => setEdit(a)} aria-label="Edit"><Pencil size={14} /></button><button className="btn ghost sm" onClick={() => remove(a)} aria-label="Delete"><Trash2 size={14} /></button></div>
        </article>);
    })}</div>
    {edit && <Editor a={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { toast.success(edit === 'new' ? 'Assignment created' : 'Assignment updated'); setEdit(null); setTick((n) => n + 1); }} />}
    {view && <Submissions id={view} onClose={() => setView('')} onChanged={() => setTick((n) => n + 1)} />}
  </>;
}

export function AssignmentsView() {
  const { session } = useSession();
  if (!session) return null;
  if (session.user.role !== 'STUDENT') return <StaffView />;
  return <><div className="pagehead"><p className="eyebrow">Evaluation</p><h1>Assignments</h1><p className="intro">Submit your work, see your marks and read feedback.</p></div><StudentView /></>;
}
