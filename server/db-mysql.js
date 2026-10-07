/**
 * @file db-mysql.js
 * @description Quản lý kết nối CSDL MySQL (localhost:3306), tự động khởi tạo Schema (Tables: Users, Lines, Machines, AuditLogs, PLCStations)
 * và seeding tài khoản mặc định (Admin, Operator, Maintenance).
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const DB_NAME = process.env.DB_NAME || 'denso_iot';
const DB_SSL = process.env.DB_SSL === 'true' || DB_HOST.includes('aivencloud.com') || DB_HOST.includes('tidbcloud.com');

let pool = null;

/**
 * Khởi tạo CSDL MySQL, tạo database và tables nếu chưa có
 */
export async function initDatabase() {
  try {
    const sslConfig = DB_SSL ? { rejectUnauthorized: false } : undefined;

    // 1. Thử tạo database nếu tài khoản có quyền (localhost)
    if (!DB_SSL) {
      try {
        const initialConn = await mysql.createConnection({
          host: DB_HOST,
          port: DB_PORT,
          user: DB_USER,
          password: DB_PASSWORD,
        });
        await initialConn.query(
          `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
        );
        await initialConn.end();
      } catch (err) {
        console.warn(`[MySQL] Bỏ qua bước tạo database: ${err.message}`);
      }
    }

    // 2. Tạo connection pool kết nối tới database
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      ssl: sslConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    console.log(`[MySQL] Đã kết nối thành công tới MySQL database: ${DB_NAME}@${DB_HOST}:${DB_PORT} (SSL: ${DB_SSL})`);

    // 3. Tạo bảng Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        employeeId VARCHAR(32) UNIQUE NOT NULL,
        fullName VARCHAR(128) NOT NULL,
        email VARCHAR(128) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('ADMIN', 'OPERATOR', 'MAINTENANCE') NOT NULL DEFAULT 'OPERATOR',
        assignedLineId VARCHAR(64) DEFAULT 'ALL',
        avatarUrl VARCHAR(255) NULL,
        status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastLoginAt DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Tạo bảng Lines (Dây chuyền sản xuất)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS production_lines (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        code VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'normal',
        safetyScore INT DEFAULT 95,
        targetOutput INT DEFAULT 1200,
        actualOutput INT DEFAULT 1140,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Tạo bảng Machines (Máy móc / Thiết bị Tầng 2)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS machines (
        id VARCHAR(64) PRIMARY KEY,
        lineId VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        code VARCHAR(64) NOT NULL,
        type VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'normal',
        healthScore INT DEFAULT 95,
        uptimeHours INT DEFAULT 120,
        qrCodeUrl VARCHAR(255) NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_line_id (lineId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Tạo bảng AuditLogs (Nhật ký kiểm toán hệ thống)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(64) NULL,
        userEmail VARCHAR(128) NULL,
        userName VARCHAR(128) NULL,
        employeeId VARCHAR(32) NULL,
        action VARCHAR(64) NOT NULL,
        target VARCHAR(128) NULL,
        details TEXT NULL,
        ipAddress VARCHAR(64) NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_action (action),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Tạo bảng PLCStations (Trạm PLC Modbus/TCP, OPC-UA)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plc_stations (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        protocol VARCHAR(32) NOT NULL,
        ipAddress VARCHAR(64) NOT NULL,
        port INT NOT NULL,
        isConnected BOOLEAN DEFAULT TRUE,
        latencyMs INT DEFAULT 12,
        tagsCount INT DEFAULT 24,
        lastSync VARCHAR(64) DEFAULT 'Vừa xong',
        pollingRateMs INT DEFAULT 1000
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Seed Users nếu bảng đang trống
    const [userRows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (userRows[0].count === 0) {
      console.log('[MySQL] Bảng users trống. Đang khởi tạo các tài khoản mặc định...');
      const adminPass = bcrypt.hashSync('admin123', 10);
      const userPass = bcrypt.hashSync('user123', 10);
      const techPass = bcrypt.hashSync('tech123', 10);

      await pool.query(
        `INSERT INTO users (id, employeeId, fullName, email, password, role, assignedLineId, avatarUrl, status, createdAt)
         VALUES 
          ('usr-admin-01', 'DNS-1001', 'Hoàng Minh Hải', 'admin@denso.com', ?, 'ADMIN', 'ALL', '/uploads/avatars/default-admin.png', 'ACTIVE', NOW()),
          ('usr-operator-01', 'DNS-1024', 'Trần Quang Huy', 'user@denso.com', ?, 'OPERATOR', 'LINE-01', '/uploads/avatars/default-user.png', 'ACTIVE', NOW()),
          ('usr-maint-01', 'DNS-1088', 'Lê Văn Bách', 'tech@denso.com', ?, 'MAINTENANCE', 'LINE-02', '/uploads/avatars/default-tech.png', 'ACTIVE', NOW())`,
        [adminPass, userPass, techPass]
      );
      console.log('[MySQL] Đã tạo 3 tài khoản mặc định: admin@denso.com, user@denso.com, tech@denso.com');
    }

    // 9. Seed Dây chuyền & Máy nếu trống
    const [lineRows] = await pool.query('SELECT COUNT(*) as count FROM production_lines');
    if (lineRows[0].count === 0) {
      console.log('[MySQL] Khởi tạo danh mục Dây chuyền & Máy móc...');
      await pool.query(`
        INSERT INTO production_lines (id, name, code, status, safetyScore, targetOutput, actualOutput)
        VALUES 
          ('LINE-01', 'Dây chuyền Dập & Hàn Khung Gầm (Press & Welding)', 'LN-PRS-01', 'normal', 98, 1500, 1420),
          ('LINE-02', 'Dây chuyền Sơn Tĩnh Điện (Electrostatic Paint)', 'LN-PNT-02', 'normal', 94, 1200, 1150),
          ('LINE-03', 'Dây chuyền Lắp Ráp Hoàn Thiện (Final Assembly)', 'LN-ASM-03', 'normal', 99, 800, 790)
      `);

      await pool.query(`
        INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours, qrCodeUrl)
        VALUES 
          ('MCH-PRS-01', 'LINE-01', 'Máy Dập Thủy Lực 500T Komatsu', 'STP-01', 'hydraulic_press', 'normal', 96, 340, '/qr/mch-prs-01'),
          ('MCH-WLD-01', 'LINE-01', 'Robot Hàn Điểm Fanuc R-2000iC', 'ROB-01', 'welding_robot', 'normal', 99, 410, '/qr/mch-wld-01'),
          ('MCH-PNT-01', 'LINE-02', 'Buồng Phun Sơn Robot Yaskawa EPX', 'PNT-01', 'paint_booth', 'normal', 92, 280, '/qr/mch-pnt-01'),
          ('MCH-DRY-01', 'LINE-02', 'Lò Sấy Nhiệt Hồng Ngoại Kawasumi', 'DRY-01', 'drying_oven', 'normal', 95, 390, '/qr/mch-dry-01'),
          ('MCH-ASM-01', 'LINE-03', 'Robot Siết Bulong Tự Động Atlas Copco', 'ASM-01', 'tightening_robot', 'normal', 99, 480, '/qr/mch-asm-01'),
          ('MCH-TST-01', 'LINE-03', 'Băng Chuyền Kiểm Tra Cuối Dòng TestBench', 'TST-01', 'testing_station', 'normal', 97, 360, '/qr/mch-tst-01')
      `);
    }

    // 10. Seed PLC Stations nếu trống
    const [plcRows] = await pool.query('SELECT COUNT(*) as count FROM plc_stations');
    if (plcRows[0].count === 0) {
      await pool.query(`
        INSERT INTO plc_stations (id, name, protocol, ipAddress, port, isConnected, latencyMs, tagsCount, lastSync, pollingRateMs)
        VALUES 
          ('PLC-STATION-01', 'Trạm PLC Chính - Dây chuyền Dập & Hàn (Siemens S7-1500)', 'Modbus/TCP', '192.168.1.100', 502, 1, 12, 24, 'Vừa xong', 1000),
          ('PLC-STATION-02', 'Trạm PLC Phụ - Dây chuyền Sơn & Lắp ráp (Omron NX1P2)', 'OPC-UA', '192.168.1.101', 4840, 1, 18, 16, 'Vừa xong', 2500)
      `);
    }

    // 11. Seed AuditLogs nếu trống
    const [auditRows] = await pool.query('SELECT COUNT(*) as count FROM audit_logs');
    if (auditRows[0].count === 0) {
      await pool.query(`
        INSERT INTO audit_logs (id, userId, userEmail, userName, employeeId, action, target, details, ipAddress, timestamp)
        VALUES 
          ('AUD-INIT-001', 'usr-admin-01', 'admin@denso.com', 'Hoàng Minh Hải', 'DNS-1001', 'SYSTEM_INIT', 'SYSTEM', 'Khởi tạo hệ thống CSDL MySQL denso_iot thành công', '127.0.0.1', NOW()),
          ('AUD-INIT-002', 'usr-admin-01', 'admin@denso.com', 'Hoàng Minh Hải', 'DNS-1001', 'LOGIN', 'auth', 'Đăng nhập phiên quản trị viên hệ thống', '127.0.0.1', NOW())
      `);
    }

    console.log('[MySQL] Cơ sở dữ liệu và các bảng đã sẵn sàng!');
    return true;
  } catch (error) {
    console.error('[MySQL Error] Lỗi kết nối hoặc khởi tạo MySQL:', error.message);
    throw error;
  }
}

// =========================================================================
// CÁC THAO TÁC CRUD TRÊN BẢNG USERS
// =========================================================================

export async function getUsers() {
  const [rows] = await pool.query(`
    SELECT id, employeeId, fullName, email, role, assignedLineId, avatarUrl, status, createdAt, lastLoginAt
    FROM users
    ORDER BY createdAt ASC
  `);
  return rows.map((u) => ({
    ...u,
    name: u.fullName,
    code: u.employeeId,
  }));
}

export async function getUserById(id) {
  const [rows] = await pool.query(`
    SELECT id, employeeId, fullName, email, password, role, assignedLineId, avatarUrl, status, createdAt, lastLoginAt
    FROM users
    WHERE id = ?
  `, [id]);
  if (rows.length === 0) return null;
  const u = rows[0];
  return {
    ...u,
    name: u.fullName,
    code: u.employeeId,
  };
}

export async function getUserByEmail(email) {
  const [rows] = await pool.query(`
    SELECT id, employeeId, fullName, email, password, role, assignedLineId, avatarUrl, status, createdAt, lastLoginAt
    FROM users
    WHERE email = ?
  `, [email]);
  if (rows.length === 0) return null;
  const u = rows[0];
  return {
    ...u,
    name: u.fullName,
    code: u.employeeId,
  };
}

export async function createUser(userData) {
  const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const employeeId = userData.employeeId || `DNS-${Math.floor(1000 + Math.random() * 9000)}`;
  const hashedPassword = userData.password
    ? bcrypt.hashSync(userData.password, 10)
    : bcrypt.hashSync('123456', 10);
  const role = (userData.role || 'OPERATOR').toUpperCase();
  const assignedLineId = userData.assignedLineId || 'ALL';
  const avatarUrl = userData.avatarUrl || null;
  const status = (userData.status || 'ACTIVE').toUpperCase();

  await pool.query(`
    INSERT INTO users (id, employeeId, fullName, email, password, role, assignedLineId, avatarUrl, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `, [id, employeeId, userData.fullName, userData.email, hashedPassword, role, assignedLineId, avatarUrl, status]);

  return getUserById(id);
}

export async function updateUser(id, updates) {
  const allowedFields = ['fullName', 'role', 'assignedLineId', 'avatarUrl', 'status', 'password', 'lastLoginAt'];
  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      if (key === 'password' && value) {
        setClauses.push('password = ?');
        values.push(bcrypt.hashSync(value, 10));
      } else if (key === 'role') {
        setClauses.push('role = ?');
        values.push(String(value).toUpperCase());
      } else if (key === 'status') {
        setClauses.push('status = ?');
        values.push(String(value).toUpperCase());
      } else {
        setClauses.push(`\`${key}\` = ?`);
        values.push(value);
      }
    }
  }

  if (setClauses.length === 0) return getUserById(id);

  values.push(id);
  await pool.query(`
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `, values);

  return getUserById(id);
}

export async function deleteUser(id) {
  const [res] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function updateUserAvatar(userId, avatarUrl) {
  await pool.query('UPDATE users SET avatarUrl = ? WHERE id = ?', [avatarUrl, userId]);
  return getUserById(userId);
}

// =========================================================================
// CÁC THAO TÁC TRÊN AUDIT LOGS
// =========================================================================

export async function getAuditLogs({ action, search, limit = 100 } = {}) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (action && action !== 'all') {
    query += ' AND action = ?';
    params.push(action);
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query += ' AND (userName LIKE ? OR employeeId LIKE ? OR target LIKE ? OR details LIKE ?)';
    params.push(s, s, s, s);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 100);

  const [rows] = await pool.query(query, params);
  return rows;
}

export async function addAuditLog(entry) {
  const id = `AUD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  await pool.query(`
    INSERT INTO audit_logs (id, userId, userEmail, userName, employeeId, action, target, details, ipAddress, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `, [
    id,
    entry.userId || null,
    entry.userEmail || null,
    entry.userName || null,
    entry.employeeId || null,
    entry.action,
    entry.target || null,
    entry.details || null,
    entry.ipAddress || '127.0.0.1',
  ]);

  const [rows] = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [id]);
  return rows[0];
}

// =========================================================================
// CÁC THAO TÁC TRÊN PLC STATIONS
// =========================================================================

export async function getPLCStations() {
  const [rows] = await pool.query('SELECT * FROM plc_stations');
  return rows.map((s) => ({
    ...s,
    isConnected: Boolean(s.isConnected),
  }));
}

export async function togglePLCStation(id) {
  const [rows] = await pool.query('SELECT * FROM plc_stations WHERE id = ?', [id]);
  if (rows.length === 0) return null;

  const current = rows[0];
  const newConnected = !current.isConnected;
  const newLatency = newConnected ? Math.floor(Math.random() * 15 + 8) : 0;
  const newLastSync = newConnected ? 'Vừa kết nối lại' : 'Mất tín hiệu';

  await pool.query(`
    UPDATE plc_stations
    SET isConnected = ?, latencyMs = ?, lastSync = ?
    WHERE id = ?
  `, [newConnected, newLatency, newLastSync, id]);

  const [updated] = await pool.query('SELECT * FROM plc_stations WHERE id = ?', [id]);
  return {
    ...updated[0],
    isConnected: Boolean(updated[0].isConnected),
  };
}

export const mysqlDb = {
  initDatabase,
  getUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  updateUserAvatar,
  getAuditLogs,
  addAuditLog,
  getPLCStations,
  togglePLCStation,
};

export default mysqlDb;
