import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-r-transparent"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

// Protected route component
const ProtectedRoute = ({ 
  children, 
  requiredRoles = [],
  requiredRole,  // Single role support for backwards compatibility
  redirectTo = '/login',
  requireAuth = true 
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Combine single role and roles array
  const allRequiredRoles = requiredRole 
    ? [...requiredRoles, requiredRole]
    : requiredRoles;

  // Show loading while checking auth
  if (loading) {
    return <LoadingSpinner />;
  }

  // If auth is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    // Redirect to login with return URL
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If specific roles are required, check if user has one of them
  if (allRequiredRoles.length > 0 && user) {
    // Admin and super_admin can access all routes
    const isAdminUser = user.role === 'admin' || user.role === 'super_admin';
    const hasRequiredRole = allRequiredRoles.includes(user.role);
    
    if (!hasRequiredRole && !isAdminUser) {
      // User doesn't have required role, redirect to unauthorized page or home
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

// Admin route (admin or super_admin)
export const AdminRoute = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
    {children}
  </ProtectedRoute>
);

// Responder route (responder, admin, or super_admin)
export const ResponderRoute = ({ children }) => (
  <ProtectedRoute requiredRoles={['responder', 'admin', 'super_admin']}>
    {children}
  </ProtectedRoute>
);

// Super admin only route
export const SuperAdminRoute = ({ children }) => (
  <ProtectedRoute requiredRoles={['super_admin']}>
    {children}
  </ProtectedRoute>
);

// Guest only route (redirect if already logged in)
export const GuestRoute = ({ children, redirectTo = '/' }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    // Redirect to the page they came from, or home
    const from = location.state?.from?.pathname || redirectTo;
    return <Navigate to={from} replace />;
  }

  return children;
};

export default ProtectedRoute;
