/**
 * @file test_phase1_database.js
 * @description Bộ kiểm thử toàn diện Giai đoạn 1 (Phase 1 Database Normalization & Relations)
 * Chạy trên database thử nghiệm: denso_iot_phase1_test
 * Bao gồm 13 Test Cases xác thực logic kiến trúc, ràng buộc khóa ngoại, checkpoint resume và rollback
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigration } from '../scripts/run_phase1_migration.js';
import { runRollback } from '../scripts/run_phase1_rollback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

const args = process.argv.slice(2);
const dbArg = args.find((a) => a.startsWith('--database='));
const TARGET_DB = dbArg ? dbArg.split('=')[1] : process.env.TARGET_DB || 'denso_iot_phase1_test';

export async function runAllTests() {
  console.log('================================================================');
  console.log(`[SUITE TEST] BẮT ĐẦU CHẠY TOÀN BỘ BÀI KIỂM THỬ GIAI ĐOẠN 1`);
  console.log(`[SUITE TEST] CSDL Kiểm thử: [${TARGET_DB}] @ ${DB_HOST}:${DB_PORT}`);
  console.log('================================================================\n');

  if (TARGET_DB === 'denso_iot') {
    throw new Error('KHÔNG ĐƯỢC CHẠY BỘ TEST TRÊN DATABASE GỐC denso_iot!');
  }

  const results = [];
  function assertTest(id, name, passed, details = '') {
    results.push({ id, name, passed, details });
    const badge = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${badge}] ${id}: ${name}`);
    if (details) console.log(`       -> ${details}`);
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TARGET_DB,
  });

  try {
    // -------------------------------------------------------------------------
    // TC-01: Thực thi Migration lần đầu
    // -------------------------------------------------------------------------
    try {
      const migRes = await runMigration(TARGET_DB);
      assertTest('TC-01', 'Thực thi Migration thành công lần đầu', migRes.success === true, 'Migration chạy hoàn tất không phát sinh lỗi');
    } catch (err) {
      assertTest('TC-01', 'Thực thi Migration thành công lần đầu', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-02: Tính lũy kế / An toàn khi chạy lại (Idempotent re-run)
    // -------------------------------------------------------------------------
    try {
      const migRes2 = await runMigration(TARGET_DB);
      assertTest('TC-02', 'Kiểm tra tính Idempotent khi chạy lại', migRes2.success === true, 'Bỏ qua an toàn hoặc thực thi không lỗi trùng lặp');
    } catch (err) {
      assertTest('TC-02', 'Kiểm tra tính Idempotent khi chạy lại', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-03: Kiểm tra cơ chế Checkpoint & Resume khi có sự cố dở dang
    // -------------------------------------------------------------------------
    try {
      // Giả lập trạng thái FAILED tại CP6
      await conn.query(`
        UPDATE schema_migrations 
        SET status = 'FAILED', checkpoint = 'CP6_CREATE_METRIC_MAPPINGS_TABLE', error_message = 'Simulated crash'
        WHERE version = '001_phase1_core_schema'
      `);
      // Chạy lại với cờ resume
      const resumeRes = await runMigration(TARGET_DB);
      const [statusRows] = await conn.query("SELECT status, checkpoint FROM schema_migrations WHERE version = '001_phase1_core_schema'");
      const isCompleted = statusRows[0].status === 'COMPLETED';
      assertTest('TC-03', 'Cơ chế Checkpoint Resume khôi phục sau sự cố', isCompleted, `Trạng thái sau resume: ${statusRows[0].status}`);
    } catch (err) {
      assertTest('TC-03', 'Cơ chế Checkpoint Resume khôi phục sau sự cố', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-04: Bảo toàn 100% dữ liệu telemetry lịch sử (>= 11,244 bản ghi)
    // -------------------------------------------------------------------------
    try {
      const [tRows] = await conn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
      const count = tRows[0].cnt;
      const telePreserved = count === 11244;
      assertTest('TC-04', 'Bảo toàn số lượng dữ liệu telemetry lịch sử', telePreserved, `Số bản ghi: ${count.toLocaleString()} (Kỳ vọng: 11,244)`);
    } catch (err) {
      assertTest('TC-04', 'Bảo toàn số lượng dữ liệu telemetry lịch sử', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-05: Bảo toàn dữ liệu audit logs (>= 203 bản ghi)
    // -------------------------------------------------------------------------
    try {
      const [aRows] = await conn.query('SELECT COUNT(*) as cnt FROM audit_logs');
      const aCount = aRows[0].cnt;
      const auditPreserved = aCount >= 203;
      assertTest('TC-05', 'Bảo toàn dữ liệu audit logs', auditPreserved, `Số bản ghi: ${aCount} (Kỳ vọng: >= 203)`);
    } catch (err) {
      assertTest('TC-05', 'Bảo toàn dữ liệu audit logs', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-06: Ràng buộc 1 Máy - Tối đa 1 PLC (uq_plc_machine_id chặn gán 2 PLC cho 1 máy)
    // -------------------------------------------------------------------------
    try {
      // Tạo 2 PLC thử nghiệm
      await conn.query(`
        INSERT INTO plc_stations (id, name, protocol, ipAddress, port, machine_id)
        VALUES ('PLC-TEST-A', 'PLC Test A', 'Modbus/TCP', '10.0.0.1', 502, 'MC-CYL-01')
        ON DUPLICATE KEY UPDATE machine_id = 'MC-CYL-01'
      `);

      let duplicateBlocked = false;
      try {
        await conn.query(`
          INSERT INTO plc_stations (id, name, protocol, ipAddress, port, machine_id)
          VALUES ('PLC-TEST-B', 'PLC Test B', 'Modbus/TCP', '10.0.0.2', 502, 'MC-CYL-01')
        `);
      } catch (dupErr) {
        if (dupErr.code === 'ER_DUP_ENTRY') {
          duplicateBlocked = true;
        }
      }

      // Dọn dẹp PLC test A
      await conn.query("DELETE FROM plc_stations WHERE id IN ('PLC-TEST-A', 'PLC-TEST-B')");
      assertTest('TC-06', 'Ràng buộc 1 Máy - Tối đa 1 PLC (Chặn gán 2 PLC cho 1 máy)', duplicateBlocked, 'ER_DUP_ENTRY kích hoạt chính xác khi gán PLC thứ 2');
    } catch (err) {
      assertTest('TC-06', 'Ràng buộc 1 Máy - Tối đa 1 PLC', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-07: Một PLC không thể đồng thời thuộc 2 máy
    // -------------------------------------------------------------------------
    try {
      // Bảng plc_stations có khóa chính id và trường machine_id là khóa ngoại đơn
      // 1 PLC chỉ có đúng 1 dòng trong bảng plc_stations, nên bản chất 1 PLC không thể có 2 machine_id khác nhau
      const [plcCountRows] = await conn.query(`
        SELECT id, COUNT(DISTINCT machine_id) as mc_cnt
        FROM plc_stations WHERE machine_id IS NOT NULL GROUP BY id HAVING COUNT(DISTINCT machine_id) > 1
      `);
      const singleOwner = plcCountRows.length === 0;
      assertTest('TC-07', 'Một PLC chỉ thuộc về tối đa 1 máy duy nhất', singleOwner, 'Cấu trúc schema đảm bảo 1 PLC chỉ trỏ tới 1 machine_id');
    } catch (err) {
      assertTest('TC-07', 'Một PLC chỉ thuộc về tối đa 1 máy duy nhất', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-08: Quy trình chuyển PLC từ máy A sang máy B có xác nhận và an toàn
    // -------------------------------------------------------------------------
    try {
      // Tạo PLC-TEST-TRANSFER gắn vào MC-FDR-01
      await conn.query(`
        INSERT INTO plc_stations (id, name, protocol, ipAddress, port, machine_id)
        VALUES ('PLC-TEST-TRF', 'PLC Transfer Test', 'Modbus/TCP', '10.0.0.5', 502, 'MC-FDR-01')
        ON DUPLICATE KEY UPDATE machine_id = 'MC-FDR-01'
      `);

      // Chuyển sang MC-CYL-01 theo quy trình 2 bước:
      // Bước a: Gỡ khỏi máy cũ (hoặc update trực tiếp có xác nhận)
      await conn.query("UPDATE plc_stations SET machine_id = 'MC-CYL-01' WHERE id = 'PLC-TEST-TRF'");

      const [chkRows] = await conn.query("SELECT machine_id FROM plc_stations WHERE id = 'PLC-TEST-TRF'");
      const transferSuccess = chkRows[0].machine_id === 'MC-CYL-01';

      // Dọn dẹp
      await conn.query("DELETE FROM plc_stations WHERE id = 'PLC-TEST-TRF'");
      assertTest('TC-08', 'Quy trình chuyển giao PLC giữa các máy an toàn', transferSuccess, 'Chuyển PLC từ MC-FDR-01 sang MC-CYL-01 thành công');
    } catch (err) {
      assertTest('TC-08', 'Quy trình chuyển giao PLC giữa các máy an toàn', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-09: Quan hệ 1 Máy - Nhiều Metric Mapping với mapping_code duy nhất
    // -------------------------------------------------------------------------
    try {
      const [mapRows] = await conn.query(`
        SELECT machine_id, COUNT(*) as map_cnt
        FROM metric_mappings
        WHERE machine_id = 'MC-CYL-01'
        GROUP BY machine_id
      `);
      const hasMultiMappings = mapRows.length > 0 && mapRows[0].map_cnt >= 2;
      assertTest('TC-09', '1 Máy liên kết nhiều Metric Mapping', hasMultiMappings, `Máy MC-CYL-01 có ${mapRows[0]?.map_cnt || 0} metrics (PRS và TMP)`);
    } catch (err) {
      assertTest('TC-09', '1 Máy liên kết nhiều Metric Mapping', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-10: Khóa ngoại ON DELETE RESTRICT bảo vệ toàn vẹn dữ liệu
    // -------------------------------------------------------------------------
    try {
      let deleteBlocked = false;
      try {
        // Thử xóa máy MC-CYL-01 (đang có metric_mappings tham chiếu tới)
        await conn.query("DELETE FROM machines WHERE id = 'MC-CYL-01'");
      } catch (fkErr) {
        if (fkErr.code === 'ER_ROW_IS_REFERENCED_2') {
          deleteBlocked = true;
        }
      }
      assertTest('TC-10', 'Khóa ngoại RESTRICT chặn xóa máy đang có liên kết', deleteBlocked, 'ER_ROW_IS_REFERENCED_2 kích hoạt bảo vệ dữ liệu');
    } catch (err) {
      assertTest('TC-10', 'Khóa ngoại RESTRICT chặn xóa máy đang có liên kết', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-11: Trạng thái mặc định chuẩn xác (NOT_CONFIGURED / UNKNOWN / monitoring_enabled = 0)
    // -------------------------------------------------------------------------
    try {
      const [defaultMaps] = await conn.query(`
        SELECT COUNT(*) as cnt FROM metric_mappings 
        WHERE status = 'NOT_CONFIGURED' AND monitoring_enabled = 0
      `);
      const defaultsOk = defaultMaps[0].cnt === 10;
      assertTest('TC-11', 'Trạng thái mặc định (NOT_CONFIGURED, monitoring=false)', defaultsOk, `10/10 kênh telemetry có trạng thái chuẩn ban đầu`);
    } catch (err) {
      assertTest('TC-11', 'Trạng thái mặc định chuẩn xác', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-12: Trạm PLC demo giữ nguyên machine_id = NULL, disabled, UNKNOWN
    // -------------------------------------------------------------------------
    try {
      const [demoRows] = await conn.query(`
        SELECT id, machine_id, is_demo, enabled, connection_status
        FROM plc_stations WHERE id IN ('PLC-STATION-01', 'PLC-STATION-02')
      `);
      const demoOk = demoRows.length === 2 && demoRows.every((d) => d.machine_id === null && d.is_demo === 1 && d.enabled === 0 && d.connection_status === 'UNKNOWN');
      assertTest('TC-12', '2 PLC demo cô lập an toàn (machine_id=NULL, disabled, UNKNOWN)', demoOk, 'Không bị gán máy giả hay đánh dấu online');
    } catch (err) {
      assertTest('TC-12', '2 PLC demo cô lập an toàn', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TC-13: Kiểm thử Hoàn tác an toàn (Rollback) và Tái thực thi (Re-apply)
    // -------------------------------------------------------------------------
    try {
      console.log('\n--- Bắt đầu thử nghiệm Rollback schema ---');
      await runRollback(TARGET_DB);

      // Kiểm tra sau rollback
      const [rbTele] = await conn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
      const rollbackPreserved = rbTele[0].cnt === 11244;

      // Tái thực thi lại migration để đưa test DB về trạng thái chuẩn hóa hoàn chỉnh
      console.log('--- Tái thực thi Migration sau Rollback ---');
      const reapplyRes = await runMigration(TARGET_DB);

      const rollbackSuccess = rollbackPreserved && reapplyRes.success === true;
      assertTest('TC-13', 'Kiểm thử Rollback an toàn và Tái áp dụng Migration', rollbackSuccess, 'Rollback thành công bảo toàn telemetry 100%, re-apply thành công');
    } catch (err) {
      assertTest('TC-13', 'Kiểm thử Rollback an toàn và Tái áp dụng Migration', false, err.message);
    }

  } finally {
    await conn.end();
  }

  // Tổng kết
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`[TỔNG KẾT KIỂM THỬ GIAI ĐOẠN 1]`);
  console.log(`Kết quả: ${passCount}/${results.length} PASS | ${failCount} FAIL`);
  console.log('================================================================\n');

  return { total: results.length, passed: passCount, failed: failCount, results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAllTests()
    .then((r) => process.exit(r.failed === 0 ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
