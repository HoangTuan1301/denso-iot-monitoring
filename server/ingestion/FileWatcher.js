/**
 * @file server/ingestion/FileWatcher.js
 * @description Giám sát thư mục inbox đón nhận tệp tin mới với cơ chế ổn định an toàn:
 * 1. Bỏ qua các tệp ghi tạm (.tmp, .writing, .part).
 * 2. Cửa sổ ổn định (Stability Check): Theo dõi kích thước file và mtime qua các khoảng thời gian liên tiếp.
 * 3. Hỗ trợ cả polling thủ công (hữu ích cho môi trường test/CI) và fs.watch tự động.
 */

import fs from 'fs';
import path from 'path';

export class FileWatcher {
  /**
   * @param {Object} options
   * @param {string} options.inboxDir Thư mục inbox cần giám sát
   * @param {Array<string>} [options.ignoredExtensions=['.tmp', '.writing', '.part', '.crdownload']]
   * @param {number} [options.stabilityCheckIntervalMs=500] Chu kỳ kiểm tra kích thước
   * @param {number} [options.stabilityCheckRounds=2] Số chu kỳ ổn định liên tiếp bắt buộc
   * @param {Function} options.onFileReady Callback khi tệp đã sẵn sàng xử lý
   */
  constructor(options = {}) {
    this.inboxDir = options.inboxDir;
    this.ignoredExtensions = options.ignoredExtensions || ['.tmp', '.writing', '.part', '.crdownload'];
    this.stabilityIntervalMs = options.stabilityCheckIntervalMs || 500;
    this.stabilityRounds = options.stabilityCheckRounds || 2;
    this.onFileReady = options.onFileReady || (() => {});

    this.isWatching = false;
    this.isPaused = false;
    this.fsWatcher = null;
    this.pollTimer = null;
    this.processingFiles = new Set();
    this.stabilityTracking = new Map(); // filePath -> { size, mtime, stableCount }
  }

  /**
   * Tạm dừng quét inbox (Backpressure khi hạ tầng CSDL hoặc hệ thống gặp sự cố)
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Khôi phục quét inbox sau khi sự cố đã được khắc phục
   */
  resume() {
    this.isPaused = false;
    if (this.isWatching) {
      this.scanInbox();
    }
  }

  /**
   * Kiểm tra thẩm định môi trường giám sát (Pre-flight Verification)
   * @returns {{ ready: boolean, reason?: string }}
   */
  verifyEnvironment() {
    try {
      if (!fs.existsSync(this.inboxDir)) {
        fs.mkdirSync(this.inboxDir, { recursive: true });
      }
      fs.accessSync(this.inboxDir, fs.constants.R_OK | fs.constants.W_OK);
      return { ready: true };
    } catch (err) {
      return { ready: false, reason: `Không có quyền đọc/ghi thư mục inbox: ${err.message}` };
    }
  }

  /**
   * Khởi động bộ giám sát
   */
  start() {
    if (this.isWatching) return;
    if (!fs.existsSync(this.inboxDir)) {
      fs.mkdirSync(this.inboxDir, { recursive: true });
    }

    this.isWatching = true;

    // Quét định kỳ để đảm bảo không bỏ sót sự kiện trên mọi hệ điều hành
    this.pollTimer = setInterval(() => {
      this.scanInbox();
    }, this.stabilityIntervalMs);

    // Kích hoạt quét ban đầu
    this.scanInbox();
  }

  /**
   * Dừng bộ giám sát và giải phóng tài nguyên
   */
  stop() {
    this.isWatching = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    this.stabilityTracking.clear();
  }

  /**
   * Quét thư mục inbox và kiểm tra điều kiện sẵn sàng
   */
  scanInbox() {
    if (!this.isWatching || this.isPaused || !fs.existsSync(this.inboxDir)) return;

    try {
      const files = fs.readdirSync(this.inboxDir);

      for (const fileName of files) {
        const fullPath = path.join(this.inboxDir, fileName);
        if (this.processingFiles.has(fullPath)) continue;

        // Bỏ qua thư mục con
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue; // File có thể đã bị di chuyển
        }
        if (stat.isDirectory()) continue;

        // Bỏ qua các file tạm
        const ext = path.extname(fileName).toLowerCase();
        if (this.ignoredExtensions.includes(ext)) {
          continue;
        }

        // Kiểm tra tính ổn định (Stability Check)
        const track = this.stabilityTracking.get(fullPath);
        if (!track) {
          this.stabilityTracking.set(fullPath, {
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            stableCount: 1,
          });
          continue;
        }

        if (track.size === stat.size && track.mtimeMs === stat.mtimeMs) {
          track.stableCount++;
          if (track.stableCount >= this.stabilityRounds) {
            // Tệp đã ổn định hoàn toàn! Đưa vào xử lý
            this.stabilityTracking.delete(fullPath);
            this.processingFiles.add(fullPath);

            Promise.resolve(this.onFileReady(fullPath, fileName))
              .catch((err) => {
                console.warn(`[FileWatcher Error] Lỗi khi xử lý tệp ${fileName}:`, err.message);
              })
              .finally(() => {
                this.processingFiles.delete(fullPath);
              });
          }
        } else {
          // File đang tiếp tục được ghi (kích thước hoặc mtime thay đổi) -> reset bộ đếm
          track.size = stat.size;
          track.mtimeMs = stat.mtimeMs;
          track.stableCount = 1;
        }
      }
    } catch (err) {
      console.warn('[FileWatcher Scan Warning]:', err.message);
    }
  }

  /**
   * Kích hoạt quét tức thì (Dùng cho unit test)
   */
  async triggerImmediateCheck() {
    this.scanInbox();
  }
}
