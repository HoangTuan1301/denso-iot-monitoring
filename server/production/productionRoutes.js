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
 *   PUT  /api/production/lines/:lineId/plan             Sửa kế hoạch 1 giờ của ca {date, shift, hour, qty|null, reason}
 */
import {
  DEFAULT_PRODUCTION_SETTINGS,
  simulateLineShift,
  simulateLineDaily,
  simulateProcessConditions,
  simulateWhatIf,
  buildFactoryOverview,
  setPlanOverrides,
  getPlanOverrides,
  VIRTUAL_LINES,
  virtualMachines,
} from './ProductionSimulator.js';

const SETTINGS_KEY = 'production';
const PLAN_KEY = 'production_plan_overrides';
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

  // Kế hoạch theo giờ đã sửa: nạp 1 lần từ CSDL (app_settings), sau đó giữ trong bộ nhớ
  let planLoaded = false;
  async function loadPlanOverrides() {
    if (planLoaded || !dbReady()) return;
    try {
      setPlanOverrides((await mysqlDb.getAppSetting(PLAN_KEY, {})) || {});
      planLoaded = true;
    } catch (err) {
      console.warn('[Production Plan] Không đọc được kế hoạch đã sửa:', err.message);
    }
  }
  app.use('/api/production', (req, res, next) => {
    loadPlanOverrides().finally(next);
  });

  // Line thật từ CSDL + 2 line mô phỏng (đánh dấu virtual: true) để đủ Top 5 khi demo
  async function loadLinesAndMachines() {
    const vLines = VIRTUAL_LINES.map(({ machines: _m, ...l }) => l);
    if (!dbReady()) return { lines: vLines, machines: virtualMachines() };
    const [lines, machines] = await Promise.all([mysqlDb.getProductionLines({}), mysqlDb.getMachines({})]);
    // Line ảo chỉ dùng khi CSDL chưa có line cùng mã (AT, AFM nay đã là line thật trong CSDL)
    const codes = new Set(lines.map((l) => l.code));
    const extra = vLines.filter((l) => !codes.has(l.code));
    const extraIds = new Set(extra.map((l) => l.id));
    return { lines: [...lines, ...extra], machines: [...machines, ...virtualMachines().filter((m) => extraIds.has(m.lineId))] };
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

  app.put('/api/production/lines/:lineId/plan', authenticateToken, requireRole(['ADMIN', 'MAINTENANCE']), async (req, res) => {
    try {
      const found = await findLine(req, res);
      if (!found) return;
      const date = validDate(req.body?.date);
      const shift = validShift(req.body?.shift);
      const hour = Number(req.body?.hour);
      if (!date || !shift || !Number.isInteger(hour) || hour < 0 || hour > 7) {
        return res.status(400).json({ message: 'Thiếu ngày, ca hoặc giờ hợp lệ.', errorCode: 'INVALID_SLOT' });
      }
      const raw = req.body?.qty;
      const reset = raw === null || raw === undefined || raw === '';
      const qty = Number(raw);
      if (!reset && (!Number.isFinite(qty) || qty < 0 || qty > 10000)) {
        return res.status(400).json({ message: 'Số lượng kế hoạch phải từ 0 đến 10.000.', errorCode: 'INVALID_QTY' });
      }
      const key = `${found.line.id}|${date}|${shift}`;
      const all = { ...getPlanOverrides() };
      const slot = { ...(all[key] || {}) };
      if (reset) delete slot[hour];
      else slot[hour] = { qty: Math.round(qty), reason: req.body?.reason ? String(req.body.reason).slice(0, 200) : null, by: req.user?.fullName || req.user?.email || null, at: new Date().toISOString() };
      if (Object.keys(slot).length) all[key] = slot;
      else delete all[key];
      // Chỉ giữ 45 ngày gần nhất
      const cutoff = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
      for (const k of Object.keys(all)) if (k.split('|')[1] < cutoff) delete all[k];
      setPlanOverrides(all);
      if (dbReady()) {
        await mysqlDb.setAppSetting(PLAN_KEY, all, req.user?.email || null);
        mysqlDb
          .addAuditLog({
            userId: req.user.id,
            userEmail: req.user.email,
            userName: req.user.fullName,
            employeeId: req.user.employeeId,
            action: 'UPDATE_PLAN',
            target: `${found.line.code || found.line.id} ${date} ca ${shift} giờ ${hour + 1}`,
            details: reset ? 'Về kế hoạch mặc định' : `Kế hoạch giờ = ${Math.round(qty)} pcs${req.body?.reason ? ` (${String(req.body.reason).slice(0, 80)})` : ''}`,
            ipAddress: req.ip || '127.0.0.1',
          })
          .catch(() => {});
      }
      const settings = await loadSettings();
      res.json(
        simulateLineShift({ line: found.line, machines: machinesOf(found.machines, found.line.id), date, shift, settings })
      );
    } catch (err) {
      console.error('[Production Plan Error]:', err);
      res.status(500).json({ message: 'Không lưu được kế hoạch: ' + err.message });
    }
  });

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
