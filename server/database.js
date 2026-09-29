/**
 * @file database.js
 * @description Hệ thống Cơ sở dữ liệu JSON Engine bền vững (ACID-like persistence) cho Denso IoT
 * Quản lý Users, AuditLogs, Production Lines, PLC Stations và Alarms.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

// Khởi tạo CSDL mặc định ban đầu
function getInitialData() {
  const adminHash = bcrypt.hashSync('admin123', 10);
  const userHash = bcrypt.hashSync('user123', 10);
  const techHash = bcrypt.hashSync('tech123', 10);

  return {
    users: [
      {
        id: 'usr-admin-01',
        employeeId: 'DNS-1001',
        email: 'admin@denso.com',
        passwordHash: adminHash,
        fullName: 'Hoàng Minh Hải',
        role: 'ADMIN',
        assignedLineId: 'ALL',
        status: 'active',
        createdAt: '2026-01-15T08:00:00.000Z',
        lastLoginAt: new Date().toISOString(),
      },
      {
        id: 'usr-operator-01',
        employeeId: 'DNS-1024',
        email: 'user@denso.com',
        passwordHash: userHash,
        fullName: 'Trần Quang Huy',
        role: 'OPERATOR',
        assignedLineId: 'LINE-01',
        status: 'active',
        createdAt: '2026-02-01T08:00:00.000Z',
        lastLoginAt: '2026-09-28T07:30:00.000Z',
      },
      {
        id: 'usr-maint-01',
        employeeId: 'DNS-1088',
        email: 'tech@denso.com',
        passwordHash: techHash,
        fullName: 'Lê Văn Tiến',
        role: 'MAINTENANCE',
        assignedLineId: 'LINE-02',
        status: 'active',
        createdAt: '2026-02-10T08:00:00.000Z',
        lastLoginAt: '2026-09-27T14:15:00.000Z',
      },
    ],
    auditLogs: [
      {
        id: 'AUD-20260929-001',
        userId: 'usr-admin-01',
        userEmail: 'admin@denso.com',
        userName: 'Hoàng Minh Hải',
        employeeId: 'DNS-1001',
        action: 'UPDATE_THRESHOLD',
        target: 'MTR-STP-01-TMP',
        details: 'Cập nhật ngưỡng nhiệt độ máy dập: Warning Max: 68°C, Critical Max: 80°C',
        ipAddress: '192.168.1.15',
        timestamp: '2026-09-29T08:15:22.000Z',
      },
      {
        id: 'AUD-20260929-002',
        userId: 'usr-admin-01',
        userEmail: 'admin@denso.com',
        userName: 'Hoàng Minh Hải',
        employeeId: 'DNS-1001',
        action: 'TOGGLE_PLC',
        target: 'PLC-STATION-01',
        details: 'Khởi động lại kết nối truyền thông Modbus/TCP Siemens S7-1500',
        ipAddress: '192.168.1.15',
        timestamp: '2026-09-29T08:30:10.000Z',
      },
      {
        id: 'AUD-20260929-003',
        userId: 'usr-operator-01',
        userEmail: 'user@denso.com',
        userName: 'Trần Quang Huy',
        employeeId: 'DNS-1024',
        action: 'ACKNOWLEDGE_ALARM',
        target: 'ALM-20260927-001',
        details: 'Tiếp nhận xử lý cảnh báo quá nhiệt ổ bi băng tải MC-CVY-01',
        ipAddress: '192.168.1.42',
        timestamp: '2026-09-29T09:05:40.000Z',
      },
      {
        id: 'AUD-20260929-004',
        userId: 'usr-admin-01',
        userEmail: 'admin@denso.com',
        userName: 'Hoàng Minh Hải',
        employeeId: 'DNS-1001',
        action: 'CREATE_USER',
        target: 'user@denso.com',
        details: 'Tạo tài khoản Operator mới: Trần Quang Huy (Mã NV: DNS-1024)',
        ipAddress: '192.168.1.15',
        timestamp: '2026-09-29T09:20:00.000Z',
      },
    ],
    plcStations: [
      {
        id: 'PLC-STATION-01',
        name: 'Trạm PLC Chính - Dây chuyền Dập & Hàn (Siemens S7-1500)',
        protocol: 'Modbus/TCP',
        ipAddress: '192.168.1.100',
        port: 502,
        isConnected: true,
        latencyMs: 12,
        tagsCount: 24,
        lastSync: 'Vừa xong',
        pollingRateMs: 1000,
      },
      {
        id: 'PLC-STATION-02',
        name: 'Trạm PLC Phụ - Dây chuyền Sơn & Lắp ráp (Omron NX1P2)',
        protocol: 'OPC-UA',
        ipAddress: '192.168.1.101',
        port: 4840,
        isConnected: true,
        latencyMs: 18,
        tagsCount: 16,
        lastSync: 'Vừa xong',
        pollingRateMs: 2500,
      },
    ],
  };
}

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.data = getInitialData();
        this.save();
      }
    } catch (err) {
      console.error('Error loading database, resetting to initial data:', err);
      this.data = getInitialData();
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save db.json:', err);
    }
  }

  // --- Users Operations ---
  getUsers() {
    return this.data.users.map(({ passwordHash, ...safeUser }) => safeUser);
  }

  getUserById(id) {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByEmail(email) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(userData) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(userData.password || 'denso123', salt);
    const newUser = {
      id: `usr-${Date.now()}`,
      employeeId: userData.employeeId || `DNS-${Math.floor(1000 + Math.random() * 9000)}`,
      email: userData.email,
      passwordHash,
      fullName: userData.fullName,
      role: userData.role || 'OPERATOR',
      assignedLineId: userData.assignedLineId || 'ALL',
      status: userData.status || 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    this.data.users.push(newUser);
    this.save();
    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  updateUser(id, updates) {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;

    if (updates.password) {
      updates.passwordHash = bcrypt.hashSync(updates.password, 10);
      delete updates.password;
    }

    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
    };
    this.save();
    const { passwordHash: _, ...safeUser } = this.data.users[idx];
    return safeUser;
  }

  deleteUser(id) {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Audit Logs Operations ---
  getAuditLogs(filters = {}) {
    let logs = [...this.data.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (filters.action && filters.action !== 'all') {
      logs = logs.filter((l) => l.action === filters.action);
    }

    if (filters.userId && filters.userId !== 'all') {
      logs = logs.filter((l) => l.userId === filters.userId || l.employeeId === filters.userId);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.employeeId.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q)
      );
    }

    return logs;
  }

  addAuditLog(entry) {
    const newLog = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: entry.userId || 'system',
      userEmail: entry.userEmail || 'system@denso.com',
      userName: entry.userName || 'System Auto',
      employeeId: entry.employeeId || 'SYS-00',
      action: entry.action,
      target: entry.target || 'GLOBAL',
      details: entry.details || '',
      ipAddress: entry.ipAddress || '127.0.0.1',
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(newLog);
    // Giới hạn lưu trữ 1000 logs gần nhất để tối ưu dung lượng
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 1000);
    }
    this.save();
    return newLog;
  }

  // --- PLC Stations Operations ---
  getPLCStations() {
    return this.data.plcStations;
  }

  togglePLCStation(id) {
    const station = this.data.plcStations.find((s) => s.id === id);
    if (!station) return null;
    station.isConnected = !station.isConnected;
    station.latencyMs = station.isConnected ? Math.floor(Math.random() * 15 + 8) : 0;
    station.lastSync = station.isConnected ? 'Vừa kết nối lại' : 'Mất tín hiệu';
    this.save();
    return station;
  }
}

export const db = new Database();
