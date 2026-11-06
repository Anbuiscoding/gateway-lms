import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { io, type Socket } from 'socket.io-client';
import { Expand, Hand, LogOut, Pause, Play, Send, Share2, Users, Video } from 'lucide-react';
import { API_BASE, api, initials, useApi, useSession } from '../session';
import { LANGS, langOf, runCode } from '../runner';
import { domainUi, useNow, useTheme } from '../ui';

interface Info { id: string; title: string; domain: string; language: string; status: string; startedAt?: string; trainer: { id: string; name: string } }
interface Msg { id: string; who: string; role: string; text: string; at: number }
interface Person { id: string; name: string; role: string; host: boolean; paused: boolean }
interface Cursor { line: number; col: number; sel?: { sl: number; sc: number; el: number; ec: number } | null }
interface Out { label: string; text: string; html?: string }

const isTemplate = (t: string) => LANGS.some((l) => l.hello === t);

/** Replace only the part of the model that changed, so scroll position and the view stay steady while the trainer types. */
function applyDiff(ed: any, next: string) {
  const m = ed.getModel(); if (!m) return;
  const cur: string = m.getValue(); if (cur === next) return;
  let s = 0; const max = Math.min(cur.length, next.length);
  while (s < max && cur[s] === next[s]) s++;
  let ce = cur.length, ne = next.length;
  while (ce > s && ne > s && cur[ce - 1] === next[ne - 1]) { ce--; ne--; }
  const a = m.getPositionAt(s), b = m.getPositionAt(ce);
  m.applyEdits([{ range: { startLineNumber: a.lineNumber, startColumn: a.column, endLineNumber: b.lineNumber, endColumn: b.column }, text: next.slice(s, ne) }]);
}

/**
 * Live classroom.
 * Trainer: types in the class editor; everyone sees it, including the trainer's cursor.
 * Student: follows the trainer live (read only). Pause freezes a private copy that can be edited and run.
 * Resume jumps straight back to wherever the trainer is now. Edits made while paused are kept in My sandbox.
 */
export function Workspace() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const { theme } = useTheme();
  const nav = useNavigate();
  const info = useApi<Info>('/live-classes/' + id);
  const sock = useRef<Socket | null>(null);
  const [host, setHost] = useState(false);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState('');
  const [liveCode, setLiveCode] = useState('');
  const [liveLang, setLiveLang] = useState('javascript');
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [tab, setTab] = useState<'live' | 'mine'>('live');
  const [paused, setPaused] = useState(false);
  const [snap, setSnap] = useState('');
  const [local, setLocal] = useState('');
  const [localLang, setLocalLang] = useState('javascript');
  const [mine, setMine] = useState(LANGS[0].hello);
  const [mineLang, setMineLang] = useState('javascript');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [hands, setHands] = useState<string[]>([]);
  const [side, setSide] = useState<'chat' | 'people'>('chat');
  const [draft, setDraft] = useState('');
  const [out, setOut] = useState<Out | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const [outTab, setOutTab] = useState<'mine' | 'trainer'>('mine');
  const [running, setRunning] = useState(false);
  const [focus, setFocus] = useState(false);
  const [note, setNote] = useState('');
  const [edReady, setEdReady] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const edRef = useRef<any>(null); const monRef = useRef<any>(null); const decoRef = useRef<string[]>([]);
  const hostRef = useRef(false); const tabRef = useRef(tab); const pausedRef = useRef(false); const desiredRef = useRef('');
  const now = useNow(1000);

  const emit = useCallback((ev: string, ...a: unknown[]) => sock.current?.emit(ev, ...a), []);
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 4500); };

  // ---- connection ----
  useEffect(() => {
    if (!session) return;
    const opts = { auth: { token: session.accessToken }, transports: ['websocket', 'polling'] };
    const s = API_BASE ? io(API_BASE, opts) : io(opts);
    sock.current = s;
    s.on('connect', () => s.emit('room:join', id, (r: any) => {
      if (r?.error) { setProblem(r.error); return; }
      setHost(r.host); hostRef.current = r.host; setLiveCode(r.state.code); setLiveLang(r.state.language); setMsgs(r.state.chat); setHands(r.hands); setCursor(r.state.cursor);
      if (r.state.output) setShared(r.state.output);
      setReady(true);
    }));
    s.on('connect_error', () => setProblem('Could not connect to the live room. Check that the API is running.'));
    s.on('code:change', (p: { code: string }) => setLiveCode(p.code));
    s.on('lang:change', (l: string) => setLiveLang(l));
    s.on('cursor', (c: Cursor) => setCursor(c));
    s.on('output:share', (t: string) => { setShared(t); if (!pausedRef.current) setOutTab('trainer'); });
    s.on('chat:message', (m: Msg) => setMsgs((x) => [...x, m]));
    s.on('presence', (p: { people: Person[]; hands: string[] }) => { setPeople(p.people); setHands(p.hands); });
    s.on('class:ended', () => { setProblem('The trainer ended this class. Thank you for joining!'); setReady(false); });
    return () => { s.disconnect(); };
  }, [id, session]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);
  useEffect(() => { document.body.classList.toggle('focus', focus); return () => document.body.classList.remove('focus'); }, [focus]);
  useEffect(() => { pausedRef.current = paused; emit('follow:state', paused); }, [paused, emit]);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // ---- what the editor shows ----
  const editable = tab === 'mine' || host || paused;
  const desired = tab === 'mine' ? mine : host ? liveCode : paused ? local : liveCode;
  const editorLang = tab === 'mine' ? mineLang : host ? liveLang : paused ? localLang : liveLang;
  desiredRef.current = desired;
  useEffect(() => { if (edReady && edRef.current) applyDiff(edRef.current, desired); }, [desired, edReady]);

  // Show the trainer's caret and selection, and follow it, while a student is watching live.
  useEffect(() => {
    const ed = edRef.current, mon = monRef.current; if (!ed || !mon) return;
    if (host || paused || tab !== 'live' || !cursor) { decoRef.current = ed.deltaDecorations(decoRef.current, []); return; }
    const decs: any[] = [{ range: new mon.Range(cursor.line, cursor.col, cursor.line, cursor.col), options: { beforeContentClassName: 'trainer-caret', stickiness: 1 } }];
    if (cursor.sel) decs.push({ range: new mon.Range(cursor.sel.sl, cursor.sel.sc, cursor.sel.el, cursor.sel.ec), options: { className: 'trainer-sel' } });
    decoRef.current = ed.deltaDecorations(decoRef.current, decs);
    ed.revealLineInCenterIfOutsideViewport(cursor.line, 1);
  }, [cursor, paused, tab, host, liveCode, edReady]);

  const pause = () => { setSnap(liveCode); setLocal(liveCode); setLocalLang(liveLang); setPaused(true); };
  const resume = () => {
    if (local !== snap) { setMine(local); setMineLang(localLang); flash('Back to live. Your edits were saved in My sandbox.'); }
    setPaused(false); setOutTab('trainer');
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.altKey && e.key.toLowerCase() === 'p' && !hostRef.current && tabRef.current === 'live') { e.preventDefault(); pausedRef.current ? resume() : pause(); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });

  const onMount = (ed: any, mon: any) => {
    edRef.current = ed; monRef.current = mon; setEdReady(true);
    ed.onDidChangeCursorSelection((e: any) => {
      if (!hostRef.current || tabRef.current !== 'live') return;
      const s = e.selection;
      emit('cursor', { line: s.positionLineNumber, col: s.positionColumn, sel: s.isEmpty() ? null : { sl: s.startLineNumber, sc: s.startColumn, el: s.endLineNumber, ec: s.endColumn } });
    });
  };
  const onChange = (v?: string) => {
    const t = v ?? ''; if (t === desiredRef.current) return;
    if (tab === 'mine') setMine(t);
    else if (host) { setLiveCode(t); emit('code:change', t); }
    else if (paused) setLocal(t);
  };
  const changeLang = (l: string) => {
    if (tab === 'mine') { setMineLang(l); if (!mine.trim() || isTemplate(mine)) setMine(langOf(l).hello); return; }
    if (host) { setLiveLang(l); emit('lang:change', l); if (!liveCode.trim() || isTemplate(liveCode)) { const h = langOf(l).hello; setLiveCode(h); emit('code:change', h); } return; }
    if (paused) { setLocalLang(l); if (!local.trim() || isTemplate(local)) setLocal(langOf(l).hello); }
  };

  async function run() {
    const t = tab === 'mine' ? { code: mine, lang: mineLang, label: 'Your sandbox' } : host ? { code: liveCode, lang: liveLang, label: 'Class code output' } : paused ? { code: local, lang: localLang, label: 'Your edited copy' } : { code: liveCode, lang: liveLang, label: 'Trainer’s code, run by you' };
    setRunning(true); setOutTab('mine');
    try { const r = await runCode(langOf(t.lang), t.code); setOut({ label: t.label, text: r.output, html: r.html }); }
    catch (e) { setOut({ label: 'Could not run', text: e instanceof Error ? e.message : 'Run failed' }); }
    finally { setRunning(false); }
  }
  const send = (e: React.FormEvent) => { e.preventDefault(); if (draft.trim()) { emit('chat:send', draft); setDraft(''); } };
  async function endClass() { if (confirm('End this class for everyone?')) { emit('class:end'); await api(`/live-classes/${id}/end`, { method: 'POST', body: {} }).catch(() => {}); nav('/live-classes'); } }

  if (!session) return null;
  const ui = domainUi(info.data?.domain ?? 'web');
  const trainerName = info.data?.trainer.name ?? 'the trainer';
  const behind = paused && liveCode !== snap;
  const learners = people.filter((p) => !p.host);
  const elapsed = info.data?.startedAt ? Math.max(0, Math.floor((now - new Date(info.data.startedAt).getTime()) / 1000)) : 0;
  const clock = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60].map((n) => String(n).padStart(2, '0')).join(':');
  const showTrainerOut = !host && outTab === 'trainer' && shared !== null;
  const view = showTrainerOut ? { label: 'Trainer’s output', text: shared as string, html: undefined } : out;

  if (problem) return <div className="panel center"><h2>{problem}</h2><Link className="btn" to="/live-classes">Back to classes</Link></div>;
  return (
    <div className="ws" style={{ ['--c' as string]: ui.color }}>
      <header className="ws-top">
        <div className="ws-title"><ui.icon size={20} /><div><b>{info.data?.title ?? 'Loading class…'}</b><small>{trainerName} · {langOf(liveLang).label}</small></div></div>
        <span className="pill-live">LIVE {clock}</span>
        <div className="ws-tools">
          {host && <span className="muted watchers"><Users size={14} /> {learners.length - learners.filter((p) => p.paused).length} following · {learners.filter((p) => p.paused).length} paused</span>}
          {!host && <button className={'btn ghost' + (hands.includes(session.user.id) ? ' on' : '')} onClick={() => emit('hand:toggle')}><Hand size={15} /> {hands.includes(session.user.id) ? 'Lower hand' : 'Raise hand'}</button>}
          <a className="btn ghost" href={`https://meet.jit.si/gateway-lms-${id}`} target="_blank" rel="noopener noreferrer"><Video size={15} /> Video call</a>
          <button className="btn ghost" onClick={() => setFocus(!focus)} aria-pressed={focus}><Expand size={15} /> Focus</button>
          {host ? <button className="btn danger" onClick={endClass}>End class</button> : <Link className="btn ghost" to="/live-classes"><LogOut size={15} /> Leave</Link>}
        </div>
      </header>
      <div className="ws-body">
        <section className="ws-main">
          <div className="ws-bar">
            <div className="seg"><button className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>{host ? 'Class editor' : 'Live class'}</button><button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My sandbox</button></div>
            <select value={editorLang} onChange={(e) => changeLang(e.target.value)} disabled={tab === 'live' && !host && !paused} aria-label="Language">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
            {!host && tab === 'live' && (paused
              ? <button className="btn glow" onClick={resume} title="Alt + P"><Play size={15} /> Resume live</button>
              : <button className="btn ghost" onClick={pause} title="Alt + P" disabled={!ready}><Pause size={15} /> Pause and try</button>)}
            <span className="grow" />
            {host && out && tab === 'live' && <button className="btn ghost" onClick={() => emit('output:share', out.text)}><Share2 size={15} /> Share output</button>}
            <button className="btn" onClick={run} disabled={running || !ready}><Play size={15} /> {running ? 'Running…' : 'Run'}</button>
          </div>
          {!host && tab === 'live' && (
            <div className={'ws-banner ' + (paused ? 'paused' : 'live')} role="status">
              {paused
                ? <><b>Paused.</b> This is your own copy. Edit anything and press Run.{behind && <> {trainerName} has kept typing.</>} Resume jumps back to the live code.</>
                : <><b>Live.</b> Following {trainerName}’s typing. Pause any time to try the code yourself. The class carries on without you.</>}
            </div>
          )}
          {note && <div className="ws-banner note" role="status">{note}</div>}
          <div className={'ws-editor' + (tab === 'live' && !host ? (paused ? ' paused' : ' following') : '')} data-ribbon={tab === 'live' && !host ? (paused ? 'PAUSED · YOUR COPY' : 'LIVE') : ''}>
            <Editor height="100%" theme={theme === 'dark' ? 'vs-dark' : 'light'} language={langOf(editorLang).monaco} onMount={onMount} onChange={onChange}
              options={{ readOnly: !editable, fontSize: 15, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 14 }, fontLigatures: true, smoothScrolling: true, cursorSmoothCaretAnimation: 'on' }} />
          </div>
          <div className="ws-out">
            <div className="ws-outbar">
              {!host && shared !== null
                ? <div className="seg small"><button className={!showTrainerOut ? 'on' : ''} onClick={() => setOutTab('mine')}>My output</button><button className={showTrainerOut ? 'on' : ''} onClick={() => setOutTab('trainer')}>Trainer’s output</button></div>
                : <b>{view?.label ?? 'Output'}</b>}
              {!showTrainerOut && langOf(editorLang).mode === 'remote' && <small className="muted">Runs on the Gateway code runner</small>}
              {!showTrainerOut && view?.label && !host && shared !== null && <small className="muted">{view.label}</small>}
            </div>
            {view?.html !== undefined ? <iframe title="Preview" sandbox="allow-scripts" srcDoc={view.html} /> : <pre>{view?.text ?? 'Press Run to see the result here.'}</pre>}
          </div>
        </section>
        <aside className="ws-side">
          <div className="seg"><button className={side === 'chat' ? 'on' : ''} onClick={() => setSide('chat')}>Chat</button><button className={side === 'people' ? 'on' : ''} onClick={() => setSide('people')}><Users size={14} /> People {people.length}</button></div>
          {side === 'chat' ? <>
            <div className="chat big" aria-live="polite">{msgs.map((m) => <div key={m.id} className={'msg' + (m.who === session.user.name ? ' me' : '')}><small>{m.who}{m.role === 'TRAINER' && ' · trainer'}</small>{m.text}</div>)}{!msgs.length && <p className="empty">Say hello to the class.</p>}<div ref={end} /></div>
            <form className="send" onSubmit={send}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message the class" aria-label="Message" disabled={!ready} /><button className="btn" aria-label="Send"><Send size={16} /></button></form>
          </> : <div className="people">{people.map((p) => <div className="row" key={p.id}><i className={'avatar online' + (p.host ? ' host' : '')}>{initials(p.name)}</i><div className="grow"><h3>{p.name}{p.id === session.user.id && ' (you)'}</h3><p>{p.host ? 'Host' : p.paused ? 'Paused, trying the code' : 'Following live'}</p></div>{hands.includes(p.id) && <Hand size={16} className="hand" aria-label="Hand raised" />}</div>)}</div>}
        </aside>
      </div>
    </div>
  );
}
