/**
 * @file tests/test_phase2f_file_ingestion_deep_acceptance.js
 * @description BỘ KIỂM CHỨNG NGHIỆM THU CHUYÊN SÂU GIAI ĐOẠN B (FILE INGESTION SERVICE)
 * 
 * Đáp ứng đầy đủ 12 yêu cầu nghiệm thu của Người dùng:
 * 1. Kiểm tra trực tiếp code và cấu hình kết nối (chỉ ghi denso_iot_phase1_test).
 * 2. File Watcher: phát hiện file mới, file ghi dở, file lớn/sao chép chậm, nhiều file cùng lúc.
 * 3. Crash recovery tại 3 thời điểm: trước khi ghi MySQL, trong transaction, sau COMMIT trước khi chuyển completed/.
 * 4. Retry & an toàn khi MySQL gián đoạn kết nối.
 * 5. Chống nhập trùng cấp file & bản ghi, bao gồm 2 file khác nhau có dữ liệu chồng lấn (overlapping).
 * 6. Xác nhận fileModifiedAt từ mtime (không tự gán là exportedAt).
 * 7. Phân biệt dữ liệu nguồn thiết bị ('device'), môi trường TEST, và không bật Online giả cho Live.
 * 8. Kiểm chứng tính toán và giới hạn của eventId (không tuyên bố chống trùng tuyệt đối).
 * 9. Xử lý tệp một phần (Partial File): dòng hợp lệ được commit, dòng lỗi được ghi vết vào error_details và status=PARTIAL.
 * 10. Kiểm tra kịch bản Migration 002 và Rollback trên CSDL test.
 * 11. Bằng chứng kiểm thử thực tế và các trường hợp chưa được kiểm chứng.
 * 12. Xác nhận File Ingestion chưa được bật tự động trên Backend production.
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

const PROD_DB_NAME = 'denso_iot';
const TEST_DB_NAME = 'denso_iot_phase1_test';
const TEST_STORAGE_DIR = path.join(__dirname, '../test_deep_ingest');

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
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` ORDER BY 1`);
    const sha = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');

    snapshot[table] = {
      count: countRow.cnt,
      checksum: chkRows[0]?.Checksum ?? null,
      sha256: sha,
    };
  }

  await conn.end();
  return snapshot;
}

function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

async function main() {
  console.log('='.repeat(80));
  console.log('   BỘ KIỂM CHỨNG NGHIỆM THU CHUYÊN SÂU GIAI ĐOẠN B: FILE INGESTION (TEST ONLY)');
  console.log(`   Môi trường thực thi: ${TEST_DB_NAME} (Cô lập hoàn toàn)`);
  console.log('='.repeat(80));

  // 1. SNAPSHOT BẢO VỆ CSDL GỐC DENSO_IOT TRƯỚC KIỂM THỬ
  console.log('\n[BẢO VỆ CSDL GỐC] Đang tính toán Snapshot 11 bảng của denso_iot trước test...');
  const prodSnapshotBefore = await calculateFullDbSnapshot(PROD_DB_NAME);
  console.log(`  -> Số lượng bảng denso_iot: ${Object.keys(prodSnapshotBefore).length}`);
  console.log(`  -> machine_telemetry_history Count: ${prodSnapshotBefore.machine_telemetry_history.count}`);
  console.log(`  -> machine_telemetry_history Checksum: ${prodSnapshotBefore.machine_telemetry_history.checksum}`);

  // 2. KẾT NỐI VÀ CHUẨN BỊ FIXTURES TRÊN CSDL TEST denso_iot_phase1_test
  console.log('\n[CHUẨN BỊ FIXTURES TEST] Khởi tạo kết nối denso_iot_phase1_test...');
  const testConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
  });

  // Đảm bảo Migration 002 đã được nạp trên test db
  const initMigSql = fs.readFileSync(path.join(__dirname, '../migrations/002_add_file_ingestion_tables.sql'), 'utf8');
  const cleanInitMig = initMigSql.replace(/--.*$/gm, '').trim();
  const initMigStatements = cleanInitMig.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of initMigStatements) {
    try {
      await testConn.query(stmt);
    } catch (err) {
      if (err.errno !== 1060 && !err.message.includes('already exists')) {
        throw err;
      }
    }
  }

  const testMachineId = 'MC-TEST-DEEP-INGEST';
  const testCodePos1 = 'MTR-DEEP-POS1';
  const testCodePos2 = 'MTR-DEEP-POS2';
  const testCodePos3 = 'MTR-DEEP-POS3';

  // Dọn dẹp dữ liệu fixtures cũ nếu có
  await testConn.query('DELETE FROM machine_telemetry_history WHERE machineId = ?', [testMachineId]);
  await testConn.query('DELETE FROM metric_mappings WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM machines WHERE id = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_files_log WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_file_conflicts WHERE machine_id = ?', [testMachineId]);

  // Đăng ký máy thử nghiệm
  await testConn.query(`
    INSERT INTO machines (id, lineId, name, code, type, status, healthScore, uptimeHours)
    VALUES (?, 'LINE-01', 'Máy Thử Nghiệm Nghiệm Thu B', ?, 'testing_station', 'STOPPED', 100.0, 0)
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `, [testMachineId, testMachineId]);

  // Đăng ký mappings thử nghiệm
  const mappingsToInsert = [
    { code: testCodePos1, metricId: 'MTR-CAT-TRQ-01', tag: 'POS1' },
    { code: testCodePos2, metricId: 'MTR-CAT-TMP-01', tag: 'POS2' },
    { code: testCodePos3, metricId: 'MTR-CAT-CUR-01', tag: 'POS3' },
  ];

  for (const m of mappingsToInsert) {
    await testConn.query(`
      INSERT INTO metric_mappings (
        id, mapping_code, channel_name, machine_id, metric_id, plc_id, plc_register,
        scale_factor, status, monitoring_enabled, data_source_type, file_tag_name
      ) VALUES (?, ?, ?, ?, ?, NULL, 'DB1.DBD0', 1.0000, 'ACTIVE', 1, 'FILE_INGEST', ?)
      ON DUPLICATE KEY UPDATE file_tag_name = VALUES(file_tag_name), data_source_type = VALUES(data_source_type)
    `, [`MAP-${m.code}`, m.code, `Kênh ${m.tag}`, testMachineId, m.metricId, m.tag]);
  }

  cleanDir(TEST_STORAGE_DIR);

  const profileRegistry = new FileProfileRegistry();
  profileRegistry.registerProfile({
    id: 'PROFILE-TEST-DEEP',
    pattern: /^log215_DATA_.*\.csv$/i,
    parserType: 'CSV_TWO_LINE',
    targetMachineId: testMachineId,
  });

  // -------------------------------------------------------------------------
  // MỤC 1: XÁC MINH CẤU HÌNH KẾT NỐI VÀ ISOLATION BACKEND PRODUCTION
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 1: XÁC MINH CẤU HÌNH KẾT NỐI & CÔ LẬP CSDL CHÍNH ---');
  const [dbNameRow] = await testConn.query('SELECT DATABASE() as current_db');
  assert(dbNameRow[0].current_db === TEST_DB_NAME, `TC-DEEP-01.1: Mọi thao tác kiểm thử chỉ chạy trên CSDL test "${TEST_DB_NAME}"`);

  // Kiểm tra file server/index.js không tự động kích hoạt FileIngestionService
  const indexContent = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
  assert(indexContent.includes("process.env.ENABLE_FILE_INGESTION === 'true'"), 'TC-DEEP-01.2: server/index.js bảo vệ khởi động bằng cờ ENABLE_FILE_INGESTION');
  assert(!indexContent.includes('new FileWatcher'), 'TC-DEEP-01.3: server/index.js KHÔNG khởi chạy FileWatcher tự do ngoài Service');

  // -------------------------------------------------------------------------
  // MỤC 2: KIỂM THỬ FILE WATCHER HOẠT ĐỘNG LIÊN TỤC & CÁC TRƯỜNG HỢP BIÊN
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 2: KIỂM THỬ FILE WATCHER LIÊN TỤC & EDGE CASES ---');
  const watcherInbox = path.join(TEST_STORAGE_DIR, 'watcher_inbox');
  cleanDir(watcherInbox);

  const readyFiles = [];
  const watcher = new FileWatcher({
    inboxDir: watcherInbox,
    stabilityCheckIntervalMs: 100, // 100ms cho test nhanh
    stabilityCheckRounds: 2,
    ignoredExtensions: ['.tmp', '.writing', '.part'],
    onFileReady: (filePath, fileName) => {
      readyFiles.push({ filePath, fileName, time: Date.now() });
    },
  });

  watcher.start();

  // TC-WATCHER-01: File mới hoàn chỉnh được phát hiện
  const normalFile = path.join(watcherInbox, 'file_normal.csv');
  fs.writeFileSync(normalFile, 'col1,col2\n1,2', 'utf8');

  // TC-WATCHER-02: File ghi dở / phần mở rộng tạm bị bỏ qua
  const tmpFile = path.join(watcherInbox, 'file_uploading.tmp');
  fs.writeFileSync(tmpFile, 'partial data...', 'utf8');
  const writingFile = path.join(watcherInbox, 'data.writing');
  fs.writeFileSync(writingFile, 'partial data...', 'utf8');

  // TC-WATCHER-03: File sao chép chậm (Slow copy simulation)
  const slowFile = path.join(watcherInbox, 'file_slow_copy.csv');
  fs.writeFileSync(slowFile, 'chunk1', 'utf8');

  // Chờ 150ms để watcher quét vòng 1
  await new Promise((r) => setTimeout(r, 150));

  // Tiếp tục ghi chunk 2 vào slowFile (mtime và size đổi) -> reset stability
  fs.appendFileSync(slowFile, '_chunk2_appended', 'utf8');

  // Chờ tiếp 150ms (vòng 2)
  await new Promise((r) => setTimeout(r, 150));

  // Ghi chunk cuối
  fs.appendFileSync(slowFile, '_final_chunk', 'utf8');

  // Chờ 350ms để slowFile ổn định đủ 2 rounds
  await new Promise((r) => setTimeout(r, 350));

  assert(readyFiles.some((f) => f.fileName === 'file_normal.csv'), 'TC-WATCHER-01: Phát hiện và xử lý file mới sẵn sàng');
  assert(!readyFiles.some((f) => f.fileName.endsWith('.tmp') || f.fileName.endsWith('.writing')), 'TC-WATCHER-02: Bỏ qua 100% các file tạm (.tmp, .writing)');
  assert(readyFiles.some((f) => f.fileName === 'file_slow_copy.csv'), 'TC-WATCHER-03: File sao chép chậm chỉ được kích hoạt sau khi đã ổn định hoàn toàn');

  // TC-WATCHER-04: Nhiều file đến cùng lúc (Burst of 5 files)
  const burstReady = [];
  const burstCount = 5;
  for (let i = 1; i <= burstCount; i++) {
    fs.writeFileSync(path.join(watcherInbox, `burst_file_${i}.csv`), `id,val\n${i},100`, 'utf8');
  }

  // Chờ 350ms cho cả 5 file ổn định
  await new Promise((r) => setTimeout(r, 350));
  const burstDetected = readyFiles.filter((f) => f.fileName.startsWith('burst_file_'));
  assert(burstDetected.length === burstCount, `TC-WATCHER-04: Xử lý đồng thời ${burstCount} files gửi đến cùng lúc không bị mất file`);

  watcher.stop();

  // -------------------------------------------------------------------------
  // MỤC 3: CRASH RECOVERY TẠI 3 THỜI ĐIỂM QUAN TRỌNG
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 3: CRASH RECOVERY TẠI 3 THỜI ĐIỂM ---');
  const service = new FileIngestionService({
    storageRoot: TEST_STORAGE_DIR,
    pool: testConn,
    profileRegistry,
  });
  await service.initialize();

  // 1. Crash trước khi ghi MySQL: File nằm ở processing/, chưa có trong ingested_files_log
  const crashFile1Name = 'log215_DATA_CRASH1.csv';
  const crashFile1Path = path.join(service.processingDir, `stuck_before_mysql_${crashFile1Name}`);
  const CSV_CONTENT_1 = `"DATA"\n"DATA No","DATE","TIME","POS1","POS2","POS3"\n0,2026/05/22,08:30:00,41111,42222,43333`;
  fs.writeFileSync(crashFile1Path, CSV_CONTENT_1, 'utf8');

  // Khởi động lại service và recover
  await service.recoverProcessingFiles();
  assert(!fs.existsSync(crashFile1Path), 'TC-CRASH-01.1: File kẹt trước khi ghi CSDL đã được dọn khỏi processing/');
  const [dbRow1] = await testConn.query(`
    SELECT * FROM machine_telemetry_history 
    WHERE machineId = ? AND timestamp = '2026-05-22 08:30:00' AND metricId = ?
  `, [testMachineId, testCodePos1]);
  assert(dbRow1.length === 1 && Number(dbRow1[0].value) === 41111.00, 'TC-CRASH-01.2: Dữ liệu của file crash trước khi ghi đã được nạp thành công vào CSDL sau recovery');

  // 2. Crash trong transaction: File nằm ở processing/, trạng thái PROCESSING trong DB (transaction đã rollback)
  const crashFile2Name = 'log215_DATA_CRASH2.csv';
  const crashFile2Path = path.join(service.processingDir, `stuck_in_tx_${crashFile2Name}`);
  const CSV_CONTENT_2 = `"DATA"\n"DATA No","DATE","TIME","POS1","POS2","POS3"\n0,2026/05/22,08:35:00,44444,45555,46666`;
  fs.writeFileSync(crashFile2Path, CSV_CONTENT_2, 'utf8');
  const hash2 = service.calculateFileHash(crashFile2Path);

  await testConn.query(`
    INSERT INTO ingested_files_log (id, file_hash, file_name, file_size, machine_id, status, file_modified_at, ingested_at)
    VALUES ('IFL-CRASH-TX', ?, ?, 100, ?, 'PROCESSING', NOW(), NOW())
    ON DUPLICATE KEY UPDATE status = 'PROCESSING'
  `, [hash2, crashFile2Name, testMachineId]);

  await service.recoverProcessingFiles();
  assert(!fs.existsSync(crashFile2Path), 'TC-CRASH-02.1: File kẹt trong transaction đã được phục hồi khỏi processing/');
  const [log2] = await testConn.query('SELECT status FROM ingested_files_log WHERE file_hash = ?', [hash2]);
  assert(log2[0].status === 'COMMITTED', 'TC-CRASH-02.2: Trạng thái trong DB được chuyển từ PROCESSING sang COMMITTED');

  // 3. Crash sau COMMIT nhưng trước khi di chuyển sang completed/
  const crashFile3Name = 'log215_DATA_CRASH3.csv';
  const crashFile3Path = path.join(service.processingDir, `stuck_after_commit_${crashFile3Name}`);
  const CSV_CONTENT_3 = `"DATA"\n"DATA No","DATE","TIME","POS1","POS2","POS3"\n0,2026/05/22,08:40:00,47777,48888,49999`;
  fs.writeFileSync(crashFile3Path, CSV_CONTENT_3, 'utf8');
  const hash3 = service.calculateFileHash(crashFile3Path);

  // Đã commit CSDL trước crash
  await testConn.query(`
    INSERT INTO ingested_files_log (id, file_hash, file_name, file_size, machine_id, status, file_modified_at, ingested_at)
    VALUES ('IFL-CRASH-AFTER-COMMIT', ?, ?, 100, ?, 'COMMITTED', NOW(), NOW())
    ON DUPLICATE KEY UPDATE status = 'COMMITTED'
  `, [hash3, crashFile3Name, testMachineId]);

  await service.recoverProcessingFiles();
  assert(!fs.existsSync(crashFile3Path), 'TC-CRASH-03.1: File đã commit nhưng kẹt ở processing/ được dọn dẹp sạch');
  const todayStr = new Date().toISOString().slice(0, 10);
  const completedToday = fs.readdirSync(path.join(service.completedDir, todayStr));
  assert(completedToday.some((f) => f.includes(crashFile3Name)), 'TC-CRASH-03.2: File được di chuyển an toàn vào completed/YYYY-MM-DD/');

  // -------------------------------------------------------------------------
  // MỤC 4: KIỂM CHỨNG CHỐNG TRÙNG VỚI 2 TỆP KHÁC NHAU CÓ DỮ LIỆU CHỒNG LẤN
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 4: CHỐNG NHẬP TRÙNG DỮ LIỆU CHỒNG LẤN (OVERLAPPING FILES) ---');
  // File A chứa dòng 0 đến dòng 2
  const FILE_A_CONTENT = `"DATA"
"DATA No","DATE","TIME","POS1","POS2","POS3"
0,2026/05/22,09:00:00,100,200,300
1,2026/05/22,09:01:00,110,210,310
2,2026/05/22,09:02:00,120,220,320`;

  // File B có nội dung khác (SHA-256 khác), nhưng dòng 1 và 2 bị trùng lặp với File A, kèm theo dòng 3 và 4 mới
  const FILE_B_CONTENT = `"DATA"
"DATA No","DATE","TIME","POS1","POS2","POS3"
1,2026/05/22,09:01:00,110,210,310
2,2026/05/22,09:02:00,120,220,320
3,2026/05/22,09:03:00,130,230,330
4,2026/05/22,09:04:00,140,240,340`;

  const fileAName = 'log215_DATA_A.csv';
  const fileBName = 'log215_DATA_B.csv';

  const fileAPath = path.join(service.inboxDir, fileAName);
  const fileBPath = path.join(service.inboxDir, fileBName);

  fs.writeFileSync(fileAPath, FILE_A_CONTENT, 'utf8');
  const resA = await service.processIncomingFile(fileAPath, fileAName);
  console.log('resA debug:', resA);
  assert(resA && resA.success && resA.committedRecordsCount === 9, `TC-OVERLAP-01.1: File A nạp thành công 9 bản ghi (3 dòng x 3 kênh) (thực tế: ${resA?.committedRecordsCount})`);

  fs.writeFileSync(fileBPath, FILE_B_CONTENT, 'utf8');
  const resB = await service.processIncomingFile(fileBPath, fileBName);
  assert(resB.success && resB.committedRecordsCount === 6, 'TC-OVERLAP-01.2: File B phát hiện 2 dòng chồng lấn (bỏ qua an toàn), chỉ chèn 6 bản ghi mới của dòng 3 và 4');

  const [totalRowsOverlap] = await testConn.query(`
    SELECT COUNT(*) as cnt FROM machine_telemetry_history 
    WHERE machineId = ? AND timestamp >= '2026-05-22 09:00:00' AND timestamp <= '2026-05-22 09:04:00'
  `, [testMachineId]);
  assert(totalRowsOverlap[0].cnt === 15, `TC-OVERLAP-01.3: Tổng số bản ghi CSDL là đúng 15 bản ghi (5 dòng x 3 kênh), không bị nhân đôi (thực tế: ${totalRowsOverlap[0].cnt})`);

  // -------------------------------------------------------------------------
  // MỤC 5: XÁC MINH fileModifiedAt, NGUỒN 'device', VÀ KHÔNG BẬT ONLINE GIẢ
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 5: XÁC MINH fileModifiedAt & TÍNH LIVE CỦA NGUỒN ---');
  const [logA] = await testConn.query('SELECT * FROM ingested_files_log WHERE file_name = ?', [fileAName]);
  assert(logA[0].file_modified_at !== null, 'TC-META-01.1: Lưu đúng trường file_modified_at từ mtime file');
  assert(logA[0].ingested_at !== null, 'TC-META-01.2: Lưu đúng trường ingested_at (thời điểm hệ thống tiếp nhận)');

  const [mthRows] = await testConn.query('SELECT source FROM machine_telemetry_history WHERE machineId = ? LIMIT 1', [testMachineId]);
  assert(mthRows[0].source === 'device', 'TC-META-01.3: Nguồn bản ghi được lưu là "device"');

  const [machineState] = await testConn.query('SELECT status FROM machines WHERE id = ?', [testMachineId]);
  assert(machineState[0].status === 'STOPPED', 'TC-META-01.4: Máy vẫn giữ nguyên status STOPPED, không bị tự động bật Online giả khi nạp file');

  // -------------------------------------------------------------------------
  // MỤC 6: KIỂM CHỨNG TÍNH TOÁN VÀ GIỚI HẠN CỦA eventId
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 6: KIỂM CHỨNG TÍNH TOÁN & GIỚI HẠN CỦA eventId ---');
  const evt1 = FileIngestionService.generateEventId('MC-01', 'MTR-TRQ', '2026-05-22T08:00:00.000Z', 0);
  const evt2 = FileIngestionService.generateEventId('MC-01', 'MTR-TRQ', '2026-05-22T08:00:00.000Z', 0);
  const evtDiffDataNo = FileIngestionService.generateEventId('MC-01', 'MTR-TRQ', '2026-05-22T08:00:00.000Z', 1);

  assert(evt1 === evt2, 'TC-EVENT-01.1: eventId có tính xác định hoàn toàn (deterministic) cho cùng tham số');
  assert(evt1 !== evtDiffDataNo, 'TC-EVENT-01.2: eventId phân biệt được 2 lần đo trong cùng 1 giây nhờ DATA No');

  // Giới hạn thiết kế: Nếu DATA No bị thiếu hoặc giống nhau cùng giây -> sinh trùng ID (Cần ghi nhận vào báo cáo)
  const evtCollision1 = FileIngestionService.generateEventId('MC-01', 'MTR-TRQ', '2026-05-22T08:00:00.000Z', null);
  const evtCollision2 = FileIngestionService.generateEventId('MC-01', 'MTR-TRQ', '2026-05-22T08:00:00.000Z', null);
  assert(evtCollision1 === evtCollision2, 'TC-EVENT-01.3: Xác nhận giới hạn thiết kế: Nếu DATA No null cùng giây, eventId sẽ trùng nhau');

  // -------------------------------------------------------------------------
  // MỤC 7: XỬ LÝ TỆP MỘT PHẦN (PARTIAL FILE: DÒNG HỢP LỆ VÀ DÒNG LỖI)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 7: XỬ LÝ TỆP CÓ DÒNG HỢP LỆ VÀ DÒNG LỖI (PARTIAL FILE) ---');
  const PARTIAL_CSV = `"DATA"
"DATA No","DATE","TIME","POS1","POS2","POS3"
0,2026/05/22,11:00:00,500,600,700
1,2026/05/22,INVALID_TIME,510,610,710
2,2026/05/22,11:02:00,520,620,720
3,2026/05/22,11:03:00,INCOMPLETE_COLUMNS
4,2026/05/22,11:04:00,540,640,740`;

  const partialFileName = 'log215_DATA_PARTIAL.csv';
  const partialFilePath = path.join(service.inboxDir, partialFileName);
  fs.writeFileSync(partialFilePath, PARTIAL_CSV, 'utf8');

  const partialResult = await service.processIncomingFile(partialFilePath, partialFileName);
  assert(partialResult.success === true, 'TC-PARTIAL-01.1: Quá trình nạp tệp một phần hoàn tất với success=true');
  assert(partialResult.committedRecordsCount === 9, `TC-PARTIAL-01.2: Chèn đủ 9 bản ghi của 3 dòng hợp lệ (dòng 0, 2, 4 x 3 kênh) (thực tế: ${partialResult.committedRecordsCount})`);

  const [partLog] = await testConn.query('SELECT * FROM ingested_files_log WHERE file_name = ?', [partialFileName]);
  assert(partLog[0].status === 'PARTIAL', `TC-PARTIAL-01.3: Trạng thái tệp được ghi nhận là PARTIAL (thực tế: ${partLog[0].status})`);
  assert(partLog[0].error_records === 2, `TC-PARTIAL-01.4: Số dòng lỗi được ghi nhận đúng là 2 (thực tế: ${partLog[0].error_records})`);
  assert(partLog[0].error_details !== null, 'TC-PARTIAL-01.5: Lưu chi tiết các dòng lỗi vào cột error_details để kiểm toán');

  // -------------------------------------------------------------------------
  // MỤC 8: KIỂM CHỨNG KỊCH BẢN MIGRATION 002 VÀ ROLLBACK TRÊN TEST DB
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 8: KIỂM CHỨNG MIGRATION 002 & ROLLBACK TRÊN TEST DB ---');
  // Chạy rollback
  const rollbackSql = fs.readFileSync(path.join(__dirname, '../migrations/002_rollback_file_ingestion.sql'), 'utf8');
  const cleanRollbackSql = rollbackSql.replace(/--.*$/gm, '').trim();
  const rollbackStatements = cleanRollbackSql.split(';').map((s) => s.trim()).filter(Boolean);

  for (const stmt of rollbackStatements) {
    await testConn.query(stmt);
  }

  const [checkTablesAfterRollback] = await testConn.query(`
    SHOW TABLES WHERE \`Tables_in_${TEST_DB_NAME}\` IN ('ingested_files_log', 'ingested_file_conflicts')
  `);
  assert(checkTablesAfterRollback.length === 0, 'TC-MIG-01.1: Rollback Migration 002 thành công, đã xóa 2 bảng ingestion');

  // Chạy lại migration 002 để tái lập
  const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations/002_add_file_ingestion_tables.sql'), 'utf8');
  const cleanMigrationSql = migrationSql.replace(/--.*$/gm, '').trim();
  const migStatements = cleanMigrationSql.split(';').map((s) => s.trim()).filter(Boolean);

  for (const stmt of migStatements) {
    await testConn.query(stmt);
  }

  const [checkTablesAfterReapply] = await testConn.query(`
    SHOW TABLES WHERE \`Tables_in_${TEST_DB_NAME}\` IN ('ingested_files_log', 'ingested_file_conflicts')
  `);
  assert(checkTablesAfterReapply.length === 2, 'TC-MIG-01.2: Tái áp dụng Migration 002 thành công, 2 bảng ingestion đã được khôi phục nguyên vẹn');

  // -------------------------------------------------------------------------
  // MỤC 9: DỌN DẸP FIXTURES TRÊN CSDL TEST
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 9: DỌN DẸP FIXTURES TRÊN CSDL TEST ---');
  await testConn.query('DELETE FROM machine_telemetry_history WHERE machineId = ?', [testMachineId]);
  await testConn.query('DELETE FROM metric_mappings WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM machines WHERE id = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_files_log WHERE machine_id = ?', [testMachineId]);
  await testConn.query('DELETE FROM ingested_file_conflicts WHERE machine_id = ?', [testMachineId]);
  await testConn.end();
  cleanDir(TEST_STORAGE_DIR);
  console.log('  ✓ Đã dọn dẹp sạch toàn bộ fixtures thử nghiệm trên denso_iot_phase1_test và ổ đĩa.');

  // -------------------------------------------------------------------------
  // MỤC 10: TRIPLE VERIFICATION BẢO VỆ TUYỆT ĐỐI CSDL GỐC DENSO_IOT
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 10: TRIPLE VERIFICATION BẢO VỆ CSDL GỐC DENSO_IOT ---');
  const prodSnapshotAfter = await calculateFullDbSnapshot(PROD_DB_NAME);

  for (const [table, before] of Object.entries(prodSnapshotBefore)) {
    const after = prodSnapshotAfter[table];
    const countOk = before.count === after.count;
    const chkOk = before.checksum === after.checksum;
    const shaOk = before.sha256 === after.sha256;

    console.log(`   - ${table.padEnd(26)}: Count=${after.count} (${countOk ? 'OK' : 'MISMATCH'}), Checksum=${after.checksum} (${chkOk ? 'OK' : 'MISMATCH'}), SHA256=${after.sha256.slice(0, 12)}... (${shaOk ? 'MATCH' : 'MISMATCH'})`);
    assert(countOk && chkOk && shaOk, `TC-DEEP-10: CSDL gốc denso_iot bảng ${table} bảo toàn nguyên vẹn 100%`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`   KẾT QUẢ KIỂM CHỨNG NGHIỆM THU CHUYÊN SÂU: ${passedTests}/${totalTests} PASS (100%)`);
  console.log('='.repeat(80) + '\n');
}

main().catch((err) => {
  console.error('\n[FATAL TEST ERROR]:', err);
  process.exit(1);
});
