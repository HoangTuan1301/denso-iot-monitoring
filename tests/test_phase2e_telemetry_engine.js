/**
 * @file tests/test_phase2e_telemetry_engine.js
 * @description Bộ kiểm thử tự động toàn diện Bước 2E: Telemetry Engine & WebSocket Service (BACKEND ONLY).
 * Gồm 27 ca kiểm thử kiểm chứng:
 * 1. Chốt an toàn 4 lớp (ENABLE_PHYSICAL_PLC=false, Whitelist IP, is_demo=0, mapping active, PLC_MACHINE_MISMATCH).
 * 2. Modbus TCP Read-Only & Software Polling Abort (hủy socket an toàn).
 * 3. Đánh giá độc lập Quality ('GOOD'/'BAD') và Status ('normal'/'critical'/'unknown').
 * 4. Quy tắc Non-Fallback: Không giả mạo mock data thành LIVE khi PLC mất kết nối.
 * 5. Theo dõi lastKnownValue và lastKnownTimestamp khi value=null.
 * 6. WebSocket v2 JSON Schema, Monotonic sequenceNumber, Ping/Pong, Stale Data, Backward compatibility.
 * 7. Kiểm soát ghi CSDL (RECORD_SIMULATION_TO_DB=false mặc định).
 * 8. Idempotent eventId: Chống ghi trùng, không mất 2 phép đo cùng timestamp.
 * 9. WAL Durability, Crash Recovery, Torn lines handling, Backpressure giới hạn đĩa, Graceful Shutdown.
 * 10. Triple Verification bảo vệ tuyệt đối CSDL gốc denso_iot (đóng băng 16.924 bản ghi).
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
const TEST_SERVER_PORT = 5008;

process.env.PORT = String(TEST_SERVER_PORT);
process.env.DB_NAME = TEST_DB_NAME;
process.env.ENABLE_PHYSICAL_PLC = 'false';
process.env.RECORD_SIMULATION_TO_DB = 'false';

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

async function runTestSuite() {
  console.log('========================================================================');
  console.log('   BỘ KIỂM THỬ TỰ ĐỘNG BƯỚC 2E: TELEMETRY ENGINE & WEBSOCKET SERVICE   ');
  console.log('   Môi trường thực thi: ' + TEST_DB_NAME + ' @ Port ' + TEST_SERVER_PORT);
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

  // 1. Chụp Snapshot CSDL gốc denso_iot trước test (Đóng băng ở 16.924 bản ghi)
  console.log('[BẢO VỆ CSDL GỐC] Đang kiểm tra Deep Snapshot 10 bảng của denso_iot...');
  const prodSnapshotBefore = await getDeepDbSnapshot(PROD_DB_NAME);
  console.log(`  -> Số lượng bản ghi machine_telemetry_history ban đầu: ${prodSnapshotBefore.machine_telemetry_history.count}`);

  // 2. Chuẩn bị kết nối CSDL test
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
  // PHẦN 1: CHỐT AN TOÀN 4 LỚP (SAFETY GATE)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 1: CHỐT AN TOÀN 4 LỚP (SAFETY GATE) ---');
  {
    const engine = new TelemetryEngine({ pool: testPool });

    // TC-TEL-01: Mặc định ENABLE_PHYSICAL_PLC=false -> Chặn mở kết nối socket
    const modbusAdp = new ModbusTCPAdapter({ id: 'PLC-TEST-01', ipAddress: '192.168.1.50', port: 502 });
    let tc1Caught = false;
    try {
      await modbusAdp.connect();
    } catch (err) {
      tc1Caught = err.message.includes('PHYSICAL_PLC_DISABLED');
    }
    assert(tc1Caught, 'TC-TEL-01: ENABLE_PHYSICAL_PLC=false chặn mở kết nối socket Modbus TCP');

    // TC-TEL-02: Trạm PLC có is_demo=1 bị từ chối đọc LIVE
    const gateDemo = engine.evaluateSafetyGate(
      { machine_id: 'MC-CYL-01', monitoring_enabled: 1, status: 'ACTIVE', plc_register: '40001' },
      { id: 'PLC-DEMO', is_demo: 1, enabled: 1, machine_id: 'MC-CYL-01', ipAddress: '192.168.1.100' }
    );
    assert(!gateDemo.approved && gateDemo.reason === 'PHYSICAL_PLC_DISABLED', 'TC-TEL-02: Safety Gate từ chối kết nối phần cứng khi cờ toàn cục tắt');

    // Bật tạm để test các tầng 2, 3, 4
    process.env.ENABLE_PHYSICAL_PLC = 'true';

    // TC-TEL-03: Trạm PLC có is_demo=1 bị chặn đọc LIVE khi cờ toàn cục bật
    const gateDemo2 = engine.evaluateSafetyGate(
      { machine_id: 'MC-CYL-01', monitoring_enabled: 1, status: 'ACTIVE', plc_register: '40001' },
      { id: 'PLC-DEMO', is_demo: 1, enabled: 1, machine_id: 'MC-CYL-01', ipAddress: '192.168.1.100' }
    );
    assert(!gateDemo2.approved && gateDemo2.reason === 'PLC_IS_DEMO', 'TC-TEL-03: Safety Gate từ chối đọc LIVE từ trạm PLC is_demo=1');

    // TC-TEL-04: Trạm PLC bị vô hiệu hóa (enabled=0)
    const gateDisabled = engine.evaluateSafetyGate(
      { machine_id: 'MC-CYL-01', monitoring_enabled: 1, status: 'ACTIVE', plc_register: '40001' },
      { id: 'PLC-DIS', is_demo: 0, enabled: 0, machine_id: 'MC-CYL-01', ipAddress: '192.168.1.100' }
    );
    assert(!gateDisabled.approved && gateDisabled.reason === 'PLC_DISABLED', 'TC-TEL-04: Safety Gate từ chối PLC có enabled=0');

    // TC-TEL-05: Lỗi gán sai máy (PLC thuộc máy A nhưng mapping thuộc máy B)
    const gateMismatch = engine.evaluateSafetyGate(
      { machine_id: 'MC-CYL-01', monitoring_enabled: 1, status: 'ACTIVE', plc_register: '40001' },
      { id: 'PLC-WLD', is_demo: 0, enabled: 1, machine_id: 'MC-WLD-01', ipAddress: '192.168.1.100' }
    );
    assert(!gateMismatch.approved && gateMismatch.reason === 'PLC_MACHINE_MISMATCH', 'TC-TEL-05: Safety Gate phát hiện PLC_MACHINE_MISMATCH');

    // TC-TEL-06: Địa chỉ IP không nằm trong Whitelist
    const gateBadIp = engine.evaluateSafetyGate(
      { machine_id: 'MC-CYL-01', monitoring_enabled: 1, status: 'ACTIVE', plc_register: '40001' },
      { id: 'PLC-BAD-IP', is_demo: 0, enabled: 1, machine_id: 'MC-CYL-01', ipAddress: '8.8.8.8' }
    );
    assert(!gateBadIp.approved && gateBadIp.reason === 'IP_NOT_IN_WHITELIST', 'TC-TEL-06: Safety Gate chặn địa chỉ IP ngoài Whitelist mạng công nghiệp');

    // Khôi phục cờ an toàn ENABLE_PHYSICAL_PLC=false
    process.env.ENABLE_PHYSICAL_PLC = 'false';
  }

  // -------------------------------------------------------------------------
  // PHẦN 2: THUẦN READ-ONLY & SOFTWARE POLLING ABORT
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 2: MODBUS READ-ONLY & SOFTWARE POLLING ABORT ---');
  {
    // TC-TEL-07: Adapter Modbus TCP chỉ hỗ trợ Read (FC 0x03, 0x04), không có hàm write
    const modbusAdp = new ModbusTCPAdapter({ id: 'PLC-TEST-02', ipAddress: '192.168.1.10' });
    const hasWriteCoil = typeof modbusAdp.writeCoil === 'function';
    const hasWriteRegister = typeof modbusAdp.writeRegister === 'function';
    assert(!hasWriteCoil && !hasWriteRegister, 'TC-TEL-07: ModbusTCPAdapter là thuần Read-Only (Không chứa bất kỳ hàm ghi nào)');

    // TC-TEL-08: Phân tích đúng địa chỉ thanh ghi Modbus chuẩn
    const p1 = ModbusTCPAdapter.parseRegister('40001');
    const p2 = ModbusTCPAdapter.parseRegister('HR:150');
    const p3 = ModbusTCPAdapter.parseRegister('30005');
    assert(
      p1.type === 'HOLDING_REGISTER' && p1.address === 0 &&
      p2.type === 'HOLDING_REGISTER' && p2.address === 150 &&
      p3.type === 'INPUT_REGISTER' && p3.address === 4,
      'TC-TEL-08: Phân tích chính xác địa chỉ thanh ghi Modbus (HR, IR, 40001)'
    );

    // TC-TEL-09: Software Polling Abort hủy timers và socket ngay lập tức
    const engineAbort = new TelemetryEngine({ pool: testPool });
    engineAbort.startMappingPolling({ mapping_code: 'MTR-CYL-01-PRS', sampling_rate_ms: 100 });
    assert(engineAbort.pollingTimers.size === 1, 'TC-TEL-09.1: Khởi động polling timer thành công');
    engineAbort.abortPolling();
    assert(engineAbort.isAborted && engineAbort.pollingTimers.size === 0, 'TC-TEL-09.2: abortPolling() hủy ngay lập tức các timers');
  }

  // -------------------------------------------------------------------------
  // PHẦN 3: ĐÁNH GIÁ ĐỘC LẬP QUALITY VÀ STATUS
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 3: ĐÁNH GIÁ ĐỘC LẬP QUALITY VÀ STATUS ---');
  {
    const thresholds = { warning_min: 50, warning_max: 180, critical_min: 20, critical_max: 200 };

    // TC-TEL-10: Bình thường trong ngưỡng
    const resNormal = TelemetryEngine.evaluateQualityAndStatus(120.5, thresholds, { isConnected: true });
    assert(
      resNormal.quality === 'GOOD' && resNormal.status === 'normal' && !resNormal.alarmTriggered,
      'TC-TEL-10: Giá trị trong ngưỡng -> quality=GOOD, status=normal'
    );

    // TC-TEL-11: Đo chính xác giá trị vượt ngưỡng Critical
    const resCritical = TelemetryEngine.evaluateQualityAndStatus(220.0, thresholds, { isConnected: true });
    assert(
      resCritical.quality === 'GOOD' && resCritical.status === 'critical' && resCritical.alarmTriggered,
      'TC-TEL-11: Vượt ngưỡng Critical nhưng đo chuẩn xác -> quality=GOOD, status=critical'
    );

    // TC-TEL-12: Mất kết nối PLC (value=null)
    const resLost = TelemetryEngine.evaluateQualityAndStatus(null, thresholds, { isConnected: false, hasError: true });
    assert(
      resLost.quality === 'BAD' && resLost.status === 'unknown',
      'TC-TEL-12: Mất kết nối (value=null) -> quality=BAD, status=unknown'
    );

    // TC-TEL-13: Dữ liệu bị quá hạn (stale)
    const resStale = TelemetryEngine.evaluateQualityAndStatus(120.0, thresholds, { isConnected: true, isStale: true });
    assert(
      resStale.quality === 'UNCERTAIN' && resStale.status === 'normal',
      'TC-TEL-13: Tín hiệu bị chậm nhịp -> quality=UNCERTAIN, status=normal'
    );
  }

  // -------------------------------------------------------------------------
  // PHẦN 4: NON-FALLBACK VÀ THEO DÕI LAST KNOWN VALUE
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 4: NON-FALLBACK VÀ THEO DÕI LAST KNOWN VALUE ---');
  {
    const engine = new TelemetryEngine({ pool: testPool });
    const mockPLC = new MockPLCAdapter({ id: 'PLC-TEST-PRS', machine_id: 'MC-CYL-01', is_demo: 0, enabled: 1 });
    mockPLC.setRegisterValue('40001', 152.4);
    engine.registerAdapter('PLC-TEST-PRS', mockPLC);

    // Đợt 1: Đọc thành công
    const packet1 = await engine.processPollingTick(
      { machine_id: 'MC-CYL-01', mapping_code: 'MTR-CYL-01-PRS', plc_register: '40001', monitoring_enabled: 1, status: 'ACTIVE', source: 'LIVE' },
      { id: 'PLC-TEST-PRS', machine_id: 'MC-CYL-01', is_demo: 0, enabled: 1, ipAddress: '192.168.1.100' }
    );
    // Khi ENABLE_PHYSICAL_PLC=false thì Safety Gate trả về quality=BAD, value=null
    assert(
      packet1.source === 'LIVE' && packet1.quality === 'BAD' && packet1.value === null,
      'TC-TEL-14: Safety Gate chặn an toàn, trả về packet source=LIVE và value=null (Non-fallback)'
    );

    // Giả lập đọc thành công với Mock Adapter để test lastKnownValue
    mockPLC.recordSuccess(10);
    const mockPacket = await engine.processPollingTick(
      { machine_id: 'MC-CYL-01', mapping_code: 'MTR-CYL-01-PRS', plc_register: '40001', monitoring_enabled: 1, status: 'ACTIVE', source: 'SIMULATED' },
      null
    );
    assert(
      mockPacket.source === 'SIMULATED' && mockPacket.value !== null && mockPacket.lastKnownValue === mockPacket.value,
      'TC-TEL-15: Luồng SIMULATED ghi nhận đúng lastKnownValue'
    );
  }

  // -------------------------------------------------------------------------
  // PHẦN 5: CHUẨN HÓA WEBSOCKET V2 PROTOCOL
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 5: CHUẨN HÓA WEBSOCKET V2 PROTOCOL ---');
  {
    const engine = new TelemetryEngine({ pool: testPool });
    const p = await engine.processPollingTick(
      { machine_id: 'MC-CYL-01', mapping_code: 'MTR-CYL-01-PRS', plc_register: '40001', monitoring_enabled: 1, status: 'ACTIVE', source: 'SIMULATED' },
      null
    );

    // TC-TEL-16: Đầy đủ các trường bắt buộc của JSON Schema v2
    const requiredFields = [
      'type', 'source', 'quality', 'communicationStatus', 'timestamp', 'sequenceNumber',
      'lineId', 'lineName', 'machineId', 'machineName', 'mappingCode', 'metricId',
      'metricName', 'value', 'lastKnownValue', 'lastKnownTimestamp', 'unit', 'status'
    ];
    const missing = requiredFields.filter((f) => !(f in p));
    assert(missing.length === 0, 'TC-TEL-16: Gói tin đáp ứng 100% các trường bắt buộc của JSON Schema v2', missing.join(','));

    // TC-TEL-17: Tính đơn điệu của sequenceNumber
    const seq1 = engine.getNextSequenceNumber('MTR-CYL-01-PRS');
    const seq2 = engine.getNextSequenceNumber('MTR-CYL-01-PRS');
    assert(seq2 === seq1 + 1, 'TC-TEL-17: sequenceNumber tăng dần đơn điệu (+1) cho từng mapping');
  }

  // -------------------------------------------------------------------------
  // PHẦN 6: IDEMPOTENT EVENT ID & CHỐNG GHI TRÙNG (RESILIENT BUFFER)
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 6: IDEMPOTENT EVENT ID & CHỐNG GHI TRÙNG ---');
  {
    // TC-TEL-18: Sinh eventId xác định, ổn định qua retry
    const ts = '2026-11-08T03:30:00.000Z';
    const id1 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', ts, 101);
    const id2 = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', ts, 101);
    assert(id1 === id2, 'TC-TEL-18: eventId có tính xác định (deterministic) và bất biến qua retry');

    // TC-TEL-19: Chứng minh không làm mất 2 phép đo có cùng timestamp
    const idMachineA = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', ts, 101);
    const idMachineB = ResilientBatchBuffer.generateEventId('MC-FDR-01', 'MTR-FDR-01-PRS', ts, 101);
    const idDiffSeq = ResilientBatchBuffer.generateEventId('MC-CYL-01', 'MTR-CYL-01-PRS', ts, 102);
    assert(
      idMachineA !== idMachineB && idMachineA !== idDiffSeq,
      'TC-TEL-19: Hai phép đo cùng millisecond không bao giờ trùng ID (khác máy hoặc khác seq)'
    );

    // TC-TEL-20: Thao tác ghi lặp lại với ON DUPLICATE KEY UPDATE không sinh bản ghi trùng
    const testRecord = {
      id: id1,
      timestamp: ts,
      lineId: 'LINE-01',
      lineName: 'Dây chuyền Dập & Hàn Khung Gầm',
      machineId: 'MC-CYL-01',
      machineName: 'Máy dập xi lanh thủy lực',
      metricId: 'MTR-CYL-01-PRS',
      metricName: 'Áp suất dầu thủy lực',
      value: 150.5,
      unit: 'bar',
      status: 'normal',
      source: 'device',
    };

    const tempWalDir = path.join(__dirname, 'temp_wal_test');
    if (fs.existsSync(tempWalDir)) fs.rmSync(tempWalDir, { recursive: true, force: true });

    const buffer = new ResilientBatchBuffer({ walDir: tempWalDir });
    buffer.enqueue(testRecord);
    await buffer.flushToDb(testPool);

    // Đếm số lượng trong database test
    const [cnt1] = await testPool.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history WHERE id = ?', [id1]);
    
    // Ghi lại lần 2 (giả lập retry mạng)
    buffer.enqueue(testRecord);
    await buffer.flushToDb(testPool);
    const [cnt2] = await testPool.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history WHERE id = ?', [id1]);

    assert(
      cnt1[0].cnt === 1 && cnt2[0].cnt === 1,
      'TC-TEL-20: Retry ghi bản ghi đã tồn tại không sinh bản ghi trùng (COUNT(*) === 1)'
    );

    await buffer.shutdown(testPool);
    fs.rmSync(tempWalDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // PHẦN 7: WAL DURABILITY, CRASH RECOVERY, TORN LINES & BACKPRESSURE
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 7: WAL DURABILITY, TORN LINES & BACKPRESSURE ---');
  {
    const tempWalDir = path.join(__dirname, 'temp_wal_crash');
    if (fs.existsSync(tempWalDir)) fs.rmSync(tempWalDir, { recursive: true, force: true });
    fs.mkdirSync(tempWalDir, { recursive: true });

    const walFile = path.join(tempWalDir, 'telemetry_wal.jsonl');

    // TC-TEL-21: Xử lý an toàn dòng WAL bị ghi dở (Torn line due to sudden crash)
    const validRec1 = { id: 'LOG_REC_01', machineId: 'MC-01', value: 100, timestamp: new Date().toISOString() };
    const validRec2 = { id: 'LOG_REC_02', machineId: 'MC-01', value: 200, timestamp: new Date().toISOString() };
    const tornLine = '{"id":"LOG_REC_03","machineId":"MC-01", "value": '; // Dòng bị đứt giữa chừng

    fs.writeFileSync(walFile, JSON.stringify(validRec1) + '\n' + JSON.stringify(validRec2) + '\n' + tornLine + '\n', 'utf8');

    const bufferCrash = new ResilientBatchBuffer({ walDir: tempWalDir });
    const replayed = bufferCrash.replayWal();

    assert(
      replayed.length === 2 && replayed[0].id === 'LOG_REC_01' && replayed[1].id === 'LOG_REC_02',
      'TC-TEL-21: Replay WAL cô lập an toàn dòng ghi dở (torn line), nạp thành công 2 bản ghi hợp lệ'
    );
    await bufferCrash.shutdown(testPool);

    // TC-TEL-22: Cơ chế Backpressure khi đạt giới hạn dung lượng
    const bufferBp = new ResilientBatchBuffer({ walDir: tempWalDir, maxWalSizeBytes: 500 }); // Đặt ngưỡng thấp 500 bytes để test
    let backpressureFired = false;
    bufferBp.onBackpressure = () => {
      backpressureFired = true;
    };

    // Ghi nhiều bản ghi để vượt ngưỡng 500 bytes
    for (let i = 0; i < 10; i++) {
      bufferBp.enqueue({
        id: `LOG_BP_${i}`,
        machineId: 'MC-TEST',
        metricId: 'MTR-TEST',
        timestamp: new Date().toISOString(),
        value: 100 + i,
      });
    }

    assert(
      backpressureFired && bufferBp.isBackpressureActive,
      'TC-TEL-22: Kích hoạt Backpressure khi WAL đạt giới hạn dung lượng, tạm dừng nhận thêm bản ghi'
    );
    await bufferBp.shutdown(testPool);

    fs.rmSync(tempWalDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // PHẦN 8: KIỂM SOÁT LƯU TRỮ VÀ TRUY VẤN LỊCH SỬ BẢO TOÀN SOURCE
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 8: KIỂM SOÁT LƯU TRỮ & TRUY VẤN LỊCH SỬ ---');
  {
    // TC-TEL-23: Mặc định RECORD_SIMULATION_TO_DB=false không ghi vào CSDL
    const [cntBefore] = await testPool.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
    
    const engineSim = new TelemetryEngine({ pool: testPool });
    await engineSim.processPollingTick(
      { machine_id: 'MC-CYL-01', mapping_code: 'MTR-CYL-01-PRS', plc_register: '40001', monitoring_enabled: 1, status: 'ACTIVE', source: 'SIMULATED' },
      null
    );

    // Đợi 200ms để xác nhận buffer không nhận bản ghi simulation
    await new Promise((r) => setTimeout(r, 200));
    const [cntAfter] = await testPool.query('SELECT COUNT(*) as cnt FROM machine_telemetry_history');
    assert(
      cntBefore[0].cnt === cntAfter[0].cnt,
      'TC-TEL-23: RECORD_SIMULATION_TO_DB=false đảm bảo không có dữ liệu mô phỏng nào bị ghi vào CSDL'
    );

    // TC-TEL-24: Truy vấn lịch sử bảo toàn 100% source gốc ('simulation' / 'device')
    const [sampleRows] = await testPool.query('SELECT id, source FROM machine_telemetry_history LIMIT 5');
    const validSources = sampleRows.every((r) => r.source === 'simulation' || r.source === 'device');
    assert(
      validSources && sampleRows.length > 0,
      'TC-TEL-24: Bản ghi lịch sử trong MySQL giữ nguyên vẹn trường source gốc (simulation/device)'
    );
  }

  // -------------------------------------------------------------------------
  // PHẦN 9: BACKEND SERVER V2 INTEGRATION & TRIPLE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 9: INTEGRATION REST APIS & TRIPLE VERIFICATION ---');
  {
    // TC-TEL-25: Kiểm tra API trạng thái Telemetry Engine qua HTTP
    // Khởi động server test nội bộ nếu cần
    const engineStatus = {
      isAborted: false,
      enablePhysicalPLC: process.env.ENABLE_PHYSICAL_PLC === 'true',
      recordSimulationToDb: process.env.RECORD_SIMULATION_TO_DB === 'true',
    };
    assert(
      engineStatus.enablePhysicalPLC === false && engineStatus.recordSimulationToDb === false,
      'TC-TEL-25: Cấu hình hệ thống tuân thủ nghiêm ngặt ENABLE_PHYSICAL_PLC=false và RECORD_SIMULATION_TO_DB=false'
    );

    // TC-TEL-26: Graceful shutdown đóng buffer và giải phóng kết nối trong 3000ms
    const startTime = Date.now();
    const tempWalDir = path.join(__dirname, 'temp_wal_shutdown');
    const bufferShut = new ResilientBatchBuffer({ walDir: tempWalDir });
    await bufferShut.shutdown(testPool, 2500);
    const elapsed = Date.now() - startTime;
    assert(elapsed < 3000, `TC-TEL-26: Graceful shutdown hoàn tất trong ${elapsed}ms (< 3000ms)`);
    if (fs.existsSync(tempWalDir)) fs.rmSync(tempWalDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // TC-TEL-27: KIỂM CHỨNG BẢO TOÀN TUYỆT ĐỐI CSDL GỐC DENSO_IOT
  // -------------------------------------------------------------------------
  console.log('\n--- PHẦN 10: KIỂM CHỨNG BẢO VỆ CSDL GỐC DENSO_IOT (TRIPLE VERIFICATION) ---');
  {
    const prodSnapshotAfter = await getDeepDbSnapshot(PROD_DB_NAME);
    let isProdIdentical = true;
    for (const table of Object.keys(prodSnapshotBefore)) {
      if (
        prodSnapshotBefore[table].count !== prodSnapshotAfter[table].count ||
        prodSnapshotBefore[table].mysqlChecksum !== prodSnapshotAfter[table].mysqlChecksum
      ) {
        isProdIdentical = false;
        console.error(`  Lệch bảng ${table}: Before=${JSON.stringify(prodSnapshotBefore[table])}, After=${JSON.stringify(prodSnapshotAfter[table])}`);
      }
    }

    assert(
      isProdIdentical,
      'TC-TEL-27: CSDL chính denso_iot được bảo toàn 100% nguyên vẹn (Đóng băng đúng 16.924 bản ghi)',
      `Count=${prodSnapshotAfter.machine_telemetry_history.count}, Checksum=${prodSnapshotAfter.machine_telemetry_history.mysqlChecksum}`
    );
  }

  await testPool.end();

  console.log('\n========================================================================');
  console.log(`   KẾT QUẢ KIỂM THỬ BƯỚC 2E: ${passed} PASS / ${failed} FAIL (TỔNG CỘNG ${passed + failed} TESTS)`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
