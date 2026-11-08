/**
 * @file test_ui_revision_devices_plc.js
 * @description Bộ kiểm thử tự động toàn diện cho 3 yêu cầu DENSO IoT UI Revision:
 * 1. Yêu cầu 1: PLC gắn sẵn với Dây chuyền (Option A, không nút gán/đổi/gỡ, trạng thái trung thực UNKNOWN/DEMO)
 * 2. Yêu cầu 2: Thêm thiết bị mới (+ Thêm thiết bị, kế thừa PLC từ Line, validation, RBAC, CSDL TEST)
 * 3. Yêu cầu 3: Đổi tên Sidebar & Breadcrumb chính xác 9 mục theo 2 nhóm
 * 4. Kiểm toán an toàn CSDL Production (denso_iot giữ nguyên 16,924 records)
 */

import http from 'http';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const TEST_DB_NAME = 'denso_iot_phase1_test';
const PROD_DB_NAME = 'denso_iot';

let passedTests = 0;
let totalTests = 0;
const results = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    results.push({ name: message, status: 'PASS' });
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    results.push({ name: message, status: 'FAIL' });
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

async function request(method, endpoint, token = null, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
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
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('======================================================================');
  console.log('DENSO IoT UI REVISION — AUTOMATED ACCEPTANCE TEST SUITE');
  console.log('======================================================================\n');

  // Khởi tạo kết nối CSDL TEST
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  // Khởi tạo kết nối CSDL PRODUCTION để kiểm toán
  const prodConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: PROD_DB_NAME,
  });

  try {
    // Dọn dẹp trước kiểm thử bất kỳ fixture nào còn sót lại
    await testConn.query("DELETE FROM machines WHERE code LIKE 'MC-REVIS-%'");

    // -------------------------------------------------------------------------
    // 0. ĐĂNG NHẬP LẤY TOKEN CÁC ROLE
    // -------------------------------------------------------------------------
    console.log('[SECTION 0] Xác thực RBAC: Lấy Token Admin, Maintenance, Operator');
    const adminLogin = await request('POST', '/api/auth/login', null, {
      email: 'admin@denso.com',
      password: 'admin123',
    });
    const adminToken = adminLogin.body?.accessToken;
    assert(Boolean(adminToken), 'Đăng nhập Admin thành công nhận JWT token');

    const maintLogin = await request('POST', '/api/auth/login', null, {
      email: 'tech@denso.com',
      password: 'tech123',
    });
    const maintToken = maintLogin.body?.accessToken;
    assert(Boolean(maintToken), 'Đăng nhập Maintenance thành công');

    const opLogin = await request('POST', '/api/auth/login', null, {
      email: 'user@denso.com',
      password: 'user123',
    });
    const opToken = opLogin.body?.accessToken;
    assert(Boolean(opToken), 'Đăng nhập Operator thành công');

    // -------------------------------------------------------------------------
    // 1. KIỂM THỬ YÊU CẦU 1: PLC GẮN SẴN VỚI DÂY CHUYỀN
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 1] Yêu cầu 1: Cấu hình PLC gắn sẵn với Dây chuyền & Tính trung thực');

    // 1.0 Kiểm tra số lượng dây chuyền: CHÍNH XÁC 3 DÂY CHUYỀN GỐC (LN-PRS-01, LN-PNT-02, LN-ASM-03)
    const [allLines] = await testConn.query('SELECT id, code, name FROM production_lines ORDER BY id ASC');
    assert(allLines.length === 3, `CSDL TEST chỉ chứa đúng 3 dây chuyền gốc (actual: ${allLines.length})`);
    assert(allLines.some((l) => l.id === 'LINE-01' && l.code === 'LN-PRS-01'), 'Dây chuyền 1 chuẩn: LINE-01 / LN-PRS-01');
    assert(allLines.some((l) => l.id === 'LINE-02' && l.code === 'LN-PNT-02'), 'Dây chuyền 2 chuẩn: LINE-02 / LN-PNT-02');
    assert(allLines.some((l) => l.id === 'LINE-03' && l.code === 'LN-ASM-03'), 'Dây chuyền 3 chuẩn: LINE-03 / LN-ASM-03');

    // 1.1 Kiểm tra DB Fixture: PLC-STATION-01 -> LINE-01, PLC-STATION-02 -> LINE-02
    const [plcRows] = await testConn.query(`
      SELECT id, name, line_id, is_demo, enabled, connection_status
      FROM plc_stations
      WHERE id IN ('PLC-STATION-01', 'PLC-STATION-02')
      ORDER BY id ASC
    `);

    assert(plcRows.length === 2, 'Tìm thấy 2 trạm PLC fixture trong TEST DB');
    const plc1 = plcRows.find((r) => r.id === 'PLC-STATION-01');
    const plc2 = plcRows.find((r) => r.id === 'PLC-STATION-02');

    assert(plc1.line_id === 'LINE-01', 'PLC-STATION-01 được gắn trực tiếp với LINE-01');
    assert(plc2.line_id === 'LINE-02', 'PLC-STATION-02 được gắn trực tiếp với LINE-02');

    // 1.2 Không chỉnh sửa is_demo hay enabled để lách validation; giữ nguyên UNKNOWN / DISCONNECTED
    assert(plc1.is_demo === 1, 'PLC-STATION-01 giữ nguyên cờ is_demo = 1 (Không giả mạo Production)');
    assert(plc2.is_demo === 1, 'PLC-STATION-02 giữ nguyên cờ is_demo = 1 (Không giả mạo Production)');
    assert(plc1.connection_status === 'UNKNOWN', 'PLC-STATION-01 hiển thị trạng thái kết nối UNKNOWN thực tế');
    assert(plc2.connection_status === 'UNKNOWN', 'PLC-STATION-02 hiển thị trạng thái kết nối UNKNOWN thực tế');

    // 1.3 Kiểm tra API GET /api/lines trả về PLC gắn sẵn
    const resLines = await request('GET', '/api/lines', adminToken);
    assert(resLines.status === 200, 'GET /api/lines trả về 200 OK');
    assert(resLines.body.lines.length === 3, `API GET /api/lines chỉ trả về đúng 3 dây chuyền gốc (actual: ${resLines.body.lines.length})`);
    const apiLine1 = resLines.body.lines.find((l) => l.id === 'LINE-01');
    const apiLine2 = resLines.body.lines.find((l) => l.id === 'LINE-02');

    assert(apiLine1?.plc?.id === 'PLC-STATION-01', 'LINE-01 chứa PLC-STATION-01');
    assert(apiLine1?.plc?.isDemo === true, 'LINE-01 PLC có isDemo: true');
    assert(apiLine1?.plc?.status === 'UNKNOWN', 'LINE-01 PLC status là UNKNOWN');
    assert(apiLine2?.plc?.id === 'PLC-STATION-02', 'LINE-02 chứa PLC-STATION-02');

    // 1.4 Kiểm tra Máy kế thừa PLC từ Dây chuyền
    const resMachines = await request('GET', '/api/machines?lineId=LINE-01', adminToken);
    assert(resMachines.status === 200, 'GET /api/machines?lineId=LINE-01 trả về 200 OK');
    const machinesUnderLine1 = resMachines.body.machines;
    assert(machinesUnderLine1.length > 0, 'LINE-01 có các máy con');
    const allInheritedPlc1 = machinesUnderLine1.every((m) => m.plc?.id === 'PLC-STATION-01' && m.plc?.isDemo === true);
    assert(allInheritedPlc1, '100% máy thuộc LINE-01 kế thừa PLC-STATION-01 từ Dây chuyền');

    // 1.5 Kiểm tra API gán PLC trực tiếp vào máy đã bị khóa (Deprecated)
    const resDeprecatedPlc = await request('PUT', '/api/machines/MC-CYL-01/plc', adminToken, {
      plcId: 'PLC-STATION-01',
    });
    assert(resDeprecatedPlc.status === 400, 'PUT /api/machines/:id/plc bị chặn 400 DEPRECATED');

    // -------------------------------------------------------------------------
    // 2. KIỂM THỬ YÊU CẦU 2: THÊM THIẾT BỊ MỚI (+ THÊM THIẾT BỊ)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 2] Yêu cầu 2: Thao tác Thêm Thiết Bị Mới & Kế Thừa PLC Tự Động');

    const testMchCode = `MC-REVIS-${Date.now().toString().slice(-4)}`;
    const testMchName = `Máy Dập Thử Nghiệm Revision ${testMchCode}`;

    // 2.1 Backend Validation: Thiếu trường bắt buộc
    const resNoLine = await request('POST', '/api/machines', adminToken, {
      name: testMchName,
      code: testMchCode,
    });
    assert(resNoLine.status === 400, 'Chặn tạo máy khi thiếu lineId (400 Bad Request)');

    const resNoName = await request('POST', '/api/machines', adminToken, {
      lineId: 'LINE-01',
      code: testMchCode,
    });
    assert(resNoName.status === 400, 'Chặn tạo máy khi thiếu name (400 Bad Request)');

    const resNoCode = await request('POST', '/api/machines', adminToken, {
      lineId: 'LINE-01',
      name: testMchName,
    });
    assert(resNoCode.status === 400, 'Chặn tạo máy khi thiếu code (400 Bad Request)');

    const resBadStatus = await request('POST', '/api/machines', adminToken, {
      lineId: 'LINE-01',
      name: testMchName,
      code: testMchCode,
      status: 'invalid_status_xyz',
    });
    assert(resBadStatus.status === 400, 'Chặn trạng thái không hợp lệ (chỉ nhận normal / warning)');

    // 2.2 RBAC: Chỉ vai trò ADMIN mới được thêm máy
    const resOpCreate = await request('POST', '/api/machines', opToken, {
      lineId: 'LINE-01',
      name: testMchName,
      code: testMchCode,
    });
    assert(resOpCreate.status === 403, 'Operator bị chặn tạo thiết bị mới (403 Forbidden)');

    const resMaintCreate = await request('POST', '/api/machines', maintToken, {
      lineId: 'LINE-01',
      name: testMchName,
      code: testMchCode,
    });
    assert(resMaintCreate.status === 403, 'Maintenance bị chặn tạo thiết bị mới (403 Forbidden)');

    // 2.3 Admin tạo thiết bị thành công
    const resAdminCreate = await request('POST', '/api/machines', adminToken, {
      lineId: 'LINE-01',
      name: testMchName,
      code: testMchCode,
      type: 'stamping',
      status: 'normal',
      location: 'Khu vực thử nghiệm A1',
      description: 'Máy kiểm thử UI Revision',
    });
    assert(resAdminCreate.status === 201, 'Admin tạo thiết bị mới thành công (201 Created)');
    const createdMachine = resAdminCreate.body.machine;
    assert(createdMachine?.code === testMchCode, `Mã máy tạo đúng: ${testMchCode}`);
    assert(createdMachine?.plc?.id === 'PLC-STATION-01', 'Thiết bị mới tự động kế thừa PLC-STATION-01 từ LINE-01');
    assert(createdMachine?.status === 'normal', 'Trạng thái ban đầu là normal');
    assert(Array.isArray(createdMachine?.mappings) && createdMachine.mappings.length === 0, 'Thiết bị mới không bị bịa fake metric mapping');

    // 2.4 Chống trùng mã thiết bị (409 Conflict)
    const resDuplicateCode = await request('POST', '/api/machines', adminToken, {
      lineId: 'LINE-01',
      name: 'Máy Trùng Mã',
      code: testMchCode,
    });
    assert(
      resDuplicateCode.status === 409 && resDuplicateCode.body.errorCode === 'DUPLICATE_MACHINE_CODE',
      'Chặn trùng mã thiết bị (409 Conflict - DUPLICATE_MACHINE_CODE)'
    );

    // 2.5 Kiểm tra dữ liệu được lưu bền vững vào CSDL TEST
    const [dbMch] = await testConn.query('SELECT * FROM machines WHERE code = ?', [testMchCode]);
    assert(dbMch.length === 1, 'Thiết bị mới đã được ghi trực tiếp vào bảng machines trong denso_iot_phase1_test');
    assert(dbMch[0].name === testMchName, 'Tên thiết bị trong DB khớp 100%');

    // 2.6 Kiểm tra GET /api/machines hiển thị thiết bị vừa tạo
    const resSearchMch = await request('GET', `/api/machines?search=${testMchCode}`, adminToken);
    assert(resSearchMch.body.machines.some((m) => m.code === testMchCode), 'Danh sách máy cập nhật ngay và tìm thấy thiết bị vừa tạo');

    // Dọn dẹp máy kiểm thử
    await testConn.query('DELETE FROM machines WHERE code = ?', [testMchCode]);
    console.log('  ✓ Đã dọn dẹp thiết bị kiểm thử tạm thời');

    // -------------------------------------------------------------------------
    // 3. KIỂM THỬ YÊU CẦU 3: CẤU TRÚC SIDEBAR & BREADCRUMBS
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 3] Yêu cầu 3: Đổi tên Sidebar & Breadcrumb');

    const sidebarPath = path.join(__dirname, '../src/components/common/Sidebar.tsx');
    const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

    // Kiểm tra chính xác 5 mục nhóm Cấu hình
    assert(sidebarCode.includes('label: "Dây chuyền & Thiết bị"'), 'Mục 1: "Dây chuyền & Thiết bị"');
    assert(sidebarCode.includes('label: "Danh mục Thông số"'), 'Mục 2: "Danh mục Thông số"');
    assert(sidebarCode.includes('label: "Mapping & Ngưỡng cảnh báo"'), 'Mục 3: "Mapping & Ngưỡng cảnh báo"');
    assert(sidebarCode.includes('label: "Quản lý Tài khoản"'), 'Mục 4: "Quản lý Tài khoản"');
    assert(sidebarCode.includes('label: "Nhật ký Hệ thống"'), 'Mục 5: "Nhật ký Hệ thống"');

    // Kiểm tra chính xác 4 mục nhóm Giám sát
    assert(sidebarCode.includes('label: "Dashboard Tổng quan"'), 'Mục 6: "Dashboard Tổng quan"');
    assert(sidebarCode.includes('label: "Giám sát Thiết bị"'), 'Mục 7: "Giám sát Thiết bị"');
    assert(sidebarCode.includes('label: "Cảnh báo & Sự cố"'), 'Mục 8: "Cảnh báo & Sự cố"');
    assert(sidebarCode.includes('label: "Lịch sử Dữ liệu"'), 'Mục 9: "Lịch sử Dữ liệu"');

    // Kiểm tra tiêu đề nhóm
    assert(sidebarCode.includes('title="NHÓM CẤU HÌNH"'), 'Tiêu đề Nhóm: "NHÓM CẤU HÌNH"');
    assert(sidebarCode.includes('title="NHÓM GIÁM SÁT"'), 'Tiêu đề Nhóm: "NHÓM GIÁM SÁT"');

    // Kiểm tra Header Breadcrumbs
    const headerPath = path.join(__dirname, '../src/components/common/Header.tsx');
    const headerCode = fs.readFileSync(headerPath, 'utf8');
    assert(headerCode.includes('page: "Dây chuyền & Thiết bị"'), 'Header breadcrumb có "Dây chuyền & Thiết bị"');
    assert(headerCode.includes('page: "Giám sát Thiết bị"'), 'Header breadcrumb có "Giám sát Thiết bị"');
    assert(headerCode.includes('page: "Danh mục Thông số"'), 'Header breadcrumb có "Danh mục Thông số"');
    assert(headerCode.includes('page: "Mapping & Ngưỡng cảnh báo"'), 'Header breadcrumb có "Mapping & Ngưỡng cảnh báo"');
    assert(headerCode.includes('page: "Quản lý Tài khoản"'), 'Header breadcrumb có "Quản lý Tài khoản"');
    assert(headerCode.includes('page: "Nhật ký Hệ thống"'), 'Header breadcrumb có "Nhật ký Hệ thống"');
    assert(headerCode.includes('page: "Cảnh báo & Sự cố"'), 'Header breadcrumb có "Cảnh báo & Sự cố"');
    assert(headerCode.includes('page: "Lịch sử Dữ liệu"'), 'Header breadcrumb có "Lịch sử Dữ liệu"');

    // -------------------------------------------------------------------------
    // 4. KIỂM TOÁN AN TOÀN CSDL PRODUCTION (denso_iot)
    // -------------------------------------------------------------------------
    console.log('\n[SECTION 4] Kiểm toán An toàn CSDL Production (denso_iot)');

    const [[prodCnt]] = await prodConn.query('SELECT COUNT(*) as count FROM machine_telemetry_history');
    assert(
      prodCnt.count === 16924,
      `CSDL Production denso_iot được bảo vệ 100%: machine_telemetry_history có đúng ${prodCnt.count} bản ghi (chuẩn 16924, bất khả xâm phạm)`
    );

    console.log('\n======================================================================');
    console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} PASS (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log('======================================================================');

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Lỗi thực thi kiểm thử:', err);
    process.exit(1);
  } finally {
    try {
      await testConn.query("DELETE FROM machines WHERE code LIKE 'MC-REVIS-%'");
    } catch {}
    await testConn.end();
    await prodConn.end();
  }
}

run();
