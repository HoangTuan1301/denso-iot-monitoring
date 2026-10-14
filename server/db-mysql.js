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
      timezone: '+00:00', // Đảm bảo toàn bộ tương tác ngày giờ giữa Node.js và MySQL ở múi giờ UTC thuần túy
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

    // 12. Tạo bảng machine_telemetry_history (Lịch sử hoạt động máy & Telemetry chuỗi thời gian)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS machine_telemetry_history (
        id VARCHAR(96) PRIMARY KEY,
        timestamp DATETIME(3) NOT NULL,
        lineId VARCHAR(64) NOT NULL,
        lineName VARCHAR(128) NOT NULL,
        machineId VARCHAR(64) NOT NULL,
        machineName VARCHAR(128) NOT NULL,
        metricId VARCHAR(64) NOT NULL,
        metricName VARCHAR(128) NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        unit VARCHAR(32) NOT NULL,
        status ENUM('normal', 'warning', 'critical') NOT NULL,
        source ENUM('simulation', 'device') NOT NULL DEFAULT 'simulation',
        plcStationId VARCHAR(64) NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_line_time (lineId, timestamp DESC),
        INDEX idx_machine_time (machineId, timestamp DESC),
        INDEX idx_metric_time (metricId, timestamp DESC),
        INDEX idx_time_status (timestamp DESC, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. Khởi tạo dữ liệu lịch sử telemetry mẫu nếu bảng đang trống
    const [historyRows] = await pool.query('SELECT COUNT(*) as count FROM machine_telemetry_history');
    if (historyRows[0].count === 0) {
      console.log('[MySQL] Bảng machine_telemetry_history trống. Đang khởi tạo dữ liệu telemetry mẫu...');
      await seedInitialTelemetryHistory();
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

// =========================================================================
// CÁC THAO TÁC TRÊN BẢNG MACHINE_TELEMETRY_HISTORY (LỊCH SỬ HOẠT ĐỘNG MÁY)
// =========================================================================

const ALLOWED_SORT_COLUMNS = [
  'timestamp',
  'value',
  'lineId',
  'machineId',
  'metricId',
  'status',
  'createdAt',
];

// Danh mục kênh telemetry chuẩn đồng bộ giữa backend và frontend (Khớp 100% mô hình nhà máy)
export const CANONICAL_TELEMETRY_CHANNELS = [
  {
    lineId: 'LINE-01',
    lineName: 'Dây chuyền Lắp ráp Động cơ 01',
    machineId: 'MC-FDR-01',
    machineName: 'Máy cấp phôi tự động 01',
    metricId: 'MTR-FDR-01-PRS',
    metricName: 'Áp suất khí nén cấp phôi',
    unit: 'bar',
    base: 6.2,
    variance: 0.3,
    wMin: 4.5,
    wMax: 7.5,
    cMin: 3.5,
    cMax: 8.5,
  },
  {
    lineId: 'LINE-01',
    lineName: 'Dây chuyền Lắp ráp Động cơ 01',
    machineId: 'MC-FDR-01',
    machineName: 'Máy cấp phôi tự động 01',
    metricId: 'MTR-FDR-01-SPD',
    metricName: 'Tốc độ cấp phôi',
    unit: 'chi tiết/phút',
    base: 45.0,
    variance: 3.0,
    wMin: 30.0,
    wMax: 60.0,
    cMin: 20.0,
    cMax: 70.0,
  },
  {
    lineId: 'LINE-01',
    lineName: 'Dây chuyền Lắp ráp Động cơ 01',
    machineId: 'MC-CYL-01',
    machineName: 'Máy ép xi-lanh thủy lực 01',
    metricId: 'MTR-CYL-01-PRS',
    metricName: 'Áp suất nén ép trục',
    unit: 'bar',
    base: 142.5,
    variance: 5.0,
    wMin: 120.0,
    wMax: 165.0,
    cMin: 100.0,
    cMax: 180.0,
  },
  {
    lineId: 'LINE-01',
    lineName: 'Dây chuyền Lắp ráp Động cơ 01',
    machineId: 'MC-CYL-01',
    machineName: 'Máy ép xi-lanh thủy lực 01',
    metricId: 'MTR-CYL-01-TMP',
    metricName: 'Nhiệt độ dầu thủy lực',
    unit: '°C',
    base: 52.0,
    variance: 2.5,
    wMin: 40.0,
    wMax: 68.0,
    cMin: 30.0,
    cMax: 75.0,
  },
  {
    lineId: 'LINE-01',
    lineName: 'Dây chuyền Lắp ráp Động cơ 01',
    machineId: 'MC-ASM-01',
    machineName: 'Robot siết bulong động cơ 01',
    metricId: 'MTR-ASM-01-TRQ',
    metricName: 'Mô-men xoắn siết bulong',
    unit: 'N·m',
    base: 42.0,
    variance: 2.0,
    wMin: 35.0,
    wMax: 50.0,
    cMin: 30.0,
    cMax: 55.0,
  },
  {
    lineId: 'LINE-02',
    lineName: 'Dây chuyền Sơn Tĩnh Điện 02',
    machineId: 'MC-PNT-01',
    machineName: 'Buồng phun sơn robot 01',
    metricId: 'MTR-PNT-01-FLW',
    metricName: 'Lưu lượng khí nén phun sơn',
    unit: 'L/min',
    base: 315.0,
    variance: 10.0,
    wMin: 280.0,
    wMax: 360.0,
    cMin: 250.0,
    cMax: 390.0,
  },
  {
    lineId: 'LINE-02',
    lineName: 'Dây chuyền Sơn Tĩnh Điện 02',
    machineId: 'MC-PNT-01',
    machineName: 'Buồng phun sơn robot 01',
    metricId: 'MTR-PNT-01-TMP',
    metricName: 'Nhiệt độ buồng sấy sơn',
    unit: '°C',
    base: 82.0,
    variance: 3.0,
    wMin: 70.0,
    wMax: 95.0,
    cMin: 60.0,
    cMax: 105.0,
  },
  {
    lineId: 'LINE-02',
    lineName: 'Dây chuyền Sơn Tĩnh Điện 02',
    machineId: 'MC-DRY-01',
    machineName: 'Lò sấy nhiệt hồng ngoại 01',
    metricId: 'MTR-DRY-01-TMP',
    metricName: 'Nhiệt độ sấy hồng ngoại',
    unit: '°C',
    base: 160.0,
    variance: 5.0,
    wMin: 140.0,
    wMax: 180.0,
    cMin: 125.0,
    cMax: 195.0,
  },
  {
    lineId: 'LINE-03',
    lineName: 'Dây chuyền Đóng gói & Kiểm tra 03',
    machineId: 'MC-TST-01',
    machineName: 'Bàn đo rung kiểm tra chất lượng',
    metricId: 'MTR-TST-01-VIB',
    metricName: 'Độ rung kiểm tra',
    unit: 'mm/s',
    base: 1.6,
    variance: 0.3,
    wMin: 0.5,
    wMax: 2.8,
    cMin: 0.2,
    cMax: 3.5,
  },
  {
    lineId: 'LINE-03',
    lineName: 'Dây chuyền Đóng gói & Kiểm tra 03',
    machineId: 'MC-TST-01',
    machineName: 'Bàn đo rung kiểm tra chất lượng',
    metricId: 'MTR-TST-01-RPM',
    metricName: 'Tốc độ quay thử nghiệm',
    unit: 'vòng/phút',
    base: 1495.0,
    variance: 15.0,
    wMin: 1400.0,
    wMax: 1600.0,
    cMin: 1350.0,
    cMax: 1650.0,
  },
];

/**
 * Khởi tạo dữ liệu lịch sử mẫu ban đầu (120 bản ghi bao phủ Ca 1, Ca 2, Ca 3 Đêm)
 */
export async function seedInitialTelemetryHistory() {
  const getVNDate = (daysAgo = 0) => {
    const d = new Date(Date.now() - daysAgo * 86400000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
  };

  const todayVN = getVNDate(0);
  const yesterdayVN = getVNDate(1);

  // 12 mốc thời gian đại diện: 4 Ca 1, 4 Ca 2, 4 Ca 3 (Đêm qua nửa đêm)
  const timepoints = [
    // Ca 1 (Hôm nay: 06:00 - 14:00)
    `${todayVN}T07:15:00+07:00`,
    `${todayVN}T09:30:00+07:00`,
    `${todayVN}T11:45:00+07:00`,
    `${todayVN}T13:30:00+07:00`,
    // Ca 2 (Hôm nay: 14:00 - 22:00)
    `${todayVN}T14:45:00+07:00`,
    `${todayVN}T17:00:00+07:00`,
    `${todayVN}T19:15:00+07:00`,
    `${todayVN}T21:30:00+07:00`,
    // Ca 3 (Đêm qua nửa đêm: 22:00 hôm qua - 06:00 hôm nay)
    `${yesterdayVN}T22:30:00+07:00`,
    `${yesterdayVN}T23:45:00+07:00`,
    `${todayVN}T02:15:00+07:00`,
    `${todayVN}T04:45:00+07:00`,
  ];

  const seedRecords = [];

  for (let tIdx = 0; tIdx < timepoints.length; tIdx++) {
    const isoUtc = new Date(timepoints[tIdx]).toISOString();
    const epoch = new Date(timepoints[tIdx]).getTime();

    for (let cIdx = 0; cIdx < CANONICAL_TELEMETRY_CHANNELS.length; cIdx++) {
      const ch = CANONICAL_TELEMETRY_CHANNELS[cIdx];
      // Tạo dao động ngẫu nhiên có kiểm soát
      const jitterFactor = Math.sin(tIdx + cIdx) * ch.variance;
      const val = Number(Math.max(0, ch.base + jitterFactor).toFixed(2));

      let status = 'normal';
      if (val <= ch.cMin || val >= ch.cMax) status = 'critical';
      else if (val <= ch.wMin || val >= ch.wMax) status = 'warning';

      seedRecords.push({
        id: `LOG_${ch.machineId}_${ch.metricId}_${epoch}`,
        lineId: ch.lineId,
        lineName: ch.lineName,
        machineId: ch.machineId,
        machineName: ch.machineName,
        metricId: ch.metricId,
        metricName: ch.metricName,
        value: val,
        unit: ch.unit,
        status,
        source: 'simulation',
        timestamp: isoUtc,
      });
    }
  }

  const res = await insertTelemetryBatch(seedRecords);
  console.log(`[MySQL] Đã nạp thành công ${res.insertedCount} bản ghi telemetry lịch sử mẫu (bao phủ Ca 1, Ca 2, Ca 3 Đêm).`);
}

/**
 * Ghi nhiều bản ghi telemetry vào CSDL (Batch Insert an toàn, ID xác định chống trùng)
 */
export async function insertTelemetryBatch(records = []) {
  if (!pool || !Array.isArray(records) || records.length === 0) {
    return { insertedCount: 0 };
  }

  try {
    const values = records.map((r) => {
      // 1. Định danh xác định (Deterministic ID):
      // Ưu tiên eventId/sampleId có sẵn từ nguồn phát; nếu không có, tạo ID kết hợp:
      // LOG_<machineId>_<metricId>_<timestampEpochMs> (Tuyệt đối không dùng Math.random() để tránh sinh ID khác khi retry)
      const epoch = r.timestamp ? new Date(r.timestamp).getTime() : Date.now();
      const id = r.id || r.eventId || r.sampleId || `LOG_${r.machineId || 'MCH'}_${r.metricId || 'MTR'}_${epoch}`;

      // 2. Chuẩn hóa timestamp sang chuỗi UTC YYYY-MM-DD HH:mm:ss.SSS cho MySQL DATETIME(3)
      const dateObj = r.timestamp ? new Date(r.timestamp) : new Date();
      const utcTimestamp = !isNaN(dateObj.getTime())
        ? dateObj.toISOString().slice(0, 23).replace('T', ' ')
        : new Date().toISOString().slice(0, 23).replace('T', ' ');

      // 3. Validate và làm tròn số đo 2 chữ số thập phân
      const numVal = Number(r.value);
      const safeVal = !isNaN(numVal) ? Number(numVal.toFixed(2)) : 0.00;

      return [
        id,
        utcTimestamp,
        r.lineId || 'UNKNOWN',
        r.lineName || 'Unknown Line',
        r.machineId || 'UNKNOWN',
        r.machineName || 'Unknown Machine',
        r.metricId || 'UNKNOWN',
        r.metricName || 'Unknown Metric',
        safeVal,
        r.unit || '',
        r.status || 'normal',
        r.source === 'device' ? 'device' : 'simulation',
        r.plcStationId || null,
      ];
    });

    const sql = `
      INSERT IGNORE INTO machine_telemetry_history (
        id, timestamp, lineId, lineName, machineId, machineName,
        metricId, metricName, value, unit, status, source, plcStationId
      ) VALUES ?
    `;

    const [result] = await pool.query(sql, [values]);
    return {
      success: true,
      insertedCount: result.affectedRows,
    };
  } catch (err) {
    console.error('[insertTelemetryBatch Error]:', err.message);
    throw err;
  }
}

/**
 * Tra cứu lịch sử hoạt động máy kèm bộ lọc đa tiêu chí, chuyển đổi múi giờ UTC chuẩn xác,
 * hỗ trợ ca đêm và kiểm soát trần an toàn khi xuất dữ liệu.
 */
export async function getTelemetryLogs(filters = {}) {
  if (!pool) {
    throw new Error('CSDL MySQL chưa sẵn sàng hoặc connection pool chưa được khởi tạo');
  }

  const {
    lineId,
    machineId,
    metricId,
    status,
    startDate,
    endDate,
    startTime,
    endTime,
    page = 1,
    limit = 20,
    sortBy = 'timestamp',
    sortOrder = 'DESC',
    isExport = false,
  } = filters;

  const conditions = [];
  const params = [];

  // 1. Lọc theo lineId
  if (lineId && lineId !== 'all') {
    conditions.push('lineId = ?');
    params.push(lineId);
  }

  // 2. Lọc theo machineId
  if (machineId && machineId !== 'all') {
    conditions.push('machineId = ?');
    params.push(machineId);
  }

  // 3. Lọc theo metricId
  if (metricId && metricId !== 'all') {
    conditions.push('metricId = ?');
    params.push(metricId);
  }

  // 4. Lọc theo status
  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  // 5. Xử lý Múi Giờ Việt Nam (Asia/Ho_Chi_Minh: UTC+7) sang UTC chuẩn và Ca Đêm
  // Dùng khoảng nửa mở [startUtc, endUtc) để bao trùm chính xác mili-giây
  if (startDate) {
    let effectiveEndDate = endDate || startDate;
    let sTime = startTime ? `${startTime}:00.000` : '00:00:00.000';

    // Xử lý Ca Đêm: Nếu cùng 1 ngày nhưng startTime > endTime (ví dụ: 22:00 đến 06:00)
    // Tự động tịnh tiến ngày kết thúc sang ngày tiếp theo chuẩn lịch
    const isOvernight = startDate === effectiveEndDate && startTime && endTime && startTime > endTime;
    if (isOvernight) {
      const [ey, em, ed] = effectiveEndDate.split('-').map(Number);
      const nextDate = new Date(Date.UTC(ey, em - 1, ed + 1));
      effectiveEndDate = nextDate.toISOString().slice(0, 10);
    }

    // Thời điểm bắt đầu tính theo UTC
    const startVnIso = `${startDate}T${sTime}+07:00`;
    const startUtcDate = new Date(startVnIso);
    if (!isNaN(startUtcDate.getTime())) {
      const startUtcSql = startUtcDate.toISOString().slice(0, 23).replace('T', ' ');
      conditions.push('timestamp >= ?');
      params.push(startUtcSql);
    }

    // Thời điểm kết thúc (endUtc): Bao trùm toàn bộ phút endTime (ví dụ 17:00 -> < 17:01:00)
    // Hoặc bao trùm cả ngày nếu không chọn endTime (< 00:00:00 ngày tiếp theo)
    let endUtcSql = null;
    if (endTime) {
      // Cộng thêm 1 phút để bao trùm trọn vẹn phút kết thúc (VD: endTime 17:00 -> < 17:01:00)
      const endVnIso = `${effectiveEndDate}T${endTime}:00.000+07:00`;
      const endBaseDate = new Date(endVnIso);
      if (!isNaN(endBaseDate.getTime())) {
        const endPlusMinute = new Date(endBaseDate.getTime() + 60000);
        endUtcSql = endPlusMinute.toISOString().slice(0, 23).replace('T', ' ');
      }
    } else {
      // Không chọn endTime: bao trùm hết 23:59:59.999 của effectiveEndDate (< 00:00 ngày hôm sau)
      const [ey, em, ed] = effectiveEndDate.split('-').map(Number);
      const nextDate = new Date(Date.UTC(ey, em - 1, ed + 1));
      const nextDayStr = nextDate.toISOString().slice(0, 10);
      const nextDayVnIso = `${nextDayStr}T00:00:00.000+07:00`;
      const nextDayDate = new Date(nextDayVnIso);
      if (!isNaN(nextDayDate.getTime())) {
        endUtcSql = nextDayDate.toISOString().slice(0, 23).replace('T', ' ');
      }
    }

    if (endUtcSql) {
      conditions.push('timestamp < ?');
      params.push(endUtcSql);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Đếm tổng số bản ghi thỏa mãn điều kiện
  const countSql = `SELECT COUNT(*) as total FROM machine_telemetry_history ${whereClause}`;
  const [countRows] = await pool.query(countSql, params);
  const totalRecords = countRows[0]?.total || 0;

  // Xử lý sorting an toàn (Whitelist validation)
  const safeSortBy = ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : 'timestamp';
  const safeOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const MAX_EXPORT_LIMIT = 10000;

  // Nếu là thao tác Export và tổng số bản ghi vượt 10.000:
  // Từ chối xuất dữ liệu thiếu để bảo vệ tính toàn vẹn, yêu cầu thu hẹp bộ lọc
  if (isExport && totalRecords > MAX_EXPORT_LIMIT) {
    return {
      totalRecords,
      page: 1,
      limit: MAX_EXPORT_LIMIT,
      totalPages: Math.ceil(totalRecords / MAX_EXPORT_LIMIT),
      isTruncated: true,
      exportAllowed: false,
      maxExportLimit: MAX_EXPORT_LIMIT,
      warning: `Số lượng bản ghi (${totalRecords.toLocaleString('vi-VN')}) vượt quá giới hạn an toàn ${MAX_EXPORT_LIMIT.toLocaleString('vi-VN')} dòng. Vui lòng thu hẹp khoảng ngày/giờ lọc để đảm bảo dữ liệu xuất nguyên vẹn 100%.`,
      data: [],
    };
  }

  // Xử lý phân trang
  const safeLimit = isExport ? MAX_EXPORT_LIMIT : Math.min(Math.max(1, Number(limit) || 20), 100);
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  let querySql = `
    SELECT id, timestamp, lineId, lineName, machineId, machineName,
           metricId, metricName, value, unit, status, source, plcStationId, createdAt
    FROM machine_telemetry_history
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeOrder}
  `;

  const queryParams = [...params];
  if (!isExport) {
    querySql += ` LIMIT ? OFFSET ?`;
    queryParams.push(safeLimit, offset);
  } else {
    querySql += ` LIMIT ?`;
    queryParams.push(safeLimit);
  }

  const [rows] = await pool.query(querySql, queryParams);

  const formattedRows = rows.map((r) => ({
    ...r,
    value: Number(r.value),
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));

  const totalPages = safeLimit > 0 ? Math.ceil(totalRecords / safeLimit) : 1;

  return {
    totalRecords,
    page: safePage,
    limit: safeLimit,
    totalPages,
    isTruncated: false,
    exportAllowed: true,
    maxExportLimit: MAX_EXPORT_LIMIT,
    data: formattedRows,
  };
}

/**
 * Đóng an toàn connection pool khi tắt server hoặc kết thúc test
 */
export async function closeDatabase() {
  if (pool) {
    try {
      await pool.end();
      console.log('[MySQL] Connection pool đã được đóng an toàn.');
    } catch (err) {
      console.warn('[MySQL Warning] Lỗi khi đóng connection pool:', err.message);
    } finally {
      pool = null;
    }
  }
}

export const mysqlDb = {
  initDatabase,
  closeDatabase,
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
  insertTelemetryBatch,
  getTelemetryLogs,
  seedInitialTelemetryHistory,
  CANONICAL_TELEMETRY_CHANNELS,
};

export default mysqlDb;

