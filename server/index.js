/**
 * @file server/index.js
 * @description Máy chủ Backend Full-stack chuẩn Doanh nghiệp: Express REST API, JWT Authentication,
 * RBAC Authorization, Kết nối CSDL MySQL (denso_iot), Multer Avatar Upload,
 * và WebSocket Server truyền dữ liệu IoT thời gian thực.
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { mysqlDb } from './db-mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'denso-iot-enterprise-secret-key-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'denso-iot-refresh-secret-key-2026';

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ thư mục static tải lên ảnh đại diện / tài liệu
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// =========================================================================
// CẤU HÌNH MULTER UPLOAD ẢNH ĐẠI DIỆN
// =========================================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.png';
    const cleanName = `avatar-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, cleanName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg\+xml|svg/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowed.test(ext) || allowed.test(mime)) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận các tệp ảnh định dạng JPG, PNG, WEBP, SVG!'));
  },
});

const server = http.createServer(app);

// Khởi tạo WebSocket Server trên cùng HTTP Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('error', (err) => {
  console.error('[WSS Server Error]:', err.message);
});

// Hàm broadcast tới toàn bộ client đang kết nối
function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('[WS broadcast send error]:', err.message);
      }
    }
  });
}

// =========================================================================
// MIDDLEWARES XÁC THỰC BẢO MẬT JWT & PHÂN QUYỀN (RBAC)
// =========================================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

  if (!token) {
    return res.status(401).json({ message: 'Yêu cầu đăng nhập để truy cập tài nguyên.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Phiên làm việc hết hạn hoặc token không hợp lệ.' });
    }
    req.user = decoded;
    next();
  });
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = (req.user?.role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());
    if (!req.user || !normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        message: 'Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền: ' + allowedRoles.join(', '),
      });
    }
    next();
  };
}

// =========================================================================
// IN-MEMORY FALLBACK KHI MYSQL CHƯA SẴN SÀNG HOẶC AIVEN ĐANG TẮT
// =========================================================================
const fallbackUsers = [
  {
    id: 'usr-admin-01',
    employeeId: 'DNS-1001',
    fullName: 'Hoàng Minh Hải',
    email: 'admin@denso.com',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'ADMIN',
    assignedLineId: 'ALL',
    avatarUrl: '/uploads/avatars/default-admin.png',
    status: 'ACTIVE',
  },
  {
    id: 'usr-operator-01',
    employeeId: 'DNS-1024',
    fullName: 'Trần Quang Huy',
    email: 'user@denso.com',
    passwordHash: bcrypt.hashSync('user123', 10),
    role: 'OPERATOR',
    assignedLineId: 'LINE-01',
    avatarUrl: '/uploads/avatars/default-user.png',
    status: 'ACTIVE',
  },
  {
    id: 'usr-maint-01',
    employeeId: 'DNS-1088',
    fullName: 'Lê Văn Bách',
    email: 'tech@denso.com',
    passwordHash: bcrypt.hashSync('tech123', 10),
    role: 'MAINTENANCE',
    assignedLineId: 'LINE-02',
    avatarUrl: '/uploads/avatars/default-tech.png',
    status: 'ACTIVE',
  },
];

const fallbackPLCStations = [
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
];

// =========================================================================
// AUTHENTICATION APIS (MYSQL KÈM DỰ PHÒNG IN-MEMORY CHỐNG SẬP)
// =========================================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ email và mật khẩu.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = null;
    let isDbSuccess = false;

    // 1. Cố gắng xác thực với CSDL MySQL
    try {
      user = await mysqlDb.getUserByEmail(normalizedEmail);
      if (user) {
        isDbSuccess = true;
      }
    } catch (dbErr) {
      console.warn(`[Login Auth] CSDL MySQL không phản hồi: ${dbErr.message}. Chuyển sang xác thực bộ nhớ dự phòng.`);
    }

    // 2. Nếu MySQL chưa kết nối được hoặc không tìm thấy, kiểm tra tài khoản fallback
    if (!user) {
      const fallback = fallbackUsers.find((u) => u.email === normalizedEmail);
      if (fallback && bcrypt.compareSync(password, fallback.passwordHash)) {
        user = {
          id: fallback.id,
          employeeId: fallback.employeeId,
          fullName: fallback.fullName,
          email: fallback.email,
          role: fallback.role,
          assignedLineId: fallback.assignedLineId,
          avatarUrl: fallback.avatarUrl,
          status: fallback.status,
        };
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    // 3. Nếu lấy từ MySQL, kiểm tra mật khẩu đã hash trong DB
    if (isDbSuccess) {
      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
      }

      if (user.status && user.status.toUpperCase() === 'INACTIVE') {
        return res.status(403).json({ message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ Admin.' });
      }

      // Cập nhật lần đăng nhập cuối vào MySQL (nếu có lỗi ghi thì bỏ qua)
      try {
        await mysqlDb.updateUser(user.id, { lastLoginAt: new Date() });
        const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
        await mysqlDb.addAuditLog({
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName,
          employeeId: user.employeeId,
          action: 'LOGIN',
          target: 'SYSTEM_AUTH',
          details: `Đăng nhập thành công với vai trò ${user.role} (MySQL Verified)`,
          ipAddress,
        });
      } catch {}
    }

    const tokenPayload = {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      assignedLineId: user.assignedLineId,
      avatarUrl: user.avatarUrl,
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
    const refreshToken = jwt.sign(tokenPayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    const { password: _, passwordHash: __, ...safeUser } = user;
    res.json({
      message: isDbSuccess ? 'Đăng nhập thành công.' : 'Đăng nhập thành công (Chế độ Dự phòng An toàn).',
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Login Error]:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập: ' + err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await mysqlDb.getUserById(req.user.id);
    if (user) {
      const { password: _, ...safeUser } = user;
      return res.json({ user: safeUser });
    }
  } catch (err) {
    console.warn(`[GetMe] MySQL offline: ${err.message}. Sử dụng thông tin từ JWT Token.`);
  }

  // Fallback an toàn từ payload của JWT Token
  res.json({
    user: {
      id: req.user.id,
      employeeId: req.user.employeeId,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      assignedLineId: req.user.assignedLineId,
      avatarUrl: req.user.avatarUrl,
    },
  });
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'LOGOUT',
      target: 'SYSTEM_AUTH',
      details: 'Đăng xuất khỏi hệ thống',
      ipAddress,
    });
  } catch {}
  res.json({ message: 'Đăng xuất thành công.' });
});

// =========================================================================
// USER MANAGEMENT APIS (DÀNH CHO ADMIN)
// =========================================================================
app.get('/api/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await mysqlDb.getUsers();
    res.json({ users });
  } catch (err) {
    console.warn(`[GetUsers] MySQL offline: ${err.message}. Trả về danh sách dự phòng.`);
    res.json({ users: fallbackUsers.map(({ passwordHash, ...u }) => u) });
  }
});

app.post('/api/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { username, fullName, role, status, employeeId, email, password, assignedLineId, avatarUrl } = req.body;

    if (!fullName || (!username && !email)) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (Username, Họ tên).' });
    }

    const cleanUsername = (username || '').trim();
    const finalEmail = (email || (cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@denso.com`)).trim().toLowerCase();

    // Kiểm tra trùng lặp tài khoản hoặc email
    const existing = await mysqlDb.getUserByEmail(finalEmail);
    if (existing) {
      return res.status(400).json({ message: `Tài khoản hoặc email "${finalEmail}" đã tồn tại trong hệ thống MySQL.` });
    }

    // Tự động sinh mã nhân viên ngẫu nhiên nếu không truyền lên
    const finalEmployeeId = employeeId || `DNS-${Math.floor(1000 + Math.random() * 9000)}`;

    // Mật khẩu mặc định 123456
    const defaultPassword = password || '123456';

    const newUser = await mysqlDb.createUser({
      employeeId: finalEmployeeId,
      email: finalEmail,
      fullName: fullName.trim(),
      password: defaultPassword,
      role: (role || 'OPERATOR').toUpperCase(),
      status: (status || 'ACTIVE').toUpperCase(),
      assignedLineId: assignedLineId || 'ALL',
      avatarUrl: avatarUrl || null,
    });

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'CREATE_USER',
      target: newUser.email,
      details: `Tạo người dùng mới trong MySQL: ${newUser.fullName} (${newUser.employeeId}), vai trò ${newUser.role}`,
      ipAddress,
    });

    broadcast({ type: 'user_created', user: newUser });
    res.status(201).json({ message: 'Tạo người dùng thành công.', user: newUser });
  } catch (err) {
    console.error('[Create User Error]:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Tài khoản hoặc mã nhân viên này đã tồn tại trong CSDL MySQL.' });
    }
    res.status(500).json({ message: 'Lỗi tạo tài khoản MySQL: ' + err.message });
  }
});

app.put('/api/users/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedUser = await mysqlDb.updateUser(id, updates);
    if (!updatedUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng trong MySQL.' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'UPDATE_USER',
      target: updatedUser.email,
      details: `Cập nhật thông tin nhân viên: ${updatedUser.fullName} (${updatedUser.employeeId})`,
      ipAddress,
    });

    broadcast({ type: 'user_updated', user: updatedUser });
    res.json({ message: 'Cập nhật tài khoản thành công.', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật người dùng MySQL: ' + err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) {
      return res.status(400).json({ message: 'Không thể tự xóa tài khoản của chính mình.' });
    }

    const targetUser = await mysqlDb.getUserById(id);
    const success = await mysqlDb.deleteUser(id);
    if (!success) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng trong MySQL.' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'DELETE_USER',
      target: targetUser ? targetUser.email : id,
      details: `Xóa tài khoản nhân viên ${targetUser ? targetUser.fullName : id}`,
      ipAddress,
    });

    broadcast({ type: 'user_deleted', userId: id });
    res.json({ message: 'Đã xóa người dùng thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa người dùng MySQL: ' + err.message });
  }
});

app.post('/api/users/:id/reset-password', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const defaultPassword = req.body.newPassword || '123456';
    const targetUser = await mysqlDb.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng trong MySQL.' });
    }

    const updatedUser = await mysqlDb.updateUser(id, { password: defaultPassword });
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'RESET_PASSWORD',
      target: updatedUser.email,
      details: `Đặt lại mật khẩu cho tài khoản ${updatedUser.fullName} (${updatedUser.employeeId}) về mặc định (${defaultPassword})`,
      ipAddress,
    });

    res.json({
      message: `Đã đặt lại mật khẩu của tài khoản ${updatedUser.email} về mặc định (${defaultPassword}).`,
      user: updatedUser,
      defaultPassword,
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi đặt lại mật khẩu MySQL: ' + err.message });
  }
});

// =========================================================================
// TÍNH NĂNG TẢI & ĐỔI ẢNH ĐẠI DIỆN (AVATAR UPLOAD - MULTER + MYSQL)
// =========================================================================
app.post('/api/users/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn file ảnh hợp lệ để tải lên.' });
    }

    const targetUserId = req.body.userId || req.user.id;
    const userRole = (req.user?.role || '').toUpperCase();

    // Rào chắn phân quyền: Chỉ ADMIN mới được đổi avatar cho người khác
    if (userRole !== 'ADMIN' && req.user.id !== targetUserId) {
      return res.status(403).json({ message: 'Bạn chỉ có quyền thay đổi ảnh đại diện của chính mình.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updatedUser = await mysqlDb.updateUserAvatar(targetUserId, avatarUrl);

    // Ghi audit log
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'UPDATE_AVATAR',
      target: updatedUser ? updatedUser.email : targetUserId,
      details: `Cập nhật ảnh đại diện mới: ${avatarUrl} cho nhân viên ${updatedUser ? updatedUser.fullName : targetUserId}`,
      ipAddress,
    });

    // Phát sóng sự kiện WebSocket để toàn bộ client cập nhật Header & Sidebar ngay lập tức
    broadcast({
      type: 'user_avatar_updated',
      userId: targetUserId,
      avatarUrl,
      user: updatedUser,
    });

    res.json({
      message: 'Tải lên và cập nhật ảnh đại diện thành công.',
      avatarUrl,
      user: updatedUser,
    });
  } catch (error) {
    console.error('[Upload Avatar Error]:', error);
    res.status(500).json({ message: error.message || 'Lỗi khi xử lý file ảnh đại diện.' });
  }
});

// =========================================================================
// AUDIT LOG APIS (MYSQL)
// =========================================================================
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const { action, search, limit } = req.query;
    const logs = await mysqlDb.getAuditLogs({ action, search, limit });
    res.json({ auditLogs: logs });
  } catch (err) {
    console.warn(`[GetAuditLogs] MySQL offline: ${err.message}. Trả về danh sách trống.`);
    res.json({ auditLogs: [] });
  }
});

app.post('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const { action, target, details } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';

    const newLog = await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action,
      target,
      details,
      ipAddress,
    });

    broadcast({ type: 'audit_event', data: newLog });
    res.status(201).json({ auditLog: newLog });
  } catch (err) {
    res.json({ auditLog: { id: 'AUD-MEM-01', action: req.body.action, timestamp: new Date() } });
  }
});

// =========================================================================
// PLC STATIONS APIS (MYSQL KÈM FALLBACK)
// =========================================================================
app.get('/api/plc-stations', authenticateToken, async (req, res) => {
  try {
    const stations = await mysqlDb.getPLCStations();
    res.json({ stations });
  } catch (err) {
    console.warn(`[GetPLCStations] MySQL offline: ${err.message}. Trả về danh sách dự phòng.`);
    res.json({ stations: fallbackPLCStations });
  }
});

app.post('/api/plc-stations/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedStation = await mysqlDb.togglePLCStation(id);
    if (!updatedStation) {
      return res.status(404).json({ message: 'Không tìm thấy trạm PLC.' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'TOGGLE_PLC',
      target: updatedStation.id,
      details: `Chuyển trạng thái trạm ${updatedStation.name} sang: ${
        updatedStation.isConnected ? 'ONLINE' : 'DISCONNECTED'
      }`,
      ipAddress,
    });

    broadcast({ type: 'plc_update', data: updatedStation });
    res.json({ station: updatedStation });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi chuyển trạng thái PLC: ' + err.message });
  }
});

// =========================================================================
// TELEMETRY & MACHINE ACTIVITY LOGS APIS (LỊCH SỬ HOẠT ĐỘNG MÁY)
// =========================================================================

const VALID_SORT_COLUMNS = ['timestamp', 'value', 'lineId', 'machineId', 'metricId', 'status', 'createdAt'];

/**
 * Kiểm tra ngày theo lịch thực tế (bao gồm kiểm tra năm nhuận và tháng 2)
 */
function isValidCalendarDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return (
    dateObj.getUTCFullYear() === y &&
    dateObj.getUTCMonth() + 1 === m &&
    dateObj.getUTCDate() === d
  );
}

/**
 * Kiểm tra giờ hợp lệ trong ngày (00:00 đến 23:59)
 */
function isValidTime(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

app.get(
  '/api/telemetry/logs',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const {
        lineId,
        machineId,
        metricId,
        status,
        startDate,
        endDate,
        startTime,
        endTime,
        page = '1',
        limit = '20',
        sortBy = 'timestamp',
        sortOrder = 'DESC',
        isExport = 'false',
      } = req.query;

      // 1. Validate tham số phân trang page và limit
      if (req.query.page !== undefined) {
        const pNum = Number(page);
        if (!Number.isInteger(pNum) || pNum < 1) {
          return res.status(400).json({
            success: false,
            message: 'Tham số "page" phải là số nguyên dương hợp lệ (>= 1).',
          });
        }
      }

      if (req.query.limit !== undefined) {
        const lNum = Number(limit);
        if (!Number.isInteger(lNum) || lNum < 1) {
          return res.status(400).json({
            success: false,
            message: 'Tham số "limit" phải là số nguyên dương hợp lệ (>= 1).',
          });
        }
      }

      // 2. Validate cột sắp xếp (Whitelist validation)
      if (sortBy && !VALID_SORT_COLUMNS.includes(sortBy)) {
        return res.status(400).json({
          success: false,
          message: `Cột sắp xếp "${sortBy}" không hợp lệ. Chỉ chấp nhận một trong các cột: ${VALID_SORT_COLUMNS.join(', ')}.`,
        });
      }

      if (sortOrder && !['ASC', 'DESC'].includes(String(sortOrder).toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Chiều sắp xếp không hợp lệ. Chỉ chấp nhận "ASC" hoặc "DESC".',
        });
      }

      // 3. Validate ngày thực tế theo lịch (bao gồm năm nhuận)
      if (startDate && !isValidCalendarDate(startDate)) {
        return res.status(400).json({
          success: false,
          message: `Ngày bắt đầu "${startDate}" không hợp lệ theo lịch chuẩn (YYYY-MM-DD).`,
        });
      }

      if (endDate && !isValidCalendarDate(endDate)) {
        return res.status(400).json({
          success: false,
          message: `Ngày kết thúc "${endDate}" không hợp lệ theo lịch chuẩn (YYYY-MM-DD).`,
        });
      }

      // 4. Validate khung giờ (00:00 - 23:59)
      if (startTime && !isValidTime(startTime)) {
        return res.status(400).json({
          success: false,
          message: `Giờ bắt đầu "${startTime}" không hợp lệ. Giờ phải nằm trong khoảng 00:00 đến 23:59.`,
        });
      }

      if (endTime && !isValidTime(endTime)) {
        return res.status(400).json({
          success: false,
          message: `Giờ kết thúc "${endTime}" không hợp lệ. Giờ phải nằm trong khoảng 00:00 đến 23:59.`,
        });
      }

      // 5. Kiểm tra logic ngày: Ngày kết thúc không được nhỏ hơn ngày bắt đầu
      if (startDate && endDate && endDate < startDate) {
        return res.status(400).json({
          success: false,
          message: 'Ngày kết thúc (endDate) không được nhỏ hơn ngày bắt đầu (startDate).',
        });
      }

      const exportFlag = String(isExport).toLowerCase() === 'true';
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = exportFlag
        ? Math.min(Math.max(1, parseInt(limit, 10) || 10000), 10000)
        : Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);

      const filters = {
        lineId: lineId && lineId !== 'all' ? String(lineId).trim() : undefined,
        machineId: machineId && machineId !== 'all' ? String(machineId).trim() : undefined,
        metricId: metricId && metricId !== 'all' ? String(metricId).trim() : undefined,
        status: status && status !== 'all' ? String(status).trim() : undefined,
        startDate: startDate ? String(startDate).trim() : undefined,
        endDate: endDate ? String(endDate).trim() : undefined,
        startTime: startTime ? String(startTime).trim() : undefined,
        endTime: endTime ? String(endTime).trim() : undefined,
        page: parsedPage,
        limit: parsedLimit,
        sortBy: sortBy || 'timestamp',
        sortOrder: String(sortOrder || 'DESC').toUpperCase(),
        isExport: exportFlag,
      };

      // 6. Truy vấn từ CSDL MySQL chính thức
      try {
        const queryResult = await mysqlDb.getTelemetryLogs(filters);

        // Nếu là thao tác Export và số lượng vượt trần 10.000 dòng:
        // Từ chối xuất và yêu cầu người dùng thu hẹp bộ lọc để bảo vệ tính toàn vẹn dữ liệu
        if (exportFlag && queryResult.exportAllowed === false) {
          return res.status(400).json({
            success: false,
            message: queryResult.warning,
            metadata: {
              totalRecords: queryResult.totalRecords,
              page: queryResult.page,
              limit: queryResult.limit,
              totalPages: queryResult.totalPages,
              isTruncated: true,
              exportAllowed: false,
              maxExportLimit: queryResult.maxExportLimit || 10000,
              appliedFilters: filters,
              serverTimeUTC: new Date().toISOString(),
              dataSource: 'MySQL_Database',
              status: 'ok',
            },
            data: [],
          });
        }

        return res.json({
          success: true,
          metadata: {
            totalRecords: queryResult.totalRecords,
            page: queryResult.page,
            limit: queryResult.limit,
            totalPages: queryResult.totalPages,
            isTruncated: queryResult.isTruncated || false,
            exportAllowed: queryResult.exportAllowed !== false,
            maxExportLimit: queryResult.maxExportLimit || 10000,
            appliedFilters: filters,
            serverTimeUTC: new Date().toISOString(),
            dataSource: 'MySQL_Database',
            status: 'ok',
            warning: queryResult.warning,
          },
          data: queryResult.data,
        });
      } catch (dbErr) {
        console.warn(`[GetTelemetryLogs] MySQL chưa khả dụng: ${dbErr.message}`);
        // Nếu DB không khả dụng, không giả mạo là lịch sử đầy đủ mà trả trạng thái degraded rõ ràng
        return res.json({
          success: true,
          metadata: {
            totalRecords: 0,
            page: parsedPage,
            limit: parsedLimit,
            totalPages: 0,
            isTruncated: false,
            exportAllowed: !exportFlag,
            maxExportLimit: 10000,
            appliedFilters: filters,
            serverTimeUTC: new Date().toISOString(),
            dataSource: 'Memory_Fallback',
            status: 'degraded',
            warning: 'Cơ sở dữ liệu trung tâm chưa được kết nối hoặc đang ngoại tuyến. Dữ liệu lịch sử bền vững tạm thời chưa khả dụng.',
          },
          data: [],
        });
      }
    } catch (err) {
      console.error('[Telemetry Logs API Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi truy vấn lịch sử telemetry: ' + err.message,
      });
    }
  }
);

// =========================================================================
// WEBSOCKET REAL-TIME IoT SIMULATION ENGINE
// =========================================================================
wss.on('connection', (ws) => {
  ws.on('error', (err) => {
    console.error('[WS Client Error]:', err.message);
  });

  try {
    ws.send(
      JSON.stringify({
        type: 'connection_ack',
        message: 'Kết nối WebSocket IoT Server thành công (MySQL Backed).',
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error('[WS Init Send Error]:', err.message);
  }

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch {
      // bỏ qua gói tin lỗi
    }
  });
});

// Xung nhịp mô phỏng IoT: Phát sóng gói tin Telemetry chuỗi thời gian mỗi 2 giây
setInterval(() => {
  if (wss.clients.size === 0) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const telemetryPacket = {
    type: 'iot_telemetry_tick',
    timestamp: timeStr,
    delta: {
      temperatureJitter: Number(((Math.random() - 0.5) * 0.6).toFixed(2)),
      pressureJitter: Number(((Math.random() - 0.5) * 0.15).toFixed(2)),
      vibrationJitter: Number(((Math.random() - 0.5) * 0.08).toFixed(2)),
    },
  };

  broadcast(telemetryPacket);
}, 2000);

// =========================================================================
// BỘ GHI TỰ ĐỘNG TELEMETRY TẬP TRUNG TẠI BACKEND VÀO MYSQL (DEVELOPMENT)
// =========================================================================
let isDbConnected = false;

// Cứ mỗi 5 giây, backend tự động ghi một batch dữ liệu telemetry của các máy vào MySQL
setInterval(async () => {
  if (!isDbConnected) return;

  try {
    const channels = mysqlDb.CANONICAL_TELEMETRY_CHANNELS || [];
    if (channels.length === 0) return;

    const now = new Date();
    // Chọn luân phiên các kênh cảm biến ở 3 dây chuyền để ghi nhận nhịp thời gian thực
    const pickedChannels = [
      channels[Math.floor(Math.random() * 2)],       // Line 1: FDR
      channels[2 + Math.floor(Math.random() * 2)],   // Line 1: CYL
      channels[5 + Math.floor(Math.random() * 2)],   // Line 2: PNT
      channels[8 + Math.floor(Math.random() * 2)],   // Line 3: TST
    ].filter(Boolean);

    const batch = pickedChannels.map((ch) => {
      const offset = (Math.random() - 0.5) * 2 * ch.variance;
      const val = Number(Math.max(0, ch.base + offset).toFixed(2));
      let status = 'normal';
      if (val <= ch.cMin || val >= ch.cMax) status = 'critical';
      else if (val <= ch.wMin || val >= ch.wMax) status = 'warning';

      return {
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
        timestamp: now.toISOString(),
      };
    });

    await mysqlDb.insertTelemetryBatch(batch);
  } catch (err) {
    // Không làm gián đoạn máy chủ nếu gặp lỗi ghi CSDL nền
    console.warn('[Telemetry Auto-Record Warning]:', err.message);
  }
}, 5000);

// =========================================================================
// HEALTH CHECK ENDPOINTS (RENDER & MONITORING)
// =========================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'DENSO IoT Monitoring Backend',
    database: isDbConnected ? 'connected' : 'connecting_or_sleeping',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isDbConnected ? 'connected' : 'connecting',
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handlers để đảm bảo server hoạt động ổn định
process.on('uncaughtException', (err) => {
  console.error('[DENSO IoT Backend Uncaught Exception]:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[DENSO IoT Backend Unhandled Rejection]:', reason);
});

// Khởi chạy HTTP & WebSocket Server
server.on('error', (err) => {
  console.error('[DENSO IoT Server Error]:', err.message);
});

async function connectDatabaseWithRetry(maxRetries = 10, delayMs = 4000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DENSO IoT Backend] Đang kết nối CSDL MySQL (lần ${attempt}/${maxRetries})...`);
      await mysqlDb.initDatabase();
      isDbConnected = true;
      console.log(`[DENSO IoT Backend] Kết nối CSDL MySQL thành công! CSDL sẵn sàng.`);
      return;
    } catch (err) {
      console.warn(`[DENSO IoT Backend] Thử kết nối CSDL lần ${attempt} chưa thành công: ${err.message}`);
      if (attempt < maxRetries) {
        console.log(`[DENSO IoT Backend] Thử lại sau ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        console.error('[DENSO IoT Backend] Tạm thời chưa kết nối được CSDL. Máy chủ vẫn duy trì hoạt động để phục vụ WebSocket và tránh Render crash.');
      }
    }
  }
}

async function startServer() {
  // 1. Luôn bind port ngay lập tức để Render healthcheck pass và không thoát mã lỗi 1
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[DENSO IoT Backend] Server đang chạy tại http://0.0.0.0:${PORT}`);
    console.log(`[DENSO IoT Backend] WebSocket Server hoạt động tại ws://0.0.0.0:${PORT}/ws`);
    console.log(`[DENSO IoT Backend] Avatar Upload directory: ${avatarsDir}`);
  });

  // 2. Kết nối CSDL ở chế độ retry nền (không bao giờ gọi process.exit(1))
  connectDatabaseWithRetry();
}

startServer();

