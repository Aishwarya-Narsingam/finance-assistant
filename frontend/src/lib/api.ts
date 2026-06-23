import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token Management ──────────────────────────────────────────
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  }
  return accessToken;
}

// ─── Request Interceptor ───────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor (Token Refresh) ──────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
          withCredentials: true,
        });
        setAccessToken(data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth API ──────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/api/auth/register', data),
  login: (data: { email: string; password: string; mfaCode?: string }) =>
    api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
  forgotPassword: (email: string) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }),
  verifyEmail: (token: string) => api.get(`/api/auth/verify-email?token=${token}`),
};

// ─── Users API ─────────────────────────────────────────────────
export const usersApi = {
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data: any) => api.put('/api/users/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/api/users/password', data),
  uploadAvatar: (image: string) => api.post('/api/users/avatar', { image }),
  completeOnboarding: () => api.post('/api/users/onboarding'),
  setupMfa: () => api.post('/api/users/mfa/setup'),
  verifyMfa: (code: string) => api.post('/api/users/mfa/verify', { code }),
  disableMfa: (code: string) => api.post('/api/users/mfa/disable', { code }),
};

// ─── Transactions API ──────────────────────────────────────────
export const transactionsApi = {
  list: (params?: any) => api.get('/api/transactions', { params }),
  summary: () => api.get('/api/transactions/summary'),
  create: (data: any) => api.post('/api/transactions', data),
  update: (id: string, data: any) => api.put(`/api/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/api/transactions/${id}`),
};

// ─── Budgets API ───────────────────────────────────────────────
export const budgetsApi = {
  list: (params?: any) => api.get('/api/budgets', { params }),
  create: (data: any) => api.post('/api/budgets', data),
  update: (id: string, data: any) => api.put(`/api/budgets/${id}`, data),
  delete: (id: string) => api.delete(`/api/budgets/${id}`),
};

// ─── Goals API ─────────────────────────────────────────────────
export const goalsApi = {
  list: () => api.get('/api/goals'),
  create: (data: any) => api.post('/api/goals', data),
  update: (id: string, data: any) => api.put(`/api/goals/${id}`, data),
  addFunds: (id: string, amount: number) =>
    api.post(`/api/goals/${id}/add-funds`, { amount }),
  predict: (id: string) => api.get(`/api/goals/${id}/predict`),
  delete: (id: string) => api.delete(`/api/goals/${id}`),
};

// ─── Chat API ──────────────────────────────────────────────────
export const chatApi = {
  send: (message: string) => api.post('/api/chat', { message }),
  history: () => api.get('/api/chat/history'),
  clearHistory: () => api.delete('/api/chat/history'),
  generateBudget: (data: any) => api.post('/api/chat/generate-budget', data),
  insights: () => api.get('/api/chat/insights'),
  insightHistory: () => api.get('/api/chat/insights/history'),
  healthCheck: () => api.get('/api/ai/health'),
  testApiKey: () => api.get('/api/chat/health/test-key'),
};

// ─── Reports API ───────────────────────────────────────────────
export const reportsApi = {
  list: (params?: any) => api.get('/api/reports', { params }),
  generate: (data: any) => api.post('/api/reports/generate', data),
  get: (id: string) => api.get(`/api/reports/${id}`),
  delete: (id: string) => api.delete(`/api/reports/${id}`),
};

// ─── Notifications API ─────────────────────────────────────────
export const notificationsApi = {
  list: (params?: any) => api.get('/api/notifications', { params }),
  markRead: (id: string) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
  delete: (id: string) => api.delete(`/api/notifications/${id}`),
  checkBudgets: () => api.get('/api/notifications/check-budgets'),
};

// ─── Admin API ─────────────────────────────────────────────────
export const adminApi = {
  dashboard: () => api.get('/api/admin/dashboard'),
  users: (params?: any) => api.get('/api/admin/users', { params }),
  updateUserRole: (id: string, role: string) =>
    api.patch(`/api/admin/users/${id}/role`, { role }),
  deleteUser: (id: string) => api.delete(`/api/admin/users/${id}`),
  transactions: (params?: any) => api.get('/api/admin/transactions', { params }),
  aiUsage: () => api.get('/api/admin/ai-usage'),
  auditLogs: (params?: any) => api.get('/api/admin/audit-logs', { params }),
};

export default api;
