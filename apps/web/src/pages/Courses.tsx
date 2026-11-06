import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Check, ChevronLeft, ChevronRight, Pencil, Play, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { EnrollModal } from './Enroll';
import { api, useApi, useSession } from '../session';
import { LANGS, langOf, runCode } from '../runner';
import { Confetti, EmptyState, ErrorNote, Modal, Ring, useTheme, useToast, usePageMeta } from '../ui';

interface Lesson { id: string; module: string; title: string; type: string; duration: number; videoUrl: string; language: string; starterCode: string; notes: string; chapters: { at: number; title: string }[] }
interface CourseDetail { id: string; title: string; description: string; level: string; durationHours: number; status: string; tags: string[]; source?: { provider: string; url: string }; trainer: { id: string; name: string } | null; canEdit: boolean; enrolledCount?: number; lessons: Lesson[]; progress: number | null; completed: string[]; lastLesson: string | null }
interface CourseRow { _id: string; title: string; description?: string; level?: string; durationHours?: number; status?: string; tags?: string[]; trainer?: { name: string }; source?: { provider: string; url: string }; lessonCount?: number; canEdit?: boolean; enrolledCount?: number; modules?: { lessons: { _id: string; title: string; type: string; duration?: number }[] }[] }
interface Enr { _id: string; progress: number; completedLessons?: string[]; lastLesson?: string; course: CourseRow }

const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const hue = (t: string) => [...t].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
const stamp = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor(s / 60) % 60).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
const parseChapters = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$/.exec(l); return m ? { at: Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]), title: m[4] } : null; });

/* ---------------- course cards ---------------- */
function Track({ c, progress, dots, to, i }: { c: CourseRow; progress?: number; dots?: boolean[]; to?: string; i: number }) {
  const body = (
    <>
      <div className="track-art" style={{ ['--h' as string]: hue(c.title) }}><b>{c.title.split(' ').map((w) => w[0]).slice(0, 2).join('')}</b>{progress !== undefined && <Ring value={progress} size={64} stroke={6} />}</div>
      <div className="track-body">
        <span className="tag">{c.level} · {c.durationHours}h</span>{c.status && c.status !== 'PUBLISHED' && <span className="tag warn">{c.status.toLowerCase()}</span>}
        <h3>{c.title}</h3><p>{c.description}</p>
        {dots && dots.length > 0 && <div className="dots" aria-label={`${dots.filter(Boolean).length} of ${dots.length} lessons done`}>{dots.map((d, k) => <i key={k} className={d ? 'on' : ''} />)}</div>}
        <small>{c.trainer?.name}{c.lessonCount != null ? ` · ${c.lessonCount} lesson${c.lessonCount === 1 ? '' : 's'}` : ''}{c.enrolledCount != null ? ` · ${c.enrolledCount} enrolled` : ''}</small>
        {c.source && <small>Source: <a href={c.source.url} target="_blank" rel="noopener noreferrer">{c.source.provider}</a></small>}
        {to && <span className="btn">{progress === 100 ? 'Review' : progress ? `Resume at ${progress}%` : 'Open'} <ChevronRight size={15} /></span>}
      </div>
    </>
  );
  return to ? <Link to={to} className="track spot" style={{ ['--i' as string]: i }}>{body}</Link> : <article className="track spot" style={{ ['--i' as string]: i }}>{body}</article>;
}

function CourseForm({ course, onClose, onSaved }: { course?: CourseDetail | null; onClose: () => void; onSaved?: () => void }) {
  const nav = useNavigate(); const toast = useToast();
  const [f, setF] = useState({ title: course?.title ?? '', description: course?.description ?? '', level: course?.level ?? 'Foundation', durationHours: String(course?.durationHours ?? 10), tags: (course?.tags ?? []).join(', '), status: course?.status ?? 'DRAFT' });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const body = { ...f, durationHours: Number(f.durationHours), tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) };
    try {
      if (course) { await api('/courses/' + course.id, { method: 'PATCH', body }); toast.success('Course saved'); onSaved?.(); }
      else { const c = await api<{ _id: string }>('/courses', { method: 'POST', body }); toast.success('Course created. Add its lessons, then enrol your students.'); nav('/courses/' + c._id); }
    } catch (x) { setMsg(err(x)); } finally { setBusy(false); }
  }
  return (
    <Modal title={course ? 'Edit course' : 'New course'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Course title<input required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label>Short description<textarea className="plain" rows={3} maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="two">
          <label>Level<select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option>Foundation</option><option>Intermediate</option><option>Advanced</option></select></label>
          <label>Total hours<input type="number" min={0} max={1000} value={f.durationHours} onChange={(e) => setF({ ...f, durationHours: e.target.value })} /></label>
          <label>Tags (comma separated)<input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="Python, Data" /></label>
          <label>Visibility<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="DRAFT">Draft: only staff see it</option><option value="PUBLISHED">Published: enrolled students see it</option><option value="ARCHIVED">Archived: hidden from everyone</option></select></label>
        </div>
        {msg && <p className="auth-error" role="alert">{msg}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Saving…' : course ? 'Save course' : 'Create course'}</button></div>
      </form>
    </Modal>
  );
}

export function CoursesView() {
  const { session } = useSession();
  const { data, loading, error, reload } = useApi<CourseRow[]>('/courses');
  const mine = useApi<Enr[]>('/courses/my');
  const [creating, setCreating] = useState(false);
  if (!session) return null;
  const staff = session.user.role !== 'STUDENT';
  const enrolled = new Set((mine.data ?? []).map((e) => e.course._id));
  return <>
    {staff && <div className="actions left lead-actions"><button className="btn glow" onClick={() => setCreating(true)}><Plus size={16} /> New course</button></div>}
    {loading && !data && <div className="skeleton tall" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && !data.length && <section className="panel"><EmptyState compact title={staff ? 'No courses yet' : 'No courses are published yet'} text={staff ? 'Create the first course, then add video lessons with a code workspace.' : 'Your trainers will publish courses here.'}>{staff && <button className="btn" onClick={() => setCreating(true)}>Create a course</button>}</EmptyState></section>}
    <div className="cards stagger">{data?.map((c, i) => <Track key={c._id} c={c} i={i} to={staff ? '/courses/' + c._id : enrolled.has(c._id) ? '/learning/' + c._id : undefined} />)}</div>
    {!staff && data && data.some((c) => !enrolled.has(c._id)) && <p className="muted note-line">Courses without a button are not on your plan yet. Ask your administrator to enrol you.</p>}
    {creating && <CourseForm onClose={() => setCreating(false)} />}
  </>;
}

/** My learning: each enrolled course as a track with one dot per lesson. */
export function LearningView() {
  const { data, loading, error, reload } = useApi<Enr[]>('/courses/my');
  return <>
    {loading && !data && <div className="skeleton tall" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && !data.length && <section className="panel"><EmptyState title="You are not enrolled in a course yet" text="Your administrator adds you to a batch and its courses. They will appear here, ready to resume."><Link className="btn ghost" to="/support">Ask for help</Link></EmptyState></section>}
    <div className="cards stagger">{data?.map((e, i) => {
      const ls = e.course.modules?.flatMap((m) => m.lessons) ?? []; const done = new Set((e.completedLessons ?? []).map(String));
      return <Track key={e._id} i={i} c={{ ...e.course, lessonCount: ls.length }} progress={e.progress} dots={ls.map((l) => done.has(String(l._id)))} to={'/learning/' + e.course._id + (e.lastLesson ? '?lesson=' + e.lastLesson : '')} />;
    })}</div>
  </>;
}

/** Lab exercises: every hands-on lesson from your courses in one list. */
export function LabsView() {
  const { session } = useSession();
  const { data, loading, error, reload } = useApi<Enr[]>('/courses/my');
  if (!session) return null;
  if (session.user.role !== 'STUDENT') return <CoursesView />;
  const labs = (data ?? []).flatMap((e) => (e.course.modules?.flatMap((m) => m.lessons) ?? []).filter((l) => l.type === 'LAB').map((l) => ({ ...l, course: e.course, done: (e.completedLessons ?? []).map(String).includes(String(l._id)) })));
  return <>
    {loading && !data && <div className="skeleton tall" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && !labs.length && <section className="panel"><EmptyState compact title="No lab exercises yet" text="Hands-on lessons from your courses will be listed here."><Link className="btn" to="/learning">Open my learning</Link></EmptyState></section>}
    <div className="tickets stagger">{labs.map((l, i) => <Link key={l._id} to={`/learning/${l.course._id}?lesson=${l._id}`} className={'ticket asg spot' + (l.done ? ' ok' : '')} style={{ ['--i' as string]: i }}><b>{l.title}</b><p>{l.course.title}</p><time>{l.done ? 'Done' : `${l.duration ?? 0} min`}</time></Link>)}</div>
  </>;
}

/* ---------------- the video lesson page ---------------- */
type Video = { kind: 'yt'; id: string } | { kind: 'vimeo'; id: string } | { kind: 'file'; url: string } | { kind: 'link'; url: string } | null;
function parseVideo(url: string): Video {
  if (!url) return null;
  try {
    const u = new URL(url); const h = u.hostname.replace(/^www\./, '');
    if (h === 'youtu.be' && u.pathname.length > 1) return { kind: 'yt', id: u.pathname.slice(1) };
    if (h.endsWith('youtube.com')) { const id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(?:embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname)?.[1]; if (id) return { kind: 'yt', id }; }
    if (h === 'vimeo.com' || h === 'player.vimeo.com') { const id = u.pathname.split('/').filter(Boolean).pop(); if (id && /^\d+$/.test(id)) return { kind: 'vimeo', id }; }
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: 'file', url };
    return { kind: 'link', url };
  } catch { return null; }
}
type Seek = { current: ((s: number) => void) | null };
function VideoPlayer({ url, seekRef, startAt, onTime }: { url: string; seekRef: Seek; startAt: number; onTime: (s: number) => void }) {
  const v = parseVideo(url); const frame = useRef<HTMLIFrameElement>(null); const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    seekRef.current = (s) => {
      if (v?.kind === 'file' && vid.current) { vid.current.currentTime = s; vid.current.play().catch(() => {}); }
      else if (v?.kind === 'yt') { const w = frame.current?.contentWindow; w?.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [s, true] }), '*'); w?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'); }
      else if (v?.kind === 'vimeo') { const w = frame.current?.contentWindow; w?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: s }), '*'); w?.postMessage(JSON.stringify({ method: 'play' }), '*'); }
    };
    return () => { seekRef.current = null; };
  }, [v?.kind, url, seekRef]);
  if (!v) return <EmptyState kind="empty" compact title="No video for this lesson yet" text="The notes and the code workspace still work. A trainer can add a video link when it is ready." />;
  if (v.kind === 'yt') return <iframe ref={frame} title="Lesson video" src={`https://www.youtube-nocookie.com/embed/${v.id}?enablejsapi=1&rel=0&modestbranding=1`} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />;
  if (v.kind === 'vimeo') return <iframe ref={frame} title="Lesson video" src={`https://player.vimeo.com/video/${v.id}`} allow="fullscreen; picture-in-picture" allowFullScreen loading="lazy" />;
  if (v.kind === 'file') return <video ref={vid} controls preload="metadata" playsInline src={v.url} onLoadedMetadata={(e) => { if (startAt > 5) e.currentTarget.currentTime = startAt; }} onTimeUpdate={(e) => onTime(Math.floor(e.currentTarget.currentTime))} />;
  return <EmptyState kind="empty" compact title="This video opens on another site" text="The link cannot be shown inside the lesson."><a className="btn" href={v.url} target="_blank" rel="noopener noreferrer">Open the video</a></EmptyState>;
}

function LessonForm({ courseId, lesson, modules, onClose, onDone }: { courseId: string; lesson: Lesson | null; modules: string[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ module: lesson?.module ?? modules[modules.length - 1] ?? 'Lessons', title: lesson?.title ?? '', type: lesson?.type ?? 'VIDEO', duration: String(lesson?.duration ?? 20), videoUrl: lesson?.videoUrl ?? '', language: lesson?.language ?? 'javascript', starterCode: lesson?.starterCode ?? '', notes: lesson?.notes ?? '', chapters: (lesson?.chapters ?? []).map((c) => `${stamp(c.at)} ${c.title}`).join('\n') });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const parsed = parseChapters(f.chapters);
    if (parsed.some((c) => !c)) { setMsg('Write each chapter on its own line like this: 2:30 Installing Python'); return; }
    setBusy(true);
    try {
      await api(`/courses/${courseId}/lessons${lesson ? '/' + lesson.id : ''}`, { method: lesson ? 'PATCH' : 'POST', body: { ...f, duration: Number(f.duration), chapters: parsed } });
      toast.success(lesson ? 'Lesson saved' : 'Lesson added'); onDone();
    } catch (x) { setMsg(err(x)); } finally { setBusy(false); }
  }
  return (
    <Modal title={lesson ? 'Edit lesson' : 'Add a lesson'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="two">
          <label>Lesson title<input required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          {!lesson && <label>Section<input list="mods" value={f.module} onChange={(e) => setF({ ...f, module: e.target.value })} /><datalist id="mods">{modules.map((m) => <option key={m} value={m} />)}</datalist></label>}
          <label>Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="VIDEO">Video</option><option value="LAB">Lab (hands-on)</option><option value="TEXT">Reading</option></select></label>
          <label>Minutes<input type="number" min={0} max={600} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></label>
        </div>
        <label>Video link (YouTube, Vimeo or an https .mp4 file)<input type="url" value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></label>
        <label>Code language<select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        <label>Starter code students begin with<textarea className="plain mono" rows={6} value={f.starterCode} onChange={(e) => setF({ ...f, starterCode: e.target.value })} spellCheck={false} /></label>
        <label>Notes<textarea className="plain" rows={4} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="What students should take from this lesson" /></label>
        <label>Chapters (optional, one per line)<textarea className="plain mono" rows={3} value={f.chapters} onChange={(e) => setF({ ...f, chapters: e.target.value })} placeholder={'0:00 Introduction\n2:30 Installing Python'} spellCheck={false} /></label>
        {msg && <p className="auth-error" role="alert">{msg}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Saving…' : lesson ? 'Save lesson' : 'Add lesson'}</button></div>
      </form>
    </Modal>
  );
}

export function CoursePage() {
  const { courseId = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { session } = useSession(); const { theme } = useTheme(); const toast = useToast();
  const { data, loading, error, reload } = useApi<CourseDetail>('/courses/' + courseId);
  const [curId, setCurId] = useState(''); const [done, setDone] = useState<string[]>([]); const [progress, setProgress] = useState<number | null>(null);
  const [view, setView] = useState<'video' | 'code' | 'lessons'>('video'); const [tab, setTab] = useState<'notes' | 'chapters'>('notes');
  const [code, setCode] = useState(''); const [lang, setLang] = useState('javascript'); const [out, setOut] = useState<{ text: string; html?: string } | null>(null);
  const [running, setRunning] = useState(false); const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null); const [party, setParty] = useState(false);
  const [enrolling, setEnrolling] = useState(false); const [editCourse, setEditCourse] = useState(false);
  const seekRef = useRef<((s: number) => void) | null>(null); const posRef = useRef(0); const startAt = useRef(0); const loaded = useRef('');
  usePageMeta(data?.title, data?.description);
  const student = session?.user.role === 'STUDENT';
  const lessons = data?.lessons ?? [];
  const idx = lessons.findIndex((l) => l.id === curId); const lesson = lessons[idx];

  useEffect(() => {
    if (!data) return; setDone(data.completed); setProgress(data.progress);
    const want = sp.get('lesson') || data.lastLesson || data.lessons.find((l) => !data.completed.includes(l.id))?.id || data.lessons[0]?.id || '';
    setCurId(data.lessons.some((l) => l.id === want) ? want : data.lessons[0]?.id ?? '');
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // load this lesson's code: the student's saved work, or the trainer's starter code
  useEffect(() => {
    if (!lesson) return; loaded.current = ''; setOut(null); setSaved('idle'); startAt.current = 0;
    setLang(lesson.language); setCode(lesson.starterCode);
    if (!student) { loaded.current = lesson.id; return; }
    let live = true;
    api<{ code: string; language?: string; position: number } | null>(`/courses/${courseId}/lessons/${lesson.id}/work`).then((w) => {
      if (!live) return; if (w) { setCode(w.code); if (w.language) setLang(w.language); startAt.current = w.position || 0; }
      loaded.current = lesson.id;
    }).catch(() => { loaded.current = lesson.id; });
    return () => { live = false; };
  }, [lesson?.id, student, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // save the student's code a moment after they stop typing
  useEffect(() => {
    if (!student || !lesson || loaded.current !== lesson.id) return;
    setSaved('saving');
    const t = setTimeout(() => { api(`/courses/${courseId}/lessons/${lesson.id}/work`, { method: 'PUT', body: { code, language: lang, position: posRef.current } }).then(() => setSaved('saved')).catch(() => { setSaved('idle'); toast.error('Your code could not be saved. Check your connection.'); }); }, 900);
    return () => clearTimeout(t);
  }, [code, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (id: string) => { setCurId(id); setSp({ lesson: id }, { replace: true }); setView('video'); posRef.current = 0; };
  async function run() { setRunning(true); try { const r = await runCode(langOf(lang), code); setOut({ text: r.output, html: r.html }); } catch (e) { setOut({ text: err(e) }); } finally { setRunning(false); } }
  async function toggleDone() {
    if (!lesson) return; const makeDone = !done.includes(lesson.id);
    try {
      const r = await api<{ progress: number; completed: string[]; total: number }>(`/courses/${courseId}/lessons/${lesson.id}/complete`, { method: 'POST', body: { done: makeDone } });
      setDone(r.completed); setProgress(r.progress);
      if (makeDone && r.progress === 100) { setParty(true); setTimeout(() => setParty(false), 2600); toast.success('You finished the course. Congratulations!'); }
      else toast.success(makeDone ? `Lesson complete. ${r.completed.length} of ${r.total} done.` : 'Lesson marked as not done');
    } catch (e) { toast.error(err(e)); }
  }
  async function remove(l: Lesson) { if (confirm(`Delete “${l.title}”? Students' saved code for it is removed too.`)) { try { await api(`/courses/${courseId}/lessons/${l.id}`, { method: 'DELETE' }); toast.success('Lesson deleted'); reload(); } catch (e) { toast.error(err(e)); } } }

  async function setStatus(status: string) {
    try { await api('/courses/' + courseId, { method: 'PATCH', body: { status } }); toast.success(status === 'PUBLISHED' ? 'Course published. Enrolled students can see it now.' : 'Course moved back to draft. Students no longer see it.'); reload(); } catch (e) { toast.error(err(e)); }
  }

  if (loading && !data) return <div className="skeleton tall" aria-busy="true" />;
  if (error || !data) return <section className="panel"><EmptyState kind={/enrolled|permission/i.test(error) ? 'lock' : 'lost'} title={/enrolled/i.test(error) ? 'You are not enrolled in this course' : 'We could not open this course'} text={error || 'It may have been removed.'}><Link className="btn" to={student ? '/learning' : '/courses'}>Back to courses</Link><button className="btn ghost" onClick={reload}>Try again</button></EmptyState></section>;
  const modules = [...new Set(lessons.map((l) => l.module))];
  const isDone = lesson ? done.includes(lesson.id) : false;
  return (
    <div className="cp" data-view={view}>
      <Confetti fire={party} />
      <header className="cp-head">
        <Link className="back" to={student ? '/learning' : '/courses'} aria-label="Back to courses"><ChevronLeft size={18} /></Link>
        <div className="grow"><p className="eyebrow">{data.level} · {data.trainer?.name ?? 'Gateway'}{data.status !== 'PUBLISHED' && ` · ${data.status.toLowerCase()}`}</p><h1>{data.title}</h1></div>
        {progress !== null && <Ring value={progress} size={64} stroke={7} />}
        <Link className="btn ghost sm" to="/live-classes">Live classes</Link>
        {data.canEdit && <div className="cp-staff">
          <button className="btn ghost sm" onClick={() => setEnrolling(true)}><Users size={14} /> Students ({data.enrolledCount ?? 0})</button>
          <button className="btn ghost sm" onClick={() => setEditCourse(true)}><Pencil size={14} /> Edit course</button>
          <button className={'btn sm' + (data.status === 'PUBLISHED' ? ' ghost' : '')} onClick={() => setStatus(data.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}>{data.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button>
        </div>}
      </header>
      {data.canEdit && data.status !== 'PUBLISHED' && <p className="ws-banner paused" role="status"><b>Draft.</b> Students cannot see this course yet. Add lessons, enrol students, then press Publish.</p>}
      <div className="seg cp-tabs" role="tablist" aria-label="Lesson view"><button className={view === 'video' ? 'on' : ''} onClick={() => setView('video')}>Video</button><button className={view === 'code' ? 'on' : ''} onClick={() => setView('code')}>Code</button><button className={view === 'lessons' ? 'on' : ''} onClick={() => setView('lessons')}>Lessons</button></div>
      {!lessons.length ? <section className="panel"><EmptyState kind="empty" title="No lessons in this course yet" text={data.canEdit ? 'Add the first lesson with a video link, starter code and notes.' : 'Your trainer is still adding lessons.'}>{data.canEdit && <button className="btn" onClick={() => setEditing('new')}>Add the first lesson</button>}</EmptyState></section> : (
        <div className="cp-grid">
          <nav className="cp-lessons panel" aria-label="Lessons">
            {modules.map((m) => <div key={m}><p className="caption">{m}</p><ol className="path">{lessons.filter((l) => l.module === m).map((l) => {
              const d = done.includes(l.id);
              return <li key={l.id} className={(l.id === curId ? 'now ' : '') + (d ? 'done' : '')}>
                <button className="node" onClick={() => go(l.id)} aria-current={l.id === curId ? 'true' : undefined}><i>{d ? <Check size={13} /> : lessons.indexOf(l) + 1}</i><span><b>{l.title}</b><small>{l.type.toLowerCase()} · {l.duration} min</small></span></button>
                {data.canEdit && <span className="node-tools"><button onClick={() => setEditing(l)} aria-label={`Edit ${l.title}`}><Pencil size={13} /></button><button onClick={() => remove(l)} aria-label={`Delete ${l.title}`}><Trash2 size={13} /></button></span>}
              </li>;
            })}</ol></div>)}
            {data.canEdit && <button className="btn ghost sm" onClick={() => setEditing('new')}><Plus size={14} /> Add lesson</button>}
          </nav>
          <section className="cp-video">
            <div className="video"><VideoPlayer key={lesson?.id} url={lesson?.videoUrl ?? ''} seekRef={seekRef} startAt={startAt.current} onTime={(s) => { posRef.current = s; }} /></div>
            <div className="cp-actions">
              <button className="btn ghost sm" disabled={idx <= 0} onClick={() => go(lessons[idx - 1].id)}><ChevronLeft size={15} /> Previous</button>
              {student && <button className={'btn' + (isDone ? ' ghost' : ' glow')} onClick={toggleDone}><Check size={15} /> {isDone ? 'Completed' : 'Mark complete'}</button>}
              <button className="btn ghost sm" disabled={idx >= lessons.length - 1} onClick={() => go(lessons[idx + 1].id)}>Next <ChevronRight size={15} /></button>
            </div>
            <h2 className="lesson-title">{lesson?.title}</h2>
            <div className="seg small"><button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>Notes</button><button className={tab === 'chapters' ? 'on' : ''} onClick={() => setTab('chapters')}>Chapters{lesson?.chapters.length ? ` ${lesson.chapters.length}` : ''}</button></div>
            {tab === 'notes' ? <p className="prewrap notes">{lesson?.notes || 'No notes for this lesson yet.'}</p> : (lesson?.chapters.length ? <ul className="chapters">{lesson.chapters.map((c) => <li key={c.at + c.title}><button onClick={() => seekRef.current?.(c.at)}><time>{stamp(c.at)}</time> {c.title}</button></li>)}</ul> : <p className="muted notes">This lesson has no chapters.</p>)}
          </section>
          <section className="cp-code">
            <div className="ws-bar">
              <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
              <button className="btn ghost sm" onClick={() => { if (!code || code === lesson?.starterCode || confirm('Replace your code with the starter code?')) { setCode(lesson?.starterCode ?? ''); setLang(lesson?.language ?? 'javascript'); } }}><RotateCcw size={14} /> Reset</button>
              <span className="grow" /><small className="muted savestate" aria-live="polite">{student ? saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : '' : 'Preview'}</small>
              <button className="btn" onClick={run} disabled={running}><Play size={15} /> {running ? 'Running…' : 'Run'}</button>
            </div>
            <div className="ws-editor cp-editor"><Editor height="100%" theme={theme === 'dark' ? 'vs-dark' : 'light'} path={lesson?.id} language={langOf(lang).monaco} value={code} onChange={(v) => setCode(v ?? '')} options={{ fontSize: 15, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 12 }, wordWrap: 'on' }} /></div>
            <div className="ws-out"><div className="ws-outbar"><b>Output</b>{langOf(lang).mode === 'remote' && <small className="muted">Runs on the Gateway code runner</small>}</div>{out?.html !== undefined ? <iframe title="Preview" sandbox="allow-scripts" srcDoc={out.html} /> : <pre>{out?.text ?? 'Press Run to see the result here.'}</pre>}</div>
          </section>
        </div>)}
      {enrolling && <EnrollModal courseId={courseId} title={data.title} onClose={() => setEnrolling(false)} onChanged={reload} />}
      {editCourse && <CourseForm course={data} onClose={() => setEditCourse(false)} onSaved={() => { setEditCourse(false); reload(); }} />}
      {editing && <LessonForm courseId={courseId} lesson={editing === 'new' ? null : editing} modules={modules} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
