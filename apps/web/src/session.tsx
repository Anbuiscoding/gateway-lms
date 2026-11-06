import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from './modules';

export interface User { id: string; name: string; email: string; role: Role; studentId?: string; program?: string; batch?: string; phone?: string }
export interface Session { accessToken: string; user: User }

const KEY = 'gateway_session';
/** Empty in development (Vite proxies /api). In production, set VITE_API_URL to the API address, for example https://gateway-lms-api.onrender.com */
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const portalFor = (role: Role) => (role === 'STUDENT' ? 'student' : 'admin');
export const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

function read(): Session | null {
  try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as Session) : null; } catch { return null; }
}

/** Calls /api/v1 with the stored access token. A 401 clears the session and returns to sign in. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = read();
  let res: Response;
  try {
    res = await fetch(API_BASE + '/api/v1' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: 'Bearer ' + s.accessToken } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('We could not reach the server. Check your internet connection and try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && s && !path.startsWith('/auth/')) {
    localStorage.removeItem(KEY);
    location.assign('/auth/' + portalFor(s.user.role) + '/login');
  }
  if (!res.ok) {
    const fallback = res.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : res.status >= 500 ? 'The server had a problem. Please try again in a moment.' : res.status === 403 ? 'You do not have permission to do that.' : 'Something went wrong. Please try again.';
    throw new Error(json?.error?.message || fallback);
  }
  return json.data as T;
}

/** Downloads a file from the API (for example a CSV export) with the signed-in user's token. */
export async function download(path: string, fallbackName: string) {
  const s = read();
  const res = await fetch(API_BASE + '/api/v1' + path, { headers: s ? { Authorization: 'Bearer ' + s.accessToken } : {} }).catch(() => { throw new Error('We could not reach the server. Check your internet connection and try again.'); });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message || 'Download failed'); }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useApi<T>(path: string) {
  const [n, setN] = useState(0);
  const [state, set] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  useEffect(() => {
    let live = true;
    set((s) => ({ ...s, loading: true, error: '' }));
    api<T>(path)
      .then((data) => live && set({ data, error: '', loading: false }))
      .catch((e: Error) => live && set({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [path, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

interface Ctx { session: Session | null; signIn: (s: Session) => void; signOut: () => void; updateUser: (u: Partial<User>) => void }
const SessionCtx = createContext<Ctx>({ session: null, signIn: () => {}, signOut: () => {}, updateUser: () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(read);
  const signIn = (s: Session) => { localStorage.setItem(KEY, JSON.stringify(s)); setSession(s); };
  const signOut = () => { localStorage.removeItem(KEY); setSession(null); };
  const updateUser = (u: Partial<User>) => setSession((cur) => { if (!cur) return cur; const next = { ...cur, user: { ...cur.user, ...u } }; localStorage.setItem(KEY, JSON.stringify(next)); return next; });
  return <SessionCtx.Provider value={{ session, signIn, signOut, updateUser }}>{children}</SessionCtx.Provider>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const loc = useLocation();
  if (!session) return <Navigate to="/auth/student/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
