import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { NotificationProvider } from './context/NotificationContext';

// Shared Components
import Navbar from './components/Shared/Navbar';
import Notification from './components/Shared/Notification';
import AlertBanner from './components/Shared/AlertBanner';
import ProtectedRoute from './components/Shared/ProtectedRoute';
import { GuestRoute } from './components/Shared/ProtectedRoute';

// Pages
import Home from './pages/Home';
import MapPage from './pages/MapPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ReportPage from './pages/ReportPage';
import ReportDetailPage from './pages/ReportDetailPage';
import AlertPage from './pages/AlertPage';
import AlertDetailPage from './pages/AlertDetailPage';
import AlertCreatePage from './pages/AlertCreatePage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <LocationProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-gray-50">
              <Navbar />
              <AlertBanner />
              <Notification />
            
            <main>
              <Routes>
                {/* Public Routes - Only Home/Dashboard visible without login */}
                <Route path="/" element={<Home />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                
                {/* Guest Only Routes - Redirect to map if already logged in */}
                <Route 
                  path="/login" 
                  element={
                    <GuestRoute redirectTo="/map">
                      <LoginPage />
                    </GuestRoute>
                  } 
                />
                <Route 
                  path="/register" 
                  element={
                    <GuestRoute redirectTo="/map">
                      <RegisterPage />
                    </GuestRoute>
                  } 
                />
                
                {/* Protected Routes - Require authentication */}
                <Route 
                  path="/map" 
                  element={
                    <ProtectedRoute>
                      <MapPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/alerts" 
                  element={
                    <ProtectedRoute>
                      <AlertPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/alerts/:id" 
                  element={
                    <ProtectedRoute>
                      <AlertDetailPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/report" 
                  element={
                    <ProtectedRoute>
                      <ReportPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/reports/:id" 
                  element={
                    <ProtectedRoute>
                      <ReportDetailPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/notifications" 
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/settings/notifications" 
                  element={
                    <ProtectedRoute>
                      <NotificationSettingsPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Admin Routes */}
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/*" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Responder Routes */}
                <Route 
                  path="/responder" 
                  element={
                    <ProtectedRoute requiredRole="responder">
                      <AdminPage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Alert Creation - Responders and Admins */}
                <Route 
                  path="/alerts/create" 
                  element={
                    <ProtectedRoute requiredRoles={['responder', 'admin', 'super_admin']}>
                      <AlertCreatePage />
                    </ProtectedRoute>
                  } 
                />
                
                {/* 404 Catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
          </NotificationProvider>
        </LocationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
