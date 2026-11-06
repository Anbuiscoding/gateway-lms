import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { INFO, NAV, ROLE_LABEL, type Role } from './modules';
import { initials, useSession } from './session';
import { CommandPalette, Icon, Logo, ThemeToggle, usePageMeta, useSpotlight } from './ui';
import { NoAccess, NotFound } from './pages/Misc';

/** The four shortcuts shown on a phone's bottom bar, per role. "More" opens the full menu. */
const QUICK: Record<Role, string[]> = {
  STUDENT: ['dashboard', 'learning', 'live-classes', 'assignments'],
  TRAINER: ['dashboard', 'live-classes', 'attendance', 'assignments'],
  ADMIN: ['dashboard', 'students', 'attendance', 'live-classes'],
  SUPER_ADMIN: ['dashboard', 'users', 'courses', 'batches'],
};
const ALL_SLUGS = new Set(Object.values(NAV).flatMap((g) => g.flatMap((x) => x.items.map((m) => m[1]))));

export function Shell() {
  const { session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [cmd, setCmd] = useState(false);
  const loc = useLocation();
  useSpotlight();
  const parts = loc.pathname.split('/').filter(Boolean);
  const slug = parts[0] || 'dashboard';
  const current = session ? NAV[session.user.role].flatMap((g) => g.items).find((m) => m[1] === slug) : undefined;
  usePageMeta(parts.length <= 1 ? (current ? (INFO[slug]?.[1] ?? current[0]) : 'Page not found') : undefined, parts.length <= 1 ? (INFO[slug]?.[2] ?? 'Your learning portal at Gateway Software Solutions.') : undefined);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', k); };
  }, [open]);
  if (!session) return null;
  const { user } = session;
  const groups = NAV[user.role];
  const to = (s: string) => (s === 'dashboard' ? '/' : '/' + s);
  const flat = groups.flatMap((g) => g.items);
  const quick = QUICK[user.role].map((s) => flat.find((m) => m[1] === s)).filter(Boolean) as typeof flat;

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Main navigation">
        <div className="brand"><Logo /></div>
        <nav>
          {groups.map((g) => (
            <div key={g.name}>
              <p className="caption">{g.name}</p>
              {g.items.map(([label, s]) => (
                <NavLink key={s} to={to(s)} end={s === 'dashboard'} className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}><Icon name={s} />{label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <i className="avatar">{initials(user.name)}</i>
          <span><b>{user.name}</b><small>{user.role === 'STUDENT' && user.studentId ? `Student · ${user.studentId}` : ROLE_LABEL[user.role]}</small></span>
          <button className="signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close menu" />}
      <main id="main" tabIndex={-1}>
        <header className="top">
          <div>
            <button className="menu" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu /></button>
            <small>{ROLE_LABEL[user.role]}</small><b> / {current ? (INFO[slug]?.[1] ?? current[0]) : 'Not found'}</b>
          </div>
          <div>
            <button className="jump" onClick={() => setCmd(true)}><Search size={15} /> Jump to… <kbd>Ctrl K</kbd></button>
            <ThemeToggle /><span className="rolechip">{ROLE_LABEL[user.role]}</span>
          </div>
        </header>
        <section className={'content' + (parts.length > 1 ? ' wide' : '')} key={loc.pathname}>
          {current ? <Outlet /> : ALL_SLUGS.has(slug) ? <NoAccess /> : <NotFound />}
        </section>
      </main>
      <nav className="bottomnav" aria-label="Quick navigation">
        {quick.map(([label, s]) => <NavLink key={s} to={to(s)} end={s === 'dashboard'} className={({ isActive }) => (isActive ? 'on' : '')}><Icon name={s} size={20} /><span>{label.replace('Live Classes', 'Classes').replace('Course Management', 'Courses').replace('Users & Roles', 'Users').replace('My Learning', 'Learning')}</span></NavLink>)}
        <button onClick={() => setOpen(true)} aria-label="More"><Menu size={20} /><span>More</span></button>
      </nav>
      <CommandPalette open={cmd} setOpen={setCmd} />
    </div>
  );
}

export function PageHead({ slug }: { slug: string }) {
  const i = INFO[slug];
  if (!i) return null;
  return <div className="pagehead"><p className="eyebrow">{i[0]}</p><h1>{i[1]}</h1><p className="intro">{i[2]}</p></div>;
}
