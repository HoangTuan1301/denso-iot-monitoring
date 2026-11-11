/**
 * @file scripts/run_migration_004.js
 * @description Thực thi và kiểm thử Migration 004 trên CSDL TEST (denso_iot_phase1_test).
 * Kiểm tra trước, trong, rollback và tái thực thi. Bảo vệ tuyệt đối CSDL gốc denso_iot.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const TEST_DB = 'denso_iot_phase1_test';

export async function applyMigration004(conn) {
  console.log('[MIGRATE-004] Áp dụng migration chuyển đổi kiến trúc PLC sang cấp Line...');

  // 1. Kiểm tra cột line_id
  const [cols] = await conn.query("SHOW COLUMNS FROM plc_stations LIKE 'line_id'");
  if (cols.length === 0) {
    await conn.query("ALTER TABLE plc_stations ADD COLUMN line_id varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER name");
    console.log('  + Thêm cột line_id');
  }

  // 2. Kiểm tra index uq_plc_line_id
  const [lineIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'uq_plc_line_id'");
  if (lineIdx.length === 0) {
    await conn.query("ALTER TABLE plc_stations ADD UNIQUE KEY uq_plc_line_id (line_id)");
    console.log('  + Thêm UNIQUE KEY uq_plc_line_id');
  }

  // 3. Xử lý fk_plc_machine_id và uq_plc_machine_id
  const [fks] = await conn.query(`
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plc_stations' AND CONSTRAINT_NAME = 'fk_plc_machine_id'
  `, [TEST_DB]);
  if (fks.length > 0) {
    await conn.query("ALTER TABLE plc_stations DROP FOREIGN KEY fk_plc_machine_id");
    console.log('  - Hủy bỏ FOREIGN KEY fk_plc_machine_id');
  }

  const [machIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'uq_plc_machine_id'");
  if (machIdx.length > 0) {
    await conn.query("ALTER TABLE plc_stations DROP INDEX uq_plc_machine_id");
    console.log('  - Hủy bỏ UNIQUE INDEX uq_plc_machine_id');
  }

  // 4. Thêm idx_plc_legacy_machine
  const [legacyIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'idx_plc_legacy_machine'");
  if (legacyIdx.length === 0) {
    await conn.query("ALTER TABLE plc_stations ADD KEY idx_plc_legacy_machine (machine_id)");
    console.log('  + Thêm KEY idx_plc_legacy_machine');
  }

  // 5. Thêm foreign key fk_plc_line_id
  const [lineFks] = await conn.query(`
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plc_stations' AND CONSTRAINT_NAME = 'fk_plc_line_id'
  `, [TEST_DB]);
  if (lineFks.length === 0) {
    await conn.query("ALTER TABLE plc_stations ADD CONSTRAINT fk_plc_line_id FOREIGN KEY (line_id) REFERENCES production_lines (id) ON DELETE RESTRICT ON UPDATE CASCADE");
    console.log('  + Thêm CONSTRAINT fk_plc_line_id FOREIGN KEY (line_id) REFERENCES production_lines (id)');
  }

  // 6. Ghi schema_migrations
  await conn.query(`
    INSERT INTO schema_migrations (version, name, checkpoint, status, applied_at, updated_at)
    VALUES ('004_plc_to_line_architecture', 'Chuyển đổi kiến trúc PLC gắn theo Dây chuyền sản xuất (Production Line)', 'COMPLETED', 'COMPLETED', NOW(), NOW())
    ON DUPLICATE KEY UPDATE status = 'COMPLETED', updated_at = NOW()
  `);
  console.log('  ✓ Đã cập nhật schema_migrations 004_plc_to_line_architecture thành công.');
}

export async function rollbackMigration004(conn) {
  console.log('[ROLLBACK-004] Hoàn nguyên migration 004...');

  // 1. Drop fk_plc_line_id
  const [lineFks] = await conn.query(`
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plc_stations' AND CONSTRAINT_NAME = 'fk_plc_line_id'
  `, [TEST_DB]);
  if (lineFks.length > 0) {
    await conn.query("ALTER TABLE plc_stations DROP FOREIGN KEY fk_plc_line_id");
    console.log('  - Đã xóa foreign key fk_plc_line_id');
  }

  // 2. Drop uq_plc_line_id & line_id
  const [lineIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'uq_plc_line_id'");
  if (lineIdx.length > 0) {
    await conn.query("ALTER TABLE plc_stations DROP INDEX uq_plc_line_id");
    console.log('  - Đã xóa index uq_plc_line_id');
  }

  const [cols] = await conn.query("SHOW COLUMNS FROM plc_stations LIKE 'line_id'");
  if (cols.length > 0) {
    await conn.query("ALTER TABLE plc_stations DROP COLUMN line_id");
    console.log('  - Đã xóa cột line_id');
  }

  // 3. Drop legacy index & khôi phục uq_plc_machine_id + fk_plc_machine_id
  const [legacyIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'idx_plc_legacy_machine'");
  if (legacyIdx.length > 0) {
    await conn.query("ALTER TABLE plc_stations DROP INDEX idx_plc_legacy_machine");
    console.log('  - Đã xóa index idx_plc_legacy_machine');
  }

  const [machIdx] = await conn.query("SHOW INDEX FROM plc_stations WHERE Key_name = 'uq_plc_machine_id'");
  if (machIdx.length === 0) {
    await conn.query("ALTER TABLE plc_stations ADD UNIQUE KEY uq_plc_machine_id (machine_id)");
    console.log('  + Đã khôi phục UNIQUE KEY uq_plc_machine_id');
  }

  const [fks] = await conn.query(`
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plc_stations' AND CONSTRAINT_NAME = 'fk_plc_machine_id'
  `, [TEST_DB]);
  if (fks.length === 0) {
    await conn.query("ALTER TABLE plc_stations ADD CONSTRAINT fk_plc_machine_id FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE RESTRICT ON UPDATE CASCADE");
    console.log('  + Đã khôi phục CONSTRAINT fk_plc_machine_id');
  }

  // 4. Xóa schema_migrations
  await conn.query("DELETE FROM schema_migrations WHERE version = '004_plc_to_line_architecture'");
  console.log('  ✓ Đã hoàn tất rollback migration 004.');
}

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB,
  });

  try {
    console.log(`[TEST-MIGRATE] Bắt đầu chu trình kiểm thử apply -> rollback -> re-apply trên ${TEST_DB}`);
    await applyMigration004(conn);

    console.log('[TEST-MIGRATE] Thử nghiệm rollback...');
    await rollbackMigration004(conn);

    console.log('[TEST-MIGRATE] Tái áp dụng migration chính thức...');
    await applyMigration004(conn);

    console.log('[TEST-MIGRATE] HOÀN TẤT VÀ THÀNH CÔNG 100%!');
  } finally {
    await conn.end();
  }
}

// Nếu chạy trực tiếp từ dòng lệnh
if (process.argv[1]?.endsWith('run_migration_004.js')) {
  main().catch(err => {
    console.error('Lỗi khi chạy migration 004:', err);
    process.exit(1);
  });
}
