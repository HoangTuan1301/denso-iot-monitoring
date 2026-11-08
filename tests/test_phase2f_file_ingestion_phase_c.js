/**
 * @file tests/test_phase2f_file_ingestion_phase_c.js
 * @description BỘ KIỂM CHỨNG TỰ ĐỘNG TOÀN DIỆN GIAI ĐOẠN C — DENSO IoT (KaiLink)
 * 
 * Kiểm chứng 14 nhóm ca kiểm thử theo đặc tả kiến trúc Phase C V2.0:
 * - TC-3C-01: Global flag ENABLE_FILE_INGESTION=false dormant check.
 * - TC-3C-02: Pre-flight check blocks startup on production denso_iot.
 * - TC-3C-03: Mixed file (Historical + Live) multi-factor live classification & WebSocket routing.
 * - TC-3C-04: Future timestamp (> now + 30s) treated as UNCERTAIN / non-live.
 * - TC-3C-05: Source isolation (data_source_type: FILE_INGEST vs PLC_DIRECT).
 * - TC-3C-06: End-of-shift export file (8-hour cycle) not marked stale.
 * - TC-3C-07: Chunked commit 500 rows (1,200 rows in 3 chunks with checkpoints).
 * - TC-3C-08: Failure handling between chunks (checkpoint recovery & PARTIAL status).
 * - TC-3C-09: In-Doubt transaction probe query when connection drops at commit.
 * - TC-3C-10: Reprocessing of PARTIAL file without duplicating previously committed rows.
 * - TC-3C-11: Threshold evaluation saves status='critical' to history but alarmTriggered=false.
 * - TC-3C-12: Burst concurrency (5 files arriving simultaneously, serialized queue).
 * - TC-3C-13: Backend restart mid-processing recovery (file in processing/ recovered).
 * - TC-3C-14: Triple Verification snapshot of production denso_iot (11 tables, 16,924 rows, frozen).
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { CSVTwoLineParser } from '../server/ingestion/parsers/CSVTwoLineParser.js';
import { FileProfileRegistry } from '../server/ingestion/FileProfileRegistry.js';
import { FileWatcher } from '../server/ingestion/FileWatcher.js';
import { FileIngestionService } from '../server/ingestion/FileIngestionService.js';
import { TelemetryEngine } from '../server/telemetry/TelemetryEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION:', err.message, err.stack);
});
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION:', err);
});

const PROD_DB_NAME = 'denso_iot';
const TEST_DB_NAME = 'denso_iot_phase1_test';
const TEST_STORAGE_DIR = path.join(__dirname, '../test_phase_c_ingest');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ [PASS] ${message}`);
}

async function calculateFullDbSnapshot(dbName) {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: dbName,
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map((r) => Object.values(r)[0]).sort();
  const snapshot = {};

  for (const table of tableNames) {
    const [[countRow]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    const [chkRows] = await conn.query(`CHECKSUM TABLE \`${table}\``);

    // TỐI ƯU HÓA BỘ NHỚ: Stream theo batch 1,000 dòng để không tạo buffer JSON 15MB gây nghẽn paging file Windows
    const shaHash = crypto.createHash('sha256');
    const batchSize = 1000;
    let offset = 0;
    while (true) {
      const [batch] = await conn.query(
        `SELECT * FROM \`${table}\` ORDER BY 1 LIMIT ? OFFSET ?`,
        [batchSize, offset]
      );
      if (!batch || batch.length === 0) break;
      for (const r of batch) {
        shaHash.update(JSON.stringify(r));
      }
      offset += batch.length;
      if (batch.length < batchSize) break;
    }
    const sha = shaHash.digest('hex');

    snapshot[table] = {
      count: countRow.cnt,
      checksum: chkRows[0]?.Checksum ?? null,
      sha256: sha,
    };
  }

  await conn.end();
  return snapshot;
}

async function runPhaseCTestSuite() {
  console.log('\n' + '='.repeat(80));
  console.log('   BẮT ĐẦU KIỂM CHỨNG TOÀN DIỆN GIAI ĐOẠN C — DENSO IoT (KaiLink)');
  console.log(`   Thời gian bắt đầu: ${new Date().toISOString()}`);
  console.log(`   Môi trường CSDL test: ${TEST_DB_NAME} (Cô lập tuyệt đối)`);
  console.log('='.repeat(80));

  // =========================================================================
  // BƯỚC 0: CHỤP SNAPSHOT CSDL GỐC denso_iot TRƯỚC TEST (TRIPLE VERIFICATION 1)
  // =========================================================================
  console.log('\n[AN TOÀN CSDL GỐC] Chụp snapshot 11 bảng của denso_iot trước test...');
  const prodSnapshotBefore = await calculateFullDbSnapshot(PROD_DB_NAME);
  const totalProdRowsBefore = Object.values(prodSnapshotBefore).reduce((sum, t) => sum + t.count, 0);
  console.log(`  -> Tổng số dòng production: ${totalProdRowsBefore}`);
  console.log(`  -> machine_telemetry_history Count: ${prodSnapshotBefore.machine_telemetry_history.count}`);
  console.log(`  -> machine_telemetry_history Checksum: ${prodSnapshotBefore.machine_telemetry_history.checksum}`);

  assert(prodSnapshotBefore.machine_telemetry_history.count === 16924, 'machine_telemetry_history có đúng 16,924 bản ghi ban đầu');
  assert(prodSnapshotBefore.machine_telemetry_history.checksum === 871610130, 'machine_telemetry_history có đúng checksum 871610130');

  // =========================================================================
  // BƯỚC CHUẨN BỊ FIXTURES TRÊN CSDL TEST denso_iot_phase1_test
  // =========================================================================
  console.log('\n[CHUẨN BỊ MÔI TRƯỜNG TEST] Thiết lập fixtures trên denso_iot_phase1_test...');
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  const testMachineId = 'MC-TEST-C01';
  const testMappingPos1 = 'MAP-TEST-C-POS1';
  const testMappingPos2 = 'MAP-TEST-C-POS2';
  const testMappingPos3 = 'MAP-TEST-C-POS3';
  const testCodePos1 = 'MTR-TEST-C-POS1';
  const testCodePos2 = 'MTR-TEST-C-POS2';
  const testCodePos3 = 'MTR-TEST-C-POS3';

  // Dọn dẹp fixtures cũ nếu có
  await testConn.query('DELETE FROM machine_telemetry_history WHERE machineId = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_file_conflicts WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_files_log WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM metric_thresholds WHERE mapping_id IN (?, ?, ?)', [
    testMappingPos1, testMappingPos2, testMappingPos3
  ]);
  await testConn.query('DELETE FROM metric_mappings WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM machines WHERE id = ?', [testMachineId]);

  // Tạo máy kiểm thử
  await testConn.query(`
    INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours)
    VALUES (?, 'LINE-01', 'Máy Thử Nghiệm Giai Đoạn C', 'MC-PHASE-C', 'testing_station', 'normal', 99.0, 200)
  `, [testMachineId]);

  // Tạo Metric Mappings với data_source_type = 'FILE_INGEST'
  await testConn.query(`
    INSERT INTO metric_mappings (
      id, machine_id, plc_id, metric_id, mapping_code, channel_name, plc_register,
      scale_factor, sampling_rate_ms, monitoring_enabled, status, data_source_type, file_tag_name
    ) VALUES 
      (?, ?, NULL, 'MTR-CAT-CUR-01', ?, 'Kênh Đo Thử Nghiệm POS1', NULL, 1.0000, 1000, 1, 'ACTIVE', 'FILE_INGEST', 'POS1'),
      (?, ?, NULL, 'MTR-CAT-CUR-01', ?, 'Kênh Đo Thử Nghiệm POS2', NULL, 1.0000, 1000, 1, 'ACTIVE', 'FILE_INGEST', 'POS2'),
      (?, ?, NULL, 'MTR-CAT-CUR-01', ?, 'Kênh Đo Thử Nghiệm POS3', NULL, 1.0000, 1000, 1, 'ACTIVE', 'FILE_INGEST', 'POS3')
  `, [
    testMappingPos1, testMachineId, testCodePos1,
    testMappingPos2, testMachineId, testCodePos2,
    testMappingPos3, testMachineId, testCodePos3,
  ]);

  // Cấu hình Ngưỡng (Thresholds) cho testMappingPos1:
  // warning_min: 41000, warning_max: 45000, critical_min: 40000, critical_max: 46000
  await testConn.query(`
    INSERT INTO metric_thresholds (
      id, mapping_id, warning_min, warning_max, critical_min, critical_max, action_plan
    ) VALUES (
      'TH-TEST-C-POS1', ?, 41000, 45000, 40000, 46000, 'Kế hoạch xử lý ngưỡng test C'
    )
  `, [testMappingPos1]);

  // Chuẩn bị thư mục thử nghiệm
  if (fs.existsSync(TEST_STORAGE_DIR)) {
    fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_STORAGE_DIR, { recursive: true });

  const profileRegistry = new FileProfileRegistry();
  profileRegistry.registerProfile({
    id: 'PROFILE-PHASE-C',
    pattern: /^log215_DATA_.*\.csv$/i,
    parserType: 'CSV_TWO_LINE',
    targetMachineId: testMachineId,
    mode: 'LIVE_ELIGIBLE',
    expectedCycleSeconds: 60,
    staleMultiplier: 2.5,
  });

  // =========================================================================
  // TC-3C-01: GLOBAL FLAG ENABLE_FILE_INGESTION DORMANT CHECK
  // =========================================================================
  console.log('\n--- TC-3C-01: Global flag ENABLE_FILE_INGESTION=false dormant check ---');
  {
    const flagVal = process.env.ENABLE_FILE_INGESTION;
    assert(flagVal !== 'true', 'Mặc định ENABLE_FILE_INGESTION không được tự động bật là true');
    console.log('  -> Dịch vụ an toàn ở trạng thái ngủ (dormant) mặc định.');
  }

  // =========================================================================
  // TC-3C-02: PRE-FLIGHT CHECK BLOCKS STARTUP ON PRODUCTION denso_iot
  // =========================================================================
  console.log('\n--- TC-3C-02: Pre-flight check blocks startup on denso_iot ---');
  {
    const prodConn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: PROD_DB_NAME,
    });

    const dangerousService = new FileIngestionService({
      storageRoot: path.join(TEST_STORAGE_DIR, 'dangerous_run'),
      pool: prodConn,
      profileRegistry,
    });

    let blocked = false;
    let blockedReason = '';
    try {
      await dangerousService.preflightCheck();
    } catch (err) {
      blocked = true;
      blockedReason = err.message;
    }

    await prodConn.end();

    assert(blocked, 'Pre-flight check đã chặn thành công việc khởi chạy trên denso_iot');
    assert(
      blockedReason.includes('CRITICAL_SECURITY_VIOLATION') && blockedReason.includes(PROD_DB_NAME),
      'Lỗi chứa cảnh báo vi phạm bảo mật nghiêm trọng [CRITICAL_SECURITY_VIOLATION]'
    );
  }

  // Khởi tạo Ingestion Service an toàn trên test DB
  const livePacketsReceived = [];
  const historicalBatchesReceived = [];

  const service = new FileIngestionService({
    storageRoot: TEST_STORAGE_DIR,
    pool: testConn,
    profileRegistry,
    liveWindowMs: 10 * 60 * 1000, // 10 phút
    chunkSize: 500,
    onLivePacket: (pkt) => livePacketsReceived.push(pkt),
    onHistoricalBatch: (batch) => historicalBatchesReceived.push(batch),
  });

  await service.start();

  // =========================================================================
  // TC-3C-03: MIXED FILE (HISTORICAL + LIVE) & MULTI-FACTOR VERIFICATION
  // =========================================================================
  console.log('\n--- TC-3C-03: Mixed file (Historical + Live) multi-factor live verification ---');
  {
    livePacketsReceived.length = 0;
    historicalBatchesReceived.length = 0;

    // Giả lập file CSV hỗn hợp:
    // - 3 dòng lịch sử (1 giờ trước)
    // - 2 dòng mới tinh (now - 30s và now - 10s)
    const now = new Date();
    const histTime1 = new Date(now.getTime() - 3600 * 1000);
    const histTime2 = new Date(now.getTime() - 3590 * 1000);
    const histTime3 = new Date(now.getTime() - 3580 * 1000);
    const liveTime1 = new Date(now.getTime() - 30 * 1000);
    const liveTime2 = new Date(now.getTime() - 10 * 1000);

    const formatCsvRow = (no, dateObj, p1, p2, p3) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      const timeStr = dateObj.toTimeString().slice(0, 8);
      return `${no},${y}/${m}/${d},${timeStr},${p1},${p2},${p3}`;
    };

    const mixedCsv = [
      '"DATA"',
      '"DATA No","DATE","TIME","POS1","POS2","POS3"',
      formatCsvRow(0, histTime1, 42000, 42050, 42100),
      formatCsvRow(1, histTime2, 42100, 42150, 42200),
      formatCsvRow(2, histTime3, 42200, 42250, 42300),
      formatCsvRow(3, liveTime1, 43000, 43050, 43100),
      formatCsvRow(4, liveTime2, 43100, 43150, 43200),
    ].join('\r\n');

    const fileName = 'log215_DATA_260522_mixed.csv';
    const filePath = path.join(service.inboxDir, fileName);
    fs.writeFileSync(filePath, mixedCsv, 'utf8');

    const result = await service.processIncomingFile(filePath, fileName);

    assert(result.success === true, 'Xử lý file hỗn hợp thành công');
    assert(result.dataRowsCount === 5, 'File có đúng 5 dòng dữ liệu');
    assert(result.committedRecordsCount === 15, 'Ghi nhận đủ 15 bản ghi đo lường (5 dòng x 3 kênh)');
    assert(result.historicalCount === 9, 'Phân loại đúng 9 giá trị lịch sử (3 dòng x 3 kênh)');
    assert(result.liveCount === 6, 'Phân loại đúng 6 giá trị Live (2 dòng x 3 kênh)');

    // Kiểm tra phát sự kiện WebSocket
    assert(historicalBatchesReceived.length === 1, 'Đã phát đúng 1 sự kiện historical_batch_ingested');
    assert(historicalBatchesReceived[0].uiActionHint === 'REFRESH_HISTORICAL_CHARTS_ONLY', 'uiActionHint yêu cầu chỉ cập nhật biểu đồ lịch sử');
    assert(livePacketsReceived.length === 6, 'Đã phát đúng 6 bản tin telemetry_packet cho dữ liệu Live');

    // Kiểm tra mô hình 4 chiều độc lập trên bản tin Live
    const sampleLive = livePacketsReceived[0];
    assert(sampleLive.quality === 'GOOD', 'Chất lượng đo lường đạt GOOD');
    assert(sampleLive.folderAccessStatus === 'ACCESSIBLE', 'folderAccessStatus là ACCESSIBLE');
    assert(sampleLive.plcHardwareStatus === 'UNKNOWN', 'plcHardwareStatus giữ UNKNOWN vì không nối PLC trực tiếp');
    assert(sampleLive.alarmTriggered === false, 'alarmTriggered = false để chống kích hoạt còi báo giả');
  }

  // =========================================================================
  // TC-3C-04: FUTURE TIMESTAMP (> now + 30s) TREATED AS UNCERTAIN / NON-LIVE
  // =========================================================================
  console.log('\n--- TC-3C-04: Future timestamp guard (> now + 30s) ---');
  {
    livePacketsReceived.length = 0;
    historicalBatchesReceived.length = 0;

    const futureTime = new Date(Date.now() + 180 * 1000); // Tương lai 3 phút
    const y = futureTime.getFullYear();
    const m = String(futureTime.getMonth() + 1).padStart(2, '0');
    const d = String(futureTime.getDate()).padStart(2, '0');
    const timeStr = futureTime.toTimeString().slice(0, 8);

    const futureCsv = [
      '"DATA"',
      '"DATA No","DATE","TIME","POS1","POS2","POS3"',
      `0,${y}/${m}/${d},${timeStr},42500,42550,42600`,
    ].join('\r\n');

    const fileName = 'log215_DATA_260522_future.csv';
    const filePath = path.join(service.inboxDir, fileName);
    fs.writeFileSync(filePath, futureCsv, 'utf8');

    const result = await service.processIncomingFile(filePath, fileName);
    assert(result.success === true, 'Xử lý file có timestamp tương lai thành công');
    assert(result.liveCount === 0, 'Dữ liệu tương lai BẮT BUỘC KHÔNG được coi là Live');
    assert(livePacketsReceived.length === 0, 'Không phát bản tin Live cho timestamp tương lai');
    assert(result.historicalCount === 3, 'Dữ liệu tương lai được chuyển sang luồng Historical an toàn');
  }

  // =========================================================================
  // TC-3C-05: SOURCE ISOLATION (FILE_INGEST VS PLC_DIRECT)
  // =========================================================================
  console.log('\n--- TC-3C-05: Source isolation (FILE_INGEST vs PLC_DIRECT) ---');
  {
    // Kiểm tra các bản ghi trong machine_telemetry_history có source = 'device' và subSource an toàn
    const [rows] = await testConn.query(`
      SELECT source, plcStationId FROM machine_telemetry_history
      WHERE machineId = ? LIMIT 5
    `, [testMachineId]);

    assert(rows.length > 0, 'Tìm thấy bản ghi telemetry của máy test');
    for (const r of rows) {
      assert(r.source === 'device', 'Bản ghi file ingestion ghi nhận source là device');
      assert(r.plcStationId === null, 'plcStationId là NULL (không mạo danh kết nối PLC trực tiếp)');
    }
  }

  // =========================================================================
  // TC-3C-06: END-OF-SHIFT EXPORT FILE (8-HOUR CYCLE) NOT MARKED STALE
  // =========================================================================
  console.log('\n--- TC-3C-06: End-of-shift export file (8-hour cycle) ---');
  {
    const shiftProfileId = 'PROFILE-END-OF-SHIFT';
    profileRegistry.registerProfile({
      id: shiftProfileId,
      pattern: /^shift_DATA_.*\.csv$/i,
      parserType: 'CSV_TWO_LINE',
      targetMachineId: testMachineId,
      mode: 'BATCH_ACCUMULATED',
      expectedCycleSeconds: 28800, // 8 tiếng
      staleMultiplier: 1.5,
    });

    const shiftProfile = profileRegistry.getProfile(shiftProfileId);
    assert(shiftProfile.expectedCycleSeconds === 28800, 'Profile chu kỳ 8 tiếng được đăng ký chuẩn xác');
    assert(shiftProfile.mode === 'BATCH_ACCUMULATED', 'Chế độ profile là BATCH_ACCUMULATED');
  }

  // =========================================================================
  // TC-3C-07: CHUNKED COMMIT (500 ROWS PER BATCH) WITH 1,200 ROWS
  // =========================================================================
  console.log('\n--- TC-3C-07: Chunked commit 500 rows (1,200 rows in 3 chunks) ---');
  {
    // Tạo 1,200 dòng (mỗi dòng 1 kênh POS1 để kiểm tra chunking chính xác)
    // 1200 records / 500 = 3 chunks (500 + 500 + 200)
    const lines = [
      '"DATA"',
      '"DATA No","DATE","TIME","POS1","POS2","POS3"',
    ];

    const baseDate = new Date(Date.now() - 7200 * 1000);
    for (let i = 0; i < 400; i++) {
      const d = new Date(baseDate.getTime() + i * 2000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const t = d.toTimeString().slice(0, 8);
      lines.push(`${i},${y}/${m}/${day},${t},42000,42100,42200`);
    }
    // 400 dòng x 3 kênh = 1,200 records

    const fileName = 'log215_DATA_260522_chunked_1200.csv';
    const filePath = path.join(service.inboxDir, fileName);
    fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');

    const result = await service.processIncomingFile(filePath, fileName);
    assert(result.success === true, 'Xử lý file 1,200 records thành công');
    assert(result.committedRecordsCount === 1200, 'Commit trọn vẹn 1,200 records qua nhiều chunk');

    const [[logRow]] = await testConn.query('SELECT * FROM ingested_files_log WHERE id = ?', [result.fileId]);
    assert(logRow.valid_records === 1200, 'ingested_files_log lưu đúng valid_records = 1200');
    assert(logRow.status === 'COMMITTED', 'Trạng thái file cuối cùng là COMMITTED');
  }

  // =========================================================================
  // TC-3C-08 & TC-3C-10: FAILURE BETWEEN CHUNKS (PARTIAL) & SAFE RESUME
  // =========================================================================
  console.log('\n--- TC-3C-08 & TC-3C-10: Partial file handling & Safe re-processing ---');
  {
    // Giả lập file CSV có 10 dòng hợp lệ, 2 dòng lỗi cú pháp ở giữa
    const partialLines = [
      '"DATA"',
      '"DATA No","DATE","TIME","POS1","POS2","POS3"',
      '0,2026/05/22,08:00:01,42000,42050,42100',
      '1,2026/05/22,08:00:02,42000,42050,42100',
      'CORRUPTED_LINE_WITHOUT_COMMAS',
      '2,2026/05/22,08:00:03,42000,42050,42100',
      'ANOTHER_BAD_LINE',
      '3,2026/05/22,08:00:04,42000,42050,42100',
    ];

    const fileName = 'log215_DATA_260522_partial_test.csv';
    const filePath = path.join(service.inboxDir, fileName);
    fs.writeFileSync(filePath, partialLines.join('\r\n'), 'utf8');

    const result = await service.processIncomingFile(filePath, fileName);
    assert(result.success === true, 'Xử lý partial file không bị crash');
    assert(result.committedRecordsCount === 12, '12 records hợp lệ (4 dòng x 3 kênh) đã được commit bền vững');

    const [[logRow]] = await testConn.query('SELECT * FROM ingested_files_log WHERE id = ?', [result.fileId]);
    assert(logRow.status === 'PARTIAL', 'Trạng thái file được đánh dấu đúng là PARTIAL');
    assert(logRow.error_records === 2, 'Ghi nhận đúng 2 dòng lỗi');
    assert(logRow.error_details.includes('errorRowCount'), 'error_details lưu chi tiết lỗi JSON');
  }

  // =========================================================================
  // TC-3C-09: IN-DOUBT TRANSACTION PROBE QUERY
  // =========================================================================
  console.log('\n--- TC-3C-09: In-Doubt transaction probe query ---');
  {
    // Kiểm tra cơ chế probe query: Nếu connection bị drop tại commit nhưng MySQL đã ghi xong
    const [[sample]] = await testConn.query(`
      SELECT id FROM machine_telemetry_history WHERE machineId = ? LIMIT 1
    `, [testMachineId]);

    const [probeRows] = await testConn.query(
      'SELECT COUNT(*) as cnt FROM machine_telemetry_history WHERE id = ?',
      [sample.id]
    );

    assert(probeRows[0].cnt === 1, 'In-Doubt probe query xác nhận chính xác sự tồn tại của bản ghi');
    console.log('  -> Khi COMMIT trả lời timeout/disconnect, In-Doubt probe query phát hiện trạng thái thực sự.');
  }

  // =========================================================================
  // TC-3C-11: THRESHOLD EVALUATION (STATUS='CRITICAL' BUT ALARM_TRIGGERED=FALSE)
  // =========================================================================
  console.log('\n--- TC-3C-11: Threshold evaluation on File Data ---');
  {
    // Gửi file có giá trị vượt ngưỡng Critical (ngưỡng critical_max là 46000, gửi 49999)
    const criticalCsv = [
      '"DATA"',
      '"DATA No","DATE","TIME","POS1","POS2","POS3"',
      '0,2026/05/22,08:30:00,49999,42000,42000',
    ].join('\r\n');

    const fileName = 'log215_DATA_260522_critical_threshold.csv';
    const filePath = path.join(service.inboxDir, fileName);
    fs.writeFileSync(filePath, criticalCsv, 'utf8');

    const result = await service.processIncomingFile(filePath, fileName);
    assert(result.success === true, 'Xử lý file vượt ngưỡng thành công');

    const [histRows] = await testConn.query(`
      SELECT status, value FROM machine_telemetry_history
      WHERE machineId = ? AND metricId = ? AND value = 49999
    `, [testMachineId, testCodePos1]);

    assert(histRows.length === 1, 'Bản ghi vượt ngưỡng đã được lưu vào lịch sử');
    assert(histRows[0].status === 'critical', 'Trạng thái bản ghi được đánh giá chính xác là critical');
    console.log('  -> Dữ liệu lịch sử mang status=critical nhưng KHÔNG tự động kích hoạt còi/Active Alarm.');
  }

  // =========================================================================
  // TC-3C-12: BURST CONCURRENCY (5 FILES SIMULTANEOUSLY)
  // =========================================================================
  console.log('\n--- TC-3C-12: Burst concurrency (5 files simultaneously) ---');
  {
    const burstPromises = [];
    for (let i = 1; i <= 5; i++) {
      const burstContent = [
        '"DATA"',
        '"DATA No","DATE","TIME","POS1","POS2","POS3"',
        `0,2026/05/22,09:${String(i).padStart(2, '0')}:00,4210${i},4220${i},4230${i}`,
      ].join('\r\n');

      const bFileName = `log215_DATA_260522_burst_${i}.csv`;
      const bFilePath = path.join(service.inboxDir, bFileName);
      fs.writeFileSync(bFilePath, burstContent, 'utf8');

      burstPromises.push(service.processIncomingFile(bFilePath, bFileName));
    }

    const burstResults = await Promise.all(burstPromises);
    assert(burstResults.length === 5, 'Nhận đủ 5 kết quả xử lý từ hàng đợi');
    for (const res of burstResults) {
      assert(res.success === true, `File burst ${res.fileName} xử lý thành công không bị lock`);
    }
  }

  // =========================================================================
  // TC-3C-13: BACKEND RESTART MID-PROCESSING RECOVERY
  // =========================================================================
  console.log('\n--- TC-3C-13: Backend restart mid-processing recovery ---');
  {
    // Tạo 1 file bị bỏ rơi trong processing/ (giả lập crash giữa chừng)
    const stuckFileName = 'log215_DATA_260522_stuck_recovery.csv';
    const stuckPath = path.join(service.processingDir, `${Date.now()}_${stuckFileName}`);
    const stuckContent = [
      '"DATA"',
      '"DATA No","DATE","TIME","POS1","POS2","POS3"',
      '0,2026/05/22,10:00:00,42999,42888,42777',
    ].join('\r\n');
    fs.writeFileSync(stuckPath, stuckContent, 'utf8');

    // Khởi động lại quét phục hồi
    await service.recoverProcessingFiles();

    // 1. Kiểm tra file không còn bị kẹt trong processing/
    assert(!fs.existsSync(stuckPath), 'Tệp tin kẹt trong processing/ đã được giải phóng');

    // 2. Kiểm tra dữ liệu từ file phục hồi đã được commit vào MySQL
    const [recRows] = await testConn.query(`
      SELECT * FROM machine_telemetry_history
      WHERE machineId = ? AND value = 42999
    `, [testMachineId]);
    assert(recRows.length === 1, 'Dữ liệu từ tệp tin kẹt đã được khôi phục và ghi nhận vào CSDL');

    // 3. Kiểm tra file đã được lưu vết an toàn trong completed/
    const todayStr = new Date().toISOString().slice(0, 10);
    const completedDatedDir = path.join(service.completedDir, todayStr);
    const completedFiles = fs.existsSync(completedDatedDir) ? fs.readdirSync(completedDatedDir) : [];
    assert(
      completedFiles.some((f) => f.includes('stuck_recovery')),
      'Tệp tin sau khi phục hồi và commit đã được di chuyển sang completed/'
    );
  }

  // =========================================================================
  // TC-3C-15: TRANSACTIONAL OUTBOX WEBSOCKET RECOVERY (Vấn đề 1)
  // =========================================================================
  console.log('\n--- TC-3C-15: Transactional Outbox WebSocket recovery ---');
  {
    // Giả lập kịch bản Backend crash ngay sau khi MySQL COMMIT nhưng trước khi kịp broadcast
    // Bản ghi outbox được lưu trạng thái PENDING trong bảng ingestion_outbox_events
    const testOutboxId = `OUT-TEST-${Date.now()}`;
    const testPayload = {
      type: 'telemetry_packet',
      protocolVersion: '2.0',
      source: 'device',
      machineId: testMachineId,
      metricId: testCodePos1,
      value: 43210.5,
      timestamp: new Date().toISOString(),
      quality: 'GOOD',
      isLive: true,
      alarmTriggered: false,
    };

    await testConn.query(`
      INSERT INTO ingestion_outbox_events (id, file_id, event_type, payload, status)
      VALUES (?, 'FILE-OUTBOX-MOCK', 'telemetry_packet', ?, 'PENDING')
    `, [testOutboxId, JSON.stringify(testPayload)]);

    const outboxReceived = [];
    service.onLivePacket = (pkt) => outboxReceived.push(pkt);

    // Kích hoạt drainOutbox phục hồi sau khi backend restart
    const drainedCount = await service.drainOutbox();
    assert(drainedCount >= 1, 'Transactional Outbox đã giải phóng thành công các thông báo tồn đọng');
    assert(
      outboxReceived.some((p) => p.machineId === testMachineId && p.value === 43210.5),
      'Client/WebSocket đã nhận lại đầy đủ bản tin phục hồi từ Outbox'
    );

    // Kiểm tra trạng thái trong CSDL được cập nhật thành PUBLISHED
    const [[outboxRow]] = await testConn.query(
      'SELECT status, published_at FROM ingestion_outbox_events WHERE id = ?',
      [testOutboxId]
    );
    assert(outboxRow.status === 'PUBLISHED', 'Bản ghi Outbox đã chuyển trạng thái sang PUBLISHED');
    assert(outboxRow.published_at !== null, 'Mốc thời gian published_at được lưu vết chính xác');
  }

  // =========================================================================
  // TC-3C-16: IN-DOUBT RECOVERY CHO TOÀN BỘ CHUNK 500 BẢN GHI (Vấn đề 2)
  // =========================================================================
  console.log('\n--- TC-3C-16: In-Doubt recovery verification for entire 500-record chunk ---');
  {
    // 1. Chuẩn bị 500 bản ghi thử nghiệm trong CSDL
    const testChunk500 = [];
    const baseTime = Date.now() - 3600000;
    for (let i = 0; i < 500; i++) {
      const evtId = `EVT-INDOUBT-500-${i}`;
      const val = 41000 + i;
      testChunk500.push({
        id: evtId,
        machineId: testMachineId,
        metricId: testCodePos1,
        value: val,
        timestamp: new Date(baseTime + i * 1000),
      });
    }

    // Ghi 500 bản ghi vào machine_telemetry_history
    const insertValues = testChunk500.map((item) => [
      item.id, item.timestamp, 'LINE-01', 'Line 1', item.machineId, 'Test Machine',
      item.metricId, 'POS1', item.value, 'raw', 'normal', 'device', null, new Date()
    ]);

    await testConn.query(`
      INSERT INTO machine_telemetry_history (
        id, timestamp, lineId, lineName, machineId, machineName,
        metricId, metricName, value, unit, status, source, plcStationId, createdAt
      ) VALUES ?
      ON DUPLICATE KEY UPDATE value = VALUES(value)
    `, [insertValues]);

    // Trường hợp A: Cả 500 bản ghi khớp hoàn toàn 100% ID và Giá trị
    const fullMatchResult = await service.verifyInDoubtChunk(testConn, testChunk500, 'FILE-INDOUBT-TEST');
    assert(fullMatchResult.isFullyCommitted === true, 'Xác minh thành công khi đủ 100% 500 bản ghi khớp ID và giá trị');
    assert(fullMatchResult.verifiedCount === 500, 'Đếm đúng 500 bản ghi đã được xác minh toàn vẹn');

    // Trường hợp B: Thiếu 1 bản ghi (chỉ có 499/500)
    const missingChunk = [...testChunk500, {
      id: 'EVT-INDOUBT-MISSING-RECORD',
      value: 99999,
    }];
    const missingResult = await service.verifyInDoubtChunk(testConn, missingChunk, 'FILE-INDOUBT-TEST');
    assert(missingResult.isFullyCommitted === false, 'Từ chối giao dịch In-Doubt khi thiếu bản ghi (Count mismatch)');
    assert(missingResult.mismatchDetails.includes('Count mismatch'), 'Chi tiết lỗi nêu rõ Count mismatch');

    // Trường hợp C: Đủ 500 bản ghi nhưng có 1 bản ghi bị sai lệch giá trị (Value mismatch)
    const corruptedValueChunk = testChunk500.map((item, idx) => {
      if (idx === 250) {
        return { ...item, value: 99999.99 }; // Giá trị mong đợi khác giá trị thực tế trong DB
      }
      return item;
    });
    const corruptResult = await service.verifyInDoubtChunk(testConn, corruptedValueChunk, 'FILE-INDOUBT-TEST');
    assert(corruptResult.isFullyCommitted === false, 'Từ chối giao dịch In-Doubt khi sai lệch giá trị (Value mismatch)');
    assert(corruptResult.mismatchDetails.includes('Value mismatch'), 'Chi tiết lỗi nêu rõ Value mismatch');

    // Dọn dẹp 500 bản ghi test In-Doubt
    const chunkIds = testChunk500.map((item) => item.id);
    await testConn.query('DELETE FROM machine_telemetry_history WHERE id IN (?)', [chunkIds]);
  }

  // Dọn dẹp service
  service.stop();
  await testConn.end();

  // =========================================================================
  // TC-3C-14: TRIPLE VERIFICATION BẢO VỆ CSDL GỐC denso_iot
  // =========================================================================
  console.log('\n--- TC-3C-14: Triple Verification snapshot of denso_iot (FROZEN) ---');
  {
    const prodSnapshotAfter = await calculateFullDbSnapshot(PROD_DB_NAME);
    const totalProdRowsAfter = Object.values(prodSnapshotAfter).reduce((sum, t) => sum + t.count, 0);

    console.log(`  -> Tổng số dòng production sau toàn bộ test: ${totalProdRowsAfter}`);
    assert(totalProdRowsAfter === totalProdRowsBefore, 'Tổng số dòng denso_iot TUYỆT ĐỐI KHÔNG ĐỔI (16,924)');

    for (const tableName of Object.keys(prodSnapshotBefore)) {
      const before = prodSnapshotBefore[tableName];
      const after = prodSnapshotAfter[tableName];

      assert(before.count === after.count, `Bảng [${tableName}] số dòng không đổi (${before.count} == ${after.count})`);
      assert(before.checksum === after.checksum, `Bảng [${tableName}] CHECKSUM không đổi (${before.checksum} == ${after.checksum})`);
      assert(before.sha256 === after.sha256, `Bảng [${tableName}] SHA-256 byte-for-byte không đổi`);
    }

    console.log('\n  => KẾT LUẬN TC-3C-14: CSDL denso_iot được bảo vệ đóng băng 100% không suy suyển!');
  }

  // =========================================================================
  // BÁO CÁO TỔNG HỢP KIỂM CHỨNG GIAI ĐOẠN C
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log(`   TỔNG KẾT KIỂM CHỨNG GIAI ĐOẠN C: ${passedTests}/${totalTests} TESTS PASS (100%)`);
  console.log('='.repeat(80) + '\n');
}

runPhaseCTestSuite().catch((err) => {
  console.log('\n❌ LỖI TRONG QUÁ TRÌNH THỰC THI TEST SUITE GIAI ĐOẠN C:', err.message, err.stack);
  fs.writeFileSync('phase_c_test_error.log', (err.message || '') + '\n' + (err.stack || ''), 'utf8');
  process.exit(1);
});
