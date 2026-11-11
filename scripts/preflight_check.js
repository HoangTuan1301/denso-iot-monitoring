/**
 * @file preflight_check.js
 * @description Kịch bản kiểm tra tiền điều kiện (Preflight Inspection) trước khi thực thi Migration
 * Kiểm tra CSDL mục tiêu:
 *  - Phiên bản MySQL >= 8.0
 *  - Đủ các bảng bắt buộc
 *  - Không có lineId mồ côi
 *  - Mã code máy duy nhất
 *  - Xác nhận telemetry và audit logs hiện có (đọc trực tiếp số lượng động thời gian thực)
 *  - Xác nhận KHÔNG CÓ kết nối ghi hay tiến trình tự động nào đang ghi dữ liệu vào CSDL
 *  - Xác nhận trạng thái 2 trạm PLC demo
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
const TARGET_DB = dbArg ? dbArg.split('=')[1] : process.env.TARGET_DB || 'denso_iot_phase1_test';

export async function runPreflight(dbName = TARGET_DB) {
  console.log(`================================================================`);
  console.log(`[PREFLIGHT CHECK] BẮT ĐẦU KIỂM TRA TIỀN ĐIỀU KIỆN TRỰC TIẾP`);
  console.log(`[PREFLIGHT CHECK] CSDL Mục tiêu: [${dbName}] @ ${DB_HOST}:${DB_PORT}`);
  console.log(`[PREFLIGHT CHECK] Thời điểm: ${new Date().toISOString()}`);
  console.log(`================================================================\n`);

  let conn = null;
  let hasErrors = false;

  const results = [];

  function report(name, status, details) {
    results.push({ name, status, details });
    const mark = status ? '✓ PASS' : '✗ FAIL';
    console.log(`[${mark}] ${name}`);
    if (details) console.log(`       -> ${details}`);
  }

  try {
    conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: dbName,
    });

    // 1. Kiểm tra phiên bản MySQL Server
    const [verRows] = await conn.query('SELECT VERSION() as v');
    const versionStr = verRows[0].v;
    const isV8 = versionStr.startsWith('8.');
    report('1. Kiểm tra phiên bản MySQL (Yêu cầu >= 8.0)', isV8, `Phiên bản hiện tại: ${versionStr}`);
    if (!isV8) hasErrors = true;

    // 2. Kiểm tra các bảng gốc bắt buộc
    const [tableRows] = await conn.query('SHOW TABLES');
    const existingTables = tableRows.map((r) => Object.values(r)[0]);
    const requiredTables = ['users', 'production_lines', 'machines', 'plc_stations', 'machine_telemetry_history', 'audit_logs', 'metric_catalog'];
    const missingTables = requiredTables.filter((t) => !existingTables.includes(t));
    const tablesOk = missingTables.length === 0;
    report('2. Kiểm tra các bảng gốc bắt buộc', tablesOk, tablesOk ? `Đủ ${requiredTables.length} bảng gốc` : `Thiếu bảng: ${missingTables.join(', ')}`);
    if (!tablesOk) hasErrors = true;

    // 3. Kiểm tra dữ liệu mồ côi lineId trong machines
    const [orphanMachines] = await conn.query(`
      SELECT m.id, m.lineId FROM machines m
      LEFT JOIN production_lines p ON m.lineId = p.id
      WHERE p.id IS NULL
    `);
    const noOrphanMachines = orphanMachines.length === 0;
    report('3. Kiểm tra dữ liệu mồ côi machines.lineId', noOrphanMachines, noOrphanMachines ? 'Không có bản ghi mồ côi (0 dòng)' : `Có ${orphanMachines.length} máy có lineId không tồn tại`);
    if (!noOrphanMachines) hasErrors = true;

    // 4. Kiểm tra tính duy nhất của mã code trong machines
    const [dupMachineCodes] = await conn.query(`
      SELECT code, COUNT(*) as cnt FROM machines GROUP BY code HAVING COUNT(*) > 1
    `);
    const noDupMachineCodes = dupMachineCodes.length === 0;
    report('4. Kiểm tra trùng lặp mã code trong machines', noDupMachineCodes, noDupMachineCodes ? 'Mã code duy nhất 100%' : `Có ${dupMachineCodes.length} mã code bị trùng lặp`);
    if (!noDupMachineCodes) hasErrors = true;

    // 5. Kiểm tra số lượng động telemetry thực tế (Không dùng con số cứng từ báo cáo cũ)
    const [teleCountRows] = await conn.query('SELECT COUNT(*) as c, MIN(timestamp) as min_t, MAX(timestamp) as max_t FROM machine_telemetry_history');
    const teleCount = teleCountRows[0].c;
    const teleHasData = teleCount > 0;
    report('5. Kiểm tra dữ liệu telemetry thực tế (Dynamic Check)', teleHasData, `Ghi nhận thực tế: ${teleCount.toLocaleString()} bản ghi (Min: ${teleCountRows[0].min_t}, Max: ${teleCountRows[0].max_t})`);
    if (!teleHasData) hasErrors = true;

    // 6. Kiểm tra các lineId trong telemetry có tồn tại trong production_lines
    const [orphanTeleLines] = await conn.query(`
      SELECT DISTINCT t.lineId FROM machine_telemetry_history t
      LEFT JOIN production_lines p ON t.lineId = p.id
      WHERE p.id IS NULL
    `);
    const teleLinesOk = orphanTeleLines.length === 0;
    report('6. Kiểm tra lineId trong telemetry có trong production_lines', teleLinesOk, teleLinesOk ? 'Khớp 100% các lineId' : `Có lineId mồ côi: ${orphanTeleLines.map((r) => r.lineId).join(', ')}`);
    if (!teleLinesOk) hasErrors = true;

    // 7. Kiểm tra audit_logs thực tế (Dynamic Check)
    const [auditCountRows] = await conn.query('SELECT COUNT(*) as c FROM audit_logs');
    const auditCount = auditCountRows[0].c;
    const auditHasData = auditCount > 0;
    report('7. Kiểm tra dữ liệu audit logs thực tế (Dynamic Check)', auditHasData, `Ghi nhận thực tế: ${auditCount} bản ghi`);
    if (!auditHasData) hasErrors = true;

    // 8. Kiểm tra trạng thái 2 trạm PLC demo
    const [plcRows] = await conn.query("SELECT id, isConnected FROM plc_stations WHERE id IN ('PLC-STATION-01', 'PLC-STATION-02')");
    report('8. Kiểm tra 2 trạm PLC demo hiện hữu', plcRows.length === 2, `Tìm thấy ${plcRows.length}/2 trạm: ${plcRows.map((p) => p.id).join(', ')}`);

    // 9. Kiểm tra kết nối ghi và tiến trình nền đang hoạt động trên CSDL (Processlist Check)
    const [connIdRows] = await conn.query('SELECT CONNECTION_ID() as cid');
    const myConnectionId = connIdRows[0].cid;

    const [processRows] = await conn.query(`
      SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO
      FROM INFORMATION_SCHEMA.PROCESSLIST
      WHERE DB = ? AND ID != ?
    `, [dbName, myConnectionId]);

    const activeWriters = processRows.filter((p) => {
      const info = (p.INFO || '').toUpperCase();
      return info.startsWith('INSERT') || info.startsWith('UPDATE') || info.startsWith('DELETE') || info.startsWith('ALTER');
    });

    const isDbCleanOfWrites = activeWriters.length === 0;
    report('9. Kiểm tra kết nối ghi đồng thời vào CSDL (Processlist)', isDbCleanOfWrites, isDbCleanOfWrites ? `0 kết nối ghi khác (Tổng kết nối ngoài: ${processRows.length})` : `Phát hiện ${activeWriters.length} kết nối đang ghi vào CSDL!`);
    if (!isDbCleanOfWrites) hasErrors = true;

  } catch (err) {
    console.error(`[PREFLIGHT CHECK ERROR] Lỗi kết nối CSDL:`, err.message);
    hasErrors = true;
  } finally {
    if (conn) await conn.end();
  }

  console.log(`\n================================================================`);
  if (hasErrors) {
    console.error(`[KẾT QUẢ PREFLIGHT]: KHÔNG ĐẠT (CÓ LỖI TIỀN ĐIỀU KIỆN). KHÔNG ĐƯỢC CHẠY MIGRATION.`);
    return false;
  } else {
    console.log(`[KẾT QUẢ PREFLIGHT]: ĐẠT 100% TIÊU CHUẨN TIỀN ĐIỀU KIỆN TRỰC TIẾP.`);
    return true;
  }
}

// Chạy trực tiếp nếu gọi từ CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPreflight().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
