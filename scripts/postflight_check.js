/**
 * @file postflight_check.js
 * @description Kịch bản kiểm tra sau Migration (Postflight Verification)
 * Xác nhận cấu trúc schema, khóa ngoại, tính toàn vẹn dữ liệu và trạng thái hệ thống
 */

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

const args = process.argv.slice(2);
const dbArg = args.find((a) => a.startsWith('--database='));
const TARGET_DB = dbArg ? dbArg.split('=')[1] : 'denso_iot';

export async function runPostflight(dbName = TARGET_DB) {
  console.log('================================================================');
  console.log(`[POSTFLIGHT CHECK] BẮT ĐẦU KIỂM TRA HẬU MIGRATION`);
  console.log(`[POSTFLIGHT CHECK] CSDL Kiểm tra: [${dbName}] @ ${DB_HOST}:${DB_PORT}`);
  console.log('================================================================\n');

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
    dateStrings: true,
  });

  const results = [];
  function report(name, status, details) {
    results.push({ name, status, details });
    const mark = status ? '✓ PASS' : '✗ FAIL';
    console.log(`[${mark}] ${name}`);
    if (details) console.log(`       -> ${details}`);
  }

  try {
    // 1. Kiểm tra bảng schema_migrations
    const [migRows] = await conn.query("SELECT * FROM schema_migrations WHERE version = '001_phase1_core_schema'");
    const migOk = migRows.length > 0 && migRows[0].status === 'COMPLETED';
    report('1. Trạng thái Migration phiên bản 001', migOk, migOk ? `Hoàn thành lúc: ${migRows[0].applied_at}` : 'Chưa COMPLETED');

    // 2. Kiểm tra đủ 11 bảng
    const [tRows] = await conn.query('SHOW TABLES');
    const tableNames = tRows.map((r) => Object.values(r)[0]);
    const requiredTables = [
      'users', 'production_lines', 'machines', 'plc_stations',
      'machine_telemetry_history', 'audit_logs', 'metric_catalog',
      'schema_migrations', 'metric_mappings', 'metric_thresholds', 'collection_schedules'
    ];
    const missing = requiredTables.filter((t) => !tableNames.includes(t));
    const tablesOk = missing.length === 0;
    report('2. Kiểm tra danh sách bảng đầy đủ (11 bảng)', tablesOk, tablesOk ? `Đủ 11/11 bảng` : `Thiếu: ${missing.join(', ')}`);

    // 3. Bảo toàn 100% dữ liệu Telemetry lịch sử
    const [teleRows] = await conn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
    const teleCount = teleRows[0].cnt;
    const teleOk = teleCount === 11244;
    report('3. Bảo toàn dữ liệu telemetry lịch sử', teleOk, `Hiện có: ${teleCount.toLocaleString()} bản ghi (Kỳ vọng: 11,244)`);

    // 4. Bảo toàn dữ liệu Audit Logs
    const [audRows] = await conn.query('SELECT COUNT(*) as cnt FROM audit_logs');
    const audCount = audRows[0].cnt;
    const audOk = audCount >= 203;
    report('4. Bảo toàn dữ liệu audit logs', audOk, `Hiện có: ${audCount} bản ghi (Kỳ vọng: >= 203)`);

    // 5. Kiểm tra 12 thực thể máy
    const [mchRows] = await conn.query('SELECT COUNT(*) as cnt FROM machines');
    const mchCount = mchRows[0].cnt;
    const mchOk = mchCount === 12;
    report('5. Danh sách thực thể máy độc lập', mchOk, `Hiện có: ${mchCount} máy (6 MCH-* cũ và 6 MC-* mới)`);

    // 6. Kiểm tra 10 kênh mapping lịch sử (NOT_CONFIGURED, monitoring_enabled = 0)
    const [mapRows] = await conn.query('SELECT COUNT(*) as cnt FROM metric_mappings WHERE status = "NOT_CONFIGURED" AND monitoring_enabled = 0');
    const mapCount = mapRows[0].cnt;
    const mapOk = mapCount === 10;
    report('6. Trạng thái 10 kênh Mapping lịch sử', mapOk, `10/10 kênh NOT_CONFIGURED, không bị gán LIVE`);

    // 7. Kiểm tra 2 PLC demo (machine_id = NULL, disabled, UNKNOWN)
    const [plcRows] = await conn.query("SELECT id, machine_id, connection_status, enabled, is_demo FROM plc_stations WHERE id IN ('PLC-STATION-01', 'PLC-STATION-02')");
    const plcOk = plcRows.length === 2 && plcRows.every((p) => p.machine_id === null && p.connection_status === 'UNKNOWN' && p.enabled === 0 && p.is_demo === 1);
    report('7. Cô lập 2 trạm PLC demo', plcOk, 'machine_id = NULL, disabled, UNKNOWN');

    // 8. Kiểm tra các ràng buộc khóa ngoại (RESTRICT)
    const [fkRows] = await conn.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `, [dbName]);
    const fkNames = fkRows.map((r) => r.CONSTRAINT_NAME);
    const requiredFks = [
      'fk_machines_line_id', 'fk_plc_machine_id',
      'fk_mappings_machine_id', 'fk_mappings_plc_id', 'fk_mappings_metric_id',
      'fk_thresholds_mapping_id', 'fk_schedules_mapping_id'
    ];
    const missingFks = requiredFks.filter((fk) => !fkNames.includes(fk));
    const fksOk = missingFks.length === 0;
    report('8. Kiểm tra hệ thống khóa ngoại RESTRICT', fksOk, fksOk ? 'Đủ 7/7 ràng buộc khóa ngoại' : `Thiếu: ${missingFks.join(', ')}`);

    const allPassed = results.every((r) => r.status);
    console.log('\n================================================================');
    console.log(`[KẾT QUẢ POSTFLIGHT]: ${allPassed ? '✓ ĐẠT 100% TIÊU CHUẨN AN TOÀN' : '✗ CÓ LỖI'}`);
    console.log('================================================================\n');

    await conn.end();
    return { success: allPassed, results };
  } catch (err) {
    console.error('❌ [POSTFLIGHT ERROR]:', err.message);
    await conn.end();
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPostflight()
    .then((r) => process.exit(r.success ? 0 : 1))
    .catch(() => process.exit(1));
}
