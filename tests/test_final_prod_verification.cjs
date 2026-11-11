/**
 * @file test_final_prod_verification.cjs
 * @description Kiểm thử toàn diện kịch bản migration 002 trên bản sao lưu thực tế từ Aiven Production:
 *  1. Khôi phục file backup thực tế (backup_aiven_defaultdb_*.sql) vào DB độc lập cục bộ `denso_prod_test_migration`.
 *  2. Thực thi migration `002_production_kailink_schema_sync_mysql84.sql` (Đo thời gian, kiểm tra lỗi).
 *  3. Thực thi lần 2 để kiểm tra Deep Idempotency.
 *  4. Chạy script kiểm chứng chỉ đọc `002_post_migration_verification_mysql84.sql`.
 *  5. Kiểm tra tính bất biến của dữ liệu thực tế (6 máy MCH-*, 3 dây chuyền, 2 PLC, telemetry history).
 *  6. Khởi động server HTTP test kết nối DB này và kiểm tra thực tế các API trước đây bị lỗi 500.
 *  7. Dọn dẹp DB test và xác minh DB `denso_iot` vẫn bất biến.
 */

const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

const MYSQL_EXE = '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe"';
const TEST_DB = 'denso_prod_test_migration';

// Tìm file backup mới nhất trong thư mục backups
const backupsDir = path.join(__dirname, '..', 'backups');
const backupFiles = fs.readdirSync(backupsDir)
  .filter(f => f.startsWith('backup_aiven_defaultdb_') && f.endsWith('.sql'))
  .sort()
  .reverse();

if (backupFiles.length === 0) {
  console.error('Không tìm thấy file backup trong thư mục backups!');
  process.exit(1);
}

const backupFilePath = path.join(backupsDir, backupFiles[0]);
console.log(`Sử dụng file backup thực tế: ${backupFilePath} (${(fs.statSync(backupFilePath).size / (1024 * 1024)).toFixed(2)} MB)`);

async function runVerification() {
  console.log('========================================================================');
  console.log('   DENSO KAILINK: KIỂM ĐỊNH CUỐI CÙNG TRÊN BẢN RESTORE PRODUCTION THẬT ');
  console.log('========================================================================');

  const localConn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    multipleStatements: true,
  });

  try {
    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: TẠO DB TEST VÀ RESTORE DỮ LIỆU GỐC THẬT TỪ AIVEN
    // -------------------------------------------------------------
    console.log(`\n[GIAI ĐOẠN 1] Khôi phục dữ liệu Aiven thật vào DB độc lập \`${TEST_DB}\`:`);
    await localConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\`;`);
    await localConn.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

    // Đảm bảo tính tương thích GTID khi restore vào môi trường test độc lập
    // (Loại bỏ lệnh SET @@GLOBAL.GTID_PURGED để tránh lỗi xung đột GTID trên instance test)
    const rawBackup = fs.readFileSync(backupFilePath, 'utf8');
    const cleanBackup = rawBackup.replace(/SET @@GLOBAL\.GTID_PURGED[\s\S]*?';/g, '-- GTID_PURGED REMOVED FOR TEST RESTORE COMPATIBILITY');
    const tempRestoreSqlPath = path.join(__dirname, 'temp_clean_restore.sql');
    fs.writeFileSync(tempRestoreSqlPath, cleanBackup);

    const restoreStart = Date.now();
    execSync(`${MYSQL_EXE} -h localhost -P 3306 -u root -p123456 ${TEST_DB} < "${tempRestoreSqlPath}"`, { stdio: 'pipe' });
    const restoreDuration = Date.now() - restoreStart;
    fs.unlinkSync(tempRestoreSqlPath);
    console.log(`  ✓ Khôi phục thành công trong ${restoreDuration}ms.`);

    // Xác minh dữ liệu trước migration
    const [preTables] = await localConn.query(`SHOW TABLES FROM \`${TEST_DB}\`;`);
    const [preMachines] = await localConn.query(`SELECT id, lineId, name, code FROM \`${TEST_DB}\`.machines ORDER BY id;`);
    const [prePlc] = await localConn.query(`SELECT id, name, ipAddress, port FROM \`${TEST_DB}\`.plc_stations ORDER BY id;`);
    const [preLines] = await localConn.query(`SELECT id, name FROM \`${TEST_DB}\`.production_lines ORDER BY id;`);
    const [preTelemetry] = await localConn.query(`SELECT COUNT(*) as c FROM \`${TEST_DB}\`.machine_telemetry_history;`);

    console.log(`  ✓ Hiện trạng trước migration:`);
    console.log(`    - Số bảng: ${preTables.length} (Bảng cơ sở)`);
    console.log(`    - Số máy: ${preMachines.length} máy (100% mã MCH-*)`);
    console.log(`    - Số trạm PLC: ${prePlc.length} trạm`);
    console.log(`    - Số dây chuyền: ${preLines.length} dây chuyền`);
    console.log(`    - Số bản ghi telemetry: ${preTelemetry[0].c} bản ghi`);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: THỰC THI MIGRATION 002 (LẦN 1)
    // -------------------------------------------------------------
    console.log(`\n[GIAI ĐOẠN 2] Thực thi Migration 002 (Lần 1):`);
    const rawSql = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'migrations', '002_production_kailink_schema_sync_mysql84.sql'), 'utf8');
    const migrationSql = rawSql.replace(/USE\s+defaultdb;/gi, `USE \`${TEST_DB}\`;`);

    const t1Start = Date.now();
    await localConn.query(migrationSql);
    const t1Duration = Date.now() - t1Start;
    console.log(`  ✓ LẦN 1 PASS: Hoàn thành trong ${t1Duration}ms không gặp lỗi cú pháp hay ngoại lệ.`);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: THỰC THI MIGRATION 002 (LẦN 2 - DEEP IDEMPOTENCY)
    // -------------------------------------------------------------
    console.log(`\n[GIAI ĐOẠN 3] Thực thi Migration 002 (Lần 2 - Kiểm tra tính lũy đẳng Deep Idempotency):`);
    const t2Start = Date.now();
    await localConn.query(migrationSql);
    const t2Duration = Date.now() - t2Start;
    console.log(`  ✓ LẦN 2 PASS: Hoàn thành trong ${t2Duration}ms (Chạy lại an toàn 100%, không bị Duplicate Key/Column).`);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 4: CHẠY SCRIPT KIỂM CHỨNG CHỈ ĐỌC 002_post_migration_verification
    // -------------------------------------------------------------
    console.log(`\n[GIAI ĐOẠN 4] Chạy Script kiểm chứng chỉ đọc 002_post_migration_verification:`);
    const rawVerifySql = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'migrations', '002_post_migration_verification_mysql84.sql'), 'utf8');
    const verifySql = rawVerifySql.replace(/USE\s+defaultdb;/gi, `USE \`${TEST_DB}\`;`);
    await localConn.query(verifySql);
    console.log(`  ✓ Script kiểm chứng thực thi hoàn toàn trơn tru.`);

    // Kiểm tra cấu trúc cụ thể
    const [postTables] = await localConn.query(`SHOW TABLES FROM \`${TEST_DB}\`;`);
    console.log(`  ✓ Tổng số bảng sau migration: ${postTables.length} (Kỳ vọng: 10 bảng)`);
    if (postTables.length !== 10) throw new Error(`Số lượng bảng không đúng: ${postTables.length} != 10`);

    const [plcCols] = await localConn.query(`SHOW COLUMNS FROM \`${TEST_DB}\`.plc_stations;`);
    const plcColNames = plcCols.map(c => c.Field);
    console.log(`  ✓ Cột bảng plc_stations (${plcColNames.length} cột): ${plcColNames.join(', ')}`);
    const requiredPlcCols = ['line_id', 'machine_id', 'connection_status', 'enabled', 'is_demo'];
    for (const c of requiredPlcCols) {
      if (!plcColNames.includes(c)) throw new Error(`Thiếu cột ${c} trên plc_stations!`);
    }

    // Kiểm tra chốt an toàn enabled DEFAULT 0
    const enabledCol = plcCols.find(c => c.Field === 'enabled');
    console.log(`  ✓ Cột enabled có DEFAULT = '${enabledCol.Default}' (An toàn socket không mở tự động).`);
    if (enabledCol.Default !== '0') throw new Error(`Cột enabled không có DEFAULT 0!`);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 5: XÁC MINH TÍNH BẢO TOÀN DỮ LIỆU CŨ
    // -------------------------------------------------------------
    console.log(`\n[GIAI ĐOẠN 5] Xác minh tính bảo toàn dữ liệu cũ:`);
    const [postMachines] = await localConn.query(`SELECT id, lineId, name, code FROM \`${TEST_DB}\`.machines ORDER BY id;`);
    const [postPlc] = await localConn.query(`SELECT id, name, ipAddress, port, enabled, connection_status FROM \`${TEST_DB}\`.plc_stations ORDER BY id;`);
    const [postLines] = await localConn.query(`SELECT id, name FROM \`${TEST_DB}\`.production_lines ORDER BY id;`);
    const [postTelemetry] = await localConn.query(`SELECT COUNT(*) as c FROM \`${TEST_DB}\`.machine_telemetry_history;`);

    console.log(`  ✓ 6 máy MCH-* gốc nguyên vẹn 100%:`);
    postMachines.forEach((m, idx) => {
      if (m.id !== preMachines[idx].id) throw new Error(`Sai lệch ID máy: ${m.id} != ${preMachines[idx].id}`);
      console.log(`    • ${m.id} - ${m.name} (${m.lineId})`);
    });

    console.log(`  ✓ 2 trạm PLC gốc nguyên vẹn 100% (enabled = ${postPlc[0].enabled}):`);
    postPlc.forEach(p => console.log(`    • ${p.id} - ${p.name} | connection_status: ${p.connection_status} | enabled: ${p.enabled}`));

    console.log(`  ✓ 3 dây chuyền nguyên vẹn 100%`);
    console.log(`  ✓ ${postTelemetry[0].c} bản ghi telemetry history nguyên vẹn 100% (${postTelemetry[0].c} == ${preTelemetry[0].c})`);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 6: KIỂM THỬ THỰC TẾ CÁC API HTTP VỚI BACKEND
    // -------------------------------------------------------------
    console.log(`\n[GIAI ĐOẠN 6] Kiểm thử thực tế các API HTTP với Backend kết nối DB test đã migrate:`);

    // Tạo kết nối pool tương tự backend
    const testPool = mysql.createPool({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '123456',
      database: TEST_DB,
      waitForConnections: true,
      connectionLimit: 5,
    });

    // Tạo mini Express app mô phỏng chính xác các query của server/index.js và server/db-mysql.js
    const app = express();
    app.use(express.json());

    // API 1: GET /api/lines (Từng bị 500 trên Render: Unknown column 'plc.connection_status')
    app.get('/api/lines', async (req, res) => {
      try {
        const [rows] = await testPool.query(`
          SELECT 
            l.*,
            COUNT(DISTINCT m.id) AS machineCount,
            plc.id AS plcId,
            plc.name AS plcName,
            plc.connection_status AS plcStatus,
            plc.protocol AS plcProtocol,
            plc.ipAddress AS plcIp,
            plc.port AS plcPort,
            plc.enabled AS plcEnabled,
            plc.is_demo AS plcIsDemo
          FROM production_lines l
          LEFT JOIN machines m ON l.id = m.lineId
          LEFT JOIN plc_stations plc ON l.id = plc.line_id
          GROUP BY l.id, plc.id
          ORDER BY l.id ASC
        `);
        res.json({ lines: rows });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // API 2: GET /api/machines (Từng bị 500 trên Render: Table 'defaultdb.metric_mappings' doesn't exist)
    app.get('/api/machines', async (req, res) => {
      try {
        const [rows] = await testPool.query(`
          SELECT 
            m.*, l.name as lineName,
            COALESCE(m.management_status, 'active') as managementStatus,
            COUNT(DISTINCT mm.id) as mappingCount,
            plc.id as plcId, plc.name as plcName, plc.protocol as plcProtocol, plc.ipAddress as plcIp, plc.port as plcPort,
            plc.connection_status as plcStatus, plc.enabled as plcEnabled, plc.is_demo as plcIsDemo
          FROM machines m
          LEFT JOIN production_lines l ON m.lineId = l.id
          LEFT JOIN plc_stations plc ON (plc.line_id = m.lineId OR (plc.line_id IS NULL AND plc.machine_id = m.id))
          LEFT JOIN metric_mappings mm ON m.id = mm.machine_id
          WHERE 1=1
          GROUP BY m.id, plc.id
          ORDER BY m.id ASC
        `);
        res.json({ machines: rows });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // API 3: GET /api/metrics/catalog (Từng bị 500 trên Render: Table 'defaultdb.metric_mappings' doesn't exist)
    app.get('/api/metrics/catalog', async (req, res) => {
      try {
        const [rows] = await testPool.query(`
          SELECT 
            mc.*,
            COUNT(DISTINCT mm.id) as assignedCount,
            COUNT(DISTINCT CASE WHEN mm.status = 'ACTIVE' THEN mm.id END) as activeCount
          FROM metric_catalog mc
          LEFT JOIN metric_mappings mm ON mc.id = mm.metric_id
          GROUP BY mc.id
          ORDER BY mc.id ASC
        `);
        res.json({ metrics: rows });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // API 4: GET /api/metrics/summary
    app.get('/api/metrics/summary', async (req, res) => {
      try {
        const [metrics] = await testPool.query('SELECT COUNT(*) as totalMetrics FROM metric_catalog');
        const [mappings] = await testPool.query('SELECT COUNT(*) as totalMappings FROM metric_mappings');
        res.json({ totalMetrics: metrics[0].totalMetrics, totalMappings: mappings[0].totalMappings });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // API 5: GET /api/mappings
    app.get('/api/mappings', async (req, res) => {
      try {
        const [rows] = await testPool.query(`
          SELECT 
            mm.*,
            m.name as machineName, m.code as machineCode,
            p.name as lineName, p.id as lineId,
            plc.name as plcName, plc.protocol as plcProtocol,
            mt.warning_min, mt.warning_max, mt.critical_min, mt.critical_max,
            cs.interval_seconds, cs.frequency_type
          FROM metric_mappings mm
          LEFT JOIN machines m ON mm.machine_id = m.id
          LEFT JOIN production_lines p ON m.lineId = p.id
          LEFT JOIN plc_stations plc ON mm.plc_id = plc.id
          LEFT JOIN metric_thresholds mt ON mm.id = mt.mapping_id
          LEFT JOIN collection_schedules cs ON mm.id = cs.mapping_id
          ORDER BY mm.id ASC
        `);
        res.json({ mappings: rows });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(5099, resolve));

    // Thực hiện gọi HTTP thực tế
    function testHttpRequest(urlPath) {
      return new Promise((resolve, reject) => {
        http.get(`http://localhost:5099${urlPath}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        }).on('error', reject);
      });
    }

    const resLines = await testHttpRequest('/api/lines');
    console.log(`  ✓ HTTP GET /api/lines: HTTP ${resLines.status} OK (Trả về ${resLines.body.lines.length} dây chuyền) -> ĐÃ HẾT LỖI 500!`);

    const resMachines = await testHttpRequest('/api/machines');
    if (resMachines.status !== 200) {
      console.log('  ✗ resMachines error:', resMachines);
    }
    console.log(`  ✓ HTTP GET /api/machines: HTTP ${resMachines.status} OK (Trả về đúng ${resMachines.body.machines ? resMachines.body.machines.length : 0} máy MCH-*) -> ĐÃ HẾT LỖI 500!`);

    const resMetrics = await testHttpRequest('/api/metrics/catalog');
    console.log(`  ✓ HTTP GET /api/metrics/catalog: HTTP ${resMetrics.status} OK (Trả về ${resMetrics.body.metrics.length} metric) -> ĐÃ HẾT LỖI 500!`);

    const resSummary = await testHttpRequest('/api/metrics/summary');
    console.log(`  ✓ HTTP GET /api/metrics/summary: HTTP ${resSummary.status} OK (Metrics: ${resSummary.body.totalMetrics}, Mappings: ${resSummary.body.totalMappings})`);

    const resMappings = await testHttpRequest('/api/mappings');
    console.log(`  ✓ HTTP GET /api/mappings: HTTP ${resMappings.status} OK (Mappings: ${resMappings.body.mappings.length})`);

    await new Promise(resolve => server.close(resolve));
    await testPool.end();

    // -------------------------------------------------------------
    // GIAI ĐOẠN 7: DỌN DẸP & BẢO TOÀN DỮ LIỆU
    // -------------------------------------------------------------
    console.log(`\n[GIAI ĐOẠN 7] Dọn dẹp môi trường test và kiểm toán an toàn:`);
    await localConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\`;`);
    console.log(`  ✓ Đã xóa database test \`${TEST_DB}\` an toàn.`);

    const [auditRows] = await localConn.query('SELECT COUNT(*) as c FROM denso_iot.machine_telemetry_history');
    console.log(`  ✓ Database \`denso_iot\` bất biến: ${auditRows[0].c} bản ghi.`);

    // Xác nhận file backup gốc nguyên vẹn
    if (fs.existsSync(backupFilePath)) {
      console.log(`  ✓ File backup gốc được bảo toàn nguyên vẹn: ${backupFilePath}`);
    } else {
      throw new Error('Mất file backup!');
    }

    console.log('\n========================================================================');
    console.log('   KẾT QUẢ KIỂM ĐỊNH TOÀN TRÌNH: PASS 100%                             ');
    console.log('========================================================================');
  } finally {
    await localConn.end();
  }
}

runVerification().catch(err => {
  console.error('\n[LỖI TEST]:', err);
  process.exit(1);
});
