/**
 * @file TelemetryEngine.js
 * @description Động cơ điều phối Telemetry trung tâm cho hệ thống DENSO Industrial IoT.
 * Tích hợp Chốt an toàn 4 lớp, đánh giá độc lập Quality / Status / CommunicationStatus,
 * quản lý chu kỳ Polling theo Schedule (fallback sampling_rate_ms),
 * chống ghi đè dữ liệu mô phỏng vào CSDL (RECORD_SIMULATION_TO_DB=false),
 * và cơ chế Dừng thu thập phần mềm (Software Polling Abort).
 */

import { MockPLCAdapter } from './MockPLCAdapter.js';
import { ModbusTCPAdapter } from './ModbusTCPAdapter.js';
import { ResilientBatchBuffer } from './ResilientBatchBuffer.js';

export class TelemetryEngine {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.pool = options.pool || null;
    this.buffer = options.buffer || new ResilientBatchBuffer();
    this.onTelemetryPacket = options.onTelemetryPacket || null; // Callback phát sóng WebSocket

    this.adapters = new Map(); // plcId -> PLCAdapter
    this.mappings = new Map(); // mappingCode -> mappingConfig
    this.pollingTimers = new Map(); // mappingCode -> intervalTimer
    this.sequenceCounters = new Map(); // mappingCode -> monotonic integer
    this.lastKnownStates = new Map(); // mappingCode -> { lastKnownValue, lastKnownTimestamp }

    this.isAborted = false;
    this.allowedSubnets = options.allowedSubnets || ['192.168.', '10.', '127.0.0.1', 'localhost'];
  }

  /**
   * Đăng ký một Adapter cho trạm PLC
   * @param {string} plcId
   * @param {Object} adapter
   */
  registerAdapter(plcId, adapter) {
    this.adapters.set(plcId, adapter);
  }

  /**
   * Lấy Adapter của trạm PLC
   * @param {string} plcId
   * @returns {Object|null}
   */
  getAdapter(plcId) {
    return this.adapters.get(plcId) || null;
  }

  /**
   * Lấy số thứ tự gói tin đơn điệu (Monotonic Sequence Number) cho từng Mapping
   * @param {string} mappingCode
   * @returns {number}
   */
  getNextSequenceNumber(mappingCode) {
    const current = this.sequenceCounters.get(mappingCode) || 0;
    const next = current + 1;
    this.sequenceCounters.set(mappingCode, next);
    return next;
  }

  /**
   * CHỐT AN TOÀN 4 LỚP: Thẩm định điều kiện tiên quyết trước khi đọc dữ liệu LIVE
   * @param {Object} mapping
   * @param {Object} plcStation
   * @returns {{ approved: boolean, reason?: string }}
   */
  evaluateSafetyGate(mapping, plcStation) {
    // LỚP 1: Cờ toàn cục cho phép kết nối PLC vật lý
    const enablePhysical = process.env.ENABLE_PHYSICAL_PLC === 'true';
    if (!enablePhysical) {
      return { approved: false, reason: 'PHYSICAL_PLC_DISABLED' };
    }

    // LỚP 2: Kiểm tra Whitelist địa chỉ mạng IP
    if (plcStation?.ipAddress) {
      const isAllowed = this.allowedSubnets.some((subnet) => plcStation.ipAddress.startsWith(subnet));
      if (!isAllowed) {
        return { approved: false, reason: 'IP_NOT_IN_WHITELIST' };
      }
    }

    // LỚP 3: Thẩm định trạng thái trạm PLC & Khớp máy
    if (!plcStation) {
      return { approved: false, reason: 'PLC_NOT_FOUND' };
    }
    if (Boolean(plcStation.is_demo)) {
      return { approved: false, reason: 'PLC_IS_DEMO' };
    }
    if (!Boolean(plcStation.enabled)) {
      return { approved: false, reason: 'PLC_DISABLED' };
    }
    if (plcStation.machine_id && mapping.machine_id && plcStation.machine_id !== mapping.machine_id) {
      return { approved: false, reason: 'PLC_MACHINE_MISMATCH' };
    }

    // LỚP 4: Thẩm định trạng thái cấu hình Mapping
    if (!Boolean(mapping.monitoring_enabled)) {
      return { approved: false, reason: 'MONITORING_DISABLED' };
    }
    if (mapping.status !== 'ACTIVE') {
      return { approved: false, reason: 'MAPPING_NOT_ACTIVE' };
    }
    if (!mapping.plc_register) {
      return { approved: false, reason: 'REGISTER_NOT_CONFIGURED' };
    }

    return { approved: true };
  }

  /**
   * Đánh giá độc lập chất lượng đo lường (Quality) và ngưỡng vận hành (Status)
   * @param {number|null} rawValue
   * @param {Object} thresholds { warning_min, warning_max, critical_min, critical_max }
   * @param {Object} commHealth { isConnected, hasError, latencyMs, isStale }
   * @returns {{ quality: string, status: string, alarmTriggered: boolean }}
   */
  static evaluateQualityAndStatus(rawValue, thresholds = {}, commHealth = {}) {
    // 1. Đánh giá chất lượng phép đo (Quality)
    let quality = 'GOOD';
    if (commHealth.hasError || !commHealth.isConnected || rawValue === null) {
      quality = 'BAD';
    } else if (commHealth.isStale || commHealth.isCalibrating) {
      quality = 'UNCERTAIN';
    }

    // 2. Đánh giá trạng thái vận hành theo ngưỡng (Status)
    // Nếu không có giá trị đo được do mất kết nối -> BẮT BUỘC status = 'unknown'
    if (rawValue === null || quality === 'BAD') {
      return {
        quality,
        status: 'unknown',
        alarmTriggered: false,
      };
    }

    let status = 'normal';
    let alarmTriggered = false;

    const val = Number(rawValue);
    const { warning_min, warning_max, critical_min, critical_max } = thresholds;

    // Kiểm tra ngưỡng Critical (Nguy cấp)
    if (
      (critical_min != null && val <= Number(critical_min)) ||
      (critical_max != null && val >= Number(critical_max))
    ) {
      status = 'critical';
      alarmTriggered = true;
    }
    // Kiểm tra ngưỡng Warning (Cảnh báo)
    else if (
      (warning_min != null && val <= Number(warning_min)) ||
      (warning_max != null && val >= Number(warning_max))
    ) {
      status = 'warning';
      alarmTriggered = true;
    }

    // Một phép đo vượt ngưỡng Critical nhưng đọc chuẩn xác thì: quality='GOOD' và status='critical'
    return {
      quality,
      status,
      alarmTriggered,
    };
  }

  /**
   * Thực hiện một chu kỳ thu thập dữ liệu (Polling Tick)
   * @param {Object} mapping
   * @param {Object} plcStation
   * @param {Object} thresholds
   * @param {Object} schedule
   * @returns {Promise<Object>} Gói tin Telemetry v2 đã chuẩn hóa
   */
  async processPollingTick(mapping, plcStation = null, thresholds = {}, schedule = null) {
    const now = new Date();
    const timestamp = now.toISOString();
    const mappingCode = mapping.mapping_code;
    const sequenceNumber = this.getNextSequenceNumber(mappingCode);

    // Lấy thông tin trạng thái hợp lệ cuối cùng đã biết
    const lastKnown = this.lastKnownStates.get(mappingCode) || {
      lastKnownValue: null,
      lastKnownTimestamp: null,
    };

    // Kiểm tra nguồn gốc dữ liệu: LIVE vs SIMULATED
    const isLiveRequested = mapping.source === 'LIVE' || (!mapping.source && plcStation && !plcStation.is_demo);
    let packet = null;

    if (isLiveRequested) {
      // KIỂM TRA CHỐT AN TOÀN 4 LỚP CHO LUỒNG LIVE
      const gateResult = this.evaluateSafetyGate(mapping, plcStation);

      if (!gateResult.approved) {
        // NGUYÊN TẮC NON-FALLBACK: Tuyệt đối không fallback sang mock data
        packet = {
          type: 'telemetry_packet',
          source: 'LIVE',
          quality: 'BAD',
          communicationStatus: gateResult.reason === 'PHYSICAL_PLC_DISABLED' ? 'UNCONFIGURED' : 'ERROR',
          timestamp,
          sequenceNumber,
          lineId: mapping.lineId || 'LINE-UNKNOWN',
          lineName: mapping.lineName || 'Unknown Line',
          machineId: mapping.machine_id,
          machineName: mapping.machineName || 'Unknown Machine',
          mappingCode,
          metricId: mapping.metric_id,
          metricName: mapping.metricName || mapping.channel_name,
          value: null,
          lastKnownValue: lastKnown.lastKnownValue,
          lastKnownTimestamp: lastKnown.lastKnownTimestamp,
          unit: mapping.unit || '',
          status: 'unknown',
          alarmTriggered: false,
          plcStationId: plcStation?.id || null,
          latencyMs: 0,
          errorCode: gateResult.reason,
        };
      } else {
        // THỰC HIỆN ĐỌC THANH GHI THỰC QUA ADAPTER
        let adapter = this.getAdapter(plcStation.id);
        if (!adapter) {
          adapter = new ModbusTCPAdapter(plcStation);
          this.registerAdapter(plcStation.id, adapter);
        }

        try {
          if (!adapter.isConnected()) {
            await adapter.connect();
          }

          const readResult = await adapter.readRegister({
            register: mapping.plc_register,
            scaleFactor: mapping.scale_factor || 1.0,
          });

          // Cập nhật giá trị hợp lệ cuối cùng
          lastKnown.lastKnownValue = readResult.value;
          lastKnown.lastKnownTimestamp = timestamp;
          this.lastKnownStates.set(mappingCode, lastKnown);

          const evalResult = TelemetryEngine.evaluateQualityAndStatus(readResult.value, thresholds, {
            isConnected: true,
            hasError: false,
            latencyMs: readResult.latencyMs,
          });

          packet = {
            type: 'telemetry_packet',
            source: 'LIVE',
            quality: evalResult.quality,
            communicationStatus: 'CONNECTED',
            timestamp,
            sequenceNumber,
            lineId: mapping.lineId || 'LINE-UNKNOWN',
            lineName: mapping.lineName || 'Unknown Line',
            machineId: mapping.machine_id,
            machineName: mapping.machineName || 'Unknown Machine',
            mappingCode,
            metricId: mapping.metric_id,
            metricName: mapping.metricName || mapping.channel_name,
            value: readResult.value,
            lastKnownValue: lastKnown.lastKnownValue,
            lastKnownTimestamp: lastKnown.lastKnownTimestamp,
            unit: mapping.unit || '',
            status: evalResult.status,
            alarmTriggered: evalResult.alarmTriggered,
            plcStationId: plcStation.id,
            latencyMs: readResult.latencyMs,
            errorCode: null,
          };
        } catch (err) {
          // Lỗi truyền thông (Timeout hoặc đứt mạng) -> Trả về value: null, quality: 'BAD', status: 'unknown'
          packet = {
            type: 'telemetry_packet',
            source: 'LIVE',
            quality: 'BAD',
            communicationStatus: err.message.includes('TIMEOUT') ? 'TIMEOUT' : 'ERROR',
            timestamp,
            sequenceNumber,
            lineId: mapping.lineId || 'LINE-UNKNOWN',
            lineName: mapping.lineName || 'Unknown Line',
            machineId: mapping.machine_id,
            machineName: mapping.machineName || 'Unknown Machine',
            mappingCode,
            metricId: mapping.metric_id,
            metricName: mapping.metricName || mapping.channel_name,
            value: null,
            lastKnownValue: lastKnown.lastKnownValue,
            lastKnownTimestamp: lastKnown.lastKnownTimestamp,
            unit: mapping.unit || '',
            status: 'unknown',
            alarmTriggered: false,
            plcStationId: plcStation?.id || null,
            latencyMs: adapter.latencyMs || 0,
            errorCode: err.message,
          };
        }
      }
    } else {
      // LUỒNG SIMULATED (DEMO / MOCK)
      let adapter = this.getAdapter('MOCK-ADAPTER');
      if (!adapter) {
        adapter = new MockPLCAdapter({ id: 'MOCK-ADAPTER', is_demo: 1 });
        this.registerAdapter('MOCK-ADAPTER', adapter);
      }

      const readResult = await adapter.readRegister({
        register: mapping.plc_register || '40001',
        scaleFactor: mapping.scale_factor || 1.0,
      });

      lastKnown.lastKnownValue = readResult.value;
      lastKnown.lastKnownTimestamp = timestamp;
      this.lastKnownStates.set(mappingCode, lastKnown);

      const evalResult = TelemetryEngine.evaluateQualityAndStatus(readResult.value, thresholds, {
        isConnected: true,
        hasError: false,
        latencyMs: readResult.latencyMs,
      });

      packet = {
        type: 'telemetry_packet',
        source: 'SIMULATED',
        quality: evalResult.quality,
        communicationStatus: 'CONNECTED',
        timestamp,
        sequenceNumber,
        lineId: mapping.lineId || 'LINE-UNKNOWN',
        lineName: mapping.lineName || 'Unknown Line',
        machineId: mapping.machine_id,
        machineName: mapping.machineName || 'Unknown Machine',
        mappingCode,
        metricId: mapping.metric_id,
        metricName: mapping.metricName || mapping.channel_name,
        value: readResult.value,
        lastKnownValue: lastKnown.lastKnownValue,
        lastKnownTimestamp: lastKnown.lastKnownTimestamp,
        unit: mapping.unit || '',
        status: evalResult.status,
        alarmTriggered: evalResult.alarmTriggered,
        plcStationId: null,
        latencyMs: readResult.latencyMs,
        errorCode: null,
      };
    }

    // 1. Phát sóng gói tin qua WebSocket (cho cả LIVE và SIMULATED)
    if (typeof this.onTelemetryPacket === 'function') {
      this.onTelemetryPacket(packet);
    }

    // 2. Kiểm soát lưu trữ vào CSDL:
    // - Luồng SIMULATED: Mặc định KHÔNG ghi vào CSDL (chỉ ghi nếu RECORD_SIMULATION_TO_DB === 'true')
    // - Luồng LIVE: Đưa vào hàng đợi Batch Buffer nếu có giá trị đo hợp lệ
    const shouldRecordSimulation = process.env.RECORD_SIMULATION_TO_DB === 'true';

    if (packet.source === 'LIVE' && packet.value !== null) {
      // Xác định chu kỳ ghi CSDL: nếu không có Schedule, sử dụng chu kỳ polling
      this.buffer.enqueue(packet);
    } else if (packet.source === 'SIMULATED' && shouldRecordSimulation) {
      this.buffer.enqueue(packet);
    }

    return packet;
  }

  /**
   * Software Polling Abort: Dừng toàn bộ các chu kỳ thu thập phần mềm
   */
  abortPolling() {
    this.isAborted = true;

    // Hủy toàn bộ các interval timers
    for (const [code, timer] of this.pollingTimers.entries()) {
      clearInterval(timer);
      this.pollingTimers.delete(code);
    }

    // Hủy socket của tất cả adapters
    for (const adapter of this.adapters.values()) {
      if (typeof adapter.abortConnection === 'function') {
        adapter.abortConnection();
      } else if (typeof adapter.disconnect === 'function') {
        adapter.disconnect().catch(() => {});
      }
    }
  }

  /**
   * Khởi động chu kỳ thu thập dữ liệu định kỳ cho một Mapping
   * @param {Object} mapping
   * @param {Object} plcStation
   * @param {Object} thresholds
   * @param {Object} schedule
   */
  startMappingPolling(mapping, plcStation = null, thresholds = {}, schedule = null) {
    if (this.isAborted) return;

    const mappingCode = mapping.mapping_code;
    if (this.pollingTimers.has(mappingCode)) {
      clearInterval(this.pollingTimers.get(mappingCode));
    }

    // Tần suất đọc PLC (Polling Rate):
    // Sử dụng sampling_rate_ms từ mapping (mặc định 1000ms nếu chưa cấu hình)
    const pollingRateMs = Math.max(100, Number(mapping.sampling_rate_ms) || 1000);

    const timer = setInterval(() => {
      this.processPollingTick(mapping, plcStation, thresholds, schedule).catch((err) => {
        console.warn(`[Polling Tick Warning - ${mappingCode}]:`, err.message);
      });
    }, pollingRateMs);

    this.pollingTimers.set(mappingCode, timer);
  }

  /**
   * Dừng thu thập của một Mapping cụ thể
   * @param {string} mappingCode
   */
  stopMappingPolling(mappingCode) {
    if (this.pollingTimers.has(mappingCode)) {
      clearInterval(this.pollingTimers.get(mappingCode));
      this.pollingTimers.delete(mappingCode);
    }
  }

  /**
   * Trả về trạng thái hoạt động của Engine
   */
  getStatus() {
    return {
      isAborted: this.isAborted,
      activePollingCount: this.pollingTimers.size,
      registeredAdaptersCount: this.adapters.size,
      bufferStats: this.buffer.getStats(),
      enablePhysicalPLC: process.env.ENABLE_PHYSICAL_PLC === 'true',
      recordSimulationToDb: process.env.RECORD_SIMULATION_TO_DB === 'true',
    };
  }
}
