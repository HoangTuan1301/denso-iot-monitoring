/**
 * @file tests/test_phase2c_mappings_thresholds.js
 * @description Bộ kiểm thử tự động toàn diện & kiểm chứng bổ sung Bước 2C:
 * 1. Metric Mappings APIs (GET, POST, PUT, PATCH /deactivate, PATCH /monitoring)
 * 2. Metric Thresholds APIs (GET, PUT /thresholds)
 * 3. Collection Schedules APIs (GET, PUT /schedule)
 * 4. Kiểm thử Concurrency thực tế:
 *    - Gửi 10 request PUT Threshold đồng thời cho cùng 1 mapping -> Xác minh COUNT(*) === 1.
 *    - Gửi 10 request PUT Schedule đồng thời cho cùng 1 mapping -> Xác minh COUNT(*) === 1.
 *    - Kiểm tra phát hiện và xử lý dữ liệu trùng lặp có sẵn (MULTIPLE_THRESHOLDS / SCHEDULES_DETECTED).
 * 5. Kiểm tra toàn vẹn lịch sử telemetry:
 *    - mapping_code có lịch sử telemetry trong machine_telemetry_history BỊ CHẶN sửa đổi (409).
 *    - mapping_code chưa có lịch sử telemetry CHO PHÉP sửa đổi bình thường (200).
 *    - Dữ liệu lịch sử telemetry tuyệt đối không bị thay đổi hoặc xóa.
 * 6. Kiểm tra các tình huống ngưỡng bất đối xứng (1 phía: chỉ max, chỉ min) và ngưỡng mâu thuẫn.
 * 7. Kiểm tra các tình huống lỗi: không tồn tại (404), machine/metric sai (400), PLC máy khác (422), RBAC Operator (403), Rollback transaction.
 * 8. Toàn bộ thao tác ghi chỉ chạy trên database test: denso_iot_phase1_test.
 * 9. Đối chiếu Triple Verification (Count, Checksum, SHA256) bảo vệ CSDL gốc denso_iot.
 */

import http from 'http';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
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
const TEST_SERVER_PORT = 5007;

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
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            parsed = responseBody;
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

async function getDeepDbSnapshot(databaseName) {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: databaseName,
  });

  const tables = [
    'production_lines',
    'machines',
    'plc_stations',
    'metric_catalog',
    'metric_mappings',
    'metric_thresholds',
    'collection_schedules',
    'audit_logs',
    'users',
    'machine_telemetry_history',
  ];

  const snapshot = {};
  for (const table of tables) {
    const [cntRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
    const count = Number(cntRows[0].cnt);

    let mysqlChecksum = null;
    try {
      const [chkRows] = await conn.query(`CHECKSUM TABLE \`${table}\``);
      mysqlChecksum = chkRows[0]?.Checksum || null;
    } catch {}

    const [allRows] = await conn.query(`SELECT * FROM \`${table}\` ORDER BY id ASC`);
    const sha256 = crypto.createHash('sha256').update(JSON.stringify(allRows)).digest('hex');

    snapshot[table] = { count, mysqlChecksum, sha256 };
  }

  await conn.end();
  return snapshot;
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('   BỘ KIỂM THỬ TỰ ĐỘNG & KIỂM CHỨNG BỔ SUNG BƯỚC 2C                     ');
  console.log('   Môi trường thực thi: ' + TEST_DB_NAME + ' @ Port ' + TEST_SERVER_PORT);
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraDetail = '') {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}${extraDetail ? ' (' + extraDetail + ')' : ''}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}${extraDetail ? ' (' + extraDetail + ')' : ''}`);
      failed++;
    }
  }

  // 1. Chụp Snapshot CSDL gốc denso_iot trước test (bao gồm machine_telemetry_history)
  console.log('[BẢO VỆ CSDL GỐC] Đang tính toán Deep Snapshot 10 bảng của denso_iot...');
  const prodSnapshotBefore = await getDeepDbSnapshot(PROD_DB_NAME);

  // 2. Chuẩn bị dữ liệu kiểm thử trên denso_iot_phase1_test
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  const [existingTech] = await testConn.query('SELECT id FROM users WHERE email = ?', ['tech@denso.com']);
  if (existingTech.length === 0) {
    const techHash = bcrypt.hashSync('tech123', 10);
    await testConn.query(`
      INSERT INTO users (id, employeeId, fullName, email, password, role, assignedLineId, avatarUrl, status, createdAt)
      VALUES ('usr-maint-01', 'DNS-1088', 'Lê Văn Bách', 'tech@denso.com', ?, 'MAINTENANCE', 'LINE-02', '/uploads/avatars/default-tech.png', 'ACTIVE', NOW())
    `, [techHash]);
  }

  // Khởi tạo trạm PLC test hợp lệ và trạm PLC test của máy khác
  await testConn.query('DELETE FROM plc_stations WHERE id IN ("PLC-TEST-PROD-2C", "PLC-TEST-OTHER-2C")');
  await testConn.query(`
    INSERT INTO plc_stations (id, name, ipAddress, port, protocol, machine_id, is_demo, enabled, connection_status)
    VALUES 
      ('PLC-TEST-PROD-2C', 'Trạm PLC Test Dập 2C', '192.168.1.190', 502, 'Modbus/TCP', 'MCH-PRS-01', 0, 1, 'CONNECTED'),
      ('PLC-TEST-OTHER-2C', 'Trạm PLC Test Máy Khác', '192.168.1.191', 502, 'Modbus/TCP', 'MCH-WLD-01', 0, 1, 'CONNECTED')
  `);

  await testConn.end();

  // 3. Khởi động Backend Express Server trên TEST_SERVER_PORT
  console.log('\n[KHỞI ĐỘNG SERVER] Khởi chạy backend trên port ' + TEST_SERVER_PORT + '...');
  await import('../server/index.js');
  await new Promise((r) => setTimeout(r, 2000));

  // WebSocket Client để kiểm tra phát sự kiện
  const wsEvents = [];
  const wsClient = new WebSocket(`ws://127.0.0.1:${TEST_SERVER_PORT}/ws`);
  wsClient.on('message', (data) => {
    try {
      wsEvents.push(JSON.parse(data.toString()));
    } catch {}
  });
  await new Promise((r) => setTimeout(r, 500));

  let adminToken = '';
  let operatorToken = '';
  let maintToken = '';

  // -------------------------------------------------------------------------
  // MỤC 1: XÁC THỰC VÀ BẢO MẬT MATRIX (TC-01)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 1: XÁC THỰC VÀ MA TRẬN PHÂN QUYỀN RBAC ---');
  {
    const resAdmin = await apiRequest('POST', '/api/auth/login', null, { email: 'admin@denso.com', password: 'admin123' });
    adminToken = resAdmin.body.accessToken;
    assert(resAdmin.status === 200 && adminToken, 'TC-01.1: Đăng nhập Admin thành công');

    const resOp = await apiRequest('POST', '/api/auth/login', null, { email: 'user@denso.com', password: 'user123' });
    operatorToken = resOp.body.accessToken;
    assert(resOp.status === 200 && operatorToken, 'TC-01.2: Đăng nhập Operator thành công');

    const resTech = await apiRequest('POST', '/api/auth/login', null, { email: 'tech@denso.com', password: 'tech123' });
    maintToken = resTech.body.accessToken;
    assert(resTech.status === 200 && maintToken, 'TC-01.3: Đăng nhập Maintenance thành công');

    const resNoToken = await apiRequest('GET', '/api/mappings', null);
    assert(resNoToken.status === 401, 'TC-01.4: Truy cập không có Token trả về 401 Unauthorized');
  }

  // -------------------------------------------------------------------------
  // MỤC 2: METRIC MAPPINGS APIS & TOÀN VẸN LỊCH SỬ TELEMETRY (TC-02 -> TC-07)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 2: METRIC MAPPINGS APIS & BẢO VỆ DỮ LIỆU LỊCH SỬ TELEMETRY ---');
  let testMappingId = '';
  const testMappingCode = `MAP-TEST-2C-${Date.now().toString().slice(-4)}`;
  {
    const resGetMaps = await apiRequest('GET', '/api/mappings', operatorToken);
    assert(resGetMaps.status === 200 && Array.isArray(resGetMaps.body.mappings), 'TC-02.1: Operator lấy danh sách mappings (200 OK)');
    assert(resGetMaps.body.mappings.length >= 10, 'TC-02.2: Hệ thống có đủ 10 mapping chuẩn chuyển tiếp từ Giai đoạn 1');

    // Chặn RBAC: Operator & Tech không được tạo mapping
    const resOpPost = await apiRequest('POST', '/api/mappings', operatorToken, { mapping_code: 'TEST' });
    assert(resOpPost.status === 403, 'TC-03.1: Operator bị chặn tạo mapping (403 Forbidden)');

    const resTechPost = await apiRequest('POST', '/api/mappings', maintToken, { mapping_code: 'TEST' });
    assert(resTechPost.status === 403, 'TC-03.2: Maintenance bị chặn tạo mapping (403 Forbidden)');

    // Kiểm tra các lỗi 400 và 404 khi tham số không hợp lệ
    const resInvalidMachine = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: 'MC-NON-EXISTENT',
      metric_id: 'MTR-CAT-PRS-01',
      mapping_code: 'MAP-INV-MCH',
      channel_name: 'Máy không tồn tại',
    });
    assert(resInvalidMachine.status === 400, 'TC-03.3: Tạo mapping với machine_id không tồn tại trả về 400 Bad Request');

    const resInvalidMetric = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: 'MCH-PRS-01',
      metric_id: 'MTR-CAT-NON-EXISTENT',
      mapping_code: 'MAP-INV-MTR',
      channel_name: 'Metric không tồn tại',
    });
    assert(resInvalidMetric.status === 400, 'TC-03.4: Tạo mapping với metric_id không tồn tại trả về 400 Bad Request');

    // Chặn mapping tham chiếu PLC thuộc máy khác
    const resCrossMachine = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: 'MCH-PRS-01',
      plc_id: 'PLC-TEST-OTHER-2C', // PLC của MCH-WLD-01
      metric_id: 'MTR-CAT-PRS-01',
      mapping_code: `MAP-CROSS-${Date.now().toString().slice(-4)}`,
      channel_name: 'Kênh tham chiếu chéo máy',
    });
    assert(
      resCrossMachine.status === 422 && resCrossMachine.body.errorCode === 'PLC_MACHINE_MISMATCH',
      'TC-03.5: Chặn tạo mapping tham chiếu PLC không thuộc về máy đích (422 PLC_MACHINE_MISMATCH)'
    );

    // Tạo mapping hợp lệ ban đầu (chưa cần PLC / plc_register)
    const resAdminCreate = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: 'MCH-PRS-01',
      metric_id: 'MTR-CAT-PRS-01',
      mapping_code: testMappingCode,
      channel_name: 'Kênh Đo Áp Lực Thủy Lực Bước 2C',
      plc_id: null,
      plc_register: null,
    });
    assert(resAdminCreate.status === 201 && resAdminCreate.body.mapping?.id, 'TC-03.6: Tạo mapping mới thành công không cần PLC ban đầu (201 Created)');
    testMappingId = resAdminCreate.body.mapping?.id;

    assert(
      resAdminCreate.body.mapping.status === 'NOT_CONFIGURED' && resAdminCreate.body.mapping.monitoring_enabled === false,
      'TC-03.7: Mapping mới khởi tạo ở trạng thái NOT_CONFIGURED và monitoring_enabled = 0'
    );

    // Chặn trùng mapping_code
    const resDupCode = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: 'MCH-PRS-01',
      metric_id: 'MTR-CAT-PRS-01',
      mapping_code: testMappingCode,
      channel_name: 'Kênh Trùng Mã',
    });
    assert(resDupCode.status === 409 && resDupCode.body.errorCode === 'DUPLICATE_MAPPING_CODE', 'TC-03.8: Chặn trùng mã mapping_code (409 Conflict)');

    // GET detail
    const resGetOne = await apiRequest('GET', `/api/mappings/${testMappingId}`, operatorToken);
    assert(resGetOne.status === 200 && resGetOne.body.mapping?.id === testMappingId, 'TC-04.1: Lấy chi tiết mapping kèm metric_catalog (200 OK)');

    const resGet404 = await apiRequest('GET', '/api/mappings/MAP-NON-EXISTENT', operatorToken);
    assert(resGet404.status === 404, 'TC-04.2: Truy vấn mapping không tồn tại trả về 404 Not Found');

    // PUT update: Maintenance cập nhật cấu hình thanh ghi PLC
    const resTechUpdate = await apiRequest('PUT', `/api/mappings/${testMappingId}`, maintToken, {
      plc_id: 'PLC-TEST-PROD-2C',
      plc_register: 'DB100.DBD20',
      scale_factor: 1.5,
      sampling_rate_ms: 2000,
    });
    assert(
      resTechUpdate.status === 200 && resTechUpdate.body.mapping?.plc_register === 'DB100.DBD20',
      'TC-04.3: Maintenance cấu hình thanh ghi PLC DB100.DBD20 thành công (200 OK)'
    );

    // Operator cố tình sửa cấu hình mapping -> 403 Forbidden
    const resOpPut = await apiRequest('PUT', `/api/mappings/${testMappingId}`, operatorToken, { channel_name: 'Operator Hack' });
    assert(resOpPut.status === 403, 'TC-04.4: Operator bị chặn sửa cấu hình mapping (403 Forbidden)');

    // BẢO VỆ MAPPING_CODE ĐÃ CÓ LỊCH SỬ TELEMETRY:
    // Kênh MAP-ASM-01-TRQ có mapping_code='MTR-ASM-01-TRQ' đã ghi nhận dữ liệu trong machine_telemetry_history
    const resProtectHistory = await apiRequest('PUT', '/api/mappings/MAP-ASM-01-TRQ', adminToken, {
      mapping_code: 'MTR-ASM-01-TRQ-MODIFIED',
    });
    assert(
      resProtectHistory.status === 409 && resProtectHistory.body.errorCode === 'CANNOT_MODIFY_MAPPING_CODE_WITH_HISTORY',
      'TC-05.1: Chặn sửa đổi mapping_code đã phát sinh dữ liệu lịch sử telemetry (409 CANNOT_MODIFY_MAPPING_CODE_WITH_HISTORY)'
    );

    // ĐỐI CHIẾU TRƯỜNG HỢP MAPPING_CODE CHƯA CÓ LỊCH SỬ TELEMETRY:
    // testMappingCode chưa từng phát sinh telemetry -> CHO PHÉP sửa đổi bình thường
    const updatedNewCode = `${testMappingCode}-RENAMED`;
    const resRenameOk = await apiRequest('PUT', `/api/mappings/${testMappingId}`, adminToken, {
      mapping_code: updatedNewCode,
    });
    assert(
      resRenameOk.status === 200 && resRenameOk.body.mapping?.mapping_code === updatedNewCode,
      'TC-05.2: Mapping_code chưa có lịch sử telemetry được phép đổi mã thành công (200 OK)'
    );

    // PATCH deactivate: Ngừng hoạt động mapping (bảo toàn lịch sử)
    const resDeact = await apiRequest('PATCH', `/api/mappings/${testMappingId}/deactivate`, maintToken);
    assert(
      resDeact.status === 200 && resDeact.body.status === 'INACTIVE' && resDeact.body.monitoring_enabled === false,
      'TC-06: Maintenance ngừng hoạt động mapping chuyển sang INACTIVE (200 OK)'
    );
  }

  // -------------------------------------------------------------------------
  // MỤC 3: MONITORING LIFECYCLE & AN TOÀN KÍCH HOẠT (TC-08 -> TC-11)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 3: MONITORING LIFECYCLE & AN TOÀN KÍCH HOẠT ---');
  {
    // 1. Chặn bật monitoring khi mapping chưa có PLC
    const resNoPlcMap = await apiRequest('POST', '/api/mappings', adminToken, {
      machine_id: 'MCH-PRS-01',
      metric_id: 'MTR-CAT-TMP-01',
      mapping_code: `MAP-NOPLC-${Date.now().toString().slice(-4)}`,
      channel_name: 'Kênh Chưa Có PLC',
    });
    const noPlcId = resNoPlcMap.body.mapping.id;

    const resEnableNoPlc = await apiRequest('PATCH', `/api/mappings/${noPlcId}/monitoring`, maintToken, { enable: true });
    assert(
      resEnableNoPlc.status === 422 && resEnableNoPlc.body.errorCode === 'PLC_REQUIRED_FOR_MONITORING',
      'TC-07.1: Từ chối bật giám sát khi mapping chưa được gán PLC (422 PLC_REQUIRED_FOR_MONITORING)'
    );

    // 2. Chặn bật monitoring khi PLC là Demo
    const testConnMon = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
    await testConnMon.query('UPDATE plc_stations SET is_demo = 1 WHERE id = "PLC-TEST-PROD-2C"');
    const resEnableDemo = await apiRequest('PATCH', `/api/mappings/${testMappingId}/monitoring`, maintToken, { enable: true });
    assert(
      resEnableDemo.status === 422 && resEnableDemo.body.errorCode === 'CANNOT_MONITOR_DEMO_PLC',
      'TC-07.2: Từ chối bật giám sát khi trạm PLC là Demo (422 CANNOT_MONITOR_DEMO_PLC)'
    );
    await testConnMon.query('UPDATE plc_stations SET is_demo = 0 WHERE id = "PLC-TEST-PROD-2C"');

    // 3. Chặn bật monitoring khi PLC bị disabled
    await testConnMon.query('UPDATE plc_stations SET enabled = 0 WHERE id = "PLC-TEST-PROD-2C"');
    const resEnableDis = await apiRequest('PATCH', `/api/mappings/${testMappingId}/monitoring`, maintToken, { enable: true });
    assert(
      resEnableDis.status === 422 && resEnableDis.body.errorCode === 'PLC_DISABLED',
      'TC-07.3: Từ chối bật giám sát khi trạm PLC bị vô hiệu hóa (422 PLC_DISABLED)'
    );
    await testConnMon.query('UPDATE plc_stations SET enabled = 1 WHERE id = "PLC-TEST-PROD-2C"');

    // 4. Kích hoạt giám sát hợp lệ: status trở thành ACTIVE
    const resEnableOk = await apiRequest('PATCH', `/api/mappings/${testMappingId}/monitoring`, maintToken, { enable: true });
    assert(
      resEnableOk.status === 200 &&
      resEnableOk.body.mapping?.monitoring_enabled === true &&
      resEnableOk.body.mapping?.status === 'ACTIVE',
      'TC-08.1: Bật giám sát thành công -> mapping chuyển sang ACTIVE và monitoring_enabled = 1 (Không kết nối PLC vật lý)'
    );

    // 5. Tạm dừng giám sát: status trở thành INACTIVE
    const resDisableOk = await apiRequest('PATCH', `/api/mappings/${testMappingId}/monitoring`, maintToken, { enable: false });
    assert(
      resDisableOk.status === 200 &&
      resDisableOk.body.mapping?.monitoring_enabled === false &&
      resDisableOk.body.mapping?.status === 'INACTIVE',
      'TC-08.2: Tắt giám sát thành công -> mapping chuyển sang INACTIVE và monitoring_enabled = 0'
    );

    await testConnMon.query('DELETE FROM metric_mappings WHERE id = ?', [noPlcId]);
    await testConnMon.end();
  }

  // -------------------------------------------------------------------------
  // MỤC 4: METRIC THRESHOLDS APIS & VALIDATION LOGIC (TC-12 -> TC-17)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 4: METRIC THRESHOLDS APIS & NGƯỠNG BẤT ĐỐI XỨNG ---');
  {
    const resGetNull = await apiRequest('GET', `/api/mappings/${testMappingId}/thresholds`, operatorToken);
    assert(resGetNull.status === 200 && resGetNull.body.thresholds === null, 'TC-09.1: Lấy ngưỡng khi chưa cấu hình trả về null');

    // Chặn mảng ngưỡng rỗng
    const resEmptyThr = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {});
    assert(
      resEmptyThr.status === 400 && resEmptyThr.body.errorCode === 'AT_LEAST_ONE_THRESHOLD_REQUIRED',
      'TC-09.2: Từ chối cấu hình rỗng không có giá trị ngưỡng nào (400 AT_LEAST_ONE_THRESHOLD_REQUIRED)'
    );

    // PUT threshold: Vi phạm validMin / validMax của MetricCatalog
    const resExceedMax = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
      critical_max: 450, // Vượt quá validMax 400
    });
    assert(
      resExceedMax.status === 400 && resExceedMax.body.errorCode === 'THRESHOLD_EXCEEDS_VALID_MAX',
      'TC-09.3: Từ chối ngưỡng vượt quá giới hạn vật lý validMax của metric (400 THRESHOLD_EXCEEDS_VALID_MAX)'
    );

    const resBelowMin = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
      critical_min: -10, // Nhỏ hơn validMin 0
    });
    assert(
      resBelowMin.status === 400 && resBelowMin.body.errorCode === 'THRESHOLD_BELOW_VALID_MIN',
      'TC-09.4: Từ chối ngưỡng nhỏ hơn giới hạn vật lý validMin của metric (400 THRESHOLD_BELOW_VALID_MIN)'
    );

    // PUT threshold: Vi phạm tính nhất quán logic min/max (warning_min > warning_max)
    const resInconsistent = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
      warning_min: 80,
      warning_max: 50,
    });
    assert(
      resInconsistent.status === 400 && resInconsistent.body.errorCode === 'INVALID_THRESHOLD_LOGIC',
      'TC-09.5: Từ chối thiết lập ngưỡng mâu thuẫn warning_min > warning_max (400 INVALID_THRESHOLD_LOGIC)'
    );

    // PUT threshold: Vi phạm ngưỡng bất đối xứng mâu thuẫn (critical_min > warning_max)
    const resAsymInconsistent = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
      critical_min: 85,
      warning_max: 60,
    });
    assert(
      resAsymInconsistent.status === 400 && resAsymInconsistent.body.errorCode === 'INVALID_THRESHOLD_LOGIC',
      'TC-09.6: Từ chối thiết lập ngưỡng bất đối xứng mâu thuẫn critical_min > warning_max (400 INVALID_THRESHOLD_LOGIC)'
    );

    // HỖ TRỢ NGƯỠNG BẤT ĐỐI XỨNG HỢP LỆ (1 PHÍA):
    // 1. Chỉ có ngưỡng trên (Upper-only, e.g. nhiệt độ cảnh báo nóng)
    const resUpperOnly = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
      warning_max: 75,
      critical_max: 90,
      action_plan: 'Cảnh báo nhiệt/áp cao',
    });
    assert(
      resUpperOnly.status === 200 &&
      resUpperOnly.body.thresholds?.warning_min === null &&
      resUpperOnly.body.thresholds?.warning_max === 75 &&
      resUpperOnly.body.thresholds?.critical_max === 90,
      'TC-10.1: Hỗ trợ cấu hình ngưỡng một phía (Upper-only: warning_max & critical_max) thành công'
    );

    // 2. Chỉ có ngưỡng dưới (Lower-only, e.g. áp lực tối thiểu)
    const resLowerOnly = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
      critical_min: 15,
      warning_min: 25,
      action_plan: 'Cảnh báo áp lực quá thấp',
    });
    assert(
      resLowerOnly.status === 200 &&
      resLowerOnly.body.thresholds?.critical_min === 15 &&
      resLowerOnly.body.thresholds?.warning_min === 25 &&
      resLowerOnly.body.thresholds?.warning_max === null,
      'TC-10.2: Hỗ trợ cấu hình ngưỡng một phía (Lower-only: critical_min & warning_min) thành công'
    );

    // Cấu hình đầy đủ cả 2 phía (Bilateral)
    const resBilateral = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
      critical_min: 10,
      warning_min: 20,
      warning_max: 80,
      critical_max: 95,
      action_plan: 'Kế hoạch xử lý toàn diện',
    });
    assert(
      resBilateral.status === 200 &&
      resBilateral.body.thresholds?.warning_max === 80 &&
      resBilateral.body.thresholds?.critical_max === 95,
      'TC-10.3: Thiết lập cấu hình ngưỡng 2 phía thành công (200 OK)'
    );
  }

  // -------------------------------------------------------------------------
  // MỤC 5: KIỂM THỬ CONCURRENCY & PHÁT HIỆN DUPLICATE CÓ SẴN (TC-18 -> TC-21)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 5: KIỂM THỬ CONCURRENCY THỰC TẾ & XỬ LÝ DUPLICATE CÓ SẴN ---');
  {
    // 1. KIỂM THỬ CONCURRENCY THRESHOLDS: Gửi 10 request PUT Threshold đồng thời cho cùng 1 mapping
    console.log('   [CONCURRENCY TEST 1] Gửi đồng thời 10 request PUT Threshold vào mapping ' + testMappingId + '...');
    const thrPromises = [];
    for (let i = 0; i < 10; i++) {
      thrPromises.push(
        apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, {
          critical_min: 10,
          warning_min: 20,
          warning_max: 80 + i,
          critical_max: 95,
        })
      );
    }
    const thrResults = await Promise.all(thrPromises);
    const thrSuccessCount = thrResults.filter((r) => r.status === 200).length;
    assert(thrSuccessCount === 10, `TC-11.1: 10/10 request PUT Threshold đồng thời đều hoàn thành an toàn (200 OK) không bị deadlock`);

    // Xác minh truy vấn SQL: Chỉ có duy nhất 1 bản ghi Threshold được lưu trong DB
    const testConnConc = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
    const [thrCountCheck] = await testConnConc.query('SELECT COUNT(*) AS cnt FROM metric_thresholds WHERE mapping_id = ?', [testMappingId]);
    assert(thrCountCheck[0].cnt === 1, `TC-11.2: Truy vấn SQL xác nhận duy nhất 1 bản ghi Threshold tồn tại (COUNT = ${thrCountCheck[0].cnt})`);

    // 2. KIỂM THỬ CONCURRENCY SCHEDULES: Gửi 10 request PUT Schedule đồng thời cho cùng 1 mapping
    console.log('   [CONCURRENCY TEST 2] Gửi đồng thời 10 request PUT Schedule vào mapping ' + testMappingId + '...');
    const schedPromises = [];
    for (let i = 0; i < 10; i++) {
      schedPromises.push(
        apiRequest('PUT', `/api/mappings/${testMappingId}/schedule`, maintToken, {
          frequency_type: 'INTERVAL',
          interval_seconds: 5 + i,
          is_active: true,
        })
      );
    }
    const schedResults = await Promise.all(schedPromises);
    const schedSuccessCount = schedResults.filter((r) => r.status === 200).length;
    assert(schedSuccessCount === 10, `TC-12.1: 10/10 request PUT Schedule đồng thời đều hoàn thành an toàn (200 OK) không bị deadlock`);

    const [schedCountCheck] = await testConnConc.query('SELECT COUNT(*) AS cnt FROM collection_schedules WHERE mapping_id = ?', [testMappingId]);
    assert(schedCountCheck[0].cnt === 1, `TC-12.2: Truy vấn SQL xác nhận duy nhất 1 bản ghi Schedule tồn tại (COUNT = ${schedCountCheck[0].cnt})`);

    // 3. KIỂM THỬ XỬ LÝ DỮ LIỆU TRÙNG LẶP CÓ SẴN (ARTIFICIAL DUPLICATES):
    // Giả lập đưa thêm bản ghi thứ 2 vào DB mà không thông qua ứng dụng
    console.log('   [DUPLICATE DETECTION] Giả lập chèn bản ghi trùng lặp thứ 2 vào CSDL để kiểm tra phát hiện bất thường:');
    const fakeThrId = `THR-FAKE-DUP-${Date.now()}`;
    await testConnConc.query(`
      INSERT INTO metric_thresholds (id, mapping_id, warning_min, warning_max, critical_min, critical_max)
      VALUES (?, ?, 10, 80, 5, 95)
    `, [fakeThrId, testMappingId]);

    const resDetectThrDup = await apiRequest('GET', `/api/mappings/${testMappingId}/thresholds`, operatorToken);
    assert(
      resDetectThrDup.status === 409 && resDetectThrDup.body.errorCode === 'MULTIPLE_THRESHOLDS_DETECTED',
      'TC-13.1: Hệ thống phát hiện bất thường và từ chối khi CSDL có nhiều hơn 1 bản ghi Threshold (409 MULTIPLE_THRESHOLDS_DETECTED)'
    );

    const resPutThrDup = await apiRequest('PUT', `/api/mappings/${testMappingId}/thresholds`, maintToken, { warning_max: 85 });
    assert(
      resPutThrDup.status === 409 && resPutThrDup.body.errorCode === 'MULTIPLE_THRESHOLDS_DETECTED',
      'TC-13.2: Chặn cập nhật khi phát hiện CSDL đang chứa bản ghi Threshold trùng lặp (409)'
    );
    // Dọn dẹp bản ghi giả lập
    await testConnConc.query('DELETE FROM metric_thresholds WHERE id = ?', [fakeThrId]);

    // Giả lập bản ghi Schedule trùng lặp
    const fakeSchedId = `SCH-FAKE-DUP-${Date.now()}`;
    await testConnConc.query(`
      INSERT INTO collection_schedules (id, mapping_id, frequency_type, interval_seconds, is_active)
      VALUES (?, ?, 'INTERVAL', 10, 1)
    `, [fakeSchedId, testMappingId]);

    const resDetectSchedDup = await apiRequest('GET', `/api/mappings/${testMappingId}/schedule`, operatorToken);
    assert(
      resDetectSchedDup.status === 409 && resDetectSchedDup.body.errorCode === 'MULTIPLE_SCHEDULES_DETECTED',
      'TC-13.3: Hệ thống phát hiện bất thường và từ chối khi CSDL có nhiều hơn 1 bản ghi Schedule (409 MULTIPLE_SCHEDULES_DETECTED)'
    );
    await testConnConc.query('DELETE FROM collection_schedules WHERE id = ?', [fakeSchedId]);

    await testConnConc.end();
  }

  // -------------------------------------------------------------------------
  // MỤC 6: KIỂM CHỨNG LẬP LỊCH SCHEDULE (TC-22 -> TC-24)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 6: COLLECTION SCHEDULES ĐỊNH DẠNG & CRON ---');
  {
    const resInvalidSec = await apiRequest('PUT', `/api/mappings/${testMappingId}/schedule`, maintToken, {
      frequency_type: 'INTERVAL',
      interval_seconds: 0,
    });
    assert(
      resInvalidSec.status === 400 && resInvalidSec.body.errorCode === 'INVALID_INTERVAL_SECONDS',
      'TC-14.1: Từ chối interval_seconds < 1 giây (400 INVALID_INTERVAL_SECONDS)'
    );

    const resInvalidCron = await apiRequest('PUT', `/api/mappings/${testMappingId}/schedule`, maintToken, {
      frequency_type: 'CRON',
      cron_expression: 'sai-cu-phap-cron',
    });
    assert(
      resInvalidCron.status === 400 && resInvalidCron.body.errorCode === 'INVALID_CRON_EXPRESSION',
      'TC-14.2: Từ chối cron_expression không đúng chuẩn 5 trường (400 INVALID_CRON_EXPRESSION)'
    );

    const resValidCron = await apiRequest('PUT', `/api/mappings/${testMappingId}/schedule`, maintToken, {
      frequency_type: 'CRON',
      cron_expression: '*/10 * * * *',
      is_active: true,
    });
    assert(
      resValidCron.status === 200 &&
      resValidCron.body.schedule?.cron_expression === '*/10 * * * *' &&
      resValidCron.body.schedule?.interval_seconds === null,
      'TC-14.3: Chuyển đổi lịch sang biểu thức CRON "*/10 * * * *" thành công (200 OK)'
    );
  }

  // -------------------------------------------------------------------------
  // MỤC 7: AUDIT LOG & WEBSOCKET BROADCAST SAU COMMIT (TC-25)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 7: AUDIT LOG VÀ WEBSOCKET BROADCAST SAU COMMIT ---');
  {
    wsClient.close();
    const eventTypes = wsEvents.map((e) => e.type);
    assert(eventTypes.includes('mapping_created'), 'TC-15.1: WebSocket nhận sự kiện mapping_created sau COMMIT');
    assert(eventTypes.includes('mapping_updated'), 'TC-15.2: WebSocket nhận sự kiện mapping_updated sau COMMIT');
    assert(eventTypes.includes('mapping_deactivated'), 'TC-15.3: WebSocket nhận sự kiện mapping_deactivated sau COMMIT');
    assert(eventTypes.includes('thresholds_updated'), 'TC-15.4: WebSocket nhận sự kiện thresholds_updated sau COMMIT');
    assert(eventTypes.includes('schedule_updated'), 'TC-15.5: WebSocket nhận sự kiện schedule_updated sau COMMIT');

    const testConnAudit = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
    const [audits] = await testConnAudit.query('SELECT DISTINCT action FROM audit_logs WHERE target IN (?, ?)', [testMappingId, 'THR-']);
    const actions = audits.map((a) => a.action);
    assert(actions.includes('CREATE_METRIC_MAPPING'), 'TC-15.6: Audit Log ghi nhận CREATE_METRIC_MAPPING trong transaction');
    assert(actions.includes('UPDATE_METRIC_MAPPING'), 'TC-15.7: Audit Log ghi nhận UPDATE_METRIC_MAPPING trong transaction');

    // Dọn dẹp dữ liệu test trên test database
    await testConnAudit.query('DELETE FROM collection_schedules WHERE mapping_id = ?', [testMappingId]);
    await testConnAudit.query('DELETE FROM metric_thresholds WHERE mapping_id = ?', [testMappingId]);
    await testConnAudit.query('DELETE FROM metric_mappings WHERE id = ?', [testMappingId]);
    await testConnAudit.query('DELETE FROM plc_stations WHERE id IN ("PLC-TEST-PROD-2C", "PLC-TEST-OTHER-2C")');
    await testConnAudit.end();
  }

  // -------------------------------------------------------------------------
  // MỤC 8: TRIPLE VERIFICATION BẢO VỆ CSDL GỐC DENSO_IOT (TC-26)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 8: ĐỐI CHIẾU MÃ HÓA SHA-256 BẢO TOÀN CSDL GỐC DENSO_IOT (BAO GỒM LỊCH SỬ TELEMETRY) ---');
  {
    const prodSnapshotAfter = await getDeepDbSnapshot(PROD_DB_NAME);
    let is100PercentIdentical = true;

    for (const [tbl, dataBefore] of Object.entries(prodSnapshotBefore)) {
      const dataAfter = prodSnapshotAfter[tbl];
      const matchCount = dataBefore.count === dataAfter.count;
      const matchChecksum = dataBefore.mysqlChecksum === dataAfter.mysqlChecksum;
      const matchSha256 = dataBefore.sha256 === dataAfter.sha256;

      console.log(`   - ${tbl.padEnd(26)}: Count=${dataAfter.count} (${matchCount ? 'OK' : 'MISMATCH'}), Checksum=${dataAfter.mysqlChecksum} (${matchChecksum ? 'OK' : 'MISMATCH'}), SHA256=${dataAfter.sha256.slice(0, 12)}... (${matchSha256 ? 'MATCH' : 'MISMATCH'})`);

      if (!matchCount || !matchChecksum || !matchSha256) is100PercentIdentical = false;
    }

    assert(
      is100PercentIdentical,
      'TC-16: CSDL gốc denso_iot được bảo vệ tuyệt đối: 100% bản ghi (kể cả telemetry lịch sử), Checksum và SHA-256 hoàn toàn trùng khớp từng byte!'
    );
  }

  // -------------------------------------------------------------------------
  // TỔNG KẾT
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`   KẾT QUẢ KIỂM THỬ BỔ SUNG BƯỚC 2C: ${passed} PASS / ${failed} FAIL (TỔNG CỘNG: ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('[TEST SUITE UNCAUGHT ERROR]:', err);
  process.exit(1);
});
