import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, GraduationCap, Plus, Radio, BarChart3 } from 'lucide-react';
import { useApi, useSession } from '../session';
import { CodeTicker, CountUp, EmptyState, ErrorNote, Icon, Ring, domainUi, until, useNow } from '../ui';

interface Stat { label: string; value: string; note: string; icon: string }
interface Enr { _id: string; progress: number; completedLessons?: string[]; lastLesson?: string; course: { _id: string; title: string; description?: string; durationHours?: number; trainer?: { name: string }; modules?: { lessons: { _id: string }[] }[] } }
interface Person { _id: string; name: string; role: string }
interface Cls { id: string; title: string; domain: string; language: string; status: string; scheduledAt: string; trainer?: string }
interface Row { title: string; text: string; meta: string; tone?: 'warn' | 'ok' }
interface Dash {
  stats: Stat[]; classes: Cls[]; enrollments?: Enr[]; courses?: { _id: string; title: string; level: string; durationHours: number; status: string }[]; recent?: Person[];
  attendance?: { present: number; total: number; rate: number }; deadlines?: { id: string; title: string; batch?: string; dueAt: string }[]; grading?: { id: string; title: string; waiting: number; dueAt: string }[];
  pendingLeaves?: number; leaveQueue?: { id: string; name?: string; from: string; to: string; type: string }[]; batchHealth?: { batch: string; total: number; present: number; percent: number }[];
  activity?: { title: string; text: string; at: string }[]; system?: Row[];
}

const Empty = ({ text }: { text: string }) => <p className="empty">{text}</p>;
const dayLabel = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const dueRow = (title: string, text: string, iso: string): Row => ({ title, text, meta: dayLabel(iso), tone: new Date(iso).getTime() - Date.now() < 2 * 864e5 ? 'warn' : undefined });
const ago = (iso: string) => { const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

function Panel({ title, eyebrow, to, span = 6, children }: { title: string; eyebrow?: string; to?: string; span?: number; children: React.ReactNode }) {
  return (
    <section className="panel spot" style={{ gridColumn: `span ${span}` }}>
      <header><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{to && <Link to={to}>View all →</Link>}</header>
      {children}
    </section>
  );
}
function Timeline({ classes }: { classes: Cls[] }) {
  const now = useNow(30000);
  if (!classes.length) return <Empty text="No classes are scheduled yet." />;
  return (
    <ol className="timeline">{classes.map((c) => {
      const ui = domainUi(c.domain); const D = ui.icon; const live = c.status === 'LIVE';
      return (
        <li key={c.id} className={live ? 'live' : ''} style={{ ['--c' as string]: ui.color }}>
          <i className="dot"><D size={14} /></i>
          <div className="grow"><h3>{c.title}</h3><p>{c.trainer} · {new Date(c.scheduledAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p></div>
          {live ? <Link className="pill-live" to={`/live-classes/${c.id}`}>LIVE · Join</Link> : <time>{until(c.scheduledAt, now)}</time>}
        </li>
      );
    })}</ol>
  );
}
const Tickets = ({ rows }: { rows: Row[] }) => <div className="tickets stagger">{rows.map((r, i) => <div key={r.title + i} style={{ ['--i' as string]: i }} className={'ticket ' + (r.tone ?? '')}><b>{r.title}</b><p>{r.text}</p><time>{r.meta}</time></div>)}</div>;
const Rows = ({ rows }: { rows: Row[] }) => <>{rows.map((r, i) => <div className="row" key={r.title + i}><i className={'pulse ' + (r.tone ?? '')} /><div className="grow"><h3>{r.title}</h3><p>{r.text}</p></div><time className={r.tone}>{r.meta}</time></div>)}</>;

function People({ d, to }: { d: Dash; to: string }) {
  return (
    <Panel title="Recently added" eyebrow="People" to={to} span={4}>
      {d.recent?.length ? d.recent.map((p) => <div className="row" key={p._id}><i className="avatar sm">{p.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</i><div className="grow"><h3>{p.name}</h3><p>{p.role.replace('_', ' ').toLowerCase()}</p></div></div>) : <Empty text="No accounts yet." />}
    </Panel>
  );
}

export function Dashboard() {
  const { session } = useSession();
  const { data, error, loading, reload } = useApi<Dash>('/dashboard');
  if (!session) return null;
  const { user } = session;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const live = data?.classes.find((c) => c.status === 'LIVE');
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const staff = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const first = user.name.split(' ')[0];
  const actions = [
    { to: '/students?new=1', icon: GraduationCap, label: 'Add a student', show: staff },
    { to: '/attendance', icon: CalendarCheck, label: data?.pendingLeaves ? `Attendance and leave (${data.pendingLeaves})` : 'Attendance and leave', show: user.role !== 'STUDENT' },
    { to: '/live-classes?new=1', icon: Plus, label: 'Schedule a class', show: user.role !== 'STUDENT' },
    { to: '/reports', icon: BarChart3, label: 'View reports', show: staff },
  ].filter((a) => a.show);

  return <>
    <section className="hero">
      <i className="blob b1" /><i className="blob b2" /><i className="blob b3" />
      <div className="hero-in">
        <p className="eyebrow">{date}</p>
        <h1>{greet}, <span>{first}</span></h1>
        <p className="lead">{user.role === 'STUDENT' ? 'Your next lesson is one click away.' : user.role === 'TRAINER' ? 'Pick a domain, go live, and teach in any language.' : user.role === 'ADMIN' ? 'Everything about today’s learners, in one glance.' : 'The whole platform at a glance.'}</p>
        <div className="hero-cta">
          {live ? <Link className="btn glow" to={`/live-classes/${live.id}`}><Radio size={16} /> {live.title} is live. Join</Link>
            : user.role === 'STUDENT' ? <Link className="btn glow" to="/learning">Continue learning →</Link>
            : <Link className="btn glow" to="/live-classes?new=1"><Plus size={16} /> Schedule a class</Link>}
        </div>
      </div>
      {user.role === 'STUDENT' ? <CodeTicker name={first} /> : <div className="quick">{actions.map((a) => <Link key={a.to} to={a.to} className="qa"><a.icon size={20} /><span>{a.label}</span></Link>)}</div>}
    </section>

    {loading && !data && <div className="orbs" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>}
    {error && <ErrorNote text={`We could not load your dashboard. ${error}`} onRetry={reload} />}
    {data && <>
      <div className="orbs stagger">{data.stats.map((s, n) => (
        <article key={s.label} style={{ ['--i' as string]: n }} className={'orb spot o' + (n % 4)}><i><Icon name={s.icon} size={20} /></i><div><small>{s.label}</small><strong><CountUp value={s.value} /></strong><p>{s.note}</p></div></article>
      ))}</div>

      <div className="bento">
        {user.role === 'STUDENT' && (() => {
          const e = (data.enrollments || []).filter((x) => x.progress < 100).sort((a, b) => b.progress - a.progress)[0];
          const total = e?.course.modules?.flatMap((m) => m.lessons).length ?? 0;
          return <>
            <Panel title="Continue learning" eyebrow="Pick up where you left off" to="/learning" span={7}>
              {e ? <div className="course">
                <Ring value={e.progress} size={120} stroke={10} />
                <div><span className="tag">In progress</span><h2>{e.course.title}</h2><p>{e.course.description}</p><small>{(e.completedLessons ?? []).length} of {total} lessons done · {e.course.trainer?.name || 'Gateway trainer'}</small><div><Link className="btn" to={`/learning/${e.course._id}${e.lastLesson ? '?lesson=' + e.lastLesson : ''}`}>Resume lesson →</Link></div></div>
              </div> : <EmptyState compact title={data.enrollments?.length ? 'Every course is finished' : 'No courses yet'} text={data.enrollments?.length ? 'Great work. Review any lesson from My learning.' : 'Ask your administrator to add you to a batch and its courses.'} />}
            </Panel>
            <Panel title="Today and next" eyebrow="Live classes" to="/live-classes" span={5}><Timeline classes={data.classes} /></Panel>
            <Panel title="Upcoming deadlines" eyebrow="Stay on track" to="/assignments" span={12}>
              {data.deadlines?.length ? <Tickets rows={data.deadlines.map((a) => dueRow(a.title, a.batch ? `Assignment · ${a.batch}` : 'Assignment', a.dueAt))} /> : <Empty text="You are all caught up. New assignments will appear here." />}
            </Panel>
          </>;
        })()}
        {user.role === 'TRAINER' && <>
          <Panel title="Your classes" eyebrow="Teaching" to="/live-classes" span={7}><Timeline classes={data.classes} /></Panel>
          <Panel title="Your courses" eyebrow="Catalog" to="/courses" span={5}>
            {data.courses?.length ? data.courses.map((c) => <Link to={`/courses/${c._id}`} className="row linkrow" key={c._id}><div className="grow"><h3>{c.title}</h3><p>{c.level} · {c.durationHours}h</p></div><span className="tag">{c.status.toLowerCase()}</span></Link>) : <EmptyState compact title="No courses yet" text="Create a course and add video lessons."><Link className="btn" to="/courses">Go to courses</Link></EmptyState>}
          </Panel>
          <Panel title="Grading queue" eyebrow="Needs attention" to="/assignments" span={12}>
            {data.grading?.length ? <Tickets rows={data.grading.map((g) => dueRow(g.title, `${g.waiting} submission${g.waiting > 1 ? 's' : ''} waiting`, g.dueAt))} /> : <Empty text="Nothing is waiting to be graded." />}
          </Panel>
        </>}
        {staff && data.attendance && <>
          <Panel title="Attendance today" eyebrow="Learners" to="/attendance" span={4}>
            <div className="attend"><Ring value={data.attendance.rate} size={130} stroke={11} /><p><b>{data.attendance.present}</b> of {data.attendance.total} students checked in</p></div>
          </Panel>
          {user.role === 'ADMIN' ? <>
            <Panel title="Leave requests" eyebrow="Needs a decision" to="/attendance" span={4}>
              {data.leaveQueue?.length ? <Rows rows={data.leaveQueue.map((l) => ({ title: l.name ?? 'Student', text: `${l.type.toLowerCase()} leave`, meta: l.from === l.to ? dayLabel(l.from) : `${dayLabel(l.from)} to ${dayLabel(l.to)}`, tone: 'warn' as const }))} /> : <Empty text="No leave requests are waiting." />}
            </Panel>
            <Panel title="Batch attendance today" eyebrow="By batch" to="/batches" span={4}>
              {data.batchHealth?.length ? data.batchHealth.map((b) => <div className="barrow" key={b.batch}><div><b>{b.batch}</b><small>{b.present} of {b.total} present</small></div><div className="progress"><i style={{ width: b.percent + '%' }} /></div><time>{b.percent}%</time></div>) : <Empty text="Add students to see batches here." />}
            </Panel>
          </> : <>
            <Panel title="System health" eyebrow="Platform" span={4}><Rows rows={data.system ?? []} /></Panel>
            <Panel title="Recent activity" eyebrow="What changed" span={4}>
              {data.activity?.length ? data.activity.map((a, i) => <div className="row" key={i}><div className="grow"><h3>{a.title}</h3><p>{[a.text, ago(a.at)].filter(Boolean).join(' · ')}</p></div></div>) : <Empty text="Activity will appear here." />}
            </Panel>
          </>}
          <Panel title="Live and upcoming" eyebrow="Classes" to={user.role === 'ADMIN' ? '/live-classes' : undefined} span={8}><Timeline classes={data.classes} /></Panel>
          <People d={data} to={user.role === 'SUPER_ADMIN' ? '/users' : '/students'} />
        </>}
      </div>
    </>}
  </>;
}
