import { useAuth } from '../context/AuthContext';
import AdminPanel from '../components/Dashboard/AdminPanel';
import { Navigate } from 'react-router-dom';

const AdminPage = () => {
  const { isAdmin, isResponder, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-r-transparent"></div>
      </div>
    );
  }

  if (!isAdmin && !isResponder) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminPanel />
    </div>
  );
};

export default AdminPage;
