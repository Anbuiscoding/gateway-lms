import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { api, useApi, useSession, type Session } from '../session';
import { CodeTicker, Logo, ThemeToggle, useToast, usePageMeta } from '../ui';

export function AuthPage() {
  const { portal, mode } = useParams();
  const nav = useNavigate(); const toast = useToast();
  const { session, signIn } = useSession();
  const support = useApi<{ email: string | null; phone: string | null }>('/public/support');
  const [form, setForm] = useState({ name: '', email: '', password: '', program: '', adminInviteCode: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  usePageMeta(mode === 'signup' ? 'Create your account' : 'Sign in', 'Sign in to Gateway LMS, the learning portal of Gateway Software Solutions: live classes, code-along lessons, assignments and attendance.');

  if ((portal !== 'student' && portal !== 'admin') || (mode !== 'login' && mode !== 'signup')) return <Navigate to="/auth/student/login" replace />;
  if (session) return <Navigate to="/" replace />;
  const staff = portal === 'admin';
  const change = (k: string, v: string) => setForm({ ...form, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password, portal } : { ...form, role: staff ? 'ADMIN' : 'STUDENT' };
      const data = await api<Session>('/auth/' + mode, { method: 'POST', body });
      signIn(data);
      toast.success(mode === 'login' ? `Welcome back, ${data.user.name.split(' ')[0]}` : 'Your account is ready. Welcome to Gateway LMS!');
      nav('/', { replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'We could not sign you in. Please try again.');
    } finally { setBusy(false); }
  }

  const other = (p: string, m: string) => `/auth/${p}/${m}`;
  const s = support.data;
  return (
    <main className="auth-page">
      <div className="auth-theme"><ThemeToggle /></div>
      <section className="auth-brand">
        <div className="logo-pill"><Logo /></div>
        <div className="auth-ticker"><CodeTicker name="you" /></div>
        <p className="eyebrow">Gateway LMS</p>
        <h1>{staff ? 'Teach and manage learning.' : 'Learn. Practice. Build.'}</h1>
        <p>{staff ? 'Run live classes, grade work and track attendance from one secure workspace. Your role decides which modules you see.' : 'Live classes with a shared editor, code-along video lessons, assignments and attendance, built for hands-on technology education.'}</p>
        {(s?.email || s?.phone) && <p className="auth-contact">Need help? {s.email && <a href={`mailto:${s.email}`}><Mail size={14} /> {s.email}</a>}{s.phone && <a href={'tel:' + s.phone.replace(/[^+\d]/g, '')}><Phone size={14} /> {s.phone}</a>}</p>}
      </section>
      <section className="auth-form-wrap">
        <form onSubmit={submit} className="auth-form" noValidate={false}>
          <p className="eyebrow">{staff ? 'Staff portal' : 'Student portal'}</p>
          <h2>{mode === 'login' ? 'Sign in to Gateway LMS' : staff ? 'Create administrator account' : 'Create your learner account'}</h2>
          <p className="auth-sub">{mode === 'login' ? (staff ? 'Trainers, administrators and super administrators sign in here.' : 'Use your Gateway LMS email and password.') : 'It only takes a minute.'}</p>
          {mode === 'signup' && <>
            <label>Full name<input required minLength={2} autoComplete="name" value={form.name} onChange={(e) => change('name', e.target.value)} /></label>
            {!staff && <label>Program<input required value={form.program} onChange={(e) => change('program', e.target.value)} placeholder="For example, Data Science & AI" /></label>}
            {staff && <label>Administrator invitation code<input required value={form.adminInviteCode} onChange={(e) => change('adminInviteCode', e.target.value)} placeholder="Given to you by Gateway" /></label>}
          </>}
          <label>Email address<input type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => change('email', e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => change('password', e.target.value)} placeholder="At least 8 characters" /></label>
          {message && <p className="auth-error" role="alert">{message}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}</button>
          <p className="auth-switch">{mode === 'login' ? 'New to Gateway LMS?' : 'Already have an account?'} <Link to={other(portal, mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Sign up' : 'Sign in'}</Link></p>
          <div className="auth-links"><Link to={other(staff ? 'student' : 'admin', 'login')}>{staff ? 'Student sign in' : 'Staff sign in'}</Link>{mode === 'login' && s?.email && <a href={`mailto:${s.email}?subject=${encodeURIComponent('Gateway LMS password help')}`}>Forgot your password?</a>}</div>
        </form>
      </section>
    </main>
  );
}
