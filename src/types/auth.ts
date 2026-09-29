/**
 * @file auth.ts
 * @description Định nghĩa các vai trò và quyền hạn người dùng (RBAC) trong hệ thống
 */

export type UserRole = 'ADMIN' | 'OPERATOR' | 'MAINTENANCE' | 'admin' | 'operator' | 'maintenance';

export interface UserProfile {
  id: string;
  employeeId: string;
  name: string;
  fullName?: string;
  email: string;
  role: UserRole;
  assignedLineId?: string; // 'ALL' hoặc 'LINE-01', 'LINE-02', 'LINE-03'
  avatarUrl?: string | null;
  status?: 'active' | 'inactive';
  lastLoginAt?: string | null;
  shift?: 'Ca 1 (Sáng)' | 'Ca 2 (Chiều)' | 'Ca 3 (Đêm)';
  code?: string;
}

export interface AuthResponse {
  message: string;
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}
