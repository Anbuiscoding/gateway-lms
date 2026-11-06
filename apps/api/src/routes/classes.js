import { Router } from 'express';
import { z } from 'zod';
import { ClassSession } from '../models/ClassSession.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { DOMAINS, LANGS } from '../domains.js';

const router = Router();
router.use(requireAuth);
const HOSTS = ['TRAINER', 'ADMIN', 'SUPER_ADMIN'];
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  domain: z.enum(DOMAINS.map((d) => d.id)),
  language: z.enum(LANGS).optional(),
  topic: z.string().trim().max(200).optional(),
  scheduledAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(15).max(480).default(60),
  batch: z.string().trim().max(40).optional(),
  starterCode: z.string().max(5000).optional(),
});

async function loadOwned(req, res) {
  const s = await ClassSession.findById(req.params.id).catch(() => null);
  if (!s) { fail(res, 404, 'NOT_FOUND', 'Class not found'); return null; }
  if (req.user.role === 'TRAINER' && String(s.trainer) !== String(req.user._id)) { fail(res, 403, 'FORBIDDEN', 'Only the class trainer can do this'); return null; }
  return s;
}
const view = (s) => ({ id: String(s._id), title: s.title, domain: s.domain, language: s.language, topic: s.topic, batch: s.batch, scheduledAt: s.scheduledAt, durationMin: s.durationMin, status: s.status, startedAt: s.startedAt, trainer: s.trainer?.name ? { id: String(s.trainer._id), name: s.trainer.name } : { id: String(s.trainer) } });

router.get('/domains', (req, res) => ok(res, DOMAINS));

router.get('/', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    const filter = { $or: [{ status: 'LIVE' }, { scheduledAt: { $gte: since } }] };
    if (req.user.role === 'TRAINER') filter.trainer = req.user._id;
    const rows = await ClassSession.find(filter).populate('trainer', 'name').sort({ scheduledAt: 1 }).limit(80);
    ok(res, rows.map(view));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const s = await ClassSession.findById(req.params.id).populate('trainer', 'name').catch(() => null);
    if (!s) return fail(res, 404, 'NOT_FOUND', 'Class not found');
    ok(res, view(s));
  } catch (e) { next(e); }
});

router.post('/', allowRoles(...HOSTS), async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body);
    const domain = DOMAINS.find((d) => d.id === b.domain);
    const s = await ClassSession.create({ ...b, language: b.language || domain.language, trainer: req.user._id });
    await s.populate('trainer', 'name');
    ok(res, view(s), 201);
  } catch (e) { next(e); }
});

router.post('/:id/start', allowRoles(...HOSTS), async (req, res, next) => {
  try {
    const s = await loadOwned(req, res); if (!s) return;
    if (s.status === 'ENDED') return fail(res, 409, 'ENDED', 'This class has already ended');
    if (s.status === 'SCHEDULED') { s.status = 'LIVE'; s.startedAt = new Date(); await s.save(); }
    ok(res, { id: String(s._id), status: s.status });
  } catch (e) { next(e); }
});

router.post('/:id/end', allowRoles(...HOSTS), async (req, res, next) => {
  try {
    const s = await loadOwned(req, res); if (!s) return;
    s.status = 'ENDED'; s.endedAt = new Date(); await s.save();
    req.app.get('io')?.to('class:' + s._id).emit('class:ended');
    ok(res, { id: String(s._id), status: s.status });
  } catch (e) { next(e); }
});

router.delete('/:id', allowRoles(...HOSTS), async (req, res, next) => {
  try {
    const s = await loadOwned(req, res); if (!s) return;
    if (s.status !== 'SCHEDULED') return fail(res, 409, 'LOCKED', 'Only classes that have not started can be cancelled');
    await s.deleteOne();
    ok(res, { id: String(s._id) });
  } catch (e) { next(e); }
});
export default router;
