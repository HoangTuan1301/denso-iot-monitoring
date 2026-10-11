/**
 * @file useAuthStore.ts
 * @description Quản lý phiên xác thực JWT, hồ sơ nhân viên và phân quyền RBAC (ADMIN, OPERATOR, MAINTENANCE)
 */

import { create } from 'zustand';
import { UserProfile, UserRole } from '../types/auth';
import { apiClient, tokenStorage } from '../services/api';
import { mockUsers } from '../utils/mockData';

interface AuthState {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  uploadAvatar: (file: File, targetUserId?: string) => Promise<string | null>;
  setAvatarUrl: (avatarUrl: string) => void;
  switchUser: (userId: string) => void;
  switchRole: (role: UserRole) => void;
  availableUsers: UserProfile[];
}

const defaultAdmin: UserProfile = {
  id: 'usr-admin-01',
  employeeId: 'DNS-1001',
  name: 'Hoàng Minh Hải',
  fullName: 'Hoàng Minh Hải',
  email: 'admin@denso.com',
  role: 'ADMIN',
  assignedLineId: 'ALL',
  status: 'active',
  shift: 'Ca 1 (Sáng)',
  code: 'DNS-1001',
};

const savedUser = tokenStorage.getUser();
const savedToken = tokenStorage.getAccessToken();

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: savedUser || defaultAdmin,
  isAuthenticated: Boolean(savedToken && savedUser),
  token: savedToken,
  isLoading: false,
  error: null,
  availableUsers: mockUsers,

  /**
   * Đăng nhập xác thực bảo mật JWT (Kèm fallback demo mượt mà khi Backend đang khởi động)
   */
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await apiClient.login(normalizedEmail, password);
      set({
        currentUser: res.user,
        token: res.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      // Fallback cho buổi thuyết trình/demo: Nếu máy chủ đang ngủ hoặc mất kết nối,
      // cho phép đăng nhập tức thì với tài khoản demo mẫu chuẩn
      const matchedMock = mockUsers.find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      const isDemoPass =
        (normalizedEmail === 'admin@denso.com' && password === 'admin123') ||
        (normalizedEmail === 'user@denso.com' && password === 'user123') ||
        (normalizedEmail === 'tech@denso.com' && password === 'tech123');

      if (matchedMock && isDemoPass) {
        console.warn('[Auth Store] Máy chủ đang khởi động hoặc ngủ, kích hoạt phiên Demo nội bộ:', matchedMock.email);
        const demoToken = 'demo-jwt-token-' + Date.now();
        tokenStorage.setSession({
          message: 'Demo login successful',
          user: matchedMock,
          accessToken: demoToken,
          refreshToken: 'demo-refresh',
        });
        set({
          currentUser: matchedMock,
          token: demoToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      }

      set({
        isLoading: false,
        error: err.message || 'Đăng nhập thất bại. Vui lòng thử lại.',
      });
      return false;
    }
  },

  /**
   * Đăng xuất xóa phiên làm việc ngay lập tức (Tức thì, không treo giao diện)
   */
  logout: async () => {
    // 1. Dọn dẹp session cục bộ ngay lập tức để UI chuyển về LoginPage tức thì
    tokenStorage.clearSession();
    set({
      currentUser: defaultAdmin,
      isAuthenticated: false,
      token: null,
      error: null,
    });

    // 2. Báo server ở chế độ nền (không chờ đợi)
    apiClient.logout().catch(() => {});
  },

  /**
   * Kiểm tra tính hợp lệ của token khi khởi động
   */
  checkAuth: async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      set({ isAuthenticated: false, token: null });
      return;
    }

    if (token.startsWith('demo-jwt-token-')) {
      const user = tokenStorage.getUser();
      if (user) {
        set({ currentUser: user, isAuthenticated: true });
        return;
      }
    }

    try {
      const { user } = await apiClient.getMe();
      set({ currentUser: user, isAuthenticated: true });
    } catch {
      // Token hết hạn hoặc không kết nối được
      tokenStorage.clearSession();
      set({ isAuthenticated: false, token: null, currentUser: defaultAdmin });
    }
  },

  /**
   * Tải lên và đổi ảnh đại diện
   */
  uploadAvatar: async (file, targetUserId) => {
    try {
      const res = await apiClient.uploadAvatar(file, targetUserId);
      const newAvatarUrl = res.avatarUrl;
      set((state) => {
        const isCurrent = !targetUserId || targetUserId === state.currentUser.id;
        if (isCurrent) {
          const updatedUser: UserProfile = {
            ...state.currentUser,
            avatarUrl: newAvatarUrl,
          };
          tokenStorage.setSession({
            message: 'Updated avatar',
            user: updatedUser,
            accessToken: state.token || '',
            refreshToken: 'refresh',
          });
          return { currentUser: updatedUser };
        }
        return state;
      });
      return newAvatarUrl;
    } catch (err: any) {
      console.error('[Upload Avatar Store Error]:', err);
      return null;
    }
  },

  setAvatarUrl: (avatarUrl: string) => {
    set((state) => {
      const updatedUser: UserProfile = {
        ...state.currentUser,
        avatarUrl,
      };
      tokenStorage.setSession({
        message: 'Updated avatar',
        user: updatedUser,
        accessToken: state.token || '',
        refreshToken: 'refresh',
      });
      return { currentUser: updatedUser };
    });
  },

  switchUser: (userId: string) =>
    set((state) => {
      const user = state.availableUsers.find((u) => u.id === userId);
      return user ? { currentUser: user } : state;
    }),

  switchRole: (role: UserRole) =>
    set((state) => {
      const roleStr = String(role).toUpperCase();
      const updatedUser: UserProfile = {
        ...state.currentUser,
        role: roleStr as UserRole,
      };
      tokenStorage.setSession({
        message: 'Updated role',
        user: updatedUser,
        accessToken: state.token || 'token',
        refreshToken: 'refresh',
      });
      return { currentUser: updatedUser };
    }),
}));

// Lắng nghe sự kiện token hết hạn từ api client
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().logout();
  });
}
