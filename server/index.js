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
import * as mysqlDb from './db-mysql.js';
import { WebSocketTelemetryService } from './telemetry/WebSocketTelemetryService.js';
import { TelemetryEngine } from './telemetry/TelemetryEngine.js';
import { ResilientBatchBuffer } from './telemetry/ResilientBatchBuffer.js';
import { FileIngestionService } from './ingestion/FileIngestionService.js';
import { defaultProfileRegistry } from './ingestion/FileProfileRegistry.js';

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
const machinesDir = path.join(__dirname, 'uploads', 'machines');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(machinesDir)) {
  fs.mkdirSync(machinesDir, { recursive: true });
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

// =========================================================================
// CẤU HÌNH MULTER UPLOAD ẢNH THIẾT BỊ MÁY MÓC CÔNG NGHIỆP
// =========================================================================
const machineStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, machinesDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanName = `machine-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, cleanName);
  },
});

const uploadMachine = multer({
  storage: machineStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB/ảnh
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowed.test(ext) || mime.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận các tệp ảnh định dạng JPG, JPEG, PNG, WEBP (tối đa 5MB)!'));
  },
});

const server = http.createServer(app);

// Khởi tạo WebSocket Server trên cùng HTTP Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('error', (err) => {
  console.error('[WSS Server Error]:', err.message);
});

// Khởi tạo Dịch vụ Telemetry v2 và Bộ đệm Batch Buffer
export const wsService = new WebSocketTelemetryService(wss);
export const batchBuffer = new ResilientBatchBuffer();
export const telemetryEngine = new TelemetryEngine({
  pool: null, // Sẽ được cập nhật khi CSDL kết nối thành công
  buffer: batchBuffer,
  onTelemetryPacket: (packet) => {
    wsService.broadcastTelemetry(packet);
  },
});
export let fileIngestionService = null;

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
      return res.status(401).json({ message: 'Phiên làm việc đã hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.' });
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
// PRODUCTION LINES APIS (DÂY CHUYỀN SẢN XUẤT - BƯỚC 2B)
// =========================================================================

// Lấy danh sách dây chuyền sản xuất kèm bộ lọc và tổng số máy
app.get(
  '/api/lines',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const lines = await mysqlDb.getProductionLines(req.query);
      res.json({ lines });
    } catch (err) {
      console.error('[Get Production Lines Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy danh sách dây chuyền sản xuất.',
      });
    }
  }
);

// Lấy chi tiết dây chuyền theo ID kèm danh sách máy và trạm PLC
app.get(
  '/api/lines/:id',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const line = await mysqlDb.getProductionLineById(req.params.id);
      if (!line) {
        return res.status(404).json({ message: `Không tìm thấy dây chuyền với ID: ${req.params.id}` });
      }
      res.json({ line });
    } catch (err) {
      console.error('[Get Production Line By ID Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy thông tin dây chuyền.',
      });
    }
  }
);

// Tạo mới dây chuyền (Chỉ Admin)
app.post(
  '/api/lines',
  authenticateToken,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const { name, code } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Tên dây chuyền (name) là bắt buộc.' });
      }
      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ message: 'Mã dây chuyền (code) là bắt buộc.' });
      }

      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const newLine = await mysqlDb.createProductionLine(req.body, req.user, ipAddress);

      broadcast({ type: 'line_created', data: newLine });
      res.status(201).json({
        message: 'Tạo dây chuyền sản xuất thành công.',
        line: newLine,
      });
    } catch (err) {
      console.error('[Create Production Line Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi tạo dây chuyền sản xuất.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Cập nhật thông tin dây chuyền (Admin & Maintenance)
app.put(
  '/api/lines/:id',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const updatedLine = await mysqlDb.updateProductionLine(req.params.id, req.body, req.user, ipAddress);

      broadcast({ type: 'line_updated', data: updatedLine });
      res.json({
        message: 'Cập nhật dây chuyền sản xuất thành công.',
        line: updatedLine,
      });
    } catch (err) {
      console.error('[Update Production Line Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi cập nhật dây chuyền.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Lưu trữ / Dừng vận hành dây chuyền (Chỉ Admin)
app.patch(
  '/api/lines/:id/archive',
  authenticateToken,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const result = await mysqlDb.archiveProductionLine(req.params.id, req.user, ipAddress);

      broadcast({ type: 'line_archived', data: result });
      res.json({
        message: 'Lưu trữ / Dừng vận hành dây chuyền thành công.',
        ...result,
      });
    } catch (err) {
      console.error('[Archive Production Line Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lưu trữ dây chuyền.',
      });
    }
  }
);

// =========================================================================
// MACHINES APIS (MÁY MÓC / THIẾT BỊ - BƯỚC 2B)
// =========================================================================

// Tải ảnh thiết bị máy móc lên máy chủ (Admin & Maintenance)
app.post(
  '/api/machines/upload-image',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  uploadMachine.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Vui lòng chọn một tệp ảnh hợp lệ để tải lên.' });
      }

      const imageUrl = `/uploads/machines/${req.file.filename}`;
      const machineId = req.body.machineId;

      // Ghi audit log nếu người dùng đăng nhập
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      await mysqlDb.addAuditLog({
        userId: req.user?.id,
        userEmail: req.user?.email,
        userName: req.user?.fullName || req.user?.name,
        employeeId: req.user?.employeeId,
        action: 'UPLOAD_MACHINE_IMAGE',
        target: machineId || req.file.filename,
        details: `Tải ảnh thiết bị: ${req.file.originalname} -> ${imageUrl} (${Math.round(req.file.size / 1024)} KB)`,
        ipAddress,
      });

      res.status(200).json({
        message: 'Tải ảnh thiết bị lên thành công.',
        imageUrl,
        filename: req.file.filename,
        size: req.file.size,
      });
    } catch (err) {
      console.error('[Upload Machine Image Error]:', err);
      res.status(500).json({
        message: err.message || 'Lỗi khi tải ảnh thiết bị lên.',
      });
    }
  }
);

// Lấy danh sách máy kèm bộ lọc (lineId, status, type, search)
app.get(
  '/api/machines',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const machines = await mysqlDb.getMachines(req.query);
      res.json({ machines });
    } catch (err) {
      console.error('[Get Machines Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy danh sách máy móc.',
      });
    }
  }
);

// Lấy chi tiết máy kèm thông tin PLC và danh sách Metric Mapping
app.get(
  '/api/machines/:id',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const machine = await mysqlDb.getMachineById(req.params.id);
      if (!machine) {
        return res.status(404).json({ message: `Không tìm thấy máy với ID: ${req.params.id}` });
      }
      res.json({ machine });
    } catch (err) {
      console.error('[Get Machine By ID Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy thông tin máy.',
      });
    }
  }
);

// Tạo mới máy (Chỉ Admin)
app.post(
  '/api/machines',
  authenticateToken,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const { lineId, name, code, type, status, managementStatus, location, description } = req.body;
      if (!lineId || typeof lineId !== 'string' || !lineId.trim()) {
        return res.status(400).json({ message: 'Dây chuyền sở hữu (lineId) là bắt buộc.' });
      }
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Tên máy (name) là bắt buộc.' });
      }
      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ message: 'Mã máy (code) là bắt buộc.' });
      }

      // Trạng thái giám sát (Monitoring status): no_data / unknown / normal / warning / critical / offline
      const validStatuses = ['no_data', 'unknown', 'normal', 'warning', 'critical', 'offline'];
      const normalizedStatus = (status && typeof status === 'string') ? status.toLowerCase() : 'no_data';
      if (status && !validStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          message: 'Trạng thái giám sát không hợp lệ. Chấp nhận: no_data, unknown, normal, warning, critical, offline.'
        });
      }

      // Trạng thái quản lý thiết bị: active (đang sử dụng) / inactive (ngừng sử dụng)
      const validMgmt = ['active', 'inactive'];
      const normalizedMgmt = (managementStatus && typeof managementStatus === 'string')
        ? managementStatus.toLowerCase()
        : 'active';
      if (managementStatus && !validMgmt.includes(normalizedMgmt)) {
        return res.status(400).json({
          message: 'Trạng thái quản lý thiết bị chỉ chấp nhận: active hoặc inactive.'
        });
      }

      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const newMachine = await mysqlDb.createMachine({
        lineId: lineId.trim(),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type: (type && typeof type === 'string' && type.trim()) ? type.trim() : 'general',
        status: normalizedStatus,
        managementStatus: normalizedMgmt,
        location: (location && typeof location === 'string') ? location.trim() : null,
        description: (description && typeof description === 'string') ? description.trim() : null,
      }, req.user, ipAddress);

      broadcast({ type: 'machine_created', data: newMachine });
      res.status(201).json({
        message: 'Thêm máy mới thành công.',
        machine: newMachine,
      });
    } catch (err) {
      console.error('[Create Machine Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi thêm máy mới.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Cập nhật máy (Admin & Maintenance)
app.put(
  '/api/machines/:id',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const { name, type, location, description, managementStatus, status } = req.body;

      if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
        return res.status(400).json({ message: 'Tên máy (name) không được để trống.' });
      }

      if (managementStatus !== undefined && !['active', 'inactive'].includes(String(managementStatus).toLowerCase())) {
        return res.status(400).json({ message: 'Trạng thái quản lý thiết bị chỉ chấp nhận: active hoặc inactive.' });
      }

      if (status !== undefined) {
        const validStatuses = ['no_data', 'unknown', 'normal', 'warning', 'critical', 'offline'];
        if (!validStatuses.includes(String(status).toLowerCase())) {
          return res.status(400).json({
            message: 'Trạng thái giám sát không hợp lệ. Chấp nhận: no_data, unknown, normal, warning, critical, offline.'
          });
        }
      }

      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      // Chỉ truyền các trường được phép sửa đổi, bảo vệ tính bất biến của id, code, lineId
      const allowedUpdates = {
        name: name !== undefined ? name.trim() : undefined,
        type: type !== undefined ? type.trim() : undefined,
        location: location !== undefined ? location.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        managementStatus,
        status,
      };

      const updatedMachine = await mysqlDb.updateMachine(req.params.id, allowedUpdates, req.user, ipAddress);

      broadcast({ type: 'machine_updated', data: updatedMachine });
      res.json({
        message: 'Cập nhật thông tin máy thành công.',
        machine: updatedMachine,
      });
    } catch (err) {
      console.error('[Update Machine Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi cập nhật máy.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Lưu trữ / Dừng vận hành máy (Chỉ Admin)
app.patch(
  '/api/machines/:id/archive',
  authenticateToken,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const result = await mysqlDb.archiveMachine(req.params.id, req.user, ipAddress);

      broadcast({ type: 'machine_archived', data: result });
      res.json({
        message: 'Lưu trữ / Dừng hoạt động máy thành công.',
        ...result,
      });
    } catch (err) {
      console.error('[Archive Machine Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lưu trữ máy.',
      });
    }
  }
);

// =========================================================================
// PLC ASSIGNMENT & DETACHMENT APIS (GÁN, CHUYỂN GIAO & GỠ TRẠM PLC - BƯỚC 2B)
// =========================================================================

// =========================================================================
// KIẾN TRÚC PLC THEO DÂY CHUYỀN (LINE-LEVEL PLC ARCHITECTURE)
// =========================================================================

// Gán hoặc chuyển giao trạm PLC cho Dây chuyền sản xuất (Admin & Maintenance)
const handleAssignLinePLC = async (req, res) => {
  try {
    const { plcId, confirmDestReplace = false, confirmSourceTransfer = false } = req.body;
    if (!plcId || typeof plcId !== 'string' || !plcId.trim()) {
      return res.status(400).json({ message: 'Mã trạm PLC (plcId) là bắt buộc.' });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await mysqlDb.assignPLCToLine(
      req.params.id,
      plcId.trim(),
      {
        confirmDestReplace: Boolean(confirmDestReplace),
        confirmSourceTransfer: Boolean(confirmSourceTransfer),
      },
      req.user,
      ipAddress
    );

    broadcast({ type: 'line_plc_assigned', data: result });
    res.json({
      message: 'Gán trạm PLC cho dây chuyền thành công.',
      ...result,
    });
  } catch (err) {
    console.error('[Assign PLC To Line Error]:', err);
    res.status(err.statusCode || 500).json({
      message: err.message || 'Lỗi khi gán trạm PLC cho dây chuyền.',
      errorCode: err.errorCode,
      sourceLineId: err.sourceLineId,
      sourceLineName: err.sourceLineName,
      currentPlcId: err.currentPlcId,
      currentPlcName: err.currentPlcName,
    });
  }
};

app.put('/api/lines/:id/plc', authenticateToken, requireRole(['ADMIN', 'MAINTENANCE']), handleAssignLinePLC);
app.post('/api/lines/:id/plc', authenticateToken, requireRole(['ADMIN', 'MAINTENANCE']), handleAssignLinePLC);

// Gỡ bỏ trạm PLC khỏi Dây chuyền sản xuất (Admin & Maintenance)
app.delete(
  '/api/lines/:id/plc',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const result = await mysqlDb.unassignPLCFromLine(req.params.id, req.user, ipAddress);

      broadcast({ type: 'line_plc_unassigned', data: result });
      res.json({
        message: 'Gỡ trạm PLC khỏi dây chuyền thành công.',
        ...result,
      });
    } catch (err) {
      console.error('[Unassign PLC From Line Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi gỡ trạm PLC khỏi dây chuyền.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Vô hiệu hóa gán PLC trực tiếp vào từng máy (Deprecated theo kiến trúc mới)
app.put(
  '/api/machines/:id/plc',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    return res.status(400).json({
      message: 'Chức năng gán PLC trực tiếp cho từng máy đã bị vô hiệu hóa theo kiến trúc mới (1 Dây chuyền gắn tối đa 1 PLC). Vui lòng sử dụng API cấp Dây chuyền: /api/lines/:id/plc.',
      errorCode: 'DEPRECATED_MACHINE_PLC_ASSIGNMENT',
    });
  }
);

app.post(
  '/api/machines/:id/plc',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    return res.status(400).json({
      message: 'Chức năng gán PLC trực tiếp cho từng máy đã bị vô hiệu hóa theo kiến trúc mới (1 Dây chuyền gắn tối đa 1 PLC). Vui lòng sử dụng API cấp Dây chuyền: /api/lines/:id/plc.',
      errorCode: 'DEPRECATED_MACHINE_PLC_ASSIGNMENT',
    });
  }
);

app.delete(
  '/api/machines/:id/plc',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    return res.status(400).json({
      message: 'Chức năng gỡ PLC khỏi từng máy đã bị vô hiệu hóa theo kiến trúc mới (1 Dây chuyền gắn tối đa 1 PLC). Vui lòng sử dụng API cấp Dây chuyền: /api/lines/:id/plc.',
      errorCode: 'DEPRECATED_MACHINE_PLC_ASSIGNMENT',
    });
  }
);

// =========================================================================
// GIAI ĐOẠN 2 - BƯỚC 2C: METRIC MAPPINGS, THRESHOLDS & COLLECTION SCHEDULES
// =========================================================================

// 1. METRIC MAPPINGS APIS

// Lấy danh sách Metric Mappings kèm bộ lọc
app.get(
  '/api/mappings',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const mappings = await mysqlDb.getMetricMappings(req.query);
      res.json({ mappings });
    } catch (err) {
      console.error('[Get Metric Mappings Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy danh sách Metric Mappings.',
      });
    }
  }
);

// Lấy chi tiết Metric Mapping theo ID
app.get(
  '/api/mappings/:id',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const mapping = await mysqlDb.getMetricMappingById(req.params.id);
      if (!mapping) {
        return res.status(404).json({ message: `Không tìm thấy Metric Mapping: ${req.params.id}` });
      }
      res.json({ mapping });
    } catch (err) {
      console.error('[Get Metric Mapping By ID Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy thông tin Metric Mapping.',
      });
    }
  }
);

// Tạo mới Metric Mapping (Chỉ Admin)
app.post(
  '/api/mappings',
  authenticateToken,
  requireRole(['ADMIN']),
  async (req, res) => {
    try {
      const { machine_id, metric_id, mapping_code, channel_name } = req.body;
      if (!machine_id || typeof machine_id !== 'string' || !machine_id.trim()) {
        return res.status(400).json({ message: 'Mã máy liên kết (machine_id) là bắt buộc.' });
      }
      if (!metric_id || typeof metric_id !== 'string' || !metric_id.trim()) {
        return res.status(400).json({ message: 'Mã danh mục metric (metric_id) là bắt buộc.' });
      }
      if (!mapping_code || typeof mapping_code !== 'string' || !mapping_code.trim()) {
        return res.status(400).json({ message: 'Mã mapping_code là bắt buộc.' });
      }
      if (!channel_name || typeof channel_name !== 'string' || !channel_name.trim()) {
        return res.status(400).json({ message: 'Tên kênh (channel_name) là bắt buộc.' });
      }

      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const created = await mysqlDb.createMetricMapping(req.body, req.user, ipAddress);

      broadcast({ type: 'mapping_created', data: created });
      res.status(201).json({
        message: 'Tạo Metric Mapping mới thành công.',
        mapping: created,
      });
    } catch (err) {
      console.error('[Create Metric Mapping Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi tạo Metric Mapping.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Cập nhật cấu hình Metric Mapping (Admin & Maintenance)
app.put(
  '/api/mappings/:id',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const updated = await mysqlDb.updateMetricMapping(req.params.id, req.body, req.user, ipAddress);

      broadcast({ type: 'mapping_updated', data: updated });
      res.json({
        message: 'Cập nhật Metric Mapping thành công.',
        mapping: updated,
      });
    } catch (err) {
      console.error('[Update Metric Mapping Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi cập nhật Metric Mapping.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Ngừng hoạt động (Deactivate) Metric Mapping (Admin & Maintenance) - Bảo toàn lịch sử
app.patch(
  '/api/mappings/:id/deactivate',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const result = await mysqlDb.deactivateMetricMapping(req.params.id, req.user, ipAddress);

      broadcast({ type: 'mapping_deactivated', data: result });
      res.json({
        message: 'Ngừng hoạt động Metric Mapping thành công (Bảo toàn lịch sử dữ liệu).',
        ...result,
      });
    } catch (err) {
      console.error('[Deactivate Metric Mapping Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi ngừng hoạt động Metric Mapping.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Gỡ bỏ / Xóa Metric Mapping khỏi thiết bị (Admin & Maintenance)
app.delete(
  '/api/mappings/:id',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const result = await mysqlDb.deleteMetricMapping(req.params.id, req.user, ipAddress);

      broadcast({ type: 'mapping_deleted', data: result });
      res.json({
        message: 'Gỡ bỏ Metric Mapping thành công.',
        ...result,
      });
    } catch (err) {
      console.error('[Delete Metric Mapping Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi gỡ bỏ Metric Mapping.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Kích hoạt / Tạm dừng Giám sát (Toggle Monitoring) (Admin & Maintenance)
app.patch(
  '/api/mappings/:id/monitoring',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const { enable } = req.body;
      if (enable === undefined) {
        return res.status(400).json({ message: 'Trường enable (true hoặc false) là bắt buộc.' });
      }

      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const updated = await mysqlDb.toggleMetricMappingMonitoring(req.params.id, Boolean(enable), req.user, ipAddress);

      broadcast({ type: 'mapping_monitoring_toggled', data: updated });
      res.json({
        message: enable ? 'Kích hoạt giám sát kênh thành công.' : 'Tạm dừng giám sát kênh thành công.',
        mapping: updated,
      });
    } catch (err) {
      console.error('[Toggle Mapping Monitoring Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi bật/tắt giám sát kênh.',
        errorCode: err.errorCode,
      });
    }
  }
);

// 2. METRIC THRESHOLDS APIS

// Lấy ngưỡng cảnh báo của mapping
app.get(
  '/api/mappings/:id/thresholds',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const thresholds = await mysqlDb.getMetricThresholds(req.params.id);
      res.json({ thresholds });
    } catch (err) {
      console.error('[Get Metric Thresholds Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy thông tin ngưỡng cảnh báo.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Thiết lập / Cập nhật ngưỡng cảnh báo (Admin & Maintenance)
app.put(
  '/api/mappings/:id/thresholds',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const updated = await mysqlDb.setMetricThresholds(req.params.id, req.body, req.user, ipAddress);

      broadcast({ type: 'thresholds_updated', data: { mappingId: req.params.id, thresholds: updated } });
      res.json({
        message: 'Thiết lập ngưỡng cảnh báo thành công.',
        thresholds: updated,
      });
    } catch (err) {
      console.error('[Set Metric Thresholds Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi thiết lập ngưỡng cảnh báo.',
        errorCode: err.errorCode,
      });
    }
  }
);

// 3. COLLECTION SCHEDULES APIS

// Lấy lịch thu thập dữ liệu của mapping
app.get(
  '/api/mappings/:id/schedule',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      const schedule = await mysqlDb.getCollectionSchedule(req.params.id);
      res.json({ schedule });
    } catch (err) {
      console.error('[Get Collection Schedule Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi lấy lịch thu thập dữ liệu.',
        errorCode: err.errorCode,
      });
    }
  }
);

// Thiết lập / Cập nhật lịch thu thập dữ liệu (Admin & Maintenance)
app.put(
  '/api/mappings/:id/schedule',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE']),
  async (req, res) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const updated = await mysqlDb.setCollectionSchedule(req.params.id, req.body, req.user, ipAddress);

      broadcast({ type: 'schedule_updated', data: { mappingId: req.params.id, schedule: updated } });
      res.json({
        message: 'Thiết lập lịch thu thập dữ liệu thành công.',
        schedule: updated,
      });
    } catch (err) {
      console.error('[Set Collection Schedule Error]:', err);
      res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi khi thiết lập lịch thu thập.',
        errorCode: err.errorCode,
      });
    }
  }
);

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
// METRIC CATALOG APIS (DANH MỤC METRIC TOÀN NHÀ MÁY)
// =========================================================================

app.get('/api/metrics', authenticateToken, async (req, res) => {
  try {
    const result = await mysqlDb.getMetrics(req.query);
    res.json(result);
  } catch (err) {
    console.error('[Get Metrics Error]:', err);
    res.status(500).json({ message: 'Lỗi tải danh mục Metric: ' + err.message });
  }
});

app.get('/api/metrics/summary', authenticateToken, async (req, res) => {
  try {
    const summary = await mysqlDb.getMetricSummary();
    res.json({ summary });
  } catch (err) {
    console.error('[Get Metric Summary Error]:', err);
    res.status(500).json({ message: 'Lỗi tải tóm tắt Metric: ' + err.message });
  }
});

app.get('/api/metrics/:id/usage', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const usage = await mysqlDb.getMetricUsage(id);
    if (!usage) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin metric.' });
    }
    res.json({ usage });
  } catch (err) {
    console.error('[Get Metric Usage Error]:', err);
    res.status(500).json({ message: 'Lỗi tra cứu sử dụng metric: ' + err.message });
  }
});

app.get('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const metric = await mysqlDb.getMetricById(id);
    if (!metric) {
      return res.status(404).json({ message: 'Không tìm thấy metric trong danh mục.' });
    }
    res.json({ metric });
  } catch (err) {
    console.error('[Get Metric By Id Error]:', err);
    res.status(500).json({ message: 'Lỗi truy vấn metric: ' + err.message });
  }
});

app.post('/api/metrics', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { code, name, category, unit, dataType, validMin, validMax, description, status } = req.body;

    // Validate Code format (Chữ hoa, số, gạch dưới: 2-64 ký tự)
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Mã metric là bắt buộc.' });
    }
    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,64}$/.test(cleanCode)) {
      return res.status(400).json({
        message: 'Mã metric không hợp lệ. Chỉ chấp nhận chữ in hoa (A-Z), số (0-9) và dấu gạch dưới (_), độ dài 2-64 ký tự.',
      });
    }

    // Kiểm tra trùng lặp mã metric
    const existing = await mysqlDb.getMetricByCode(cleanCode);
    if (existing) {
      return res.status(400).json({
        message: `Mã metric "${cleanCode}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`,
      });
    }

    // Validate Tên metric
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 128) {
      return res.status(400).json({ message: 'Tên metric bắt buộc và phải từ 2 đến 128 ký tự.' });
    }

    // Validate Category
    if (!category || !mysqlDb.VALID_METRIC_CATEGORIES.includes(category)) {
      return res.status(400).json({
        message: `Danh mục phân loại không hợp lệ. Chấp nhận: ${mysqlDb.VALID_METRIC_CATEGORIES.join(', ')}`,
      });
    }

    // Validate Đơn vị đo
    if (!unit || typeof unit !== 'string' || !unit.trim() || unit.trim().length > 32) {
      return res.status(400).json({ message: 'Đơn vị đo bắt buộc và tối đa 32 ký tự.' });
    }

    // Validate Kiểu dữ liệu
    const finalDataType = (dataType || 'FLOAT').toUpperCase();
    if (!mysqlDb.VALID_METRIC_DATA_TYPES.includes(finalDataType)) {
      return res.status(400).json({
        message: `Kiểu dữ liệu không hợp lệ. Chấp nhận: ${mysqlDb.VALID_METRIC_DATA_TYPES.join(', ')}`,
      });
    }

    // Validate Ngưỡng hợp lý: validMin < validMax
    const numMin = validMin !== undefined && validMin !== null && validMin !== '' ? Number(validMin) : null;
    const numMax = validMax !== undefined && validMax !== null && validMax !== '' ? Number(validMax) : null;
    if (numMin !== null && isNaN(numMin)) {
      return res.status(400).json({ message: 'Giá trị validMin phải là số hợp lệ.' });
    }
    if (numMax !== null && isNaN(numMax)) {
      return res.status(400).json({ message: 'Giá trị validMax phải là số hợp lệ.' });
    }
    if (numMin !== null && numMax !== null && numMin >= numMax) {
      return res.status(400).json({
        message: 'Giá trị tối thiểu (validMin) phải nhỏ hơn giá trị tối đa (validMax).',
      });
    }

    const newMetric = await mysqlDb.createMetric({
      code: cleanCode,
      name: name.trim(),
      category,
      unit: unit.trim(),
      dataType: finalDataType,
      validMin: numMin,
      validMax: numMax,
      description: description ? String(description).trim() : null,
      status: (status || 'ACTIVE').toUpperCase(),
      createdBy: req.user.email,
    });

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    // Đồng bộ gán thiết bị nếu có
    if (Array.isArray(req.body.assignedMachineIds)) {
      await mysqlDb.syncMetricMachineAssignments(newMetric.id, req.body.assignedMachineIds, req.user, ipAddress);
    }

    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'CREATE_METRIC',
      target: newMetric.code,
      details: `Tạo metric mới trong danh mục: ${newMetric.name} (${newMetric.code}), đơn vị: ${newMetric.unit}, kiểu: ${newMetric.dataType}`,
      ipAddress,
    });

    broadcast({ type: 'metric_created', metric: newMetric });
    res.status(201).json({ message: 'Tạo metric mới thành công.', metric: newMetric });
  } catch (err) {
    console.error('[Create Metric Error]:', err);
    res.status(500).json({ message: 'Lỗi tạo metric trong CSDL: ' + err.message });
  }
});

app.put('/api/metrics/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const targetMetric = await mysqlDb.getMetricById(id);
    if (!targetMetric) {
      return res.status(404).json({ message: 'Không tìm thấy metric trong hệ thống.' });
    }

    const { code, name, category, unit, dataType, validMin, validMax, description, status } = req.body;
    const updates = {};

    if (code !== undefined) {
      const cleanCode = String(code).trim().toUpperCase();
      if (!/^[A-Z0-9_]{2,64}$/.test(cleanCode)) {
        return res.status(400).json({
          message: 'Mã metric không hợp lệ. Chỉ chấp nhận chữ hoa, số và dấu gạch dưới (2-64 ký tự).',
        });
      }
      if (cleanCode !== targetMetric.code) {
        const existing = await mysqlDb.getMetricByCode(cleanCode);
        if (existing && existing.id !== targetMetric.id) {
          return res.status(400).json({ message: `Mã metric "${cleanCode}" đã được sử dụng bởi metric khác.` });
        }
      }
      updates.code = cleanCode;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 128) {
        return res.status(400).json({ message: 'Tên metric bắt buộc và phải từ 2 đến 128 ký tự.' });
      }
      updates.name = name.trim();
    }

    if (category !== undefined) {
      if (!mysqlDb.VALID_METRIC_CATEGORIES.includes(category)) {
        return res.status(400).json({
          message: `Danh mục phân loại không hợp lệ. Chấp nhận: ${mysqlDb.VALID_METRIC_CATEGORIES.join(', ')}`,
        });
      }
      updates.category = category;
    }

    if (unit !== undefined) {
      if (typeof unit !== 'string' || !unit.trim() || unit.trim().length > 32) {
        return res.status(400).json({ message: 'Đơn vị đo bắt buộc và tối đa 32 ký tự.' });
      }
      updates.unit = unit.trim();
    }

    if (dataType !== undefined) {
      const cleanType = String(dataType).toUpperCase();
      if (!mysqlDb.VALID_METRIC_DATA_TYPES.includes(cleanType)) {
        return res.status(400).json({
          message: `Kiểu dữ liệu không hợp lệ. Chấp nhận: ${mysqlDb.VALID_METRIC_DATA_TYPES.join(', ')}`,
        });
      }
      updates.dataType = cleanType;
    }

    // Validate Range
    let finalMin = targetMetric.validMin;
    let finalMax = targetMetric.validMax;

    if (validMin !== undefined) {
      finalMin = validMin !== null && validMin !== '' ? Number(validMin) : null;
      if (finalMin !== null && isNaN(finalMin)) {
        return res.status(400).json({ message: 'Giá trị validMin phải là số.' });
      }
      updates.validMin = finalMin;
    }

    if (validMax !== undefined) {
      finalMax = validMax !== null && validMax !== '' ? Number(validMax) : null;
      if (finalMax !== null && isNaN(finalMax)) {
        return res.status(400).json({ message: 'Giá trị validMax phải là số.' });
      }
      updates.validMax = finalMax;
    }

    if (finalMin !== null && finalMax !== null && finalMin >= finalMax) {
      return res.status(400).json({
        message: 'Giá trị tối thiểu (validMin) phải nhỏ hơn giá trị tối đa (validMax).',
      });
    }

    if (description !== undefined) {
      updates.description = description ? String(description).trim() : null;
    }

    if (status !== undefined) {
      const cleanStatus = String(status).toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(cleanStatus)) {
        return res.status(400).json({ message: 'Trạng thái chỉ có thể là ACTIVE hoặc INACTIVE.' });
      }
      updates.status = cleanStatus;
    }

    updates.updatedBy = req.user.email;

    const updatedMetric = await mysqlDb.updateMetric(targetMetric.id, updates);

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    // Đồng bộ gán thiết bị nếu có
    if (Array.isArray(req.body.assignedMachineIds)) {
      await mysqlDb.syncMetricMachineAssignments(targetMetric.id, req.body.assignedMachineIds, req.user, ipAddress);
    }

    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: 'UPDATE_METRIC',
      target: updatedMetric.code,
      details: `Cập nhật thông tin metric: ${updatedMetric.name} (${updatedMetric.code})`,
      ipAddress,
    });

    broadcast({ type: 'metric_updated', metric: updatedMetric });
    res.json({ message: 'Cập nhật metric thành công.', metric: updatedMetric });
  } catch (err) {
    console.error('[Update Metric Error]:', err);
    res.status(500).json({ message: 'Lỗi cập nhật metric: ' + err.message });
  }
});

// Gán / Bỏ gán metric vào danh sách thiết bị
app.post('/api/metrics/:id/assign', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { machineIds } = req.body;
    if (!Array.isArray(machineIds)) {
      return res.status(400).json({ message: 'machineIds phải là mảng chuỗi mã thiết bị.' });
    }
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await mysqlDb.syncMetricMachineAssignments(id, machineIds, req.user, ipAddress);
    broadcast({ type: 'metric_assignments_updated', data: result });
    res.json({ message: 'Cập nhật gán thiết bị cho metric thành công.', ...result });
  } catch (err) {
    console.error('[Assign Metric Machines Error]:', err);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

app.patch('/api/metrics/:id/status', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const targetMetric = await mysqlDb.getMetricById(id);
    if (!targetMetric) {
      return res.status(404).json({ message: 'Không tìm thấy metric trong hệ thống.' });
    }

    const { status } = req.body;
    const cleanStatus = String(status).toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(cleanStatus)) {
      return res.status(400).json({ message: 'Trạng thái chỉ có thể là ACTIVE hoặc INACTIVE.' });
    }

    const updatedMetric = await mysqlDb.updateMetricStatus(targetMetric.id, cleanStatus, req.user.email);
    const actionName = cleanStatus === 'ACTIVE' ? 'ACTIVATE_METRIC' : 'DEACTIVATE_METRIC';

    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await mysqlDb.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.fullName,
      employeeId: req.user.employeeId,
      action: actionName,
      target: updatedMetric.code,
      details: `${cleanStatus === 'ACTIVE' ? 'Kích hoạt lại' : 'Vô hiệu hóa (Deactivate)'} metric: ${updatedMetric.name} (${updatedMetric.code})`,
      ipAddress,
    });

    broadcast({ type: 'metric_status_changed', metric: updatedMetric });
    res.json({
      message: `Đã ${cleanStatus === 'ACTIVE' ? 'kích hoạt' : 'vô hiệu hóa'} metric "${updatedMetric.name}" thành công.`,
      metric: updatedMetric,
    });
  } catch (err) {
    console.error('[Update Metric Status Error]:', err);
    res.status(500).json({ message: 'Lỗi thay đổi trạng thái metric: ' + err.message });
  }
});

// Xóa thông số khỏi danh mục chuẩn (Chỉ ADMIN, kiểm tra chặt chẽ dữ liệu phụ thuộc)
app.delete('/api/metrics/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = await mysqlDb.deleteMetric(id, req.user, ipAddress);

    broadcast({
      type: 'metric_deleted',
      id,
      code: result.metric?.code,
    });

    res.json({
      success: true,
      message: `Đã xóa thông số "${result.metric?.name}" (${result.metric?.code}) thành công.`,
      metric: result.metric,
    });
  } catch (err) {
    console.error('[Delete Metric Error]:', err);
    res.status(err.statusCode || 500).json({
      message: err.message || 'Lỗi khi xóa thông số.',
    });
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
// API LẤY DỮ LIỆU ĐO LƯỜNG MỚI NHẤT CHO DASHBOARD (TẦNG 2 & TẦNG 3)
// =========================================================================
app.get(
  '/api/telemetry/latest',
  authenticateToken,
  requireRole(['ADMIN', 'MAINTENANCE', 'OPERATOR']),
  async (req, res) => {
    try {
      if (!isDbConnected || !mysqlDb.getPool()) {
        return res.status(503).json({
          success: false,
          message: 'CSDL chưa sẵn sàng hoặc đang ngoại tuyến.',
          data: [],
        });
      }

      const { machineId, lineId } = req.query;

      let query = `
        SELECT 
          mth.id,
          mth.lineId,
          mth.lineName,
          mth.machineId,
          mth.machineName,
          mth.metricId,
          mth.metricName,
          mth.value,
          mth.unit,
          mth.status,
          mth.source,
          mth.plcStationId,
          mth.timestamp,
          mm.id AS mappingId,
          mm.channel_name,
          mm.data_source_type,
          mm.file_tag_name,
          mm.sampling_rate_ms,
          mc.name AS catalogMetricName,
          mt.warning_min,
          mt.warning_max,
          mt.critical_min,
          mt.critical_max
        FROM machine_telemetry_history mth
        INNER JOIN (
          SELECT machineId, metricId, MAX(timestamp) as maxTs
          FROM machine_telemetry_history
          WHERE (? IS NULL OR machineId = ?)
          GROUP BY machineId, metricId
        ) latest ON mth.machineId = latest.machineId 
               AND mth.metricId = latest.metricId 
               AND mth.timestamp = latest.maxTs
        LEFT JOIN metric_mappings mm ON mth.machineId = mm.machine_id AND mth.metricId = mm.mapping_code
        LEFT JOIN metric_catalog mc ON mm.metric_id = mc.id
        LEFT JOIN metric_thresholds mt ON mm.id = mt.mapping_id
        WHERE 1=1
      `;
      const params = [machineId || null, machineId || null];

      if (lineId && lineId !== 'all') {
        query += ' AND mth.lineId = ?';
        params.push(lineId);
      }

      query += ' ORDER BY mth.machineId, mth.metricId';

      const [rows] = await mysqlDb.getPool().query(query, params);

      // Tính toán độ mới của dữ liệu (Data Freshness / Quality) cho từng metric
      const now = Date.now();
      const enriched = rows.map((r) => {
        const measuredTime = new Date(r.timestamp).getTime();
        const ageMs = now - measuredTime;
        const isLive = ageMs <= 10 * 60 * 1000; // <= 10 phút
        const isStale = ageMs > 30 * 60 * 1000;  // > 30 phút

        let quality = 'GOOD';
        if (ageMs < -30000) quality = 'UNCERTAIN'; // Lệch đồng hồ tương lai
        else if (isStale) quality = 'UNCERTAIN';

        return {
          id: r.id,
          lineId: r.lineId,
          lineName: r.lineName,
          machineId: r.machineId,
          machineName: r.machineName,
          metricId: r.metricId,
          metricName: r.channel_name || r.metricName || r.catalogMetricName,
          value: Number(r.value),
          unit: r.unit || 'raw',
          status: r.status,
          source: r.source,
          dataSourceType: r.data_source_type || (r.source === 'device' ? 'FILE_INGEST' : 'SIMULATED'),
          fileTagName: r.file_tag_name,
          quality,
          isLive,
          isStale,
          ageSeconds: Math.round(ageMs / 1000),
          measuredAt: new Date(r.timestamp).toISOString(),
          plcStationId: r.plcStationId,
          thresholds: {
            warningMin: r.warning_min !== null ? Number(r.warning_min) : null,
            warningMax: r.warning_max !== null ? Number(r.warning_max) : null,
            criticalMin: r.critical_min !== null ? Number(r.critical_min) : null,
            criticalMax: r.critical_max !== null ? Number(r.critical_max) : null,
          },
        };
      });

      res.json({
        success: true,
        count: enriched.length,
        total: enriched.length,
        timestamp: new Date().toISOString(),
        data: enriched,
      });
    } catch (err) {
      console.error('[Latest Telemetry API Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Lỗi truy vấn dữ liệu đo lường mới nhất: ' + err.message,
      });
    }
  }
);

// =========================================================================
// WEBSOCKET REAL-TIME IoT SIMULATION ENGINE
// =========================================================================
wss.on('connection', (ws) => {
  wsService.handleConnection(ws);

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

// Cứ mỗi 5 giây, backend tự động ghi một batch dữ liệu telemetry của các máy vào MySQL nếu được cấu hình tường minh
setInterval(async () => {
  if (!isDbConnected) return;

  // BẢO VỆ CSDL: Mặc định KHÔNG ghi dữ liệu mô phỏng vào CSDL MySQL denso_iot
  const RECORD_SIMULATION_TO_DB = process.env.RECORD_SIMULATION_TO_DB === 'true';
  if (!RECORD_SIMULATION_TO_DB) return;

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
    databaseName: process.env.DB_NAME || 'denso_iot_phase1_test',
    timestamp: new Date().toISOString(),
  });
});

// =========================================================================
// TELEMETRY ENGINE CONTROL ENDPOINTS
// =========================================================================

// Kiểm tra trạng thái hoạt động của Telemetry Engine & Batch Buffer
app.get('/api/telemetry/engine-status', authenticateToken, (req, res) => {
  res.json({
    status: 'ok',
    engine: telemetryEngine.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

// Dừng thu thập dữ liệu phần mềm khẩn cấp (Software Polling Abort)
app.post('/api/telemetry/engine/abort-polling', authenticateToken, requireRole(['ADMIN', 'MAINTENANCE']), (req, res) => {
  telemetryEngine.abortPolling();
  res.json({
    success: true,
    message: 'Đã kích hoạt dừng thu thập dữ liệu phần mềm (Software Polling Aborted).',
    timestamp: new Date().toISOString(),
  });
});

// =========================================================================
// FILE INGESTION SERVICE CONTROL & MONITORING ENDPOINTS
// =========================================================================

// Lấy trạng thái tổng quan của File Ingestion Service
app.get('/api/ingestion/status', authenticateToken, async (req, res) => {
  const isEnabled = process.env.ENABLE_FILE_INGESTION === 'true';
  let stats = null;

  if (isDbConnected && mysqlDb.getPool()) {
    try {
      const [rows] = await mysqlDb.getPool().query(`
        SELECT status, COUNT(*) AS count
        FROM ingested_files_log
        GROUP BY status
      `);
      stats = rows.reduce((acc, r) => {
        acc[r.status] = Number(r.count);
        return acc;
      }, {});
    } catch {
      stats = null;
    }
  }

  res.json({
    enabled: isEnabled,
    status: fileIngestionService
      ? fileIngestionService.fileWatcher?.isWatching
        ? 'RUNNING'
        : 'PAUSED'
      : 'DISABLED',
    watchDirectory: fileIngestionService ? fileIngestionService.watchDirectory : null,
    activeProfiles: defaultProfileRegistry.getAllProfiles().length,
    profiles: defaultProfileRegistry.getAllProfiles().map((p) => ({
      profileId: p.profileId,
      name: p.name,
      mode: p.mode,
      expectedCycleSeconds: p.expectedCycleSeconds,
    })),
    stats,
    database: process.env.DB_NAME || 'denso_iot',
    timestamp: new Date().toISOString(),
  });
});

// Lấy danh sách lịch sử file ingestion
app.get('/api/ingestion/files', authenticateToken, async (req, res) => {
  if (!isDbConnected || !mysqlDb.getPool()) {
    return res.status(503).json({ message: 'CSDL chưa sẵn sàng.' });
  }

  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const status = req.query.status;
    const machineId = req.query.machineId;

    let query = 'SELECT * FROM ingested_files_log WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (machineId) {
      query += ' AND machine_id = ?';
      params.push(machineId);
    }

    query += ' ORDER BY ingested_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await mysqlDb.getPool().query(query, params);
    res.json({ files: rows, total: rows.length, limit });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi truy vấn lịch sử file ingestion: ' + err.message });
  }
});

// Lấy danh sách xung đột dữ liệu đo lường (Data Conflicts)
app.get('/api/ingestion/conflicts', authenticateToken, async (req, res) => {
  if (!isDbConnected || !mysqlDb.getPool()) {
    return res.status(503).json({ message: 'CSDL chưa sẵn sàng.' });
  }

  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const fileId = req.query.fileId;
    const machineId = req.query.machineId;

    let query = 'SELECT * FROM ingested_file_conflicts WHERE 1=1';
    const params = [];

    if (fileId) {
      query += ' AND file_id = ?';
      params.push(fileId);
    }
    if (machineId) {
      query += ' AND machine_id = ?';
      params.push(machineId);
    }

    query += ' ORDER BY detected_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await mysqlDb.getPool().query(query, params);
    res.json({ conflicts: rows, total: rows.length, limit });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi truy vấn xung đột dữ liệu: ' + err.message });
  }
});

// Tạm dừng File Watcher
app.post('/api/ingestion/pause', authenticateToken, requireRole(['ADMIN', 'MAINTENANCE']), (req, res) => {
  if (!fileIngestionService) {
    return res.status(400).json({ message: 'File Ingestion Service chưa được kích hoạt.' });
  }
  fileIngestionService.pause();
  res.json({ success: true, message: 'Đã tạm dừng File Watcher.', status: 'PAUSED' });
});

// Tiếp tục File Watcher
app.post('/api/ingestion/resume', authenticateToken, requireRole(['ADMIN', 'MAINTENANCE']), (req, res) => {
  if (!fileIngestionService) {
    return res.status(400).json({ message: 'File Ingestion Service chưa được kích hoạt.' });
  }
  fileIngestionService.resume();
  res.json({ success: true, message: 'Đã tiếp tục File Watcher.', status: 'RUNNING' });
});

// Global Error Handlers để đảm bảo server hoạt động ổn định
process.on('uncaughtException', (err) => {
  console.error('[DENSO IoT Backend Uncaught Exception]:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[DENSO IoT Backend Unhandled Rejection]:', reason);
});

// Graceful Shutdown an toàn
async function handleGracefulShutdown(signal) {
  console.log(`[DENSO IoT Backend] Nhận tín hiệu ${signal}. Đang tắt dịch vụ an toàn...`);
  try {
    if (fileIngestionService) {
      fileIngestionService.stop();
    }
    telemetryEngine.abortPolling();
    wsService.destroy();
    await batchBuffer.shutdown(mysqlDb.getPool(), 2500);
  } catch (err) {
    console.warn('[Graceful Shutdown Warning]:', err.message);
  }
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

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
      telemetryEngine.pool = mysqlDb.getPool();
      batchBuffer.startFlusher(mysqlDb.getPool());

      // Phục hồi dữ liệu chưa commit từ WAL nếu có
      const replayed = batchBuffer.replayWal();
      if (replayed.length > 0) {
        console.log(`[BatchBuffer] Đã phục hồi ${replayed.length} bản ghi chưa commit từ tệp WAL.`);
      }

      console.log(`[DENSO IoT Backend] Kết nối CSDL MySQL thành công! CSDL sẵn sàng.`);

      // Khởi tạo File Ingestion Service nếu được cấu hình bật
      const ENABLE_FILE_INGESTION = process.env.ENABLE_FILE_INGESTION === 'true';
      if (ENABLE_FILE_INGESTION) {
        try {
          const ingestionWatchDir =
            process.env.FILE_INGESTION_WATCH_DIR || path.join(__dirname, '..', 'data_ingestion_watch');
          fileIngestionService = new FileIngestionService({
            pool: mysqlDb.getPool(),
            profileRegistry: defaultProfileRegistry,
            telemetryEngine: telemetryEngine,
            wsService: wsService,
            watchDirectory: ingestionWatchDir,
            chunkSize: 500,
          });
          await fileIngestionService.start();
          console.log(`[FileIngestionService] Đã kích hoạt giám sát thư mục: ${ingestionWatchDir}`);
        } catch (ingestionErr) {
          console.error('[FileIngestionService] Khởi động thất bại:', ingestionErr.message);
        }
      } else {
        console.log('[FileIngestionService] Dịch vụ đang tắt (ENABLE_FILE_INGESTION !== true).');
      }

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

