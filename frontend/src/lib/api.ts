import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor - add auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        if (data.data?.accessToken) {
          localStorage.setItem("accessToken", data.data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        localStorage.removeItem("accessToken");
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string }) => api.post("/auth/register", data),
  login: (data: { email: string; password: string; mfaToken?: string }) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  refresh: () => api.post("/auth/refresh"),
  me: () => api.get("/auth/me"),
  verifyEmail: (token: string) => api.get(`/auth/verify-email?token=${token}`),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),
  resetPassword: (data: { token: string; password: string }) => api.post("/auth/reset-password", data),
};

// Transactions API
export const transactionsApi = {
  list: (params?: Record<string, any>) => api.get("/transactions", { params }),
  summary: () => api.get("/transactions/summary"),
  create: (data: any) => api.post("/transactions", data),
  update: (id: string, data: any) => api.put(`/transactions/${id}`, data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
};

// Budgets API
export const budgetsApi = {
  list: (params?: Record<string, any>) => api.get("/budgets", { params }),
  create: (data: any) => api.post("/budgets", data),
  update: (id: string, data: any) => api.put(`/budgets/${id}`, data),
  delete: (id: string) => api.delete(`/budgets/${id}`),
};

// Goals API
export const goalsApi = {
  list: () => api.get("/goals"),
  create: (data: any) => api.post("/goals", data),
  update: (id: string, data: any) => api.put(`/goals/${id}`, data),
  delete: (id: string) => api.delete(`/goals/${id}`),
  addFunds: (id: string, data: { amount: number }) => api.post(`/goals/${id}/add-funds`, data),
  predict: (id: string) => api.get(`/goals/${id}/predict`),
};

// Chat API
export const chatApi = {
  send: (message: string) => api.post("/chat", { message }),
  history: () => api.get("/chat/history"),
  clearHistory: () => api.delete("/chat/history"),
  generateBudget: () => api.post("/chat/generate-budget"),
  insights: () => api.get("/chat/insights"),
  insightsHistory: () => api.get("/chat/insights/history"),
  health: () => api.get("/chat/health"),
};

// Reports API
export const reportsApi = {
  list: (params?: Record<string, any>) => api.get("/reports", { params }),
  generate: (data: any) => api.post("/reports/generate", data),
  get: (id: string) => api.get(`/reports/${id}`),
  delete: (id: string) => api.delete(`/reports/${id}`),
};

// Notifications API
export const notificationsApi = {
  list: (params?: Record<string, any>) => api.get("/notifications", { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  checkBudgets: () => api.get("/notifications/check-budgets"),
  sendWeeklyReport: () => api.post("/notifications/send-weekly-report"),
};

// Users API
export const usersApi = {
  profile: () => api.get("/users/profile"),
  updateProfile: (data: any) => api.put("/users/profile", data),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.put("/users/password", data),
  uploadAvatar: (url: string) => api.post("/users/avatar", { url }),
  completeOnboarding: (data: any) => api.post("/users/onboarding", data),
  mfaSetup: () => api.post("/users/mfa/setup"),
  mfaVerify: (token: string) => api.post("/users/mfa/verify", { token }),
  mfaDisable: (token: string) => api.post("/users/mfa/disable", { token }),
};

// Upload API
export const uploadApi = {
  image: (formData: FormData) =>
    api.post("/upload/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// Admin API
export const adminApi = {
  dashboard: () => api.get("/admin/dashboard"),
  users: (params?: Record<string, any>) => api.get("/admin/users", { params }),
  updateUserRole: (id: string, role: string) => api.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  transactions: (params?: Record<string, any>) => api.get("/admin/transactions", { params }),
  aiUsage: () => api.get("/admin/ai-usage"),
  auditLogs: (params?: Record<string, any>) => api.get("/admin/audit-logs", { params }),
};

export default api;
