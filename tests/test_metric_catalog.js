/**
 * @file test_metric_catalog.js
 * @description Bộ kiểm thử tự động toàn diện cho Module Danh Mục Metric (Metric Catalog)
 * - Kiểm tra Schema MySQL & Bảng metric_catalog
 * - Kiểm tra Seed Data tiêu chuẩn
 * - Kiểm tra Phân quyền RBAC (ADMIN, OPERATOR, MAINTENANCE)
 * - Kiểm tra Ràng buộc dữ liệu & Validation (Code format, Code duplicate, Min < Max)
 * - Kiểm tra REST API: GET, POST, PUT, PATCH, GET /usage
 * - Kiểm tra Ghi nhận Nhật ký Kiểm toán (Audit Logs)
 */

import http from 'http';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const DB_NAME = process.env.DB_NAME || 'denso_iot';

const SERVER_PORT = 5001; // Port test tránh trùng lặp nếu server chính đang chạy

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error('Request timeout'));
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG MODULE METRIC CATALOG ===\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedCount++;
    }
  }

  // 1. Kiểm tra CSDL MySQL
  console.log('--- 1. KIỂM TRA SCHEMA VÀ SEED DATA CSDL MYSQL ---');
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  const [tables] = await conn.query("SHOW TABLES LIKE 'metric_catalog'");
  assert(tables.length > 0, "Bảng 'metric_catalog' tồn tại trong CSDL MySQL");

  const [cols] = await conn.query('DESCRIBE metric_catalog');
  const colNames = cols.map((c) => c.Field);
  const requiredCols = ['id', 'code', 'name', 'category', 'unit', 'dataType', 'validMin', 'validMax', 'description', 'status', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'];
  for (const rc of requiredCols) {
    assert(colNames.includes(rc), `Trường '${rc}' có mặt trong bảng metric_catalog`);
  }

  const [seedRows] = await conn.query('SELECT COUNT(*) as count FROM metric_catalog');
  assert(seedRows[0].count >= 10, `Bảng metric_catalog đã có dữ liệu seed (${seedRows[0].count} bản ghi)`);

  // 2. Khởi động server test
  console.log('\n--- 2. KHỞI ĐỘNG EXPRESS SERVER VÀ XÁC THỰC RBAC ---');
  // Dynamic import server
  process.env.PORT = String(SERVER_PORT);
  const serverModule = await import('../server/index.js');
  // Chờ 1.5s để server khởi động và kết nối db
  await new Promise((r) => setTimeout(r, 1500));

  // Đăng nhập 3 vai trò để lấy JWT Tokens
  async function login(email, password) {
    const res = await makeRequest({
      hostname: 'localhost',
      port: SERVER_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email, password });
    return res.body?.accessToken;
  }

  const adminToken = await login('admin@denso.com', 'admin123');
  const operatorToken = await login('user@denso.com', 'user123');
  const maintToken = await login('tech@denso.com', 'tech123');

  assert(!!adminToken, 'Đăng nhập ADMIN thành công, nhận Bearer JWT');
  assert(!!operatorToken, 'Đăng nhập OPERATOR thành công, nhận Bearer JWT');
  assert(!!maintToken, 'Đăng nhập MAINTENANCE thành công, nhận Bearer JWT');

  // 3. Kiểm tra GET /api/metrics (Phân trang, bộ lọc)
  console.log('\n--- 3. KIỂM TRA GET /api/metrics (DANH SÁCH, PHÂN TRANG & BỘ LỌC) ---');
  const listRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics?page=1&limit=5',
    method: 'GET',
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(listRes.status === 200, 'OPERATOR truy cập GET /api/metrics trả về mã 200 OK (Read-only)');
  assert(Array.isArray(listRes.body?.metrics), 'Trả về mảng metrics hợp lệ');
  assert(listRes.body?.metrics.length <= 5, 'Phân trang limit=5 hoạt động chính xác');
  assert(listRes.body?.summary?.total >= 10, 'Summary thống kê tổng số metric chính xác');

  // Lọc theo Category
  const filterCatRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics?category=Temperature',
    method: 'GET',
    headers: { Authorization: `Bearer ${maintToken}` },
  });
  assert(filterCatRes.status === 200, 'MAINTENANCE lọc theo category=Temperature thành công');
  const allTemp = (filterCatRes.body?.metrics || []).every((m) => m.category === 'Temperature');
  assert(allTemp, 'Tất cả kết quả lọc đều thuộc nhóm Temperature');

  // 4. Kiểm tra RBAC trên các thao tác ghi (POST / PUT / PATCH)
  console.log('\n--- 4. KIỂM TRA BẢO VỆ PHÂN QUYỀN RBAC (OPERATOR/MAINTENANCE BỊ TỪ CHỐI) ---');
  const testPayload = {
    code: 'TEST_METRIC_ROLES',
    name: 'Metric Thử Nghiệm Quyền',
    category: 'Pressure',
    unit: 'bar',
    dataType: 'FLOAT',
    validMin: 0,
    validMax: 100,
  };

  const opPostRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${operatorToken}`,
      'Content-Type': 'application/json',
    },
  }, testPayload);
  assert(opPostRes.status === 403, 'OPERATOR POST /api/metrics bị chặn với 403 Forbidden');

  const maintPostRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${maintToken}`,
      'Content-Type': 'application/json',
    },
  }, testPayload);
  assert(maintPostRes.status === 403, 'MAINTENANCE POST /api/metrics bị chặn với 403 Forbidden');

  // 5. Kiểm tra Ràng buộc Dữ liệu & Validation
  console.log('\n--- 5. KIỂM TRA RÀNG BUỘC DỮ LIỆU & VALIDATION ---');
  // a) Mã không đúng định dạng (có ký tự đặc biệt / chữ thường)
  const invalidCodeRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, { ...testPayload, code: 'invalid-code-123!' });
  assert(invalidCodeRes.status === 400, 'Mã metric sai format (chứa dấu gạch ngang/chấm than) bị từ chối 400 Bad Request');

  // b) validMin >= validMax
  const invalidRangeRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, { ...testPayload, code: 'TEST_RANGE_ERR', validMin: 150, validMax: 50 });
  assert(invalidRangeRes.status === 400, 'validMin (150) >= validMax (50) bị từ chối với thông báo lỗi hợp lý');

  // c) Trùng mã code với metric đã có (TEMPERATURE)
  const dupCodeRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, { ...testPayload, code: 'TEMPERATURE' });
  assert(dupCodeRes.status === 400, 'Trùng mã code TEMPERATURE bị từ chối 400 Duplicate');

  // 6. Kiểm tra ADMIN Thêm mới Metric thành công (POST)
  console.log('\n--- 6. KIỂM TRA ADMIN THÊM MỚI METRIC (POST) ---');
  const validMetricCode = `TEST_ACCEL_${Date.now()}`;
  const createRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    code: validMetricCode,
    name: 'Gia tốc rung động 3 trục',
    category: 'Vibration',
    unit: 'm/s2',
    dataType: 'FLOAT',
    validMin: 0,
    validMax: 200,
    description: 'Đo gia tốc rung của cụm trục chính phục vụ bảo trì dự đoán',
    status: 'ACTIVE',
  });
  assert(createRes.status === 201, 'ADMIN tạo metric mới thành công, mã 201 Created');
  const createdMetric = createRes.body?.metric;
  assert(createdMetric?.code === validMetricCode, 'Mã metric trả về đúng dữ liệu vừa tạo');
  assert(createdMetric?.category === 'Vibration', 'Category là Vibration');
  assert(createdMetric?.validMin === 0 && createdMetric?.validMax === 200, 'Range [0 ... 200] lưu chính xác');

  // 7. Kiểm tra GET /api/metrics/:id và GET /api/metrics/:id/usage
  console.log('\n--- 7. KIỂM TRA CHI TIẾT METRIC & TRA CỨU SỬ DỤNG (/usage) ---');
  const getSingleRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: `/api/metrics/${createdMetric.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  assert(getSingleRes.status === 200, `Truy vấn metric theo id (${createdMetric.id}) thành công`);

  // Kiểm tra usage của TEMPERATURE (được dùng trong telemetry)
  const usageRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/metrics/TEMPERATURE/usage',
    method: 'GET',
    headers: { Authorization: `Bearer ${maintToken}` },
  });
  assert(usageRes.status === 200, 'Tra cứu sử dụng GET /api/metrics/TEMPERATURE/usage thành công');
  assert(typeof usageRes.body?.usage?.usageCount === 'number', 'Kết quả trả về usageCount chính xác');

  // 8. Kiểm tra Cập nhật thông tin (PUT)
  console.log('\n--- 8. KIỂM TRA CẬP NHẬT THÔNG TIN METRIC (PUT) ---');
  const updateRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: `/api/metrics/${createdMetric.id}`,
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    name: 'Gia tốc rung động 3 trục (Hiệu chỉnh)',
    validMax: 250,
    description: 'Đã cập nhật dải đo lên 250 m/s2',
  });
  assert(updateRes.status === 200, 'ADMIN cập nhật metric thành công, trả về 200 OK');
  assert(updateRes.body?.metric?.name === 'Gia tốc rung động 3 trục (Hiệu chỉnh)', 'Tên đã được cập nhật');
  assert(updateRes.body?.metric?.validMax === 250, 'validMax đã được nâng lên 250');

  // 9. Kiểm tra Đổi trạng thái Kích hoạt / Vô hiệu hóa (PATCH /status)
  console.log('\n--- 9. KIỂM TRA ĐỔI TRẠNG THÁI (PATCH /status) ---');
  // Deactivate
  const deactRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: `/api/metrics/${createdMetric.id}/status`,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, { status: 'INACTIVE' });
  assert(deactRes.status === 200, 'Vô hiệu hóa metric thành công');
  assert(deactRes.body?.metric?.status === 'INACTIVE', 'Trạng thái chuyển sang INACTIVE');

  // Reactivate
  const reactRes = await makeRequest({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: `/api/metrics/${createdMetric.id}/status`,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  }, { status: 'ACTIVE' });
  assert(reactRes.status === 200, 'Kích hoạt lại metric thành công');
  assert(reactRes.body?.metric?.status === 'ACTIVE', 'Trạng thái trở lại ACTIVE');

  // 10. Kiểm tra Audit Logs
  console.log('\n--- 10. KIỂM TRA GHI NHẬN AUDIT LOGS ---');
  const [auditRows] = await conn.query(
    "SELECT action, target, details FROM audit_logs WHERE target = ? ORDER BY timestamp ASC",
    [validMetricCode]
  );
  const actions = auditRows.map((a) => a.action);
  assert(actions.includes('CREATE_METRIC'), "Có ghi log 'CREATE_METRIC'");
  assert(actions.includes('UPDATE_METRIC'), "Có ghi log 'UPDATE_METRIC'");
  assert(actions.includes('DEACTIVATE_METRIC'), "Có ghi log 'DEACTIVATE_METRIC'");
  assert(actions.includes('ACTIVATE_METRIC'), "Có ghi log 'ACTIVATE_METRIC'");

  // Dọn dẹp bản ghi test
  await conn.query('DELETE FROM metric_catalog WHERE id = ?', [createdMetric.id]);
  await conn.query('DELETE FROM audit_logs WHERE target = ?', [validMetricCode]);
  await conn.end();

  console.log('\n======================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log('======================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Lỗi thực thi kiểm thử:', err);
  process.exit(1);
});
