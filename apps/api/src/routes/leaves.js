import { Router } from 'express';
import { z } from 'zod';
import { Leave } from '../models/Leave.js';
import { Attendance } from '../models/Attendance.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const STAFF = ['TRAINER', 'ADMIN', 'SUPER_ADMIN'];
const D = /^\d{4}-\d\d-\d\d$/;
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });
const view = (l) => ({ id: String(l._id), student: l.student?.name ? { id: String(l.student._id), name: l.student.name, studentId: l.student.studentId, batch: l.student.batch } : undefined, from: l.from, to: l.to, type: l.type, reason: l.reason, status: l.status, decisionNote: l.decisionNote, createdAt: l.createdAt });
const span = (a, b) => { const o = []; for (let t = Date.parse(a + 'T00:00:00Z'); t <= Date.parse(b + 'T00:00:00Z'); t += 864e5) o.push(new Date(t).toISOString().slice(0, 10)); return o; };
const weekday = (s) => { const d = new Date(s + 'T00:00:00Z').getUTCDay(); return d >= 1 && d <= 5; };

router.get('/', async (req, res, next) => {
  try {
    const q = req.user.role === 'STUDENT' ? { student: req.user._id } : req.query.status ? { status: String(req.query.status).toUpperCase() } : {};
    ok(res, (await Leave.find(q).populate('student', 'name studentId batch').sort({ createdAt: -1 }).limit(200)).map(view));
  } catch (e) { next(e); }
});

const createSchema = z.object({ from: z.string().regex(D), to: z.string().regex(D), type: z.enum(['SICK', 'CASUAL', 'OTHER']).default('CASUAL'), reason: z.string().trim().min(3, 'Please give a short reason').max(500) });
router.post('/', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body);
    if (b.to < b.from) return fail(res, 400, 'BAD_RANGE', 'The end date must be on or after the start date');
    if (span(b.from, b.to).length > 30) return fail(res, 400, 'TOO_LONG', 'Leave requests can cover up to 30 days. Split longer leave into two requests.');
    if (await Leave.exists({ student: req.user._id, status: { $in: ['PENDING', 'APPROVED'] }, from: { $lte: b.to }, to: { $gte: b.from } })) return fail(res, 409, 'OVERLAP', 'You already have a leave request for some of these dates');
    ok(res, view(await Leave.create({ ...b, student: req.user._id })), 201);
  } catch (e) { next(e); }
});

router.delete('/:id', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const l = await Leave.findOne({ _id: req.params.id, student: req.user._id }).catch(() => null);
    if (!l) return fail(res, 404, 'NOT_FOUND', 'Leave request not found');
    if (l.status !== 'PENDING') return fail(res, 409, 'LOCKED', 'Only pending requests can be withdrawn');
    await l.deleteOne(); ok(res, { id: String(l._id) });
  } catch (e) { next(e); }
});

router.post('/:id/decide', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const b = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().max(300).optional() }).parse(req.body);
    const l = await Leave.findById(req.params.id).catch(() => null);
    if (!l) return fail(res, 404, 'NOT_FOUND', 'Leave request not found');
    if (l.status !== 'PENDING') return fail(res, 409, 'DECIDED', `This request was already ${l.status.toLowerCase()}`);
    Object.assign(l, { status: b.decision, decidedBy: req.user._id, decidedAt: new Date(), decisionNote: b.note });
    await l.save();
    if (b.decision === 'APPROVED') {
      const ds = span(l.from, l.to).filter(weekday);
      await Attendance.updateMany({ user: l.student, kind: 'DAY', date: { $in: ds }, status: 'ABSENT' }, { $set: { status: 'LEAVE', markedBy: req.user._id } });
      if (ds.length) await Attendance.bulkWrite(ds.map((date) => ({ updateOne: { filter: { user: l.student, date, kind: 'DAY' }, update: { $setOnInsert: { status: 'LEAVE', markedBy: req.user._id, note: `Approved leave (${l.type.toLowerCase()})` } }, upsert: true } })));
    }
    await l.populate('student', 'name studentId batch'); ok(res, view(l));
  } catch (e) { next(e); }
});
export default router;
