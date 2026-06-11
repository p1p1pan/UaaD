import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import PublicLayout from './layouts/PublicLayout';
import HomePage from './pages/Home';
import NotificationsPage from './pages/Notifications';
import OrdersPage from './pages/Orders';
import OrderDetailPage from './pages/OrderDetail';
import ProfilePage from './pages/Profile';
import PublicActivitiesPage from './pages/PublicActivities';
import ActivityDetailPage from './pages/ActivityDetail';
import EnrollStatusPage from './pages/EnrollStatus';
import SettingsPage from './pages/Settings';
import MerchantDashboardPage from './pages/MerchantDashboard';
import MerchantActivitiesPage from './pages/MerchantActivities';
import MerchantActivityNewPage from './pages/MerchantActivityNew';
import MerchantActivityEditPage from './pages/MerchantActivityEdit';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';

function LegacyParamRedirect({
  resolve,
}: {
  resolve: (params: { id?: string }) => string;
}) {
  const params = useParams();
  return <Navigate to={resolve(params)} replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="activities" element={<PublicActivitiesPage />} />
              <Route path="activity/:id" element={<ActivityDetailPage />} />
              <Route
                path="orders"
                element={
                  <ProtectedRoute>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="orders/:id"
                element={
                  <ProtectedRoute>
                    <OrderDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="enroll-status/:id"
                element={
                  <ProtectedRoute>
                    <EnrollStatusPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="merchant" element={<Navigate to="/merchant/dashboard" replace />} />
              <Route
                path="merchant/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['MERCHANT']}>
                    <MerchantDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="merchant/activities"
                element={
                  <ProtectedRoute allowedRoles={['MERCHANT']}>
                    <MerchantActivitiesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="merchant/activities/new"
                element={
                  <ProtectedRoute allowedRoles={['MERCHANT']}>
                    <MerchantActivityNewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="merchant/activities/:id/edit"
                element={
                  <ProtectedRoute allowedRoles={['MERCHANT']}>
                    <MerchantActivityEditPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Legacy Fallbacks */}
            <Route path="/app" element={<Navigate to="/" replace />} />
            <Route path="/app/overview" element={<Navigate to="/" replace />} />
            <Route path="/app/activities" element={<Navigate to="/activities" replace />} />
            <Route path="/app/orders" element={<Navigate to="/orders" replace />} />
            <Route
              path="/app/orders/:id"
              element={<LegacyParamRedirect resolve={({ id }) => `/orders/${id ?? ''}`} />}
            />
            <Route path="/app/notifications" element={<Navigate to="/notifications" replace />} />
            <Route path="/app/profile" element={<Navigate to="/profile" replace />} />
            <Route path="/app/settings" element={<Navigate to="/settings" replace />} />
            <Route
              path="/app/enroll-status/:id"
              element={<LegacyParamRedirect resolve={({ id }) => `/enroll-status/${id ?? ''}`} />}
            />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
