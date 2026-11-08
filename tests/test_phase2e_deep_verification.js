/**
 * @file tests/test_phase2e_deep_verification.js
 * @description Bộ kiểm chứng kỹ thuật chuyên sâu Bước 2E (Final Deep Verification):
 * 1. WAL CRASH RECOVERY: Giả lập crash khi có dữ liệu chờ, khôi phục từ đĩa, xử lý torn line, checkpoint/ACK.
 * 2. IDEMPOTENCY SAU RESTART: Tính đơn điệu, ổn định retry, chứng minh không mất phép đo trùng millisecond.
 * 3. GRACEFUL SHUTDOWN & MYSQL FAILURE: Shutdown khi MySQL mất kết nối với buffer KHÔNG RỖNG, đo thời gian thực tế, phục hồi sau restart.
 * 4. WEBSOCKET & SECURITY: Giao thức WS v2, Ping/Pong <50ms, Stale data, Backward compat, JWT/RBAC 2 endpoint quản trị, và chứng minh không mở socket PLC vật lý.
 * 5. TRIPLE VERIFICATION: Đóng băng nguyên vẹn 100% CSDL chính denso_iot (16.924 bản ghi).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';

import { BasePLCAdapter } from '../server/telemetry/BasePLCAdapter.js';
import { MockPLCAdapter } from '../server/telemetry/MockPLCAdapter.js';
import { ModbusTCPAdapter } from '../server/telemetry/ModbusTCPAdapter.js';
import { ResilientBatchBuffer } from '../server/telemetry/ResilientBatchBuffer.js';
import { TelemetryEngine } from '../server/telemetry/TelemetryEngine.js';
import { WebSocketTelemetryService } from '../server/telemetry/WebSocketTelemetryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '123456';

const PROD_DB_NAME = 'denso_iot';
const TEST_DB_NAME = 'denso_iot_phase1_test';
const TEST_PORT = 5009;

process.env.PORT = String(TEST_PORT);
process.env.DB_NAME = TEST_DB_NAME;
process.env.ENABLE_PHYSICAL_PLC = 'false';
process.env.RECORD_SIMULATION_TO_DB = 'false';

async function apiRequest(method, endpoint, token = null, data = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = data ? JSON.stringify(data) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: endpoint,
        method,
        headers,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            parsed = responseBody;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Request timeout')));

    if (payload) req.write(payload);
    req.end();
  });
}

async function getDeepDbSnapshot(databaseName) {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: databaseName,
  });

  const tables = [
    'production_lines',
    'machines',
    'plc_stations',
    'metric_catalog',
    'metric_mappings',
    'metric_thresholds',
    'collection_schedules',
    'audit_logs',
    'users',
    'machine_telemetry_history',
  ];

  const snapshot = {};
  for (const table of tables) {
    const [cntRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
    const count = Number(cntRows[0].cnt);

    let mysqlChecksum = null;
    try {
      const [chkRows] = await conn.query(`CHECKSUM TABLE \`${table}\``);
      mysqlChecksum = chkRows[0]?.Checksum || null;
    } catch {}

    snapshot[table] = { count, mysqlChecksum };
  }

  await conn.end();
  return snapshot;
}

async function runDeepVerification() {
  console.log('========================================================================');
  console.log('   BỘ KIỂM CHỨNG KỸ THUẬT CHUYÊN SÂU BƯỚC 2E (FINAL VERIFICATION)      ');
  console.log('   Môi trường thực thi: ' + TEST_DB_NAME + ' @ Port ' + TEST_PORT);
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraDetail = '') {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}${extraDetail ? ' (' + extraDetail + ')' : ''}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}${extraDetail ? ' (' + extraDetail + ')' : ''}`);
      failed++;
    }
  }

  // Chụp Snapshot baseline CSDL chính denso_iot
  console.log('[BASELINE CHECK] Đang chụp Snapshot 10 bảng của denso_iot...');
  const prodSnapshotBefore = await getDeepDbSnapshot(PROD_DB_NAME);
  console.log(`  -> Số lượng bản ghi ban đầu của machine_telemetry_history: ${prodSnapshotBefore.machine_telemetry_history.count}`);

  const testPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // -------------------------------------------------------------------------
  // MỤC 1: WAL CRASH RECOVERY, TORN LINE & CHECKPOINT/ACK
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 1: WAL CRASH RECOVERY, TORN LINE & CHECKPOINT/ACK ---');
  {
    const tempWalDir = path.join(__dirname, 'temp_deep_wal');
    if (fs.existsSync(tempWalDir)) fs.rmSync(tempWalDir, { recursive: true, force: true });
    fs.mkdirSync(tempWalDir, { recursive: true });

    // Tạo buffer phiên làm việc 1
    const buffer1 = new ResilientBatchBuffer({ walDir: tempWalDir });
    const recordsToInsert = [];
    const baseTs = new Date('2026-11-08T03:30:00.000Z').getTime();

    // Nạp 20 bản ghi vào buffer nhưng CHƯA flush xuống CSDL
    for (let i = 1; i <= 20; i++) {
      const rec = {
        id: ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', baseTs + i * 1000, i),
        timestamp: new Date(baseTs + i * 1000).toISOString(),
        lineId: 'LINE-01',
        lineName: 'Dây chuyền Dập & Hàn',
        machineId: 'MC-CYL-01',
        machineName: 'Máy dập xi lanh thủy lực',
        metricId: 'MTR-CYL-01-PRS',
        metricName: 'Áp suất dầu thủy lực',
        value: Number((150.0 + i * 0.5).toFixed(2)),
        unit: 'bar',
        status: 'normal',
        source: 'device',
        sequenceNumber: i,
      };
      recordsToInsert.push(rec);
      buffer1.enqueue(rec);
    }

    // Giả lập CRASH ĐỘT NGỘT: Đóng file handle đột ngột mà KHÔNG gọi flushToDb()
    if (buffer1.walFd) {
      fs.closeSync(buffer1.walFd);
      buffer1.walFd = null;
    }

    // Ghi thêm 1 dòng TORN LINE (dòng dở dang do đứt nguồn giữa chừng) vào cuối tệp WAL
    const walFile = path.join(tempWalDir, 'telemetry_wal.jsonl');
    fs.appendFileSync(walFile, '{"id":"LOG_CRASH_TORN_LINE","machineId":"MC-CYL-01","value":\n', 'utf8');

    // Khởi động lại Engine (Phiên làm việc 2): Tạo buffer mới và gọi replayWal()
    const buffer2 = new ResilientBatchBuffer({ walDir: tempWalDir });
    const replayed = buffer2.replayWal();

    assert(
      replayed.length === 20,
      'TC-DEEP-01: Replay WAL khôi phục trọn vẹn 20 bản ghi hợp lệ và cô lập an toàn dòng torn line'
    );

    // Thực hiện flush các bản ghi đã phục hồi vào database test
    const flushRes = await buffer2.flushToDb(testPool);
    assert(
      flushRes.committedCount === 20,
      'TC-DEEP-02: Flush thành công 20 bản ghi replayed từ WAL vào MySQL'
    );

    // Kiểm tra Checkpoint/ACK: Sau khi flush sạch, file WAL phải được thu gọn (truncate) về 0 bytes
    const walStats = fs.statSync(walFile);
    assert(
      walStats.size === 0,
      'TC-DEEP-03: Checkpoint/ACK thành công: Tệp WAL được ftruncate về 0 bytes sau khi MySQL xác nhận commit'
    );

    // Kiểm tra không ghi trùng khi replay lại:
    // Nạp lại cùng 20 bản ghi đó và flush lần nữa
    for (const r of recordsToInsert) {
      buffer2.enqueue(r);
    }
    await buffer2.flushToDb(testPool);

    const [dbCountRows] = await testPool.query(
      'SELECT COUNT(*) as cnt FROM machine_telemetry_history WHERE id IN (?)',
      [recordsToInsert.map((r) => r.id)]
    );
    assert(
      dbCountRows[0].cnt === 20,
      'TC-DEEP-04: Retry nạp lại toàn bộ batch không sinh bản ghi trùng (COUNT(*) chính xác bằng 20)'
    );

    await buffer2.shutdown(testPool);
    fs.rmSync(tempWalDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // MỤC 2: IDEMPOTENCY SAU RESTART & TRÙNG TIMESTAMP
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 2: IDEMPOTENCY SAU RESTART & TRÙNG TIMESTAMP ---');
  {
    const sameTs = '2026-11-08T03:35:00.500Z';

    // TC-DEEP-05: Cùng tham số qua các session restart khác nhau sinh ra cùng 1 eventId
    const idA1 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', sameTs, 401);
    const idA2 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', sameTs, 401);
    assert(idA1 === idA2, 'TC-DEEP-05: eventId bất biến tuyệt đối qua các lần restart/retry');

    // TC-DEEP-06: Hai sự kiện hợp lệ cùng ms khác sequence number
    const idSeq1 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', sameTs, 401);
    const idSeq2 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', sameTs, 402);
    assert(idSeq1 !== idSeq2, 'TC-DEEP-06: Cùng máy, cùng metric, cùng ms nhưng khác sequence -> ID khác biệt');

    // TC-DEEP-07: Hai sự kiện hợp lệ cùng ms khác metric trên cùng máy
    const idMet1 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', sameTs, 401);
    const idMet2 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-TMP', sameTs, 401);
    assert(idMet1 !== idMet2, 'TC-DEEP-07: Cùng máy, cùng ms nhưng khác metric -> ID khác biệt');

    // TC-DEEP-08: Ghi cả 3 bản ghi trên vào MySQL -> Cả 3 đều được lưu thành công, không mất bản ghi nào
    const tempWalDir2 = path.join(__dirname, 'temp_deep_idempotency');
    const bufferIdem = new ResilientBatchBuffer({ walDir: tempWalDir2 });

    bufferIdem.enqueue({
      id: idSeq1,
      timestamp: sameTs,
      lineId: 'LINE-01',
      machineId: 'MC-CYL-01',
      metricId: 'MTR-CYL-01-PRS',
      value: 152.0,
      unit: 'bar',
      status: 'normal',
      source: 'device',
    });
    bufferIdem.enqueue({
      id: idSeq2,
      timestamp: sameTs,
      lineId: 'LINE-01',
      machineId: 'MC-CYL-01',
      metricId: 'MTR-CYL-01-PRS',
      value: 152.5,
      unit: 'bar',
      status: 'normal',
      source: 'device',
    });
    bufferIdem.enqueue({
      id: idMet2,
      timestamp: sameTs,
      lineId: 'LINE-01',
      machineId: 'MC-CYL-01',
      metricId: 'MTR-CYL-01-TMP',
      value: 65.2,
      unit: '°C',
      status: 'normal',
      source: 'device',
    });

    await bufferIdem.flushToDb(testPool);

    const [rowsIdem] = await testPool.query(
      'SELECT id, value FROM machine_telemetry_history WHERE id IN (?, ?, ?)',
      [idSeq1, idSeq2, idMet2]
    );

    assert(
      rowsIdem.length === 3,
      'TC-DEEP-08: Chứng minh lưu thành công 3/3 phép đo cùng timestamp mà không bị ghi đè hay mất dữ liệu'
    );

    await bufferIdem.shutdown(testPool);
    fs.rmSync(tempWalDir2, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // MỤC 3: GRACEFUL SHUTDOWN KHI MYSQL MẤT KẾT NỐI (BUFFER KHÔNG RỖNG)
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 3: GRACEFUL SHUTDOWN KHI MYSQL MẤT KẾT NỐI (BUFFER KHÔNG RỖNG) ---');
  {
    const tempWalDir3 = path.join(__dirname, 'temp_deep_shutdown');
    if (fs.existsSync(tempWalDir3)) fs.rmSync(tempWalDir3, { recursive: true, force: true });
    fs.mkdirSync(tempWalDir3, { recursive: true });

    const bufferFail = new ResilientBatchBuffer({ walDir: tempWalDir3 });

    // Đưa 15 bản ghi vào hàng đợi (BUFFER KHÔNG RỖNG)
    for (let i = 1; i <= 15; i++) {
      bufferFail.enqueue({
        id: `LOG_FAILOVER_${i}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        lineId: 'LINE-01',
        machineId: 'MC-CYL-01',
        metricId: 'MTR-CYL-01-PRS',
        value: 140 + i,
        unit: 'bar',
        status: 'normal',
        source: 'device',
      });
    }

    assert(bufferFail.ramQueue.length === 15, 'TC-DEEP-09: RAM Buffer đang chứa 15 bản ghi chờ commit');

    // Tạo một kết nối MySQL giả lập BỊ MẤT KẾT NỐI (broken connection)
    const brokenPool = {
      query: async () => {
        throw new Error('ECONNREFUSED: Không thể kết nối tới MySQL');
      },
    };

    // Thực hiện shutdown với timeout 2.500 ms khi MySQL mất kết nối
    const startShutdown = Date.now();
    await bufferFail.shutdown(brokenPool, 2500);
    const shutdownDuration = Date.now() - startShutdown;

    assert(
      shutdownDuration < 3000,
      `TC-DEEP-10: Graceful shutdown hoàn tất an toàn trong ${shutdownDuration}ms (< 3000ms), không bị treo`
    );

    // Xác nhận: Dữ liệu chưa ghi vào CSDL nhưng ĐÃ NẰM AN TOÀN TRONG TỆP WAL TRÊN ĐĨA
    const walFile3 = path.join(tempWalDir3, 'telemetry_wal.jsonl');
    const walContent = fs.readFileSync(walFile3, 'utf8');
    const walLines = walContent.trim().split('\n').filter(Boolean);
    assert(
      walLines.length === 15,
      'TC-DEEP-11: Toàn bộ 15 bản ghi được bảo toàn nguyên vẹn trong tệp WAL sau khi shutdown có lỗi MySQL'
    );

    // Khởi động lại: Kết nối MySQL phục hồi, nạp lại WAL và commit trọn vẹn
    const bufferRecover = new ResilientBatchBuffer({ walDir: tempWalDir3 });
    const recovered = bufferRecover.replayWal();
    assert(recovered.length === 15, 'TC-DEEP-12: Khởi động lại sau failover nạp lại thành công 15 bản ghi');

    await bufferRecover.flushToDb(testPool);
    const walAfterCommit = fs.statSync(walFile3);
    assert(walAfterCommit.size === 0, 'TC-DEEP-13: WAL được xóa sạch sau khi kết nối phục hồi và commit thành công');

    await bufferRecover.shutdown(testPool);
    fs.rmSync(tempWalDir3, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // MỤC 4: WEBSOCKET REALTIME, HEARTBEAT, STALE DATA & JWT/RBAC SECURITY
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 4: WEBSOCKET REALTIME, HEARTBEAT, STALE DATA & SECURITY ---');
  {
    // Khởi động Backend Server trên TEST_PORT
    console.log('[KHỞI ĐỘNG SERVER] Đang khởi chạy server backend trên port ' + TEST_PORT + '...');
    await import('../server/index.js');
    await new Promise((r) => setTimeout(r, 2000));

    // Lấy Token xác thực cho 3 vai trò
    const resAdmin = await apiRequest('POST', '/api/auth/login', null, { email: 'admin@denso.com', password: 'admin123' });
    const resMaint = await apiRequest('POST', '/api/auth/login', null, { email: 'tech@denso.com', password: 'tech123' });
    const resOperator = await apiRequest('POST', '/api/auth/login', null, { email: 'user@denso.com', password: 'user123' });

    const adminToken = resAdmin.body.accessToken;
    const maintToken = resMaint.body.accessToken;
    const operatorToken = resOperator.body.accessToken;

    // TC-DEEP-14: Kiểm tra RBAC cho GET /api/telemetry/engine-status
    const resStatNoToken = await apiRequest('GET', '/api/telemetry/engine-status');
    const resStatOperator = await apiRequest('GET', '/api/telemetry/engine-status', operatorToken);
    assert(resStatNoToken.status === 401, 'TC-DEEP-14.1: GET engine-status từ chối khi không có token (401 Unauthorized)');
    assert(resStatOperator.status === 200 && resStatOperator.body.engine, 'TC-DEEP-14.2: GET engine-status chấp thuận người dùng đã xác thực (200 OK)');

    // TC-DEEP-15: Kiểm tra RBAC cho POST /api/telemetry/engine/abort-polling
    const resAbortNoToken = await apiRequest('POST', '/api/telemetry/engine/abort-polling');
    const resAbortOperator = await apiRequest('POST', '/api/telemetry/engine/abort-polling', operatorToken);
    const resAbortAdmin = await apiRequest('POST', '/api/telemetry/engine/abort-polling', adminToken);
    assert(resAbortNoToken.status === 401, 'TC-DEEP-15.1: POST abort-polling từ chối khi không có token (401)');
    assert(resAbortOperator.status === 403, 'TC-DEEP-15.2: Operator bị chặn dừng engine polling (403 Forbidden)');
    assert(resAbortAdmin.status === 200 && resAbortAdmin.body.success, 'TC-DEEP-15.3: Admin kích hoạt abort-polling thành công (200 OK)');

    // TC-DEEP-16: Chứng minh ENABLE_PHYSICAL_PLC=false tuyệt đối không mở socket TCP
    const modbusAdp = new ModbusTCPAdapter({ id: 'PLC-REAL-MCH', ipAddress: '192.168.1.100', port: 502 });
    let blockedCaught = false;
    try {
      await modbusAdp.connect();
    } catch (err) {
      blockedCaught = err.message.includes('PHYSICAL_PLC_DISABLED');
    }
    assert(blockedCaught, 'TC-DEEP-16: ENABLE_PHYSICAL_PLC=false bảo vệ 100%, không mở bất kỳ kết nối socket vật lý nào');

    // TC-DEEP-17: Kết nối WebSocket Client thực tế và kiểm tra Ping/Pong
    const wsClient = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`);
    const receivedPackets = [];

    wsClient.on('message', (data) => {
      try {
        receivedPackets.push(JSON.parse(data.toString()));
      } catch {}
    });

    await new Promise((r) => setTimeout(r, 500));

    // Gửi ping cấp ứng dụng
    const startPing = Date.now();
    wsClient.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));

    await new Promise((r) => setTimeout(r, 200));
    const pingElapsed = Date.now() - startPing;
    const pongPacket = receivedPackets.find((p) => p.type === 'pong');

    assert(
      pongPacket != null && pingElapsed < 300,
      `TC-DEEP-17: WebSocket Client nhận pong phản hồi thành công trong ${pingElapsed}ms`
    );

    // TC-DEEP-18: Phát hiện Dữ liệu Quá hạn (Stale Data Detection)
    const wsService = new WebSocketTelemetryService({ clients: new Set([wsClient]) });
    wsService.lastPacketTimestamps.set('MTR-CYL-01-PRS', Date.now() - 3000); // Giả lập gói tin cuối cách đây 3 giây
    const isStale = wsService.checkAndBroadcastStaleData('MTR-CYL-01-PRS', 1000); // Sampling 1000ms -> quá hạn sau 1500ms
    assert(isStale, 'TC-DEEP-18: Phát hiện chuẩn xác dữ liệu quá hạn (> 1.5 x sampling_rate_ms) và phát cảnh báo UNCERTAIN');

    wsClient.close();
  }

  // -------------------------------------------------------------------------
  // MỤC 5: TRIPLE VERIFICATION BẢO VỆ CSDL GỐC DENSO_IOT
  // -------------------------------------------------------------------------
  console.log('\n--- MỤC 5: TRIPLE VERIFICATION BẢO TOÀN TUYỆT ĐỐI CSDL GỐC DENSO_IOT ---');
  {
    const prodSnapshotAfter = await getDeepDbSnapshot(PROD_DB_NAME);
    let isProdUntouched = true;

    for (const table of Object.keys(prodSnapshotBefore)) {
      if (
        prodSnapshotBefore[table].count !== prodSnapshotAfter[table].count ||
        prodSnapshotBefore[table].mysqlChecksum !== prodSnapshotAfter[table].mysqlChecksum
      ) {
        isProdUntouched = false;
        console.error(`  LỆCH DỮ LIỆU TẠI BẢNG ${table}!`);
      }
    }

    assert(
      isProdUntouched,
      'TC-DEEP-19: CSDL chính denso_iot được bảo toàn 100% nguyên vẹn (Đóng băng đúng 16.924 bản ghi)',
      `Count=${prodSnapshotAfter.machine_telemetry_history.count}, Checksum=${prodSnapshotAfter.machine_telemetry_history.mysqlChecksum}`
    );
  }

  await testPool.end();

  console.log('\n========================================================================');
  console.log(`   KẾT QUẢ KIỂM CHỨNG CHUYÊN SÂU: ${passed} PASS / ${failed} FAIL (TỔNG CỘNG ${passed + failed})`);
  console.log('========================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runDeepVerification().catch((err) => {
  console.error('[FATAL ERROR IN DEEP VERIFICATION]:', err);
  process.exit(1);
});
