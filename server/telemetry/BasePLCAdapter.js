/**
 * @file BasePLCAdapter.js
 * @description Lớp trừu tượng cơ sở (Base Class) cho tất cả các PLC Adapters
 * Quản lý trạng thái kết nối, thống kê độ trễ, kiểm soát lỗi và thuật toán Exponential Backoff.
 */

export class BasePLCAdapter {
  /**
   * @param {Object} stationConfig Cấu hình trạm PLC từ bảng plc_stations
   */
  constructor(stationConfig = {}) {
    this.id = stationConfig.id || 'PLC-UNKNOWN';
    this.name = stationConfig.name || 'Unknown PLC';
    this.ipAddress = stationConfig.ipAddress || null;
    this.port = Number(stationConfig.port) || 502;
    this.protocol = stationConfig.protocol || 'Modbus/TCP';
    this.machineId = stationConfig.machine_id || stationConfig.machineId || null;
    this.isDemo = Boolean(stationConfig.is_demo ?? stationConfig.isDemo ?? false);
    this.enabled = Boolean(stationConfig.enabled ?? true);

    this.status = 'DISCONNECTED'; // 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR'
    this.latencyMs = 0;
    this.consecutiveErrors = 0;
    this.lastSuccessTs = null;
    this.lastErrorTs = null;
    this.lastErrorMessage = null;

    // Cấu hình Reconnect Exponential Backoff with Jitter
    this.reconnectAttempt = 0;
    this.baseBackoffMs = 2000; // 2 giây khởi đầu
    this.maxBackoffMs = 60000;  // 60 giây trần tối đa
  }

  /**
   * Khởi tạo kết nối tới thiết bị PLC
   * @returns {Promise<boolean>}
   */
  async connect() {
    throw new Error('Method connect() must be implemented by subclass');
  }

  /**
   * Đóng kết nối an toàn tới thiết bị PLC
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('Method disconnect() must be implemented by subclass');
  }

  /**
   * Đọc một thanh ghi đo lường đơn lẻ
   * @param {Object} registerConfig { register, scaleFactor, dataType }
   * @returns {Promise<{ value: number, raw: any, latencyMs: number }>}
   */
  async readRegister(registerConfig) {
    throw new Error('Method readRegister() must be implemented by subclass');
  }

  /**
   * Đọc một lô nhiều thanh ghi
   * @param {Array<Object>} registerConfigs
   * @returns {Promise<Map<string, { value: number, raw: any }>>}
   */
  async readBatch(registerConfigs) {
    throw new Error('Method readBatch() must be implemented by subclass');
  }

  /**
   * Kiểm tra trạng thái trực tuyến
   * @returns {boolean}
   */
  isConnected() {
    return this.status === 'CONNECTED';
  }

  /**
   * Ghi nhận lượt đọc thành công, cập nhật độ trễ và xóa cờ lỗi
   * @param {number} latencyMs
   */
  recordSuccess(latencyMs = 0) {
    this.latencyMs = Math.round(latencyMs);
    this.consecutiveErrors = 0;
    this.reconnectAttempt = 0;
    this.lastSuccessTs = new Date().toISOString();
    this.status = 'CONNECTED';
    this.lastErrorMessage = null;
  }

  /**
   * Ghi nhận lượt đọc/kết nối thất bại
   * @param {Error|Object} err
   */
  recordError(err) {
    this.consecutiveErrors++;
    this.reconnectAttempt++;
    this.lastErrorTs = new Date().toISOString();
    this.lastErrorMessage = err?.message || String(err);

    // Nếu gặp 3 lỗi liên tiếp -> chuyển trạng thái ERROR
    if (this.consecutiveErrors >= 3) {
      this.status = 'ERROR';
    }
  }

  /**
   * Tính toán thời gian chờ tái kết nối theo Exponential Backoff có kèm ngẫu nhiên (Jitter)
   * T_backoff = min(maxBackoff, baseBackoff * 2^attempt) + random(0, 1000)ms
   * @returns {number} Thời gian trễ tính bằng mili-giây
   */
  getNextBackoffDelay() {
    const exponent = Math.min(this.reconnectAttempt, 6);
    const calculated = this.baseBackoffMs * Math.pow(2, exponent);
    const capped = Math.min(this.maxBackoffMs, calculated);
    const jitter = Math.floor(Math.random() * 1000); // 0 - 999 ms
    return capped + jitter;
  }

  /**
   * Trả về thông số sức khỏe và trạng thái vận hành của Adapter
   * @returns {Object}
   */
  getHealth() {
    return {
      id: this.id,
      name: this.name,
      ipAddress: this.ipAddress,
      port: this.port,
      protocol: this.protocol,
      machineId: this.machineId,
      isDemo: this.isDemo,
      enabled: this.enabled,
      status: this.status,
      latencyMs: this.latencyMs,
      consecutiveErrors: this.consecutiveErrors,
      reconnectAttempt: this.reconnectAttempt,
      lastSuccessTs: this.lastSuccessTs,
      lastErrorTs: this.lastErrorTs,
      lastErrorMessage: this.lastErrorMessage,
    };
  }
}
