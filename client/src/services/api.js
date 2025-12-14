import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const { response } = error;

    // Handle 401 errors with token refresh
    if (response?.status === 401 && !originalRequest._retry) {
      // Don't retry for login/register/refresh endpoints
      if (originalRequest.url?.includes('/auth/login') || 
          originalRequest.url?.includes('/auth/register') ||
          originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        // No refresh token, logout
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
          { refreshToken }
        );
        
        const newToken = data.data.token;
        const newRefreshToken = data.data.refreshToken;
        
        localStorage.setItem('token', newToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        
        processQueue(null, newToken);
        isRefreshing = false;
        
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Refresh failed, logout
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle other error codes
    if (response) {
      switch (response.status) {
        case 403:
          // Forbidden - user doesn't have permission
          console.error('Access forbidden:', response.data?.message);
          break;
        case 429:
          // Rate limited
          console.error('Rate limited. Please wait before retrying.');
          break;
        case 500:
          // Server error
          console.error('Server error:', response.data?.message);
          break;
        default:
          break;
      }
    } else if (error.request) {
      // Network error
      console.error('Network error - please check your connection');
    }

    return Promise.reject(error);
  }
);

// API helper functions

// Reports API
export const reportsApi = {
  getAll: (params) => api.get('/reports', { params }),
  getById: (id) => api.get(`/reports/${id}`),
  create: (data) => api.post('/reports', data),
  createAnonymous: (data) => api.post('/reports', data), // Same endpoint, just no auth
  update: (id, data) => api.put(`/reports/${id}`, data),
  delete: (id) => api.delete(`/reports/${id}`),
  getNearby: (lat, lng, radius = 5000) =>
    api.get('/reports/nearby', { params: { lat, lng, radius } }),
  verify: (id, data) => api.post(`/reports/${id}/verify`, data),
  moderate: (id, status, reason) =>
    api.put(`/reports/${id}/moderate`, { status, reason }),
  getCategories: () => api.get('/reports/categories/list'),
};

// Alerts API
export const alertsApi = {
  getAll: (params) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  create: (data) => api.post('/alerts', data),
  update: (id, data) => api.put(`/alerts/${id}`, data),
  delete: (id) => api.delete(`/alerts/${id}`),
  getNearby: (lat, lng, radius = 10000) =>
    api.get('/alerts/nearby', { params: { lat, lng, radius } }),
  cancel: (id, reason) => api.put(`/alerts/${id}/cancel`, { reason }),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
};

// Analytics API
export const analyticsApi = {
  getPopulation: (params) => api.get('/analytics/population', { params }),
  getReportStats: (params) => api.get('/analytics/reports', { params }),
  getReportHeatmap: (params) => api.get('/analytics/reports/heatmap', { params }),
  getAlertStats: (params) => api.get('/analytics/alerts', { params }),
  getAlertHeatmap: (params) => api.get('/analytics/alerts/heatmap', { params }),
  getHeatmap: (params) => api.get('/analytics/heatmap', { params }),
};

// Users API (Admin only)
export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  ban: (id) => api.put(`/users/${id}/ban`),
  unban: (id) => api.put(`/users/${id}/unban`),
  delete: (id) => api.delete(`/users/${id}`),
};

// Auth API (for direct usage without context)
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  verifyEmail: (email, code) => api.post('/auth/verify-email', { email, code }),
  login: (email, password, deviceInfo) =>
    api.post('/auth/login', { email, password, deviceInfo }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  updatePassword: (currentPassword, newPassword) =>
    api.put('/auth/me/password', { currentPassword, newPassword }),
  updateLocation: (lat, lng) => api.put('/auth/update-location', { lat, lng }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email, code, newPassword) =>
    api.post('/auth/reset-password', { email, code, newPassword }),
  getSessions: () => api.get('/auth/me/sessions'),
  revokeSession: (id) => api.delete(`/auth/me/sessions/${id}`),
};

// File upload helper
export const uploadFile = async (file, endpoint = '/reports') => {
  const formData = new FormData();
  formData.append('image', file);
  
  return api.post(endpoint, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export default api;
