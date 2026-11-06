import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import './styles.css';
import { RequireAuth, SessionProvider } from './session';
import { ErrorBoundary, ThemeProvider, ToastProvider } from './ui';
import { PageHead, Shell } from './layout';
import { AuthPage } from './pages/Auth';
import { Dashboard } from './pages/Dashboards';
import { AttendanceView } from './pages/Attendance';
import { AssignmentsView } from './pages/Assignments';
import { Classes } from './pages/Classes';
import { CoursePage, CoursesView, LabsView, LearningView } from './pages/Courses';
import { BatchesView, ComingSoon, NotFound, Profile, Settings, Support } from './pages/Misc';
import { Generic } from './pages/Modules';
import { Workbench } from './pages/Playground';
import { StudentsView } from './pages/Students';
import { Workspace } from './pages/Workspace';

// Modules that draw their own page heading.
const OWN_HEAD: Record<string, React.ReactNode> = {
  'live-classes': <Classes />, attendance: <AttendanceView />, students: <StudentsView />, assignments: <AssignmentsView />,
  batches: <BatchesView />, profile: <Profile />, settings: <Settings />, support: <Support />,
};
// Modules that need the standard heading above them.
const WITH_HEAD: Record<string, React.ReactNode> = { learning: <LearningView />, courses: <CoursesView />, labs: <LabsView />, workbench: <Workbench /> };
const PEOPLE = ['trainers', 'admins', 'users'];

function ModuleRoute() {
  const { module = '' } = useParams();
  if (module === 'dashboard') return <Navigate to="/" replace />;
  if (OWN_HEAD[module]) return <>{OWN_HEAD[module]}</>;
  if (WITH_HEAD[module]) return <><PageHead slug={module} />{WITH_HEAD[module]}</>;
  if (PEOPLE.includes(module)) return <><PageHead slug={module} /><Generic slug={module} /></>;
  return <ComingSoon slug={module} />;
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <SessionProvider>
            <Routes>
              <Route path="/auth/:portal/:mode" element={<AuthPage />} />
              <Route element={<RequireAuth><Shell /></RequireAuth>}>
                <Route index element={<Dashboard />} />
                <Route path="live-classes/:id" element={<Workspace />} />
                <Route path="learning/:courseId" element={<CoursePage />} />
                <Route path="courses/:courseId" element={<CoursePage />} />
                <Route path=":module" element={<ModuleRoute />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </SessionProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
