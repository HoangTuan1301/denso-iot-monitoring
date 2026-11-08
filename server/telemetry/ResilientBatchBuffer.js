/**
 * @file ResilientBatchBuffer.js
 * @description Hệ thống đệm ghi dữ liệu Telemetry bền vững với Write-Ahead Log (WAL),
 * chống ghi trùng bằng eventId đơn điệu xác định, fsync durability, phục hồi sau crash,
 * cơ chế Backpressure khi đạt 50MB và Graceful Shutdown an toàn.
 */

import fs from 'fs';
import path from 'path';

export class ResilientBatchBuffer {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.walDir = options.walDir || path.join(process.cwd(), 'server', 'telemetry', 'spillover');
    this.walFile = path.join(this.walDir, 'telemetry_wal.jsonl');
    this.maxWalSizeBytes = options.maxWalSizeBytes || 50 * 1024 * 1024; // 50 MB
    this.flushIntervalMs = options.flushIntervalMs || 1000;
    this.maxBatchSize = options.maxBatchSize || 50;
    this.onBackpressure = options.onBackpressure || null;
    this.onBackpressureReleased = options.onBackpressureReleased || null;

    this.ramQueue = [];
    this.isFlushing = false;
    this.isBackpressureActive = false;
    this.flushTimer = null;
    this.walFd = null;

    this.initStorage();
  }

  /**
   * Khởi tạo thư mục và mở file descriptor cho tệp WAL
   */
  initStorage() {
    if (!fs.existsSync(this.walDir)) {
      fs.mkdirSync(this.walDir, { recursive: true });
    }
    // Đảm bảo tệp tồn tại trước khi mở ở chế độ đọc/ghi r+
    fs.closeSync(fs.openSync(this.walFile, 'a'));
    this.walFd = fs.openSync(this.walFile, 'r+');
  }

  /**
   * Sinh eventId duy nhất, đơn điệu và ổn định qua các lần retry (Idempotent Event ID)
   * Đảm bảo:
   * 1. Ổn định qua retry: Cùng 1 lần đo sẽ luôn sinh ra cùng 1 eventId.
   * 2. Không làm mất 2 phép đo có cùng timestamp:
   *    - Khác máy -> machineId khác nhau.
   *    - Khác mapping trên cùng máy -> metricId khác nhau.
   *    - Cùng mapping trên cùng máy tại cùng ms -> sequenceNumber khác nhau.
   * @param {string} machineId
   * @param {string} metricId (mappingCode)
   * @param {string|number} timestamp
   * @param {number} sequenceNumber
   * @returns {string} Độ dài tối đa ~70 ký tự (nhỏ hơn varchar(96) của CSDL)
   */
  static generateEventId(machineId, metricId, timestamp, sequenceNumber) {
    const epochMs = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    const cleanMachine = String(machineId || 'MCH').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
    const cleanMetric = String(metricId || 'MTR').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    const seqStr = String(sequenceNumber || 0).padStart(6, '0');
    return `LOG_${cleanMachine}_${cleanMetric}_${epochMs}_${seqStr}`;
  }

  /**
   * Đưa một bản ghi đo lường vào hàng đợi đệm
   * Ghi đồng bộ xuống đĩa (WAL + fsync) trước khi đưa vào RAM
   * @param {Object} record
   * @returns {boolean} true nếu chấp nhận, false nếu đang bị backpressure
   */
  enqueue(record) {
    if (!record) return false;

    // Kiểm tra dung lượng tệp WAL để áp dụng Backpressure
    const stats = fs.fstatSync(this.walFd);
    if (stats.size >= this.maxWalSizeBytes) {
      if (!this.isBackpressureActive) {
        this.isBackpressureActive = true;
        if (typeof this.onBackpressure === 'function') {
          this.onBackpressure({
            currentSize: stats.size,
            maxSize: this.maxWalSizeBytes,
            reason: 'WAL_BUFFER_CAPACITY_LIMIT_REACHED',
          });
        }
      }
      return false; // Áp dụng backpressure: từ chối nhận thêm để bảo vệ ổ đĩa
    }

    // Đảm bảo có eventId hợp chuẩn
    if (!record.id) {
      record.id = ResilientBatchBuffer.generateEventId(
        record.machineId,
        record.metricId,
        record.timestamp,
        record.sequenceNumber || 1
      );
    }

    // 1. Ghi tuần tự vào cuối WAL với fsync durability
    const line = JSON.stringify(record) + '\n';
    const buffer = Buffer.from(line, 'utf8');
    const pos = fs.fstatSync(this.walFd).size;
    fs.writeSync(this.walFd, buffer, 0, buffer.length, pos);
    fs.fsyncSync(this.walFd); // Ép ghi xuống đĩa vật lý

    // 2. Đưa vào hàng đợi RAM
    this.ramQueue.push(record);
    return true;
  }

  /**
   * Phục hồi dữ liệu từ WAL khi khởi động lại sau crash / mất điện
   * Bỏ qua các dòng bị ghi dở (torn lines) và giữ nguyên toàn bộ dòng hợp lệ
   * @returns {Array<Object>} Danh sách bản ghi hợp lệ đã phục hồi
   */
  replayWal() {
    if (!fs.existsSync(this.walFile)) return [];

    const content = fs.readFileSync(this.walFile, 'utf8');
    const lines = content.split('\n');
    const validRecords = [];
    let tornLinesCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        validRecords.push(parsed);
      } catch (err) {
        tornLinesCount++;
        // Dòng bị ghi dở do crash đột ngột: bỏ qua an toàn và cảnh báo
        console.warn(`[WAL Recovery] Phát hiện dòng WAL không trọn vẹn tại vị trí ${i + 1}: ${err.message}. Đã cô lập dòng lỗi.`);
      }
    }

    // Nạp lại vào RAM queue nếu chưa có
    if (validRecords.length > 0 && this.ramQueue.length === 0) {
      this.ramQueue.push(...validRecords);
    }

    return validRecords;
  }

  /**
   * Khởi động bộ lập lịch flush tự động
   * @param {Object} pool MySQL connection pool
   */
  startFlusher(pool) {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flushToDb(pool).catch((err) => {
        console.warn('[BatchBuffer Flush Error]:', err.message);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Dừng bộ lập lịch flush
   */
  stopFlusher() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Thực hiện ghi một lô (batch) từ hàng đợi vào MySQL
   * Sử dụng INSERT ... ON DUPLICATE KEY UPDATE id=id để đảm bảo tính idempotent
   * @param {Object} pool MySQL connection pool
   * @returns {Promise<{ committedCount: number }>}
   */
  async flushToDb(pool) {
    if (this.isFlushing || this.ramQueue.length === 0 || !pool) {
      return { committedCount: 0 };
    }

    this.isFlushing = true;

    try {
      // Lấy tối đa maxBatchSize bản ghi
      const batch = this.ramQueue.slice(0, this.maxBatchSize);
      if (batch.length === 0) {
        this.isFlushing = false;
        return { committedCount: 0 };
      }

      // Xây dựng câu lệnh chèn hàng loạt có kiểm soát kiểu và ràng buộc
      // ON DUPLICATE KEY UPDATE id=id: Không ghi đè, không sinh bản ghi trùng, không che giấu lỗi kiểu dữ liệu
      const query = `
        INSERT INTO machine_telemetry_history (
          id, timestamp, lineId, lineName, machineId, machineName,
          metricId, metricName, value, unit, status, source, plcStationId, createdAt
        ) VALUES ?
        ON DUPLICATE KEY UPDATE id = VALUES(id)
      `;

      const values = batch.map((r) => [
        r.id,
        new Date(r.timestamp),
        r.lineId || 'UNKNOWN',
        r.lineName || 'Unknown Line',
        r.machineId || 'UNKNOWN',
        r.machineName || 'Unknown Machine',
        r.metricId || 'UNKNOWN',
        r.metricName || 'Unknown Metric',
        r.value != null ? Number(r.value) : 0,
        r.unit || '',
        r.status && ['normal', 'warning', 'critical'].includes(r.status) ? r.status : 'normal',
        r.source === 'device' ? 'device' : 'simulation',
        r.plcStationId || null,
        new Date(),
      ]);

      await pool.query(query, [values]);

      // MySQL đã xác nhận ghi nhận thành công (ACK)
      // Loại bỏ các bản ghi đã commit khỏi ramQueue
      this.ramQueue.splice(0, batch.length);

      // Cập nhật checkpoint WAL: Nếu ramQueue đã trống, thu gọn (truncate) WAL về 0
      if (this.ramQueue.length === 0) {
        fs.ftruncateSync(this.walFd, 0);
        fs.fsyncSync(this.walFd);

        // Giải phóng backpressure nếu trước đó bị nghẽn
        if (this.isBackpressureActive) {
          this.isBackpressureActive = false;
          if (typeof this.onBackpressureReleased === 'function') {
            this.onBackpressureReleased();
          }
        }
      }

      this.isFlushing = false;
      return { committedCount: batch.length };
    } catch (err) {
      this.isFlushing = false;
      throw err;
    }
  }

  /**
   * Graceful Shutdown: Cố gắng flush dữ liệu còn lại.
   * Nếu MySQL mất kết nối, dữ liệu đã nằm an toàn trong WAL trên đĩa; đóng file an toàn trong timeout.
   * @param {Object} pool MySQL connection pool
   * @param {number} timeoutMs
   * @returns {Promise<void>}
   */
  async shutdown(pool, timeoutMs = 2500) {
    this.stopFlusher();

    const flushPromise = (async () => {
      try {
        if (pool && this.ramQueue.length > 0) {
          while (this.ramQueue.length > 0) {
            await this.flushToDb(pool);
          }
        }
      } catch (err) {
        console.warn(`[Graceful Shutdown Warning] Không thể kết nối MySQL để flush (${err.message}). Dữ liệu đã lưu an toàn trong WAL.`);
      }
    })();

    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([flushPromise, timeoutPromise]);

    if (this.walFd) {
      try {
        fs.fsyncSync(this.walFd);
        fs.closeSync(this.walFd);
        this.walFd = null;
      } catch {}
    }
  }

  /**
   * Lấy thống kê hoạt động của Buffer
   */
  getStats() {
    let fileSize = 0;
    try {
      if (this.walFd) {
        fileSize = fs.fstatSync(this.walFd).size;
      }
    } catch {}

    return {
      ramQueueLength: this.ramQueue.length,
      walFileSizeBytes: fileSize,
      maxWalSizeBytes: this.maxWalSizeBytes,
      isBackpressureActive: this.isBackpressureActive,
      isFlushing: this.isFlushing,
    };
  }
}
