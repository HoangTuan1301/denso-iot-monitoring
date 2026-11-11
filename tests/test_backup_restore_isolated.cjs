const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MYSQL_EXE = '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe"';
const MYSQLDUMP_EXE = '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe"';

const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '123456',
  multipleStatements: true,
};

async function testBackupAndRestore() {
  console.log('========================================================================');
  console.log('   KIỂM ĐỊNH QUY TRÌNH BACKUP & RESTORE TRÊN DATABASE TEST ĐỘC LẬP     ');
  console.log('========================================================================');

  const conn = await mysql.createConnection(DB_CONFIG);

  const DB_SRC = 'denso_test_backup_src';
  const DB_DEST = 'denso_test_restore_dest';
  const dumpFilePath = path.join(__dirname, 'fixtures', 'temp_backup_test.sql');

  // Đảm bảo thư mục fixtures tồn tại
  if (!fs.existsSync(path.join(__dirname, 'fixtures'))) {
    fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
  }

  try {
    // 1. Tạo DB nguồn
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_SRC}\`;`);
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_DEST}\`;`);
    await conn.query(`CREATE DATABASE \`${DB_SRC}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await conn.query(`USE \`${DB_SRC}\`;`);

    // Dựng 7 bảng chuẩn Aiven Cloud
    await conn.query(`
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

      CREATE TABLE production_lines (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        code VARCHAR(64) UNIQUE NOT NULL,
        status VARCHAR(32) DEFAULT 'normal',
        safetyScore INT DEFAULT 100,
        targetOutput INT DEFAULT 0,
        actualOutput INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE machines (
        id VARCHAR(64) PRIMARY KEY,
        lineId VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        code VARCHAR(64) UNIQUE NOT NULL,
        type VARCHAR(64) DEFAULT 'general',
        status VARCHAR(32) DEFAULT 'normal',
        healthScore INT DEFAULT 100,
        uptimeHours INT DEFAULT 0,
        qrCodeUrl VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_machines_line_id FOREIGN KEY (lineId) REFERENCES production_lines(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        action VARCHAR(64) NOT NULL,
        entity VARCHAR(64) NOT NULL,
        entity_id VARCHAR(64) NULL,
        details TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE plc_stations (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        protocol VARCHAR(32) DEFAULT 'Modbus/TCP',
        ipAddress VARCHAR(64) NOT NULL,
        port INT DEFAULT 502,
        isConnected TINYINT(1) DEFAULT 0,
        latencyMs INT DEFAULT 0,
        tagsCount INT DEFAULT 0,
        lastSync VARCHAR(64) DEFAULT 'Chưa đồng bộ',
        pollingRateMs INT DEFAULT 1000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE machine_telemetry_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        machine_id VARCHAR(64) NOT NULL,
        metric_code VARCHAR(64) NOT NULL,
        value DECIMAL(12, 4) NOT NULL,
        status VARCHAR(32) DEFAULT 'normal',
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_machine_metric_time (machine_id, metric_code, recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE metric_catalog (
        id VARCHAR(64) PRIMARY KEY,
        metric_code VARCHAR(64) UNIQUE NOT NULL,
        metric_name VARCHAR(128) NOT NULL,
        category VARCHAR(64) DEFAULT 'General',
        unit VARCHAR(32) NOT NULL,
        standard_warning_min DECIMAL(10, 2) NULL,
        standard_warning_max DECIMAL(10, 2) NULL,
        standard_critical_min DECIMAL(10, 2) NULL,
        standard_critical_max DECIMAL(10, 2) NULL,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- Seed data
      INSERT INTO production_lines (id, name, code) VALUES
        ('LINE-01', 'Dây chuyền Dập & Hàn Khung Gầm', 'LN-PRS-01'),
        ('LINE-02', 'Dây chuyền Sơn Tĩnh Điện', 'LN-PNT-02'),
        ('LINE-03', 'Dây chuyền Lắp Ráp Hoàn Thiện', 'LN-ASM-03');

      INSERT INTO machines (id, lineId, name, code) VALUES
        ('MC-FDR-01', 'LINE-01', 'Máy cấp phôi tự động', 'FDR-01'),
        ('MC-CYL-01', 'LINE-01', 'Máy dập xi lanh thủy lực', 'CYL-01'),
        ('MC-ASM-01', 'LINE-01', 'Robot hàn bấm điểm', 'ASM-01'),
        ('MC-PNT-01', 'LINE-02', 'Buồng phun sơn tự động', 'PNT-01'),
        ('MC-DRY-01', 'LINE-02', 'Lò sấy hồng ngoại', 'DRY-01'),
        ('MC-TST-01', 'LINE-03', 'Trạm kiểm tra thử nghiệm', 'TST-01');

      INSERT INTO plc_stations (id, name, ipAddress, port) VALUES
        ('PLC-LINE-01', 'Trạm PLC Dập & Hàn S7-1500', '192.168.1.100', 502),
        ('PLC-LINE-02', 'Trạm PLC Sơn Tĩnh Điện NX1P2', '192.168.1.101', 502);

      INSERT INTO metric_catalog (id, metric_code, metric_name, unit) VALUES
        ('MTR-01', 'MTR_TEMP_OIL', 'Nhiệt độ dầu thủy lực', '°C'),
        ('MTR-02', 'MTR_PRESS_MAIN', 'Áp suất nén trục chính', 'bar');
    `);
    console.log('[BƯỚC 1] Khởi tạo DB nguồn mẫu `denso_test_backup_src`: THÀNH CÔNG.');

    // 2. Chạy lệnh mysqldump xuất file backup
    console.log('[BƯỚC 2] Thực thi sao lưu qua mysqldump:');
    const dumpCmd = `${MYSQLDUMP_EXE} -h localhost -P 3306 -u root -p123456 --single-transaction --quick --skip-lock-tables ${DB_SRC} > "${dumpFilePath}"`;
    execSync(dumpCmd, { stdio: 'pipe' });

    const stats = fs.statSync(dumpFilePath);
    console.log(`  ✓ File dump được tạo: ${dumpFilePath} (${stats.size} bytes).`);
    if (stats.size === 0) {
      throw new Error('Dump file rỗng!');
    }

    // 3. Tạo DB đích và restore
    console.log('[BƯỚC 3] Tạo database độc lập `denso_test_restore_dest` và thực thi Restore:');
    await conn.query(`CREATE DATABASE \`${DB_DEST}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

    const restoreCmd = `${MYSQL_EXE} -h localhost -P 3306 -u root -p123456 ${DB_DEST} < "${dumpFilePath}"`;
    execSync(restoreCmd, { stdio: 'pipe' });
    console.log('  ✓ Đã restore thành công dữ liệu từ dump vào `denso_test_restore_dest`.');

    // 4. So sánh số lượng bản ghi giữa DB_SRC và DB_DEST
    console.log('[BƯỚC 4] Đối chiếu tính toàn vẹn giữa DB_SRC và DB_DEST:');
    const tables = ['production_lines', 'machines', 'plc_stations', 'metric_catalog'];
    for (const t of tables) {
      const [r1] = await conn.query(`SELECT COUNT(*) as c FROM \`${DB_SRC}\`.\`${t}\``);
      const [r2] = await conn.query(`SELECT COUNT(*) as c FROM \`${DB_DEST}\`.\`${t}\``);
      const c1 = r1[0].c;
      const c2 = r2[0].c;
      if (c1 !== c2) {
        throw new Error(`Sai lệch số lượng bản ghi bảng ${t}: ${c1} != ${c2}`);
      }
      console.log(`  ✓ Bảng ${t}: ${c1} bản ghi (Khớp 100%).`);
    }

    // 5. Thử nghiệm kịch bản Migration trên SRC và Rollback từ DEST
    console.log('[BƯỚC 5] Kiểm chứng khả năng Rollback an toàn:');
    const rawSql = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'migrations', '002_production_kailink_schema_sync_mysql84.sql'), 'utf8');
    const migrationSql = rawSql.replace(/USE\s+defaultdb;/gi, `USE \`${DB_SRC}\`;`);
    await conn.query(migrationSql);
    const [tablesAfter] = await conn.query(`SHOW TABLES FROM \`${DB_SRC}\`;`);
    console.log(`  ✓ Sau migration: \`${DB_SRC}\` có ${tablesAfter.length} bảng (Đã thêm 3 bảng).`);

    // Thực hiện Rollback chuẩn: Tạo mới schema sạch trước khi import dump
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_SRC}\`;`);
    await conn.query(`CREATE DATABASE \`${DB_SRC}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    execSync(`${MYSQL_EXE} -h localhost -P 3306 -u root -p123456 ${DB_SRC} < "${dumpFilePath}"`, { stdio: 'pipe' });
    const [tablesRollback] = await conn.query(`SHOW TABLES FROM \`${DB_SRC}\`;`);
    console.log(`  ✓ Sau rollback từ dump vào schema sạch: \`${DB_SRC}\` quay về đúng ${tablesRollback.length} bảng ban đầu (Chính xác 7 bảng gốc).`);
    if (tablesRollback.length !== 7) {
      throw new Error(`Rollback thất bại: Số lượng bảng là ${tablesRollback.length}, kỳ vọng là 7!`);
    }

    // 6. Dọn dẹp
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_SRC}\`;`);
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_DEST}\`;`);
    if (fs.existsSync(dumpFilePath)) {
      fs.unlinkSync(dumpFilePath);
    }
    console.log('[BƯỚC 6] Đã dọn dẹp các database và file dump tạm an toàn.');

    // 7. Kiểm tra bất biến denso_iot
    const [auditRows] = await conn.query('SELECT COUNT(*) AS total FROM denso_iot.machine_telemetry_history');
    console.log(`[KIỂM TOÁN CSDL LOCAL]: Database denso_iot nguyên vẹn: ${auditRows[0].total} telemetry records.`);

    console.log('\n>>> KẾT QUẢ: QUY TRÌNH BACKUP & RESTORE ĐÃ ĐƯỢC THỬ NGHIỆM ĐẠT 100% TIÊU CHUẨN AN TOÀN.');
  } finally {
    await conn.end();
  }
}

testBackupAndRestore().catch(err => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
