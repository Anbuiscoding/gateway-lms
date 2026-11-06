export type Role = 'STUDENT' | 'TRAINER' | 'ADMIN' | 'SUPER_ADMIN';
/** [label, slug, icon] */
export type Mod = [string, string, string];
export interface Group { name: string; items: Mod[] }

const COMMON_ACCOUNT: Mod[] = [['Notifications', 'notifications', '♢'], ['Profile', 'profile', '◉'], ['Settings', 'settings', '⚙'], ['Support', 'support', '?']];

/** Every role gets its own set of modules. The API enforces the same map in apps/api/src/rbac.js. */
export const NAV: Record<Role, Group[]> = {
  STUDENT: [
    { name: 'Workspace', items: [['Dashboard', 'dashboard', '▦'], ['My Learning', 'learning', '▶'], ['Courses', 'courses', '▤'], ['Learning Paths', 'paths', '⌘'], ['Live Classes', 'live-classes', '◉']] },
    { name: 'Practice', items: [['Cloud Workbench', 'workbench', '⌘'], ['Lab Exercises', 'labs', '⌁'], ['Projects', 'projects', '◆']] },
    { name: 'Evaluation', items: [['Assignments', 'assignments', '✓'], ['Assessments', 'assessments', '◈'], ['Results', 'results', '▥'], ['Certificates', 'certificates', '✦']] },
    { name: 'Career', items: [['Placement Hub', 'placement', '↗'], ['Messages', 'messages', '◌'], ['Announcements', 'announcements', '◉'], ['Gateway AI Assistant', 'assistant', '✦']] },
    { name: 'Account', items: COMMON_ACCOUNT },
  ],
  TRAINER: [
    { name: 'Teaching', items: [['Dashboard', 'dashboard', '▦'], ['My Courses', 'courses', '▤'], ['My Batches', 'batches', '▦'], ['Live Classes', 'live-classes', '◉'], ['Attendance', 'attendance', '✓']] },
    { name: 'Practice and evaluation', items: [['Lab Exercises', 'labs', '⌁'], ['Assignments', 'assignments', '✓'], ['Assessments', 'assessments', '◈'], ['Question Bank', 'question-bank', '◈'], ['Projects', 'projects', '◆']] },
    { name: 'People', items: [['Students', 'students', '◎'], ['Messages', 'messages', '◌'], ['Announcements', 'announcements', '◉']] },
    { name: 'Account', items: COMMON_ACCOUNT },
  ],
  ADMIN: [
    { name: 'Academics', items: [['Dashboard', 'dashboard', '▦'], ['Course Management', 'courses', '▤'], ['Batches', 'batches', '▦'], ['Live Classes', 'live-classes', '◉'], ['Attendance', 'attendance', '✓']] },
    { name: 'Evaluation', items: [['Assignments', 'assignments', '✓'], ['Assessments', 'assessments', '◈'], ['Question Bank', 'question-bank', '◈'], ['Projects', 'projects', '◆'], ['Certificates', 'certificates', '✦']] },
    { name: 'People and career', items: [['Students', 'students', '◎'], ['Trainers', 'trainers', '◎'], ['Placement Hub', 'placement', '↗']] },
    { name: 'Insights', items: [['Reports', 'reports', '▥'], ['Analytics', 'analytics', '▥'], ['Messages', 'messages', '◌'], ['Announcements', 'announcements', '◉']] },
    { name: 'Account', items: COMMON_ACCOUNT },
  ],
  SUPER_ADMIN: [
    { name: 'Platform', items: [['Dashboard', 'dashboard', '▦'], ['Institutions', 'institutions', '▦'], ['Users & Roles', 'users', '◎'], ['Administrators', 'admins', '◎']] },
    { name: 'Academics', items: [['Course Management', 'courses', '▤'], ['Batches', 'batches', '▦'], ['Certificates', 'certificates', '✦'], ['Placement Hub', 'placement', '↗']] },
    { name: 'Insights', items: [['Reports', 'reports', '▥'], ['Platform Analytics', 'analytics', '▥'], ['Audit Logs', 'audit-logs', '◈']] },
    { name: 'System', items: [['Security', 'security', '◆'], ['Integrations', 'integrations', '⌘'], ['Billing & Licences', 'billing', '▤'], ['Announcements', 'announcements', '◉']] },
    { name: 'Account', items: COMMON_ACCOUNT },
  ],
};

export const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Student', TRAINER: 'Trainer', ADMIN: 'Administrator', SUPER_ADMIN: 'Super administrator' };

/** [eyebrow, title, description] */
export const INFO: Record<string, [string, string, string]> = {
  learning: ['Learning library', 'My learning', 'Your enrolled programs, with progress.'],
  courses: ['Course catalog', 'Courses', 'Structured learning programs published by Gateway.'],
  workbench: ['Gateway Cloud Workbench', 'Build without limits.', 'Launch secure, ready-to-code environments for your labs and projects.'],
  labs: ['Practice', 'Lab exercises', 'Watch the trainer code, pause, then edit and check your own version.'],
  'live-classes': ['Schedule', 'Live classes', 'Join instructor-led sessions in the virtual workspace.'],
  assignments: ['Evaluation', 'Assignments', 'Keep track of work, submissions, and feedback.'],
  assessments: ['Evaluation', 'Assessments', 'Prepare, attempt, and review results.'],
  certificates: ['Gateway certification', 'Certificates', 'Verified learning accomplishments.'],
  placement: ['Gateway Placement Hub', 'Career readiness', 'Profiles, drives, and placement outcomes.'],
  students: ['People', 'Students', 'Learners enrolled on the platform.'],
  trainers: ['People', 'Trainers', 'Teaching faculty on the platform.'],
  admins: ['Platform', 'Administrators', 'Administrator and super administrator accounts.'],
  users: ['Platform', 'Users & roles', 'Every account on the platform and the role it holds.'],
  institutions: ['Platform', 'Institutions', 'Partner institutions and their learner groups.'],
  'audit-logs': ['System', 'Audit logs', 'Who changed what, and when.'],
  security: ['System', 'Security', 'Sign-in policy, sessions, and access reviews.'],
  integrations: ['System', 'Integrations', 'Connected services such as SSO, email, and video.'],
  billing: ['System', 'Billing & licences', 'Seats, plans, and invoices.'],
};
