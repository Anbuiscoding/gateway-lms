import { Router } from 'express';
import mongoose from 'mongoose';
import { Enrollment } from '../models/Enrollment.js';
import { Course } from '../models/Course.js';
import { User } from '../models/User.js';
import { ClassSession } from '../models/ClassSession.js';
import { Attendance } from '../models/Attendance.js';
import { Assignment, Submission } from '../models/Assignment.js';
import { Leave } from '../models/Leave.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const avg = (rows) => (rows.length ? Math.round(rows.reduce((n, e) => n + e.progress, 0) / rows.length) : 0);
const stat = (label, value, note, icon) => ({ label, value: String(value), note, icon });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.ORG_TIMEZONE || 'Asia/Kolkata' });
const ROLE = { STUDENT: 'student', TRAINER: 'trainer', ADMIN: 'administrator', SUPER_ADMIN: 'super administrator' };
const uptime = () => { const s = Math.floor(process.uptime()); return s < 3600 ? `${Math.max(1, Math.floor(s / 60))} min` : s < 86400 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 86400)} days`; };

async function adminData(req) {
  const [students, trainers, admins, courses, enr, recent, presentRows, leaveQueue, studentBatches, uu, cc, aa, ll] = await Promise.all([
    User.countDocuments({ role: 'STUDENT', active: true }), User.countDocuments({ role: 'TRAINER' }), User.countDocuments({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } }),
    Course.countDocuments({ status: 'PUBLISHED' }), Enrollment.find().select('progress'), User.find().sort({ createdAt: -1 }).limit(5).select('name role createdAt'),
    Attendance.find({ date: today(), kind: 'DAY', status: { $in: ['PRESENT', 'LATE'] } }).select('user'),
    Leave.find({ status: 'PENDING' }).populate('student', 'name').sort({ createdAt: 1 }).limit(4),
    User.find({ role: 'STUDENT', active: true }).select('batch'),
    User.find().sort({ createdAt: -1 }).limit(4).select('name role createdAt'),
    ClassSession.find().sort({ updatedAt: -1 }).limit(4).populate('trainer', 'name').select('title status updatedAt trainer'),
    Assignment.find().sort({ createdAt: -1 }).limit(4).populate('createdBy', 'name').select('title createdAt createdBy'),
    Leave.find({ status: { $ne: 'PENDING' } }).sort({ decidedAt: -1 }).limit(4).populate('student', 'name').select('status decidedAt student'),
  ]);
  const present = new Set(presentRows.map((r) => String(r.user)));
  const groups = new Map();
  studentBatches.forEach((s) => { const k = s.batch || 'No batch'; const g = groups.get(k) || { batch: k, total: 0, present: 0 }; g.total++; if (present.has(String(s._id))) g.present++; groups.set(k, g); });
  const activity = [
    ...uu.map((u) => ({ title: `${u.name} joined`, text: `As ${ROLE[u.role] || u.role.toLowerCase()}`, at: u.createdAt })),
    ...cc.map((c) => ({ title: `${c.status === 'LIVE' ? 'Class is live' : c.status === 'ENDED' ? 'Class ended' : 'Class scheduled'}: ${c.title}`, text: c.trainer?.name || '', at: c.updatedAt })),
    ...aa.map((a) => ({ title: `Assignment: ${a.title}`, text: `By ${a.createdBy?.name || 'a trainer'}`, at: a.createdAt })),
    ...ll.filter((l) => l.decidedAt).map((l) => ({ title: `Leave ${l.status.toLowerCase()}: ${l.student?.name || 'student'}`, text: '', at: l.decidedAt })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
  const io = req.app.get('io'); const db = mongoose.connection.readyState === 1; const runner = !!process.env.CODE_RUNNER_URL;
  return {
    students, trainers, admins, courses, enr, recent, presentToday: present.size, activity,
    leaveQueue: leaveQueue.map((l) => ({ id: String(l._id), name: l.student?.name, from: l.from, to: l.to, type: l.type })),
    batchHealth: [...groups.values()].map((g) => ({ ...g, percent: g.total ? Math.round((g.present / g.total) * 100) : 0 })).sort((a, b) => a.batch.localeCompare(b.batch)),
    system: [
      { title: 'API', text: `Running for ${uptime()}`, meta: 'Healthy', tone: 'ok' },
      { title: 'Database', text: db ? 'MongoDB connection is open' : 'MongoDB connection is not open', meta: db ? 'Connected' : 'Problem', tone: db ? 'ok' : 'warn' },
      { title: 'Live classes', text: `${io?.engine?.clientsCount ?? 0} connected right now`, meta: 'Realtime on', tone: 'ok' },
      { title: 'Code runner', text: runner ? 'Connected for Java, C++, Go and more' : 'Not connected. JavaScript, Python and HTML still run in the browser', meta: runner ? 'Ready' : 'Setup needed', tone: runner ? 'ok' : 'warn' },
    ],
  };
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { role, id } = req.user;
    const classFilter = { status: { $in: ['LIVE', 'SCHEDULED'] } };
    if (role === 'TRAINER') classFilter.trainer = id;
    const classes = (await ClassSession.find(classFilter).populate('trainer', 'name').sort({ scheduledAt: 1 }).limit(5))
      .map((s) => ({ id: String(s._id), title: s.title, domain: s.domain, language: s.language, status: s.status, scheduledAt: s.scheduledAt, trainer: s.trainer?.name }));
    let data;
    if (role === 'STUDENT') {
      const enrollments = await Enrollment.find({ student: id }).populate({ path: 'course', populate: { path: 'trainer', select: 'name' } });
      const finished = enrollments.filter((e) => e.progress === 100).length;
      const mine = await Attendance.find({ user: id, kind: 'DAY' }).sort({ date: -1 }).limit(30);
      const presentDays = mine.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const asg = await Assignment.find({ $or: [{ batch: '' }, { batch: { $exists: false } }, ...(req.user.batch ? [{ batch: req.user.batch }] : [])] }).sort({ dueAt: 1 });
      const submitted = new Set((await Submission.find({ student: id, assignment: { $in: asg.map((a) => a._id) } }).select('assignment')).map((s) => String(s.assignment)));
      const pending = asg.filter((a) => !submitted.has(String(a._id)));
      const overdue = pending.filter((a) => a.dueAt < new Date()).length;
      data = {
        enrollments,
        deadlines: pending.slice(0, 4).map((a) => ({ id: String(a._id), title: a.title, batch: a.batch, dueAt: a.dueAt })),
        stats: [stat('Courses enrolled', String(enrollments.length).padStart(2, '0'), `${finished} completed`, 'courses'), stat('Overall progress', avg(enrollments) + '%', 'Across all programs', 'progress'), stat('Assignments due', String(pending.length).padStart(2, '0'), overdue ? `${overdue} overdue` : pending.length ? 'Nothing overdue' : 'All caught up', 'assignments'), stat('Days present', presentDays, 'In the last 30 days', 'attendance')],
      };
    } else if (role === 'TRAINER') {
      const courses = await Course.find({ trainer: id }).select('title level durationHours status');
      const enr = await Enrollment.find({ course: { $in: courses.map((c) => c._id) } }).select('student progress');
      const mine = await Assignment.find({ createdBy: id }).select('title dueAt');
      const waiting = await Submission.aggregate([{ $match: { assignment: { $in: mine.map((a) => a._id) }, status: 'SUBMITTED' } }, { $group: { _id: '$assignment', n: { $sum: 1 } } }]);
      const total = waiting.reduce((t, w) => t + w.n, 0);
      data = {
        courses, pendingLeaves: await Leave.countDocuments({ status: 'PENDING' }),
        grading: waiting.map((w) => { const a = mine.find((x) => String(x._id) === String(w._id)); return { id: String(w._id), title: a?.title, waiting: w.n, dueAt: a?.dueAt }; }).slice(0, 4),
        stats: [stat('My courses', courses.length, 'Published and draft', 'courses'), stat('Learners', new Set(enr.map((e) => String(e.student))).size, 'Across your courses', 'students'), stat('Average progress', avg(enr) + '%', 'Your learners', 'progress'), stat('To grade', total, total ? 'Submissions waiting' : 'Nothing waiting', 'assignments')],
      };
    } else {
      const a = await adminData(req);
      const rate = a.students ? Math.round((a.presentToday / a.students) * 100) : 0;
      data = {
        recent: a.recent, pendingLeaves: a.leaveQueue.length ? await Leave.countDocuments({ status: 'PENDING' }) : 0, leaveQueue: a.leaveQueue, batchHealth: a.batchHealth, activity: a.activity, ...(role === 'SUPER_ADMIN' ? { system: a.system } : {}),
        attendance: { present: a.presentToday, total: a.students, rate },
        stats: role === 'ADMIN'
          ? [stat('Students', a.students, 'Active learners', 'students'), stat('Trainers', a.trainers, 'Teaching faculty', 'trainers'), stat('Published courses', a.courses, 'In the catalog', 'courses'), stat('Attendance today', rate + '%', `${a.presentToday} of ${a.students} present`, 'attendance')]
          : [stat('Total users', a.students + a.trainers + a.admins, `${a.admins} administrators`, 'users'), stat('Students', a.students, 'Active learners', 'students'), stat('Trainers', a.trainers, 'Teaching faculty', 'trainers'), stat('Attendance today', rate + '%', `${a.presentToday} of ${a.students} present`, 'attendance')],
      };
    }
    res.json({ success: true, data: { user: req.user, classes, ...data } });
  } catch (e) { next(e); }
});
export default router;
