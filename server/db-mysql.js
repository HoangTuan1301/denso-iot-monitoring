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

export function getPool() {
  return pool;
}

export function setPool(customPool) {
  pool = customPool;
}

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

    // 14. Tạo bảng metric_catalog (Danh mục Metric chuẩn toàn nhà máy)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS metric_catalog (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(128) NOT NULL,
        category ENUM('Temperature', 'Pressure', 'Vibration', 'Current', 'Voltage', 'Speed', 'Flow', 'Level', 'Other') NOT NULL,
        unit VARCHAR(32) NOT NULL,
        dataType ENUM('FLOAT', 'INTEGER', 'BOOLEAN', 'STRING', 'ENUM') NOT NULL DEFAULT 'FLOAT',
        validMin DECIMAL(10, 2) NULL,
        validMax DECIMAL(10, 2) NULL,
        description TEXT NULL,
        status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        createdBy VARCHAR(64) NULL,
        updatedBy VARCHAR(64) NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_metric_category (category),
        INDEX idx_metric_status (status),
        INDEX idx_metric_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 15. Seed Metric Catalog nếu trống
    const [metricRows] = await pool.query('SELECT COUNT(*) as count FROM metric_catalog');
    if (metricRows[0].count === 0) {
      console.log('[MySQL] Bảng metric_catalog trống. Đang khởi tạo các Metric chuẩn công nghiệp...');
      const defaultMetrics = [
        ['MTR-CAT-TMP-01', 'TEMPERATURE', 'Nhiệt độ hoạt động', 'Temperature', '°C', 'FLOAT', -40.00, 300.00, 'Đo nhiệt độ bề mặt vỏ máy, dầu giải nhiệt và khoang gia công', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-PRS-01', 'PRESSURE_HYDRAULIC', 'Áp suất dầu thủy lực', 'Pressure', 'bar', 'FLOAT', 0.00, 400.00, 'Áp suất làm việc hệ thống thủy lực máy dập và cơ cấu nâng hạ', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-PRS-02', 'PRESSURE_PNEUMATIC', 'Áp suất khí nén cấp', 'Pressure', 'bar', 'FLOAT', 0.00, 25.00, 'Áp suất khí nén cấp cho robot gắp phôi và van điều khiển khí nén', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-VIB-01', 'VIBRATION_RMS', 'Vận tốc rung hiệu dụng (RMS)', 'Vibration', 'mm/s', 'FLOAT', 0.00, 50.00, 'Đo độ rung động cơ và ổ bi trục chính theo chuẩn ISO 10816', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-CUR-01', 'CURRENT_PHASE', 'Dòng điện tải động cơ', 'Current', 'A', 'FLOAT', 0.00, 250.00, 'Dòng điện xoay chiều 3 pha cung cấp cho cụm động cơ tải nặng', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-VOL-01', 'VOLTAGE_LINE', 'Điện áp lưới cung cấp', 'Voltage', 'V', 'FLOAT', 0.00, 500.00, 'Điện áp pha-pha cung cấp cho tủ điện phân phối và biến tần', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-SPD-01', 'ROTATION_SPEED', 'Tốc độ quay trục chính', 'Speed', 'RPM', 'FLOAT', 0.00, 15000.00, 'Tốc độ quay trục chính máy tiện CNC, máy phay và đầu siết bulong', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-FLW-01', 'FLOW_COOLANT', 'Lưu lượng dung dịch làm mát', 'Flow', 'L/min', 'FLOAT', 0.00, 100.00, 'Lưu lượng tuần hoàn dung dịch giải nhiệt tưới nguội đầu gia công', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-LVL-01', 'OIL_LEVEL', 'Mức dầu bôi trơn bình chứa', 'Level', '%', 'FLOAT', 0.00, 100.00, 'Tỷ lệ phần trăm dung tích bồn dầu bôi trơn cưỡng bức ổ trục', 'ACTIVE', 'admin@denso.com'],
        ['MTR-CAT-ENG-01', 'ENERGY_CONSUMPTION', 'Công suất điện tiêu thụ', 'Other', 'kW', 'FLOAT', 0.00, 500.00, 'Tổng công suất điện tiêu thụ tức thời của trạm sản xuất', 'ACTIVE', 'admin@denso.com'],
      ];

      for (const m of defaultMetrics) {
        await pool.query(`
          INSERT INTO metric_catalog (id, code, name, category, unit, dataType, validMin, validMax, description, status, createdBy, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, m);
      }
      console.log(`[MySQL] Đã khởi tạo ${defaultMetrics.length} metric mẫu vào metric_catalog.`);
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

export async function addAuditLog(entry, connection = null) {
  const runner = connection || pool;
  const id = `AUD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  await runner.query(`
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

  const [rows] = await runner.query('SELECT * FROM audit_logs WHERE id = ?', [id]);
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
      // LOG_<machineId>_<metricId>_<timestampEpochMs>_<seq> (Idempotent & Bền vững qua retry)
      const epoch = r.timestamp ? new Date(r.timestamp).getTime() : Date.now();
      const seqStr = r.sequenceNumber ? `_${String(r.sequenceNumber).padStart(6, '0')}` : '';
      const id = r.id || r.eventId || r.sampleId || `LOG_${r.machineId || 'MCH'}_${r.metricId || 'MTR'}_${epoch}${seqStr}`;

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
      INSERT INTO machine_telemetry_history (
        id, timestamp, lineId, lineName, machineId, machineName,
        metricId, metricName, value, unit, status, source, plcStationId
      ) VALUES ?
      ON DUPLICATE KEY UPDATE id = VALUES(id)
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

// =========================================================================
// CÁC THAO TÁC TRÊN BẢNG METRIC_CATALOG (DANH MỤC METRIC TOÀN NHÀ MÁY)
// =========================================================================

export const VALID_METRIC_CATEGORIES = [
  'Temperature', 'Pressure', 'Vibration', 'Current', 'Voltage', 'Speed', 'Flow', 'Level', 'Other'
];

export const VALID_METRIC_DATA_TYPES = [
  'FLOAT', 'INTEGER', 'BOOLEAN', 'STRING', 'ENUM'
];

export async function getMetrics({
  page = 1,
  limit = 10,
  search = '',
  category = '',
  dataType = '',
  status = '',
  sortBy = 'createdAt',
  sortOrder = 'DESC',
} = {}) {
  const allowedSortFields = ['code', 'name', 'category', 'unit', 'dataType', 'validMin', 'validMax', 'status', 'createdAt', 'updatedAt', 'usageCount'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 100);
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['1=1'];
  const params = [];

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    whereClauses.push('(m.code LIKE ? OR m.name LIKE ? OR m.description LIKE ?)');
    params.push(s, s, s);
  }

  if (category && category !== 'all') {
    whereClauses.push('m.category = ?');
    params.push(category);
  }

  if (dataType && dataType !== 'all') {
    whereClauses.push('m.dataType = ?');
    params.push(dataType);
  }

  if (status && status !== 'all') {
    whereClauses.push('m.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.join(' AND ');

  // Đếm tổng số bản ghi phù hợp bộ lọc
  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM metric_catalog m WHERE ${whereSql}`,
    params
  );
  const total = countRows[0]?.total || 0;

  // Lấy dữ liệu kèm tính toán usageCount (số máy hoặc cảm biến đang tham chiếu metric này)
  const querySql = `
    SELECT 
      m.id, m.code, m.name, m.category, m.unit, m.dataType,
      m.validMin, m.validMax, m.description, m.status,
      m.createdBy, m.updatedBy, m.createdAt, m.updatedAt,
      (
        SELECT COUNT(DISTINCT mm.machine_id)
        FROM metric_mappings mm
        WHERE mm.metric_id = m.id
      ) AS assignedCount,
      (
        SELECT GROUP_CONCAT(DISTINCT mm.machine_id)
        FROM metric_mappings mm
        WHERE mm.metric_id = m.id
      ) AS assignedMachineIds,
      (
        SELECT COUNT(DISTINCT h.machineId)
        FROM machine_telemetry_history h
        WHERE h.metricId LIKE CONCAT('%', m.code, '%') 
           OR h.metricName LIKE CONCAT('%', m.name, '%')
           OR h.metricId = m.id
      ) AS usageCount
    FROM metric_catalog m
    WHERE ${whereSql}
    ORDER BY ${safeSortBy === 'usageCount' ? 'usageCount' : `m.${safeSortBy}`} ${safeSortOrder}
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, safeLimit, offset];
  const [rows] = await pool.query(querySql, queryParams);

  const formattedRows = rows.map((r) => ({
    ...r,
    validMin: r.validMin !== null ? Number(r.validMin) : null,
    validMax: r.validMax !== null ? Number(r.validMax) : null,
    usageCount: Number(r.usageCount || 0),
    assignedCount: Number(r.assignedCount || 0),
    assignedMachineIds: r.assignedMachineIds ? String(r.assignedMachineIds).split(',') : [],
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  }));

  const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 1;

  // Summary counts
  const summary = await getMetricSummary();

  return {
    metrics: formattedRows,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    },
    summary,
  };
}

export async function getMetricSummary() {
  const [rows] = await pool.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive
    FROM metric_catalog
  `);

  // Tính số lượng metric đang được gán vào ít nhất 1 máy trong metric_mappings
  const [mappedRows] = await pool.query(`
    SELECT COUNT(DISTINCT metric_id) AS totalMapped
    FROM metric_mappings
    WHERE metric_id IS NOT NULL
  `);

  const total = Number(rows[0]?.total || 0);
  const active = Number(rows[0]?.active || 0);
  const inactive = Number(rows[0]?.inactive || 0);
  const totalMapped = Number(mappedRows[0]?.totalMapped || 0);
  const assigned = totalMapped;
  const unassigned = Math.max(0, total - assigned);

  return { total, active, inactive, totalMapped, assigned, unassigned };
}

export async function getMetricById(id) {
  const [rows] = await pool.query(`
    SELECT 
      m.id, m.code, m.name, m.category, m.unit, m.dataType,
      m.validMin, m.validMax, m.description, m.status,
      m.createdBy, m.updatedBy, m.createdAt, m.updatedAt,
      (
        SELECT COUNT(DISTINCT mm.machine_id)
        FROM metric_mappings mm
        WHERE mm.metric_id = m.id
      ) AS assignedCount,
      (
        SELECT GROUP_CONCAT(DISTINCT mm.machine_id)
        FROM metric_mappings mm
        WHERE mm.metric_id = m.id
      ) AS assignedMachineIds,
      (
        SELECT COUNT(DISTINCT h.machineId)
        FROM machine_telemetry_history h
        WHERE h.metricId LIKE CONCAT('%', m.code, '%') 
           OR h.metricName LIKE CONCAT('%', m.name, '%')
           OR h.metricId = m.id
      ) AS usageCount
    FROM metric_catalog m
    WHERE m.id = ? OR m.code = ?
  `, [id, id]);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    validMin: r.validMin !== null ? Number(r.validMin) : null,
    validMax: r.validMax !== null ? Number(r.validMax) : null,
    usageCount: Number(r.usageCount || 0),
    assignedCount: Number(r.assignedCount || 0),
    assignedMachineIds: r.assignedMachineIds ? String(r.assignedMachineIds).split(',') : [],
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

export async function getMetricByCode(code) {
  const [rows] = await pool.query(
    'SELECT * FROM metric_catalog WHERE code = ?',
    [String(code).trim().toUpperCase()]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export async function createMetric(data) {
  const id = `MTR-CAT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const code = String(data.code).trim().toUpperCase();
  const name = String(data.name).trim();
  const category = data.category;
  const unit = String(data.unit).trim();
  const dataType = data.dataType || 'FLOAT';
  const validMin = data.validMin !== undefined && data.validMin !== null && data.validMin !== '' ? Number(data.validMin) : null;
  const validMax = data.validMax !== undefined && data.validMax !== null && data.validMax !== '' ? Number(data.validMax) : null;
  const description = data.description ? String(data.description).trim() : null;
  const status = (data.status || 'ACTIVE').toUpperCase();
  const createdBy = data.createdBy || null;

  await pool.query(`
    INSERT INTO metric_catalog (id, code, name, category, unit, dataType, validMin, validMax, description, status, createdBy, updatedBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `, [id, code, name, category, unit, dataType, validMin, validMax, description, status, createdBy, createdBy]);

  return getMetricById(id);
}

export async function updateMetric(id, data) {
  const existing = await getMetricById(id);
  if (!existing) return null;

  const allowedFields = ['code', 'name', 'category', 'unit', 'dataType', 'validMin', 'validMax', 'description', 'status', 'updatedBy'];
  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      if (key === 'code') {
        const cleanCode = String(value).trim().toUpperCase();
        setClauses.push('`code` = ?');
        values.push(cleanCode);
      } else if (key === 'validMin' || key === 'validMax') {
        const numVal = value !== undefined && value !== null && value !== '' ? Number(value) : null;
        setClauses.push(`\`${key}\` = ?`);
        values.push(numVal);
      } else if (key === 'status') {
        setClauses.push('`status` = ?');
        values.push(String(value).toUpperCase());
      } else {
        setClauses.push(`\`${key}\` = ?`);
        values.push(value !== undefined && value !== null ? String(value).trim() : null);
      }
    }
  }

  if (setClauses.length === 0) return existing;

  setClauses.push('updatedAt = NOW()');
  values.push(existing.id);

  await pool.query(`
    UPDATE metric_catalog
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `, values);

  return getMetricById(existing.id);
}

export async function updateMetricStatus(id, status, updatedBy) {
  const existing = await getMetricById(id);
  if (!existing) return null;

  const cleanStatus = String(status).toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  await pool.query(`
    UPDATE metric_catalog
    SET status = ?, updatedBy = ?, updatedAt = NOW()
    WHERE id = ?
  `, [cleanStatus, updatedBy || null, existing.id]);

  return getMetricById(existing.id);
}

export async function getMetricUsage(id) {
  const metric = await getMetricById(id);
  if (!metric) return null;

  const [rows] = await pool.query(`
    SELECT 
      lineId, lineName, machineId, machineName, metricId, metricName,
      COUNT(*) AS sampleCount,
      MAX(timestamp) AS lastSeen
    FROM machine_telemetry_history
    WHERE metricId LIKE CONCAT('%', ?, '%')
       OR metricName LIKE CONCAT('%', ?, '%')
       OR metricId = ?
    GROUP BY lineId, lineName, machineId, machineName, metricId, metricName
    ORDER BY lastSeen DESC
  `, [metric.code, metric.name, metric.id]);

  const formattedMachines = rows.map((r) => ({
    lineId: r.lineId,
    lineName: r.lineName,
    machineId: r.machineId,
    machineName: r.machineName,
    metricId: r.metricId,
    metricName: r.metricName,
    sampleCount: Number(r.sampleCount || 0),
    lastSeen: r.lastSeen instanceof Date ? r.lastSeen.toISOString() : String(r.lastSeen),
  }));

  return {
    metricId: metric.id,
    code: metric.code,
    name: metric.name,
    status: metric.status,
    usageCount: formattedMachines.length,
    referencingMachines: formattedMachines,
  };
}

export async function deleteMetric(id, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [rows] = await conn.query('SELECT * FROM metric_catalog WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy thông số trong danh mục: ${id}`), { statusCode: 404 });
    }
    const metric = rows[0];

    // 1. Kiểm tra ràng buộc phụ thuộc: metric_mappings
    const [mappingRows] = await conn.query(
      'SELECT id, mapping_code, channel_name, machine_id FROM metric_mappings WHERE metric_id = ?',
      [id]
    );
    if (mappingRows.length > 0) {
      throw Object.assign(
        new Error(
          `Không thể xóa thông số "${metric.name}" (${metric.code}): Đang được gán cho ${mappingRows.length} kênh đo/thiết bị trong hệ thống. Vui lòng gỡ gán khỏi tất cả thiết bị trước khi xóa.`
        ),
        { statusCode: 409 }
      );
    }

    // 2. Kiểm tra ràng buộc phụ thuộc: metric_thresholds hoặc collection_schedules (nếu có mapping sót)
    const [thresholdRows] = await conn.query(`
      SELECT COUNT(*) AS count 
      FROM metric_thresholds mt
      JOIN metric_mappings mm ON mt.mapping_id = mm.id
      WHERE mm.metric_id = ?
    `, [id]);
    if (thresholdRows[0].count > 0) {
      throw Object.assign(
        new Error(
          `Không thể xóa thông số "${metric.name}" (${metric.code}): Đang tồn tại ${thresholdRows[0].count} cấu hình ngưỡng kỹ thuật liên quan.`
        ),
        { statusCode: 409 }
      );
    }

    const [scheduleRows] = await conn.query(`
      SELECT COUNT(*) AS count 
      FROM collection_schedules cs
      JOIN metric_mappings mm ON cs.mapping_id = mm.id
      WHERE mm.metric_id = ?
    `, [id]);
    if (scheduleRows[0].count > 0) {
      throw Object.assign(
        new Error(
          `Không thể xóa thông số "${metric.name}" (${metric.code}): Đang tồn tại ${scheduleRows[0].count} lịch thu thập dữ liệu liên quan.`
        ),
        { statusCode: 409 }
      );
    }

    // 3. Kiểm tra ràng buộc phụ thuộc: machine_telemetry_history (Dữ liệu lịch sử đo lường)
    const [telemetryRows] = await conn.query(`
      SELECT COUNT(*) AS count 
      FROM machine_telemetry_history
      WHERE metricId = ? OR metricId LIKE CONCAT('%', ?, '%') OR metricName LIKE CONCAT('%', ?, '%')
    `, [metric.id, metric.code, metric.name]);
    if (telemetryRows[0].count > 0) {
      throw Object.assign(
        new Error(
          `Không thể xóa thông số "${metric.name}" (${metric.code}): Đang có ${telemetryRows[0].count} bản ghi dữ liệu lịch sử đo lường (telemetry). Cần bảo toàn lịch sử sản xuất của nhà máy.`
        ),
        { statusCode: 409 }
      );
    }

    // 4. Nếu không có dữ liệu phụ thuộc, thực hiện xóa
    await conn.query('DELETE FROM metric_catalog WHERE id = ?', [id]);

    // Ghi audit log
    await addAuditLog({
      action: 'DELETE_METRIC',
      target: metric.code,
      details: `Xóa thông số khỏi danh mục: ${metric.name} (${metric.code})`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    return { success: true, metric };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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

// =========================================================================
// CÁC THAO TÁC TRÊN PRODUCTION LINES (DÂY CHUYỀN SẢN XUẤT)
// =========================================================================

export async function getProductionLines(filters = {}) {
  let query = `
    SELECT 
      p.id, p.name, p.code, p.status, p.safetyScore, p.targetOutput, p.actualOutput, p.createdAt,
      COUNT(DISTINCT m.id) AS machineCount,
      plc.id AS plcId, plc.name AS plcName, plc.protocol AS plcProtocol, plc.connection_status AS plcStatus,
      plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo, plc.ipAddress AS plcIp, plc.port AS plcPort
    FROM production_lines p
    LEFT JOIN machines m ON m.lineId = p.id
    LEFT JOIN plc_stations plc ON plc.line_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status && filters.status !== 'all') {
    query += ' AND p.status = ?';
    params.push(filters.status);
  }

  if (filters.search && filters.search.trim()) {
    const s = `%${filters.search.trim()}%`;
    query += ' AND (p.name LIKE ? OR p.code LIKE ?)';
    params.push(s, s);
  }

  query += ' GROUP BY p.id, plc.id ORDER BY p.id ASC';
  const [rows] = await pool.query(query, params);
  return rows.map((r) => ({
    ...r,
    machineCount: Number(r.machineCount || 0),
    plc: r.plcId
      ? {
          id: r.plcId,
          name: r.plcName,
          protocol: r.plcProtocol,
          status: r.plcStatus,
          enabled: Boolean(r.plcEnabled),
          isDemo: Boolean(r.plcIsDemo),
          ipAddress: r.plcIp,
          port: r.plcPort,
        }
      : null,
  }));
}

export async function getProductionLineById(id) {
  const [rows] = await pool.query(`
    SELECT p.*,
      plc.id AS plcId, plc.name AS plcName, plc.protocol AS plcProtocol, plc.connection_status AS plcStatus,
      plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo, plc.ipAddress AS plcIp, plc.port AS plcPort
    FROM production_lines p
    LEFT JOIN plc_stations plc ON plc.line_id = p.id
    WHERE p.id = ?
  `, [id]);
  if (rows.length === 0) return null;
  const line = rows[0];

  const [machines] = await pool.query(`
    SELECT m.*, plc.id as plcId, plc.name as plcName, plc.connection_status as plcStatus,
           plc.protocol as plcProtocol, plc.enabled as plcEnabled, plc.is_demo as plcIsDemo
    FROM machines m
    LEFT JOIN plc_stations plc ON plc.line_id = m.lineId
    WHERE m.lineId = ?
    ORDER BY m.id ASC
  `, [id]);

  return {
    ...line,
    plc: line.plcId
      ? {
          id: line.plcId,
          name: line.plcName,
          protocol: line.plcProtocol,
          status: line.plcStatus,
          enabled: Boolean(line.plcEnabled),
          isDemo: Boolean(line.plcIsDemo),
          ipAddress: line.plcIp,
          port: line.plcPort,
        }
      : null,
    machines: machines.map((m) => ({
      ...m,
      plc: m.plcId
        ? {
            id: m.plcId,
            name: m.plcName,
            protocol: m.plcProtocol,
            status: m.plcStatus,
            enabled: Boolean(m.plcEnabled),
            isDemo: Boolean(m.plcIsDemo),
          }
        : null,
    })),
  };
}

export async function createProductionLine(data, user = null, ipAddress = '127.0.0.1') {
  const { name, code, targetOutput = 1200, actualOutput = 0, status = 'normal', safetyScore = 95 } = data;

  if (!name || !code) {
    throw Object.assign(new Error('Tên dây chuyền và mã code là bắt buộc.'), { statusCode: 400 });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [exist] = await conn.query('SELECT id FROM production_lines WHERE code = ?', [code]);
    if (exist.length > 0) {
      throw Object.assign(new Error(`Mã dây chuyền "${code}" đã tồn tại.`), { statusCode: 409, errorCode: 'DUPLICATE_LINE_CODE' });
    }

    const id = data.id || `LINE-${code.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`;
    await conn.query(`
      INSERT INTO production_lines (id, name, code, status, safetyScore, targetOutput, actualOutput, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [id, name, code, status, safetyScore, targetOutput, actualOutput]);

    await addAuditLog({
      action: 'CREATE_PRODUCTION_LINE',
      target: id,
      details: `Tạo dây chuyền mới: ${name} (${code})`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getProductionLineById(id);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function updateProductionLine(id, updates, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [existing] = await conn.query('SELECT * FROM production_lines WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy dây chuyền với ID: ${id}`), { statusCode: 404 });
    }

    if (updates.code && updates.code !== existing[0].code) {
      const [dup] = await conn.query('SELECT id FROM production_lines WHERE code = ? AND id != ?', [updates.code, id]);
      if (dup.length > 0) {
        throw Object.assign(new Error(`Mã dây chuyền "${updates.code}" đã được sử dụng.`), { statusCode: 409 });
      }
    }

    const fields = [];
    const values = [];
    const allowed = ['name', 'code', 'status', 'safetyScore', 'targetOutput', 'actualOutput'];
    for (const f of allowed) {
      if (updates[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(updates[f]);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      await conn.query(`UPDATE production_lines SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    await addAuditLog({
      action: 'UPDATE_PRODUCTION_LINE',
      target: id,
      details: `Cập nhật dây chuyền: ${updates.name || existing[0].name}`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getProductionLineById(id);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function archiveProductionLine(id, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [existing] = await conn.query('SELECT * FROM production_lines WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy dây chuyền: ${id}`), { statusCode: 404 });
    }

    await conn.query('UPDATE production_lines SET status = "ARCHIVED" WHERE id = ?', [id]);

    await addAuditLog({
      action: 'ARCHIVE_PRODUCTION_LINE',
      target: id,
      details: `Lưu trữ / Dừng vận hành dây chuyền: ${existing[0].name} (${id})`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return { success: true, id, status: 'ARCHIVED' };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

// =========================================================================
// CÁC THAO TÁC TRÊN MACHINES (MÁY MÓC / THIẾT BỊ)
// =========================================================================

export async function getMachines(filters = {}) {
  let query = `
    SELECT 
      m.id, m.lineId, p.name AS lineName, m.name, m.code, m.type, m.status, 
      COALESCE(m.management_status, 'active') AS managementStatus,
      m.location, m.description,
      m.healthScore, m.uptimeHours, m.qrCodeUrl, m.createdAt,
      plc.id AS plcId, plc.name AS plcName, plc.protocol AS plcProtocol, plc.connection_status AS plcStatus, plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo,
      COUNT(mm.id) AS mappingCount
    FROM machines m
    LEFT JOIN production_lines p ON m.lineId = p.id
    LEFT JOIN plc_stations plc ON (plc.line_id = m.lineId OR (plc.line_id IS NULL AND plc.machine_id = m.id))
    LEFT JOIN metric_mappings mm ON mm.machine_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.lineId && filters.lineId !== 'all') {
    query += ' AND m.lineId = ?';
    params.push(filters.lineId);
  }

  if (filters.status && filters.status !== 'all') {
    query += ' AND m.status = ?';
    params.push(filters.status);
  }

  if (filters.type && filters.type !== 'all') {
    query += ' AND m.type = ?';
    params.push(filters.type);
  }

  if (filters.search && filters.search.trim()) {
    const s = `%${filters.search.trim()}%`;
    query += ' AND (m.name LIKE ? OR m.code LIKE ? OR m.id LIKE ?)';
    params.push(s, s, s);
  }

  query += ' GROUP BY m.id, plc.id ORDER BY m.lineId ASC, m.id ASC';
  const [rows] = await pool.query(query, params);

  return rows.map((r) => ({
    id: r.id,
    lineId: r.lineId,
    lineName: r.lineName,
    name: r.name,
    code: r.code,
    type: r.type,
    status: r.status,
    managementStatus: r.managementStatus || 'active',
    location: r.location || null,
    description: r.description || null,
    healthScore: r.healthScore,
    uptimeHours: r.uptimeHours,
    qrCodeUrl: r.qrCodeUrl,
    createdAt: r.createdAt,
    mappingCount: Number(r.mappingCount || 0),
    plc: r.plcId
      ? {
          id: r.plcId,
          name: r.plcName,
          protocol: r.plcProtocol,
          status: r.plcStatus,
          enabled: Boolean(r.plcEnabled),
          isDemo: Boolean(r.plcIsDemo),
        }
      : null,
  }));
}

export async function getMachineById(id) {
  const [rows] = await pool.query(`
    SELECT 
      m.*, p.name AS lineName,
      COALESCE(m.management_status, 'active') AS managementStatus,
      plc.id AS plcId, plc.name AS plcName, plc.protocol AS plcProtocol, plc.ipAddress AS plcIp, plc.port AS plcPort,
      plc.connection_status AS plcStatus, plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo
    FROM machines m
    LEFT JOIN production_lines p ON m.lineId = p.id
    LEFT JOIN plc_stations plc ON (plc.line_id = m.lineId OR (plc.line_id IS NULL AND plc.machine_id = m.id))
    WHERE m.id = ?
  `, [id]);

  if (rows.length === 0) return null;
  const r = rows[0];

  const [mappings] = await pool.query(`
    SELECT mm.*, mc.code AS metricCode, mc.name AS metricName, mc.unit, mc.category
    FROM metric_mappings mm
    LEFT JOIN metric_catalog mc ON mm.metric_id = mc.id
    WHERE mm.machine_id = ?
    ORDER BY mm.id ASC
  `, [id]);

  return {
    id: r.id,
    lineId: r.lineId,
    lineName: r.lineName,
    name: r.name,
    code: r.code,
    type: r.type,
    status: r.status,
    managementStatus: r.managementStatus || 'active',
    location: r.location || null,
    description: r.description || null,
    healthScore: r.healthScore,
    uptimeHours: r.uptimeHours,
    qrCodeUrl: r.qrCodeUrl,
    createdAt: r.createdAt,
    plcId: r.plcId || null,
    plcName: r.plcName || null,
    plcProtocol: r.plcProtocol || null,
    plcStatus: r.plcStatus || null,
    plc: r.plcId
      ? {
          id: r.plcId,
          name: r.plcName,
          protocol: r.plcProtocol,
          ipAddress: r.plcIp,
          port: r.plcPort,
          status: r.plcStatus,
          enabled: Boolean(r.plcEnabled),
          isDemo: Boolean(r.plcIsDemo),
        }
      : null,
    mappings,
  };
}

export async function createMachine(data, user = null, ipAddress = '127.0.0.1') {
  const { lineId, name, code, type = 'general', status = 'no_data', managementStatus = 'active', location = null, description = null, healthScore = null, uptimeHours = 0, qrCodeUrl = null } = data;

  if (!lineId || !name || !code) {
    throw Object.assign(new Error('lineId, name và code là bắt buộc.'), { statusCode: 400 });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [line] = await conn.query('SELECT id FROM production_lines WHERE id = ?', [lineId]);
    if (line.length === 0) {
      throw Object.assign(new Error(`Dây chuyền ${lineId} không tồn tại.`), { statusCode: 400 });
    }

    const [exist] = await conn.query('SELECT id FROM machines WHERE code = ?', [code]);
    if (exist.length > 0) {
      throw Object.assign(new Error(`Mã máy "${code}" đã tồn tại trên hệ thống.`), { statusCode: 409, errorCode: 'DUPLICATE_MACHINE_CODE' });
    }

    const id = data.id || `MCH-${code.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`;
    const [existId] = await conn.query('SELECT id FROM machines WHERE id = ?', [id]);
    if (existId.length > 0) {
      throw Object.assign(new Error(`Mã định danh kỹ thuật "${id}" đã tồn tại. Vui lòng chọn mã máy khác.`), { statusCode: 409, errorCode: 'DUPLICATE_MACHINE_ID' });
    }

    await conn.query(`
      INSERT INTO machines (id, lineId, name, code, type, status, management_status, location, description, healthScore, uptimeHours, qrCodeUrl, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [id, lineId, name, code, type, status, managementStatus, location, description, healthScore, uptimeHours, qrCodeUrl]);

    await addAuditLog({
      action: 'CREATE_MACHINE',
      target: id,
      details: `Thêm máy mới: ${name} (${code}) vào dây chuyền ${lineId}. Loại: ${type || 'general'}. Quản lý: ${managementStatus}. Giám sát: ${status}${location ? `. Vị trí: ${location}` : ''}`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getMachineById(id);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function updateMachine(id, updates, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [existing] = await conn.query('SELECT * FROM machines WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy máy với ID: ${id}`), { statusCode: 404 });
    }

    if (updates.lineId && updates.lineId !== existing[0].lineId) {
      const [line] = await conn.query('SELECT id FROM production_lines WHERE id = ?', [updates.lineId]);
      if (line.length === 0) {
        throw Object.assign(new Error(`Dây chuyền ${updates.lineId} không tồn tại.`), { statusCode: 400 });
      }
    }

    if (updates.code && updates.code !== existing[0].code) {
      const [dup] = await conn.query('SELECT id FROM machines WHERE code = ? AND id != ?', [updates.code, id]);
      if (dup.length > 0) {
        throw Object.assign(new Error(`Mã máy "${updates.code}" đã được sử dụng.`), { statusCode: 409 });
      }
    }

    // Ánh xạ camelCase sang snake_case cho cột CSDL
    if (updates.managementStatus !== undefined && updates.management_status === undefined) {
      updates.management_status = updates.managementStatus;
    }
    if (updates.healthScore !== undefined && updates.health_score === undefined) {
      updates.health_score = updates.healthScore;
    }
    if (updates.uptimeHours !== undefined && updates.uptime_hours === undefined) {
      updates.uptime_hours = updates.uptimeHours;
    }
    if (updates.qrCodeUrl !== undefined && updates.qr_code_url === undefined) {
      updates.qr_code_url = updates.qrCodeUrl;
    }

    const fields = [];
    const values = [];
    const allowed = ['name', 'type', 'status', 'management_status', 'location', 'description', 'health_score', 'uptime_hours', 'qr_code_url'];
    for (const f of allowed) {
      if (updates[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(updates[f]);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      await conn.query(`UPDATE machines SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    await addAuditLog({
      action: 'UPDATE_MACHINE',
      target: id,
      details: `Cập nhật thông tin máy: ${updates.name || existing[0].name}${updates.location ? ` [Vị trí: ${updates.location}]` : ''}`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getMachineById(id);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function archiveMachine(id, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [existing] = await conn.query('SELECT * FROM machines WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy máy: ${id}`), { statusCode: 404 });
    }

    await conn.query('UPDATE machines SET status = "ARCHIVED" WHERE id = ?', [id]);

    await addAuditLog({
      action: 'ARCHIVE_MACHINE',
      target: id,
      details: `Lưu trữ / Dừng hoạt động máy: ${existing[0].name} (${id})`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return { success: true, id, status: 'ARCHIVED' };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

// =========================================================================
// QUY TRÌNH TRANSACTION GÁN, CHUYỂN GIAO & GỠ PLC AN TOÀN TUYỆT ĐỐI
// =========================================================================

// =========================================================================
// QUY TRÌNH TRANSACTION GÁN, CHUYỂN GIAO & GỠ PLC CẤP DÂY CHUYỀN (LINE-LEVEL)
// =========================================================================

export async function assignPLCToLine(destLineId, plcId, options = {}, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Khóa và kiểm tra Dây chuyền đích
    const [lRows] = await conn.query('SELECT * FROM production_lines WHERE id = ? FOR UPDATE', [destLineId]);
    if (lRows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy dây chuyền với ID: ${destLineId}`), { statusCode: 404 });
    }
    const destLine = lRows[0];

    // 2. Khóa và kiểm tra Trạm PLC mục tiêu
    const [pRows] = await conn.query('SELECT * FROM plc_stations WHERE id = ? FOR UPDATE', [plcId]);
    if (pRows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy trạm PLC với ID: ${plcId}`), { statusCode: 404 });
    }
    const targetPLC = pRows[0];

    // 3. Xử lý IDEMPOTENT: Nếu PLC đã gắn đúng vào dây chuyền đích
    if (targetPLC.line_id === destLineId) {
      await conn.commit();
      conn.release();
      return {
        success: true,
        idempotent: true,
        message: 'PLC_ALREADY_ASSIGNED_TO_DESTINATION_LINE',
        line: destLine,
        plc: targetPLC,
      };
    }

    // 4. Kiểm tra tiêu chuẩn kỹ thuật: bảo vệ PLC Demo và trạng thái kích hoạt
    if (targetPLC.is_demo === 1 || targetPLC.is_demo === true) {
      throw Object.assign(new Error('Không được phép gán trạm PLC Demo cho dây chuyền sản xuất.'), {
        statusCode: 422,
        errorCode: 'CANNOT_ASSIGN_DEMO_PLC',
      });
    }

    if (targetPLC.enabled === 0 || targetPLC.enabled === false) {
      throw Object.assign(new Error('Trạm PLC đang bị vô hiệu hóa, không được phép gán vận hành.'), {
        statusCode: 422,
        errorCode: 'CANNOT_ASSIGN_DISABLED_PLC',
      });
    }

    // 5. Kiểm tra Dây chuyền đích hiện tại có đang gắn PLC khác không?
    const [curPlcRows] = await conn.query('SELECT * FROM plc_stations WHERE line_id = ? AND id != ? FOR UPDATE', [destLineId, plcId]);
    const currentDestPLC = curPlcRows[0] || null;

    // 6. Kiểm tra Trạm PLC mục tiêu hiện có đang thuộc dây chuyền khác không?
    const oldLineId = targetPLC.line_id;
    let oldLine = null;
    if (oldLineId && oldLineId !== destLineId) {
      const [oldLRows] = await conn.query('SELECT * FROM production_lines WHERE id = ? FOR UPDATE', [oldLineId]);
      oldLine = oldLRows[0] || null;
    }

    const needsDestReplace = Boolean(currentDestPLC && !options.confirmDestReplace);
    const needsSourceTransfer = Boolean(oldLineId && oldLineId !== destLineId && !options.confirmSourceTransfer);

    if (needsDestReplace || needsSourceTransfer) {
      if (needsDestReplace && needsSourceTransfer) {
        throw Object.assign(
          new Error(`Yêu cầu xác nhận đồng thời cả hai: Dây chuyền đích (${destLine.name}) đang có PLC (${currentDestPLC.name}) cần thay thế (confirmDestReplace: true) VÀ Trạm PLC (${targetPLC.name}) đang thuộc dây chuyền khác (${oldLine?.name || oldLineId}) cần chuyển giao (confirmSourceTransfer: true).`),
          {
            statusCode: 409,
            errorCode: 'DUAL_CONFIRMATION_REQUIRED',
            currentPlcId: currentDestPLC.id,
            currentPlcName: currentDestPLC.name,
            sourceLineId: oldLineId,
            sourceLineName: oldLine?.name,
          }
        );
      } else if (needsDestReplace) {
        throw Object.assign(
          new Error(`Dây chuyền đích (${destLine.name}) hiện đã có trạm PLC (${currentDestPLC.name}) gắn kèm. Cần xác nhận thay thế (confirmDestReplace: true).`),
          {
            statusCode: 409,
            errorCode: 'DEST_LINE_HAS_PLC',
            currentPlcId: currentDestPLC.id,
            currentPlcName: currentDestPLC.name,
          }
        );
      } else {
        throw Object.assign(
          new Error(`Trạm PLC (${targetPLC.name}) hiện đang thuộc về dây chuyền ${oldLine ? oldLine.name : oldLineId}. Cần xác nhận chuyển giao (confirmSourceTransfer: true).`),
          {
            statusCode: 409,
            errorCode: 'PLC_BELONGS_TO_ANOTHER_LINE',
            sourceLineId: oldLineId,
            sourceLineName: oldLine?.name,
          }
        );
      }
    }

    // =========================================================================
    // 7. THỰC THI THAY ĐỔI DML TRONG TRANSACTION
    // =========================================================================

    // 7.1. Nếu dây chuyền đích có PLC cũ: gỡ bỏ và ngắt monitoring trên các mapping cũ của các máy thuộc line
    if (currentDestPLC) {
      await conn.query('UPDATE plc_stations SET line_id = NULL WHERE id = ?', [currentDestPLC.id]);
      await conn.query(`
        UPDATE metric_mappings 
        SET plc_id = NULL, monitoring_enabled = 0, status = 'NOT_CONFIGURED' 
        WHERE plc_id = ? AND machine_id IN (SELECT id FROM machines WHERE lineId = ?)
      `, [currentDestPLC.id, destLineId]);
    }

    // 7.2. Nếu PLC mục tiêu thuộc dây chuyền cũ: gỡ bỏ và ngắt monitoring trên các mapping của dây chuyền cũ
    if (oldLineId && oldLineId !== destLineId) {
      await conn.query('UPDATE plc_stations SET line_id = NULL WHERE id = ?', [plcId]);
      await conn.query(`
        UPDATE metric_mappings 
        SET plc_id = NULL, monitoring_enabled = 0, status = 'NOT_CONFIGURED' 
        WHERE plc_id = ? AND machine_id IN (SELECT id FROM machines WHERE lineId = ?)
      `, [plcId, oldLineId]);
    }

    // 7.3. Gán PLC mục tiêu vào dây chuyền đích
    await conn.query('UPDATE plc_stations SET line_id = ? WHERE id = ?', [destLineId, plcId]);

    // 8. Ghi Audit Log trong cùng Transaction
    const auditDetails = `Gán trạm PLC ${targetPLC.name} (${plcId}) vào dây chuyền ${destLine.name} (${destLineId})` +
      (oldLineId ? ` [Chuyển từ dây chuyền: ${oldLine?.name || oldLineId}]` : '') +
      (currentDestPLC ? ` [Thay thế PLC cũ: ${currentDestPLC.name}]` : '');

    await addAuditLog({
      action: 'ASSIGN_PLC_TO_LINE',
      target: plcId,
      details: auditDetails,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();

    return {
      success: true,
      message: 'ASSIGN_PLC_TO_LINE_SUCCESS',
      lineId: destLineId,
      plcId,
      transferredFromLine: oldLineId || null,
      replacedPlc: currentDestPLC?.id || null,
    };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function unassignPLCFromLine(lineId, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [lRows] = await conn.query('SELECT * FROM production_lines WHERE id = ? FOR UPDATE', [lineId]);
    if (lRows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy dây chuyền với ID: ${lineId}`), { statusCode: 404 });
    }
    const line = lRows[0];

    const [pRows] = await conn.query('SELECT * FROM plc_stations WHERE line_id = ? FOR UPDATE', [lineId]);
    if (pRows.length === 0) {
      await conn.commit();
      conn.release();
      return {
        success: true,
        idempotent: true,
        message: 'NO_PLC_ASSIGNED_TO_LINE',
        lineId,
      };
    }
    const assignedPLC = pRows[0];

    // 1. Gỡ liên kết PLC khỏi dây chuyền
    await conn.query('UPDATE plc_stations SET line_id = NULL WHERE id = ?', [assignedPLC.id]);

    // 2. Vô hiệu hóa monitoring và gỡ plc_id trên toàn bộ mappings của các máy thuộc dây chuyền
    await conn.query(`
      UPDATE metric_mappings 
      SET plc_id = NULL, monitoring_enabled = 0, status = 'NOT_CONFIGURED' 
      WHERE machine_id IN (SELECT id FROM machines WHERE lineId = ?) AND plc_id = ?
    `, [lineId, assignedPLC.id]);

    // 3. Ghi Audit Log trong cùng Transaction
    await addAuditLog({
      action: 'UNASSIGN_PLC_FROM_LINE',
      target: assignedPLC.id,
      details: `Gỡ bỏ trạm PLC ${assignedPLC.name} (${assignedPLC.id}) khỏi dây chuyền ${line.name} (${lineId})`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();

    return {
      success: true,
      message: 'UNASSIGN_PLC_FROM_LINE_SUCCESS',
      lineId,
      unassignedPlcId: assignedPLC.id,
    };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

// Deprecated machine-level PLC assignment (vô hiệu hóa theo kiến trúc mới)
export async function assignPLCToMachine(destMachineId, plcId, options = {}, user = null, ipAddress = '127.0.0.1') {
  throw Object.assign(
    new Error('Chức năng gán PLC trực tiếp cho từng máy đã bị vô hiệu hóa theo kiến trúc mới (1 Dây chuyền gắn tối đa 1 PLC). Vui lòng sử dụng API cấp Dây chuyền: /api/lines/:id/plc.'),
    { statusCode: 400, errorCode: 'DEPRECATED_MACHINE_PLC_ASSIGNMENT' }
  );
}

export async function unassignPLCFromMachine(machineId, user = null, ipAddress = '127.0.0.1') {
  throw Object.assign(
    new Error('Chức năng gỡ PLC khỏi từng máy đã bị vô hiệu hóa theo kiến trúc mới (1 Dây chuyền gắn tối đa 1 PLC). Vui lòng sử dụng API cấp Dây chuyền: /api/lines/:id/plc.'),
    { statusCode: 400, errorCode: 'DEPRECATED_MACHINE_PLC_ASSIGNMENT' }
  );
}

// =========================================================================
// GIAI ĐOẠN 2 - BƯỚC 2C: METRIC MAPPINGS, THRESHOLDS & COLLECTION SCHEDULES
// =========================================================================

export function isValidCronExpression(cron) {
  if (!cron || typeof cron !== 'string') return false;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const fieldRegex = /^(\*|[0-9]+|\*\/[0-9]+|[0-9]+-[0-9]+|[0-9]+(,[0-9]+)*)$/;
  return parts.every((p) => fieldRegex.test(p));
}

export async function getMetricMappings(filters = {}) {
  let query = `
    SELECT 
      mm.*,
      m.name AS machineName, m.code AS machineCode, m.lineId,
      p.name AS lineName,
      plc.name AS plcName, plc.connection_status AS plcStatus, plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo,
      mc.code AS metricCode, mc.name AS metricName, mc.category AS metricCategory, mc.unit, mc.dataType, mc.validMin, mc.validMax,
      mt.id AS thresholdId, mt.warning_min, mt.warning_max, mt.critical_min, mt.critical_max, mt.action_plan,
      cs.id AS scheduleId, cs.frequency_type, cs.interval_seconds, cs.cron_expression, cs.is_active AS scheduleIsActive
    FROM metric_mappings mm
    LEFT JOIN machines m ON mm.machine_id = m.id
    LEFT JOIN production_lines p ON m.lineId = p.id
    LEFT JOIN plc_stations plc ON mm.plc_id = plc.id
    LEFT JOIN metric_catalog mc ON mm.metric_id = mc.id
    LEFT JOIN metric_thresholds mt ON mt.mapping_id = mm.id
    LEFT JOIN collection_schedules cs ON cs.mapping_id = mm.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.machineId && filters.machineId !== 'all') {
    query += ' AND mm.machine_id = ?';
    params.push(filters.machineId);
  }

  if (filters.plcId && filters.plcId !== 'all') {
    query += ' AND mm.plc_id = ?';
    params.push(filters.plcId);
  }

  if (filters.metricId && filters.metricId !== 'all') {
    query += ' AND mm.metric_id = ?';
    params.push(filters.metricId);
  }

  if (filters.status && filters.status !== 'all') {
    query += ' AND mm.status = ?';
    params.push(filters.status);
  }

  if (filters.monitoring_enabled !== undefined && filters.monitoring_enabled !== 'all') {
    query += ' AND mm.monitoring_enabled = ?';
    params.push(filters.monitoring_enabled === 'true' || filters.monitoring_enabled === '1' ? 1 : 0);
  }

  if (filters.search && filters.search.trim()) {
    const s = `%${filters.search.trim()}%`;
    query += ' AND (mm.mapping_code LIKE ? OR mm.channel_name LIKE ? OR mm.plc_register LIKE ?)';
    params.push(s, s, s);
  }

  query += ' ORDER BY mm.machine_id ASC, mm.id ASC';
  const [rows] = await pool.query(query, params);

  return rows.map((r) => ({
    id: r.id,
    machine_id: r.machine_id,
    machineName: r.machineName,
    machineCode: r.machineCode,
    lineId: r.lineId,
    lineName: r.lineName,
    plc_id: r.plc_id,
    plcName: r.plcName,
    plcStatus: r.plcStatus,
    plcEnabled: r.plcEnabled !== null ? Boolean(r.plcEnabled) : null,
    plcIsDemo: r.plcIsDemo !== null ? Boolean(r.plcIsDemo) : null,
    metric_id: r.metric_id,
    metricCode: r.metricCode,
    metricName: r.metricName,
    metricCategory: r.metricCategory,
    unit: r.unit,
    dataType: r.dataType,
    validMin: r.validMin !== null ? Number(r.validMin) : null,
    validMax: r.validMax !== null ? Number(r.validMax) : null,
    mapping_code: r.mapping_code,
    channel_name: r.channel_name,
    plc_register: r.plc_register,
    scale_factor: Number(r.scale_factor || 1),
    sampling_rate_ms: Number(r.sampling_rate_ms || 1000),
    monitoring_enabled: Boolean(r.monitoring_enabled),
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    thresholds: r.thresholdId
      ? {
          id: r.thresholdId,
          warning_min: r.warning_min !== null ? Number(r.warning_min) : null,
          warning_max: r.warning_max !== null ? Number(r.warning_max) : null,
          critical_min: r.critical_min !== null ? Number(r.critical_min) : null,
          critical_max: r.critical_max !== null ? Number(r.critical_max) : null,
          action_plan: r.action_plan,
        }
      : null,
    schedule: r.scheduleId
      ? {
          id: r.scheduleId,
          frequency_type: r.frequency_type,
          interval_seconds: r.interval_seconds !== null ? Number(r.interval_seconds) : null,
          cron_expression: r.cron_expression,
          is_active: Boolean(r.scheduleIsActive),
        }
      : null,
  }));
}

export async function getMetricMappingById(id) {
  const [rows] = await pool.query(`
    SELECT 
      mm.*,
      m.name AS machineName, m.code AS machineCode, m.lineId,
      p.name AS lineName,
      plc.name AS plcName, plc.connection_status AS plcStatus, plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo,
      mc.code AS metricCode, mc.name AS metricName, mc.category AS metricCategory, mc.unit, mc.dataType, mc.validMin, mc.validMax
    FROM metric_mappings mm
    LEFT JOIN machines m ON mm.machine_id = m.id
    LEFT JOIN production_lines p ON m.lineId = p.id
    LEFT JOIN plc_stations plc ON mm.plc_id = plc.id
    LEFT JOIN metric_catalog mc ON mm.metric_id = mc.id
    WHERE mm.id = ?
  `, [id]);

  if (rows.length === 0) return null;
  const r = rows[0];

  // Lấy Thresholds (nếu có)
  const [thresholdRows] = await pool.query('SELECT * FROM metric_thresholds WHERE mapping_id = ?', [id]);
  const thresholds = thresholdRows.length > 0 ? {
    id: thresholdRows[0].id,
    warning_min: thresholdRows[0].warning_min !== null ? Number(thresholdRows[0].warning_min) : null,
    warning_max: thresholdRows[0].warning_max !== null ? Number(thresholdRows[0].warning_max) : null,
    critical_min: thresholdRows[0].critical_min !== null ? Number(thresholdRows[0].critical_min) : null,
    critical_max: thresholdRows[0].critical_max !== null ? Number(thresholdRows[0].critical_max) : null,
    action_plan: thresholdRows[0].action_plan,
  } : null;

  // Lấy Schedule (nếu có)
  const [schedRows] = await pool.query('SELECT * FROM collection_schedules WHERE mapping_id = ?', [id]);
  const schedule = schedRows.length > 0 ? {
    id: schedRows[0].id,
    frequency_type: schedRows[0].frequency_type,
    interval_seconds: schedRows[0].interval_seconds !== null ? Number(schedRows[0].interval_seconds) : null,
    cron_expression: schedRows[0].cron_expression,
    is_active: Boolean(schedRows[0].is_active),
  } : null;

  return {
    id: r.id,
    machine_id: r.machine_id,
    machineName: r.machineName,
    machineCode: r.machineCode,
    lineId: r.lineId,
    lineName: r.lineName,
    plc_id: r.plc_id,
    plcName: r.plcName,
    plcStatus: r.plcStatus,
    plcEnabled: r.plcEnabled !== null ? Boolean(r.plcEnabled) : null,
    plcIsDemo: r.plcIsDemo !== null ? Boolean(r.plcIsDemo) : null,
    metric_id: r.metric_id,
    metricCode: r.metricCode,
    metricName: r.metricName,
    metricCategory: r.metricCategory,
    unit: r.unit,
    dataType: r.dataType,
    validMin: r.validMin !== null ? Number(r.validMin) : null,
    validMax: r.validMax !== null ? Number(r.validMax) : null,
    mapping_code: r.mapping_code,
    channel_name: r.channel_name,
    plc_register: r.plc_register,
    scale_factor: Number(r.scale_factor || 1),
    sampling_rate_ms: Number(r.sampling_rate_ms || 1000),
    monitoring_enabled: Boolean(r.monitoring_enabled),
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    thresholds,
    schedule,
  };
}

export async function createMetricMapping(data, user = null, ipAddress = '127.0.0.1') {
  const { machine_id, metric_id, mapping_code, channel_name, plc_id = null, plc_register = null, scale_factor = 1.0, sampling_rate_ms = 1000 } = data;

  if (!machine_id || !metric_id || !mapping_code || !channel_name) {
    throw Object.assign(new Error('machine_id, metric_id, mapping_code và channel_name là bắt buộc.'), { statusCode: 400 });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Kiểm tra máy tồn tại
    const [mRows] = await conn.query('SELECT id, name, lineId FROM machines WHERE id = ? FOR UPDATE', [machine_id]);
    if (mRows.length === 0) {
      throw Object.assign(new Error(`Máy đích không tồn tại: ${machine_id}`), { statusCode: 400 });
    }

    // 2. Kiểm tra metric_catalog tồn tại
    const [mcRows] = await conn.query('SELECT id, name, code FROM metric_catalog WHERE id = ?', [metric_id]);
    if (mcRows.length === 0) {
      throw Object.assign(new Error(`Metric catalog không tồn tại: ${metric_id}`), { statusCode: 400 });
    }

    // 3. Kiểm tra trùng lặp mapping_code
    const [exist] = await conn.query('SELECT id FROM metric_mappings WHERE mapping_code = ?', [mapping_code]);
    if (exist.length > 0) {
      throw Object.assign(new Error(`Mã mapping_code "${mapping_code}" đã tồn tại.`), {
        statusCode: 409,
        errorCode: 'DUPLICATE_MAPPING_CODE',
      });
    }

    // 4. Nếu truyền plc_id, kiểm tra PLC phải thuộc đúng dây chuyền của máy đích (hoặc gắn máy di sản). Nếu không truyền, tự động kế thừa PLC của dây chuyền.
    let resolvedPlcId = plc_id || null;
    if (resolvedPlcId) {
      const [plcRows] = await conn.query('SELECT id, line_id, machine_id, name, is_demo, enabled FROM plc_stations WHERE id = ? FOR UPDATE', [resolvedPlcId]);
      if (plcRows.length === 0) {
        throw Object.assign(new Error(`Trạm PLC không tồn tại: ${resolvedPlcId}`), { statusCode: 400 });
      }
      const plcMatchesLine = (plcRows[0].line_id && plcRows[0].line_id === mRows[0].lineId) ||
        (!plcRows[0].line_id && plcRows[0].machine_id === mRows[0].id);
      if (!plcMatchesLine) {
        throw Object.assign(
          new Error(`Trạm PLC (${plcRows[0].name}) không thuộc về dây chuyền của máy đích (${mRows[0].name}). Không được phép gán mapping chéo dây chuyền.`),
          { statusCode: 422, errorCode: 'PLC_LINE_MISMATCH' }
        );
      }
    } else if (mRows[0].lineId) {
      const [linePlcs] = await conn.query('SELECT id FROM plc_stations WHERE line_id = ? LIMIT 1', [mRows[0].lineId]);
      if (linePlcs.length > 0) {
        resolvedPlcId = linePlcs[0].id;
      }
    }

    // 5. Kiểm tra trùng lặp thông số trên cùng máy
    const [existMachineMetric] = await conn.query(
      'SELECT id FROM metric_mappings WHERE machine_id = ? AND metric_id = ?',
      [machine_id, metric_id]
    );
    if (existMachineMetric.length > 0) {
      throw Object.assign(new Error(`Thông số "${mcRows[0].name}" đã được gán cho thiết bị "${mRows[0].name}".`), {
        statusCode: 409,
        errorCode: 'DUPLICATE_MACHINE_METRIC',
      });
    }

    const initialStatus = data.status || 'ACTIVE';
    const initialMonitoring = data.monitoring_enabled !== undefined ? (data.monitoring_enabled ? 1 : 0) : 1;
    const initialDataSource = data.data_source_type || 'FILE_INGEST';
    const id = data.id || `MAP-${mapping_code.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase()}`.substring(0, 64);

    await conn.query(`
      INSERT INTO metric_mappings (
        id, machine_id, plc_id, metric_id, mapping_code, channel_name, plc_register,
        scale_factor, sampling_rate_ms, monitoring_enabled, status, data_source_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [id, machine_id, resolvedPlcId, metric_id, mapping_code, channel_name, plc_register, scale_factor, sampling_rate_ms, initialMonitoring, initialStatus, initialDataSource]);

    await addAuditLog({
      action: 'CREATE_METRIC_MAPPING',
      target: id,
      details: `Tạo Metric Mapping mới: ${channel_name} (${mapping_code}) cho máy ${mRows[0].name}`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getMetricMappingById(id);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function updateMetricMapping(id, updates, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [existing] = await conn.query('SELECT * FROM metric_mappings WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy Metric Mapping: ${id}`), { statusCode: 404 });
    }
    const current = existing[0];

    // 1. Kiểm tra thay đổi mapping_code -> BẢO VỆ LỊCH SỬ TELEMETRY
    if (updates.mapping_code && updates.mapping_code !== current.mapping_code) {
      // Kiểm tra xem mapping_code cũ đã được ghi nhận trong machine_telemetry_history chưa
      const [hist] = await conn.query('SELECT 1 FROM machine_telemetry_history WHERE metricId = ? LIMIT 1', [current.mapping_code]);
      if (hist.length > 0) {
        throw Object.assign(
          new Error(`Mã mapping_code "${current.mapping_code}" đã phát sinh dữ liệu lịch sử telemetry, không được phép thay đổi để bảo toàn liên kết.`),
          { statusCode: 409, errorCode: 'CANNOT_MODIFY_MAPPING_CODE_WITH_HISTORY' }
        );
      }

      // Kiểm tra trùng lặp với mapping khác
      const [dup] = await conn.query('SELECT id FROM metric_mappings WHERE mapping_code = ? AND id != ?', [updates.mapping_code, id]);
      if (dup.length > 0) {
        throw Object.assign(new Error(`Mã mapping_code "${updates.mapping_code}" đã được sử dụng.`), {
          statusCode: 409,
          errorCode: 'DUPLICATE_MAPPING_CODE',
        });
      }
    }

    // 2. Kiểm tra thay đổi plc_id
    if (updates.plc_id !== undefined && updates.plc_id !== current.plc_id) {
      if (updates.plc_id !== null) {
        const [plcRows] = await conn.query('SELECT id, line_id, machine_id, name FROM plc_stations WHERE id = ? FOR UPDATE', [updates.plc_id]);
        if (plcRows.length === 0) {
          throw Object.assign(new Error(`Trạm PLC không tồn tại: ${updates.plc_id}`), { statusCode: 400 });
        }
        const [mRows] = await conn.query('SELECT id, lineId, name FROM machines WHERE id = ?', [current.machine_id]);
        const plcMatchesLine = (plcRows[0].line_id && plcRows[0].line_id === mRows[0]?.lineId) ||
          (!plcRows[0].line_id && plcRows[0].machine_id === current.machine_id);
        if (!plcMatchesLine) {
          throw Object.assign(
            new Error(`Trạm PLC (${plcRows[0].name}) không thuộc về dây chuyền của máy chứa mapping này. Không được phép gán chéo dây chuyền.`),
            { statusCode: 422, errorCode: 'PLC_LINE_MISMATCH' }
          );
        }
      }
    }

    // 3. Nếu cấu hình phần cứng thay đổi (PLC hoặc thanh ghi) trong khi đang bật giám sát, bắt buộc ngắt giám sát an toàn
    let resetMonitoring = false;
    if (current.monitoring_enabled === 1) {
      if (
        (updates.plc_id !== undefined && updates.plc_id !== current.plc_id) ||
        (updates.plc_register !== undefined && updates.plc_register !== current.plc_register)
      ) {
        resetMonitoring = true;
      }
    }

    const fields = [];
    const values = [];
    const allowed = ['channel_name', 'mapping_code', 'plc_id', 'plc_register', 'scale_factor', 'sampling_rate_ms'];
    for (const f of allowed) {
      if (updates[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(updates[f]);
      }
    }

    if (resetMonitoring) {
      fields.push('monitoring_enabled = 0');
      fields.push('status = "NOT_CONFIGURED"');
    }

    fields.push('updated_at = NOW()');

    if (fields.length > 0) {
      values.push(id);
      await conn.query(`UPDATE metric_mappings SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    await addAuditLog({
      action: 'UPDATE_METRIC_MAPPING',
      target: id,
      details: `Cập nhật cấu hình Metric Mapping: ${updates.channel_name || current.channel_name} (${id})` +
        (resetMonitoring ? ' [Ngắt giám sát do thay đổi phần cứng/thanh ghi]' : ''),
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getMetricMappingById(id);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function deactivateMetricMapping(id, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [existing] = await conn.query('SELECT * FROM metric_mappings WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy Metric Mapping: ${id}`), { statusCode: 404 });
    }

    await conn.query('UPDATE metric_mappings SET status = "INACTIVE", monitoring_enabled = 0, updated_at = NOW() WHERE id = ?', [id]);

    await addAuditLog({
      action: 'DEACTIVATE_METRIC_MAPPING',
      target: id,
      details: `Ngừng hoạt động Metric Mapping: ${existing[0].channel_name} (${id}) - Bảo toàn lịch sử telemetry`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return { success: true, id, status: 'INACTIVE', monitoring_enabled: false };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function deleteMetricMapping(id, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [existing] = await conn.query('SELECT * FROM metric_mappings WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy Metric Mapping: ${id}`), { statusCode: 404 });
    }

    // Xóa collection_schedules và metric_thresholds con trước
    await conn.query('DELETE FROM collection_schedules WHERE mapping_id = ?', [id]);
    await conn.query('DELETE FROM metric_thresholds WHERE mapping_id = ?', [id]);
    await conn.query('DELETE FROM metric_mappings WHERE id = ?', [id]);

    await addAuditLog({
      action: 'DELETE_METRIC_MAPPING',
      target: id,
      details: `Gỡ bỏ Metric Mapping: ${existing[0].channel_name} (${id}) khỏi thiết bị ${existing[0].machine_id}`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return { success: true, id };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function syncMetricMachineAssignments(metricId, machineIds = [], user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [metricRows] = await conn.query('SELECT * FROM metric_catalog WHERE id = ?', [metricId]);
    if (metricRows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy metric: ${metricId}`), { statusCode: 404 });
    }
    const metric = metricRows[0];

    const [currentMappings] = await conn.query('SELECT id, machine_id FROM metric_mappings WHERE metric_id = ?', [metricId]);
    const currentMachineMap = new Map();
    currentMappings.forEach((m) => currentMachineMap.set(m.machine_id, m.id));

    const targetMachineIds = Array.isArray(machineIds) ? machineIds : [];

    // 1. Thêm mapping cho các máy mới được chọn
    for (const machineId of targetMachineIds) {
      if (!currentMachineMap.has(machineId)) {
        const [mRows] = await conn.query(`
          SELECT m.*, pl.id as line_id 
          FROM machines m 
          LEFT JOIN production_lines pl ON m.lineId = pl.id 
          WHERE m.id = ?
        `, [machineId]);

        if (mRows.length > 0) {
          const machine = mRows[0];
          let plcId = null;
          if (machine.line_id) {
            const [plcRows] = await conn.query('SELECT id FROM plc_stations WHERE line_id = ? LIMIT 1', [machine.line_id]);
            if (plcRows.length > 0) plcId = plcRows[0].id;
          }

          const rawMapId = `MAP-${machine.code || machine.id}-${metric.code}`.replace(/[^A-Za-z0-9_-]/g, '');
          const mappingId = rawMapId.length > 64 ? rawMapId.substring(0, 64) : rawMapId;
          const rawCode = `MTR-${machine.code || machine.id}-${metric.code}`.replace(/[^A-Za-z0-9_-]/g, '');
          const mappingCode = rawCode.length > 64 ? rawCode.substring(0, 64) : rawCode;
          const channelName = `${metric.name} - ${machine.name}`;

          await conn.query(`
            INSERT INTO metric_mappings (
              id, machine_id, plc_id, metric_id, mapping_code, channel_name, 
              sampling_rate_ms, monitoring_enabled, status, data_source_type, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1000, 1, 'ACTIVE', 'FILE_INGEST', NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
              status = 'ACTIVE', 
              monitoring_enabled = 1,
              updated_at = NOW()
          `, [mappingId, machineId, plcId, metricId, mappingCode, channelName]);
        }
      }
    }

    // 2. Gỡ mapping cho các máy bị bỏ chọn
    for (const [mId, mapId] of currentMachineMap.entries()) {
      if (!targetMachineIds.includes(mId)) {
        await conn.query('DELETE FROM collection_schedules WHERE mapping_id = ?', [mapId]);
        await conn.query('DELETE FROM metric_thresholds WHERE mapping_id = ?', [mapId]);
        await conn.query('DELETE FROM metric_mappings WHERE id = ?', [mapId]);
      }
    }

    await addAuditLog({
      action: 'SYNC_METRIC_MACHINE_ASSIGNMENTS',
      target: metricId,
      details: `Đồng bộ gán metric ${metric.code} vào ${targetMachineIds.length} thiết bị`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return { success: true, metricId, assignedMachineIds: targetMachineIds };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export async function toggleMetricMappingMonitoring(id, enable, user = null, ipAddress = '127.0.0.1') {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [mRows] = await conn.query(`
      SELECT mm.*, m.name AS machineName
      FROM metric_mappings mm
      LEFT JOIN machines m ON mm.machine_id = m.id
      WHERE mm.id = ? FOR UPDATE
    `, [id]);

    if (mRows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy Metric Mapping: ${id}`), { statusCode: 404 });
    }
    const mapping = mRows[0];

    if (enable === true || enable === 1 || enable === '1' || enable === 'true') {
      // 1. Kiểm tra Mapping phải có PLC
      if (!mapping.plc_id) {
        throw Object.assign(new Error('Chưa gán trạm PLC cho mapping, không thể kích hoạt giám sát.'), {
          statusCode: 422,
          errorCode: 'PLC_REQUIRED_FOR_MONITORING',
        });
      }

      // 2. Khóa và kiểm tra thông số PLC
      const [plcRows] = await conn.query('SELECT * FROM plc_stations WHERE id = ? FOR UPDATE', [mapping.plc_id]);
      if (plcRows.length === 0) {
        throw Object.assign(new Error('Trạm PLC liên kết không tồn tại.'), { statusCode: 404 });
      }
      const plc = plcRows[0];

      const [mRows] = await conn.query('SELECT id, lineId FROM machines WHERE id = ?', [mapping.machine_id]);
      const plcMatchesLine = (plc.line_id && plc.line_id === mRows[0]?.lineId) ||
        (!plc.line_id && plc.machine_id === mapping.machine_id);
      if (!plcMatchesLine) {
        throw Object.assign(new Error('Trạm PLC không thuộc về dây chuyền của máy chứa mapping này.'), {
          statusCode: 422,
          errorCode: 'PLC_LINE_MISMATCH',
        });
      }

      if (plc.is_demo === 1 || plc.is_demo === true) {
        throw Object.assign(new Error('Không được phép kích hoạt giám sát với trạm PLC Demo.'), {
          statusCode: 422,
          errorCode: 'CANNOT_MONITOR_DEMO_PLC',
        });
      }

      if (plc.enabled === 0 || plc.enabled === false) {
        throw Object.assign(new Error('Trạm PLC đang bị vô hiệu hóa, không thể kích hoạt giám sát.'), {
          statusCode: 422,
          errorCode: 'PLC_DISABLED',
        });
      }

      // 3. Kiểm tra thanh ghi PLC
      if (!mapping.plc_register || !mapping.plc_register.trim()) {
        throw Object.assign(new Error('Chưa cấu hình thanh ghi PLC (plc_register), không thể kích hoạt giám sát.'), {
          statusCode: 422,
          errorCode: 'PLC_REGISTER_REQUIRED',
        });
      }

      // Cập nhật trạng thái: BẬT GIÁM SÁT -> status trở thành ACTIVE
      await conn.query('UPDATE metric_mappings SET monitoring_enabled = 1, status = "ACTIVE", updated_at = NOW() WHERE id = ?', [id]);
    } else {
      // TẮT GIÁM SÁT -> status trở thành INACTIVE
      await conn.query('UPDATE metric_mappings SET monitoring_enabled = 0, status = "INACTIVE", updated_at = NOW() WHERE id = ?', [id]);
    }

    await addAuditLog({
      action: 'TOGGLE_MAPPING_MONITORING',
      target: id,
      details: `${enable ? 'Kích hoạt' : 'Tạm dừng'} giám sát cho mapping: ${mapping.channel_name} (${mapping.mapping_code})`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getMetricMappingById(id);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

// -------------------------------------------------------------------------
// NGƯỠNG CẢNH BÁO (METRIC THRESHOLDS)
// -------------------------------------------------------------------------

export async function getMetricThresholds(mappingId) {
  const [rows] = await pool.query('SELECT * FROM metric_thresholds WHERE mapping_id = ?', [mappingId]);
  if (rows.length > 1) {
    throw Object.assign(new Error(`Phát hiện bất thường: Có ${rows.length} bản ghi Threshold cho cùng mapping ${mappingId}.`), {
      statusCode: 409,
      errorCode: 'MULTIPLE_THRESHOLDS_DETECTED',
    });
  }
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.id,
    mapping_id: r.mapping_id,
    warning_min: r.warning_min !== null ? Number(r.warning_min) : null,
    warning_max: r.warning_max !== null ? Number(r.warning_max) : null,
    critical_min: r.critical_min !== null ? Number(r.critical_min) : null,
    critical_max: r.critical_max !== null ? Number(r.critical_max) : null,
    action_plan: r.action_plan,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function setMetricThresholds(mappingId, data, user = null, ipAddress = '127.0.0.1') {
  const { warning_min = null, warning_max = null, critical_min = null, critical_max = null, action_plan = null } = data;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Khóa dòng cha metric_mappings để ngăn chặn race condition duplicate threshold
    const [mRows] = await conn.query(`
      SELECT mm.*, mc.validMin, mc.validMax, mc.name AS metricName
      FROM metric_mappings mm
      LEFT JOIN metric_catalog mc ON mm.metric_id = mc.id
      WHERE mm.id = ? FOR UPDATE
    `, [mappingId]);

    if (mRows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy Metric Mapping: ${mappingId}`), { statusCode: 404 });
    }
    const mapping = mRows[0];

    const wMin = warning_min !== null && warning_min !== undefined ? Number(warning_min) : null;
    const wMax = warning_max !== null && warning_max !== undefined ? Number(warning_max) : null;
    const cMin = critical_min !== null && critical_min !== undefined ? Number(critical_min) : null;
    const cMax = critical_max !== null && critical_max !== undefined ? Number(critical_max) : null;

    // 2. Kiểm tra giới hạn vật lý theo metric_catalog (validMin / validMax)
    const validMin = mapping.validMin !== null ? Number(mapping.validMin) : null;
    const validMax = mapping.validMax !== null ? Number(mapping.validMax) : null;

    const allThresholds = [wMin, wMax, cMin, cMax].filter((v) => v !== null);
    if (allThresholds.length === 0) {
      throw Object.assign(new Error('Cần cung cấp ít nhất một giá trị ngưỡng cảnh báo (warning_min, warning_max, critical_min hoặc critical_max).'), {
        statusCode: 400,
        errorCode: 'AT_LEAST_ONE_THRESHOLD_REQUIRED',
      });
    }

    if (validMin !== null) {
      for (const val of allThresholds) {
        if (val < validMin) {
          throw Object.assign(new Error(`Giá trị ngưỡng (${val}) không được nhỏ hơn giới hạn vật lý validMin (${validMin}).`), {
            statusCode: 400,
            errorCode: 'THRESHOLD_BELOW_VALID_MIN',
          });
        }
      }
    }
    if (validMax !== null) {
      for (const val of allThresholds) {
        if (val > validMax) {
          throw Object.assign(new Error(`Giá trị ngưỡng (${val}) không được vượt quá giới hạn vật lý validMax (${validMax}).`), {
            statusCode: 400,
            errorCode: 'THRESHOLD_EXCEEDS_VALID_MAX',
          });
        }
      }
    }

    // 3. Kiểm tra tính nhất quán logic giữa các ngưỡng
    if (cMin !== null && wMin !== null && cMin > wMin) {
      throw Object.assign(new Error(`Ngưỡng critical_min (${cMin}) không được lớn hơn warning_min (${wMin}).`), {
        statusCode: 400,
        errorCode: 'INVALID_THRESHOLD_LOGIC',
      });
    }
    if (wMin !== null && wMax !== null && wMin > wMax) {
      throw Object.assign(new Error(`Ngưỡng warning_min (${wMin}) không được lớn hơn warning_max (${wMax}).`), {
        statusCode: 400,
        errorCode: 'INVALID_THRESHOLD_LOGIC',
      });
    }
    if (wMax !== null && cMax !== null && wMax > cMax) {
      throw Object.assign(new Error(`Ngưỡng warning_max (${wMax}) không được lớn hơn critical_max (${cMax}).`), {
        statusCode: 400,
        errorCode: 'INVALID_THRESHOLD_LOGIC',
      });
    }
    if (cMin !== null && cMax !== null && cMin > cMax) {
      throw Object.assign(new Error(`Ngưỡng critical_min (${cMin}) không được lớn hơn critical_max (${cMax}).`), {
        statusCode: 400,
        errorCode: 'INVALID_THRESHOLD_LOGIC',
      });
    }
    if (cMin !== null && wMax !== null && cMin > wMax) {
      throw Object.assign(new Error(`Ngưỡng critical_min (${cMin}) không được lớn hơn warning_max (${wMax}).`), {
        statusCode: 400,
        errorCode: 'INVALID_THRESHOLD_LOGIC',
      });
    }
    if (wMin !== null && cMax !== null && wMin > cMax) {
      throw Object.assign(new Error(`Ngưỡng warning_min (${wMin}) không được lớn hơn critical_max (${cMax}).`), {
        statusCode: 400,
        errorCode: 'INVALID_THRESHOLD_LOGIC',
      });
    }

    // 4. Kiểm tra sự tồn tại của Threshold hiện có
    const [existRows] = await conn.query('SELECT * FROM metric_thresholds WHERE mapping_id = ? FOR UPDATE', [mappingId]);
    if (existRows.length > 1) {
      throw Object.assign(new Error(`Phát hiện nhiều bản ghi Threshold bất thường cho cùng mapping ${mappingId}. Cần chuẩn hóa dữ liệu.`), {
        statusCode: 409,
        errorCode: 'MULTIPLE_THRESHOLDS_DETECTED',
      });
    }

    let thresholdId = '';
    if (existRows.length === 1) {
      thresholdId = existRows[0].id;
      await conn.query(`
        UPDATE metric_thresholds
        SET warning_min = ?, warning_max = ?, critical_min = ?, critical_max = ?, action_plan = ?, updated_at = NOW()
        WHERE id = ?
      `, [wMin, wMax, cMin, cMax, action_plan, thresholdId]);
    } else {
      thresholdId = data.id || `THR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await conn.query(`
        INSERT INTO metric_thresholds (id, mapping_id, warning_min, warning_max, critical_min, critical_max, action_plan, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [thresholdId, mappingId, wMin, wMax, cMin, cMax, action_plan]);
    }

    await addAuditLog({
      action: 'SET_METRIC_THRESHOLDS',
      target: thresholdId,
      details: `Thiết lập ngưỡng cảnh báo cho mapping ${mapping.channel_name} (${mappingId})`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getMetricThresholds(mappingId);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

// -------------------------------------------------------------------------
// LỊCH THU THẬP DỮ LIỆU (COLLECTION SCHEDULES)
// -------------------------------------------------------------------------

export async function getCollectionSchedule(mappingId) {
  const [rows] = await pool.query('SELECT * FROM collection_schedules WHERE mapping_id = ?', [mappingId]);
  if (rows.length > 1) {
    throw Object.assign(new Error(`Phát hiện bất thường: Có ${rows.length} bản ghi Schedule cho cùng mapping ${mappingId}.`), {
      statusCode: 409,
      errorCode: 'MULTIPLE_SCHEDULES_DETECTED',
    });
  }
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.id,
    mapping_id: r.mapping_id,
    frequency_type: r.frequency_type,
    interval_seconds: r.interval_seconds !== null ? Number(r.interval_seconds) : null,
    cron_expression: r.cron_expression,
    is_active: Boolean(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function setCollectionSchedule(mappingId, data, user = null, ipAddress = '127.0.0.1') {
  const { frequency_type = 'INTERVAL', interval_seconds = 1, cron_expression = null, is_active = true } = data;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Khóa dòng cha metric_mappings
    const [mRows] = await conn.query('SELECT * FROM metric_mappings WHERE id = ? FOR UPDATE', [mappingId]);
    if (mRows.length === 0) {
      throw Object.assign(new Error(`Không tìm thấy Metric Mapping: ${mappingId}`), { statusCode: 404 });
    }
    const mapping = mRows[0];

    // 2. Validate chiến lược lập lịch: Chọn rõ ràng INTERVAL hay CRON
    const normalizedType = String(frequency_type).toUpperCase();
    if (!['INTERVAL', 'CRON', 'CONTINUOUS'].includes(normalizedType)) {
      throw Object.assign(new Error('Loại chu kỳ frequency_type không hợp lệ. Chỉ chấp nhận INTERVAL, CRON hoặc CONTINUOUS.'), {
        statusCode: 400,
        errorCode: 'INVALID_FREQUENCY_TYPE',
      });
    }

    let finalInterval = null;
    let finalCron = null;

    if (normalizedType === 'INTERVAL') {
      const sec = Number(interval_seconds);
      if (!Number.isInteger(sec) || sec < 1) {
        throw Object.assign(new Error('Chu kỳ interval_seconds phải là số nguyên dương (>= 1 giây).'), {
          statusCode: 400,
          errorCode: 'INVALID_INTERVAL_SECONDS',
        });
      }
      finalInterval = sec;
      finalCron = null; // Xóa biểu thức cron nếu dùng interval
    } else if (normalizedType === 'CRON') {
      if (!cron_expression || !isValidCronExpression(cron_expression)) {
        throw Object.assign(new Error(`Biểu thức cron "${cron_expression}" không hợp lệ theo chuẩn 5 trường (* * * * *).`), {
          statusCode: 400,
          errorCode: 'INVALID_CRON_EXPRESSION',
        });
      }
      finalCron = cron_expression.trim();
      finalInterval = null;
    } else {
      // CONTINUOUS
      finalInterval = 1;
      finalCron = null;
    }

    // 3. Kiểm tra bản ghi Schedule hiện tại
    const [existRows] = await conn.query('SELECT * FROM collection_schedules WHERE mapping_id = ? FOR UPDATE', [mappingId]);
    if (existRows.length > 1) {
      throw Object.assign(new Error(`Phát hiện nhiều bản ghi Schedule bất thường cho mapping ${mappingId}. Cần chuẩn hóa dữ liệu.`), {
        statusCode: 409,
        errorCode: 'MULTIPLE_SCHEDULES_DETECTED',
      });
    }

    let scheduleId = '';
    const activeVal = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;

    if (existRows.length === 1) {
      scheduleId = existRows[0].id;
      await conn.query(`
        UPDATE collection_schedules
        SET frequency_type = ?, interval_seconds = ?, cron_expression = ?, is_active = ?, updated_at = NOW()
        WHERE id = ?
      `, [normalizedType, finalInterval, finalCron, activeVal, scheduleId]);
    } else {
      scheduleId = data.id || `SCH-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await conn.query(`
        INSERT INTO collection_schedules (id, mapping_id, frequency_type, interval_seconds, cron_expression, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [scheduleId, mappingId, normalizedType, finalInterval, finalCron, activeVal]);
    }

    await addAuditLog({
      action: 'SET_COLLECTION_SCHEDULE',
      target: scheduleId,
      details: `Cập nhật lịch thu thập cho mapping ${mapping.channel_name} (${mappingId}): Type=${normalizedType}`,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.fullName || user?.name,
      employeeId: user?.employeeId,
      ipAddress,
    }, conn);

    await conn.commit();
    conn.release();
    return getCollectionSchedule(mappingId);
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

export const mysqlDb = {
  initDatabase,
  closeDatabase,
  getPool,
  setPool,
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
  VALID_METRIC_CATEGORIES,
  VALID_METRIC_DATA_TYPES,
  getMetrics,
  getMetricSummary,
  getMetricById,
  getMetricByCode,
  createMetric,
  updateMetric,
  updateMetricStatus,
  deleteMetric,
  getMetricUsage,
  getProductionLines,
  getProductionLineById,
  createProductionLine,
  updateProductionLine,
  archiveProductionLine,
  getMachines,
  getMachineById,
  createMachine,
  updateMachine,
  archiveMachine,
  assignPLCToLine,
  unassignPLCFromLine,
  assignPLCToMachine,
  unassignPLCFromMachine,
  isValidCronExpression,
  getMetricMappings,
  getMetricMappingById,
  createMetricMapping,
  updateMetricMapping,
  deactivateMetricMapping,
  deleteMetricMapping,
  syncMetricMachineAssignments,
  toggleMetricMappingMonitoring,
  getMetricThresholds,
  setMetricThresholds,
  getCollectionSchedule,
  setCollectionSchedule,
};

export default mysqlDb;

