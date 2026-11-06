import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Activity, Award, BarChart3, Bell, BookOpen, Brain, Briefcase, Bug, Building2, CalendarCheck, ClipboardCheck, Cloud, CreditCard, Cpu, Database, FileCheck2, FlaskConical, FolderKanban, Globe, GraduationCap, Layers, LayoutDashboard, LifeBuoy, Library, ListChecks, Megaphone, MessageSquare, Plug, Radio, Route, ScrollText, Search, Server, Settings, Shield, ShieldCheck, Smartphone, Sparkles, Sun, Moon, Terminal, User, UserCog, Users } from 'lucide-react';
import { NAV } from './modules';
import { useSession } from './session';

export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, learning: BookOpen, courses: Library, paths: Route, 'live-classes': Radio, workbench: Terminal, labs: FlaskConical, projects: FolderKanban,
  assignments: ClipboardCheck, assessments: FileCheck2, results: BarChart3, certificates: Award, placement: Briefcase, messages: MessageSquare, announcements: Megaphone,
  assistant: Sparkles, notifications: Bell, profile: User, settings: Settings, support: LifeBuoy, batches: Layers, students: GraduationCap, trainers: UserCog,
  attendance: CalendarCheck, 'question-bank': ListChecks, reports: BarChart3, analytics: Activity, admins: ShieldCheck, users: Users, institutions: Building2,
  'audit-logs': ScrollText, security: Shield, integrations: Plug, billing: CreditCard, progress: Activity,
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const C = ICONS[name] ?? Sparkles;
  return <C size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export const DOMAIN_UI: Record<string, { icon: LucideIcon; color: string }> = {
  web: { icon: Globe, color: '#38bdf8' }, data: { icon: Brain, color: '#a78bfa' }, backend: { icon: Server, color: '#34d399' }, systems: { icon: Cpu, color: '#fb923c' },
  cloud: { icon: Cloud, color: '#60a5fa' }, mobile: { icon: Smartphone, color: '#f472b6' }, database: { icon: Database, color: '#fbbf24' }, qa: { icon: Bug, color: '#4ade80' },
  security: { icon: Shield, color: '#f87171' }, office: { icon: Briefcase, color: '#94a3b8' },
};
export const domainUi = (id: string) => DOMAIN_UI[id] ?? DOMAIN_UI.office;

/** Animated progress ring. */
export function Ring({ value, size = 76, stroke = 8, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 80); return () => clearTimeout(t); }, [value]);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${value} percent`}>
      <svg width={size} height={size}>
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f47721" /><stop offset="1" stopColor="#ffb48a" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--track)" }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#rg)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <b>{label ?? value + '%'}</b>
    </div>
  );
}

/** Counts a number up when it appears: "68%" or "04" or "26h". */
export function CountUp({ value }: { value: string }) {
  const m = /^(\d+)(.*)$/.exec(value);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!m) return;
    const to = Number(m[1]); const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const p = Math.min((t - t0) / 800, 1); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (!m) return <>{value}</>;
  return <>{String(n).padStart(m[1].length, '0')}{m[2]}</>;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
export function until(ts: string | number | Date, now: number) {
  const d = new Date(ts).getTime() - now;
  if (d <= 0) return 'starting';
  const m = Math.floor(d / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24);
  return days ? `in ${days}d ${h % 24}h` : h ? `in ${h}h ${m % 60}m` : `in ${m}m`;
}

/** Glow that follows the pointer on any element with the "spot" class. */
export function useSpotlight() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('.spot') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px');
      el.style.setProperty('--my', e.clientY - r.top + 'px');
    };
    document.addEventListener('pointermove', move);
    return () => document.removeEventListener('pointermove', move);
  }, []);
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">✕</button></header>
        {children}
      </div>
    </div>
  );
}

/** Ctrl/Cmd + K opens a jump-to menu built from the signed-in role's modules. */
export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { session } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => (session ? NAV[session.user.role].flatMap((g) => g.items.map((m) => ({ label: m[0], slug: m[1], group: g.name }))) : []), [session]);
  const shown = items.filter((x) => (x.label + x.group).toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(!open); } if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, setOpen]);
  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);
  if (!open) return null;
  const go = (slug: string) => { nav(slug === 'dashboard' ? '/' : '/' + slug); setOpen(false); };
  return (
    <div className="modal-back top" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="palette" role="dialog" aria-label="Jump to">
        <div className="pin"><Search size={18} /><input ref={input} value={q} placeholder="Jump to a module…" onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((i + 1) % Math.max(shown.length, 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setI((i - 1 + shown.length) % Math.max(shown.length, 1)); } if (e.key === 'Enter' && shown[i]) go(shown[i].slug); }} /></div>
        <ul>{shown.map((x, n) => <li key={x.slug}><button className={n === i ? 'on' : ''} onMouseEnter={() => setI(n)} onClick={() => go(x.slug)}><Icon name={x.slug} /> {x.label}<small>{x.group}</small></button></li>)}{!shown.length && <li className="empty">No matching module.</li>}</ul>
      </div>
    </div>
  );
}

/** A short burst of confetti when `fire` becomes true. */
export function Confetti({ fire }: { fire: boolean }) {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, n) => ({ n, x: Math.random() * 100, d: Math.random() * 0.4, c: ['#078fe8', '#f47721', '#5ee0a0', '#ffb48a', '#a78bfa'][n % 5], r: Math.random() * 360 })), []);
  const [show, setShow] = useState(false);
  useEffect(() => { if (fire) { setShow(true); const t = setTimeout(() => setShow(false), 2200); return () => clearTimeout(t); } }, [fire]);
  if (!show) return null;
  return <div className="confetti" aria-hidden="true">{bits.map((b) => <i key={b.n} style={{ left: b.x + '%', background: b.c, animationDelay: b.d + 's', transform: `rotate(${b.r}deg)` }} />)}</div>;
}

type Theme = 'dark' | 'light';
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => { try { const v = localStorage.getItem('gateway_theme'); return v === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('gateway_theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>{children}</ThemeCtx.Provider>;
}
/** Sun and moon switch, used in the top bar and on the sign-in page. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return <button className="themebtn" onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

/** Sets the browser tab title and the page description for the current screen. */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · Gateway LMS`;
    if (description) {
      let m = document.querySelector('meta[name="description"]');
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.append(m); }
      m.setAttribute('content', description);
    }
  }, [title, description]);
}

/* ---------- toasts: success, error and info messages ---------- */
interface ToastItem { id: number; kind: 'success' | 'error' | 'info'; text: string }
interface Toasts { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }
const ToastCtx = createContext<Toasts>({ success: () => {}, error: () => {}, info: () => {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const add = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  const api = useMemo<Toasts>(() => ({ success: (t) => add('success', t), error: (t) => add('error', t), info: (t) => add('info', t) }), [add]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-label="Messages">
        {list.map((t) => (
          <div key={t.id} className={'toast ' + t.kind} role={t.kind === 'error' ? 'alert' : 'status'}>
            <i aria-hidden="true">{t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : 'i'}</i><span>{t.text}</span>
            <button onClick={() => setList((l) => l.filter((x) => x.id !== t.id))} aria-label="Dismiss message">✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Inline error with a retry button, for screens that load data. */
export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return <div className="notice" role="alert"><span>{text}</span>{onRetry && <button className="btn ghost sm" onClick={onRetry}>Try again</button>}</div>;
}

/* ---------- empty, 404 and error pages ---------- */
type Kind = 'empty' | 'lost' | 'lock' | 'build' | 'error';
function Art({ kind }: { kind: Kind }) {
  const c = { stroke: 'currentColor', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="art-svg" viewBox="0 0 160 120" width="200" height="150" aria-hidden="true">
      <ellipse cx="80" cy="108" rx="52" ry="7" fill="currentColor" opacity=".12" />
      {kind === 'empty' && <g className="float"><rect x="38" y="30" width="84" height="58" rx="10" {...c} /><path d="M38 52h84M62 70h36" {...c} /><circle cx="122" cy="30" r="9" fill="var(--o)" stroke="none" /></g>}
      {kind === 'lost' && <g className="float"><circle cx="72" cy="56" r="28" {...c} /><path d="M93 77l24 24" {...c} /><path d="M62 48l20 16M82 48L62 64" stroke="var(--o)" strokeWidth="4" strokeLinecap="round" /></g>}
      {kind === 'lock' && <g className="float"><rect x="48" y="52" width="64" height="46" rx="10" {...c} /><path d="M60 52V40a20 20 0 0140 0v12" {...c} /><circle cx="80" cy="75" r="6" fill="var(--o)" stroke="none" /></g>}
      {kind === 'build' && <g className="float"><rect x="36" y="64" width="34" height="34" rx="6" {...c} /><rect x="76" y="64" width="34" height="34" rx="6" {...c} /><rect x="56" y="26" width="34" height="34" rx="6" stroke="var(--o)" strokeWidth="3" fill="none" /><path d="M118 40l8-8m0 0l8 8m-8-8v22" {...c} /></g>}
      {kind === 'error' && <g className="float"><path d="M40 70h22l8-14 12 28 8-14h30" {...c} /><circle cx="80" cy="30" r="12" stroke="var(--o)" strokeWidth="3" fill="none" /><path d="M80 25v6M80 35v.5" stroke="var(--o)" strokeWidth="3" strokeLinecap="round" /></g>}
    </svg>
  );
}
export function EmptyState({ kind = 'empty', title, text, children, compact }: { kind?: Kind; title: string; text?: string; children?: React.ReactNode; compact?: boolean }) {
  return <div className={'emptystate' + (compact ? ' compact' : '')}><Art kind={kind} /><h2>{title}</h2>{text && <p>{text}</p>}{children && <div className="actions center">{children}</div>}</div>;
}
export function ErrorPage() {
  return <main className="standalone"><EmptyState kind="error" title="Something went wrong" text="The page hit an unexpected problem. Your work is safe. Reloading usually fixes it."><button className="btn" onClick={() => location.reload()}>Reload the page</button><a className="btn ghost" href="/">Go to the start</a></EmptyState></main>;
}
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error(e); }
  render() { return this.state.failed ? <ErrorPage /> : this.props.children; }
}

/** The company logo. One compressed file, with its size set so the page never jumps while it loads. */
export function Logo({ className }: { className?: string }) {
  return <img className={className} src="/assets/gsslogo.png" width={480} height={154} alt="Gateway Software Solutions, IT & ITES" decoding="async" />;
}

/** A small editor window that types a few lines of code. Decorative: shows a learner's first name. */
const TOKEN = /(\/\/.*|"[^"]*"|\b(?:const|let|function|return|await|async)\b|\b\d+\b)/g;
export function CodeTicker({ name }: { name: string }) {
  const code = useMemo(() => [`const learner = ${JSON.stringify(name || 'you')};`, 'learner.attend("live class");', 'learner.practice("code along");', '// pause, tweak, run, repeat', 'learner.build("something real");'].join('\n'), [name]);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(code.length); return; }
    const t = setInterval(() => setN((x) => (x > code.length + 70 ? 0 : x + 1)), 55);
    return () => clearInterval(t);
  }, [code]);
  const shown = code.slice(0, Math.min(n, code.length)).split('\n');
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-bar"><i /><i /><i /><span>learn.js</span></div>
      <pre>{shown.map((line, i) => <div key={i}><b>{i + 1}</b>{line.split(TOKEN).map((p, k) => <span key={k} className={/^\/\//.test(p) ? 'c' : /^"/.test(p) ? 's' : /^(const|let|function|return|await|async)$/.test(p) ? 'k' : /^\d+$/.test(p) ? 'n' : ''}>{p}</span>)}{i === shown.length - 1 && <em className="caret" />}</div>)}</pre>
    </div>
  );
}
