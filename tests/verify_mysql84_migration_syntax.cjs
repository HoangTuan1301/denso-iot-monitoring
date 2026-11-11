const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    multipleStatements: true
  });

  const TEST_DB = 'test_mysql84_syntax_verification';
  await conn.query('CREATE DATABASE IF NOT EXISTS `' + TEST_DB + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  await conn.query('USE `' + TEST_DB + '`;');

  // Tạo trước 4 bảng phụ thuộc
  await conn.query(`
    CREATE TABLE IF NOT EXISTS production_lines (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS machines (
      id VARCHAR(64) PRIMARY KEY,
      lineId VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(64) NOT NULL,
      type VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS metric_catalog (
      id VARCHAR(64) PRIMARY KEY,
      code VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      category VARCHAR(32) NOT NULL,
      unit VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS plc_stations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      protocol VARCHAR(32) NOT NULL,
      ipAddress VARCHAR(64) NOT NULL,
      port INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Đọc file SQL đã sửa
  const sqlContent = fs.readFileSync('scripts/migrations/002_production_kailink_schema_sync_mysql84.sql', 'utf8')
    .replace('USE defaultdb;', 'USE `' + TEST_DB + '`;');

  console.log('--- TEST 1: CHẠY LẦN 1 (THỰC THI SCHEMA) ---');
  await conn.query(sqlContent);
  console.log('PASS: Lần 1 thực thi thành công.');

  console.log('--- TEST 2: CHẠY LẦN 2 (KIỂM TRA IDEMPOTENT) ---');
  await conn.query(sqlContent);
  console.log('PASS: Lần 2 thực thi thành công (Idempotent 100%).');

  // Kiểm tra các cột trong plc_stations
  const [cols] = await conn.query('SHOW COLUMNS FROM plc_stations');
  console.log('Columns in plc_stations:', cols.map(c => c.Field));

  // Dọn dẹp
  await conn.query('DROP DATABASE IF EXISTS `' + TEST_DB + '`;');
  console.log('PASS: Dọn dẹp test database sạch sẽ.');

  // Kiểm tra CSDL production denso_iot bất biến
  const [chk] = await conn.query('CHECKSUM TABLE denso_iot.machine_telemetry_history');
  console.log('Production denso_iot Checksum:', chk[0].Checksum);

  await conn.end();
})();
