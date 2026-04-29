import ReactDOM from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Provider } from 'react-redux';
import NotFound from './notFound';
import './index.css';
import Loader from './components/loader';
import { Toaster } from 'sonner';
import { store } from './store/store';


import AdminContainerLayouts  from './views/admin/AdminContainerLayouts';
import FacultyContainerLayouts from './views/faculty/FacultyContainerLayouts';
import DeparmentContainerLayouts from './views/department/DeparmentContainerLayouts';

// Lazy-loaded components with simulated delay
const Login = lazy(() => 
  wait(3000).then(() => import('./views/auth/Login'))
);

const FacultyNotification = lazy(() => 
  wait(3000).then(() => import('./views/faculty/notification/FacultyNotification'))
);

const ClassroomScheduleLayout = lazy(() => 
  wait(3000).then(() => import('./views/department/classrommSchedule/ClassroomScheduleLayout'))
);


const DepartmentFacultyLoading = lazy(() => 
  wait(3000).then(() => import('./views/department/faculty-loading/FacultyLoading'))
);


const FacultyProfileContainer = lazy(() => 
  wait(3000).then(() => import('./views/faculty/profile/FacultyProfileContainer'))
);

const ReportsContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/reports/ReportsContainer'))
);

const ProfileContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/profile/ProfileContainer'))
);

const SettingsContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/settings/SettingsContainer'))
);

const FacultySchedule = lazy(() => 
  wait(3000).then(() => import('./views/faculty/schedule/FacultySchedule'))
);

const FacultyLoading = lazy(() => 
  wait(3000).then(() => import('./views/faculty/facultyLoading/FacultyLoading'))
);

const FacultyDashboardContainer = lazy(() => 
  wait(3000).then(() => import('./views/faculty/dashboard/FacultyDashboardContainer'))
);

const DepartmentDashboardContainer = lazy(() => 
  wait(3000).then(() => import('./views/department/dashboard/DeanDashboardContainer'))
);

const ForgotPassword = lazy(() => 
  wait(3000).then(() => import('./views/auth/FotgotPassword'))
);

const ScheduleContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/faculty-loading/ScheduleContainer'))
);

const CourseContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/curriculum/CourseContainer'))
);

const RoomContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/room/RoomContainer'))
);

const DashboardContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/dashboard/DashboardContainer'))
);

const FacultyContainer = lazy(() => 
  wait(3000).then(() => import('./views/admin/faculty/FacultyContainer'))
);

// Route configuration
const routes = [
  {
    path: '/',
    element: <RedirectFrom404 />,
  },
  {
    path: 'user-login',
    element: (
      <Suspense fallback={<Loader />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: 'forgot-password',
    element: (
      <Suspense fallback={<Loader />}>
        <ForgotPassword  />
      </Suspense>
    ),
  },

  // Admin
  {
    path: 'admin',
    element: <AdminContainerLayouts />,
    children: [
      {
        path: '',
        element: <Navigate to="/admin/user-dashboard" />,
      },
      {
        path: 'user-dashboard',
        element: 
          <Suspense fallback={<Loader />}>
            <DashboardContainer />
          </Suspense>
      },
      {
        path: 'faculty',
        element: 
          <Suspense fallback={<Loader />}>
            <FacultyContainer />
          </Suspense>
      },
      {
        path: 'room',
        element: 
          <Suspense fallback={<Loader />}>
            <RoomContainer />
          </Suspense>
      },
      {
        path: 'curriculum-management',
        element: 
          <Suspense fallback={<Loader />}>
            <CourseContainer />
          </Suspense>
      },
      {
        path: 'faculty-loading',
        element: 
          <Suspense fallback={<Loader />}>
            <ScheduleContainer />
          </Suspense>
      },
      {
        path: 'reports',
        element: 
          <Suspense fallback={<Loader />}>
            <ReportsContainer />
          </Suspense>
      },
      {
        path: 'settings',
        element: 
          <Suspense fallback={<Loader />}>
            <SettingsContainer />
          </Suspense>
      },
      {
        path: 'profile',
        element: 
          <Suspense fallback={<Loader />}>
            <ProfileContainer />
          </Suspense>
      },

    ],
  },

  // Dean Department
  {
    path: 'dean',
    element: <DeparmentContainerLayouts />,
    children: [
      {
        path: '',
        element: <Navigate to="/dean/user-dashboard" />,
      },
      {
        path: 'user-dashboard',
        element: 
          <Suspense fallback={<Loader />}>
            <DepartmentDashboardContainer />
          </Suspense>
      },
      {
        path: 'faculty-loading',
        element: 
          <Suspense fallback={<Loader />}>
            <DepartmentFacultyLoading />
          </Suspense>
      },
      {
        path: 'class-schedules',
        element: 
          <Suspense fallback={<Loader />}>
            <ClassroomScheduleLayout />
          </Suspense>
      },
      {
        path: 'curriculum',
        element:
          <Suspense fallback={<Loader />}>
            <CourseContainer readOnly={true} />
          </Suspense>
      },
      {
        path: 'settings',
        element:
          <Suspense fallback={<Loader />}>
            <SettingsContainer />
          </Suspense>
      },
      {
        path: 'profile',
        element:
          <Suspense fallback={<Loader />}>
            <ProfileContainer />
          </Suspense>
      },
      
    ],
  },

  // Faculty
  {
    path: 'faculty',
    element: <FacultyContainerLayouts />,
    children: [
      {
        path: '',
        element: <Navigate to="/faculty/user-dashboard" />,
      },
      {
        path: 'user-dashboard',
        element: 
          <Suspense fallback={<Loader />}>
            <FacultyDashboardContainer />
          </Suspense>
      },
      {
        path: 'my-schedule',
        element: 
          <Suspense fallback={<Loader />}>
            <FacultySchedule />
          </Suspense>
      },
      {
        path: 'faculty-loading',
        element: 
          <Suspense fallback={<Loader />}>
            <FacultyLoading />
          </Suspense>
      },
      {
        path: 'notifications',
        element: 
          <Suspense fallback={<Loader />}>
            <FacultyNotification />
          </Suspense>
      },
      {
        path: 'profile',
        element: 
          <Suspense fallback={<Loader />}>
            <FacultyProfileContainer />
          </Suspense>
      },
      {
        path: 'settings',
        element: 
          <Suspense fallback={<Loader />}>
            <SettingsContainer />
          </Suspense>
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

// Create router
const router = createBrowserRouter(routes);

// Component to handle redirects coming from GitHub Pages 404
function RedirectFrom404() {
  const params = new URLSearchParams(window.location.search);
  const shouldRedirect = params.get('redirect') === 'true';
  if (shouldRedirect) {
    const saved = sessionStorage.getItem('redirectPath') || '/user-login';
    sessionStorage.removeItem('redirectPath');
    return <Navigate to={saved} replace />;
  }
  return <Navigate to="/user-login" replace />;
}

// Simulate delay function
function wait(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

// Render application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <RouterProvider router={router} />
    <Toaster richColors position="top-right" />
  </Provider>
);
