// Single source of truth for which roles may open each module endpoint.
// Keep in sync with NAV in apps/web/src/modules.ts.
const ALL = ['SUPER_ADMIN', 'ADMIN', 'TRAINER', 'STUDENT'];
const STAFF = ['SUPER_ADMIN', 'ADMIN', 'TRAINER'];
const ADMINS = ['SUPER_ADMIN', 'ADMIN'];

export const ACCESS = {
  batches: STAFF, students: STAFF, trainers: ADMINS, admins: ['SUPER_ADMIN'], users: ['SUPER_ADMIN', 'ADMIN'], institutions: ['SUPER_ADMIN'],
  'live-classes': ALL, attendance: ALL, assignments: ALL, assessments: ALL, 'question-bank': STAFF, projects: ALL, certificates: ALL,
  placement: ['SUPER_ADMIN', 'ADMIN', 'STUDENT'], reports: ADMINS, analytics: ADMINS,
  'audit-logs': ['SUPER_ADMIN'], security: ['SUPER_ADMIN'], integrations: ['SUPER_ADMIN'], billing: ['SUPER_ADMIN'],
  notifications: ALL, messages: ALL, announcements: ALL, workbench: ALL, labs: ALL, paths: ['STUDENT'], results: ['STUDENT'], assistant: ['STUDENT'],
  profile: ALL, settings: ALL, support: ALL,
};
