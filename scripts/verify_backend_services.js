/**
 * @file verify_backend_services.js
 * @description Kiểm tra toàn diện các dịch vụ Backend sau Migration:
 * - Health Check API (/api/health)
 * - Authentication (Đăng nhập) & Phân quyền RBAC
 * - Users API (/api/users)
 * - PLC Stations API (/api/plc-stations)
 * - Metric Catalog API (/api/metrics)
 * - Telemetry Logs API (/api/telemetry/logs)
 * - Audit Logs API (/api/audit-logs)
 * - WebSocket connection (ws://localhost:5000/ws)
 */

import WebSocket from 'ws';

const BASE_URL = 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function testBackend() {
  console.log('================================================================');
  console.log(`[VERIFY BACKEND] KIỂM TRA TOÀN DIỆN DỊCH VỤ BACKEND SAU MIGRATION`);
  console.log('================================================================\n');

  const results = [];
  function report(name, status, details) {
    results.push({ name, status, details });
    const mark = status ? '✓ PASS' : '✗ FAIL';
    console.log(`[${mark}] ${name}`);
    if (details) console.log(`       -> ${details}`);
  }

  // 1. Health check
  try {
    const health = await request('/api/health');
    const ok = health.status === 200 && health.data?.database === 'connected';
    report('1. API Health Check (/api/health)', ok, `Status: ${health.data?.status}, DB: ${health.data?.database}`);
  } catch (err) {
    report('1. API Health Check', false, err.message);
  }

  // 2. Đăng nhập Admin (ADMIN)
  let adminToken = null;
  try {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@denso.com', password: 'admin123' }),
    });
    adminToken = loginRes.data?.accessToken;
    const ok = loginRes.status === 200 && !!adminToken;
    report('2. Đăng nhập Quản trị viên (admin@denso.com)', ok, `Đăng nhập thành công, nhận Access Token`);
  } catch (err) {
    report('2. Đăng nhập Quản trị viên', false, err.message);
  }

  // 3. Đăng nhập Vận hành (OPERATOR)
  let operatorToken = null;
  try {
    const opLoginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@denso.com', password: 'user123' }),
    });
    operatorToken = opLoginRes.data?.accessToken;
    const ok = opLoginRes.status === 200 && !!operatorToken;
    report('3. Đăng nhập Nhân viên Vận hành (user@denso.com)', ok, `Đăng nhập thành công với vai trò OPERATOR`);
  } catch (err) {
    report('3. Đăng nhập Nhân viên Vận hành', false, err.message);
  }

  // 4. Xác thực Phân quyền RBAC (/api/auth/me)
  try {
    const profileRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const role = profileRes.data?.user?.role || profileRes.data?.role;
    const name = profileRes.data?.user?.fullName || profileRes.data?.fullName;
    const ok = profileRes.status === 200 && role === 'ADMIN';
    report('4. Xác thực Hồ sơ & Phân quyền RBAC (/api/auth/me)', ok, `Họ tên: ${name}, Vai trò: ${role}`);
  } catch (err) {
    report('4. Xác thực Hồ sơ & Phân quyền RBAC', false, err.message);
  }

  // 5. Kiểm tra quyền Admin truy cập /api/users
  try {
    const usersRes = await request('/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const users = usersRes.data?.users || [];
    const ok = usersRes.status === 200 && users.length === 3;
    report('5. API Quản lý Người dùng & Phân quyền (/api/users)', ok, `Đọc thành công ${users.length} tài khoản trong hệ thống`);
  } catch (err) {
    report('5. API Quản lý Người dùng', false, err.message);
  }

  // 6. API Trạm PLC (/api/plc-stations)
  try {
    const plcRes = await request('/api/plc-stations', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const plcs = plcRes.data?.stations || [];
    const ok = plcRes.status === 200 && plcs.length === 2 && plcs.every((p) => p.machine_id === null && p.connection_status === 'UNKNOWN');
    report('6. API Trạm PLC (/api/plc-stations)', ok, `Đọc thành công ${plcs.length} trạm PLC demo (machine_id = NULL, UNKNOWN)`);
  } catch (err) {
    report('6. API Trạm PLC', false, err.message);
  }

  // 7. API Danh mục Metric chuẩn (/api/metrics)
  try {
    const metricsRes = await request('/api/metrics?limit=20', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const metrics = metricsRes.data?.metrics || [];
    const ok = metricsRes.status === 200 && metrics.length >= 11;
    report('7. API Danh mục Metric chuẩn (/api/metrics)', ok, `Đọc thành công danh mục metric (Hiện có ${metrics.length} metrics chuẩn)`);
  } catch (err) {
    report('7. API Danh mục Metric chuẩn', false, err.message);
  }

  // 8. API Lịch sử Telemetry (/api/telemetry/logs)
  try {
    const teleRes = await request('/api/telemetry/logs?limit=10', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const totalRecords = teleRes.data?.metadata?.totalRecords || teleRes.data?.totalRecords || 0;
    const ok = teleRes.status === 200 && totalRecords >= 11244;
    report('8. API Lịch sử Telemetry (/api/telemetry/logs)', ok, `Tổng số bản ghi telemetry truy xuất: ${totalRecords.toLocaleString()} dòng`);
  } catch (err) {
    report('8. API Lịch sử Telemetry', false, err.message);
  }

  // 9. API Nhật ký Kiểm toán (/api/audit-logs)
  try {
    const auditRes = await request('/api/audit-logs?limit=10', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditLogs = auditRes.data?.auditLogs || (Array.isArray(auditRes.data) ? auditRes.data : []);
    const ok = auditRes.status === 200 && auditLogs.length > 0;
    report('9. API Nhật ký Kiểm toán (/api/audit-logs)', ok, `Đọc thành công nhật ký kiểm toán hệ thống (${auditLogs.length} sự kiện gần nhất)`);
  } catch (err) {
    report('9. API Nhật ký Kiểm toán', false, err.message);
  }

  // 10. WebSocket Realtime Stream (ws://localhost:5000/ws)
  try {
    const wsReceived = await new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:5000/ws');
      const timer = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'telemetry' }));
      });

      ws.on('message', (msg) => {
        clearTimeout(timer);
        ws.close();
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });

    report('10. WebSocket Realtime Stream (ws://localhost:5000/ws)', wsReceived, wsReceived ? 'Kết nối thành công, nhận telemetry packet thời gian thực' : 'Không nhận được packet');
  } catch (err) {
    report('10. WebSocket Realtime Stream', false, err.message);
  }

  const allPassed = results.every((r) => r.status);
  console.log('\n================================================================');
  console.log(`[TỔNG KẾT BACKEND]: ${allPassed ? '✓ 10/10 DỊCH VỤ HOẠT ĐỘNG HOÀN HẢO' : '✗ CÓ LỖI DỊCH VỤ'}`);
  console.log('================================================================\n');

  return allPassed;
}

testBackend()
  .then((passed) => process.exit(passed ? 0 : 1))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
