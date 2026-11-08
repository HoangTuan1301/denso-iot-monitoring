/**
 * @file verify_rollback_safety.js
 * @description Kiểm chứng an toàn Rollback:
 * - Không làm mất dữ liệu Mapping hoặc Threshold đã phát sinh sau migration
 * - Không tự động xóa bảng đang chứa dữ liệu của người dùng
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runRollback } from '../scripts/run_phase1_rollback.js';
import { runMigration } from '../scripts/run_phase1_migration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const TARGET_DB = 'denso_iot_phase1_test';

async function verifyRollbackDataPreservation() {
  console.log('================================================================');
  console.log('[TEST BẢO VỆ DỮ LIỆU KHI ROLLBACK] BẮT ĐẦU KIỂM THỬ');
  console.log('================================================================\n');

  // Đảm bảo test DB đang ở trạng thái đã migration
  await runMigration(TARGET_DB);

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TARGET_DB,
  });

  // 1. Kỹ sư tạo thêm 1 Mapping và 1 Threshold nghiệp vụ mới sau migration
  console.log('1. Giả lập kỹ sư cấu hình thêm Mapping và Threshold mới...');
  await conn.query(`
    INSERT INTO metric_mappings (id, machine_id, metric_id, mapping_code, channel_name, status)
    VALUES ('USER-MAP-CUSTOM-01', 'MC-CYL-01', 'MTR-CAT-PRS-01', 'MTR-CUSTOM-999', 'Cảm biến do kỹ sư cấu hình thêm', 'NOT_CONFIGURED')
    ON DUPLICATE KEY UPDATE channel_name = 'Cảm biến do kỹ sư cấu hình thêm'
  `);

  await conn.query(`
    INSERT INTO metric_thresholds (id, mapping_id, warning_max, critical_max, action_plan)
    VALUES ('USER-THR-CUSTOM-01', 'USER-MAP-CUSTOM-01', 80.00, 95.00, 'Kế hoạch xử lý sự cố do kỹ sư định nghĩa')
    ON DUPLICATE KEY UPDATE action_plan = 'Kế hoạch xử lý sự cố do kỹ sư định nghĩa'
  `);
  console.log('   ✓ Đã tạo USER-MAP-CUSTOM-01 và USER-THR-CUSTOM-01 trong CSDL.');

  await conn.end();

  // 2. Chạy rollback
  console.log('\n2. Thực hiện Rollback Phase 1...');
  await runRollback(TARGET_DB);

  // 3. Kiểm tra tính toàn vẹn sau Rollback
  console.log('\n3. Kiểm tra tính toàn vẹn dữ liệu sau Rollback...');
  const connCheck = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TARGET_DB,
  });

  const [tRows] = await connCheck.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('metric_mappings', 'metric_thresholds')
  `, [TARGET_DB]);
  const tableNames = tRows.map((r) => r.TABLE_NAME);
  console.log('   * Các bảng được bảo vệ không bị DROP:', tableNames.join(', '));

  const [mapRows] = await connCheck.query("SELECT * FROM metric_mappings WHERE id = 'USER-MAP-CUSTOM-01'");
  const [thrRows] = await connCheck.query("SELECT * FROM metric_thresholds WHERE id = 'USER-THR-CUSTOM-01'");

  const mapPreserved = mapRows.length > 0;
  const thrPreserved = thrRows.length > 0;

  console.log('   * Mapping phát sinh của người dùng:', mapPreserved ? '✓ NGUYÊN VẸN 100%' : '✗ BỊ MẤT');
  console.log('   * Threshold phát sinh của người dùng:', thrPreserved ? '✓ NGUYÊN VẸN 100%' : '✗ BỊ MẤT');

  // Dọn dẹp dữ liệu test và re-apply migration để giữ test DB chuẩn hóa
  await connCheck.query("DELETE FROM metric_thresholds WHERE id = 'USER-THR-CUSTOM-01'");
  await connCheck.query("DELETE FROM metric_mappings WHERE id = 'USER-MAP-CUSTOM-01'");
  await connCheck.end();

  console.log('\n4. Đưa CSDL test về trạng thái Migration chuẩn...');
  await runMigration(TARGET_DB);

  const testPassed = tableNames.includes('metric_mappings') && tableNames.includes('metric_thresholds') && mapPreserved && thrPreserved;
  console.log('\n================================================================');
  console.log(`[KẾT QUẢ TEST]: ${testPassed ? '✅ ĐẠT YÊU CẦU BẢO TOÀN DỮ LIỆU' : '❌ THẤT BẠI'}`);
  console.log('================================================================\n');

  return testPassed;
}

verifyRollbackDataPreservation()
  .then((passed) => process.exit(passed ? 0 : 1))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
