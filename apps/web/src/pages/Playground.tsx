import React, { useEffect, useState } from 'react';
import { Copy, Play, RotateCcw } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { LANGS, langOf, runCode } from '../runner';
import { useTheme, useToast } from '../ui';

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage full or blocked */ } };

/** Cloud Workbench: a private scratchpad for trying code in any supported language. Saved in this browser. */
export function Workbench() {
  const { theme } = useTheme(); const toast = useToast();
  const [lang, setLang] = useState(() => get('gateway_play_lang') || 'python');
  const [code, setCode] = useState(() => get('gateway_play_' + (get('gateway_play_lang') || 'python')) ?? langOf(get('gateway_play_lang') || 'python').hello);
  const [out, setOut] = useState<{ text: string; html?: string } | null>(null); const [running, setRunning] = useState(false);
  useEffect(() => { set('gateway_play_' + lang, code); set('gateway_play_lang', lang); }, [code, lang]);
  const pick = (l: string) => { setLang(l); setCode(get('gateway_play_' + l) ?? langOf(l).hello); setOut(null); };
  async function run() { setRunning(true); try { const r = await runCode(langOf(lang), code); setOut({ text: r.output, html: r.html }); } catch (e) { const m = e instanceof Error ? e.message : 'Run failed'; setOut({ text: m }); toast.error(m); } finally { setRunning(false); } }
  async function copy() { try { await navigator.clipboard.writeText(code); toast.success('Code copied'); } catch { toast.error('Your browser blocked copying. Select the code and copy it by hand.'); } }
  return (
    <div className="play">
      <div className="ws-bar">
        <select value={lang} onChange={(e) => pick(e.target.value)} aria-label="Language">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
        <button className="btn ghost sm" onClick={() => { if (confirm('Replace your code with a fresh example?')) { setCode(langOf(lang).hello); setOut(null); } }}><RotateCcw size={14} /> Reset</button>
        <button className="btn ghost sm" onClick={copy}><Copy size={14} /> Copy</button>
        <span className="grow" /><small className="muted">Saved in this browser</small>
        <button className="btn glow" onClick={run} disabled={running}><Play size={15} /> {running ? 'Running…' : 'Run'}</button>
      </div>
      <div className="ws-editor play-editor"><Editor height="100%" theme={theme === 'dark' ? 'vs-dark' : 'light'} path={'play-' + lang} language={langOf(lang).monaco} value={code} onChange={(v) => setCode(v ?? '')} options={{ fontSize: 15, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 12 }, wordWrap: 'on' }} /></div>
      <div className="ws-out"><div className="ws-outbar"><b>Output</b>{langOf(lang).mode === 'remote' && <small className="muted">Runs on the Gateway code runner</small>}</div>{out?.html !== undefined ? <iframe title="Preview" sandbox="allow-scripts" srcDoc={out.html} /> : <pre>{out?.text ?? 'Press Run to see the result here.'}</pre>}</div>
    </div>
  );
}
