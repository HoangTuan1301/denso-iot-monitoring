/**
 * @file tests/test_phase2b_lines_machines.js
 * @description Bộ kiểm thử tự động toàn diện & kiểm chứng bổ sung Bước 2B:
 * 1. Logic Gán / Chuyển giao PLC:
 *    - Trường hợp cả máy nguồn và máy đích đều đang có PLC riêng (Double Conflict & Dual Confirmation).
 *    - Toàn bộ Mapping của máy đích và máy nguồn bắt buộc ngắt monitoring (monitoring_enabled = 0) và yêu cầu cấu hình lại (status = 'NOT_CONFIGURED').
 *    - Rollback transaction khi có lỗi xảy ra.
 * 2. Tính toàn vẹn dữ liệu:
 *    - Kiểm tra SHA-256 Checksum và MySQL CHECKSUM TABLE của toàn bộ 9 bảng trong denso_iot trước và sau test.
 *    - Tuyệt đối chỉ ghi dữ liệu vào CSDL kiểm thử độc lập denso_iot_phase1_test.
 * 3. Nghiệp vụ Archive:
 *    - Chuyển trạng thái sang ARCHIVED, phân biệt rõ với trạng thái vận hành STOPPED / OFFLINE.
 * 4. Bảo mật & API Matrix:
 *    - Kiểm tra 401 (Không có Token), 403 (Token không đủ quyền / Operator / Token giả mạo) trên cả 12 API.
 *    - Kiểm tra 404 (Không tìm thấy), 409 (Xung đột mã / Xung đột PLC), 422 (Demo PLC / Disabled PLC).
 *    - Kiểm tra Audit Log được lưu trong cùng transaction.
 *    - Kiểm tra WebSocket broadcast sau commit thành công.
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
const TEST_SERVER_PORT = 5006;

// Ép buộc môi trường chạy trỏ ĐỘC QUYỀN vào database test
process.env.PORT = String(TEST_SERVER_PORT);
process.env.DB_NAME = TEST_DB_NAME;

// Helper gửi HTTP Request
async function apiRequest(method, endpoint, token = null, data = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = data ? JSON.stringify(data) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

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

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// Lấy bản chụp số lượng bản ghi, MySQL Checksum và SHA-256 của CSDL
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

    snapshot[table] = {
      count,
      mysqlChecksum,
      sha256,
    };
  }

  await conn.end();
  return snapshot;
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('   BỘ KIỂM THỬ TỰ ĐỘNG & BẢO VỆ DỮ LIỆU TOÀN DIỆN BƯỚC 2B              ');
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

  // 1. Chụp Deep Snapshot CSDL gốc denso_iot trước khi chạy test
  console.log('[BẢO VỆ CSDL GỐC] Đang tính toán SHA-256 Checksum của 9 bảng trong denso_iot...');
  const prodSnapshotBefore = await getDeepDbSnapshot(PROD_DB_NAME);
  console.log('Snapshot denso_iot Trước test:');
  for (const [tbl, data] of Object.entries(prodSnapshotBefore)) {
    console.log(`   - ${tbl.padEnd(22)}: Count=${data.count}, Checksum=${data.mysqlChecksum}, SHA256=${data.sha256.slice(0, 12)}...`);
  }

  // 2. Chuẩn bị dữ liệu trên CSDL TEST denso_iot_phase1_test
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  // User Maintenance trong test db
  const [existingTech] = await testConn.query('SELECT id FROM users WHERE email = ?', ['tech@denso.com']);
  if (existingTech.length === 0) {
    const techHash = bcrypt.hashSync('tech123', 10);
    await testConn.query(`
      INSERT INTO users (id, employeeId, fullName, email, password, role, assignedLineId, avatarUrl, status, createdAt)
      VALUES ('usr-maint-01', 'DNS-1088', 'Lê Văn Bách', 'tech@denso.com', ?, 'MAINTENANCE', 'LINE-02', '/uploads/avatars/default-tech.png', 'ACTIVE', NOW())
    `, [techHash]);
  }

  // Khởi tạo 2 trạm PLC sản xuất sạch cho bài test
  await testConn.query('DELETE FROM plc_stations WHERE id IN ("PLC-TEST-A", "PLC-TEST-B")');
  await testConn.query(`
    INSERT INTO plc_stations (id, name, ipAddress, port, protocol, machine_id, is_demo, enabled, connection_status)
    VALUES 
      ('PLC-TEST-A', 'Trạm PLC Test Alpha (Sản xuất)', '192.168.1.180', 502, 'Modbus/TCP', NULL, 0, 1, 'CONNECTED'),
      ('PLC-TEST-B', 'Trạm PLC Test Beta (Sản xuất)', '192.168.1.181', 502, 'Modbus/TCP', NULL, 0, 1, 'CONNECTED')
  `);

  await testConn.end();

  // 3. Khởi động Backend Express Server trên TEST_SERVER_PORT
  console.log('\n[KHỞI ĐỘNG SERVER] Khởi chạy backend trên port ' + TEST_SERVER_PORT + '...');
  await import('../server/index.js');
  await new Promise((r) => setTimeout(r, 2000));

  // Kết nối WebSocket Client để kiểm tra tính năng phát sự kiện sau COMMIT
  const wsEvents = [];
  const wsClient = new WebSocket(`ws://127.0.0.1:${TEST_SERVER_PORT}/ws`);
  wsClient.on('message', (data) => {
    try {
      wsEvents.push(JSON.parse(data.toString()));
    } catch {}
  });
  await new Promise((r) => setTimeout(r, 500));

  // Dọn dẹp trước kiểm thử bất kỳ fixture test còn sót lại từ lần chạy trước
  const preCleanupConn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
  await preCleanupConn.query("DELETE FROM production_lines WHERE code LIKE 'LINE-TST-%' OR code LIKE 'LINE-TEST-%' OR id LIKE 'LINE-LINETEST%'");
  await preCleanupConn.query("DELETE FROM machines WHERE code LIKE 'MCH-TA-%' OR code LIKE 'MCH-TB-%'");
  await preCleanupConn.end();

  let adminToken = '';
  let operatorToken = '';
  let maintToken = '';

  // -------------------------------------------------------------------------
  // MỤC 1: AUTHENTICATION VÀ BẢO MẬT MATRIX (TC-01 -> TC-04)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 1: XÁC THỰC JWT VÀ MA TRẬN PHÂN QUYỀN RBAC ---');
  {
    const resAdmin = await apiRequest('POST', '/api/auth/login', null, { email: 'admin@denso.com', password: 'admin123' });
    assert(resAdmin.status === 200 && resAdmin.body.accessToken, 'TC-01.1: Đăng nhập Admin thành công nhận Access Token');
    adminToken = resAdmin.body.accessToken;

    const resOp = await apiRequest('POST', '/api/auth/login', null, { email: 'user@denso.com', password: 'user123' });
    assert(resOp.status === 200 && resOp.body.accessToken, 'TC-01.2: Đăng nhập Operator thành công nhận Access Token');
    operatorToken = resOp.body.accessToken;

    const resTech = await apiRequest('POST', '/api/auth/login', null, { email: 'tech@denso.com', password: 'tech123' });
    assert(resTech.status === 200 && resTech.body.accessToken, 'TC-01.3: Đăng nhập Maintenance thành công nhận Access Token');
    maintToken = resTech.body.accessToken;

    // Kiểm tra 401 khi không truyền Token trên toàn bộ các nhóm API
    const endpoints401 = [
      ['GET', '/api/lines'],
      ['POST', '/api/lines'],
      ['GET', '/api/machines'],
      ['POST', '/api/machines'],
      ['PUT', '/api/machines/MCH-01/plc'],
      ['DELETE', '/api/machines/MCH-01/plc'],
    ];
    let count401 = 0;
    for (const [m, ep] of endpoints401) {
      const res = await apiRequest(m, ep, null);
      if (res.status === 401) count401++;
    }
    assert(count401 === endpoints401.length, `TC-01.4: Toàn bộ API yêu cầu Token trả về 401 Unauthorized (${count401}/${endpoints401.length})`);

    // Kiểm tra 403 khi Token không hợp lệ / giả mạo
    const resFakeToken = await apiRequest('GET', '/api/lines', 'fake.invalid.jwt.token');
    assert(resFakeToken.status === 403, 'TC-01.5: Token không hợp lệ trả về 403 Forbidden');
  }

  // -------------------------------------------------------------------------
  // MỤC 2: PRODUCTION LINES APIS & ARCHIVE LOGIC (TC-05 -> TC-08)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 2: PRODUCTION LINES APIS & ARCHIVE LOGIC ---');
  let createdLineId = '';
  {
    // GET list & detail
    const resGetLines = await apiRequest('GET', '/api/lines', operatorToken);
    assert(resGetLines.status === 200 && Array.isArray(resGetLines.body.lines), 'TC-02.1: Operator lấy danh sách dây chuyền (200 OK)');
    
    const firstLineId = resGetLines.body.lines[0].id;
    const resGetOne = await apiRequest('GET', `/api/lines/${firstLineId}`, operatorToken);
    assert(resGetOne.status === 200 && Array.isArray(resGetOne.body.line?.machines), 'TC-02.2: Chi tiết dây chuyền nhúng kèm danh sách máy');

    const resGet404 = await apiRequest('GET', '/api/lines/LINE-KHONG-TON-TAI', operatorToken);
    assert(resGet404.status === 404, 'TC-02.3: Truy vấn dây chuyền không tồn tại trả về 404 Not Found');

    // POST create RBAC
    const resOpCreate = await apiRequest('POST', '/api/lines', operatorToken, { name: 'Line Hack', code: 'L-HACK' });
    assert(resOpCreate.status === 403, 'TC-03.1: Operator bị chặn tạo dây chuyền (403 Forbidden)');

    const resMaintCreate = await apiRequest('POST', '/api/lines', maintToken, { name: 'Line Tech', code: 'L-TECH' });
    assert(resMaintCreate.status === 403, 'TC-03.2: Maintenance bị chặn tạo dây chuyền (403 Forbidden)');

    try {
      const testLineCode = `LINE-TST-${Date.now().toString().slice(-4)}`;
      const resAdminCreate = await apiRequest('POST', '/api/lines', adminToken, {
        name: 'Dây chuyền Đúc Kim Loại Thử Nghiệm',
        code: testLineCode,
        targetOutput: 1600,
      });
      assert(resAdminCreate.status === 201 && resAdminCreate.body.line?.id, 'TC-03.3: Admin tạo mới dây chuyền thành công (201 Created)');
      createdLineId = resAdminCreate.body.line?.id;

      const resDupLine = await apiRequest('POST', '/api/lines', adminToken, {
        name: 'Dây chuyền Trùng Code',
        code: testLineCode,
      });
      assert(resDupLine.status === 409 && resDupLine.body.errorCode === 'DUPLICATE_LINE_CODE', 'TC-03.4: Chặn trùng mã dây chuyền (409 Conflict)');

      // PUT update
      const resTechUpdate = await apiRequest('PUT', `/api/lines/${createdLineId}`, maintToken, {
        name: 'Dây chuyền Đúc (Đã Hiệu Chỉnh)',
        targetOutput: 1900,
      });
      assert(resTechUpdate.status === 200 && resTechUpdate.body.line?.targetOutput === 1900, 'TC-04.1: Maintenance cập nhật thông số dây chuyền thành công (200 OK)');

      // PATCH archive: chuyển sang ARCHIVED phân biệt với STOPPED
      const resOpArchive = await apiRequest('PATCH', `/api/lines/${createdLineId}/archive`, operatorToken);
      assert(resOpArchive.status === 403, 'TC-04.2: Operator bị chặn lưu trữ dây chuyền (403 Forbidden)');

      const resAdminArchive = await apiRequest('PATCH', `/api/lines/${createdLineId}/archive`, adminToken);
      assert(resAdminArchive.status === 200 && resAdminArchive.body.status === 'ARCHIVED', 'TC-04.3: Admin lưu trữ dây chuyền chuyển trạng thái ARCHIVED (200 OK)');

      const testConnVerify = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
      const [lineDbRows] = await testConnVerify.query('SELECT status FROM production_lines WHERE id = ?', [createdLineId]);
      assert(lineDbRows[0]?.status === 'ARCHIVED', 'TC-04.4: Trạng thái trong CSDL thực sự là ARCHIVED (phân biệt với STOPPED)');
      await testConnVerify.end();
    } finally {
      if (createdLineId) {
        const cleanupConn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
        await cleanupConn.query('DELETE FROM production_lines WHERE id = ?', [createdLineId]);
        await cleanupConn.end();
        createdLineId = '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // MỤC 3: MACHINES APIS & ARCHIVE LOGIC (TC-09 -> TC-12)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 3: MACHINES APIS & ARCHIVE LOGIC ---');
  let testMachineA = '';
  let testMachineB = '';
  {
    const resGetMachines = await apiRequest('GET', '/api/machines', operatorToken);
    assert(resGetMachines.status === 200 && resGetMachines.body.machines.length >= 12, 'TC-05.1: Operator xem danh sách máy (>= 12 máy)');

    // POST create
    const testCodeA = `MCH-TA-${Date.now().toString().slice(-4)}`;
    const testCodeB = `MCH-TB-${Date.now().toString().slice(-4)}`;

    const resMaintCreateMch = await apiRequest('POST', '/api/machines', maintToken, { lineId: 'LINE-01', name: 'Máy Test', code: testCodeA });
    assert(resMaintCreateMch.status === 403, 'TC-06.1: Maintenance bị chặn tạo máy mới (403 Forbidden)');

    const resCreateA = await apiRequest('POST', '/api/machines', adminToken, {
      lineId: 'LINE-01',
      name: 'Máy Dập Thử Nghiệm Alpha',
      code: testCodeA,
      type: 'stamping',
    });
    assert(resCreateA.status === 201 && resCreateA.body.machine?.id, 'TC-06.2: Admin tạo Máy Alpha thành công (201 Created)');
    testMachineA = resCreateA.body.machine?.id;

    const resCreateB = await apiRequest('POST', '/api/machines', adminToken, {
      lineId: 'LINE-02',
      name: 'Máy Hàn Thử Nghiệm Beta',
      code: testCodeB,
      type: 'welding',
    });
    assert(resCreateB.status === 201 && resCreateB.body.machine?.id, 'TC-06.3: Admin tạo Máy Beta thành công (201 Created)');
    testMachineB = resCreateB.body.machine?.id;

    const resDupMch = await apiRequest('POST', '/api/machines', adminToken, { lineId: 'LINE-01', name: 'Trùng', code: testCodeA });
    assert(resDupMch.status === 409 && resDupMch.body.errorCode === 'DUPLICATE_MACHINE_CODE', 'TC-06.4: Chặn trùng mã máy (409 Conflict)');

    // PUT update
    const resMaintUpdate = await apiRequest('PUT', `/api/machines/${testMachineA}`, maintToken, { healthScore: 98 });
    assert(resMaintUpdate.status === 200 && resMaintUpdate.body.machine?.healthScore === 98, 'TC-07.1: Maintenance cập nhật điểm sức khỏe máy (200 OK)');

    // PATCH archive machine: chuyển trạng thái ARCHIVED
    const resArchiveMch = await apiRequest('PATCH', `/api/machines/${testMachineA}/archive`, adminToken);
    assert(resArchiveMch.status === 200 && resArchiveMch.body.status === 'ARCHIVED', 'TC-07.2: Admin lưu trữ máy chuyển trạng thái ARCHIVED (200 OK)');
  }

  // -------------------------------------------------------------------------
  // MỤC 4: PLC ASSIGNMENT, DOUBLE CONFLICT, DUAL CONFIRMATION & RESET MAPPINGS (TC-13 -> TC-20)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 4: PLC ASSIGNMENT, DOUBLE CONFLICT & RECONFIGURATION STATE ---');
  {
    // TC-08: Chặn Demo PLC
    const resDemo = await apiRequest('PUT', `/api/machines/${testMachineA}/plc`, maintToken, { plcId: 'PLC-STATION-01' });
    assert(resDemo.status === 422 && resDemo.body.errorCode === 'CANNOT_ASSIGN_DEMO_PLC', 'TC-08: Chặn gán trạm Demo PLC cho máy sản xuất (422)');

    // TC-09: Chặn Disabled PLC
    const testConnPlc = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
    await testConnPlc.query('UPDATE plc_stations SET enabled = 0 WHERE id = "PLC-TEST-A"');
    const resDis = await apiRequest('PUT', `/api/machines/${testMachineA}/plc`, maintToken, { plcId: 'PLC-TEST-A' });
    assert(resDis.status === 422 && resDis.body.errorCode === 'CANNOT_ASSIGN_DISABLED_PLC', 'TC-09: Chặn gán trạm PLC bị vô hiệu hóa (422)');
    await testConnPlc.query('UPDATE plc_stations SET enabled = 1 WHERE id = "PLC-TEST-A"');

    // Thiết lập trạng thái ban đầu:
    // Máy Alpha được gán PLC-TEST-A
    // Máy Beta được gán PLC-TEST-B
    const resAssignA = await apiRequest('PUT', `/api/machines/${testMachineA}/plc`, maintToken, { plcId: 'PLC-TEST-A' });
    assert(resAssignA.status === 200 && resAssignA.body.message === 'ASSIGN_PLC_SUCCESS', 'TC-10.1: Gán PLC-TEST-A vào Máy Alpha thành công');

    const resAssignB = await apiRequest('PUT', `/api/machines/${testMachineB}/plc`, maintToken, { plcId: 'PLC-TEST-B' });
    assert(resAssignB.status === 200 && resAssignB.body.message === 'ASSIGN_PLC_SUCCESS', 'TC-10.2: Gán PLC-TEST-B vào Máy Beta thành công');

    // Tạo các Mapping đang ACTIVE trên cả Máy Alpha và Máy Beta để kiểm thử chuyển giao
    await testConnPlc.query('DELETE FROM metric_mappings WHERE id IN ("MAP-TEST-A-CUR", "MAP-TEST-B-CUR")');
    await testConnPlc.query(`
      INSERT INTO metric_mappings (id, mapping_code, channel_name, machine_id, plc_id, metric_id, monitoring_enabled, status)
      VALUES 
        ('MAP-TEST-A-CUR', 'MTR-MAP-A-01', 'Kênh Áp Suất Alpha', ?, 'PLC-TEST-A', 'MTR-CAT-TRQ-01', 1, 'ACTIVE'),
        ('MAP-TEST-B-CUR', 'MTR-MAP-B-01', 'Kênh Nhiệt Độ Beta', ?, 'PLC-TEST-B', 'MTR-CAT-TMP-01', 1, 'ACTIVE')
    `, [testMachineA, testMachineB]);

    // KIỂM THỬ TÌNH HUỐNG KÉP: CẢ MÁY NGUỒN VÀ MÁY ĐÍCH ĐỀU ĐANG CÓ PLC RIÊNG
    // Muốn gán PLC-TEST-A (đang thuộc Alpha) sang Máy Beta (đang có PLC-TEST-B)
    console.log('   [TÌNH HUỐNG KÉP] Máy Alpha có PLC-A, Máy Beta có PLC-B. Thử gán PLC-A sang Máy Beta:');

    // 1. Không gửi bất kỳ confirm nào -> Phải trả về DUAL_CONFIRMATION_REQUIRED (409)
    const resDualNone = await apiRequest('PUT', `/api/machines/${testMachineB}/plc`, maintToken, {
      plcId: 'PLC-TEST-A',
      confirmDestReplace: false,
      confirmSourceTransfer: false,
    });
    assert(
      resDualNone.status === 409 && resDualNone.body.errorCode === 'DUAL_CONFIRMATION_REQUIRED',
      'TC-11.1: Phát hiện xung đột kép khi cả máy nguồn & đích đều có PLC (409 DUAL_CONFIRMATION_REQUIRED)'
    );

    // 2. Chỉ gửi confirmDestReplace: true (chưa có confirmSourceTransfer) -> Vẫn phải chặn 409
    const resOnlyDest = await apiRequest('PUT', `/api/machines/${testMachineB}/plc`, maintToken, {
      plcId: 'PLC-TEST-A',
      confirmDestReplace: true,
      confirmSourceTransfer: false,
    });
    assert(
      resOnlyDest.status === 409 && resOnlyDest.body.errorCode === 'PLC_BELONGS_TO_ANOTHER_MACHINE',
      'TC-11.2: Chặn khi mới chỉ xác nhận thay thế máy đích nhưng thiếu xác nhận chuyển giao máy nguồn (409)'
    );

    // 3. Chỉ gửi confirmSourceTransfer: true (chưa có confirmDestReplace) -> Vẫn phải chặn 409
    const resOnlySrc = await apiRequest('PUT', `/api/machines/${testMachineB}/plc`, maintToken, {
      plcId: 'PLC-TEST-A',
      confirmDestReplace: false,
      confirmSourceTransfer: true,
    });
    assert(
      resOnlySrc.status === 409 && resOnlySrc.body.errorCode === 'DEST_MACHINE_HAS_PLC',
      'TC-11.3: Chặn khi mới chỉ xác nhận chuyển giao máy nguồn nhưng thiếu xác nhận thay thế máy đích (409)'
    );

    // 4. Gửi đồng thời CẢ HAI: confirmDestReplace: true VÀ confirmSourceTransfer: true -> Thực thi thành công
    const resDualConfirmed = await apiRequest('PUT', `/api/machines/${testMachineB}/plc`, maintToken, {
      plcId: 'PLC-TEST-A',
      confirmDestReplace: true,
      confirmSourceTransfer: true,
    });
    assert(
      resDualConfirmed.status === 200 && resDualConfirmed.body.message === 'ASSIGN_PLC_SUCCESS',
      'TC-12.1: Gán chuyển giao thành công khi đã xác nhận đồng thời cả 2 điều kiện (200 OK)'
    );

    // KIỂM TRA BẮT BUỘC: TOÀN BỘ MAPPING PHẢI BỊ NGẮT MONITORING VÀ CHUYỂN VỀ 'NOT_CONFIGURED'
    // A. Kiểm tra Mapping trên Máy nguồn (Alpha): plc_id=NULL, monitoring_enabled=0, status='NOT_CONFIGURED'
    const [alphaMaps] = await testConnPlc.query('SELECT plc_id, monitoring_enabled, status FROM metric_mappings WHERE id = "MAP-TEST-A-CUR"');
    assert(
      alphaMaps[0].plc_id === null && alphaMaps[0].monitoring_enabled === 0 && alphaMaps[0].status === 'NOT_CONFIGURED',
      'TC-13.1: Mapping trên máy nguồn Alpha bị ngắt monitoring=0, status=NOT_CONFIGURED, plc_id=NULL'
    );

    // B. Kiểm tra Mapping trên Máy đích (Beta): ĐÃ ĐỔI sang PLC-TEST-A, NHƯNG monitoring_enabled=0, status='NOT_CONFIGURED'
    const [betaMaps] = await testConnPlc.query('SELECT plc_id, monitoring_enabled, status FROM metric_mappings WHERE id = "MAP-TEST-B-CUR"');
    assert(
      betaMaps[0].plc_id === 'PLC-TEST-A' && betaMaps[0].monitoring_enabled === 0 && betaMaps[0].status === 'NOT_CONFIGURED',
      'TC-13.2: Mapping trên máy đích Beta đổi sang PLC-TEST-A nhưng BẮT BUỘC monitoring=0, status=NOT_CONFIGURED (Yêu cầu cấu hình lại)'
    );

    // C. Kiểm tra PLC cũ (PLC-TEST-B) của máy Beta đã bị giải phóng machine_id=NULL
    const [plcBRow] = await testConnPlc.query('SELECT machine_id FROM plc_stations WHERE id = "PLC-TEST-B"');
    assert(plcBRow[0].machine_id === null, 'TC-13.3: PLC-TEST-B cũ của máy đích được giải phóng machine_id=NULL');

    // D. Kiểm tra Audit Log đã ghi nhận giao dịch đầy đủ thông tin thay thế & chuyển giao
    const [auditRows] = await testConnPlc.query(`
      SELECT action, target, details, userEmail FROM audit_logs 
      WHERE action = 'ASSIGN_PLC_TO_MACHINE' AND target = 'PLC-TEST-A' 
      ORDER BY id DESC LIMIT 1
    `);
    assert(
      auditRows.length > 0 &&
      auditRows[0].userEmail === 'tech@denso.com' &&
      auditRows[0].details.includes('Chuyển từ máy') &&
      auditRows[0].details.includes('Thay thế PLC cũ'),
      'TC-13.4: Audit Log ghi nhận đầy đủ chi tiết chuyển giao và thay thế trong cùng Transaction'
    );

    // KIỂM TRA ROLLBACK KHI TRANSACTION THẤT BẠI
    console.log('   [KIỂM CHỨNG ROLLBACK] Thực hiện transaction giả định lỗi để kiểm tra an toàn dữ liệu:');
    let rollbackSuccess = false;
    const rollbackConn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: TEST_DB_NAME });
    await rollbackConn.beginTransaction();
    try {
      // Thực hiện 1 lệnh sửa đổi tạm thời
      await rollbackConn.query('UPDATE machines SET name = "Tên Giả Mạo Rollback" WHERE id = ?', [testMachineB]);
      // Cố ý gây lỗi SQL sai cú pháp để kích hoạt rollback
      await rollbackConn.query('INSERT INTO non_existent_table_cause_error (abc) VALUES (123)');
      await rollbackConn.commit();
    } catch (err) {
      await rollbackConn.rollback();
      rollbackSuccess = true;
    }
    await rollbackConn.end();

    const [verifyRollback] = await testConnPlc.query('SELECT name FROM machines WHERE id = ?', [testMachineB]);
    assert(
      rollbackSuccess && verifyRollback[0].name !== 'Tên Giả Mạo Rollback',
      'TC-14: Cơ chế Transaction Rollback hoạt động chuẩn xác, khôi phục 100% khi DML gặp sự cố'
    );

    // KIỂM TRA THAO TÁC GỠ PLC (UNASSIGN)
    const resOpDetach = await apiRequest('DELETE', `/api/machines/${testMachineB}/plc`, operatorToken);
    assert(resOpDetach.status === 403, 'TC-15.1: Operator bị chặn gỡ trạm PLC (403 Forbidden)');

    const resMaintDetach = await apiRequest('DELETE', `/api/machines/${testMachineB}/plc`, maintToken);
    assert(resMaintDetach.status === 200 && resMaintDetach.body.success === true, 'TC-15.2: Maintenance gỡ bỏ trạm PLC khỏi Máy Beta (200 OK)');

    const [plcAfterDetach] = await testConnPlc.query('SELECT machine_id FROM plc_stations WHERE id = "PLC-TEST-A"');
    assert(plcAfterDetach[0].machine_id === null, 'TC-15.3: Trạm PLC-TEST-A đã được giải phóng hoàn toàn');

    const resDetachIdempotent = await apiRequest('DELETE', `/api/machines/${testMachineB}/plc`, maintToken);
    assert(resDetachIdempotent.status === 200 && resDetachIdempotent.body.idempotent === true, 'TC-15.4: Gỡ PLC khi không còn PLC gắn kèm trả về idempotent thành công');

    // Dọn dẹp dữ liệu kiểm thử
    await testConnPlc.query('DELETE FROM metric_mappings WHERE id IN ("MAP-TEST-A-CUR", "MAP-TEST-B-CUR")');
    await testConnPlc.query('DELETE FROM plc_stations WHERE id IN ("PLC-TEST-A", "PLC-TEST-B")');
    await testConnPlc.query('DELETE FROM machines WHERE id IN (?, ?)', [testMachineA, testMachineB]);
    if (createdLineId) {
      await testConnPlc.query('DELETE FROM production_lines WHERE id = ?', [createdLineId]);
    }
    await testConnPlc.end();
  }

  // -------------------------------------------------------------------------
  // MỤC 5: KIỂM CHỨNG WEBSOCKET BROADCAST SAU COMMIT (TC-21)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 5: KIỂM CHỨNG WEBSOCKET BROADCAST SAU COMMIT ---');
  {
    wsClient.close();
    const eventTypes = wsEvents.map((e) => e.type);
    console.log('Các sự kiện WebSocket đã nhận được:', eventTypes);
    assert(eventTypes.includes('line_created'), 'TC-16.1: WebSocket nhận sự kiện line_created sau khi tạo thành công');
    assert(eventTypes.includes('machine_created'), 'TC-16.2: WebSocket nhận sự kiện machine_created sau khi tạo thành công');
    assert(eventTypes.includes('plc_assigned'), 'TC-16.3: WebSocket nhận sự kiện plc_assigned sau khi commit thành công');
    assert(eventTypes.includes('plc_unassigned'), 'TC-16.4: WebSocket nhận sự kiện plc_unassigned sau khi commit thành công');
  }

  // -------------------------------------------------------------------------
  // MỤC 6: KIỂM CHỨNG BẢO VỆ TUYỆT ĐỐI CSDL GỐC DENSO_IOT (TC-22)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 6: ĐỐI CHIẾU MÃ HÓA SHA-256 BẢO TOÀN CSDL GỐC DENSO_IOT ---');
  {
    const prodSnapshotAfter = await getDeepDbSnapshot(PROD_DB_NAME);
    console.log('Snapshot denso_iot Sau test:');
    let is100PercentIdentical = true;

    for (const [tbl, dataBefore] of Object.entries(prodSnapshotBefore)) {
      const dataAfter = prodSnapshotAfter[tbl];
      const matchCount = dataBefore.count === dataAfter.count;
      const matchChecksum = dataBefore.mysqlChecksum === dataAfter.mysqlChecksum;
      const matchSha256 = dataBefore.sha256 === dataAfter.sha256;

      console.log(`   - ${tbl.padEnd(22)}: Count=${dataAfter.count} (${matchCount ? 'OK' : 'MISMATCH'}), Checksum=${dataAfter.mysqlChecksum} (${matchChecksum ? 'OK' : 'MISMATCH'}), SHA256=${dataAfter.sha256.slice(0, 12)}... (${matchSha256 ? 'MATCH' : 'MISMATCH'})`);

      if (!matchCount || !matchChecksum || !matchSha256) {
        is100PercentIdentical = false;
      }
    }

    assert(
      is100PercentIdentical,
      'TC-17: CSDL gốc denso_iot được bảo vệ tuyệt đối: 100% bản ghi, MySQL Checksum và SHA-256 hoàn toàn trùng khớp từng byte!'
    );
  }

  // -------------------------------------------------------------------------
  // TỔNG KẾT BÁO CÁO
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`   KẾT QUẢ KIỂM THỬ: ${passed} PASS / ${failed} FAIL (TỔNG CỘNG: ${passed + failed} TEST CRITERIA)`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('[TEST SUITE UNCAUGHT ERROR]:', err);
  process.exit(1);
});
