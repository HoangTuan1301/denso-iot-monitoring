/**
 * @file api.ts
 * @description API Client chuẩn RESTful có gắn tự động Authorization: Bearer <token>
 * và quản lý phiên xác thực JWT an toàn.
 */

import { AuthResponse, UserProfile } from '../types/auth';
import { AuditLogEntry } from '../types/audit';

const TOKEN_KEY = 'denso_iot_access_token';
const REFRESH_TOKEN_KEY = 'denso_iot_refresh_token';
const USER_KEY = 'denso_iot_user_profile';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: (): UserProfile | null => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setSession: (authData: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, authData.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// Tự động nhận diện URL Backend Render nếu chạy trên môi trường Vercel hoặc cloud
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  // Nếu đang mở trên tên miền vercel.app, tự động trỏ về Render backend
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://denso-iot-monitoring.onrender.com';
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();

// Hàm gửi HTTP Request có tự động đính kèm Bearer Token
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.getAccessToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Nếu có API_BASE_URL và endpoint bắt đầu bằng '/', nối vào
  const fullUrl = API_BASE_URL && endpoint.startsWith('/') ? `${API_BASE_URL}${endpoint}` : endpoint;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Phiên làm việc hết hạn
    tokenStorage.clearSession();
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.error(`[API Error] Expected JSON but received ${contentType} from ${fullUrl}:`, text.slice(0, 200));
    throw new Error('Máy chủ đang khởi động hoặc đường dẫn API chưa kết nối đúng tới Backend.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Lỗi yêu cầu: ${response.statusText}`);
  }

  return data as T;
}

// =========================================================================
// CÁC DỊCH VỤ API TƯƠNG TÁC BACKEND
// =========================================================================
export const apiClient = {
  // --- Auth ---
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      tokenStorage.setSession(res);
      return res;
    } catch (err: any) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('Không thể kết nối đến máy chủ Backend (Port 5000). Vui lòng khởi động backend bằng "npm run server" hoặc "npm run dev".');
      }
      throw err;
    }
  },

  async getMe(): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/api/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // bỏ qua lỗi nếu server offline
    } finally {
      tokenStorage.clearSession();
    }
  },

  // --- Users Management ---
  async getUsers(): Promise<{ users: UserProfile[] }> {
    return request<{ users: UserProfile[] }>('/api/users');
  },

  async createUser(userData: {
    username?: string;
    fullName: string;
    role: string;
    status?: string;
    employeeId?: string;
    email?: string;
    password?: string;
    assignedLineId?: string;
    avatarUrl?: string | null;
  }): Promise<{ user: UserProfile; message: string }> {
    return request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<{ user: UserProfile }> {
    return request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    return request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  async resetPassword(id: string, newPassword: string = '123456'): Promise<{ message: string; defaultPassword?: string }> {
    return request(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },

  async uploadAvatar(file: File, userId?: string): Promise<{ avatarUrl: string; user: UserProfile; message: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    if (userId) {
      formData.append('userId', userId);
    }
    return request('/api/users/upload-avatar', {
      method: 'POST',
      body: formData,
    });
  },

  // --- Audit Logs ---
  async getAuditLogs(filters: { action?: string; search?: string } = {}): Promise<{ auditLogs: AuditLogEntry[] }> {
    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/audit-logs${query}`);
  },

  async recordAudit(action: string, target: string, details: string): Promise<void> {
    try {
      await request('/api/audit-logs', {
        method: 'POST',
        body: JSON.stringify({ action, target, details }),
      });
    } catch {
      // Không chặn luồng chính nếu ghi log thất bại
    }
  },
};
