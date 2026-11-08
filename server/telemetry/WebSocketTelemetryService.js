/**
 * @file WebSocketTelemetryService.js
 * @description Dịch vụ quản lý WebSocket Server v2 cho dữ liệu IoT và các sự kiện quản trị.
 * Chuẩn hóa gói tin telemetry_packet, quản lý Heartbeat Ping/Pong (15s/30s dead pruning),
 * phát hiện dữ liệu quá hạn (Stale Data), và duy trì tính tương thích ngược 100% với các sự kiện cũ.
 */

import { WebSocket } from 'ws';

export class WebSocketTelemetryService {
  /**
   * @param {Object} wss Instance của ws.WebSocketServer
   */
  constructor(wss) {
    this.wss = wss;
    this.lastPacketTimestamps = new Map(); // mappingCode -> epochMs
    this.heartbeatTimer = null;

    this.initHeartbeat();
  }

  /**
   * Khởi tạo chu kỳ giám sát Heartbeat và dọn dẹp các kết nối chết (Dead Client Pruning)
   */
  initHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (!this.wss || !this.wss.clients) return;

      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          // Sau 30s không nhận được phản hồi ping/pong -> Đóng kết nối để chống rò rỉ bộ nhớ
          return ws.terminate();
        }

        ws.isAlive = false;
        try {
          ws.ping();
        } catch {}
      });
    }, 15000); // Mỗi 15 giây gửi ping
  }

  /**
   * Thiết lập xử lý sự kiện kết nối cho Client mới
   * @param {Object} ws
   */
  handleConnection(ws) {
    ws.isAlive = true;

    // Phản hồi Pong nội bộ của giao thức WebSocket
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Lắng nghe các bản tin dạng JSON từ Client (Bao gồm ping cấp ứng dụng)
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'ping') {
          ws.isAlive = true;
          ws.send(JSON.stringify({
            type: 'pong',
            clientTimestamp: parsed.timestamp || null,
            serverTimestamp: new Date().toISOString(),
          }));
        }
      } catch {
        // Bỏ qua gói tin không đúng định dạng JSON
      }
    });

    // Gửi thông báo chào mừng và trạng thái kết nối
    ws.send(JSON.stringify({
      type: 'connection_established',
      protocolVersion: '2.0',
      message: 'Kết nối WebSocket Telemetry v2 thành công (KaiLink IoT Engine).',
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Phát sóng gói tin Telemetry chuẩn hóa v2 tới toàn bộ Client đang kết nối
   * @param {Object} packet
   */
  broadcastTelemetry(packet) {
    if (!this.wss || !this.wss.clients || this.wss.clients.size === 0) return;

    // Ghi nhận thời điểm nhận gói tin để phục vụ phát hiện Stale Data
    if (packet.mappingCode) {
      this.lastPacketTimestamps.set(packet.mappingCode, Date.now());
    }

    const payload = JSON.stringify(packet);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (err) {
          console.warn('[WS Telemetry Send Error]:', err.message);
        }
      }
    });
  }

  /**
   * Phát sóng các sự kiện Quản trị / Nghiệp vụ (Bảo đảm tương thích ngược 100%)
   * @param {string} eventType Tên sự kiện: line_created, machine_updated, audit_event...
   * @param {Object} data Payload dữ liệu
   */
  broadcastEvent(eventType, data = {}) {
    if (!this.wss || !this.wss.clients || this.wss.clients.size === 0) return;

    const payload = JSON.stringify({
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (err) {
          console.warn(`[WS Event ${eventType} Error]:`, err.message);
        }
      }
    });
  }

  /**
   * Kiểm tra và phát cảnh báo Dữ liệu quá hạn (Stale Data Detection)
   * @param {string} mappingCode
   * @param {number} samplingRateMs
   * @returns {boolean} true nếu dữ liệu bị stale
   */
  checkAndBroadcastStaleData(mappingCode, samplingRateMs = 1000) {
    const lastTs = this.lastPacketTimestamps.get(mappingCode);
    if (!lastTs) return false;

    const staleThresholdMs = 1.5 * samplingRateMs;
    const elapsed = Date.now() - lastTs;

    if (elapsed > staleThresholdMs) {
      this.broadcastTelemetry({
        type: 'telemetry_packet',
        source: 'LIVE',
        quality: 'UNCERTAIN',
        communicationStatus: 'TIMEOUT',
        timestamp: new Date().toISOString(),
        mappingCode,
        value: null,
        status: 'unknown',
        isStale: true,
        staleElapsedMs: elapsed,
      });
      return true;
    }
    return false;
  }

  /**
   * Dừng dịch vụ WebSocket
   */
  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
