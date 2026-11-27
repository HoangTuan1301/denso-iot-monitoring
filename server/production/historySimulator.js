/**
 * @file historySimulator.js
 * @description Sinh lịch sử thông số máy liên tục cho trang "Lịch sử dữ liệu" (bảng machine_telemetry_history).
 *
 * Trước đây chỉ có 24 giờ lịch sử mẫu lúc tạo line, toàn giá trị đẹp → trang Lịch sử trống sau 1 ngày và "ảo".
 * Nay cứ 10 phút ghi 1 mẫu cho mỗi mapping có ngưỡng, và bù lại tối đa 7 ngày khi máy chủ khởi động.
 *
 * Mô hình giá trị (tất định theo mapping + mốc 10 phút, ghi lại bao nhiêu lần cũng ra cùng giá trị):
 *  - Bình thường: dao động quanh giữa dải cảnh báo, có dao động theo ngày.
 *  - Line "có vấn đề" trong ngày (troubleLinesFor): mỗi thông số 2–4 đợt bất thường 50–180 phút,
 *    giá trị trôi ra ngoài ngưỡng cảnh báo, ~45 % số đợt chạm ngưỡng nguy hiểm.
 *  - Line bình thường: ~35 % thông số-ngày có 1 đợt cảnh báo 20–70 phút.
 *  - Nhiễu ngắn: ~2 % mẫu (line có vấn đề ~5 %) vọt qua ngưỡng cảnh báo 1 mốc.
 *  - Sự cố giả lập đang chạy: máy bị chọn ở mức nguy hiểm.
 * Tắt bằng biến môi trường HISTORY_SIM=false.
 */
import { createRng, troubleLinesFor, getEmergency } from './ProductionSimulator.js';

const SLOT_MS = 10 * 60 * 1000;
const BACKFILL_DAYS = 7;
const VN_OFFSET_MS = 7 * 3600 * 1000;

const vnDay = (ms) => new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);

/** Các đợt bất thường của 1 mapping trong 1 ngày: [{ startMs, endMs, peak }] (peak: 1 = vừa chạm cảnh báo, 2 = nguy hiểm) */
const episodeCache = new Map();
function episodesFor(m, day, lineCode) {
  const key = `${m.id}|${day}`;
  if (episodeCache.has(key)) return episodeCache.get(key);
  const rng = createRng(`hist|${key}`);
  const trouble = troubleLinesFor(day).has(lineCode);
  const n = trouble ? 2 + Math.floor(rng() * 3) : rng() < 0.35 ? 1 : 0;
  const dayStart = Date.parse(`${day}T00:00:00+07:00`);
  const eps = [];
  for (let i = 0; i < n; i++) {
    const start = dayStart + Math.floor(rng() * 22 * 60) * 60000;
    const dur = (trouble ? 50 + Math.floor(rng() * 130) : 20 + Math.floor(rng() * 50)) * 60000;
    eps.push({ startMs: start, endMs: start + dur, peak: rng() < (trouble ? 0.45 : 0.12) ? 2 : 1, up: rng() < 0.75 });
  }
  episodeCache.set(key, eps);
  if (episodeCache.size > 20000) episodeCache.clear();
  return eps;
}

function sampleValue(m, ts) {
  const wMin = num(m.warning_min);
  const wMax = num(m.warning_max);
  const cMin = num(m.critical_min);
  const cMax = num(m.critical_max);
  if (wMin === null && wMax === null) return null;
  const lo = wMin ?? (wMax - Math.abs(wMax) * 0.5);
  const hi = wMax ?? (wMin + Math.abs(wMin) * 0.5 + 1);
  const mid = (lo + hi) / 2;
  const half = Math.max((hi - lo) / 2, 1e-6);
  const rng = createRng(`hist|${m.id}|${ts}`);
  const hourPhase = ((ts + VN_OFFSET_MS) % 86400000) / 86400000;
  let v = mid + half * (0.25 * Math.sin(hourPhase * 2 * Math.PI + (m.id.length % 7)) + (rng() - 0.5) * 0.7);

  const day = vnDay(ts);
  const em = getEmergency();
  if (em && em.machineId && em.machineId === m.machine_id && ts >= Date.parse(em.startedAt) - 60000) {
    // Thông số bị sự cố: vượt ngưỡng nguy hiểm; các thông số khác của cùng máy: cảnh báo
    const hit = !em.metricName || em.metricName === m.metricName;
    if (hit) v = cMax !== null ? cMax + half * (0.1 + 0.2 * rng()) : hi + half * (0.9 + 0.3 * rng());
    else v = hi + half * (0.12 + 0.2 * rng());
  } else {
    for (const e of episodesFor(m, day, m.lineCode || m.lineId)) {
      if (ts < e.startMs || ts > e.endMs) continue;
      // Hình chuông: lên dần, đỉnh giữa đợt, rồi về lại
      const k = Math.sin(((ts - e.startMs) / (e.endMs - e.startMs)) * Math.PI);
      const over = e.peak === 2 ? ((e.up ? cMax : cMin) ?? null) : null;
      const target = e.up
        ? (over !== null ? over + half * 0.15 : hi + half * 0.55)
        : (over !== null ? over - half * 0.15 : lo - half * 0.55);
      v = v + (target - v) * Math.min(1, k * 1.7);
    }
  }
  // Nhiễu cảm biến / dao động ngắn: ~2 % mẫu vọt qua ngưỡng cảnh báo trong 1 mốc (line có vấn đề ~5 %)
  const spikeP = troubleLinesFor(day).has(m.lineCode || m.lineId) ? 0.05 : 0.02;
  if (rng() < spikeP) v = rng() < 0.75 ? hi + half * (0.08 + rng() * 0.3) : lo - half * (0.08 + rng() * 0.3);
  let status = 'normal';
  if ((cMax !== null && v >= cMax) || (cMin !== null && v <= cMin)) status = 'critical';
  else if ((wMax !== null && v > wMax) || (wMin !== null && v < wMin)) status = 'warning';
  return { value: Number(v.toFixed(2)), status };
}

function num(x) {
  const n = Number(x);
  return x === null || x === undefined || x === '' || !Number.isFinite(n) ? null : n;
}

/** Ghi ngay mẫu lịch sử cho máy bị sự cố (gọi khi bấm "Giả lập sự cố" / "Khôi phục sự cố") */
let kickMachine = null;
export function recordMachineNow(machineId) {
  if (kickMachine && machineId) kickMachine(machineId).catch(() => {});
}

export function startHistorySimulator({ db, log = console }) {
  if (process.env.HISTORY_SIM === 'false') {
    log.log('[HistorySim] Đang tắt (HISTORY_SIM=false).');
    return () => {};
  }
  let timer = null;
  let running = false;

  async function loadMappings() {
    const rows = await db.getMetricMappings({});
    const list = Array.isArray(rows) ? rows : rows?.data || rows?.mappings || [];
    let codeById = new Map();
    try {
      const [lines] = await db.getPool().query('SELECT id, code FROM production_lines');
      codeById = new Map(lines.map((l) => [l.id, l.code]));
    } catch {
      /* không có bảng line: dùng lineId */
    }
    return list
      .filter((m) => m.machine_id && m.lineId && m.thresholds && (m.thresholds.warning_min !== null || m.thresholds.warning_max !== null) && m.status !== 'inactive')
      .map((m) => ({ ...m, ...m.thresholds, id: m.id, lineCode: codeById.get(m.lineId) || m.lineId }));
  }

  let cachedMappings = null;
  let cachedAt = 0;
  async function mappingsCached() {
    if (!cachedMappings || Date.now() - cachedAt > 5 * 60000) {
      cachedMappings = await loadMappings();
      cachedAt = Date.now();
    }
    return cachedMappings;
  }

  // Mẫu tức thời (lệch mốc 10 phút) cho 1 máy: dùng khi có/khôi phục sự cố và mỗi phút trong lúc sự cố
  kickMachine = async (machineId) => {
    const list = (await mappingsCached()).filter((m) => m.machine_id === machineId);
    if (!list.length) return;
    const ts = Math.floor(Date.now() / 60000) * 60000;
    if (ts % SLOT_MS === 0) return; // mốc 10 phút đã do vòng chính ghi
    const batch = [];
    for (const m of list) {
      const s = sampleValue(m, ts);
      if (s) batch.push(rowOf(m, ts, s));
    }
    if (batch.length) await db.insertTelemetryBatch(batch);
  };

  function rowOf(m, ts, s) {
    return {
      id: `SIM_${m.id}_${ts}`.slice(0, 96),
      timestamp: new Date(ts).toISOString(),
      lineId: m.lineId,
      lineName: m.lineName,
      machineId: m.machine_id,
      machineName: m.machineName,
      metricId: m.metric_id,
      metricName: m.metricName,
      value: s.value,
      unit: m.unit || '',
      status: s.status,
      source: 'simulation',
    };
  }

  async function writeSlots(mappings, fromMs, toMs) {
    let batch = [];
    let written = 0;
    for (let ts = Math.ceil(fromMs / SLOT_MS) * SLOT_MS; ts <= toMs; ts += SLOT_MS) {
      for (const m of mappings) {
        const s = sampleValue(m, ts);
        if (!s) continue;
        batch.push(rowOf(m, ts, s));
        if (batch.length >= 1500) {
          await db.insertTelemetryBatch(batch);
          written += batch.length;
          batch = [];
        }
      }
    }
    if (batch.length) {
      await db.insertTelemetryBatch(batch);
      written += batch.length;
    }
    return written;
  }

  async function tick(backfill = false) {
    if (running) return;
    running = true;
    try {
      const mappings = await mappingsCached();
      if (!mappings.length) return;
      const now = Date.now();
      let from = now - SLOT_MS;
      if (backfill) {
        from = now - BACKFILL_DAYS * 86400000;
        try {
          const [rows] = await db.getPool().query("SELECT MAX(timestamp) AS t FROM machine_telemetry_history WHERE id LIKE 'SIM\\_%'");
          const last = rows?.[0]?.t ? Date.parse(String(rows[0].t).replace(' ', 'T') + (String(rows[0].t).includes('Z') ? '' : 'Z')) : null;
          if (last && Number.isFinite(last)) from = Math.max(from, last);
        } catch {
          /* bảng trống hoặc khác định dạng: bù đủ 7 ngày */
        }
      }
      const n = await writeSlots(mappings, from, now);
      if (backfill) log.log(`[HistorySim] Đã bù ${n} bản ghi lịch sử (${mappings.length} mapping).`);
    } catch (err) {
      log.warn('[HistorySim] Lỗi ghi lịch sử mô phỏng:', err.message);
    } finally {
      running = false;
    }
  }

  // Bù lịch sử sau khi khởi động 20 giây (để không giành tài nguyên lúc CSDL vừa sẵn sàng)
  const t0 = setTimeout(() => tick(true), 20_000);
  timer = setInterval(() => tick(false), SLOT_MS);
  // Trong lúc sự cố giả lập: mỗi phút ghi thêm 1 mẫu cho máy bị sự cố
  const emTimer = setInterval(() => {
    const em = getEmergency();
    if (em?.machineId) kickMachine(em.machineId).catch(() => {});
  }, 60_000);
  return () => {
    clearTimeout(t0);
    clearInterval(timer);
    clearInterval(emTimer);
    kickMachine = null;
  };
}
