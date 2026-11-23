/**
 * @file machineRoutes.js
 * @description API cho màn Chi tiết máy:
 *
 *   Tài liệu máy (lưu trong MySQL vì ổ đĩa Render bị xóa mỗi lần deploy):
 *   GET    /api/machines/:machineId/documents                    Danh sách (không kèm nội dung)
 *   POST   /api/machines/:machineId/documents                    Tải lên (multipart: file, category, note) – ADMIN/MAINTENANCE
 *   GET    /api/machines/:machineId/documents/:docId/download    Tải xuống
 *   DELETE /api/machines/:machineId/documents/:docId             Xóa – ADMIN/MAINTENANCE
 *
 *   Check Sheet đầu ca / cuối ca:
 *   GET    /api/check-sheets?machineId=&date=&shift=             Kết quả đã ghi nhận
 *   POST   /api/check-sheets                                     Ghi nhận 1 lần check
 *
 *   Dữ liệu Unipulse (mô phỏng tới khi có file CSV mẫu):
 *   GET    /api/production/machines/:machineId/unipulse?limit=
 */
import crypto from 'crypto';
import multer from 'multer';
import { simulateUnipulse, getCurrentShift } from './ProductionSimulator.js';

const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
const CATEGORIES = ['DRAWING', 'PROGRAM', 'OTHER'];
const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DOC_BYTES, files: 1 } });

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

export function registerMachineRoutes(app, { authenticateToken, requireRole, mysqlDb, isDbConnected }) {
  const pool = () => (isDbConnected() ? mysqlDb.getPool() : null);
  const needDb = (res) => {
    if (pool()) return false;
    res.status(503).json({ message: 'CSDL chưa sẵn sàng.', errorCode: 'DB_UNAVAILABLE' });
    return true;
  };
  const audit = (req, action, target, details) =>
    mysqlDb
      .addAuditLog({
        userId: req.user?.id,
        userEmail: req.user?.email,
        userName: req.user?.fullName,
        employeeId: req.user?.employeeId,
        action,
        target,
        details,
        ipAddress: req.ip || '127.0.0.1',
      })
      .catch(() => {});

  /* ----------------------------- TÀI LIỆU MÁY ----------------------------- */
  app.get('/api/machines/:machineId/documents', authenticateToken, async (req, res) => {
    if (needDb(res)) return;
    try {
      const [rows] = await pool().query(
        `SELECT id, machine_id AS machineId, category, file_name AS fileName, mime_type AS mimeType,
                size_bytes AS sizeBytes, note, uploaded_by AS uploadedBy, created_at AS createdAt
         FROM machine_documents WHERE machine_id = ? ORDER BY created_at DESC`,
        [req.params.machineId]
      );
      res.json({ documents: rows });
    } catch (err) {
      res.status(500).json({ message: 'Lỗi tải danh sách tài liệu: ' + err.message });
    }
  });

  app.post(
    '/api/machines/:machineId/documents',
    authenticateToken,
    requireRole(['ADMIN', 'MAINTENANCE']),
    (req, res, next) =>
      docUpload.single('file')(req, res, (err) => {
        if (err && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ message: 'File vượt quá 10 MB.', errorCode: 'FILE_TOO_LARGE' });
        }
        if (err) return res.status(400).json({ message: 'File không hợp lệ: ' + err.message });
        next();
      }),
    async (req, res) => {
      if (needDb(res)) return;
      const file = req.file;
      const category = String(req.body?.category || 'OTHER').toUpperCase();
      if (!file) return res.status(400).json({ message: 'Chưa chọn file.', errorCode: 'NO_FILE' });
      if (!CATEGORIES.includes(category)) return res.status(400).json({ message: 'Loại tài liệu không hợp lệ.' });
      // Tên file gốc từ multer là latin1 → đổi sang UTF-8 để giữ dấu tiếng Việt / tiếng Nhật
      const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255);
      const id = newId('DOC');
      try {
        await pool().query(
          `INSERT INTO machine_documents (id, machine_id, category, file_name, mime_type, size_bytes, content, note, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, req.params.machineId, category, fileName, file.mimetype || 'application/octet-stream', file.size, file.buffer,
            req.body?.note ? String(req.body.note).slice(0, 255) : null, req.user?.fullName || req.user?.email || null]
        );
        audit(req, 'UPLOAD_DOCUMENT', req.params.machineId, `Tải lên ${category}: ${fileName} (${file.size} bytes)`);
        res.status(201).json({
          document: { id, machineId: req.params.machineId, category, fileName, mimeType: file.mimetype, sizeBytes: file.size,
            uploadedBy: req.user?.fullName || req.user?.email || null, createdAt: new Date().toISOString() },
        });
      } catch (err) {
        res.status(500).json({ message: 'Lỗi lưu tài liệu: ' + err.message });
      }
    }
  );

  app.get('/api/machines/:machineId/documents/:docId/download', authenticateToken, async (req, res) => {
    if (needDb(res)) return;
    try {
      const [rows] = await pool().query(
        'SELECT file_name, mime_type, content FROM machine_documents WHERE id = ? AND machine_id = ?',
        [req.params.docId, req.params.machineId]
      );
      if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
      const d = rows[0];
      res.setHeader('Content-Type', d.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(d.file_name)}`);
      res.send(d.content);
    } catch (err) {
      res.status(500).json({ message: 'Lỗi tải tài liệu: ' + err.message });
    }
  });

  app.delete('/api/machines/:machineId/documents/:docId', authenticateToken, requireRole(['ADMIN', 'MAINTENANCE']), async (req, res) => {
    if (needDb(res)) return;
    try {
      const [rows] = await pool().query('SELECT file_name FROM machine_documents WHERE id = ? AND machine_id = ?', [
        req.params.docId,
        req.params.machineId,
      ]);
      if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy tài liệu.' });
      await pool().query('DELETE FROM machine_documents WHERE id = ?', [req.params.docId]);
      audit(req, 'DELETE_DOCUMENT', req.params.machineId, `Xóa tài liệu: ${rows[0].file_name}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: 'Lỗi xóa tài liệu: ' + err.message });
    }
  });

  /* ------------------------------ CHECK SHEET ------------------------------ */
  const validDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

  app.get('/api/check-sheets', authenticateToken, async (req, res) => {
    if (needDb(res)) return;
    const machineId = String(req.query.machineId || '');
    if (!machineId) return res.status(400).json({ message: 'Thiếu machineId.' });
    const current = getCurrentShift();
    const date = validDate(req.query.date) || current.date;
    const shift = ['1', '2', '3'].includes(String(req.query.shift)) ? Number(req.query.shift) : current.shift;
    try {
      const [rows] = await pool().query(
        `SELECT id, machine_id AS machineId, DATE_FORMAT(production_date, '%Y-%m-%d') AS date, shift, check_type AS checkType,
                result, items_json AS itemsJson, note, checked_by AS checkedBy, checked_by_name AS checkedByName, created_at AS createdAt
         FROM check_sheet_records WHERE machine_id = ? AND production_date = ? AND shift = ?
         ORDER BY created_at ASC`,
        [machineId, date, shift]
      );
      const records = rows.map(({ itemsJson, ...r }) => {
        let items = [];
        try {
          items = JSON.parse(itemsJson);
        } catch {
          /* bỏ qua */
        }
        return { ...r, items };
      });
      res.json({ machineId, date, shift, records });
    } catch (err) {
      res.status(500).json({ message: 'Lỗi tải check sheet: ' + err.message });
    }
  });

  app.post('/api/check-sheets', authenticateToken, async (req, res) => {
    if (needDb(res)) return;
    const b = req.body || {};
    const machineId = String(b.machineId || '');
    const checkType = String(b.checkType || '').toUpperCase();
    const current = getCurrentShift();
    const date = validDate(b.date) || current.date;
    const shift = [1, 2, 3].includes(Number(b.shift)) ? Number(b.shift) : current.shift;
    if (!machineId || !['START', 'END'].includes(checkType)) {
      return res.status(400).json({ message: 'Thiếu machineId hoặc loại check (START/END).' });
    }
    if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 100) {
      return res.status(400).json({ message: 'Danh sách thông số check không hợp lệ.' });
    }
    // Server tự đánh giá lại OK/NG theo ngưỡng gửi kèm, không tin kết quả từ client
    const items = b.items.map((it) => {
      const value = Number(it.value);
      const min = it.min === null || it.min === undefined || it.min === '' ? null : Number(it.min);
      const max = it.max === null || it.max === undefined || it.max === '' ? null : Number(it.max);
      const ok = Number.isFinite(value) && (min === null || value >= min) && (max === null || value <= max);
      return {
        metricId: String(it.metricId || '').slice(0, 64),
        name: String(it.name || '').slice(0, 128),
        unit: String(it.unit || '').slice(0, 32),
        value: Number.isFinite(value) ? value : null,
        min,
        max,
        result: ok ? 'OK' : 'NG',
      };
    });
    const result = items.every((i) => i.result === 'OK') ? 'OK' : 'NG';
    const id = newId('CHK');
    try {
      await pool().query(
        `INSERT INTO check_sheet_records (id, machine_id, production_date, shift, check_type, result, items_json, note, checked_by, checked_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, machineId, date, shift, checkType, result, JSON.stringify(items), b.note ? String(b.note).slice(0, 500) : null,
          req.user?.email || null, req.user?.fullName || null]
      );
      audit(req, 'CHECK_SHEET', machineId, `Check ${checkType === 'START' ? 'đầu ca' : 'cuối ca'} ca ${shift} ngày ${date}: ${result}`);
      res.status(201).json({
        record: { id, machineId, date, shift, checkType, result, items, note: b.note || null, checkedBy: req.user?.email || null,
          checkedByName: req.user?.fullName || null, createdAt: new Date().toISOString() },
      });
    } catch (err) {
      res.status(500).json({ message: 'Lỗi lưu check sheet: ' + err.message });
    }
  });

  /* -------------------------------- UNIPULSE ------------------------------- */
  app.get('/api/production/machines/:machineId/unipulse', authenticateToken, async (req, res) => {
    try {
      let machine = { id: req.params.machineId, code: req.params.machineId };
      if (pool()) {
        const machines = await mysqlDb.getMachines({});
        machine = machines.find((m) => m.id === req.params.machineId || m.code === req.params.machineId) || machine;
      }
      res.json(simulateUnipulse({ machine, limit: req.query.limit }));
    } catch (err) {
      res.status(500).json({ message: 'Lỗi tải dữ liệu Unipulse: ' + err.message });
    }
  });
}
