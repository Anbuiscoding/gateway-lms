import React, { useState } from 'react';
import { Search, UserMinus, UserPlus } from 'lucide-react';
import { api, useApi } from '../session';
import { EmptyState, ErrorNote, Modal, useToast } from '../ui';

interface En { id: string; student: { id: string; name: string; studentId?: string; batch?: string }; progress: number; completed: number; total: number }
interface S { id: string; name: string; studentId?: string; batch?: string; active: boolean }
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** Who is on this course: see progress, add students one by one or a whole batch, remove students. */
export function EnrollModal({ courseId, title, onClose, onChanged }: { courseId: string; title: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'in' | 'add'>('in'); const [tick, setTick] = useState(0);
  const en = useApi<En[]>(`/courses/${courseId}/enrollments?r=${tick}`);
  const st = useApi<S[]>('/students');
  const [q, setQ] = useState(''); const [picked, setPicked] = useState<string[]>([]); const [batch, setBatch] = useState(''); const [busy, setBusy] = useState(false);
  const enrolled = new Set((en.data ?? []).map((e) => e.student.id));
  const active = (st.data ?? []).filter((s) => s.active);
  const left = (b: string) => active.filter((s) => s.batch === b && !enrolled.has(s.id)).length;
  const batches = [...new Set(active.filter((s) => s.batch).map((s) => s.batch as string))].sort();
  const candidates = active.filter((s) => !enrolled.has(s.id) && (s.name + (s.studentId ?? '') + (s.batch ?? '')).toLowerCase().includes(q.toLowerCase()));

  async function enrol(body: { studentIds?: string[]; batch?: string }) {
    setBusy(true);
    try {
      const r = await api<{ added: number; skipped: number }>(`/courses/${courseId}/enroll`, { method: 'POST', body });
      toast[r.added ? 'success' : 'info'](r.added ? `${r.added} student${r.added > 1 ? 's' : ''} enrolled${r.skipped ? `, ${r.skipped} already on the course` : ''}` : body.batch ? 'No new students to add from that batch' : 'Everyone you chose was already enrolled');
      setPicked([]); setTick((n) => n + 1); onChanged();
    } catch (e) { toast.error(err(e)); } finally { setBusy(false); }
  }
  async function remove(e: En) {
    if (!confirm(`Remove ${e.student.name} from this course? Their progress on it is deleted.`)) return;
    try { await api(`/courses/${courseId}/enrollments/${e.student.id}`, { method: 'DELETE' }); toast.success(`${e.student.name} was removed from the course`); setTick((n) => n + 1); onChanged(); } catch (x) { toast.error(err(x)); }
  }
  return (
    <Modal title={`Students in ${title}`} onClose={onClose}>
      <div className="seg tabs" role="tablist"><button className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>Enrolled{en.data ? ` (${en.data.length})` : ''}</button><button className={tab === 'add' ? 'on' : ''} onClick={() => setTab('add')}>Add students</button></div>
      {tab === 'in' && <>
        {en.loading && !en.data && <div className="skeleton tall" />}
        {en.error && <ErrorNote text={en.error} onRetry={en.reload} />}
        {en.data && !en.data.length && <EmptyState compact title="No students enrolled yet" text="Add students one by one, or a whole batch at once."><button className="btn" onClick={() => setTab('add')}>Add students</button></EmptyState>}
        <div className="enrolled">{en.data?.map((e) => (
          <div className="row" key={e.id}>
            <div className="grow"><h3>{e.student.name}</h3><p>{e.student.studentId} · {e.student.batch || 'No batch'} · {e.completed} of {e.total} lessons</p></div>
            <div className="pbar"><i style={{ width: e.progress + '%' }} /><span>{e.progress}%</span></div>
            <button className="btn ghost sm" onClick={() => remove(e)} aria-label={`Remove ${e.student.name}`}><UserMinus size={14} /></button>
          </div>))}</div>
      </>}
      {tab === 'add' && <div className="form">
        {st.error && <ErrorNote text={st.error} onRetry={st.reload} />}
        {batches.length > 0 && <div className="batchadd"><label>Enrol a whole batch<select value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">Choose a batch…</option>{batches.map((b) => <option key={b} value={b}>{b} ({left(b)} not yet enrolled)</option>)}</select></label><button className="btn" disabled={!batch || busy} onClick={() => enrol({ batch })}><UserPlus size={15} /> Enrol batch</button></div>}
        <div className="searchbar"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students by name, ID or batch" aria-label="Search students" /></div>
        {st.loading && !st.data && <div className="skeleton tall" />}
        {st.data && !candidates.length && <EmptyState compact title={q ? 'No students match' : 'Everyone is already enrolled'} text={q ? 'Try a different name or batch.' : 'New students will show up here once an administrator adds them.'} />}
        <div className="picklist">{candidates.map((s) => (
          <label key={s.id} className="check pickrow"><input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} /><span><b>{s.name}</b><small>{s.studentId} · {s.batch || 'No batch'}</small></span></label>))}</div>
        <div className="actions"><button className="btn ghost" onClick={() => setPicked(candidates.map((s) => s.id))} disabled={!candidates.length}>Select all shown</button><button className="btn" disabled={!picked.length || busy} onClick={() => enrol({ studentIds: picked })}>{busy ? 'Enrolling…' : `Enrol ${picked.length || ''} selected`}</button></div>
      </div>}
    </Modal>
  );
}
