/**
 * @file audit.ts
 * @description Định nghĩa các kiểu dữ liệu cho Hệ thống Nhật ký Thao tác & Truy vết Sự cố (Audit Log System)
 */

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'UPDATE_THRESHOLD'
  | 'TOGGLE_PLC'
  | 'ACKNOWLEDGE_ALARM'
  | 'RESOLVE_ALARM'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'TRIGGER_EMERGENCY';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  employeeId: string;
  action: AuditAction | string;
  target: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}
