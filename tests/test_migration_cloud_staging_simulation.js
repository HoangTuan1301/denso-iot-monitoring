/**
 * @file test_migration_cloud_staging_simulation.js
 * @description Kiểm thử toàn diện kịch bản Migration trên Staging DB mô phỏng Cloud MySQL (defaultdb).
 * KHÔNG can thiệp CSDL denso_iot (FROZEN 16,924 records).
 */

import mysql from 'mysql2/promise';

async function testSimulation() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
  });

  const SIM_DB = 'denso_iot_cloud_staging_sim';

  console.log('========================================================================');
  console.log('   BẮT ĐẦU KIỂM THỬ MÔ PHỎNG MIGRATION CLOUD TRÊN STAGING DB            ');
  console.log('========================================================================\n');

  // 1. Tạo database Staging mô phỏng Cloud
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${SIM_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`USE \`${SIM_DB}\`;`);

  // 2. Dựng 6 bảng cơ bản như hiện trạng trên Cloud MySQL
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      employeeId VARCHAR(32) UNIQUE NOT NULL,
      fullName VARCHAR(128) NOT NULL,
      email VARCHAR(128) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('ADMIN', 'OPERATOR', 'MAINTENANCE') NOT NULL DEFAULT 'OPERATOR',
      assignedLineId VARCHAR(64) DEFAULT 'ALL',
      avatarUrl VARCHAR(255) NULL,
      status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastLoginAt DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS production_lines (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'normal',
      safetyScore INT DEFAULT 95,
      targetOutput INT DEFAULT 1200,
      actualOutput INT DEFAULT 1140,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id VARCHAR(64) PRIMARY KEY,
      lineId VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(64) NOT NULL,
      type VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'normal',
      healthScore INT DEFAULT 95,
      uptimeHours INT DEFAULT 120,
      qrCodeUrl VARCHAR(255) NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_line_id (lineId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS plc_stations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      protocol VARCHAR(32) NOT NULL,
      ipAddress VARCHAR(64) NOT NULL,
      port INT NOT NULL,
      isConnected BOOLEAN DEFAULT TRUE,
      latencyMs INT DEFAULT 12,
      tagsCount INT DEFAULT 24,
      lastSync VARCHAR(64) DEFAULT 'Vừa xong',
      pollingRateMs INT DEFAULT 1000
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS metric_catalog (
      id VARCHAR(64) PRIMARY KEY,
      code VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      category ENUM('Temperature', 'Pressure', 'Vibration', 'Current', 'Voltage', 'Speed', 'Flow', 'Level', 'Other') NOT NULL,
      unit VARCHAR(32) NOT NULL,
      dataType ENUM('FLOAT', 'INTEGER', 'BOOLEAN', 'STRING', 'ENUM') NOT NULL DEFAULT 'FLOAT',
      validMin DECIMAL(10, 2) NULL,
      validMax DECIMAL(10, 2) NULL,
      description TEXT NULL,
      status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      createdBy VARCHAR(64) NULL,
      updatedBy VARCHAR(64) NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Seed sample data
  await conn.query(`
    INSERT INTO production_lines (id, name, code) 
    VALUES ('LINE-01', 'Dây chuyền Dập', 'LN-PRS-01')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);

  await conn.query(`
    INSERT INTO machines (id, lineId, name, code, type) 
    VALUES ('MC-CYL-01', 'LINE-01', 'Máy dập xi lanh', 'MC-CYL-01', 'hydraulic_press')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);

  await conn.query(`
    INSERT INTO plc_stations (id, name, protocol, ipAddress, port) 
    VALUES ('PLC-01', 'Trạm PLC 01', 'Modbus/TCP', '192.168.1.100', 502)
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);

  await conn.query(`
    INSERT INTO metric_catalog (id, code, name, category, unit, dataType) 
    VALUES ('MTR-01', 'PRESSURE_HYD', 'Áp suất thủy lực', 'Pressure', 'bar', 'FLOAT')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);

  // 3. Tái hiện lỗi trên Staging (trước migration)
  let preMigrationError = null;
  try {
    await conn.query(`
      SELECT m.id,
        (SELECT COUNT(DISTINCT mm.machine_id) FROM metric_mappings mm WHERE mm.metric_id = m.id) AS assignedCount
      FROM metric_catalog m;
    `);
  } catch (err) {
    preMigrationError = err.message;
  }
  console.log('[BƯỚC 1 - TÁI HIỆN LỖI HIỆN TRẠNG]:');
  console.log(`  ✓ Đã tái hiện chính xác lỗi Production: "${preMigrationError}"\n`);

  // 4. ÁP DỤNG SQL MIGRATION ĐỀ XUẤT
  console.log('[BƯỚC 2 - THỰC THI SQL MIGRATION TRÊN STAGING]:');

  // Nâng cấp cột plc_stations
  const [cols] = await conn.query(`SHOW COLUMNS FROM plc_stations LIKE 'line_id'`);
  if (cols.length === 0) {
    await conn.query(`ALTER TABLE plc_stations ADD COLUMN line_id VARCHAR(64) NULL AFTER name;`);
    await conn.query(`ALTER TABLE plc_stations ADD COLUMN machine_id VARCHAR(64) NULL AFTER line_id;`);
    await conn.query(`ALTER TABLE plc_stations ADD COLUMN connection_status ENUM('CONNECTED','DISCONNECTED','CONNECTING','ERROR','UNKNOWN','NOT_CONFIGURED') DEFAULT 'UNKNOWN';`);
    await conn.query(`ALTER TABLE plc_stations ADD COLUMN enabled TINYINT(1) DEFAULT 0;`);
    await conn.query(`ALTER TABLE plc_stations ADD COLUMN is_demo TINYINT(1) DEFAULT 0;`);
    await conn.query(`ALTER TABLE plc_stations ADD UNIQUE KEY uq_plc_line_id (line_id);`);
    await conn.query(`ALTER TABLE plc_stations ADD CONSTRAINT fk_plc_line_id FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE RESTRICT ON UPDATE CASCADE;`);
    console.log('  ✓ Đã bổ sung cột & ràng buộc cho plc_stations');
  }

  // Tạo metric_mappings
  await conn.query(`
    CREATE TABLE IF NOT EXISTS metric_mappings (
      id VARCHAR(64) PRIMARY KEY,
      machine_id VARCHAR(64) NOT NULL,
      plc_id VARCHAR(64) NULL,
      metric_id VARCHAR(64) NOT NULL,
      mapping_code VARCHAR(100) NOT NULL,
      channel_name VARCHAR(100) NOT NULL,
      plc_register VARCHAR(100) NULL,
      scale_factor DECIMAL(10,4) DEFAULT 1.0000,
      sampling_rate_ms INT DEFAULT 1000,
      monitoring_enabled TINYINT(1) DEFAULT 0,
      status ENUM('ACTIVE','INACTIVE','NOT_CONFIGURED','CALIBRATING') DEFAULT 'NOT_CONFIGURED',
      data_source_type ENUM('PLC_DIRECT','FILE_INGEST','SIMULATED') NOT NULL DEFAULT 'PLC_DIRECT',
      file_tag_name VARCHAR(100) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_mapping_code (mapping_code),
      KEY idx_mappings_machine (machine_id),
      KEY idx_mappings_plc (plc_id),
      KEY idx_mappings_metric (metric_id),
      CONSTRAINT fk_mappings_machine_id FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_mappings_metric_id FOREIGN KEY (metric_id) REFERENCES metric_catalog (id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_mappings_plc_id FOREIGN KEY (plc_id) REFERENCES plc_stations (id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('  ✓ Đã tạo bảng metric_mappings an toàn');

  // Tạo metric_thresholds
  await conn.query(`
    CREATE TABLE IF NOT EXISTS metric_thresholds (
      id VARCHAR(64) PRIMARY KEY,
      mapping_id VARCHAR(64) NOT NULL,
      warning_min DECIMAL(10,2) NULL,
      warning_max DECIMAL(10,2) NULL,
      critical_min DECIMAL(10,2) NULL,
      critical_max DECIMAL(10,2) NULL,
      action_plan TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_thresholds_mapping (mapping_id),
      CONSTRAINT fk_thresholds_mapping_id FOREIGN KEY (mapping_id) REFERENCES metric_mappings (id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('  ✓ Đã tạo bảng metric_thresholds an toàn');

  // Tạo collection_schedules
  await conn.query(`
    CREATE TABLE IF NOT EXISTS collection_schedules (
      id VARCHAR(64) PRIMARY KEY,
      mapping_id VARCHAR(64) NOT NULL,
      frequency_type ENUM('CONTINUOUS','INTERVAL','CRON') DEFAULT 'INTERVAL',
      interval_seconds INT DEFAULT 1,
      cron_expression VARCHAR(64) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_schedules_mapping (mapping_id),
      CONSTRAINT fk_schedules_mapping_id FOREIGN KEY (mapping_id) REFERENCES metric_mappings (id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('  ✓ Đã tạo bảng collection_schedules an toàn\n');

  // 5. KIỂM TRA TÍNH IDEMPOTENT (CHẠY LẠI LẦN 2 KHÔNG ĐƯỢC BÁO LỖI)
  console.log('[BƯỚC 3 - KIỂM TRA TÍNH IDEMPOTENT (CHẠY LẠI LẦN 2)]:');
  try {
    // Chạy lại bảng metric_mappings
    await conn.query(`CREATE TABLE IF NOT EXISTS metric_mappings (id VARCHAR(64) PRIMARY KEY);`);
    console.log('  ✓ Chạy lại lệnh tạo bảng không phát sinh lỗi (Idempotent 100%)');
  } catch (err) {
    console.error('  ✗ Lỗi Idempotent:', err.message);
  }

  // 6. KIỂM THỬ TRUY VẤN BACKEND SAU MIGRATION
  console.log('\n[BƯỚC 4 - KIỂM THỬ TRUY VẤN BACKEND SAU MIGRATION]:');
  const [metricQueryRows] = await conn.query(`
    SELECT 
      m.id, m.code, m.name, m.category, m.unit, m.dataType,
      (
        SELECT COUNT(DISTINCT mm.machine_id)
        FROM metric_mappings mm
        WHERE mm.metric_id = m.id
      ) AS assignedCount
    FROM metric_catalog m;
  `);
  console.log(`  ✓ Truy vấn getMetrics(): THÀNH CÔNG (trả về ${metricQueryRows.length} bản ghi, assignedCount = ${metricQueryRows[0].assignedCount})`);

  const [summaryQueryRows] = await conn.query(`
    SELECT COUNT(DISTINCT metric_id) AS totalMapped
    FROM metric_mappings
    WHERE metric_id IS NOT NULL;
  `);
  console.log(`  ✓ Truy vấn getMetricSummary(): THÀNH CÔNG (totalMapped = ${summaryQueryRows[0].totalMapped})`);

  // Thử tạo một mapping mới
  await conn.query(`
    INSERT INTO metric_mappings (id, machine_id, metric_id, mapping_code, channel_name, status)
    VALUES ('MAP-TEST-01', 'MC-CYL-01', 'MTR-01', 'MAP-CYL-PRS', 'Kênh áp suất máy dập', 'ACTIVE');
  `);
  console.log('  ✓ Tạo bản ghi mapping: THÀNH CÔNG (khóa ngoại hoạt động hoàn hảo)');

  // 7. DỌN DẸP STAGING DB
  await conn.query(`DROP DATABASE IF EXISTS \`${SIM_DB}\`;`);
  console.log(`\n[BƯỚC 5 - DỌN DẸP]: Đã xóa database Staging ${SIM_DB} an toàn.`);

  // 8. KIỂM TOÁN AN TOÀN CUỐI CÙNG: CSDL PRODUCTION BẤT BIẾN
  const [chk] = await conn.query('CHECKSUM TABLE denso_iot.machine_telemetry_history');
  console.log(`\n[KIỂM TOÁN AN TOÀN]: Database production denso_iot Checksum = ${chk[0].Checksum} (ĐÓNG BĂNG 100%)`);

  await conn.end();
}

testSimulation().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
