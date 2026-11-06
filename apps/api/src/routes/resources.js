import { Router } from 'express';
import { User } from '../models/User.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { ACCESS } from '../rbac.js';

const router = Router();
router.use(requireAuth);

const people = (filter) => async (req, res, next) => {
  try {
    const rows = await User.find(filter).select('name email role studentId program batch active createdAt').sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: rows.map(({ _id, ...r }) => ({ id: String(_id), ...r })) });
  } catch (e) { next(e); }
};
const live = {
  students: people({ role: 'STUDENT' }),
  trainers: people({ role: 'TRAINER' }),
  admins: people({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } }),
  users: people({}),
};
const ready = (name) => (req, res) => res.json({ success: true, data: [], message: `${name} endpoint ready` });

// Every module is role-gated here. People modules return real accounts; the rest return empty lists until their models exist.
Object.entries(ACCESS).forEach(([name, roles]) => router.get('/' + name, allowRoles(...roles), live[name] || ready(name)));

router.post('/workbench/launch', allowRoles('STUDENT', 'TRAINER'), async (req, res) =>
  res.status(202).json({ success: true, data: { status: 'PROVISIONING', workspace: 'Python Data Lab' }, message: 'Gateway Cloud Workbench is preparing' }));
router.post('/users', allowRoles('ADMIN', 'SUPER_ADMIN'), (req, res) => res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'User creation is not available yet' } }));
export default router;
