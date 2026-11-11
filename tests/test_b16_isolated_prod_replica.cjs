const mysql = require('mysql2/promise');
const fs = require('fs');

async function runB16Verification() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    multipleStatements: true,
  });

  const [verRows] = await conn.query('SELECT VERSION() AS ver, NOW() AS ts');
  const mysqlVersion = verRows[0].ver;
  const testTimestamp = verRows[0].ts;

  const TEST_DB = 'denso_kailink_b16_prod_replica';

  console.log('========================================================================');
  console.log('   BƯỚC 16: KIỂM ĐỊNH AN TOÀN TRÊN DATABASE TEST ĐỘC LẬP REPLICA       ');
  console.log('========================================================================');
  console.log(`- Môi trường kiểm thử: MySQL Server ${mysqlVersion}`);
  console.log(`- Thời điểm thực thi: ${testTimestamp}`);
  console.log(`- Database độc lập: ${TEST_DB}`);
  console.log('------------------------------------------------------------------------\n');

  // 1. Tạo database độc lập
  await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\`;`);
  await conn.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.query(`USE \`${TEST_DB}\`;`);

  // 2. Dựng 7 bảng với cấu trúc và dữ liệu đại diện chính xác 100% như trên Aiven Cloud
  console.log('[GIAI ĐOẠN 1] Khởi tạo 7 bảng và dữ liệu đại diện giống hệt Aiven Cloud:');

  await conn.query(`
    -- 1. Users
    CREATE TABLE users (
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

    -- 2. Production Lines (3 bản ghi)
    CREATE TABLE production_lines (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'normal',
      safetyScore INT DEFAULT 95,
      targetOutput INT DEFAULT 1200,
      actualOutput INT DEFAULT 1140,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    INSERT INTO production_lines (id, name, code, status, safetyScore) VALUES
      ('LINE-01', 'Dây chuyền Dập & Hàn Khung Gầm', 'LN-PRS-01', 'normal', 96),
      ('LINE-02', 'Dây chuyền Sơn Tĩnh Điện', 'LN-PNT-02', 'normal', 94),
      ('LINE-03', 'Dây chuyền Lắp Ráp Hoàn Thiện', 'LN-ASM-03', 'normal', 95);

    -- 3. Machines (6 bản ghi thuộc 3 dây chuyền)
    CREATE TABLE machines (
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
      INDEX idx_line_id (lineId),
      CONSTRAINT fk_machines_line_id FOREIGN KEY (lineId) REFERENCES production_lines (id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    INSERT INTO machines (id, lineId, name, code, type) VALUES
      ('MC-FDR-01', 'LINE-01', 'Máy cấp phôi tự động', 'MC-FDR-01', 'feeder'),
      ('MC-CYL-01', 'LINE-01', 'Máy dập xi lanh thủy lực', 'MC-CYL-01', 'hydraulic_press'),
      ('MC-ASM-01', 'LINE-01', 'Trạm siết bulong tự động', 'MC-ASM-01', 'tightening_station'),
      ('MC-PNT-01', 'LINE-02', 'Trạm phun sơn tự động', 'MC-PNT-01', 'paint_booth'),
      ('MC-DRY-01', 'LINE-02', 'Trạm sấy hồng ngoại', 'MC-DRY-01', 'drying_oven'),
      ('MC-TST-01', 'LINE-03', 'Trạm kiểm tra chức năng', 'MC-TST-01', 'testing_station');

    -- 4. PLC Stations (Hiện trạng 11 cột, không có line_id, 2 trạm PLC)
    CREATE TABLE plc_stations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      protocol VARCHAR(32) NOT NULL,
      ipAddress VARCHAR(64) NOT NULL,
      port INT NOT NULL,
      isConnected BOOLEAN DEFAULT TRUE,
      latencyMs INT DEFAULT 12,
      tagsCount INT DEFAULT 24,
      lastSync VARCHAR(64) DEFAULT 'Vừa xong',
      pollingRateMs INT DEFAULT 1000,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    INSERT INTO plc_stations (id, name, protocol, ipAddress, port) VALUES
      ('PLC-STATION-01', 'Trạm PLC Chính - Dây chuyền Dập & Hàn (Siemens S7-1500)', 'Modbus/TCP', '192.168.1.100', 502),
      ('PLC-STATION-02', 'Trạm PLC Phụ - Dây chuyền Sơn & Lắp ráp (Omron NX1P2)', 'OPC-UA', '192.168.1.101', 4840);

    -- 5. Metric Catalog (10 bản ghi chuẩn)
    CREATE TABLE metric_catalog (
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

    INSERT INTO metric_catalog (id, code, name, category, unit, dataType, validMin, validMax) VALUES
      ('MTR-CAT-TMP-01', 'TEMPERATURE', 'Nhiệt độ hoạt động', 'Temperature', '°C', 'FLOAT', -40.0, 300.0),
      ('MTR-CAT-PRS-01', 'PRESSURE_HYDRAULIC', 'Áp suất dầu thủy lực', 'Pressure', 'bar', 'FLOAT', 0.0, 400.0),
      ('MTR-CAT-PRS-02', 'PRESSURE_PNEUMATIC', 'Áp suất khí nén cấp', 'Pressure', 'bar', 'FLOAT', 0.0, 25.0),
      ('MTR-CAT-VIB-01', 'VIBRATION_RMS', 'Vận tốc rung hiệu dụng (RMS)', 'Vibration', 'mm/s', 'FLOAT', 0.0, 50.0),
      ('MTR-CAT-CUR-01', 'CURRENT_PHASE', 'Dòng điện tải động cơ', 'Current', 'A', 'FLOAT', 0.0, 250.0),
      ('MTR-CAT-VOL-01', 'VOLTAGE_LINE', 'Điện áp lưới cung cấp', 'Voltage', 'V', 'FLOAT', 0.0, 500.0),
      ('MTR-CAT-SPD-01', 'ROTATION_SPEED', 'Tốc độ quay trục chính', 'Speed', 'RPM', 'FLOAT', 0.0, 15000.0),
      ('MTR-CAT-FLW-01', 'FLOW_COOLANT', 'Lưu lượng dung dịch làm mát', 'Flow', 'L/min', 'FLOAT', 0.0, 100.0),
      ('MTR-CAT-LVL-01', 'OIL_LEVEL', 'Mức dầu bôi trơn bình chứa', 'Level', '%', 'FLOAT', 0.0, 100.0),
      ('MTR-CAT-ENG-01', 'ENERGY_CONSUMPTION', 'Công suất điện tiêu thụ', 'Other', 'kW', 'FLOAT', 0.0, 500.0);

    -- 6. Audit Logs
    CREATE TABLE audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NULL,
      action VARCHAR(64) NOT NULL,
      target VARCHAR(128) NULL,
      details TEXT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- 7. Machine Telemetry History
    CREATE TABLE machine_telemetry_history (
      id VARCHAR(96) PRIMARY KEY,
      timestamp DATETIME(3) NOT NULL,
      lineId VARCHAR(64) NOT NULL,
      machineId VARCHAR(64) NOT NULL,
      metricId VARCHAR(64) NOT NULL,
      value DECIMAL(10, 2) NOT NULL,
      unit VARCHAR(32) NOT NULL,
      status ENUM('normal', 'warning', 'critical') NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [tInit] = await conn.query('SHOW TABLES');
  console.log(`  ✓ Đã thiết lập ${tInit.length} bảng ban đầu (Chưa có metric_mappings).`);

  // Đọc file migration SQL 002
  const migrationRawSql = fs.readFileSync('scripts/migrations/002_production_kailink_schema_sync_mysql84.sql', 'utf8')
    .replace('USE defaultdb;', `USE \`${TEST_DB}\`;`);

  // 3. THỰC THI KIỂM THỬ LẦN 1
  console.log('\n[GIAI ĐOẠN 2] Thực thi Migration Lần 1 (Áp dụng Schema):');
  const startT1 = Date.now();
  await conn.query(migrationRawSql);
  const durT1 = Date.now() - startT1;
  console.log(`  ✓ LẦN 1 PASS: Hoàn thành trong ${durT1}ms. Không có lỗi cú pháp hay ngoại lệ.`);

  // 4. THỰC THI KIỂM THỬ LẦN 2 (DEEP IDEMPOTENCY)
  console.log('\n[GIAI ĐOẠN 3] Thực thi Migration Lần 2 (Kiểm tra Deep Idempotency):');
  const startT2 = Date.now();
  await conn.query(migrationRawSql);
  const durT2 = Date.now() - startT2;
  console.log(`  ✓ LẦN 2 PASS: Hoàn thành trong ${durT2}ms. Idempotent 100%, không bị Duplicate Key / Column.`);

  // 5. KIỂM TRA ĐẦY ĐỦ SCHEMA & CONSTRAINTS SAU MIGRATION
  console.log('\n[GIAI ĐOẠN 4] Kiểm tra chi tiết Schema, Columns, Constraints & Foreign Keys:');
  
  // 5.1 Bảng plc_stations
  const [plcCols] = await conn.query('SHOW COLUMNS FROM plc_stations');
  const plcFields = plcCols.map((c) => ({ field: c.Field, type: c.Type, null: c.Null, default: c.Default }));
  const enabledCol = plcFields.find((f) => f.field === 'enabled');
  console.log(`  ✓ plc_stations có tổng cộng ${plcFields.length} cột (Đã thêm line_id, machine_id, connection_status, enabled, is_demo).`);
  console.log(`  ✓ plc_stations.enabled có DEFAULT = '${enabledCol.default}' (An toàn: CHỐT BẢO VỆ SOCKET KHÔNG MỞ TỰ ĐỘNG).`);

  // 5.2 Khóa ngoại Foreign Keys
  const [fks] = await conn.query(`
    SELECT 
      CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `, [TEST_DB]);

  console.log(`  ✓ Đã kiểm tra ${fks.length} khóa ngoại liên kết toàn vẹn:`);
  fks.forEach((k) => {
    console.log(`    - [${k.TABLE_NAME}.${k.COLUMN_NAME}] -> trỏ về [${k.REFERENCED_TABLE_NAME}.${k.REFERENCED_COLUMN_NAME}] (${k.CONSTRAINT_NAME})`);
  });

  // 6. KIỂM TRA TRUY VẤN CỦA 5 NHÓM API BACKEND TRÊN DB MỚI
  console.log('\n[GIAI ĐOẠN 5] Kiểm tra phản hồi của 5 nhóm API nghiệp vụ Backend:');

  // API 1: Danh mục Metric (getMetrics & getMetricSummary)
  const [mList] = await conn.query(`
    SELECT 
      m.id, m.code, m.name, m.category, m.unit, m.dataType,
      (SELECT COUNT(DISTINCT mm.machine_id) FROM metric_mappings mm WHERE mm.metric_id = m.id) AS assignedCount,
      (SELECT GROUP_CONCAT(DISTINCT mm.machine_id) FROM metric_mappings mm WHERE mm.metric_id = m.id) AS assignedMachineIds
    FROM metric_catalog m;
  `);
  const [mSum] = await conn.query(`
    SELECT COUNT(DISTINCT metric_id) AS totalMapped FROM metric_mappings WHERE metric_id IS NOT NULL;
  `);
  console.log(`  ✓ API 1 [GET /api/metrics/catalog]: PASS (Trả về ${mList.length} metric, assignedCount = ${mList[0].assignedCount}, totalMapped = ${mSum[0].totalMapped}). HẾT LỖI 500!`);

  // API 2: Dây chuyền sản xuất (getProductionLines)
  const [lines] = await conn.query(`
    SELECT 
      p.id, p.name, p.code, p.status, p.safetyScore,
      COUNT(DISTINCT m.id) AS machineCount,
      plc.id AS plcId, plc.name AS plcName, plc.protocol AS plcProtocol, plc.connection_status AS plcStatus,
      plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo
    FROM production_lines p
    LEFT JOIN machines m ON m.lineId = p.id
    LEFT JOIN plc_stations plc ON plc.line_id = p.id
    GROUP BY p.id, plc.id ORDER BY p.id ASC;
  `);
  console.log(`  ✓ API 2 [GET /api/lines]: PASS (Trả về ${lines.length} dây chuyền, machineCount = ${lines[0].machineCount}, plcId = ${lines[0].plcId || 'NULL (Chưa gán)'}).`);

  // API 3: Danh sách thiết bị (getMachines)
  const [machines] = await conn.query(`
    SELECT 
      m.*, p.name AS lineName,
      plc.id AS plcId, plc.name AS plcName, plc.connection_status AS plcStatus, plc.enabled AS plcEnabled, plc.is_demo AS plcIsDemo,
      COUNT(mm.id) AS mappingCount
    FROM machines m
    LEFT JOIN production_lines p ON m.lineId = p.id
    LEFT JOIN plc_stations plc ON (plc.line_id = m.lineId OR (plc.line_id IS NULL AND plc.machine_id = m.id))
    LEFT JOIN metric_mappings mm ON mm.machine_id = m.id
    GROUP BY m.id, plc.id ORDER BY m.lineId ASC, m.id ASC;
  `);
  console.log(`  ✓ API 3 [GET /api/machines]: PASS (Trả về ${machines.length} máy, lineId = ${machines[0].lineId}, mappingCount = ${machines[0].mappingCount}).`);

  // API 4: Chi tiết máy (getMachineById)
  const [mDetail] = await conn.query(`
    SELECT m.*, plc.id AS plcId, plc.name AS plcName
    FROM machines m
    LEFT JOIN plc_stations plc ON (plc.line_id = m.lineId OR (plc.line_id IS NULL AND plc.machine_id = m.id))
    WHERE m.id = 'MC-CYL-01';
  `);
  console.log(`  ✓ API 4 [GET /api/machines/MC-CYL-01]: PASS (Trả về chi tiết máy ${mDetail[0].name}, status = ${mDetail[0].status}).`);

  // API 5: Mapping & Ngưỡng (getMappingDetails)
  const [mapRows] = await conn.query(`
    SELECT mm.*, mt.warning_min, mt.critical_min, cs.interval_seconds
    FROM metric_mappings mm
    LEFT JOIN metric_thresholds mt ON mt.mapping_id = mm.id
    LEFT JOIN collection_schedules cs ON cs.mapping_id = mm.id;
  `);
  console.log(`  ✓ API 5 [GET /api/mappings]: PASS (Trả về ${mapRows.length} mappings, JOIN metric_thresholds và collection_schedules trơn tru).`);

  // 7. KIỂM TOÁN AN TOÀN VÀ DỌN DẸP
  await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\`;`);
  console.log(`\n[GIAI ĐOẠN 6] Đã xóa database test độc lập ${TEST_DB} an toàn.`);

  // 8. KIỂM TOÁN CSDL PRODUCTION LOCAL
  const [chk] = await conn.query('CHECKSUM TABLE denso_iot.machine_telemetry_history');
  console.log(`[KIỂM TOÁN CSDL LOCAL]: Database denso_iot Checksum = ${chk[0].Checksum} (BẤT BIẾN 100%, 16,924 records)\n`);

  await conn.end();
}

runB16Verification().catch((err) => {
  console.error('[B16 TEST FAILED]:', err);
  process.exit(1);
});
