/**
 * @file productionRoutes.js
 * @description API dữ liệu sản xuất (mô phỏng): OEE, dừng máy, sản lượng, điều kiện gia công, What-If.
 *
 *   GET  /api/production/overview                       Tổng quan nhà máy + Top 5 line dừng lâu
 *   GET  /api/production/lines/:lineId?date=&shift=     Chi tiết ca sản xuất của 1 line
 *   GET  /api/production/lines/:lineId/daily?period=week|month&date=  Sản lượng + NG theo ngày
 *   GET  /api/production/lines/:lineId/conditions?days= Điều kiện gia công N ngày
 *   GET  /api/production/lines/:lineId/what-if?otHours=&reroutePct=&orderQty=
 *   GET  /api/production/settings                       Cài đặt (ngưỡng dừng ngắn)
 *   PUT  /api/production/settings                       Cập nhật cài đặt (ADMIN)
 */
import {
  DEFAULT_PRODUCTION_SETTINGS,
  simulateLineShift,
  simulateLineDaily,
  simulateProcessConditions,
  simulateWhatIf,
  buildFactoryOverview,
  VIRTUAL_LINES,
  virtualMachines,
} from './ProductionSimulator.js';

const SETTINGS_KEY = 'production';
let memorySettings = { ...DEFAULT_PRODUCTION_SETTINGS };

export function registerProductionRoutes(app, { authenticateToken, requireRole, mysqlDb, isDbConnected }) {
  const dbReady = () => isDbConnected() && mysqlDb.getPool();

  async function loadSettings() {
    if (!dbReady()) return memorySettings;
    try {
      const saved = await mysqlDb.getAppSetting(SETTINGS_KEY, null);
      memorySettings = { ...DEFAULT_PRODUCTION_SETTINGS, ...(saved || {}) };
    } catch (err) {
      console.warn('[Production Settings] Không đọc được cài đặt, dùng mặc định:', err.message);
    }
    return memorySettings;
  }

  // Line thật từ CSDL + 2 line mô phỏng (đánh dấu virtual: true) để đủ Top 5 khi demo
  async function loadLinesAndMachines() {
    const vLines = VIRTUAL_LINES.map(({ machines: _m, ...l }) => l);
    if (!dbReady()) return { lines: vLines, machines: virtualMachines() };
    const [lines, machines] = await Promise.all([mysqlDb.getProductionLines({}), mysqlDb.getMachines({})]);
    return { lines: [...lines, ...vLines], machines: [...machines, ...virtualMachines()] };
  }

  // Giữ nguyên thứ tự máy như API /api/machines trả về (trùng với cách giao diện đánh số OP10, OP20, ...)
  const machinesOf = (machines, lineId) => machines.filter((m) => m.lineId === lineId);

  app.get('/api/production/settings', authenticateToken, async (req, res) => {
    res.json({ settings: await loadSettings() });
  });

  app.put('/api/production/settings', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
    const threshold = Number(req.body?.shortStopThresholdMin);
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > 60) {
      return res.status(400).json({ message: 'Ngưỡng dừng ngắn phải là số phút từ 1 đến 60.', errorCode: 'INVALID_THRESHOLD' });
    }
    const next = { ...(await loadSettings()), shortStopThresholdMin: Math.round(threshold) };
    memorySettings = next;
    if (dbReady()) {
      try {
        await mysqlDb.setAppSetting(SETTINGS_KEY, next, req.user?.email || null);
        mysqlDb
          .addAuditLog({
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.fullName,
            employeeId: req.user.employeeId,
            action: 'UPDATE_SETTINGS',
            target: 'production.shortStopThresholdMin',
            details: `Đổi ngưỡng dừng ngắn thành ${next.shortStopThresholdMin} phút`,
            ipAddress: req.ip || '127.0.0.1',
          })
          .catch(() => {});
      } catch (err) {
        return res.status(500).json({ message: 'Không lưu được cài đặt: ' + err.message });
      }
    }
    res.json({ settings: next });
  });

  app.get('/api/production/overview', authenticateToken, async (req, res) => {
    try {
      const settings = await loadSettings();
      const { lines, machines } = await loadLinesAndMachines();
      const now = new Date();
      const lineShifts = lines.map((line) =>
        simulateLineShift({ line, machines: machinesOf(machines, line.id), now, settings })
      );
      res.json(buildFactoryOverview({ lineShifts, machines, lines }));
    } catch (err) {
      console.error('[Production Overview Error]:', err);
      res.status(500).json({ message: 'Lỗi tạo tổng quan sản xuất: ' + err.message });
    }
  });

  async function findLine(req, res) {
    const { lines, machines } = await loadLinesAndMachines();
    const line = lines.find((l) => l.id === req.params.lineId || l.code === req.params.lineId);
    if (!line) {
      res.status(404).json({ message: 'Không tìm thấy dây chuyền.', errorCode: 'LINE_NOT_FOUND' });
      return null;
    }
    return { line, lines, machines };
  }

  const validDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const validShift = (s) => (['1', '2', '3'].includes(String(s)) ? Number(s) : undefined);

  app.get('/api/production/lines/:lineId', authenticateToken, async (req, res) => {
    try {
      const found = await findLine(req, res);
      if (!found) return;
      const settings = await loadSettings();
      res.json(
        simulateLineShift({
          line: found.line,
          machines: machinesOf(found.machines, found.line.id),
          date: validDate(req.query.date),
          shift: validShift(req.query.shift),
          settings,
        })
      );
    } catch (err) {
      console.error('[Production Line Error]:', err);
      res.status(500).json({ message: 'Lỗi tạo dữ liệu sản xuất: ' + err.message });
    }
  });

  app.get('/api/production/lines/:lineId/daily', authenticateToken, async (req, res) => {
    try {
      const found = await findLine(req, res);
      if (!found) return;
      const settings = await loadSettings();
      res.json(
        simulateLineDaily({
          line: found.line,
          machines: machinesOf(found.machines, found.line.id),
          period: req.query.period === 'month' ? 'month' : 'week',
          date: validDate(req.query.date),
          settings,
        })
      );
    } catch (err) {
      console.error('[Production Daily Error]:', err);
      res.status(500).json({ message: 'Lỗi tạo dữ liệu sản lượng theo ngày: ' + err.message });
    }
  });

  app.get('/api/production/lines/:lineId/conditions', authenticateToken, async (req, res) => {
    try {
      const found = await findLine(req, res);
      if (!found) return;
      res.json(simulateProcessConditions({ line: found.line, days: req.query.days }));
    } catch (err) {
      console.error('[Production Conditions Error]:', err);
      res.status(500).json({ message: 'Lỗi tạo dữ liệu điều kiện gia công: ' + err.message });
    }
  });

  app.get('/api/production/lines/:lineId/what-if', authenticateToken, async (req, res) => {
    try {
      const found = await findLine(req, res);
      if (!found) return;
      const settings = await loadSettings();
      const now = new Date();
      const shifts = found.lines.map((line) =>
        simulateLineShift({ line, machines: machinesOf(found.machines, line.id), now, settings })
      );
      const shiftData = shifts.find((s) => s.lineId === found.line.id);
      res.json(
        simulateWhatIf({
          shiftData,
          otherLines: shifts,
          params: { otHours: req.query.otHours, reroutePct: req.query.reroutePct, orderQty: req.query.orderQty },
        })
      );
    } catch (err) {
      console.error('[Production What-If Error]:', err);
      res.status(500).json({ message: 'Lỗi mô phỏng What-If: ' + err.message });
    }
  });
}
