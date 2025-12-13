import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current user on mount or token change
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        setUser(response.data.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch user:', err);
        // Token is invalid, clear it
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const register = async (userData) => {
    try {
      setError(null);
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const verifyEmail = async (email, code) => {
    try {
      setError(null);
      const response = await api.post('/auth/verify-email', { email, code });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Verification failed';
      setError(message);
      throw new Error(message);
    }
  };

  // Firebase authentication (for phone OTP and Google sign-in)
  const firebaseAuth = async (firebaseToken) => {
    try {
      setError(null);
      const response = await api.post('/auth/firebase-verify', { firebaseToken });
      const { token: newToken, user: userData } = response.data.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Firebase authentication failed';
      setError(message);
      throw new Error(message);
    }
  };

  const login = async (email, password, deviceInfo = {}) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password, deviceInfo });
      const { token: newToken, user: userData } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      setError(null);
      const response = await api.put('/auth/me', profileData);
      setUser(response.data.data);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Update failed';
      setError(message);
      throw new Error(message);
    }
  };

  const updatePassword = async (currentPassword, newPassword) => {
    try {
      setError(null);
      const response = await api.put('/auth/me/password', { currentPassword, newPassword });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Password update failed';
      setError(message);
      throw new Error(message);
    }
  };

  const updateLocation = useCallback(async (latitude, longitude) => {
    try {
      const response = await api.put('/auth/update-location', { lat: latitude, lng: longitude });
      setUser(prev => ({
        ...prev,
        lastKnownLocation: response.data.data.lastKnownLocation
      }));
      return response.data;
    } catch (err) {
      console.error('Location update failed:', err);
    }
  }, []);

  const forgotPassword = async (email) => {
    try {
      setError(null);
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Request failed';
      setError(message);
      throw new Error(message);
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    try {
      setError(null);
      const response = await api.post('/auth/reset-password', { email, code, newPassword });
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Reset failed';
      setError(message);
      throw new Error(message);
    }
  };

  const getSessions = async () => {
    try {
      const response = await api.get('/auth/me/sessions');
      return response.data.data;
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      throw err;
    }
  };

  const revokeSession = async (sessionId) => {
    try {
      await api.delete(`/auth/me/sessions/${sessionId}`);
    } catch (err) {
      console.error('Failed to revoke session:', err);
      throw err;
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isResponder = user?.role === 'responder' || isAdmin;
  const isSuperAdmin = user?.role === 'super_admin';

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin,
    isResponder,
    isSuperAdmin,
    register,
    verifyEmail,
    firebaseAuth,
    login,
    logout,
    updateProfile,
    updatePassword,
    updateLocation,
    forgotPassword,
    resetPassword,
    getSessions,
    revokeSession,
    clearError: () => setError(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
