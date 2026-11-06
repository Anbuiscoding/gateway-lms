import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { Enrollment } from '../models/Enrollment.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const STAFF = ['TRAINER', 'ADMIN', 'SUPER_ADMIN'];
const ADMINS = ['ADMIN', 'SUPER_ADMIN'];
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const row = (u) => ({ id: String(u._id), name: u.name, email: u.email, studentId: u.studentId, program: u.program, batch: u.batch, phone: u.phone, active: u.active, createdAt: u.createdAt });

router.get('/', allowRoles(...STAFF), async (req, res, next) => {
  try { ok(res, (await User.find({ role: 'STUDENT' }).sort({ createdAt: -1 }).limit(500)).map(row)); } catch (e) { next(e); }
});

const createSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().toLowerCase(), program: z.string().trim().max(80).optional(), batch: z.string().trim().max(40).optional(), courseIds: z.array(z.string()).max(20).optional(), phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/,'Enter a valid phone number').or(z.literal('')).optional(), password: z.string().min(8).max(72).optional() });
router.post('/', allowRoles(...ADMINS), async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body);
    const last = await User.findOne({ studentId: /^GSS-\d+$/ }).sort({ studentId: -1 }).select('studentId');
    const next_ = last ? Number(last.studentId.slice(4)) + 1 : 2001;
    const temporaryPassword = b.password || `Gw${crypto.randomBytes(4).toString('hex')}!`;
    const u = await User.create({ name: b.name, email: b.email, program: b.program, batch: b.batch, phone: b.phone || undefined, role: 'STUDENT', studentId: 'GSS-' + next_, passwordHash: await bcrypt.hash(temporaryPassword, 12) });
    let enrolled = 0;
    if (b.courseIds?.length) { const cs = await Course.find({ _id: { $in: b.courseIds } }).select('_id'); await Enrollment.insertMany(cs.map((c) => ({ student: u._id, course: c._id })), { ordered: false }); enrolled = cs.length; }
    ok(res, { student: row(u), temporaryPassword, enrolled }, 201);
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'A user with this email already exists' } });
    next(e);
  }
});

router.patch('/:id', allowRoles(...ADMINS), async (req, res, next) => {
  try {
    const b = z.object({ active: z.boolean().optional(), program: z.string().max(80).optional(), batch: z.string().max(40).optional(), phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/,'Enter a valid phone number').or(z.literal('')).optional() }).parse(req.body);
    const u = await User.findOneAndUpdate({ _id: req.params.id, role: 'STUDENT' }, { $set: b }, { new: true }).catch(() => null);
    if (!u) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } });
    ok(res, row(u));
  } catch (e) { next(e); }
});
export default router;
