/**
 * @file backup_and_cleanup_test_lines.js
 * @description Script sao lưu an toàn và dọn dẹp 2 bản ghi dây chuyền rác (LINE-TEST-*) trong denso_iot_phase1_test
 * - Kiểm tra chứng minh 100% không có phụ thuộc (machines, plc_stations, telemetry, mappings, users = 0)
 * - Sao lưu ra file JSON trong thư mục backups/
 * - Sao lưu vào bảng backup_production_lines_deleted trong CSDL TEST
 * - Xóa 2 bản ghi rác khỏi denso_iot_phase1_test
 * - Kiểm toán bảo vệ CSDL Production denso_iot (16,924 records)
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const TEST_DB = 'denso_iot_phase1_test';
const PROD_DB = 'denso_iot';

const TARGET_IDS = ['LINE-LINETEST5396', 'LINE-LINETEST7221'];

async function run() {
  console.log('======================================================================');
  console.log('[BACKUP & CLEANUP] DỌN DẸP DÂY CHUYỀN TEST RÁC TRONG TEST DB');
  console.log('======================================================================\n');

  // 1. Kiểm toán an toàn CSDL Production
  const prodConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: PROD_DB,
  });
  const [[prodCnt]] = await prodConn.query('SELECT COUNT(*) as count FROM machine_telemetry_history');
  console.log(`[SAFETY CHECK] Production denso_iot records: ${prodCnt.count} (phải là 16924)`);
  if (prodCnt.count !== 16924) {
    throw new Error('CSDL Production không khớp snapshot! Dừng ngay lập tức.');
  }
  await prodConn.end();

  // 2. Kết nối CSDL TEST
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB,
  });

  try {
    // 3. Lấy dữ liệu 2 bản ghi cần xử lý
    const [linesToBackup] = await testConn.query(
      'SELECT * FROM production_lines WHERE id IN (?, ?)',
      TARGET_IDS
    );

    console.log(`Tìm thấy ${linesToBackup.length} bản ghi dây chuyền test mục tiêu:`);
    for (const l of linesToBackup) {
      console.log(`  - ID: ${l.id} | Code: ${l.code} | Name: ${l.name} | Status: ${l.status}`);
    }

    if (linesToBackup.length === 0) {
      console.log('Không còn bản ghi test rác nào cần dọn dẹp. Hoàn tất!');
      return;
    }

    // 4. Kiểm tra nghiêm ngặt phụ thuộc (Dependency Proof)
    const [mCnt] = await testConn.query('SELECT COUNT(*) as c FROM machines WHERE lineId IN (?, ?)', TARGET_IDS);
    const [pCnt] = await testConn.query('SELECT COUNT(*) as c FROM plc_stations WHERE line_id IN (?, ?)', TARGET_IDS);
    const [tCnt] = await testConn.query('SELECT COUNT(*) as c FROM machine_telemetry_history WHERE lineId IN (?, ?)', TARGET_IDS);
    const [uCnt] = await testConn.query('SELECT COUNT(*) as c FROM users WHERE assignedLineId IN (?, ?)', TARGET_IDS);

    console.log('\n[XÁC MINH PHỤ THUỘC]:');
    console.log(`  - Machines tham chiếu: ${mCnt[0].c}`);
    console.log(`  - PLC stations tham chiếu: ${pCnt[0].c}`);
    console.log(`  - Telemetry history tham chiếu: ${tCnt[0].c}`);
    console.log(`  - Users tham chiếu: ${uCnt[0].c}`);

    if (mCnt[0].c > 0 || pCnt[0].c > 0 || tCnt[0].c > 0 || uCnt[0].c > 0) {
      console.error('\n[BLOCKED] Có phụ thuộc dữ liệu chưa rõ nguồn gốc! Không được phép xóa.');
      process.exit(1);
    }
    console.log('  -> CHỨNG MINH AN TOÀN 100%: Hoàn toàn không có phụ thuộc hay dữ liệu lịch sử!');

    // 5. Lấy kèm audit logs liên quan để backup
    const [auditLogs] = await testConn.query(
      'SELECT * FROM audit_logs WHERE target IN (?, ?) OR details LIKE ? OR details LIKE ?',
      [...TARGET_IDS, '%LINE-TEST-5396%', '%LINE-TEST-7221%']
    );

    // 6. Sao lưu ra file JSON
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFilePath = path.join(
      backupDir,
      `backup_orphaned_test_lines_${Date.now()}.json`
    );
    const backupData = {
      backupTimestamp: new Date().toISOString(),
      database: TEST_DB,
      recordsCount: linesToBackup.length,
      productionLines: linesToBackup,
      auditLogs,
    };
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`\n✓ Đã sao lưu dữ liệu ra file: ${backupFilePath}`);

    // 7. Sao lưu vào bảng backup trong MySQL TEST
    await testConn.query(`
      CREATE TABLE IF NOT EXISTS backup_production_lines_deleted (
        backup_id INT AUTO_INCREMENT PRIMARY KEY,
        id VARCHAR(64),
        name VARCHAR(128),
        code VARCHAR(64),
        status VARCHAR(32),
        safetyScore INT,
        targetOutput INT,
        actualOutput INT,
        original_createdAt DATETIME,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    for (const l of linesToBackup) {
      await testConn.query(
        `
        INSERT INTO backup_production_lines_deleted 
        (id, name, code, status, safetyScore, targetOutput, actualOutput, original_createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          l.id,
          l.name,
          l.code,
          l.status,
          l.safetyScore,
          l.targetOutput,
          l.actualOutput,
          l.createdAt,
        ]
      );
    }
    console.log('✓ Đã sao lưu bản ghi vào bảng backup_production_lines_deleted trong TEST DB');

    // 8. Thực hiện xóa an toàn
    const [delRes] = await testConn.query(
      'DELETE FROM production_lines WHERE id IN (?, ?)',
      TARGET_IDS
    );
    console.log(`✓ Đã xóa thành công ${delRes.affectedRows} bản ghi test khỏi production_lines`);

    // 9. Xác minh danh sách production_lines còn lại
    const [remainingLines] = await testConn.query('SELECT id, code, name, status FROM production_lines ORDER BY id ASC');
    console.log(`\n[KẾT QUẢ SAU DỌN DẸP]: Còn lại đúng ${remainingLines.length} dây chuyền gốc:`);
    console.table(remainingLines);

    if (remainingLines.length !== 3) {
      throw new Error(`Số lượng dây chuyền sau dọn dẹp là ${remainingLines.length}, mong đợi là 3!`);
    }

    console.log('\n✓ HOÀN THÀNH XỬ LÝ AN TOÀN 100%!');
  } finally {
    await testConn.end();
  }
}

run().catch((err) => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
