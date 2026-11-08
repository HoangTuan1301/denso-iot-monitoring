/**
 * @file ModbusTCPAdapter.js
 * @description Bộ chuyển đổi giao thức Modbus TCP công nghiệp (Read-Only).
 * Tích hợp chốt an toàn cấm kết nối phần cứng khi ENABLE_PHYSICAL_PLC=false,
 * hỗ trợ phân tích địa chỉ thanh ghi (Holding/Input/Coil) và kiểm soát timeout nghiêm ngặt (1500ms).
 */

import net from 'net';
import { BasePLCAdapter } from './BasePLCAdapter.js';

export class ModbusTCPAdapter extends BasePLCAdapter {
  constructor(stationConfig = {}) {
    super(stationConfig);
    this.socket = null;
    this.readTimeoutMs = 1500; // Ngưỡng timeout tối đa 1.5 giây
    this.unitId = Number(stationConfig.unitId) || 1;
    this.transactionId = 0;
    this.isAborted = false;
  }

  /**
   * Phân tích địa chỉ thanh ghi Modbus từ chuỗi cấu hình
   * @param {string|number} regStr
   * @returns {{ type: string, address: number }}
   */
  static parseRegister(regStr) {
    const raw = String(regStr || '').trim().toUpperCase();

    if (raw.startsWith('HR:')) {
      return { type: 'HOLDING_REGISTER', address: parseInt(raw.slice(3), 10) || 0 };
    }
    if (raw.startsWith('IR:')) {
      return { type: 'INPUT_REGISTER', address: parseInt(raw.slice(3), 10) || 0 };
    }
    if (raw.startsWith('COIL:') || raw.startsWith('C:')) {
      return { type: 'COIL', address: parseInt(raw.split(':')[1], 10) || 0 };
    }
    if (raw.startsWith('DI:')) {
      return { type: 'DISCRETE_INPUT', address: parseInt(raw.slice(3), 10) || 0 };
    }

    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      if (num >= 40001 && num <= 49999) {
        return { type: 'HOLDING_REGISTER', address: num - 40001 };
      }
      if (num >= 30001 && num <= 39999) {
        return { type: 'INPUT_REGISTER', address: num - 30001 };
      }
      if (num >= 10001 && num <= 19999) {
        return { type: 'DISCRETE_INPUT', address: num - 10001 };
      }
      if (num >= 1 && num <= 9999) {
        return { type: 'COIL', address: num - 1 };
      }
      return { type: 'HOLDING_REGISTER', address: num };
    }

    return { type: 'HOLDING_REGISTER', address: 0 };
  }

  /**
   * Khởi tạo kết nối Socket TCP tới PLC Modbus
   * @returns {Promise<boolean>}
   */
  async connect() {
    this.isAborted = false;

    // CHỐT AN TOÀN 1: Kiểm tra cờ hệ thống cho phép kết nối phần cứng vật lý
    const enablePhysical = process.env.ENABLE_PHYSICAL_PLC === 'true';
    if (!enablePhysical) {
      const err = new Error(
        'PHYSICAL_PLC_DISABLED: Kết nối PLC vật lý đang bị vô hiệu hóa bởi cấu hình an toàn hệ thống (ENABLE_PHYSICAL_PLC=false).'
      );
      this.recordError(err);
      throw err;
    }

    // CHỐT AN TOÀN 2: Trạm demo hoặc bị disable tuyệt đối không mở socket
    if (this.isDemo || !this.enabled) {
      const err = new Error(
        `PLC_NOT_AUTHORIZED: Trạm PLC ${this.id} có trạng thái isDemo=${this.isDemo}, enabled=${this.enabled}. Không được mở socket TCP.`
      );
      this.recordError(err);
      throw err;
    }

    if (!this.ipAddress) {
      const err = new Error(`PLC_IP_MISSING: Trạm PLC ${this.id} chưa cấu hình địa chỉ IP.`);
      this.recordError(err);
      throw err;
    }

    this.status = 'CONNECTING';

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      this.socket = socket;
      socket.setTimeout(this.readTimeoutMs);

      socket.connect(this.port, this.ipAddress, () => {
        if (this.isAborted) {
          socket.destroy();
          return reject(new Error('COMMUNICATION_ABORTED: Kết nối đã bị hủy bởi Software Polling Abort.'));
        }
        this.recordSuccess(10);
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        const err = new Error(`ERR_PLC_TIMEOUT: Quá hạn kết nối tới ${this.ipAddress}:${this.port} (> ${this.readTimeoutMs}ms).`);
        this.recordError(err);
        reject(err);
      });

      socket.on('error', (err) => {
        socket.destroy();
        this.recordError(err);
        reject(err);
      });
    });
  }

  /**
   * Đóng socket TCP an toàn
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.status = 'DISCONNECTED';
  }

  /**
   * Software Polling Abort: Hủy socket ngay lập tức trên event loop
   */
  abortConnection() {
    this.isAborted = true;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.status = 'DISCONNECTED';
  }

  /**
   * Đọc thanh ghi Modbus (THUẦN READ-ONLY: Chỉ hỗ trợ Function Code 0x03 và 0x04)
   * Tuyệt đối không chứa bất kỳ logic ghi thanh ghi (write register / write coil) nào.
   * @param {Object} registerConfig { register, scaleFactor = 1.0 }
   * @returns {Promise<{ value: number, raw: number, latencyMs: number }>}
   */
  async readRegister(registerConfig) {
    const startTime = Date.now();
    const enablePhysical = process.env.ENABLE_PHYSICAL_PLC === 'true';

    if (!enablePhysical) {
      const err = new Error('PHYSICAL_PLC_DISABLED: Không thể đọc thanh ghi khi ENABLE_PHYSICAL_PLC=false.');
      this.recordError(err);
      throw err;
    }

    if (!this.isConnected() || !this.socket) {
      const err = new Error(`ERR_PLC_NOT_CONNECTED: Trạm PLC ${this.id} chưa kết nối.`);
      this.recordError(err);
      throw err;
    }

    const { type, address } = ModbusTCPAdapter.parseRegister(registerConfig.register);
    const scale = Number(registerConfig.scaleFactor) || 1.0;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(`ERR_PLC_TIMEOUT: Đọc thanh ghi ${registerConfig.register} quá hạn (> ${this.readTimeoutMs}ms)`);
        this.recordError(err);
        reject(err);
      }, this.readTimeoutMs);

      try {
        this.transactionId = (this.transactionId + 1) % 65535;
        const mbap = Buffer.alloc(12);
        mbap.writeUInt16BE(this.transactionId, 0); // Transaction ID
        mbap.writeUInt16BE(0x0000, 2);             // Protocol ID = 0 (Modbus)
        mbap.writeUInt16BE(6, 4);                  // Length = 6 bytes tiếp theo
        mbap.writeUInt8(this.unitId, 6);           // Unit ID
        
        // Function code: 0x03 (Read Holding Register), 0x04 (Read Input Register)
        const fc = type === 'INPUT_REGISTER' ? 0x04 : 0x03;
        mbap.writeUInt8(fc, 7);
        mbap.writeUInt16BE(address, 8);            // Starting Address
        mbap.writeUInt16BE(1, 10);                 // Quantity = 1 word (16-bit)

        const onData = (data) => {
          clearTimeout(timer);
          this.socket.removeListener('data', onData);

          if (data.length >= 9 && data.readUInt16BE(0) === this.transactionId) {
            const byteCount = data.readUInt8(8);
            if (byteCount >= 2) {
              const rawVal = data.readUInt16BE(9);
              const elapsed = Date.now() - startTime;
              this.recordSuccess(elapsed);
              const calculatedValue = Number((rawVal * scale).toFixed(2));
              resolve({
                value: calculatedValue,
                raw: rawVal,
                latencyMs: elapsed,
              });
              return;
            }
          }
          const err = new Error('ERR_MODBUS_INVALID_RESPONSE: Dữ liệu phản hồi không đúng cấu trúc MBAP');
          this.recordError(err);
          reject(err);
        };

        this.socket.once('data', onData);
        this.socket.write(mbap);
      } catch (err) {
        clearTimeout(timer);
        this.recordError(err);
        reject(err);
      }
    });
  }

  /**
   * Đọc nhiều thanh ghi
   */
  async readBatch(registerConfigs = []) {
    const results = new Map();
    for (const conf of registerConfigs) {
      const res = await this.readRegister(conf);
      results.set(conf.register, res);
    }
    return results;
  }
}
