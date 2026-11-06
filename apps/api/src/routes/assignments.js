import { Router } from 'express';
import { z } from 'zod';
import { Assignment, Submission } from '../models/Assignment.js';
import { User } from '../models/User.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const HOSTS = ['TRAINER', 'ADMIN', 'SUPER_ADMIN'];
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });
const view = (a) => ({ id: String(a._id), title: a.title, instructions: a.instructions, batch: a.batch, dueAt: a.dueAt, maxMarks: a.maxMarks, allowLate: a.allowLate, createdBy: a.createdBy?.name ? { id: String(a.createdBy._id), name: a.createdBy.name } : { id: String(a.createdBy) } });
const mine = (s) => s && { status: s.status, submittedAt: s.submittedAt, late: s.late, marks: s.marks, feedback: s.feedback, answer: s.answer, link: s.link };
export const stateOf = (a, s) => (s ? s.status : new Date(a.dueAt) < new Date() ? 'OVERDUE' : 'TODO');
const forStudent = (u) => ({ $or: [{ batch: '' }, { batch: { $exists: false } }, ...(u.batch ? [{ batch: u.batch }] : [])] });
const canManage = (req, a) => req.user.role !== 'TRAINER' || String(a.createdBy._id ?? a.createdBy) === String(req.user._id);

router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'STUDENT') {
      const list = await Assignment.find(forStudent(req.user)).populate('createdBy', 'name').sort({ dueAt: 1 });
      const subs = new Map((await Submission.find({ student: req.user._id, assignment: { $in: list.map((a) => a._id) } })).map((s) => [String(s.assignment), s]));
      return ok(res, list.map((a) => ({ ...view(a), state: stateOf(a, subs.get(String(a._id))), my: mine(subs.get(String(a._id))) || null })));
    }
    const list = await Assignment.find(req.user.role === 'TRAINER' ? { createdBy: req.user._id } : {}).populate('createdBy', 'name').sort({ dueAt: -1 }).limit(100);
    const counts = await Submission.aggregate([{ $match: { assignment: { $in: list.map((a) => a._id) } } }, { $group: { _id: { a: '$assignment', s: '$status' }, n: { $sum: 1 } } }]);
    const totals = new Map();
    for (const a of list) if (!totals.has(a.batch)) totals.set(a.batch, await User.countDocuments({ role: 'STUDENT', active: true, ...(a.batch ? { batch: a.batch } : {}) }));
    const n = (a, s) => counts.find((c) => String(c._id.a) === String(a._id) && c._id.s === s)?.n || 0;
    ok(res, list.map((a) => ({ ...view(a), total: totals.get(a.batch), submitted: n(a, 'SUBMITTED') + n(a, 'GRADED'), graded: n(a, 'GRADED') })));
  } catch (e) { next(e); }
});

const body = z.object({ title: z.string().trim().min(3).max(140), instructions: z.string().max(5000).default(''), batch: z.string().trim().max(40).default(''), dueAt: z.coerce.date(), maxMarks: z.coerce.number().int().min(1).max(1000).default(100), allowLate: z.boolean().default(true) });
router.post('/', allowRoles(...HOSTS), async (req, res, next) => {
  try { const a = await Assignment.create({ ...body.parse(req.body), createdBy: req.user._id }); await a.populate('createdBy', 'name'); ok(res, view(a), 201); } catch (e) { next(e); }
});

async function load(req, res) {
  const a = await Assignment.findById(req.params.id).populate('createdBy', 'name').catch(() => null);
  if (!a) { fail(res, 404, 'NOT_FOUND', 'Assignment not found'); return null; }
  return a;
}
router.get('/:id', async (req, res, next) => {
  try {
    const a = await load(req, res); if (!a) return;
    if (req.user.role === 'STUDENT') { const s = await Submission.findOne({ assignment: a._id, student: req.user._id }); return ok(res, { ...view(a), state: stateOf(a, s), my: mine(s) || null }); }
    const students = await User.find({ role: 'STUDENT', active: true, ...(a.batch ? { batch: a.batch } : {}) }).select('name studentId batch').sort({ name: 1 });
    const subs = new Map((await Submission.find({ assignment: a._id })).map((s) => [String(s.student), s]));
    ok(res, { ...view(a), canManage: canManage(req, a), rows: students.map((u) => ({ student: { id: String(u._id), name: u.name, studentId: u.studentId, batch: u.batch }, submission: mine(subs.get(String(u._id))) || null })) });
  } catch (e) { next(e); }
});

router.patch('/:id', allowRoles(...HOSTS), async (req, res, next) => {
  try {
    const a = await load(req, res); if (!a) return;
    if (!canManage(req, a)) return fail(res, 403, 'FORBIDDEN', 'Only the trainer who created this can change it');
    Object.assign(a, body.partial().parse(req.body)); await a.save(); ok(res, view(a));
  } catch (e) { next(e); }
});
router.delete('/:id', allowRoles(...HOSTS), async (req, res, next) => {
  try {
    const a = await load(req, res); if (!a) return;
    if (!canManage(req, a)) return fail(res, 403, 'FORBIDDEN', 'Only the trainer who created this can delete it');
    await Submission.deleteMany({ assignment: a._id }); await a.deleteOne(); ok(res, { id: String(a._id) });
  } catch (e) { next(e); }
});

router.post('/:id/submit', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const a = await load(req, res); if (!a) return;
    const b = z.object({ answer: z.string().max(20000).default(''), link: z.string().trim().url('Enter a full link starting with https://').max(500).or(z.literal('')).default('') }).parse(req.body);
    if (!b.answer.trim() && !b.link) return fail(res, 400, 'EMPTY', 'Add your answer or a link before submitting');
    if (a.batch && a.batch !== req.user.batch) return fail(res, 403, 'FORBIDDEN', 'This assignment is for another batch');
    const late = new Date() > a.dueAt;
    if (late && !a.allowLate) return fail(res, 403, 'CLOSED', 'The deadline has passed and late submissions are not accepted');
    const ex = await Submission.findOne({ assignment: a._id, student: req.user._id });
    if (ex?.status === 'GRADED') return fail(res, 409, 'GRADED', 'This work is already graded and can no longer be changed');
    const s = await Submission.findOneAndUpdate({ assignment: a._id, student: req.user._id }, { $set: { ...b, submittedAt: new Date(), late } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    ok(res, mine(s), 201);
  } catch (e) { next(e); }
});

router.post('/:id/grade', allowRoles(...HOSTS), async (req, res, next) => {
  try {
    const a = await load(req, res); if (!a) return;
    if (!canManage(req, a)) return fail(res, 403, 'FORBIDDEN', 'Only the trainer who created this can grade it');
    const b = z.object({ studentId: z.string().min(1), marks: z.coerce.number().min(0), feedback: z.string().max(2000).default('') }).parse(req.body);
    if (b.marks > a.maxMarks) return fail(res, 400, 'TOO_HIGH', `Marks cannot be more than ${a.maxMarks}`);
    const s = await Submission.findOneAndUpdate({ assignment: a._id, student: b.studentId }, { $set: { status: 'GRADED', marks: b.marks, feedback: b.feedback, gradedBy: req.user._id, gradedAt: new Date() } }, { new: true }).catch(() => null);
    if (!s) return fail(res, 404, 'NOT_FOUND', 'This student has not submitted yet');
    ok(res, mine(s));
  } catch (e) { next(e); }
});
export default router;
