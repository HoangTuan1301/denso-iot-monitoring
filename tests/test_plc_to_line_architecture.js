/**
 * @file tests/test_plc_to_line_architecture.js
 * @description Bộ kiểm thử tự động toàn diện cho Chuyển đổi Kiến trúc PLC theo Dây chuyền (Option A)
 * Hệ thống DENSO Industrial IoT Monitoring System (KaiLink).
 * Môi trường: TEST ONLY (denso_iot_phase1_test)
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import {
  initDatabase,
  closeDatabase,
  getPool,
  getProductionLines,
  getProductionLineById,
  createProductionLine,
  getMachines,
  getMachineById,
  createMachine,
  assignPLCToLine,
  unassignPLCFromLine,
  assignPLCToMachine,
  unassignPLCFromMachine,
  createMetricMapping,
  updateMetricMapping,
  toggleMetricMappingMonitoring,
} from '../server/db-mysql.js';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const TEST_DB = 'denso_iot_phase1_test';
const PROD_DB = 'denso_iot';

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failCount++;
  }
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('  KIỂM THỬ TOÀN DIỆN: CHUYỂN ĐỔI KIẾN TRÚC PLC THEO DÂY CHUYỀN (OPTION A)');
  console.log(`  Môi trường: ${TEST_DB} (Local MySQL 3306)`);
  console.log('='.repeat(80));

  // 0. BẢO VỆ TUYỆT ĐỐI DATABASE PRODUCTION
  console.log('\n[BƯỚC 0] Kiểm toán an toàn: Kiểm tra CSDL Production denso_iot trước kiểm thử...');
  const prodConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: PROD_DB,
  });
  const [[prodCntBefore]] = await prodConn.query('SELECT COUNT(*) as count FROM machine_telemetry_history');
  const [[prodChkBefore]] = await prodConn.query('CHECKSUM TABLE machine_telemetry_history');
  assert(
    prodCntBefore.count === 16924 && prodChkBefore.Checksum === 871610130,
    'Database denso_iot giữ nguyên vẹn 16,924 bản ghi, Checksum 871610130',
    `Count=${prodCntBefore.count}, Checksum=${prodChkBefore.Checksum}`
  );
  await prodConn.end();

  // Khởi tạo pool kết nối MySQL backend cho denso_iot_phase1_test
  await initDatabase();

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB,
  });

  try {
    // SCENARIO 1: KIỂM TRA SCHEMA CỘT VÀ RÀNG BUỘC MỚI TRÊN plc_stations
    console.log('\n[SCENARIO 1] Kiểm tra schema cột line_id và các ràng buộc trên plc_stations...');
    const [cols] = await conn.query("SHOW COLUMNS FROM plc_stations LIKE 'line_id'");
    assert(cols.length === 1, 'Cột line_id tồn tại trong bảng plc_stations');

    const [lineIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'uq_plc_line_id'");
    assert(lineIdx.length >= 1 && lineIdx[0].Non_unique === 0, 'Ràng buộc UNIQUE KEY uq_plc_line_id tồn tại');

    const [fks] = await conn.query(`
      SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plc_stations' AND CONSTRAINT_NAME = 'fk_plc_line_id'
    `, [TEST_DB]);
    assert(
      fks.length === 1 && fks[0].REFERENCED_TABLE_NAME === 'production_lines' && fks[0].REFERENCED_COLUMN_NAME === 'id',
      'Foreign Key fk_plc_line_id trỏ chính xác về production_lines(id)'
    );

    // SCENARIO 2: KIỂM TRA ĐÃ GỠ RÀNG BUỘC CŨ VÀ BẢO LƯU CHỈ MỤC DI SẢN
    console.log('\n[SCENARIO 2] Kiểm tra đã gỡ ràng buộc cũ trên machine_id và thêm idx_plc_legacy_machine...');
    const [oldFks] = await conn.query(`
      SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plc_stations' AND CONSTRAINT_NAME = 'fk_plc_machine_id'
    `, [TEST_DB]);
    assert(oldFks.length === 0, 'Foreign Key cũ fk_plc_machine_id đã được gỡ bỏ hoàn toàn');

    const [oldUq] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'uq_plc_machine_id'");
    assert(oldUq.length === 0, 'Unique Key cũ uq_plc_machine_id đã được gỡ bỏ');

    const [legacyIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'idx_plc_legacy_machine'");
    assert(legacyIdx.length >= 1, 'Index di sản idx_plc_legacy_machine được duy trì');

    // SCENARIO 3: THIẾT LẬP DỮ LIỆU THỬ NGHIỆM
    console.log('\n[SCENARIO 3] Chuẩn bị dữ liệu thử nghiệm trong denso_iot_phase1_test...');
    const testLineA = 'LINE-TEST-ARCH-A';
    const testLineB = 'LINE-TEST-ARCH-B';
    const testMcA1 = 'MC-TEST-ARCH-A1';
    const testMcA2 = 'MC-TEST-ARCH-A2';
    const testMcB1 = 'MC-TEST-ARCH-B1';
    const testPlc1 = 'PLC-TEST-PROD-01';
    const testPlc2 = 'PLC-TEST-PROD-02';

    // Xóa dữ liệu cũ nếu có
    await conn.query('DELETE FROM metric_mappings WHERE machine_id IN (?, ?, ?)', [testMcA1, testMcA2, testMcB1]);
    await conn.query('DELETE FROM machines WHERE id IN (?, ?, ?)', [testMcA1, testMcA2, testMcB1]);
    await conn.query('DELETE FROM plc_stations WHERE id IN (?, ?)', [testPlc1, testPlc2]);
    await conn.query('DELETE FROM production_lines WHERE id IN (?, ?)', [testLineA, testLineB]);

    // Tạo 2 Lines
    await conn.query(`
      INSERT INTO production_lines (id, name, code, status, safetyScore, targetOutput, actualOutput, createdAt)
      VALUES 
        (?, 'Dây chuyền Thử nghiệm A', 'LN-TEST-A', 'normal', 95, 1000, 950, NOW()),
        (?, 'Dây chuyền Thử nghiệm B', 'LN-TEST-B', 'normal', 90, 800, 780, NOW())
    `, [testLineA, testLineB]);

    // Tạo 3 Machines (2 máy thuộc Line A, 1 máy thuộc Line B)
    await conn.query(`
      INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours, createdAt)
      VALUES 
        (?, ?, 'Máy Dập Thử Nghiệm A1', 'MC-T-A1', 'Dập', 'normal', 98, 50, NOW()),
        (?, ?, 'Máy Hàn Thử Nghiệm A2', 'MC-T-A2', 'Hàn', 'normal', 94, 60, NOW()),
        (?, ?, 'Máy Sơn Thử Nghiệm B1', 'MC-T-B1', 'Sơn', 'normal', 92, 40, NOW())
    `, [testMcA1, testLineA, testMcA2, testLineA, testMcB1, testLineB]);

    // Tạo 2 trạm PLC công nghiệp (không phải demo)
    await conn.query(`
      INSERT INTO plc_stations (id, name, protocol, ipAddress, port, connection_status, enabled, is_demo, isConnected)
      VALUES 
        (?, 'Trạm PLC Công Nghiệp 01', 'Modbus/TCP', '192.168.10.101', 502, 'CONNECTED', 1, 0, 1),
        (?, 'Trạm PLC Công Nghiệp 02', 'OPC-UA', '192.168.10.102', 4840, 'CONNECTED', 1, 0, 1)
    `, [testPlc1, testPlc2]);
    assert(true, 'Dữ liệu thử nghiệm đã được chuẩn bị thành công');

    // SCENARIO 4: GÁN TRẠM PLC CHO DÂY CHUYỀN (assignPLCToLine)
    console.log('\n[SCENARIO 4] Thực thi gán trạm PLC vào Dây chuyền...');
    const assignRes = await assignPLCToLine(testLineA, testPlc1, {}, { id: 'USR-TEST', name: 'Tester' });
    assert(assignRes.success === true, 'Gán PLC TEST-PLC-PROD-01 vào LINE-TEST-ARCH-A thành công');

    const [plcCheck1] = await conn.query('SELECT line_id FROM plc_stations WHERE id = ?', [testPlc1]);
    assert(plcCheck1[0].line_id === testLineA, 'Cột line_id trong plc_stations đã cập nhật chính xác LINE-TEST-ARCH-A');

    // SCENARIO 5: CHỐNG GÁN 2 PLC CHO 1 LINE (RULE 1)
    console.log('\n[SCENARIO 5] Kiểm tra Quy tắc 1: Mỗi dây chuyền có tối đa 1 PLC...');
    let threwReplaceConflict = false;
    try {
      await assignPLCToLine(testLineA, testPlc2, { confirmDestReplace: false });
    } catch (err) {
      threwReplaceConflict = err.errorCode === 'DEST_LINE_HAS_PLC';
    }
    assert(threwReplaceConflict, 'Cảnh báo 409 DEST_LINE_HAS_PLC khi gán PLC thứ 2 vào Line mà chưa xác nhận');

    // SCENARIO 6: CHỐNG GÁN 1 PLC CHO NHIỀU LINE (RULE 2)
    console.log('\n[SCENARIO 6] Kiểm tra Quy tắc 2: Một PLC chỉ thuộc tối đa 1 dây chuyền tại một thời điểm...');
    let threwTransferConflict = false;
    try {
      await assignPLCToLine(testLineB, testPlc1, { confirmSourceTransfer: false });
    } catch (err) {
      threwTransferConflict = err.errorCode === 'PLC_BELONGS_TO_ANOTHER_LINE';
    }
    assert(threwTransferConflict, 'Cảnh báo 409 PLC_BELONGS_TO_ANOTHER_LINE khi chuyển giao PLC sang Line khác mà chưa xác nhận');

    // SCENARIO 7: XÁC NHẬN KÉP (DUAL CONFIRMATION)
    console.log('\n[SCENARIO 7] Kiểm tra Dual Confirmation khi cả 2 điều kiện xung đột cùng xuất hiện...');
    // Gán testPlc2 cho Line B trước
    await assignPLCToLine(testLineB, testPlc2, {}, { id: 'USR-TEST' });

    let threwDualConflict = false;
    try {
      // Line A đang có PLC1, Line B đang có PLC2. Cố tình gán PLC2 vào Line A mà không truyền confirmation
      await assignPLCToLine(testLineA, testPlc2, {});
    } catch (err) {
      threwDualConflict = err.errorCode === 'DUAL_CONFIRMATION_REQUIRED';
    }
    assert(threwDualConflict, 'Bắt buộc xác nhận kép DUAL_CONFIRMATION_REQUIRED khi Line đích đã có PLC VÀ PLC nguồn thuộc Line khác');

    // Thực hiện gán thành công khi có đủ 2 cờ xác nhận
    const dualRes = await assignPLCToLine(testLineA, testPlc2, {
      confirmDestReplace: true,
      confirmSourceTransfer: true,
    });
    assert(dualRes.success === true, 'Gán thành công khi cung cấp đầy đủ cả 2 xác nhận');

    const [plcCheckAfterDual] = await conn.query('SELECT id, line_id FROM plc_stations WHERE id IN (?, ?)', [testPlc1, testPlc2]);
    const plc1Row = plcCheckAfterDual.find((r) => r.id === testPlc1);
    const plc2Row = plcCheckAfterDual.find((r) => r.id === testPlc2);
    assert(plc1Row.line_id === null, 'PLC cũ (PLC1) được tự động gỡ khỏi Line A (line_id = NULL)');
    assert(plc2Row.line_id === testLineA, 'PLC mới (PLC2) đã thuộc Line A');

    // SCENARIO 8: XỬ LÝ IDEMPOTENT KHI GÁN LẠI CHÍNH NÓ
    console.log('\n[SCENARIO 8] Kiểm tra tính Idempotent khi gán lại PLC cho cùng dây chuyền...');
    const idempotentRes = await assignPLCToLine(testLineA, testPlc2);
    assert(
      idempotentRes.success === true && idempotentRes.idempotent === true,
      'Gán lại PLC cho cùng dây chuyền trả về idempotent: true an toàn'
    );

    // SCENARIO 9: BẢO VỆ TUYỆT ĐỐI PLC DEMO (RULE 10)
    console.log('\n[SCENARIO 9] Kiểm tra Quy tắc 10: Không được gán PLC Demo cho dây chuyền sản xuất...');
    let threwDemoError = false;
    try {
      // PLC-STATION-01 là PLC Demo (is_demo = 1)
      await assignPLCToLine(testLineB, 'PLC-STATION-01');
    } catch (err) {
      threwDemoError = err.errorCode === 'CANNOT_ASSIGN_DEMO_PLC';
    }
    assert(threwDemoError, 'Từ chối với mã lỗi 422 CANNOT_ASSIGN_DEMO_PLC khi gán PLC Demo');

    // SCENARIO 10: TỪ CHỐI GÁN TRẠM PLC BỊ VÔ HIỆU HÓA (ENABLED = 0)
    console.log('\n[SCENARIO 10] Kiểm tra từ chối gán trạm PLC bị vô hiệu hóa...');
    await conn.query('UPDATE plc_stations SET enabled = 0 WHERE id = ?', [testPlc1]);
    let threwDisabledError = false;
    try {
      await assignPLCToLine(testLineB, testPlc1);
    } catch (err) {
      threwDisabledError = err.errorCode === 'CANNOT_ASSIGN_DISABLED_PLC';
    }
    assert(threwDisabledError, 'Từ chối với mã lỗi 422 CANNOT_ASSIGN_DISABLED_PLC khi PLC bị vô hiệu hóa');
    await conn.query('UPDATE plc_stations SET enabled = 1 WHERE id = ?', [testPlc1]);

    // SCENARIO 11: CÁC MÁY TRONG DÂY CHUYỀN KẾ THỪA PLC TỪ DÂY CHUYỀN (RULE 4)
    console.log('\n[SCENARIO 11] Kiểm tra Quy tắc 4: Các máy trong dây chuyền kế thừa thông tin PLC từ Line...');
    // Gán testPlc1 vào Line A
    await assignPLCToLine(testLineA, testPlc1, { confirmDestReplace: true });

    // Kiểm tra getMachines
    const lineAMachines = await getMachines({ lineId: testLineA });
    assert(lineAMachines.length === 2, 'Line A chứa đúng 2 máy thành phần');
    assert(
      lineAMachines[0].plc && lineAMachines[0].plc.id === testPlc1,
      'Máy A1 kế thừa chính xác PLC từ Line A'
    );
    assert(
      lineAMachines[1].plc && lineAMachines[1].plc.id === testPlc1,
      'Máy A2 kế thừa chính xác PLC từ Line A'
    );

    // Kiểm tra getMachineById
    const mcA1Detail = await getMachineById(testMcA1);
    assert(
      mcA1Detail && mcA1Detail.plcId === testPlc1 && mcA1Detail.plcName === 'Trạm PLC Công Nghiệp 01',
      'getMachineById trả về thông tin PLC kế thừa từ Line A'
    );

    // Kiểm tra getProductionLineById
    const lineADetail = await getProductionLineById(testLineA);
    assert(
      lineADetail && lineADetail.plc && lineADetail.plc.id === testPlc1,
      'getProductionLineById trả về đối tượng plc của dây chuyền'
    );

    // SCENARIO 12: VÔ HIỆU HÓA GÁN PLC CẤP MÁY (RULE 5)
    console.log('\n[SCENARIO 12] Kiểm tra Quy tắc 5: Bỏ chức năng gán PLC trực tiếp vào từng máy...');
    let threwMachineAssignDep = false;
    try {
      await assignPLCToMachine(testMcA1, testPlc1);
    } catch (err) {
      threwMachineAssignDep = err.errorCode === 'DEPRECATED_MACHINE_PLC_ASSIGNMENT';
    }
    assert(threwMachineAssignDep, 'assignPLCToMachine ném lỗi 400 DEPRECATED_MACHINE_PLC_ASSIGNMENT');

    let threwMachineUnassignDep = false;
    try {
      await unassignPLCFromMachine(testMcA1);
    } catch (err) {
      threwMachineUnassignDep = err.errorCode === 'DEPRECATED_MACHINE_PLC_ASSIGNMENT';
    }
    assert(threwMachineUnassignDep, 'unassignPLCFromMachine ném lỗi 400 DEPRECATED_MACHINE_PLC_ASSIGNMENT');

    // SCENARIO 13: XÁC THỰC METRIC MAPPING VỚI PLC CỦA DÂY CHUYỀN
    console.log('\n[SCENARIO 13] Kiểm tra Metric Mapping với PLC theo Dây chuyền...');
    // Gán testPlc2 cho Line B
    await assignPLCToLine(testLineB, testPlc2, {}, { id: 'USR-TEST' });

    // Tạo mapping hợp lệ: Máy A1 gán với testPlc1 (thuộc cùng Line A)
    const validMapping = await createMetricMapping({
      id: 'MAP-TEST-A1-PRS',
      machine_id: testMcA1,
      metric_id: 'MTR-CAT-PRS-01',
      mapping_code: 'MAP-TEST-A1-PRS',
      channel_name: 'Kênh Áp Suất Thử Nghiệm A1',
      plc_id: testPlc1,
      plc_register: 'DB1.DBD10',
      data_source_type: 'PLC_DIRECT',
    });
    assert(validMapping && validMapping.id === 'MAP-TEST-A1-PRS', 'Tạo Metric Mapping hợp lệ với PLC của Line A thành công');

    // Tạo mapping không hợp lệ: Máy A1 (Line A) gán với testPlc2 (thuộc Line B)
    let threwMappingMismatch = false;
    try {
      await createMetricMapping({
        id: 'MAP-TEST-A1-CROSS',
        machine_id: testMcA1,
        metric_id: 'MTR-CAT-PRS-01',
        mapping_code: 'MAP-TEST-A1-CROSS',
        channel_name: 'Kênh Gán Chéo Line B',
        plc_id: testPlc2,
        plc_register: 'DB1.DBD20',
      });
    } catch (err) {
      threwMappingMismatch = err.errorCode === 'PLC_LINE_MISMATCH';
    }
    assert(threwMappingMismatch, 'Từ chối gán mapping chéo dây chuyền với mã lỗi 422 PLC_LINE_MISMATCH');

    // SCENARIO 14: XÁC THỰC KÍCH HOẠT GIÁM SÁT MONITORING
    console.log('\n[SCENARIO 14] Kiểm tra toggleMetricMappingMonitoring với PLC của Line...');
    const monitoredMapping = await toggleMetricMappingMonitoring('MAP-TEST-A1-PRS', true);
    assert(monitoredMapping.monitoring_enabled === true, 'Kích hoạt giám sát monitoring trên mapping hợp lệ thành công');

    // SCENARIO 15: GỠ TRẠM PLC KHỎI DÂY CHUYỀN (unassignPLCFromLine)
    console.log('\n[SCENARIO 15] Thực thi gỡ trạm PLC khỏi Dây chuyền và ngắt giám sát an toàn...');
    const unassignRes = await unassignPLCFromLine(testLineA, { id: 'USR-TEST' });
    assert(unassignRes.success === true, 'Gỡ trạm PLC khỏi LINE-TEST-ARCH-A thành công');

    // Kiểm tra các mapping của Line A tự động ngắt giám sát
    const [mappingCheck] = await conn.query('SELECT plc_id, monitoring_enabled, status FROM metric_mappings WHERE id = ?', ['MAP-TEST-A1-PRS']);
    assert(
      mappingCheck[0].plc_id === null && mappingCheck[0].monitoring_enabled === 0 && mappingCheck[0].status === 'NOT_CONFIGURED',
      'Mapping của các máy trong Line tự động gỡ plc_id và ngắt giám sát an toàn (NOT_CONFIGURED)'
    );

    // Kiểm tra Idempotent của unassign
    const unassignIdempotent = await unassignPLCFromLine(testLineA);
    assert(
      unassignIdempotent.success === true && unassignIdempotent.idempotent === true,
      'Gỡ lại khi Line không có PLC trả về idempotent: true an toàn'
    );

    // DỌN DẸP DỮ LIỆU THỬ NGHIỆM
    console.log('\n[DỌN DẸP] Làm sạch dữ liệu thử nghiệm trong CSDL TEST...');
    await conn.query('DELETE FROM metric_mappings WHERE machine_id IN (?, ?, ?)', [testMcA1, testMcA2, testMcB1]);
    await conn.query('DELETE FROM machines WHERE id IN (?, ?, ?)', [testMcA1, testMcA2, testMcB1]);
    await conn.query('DELETE FROM plc_stations WHERE id IN (?, ?)', [testPlc1, testPlc2]);
    await conn.query('DELETE FROM production_lines WHERE id IN (?, ?)', [testLineA, testLineB]);
    console.log('  ✓ Đã xóa sạch dữ liệu test.');

    // KIỂM TRA CUỐI CÙNG: DATABASE PRODUCTION BẢO LƯU 100%
    console.log('\n[KIỂM TOÁN CUỐI CÙNG] Kiểm tra CSDL Production denso_iot sau kiểm thử...');
    const prodConnAfter = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: PROD_DB,
    });
    const [[prodCntAfter]] = await prodConnAfter.query('SELECT COUNT(*) as count FROM machine_telemetry_history');
    const [[prodChkAfter]] = await prodConnAfter.query('CHECKSUM TABLE machine_telemetry_history');
    assert(
      prodCntAfter.count === 16924 && prodChkAfter.Checksum === 871610130,
      'Database Production denso_iot BẤT BIẾN: 16,924 bản ghi, Checksum 871610130',
      `Count=${prodCntAfter.count}, Checksum=${prodChkAfter.Checksum}`
    );
    await prodConnAfter.end();
  } finally {
    try {
      await conn.query('DELETE FROM metric_mappings WHERE machine_id IN (?, ?, ?)', ['MC-TEST-ARCH-A1', 'MC-TEST-ARCH-A2', 'MC-TEST-ARCH-B1']);
      await conn.query('DELETE FROM machines WHERE id IN (?, ?, ?)', ['MC-TEST-ARCH-A1', 'MC-TEST-ARCH-A2', 'MC-TEST-ARCH-B1']);
      await conn.query('DELETE FROM plc_stations WHERE id IN (?, ?)', ['PLC-TEST-PROD-01', 'PLC-TEST-PROD-02']);
      await conn.query('DELETE FROM production_lines WHERE id IN (?, ?)', ['LINE-TEST-ARCH-A', 'LINE-TEST-ARCH-B']);
    } catch {}
    await conn.end();
    await closeDatabase();
  }

  console.log('\n' + '='.repeat(80));
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passCount} PASS / ${failCount} FAIL (Tổng số: ${passCount + failCount})`);
  console.log('='.repeat(80));

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Lỗi khi chạy bộ kiểm thử test_plc_to_line_architecture:', err);
  process.exit(1);
});
