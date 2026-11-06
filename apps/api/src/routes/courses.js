import { Router } from 'express';
import { z } from 'zod';
import { Course } from '../models/Course.js';
import { Enrollment } from '../models/Enrollment.js';
import { User } from '../models/User.js';
import { LessonWork } from '../models/LessonWork.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { LANGS } from '../domains.js';

const router = Router();
const STAFF = ['TRAINER', 'ADMIN', 'SUPER_ADMIN'];
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

router.get('/catalog', async (req, res, next) => {
  try { ok(res, await Course.find({ status: 'PUBLISHED' }).populate('trainer', 'name').select('title slug description level durationHours tags source trainer')); } catch (e) { next(e); }
});
router.use(requireAuth);

const owns = (req, c) => req.user.role !== 'TRAINER' || String(c.trainer?._id ?? c.trainer) === String(req.user._id);
const lessonView = (m, l) => ({ id: String(l._id), module: m.title, title: l.title, type: l.type, duration: l.duration ?? 0, videoUrl: l.videoUrl, language: l.language, starterCode: l.starterCode, notes: l.notes, chapters: (l.chapters || []).map((c) => ({ at: c.at, title: c.title })) });
const lessonsOf = (c) => c.modules.flatMap((m) => m.lessons.map((l) => lessonView(m, l)));
const findLesson = (c, id) => { for (const m of c.modules) { const l = m.lessons.id(id); if (l) return { m, l }; } return null; };
const load = async (req, res) => { const c = await Course.findById(req.params.courseId).populate('trainer', 'name').catch(() => null); if (!c) fail(res, 404, 'NOT_FOUND', 'Course not found'); return c; };
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'course';

async function recalc(course) {
  const ids = new Set(lessonsOf(course).map((l) => l.id)); const total = ids.size;
  for (const e of await Enrollment.find({ course: course._id })) {
    const done = e.completedLessons.filter((x) => ids.has(String(x)));
    e.completedLessons = done; e.progress = total ? Math.round((done.length / total) * 100) : 0; await e.save();
  }
}
async function enrolled(req, res, course) {
  const e = await Enrollment.findOne({ student: req.user._id, course: course._id });
  if (!e) fail(res, 403, 'NOT_ENROLLED', 'You are not enrolled in this course. Ask your administrator to add you.');
  return e;
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await Course.find(req.user.role === 'STUDENT' ? { status: 'PUBLISHED' } : {}).populate('trainer', 'name').sort({ createdAt: -1 });
    const counts = STAFF.includes(req.user.role) ? new Map((await Enrollment.aggregate([{ $group: { _id: '$course', n: { $sum: 1 } } }])).map((c) => [String(c._id), c.n])) : null;
    ok(res, rows.map((c) => ({ ...c.toObject(), modules: undefined, lessonCount: lessonsOf(c).length, canEdit: STAFF.includes(req.user.role) && owns(req, c), ...(counts ? { enrolledCount: counts.get(String(c._id)) || 0 } : {}) })));
  } catch (e) { next(e); }
});
router.get('/my', async (req, res, next) => {
  try { ok(res, await Enrollment.find({ student: req.user._id }).populate({ path: 'course', populate: { path: 'trainer', select: 'name' } })); } catch (e) { next(e); }
});

const courseBody = z.object({ title: z.string().trim().min(3).max(120), description: z.string().max(1000).default(''), level: z.enum(['Foundation', 'Intermediate', 'Advanced']).default('Foundation'), durationHours: z.coerce.number().min(0).max(1000).default(0), tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT') });
router.post('/', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const b = courseBody.parse(req.body); let slug = slugify(b.title);
    if (await Course.exists({ slug })) slug += '-' + Math.random().toString(36).slice(2, 6);
    ok(res, await Course.create({ ...b, slug, trainer: req.user._id }), 201);
  } catch (e) { next(e); }
});
router.patch('/:courseId', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const c = await load(req, res); if (!c) return;
    if (!owns(req, c)) return fail(res, 403, 'FORBIDDEN', 'Only the course trainer or an administrator can change this course');
    Object.assign(c, courseBody.partial().parse(req.body)); await c.save(); ok(res, { id: String(c._id) });
  } catch (e) { next(e); }
});

router.get('/:courseId', async (req, res, next) => {
  try {
    const c = await load(req, res); if (!c) return;
    let e = null;
    if (req.user.role === 'STUDENT') { if (c.status !== 'PUBLISHED') return fail(res, 404, 'NOT_FOUND', 'Course not found'); e = await enrolled(req, res, c); if (!e) return; }
    ok(res, { id: String(c._id), title: c.title, description: c.description, level: c.level, durationHours: c.durationHours, status: c.status, tags: c.tags, source: c.source, trainer: c.trainer ? { id: String(c.trainer._id), name: c.trainer.name } : null, canEdit: STAFF.includes(req.user.role) && owns(req, c), enrolledCount: STAFF.includes(req.user.role) ? await Enrollment.countDocuments({ course: c._id }) : undefined, lessons: lessonsOf(c), progress: e?.progress ?? null, completed: (e?.completedLessons ?? []).map(String), lastLesson: e?.lastLesson ? String(e.lastLesson) : null });
  } catch (e) { next(e); }
});

const https = (v) => v === '' || /^https:\/\//i.test(v);
const lessonBody = z.object({
  module: z.string().trim().max(80).default('Lessons'), title: z.string().trim().min(2).max(120), type: z.enum(['VIDEO', 'TEXT', 'QUIZ', 'ASSIGNMENT', 'LAB']).default('VIDEO'),
  duration: z.coerce.number().int().min(0).max(600).default(0), videoUrl: z.string().trim().max(500).refine(https, 'The video link must start with https://').default(''),
  language: z.enum(LANGS).default('javascript'), starterCode: z.string().max(20000).default(''), notes: z.string().max(10000).default(''),
  chapters: z.array(z.object({ at: z.coerce.number().int().min(0).max(86400), title: z.string().trim().min(1).max(100) })).max(50).default([]),
});
router.post('/:courseId/lessons', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const c = await load(req, res); if (!c) return;
    if (!owns(req, c)) return fail(res, 403, 'FORBIDDEN', 'Only the course trainer or an administrator can add lessons');
    const { module: title, ...b } = lessonBody.parse(req.body);
    let m = c.modules.find((x) => x.title === title);
    if (!m) { c.modules.push({ title, order: c.modules.length + 1, lessons: [] }); m = c.modules[c.modules.length - 1]; }
    m.lessons.push(b); await c.save(); await recalc(c);
    ok(res, lessonView(m, m.lessons[m.lessons.length - 1]), 201);
  } catch (e) { next(e); }
});
router.patch('/:courseId/lessons/:lessonId', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const c = await load(req, res); if (!c) return;
    if (!owns(req, c)) return fail(res, 403, 'FORBIDDEN', 'Only the course trainer or an administrator can edit lessons');
    const f = findLesson(c, req.params.lessonId); if (!f) return fail(res, 404, 'NOT_FOUND', 'Lesson not found');
    const { module: _ignored, ...b } = lessonBody.partial().parse(req.body);
    Object.assign(f.l, b); await c.save(); ok(res, lessonView(f.m, f.l));
  } catch (e) { next(e); }
});
router.delete('/:courseId/lessons/:lessonId', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const c = await load(req, res); if (!c) return;
    if (!owns(req, c)) return fail(res, 403, 'FORBIDDEN', 'Only the course trainer or an administrator can delete lessons');
    const f = findLesson(c, req.params.lessonId); if (!f) return fail(res, 404, 'NOT_FOUND', 'Lesson not found');
    f.l.deleteOne(); await c.save(); await recalc(c); await LessonWork.deleteMany({ lesson: req.params.lessonId });
    ok(res, { id: req.params.lessonId });
  } catch (e) { next(e); }
});

router.get('/:courseId/lessons/:lessonId/work', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const w = await LessonWork.findOne({ student: req.user._id, lesson: req.params.lessonId }).catch(() => null);
    ok(res, w ? { code: w.code, language: w.language, position: w.position } : null);
  } catch (e) { next(e); }
});
router.put('/:courseId/lessons/:lessonId/work', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const b = z.object({ code: z.string().max(50000).optional(), language: z.enum(LANGS).optional(), position: z.coerce.number().min(0).max(86400).optional() }).parse(req.body);
    const c = await load(req, res); if (!c) return; if (!findLesson(c, req.params.lessonId)) return fail(res, 404, 'NOT_FOUND', 'Lesson not found');
    if (!(await enrolled(req, res, c))) return;
    await LessonWork.updateOne({ student: req.user._id, lesson: req.params.lessonId }, { $set: { ...b, course: c._id } }, { upsert: true });
    ok(res, { saved: true });
  } catch (e) { next(e); }
});
router.post('/:courseId/lessons/:lessonId/complete', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const { done } = z.object({ done: z.boolean() }).parse(req.body);
    const c = await load(req, res); if (!c) return; if (!findLesson(c, req.params.lessonId)) return fail(res, 404, 'NOT_FOUND', 'Lesson not found');
    const e = await enrolled(req, res, c); if (!e) return;
    const id = req.params.lessonId;
    e.completedLessons = done ? [...new Set([...e.completedLessons.map(String), id])] : e.completedLessons.filter((x) => String(x) !== id);
    e.lastLesson = id; await e.save(); await recalc(c);
    const fresh = await Enrollment.findById(e._id);
    ok(res, { progress: fresh.progress, completed: fresh.completedLessons.map(String), total: lessonsOf(c).length });
  } catch (e) { next(e); }
});

// ---- enrolment: who is on this course ----
const manage = async (req, res) => { const c = await load(req, res); if (!c) return null; if (!owns(req, c)) { fail(res, 403, 'FORBIDDEN', 'Only the course trainer or an administrator can manage who is enrolled'); return null; } return c; };
router.get('/:courseId/enrollments', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const c = await manage(req, res); if (!c) return;
    const total = lessonsOf(c).length;
    const rows = await Enrollment.find({ course: c._id }).populate('student', 'name studentId batch active').sort({ createdAt: -1 });
    ok(res, rows.filter((e) => e.student).map((e) => ({ id: String(e._id), student: { id: String(e.student._id), name: e.student.name, studentId: e.student.studentId, batch: e.student.batch, active: e.student.active }, progress: e.progress, completed: e.completedLessons.length, total, enrolledAt: e.createdAt })));
  } catch (e) { next(e); }
});
const enrollBody = z.object({ studentIds: z.array(z.string().min(1)).max(500).default([]), batch: z.string().trim().max(40).optional() }).refine((b) => b.studentIds.length || b.batch, 'Choose some students or a batch');
router.post('/:courseId/enroll', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const c = await manage(req, res); if (!c) return;
    const b = enrollBody.parse(req.body);
    const ids = new Set(b.studentIds);
    if (b.batch) (await User.find({ role: 'STUDENT', active: true, batch: b.batch }).select('_id')).forEach((u) => ids.add(String(u._id)));
    const valid = await User.find({ _id: { $in: [...ids] }, role: 'STUDENT', active: true }).select('_id');
    const already = new Set((await Enrollment.find({ course: c._id, student: { $in: valid.map((u) => u._id) } }).select('student')).map((e) => String(e.student)));
    const fresh = valid.filter((u) => !already.has(String(u._id)));
    if (fresh.length) await Enrollment.insertMany(fresh.map((u) => ({ student: u._id, course: c._id })), { ordered: false });
    ok(res, { added: fresh.length, skipped: valid.length - fresh.length }, 201);
  } catch (e) { next(e); }
});
router.delete('/:courseId/enrollments/:studentId', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const c = await manage(req, res); if (!c) return;
    const r = await Enrollment.deleteOne({ course: c._id, student: req.params.studentId });
    if (!r.deletedCount) return fail(res, 404, 'NOT_FOUND', 'That student is not enrolled in this course');
    ok(res, { removed: true });
  } catch (e) { next(e); }
});
export default router;
