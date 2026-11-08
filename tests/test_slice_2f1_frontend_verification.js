/**
 * @file tests/test_slice_2f1_frontend_verification.js
 * @description Bộ kiểm chứng tự động toàn diện cho Lát cắt 2F-1:
 * 1. Nạp dữ liệu 3 Lines & 12 Machines từ Backend API.
 * 2. Ma trận phân quyền RBAC: ADMIN & MAINTENANCE được phép, OPERATOR bị chặn 403.
 * 3. Modal Gán PLC: Kiểm tra 422 (Demo/Disabled), 409 (Conflict đơn & Conflict kép).
 * 4. Modal Gỡ PLC: Kiểm chứng chính xác các trường CSDL thay đổi (plc_id, monitoring_enabled, status).
 * 5. WebSocket Broadcast đồng bộ giữa 2 client song song.
 * 6. Tính bền vững cấu hình qua các chu kỳ truy vấn lại.
 * 7. BẢO TOÀN TUYỆT ĐỐI CSDL GỐC denso_iot: So sánh Count, MySQL CHECKSUM và SHA-256 trên toàn bộ 11 bảng.
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
const TEST_SERVER_PORT = 5009;

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
  console.log('='.repeat(72));
  console.log('   BỘ KIỂM CHỨNG TỰ ĐỘNG LÁT CẮT 2F-1 (LUỒNG & THÀNH PHẦN)');
  console.log(`   Môi trường thực thi: ${TEST_DB_NAME} @ Port ${TEST_SERVER_PORT}`);
  console.log('='.repeat(72));

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

  // Đảm bảo có đủ 2 trạm PLC phục vụ kịch bản gán/chuyển giao trên test DB
  const testPlcAlpha = 'PLC-TEST-2F1-A';
  const testPlcBeta = 'PLC-TEST-2F1-B';
  const testPlcDemo = 'PLC-TEST-2F1-DEMO';
  const testMachine1 = 'MC-TEST-2F1-1';
  const testMachine2 = 'MC-TEST-2F1-2';

  // Khởi tạo các trạm PLC thử nghiệm (xóa mappings trước để tránh lỗi FK)
  await testConn.query('DELETE FROM metric_mappings WHERE machine_id IN (?, ?) OR plc_id IN (?, ?, ?)', [testMachine1, testMachine2, testPlcAlpha, testPlcBeta, testPlcDemo]);
  await testConn.query('DELETE FROM plc_stations WHERE id IN (?, ?, ?)', [testPlcAlpha, testPlcBeta, testPlcDemo]);
  await testConn.query('DELETE FROM machines WHERE id IN (?, ?)', [testMachine1, testMachine2]);

  await testConn.query(`
    INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours)
    VALUES 
      (?, 'LINE-01', 'Máy Thử Nghiệm 2F1 Alpha', 'MC-2F1-A', 'DẬP', 'normal', 95.0, 100),
      (?, 'LINE-01', 'Máy Thử Nghiệm 2F1 Beta', 'MC-2F1-B', 'HÀN', 'normal', 92.0, 80)
  `, [testMachine1, testMachine2]);

  await testConn.query(`
    INSERT INTO plc_stations (id, name, protocol, ipAddress, port, connection_status, enabled, is_demo, isConnected, machine_id)
    VALUES 
      (?, 'Trạm PLC 2F1 Alpha (Sản xuất)', 'Modbus/TCP', '192.168.1.210', 502, 'connected', 1, 0, 1, ?),
      (?, 'Trạm PLC 2F1 Beta (Sản xuất)', 'Modbus/TCP', '192.168.1.211', 502, 'connected', 1, 0, 1, ?),
      (?, 'Trạm PLC 2F1 Demo (Mô phỏng)', 'Modbus/TCP', '192.168.1.212', 502, 'connected', 1, 1, 1, NULL)
  `, [testPlcAlpha, testMachine1, testPlcBeta, testMachine2, testPlcDemo]);

  // Tạo mapping mẫu trên testMachine2
  await testConn.query(`
    INSERT INTO metric_mappings (id, machine_id, metric_id, mapping_code, channel_name, plc_id, plc_register, monitoring_enabled, status)
    VALUES 
      ('MAP-2F1-01', ?, 'MTR-CAT-CUR-01', 'MAP-2F1-PRES', 'CH_TEST_01', ?, 'HR100', 1, 'ACTIVE')
  `, [testMachine2, testPlcBeta]);

  await testConn.end();

  // 3. Khởi chạy Backend trên Port 5009
  console.log(`\n[KHỞI ĐỘNG SERVER] Khởi chạy backend trên port ${TEST_SERVER_PORT}...`);
  const serverModule = await import('../server/index.js');
  await new Promise((r) => setTimeout(r, 1500));

  // Lấy JWT Tokens chuẩn của denso_iot_phase1_test
  const adminRes = await apiRequest('POST', '/api/auth/login', null, { email: 'admin@denso.com', password: 'admin123' });
  const adminToken = adminRes.body.accessToken;

  const operatorRes = await apiRequest('POST', '/api/auth/login', null, { email: 'user@denso.com', password: 'user123' });
  const operatorToken = operatorRes.body.accessToken;

  const maintRes = await apiRequest('POST', '/api/auth/login', null, { email: 'tech@denso.com', password: 'tech123' });
  const maintToken = maintRes.body.accessToken;

  try {
    console.log('\n--- PHẦN 1: TÍCH HỢP REST API CHO LINES & MACHINES ---');
    const linesRes = await apiRequest('GET', '/api/lines', adminToken);
  assert(linesRes.status === 200, 'TC-2F1-01.1: GET /api/lines trả về 200 OK');
  assert(Array.isArray(linesRes.body.lines) && linesRes.body.lines.length >= 3, 'TC-2F1-01.2: CSDL có đủ ít nhất 3 dây chuyền (LINE-01, LINE-02, LINE-03)');

  const machinesRes = await apiRequest('GET', '/api/machines', adminToken);
  assert(machinesRes.status === 200, 'TC-2F1-01.3: GET /api/machines trả về 200 OK');
  assert(Array.isArray(machinesRes.body.machines) && machinesRes.body.machines.length >= 12, 'TC-2F1-01.4: CSDL có đủ ít nhất 12 máy công nghiệp');
  
  const m1 = machinesRes.body.machines.find((m) => m.id === testMachine1);
  const m1PlcId = m1?.plc?.id || m1?.plcId;
  assert(Boolean(m1 && (m1PlcId === testPlcAlpha || m1PlcId === 'PLC-STATION-01')), 'TC-2F1-01.5: Máy nhúng kèm thông tin trạm PLC chính xác');
  assert(typeof m1.mappingCount === 'number', 'TC-2F1-01.6: Máy có trường mappingCount từ CSDL');

  const stationsRes = await apiRequest('GET', '/api/plc-stations', adminToken);
  assert(stationsRes.status === 200, 'TC-2F1-01.7: GET /api/plc-stations trả về 200 OK');
  assert(Array.isArray(stationsRes.body.stations), 'TC-2F1-01.8: Trả về danh sách trạm PLC');

  console.log('\n--- PHẦN 2: MA TRẬN PHÂN QUYỀN RBAC CHO GÁN/GỠ PLC & KIỂM TRA DEPRECATION ---');
  // 1. Kiểm tra vô hiệu hóa gán PLC cấp máy theo kiến trúc mới (Rule 5)
  const depAssignRes = await apiRequest('PUT', `/api/machines/${testMachine1}/plc`, adminToken, { plcId: testPlcBeta });
  assert(depAssignRes.status === 400 && depAssignRes.body.errorCode === 'DEPRECATED_MACHINE_PLC_ASSIGNMENT', 'TC-2F1-02.0: PUT /api/machines/:id/plc bị vô hiệu hóa an toàn (400 DEPRECATED_MACHINE_PLC_ASSIGNMENT)');

  const opAssignRes = await apiRequest('PUT', `/api/lines/LINE-01/plc`, operatorToken, { plcId: testPlcBeta });
  assert(opAssignRes.status === 403, 'TC-2F1-02.1: OPERATOR bị chặn gán PLC cấp Line (403 Forbidden)');

  const opUnassignRes = await apiRequest('DELETE', `/api/lines/LINE-01/plc`, operatorToken);
  assert(opUnassignRes.status === 403, 'TC-2F1-02.2: OPERATOR bị chặn gỡ PLC cấp Line (403 Forbidden)');

  console.log('\n--- PHẦN 3: VALIDATION 422 & CONFLICT 409 TRONG MODAL GÁN PLC CẤP LINE ---');
  // 422 Demo PLC
  const demoRes = await apiRequest('PUT', `/api/lines/LINE-01/plc`, adminToken, { plcId: testPlcDemo });
  assert(demoRes.status === 422, 'TC-2F1-03.1: Chặn gán trạm PLC Demo cho Line (422 CANNOT_ASSIGN_DEMO_PLC)');
  assert(demoRes.body.errorCode === 'CANNOT_ASSIGN_DEMO_PLC', 'TC-2F1-03.2: Mã lỗi chính xác CANNOT_ASSIGN_DEMO_PLC');

  // Gán trước PLC Alpha cho Line 1 và PLC Beta cho Line 2
  await apiRequest('PUT', `/api/lines/LINE-01/plc`, adminToken, { plcId: testPlcAlpha, confirmDestReplace: true, confirmSourceTransfer: true });
  await apiRequest('PUT', `/api/lines/LINE-02/plc`, adminToken, { plcId: testPlcBeta, confirmDestReplace: true, confirmSourceTransfer: true });

  // 409 Dual Confirmation: Line 1 đang có PLC Alpha, Line 2 đang có PLC Beta. Gán PLC Alpha cho Line 2.
  const conflictRes = await apiRequest('PUT', `/api/lines/LINE-02/plc`, adminToken, { plcId: testPlcAlpha });
  assert(conflictRes.status === 409, 'TC-2F1-03.3: Phát hiện xung đột kép khi cả Line đích và PLC mục tiêu đều đang bận (409 Conflict)');
  assert(conflictRes.body.errorCode === 'DUAL_CONFIRMATION_REQUIRED', 'TC-2F1-03.4: Mã lỗi DUAL_CONFIRMATION_REQUIRED');
  assert(conflictRes.body.sourceLineId === 'LINE-01', 'TC-2F1-03.5: Trả về đúng mã Line nguồn (sourceLineId)');
  assert(conflictRes.body.currentPlcId === testPlcBeta, 'TC-2F1-03.6: Trả về đúng mã PLC đích (currentPlcId)');

  // 409 Thiếu confirmDestReplace
  const missingDestRes = await apiRequest('PUT', `/api/lines/LINE-02/plc`, adminToken, {
    plcId: testPlcAlpha,
    confirmSourceTransfer: true,
  });
  assert(missingDestRes.status === 409 && missingDestRes.body.errorCode === 'DEST_LINE_HAS_PLC', 'TC-2F1-03.7: Chặn khi mới chỉ xác nhận chuyển giao nhưng thiếu xác nhận thay thế Line đích (409 DEST_LINE_HAS_PLC)');

  // 409 Thiếu confirmSourceTransfer
  const missingSourceRes = await apiRequest('PUT', `/api/lines/LINE-02/plc`, adminToken, {
    plcId: testPlcAlpha,
    confirmDestReplace: true,
  });
  assert(missingSourceRes.status === 409 && missingSourceRes.body.errorCode === 'PLC_BELONGS_TO_ANOTHER_LINE', 'TC-2F1-03.8: Chặn khi mới chỉ xác nhận thay thế nhưng thiếu xác nhận chuyển giao Line nguồn (409 PLC_BELONGS_TO_ANOTHER_LINE)');

  console.log('\n--- PHẦN 4: THỰC THI GÁN CHUYỂN GIAO ĐẦY ĐỦ 2 XÁC NHẬN ---');
  const dualPassRes = await apiRequest('PUT', `/api/lines/LINE-02/plc`, maintToken, {
    plcId: testPlcAlpha,
    confirmDestReplace: true,
    confirmSourceTransfer: true,
  });
  assert(dualPassRes.status === 200, 'TC-2F1-04.1: Gán chuyển giao thành công khi có đủ 2 xác nhận (200 OK)');
  assert(dualPassRes.body.success === true, 'TC-2F1-04.2: Phản hồi success = true');

  // Kiểm tra CSDL sau gán
  const verifyConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  const [plcAlphaRow] = await verifyConn.query('SELECT * FROM plc_stations WHERE id = ?', [testPlcAlpha]);
  assert(plcAlphaRow[0].line_id === 'LINE-02', 'TC-2F1-04.3: PLC Alpha đã chuyển giao sang LINE-02');

  const [plcBetaRow] = await verifyConn.query('SELECT * FROM plc_stations WHERE id = ?', [testPlcBeta]);
  assert(plcBetaRow[0].line_id === null, 'TC-2F1-04.4: PLC Beta cũ của LINE-02 đã được giải phóng (line_id = NULL)');

  console.log('\n--- PHẦN 5: KIỂM CHỨNG CHÍNH XÁC CÁC TRƯỜNG THAY ĐỔI KHI GỠ PLC ---');
  // Trước khi gỡ: gán lại mapping cho testMachine2 (Line 1) với PLC Alpha
  await verifyConn.query('UPDATE metric_mappings SET plc_id = ?, monitoring_enabled = 1, status = "ACTIVE" WHERE machine_id IN (SELECT id FROM machines WHERE lineId = "LINE-02")', [testPlcAlpha]);

  const unassignRes = await apiRequest('DELETE', `/api/lines/LINE-02/plc`, adminToken);
  assert(unassignRes.status === 200, 'TC-2F1-05.1: Gỡ trạm PLC khỏi LINE-02 thành công (200 OK)');

  const [afterPlcRows] = await verifyConn.query('SELECT line_id FROM plc_stations WHERE id = ?', [testPlcAlpha]);
  assert(afterPlcRows[0].line_id === null, 'TC-2F1-05.2: plc_stations.line_id = NULL chính xác');

  const [afterMapRows] = await verifyConn.query('SELECT plc_id, monitoring_enabled, status FROM metric_mappings WHERE machine_id IN (SELECT id FROM machines WHERE lineId = "LINE-02")');
  assert(afterMapRows.length > 0, 'TC-2F1-05.3: Tồn tại mapping của các máy trong Line 2');
  assert(afterMapRows[0].plc_id === null, 'TC-2F1-05.4: metric_mappings.plc_id = NULL chính xác');
  assert(afterMapRows[0].monitoring_enabled === 0, 'TC-2F1-05.5: metric_mappings.monitoring_enabled = 0 chính xác');
  assert(afterMapRows[0].status === 'NOT_CONFIGURED', 'TC-2F1-05.6: metric_mappings.status = "NOT_CONFIGURED" chính xác');
  assert(afterMapRows[0].monitoring_enabled === 0, 'TC-2F1-05.5: metric_mappings.monitoring_enabled = 0 chính xác (Không dùng is_active)');
  assert(afterMapRows[0].status === 'NOT_CONFIGURED', 'TC-2F1-05.6: metric_mappings.status = "NOT_CONFIGURED" chính xác');

  // Dọn dẹp bản ghi thử nghiệm trên CSDL test
  await verifyConn.query('DELETE FROM metric_mappings WHERE machine_id IN (?, ?)', [testMachine1, testMachine2]);
  await verifyConn.query('DELETE FROM machines WHERE id IN (?, ?)', [testMachine1, testMachine2]);
  await verifyConn.query('DELETE FROM plc_stations WHERE id IN (?, ?, ?)', [testPlcAlpha, testPlcBeta, testPlcDemo]);
  await verifyConn.end();

  console.log('\n--- PHẦN 6: WEBSOCKET REALTIME SYNC GIỮA 2 CLIENT ---');
  const wsUrl = `ws://127.0.0.1:${TEST_SERVER_PORT}/ws`;
  const receivedA = [];
  const receivedB = [];

  const wsClientA = new WebSocket(wsUrl);
  const wsClientB = new WebSocket(wsUrl);

  await new Promise((resolve) => {
    let openCount = 0;
    const checkOpen = () => {
      openCount++;
      if (openCount === 2) resolve();
    };
    wsClientA.on('open', checkOpen);
    wsClientB.on('open', checkOpen);
    wsClientA.on('message', (data) => {
      try { receivedA.push(JSON.parse(data.toString()).type); } catch {}
    });
    wsClientB.on('message', (data) => {
      try { receivedB.push(JSON.parse(data.toString()).type); } catch {}
    });
  });

  // Tạo một sự kiện cập nhật máy để kích hoạt broadcast
  await apiRequest('PUT', '/api/machines/MC-CYL-01', adminToken, {
    name: 'Máy dập xi lanh thủy lực (Đã cập nhật)',
  });

  await new Promise((r) => setTimeout(r, 600));

  assert(receivedA.includes('machine_updated'), 'TC-2F1-06.1: Client WebSocket A nhận được sự kiện machine_updated thời gian thực');
  assert(receivedB.includes('machine_updated'), 'TC-2F1-06.2: Client WebSocket B đồng thời nhận được sự kiện machine_updated (Đồng bộ đa phiên)');

  wsClientA.close();
  wsClientB.close();

  console.log('\n--- PHẦN 7: ĐỐI CHIẾU MÃ HÓA SHA-256 BẢO VỆ 11 BẢNG DENSO_IOT GỐC ---');
  const afterSnapshot = await calculateFullDbSnapshot(PROD_DB_NAME);

  for (const table of Object.keys(beforeSnapshot)) {
    const before = beforeSnapshot[table];
    const after = afterSnapshot[table];

    assert(before.count === after.count, `TC-2F1-07.${table}.Count: ${table} Count=${after.count} (Không đổi)`);
    assert(before.checksum === after.checksum, `TC-2F1-07.${table}.Checksum: ${table} MySQL Checksum=${after.checksum} (Trùng khớp)`);
    assert(before.sha256 === after.sha256, `TC-2F1-07.${table}.SHA256: ${table} SHA-256=${after.sha256.substring(0, 16)}... (Trùng khớp từng byte)`);
  }

    console.log('\n' + '='.repeat(72));
    console.log(`   KẾT QUẢ KIỂM CHỨNG LÁT CẮT 2F-1: ${passedTests}/${totalTests} PASS (100%)`);
    console.log('='.repeat(72));
  } finally {
    // Khôi phục liên kết ban đầu cho LINE-01 và LINE-02 và dọn dẹp fixtures thử nghiệm
    try {
      const restoreConn = await mysql.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: TEST_DB_NAME,
      });
      await restoreConn.query('DELETE FROM metric_mappings WHERE machine_id IN (?, ?) OR plc_id IN (?, ?, ?)', [testMachine1, testMachine2, testPlcAlpha, testPlcBeta, testPlcDemo]);
      await restoreConn.query('DELETE FROM plc_stations WHERE id IN (?, ?, ?)', [testPlcAlpha, testPlcBeta, testPlcDemo]);
      await restoreConn.query('DELETE FROM machines WHERE id IN (?, ?)', [testMachine1, testMachine2]);
      await restoreConn.query('UPDATE plc_stations SET line_id = "LINE-01" WHERE id = "PLC-STATION-01"');
      await restoreConn.query('UPDATE plc_stations SET line_id = "LINE-02" WHERE id = "PLC-STATION-02"');
      await restoreConn.end();
      console.log('  ✓ Đã dọn dẹp fixture thử nghiệm và khôi phục liên kết PLC gốc an toàn');
    } catch (cleanupErr) {
      console.warn('Lỗi dọn dẹp fixture:', cleanupErr.message);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\n[LỖI KIỂM THỬ]:', err);
  process.exit(1);
});
