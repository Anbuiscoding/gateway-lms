# Gateway LMS

MERN monorepo for Gateway Software Solutions' learning platform.

## Applications

- `apps/web` — React + Vite portal with student, trainer, admin, and super-admin navigation.
- `apps/api` — Express + MongoDB API with JWT authentication, RBAC middleware, course/enrollment data, dashboard metrics, and LMS module endpoints.

## Start locally

1. Copy `.env.example` to `.env` and set the JWT secret.
2. Start MongoDB with `docker compose up -d mongo`.
3. Run `npm install` in the repository root.
4. Run `npm run seed -w @gateway/api` to create local demo data.
5. Run `npm run dev` for the client and API.

## Roles and modules

Each account sees only its own modules. The role comes from the signed-in account; there is no role switcher.

| Role | Sign in at | Demo account (password `Gateway@123`) |
|---|---|---|
| Student | `/auth/student/login` | `arun@gateway.local` |
| Trainer | `/auth/admin/login` | `priya@gateway.local` |
| Administrator | `/auth/admin/login` | `admin@gateway.local` |
| Super administrator | `/auth/admin/login` | `super@gateway.local` |

The module list per role lives in `apps/web/src/modules.ts` (navigation) and `apps/api/src/rbac.js` (API access). Change both together.

## Live classes and the workspace

- A trainer (or admin) schedules a class and **chooses its domain**: Web, Data Science & AI, Backend, Systems & C++, Cloud & DevOps, Mobile, Databases, Testing, Security or Office skills. The domain sets the starting language, which the trainer can change.
- **Go live** opens a shared room (Socket.IO). The trainer edits the class code; students watch it update, chat, raise a hand, and can be given typing rights with "Let students type". Every student also has a private **My sandbox** tab.
- Joining a live class marks the student present for that class.
- **Running code:** JavaScript, Python and HTML/CSS run inside the browser. Java, C, C++, C#, Go, Rust, PHP, Ruby, Kotlin, Swift, Bash, SQL, R, Dart, Lua and TypeScript run through a Piston-compatible runner. Set `CODE_RUNNER_URL` (for example `http://localhost:2000/api/v2`) in `apps/api/.env`. Without it, those languages show a clear "no code runner" message.
- Video: the room has a button that opens a Jitsi call for the class. Built-in video would need a service such as LiveKit.

## Attendance, leave and students

Attendance covers **students only**. Staff attendance stays in your HR workspace.

- **Students** check in and out for themselves, see a five-week calendar, and apply for leave. Check-ins after `ORG_LATE_AFTER` (default 10:00 in `ORG_TIMEZONE`, default Asia/Kolkata) are marked late.
- **Trainers and admins** open Attendance to see every student's check-in and check-out time for a date, correct either time, set Present, Late, Absent or Leave, and filter by batch.
- **Leave:** students send a request with dates and a reason. Trainers and admins approve or reject it with an optional note. Approving marks the weekdays in that range as leave and turns any "absent" days in the range into leave.
- **Reports and CSV:** pick a date range and batch to see present, late, absent, leave, not marked, hours and attendance % per student. Download a summary CSV or a daily-records CSV (opens correctly in Excel).
- **Admins** add students under Students → Add student. A student ID and a one-time temporary password are generated. There is no change-password screen yet.

## Assignments

Trainers and admins create assignments (title, instructions, deadline, marks, batch, late policy), see who has submitted, read the work and give marks with feedback. Students see To do, Waiting for grading and Graded, submit text, code or a link, and can update a submission until it is graded. Dashboards show real deadlines and grading queues. Files cannot be uploaded yet.

## The live editor

Students follow the trainer's typing, including the trainer's cursor. **Pause and try** (or Alt + P) freezes a private copy that the student can edit and run while the class carries on. **Resume live** jumps straight back to where the trainer is now, and any edits made while paused are kept in the My sandbox tab. The trainer sees how many students are following and how many are paused.

## Course video lessons

Open a course (students: My learning, staff: Courses) to get the lesson page: the video on the left, a code workspace on the right and the lesson path beside them.

- **Trainers and admins** create a course, then add lessons with a YouTube, Vimeo or https .mp4 link, a code language, starter code, notes and optional chapters (`2:30 Installing Python`, one per line).
- **Students** watch, pause and try the code in the workspace next to the video. Their code is saved automatically for each lesson, and chapters jump the video to the right moment. Marking a lesson complete updates their course progress.
- The seeded Python course has one real video lesson. Other seeded lessons have notes and starter code but no video yet, so you can see how a trainer adds one.

## Look and feel, mobile and accessibility

- Dark and light themes (sun or moon button, top right), remembered per device. Animations stop for people who ask their device to reduce motion.
- On phones there is a bottom bar with the four most used modules plus a full menu. Pages never scroll sideways.
- Success and error messages appear as small notices, and every list has a clear empty state. Unknown addresses show a 404 page; a crash shows a friendly error page with a reload button.
- Each page sets its own browser title and description. Email addresses and phone numbers are tap-to-open links.

## Testing on phones

1. Phone on the same Wi-Fi as your computer. Run `npm run dev`; Vite prints a **Network** address such as `http://192.168.1.20:5173`. Open it on the phone. (Allow Node through the Windows firewall if asked.)
2. Automated check: `cd apps/web`, then `npx playwright install chromium`, then `npm run test:mobile` with the app running and the demo data seeded. It signs in as each role on an iPhone 13, a Pixel 7, a 320px phone and a desktop screen, opens every module and fails on sideways scrolling, missing page titles, links to pages that do not exist, and server errors.

## Support contact

Set `SUPPORT_EMAIL`, `SUPPORT_PHONE` and `SUPPORT_HOURS` in `apps/api/.env`. They appear on the Support page and on the sign-in page as tap-to-email and tap-to-call links. Nothing is shown until you set them.

## Enrolling students and publishing courses

Open a course (staff: Courses) and use the buttons at the top: **Students** to see who is enrolled with their progress, add students one by one or a whole batch at once, and remove students; **Edit course**; **Publish** or **Unpublish**. A new course starts as a Draft that only staff can see. When an administrator adds a student, they can enrol them in courses right there.

## Deploying

See **DEPLOYMENT.md** for step-by-step instructions and every command for Vercel (web), Render (API and live classes) and MongoDB Atlas (database), plus a troubleshooting table. `render.yaml` and `apps/web/vercel.json` are ready to use.

## Before going live

- Set `JWT_ACCESS_SECRET` (32+ random characters; the API refuses to start otherwise) and `ADMIN_SIGNUP_CODE`.
- Build the web app with `npm run build` and serve `apps/web/dist` from a static host that proxies `/api` to the API.
- Panels that still use placeholder content (approvals, batch health, system health, audit events) are listed in `apps/web/src/demo.ts`.
- The lab runner executes learner code in their own browser tab. Use an isolated runner before opening labs to untrusted users.

## Authentication routes

- Student sign in: `/auth/student/login`
- Student sign up: `/auth/student/signup`
- Administrator sign in: `/auth/admin/login`
- Administrator sign up: `/auth/admin/signup` (requires `ADMIN_SIGNUP_CODE`)

The seed catalog combines fabricated Gateway learning workflows with attributed source references to the official Python tutorial, MDN JavaScript Guide, and MongoDB data-modeling documentation.

## API surface

The API is versioned under `/api/v1`, with authentication, dashboard, courses, enrollments, workbench, batch, class, attendance, assignment, assessment, project, certificate, placement, communication, report, user, and institution module routes. Protected endpoints require `Authorization: Bearer <accessToken>`.
