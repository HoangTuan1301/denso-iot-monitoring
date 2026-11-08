/**
 * @file MockPLCAdapter.js
 * @description Adapter giả lập PLC an toàn phục vụ Unit Test, Integration Test và Demo UI.
 * Lưu trữ bộ nhớ ảo (virtual memory) trong RAM, cho phép mô phỏng lỗi mạng, timeout và trôi dạt dữ liệu.
 */

import { BasePLCAdapter } from './BasePLCAdapter.js';

export class MockPLCAdapter extends BasePLCAdapter {
  constructor(stationConfig = {}) {
    super(stationConfig);
    this.virtualMemory = new Map(); // Lưu trữ giá trị thanh ghi: address -> rawValue
    this.simulatedLatencyMs = 10;
    this.simulateFailure = false;
    this.failureReason = 'SIMULATED_COMMUNICATION_ERROR';
    this.isDemo = true;
  }

  /**
   * Cấu hình giả lập lỗi truyền thông cho các ca kiểm thử
   * @param {boolean} shouldFail
   * @param {string} reason
   */
  setSimulateFailure(shouldFail, reason = 'SIMULATED_COMMUNICATION_ERROR') {
    this.simulateFailure = Boolean(shouldFail);
    this.failureReason = reason;
  }

  /**
   * Thiết lập độ trễ mô phỏng (ms)
   * @param {number} ms
   */
  setSimulatedLatency(ms) {
    this.simulatedLatencyMs = Math.max(0, Number(ms) || 0);
  }

  /**
   * Ghi trực tiếp giá trị vào bộ nhớ thanh ghi ảo
   * @param {string} register
   * @param {number} rawValue
   */
  setRegisterValue(register, rawValue) {
    this.virtualMemory.set(String(register).trim(), Number(rawValue));
  }

  /**
   * Lấy giá trị thanh ghi ảo hiện tại
   * @param {string} register
   * @returns {number|undefined}
   */
  getRegisterValue(register) {
    return this.virtualMemory.get(String(register).trim());
  }

  /**
   * Khởi tạo kết nối giả lập
   * @returns {Promise<boolean>}
   */
  async connect() {
    if (this.simulateFailure) {
      const err = new Error(this.failureReason);
      this.recordError(err);
      throw err;
    }

    if (this.simulatedLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.simulatedLatencyMs));
    }

    this.recordSuccess(this.simulatedLatencyMs);
    return true;
  }

  /**
   * Đóng kết nối giả lập
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.status = 'DISCONNECTED';
  }

  /**
   * Đọc thanh ghi ảo
   * @param {Object} registerConfig { register, scaleFactor = 1.0 }
   * @returns {Promise<{ value: number, raw: number, latencyMs: number }>}
   */
  async readRegister(registerConfig) {
    const startTime = Date.now();
    const reg = String(registerConfig?.register || '').trim();
    const scale = Number(registerConfig?.scaleFactor) || 1.0;

    if (this.simulatedLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.simulatedLatencyMs));
    }

    if (this.simulateFailure) {
      const err = new Error(this.failureReason);
      this.recordError(err);
      throw err;
    }

    let rawVal;
    if (this.virtualMemory.has(reg)) {
      rawVal = this.virtualMemory.get(reg);
    } else {
      rawVal = 100;
    }

    const elapsed = Date.now() - startTime;
    this.recordSuccess(elapsed);

    const calculatedValue = Number((rawVal * scale).toFixed(2));
    return {
      value: calculatedValue,
      raw: rawVal,
      latencyMs: elapsed,
    };
  }

  /**
   * Đọc nhiều thanh ghi ảo cùng lúc
   * @param {Array<Object>} registerConfigs
   * @returns {Promise<Map<string, { value: number, raw: number }>>}
   */
  async readBatch(registerConfigs = []) {
    const results = new Map();
    for (const conf of registerConfigs) {
      const readRes = await this.readRegister(conf);
      results.set(conf.register, readRes);
    }
    return results;
  }
}
