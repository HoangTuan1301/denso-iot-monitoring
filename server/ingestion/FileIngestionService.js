/**
 * @file server/ingestion/FileIngestionService.js
 * @description Dịch vụ Điều phối Nhập Dữ liệu Telemetry từ Tệp (File Ingestion Service):
 * 1. Quản lý các thư mục: inbox, processing, completed, failed, duplicate, conflicts.
 * 2. Phục hồi an toàn sau crash (Startup Recovery Scanner).
 * 3. Kiểm toán mã băm SHA-256 chống nhập trùng ở cấp tệp.
 * 4. Phân biệt 3 mốc thời gian: measuredAt, exportedAt/fileModifiedAt, receivedAt.
 * 5. Khóa Idempotency 5 thành phần chống trùng cấp bản ghi.
 * 6. Phát hiện và ghi vết xung đột (Conflict Log) mà KHÔNG tự động ghi đè giá trị cũ.
 * 7. Khởi động ấm (Warm Rehydration) khôi phục lastKnownTimestamp từ MySQL.
 * 8. Phân luồng: Dữ liệu Live phát sóng WebSocket v2, Dữ liệu lịch sử phát historical_batch_ingested.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CSVTwoLineParser } from './parsers/CSVTwoLineParser.js';
import { defaultProfileRegistry } from './FileProfileRegistry.js';
import { FileWatcher } from './FileWatcher.js';
import { TelemetryEngine } from '../telemetry/TelemetryEngine.js';

export class FileIngestionService {
  /**
   * @param {Object} options
   * @param {string} options.storageRoot Thư mục gốc chứa các thư mục con
   * @param {Object} options.pool MySQL Connection Pool
   * @param {Object} [options.profileRegistry]
   * @param {Function} [options.onLivePacket] Callback phát sóng WebSocket Live
   * @param {Function} [options.onHistoricalBatch] Callback phát sóng WebSocket Historical
   * @param {number} [options.liveWindowMs=600000] Ngưỡng thời gian coi là Live (mặc định 10 phút)
   * @param {number} [options.chunkSize=500] Số bản ghi tối đa trong một transaction commit
   */
  constructor(options = {}) {
    this.storageRoot = options.storageRoot || path.resolve('./storage/file_ingest');
    this.pool = options.pool;
    this.profileRegistry = options.profileRegistry || defaultProfileRegistry;
    this.onLivePacket = options.onLivePacket || null;
    this.onHistoricalBatch = options.onHistoricalBatch || null;
    this.liveWindowMs = options.liveWindowMs || 10 * 60 * 1000;
    this.chunkSize = options.chunkSize || 500;

    // Thiết lập các thư mục chức năng
    this.inboxDir = path.join(this.storageRoot, 'inbox');
    this.processingDir = path.join(this.storageRoot, 'processing');
    this.completedDir = path.join(this.storageRoot, 'completed');
    this.failedDir = path.join(this.storageRoot, 'failed');
    this.duplicateDir = path.join(this.storageRoot, 'duplicate');
    this.conflictsDir = path.join(this.storageRoot, 'conflicts');

    // Bộ nhớ RAM theo dõi mốc thời gian mới nhất: Map<"machineId::mappingCode", { lastKnownTimestamp, lastKnownValue }>
    this.entityStates = new Map();

    // Parsers
    this.csvTwoLineParser = new CSVTwoLineParser();

    // Watcher
    this.watcher = new FileWatcher({
      inboxDir: this.inboxDir,
      onFileReady: (filePath, fileName) => this.processIncomingFile(filePath, fileName),
    });

    this.isInitialized = false;
  }

  /**
   * Thẩm định môi trường trước khi khởi động (Pre-flight Verification)
   * Bảo vệ CSDL chính và kiểm tra quyền truy cập thư mục
   */
  async preflightCheck() {
    if (this.pool) {
      const [rows] = await this.pool.query('SELECT DATABASE() as db');
      const currentDb = rows[0]?.db;
      if (currentDb === 'denso_iot' && process.env.ALLOW_PROD_INGESTION !== 'true') {
        throw new Error(`[CRITICAL_SECURITY_VIOLATION] File Ingestion Service cannot run against production database '${currentDb}' without explicit override!`);
      }
    }

    const dirs = [
      this.inboxDir,
      this.processingDir,
      this.completedDir,
      this.failedDir,
      this.duplicateDir,
      this.conflictsDir,
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
      fs.accessSync(d, fs.constants.R_OK | fs.constants.W_OK);
    }

    return { approved: true };
  }

  /**
   * Khởi tạo cấu trúc thư mục và khôi phục trạng thái ấm từ CSDL
   */
  async initialize() {
    if (this.isInitialized) return;

    // 0. Chạy Pre-flight Check bảo vệ an toàn
    await this.preflightCheck();

    // 1. Tạo đầy đủ các thư mục nếu chưa tồn tại
    const dirs = [
      this.inboxDir,
      this.processingDir,
      this.completedDir,
      this.failedDir,
      this.duplicateDir,
      this.conflictsDir,
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    }

    // 2. Khởi động ấm (Warm Rehydration): Nạp maxTimestamp từ CSDL
    await this.rehydrateWarmState();

    // 3. Quét phục hồi file tồn đọng trong processing/ sau crash
    await this.recoverProcessingFiles();

    // 4. Quét và giải phóng các sự kiện WebSocket còn tồn đọng trong Outbox (Transactional Outbox Drain)
    await this.drainOutbox();

    this.isInitialized = true;
  }

  /**
   * Bắt đầu giám sát thư mục inbox
   */
  async start() {
    await this.initialize();
    this.watcher.start();
  }

  /**
   * Dừng dịch vụ
   */
  stop() {
    this.watcher.stop();
  }

  /**
   * Khởi động ấm: Nạp mốc thời gian và giá trị gần nhất của từng kênh đo từ MySQL
   */
  async rehydrateWarmState() {
    if (!this.pool) return;
    try {
      const [rows] = await this.pool.query(`
        SELECT mth.machineId, mth.metricId AS mappingCode, mth.timestamp, mth.value
        FROM machine_telemetry_history mth
        INNER JOIN (
          SELECT machineId, metricId, MAX(timestamp) as maxTs
          FROM machine_telemetry_history
          GROUP BY machineId, metricId
        ) latest ON mth.machineId = latest.machineId 
               AND mth.metricId = latest.metricId 
               AND mth.timestamp = latest.maxTs
      `);

      for (const r of rows) {
        const key = `${r.machineId}::${r.mappingCode}`;
        this.entityStates.set(key, {
          lastKnownTimestamp: new Date(r.timestamp).toISOString(),
          lastKnownValue: Number(r.value),
        });
      }
    } catch (err) {
      console.warn('[FileIngestion Warm Rehydration Warning]:', err.message);
    }
  }

  /**
   * Quét phục hồi tệp bị kẹt trong processing/ sau khi server restart
   */
  async recoverProcessingFiles() {
    if (!fs.existsSync(this.processingDir)) return;

    try {
      const files = fs.readdirSync(this.processingDir);
      for (const fileName of files) {
        const fullPath = path.join(this.processingDir, fileName);
        if (fs.statSync(fullPath).isDirectory()) continue;

        // Tính SHA-256 đối chiếu CSDL
        const hash = this.calculateFileHash(fullPath);
        if (this.pool) {
          const [rows] = await this.pool.query('SELECT status FROM ingested_files_log WHERE file_hash = ?', [hash]);
          if (rows.length > 0 && rows[0].status === 'COMMITTED') {
            // Đã commit CSDL trước khi crash nhưng chưa kịp chuyển completed -> Hoàn tất chuyển file
            const destPath = this.getDatedDestination(this.completedDir, fileName);
            fs.renameSync(fullPath, destPath);
            continue;
          }
        }

        // Bóc tách originalFileName (loại bỏ tiền tố timestamp_ hoặc prefix trong processing/)
        let originalFileName = fileName;
        if (/^\d+_/.test(fileName)) {
          originalFileName = fileName.replace(/^\d+_/, '');
        } else if (fileName.includes('_log')) {
          originalFileName = fileName.replace(/^.*?_(?=log)/i, '');
        }

        // Chưa commit hoặc dở dang -> Chạy lại quy trình nạp an toàn
        await this.executeIngestionPipeline(fullPath, originalFileName, hash);
      }
    } catch (err) {
      console.warn('[Crash Recovery Warning]:', err.message);
    }
  }

  /**
   * Tính mã băm SHA-256 của tệp
   * @param {string} filePath
   * @returns {string}
   */
  calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Xác minh giao dịch In-Doubt cho toàn bộ bản ghi trong chunk:
   * Kiểm tra đầy đủ eventId, so khớp giá trị (value), và đồng bộ checkpoint.
   * @param {Object} conn
   * @param {Array} chunk
   * @param {string} fileId
   * @returns {Promise<{ isFullyCommitted: boolean, verifiedCount: number, mismatchDetails?: string }>}
   */
  async verifyInDoubtChunk(conn, chunk, fileId) {
    if (!chunk || chunk.length === 0) {
      return { isFullyCommitted: false, verifiedCount: 0 };
    }

    try {
      const chunkIds = chunk.map((item) => item.id);
      // Truy vấn toàn bộ danh sách id và value trong chunk từ CSDL
      const [rows] = await conn.query(
        'SELECT id, value FROM machine_telemetry_history WHERE id IN (?)',
        [chunkIds]
      );

      if (!rows || rows.length !== chunk.length) {
        return {
          isFullyCommitted: false,
          verifiedCount: rows ? rows.length : 0,
          mismatchDetails: `Count mismatch: expected ${chunk.length}, found ${rows?.length || 0}`,
        };
      }

      // Tạo Map để so khớp giá trị từng eventId
      const dbMap = new Map(rows.map((r) => [r.id, Number(r.value)]));
      for (const item of chunk) {
        const dbVal = dbMap.get(item.id);
        if (dbVal === undefined || Math.abs(dbVal - item.value) > 0.001) {
          return {
            isFullyCommitted: false,
            verifiedCount: rows.length,
            mismatchDetails: `Value mismatch for event ${item.id}: expected ${item.value}, found ${dbVal}`,
          };
        }
      }

      return { isFullyCommitted: true, verifiedCount: rows.length };
    } catch (err) {
      return { isFullyCommitted: false, verifiedCount: 0, mismatchDetails: err.message };
    }
  }

  /**
   * Quét và phát lại các sự kiện outbox còn tồn đọng (Transactional Outbox Drain)
   * Bảo đảm 100% không mất thông báo WebSocket khi crash sau MySQL commit
   */
  async drainOutbox() {
    if (!this.pool) return 0;
    const isPool = typeof this.pool.getConnection === 'function';
    const conn = isPool ? await this.pool.getConnection() : this.pool;
    let drainedCount = 0;

    try {
      const [pendingEvents] = await conn.query(`
        SELECT id, file_id, event_type, payload
        FROM ingestion_outbox_events
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT 200
      `);

      for (const ev of pendingEvents) {
        const payload = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
        try {
          if (ev.event_type === 'telemetry_packet') {
            const stateKey = `${payload.machineId}::${payload.metricId}`;
            const current = this.entityStates.get(stateKey);
            const itemIso = payload.timestamp;

            if (!current || itemIso >= current.lastKnownTimestamp) {
              this.entityStates.set(stateKey, {
                lastKnownTimestamp: itemIso,
                lastKnownValue: payload.value,
              });
            }

            if (typeof this.onLivePacket === 'function') {
              this.onLivePacket(payload);
            }
            if (this.wsService && typeof this.wsService.broadcastTelemetry === 'function') {
              this.wsService.broadcastTelemetry(payload);
            }
          } else if (ev.event_type === 'historical_batch_ingested') {
            if (typeof this.onHistoricalBatch === 'function') {
              this.onHistoricalBatch(payload);
            }
            if (this.wsService && typeof this.wsService.broadcastHistoricalBatch === 'function') {
              this.wsService.broadcastHistoricalBatch(payload);
            }
          }

          // Cập nhật trạng thái PUBLISHED
          await conn.query(`
            UPDATE ingestion_outbox_events
            SET status = 'PUBLISHED', published_at = NOW()
            WHERE id = ?
          `, [ev.id]);
          drainedCount++;
        } catch (pubErr) {
          await conn.query(`
            UPDATE ingestion_outbox_events
            SET status = 'FAILED', retry_count = retry_count + 1, error_message = ?
            WHERE id = ?
          `, [pubErr.message, ev.id]);
        }
      }
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        console.warn('[Outbox Drain Warning]:', err.message);
      }
    } finally {
      if (isPool) conn.release();
    }

    return drainedCount;
  }

  /**
   * Sinh eventId đơn định 5 chiều chống trùng tuyệt đối
   * @param {string} machineId
   * @param {string} mappingCode
   * @param {string} measuredAtISO
   * @param {number} dataNo
   * @returns {string}
   */
  static generateEventId(machineId, mappingCode, measuredAtISO, dataNo) {
    const raw = `${machineId}#${mappingCode}#${measuredAtISO}#${dataNo}`;
    const hash = crypto.createHash('md5').update(raw).digest('hex');
    return `EVT-${hash}`;
  }

  /**
   * Tạo đường dẫn đích lưu trữ theo ngày YYYY-MM-DD
   */
  getDatedDestination(baseDir, fileName) {
    const dateFolder = new Date().toISOString().slice(0, 10);
    const targetFolder = path.join(baseDir, dateFolder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    return path.join(targetFolder, `${Date.now()}_${fileName}`);
  }

  /**
   * Xử lý tệp tin khi vừa được FileWatcher xác nhận sẵn sàng từ inbox
   * @param {string} sourcePath
   * @param {string} fileName
   */
  async processIncomingFile(sourcePath, fileName) {
    // 1. Chuyển nguyên tử từ inbox/ sang processing/ để cách ly
    const processingPath = path.join(this.processingDir, `${Date.now()}_${fileName}`);
    try {
      fs.renameSync(sourcePath, processingPath);
    } catch {
      return; // File có thể đã được tiến trình khác xử lý
    }

    // 2. Tính mã băm SHA-256
    const fileHash = this.calculateFileHash(processingPath);

    // 3. Thực thi đường ống nạp dữ liệu
    return await this.executeIngestionPipeline(processingPath, fileName, fileHash);
  }

  /**
   * Đường ống thực thi nạp tệp (Pipeline Execution)
   */
  async executeIngestionPipeline(processingPath, originalFileName, fileHash) {
    const stat = fs.statSync(processingPath);
    // fileModifiedAt lấy từ stat.mtime (thời gian ghi/sửa đổi tệp trên filesystem máy tính).
    // Cần phân biệt rõ: Đây KHÔNG tự động coi là exportedAt trừ khi có bằng chứng xác nhận từ phần mềm PLC.
    const fileModifiedAt = stat.mtime.toISOString();
    const receivedAt = new Date().toISOString();
    const fileId = `IFL-${Date.now()}-${fileHash.slice(0, 8)}`;

    // 1. Kiểm tra chống nạp trùng ở cấp tệp qua fileHash
    if (this.pool) {
      const [existing] = await this.pool.query('SELECT id, status FROM ingested_files_log WHERE file_hash = ?', [fileHash]);
      if (existing.length > 0 && (existing[0].status === 'COMMITTED' || existing[0].status === 'DUPLICATE')) {
        // Tệp trùng lặp nội dung -> Di chuyển sang duplicate/
        const dupDest = path.join(this.duplicateDir, `${Date.now()}_${originalFileName}`);
        fs.renameSync(processingPath, dupDest);
        return { success: false, reason: 'DUPLICATE_FILE', fileHash };
      }
    }

    // 2. Tìm Hồ sơ Tệp (File Profile) phù hợp
    const profile = this.profileRegistry.findProfileForFile(originalFileName);
    if (!profile) {
      this.quarantineFailedFile(processingPath, originalFileName, fileId, fileHash, stat.size, 'NO_MATCHING_PROFILE', 'Không tìm thấy Hồ sơ Tệp phù hợp với mẫu tên file.');
      return { success: false, reason: 'NO_MATCHING_PROFILE' };
    }

    // 3. Xác định Máy mục tiêu (targetMachineId)
    const machineId = profile.targetMachineId;
    if (!machineId) {
      this.quarantineFailedFile(processingPath, originalFileName, fileId, fileHash, stat.size, 'MACHINE_NOT_CONFIGURED', 'Hồ sơ tệp chưa cấu hình gán máy đích.');
      return { success: false, reason: 'MACHINE_NOT_CONFIGURED' };
    }

    // Ghi nhận trạng thái PROCESSING vào ingested_files_log
    if (this.pool) {
      await this.pool.query(`
        INSERT INTO ingested_files_log (id, file_hash, file_name, file_size, machine_id, status, file_modified_at, ingested_at)
        VALUES (?, ?, ?, ?, ?, 'PROCESSING', ?, ?)
        ON DUPLICATE KEY UPDATE status = 'PROCESSING'
      `, [fileId, fileHash, originalFileName, stat.size, machineId, new Date(stat.mtime), new Date()]);
    }

    // 4. Phân tích cú pháp tệp CSV
    let parseResult;
    try {
      parseResult = await this.csvTwoLineParser.parseFile(processingPath);
    } catch (err) {
      this.quarantineFailedFile(processingPath, originalFileName, fileId, fileHash, stat.size, 'PARSE_ERROR', err.message);
      return { success: false, reason: 'PARSE_ERROR', error: err.message };
    }

    // Nếu không có bản ghi nào hợp lệ và có lỗi phân tích, chuyển file vào failed/
    if (parseResult.validRecords.length === 0 && parseResult.errorRows.length > 0) {
      const firstErr = parseResult.errorRows[0]?.error || 'Không có dữ liệu đo hợp lệ';
      this.quarantineFailedFile(processingPath, originalFileName, fileId, fileHash, stat.size, 'PARSE_VALIDATION_FAILED', firstErr);
      return { success: false, reason: 'PARSE_VALIDATION_FAILED', error: firstErr, errorRows: parseResult.errorRows };
    }

    // 5. Nạp cấu hình Kênh đo (metric_mappings) và Ngưỡng (metric_thresholds) của máy từ CSDL
    let machineMappings = [];
    let machineInfo = { name: machineId, lineId: 'UNKNOWN', lineName: 'Unknown Line' };

    if (this.pool) {
      const [mRows] = await this.pool.query(`
        SELECT mm.*, mt.warning_min, mt.warning_max, mt.critical_min, mt.critical_max,
               mc.name AS catalogMetricName, mc.unit AS catalogUnit, m.name AS mName, m.lineId, pl.name AS lName
        FROM metric_mappings mm
        LEFT JOIN metric_thresholds mt ON mm.id = mt.mapping_id
        LEFT JOIN metric_catalog mc ON mm.metric_id = mc.id
        LEFT JOIN machines m ON mm.machine_id = m.id
        LEFT JOIN production_lines pl ON m.lineId = pl.id
        WHERE mm.machine_id = ?
      `, [machineId]);

      machineMappings = mRows;
      if (mRows.length > 0 && mRows[0].mName) {
        machineInfo = {
          name: mRows[0].mName,
          lineId: mRows[0].lineId || 'UNKNOWN',
          lineName: mRows[0].lName || 'Unknown Line',
        };
      }
    }

    // Tạo bản đồ tra cứu: file_tag_name -> mapping
    const tagMap = new Map();
    for (const m of machineMappings) {
      const tagKey = (m.file_tag_name || m.mapping_code).toUpperCase();
      tagMap.set(tagKey, m);
    }

    // 6. Chuyển đổi các dòng đo và kiểm tra Xung đột (Conflict Detection)
    const telemetryBatch = [];
    const conflictRecords = [];
    let validRecordsCount = 0;
    const nowTime = Date.now();
    let latestMeasuredTime = 0;

    for (const row of parseResult.validRecords) {
      const measuredAtISO = row.measuredAt;
      const measuredTimestamp = new Date(row.measuredTimestamp);
      const measuredTimeMs = measuredTimestamp.getTime();
      if (measuredTimeMs > latestMeasuredTime) latestMeasuredTime = measuredTimeMs;

      for (const ch of row.channels) {
        if (ch.rawValue === null) continue; // Bỏ qua giá trị rỗng

        const mapping = tagMap.get(ch.tagName.toUpperCase());
        if (!mapping) continue; // Bỏ qua kênh chưa cấu hình

        validRecordsCount++;
        const mappingCode = mapping.mapping_code;
        const scaleFactor = Number(mapping.scale_factor || 1.0);
        const finalValue = Number((ch.rawValue * scaleFactor).toFixed(2));
        const eventId = FileIngestionService.generateEventId(machineId, mappingCode, measuredAtISO, row.dataNo);

        // Đánh giá ngưỡng theo TelemetryEngine (QĐ-06)
        const thresholdEval = TelemetryEngine.evaluateQualityAndStatus(
          finalValue,
          {
            warning_min: mapping.warning_min,
            warning_max: mapping.warning_max,
            critical_min: mapping.critical_min,
            critical_max: mapping.critical_max,
          },
          { isConnected: true, hasError: false }
        );
        const evaluatedStatus = thresholdEval.status; // 'normal', 'warning', 'critical'

        // Đánh giá tính Live đa chiều per-record & per-metric (QĐ-01, QĐ-02)
        const isLiveEligibleProfile = profile.mode !== 'HISTORICAL_ONLY';
        const isDataSourceAllowed = mapping.data_source_type === 'FILE_INGEST' || mapping.data_source_type === 'PLC_DIRECT';
        const isClockFuture = measuredTimeMs > nowTime + 30000; // Lệch đồng hồ tương lai > 30s
        const isWithinLiveWindow = nowTime - measuredTimeMs <= this.liveWindowMs;
        const stateKey = `${machineId}::${mappingCode}`;
        const currentEntityState = this.entityStates.get(stateKey);
        const isMonotonic = !currentEntityState || measuredAtISO >= currentEntityState.lastKnownTimestamp;

        let recordQuality = 'GOOD';
        if (isClockFuture) {
          recordQuality = 'UNCERTAIN';
        }

        const isRecordLive = isLiveEligibleProfile && isDataSourceAllowed && !isClockFuture && isWithinLiveWindow && isMonotonic;

        telemetryBatch.push({
          id: eventId,
          timestamp: measuredTimestamp,
          measuredAtISO,
          lineId: machineInfo.lineId,
          lineName: machineInfo.lineName,
          machineId,
          machineName: machineInfo.name,
          metricId: mappingCode, // Lưu ý schema: metricId lưu mappingCode
          metricName: mapping.channel_name || mapping.catalogMetricName || ch.tagName,
          value: finalValue,
          rawValue: ch.rawValue,
          dataNo: row.dataNo,
          unit: mapping.catalogUnit || '',
          status: evaluatedStatus,
          quality: recordQuality,
          source: 'device',
          plcStationId: null,
          isLive: isRecordLive,
        });
      }
    }

    // 7. Thực hiện Ghi CSDL theo Chunked Commit 500 dòng (QĐ-09 & QĐ-10)
    const CHUNK_SIZE = this.chunkSize || 500;
    const totalBatchItems = telemetryBatch.length;
    let committedRecordsCount = 0;

    if (this.pool && totalBatchItems > 0) {
      const isPool = typeof this.pool.getConnection === 'function';
      const conn = isPool ? await this.pool.getConnection() : this.pool;

      let chunkIndex = 0;
      for (let i = 0; i < totalBatchItems; i += CHUNK_SIZE) {
        chunkIndex++;
        const chunk = telemetryBatch.slice(i, i + CHUNK_SIZE);

        await conn.beginTransaction();

        try {
          for (const item of chunk) {
            // Kiểm tra bản ghi đã có trong CSDL chưa
            const [exist] = await conn.query('SELECT value FROM machine_telemetry_history WHERE id = ?', [item.id]);

            if (exist.length > 0) {
              const existingVal = Number(exist[0].value);
              if (Math.abs(existingVal - item.value) > 0.001) {
                // CÙNG SỰ KIỆN NHƯNG KHÁC GIÁ TRỊ: GHI NHẬN CONFLICT, KHÔNG TỰ ĐỘNG GHI ĐÈ!
                conflictRecords.push({
                  fileId,
                  machineId,
                  mappingCode: item.metricId,
                  dataNo: item.dataNo,
                  measuredAt: item.timestamp,
                  existingValue: existingVal,
                  incomingValue: item.value,
                });

                await conn.query(`
                  INSERT INTO ingested_file_conflicts (id, file_id, machine_id, mapping_code, data_no, measured_at, existing_value, incoming_value, resolution)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REJECTED')
                `, [`CONF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fileId, machineId, item.metricId, item.dataNo, item.timestamp, existingVal, item.value]);

                continue; // Giữ nguyên giá trị cũ
              } else {
                // Trùng lặp hoàn toàn -> Bỏ qua an toàn (Idempotent Skip)
                continue;
              }
            }

            // Chèn bản ghi mới
            await conn.query(`
              INSERT INTO machine_telemetry_history (
                id, timestamp, lineId, lineName, machineId, machineName,
                metricId, metricName, value, unit, status, source, plcStationId, createdAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
              item.id,
              item.timestamp,
              item.lineId,
              item.lineName,
              item.machineId,
              item.machineName,
              item.metricId,
              item.metricName,
              item.value,
              item.unit,
              item.status,
              item.source,
              item.plcStationId,
            ]);

            committedRecordsCount++;
          }

          // GHI TRANSACTIONAL OUTBOX CHO CÁC BẢN GHI LIVE TRONG CHUNK (Vấn đề 1)
          try {
            const chunkLiveItems = chunk.filter((item) => item.isLive);
            for (const liveItem of chunkLiveItems) {
              const outboxId = `OUT-LIVE-${liveItem.id}`;
              const livePacket = {
                type: 'telemetry_packet',
                protocolVersion: '2.0',
                source: 'device',
                subSource: 'FILE_INGEST',
                folderAccessStatus: 'ACCESSIBLE',
                fileStreamStatus: 'STREAMING',
                plcHardwareStatus: 'UNKNOWN',
                quality: liveItem.quality,
                isLive: true,
                timestamp: liveItem.timestamp.toISOString(),
                sequenceNumber: liveItem.dataNo,
                lineId: liveItem.lineId,
                lineName: liveItem.lineName,
                machineId: liveItem.machineId,
                machineName: liveItem.machineName,
                mappingCode: liveItem.metricId,
                metricId: liveItem.metricId,
                metricName: liveItem.metricName,
                value: liveItem.value,
                unit: liveItem.unit,
                status: liveItem.status,
                alarmStatus: liveItem.status,
                alarmTriggered: false,
                plcStationId: null,
                fileName: originalFileName,
              };

              await conn.query(`
                INSERT INTO ingestion_outbox_events (id, file_id, event_type, payload, status)
                VALUES (?, ?, 'telemetry_packet', ?, 'PENDING')
                ON DUPLICATE KEY UPDATE payload = VALUES(payload)
              `, [outboxId, fileId, JSON.stringify(livePacket)]);
            }
          } catch (outboxErr) {
            if (outboxErr.code !== 'ER_NO_SUCH_TABLE') {
              console.warn('[Outbox Chunk Insert Warning]:', outboxErr.message);
            }
          }

          // Cập nhật Checkpoint từng Chunk
          await conn.query(`
            UPDATE ingested_files_log 
            SET status = 'PROCESSING',
                valid_records = ?,
                conflict_records = ?
            WHERE id = ? OR file_hash = ?
          `, [committedRecordsCount, conflictRecords.length, fileId, fileHash]);

          await conn.commit();
        } catch (err) {
          // XỬ LÝ GIAO DỊCH IN-DOUBT TOÀN BỘ CHUNK 500 BẢN GHI (Vấn đề 2)
          let inDoubtResult = { isFullyCommitted: false, verifiedCount: 0 };
          if (chunk.length > 0) {
            inDoubtResult = await this.verifyInDoubtChunk(conn, chunk, fileId);
          }

          if (inDoubtResult.isFullyCommitted) {
            committedRecordsCount += inDoubtResult.verifiedCount;
            await conn.query(`
              UPDATE ingested_files_log 
              SET status = 'PROCESSING',
                  valid_records = ?,
                  conflict_records = ?
              WHERE id = ? OR file_hash = ?
            `, [committedRecordsCount, conflictRecords.length, fileId, fileHash]);
          } else {
            try { await conn.rollback(); } catch {}
            if (isPool) conn.release();
            this.quarantineFailedFile(
              processingPath,
              originalFileName,
              fileId,
              fileHash,
              stat.size,
              'DB_TRANSACTION_FAILED',
              `${err.message} (In-Doubt verification: ${inDoubtResult.mismatchDetails || 'Incomplete chunk'})`
            );
            return {
              success: false,
              reason: 'DB_TRANSACTION_FAILED',
              error: err.message,
              inDoubtDetails: inDoubtResult.mismatchDetails,
              chunkIndex,
            };
          }
        }
      }

      // GHI TRANSACTIONAL OUTBOX CHO HISTORICAL BATCH NẾU CÓ (Vấn đề 1)
      const liveItems = telemetryBatch.filter((item) => item.isLive);
      const historicalItems = telemetryBatch.filter((item) => !item.isLive);

      if (historicalItems.length > 0) {
        try {
          const histOutboxId = `OUT-HIST-${fileId}`;
          const histPayload = {
            type: 'historical_batch_ingested',
            protocolVersion: '2.0',
            fileId,
            fileName: originalFileName,
            machineId,
            machineName: machineInfo.name,
            totalRecords: parseResult.dataRowsCount,
            committedRecords: committedRecordsCount,
            historicalCount: historicalItems.length,
            liveCount: liveItems.length,
            conflictRecords: conflictRecords.length,
            errorRecords: parseResult.errorRows.length,
            firstMeasuredAt: telemetryBatch[0]?.timestamp?.toISOString() || null,
            latestMeasuredAt: telemetryBatch[telemetryBatch.length - 1]?.timestamp?.toISOString() || null,
            ingestedAt: receivedAt,
            uiActionHint: 'REFRESH_HISTORICAL_CHARTS_ONLY',
          };

          await conn.query(`
            INSERT INTO ingestion_outbox_events (id, file_id, event_type, payload, status)
            VALUES (?, ?, 'historical_batch_ingested', ?, 'PENDING')
            ON DUPLICATE KEY UPDATE payload = VALUES(payload)
          `, [histOutboxId, fileId, JSON.stringify(histPayload)]);
        } catch (outboxErr) {
          if (outboxErr.code !== 'ER_NO_SUCH_TABLE') {
            console.warn('[Outbox Hist Insert Warning]:', outboxErr.message);
          }
        }
      }

      // Cập nhật hoàn tất toàn bộ file trong ingested_files_log
      const finalStatus = parseResult.errorRows.length > 0 ? 'PARTIAL' : 'COMMITTED';
      const errorDetails = parseResult.errorRows.length > 0 
        ? JSON.stringify({ errorRowCount: parseResult.errorRows.length, samples: parseResult.errorRows.slice(0, 5) })
        : null;

      await conn.query(`
        UPDATE ingested_files_log 
        SET status = ?,
            total_records = ?,
            valid_records = ?,
            error_records = ?,
            conflict_records = ?,
            error_details = ?,
            processed_at = NOW()
        WHERE id = ? OR file_hash = ?
      `, [
        finalStatus,
        parseResult.totalRows,
        committedRecordsCount,
        parseResult.errorRows.length,
        conflictRecords.length,
        errorDetails,
        fileId,
        fileHash,
      ]);

      if (isPool) conn.release();
    }

    // 8. Di chuyển tệp tin sang completed/ sau khi CSDL đã xác nhận bền vững
    const completedDest = this.getDatedDestination(this.completedDir, originalFileName);
    fs.renameSync(processingPath, completedDest);

    // 9. Cập nhật Bộ nhớ RAM & Phân luồng WebSocket POST-COMMIT (QĐ-13, Vấn đề 1)
    const liveItems = telemetryBatch.filter((item) => item.isLive);
    const historicalItems = telemetryBatch.filter((item) => !item.isLive);

    // Ưu tiên giải phóng qua Transactional Outbox bền vững
    const outboxDrained = await this.drainOutbox();

    // Fallback broadcast trực tiếp nếu outbox chưa được áp dụng (bảo đảm tương thích ngược)
    if (outboxDrained === 0) {

      // Phát bản tin Historical nếu có dữ liệu lịch sử
      if (historicalItems.length > 0 && typeof this.onHistoricalBatch === 'function') {
        this.onHistoricalBatch({
          type: 'historical_batch_ingested',
          protocolVersion: '2.0',
          fileId,
          fileName: originalFileName,
          machineId,
          machineName: machineInfo.name,
          totalRecords: parseResult.dataRowsCount,
          committedRecords: committedRecordsCount,
          historicalCount: historicalItems.length,
          liveCount: liveItems.length,
          conflictRecords: conflictRecords.length,
          errorRecords: parseResult.errorRows.length,
          firstMeasuredAt: telemetryBatch[0]?.timestamp?.toISOString() || null,
          latestMeasuredAt: telemetryBatch[telemetryBatch.length - 1]?.timestamp?.toISOString() || null,
          ingestedAt: receivedAt,
          uiActionHint: 'REFRESH_HISTORICAL_CHARTS_ONLY',
        });
      }

      // Phát từng bản tin Live cho các bản ghi đạt chuẩn Live
      if (liveItems.length > 0) {
        for (const item of liveItems) {
          const stateKey = `${machineId}::${item.metricId}`;
          const current = this.entityStates.get(stateKey);
          const itemIso = item.measuredAtISO;

          if (!current || itemIso >= current.lastKnownTimestamp) {
            this.entityStates.set(stateKey, {
              lastKnownTimestamp: itemIso,
              lastKnownValue: item.value,
            });
          }

          if (typeof this.onLivePacket === 'function') {
            this.onLivePacket({
              type: 'telemetry_packet',
              protocolVersion: '2.0',
              source: 'device',
              subSource: 'FILE_INGEST',
              folderAccessStatus: 'ACCESSIBLE',
              fileStreamStatus: 'STREAMING',
              plcHardwareStatus: 'UNKNOWN',
              quality: item.quality,
              isLive: true,
              timestamp: item.timestamp.toISOString(),
              sequenceNumber: item.dataNo,
              lineId: item.lineId,
              lineName: item.lineName,
              machineId: item.machineId,
              machineName: item.machineName,
              mappingCode: item.metricId,
              metricId: item.metricId,
              metricName: item.metricName,
              value: item.value,
              unit: item.unit,
              status: item.status,
              alarmStatus: item.status,
              alarmTriggered: false, // TUYỆT ĐỐI KHÔNG tự bật Active Alarm/còi khi chưa có chính sách DENSO
              plcStationId: null,
              fileName: originalFileName,
            });
          }
        }
      }
    }

    return {
      success: true,
      fileId,
      fileName: originalFileName,
      dataRowsCount: parseResult.dataRowsCount,
      committedRecordsCount,
      conflictRecordsCount: conflictRecords.length,
      liveCount: liveItems.length,
      historicalCount: historicalItems.length,
      isHistorical: liveItems.length === 0,
    };
  }

  /**
   * Cách ly tệp lỗi vào failed/ kèm tệp .error.json
   */
  quarantineFailedFile(filePath, fileName, fileId, fileHash, fileSize, errorCode, errorMessage) {
    try {
      const failedDest = this.getDatedDestination(this.failedDir, fileName);
      fs.renameSync(filePath, failedDest);

      const errFile = `${failedDest}.error.json`;
      fs.writeFileSync(errFile, JSON.stringify({
        fileId,
        fileName,
        fileHash,
        fileSize,
        errorCode,
        errorMessage,
        failedAt: new Date().toISOString(),
      }, null, 2), 'utf8');

      if (this.pool) {
        this.pool.query(`
          INSERT INTO ingested_files_log (id, file_hash, file_name, file_size, status, error_details, ingested_at)
          VALUES (?, ?, ?, ?, 'FAILED', ?, NOW())
          ON DUPLICATE KEY UPDATE status = 'FAILED', error_details = ?
        `, [fileId, fileHash, fileName, fileSize, `${errorCode}: ${errorMessage}`, `${errorCode}: ${errorMessage}`]).catch(() => {});
      }
    } catch (err) {
      console.warn('[Quarantine File Warning]:', err.message);
    }
  }
}
