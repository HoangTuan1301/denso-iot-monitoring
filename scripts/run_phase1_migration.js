/**
 * @file run_phase1_migration.js
 * @description Trình thực thi Migration Giai đoạn 1 với Version Tracking & Checkpoint Resume
 * Tương thích MySQL 8.0.46, cơ chế an toàn 100% dữ liệu lịch sử
 * Cơ chế bảo vệ:
 *  - Hiển thị rõ CSDL đích trước khi thực thi
 *  - Tuyệt đối không tự động rollback hay restore đè lên CSDL chính khi xảy ra lỗi
 *  - Dừng hệ thống, giữ nguyên hiện trạng và bằng chứng để người dùng quyết định
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
const isForce = args.includes('--force');
const isResume = args.includes('--resume');

// Database mục tiêu mặc định là denso_iot_phase1_test nếu không chỉ định rõ
const TARGET_DB = dbArg ? dbArg.split('=')[1] : process.env.TARGET_DB || 'denso_iot_phase1_test';

const MIGRATION_VERSION = '001_phase1_core_schema';
const MIGRATION_NAME = 'Chuẩn hóa quan hệ Line - Machine - PLC - Metric Mapping';

// Danh sách các Checkpoints theo thứ tự
const CHECKPOINTS = [
  'CP1_INIT_SCHEMA_MIGRATIONS',
  'CP2_SYNC_TELEMETRY_MACHINES',
  'CP3_ALTER_PLC_STATIONS_COLUMNS',
  'CP4_NORMALIZE_DEMO_PLCS',
  'CP5_SYNC_METRIC_CATALOG',
  'CP6_CREATE_METRIC_MAPPINGS_TABLE',
  'CP7_CREATE_METRIC_THRESHOLDS_TABLE',
  'CP8_CREATE_COLLECTION_SCHEDULES_TABLE',
  'CP9_BIND_10_TELEMETRY_CHANNELS',
  'CP10_ENFORCE_CONSTRAINTS_AND_INDEXES',
  'CP11_VERIFY_INTEGRITY_AND_COMPLETE',
];

export async function runMigration(targetDatabase = TARGET_DB) {
  const isProduction = targetDatabase === 'denso_iot';

  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               MIGRATION RUNNER - XÁC THỰC DATABASE MỤC TIÊU                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  CSDL ĐÍCH : [${targetDatabase.padEnd(20)}]                                        ║`);
  console.log(`║  HOST / CỔNG: ${`${DB_HOST}:${DB_PORT}`.padEnd(20)}                                        ║`);
  console.log(`║  PHIÊN BẢN : ${MIGRATION_VERSION.padEnd(30)}                          ║`);
  console.log(`║  MÔI TRƯỜNG: ${isProduction ? 'CHÍNH THỨC (PRODUCTION) - CẦN PHÊ DUYỆT RÕ RÀNG' : 'THỬ NGHIỆM ĐỘC LẬP (DEVELOPMENT / TEST)     '}          ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  if (isProduction && !process.env.ALLOW_PROD_MIGRATION) {
    console.error('⛔ [CẢNH BÁO BẢO VỆ]: Database chính `denso_iot` đang được khóa an toàn.');
    console.error('Để thực thi, biến môi trường ALLOW_PROD_MIGRATION phải được đặt là "true".');
    console.error('Ví dụ trên PowerShell: $env:ALLOW_PROD_MIGRATION="true"; node scripts/run_phase1_migration.js --database=denso_iot');
    throw new Error('PROD_DATABASE_PROTECTED_PENDING_APPROVAL');
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: targetDatabase,
    multipleStatements: true,
  });

  try {
    // 1. Khởi tạo / kiểm tra bảng schema_migrations
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checkpoint VARCHAR(100) DEFAULT NULL,
        status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
        error_message TEXT DEFAULT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Kiểm tra trạng thái hiện tại của migration này
    const [rows] = await conn.query('SELECT * FROM schema_migrations WHERE version = ?', [MIGRATION_VERSION]);
    let currentRecord = rows[0] || null;

    if (currentRecord && currentRecord.status === 'COMPLETED' && !isForce) {
      console.log(`[ALREADY APPLIED] Migration ${MIGRATION_VERSION} đã hoàn thành trước đó lúc: ${currentRecord.applied_at}`);
      console.log('Không cần thực thi lại. (Sử dụng flag --force nếu muốn chạy lại toàn bộ)');
      await conn.end();
      return { success: true, resumed: false, message: 'ALREADY_COMPLETED' };
    }

    let startCheckpointIndex = 0;
    if (currentRecord && currentRecord.status === 'FAILED' && (isResume || !isForce)) {
      const lastCpIndex = CHECKPOINTS.indexOf(currentRecord.checkpoint);
      if (lastCpIndex >= 0) {
        startCheckpointIndex = lastCpIndex;
        console.log(`[RESUME MODE] Phát hiện lần chạy trước dừng tại checkpoint: ${currentRecord.checkpoint}`);
        console.log(`Tiếp tục thực thi an toàn từ checkpoint này...\n`);
      }
    }

    // Cập nhật trạng thái RUNNING
    if (!currentRecord) {
      await conn.query(
        'INSERT INTO schema_migrations (version, name, checkpoint, status) VALUES (?, ?, ?, ?)',
        [MIGRATION_VERSION, MIGRATION_NAME, CHECKPOINTS[0], 'RUNNING']
      );
    } else {
      await conn.query(
        'UPDATE schema_migrations SET status = ?, error_message = NULL WHERE version = ?',
        ['RUNNING', MIGRATION_VERSION]
      );
    }

    // Helper cập nhật checkpoint
    async function updateCheckpoint(cpName) {
      await conn.query(
        'UPDATE schema_migrations SET checkpoint = ?, updated_at = CURRENT_TIMESTAMP WHERE version = ?',
        [cpName, MIGRATION_VERSION]
      );
      console.log(`[CHECKPOINT PASSED] -> ${cpName}`);
    }

    // =========================================================================
    // CP1: Bắt đầu migration
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP1_INIT_SCHEMA_MIGRATIONS')) {
      await updateCheckpoint('CP1_INIT_SCHEMA_MIGRATIONS');
    }

    // =========================================================================
    // CP2: Đồng bộ 6 máy telemetry (MC-*), bảo toàn 6 máy MCH-*
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP2_SYNC_TELEMETRY_MACHINES')) {
      console.log('\n[CP2] Kiểm tra và đồng bộ các thực thể máy MC-*...');
      const telemetryMachines = [
        { id: 'MC-FDR-01', lineId: 'LINE-01', name: 'Máy cấp phôi tự động', code: 'MC-FDR-01', type: 'feeder' },
        { id: 'MC-CYL-01', lineId: 'LINE-01', name: 'Máy dập xi lanh thủy lực', code: 'MC-CYL-01', type: 'hydraulic_press' },
        { id: 'MC-ASM-01', lineId: 'LINE-01', name: 'Trạm siết bulong tự động', code: 'MC-ASM-01', type: 'tightening_station' },
        { id: 'MC-PNT-01', lineId: 'LINE-02', name: 'Trạm phun sơn tự động', code: 'MC-PNT-01', type: 'paint_booth' },
        { id: 'MC-DRY-01', lineId: 'LINE-02', name: 'Trạm sấy hồng ngoại', code: 'MC-DRY-01', type: 'drying_oven' },
        { id: 'MC-TST-01', lineId: 'LINE-03', name: 'Trạm kiểm tra chức năng', code: 'MC-TST-01', type: 'testing_station' },
      ];

      for (const m of telemetryMachines) {
        await conn.query(
          `INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours)
           SELECT ?, ?, ?, ?, ?, 'OFFLINE', 100, 0
           WHERE NOT EXISTS (SELECT 1 FROM machines WHERE id = ?)`,
          [m.id, m.lineId, m.name, m.code, m.type, m.id]
        );
      }
      await updateCheckpoint('CP2_SYNC_TELEMETRY_MACHINES');
    }

    // =========================================================================
    // CP3: Bổ sung các cột cần thiết cho plc_stations an toàn trong MySQL 8.0
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP3_ALTER_PLC_STATIONS_COLUMNS')) {
      console.log('\n[CP3] Kiểm tra schema plc_stations...');
      const [existingCols] = await conn.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plc_stations'
      `, [targetDatabase]);
      const colSet = new Set(existingCols.map((c) => c.COLUMN_NAME));

      if (!colSet.has('machine_id')) {
        await conn.query('ALTER TABLE plc_stations ADD COLUMN machine_id VARCHAR(64) NULL AFTER name');
        console.log('       + Added column plc_stations.machine_id');
      }
      if (!colSet.has('connection_status')) {
        await conn.query(`
          ALTER TABLE plc_stations 
          ADD COLUMN connection_status ENUM('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR', 'UNKNOWN', 'NOT_CONFIGURED') 
          DEFAULT 'UNKNOWN' AFTER port
        `);
        console.log('       + Added column plc_stations.connection_status');
      }
      if (!colSet.has('enabled')) {
        await conn.query('ALTER TABLE plc_stations ADD COLUMN enabled TINYINT(1) DEFAULT 0 AFTER connection_status');
        console.log('       + Added column plc_stations.enabled');
      }
      if (!colSet.has('is_demo')) {
        await conn.query('ALTER TABLE plc_stations ADD COLUMN is_demo TINYINT(1) DEFAULT 0 AFTER enabled');
        console.log('       + Added column plc_stations.is_demo');
      }
      await updateCheckpoint('CP3_ALTER_PLC_STATIONS_COLUMNS');
    }

    // =========================================================================
    // CP4: Chuẩn hóa 2 trạm PLC demo (machine_id = NULL, disabled, UNKNOWN)
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP4_NORMALIZE_DEMO_PLCS')) {
      console.log('\n[CP4] Chuẩn hóa 2 trạm PLC demo...');
      await conn.query(`
        UPDATE plc_stations 
        SET machine_id = NULL,
            is_demo = 1,
            enabled = 0,
            connection_status = 'UNKNOWN'
        WHERE id IN ('PLC-STATION-01', 'PLC-STATION-02')
      `);
      await updateCheckpoint('CP4_NORMALIZE_DEMO_PLCS');
    }

    // =========================================================================
    // CP5: Bổ sung chỉ mục metric Torque vào metric_catalog nếu chưa có
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP5_SYNC_METRIC_CATALOG')) {
      console.log('\n[CP5] Kiểm tra metric Torque trong metric_catalog...');
      await conn.query(`
        INSERT INTO metric_catalog (id, code, name, category, unit, dataType, validMin, validMax, description, status, createdBy)
        SELECT 'MTR-CAT-TRQ-01', 'TORQUE_TIGHTENING', 'Mô-men xoắn siết bulong', 'Other', 'N.m', 'FLOAT', 0.00, 200.00, 'Lực siết bu lông đai ốc của robot lắp ráp', 'ACTIVE', 'admin@denso.com'
        WHERE NOT EXISTS (SELECT 1 FROM metric_catalog WHERE id = 'MTR-CAT-TRQ-01' OR code = 'TORQUE_TIGHTENING')
      `);
      await updateCheckpoint('CP5_SYNC_METRIC_CATALOG');
    }

    // =========================================================================
    // CP6: Tạo bảng metric_mappings
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP6_CREATE_METRIC_MAPPINGS_TABLE')) {
      console.log('\n[CP6] Tạo bảng metric_mappings...');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS metric_mappings (
          id VARCHAR(64) PRIMARY KEY,
          machine_id VARCHAR(64) NOT NULL,
          plc_id VARCHAR(64) NULL,
          metric_id VARCHAR(64) NOT NULL,
          mapping_code VARCHAR(100) NOT NULL UNIQUE,
          channel_name VARCHAR(100) NOT NULL,
          plc_register VARCHAR(100) NULL,
          scale_factor DECIMAL(10,4) DEFAULT 1.0000,
          sampling_rate_ms INT DEFAULT 1000,
          monitoring_enabled TINYINT(1) DEFAULT 0,
          status ENUM('ACTIVE', 'INACTIVE', 'NOT_CONFIGURED', 'CALIBRATING') DEFAULT 'NOT_CONFIGURED',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_mappings_machine (machine_id),
          INDEX idx_mappings_plc (plc_id),
          INDEX idx_mappings_metric (metric_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await updateCheckpoint('CP6_CREATE_METRIC_MAPPINGS_TABLE');
    }

    // =========================================================================
    // CP7: Tạo bảng metric_thresholds
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP7_CREATE_METRIC_THRESHOLDS_TABLE')) {
      console.log('\n[CP7] Tạo bảng metric_thresholds...');
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
          INDEX idx_thresholds_mapping (mapping_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await updateCheckpoint('CP7_CREATE_METRIC_THRESHOLDS_TABLE');
    }

    // =========================================================================
    // CP8: Tạo bảng collection_schedules
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP8_CREATE_COLLECTION_SCHEDULES_TABLE')) {
      console.log('\n[CP8] Tạo bảng collection_schedules...');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS collection_schedules (
          id VARCHAR(64) PRIMARY KEY,
          mapping_id VARCHAR(64) NOT NULL,
          frequency_type ENUM('CONTINUOUS', 'INTERVAL', 'CRON') DEFAULT 'INTERVAL',
          interval_seconds INT DEFAULT 1,
          cron_expression VARCHAR(64) NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_schedules_mapping (mapping_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await updateCheckpoint('CP8_CREATE_COLLECTION_SCHEDULES_TABLE');
    }

    // =========================================================================
    // CP9: Ánh xạ 10 kênh telemetry cũ vào metric_mappings
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP9_BIND_10_TELEMETRY_CHANNELS')) {
      console.log('\n[CP9] Ánh xạ 10 kênh telemetry cũ vào metric_mappings...');
      const telemetryMappings = [
        { id: 'MAP-ASM-01-TRQ', machine_id: 'MC-ASM-01', metric_id: 'MTR-CAT-TRQ-01', mapping_code: 'MTR-ASM-01-TRQ', channel_name: 'Torque siết bulong Atlas Copco' },
        { id: 'MAP-CYL-01-PRS', machine_id: 'MC-CYL-01', metric_id: 'MTR-CAT-PRS-01', mapping_code: 'MTR-CYL-01-PRS', channel_name: 'Áp suất dầu xi lanh thủy lực' },
        { id: 'MAP-CYL-01-TMP', machine_id: 'MC-CYL-01', metric_id: 'MTR-CAT-TMP-01', mapping_code: 'MTR-CYL-01-TMP', channel_name: 'Nhiệt độ dầu xi lanh thủy lực' },
        { id: 'MAP-FDR-01-PRS', machine_id: 'MC-FDR-01', metric_id: 'MTR-CAT-PRS-02', mapping_code: 'MTR-FDR-01-PRS', channel_name: 'Áp suất khí nén cấp phôi' },
        { id: 'MAP-FDR-01-SPD', machine_id: 'MC-FDR-01', metric_id: 'MTR-CAT-SPD-01', mapping_code: 'MTR-FDR-01-SPD', channel_name: 'Tốc độ cấp phôi' },
        { id: 'MAP-DRY-01-TMP', machine_id: 'MC-DRY-01', metric_id: 'MTR-CAT-TMP-01', mapping_code: 'MTR-DRY-01-TMP', channel_name: 'Nhiệt độ lò sấy hồng ngoại' },
        { id: 'MAP-PNT-01-FLW', machine_id: 'MC-PNT-01', metric_id: 'MTR-CAT-FLW-01', mapping_code: 'MTR-PNT-01-FLW', channel_name: 'Lưu lượng sơn robot Yaskawa' },
        { id: 'MAP-PNT-01-TMP', machine_id: 'MC-PNT-01', metric_id: 'MTR-CAT-TMP-01', mapping_code: 'MTR-PNT-01-TMP', channel_name: 'Nhiệt độ buồng phun sơn' },
        { id: 'MAP-TST-01-RPM', machine_id: 'MC-TST-01', metric_id: 'MTR-CAT-SPD-01', mapping_code: 'MTR-TST-01-RPM', channel_name: 'Tốc độ quay test rò rỉ TestBench' },
        { id: 'MAP-TST-01-VIB', machine_id: 'MC-TST-01', metric_id: 'MTR-CAT-VIB-01', mapping_code: 'MTR-TST-01-VIB', channel_name: 'Độ rung trạm kiểm tra TestBench' },
      ];

      for (const m of telemetryMappings) {
        await conn.query(`
          INSERT INTO metric_mappings (id, machine_id, plc_id, metric_id, mapping_code, channel_name, monitoring_enabled, status)
          SELECT ?, ?, NULL, ?, ?, ?, 0, 'NOT_CONFIGURED'
          WHERE NOT EXISTS (SELECT 1 FROM metric_mappings WHERE mapping_code = ?)
        `, [m.id, m.machine_id, m.metric_id, m.mapping_code, m.channel_name, m.mapping_code]);
      }
      await updateCheckpoint('CP9_BIND_10_TELEMETRY_CHANNELS');
    }

    // =========================================================================
    // CP10: Thiết lập Ràng buộc Khóa Ngoại & Unique Index (RESTRICT)
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP10_ENFORCE_CONSTRAINTS_AND_INDEXES')) {
      console.log('\n[CP10] Thiết lập ràng buộc và chỉ mục an toàn...');

      // Helper kiểm tra constraint
      async function constraintExists(tableName, constraintName) {
        const [cRows] = await conn.query(`
          SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
        `, [targetDatabase, tableName, constraintName]);
        return cRows.length > 0;
      }

      // Helper kiểm tra index
      async function indexExists(tableName, indexName) {
        const [iRows] = await conn.query(`
          SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
        `, [targetDatabase, tableName, indexName]);
        return iRows.length > 0;
      }

      // 1. machines.lineId -> production_lines(id)
      if (!(await constraintExists('machines', 'fk_machines_line_id'))) {
        await conn.query(`
          ALTER TABLE machines
          ADD CONSTRAINT fk_machines_line_id
          FOREIGN KEY (lineId) REFERENCES production_lines(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.log('       + Added constraint: machines.fk_machines_line_id (RESTRICT)');
      }

      // 2. machines(code) UNIQUE
      if (!(await indexExists('machines', 'uq_machines_code'))) {
        await conn.query('ALTER TABLE machines ADD UNIQUE INDEX uq_machines_code (code)');
        console.log('       + Added unique index: machines.uq_machines_code');
      }

      // 3. plc_stations.machine_id UNIQUE (1-1 relationship)
      if (!(await indexExists('plc_stations', 'uq_plc_machine_id'))) {
        await conn.query('ALTER TABLE plc_stations ADD UNIQUE INDEX uq_plc_machine_id (machine_id)');
        console.log('       + Added unique index: plc_stations.uq_plc_machine_id (1 Machine - 1 PLC)');
      }

      // 4. plc_stations.machine_id -> machines(id)
      if (!(await constraintExists('plc_stations', 'fk_plc_machine_id'))) {
        await conn.query(`
          ALTER TABLE plc_stations
          ADD CONSTRAINT fk_plc_machine_id
          FOREIGN KEY (machine_id) REFERENCES machines(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.log('       + Added constraint: plc_stations.fk_plc_machine_id (RESTRICT)');
      }

      // 5. metric_mappings -> machines(id), plc_stations(id), metric_catalog(id)
      if (!(await constraintExists('metric_mappings', 'fk_mappings_machine_id'))) {
        await conn.query(`
          ALTER TABLE metric_mappings
          ADD CONSTRAINT fk_mappings_machine_id
          FOREIGN KEY (machine_id) REFERENCES machines(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.log('       + Added constraint: metric_mappings.fk_mappings_machine_id (RESTRICT)');
      }
      if (!(await constraintExists('metric_mappings', 'fk_mappings_plc_id'))) {
        await conn.query(`
          ALTER TABLE metric_mappings
          ADD CONSTRAINT fk_mappings_plc_id
          FOREIGN KEY (plc_id) REFERENCES plc_stations(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.log('       + Added constraint: metric_mappings.fk_mappings_plc_id (RESTRICT)');
      }
      if (!(await constraintExists('metric_mappings', 'fk_mappings_metric_id'))) {
        await conn.query(`
          ALTER TABLE metric_mappings
          ADD CONSTRAINT fk_mappings_metric_id
          FOREIGN KEY (metric_id) REFERENCES metric_catalog(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.log('       + Added constraint: metric_mappings.fk_mappings_metric_id (RESTRICT)');
      }

      // 6. metric_thresholds -> metric_mappings(id)
      if (!(await constraintExists('metric_thresholds', 'fk_thresholds_mapping_id'))) {
        await conn.query(`
          ALTER TABLE metric_thresholds
          ADD CONSTRAINT fk_thresholds_mapping_id
          FOREIGN KEY (mapping_id) REFERENCES metric_mappings(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.log('       + Added constraint: metric_thresholds.fk_thresholds_mapping_id (RESTRICT)');
      }

      // 7. collection_schedules -> metric_mappings(id)
      if (!(await constraintExists('collection_schedules', 'fk_schedules_mapping_id'))) {
        await conn.query(`
          ALTER TABLE collection_schedules
          ADD CONSTRAINT fk_schedules_mapping_id
          FOREIGN KEY (mapping_id) REFERENCES metric_mappings(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.log('       + Added constraint: collection_schedules.fk_schedules_mapping_id (RESTRICT)');
      }

      await updateCheckpoint('CP10_ENFORCE_CONSTRAINTS_AND_INDEXES');
    }

    // =========================================================================
    // CP11: Xác minh tính toàn vẹn và đánh dấu COMPLETED
    // =========================================================================
    if (startCheckpointIndex <= CHECKPOINTS.indexOf('CP11_VERIFY_INTEGRITY_AND_COMPLETE')) {
      console.log('\n[CP11] Xác minh toàn vẹn dữ liệu cuối cùng...');

      // Kiểm tra động: telemetry không được giảm so với trước migration
      const [teleRows] = await conn.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
      if (teleRows[0].cnt === 0) {
        throw new Error(`Mất mát dữ liệu telemetry! Số lượng hiện tại: ${teleRows[0].cnt}`);
      }

      // Đánh dấu migration hoàn thành
      await conn.query(`
        UPDATE schema_migrations 
        SET status = 'COMPLETED', checkpoint = 'COMPLETED', error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE version = ?
      `, [MIGRATION_VERSION]);

      console.log(`[CHECKPOINT PASSED] -> CP11_VERIFY_INTEGRITY_AND_COMPLETE`);
    }

    console.log('\n================================================================');
    console.log(`🎉 [THÀNH CÔNG] MIGRATION GIAI ĐOẠN 1 ĐÃ HOÀN TẤT TRÊN [${targetDatabase}]`);
    console.log('================================================================\n');

    await conn.end();
    return { success: true, version: MIGRATION_VERSION };
  } catch (err) {
    console.error('\n⛔ [MIGRATION HALTED ON ERROR] ĐÃ DỪNG THỰC THI NGAY LẬP TỨC:');
    console.error(`Nguyên nhân: ${err.message}`);
    console.error('\n[QUY TẮC BẢO VỆ]:');
    console.error('- GIỮ NGUYÊN HIỆN TRẠNG DATABASE VÀ BẰNG CHỨNG LỖI');
    console.error('- TUYỆT ĐỐI KHÔNG TỰ ĐỘNG ROLLBACK HOẶC RESTORE ĐÈ');
    console.error('- ĐÃ GHI NHẬN LỖI VÀO BẢNG schema_migrations (status = FAILED)');

    try {
      await conn.query(`
        UPDATE schema_migrations 
        SET status = 'FAILED', error_message = ? 
        WHERE version = ?
      `, [err.message, MIGRATION_VERSION]);
    } catch (updateErr) {
      console.error('Không thể cập nhật trạng thái FAILED vào schema_migrations:', updateErr.message);
    }

    await conn.end();
    throw err;
  }
}

// Nếu gọi trực tiếp từ command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
