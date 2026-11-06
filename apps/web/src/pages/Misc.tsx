import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { INFO, ROLE_LABEL } from '../modules';
import { api, initials, useApi, useSession } from '../session';
import { EmptyState, ErrorNote, ThemeToggle, useTheme, useToast, usePageMeta } from '../ui';

const tel = (p: string) => 'tel:' + p.replace(/[^+\d]/g, '');
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export function NotFound({ standalone }: { standalone?: boolean }) {
  const nav = useNavigate();
  usePageMeta('Page not found', 'The page you are looking for does not exist or has moved.');
  const body = (
    <EmptyState kind="lost" title="We could not find that page" text="The link may be old, or the address may have a typo. Your account and your work are fine.">
      <Link className="btn" to="/">Go to my dashboard</Link><button className="btn ghost" onClick={() => nav(-1)}>Go back</button>
    </EmptyState>
  );
  return standalone ? <main className="standalone">{body}</main> : body;
}
export function NoAccess() {
  usePageMeta('No access');
  return <EmptyState kind="lock" title="This page is not part of your account" text="Your role does not include this module. If you think it should, please ask an administrator."><Link className="btn" to="/">Go to my dashboard</Link></EmptyState>;
}
/** Shown for modules that are planned but not built yet, so nothing pretends to work. */
export function ComingSoon({ slug }: { slug: string }) {
  const i = INFO[slug];
  const sup = useApi<{ email: string | null }>('/public/support');
  return (
    <EmptyState kind="build" title={`${i?.[1] ?? 'This module'} is on its way`} text={`${i?.[2] ?? 'We are still building this part of Gateway LMS.'} It is not available yet, so there is nothing to show here today.`}>
      <Link className="btn" to="/">Back to my dashboard</Link>
      {sup.data?.email && <a className="btn ghost" href={`mailto:${sup.data.email}?subject=${encodeURIComponent('Gateway LMS idea: ' + (i?.[1] ?? slug))}`}>Tell us what you need</a>}
    </EmptyState>
  );
}

export function Profile() {
  const { session, updateUser } = useSession();
  const toast = useToast();
  const [f, setF] = useState({ name: session?.user.name ?? '', phone: session?.user.phone ?? '' });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  if (!session) return null;
  const u = session.user;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try { updateUser(await api('/auth/me', { method: 'PATCH', body: f })); toast.success('Your profile was saved'); } catch (x) { setMsg(err(x)); toast.error(err(x)); } finally { setBusy(false); }
  }
  return <>
    <div className="pagehead"><p className="eyebrow">Account</p><h1>Profile</h1><p className="intro">Your details and how people can reach you.</p></div>
    <div className="two-col">
      <section className="panel spot idcard">
        <i className="avatar big">{initials(u.name)}</i>
        <h2>{u.name}</h2><span className="tag">{ROLE_LABEL[u.role]}</span>
        <dl>
          <dt>Email</dt><dd><a href={`mailto:${u.email}`}><Mail size={14} /> {u.email}</a></dd>
          {u.phone && <><dt>Phone</dt><dd><a href={tel(u.phone)}><Phone size={14} /> {u.phone}</a></dd></>}
          {u.studentId && <><dt>Student ID</dt><dd>{u.studentId}</dd></>}
          {u.program && <><dt>Program</dt><dd>{u.program}</dd></>}
          {u.batch && <><dt>Batch</dt><dd>{u.batch}</dd></>}
        </dl>
      </section>
      <form className="panel spot form" onSubmit={save}>
        <h2>Edit details</h2>
        <label>Full name<input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
        <label>Phone number<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" inputMode="tel" pattern="[+0-9 ()\-]{7,20}" title="Use digits, spaces, + ( ) and -" /></label>
        <p className="muted">Your email address is your sign-in name. Ask an administrator if it needs to change.</p>
        {msg && <p className="auth-error" role="alert">{msg}</p>}
        <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>
  </>;
}

export function Settings() {
  const { signOut } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', again: '' });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function change(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (f.newPassword !== f.again) { setMsg('The two new passwords do not match'); return; }
    setBusy(true);
    try { await api('/auth/change-password', { method: 'POST', body: { currentPassword: f.currentPassword, newPassword: f.newPassword } }); toast.success('Your password was changed'); setF({ currentPassword: '', newPassword: '', again: '' }); } catch (x) { setMsg(err(x)); } finally { setBusy(false); }
  }
  return <>
    <div className="pagehead"><p className="eyebrow">Account</p><h1>Settings</h1><p className="intro">Appearance, password and shortcuts.</p></div>
    <div className="two-col">
      <div>
        <section className="panel spot"><h2>Appearance</h2><div className="row"><div className="grow"><h3>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</h3><p>Switch any time. Gateway LMS remembers your choice on this device.</p></div><ThemeToggle /></div></section>
        <section className="panel spot"><h2>Shortcuts</h2>
          <div className="row"><div className="grow"><h3>Jump to any module</h3></div><kbd>Ctrl</kbd><kbd>K</kbd></div>
          <div className="row"><div className="grow"><h3>Pause or resume the live class view</h3></div><kbd>Alt</kbd><kbd>P</kbd></div>
        </section>
        <section className="panel spot"><h2>Session</h2><p className="muted">You stay signed in on this device for up to eight hours.</p><button className="btn ghost" onClick={signOut}>Sign out</button></section>
      </div>
      <form className="panel spot form" onSubmit={change}>
        <h2>Change password</h2>
        <label>Current password<input type="password" required autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></label>
        <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} placeholder="At least 8 characters" /></label>
        <label>New password again<input type="password" required minLength={8} autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} /></label>
        {msg && <p className="auth-error" role="alert">{msg}</p>}
        <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button></div>
      </form>
    </div>
  </>;
}

export function Support() {
  const { session } = useSession();
  const { data, loading, error, reload } = useApi<{ email: string | null; phone: string | null; hours: string | null }>('/public/support');
  const mail = data?.email ? `mailto:${data.email}?subject=${encodeURIComponent('Gateway LMS help')}&body=${encodeURIComponent(`Hello,\n\nI need help with:\n\n\n— ${session?.user.name} (${session ? ROLE_LABEL[session.user.role] : ''})`)}` : '';
  return <>
    <div className="pagehead"><p className="eyebrow">Account</p><h1>Support</h1><p className="intro">Stuck or found a problem? Contact the Gateway team.</p></div>
    {loading && <div className="skeleton tall" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && (data.email || data.phone ? (
      <div className="cards">
        {data.email && <a className="panel spot contact" href={mail}><Mail /><b>Email us</b><span>{data.email}</span><small>Opens your email app with your details filled in.</small></a>}
        {data.phone && <a className="panel spot contact" href={tel(data.phone)}><Phone /><b>Call us</b><span>{data.phone}</span><small>{data.hours || 'Tap to call from your phone.'}</small></a>}
      </div>
    ) : <section className="panel"><EmptyState kind="empty" compact title="Support contact is not set up yet" text={session?.user.role === 'STUDENT' ? 'Please ask your trainer or administrator for help for now.' : 'Set SUPPORT_EMAIL and SUPPORT_PHONE in the API settings and they will appear here, and on the sign-in page.'} /></section>)}
  </>;
}

interface S { id: string; batch?: string; program?: string }
export function BatchesView() {
  const { data, loading, error, reload } = useApi<S[]>('/students');
  const groups = new Map<string, { n: number; programs: Set<string> }>();
  (data ?? []).forEach((s) => { const k = s.batch || 'No batch'; const g = groups.get(k) ?? { n: 0, programs: new Set<string>() }; g.n++; if (s.program) g.programs.add(s.program); groups.set(k, g); });
  return <>
    <div className="pagehead"><p className="eyebrow">Academics</p><h1>Batches</h1><p className="intro">Groups of students, built from the batch on each student record.</p></div>
    {loading && !data && <div className="skeleton tall" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && !groups.size && <section className="panel"><EmptyState compact title="No students yet" text="Add students and give them a batch, and the batches appear here."><Link className="btn" to="/students?new=1">Add a student</Link></EmptyState></section>}
    <div className="cards stagger">{[...groups.entries()].sort().map(([k, g], i) => <article key={k} className="panel spot" style={{ ['--i' as string]: i }}><span className="tag">{g.n} student{g.n > 1 ? 's' : ''}</span><h3>{k}</h3><p className="muted">{[...g.programs].join(', ') || 'No program set'}</p><Link className="btn ghost sm" to="/attendance">Open attendance</Link></article>)}</div>
  </>;
}
