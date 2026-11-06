import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

// Languages that need a server-side runner. JavaScript, Python and HTML run inside the browser.
// Piston-compatible runner expected at CODE_RUNNER_URL (see README).
const MAP = { javascript: 'javascript', typescript: 'typescript', python: 'python', java: 'java', c: 'c', cpp: 'c++', csharp: 'csharp', go: 'go', rust: 'rust', php: 'php', ruby: 'ruby', kotlin: 'kotlin', swift: 'swift', bash: 'bash', sql: 'sqlite3', r: 'r', dart: 'dart', lua: 'lua' };
const router = Router();
router.post('/', requireAuth, rateLimit({ windowMs: 60 * 1000, max: 30 }), async (req, res, next) => {
  try {
    const { language, code, stdin } = z.object({ language: z.enum(Object.keys(MAP)), code: z.string().max(50000), stdin: z.string().max(5000).optional() }).parse(req.body);
    const base = process.env.CODE_RUNNER_URL;
    if (!base) return res.status(503).json({ success: false, error: { code: 'RUNNER_NOT_CONFIGURED', message: 'No code runner is connected yet. Ask your administrator to set CODE_RUNNER_URL.' } });
    const r = await fetch(base.replace(/\/$/, '') + '/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ language: MAP[language], version: '*', files: [{ content: code }], stdin: stdin || '', run_timeout: 5000, compile_timeout: 10000 }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ success: false, error: { code: 'RUNNER_ERROR', message: j.message || 'The code runner returned an error' } });
    const output = j.compile?.code > 0 ? j.compile.output : j.run?.output ?? '';
    res.json({ success: true, data: { output, exitCode: j.run?.code ?? 0 } });
  } catch (e) { if (e?.name === 'TimeoutError') return res.status(504).json({ success: false, error: { code: 'TIMEOUT', message: 'The code runner took too long' } }); next(e); }
});
export default router;
