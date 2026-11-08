/**
 * @file test_ui_fix_add_device.js
 * @description Kịch bản kiểm thử tích hợp tự động cho tính năng Thêm thiết bị mới (DENSO IoT)
 * Xác minh toàn diện quy trình:
 * 1. RBAC & JWT Authentication (Admin 201, Operator 403, Maintenance 403, Unauth 401)
 * 2. Backend Validation (Thiếu lineId, name, code; Trạng thái không hợp lệ)
 * 3. Chống trùng mã thiết bị (409 Conflict)
 * 4. Lưu thành công và tồn tại trong CSDL TEST (denso_iot_phase1_test)
 * 5. Tách biệt Trạng thái giám sát (no_data / UNKNOWN) và Quản lý thiết bị (active/inactive)
 * 6. Kế thừa PLC từ Dây chuyền, không tự sinh PLC riêng, telemetry giả hoặc mapping giả
 * 7. Tự dọn dẹp fixture trong try...finally, bảo toàn nguyên vẹn CSDL
 */

import assert from 'assert';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'denso-iot-secret-key-2026';

const adminToken = jwt.sign(
  { id: 'usr-admin-01', email: 'admin@denso.com', role: 'ADMIN', name: 'Quản trị viên' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const operatorToken = jwt.sign(
  { id: 'usr-operator-01', email: 'user@denso.com', role: 'OPERATOR', name: 'Nhân viên vận hành' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const maintToken = jwt.sign(
  { id: 'usr-maint-01', email: 'tech@denso.com', role: 'MAINTENANCE', name: 'Kỹ thuật viên' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function runTests() {
  console.log('=============================================================================');
  console.log('BẮT ĐẦU TEST TÍCH HỢP: TÍNH NĂNG THÊM THIẾT BỊ & UI REVISION (DENSO IoT)');
  console.log('=============================================================================');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'denso_iot_phase1_test',
    waitForConnections: true,
    connectionLimit: 5,
  });

  const testFixtureCode = 'MC-TEST-AUD-99';
  let createdMachineId = null;

  try {
    // Dọn dẹp trước nếu còn sót
    await pool.query('DELETE FROM machines WHERE code = ?', [testFixtureCode]);

    // -------------------------------------------------------------------------
    // TEST 1: Xác thực & Phân quyền RBAC
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Kiểm tra Xác thực & Phân quyền RBAC...');

    // 1.1 Không có token -> 401
    const resNoAuth = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineId: 'LINE-01', name: 'Máy Không Auth', code: testFixtureCode }),
    });
    assert.strictEqual(resNoAuth.status, 401, 'Không có token phải trả về HTTP 401');
    console.log('  ✔ Không có Authorization header -> 401 Unauthorized');

    // 1.2 Quyền Operator -> 403
    const resOperator = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({ lineId: 'LINE-01', name: 'Máy Operator', code: testFixtureCode }),
    });
    assert.strictEqual(resOperator.status, 403, 'Quyền Operator phải bị từ chối với HTTP 403');
    console.log('  ✔ Tài khoản OPERATOR -> 403 Forbidden');

    // 1.3 Quyền Maintenance -> 403 (Chỉ Admin mới được tạo máy)
    const resMaint = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${maintToken}`,
      },
      body: JSON.stringify({ lineId: 'LINE-01', name: 'Máy Maintenance', code: testFixtureCode }),
    });
    assert.strictEqual(resMaint.status, 403, 'Quyền Maintenance phải bị từ chối với HTTP 403');
    console.log('  ✔ Tài khoản MAINTENANCE -> 403 Forbidden');

    // -------------------------------------------------------------------------
    // TEST 2: Validation dữ liệu đầu vào
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Kiểm tra Validation dữ liệu đầu vào...');

    // 2.1 Thiếu lineId -> 400
    const resNoLine = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'Máy Thiếu Line', code: testFixtureCode }),
    });
    assert.strictEqual(resNoLine.status, 400, 'Thiếu lineId phải trả về HTTP 400');
    console.log('  ✔ Thiếu lineId -> 400 Bad Request');

    // 2.2 Thiếu Tên máy -> 400
    const resNoName = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ lineId: 'LINE-01', code: testFixtureCode }),
    });
    assert.strictEqual(resNoName.status, 400, 'Thiếu Tên máy phải trả về HTTP 400');
    console.log('  ✔ Thiếu Tên máy -> 400 Bad Request');

    // 2.3 Thiếu Mã máy -> 400
    const resNoCode = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ lineId: 'LINE-01', name: 'Máy Thiếu Code' }),
    });
    assert.strictEqual(resNoCode.status, 400, 'Thiếu Mã máy phải trả về HTTP 400');
    console.log('  ✔ Thiếu Mã máy -> 400 Bad Request');

    // 2.4 Trạng thái quản lý không hợp lệ -> 400
    const resInvalidMgmt = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        lineId: 'LINE-01',
        name: 'Máy Sai Mgmt',
        code: testFixtureCode,
        managementStatus: 'UNKNOWN_STATUS',
      }),
    });
    assert.strictEqual(resInvalidMgmt.status, 400, 'Trạng thái quản lý không hợp lệ phải trả về HTTP 400');
    console.log('  ✔ Trạng thái quản lý sai -> 400 Bad Request');

    // -------------------------------------------------------------------------
    // TEST 3: Tạo thiết bị thành công với Quyền ADMIN
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Kiểm tra Tạo thiết bị thành công (ADMIN)...');

    const resCreate = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        lineId: 'LINE-01',
        name: 'Robot Hàn Thử Nghiệm Tự Động',
        code: testFixtureCode,
        type: 'welding',
        status: 'no_data',
        managementStatus: 'active',
        location: 'Xưởng 1 - Phân khu Hàn A',
        description: 'Thiết bị tạo từ automated integration test',
      }),
    });

    assert.strictEqual(resCreate.status, 201, 'Tạo máy mới hợp lệ phải trả về HTTP 201');
    const createData = await resCreate.json();
    assert.ok(createData.machine, 'Response phải chứa thông tin machine');
    createdMachineId = createData.machine.id;

    assert.strictEqual(createData.machine.code, testFixtureCode);
    assert.strictEqual(createData.machine.status, 'no_data', 'Trạng thái giám sát khởi tạo phải là no_data');
    assert.strictEqual(createData.machine.managementStatus, 'active', 'Trạng thái quản lý phải là active');
    console.log(`  ✔ HTTP 201 Created: ID = ${createdMachineId}, code = ${testFixtureCode}`);
    console.log(`  ✔ Trạng thái giám sát: ${createData.machine.status} (Chưa có dữ liệu, không giả lập normal)`);
    console.log(`  ✔ Trạng thái quản lý: ${createData.machine.managementStatus} (Đang sử dụng)`);

    // -------------------------------------------------------------------------
    // TEST 4: Xác minh tồn tại trong MySQL TEST DB & Kế thừa PLC
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Xác minh lưu trữ trong MySQL TEST DB & Kế thừa PLC...');

    const [rows] = await pool.query('SELECT * FROM machines WHERE id = ?', [createdMachineId]);
    assert.strictEqual(rows.length, 1, 'Bản ghi phải tồn tại trong bảng machines của MySQL TEST');
    const dbMachine = rows[0];
    assert.strictEqual(dbMachine.code, testFixtureCode);
    assert.strictEqual(dbMachine.lineId, 'LINE-01');
    assert.strictEqual(dbMachine.status, 'no_data');
    assert.strictEqual(dbMachine.management_status, 'active');
    console.log('  ✔ Bản ghi đã lưu thành công trong CSDL denso_iot_phase1_test.machines');

    // Xác minh kế thừa PLC: máy thuộc LINE-01 phải kế thừa PLC của LINE-01
    const resGetById = await fetch(`${API_BASE}/api/machines/${encodeURIComponent(createdMachineId)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resGetById.status, 200);
    const getByIdData = await resGetById.json();
    assert.strictEqual(getByIdData.machine.plcId, 'PLC-STATION-01', 'Máy phải tự động kế thừa PLC-STATION-01 từ LINE-01');
    console.log(`  ✔ Máy tự động kế thừa PLC từ Dây chuyền: ${getByIdData.machine.plcId}`);

    // Xác minh không tạo PLC riêng, telemetry giả hoặc mapping giả
    const [extraPlcs] = await pool.query('SELECT COUNT(*) as cnt FROM plc_stations WHERE machine_id = ?', [createdMachineId]);
    assert.strictEqual(extraPlcs[0].cnt, 0, 'Không được tạo PLC trạm riêng cho máy');
    const [extraTelemetry] = await pool.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history WHERE machineId = ?', [createdMachineId]);
    assert.strictEqual(extraTelemetry[0].cnt, 0, 'Không được tự sinh telemetry giả cho máy mới');
    const [extraMappings] = await pool.query('SELECT COUNT(*) as cnt FROM metric_mappings WHERE machine_id = ?', [createdMachineId]);
    assert.strictEqual(extraMappings[0].cnt, 0, 'Không được tự sinh mapping giả');
    console.log('  ✔ Không phát sinh PLC riêng, không telemetry giả, không mapping giả');

    // -------------------------------------------------------------------------
    // TEST 5: Chống trùng mã thiết bị (409 Conflict)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Kiểm tra Chống trùng mã thiết bị...');

    const resDup = await fetch(`${API_BASE}/api/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        lineId: 'LINE-01',
        name: 'Máy Trùng Mã',
        code: testFixtureCode,
      }),
    });
    assert.strictEqual(resDup.status, 409, 'Trùng mã máy phải trả về HTTP 409');
    const dupData = await resDup.json();
    assert.strictEqual(dupData.errorCode, 'DUPLICATE_MACHINE_CODE');
    console.log('  ✔ Trùng mã máy -> 409 Conflict (DUPLICATE_MACHINE_CODE)');

    // -------------------------------------------------------------------------
    // TEST 6: Lấy danh sách máy theo dây chuyền (Persistence sau Refresh)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Kiểm tra Truy vấn danh sách máy sau khi tạo...');

    const resList = await fetch(`${API_BASE}/api/machines?lineId=LINE-01`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resList.status, 200);
    const listData = await resList.json();
    const foundInList = listData.machines.some((m) => m.id === createdMachineId);
    assert.ok(foundInList, 'Thiết bị mới phải xuất hiện trong danh sách máy của LINE-01');
    console.log('  ✔ Thiết bị mới xuất hiện đầy đủ trong API GET /api/machines?lineId=LINE-01');

    // -------------------------------------------------------------------------
    // TEST 7: Kiểm tra Audit Log
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Kiểm tra Ghi nhận Audit Log...');
    const [auditRows] = await pool.query(
      'SELECT * FROM audit_logs WHERE action = "CREATE_MACHINE" AND target = ?',
      [createdMachineId]
    );
    assert.ok(auditRows.length > 0, 'Thao tác tạo máy phải được ghi vào audit_logs');
    console.log(`  ✔ Audit log ghi nhận thành công: action = CREATE_MACHINE, target = ${createdMachineId}`);

    // -------------------------------------------------------------------------
    // TEST 8: Số lượng Dây chuyền bảo toàn nghiêm ngặt (chuẩn 3 dây chuyền)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Kiểm tra Số lượng Dây chuyền bảo toàn...');
    const [linesRows] = await pool.query('SELECT id, code FROM production_lines ORDER BY id');
    assert.strictEqual(linesRows.length, 3, 'CSDL TEST phải có chính xác 3 dây chuyền');
    console.log('  ✔ Số lượng dây chuyền vẫn duy trì chính xác 3 dây chuyền DENSO:');
    linesRows.forEach((l) => console.log(`    - ${l.id} (${l.code})`));

    console.log('\n=============================================================================');
    console.log('TẤT CẢ 8 MỤC KIỂM THỬ TÍCH HỢP ĐỀU PASS 100%!');
    console.log('=============================================================================');
  } finally {
    // Dọn dẹp fixture bắt buộc trong finally
    if (createdMachineId) {
      console.log(`\n[CLEANUP] Dọn dẹp máy kiểm thử: ${createdMachineId} (${testFixtureCode})...`);
      await pool.query('DELETE FROM machines WHERE id = ?', [createdMachineId]);
      console.log('  ✔ Đã dọn dẹp sạch sẽ fixture kiểm thử.');
    }
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});
