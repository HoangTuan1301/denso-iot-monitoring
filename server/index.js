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
// AUTHENTICATION APIS (MYSQL)
// =========================================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ email và mật khẩu.' });
    }

    const user = await mysqlDb.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    if (user.status && user.status.toUpperCase() === 'INACTIVE') {
      return res.status(403).json({ message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ Admin.' });
    }

    // Cập nhật lần đăng nhập cuối vào MySQL
    await mysqlDb.updateUser(user.id, { lastLoginAt: new Date() });

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

    // Ghi nhật ký Audit Log vào MySQL
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

    const { password: _, ...safeUser } = user;
    res.json({
      message: 'Đăng nhập thành công.',
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
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng.' });
    }
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy thông tin tài khoản: ' + err.message });
  }
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
    res.json({ message: 'Đăng xuất thành công.' });
  } catch (err) {
    res.json({ message: 'Đăng xuất thành công.' });
  }
});

// =========================================================================
// USER MANAGEMENT APIS (DÀNH CHO ADMIN)
// =========================================================================
app.get('/api/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await mysqlDb.getUsers();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi tải danh sách người dùng từ MySQL: ' + err.message });
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
    res.status(500).json({ message: 'Lỗi tải nhật ký kiểm toán từ MySQL: ' + err.message });
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
    res.status(500).json({ message: 'Lỗi ghi nhật ký audit MySQL: ' + err.message });
  }
});

// =========================================================================
// PLC STATIONS APIS (MYSQL)
// =========================================================================
app.get('/api/plc-stations', authenticateToken, async (req, res) => {
  try {
    const stations = await mysqlDb.getPLCStations();
    res.json({ stations });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy danh sách trạm PLC: ' + err.message });
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

// Global Error Handlers để đảm bảo server hoạt động ổn định
process.on('uncaughtException', (err) => {
  console.error('[DENSO IoT Backend Uncaught Exception]:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[DENSO IoT Backend Unhandled Rejection]:', reason);
});

// Khởi chạy HTTP & WebSocket Server sau khi kết nối MySQL
server.on('error', (err) => {
  console.error('[DENSO IoT Server Error]:', err.message);
});

async function startServer() {
  try {
    await mysqlDb.initDatabase();
    server.listen(PORT, () => {
      console.log(`[DENSO IoT Backend] Server đang chạy tại http://localhost:${PORT}`);
      console.log(`[DENSO IoT Backend] CSDL MySQL: denso_iot@localhost:3306`);
      console.log(`[DENSO IoT Backend] WebSocket Server hoạt động tại ws://localhost:${PORT}/ws`);
      console.log(`[DENSO IoT Backend] Avatar Upload directory: ${avatarsDir}`);
    });
  } catch (err) {
    console.error('[FATAL] Không thể kết nối tới MySQL:', err.message);
    process.exit(1);
  }
}

startServer();
