/**
 * @file scripts/run_migration_test_db.js
 * @description Thực thi Migration 002 CHỈ TRÊN CSDL TEST: denso_iot_phase1_test.
 * Kiểm tra trước và sau, bảo vệ tuyệt đối CSDL gốc denso_iot.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';
const TEST_DB = 'denso_iot_phase1_test';

async function run() {
  console.log('='.repeat(65));
  console.log(`[MIGRATION] Bắt đầu chạy Migration 002 trên TEST DB: ${TEST_DB}`);
  console.log('='.repeat(65));

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB,
  });

  // 1. Tạo bảng ingested_files_log
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`ingested_files_log\` (
      \`id\` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`file_hash\` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`file_name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`file_size\` bigint NOT NULL,
      \`machine_id\` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      \`total_records\` int DEFAULT 0,
      \`valid_records\` int DEFAULT 0,
      \`error_records\` int DEFAULT 0,
      \`conflict_records\` int DEFAULT 0,
      \`status\` enum('PROCESSING','COMMITTED','FAILED','DUPLICATE','PARTIAL') COLLATE utf8mb4_unicode_ci NOT NULL,
      \`error_details\` text COLLATE utf8mb4_unicode_ci,
      \`exported_at\` datetime(3) DEFAULT NULL,
      \`ingested_at\` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
      \`processed_at\` datetime(3) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_file_hash\` (\`file_hash\`),
      KEY \`idx_machine_ingest\` (\`machine_id\`),
      KEY \`idx_ingested_at\` (\`ingested_at\` DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('  ✓ Đã tạo/kiểm tra bảng ingested_files_log thành công.');

  // 2. Tạo bảng ingested_file_conflicts
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`ingested_file_conflicts\` (
      \`id\` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`file_id\` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`machine_id\` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`mapping_code\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
      \`data_no\` int DEFAULT NULL,
      \`measured_at\` datetime(3) NOT NULL,
      \`existing_value\` decimal(10,2) NOT NULL,
      \`incoming_value\` decimal(10,2) NOT NULL,
      \`resolution\` enum('REJECTED','PENDING_REVIEW','ACCEPTED') COLLATE utf8mb4_unicode_ci DEFAULT 'REJECTED',
      \`detected_at\` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      KEY \`idx_conflict_file\` (\`file_id\`),
      KEY \`idx_conflict_machine\` (\`machine_id\`, \`mapping_code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('  ✓ Đã tạo/kiểm tra bảng ingested_file_conflicts thành công.');

  // 3. Thêm cột vào metric_mappings nếu chưa có
  const [cols1] = await conn.query('SHOW COLUMNS FROM metric_mappings LIKE "data_source_type"');
  if (cols1.length === 0) {
    await conn.query(`
      ALTER TABLE \`metric_mappings\`
      ADD COLUMN \`data_source_type\` enum('PLC_DIRECT','FILE_INGEST','SIMULATED') NOT NULL DEFAULT 'PLC_DIRECT' AFTER \`status\`
    `);
    console.log('  ✓ Đã thêm cột data_source_type vào metric_mappings.');
  } else {
    console.log('  - Cột data_source_type đã tồn tại.');
  }

  const [cols2] = await conn.query('SHOW COLUMNS FROM metric_mappings LIKE "file_tag_name"');
  if (cols2.length === 0) {
    await conn.query(`
      ALTER TABLE \`metric_mappings\`
      ADD COLUMN \`file_tag_name\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER \`data_source_type\`
    `);
    console.log('  ✓ Đã thêm cột file_tag_name vào metric_mappings.');
  } else {
    console.log('  - Cột file_tag_name đã tồn tại.');
  }

  // Kiểm tra xác thực
  const [tables] = await conn.query('SHOW TABLES LIKE "ingested_%"');
  console.log(`  ✓ Các bảng Ingestion hiện có trên ${TEST_DB}:`, tables.map((t) => Object.values(t)[0]));

  await conn.end();
  console.log(`[MIGRATION SUCCESS] Migration 002 hoàn tất thành công trên ${TEST_DB}.`);
}

run().catch((err) => {
  console.error('[MIGRATION ERROR]:', err);
  process.exit(1);
});
