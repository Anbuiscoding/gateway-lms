import { Router } from 'express';
import { z } from 'zod';
import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

// Attendance is for students. Staff attendance is handled in the HR workspace.
const router = Router();
router.use(requireAuth);
const STAFF = ['TRAINER', 'ADMIN', 'SUPER_ADMIN'];
const tz = () => process.env.ORG_TIMEZONE || 'Asia/Kolkata';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: tz() });
const hm = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { timeZone: tz(), hour: '2-digit', minute: '2-digit' }) : null);
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });
const mins = (r) => (r?.checkIn && r?.checkOut ? Math.max(0, Math.round((r.checkOut - r.checkIn) / 60000)) : null);
const clean = (r) => r && { status: r.status, date: r.date, checkIn: hm(r.checkIn), checkOut: hm(r.checkOut), minutes: mins(r), note: r.note };

/** "09:30" on a given date, read in the organisation's timezone. */
function zoned(date, time) {
  const [y, m, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz(), hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return new Date(guess - (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - guess));
}
const days = (from, to) => { const out = []; for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
const weekday = (s) => { const d = new Date(s + 'T00:00:00Z').getUTCDay(); return d >= 1 && d <= 5; };
const D = /^\d{4}-\d\d-\d\d$/;

// ---- Student: own check-in and check-out ----
router.get('/me', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const rows = await Attendance.find({ user: req.user._id, kind: 'DAY' }).sort({ date: -1 }).limit(90);
    const last = rows.slice(0, 30); const n = (s) => last.filter((r) => r.status === s).length;
    ok(res, { today: clean(rows.find((r) => r.date === today())) || null, records: rows.map(clean), summary: { present: n('PRESENT'), late: n('LATE'), absent: n('ABSENT'), leave: n('LEAVE') } });
  } catch (e) { next(e); }
});
router.post('/check-in', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const date = today();
    const ex = await Attendance.findOne({ user: req.user._id, date, kind: 'DAY' });
    if (ex?.checkIn) return ok(res, clean(ex));
    const now = new Date();
    const late = hm(now) > (process.env.ORG_LATE_AFTER || '10:00');
    const row = await Attendance.findOneAndUpdate({ user: req.user._id, date, kind: 'DAY' }, { $set: { checkIn: now, status: late ? 'LATE' : 'PRESENT' } }, { upsert: true, new: true });
    ok(res, clean(row), 201);
  } catch (e) { next(e); }
});
router.post('/check-out', allowRoles('STUDENT'), async (req, res, next) => {
  try {
    const row = await Attendance.findOne({ user: req.user._id, date: today(), kind: 'DAY' });
    if (!row?.checkIn) return fail(res, 409, 'NO_CHECK_IN', 'Check in first');
    row.checkOut = new Date(); await row.save(); ok(res, clean(row));
  } catch (e) { next(e); }
});

// ---- Staff: the roster for a day ----
router.get('/', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const date = D.test(req.query.date || '') ? req.query.date : today();
    const q = { role: 'STUDENT', active: true }; if (req.query.batch) q.batch = String(req.query.batch);
    const students = await User.find(q).select('name studentId batch').sort({ name: 1 });
    const rows = await Attendance.find({ date, kind: 'DAY', user: { $in: students.map((s) => s._id) } });
    const by = new Map(rows.map((r) => [String(r.user), r]));
    const list = students.map((s) => ({ user: { id: String(s._id), name: s.name, studentId: s.studentId, batch: s.batch }, ...(clean(by.get(String(s._id))) || { status: null }) }));
    const n = (...st) => list.filter((r) => st.includes(r.status)).length;
    ok(res, { date, rows: list, summary: { total: list.length, present: n('PRESENT', 'LATE'), late: n('LATE'), absent: n('ABSENT'), leave: n('LEAVE'), unmarked: list.filter((r) => !r.status).length } });
  } catch (e) { next(e); }
});

const T = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const markSchema = z.object({ userId: z.string().min(1), date: z.string().regex(D), status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'LEAVE']).optional(), checkIn: T.nullable().optional(), checkOut: T.nullable().optional(), note: z.string().max(200).optional() })
  .refine((b) => b.status || b.checkIn !== undefined || b.checkOut !== undefined || b.note !== undefined, 'Nothing to update');
router.post('/mark', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const b = markSchema.parse(req.body);
    const target = await User.findById(b.userId).select('role').catch(() => null);
    if (!target || target.role !== 'STUDENT') return fail(res, 404, 'NOT_FOUND', 'Student not found');
    const ex = await Attendance.findOne({ user: b.userId, date: b.date, kind: 'DAY' });
    const cin = b.checkIn === undefined ? ex?.checkIn : b.checkIn ? zoned(b.date, b.checkIn) : null;
    const cout = b.checkOut === undefined ? ex?.checkOut : b.checkOut ? zoned(b.date, b.checkOut) : null;
    if (cout && !cin) return fail(res, 400, 'NO_CHECK_IN', 'Add a check-in time before a check-out time');
    if (cin && cout && cout < cin) return fail(res, 400, 'BAD_TIMES', 'Check-out must be after check-in');
    const set = { markedBy: req.user._id, checkIn: cin, checkOut: cout };
    if (b.note !== undefined) set.note = b.note;
    if (b.status) set.status = b.status;
    else if (!ex) set.status = cin && hm(cin) > (process.env.ORG_LATE_AFTER || '10:00') ? 'LATE' : 'PRESENT';
    const row = await Attendance.findOneAndUpdate({ user: b.userId, date: b.date, kind: 'DAY' }, { $set: set }, { upsert: true, new: true });
    ok(res, clean(row));
  } catch (e) { next(e); }
});

// ---- Reports and CSV export ----
async function build(req) {
  const to = D.test(req.query.to || '') ? req.query.to : today();
  const from = D.test(req.query.from || '') ? req.query.from : to.slice(0, 8) + '01';
  if (from > to || days(from, to).length > 366) return null;
  const q = { role: 'STUDENT' }; if (req.query.batch) q.batch = String(req.query.batch);
  const students = await User.find(q).select('name studentId batch active').sort({ name: 1 });
  const recs = await Attendance.find({ kind: 'DAY', date: { $gte: from, $lte: to }, user: { $in: students.map((s) => s._id) } }).sort({ date: 1 });
  const upto = to < today() ? to : today();
  const working = from <= upto ? days(from, upto).filter(weekday).length : 0;
  const summary = students.map((s) => {
    const r = recs.filter((x) => String(x.user) === String(s._id)); const n = (st) => r.filter((x) => x.status === st).length;
    const marked = r.filter((x) => weekday(x.date)).length;
    const present = n('PRESENT'), late = n('LATE'), leave = n('LEAVE');
    const minutes = r.reduce((t, x) => t + (mins(x) || 0), 0);
    return { id: String(s._id), name: s.name, studentId: s.studentId, batch: s.batch, present, late, absent: n('ABSENT'), leave, notMarked: Math.max(0, working - marked), hours: Math.round(minutes / 6) / 10, percent: Math.round(((present + late) / Math.max(1, working - leave)) * 100) };
  });
  return { from, to, workingDays: working, students, recs, summary };
}
const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (rows) => '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n');

router.get('/report', allowRoles(...STAFF), async (req, res, next) => {
  try { const r = await build(req); if (!r) return fail(res, 400, 'BAD_RANGE', 'Choose a valid date range of up to one year'); ok(res, { from: r.from, to: r.to, workingDays: r.workingDays, rows: r.summary }); } catch (e) { next(e); }
});
router.get('/export', allowRoles(...STAFF), async (req, res, next) => {
  try {
    const r = await build(req); if (!r) return fail(res, 400, 'BAD_RANGE', 'Choose a valid date range of up to one year');
    let rows, name;
    if (req.query.type === 'detail') {
      const by = new Map(r.students.map((s) => [String(s._id), s]));
      rows = [['Date', 'Student ID', 'Name', 'Batch', 'Status', 'Check-in', 'Check-out', 'Hours', 'Note'], ...r.recs.map((x) => { const s = by.get(String(x.user)); const m = mins(x); return [x.date, s?.studentId, s?.name, s?.batch, x.status, hm(x.checkIn), hm(x.checkOut), m == null ? '' : (m / 60).toFixed(2), x.note]; })];
      name = `attendance-detail-${r.from}-to-${r.to}.csv`;
    } else {
      rows = [['Student ID', 'Name', 'Batch', 'Present', 'Late', 'Absent', 'Leave', 'Not marked', 'Hours', 'Attendance %'], ...r.summary.map((s) => [s.studentId, s.name, s.batch, s.present, s.late, s.absent, s.leave, s.notMarked, s.hours, s.percent])];
      name = `attendance-summary-${r.from}-to-${r.to}.csv`;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${name}"`); res.send(csv(rows));
  } catch (e) { next(e); }
});
export default router;
