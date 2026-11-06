import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Radio } from 'lucide-react';
import { api, useApi, useSession } from '../session';
import { LANGS, langOf } from '../runner';
import { EmptyState, ErrorNote, Modal, domainUi, until, useNow, useToast } from '../ui';

interface Domain { id: string; name: string; language: string; blurb: string }
interface Cls { id: string; title: string; domain: string; language: string; status: 'SCHEDULED' | 'LIVE' | 'ENDED'; scheduledAt: string; durationMin: number; batch?: string; topic?: string; trainer: { id: string; name: string } }

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function Scheduler({ domains, onClose, onDone }: { domains: Domain[]; onClose: () => void; onDone: () => void }) {
  const [domain, setDomain] = useState(domains[0]?.id ?? 'web');
  const [language, setLanguage] = useState(domains[0]?.language ?? 'javascript');
  const [f, setF] = useState({ title: '', topic: '', batch: '', durationMin: '60', scheduledAt: localInput(new Date(Date.now() + 3600000)) });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const pick = (d: Domain) => { setDomain(d.id); setLanguage(d.language); };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api('/live-classes', { method: 'POST', body: { ...f, durationMin: Number(f.durationMin), batch: f.batch || undefined, topic: f.topic || undefined, domain, language, scheduledAt: new Date(f.scheduledAt).toISOString(), starterCode: langOf(language).hello } });
      onDone();
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not schedule the class'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Schedule a class" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p className="eyebrow">1. Choose the class domain</p>
        <div className="domains" role="radiogroup" aria-label="Class domain">
          {domains.map((d) => { const u = domainUi(d.id); const I = u.icon; return (
            <button type="button" key={d.id} role="radio" aria-checked={domain === d.id} className={'dom spot' + (domain === d.id ? ' on' : '')} style={{ ['--c' as string]: u.color }} onClick={() => pick(d)}>
              <I size={22} /><b>{d.name}</b><small>{d.blurb}</small>
            </button>); })}
        </div>
        <p className="eyebrow">2. Details</p>
        <div className="two">
          <label>Class title<input required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Introduction to Machine Learning" /></label>
          <label>Starting language
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          </label>
          <label>Date and time<input type="datetime-local" required value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></label>
          <label>Length (minutes)<input type="number" min={15} max={480} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></label>
          <label>Topic (optional)<input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></label>
          <label>Batch (optional)<input value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} placeholder="e.g. DS-AI-24" /></label>
        </div>
        {err && <p className="auth-error" role="alert">{err}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Scheduling…' : 'Schedule class'}</button></div>
      </form>
    </Modal>
  );
}

export function Classes() {
  const { session } = useSession();
  const nav = useNavigate(); const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tick, setTick] = useState(0);
  const { data, error, loading, reload } = useApi<Cls[]>('/live-classes?r=' + tick);
  const doms = useApi<Domain[]>('/live-classes/domains');
  const [open, setOpen] = useState(false);
  const now = useNow(30000);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { if (params.get('new') && session?.user.role !== 'STUDENT') { setOpen(true); setParams({}, { replace: true }); } }, [params, session, setParams]);
  if (!session) return null;
  const host = session.user.role !== 'STUDENT';
  const mine = (c: Cls) => session.user.role !== 'TRAINER' || c.trainer.id === session.user.id;

  async function goLive(c: Cls) { try { await api(`/live-classes/${c.id}/start`, { method: 'POST', body: {} }); toast.success('You are live. Students can join now.'); nav('/live-classes/' + c.id); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not start the class'); } }
  async function cancel(c: Cls) { if (confirm(`Cancel “${c.title}”?`)) { try { await api('/live-classes/' + c.id, { method: 'DELETE' }); toast.success('Class cancelled'); setTick((n) => n + 1); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not cancel the class'); } } }

  const card = (c: Cls) => {
    const u = domainUi(c.domain); const I = u.icon; const live = c.status === 'LIVE';
    return (
      <article key={c.id} className={'cls spot' + (live ? ' live' : '')} style={{ ['--c' as string]: u.color }}>
        <div className="cls-art"><I size={34} />{live && <span className="pill-live">LIVE</span>}</div>
        <div className="cls-body">
          <small>{doms.data?.find((d) => d.id === c.domain)?.name ?? c.domain} · {langOf(c.language).label}</small>
          <h3>{c.title}</h3>
          <p>{c.trainer.name} · {new Date(c.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {c.durationMin} min{c.batch ? ` · ${c.batch}` : ''}</p>
          <div className="actions left">
            {live && <Link className="btn glow" to={'/live-classes/' + c.id}><Radio size={15} /> {host ? 'Open room' : 'Join class'}</Link>}
            {c.status === 'SCHEDULED' && host && mine(c) && <><button className="btn" onClick={() => goLive(c)}>Go live</button><button className="btn ghost" onClick={() => cancel(c)}>Cancel</button></>}
            {c.status === 'SCHEDULED' && !host && <span className="tag">Starts {until(c.scheduledAt, now)}</span>}
            {c.status === 'ENDED' && <span className="tag">Ended</span>}
          </div>
        </div>
      </article>
    );
  };
  const live = (data ?? []).filter((c) => c.status === 'LIVE');
  const next = (data ?? []).filter((c) => c.status === 'SCHEDULED');
  const past = (data ?? []).filter((c) => c.status === 'ENDED').reverse();
  return <>
    <div className="pagehead row-between">
      <div><p className="eyebrow">Virtual classroom</p><h1>Live classes</h1><p className="intro">{host ? 'Choose a domain, schedule the class and teach in any language.' : 'Join instructor-led classes in the virtual workspace.'}</p></div>
      {host && <button className="btn glow" onClick={() => setOpen(true)} disabled={!doms.data}><Plus size={16} /> Schedule a class</button>}
    </div>
    {loading && !data && <div className="skeleton tall" aria-busy="true" />}
    {error && <ErrorNote text={error} onRetry={reload} />}
    {data && !data.length && <section className="panel"><EmptyState compact title="No classes yet" text={host ? 'Choose a domain and schedule the first class.' : 'Your trainer will schedule live classes here.'}>{host && <button className="btn" onClick={() => setOpen(true)}>Schedule a class</button>}</EmptyState></section>}
    {live.length > 0 && <><h2 className="sect">Live now</h2><div className="clsgrid">{live.map(card)}</div></>}
    {next.length > 0 && <><h2 className="sect">Upcoming</h2><div className="clsgrid">{next.map(card)}</div></>}
    {past.length > 0 && <><h2 className="sect">Recent</h2><div className="clsgrid">{past.slice(0, 4).map(card)}</div></>}
    {open && doms.data && <Scheduler domains={doms.data} onClose={() => setOpen(false)} onDone={() => { setOpen(false); setTick((n) => n + 1); toast.success('Class scheduled'); }} />}
  </>;
}
