import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Plus, Search } from 'lucide-react';
import { api, useApi, useSession } from '../session';
import { EmptyState, ErrorNote, Modal, useToast } from '../ui';

interface S { id: string; name: string; email: string; studentId?: string; program?: string; batch?: string; phone?: string; active: boolean }
const tel = (p: string) => 'tel:' + p.replace(/[^+\d]/g, '');
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function AddStudent({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const courses = useApi<{ _id: string; title: string; status: string }[]>('/courses');
  const [picked, setPicked] = useState<string[]>([]);
  const [f, setF] = useState({ name: '', email: '', phone: '', program: '', batch: '' });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ student: S; temporaryPassword: string; enrolled?: number } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try { const r = await api<{ student: S; temporaryPassword: string; enrolled?: number }>('/students', { method: 'POST', body: { ...f, phone: f.phone || undefined, program: f.program || undefined, batch: f.batch || undefined, courseIds: picked } }); setMade(r); toast.success(r.enrolled ? `Student added and enrolled in ${r.enrolled} course${r.enrolled > 1 ? 's' : ''}` : 'Student added'); }
    catch (x) { setMsg(err(x)); } finally { setBusy(false); }
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); toast.success('Sign-in details copied'); } catch { toast.error('Your browser blocked copying. Select the text and copy it by hand.'); } }
  if (made) return (
    <Modal title="Student added" onClose={onDone}>
      <div className="form">
        <p><b>{made.student.name}</b> now has the ID <b>{made.student.studentId}</b>{made.enrolled ? ` and is enrolled in ${made.enrolled} course${made.enrolled > 1 ? 's' : ''}` : ''}. Share these sign-in details privately. The password is shown only once.</p>
        <div className="cred"><span>{made.student.email}</span><code>{made.temporaryPassword}</code><button className="btn ghost" onClick={() => copy(`${made.student.email}\n${made.temporaryPassword}`)}><Copy size={15} /> Copy</button></div>
        <p className="muted">They can change this password under Settings after signing in.</p>
        <div className="actions"><a className="btn ghost" href={`mailto:${made.student.email}?subject=${encodeURIComponent('Your Gateway LMS sign-in')}&body=${encodeURIComponent(`Hello ${made.student.name},\n\nYour Gateway LMS account is ready.\nEmail: ${made.student.email}\nTemporary password: ${made.temporaryPassword}\n\nPlease change your password under Settings after you sign in.`)}`}>Email these details</a><button className="btn" onClick={onDone}>Done</button></div>
      </div>
    </Modal>
  );
  return (
    <Modal title="Add a student" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="two">
          <label>Full name<input required minLength={2} autoComplete="off" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Email address<input type="email" required autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label>Phone (optional)<input type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label>Batch (optional)<input value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} placeholder="e.g. DS-AI-24" /></label>
          <label>Program (optional)<input value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} placeholder="e.g. Data Science & AI" /></label>
        </div>
        {courses.data && courses.data.length > 0 && <fieldset className="pick"><legend>Enrol in courses (optional)</legend>{courses.data.map((c) => <label key={c._id} className="check"><input type="checkbox" checked={picked.includes(c._id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c._id] : picked.filter((x) => x !== c._id))} /> {c.title}{c.status !== 'PUBLISHED' && <span className="tag warn">{c.status.toLowerCase()}</span>}</label>)}</fieldset>}
        <p className="muted">A student ID and a temporary password are created automatically.</p>
        {msg && <p className="auth-error" role="alert">{msg}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add student'}</button></div>
      </form>
    </Modal>
  );
}

export function StudentsView() {
  const { session } = useSession(); const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, error, loading, reload } = useApi<S[]>('/students');
  const [q, setQ] = useState(''); const [adding, setAdding] = useState(false);
  useEffect(() => { if (params.get('new')) { setAdding(true); setParams({}, { replace: true }); } }, [params, setParams]);
  if (!session) return null;
  const admin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';
  const rows = (data ?? []).filter((s) => (s.name + s.email + (s.studentId ?? '') + (s.batch ?? '')).toLowerCase().includes(q.toLowerCase()));
  const toggle = async (s: S) => { try { await api('/students/' + s.id, { method: 'PATCH', body: { active: !s.active } }); toast.success(`${s.name} was ${s.active ? 'disabled' : 'enabled'}`); reload(); } catch (e) { toast.error(err(e)); } };
  return <>
    <div className="pagehead row-between">
      <div><p className="eyebrow">People</p><h1>Students</h1><p className="intro">{admin ? 'Add learners and manage their access.' : 'Learners enrolled on the platform.'}</p></div>
      {admin && <button className="btn glow" onClick={() => setAdding(true)}><Plus size={16} /> Add student</button>}
    </div>
    <div className="searchbar"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, ID or batch" aria-label="Search students" /></div>
    {loading && !data && <div className="skeleton tall" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && !data.length && <section className="panel"><EmptyState compact title="No students yet" text={admin ? 'Add your first student to get started.' : 'Students appear here once an administrator adds them.'}>{admin && <button className="btn" onClick={() => setAdding(true)}>Add a student</button>}</EmptyState></section>}
    {data && data.length > 0 && <div className="tablewrap"><table>
      <thead><tr><th>Student</th><th>Contact</th><th>ID</th><th>Program</th><th>Batch</th><th>Status</th>{admin && <th />}</tr></thead>
      <tbody>{rows.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td><a href={`mailto:${s.email}`}>{s.email}</a>{s.phone && <><br /><a href={tel(s.phone)}>{s.phone}</a></>}</td><td>{s.studentId}</td><td>{s.program || '–'}</td><td>{s.batch || '–'}</td><td><span className={'tag' + (s.active ? '' : ' warn')}>{s.active ? 'Active' : 'Disabled'}</span></td>{admin && <td><button className="btn ghost sm" onClick={() => toggle(s)}>{s.active ? 'Disable' : 'Enable'}</button></td>}</tr>)}
        {!rows.length && <tr><td colSpan={7} className="empty">No students match “{q}”.</td></tr>}</tbody>
    </table></div>}
    {adding && <AddStudent onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
  </>;
}
