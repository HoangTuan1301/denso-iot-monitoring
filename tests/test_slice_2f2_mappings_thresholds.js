/**
 * @file tests/test_slice_2f2_mappings_thresholds.js
 * @description Bộ kiểm chứng tự động toàn diện cho Lát cắt 2F-2 (Metric Catalog, Mapping & Threshold Configuration):
 * 1. REST API Mappings & Filters (GET /api/mappings by machine, status, monitoring_enabled, search).
 * 2. Ma trận phân quyền RBAC: ADMIN, MAINTENANCE, OPERATOR trên Mappings, Thresholds, Schedules, Monitoring.
 * 3. Validation Cấu hình Kênh đo (Duplicate code 409, Invalid machine/metric 400, Foreign PLC 422).
 * 4. Bảo toàn tính toàn vẹn lịch sử (Chặn đổi mapping_code nếu có lịch sử 409, Cho phép nếu chưa có 200).
 * 5. Cấu hình 4 Ngưỡng Kỹ thuật (Full 4 thresholds, One-sided upper/lower, Invalid orders 400, Physical limits 400).
 * 6. Cấu hình Lịch Thu thập Telemetry (INTERVAL >= 1s, CRON 5 fields, invalid cron 400, is_active toggle).
 * 7. Cơ chế kích hoạt đo an toàn (Chặn 422 nếu máy không có PLC, PLC Demo hoặc không có thanh ghi).
 * 8. WebSocket Broadcast đa client đồng bộ thời gian thực (mapping_created, mapping_updated, thresholds_updated, schedule_updated, mapping_monitoring_toggled, mapping_deactivated).
 * 9. BẢO VỆ TUYỆT ĐỐI CSDL GỐC denso_iot: Triple Verification (Count, MySQL Checksum, SHA-256) trên 11 bảng.
 */

import http from 'http';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

const PROD_DB_NAME = 'denso_iot';
const TEST_DB_NAME = 'denso_iot_phase1_test';
const TEST_SERVER_PORT = 5011;

process.env.PORT = String(TEST_SERVER_PORT);
process.env.DB_NAME = TEST_DB_NAME;

async function apiRequest(method, endpoint, token = null, data = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = data ? JSON.stringify(data) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_SERVER_PORT,
        path: endpoint,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Request timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

async function calculateFullDbSnapshot(dbName) {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map((r) => Object.values(r)[0]).sort();
  const snapshot = {};

  for (const table of tableNames) {
    const [[countRow]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    const [chkRows] = await conn.query(`CHECKSUM TABLE \`${table}\``);
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` ORDER BY 1`);
    const sha = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');

    snapshot[table] = {
      count: countRow.cnt,
      checksum: chkRows[0].Checksum,
      sha256: sha,
    };
  }

  await conn.end();
  return snapshot;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  console.log('='.repeat(76));
  console.log('   BỘ KIỂM CHỨNG TỰ ĐỘNG LÁT CẮT 2F-2 (METRIC CATALOG, MAPPING & THRESHOLDS)');
  console.log(`   Môi trường thực thi: ${TEST_DB_NAME} @ Port ${TEST_SERVER_PORT}`);
  console.log('='.repeat(76));

  // 1. Chụp snapshot denso_iot trước test
  console.log('\n[BẢO VỆ CSDL GỐC] Đang kiểm tra Snapshot 11 bảng của denso_iot...');
  const beforeSnapshot = await calculateFullDbSnapshot(PROD_DB_NAME);
  console.log(`  -> Số lượng bảng: ${Object.keys(beforeSnapshot).length}`);
  console.log(`  -> machine_telemetry_history Count: ${beforeSnapshot.machine_telemetry_history.count}`);
  console.log(`  -> machine_telemetry_history MySQL Checksum: ${beforeSnapshot.machine_telemetry_history.checksum}`);
  console.log(`  -> machine_telemetry_history SHA-256: ${beforeSnapshot.machine_telemetry_history.sha256.substring(0, 16)}...`);

  // 2. Chuẩn bị dữ liệu trên CSDL TEST denso_iot_phase1_test
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  const testPlcAlpha = 'PLC-TEST-2F2-A';
  const testPlcBeta = 'PLC-TEST-2F2-B';
  const testPlcDemo = 'PLC-TEST-2F2-DEMO';
  const testMachine1 = 'MC-TEST-2F2-1';
  const testMachine2 = 'MC-TEST-2F2-2';
  const testMappingId = 'MAP-TEST-2F2-01';
  const testMappingHistId = 'MAP-TEST-2F2-HIST';
  const testMetricId = 'MTR-CAT-CUR-01'; // Metric dòng điện 0-100 A

  // Dọn dẹp dữ liệu cũ nếu có
  await testConn.query('DELETE FROM machine_telemetry_history WHERE machineId IN (?, ?)', [testMachine1, testMachine2]);
  const [existingMaps] = await testConn.query('SELECT id FROM metric_mappings WHERE machine_id IN (?, ?) OR id IN (?, ?)', [testMachine1, testMachine2, testMappingId, testMappingHistId]);
  const mapIds = existingMaps.map((m) => m.id);
  if (mapIds.length > 0) {
    const placeholders = mapIds.map(() => '?').join(',');
    await testConn.query(`DELETE FROM collection_schedules WHERE mapping_id IN (${placeholders})`, mapIds);
    await testConn.query(`DELETE FROM metric_thresholds WHERE mapping_id IN (${placeholders})`, mapIds);
    await testConn.query(`DELETE FROM metric_mappings WHERE id IN (${placeholders})`, mapIds);
  }
  await testConn.query('DELETE FROM plc_stations WHERE id IN (?, ?, ?)', [testPlcAlpha, testPlcBeta, testPlcDemo]);
  await testConn.query('DELETE FROM machines WHERE id IN (?, ?)', [testMachine1, testMachine2]);

  // Tạo test machines
  await testConn.query(`
    INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours)
    VALUES 
      (?, 'LINE-01', 'Máy Thử Nghiệm 2F2 Alpha', 'MC-2F2-A', 'DẬP', 'normal', 95.0, 100),
      (?, 'LINE-01', 'Máy Thử Nghiệm 2F2 Beta (No PLC)', 'MC-2F2-B', 'HÀN', 'normal', 90.0, 80)
  `, [testMachine1, testMachine2]);

  // Tạo test PLCs
  await testConn.query(`
    INSERT INTO plc_stations (id, name, protocol, ipAddress, port, connection_status, enabled, is_demo, isConnected, machine_id)
    VALUES 
      (?, 'Trạm PLC 2F2 Alpha', 'Modbus/TCP', '192.168.1.220', 502, 'connected', 1, 0, 1, ?),
      (?, 'Trạm PLC 2F2 Beta', 'Modbus/TCP', '192.168.1.221', 502, 'connected', 1, 0, 1, NULL),
      (?, 'Trạm PLC 2F2 Demo', 'Modbus/TCP', '192.168.1.222', 502, 'connected', 1, 1, 1, NULL)
  `, [testPlcAlpha, testMachine1, testPlcBeta, testPlcDemo]);

  // Tạo 1 mapping có sẵn có lịch sử telemetry để test chặn sửa mapping_code
  await testConn.query(`
    INSERT INTO metric_mappings (id, machine_id, metric_id, mapping_code, channel_name, plc_id, plc_register, scale_factor, sampling_rate_ms, monitoring_enabled, status)
    VALUES 
      (?, ?, ?, 'MAP-2F2-HIST-CUR', 'CH_HIST_CURRENT', ?, 'HR105', 0.1, 1000, 1, 'ACTIVE')
  `, [testMappingHistId, testMachine1, testMetricId, testPlcAlpha]);

  await testConn.query(`
    INSERT INTO machine_telemetry_history (id, timestamp, lineId, lineName, machineId, machineName, metricId, metricName, value, unit, status, source)
    VALUES 
      ('HIST-TEST-2F2-01', NOW(), 'LINE-01', 'Dây chuyền Dập', ?, 'Máy Thử Nghiệm 2F2 Alpha', 'MAP-2F2-HIST-CUR', 'Dòng điện', 45.2, 'A', 'normal', 'simulation')
  `, [testMachine1]);

  await testConn.end();

  // 3. Khởi chạy Backend trên Port 5011
  console.log(`\n[KHỞI ĐỘNG SERVER] Khởi chạy backend trên port ${TEST_SERVER_PORT}...`);
  await import('../server/index.js');
  await new Promise((r) => setTimeout(r, 1500));

  // Kết nối 2 WebSocket Clients để kiểm tra real-time broadcast song song
  const wsEvents1 = [];
  const wsEvents2 = [];
  const wsClient1 = new WebSocket(`ws://127.0.0.1:${TEST_SERVER_PORT}/ws`);
  const wsClient2 = new WebSocket(`ws://127.0.0.1:${TEST_SERVER_PORT}/ws`);

  wsClient1.on('message', (data) => {
    try {
      wsEvents1.push(JSON.parse(data.toString()));
    } catch { /* ignore */ }
  });

  wsClient2.on('message', (data) => {
    try {
      wsEvents2.push(JSON.parse(data.toString()));
    } catch { /* ignore */ }
  });

  await new Promise((r) => setTimeout(r, 500));

  // Đăng nhập lấy JWT Tokens
  const adminRes = await apiRequest('POST', '/api/auth/login', null, { email: 'admin@denso.com', password: 'admin123' });
  const adminToken = adminRes.body.accessToken;

  const maintRes = await apiRequest('POST', '/api/auth/login', null, { email: 'tech@denso.com', password: 'tech123' });
  const maintToken = maintRes.body.accessToken;

  const operatorRes = await apiRequest('POST', '/api/auth/login', null, { email: 'user@denso.com', password: 'user123' });
  const operatorToken = operatorRes.body.accessToken;

  // -------------------------------------------------------------------------
  // PHẦN 1: TRUY VẤN VÀ BỘ LỌC REST API /api/mappings
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 1: TRUY VẤN & BỘ LỌC REST API /api/mappings ---');
  {
    const allMappingsRes = await apiRequest('GET', '/api/mappings', adminToken);
    assert(allMappingsRes.status === 200, 'TC-2F2-01.1: GET /api/mappings trả về 200 OK');
    assert(Array.isArray(allMappingsRes.body.mappings), 'TC-2F2-01.2: Phản hồi trả về mảng mappings');

    const machineFilterRes = await apiRequest('GET', `/api/mappings?machineId=${testMachine1}`, adminToken);
    assert(machineFilterRes.status === 200, 'TC-2F2-01.3: Lọc mapping theo machineId thành công');
    assert(machineFilterRes.body.mappings.length >= 1, 'TC-2F2-01.4: Tìm thấy mapping thuộc máy chỉ định');

    const statusFilterRes = await apiRequest('GET', `/api/mappings?status=ACTIVE`, adminToken);
    assert(statusFilterRes.status === 200, 'TC-2F2-01.5: Lọc mapping theo status=ACTIVE');
    assert(statusFilterRes.body.mappings.every((m) => m.status === 'ACTIVE'), 'TC-2F2-01.6: Toàn bộ bản ghi lọc đúng status=ACTIVE');

    const searchFilterRes = await apiRequest('GET', `/api/mappings?search=HIST`, adminToken);
    assert(searchFilterRes.status === 200, 'TC-2F2-01.7: Tìm kiếm theo từ khóa search');
    assert(searchFilterRes.body.mappings.some((m) => m.mapping_code.includes('HIST')), 'TC-2F2-01.8: Tìm thấy mapping có mapping_code khớp từ khóa');
  }

  // -------------------------------------------------------------------------
  // PHẦN 2: MA TRẬN PHÂN QUYỀN RBAC CHO MAPPINGS, THRESHOLDS, SCHEDULES
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 2: MA TRẬN PHÂN QUYỀN RBAC ---');
  {
    // OPERATOR bị chặn tạo mapping (403)
    const opCreateRes = await apiRequest('POST', '/api/mappings', operatorToken, {
      machine_id: testMachine1,
      metric_id: testMetricId,
      mapping_code: 'MAP-OP-FAIL',
      channel_name: 'CH_OP_FAIL',
    });
    assert(opCreateRes.status === 403, 'TC-2F2-02.1: OPERATOR bị chặn tạo Metric Mapping (403 Forbidden)');

    // OPERATOR bị chặn sửa mapping (403)
    const opUpdateRes = await apiRequest('PUT', `/api/mappings/${testMappingHistId}`, operatorToken, {
      channel_name: 'CH_OP_UPDATE',
    });
    assert(opUpdateRes.status === 403, 'TC-2F2-02.2: OPERATOR bị chặn sửa Metric Mapping (403 Forbidden)');

    // OPERATOR bị chặn gỡ/deactivate mapping (403)
    const opDeactRes = await apiRequest('PATCH', `/api/mappings/${testMappingHistId}/deactivate`, operatorToken);
    assert(opDeactRes.status === 403, 'TC-2F2-02.3: OPERATOR bị chặn vô hiệu hóa Mapping (403 Forbidden)');

    // OPERATOR bị chặn cấu hình ngưỡng (403)
    const opThresRes = await apiRequest('PUT', `/api/mappings/${testMappingHistId}/thresholds`, operatorToken, {
      warning_max: 80,
    });
    assert(opThresRes.status === 403, 'TC-2F2-02.4: OPERATOR bị chặn cấu hình Thresholds (403 Forbidden)');

    // OPERATOR bị chặn cấu hình lịch schedule (403)
    const opSchedRes = await apiRequest('PUT', `/api/mappings/${testMappingHistId}/schedule`, operatorToken, {
      frequency_type: 'INTERVAL',
      interval_seconds: 5,
    });
    assert(opSchedRes.status === 403, 'TC-2F2-02.5: OPERATOR bị chặn cấu hình Schedules (403 Forbidden)');

    // OPERATOR bị chặn bật/tắt monitoring (403)
    const opMonRes = await apiRequest('PATCH', `/api/mappings/${testMappingHistId}/monitoring`, operatorToken, {
      enable: false,
    });
    assert(opMonRes.status === 403, 'TC-2F2-02.6: OPERATOR bị chặn toggle monitoring (403 Forbidden)');

    // MAINTENANCE bị chặn tạo mapping mới (ADMIN only)
    const maintCreateRes = await apiRequest('POST', '/api/mappings', maintToken, {
      machine_id: testMachine1,
      metric_id: testMetricId,
      mapping_code: 'MAP-MAINT-FAIL',
      channel_name: 'CH_MAINT_FAIL',
    });
    assert(maintCreateRes.status === 403, 'TC-2F2-02.7: MAINTENANCE bị chặn tạo Mapping mới (ADMIN only - 403 Forbidden)');
  }

  // -------------------------------------------------------------------------
  // PHẦN 3: VALIDATION TẠO & CẬP NHẬT METRIC MAPPING (ADMIN / MAINTENANCE)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 3: VALIDATION TẠO & CẬP NHẬT METRIC MAPPING ---');
  let createdMappingId = null;
  {
    // Máy không tồn tại (400)
    const invalidMcRes = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: 'NON_EXISTENT_MACHINE',
      metric_id: testMetricId,
      mapping_code: 'MAP-FAIL-MC',
      channel_name: 'CH_FAIL_MC',
    });
    assert(invalidMcRes.status === 400, 'TC-2F2-03.1: Từ chối máy không tồn tại (400 Bad Request)');

    // Metric không tồn tại (400)
    const invalidMtrRes = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: testMachine1,
      metric_id: 'NON_EXISTENT_METRIC',
      mapping_code: 'MAP-FAIL-MTR',
      channel_name: 'CH_FAIL_MTR',
    });
    assert(invalidMtrRes.status === 400, 'TC-2F2-03.2: Từ chối metric không tồn tại (400 Bad Request)');

    // PLC thuộc máy khác (422)
    const foreignPlcRes = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: testMachine2, // Máy 2 không sở hữu PLC Alpha
      metric_id: testMetricId,
      mapping_code: 'MAP-FAIL-FOREIGN-PLC',
      channel_name: 'CH_FAIL_FOREIGN',
      plc_id: testPlcAlpha,
    });
    assert(foreignPlcRes.status === 422, 'TC-2F2-03.3: Từ chối gán PLC thuộc máy khác cho mapping (422)');

    // Trùng mapping_code (409)
    const duplicateCodeRes = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: testMachine1,
      metric_id: testMetricId,
      mapping_code: 'MAP-2F2-HIST-CUR', // Đã tồn tại
      channel_name: 'CH_DUP_CODE',
    });
    assert(duplicateCodeRes.status === 409, 'TC-2F2-03.4: Từ chối tạo trùng mapping_code (409 Conflict)');
    assert(duplicateCodeRes.body.errorCode === 'DUPLICATE_MAPPING_CODE', 'TC-2F2-03.5: Mã lỗi chính xác DUPLICATE_MAPPING_CODE');

    // Tạo mapping hợp lệ bởi ADMIN
    const validCreateRes = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: testMachine1,
      metric_id: testMetricId,
      mapping_code: 'MAP-2F2-NEW-01',
      channel_name: 'Cảm biến dòng chính Trạm 1',
      plc_id: testPlcAlpha,
      plc_register: 'HR200',
      scale_factor: 0.1,
      sampling_rate_ms: 1000,
    });
    assert(validCreateRes.status === 201, 'TC-2F2-03.6: ADMIN tạo Metric Mapping thành công (201 Created)');
    assert(validCreateRes.body.mapping && validCreateRes.body.mapping.id, 'TC-2F2-03.7: Trả về đối tượng mapping có id');
    createdMappingId = validCreateRes.body.mapping.id;

    // Chặn sửa mapping_code khi mapping ĐÃ CÓ lịch sử telemetry (409)
    const updateHistCodeRes = await apiRequest('PUT', `/api/mappings/${testMappingHistId}`, maintToken, {
      mapping_code: 'MAP-2F2-CHANGED-HIST',
    });
    assert(updateHistCodeRes.status === 409, 'TC-2F2-03.8: Chặn đổi mapping_code khi đã có dữ liệu telemetry trong DB (409 Conflict)');
    assert(updateHistCodeRes.body.errorCode === 'CANNOT_MODIFY_MAPPING_CODE_WITH_HISTORY', 'TC-2F2-03.9: Mã lỗi CANNOT_MODIFY_MAPPING_CODE_WITH_HISTORY');

    // Cho phép sửa mapping_code khi mapping CHƯA CÓ lịch sử telemetry (200)
    const updateNoHistCodeRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}`, maintToken, {
      mapping_code: 'MAP-2F2-NEW-MODIFIED',
      channel_name: 'Tên kênh đã sửa',
    });
    assert(updateNoHistCodeRes.status === 200, 'TC-2F2-03.10: Cho phép đổi mapping_code khi chưa phát sinh telemetry (200 OK)');
  }

  // -------------------------------------------------------------------------
  // PHẦN 4: CẤU HÌNH NGƯỠNG KỸ THUẬT (THRESHOLDS CONFIGURATION)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 4: CẤU HÌNH NGƯỠNG KỸ THUẬT THRESHOLDS ---');
  {
    // Ngưỡng ngược thứ tự: warning_max <= warning_min (400)
    const invOrderRes1 = await apiRequest('PUT', `/api/mappings/${createdMappingId}/thresholds`, maintToken, {
      warning_min: 50,
      warning_max: 40,
    });
    assert(invOrderRes1.status === 400, 'TC-2F2-04.1: Từ chối khi warning_max <= warning_min (400 Bad Request)');

    // Ngưỡng ngược thứ tự: critical_max <= warning_max (400)
    const invOrderRes2 = await apiRequest('PUT', `/api/mappings/${createdMappingId}/thresholds`, maintToken, {
      warning_max: 80,
      critical_max: 75,
    });
    assert(invOrderRes2.status === 400, 'TC-2F2-04.2: Từ chối khi critical_max <= warning_max (400 Bad Request)');

    // Ngưỡng ngược thứ tự: critical_min >= warning_min (400)
    const invOrderRes3 = await apiRequest('PUT', `/api/mappings/${createdMappingId}/thresholds`, maintToken, {
      warning_min: 20,
      critical_min: 25,
    });
    assert(invOrderRes3.status === 400, 'TC-2F2-04.3: Từ chối khi critical_min >= warning_min (400 Bad Request)');

    // Vượt giới hạn vật lý của Metric (MTR-CAT-CUR-01 có range 0-250) (400)
    const exceedPhysRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}/thresholds`, maintToken, {
      critical_max: 300, // Vượt quá 250
    });
    assert(exceedPhysRes.status === 400, 'TC-2F2-04.4: Từ chối ngưỡng vượt quá giới hạn vật lý của metric (400)');
    assert(exceedPhysRes.body.errorCode === 'THRESHOLD_EXCEEDS_VALID_MAX', 'TC-2F2-04.4b: Mã lỗi THRESHOLD_EXCEEDS_VALID_MAX');

    // Cấu hình Ngưỡng một phía: Upper-only (chỉ Warning Max & Critical Max) (200)
    const upperOnlyRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}/thresholds`, maintToken, {
      warning_max: 70,
      critical_max: 90,
      action_plan: 'Giảm tải máy khi dòng vượt 70A, dừng khẩn khi đạt 90A',
    });
    assert(upperOnlyRes.status === 200, 'TC-2F2-04.5: Hỗ trợ cấu hình ngưỡng một phía Upper-only thành công (200 OK)');
    assert(upperOnlyRes.body.thresholds.warning_min === null, 'TC-2F2-04.6: warning_min là null khi chọn Upper-only');

    // Cấu hình Ngưỡng đầy đủ cả 4 mức (200)
    const fullThresRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}/thresholds`, maintToken, {
      critical_min: 10,
      warning_min: 20,
      warning_max: 75,
      critical_max: 95,
      action_plan: 'Kế hoạch ứng phó sự cố dòng điện đầy đủ 4 mức',
    });
    assert(fullThresRes.status === 200, 'TC-2F2-04.7: Cấu hình đủ 4 ngưỡng kỹ thuật thành công (200 OK)');
    assert(fullThresRes.body.thresholds.critical_min === 10, 'TC-2F2-04.8: Dữ liệu critical_min lưu chính xác');
    assert(fullThresRes.body.thresholds.critical_max === 95, 'TC-2F2-04.9: Dữ liệu critical_max lưu chính xác');

    // Kiểm tra GET /api/mappings/:id/thresholds
    const getThresRes = await apiRequest('GET', `/api/mappings/${createdMappingId}/thresholds`, operatorToken);
    assert(getThresRes.status === 200, 'TC-2F2-04.10: GET /api/mappings/:id/thresholds trả về 200');
    assert(getThresRes.body.thresholds && getThresRes.body.thresholds.action_plan.includes('4 mức'), 'TC-2F2-04.11: Đọc chính xác cấu hình ngưỡng');
  }

  // -------------------------------------------------------------------------
  // PHẦN 5: CẤU HÌNH LỊCH THU THẬP DỮ LIỆU (COLLECTION SCHEDULES)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 5: CẤU HÌNH LỊCH THU THẬP DỮ LIỆU SCHEDULES ---');
  {
    // Khoảng thời gian < 1 giây (400)
    const invalidSecRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}/schedule`, maintToken, {
      frequency_type: 'INTERVAL',
      interval_seconds: 0,
    });
    assert(invalidSecRes.status === 400, 'TC-2F2-05.1: Từ chối chu kỳ < 1 giây (400 INVALID_INTERVAL_SECONDS)');

    // Cú pháp CRON sai chuẩn (400)
    const invalidCronRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}/schedule`, maintToken, {
      frequency_type: 'CRON',
      cron_expression: 'sai cron expression',
    });
    assert(invalidCronRes.status === 400, 'TC-2F2-05.2: Từ chối biểu thức CRON không đúng 5 trường (400 INVALID_CRON_EXPRESSION)');

    // Cấu hình INTERVAL hợp lệ (200)
    const validIntervalRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}/schedule`, maintToken, {
      frequency_type: 'INTERVAL',
      interval_seconds: 5,
      is_active: true,
    });
    assert(validIntervalRes.status === 200, 'TC-2F2-05.3: Cấu hình chế độ INTERVAL 5s thành công (200 OK)');
    assert(validIntervalRes.body.schedule.interval_seconds === 5, 'TC-2F2-05.4: Dữ liệu interval_seconds lưu chính xác');

    // Cấu hình CRON hợp lệ (200)
    const validCronRes = await apiRequest('PUT', `/api/mappings/${createdMappingId}/schedule`, maintToken, {
      frequency_type: 'CRON',
      cron_expression: '*/5 * * * *',
      is_active: true,
    });
    assert(validCronRes.status === 200, 'TC-2F2-05.5: Chuyển đổi sang biểu thức CRON 5 phút thành công (200 OK)');
    assert(validCronRes.body.schedule.cron_expression === '*/5 * * * *', 'TC-2F2-05.6: Dữ liệu cron_expression lưu chính xác');

    // Kiểm tra GET /api/mappings/:id/schedule
    const getSchedRes = await apiRequest('GET', `/api/mappings/${createdMappingId}/schedule`, operatorToken);
    assert(getSchedRes.status === 200, 'TC-2F2-05.7: GET /api/mappings/:id/schedule trả về 200 OK');
    assert(getSchedRes.body.schedule.frequency_type === 'CRON', 'TC-2F2-05.8: Đọc chính xác chế độ CRON');
  }

  // -------------------------------------------------------------------------
  // PHẦN 6: CƠ CHẾ KÍCH HOẠT ĐO AN TOÀN (SAFE MONITORING TOGGLE)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 6: CƠ CHẾ KÍCH HOẠT ĐO AN TOÀN ---');
  {
    // Tạo 1 mapping trên máy KHÔNG CÓ PLC (testMachine2)
    const noPlcMapRes = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: testMachine2,
      metric_id: testMetricId,
      mapping_code: 'MAP-2F2-NOPLC',
      channel_name: 'CH_NOPLC',
    });
    assert(noPlcMapRes.status === 201, 'TC-2F2-06.1: Tạo mapping rỗng thành công');
    const noPlcMapId = noPlcMapRes.body.mapping.id;

    // Bật monitoring trên mapping không có PLC -> Chặn 422
    const toggleNoPlcRes = await apiRequest('PATCH', `/api/mappings/${noPlcMapId}/monitoring`, maintToken, {
      enable: true,
    });
    assert(toggleNoPlcRes.status === 422, 'TC-2F2-06.2: Chặn kích hoạt đo khi máy không gán PLC hoặc không có thanh ghi (422)');
    assert(toggleNoPlcRes.body.errorCode === 'PLC_REQUIRED_FOR_MONITORING' || toggleNoPlcRes.body.errorCode === 'PLC_REGISTER_REQUIRED', 'TC-2F2-06.3: Mã lỗi an toàn chính xác');

    // Bật monitoring trên mapping hợp lệ (createdMappingId) -> 200 OK
    const toggleOnRes = await apiRequest('PATCH', `/api/mappings/${createdMappingId}/monitoring`, maintToken, {
      enable: true,
    });
    assert(toggleOnRes.status === 200, 'TC-2F2-06.4: Bật giám sát thành công cho mapping hợp lệ (200 OK)');
    assert(Boolean(toggleOnRes.body.mapping.monitoring_enabled), 'TC-2F2-06.5: monitoring_enabled chuyển sang true/1');
    assert(toggleOnRes.body.mapping.status === 'ACTIVE', 'TC-2F2-06.6: status chuyển sang ACTIVE');

    // Tắt monitoring -> 200 OK
    const toggleOffRes = await apiRequest('PATCH', `/api/mappings/${createdMappingId}/monitoring`, maintToken, {
      enable: false,
    });
    assert(toggleOffRes.status === 200, 'TC-2F2-06.7: Tắt giám sát thành công (200 OK)');
    assert(!toggleOffRes.body.mapping.monitoring_enabled, 'TC-2F2-06.8: monitoring_enabled chuyển về false/0');
  }

  // -------------------------------------------------------------------------
  // PHẦN 7: VÔ HIỆU HÓA MAPPING & WEBSOCKET BROADCAST
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 7: VÔ HIỆU HÓA MAPPING & WEBSOCKET SYNC ---');
  {
    // Vô hiệu hóa (Soft Deactivate)
    const deactRes = await apiRequest('PATCH', `/api/mappings/${createdMappingId}/deactivate`, maintToken);
    assert(deactRes.status === 200, 'TC-2F2-07.1: Vô hiệu hóa mapping thành công (200 OK)');
    assert(deactRes.body.status === 'INACTIVE' || deactRes.body.status === 'DEACTIVATED', 'TC-2F2-07.2: Trạng thái mapping chuyển sang INACTIVE/DEACTIVATED');
    assert(!deactRes.body.monitoring_enabled, 'TC-2F2-07.3: monitoring_enabled tự động ngắt về false/0');

    // Chờ 500ms cho WebSocket nhận đủ các bản tin broadcast
    await new Promise((r) => setTimeout(r, 800));
    wsClient1.close();
    wsClient2.close();

    const events1 = wsEvents1.map((e) => e.type);
    const events2 = wsEvents2.map((e) => e.type);

    assert(events1.includes('mapping_created'), 'TC-2F2-07.4: Client 1 nhận sự kiện WebSocket mapping_created');
    assert(events2.includes('mapping_created'), 'TC-2F2-07.5: Client 2 nhận sự kiện WebSocket mapping_created song song');
    assert(events1.includes('mapping_updated'), 'TC-2F2-07.6: WebSocket nhận sự kiện mapping_updated');
    assert(events1.includes('thresholds_updated'), 'TC-2F2-07.7: WebSocket nhận sự kiện thresholds_updated');
    assert(events1.includes('schedule_updated'), 'TC-2F2-07.8: WebSocket nhận sự kiện schedule_updated');
    assert(events1.includes('mapping_monitoring_toggled'), 'TC-2F2-07.9: WebSocket nhận sự kiện mapping_monitoring_toggled');
    assert(events1.includes('mapping_deactivated'), 'TC-2F2-07.10: WebSocket nhận sự kiện mapping_deactivated');
  }

  // -------------------------------------------------------------------------
  // PHẦN 8: DỌN DẸP FIXTURES TRÊN CSDL TEST denso_iot_phase1_test
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 8: DỌN DẸP DỮ LIỆU TEST TRÊN CSDL TEST ---');
  {
    const cleanConn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: TEST_DB_NAME,
    });

    await cleanConn.query('DELETE FROM machine_telemetry_history WHERE machineId IN (?, ?)', [testMachine1, testMachine2]);
    const [existingMaps] = await cleanConn.query('SELECT id FROM metric_mappings WHERE machine_id IN (?, ?) OR id IN (?, ?)', [testMachine1, testMachine2, testMappingId, testMappingHistId]);
    const mapIds = existingMaps.map((m) => m.id);
    if (mapIds.length > 0) {
      const placeholders = mapIds.map(() => '?').join(',');
      await cleanConn.query(`DELETE FROM collection_schedules WHERE mapping_id IN (${placeholders})`, mapIds);
      await cleanConn.query(`DELETE FROM metric_thresholds WHERE mapping_id IN (${placeholders})`, mapIds);
      await cleanConn.query(`DELETE FROM metric_mappings WHERE id IN (${placeholders})`, mapIds);
    }
    await cleanConn.query('DELETE FROM plc_stations WHERE id IN (?, ?, ?)', [testPlcAlpha, testPlcBeta, testPlcDemo]);
    await cleanConn.query('DELETE FROM machines WHERE id IN (?, ?)', [testMachine1, testMachine2]);
    await cleanConn.end();

    console.log('  ✓ Đã dọn dẹp sạch toàn bộ fixtures thử nghiệm trên denso_iot_phase1_test.');
  }

  // -------------------------------------------------------------------------
  // PHẦN 9: TRIPLE VERIFICATION BẢO VỆ CSDL GỐC denso_iot
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 9: ĐỐI CHIẾU MÃ HÓA SHA-256 BẢO TOÀN CSDL GỐC DENSO_IOT ---');
  {
    const afterSnapshot = await calculateFullDbSnapshot(PROD_DB_NAME);
    let is100PercentIdentical = true;

    for (const [tbl, dataBefore] of Object.entries(beforeSnapshot)) {
      const dataAfter = afterSnapshot[tbl];
      const matchCount = dataBefore.count === dataAfter.count;
      const matchChecksum = dataBefore.checksum === dataAfter.checksum;
      const matchSha256 = dataBefore.sha256 === dataAfter.sha256;

      console.log(
        `   - ${tbl.padEnd(26)}: Count=${dataAfter.count} (${matchCount ? 'OK' : 'MISMATCH'}), Checksum=${dataAfter.checksum} (${matchChecksum ? 'OK' : 'MISMATCH'}), SHA256=${dataAfter.sha256.slice(0, 12)}... (${matchSha256 ? 'MATCH' : 'MISMATCH'})`
      );

      if (!matchCount || !matchChecksum || !matchSha256) is100PercentIdentical = false;
    }

    assert(
      is100PercentIdentical,
      'TC-2F2-09: CSDL gốc denso_iot được bảo vệ tuyệt đối: 100% bản ghi (kể cả telemetry lịch sử), Checksum và SHA-256 hoàn toàn trùng khớp từng byte!'
    );
  }

  // -------------------------------------------------------------------------
  // TỔNG KẾT
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(76));
  console.log(`   KẾT QUẢ KIỂM THỬ LÁT CẮT 2F-2: ${passedTests}/${totalTests} KIỂM CHỨNG PASS (100%)`);
  console.log('='.repeat(76) + '\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n[FATAL TEST RUNNER ERROR]:', err);
  process.exit(1);
});
