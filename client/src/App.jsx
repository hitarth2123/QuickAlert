import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';

// Shared Components
import Navbar from './components/Shared/Navbar';
import Notification from './components/Shared/Notification';
import AlertBanner from './components/Shared/AlertBanner';
import ProtectedRoute from './components/Shared/ProtectedRoute';

// Pages
import Home from './pages/Home';
import MapPage from './pages/MapPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ReportPage from './pages/ReportPage';
import AlertPage from './pages/AlertPage';
import AlertCreatePage from './pages/AlertCreatePage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <LocationProvider>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <AlertBanner />
            <Notification />
            
            <main>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/alerts" element={<AlertPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                
                {/* Protected Routes - Any authenticated user */}
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
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
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
        </LocationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
