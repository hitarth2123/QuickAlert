import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    // Handle specific error codes
    if (response) {
      switch (response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
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
  verify: (id, vote) => api.post(`/reports/${id}/verify`, { vote }),
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
