import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  AdminAuthProvider,
  useAdminAuth,
} from './context/AdminAuthContext';

import ProtectedRoute from
  './components/ProtectedRoute';

import AdminLayout from
  './layouts/AdminLayout';

import AdminLogin from
  './pages/AdminLogin';

import Dashboard from
  './pages/Dashboard';

import Venues from
  './pages/Venues';

import AddVenue from
  './pages/AddVenue';

import VenueDetails from
  './pages/VenueDetails';

import VendorApplications from
  './pages/VendorApplications';

import VendorApplicationDetails from
  './pages/VendorApplicationDetails';
import BulkVenueImport from
  './pages/BulkVenueImport';

function AppRoutes() {
  const {
    status,
    sessionError,
    checkSession,
  } = useAdminAuth();

  if (status === 'loading') {
    return (
      <main
        className="session-screen"
        role="status"
      >
        <div
          className="spinner"
          aria-hidden="true"
        />

        <p>
          Checking your admin session…
        </p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="session-screen">
        <h1>Unable to connect</h1>

        <p
          className="muted"
          role="alert"
        >
          {sessionError}
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            checkSession()
          }
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<AdminLogin />}
      />

      <Route
        element={<ProtectedRoute />}
      >
        <Route
          element={<AdminLayout />}
        >
          <Route
            index
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/venues"
            element={<Venues />}
          />

          <Route
            path="/venues/new"
            element={<AddVenue />}
          />

          <Route
            path="/venues/import"
            element={<BulkVenueImport />}
          />

          <Route
            path="/venues/:id/edit"
            element={<AddVenue />}
          />

          <Route
            path="/venues/:id"
            element={<VenueDetails />}
          />

          <Route
            path="/vendor-applications"
            element={
              <VendorApplications />
            }
          />

          <Route
            path="/vendor-applications/:vendorId"
            element={
              <VendorApplicationDetails />
            }
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={
              status ===
              'authenticated'
                ? '/dashboard'
                : '/login'
            }
            replace
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AppRoutes />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
