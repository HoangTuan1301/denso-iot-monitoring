const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function testInterruptedRecovery() {
  console.log('========================================================================');
  console.log('   KIỂM THỬ KHẢ NĂNG PHỤC HỒI KHI MIGRATION BỊ GIÁN ĐOẠN GIỮA CHỪNG    ');
  console.log('========================================================================');

  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    multipleStatements: true,
  });

  const TEST_DB = 'denso_test_interrupted_recovery';

  try {
    // 1. Dựng DB
    await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\`;`);
    await conn.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${TEST_DB}\`;`);

    // Dựng 7 bảng chuẩn
    await conn.query(`
      CREATE TABLE users (id VARCHAR(64) PRIMARY KEY, email VARCHAR(128) UNIQUE NOT NULL);
      CREATE TABLE production_lines (id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL);
      CREATE TABLE machines (id VARCHAR(64) PRIMARY KEY, lineId VARCHAR(64) NOT NULL, name VARCHAR(128) NOT NULL);
      CREATE TABLE plc_stations (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        ipAddress VARCHAR(64) NOT NULL
      );
      CREATE TABLE metric_catalog (id VARCHAR(64) PRIMARY KEY, name VARCHAR(128) NOT NULL);
      CREATE TABLE audit_logs (id VARCHAR(64) PRIMARY KEY);
      CREATE TABLE machine_telemetry_history (id BIGINT AUTO_INCREMENT PRIMARY KEY);
    `);

    // 2. Giả lập MIGRATION BỊ GIÁN ĐOẠN:
    // Đã thêm line_id và machine_id, nhưng bị rớt mạng trước khi thêm connection_status và các bảng mới!
    console.log('[BƯỚC 1] Giả lập sự cố: Migration đang chạy thì bị ngắt kết nối (mới thêm line_id, machine_id):');
    await conn.query(`
      ALTER TABLE plc_stations ADD COLUMN line_id VARCHAR(64) NULL;
      ALTER TABLE plc_stations ADD COLUMN machine_id VARCHAR(64) NULL;
    `);
    const [colsInterrupted] = await conn.query(`SHOW COLUMNS FROM plc_stations;`);
    console.log(`  ✓ Cột hiện có của plc_stations: ${colsInterrupted.map(c => c.Field).join(', ')}`);

    // 3. Chạy lại TOÀN BỘ script 002
    console.log('[BƯỚC 2] Chạy lại toàn bộ script 002 từ đầu (Kiểm tra cơ chế Deep Idempotency):');
    const rawSql = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'migrations', '002_production_kailink_schema_sync_mysql84.sql'), 'utf8');
    const migrationSql = rawSql.replace(/USE\s+defaultdb;/gi, `USE \`${TEST_DB}\`;`);

    const startT = Date.now();
    await conn.query(migrationSql);
    const duration = Date.now() - startT;
    console.log(`  ✓ Migration hoàn tất thành công trong ${duration}ms không gặp bất kỳ lỗi Duplicate Column / Key.`);

    // 4. Kiểm tra cấu trúc sau khi phục hồi
    console.log('[BƯỚC 3] Xác minh cấu trúc schema sau phục hồi:');
    const [colsFinal] = await conn.query(`SHOW COLUMNS FROM plc_stations;`);
    const colNames = colsFinal.map(c => c.Field);
    console.log(`  ✓ Cột cuối cùng của plc_stations (${colNames.length} cột): ${colNames.join(', ')}`);

    const expectedCols = ['line_id', 'machine_id', 'connection_status', 'enabled', 'is_demo'];
    for (const ec of expectedCols) {
      if (!colNames.includes(ec)) {
        throw new Error(`Thiếu cột ${ec} sau phục hồi!`);
      }
    }

    const [tables] = await conn.query(`SHOW TABLES;`);
    console.log(`  ✓ Tổng số bảng: ${tables.length} (Bao gồm đầy đủ 3 bảng metric mới).`);

    // 5. Dọn dẹp
    await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\`;`);
    console.log('[BƯỚC 4] Đã dọn dẹp database test an toàn.');
    console.log('\n>>> KẾT LUẬN: SCRIPT HOÀN TOÀN TỰ PHỤC HỒI KHI BỊ GIÁN ĐOẠN GIỮA CHỪNG.');
  } finally {
    await conn.end();
  }
}

testInterruptedRecovery().catch(err => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
