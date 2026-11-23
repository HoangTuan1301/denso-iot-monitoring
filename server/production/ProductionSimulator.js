/**
 * @file ProductionSimulator.js
 * @description Bộ mô phỏng dữ liệu sản xuất (OEE, dừng máy, sản lượng, điều kiện gia công, What-If).
 *
 * - Dữ liệu sinh ra có tính TẤT ĐỊNH: cùng dây chuyền + ngày + ca luôn cho cùng kết quả,
 *   nên tải lại trang không làm số liệu "nhảy" lung tung.
 * - Mọi kết quả đều gắn `simulated: true` để giao diện hiển thị nhãn "Dữ liệu mô phỏng".
 * - Khi có dữ liệu thật từ PLC/MES, chỉ cần thay các hàm sinh dữ liệu ở đây, API giữ nguyên.
 *
 * Thuật ngữ:
 * - Dừng ngắn (チョコ停): mỗi lần dừng < ngưỡng (mặc định 10 phút, cấu hình được).
 * - Dừng dài  (ドカ停):   mỗi lần dừng >= ngưỡng.
 * - OEE = Availability × Performance × Quality.
 */

export const VN_OFFSET_MIN = 7 * 60; // Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè)

export const DEFAULT_PRODUCTION_SETTINGS = {
  shortStopThresholdMin: 10,
};

export const SHIFTS = {
  1: { id: 1, startHour: 6, label: '06:00–14:00' },
  2: { id: 2, startHour: 14, label: '14:00–22:00' },
  3: { id: 3, startHour: 22, label: '22:00–06:00' },
};
const SHIFT_MINUTES = 8 * 60;

// Hồ sơ năng lực từng dây chuyền (kế hoạch/giờ, cycle time lý tưởng). Line chưa khai báo dùng mặc định.
const LINE_PROFILES = {
  'LN-PRS-01': { planPerHour: 400, idealCycleSec: 8.6, orderCode: 'VN229700-6240', product: 'Khung gầm dập hàn' },
  'LN-PNT-02': { planPerHour: 320, idealCycleSec: 10.8, orderCode: 'VN229700-7311', product: 'Vỏ sơn tĩnh điện' },
  'LN-ASM-03': { planPerHour: 360, idealCycleSec: 9.6, orderCode: 'VN229700-8102', product: 'Cụm lắp ráp hoàn thiện' },
};
const DEFAULT_PROFILE = { planPerHour: 300, idealCycleSec: 11.5, orderCode: 'VN229700-0000', product: 'Sản phẩm' };

const LONG_STOP_CAUSES = [
  { code: 'JAM', label: 'Kẹt phôi' },
  { code: 'DIE_CHANGE', label: 'Thay khuôn đột xuất' },
  { code: 'ROBOT_ERR', label: 'Lỗi robot' },
  { code: 'MAINT', label: 'Sửa chữa bảo trì' },
  { code: 'MATERIAL', label: 'Chờ vật tư' },
  { code: 'POWER', label: 'Sự cố điện' },
];
const SHORT_STOP_CAUSES = [
  { code: 'SENSOR', label: 'Lỗi cảm biến' },
  { code: 'MISFEED', label: 'Cấp phôi lệch' },
  { code: 'TOOL_WEAR', label: 'Mòn dao/khuôn' },
  { code: 'OPERATOR', label: 'Chờ thao tác' },
];

// Điều kiện gia công theo dõi 30 ngày (quy cách min–max, giá trị danh định, độ dao động, số lẻ)
const PROCESS_CONDITIONS = [
  { key: 'air_pressure', name: 'Áp lực khí', unit: 'MPa', min: 0.45, max: 0.55, nominal: 0.5, spread: 0.018, decimals: 2 },
  { key: 'press_force', name: 'Lực ép', unit: 'kN', min: 18, max: 22, nominal: 20, spread: 0.7, decimals: 1 },
  { key: 'torque', name: 'Lực xiết', unit: 'N·m', min: 25, max: 30, nominal: 27.5, spread: 0.9, decimals: 1 },
  { key: 'oil_temp', name: 'Nhiệt độ dầu', unit: '°C', min: 40, max: 55, nominal: 47, spread: 2.2, decimals: 0 },
];

/* ------------------------------------------------------------------ */
/* Tiện ích: RNG tất định + thời gian theo giờ Việt Nam                */
/* ------------------------------------------------------------------ */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seedText) {
  let a = hashString(seedText) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (rng, min, max) => min + rng() * (max - min);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const round = (v, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/** Trả về "giờ địa phương VN" dạng các thành phần số từ một Date (UTC). */
export function toVnParts(date = new Date()) {
  const local = new Date(date.getTime() + VN_OFFSET_MIN * 60000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    weekday: local.getUTCDay(),
  };
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (p) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;

/** Ca hiện tại + ngày sản xuất (ca 3 sau nửa đêm thuộc ngày hôm trước). */
export function getCurrentShift(now = new Date()) {
  const p = toVnParts(now);
  if (p.hour >= 6 && p.hour < 14) return { shift: 1, date: ymd(p) };
  if (p.hour >= 14 && p.hour < 22) return { shift: 2, date: ymd(p) };
  if (p.hour >= 22) return { shift: 3, date: ymd(p) };
  const prev = toVnParts(new Date(now.getTime() - 24 * 3600000));
  return { shift: 3, date: ymd(prev) };
}

/** Mốc bắt đầu ca (UTC ms) cho ngày sản xuất "YYYY-MM-DD" và số ca. */
function shiftStartUtcMs(date, shift) {
  const [y, m, d] = date.split('-').map(Number);
  const startHour = SHIFTS[shift].startHour;
  return Date.UTC(y, m - 1, d, startHour, 0, 0) - VN_OFFSET_MIN * 60000;
}

function fmtClock(utcMs) {
  const p = toVnParts(new Date(utcMs));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/* ------------------------------------------------------------------ */
/* 1. Mô phỏng một ca sản xuất của một dây chuyền                       */
/* ------------------------------------------------------------------ */
/**
 * @param {object} opts
 * @param {{id:string,name?:string}} opts.line
 * @param {Array<{id:string,name:string,code?:string}>} [opts.machines]
 * @param {string} [opts.date]   Ngày sản xuất YYYY-MM-DD (mặc định: ca hiện tại)
 * @param {number} [opts.shift]  1 | 2 | 3
 * @param {Date}   [opts.now]
 * @param {object} [opts.settings]
 */
export function simulateLineShift({ line, machines = [], date, shift, now = new Date(), settings = {} }) {
  const cfg = { ...DEFAULT_PRODUCTION_SETTINGS, ...settings };
  const current = getCurrentShift(now);
  const day = date || current.date;
  const sh = Number(shift) || (date ? 1 : current.shift);
  const profile = LINE_PROFILES[line.id] || DEFAULT_PROFILE;
  const rng = createRng(`${line.id}|${day}|${sh}`);

  const startMs = shiftStartUtcMs(day, sh);
  const endMs = startMs + SHIFT_MINUTES * 60000;
  const nowMs = now.getTime();
  const elapsedMin = Math.max(0, Math.min(SHIFT_MINUTES, Math.floor((nowMs - startMs) / 60000)));
  const isFuture = nowMs < startMs;
  const isFinished = nowMs >= endMs;

  const stations = machines.length
    ? machines.map((m, i) => ({ id: m.id, name: m.name, op: `OP${(i + 1) * 10}` }))
    : [{ id: `${line.id}-ST`, name: line.name || line.id, op: 'OP10' }];

  // --- Sinh sự kiện dừng máy trên toàn ca (tất định), sau đó chỉ lấy phần đã xảy ra ---
  const events = [];
  // Dừng dài: 0–2 lần/ca, (ngưỡng + 5) – 40 phút
  const longCount = rng() < 0.3 ? 0 : rng() < 0.8 ? 1 : 2;
  for (let i = 0; i < longCount; i++) {
    const at = Math.floor(range(rng, 40, SHIFT_MINUTES - 60));
    const dur = Math.round(range(rng, cfg.shortStopThresholdMin + 5, 40));
    const st = pick(rng, stations);
    events.push({ at, dur, station: st, cause: pick(rng, LONG_STOP_CAUSES) });
  }
  // Dừng ngắn: trung bình mỗi ~40 phút một lần, 1 – 5 phút (luôn dưới ngưỡng)
  let t = Math.floor(range(rng, 10, 40));
  while (t < SHIFT_MINUTES) {
    const maxShort = Math.max(1, Math.min(5, cfg.shortStopThresholdMin - 1));
    const dur = Math.max(1, Math.round(range(rng, 1, maxShort)));
    events.push({ at: t, dur, station: pick(rng, stations), cause: pick(rng, SHORT_STOP_CAUSES) });
    t += Math.floor(range(rng, 25, 60));
  }
  events.sort((a, b) => a.at - b.at);

  const happened = isFuture
    ? []
    : events
        .filter((e) => e.at < elapsedMin)
        .map((e) => ({ ...e, dur: Math.min(e.dur, elapsedMin - e.at) }))
        .filter((e) => e.dur > 0);

  const stops = happened.map((e, i) => ({
    id: `${line.id}-${day}-${sh}-${i + 1}`,
    machineId: e.station.id,
    machineName: e.station.name,
    op: e.station.op,
    startedAt: fmtClock(startMs + e.at * 60000),
    durationMin: e.dur,
    type: e.dur >= cfg.shortStopThresholdMin ? 'LONG' : 'SHORT',
    causeCode: e.cause.code,
    cause: e.cause.label,
  }));

  // --- Sản lượng theo giờ ---
  const perfFactorBase = range(rng, 0.93, 0.985);
  const idealPerHour = 3600 / profile.idealCycleSec;
  const hourly = [];
  let produced = 0;
  for (let h = 0; h < 8; h++) {
    const hStart = h * 60;
    const hEnd = hStart + 60;
    const label = `${pad((SHIFTS[sh].startHour + h) % 24)}:00`;
    let status = 'future';
    let minutesRun = 0;
    if (!isFuture) {
      if (elapsedMin >= hEnd) status = 'done';
      else if (elapsedMin > hStart) status = 'running';
      minutesRun = Math.max(0, Math.min(hEnd, elapsedMin) - hStart);
    }
    // phút dừng rơi vào giờ này
    let stopMin = 0;
    let longNote = null;
    for (const e of happened) {
      const s = Math.max(e.at, hStart);
      const f = Math.min(e.at + e.dur, hEnd, elapsedMin);
      if (f > s) {
        stopMin += f - s;
        if (e.dur >= cfg.shortStopThresholdMin && !longNote) {
          longNote = `${e.cause.label} ${e.station.op} (${e.dur}')`;
        }
      }
    }
    const shortCount = happened.filter(
      (e) => e.dur < cfg.shortStopThresholdMin && e.at >= hStart && e.at < hEnd
    ).length;
    const perf = Math.min(0.995, perfFactorBase + range(rng, -0.015, 0.015));
    const actual =
      status === 'future' ? null : Math.round(((minutesRun - stopMin) / 60) * idealPerHour * perf);
    if (actual) produced += Math.max(0, actual);
    hourly.push({
      hour: label,
      plan: profile.planPerHour,
      planSoFar: status === 'running' ? Math.round((minutesRun / 60) * profile.planPerHour) : profile.planPerHour,
      actual: actual === null ? null : Math.max(0, actual),
      status,
      stopMinutes: stopMin,
      note: longNote || (shortCount >= 3 ? `Dừng ngắn × ${shortCount}` : null),
    });
  }

  const shortStops = stops.filter((s) => s.type === 'SHORT');
  const longStops = stops.filter((s) => s.type === 'LONG');
  const sum = (arr) => arr.reduce((a, s) => a + s.durationMin, 0);
  const totalStopMin = sum(stops);
  const runMin = Math.max(0, elapsedMin - totalStopMin);

  const defectRate = range(rng, 0.008, 0.025);
  const good = Math.round(produced * (1 - defectRate));
  const availability = elapsedMin > 0 ? runMin / elapsedMin : 0;
  const performance = runMin > 0 ? Math.min(1, (produced * profile.idealCycleSec) / (runMin * 60)) : 0;
  const quality = produced > 0 ? good / produced : 0;
  const oee = availability * performance * quality;

  const planTotal = profile.planPerHour * 8;
  const planSoFar = Math.round((elapsedMin / 60) * profile.planPerHour);
  const remainingMin = SHIFT_MINUTES - elapsedMin;
  const recentRate = elapsedMin > 0 ? produced / elapsedMin : profile.planPerHour / 60 * 0.9;
  const forecast = isFinished ? produced : Math.round(produced + recentRate * remainingMin);
  const cycleSec = produced > 0 ? (runMin * 60) / produced : profile.idealCycleSec;
  const longest = longStops.slice().sort((a, b) => b.durationMin - a.durationMin)[0] || null;

  return {
    simulated: true,
    lineId: line.id,
    lineName: line.name || line.id,
    date: day,
    shift: sh,
    shiftLabel: SHIFTS[sh].label,
    state: isFuture ? 'NOT_STARTED' : isFinished ? 'FINISHED' : 'RUNNING',
    elapsedMin,
    updatedAt: fmtClock(Math.min(nowMs, endMs)),
    settings: cfg,
    oee: {
      oee: round(oee * 100, 1),
      availability: round(availability * 100, 1),
      performance: round(performance * 100, 1),
      quality: round(quality * 100, 1),
    },
    shortStops: { count: shortStops.length, minutes: sum(shortStops) },
    longStops: { count: longStops.length, minutes: sum(longStops), longest },
    output: {
      planTotal,
      planSoFar,
      actual: produced,
      good,
      defects: produced - good,
      gapToPlanSoFar: produced - planSoFar,
      forecast,
      forecastPct: round((forecast / planTotal) * 100, 1),
    },
    taktSec: round(3600 / profile.planPerHour, 1),
    cycleSec: round(cycleSec, 1),
    hourly,
    stops,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Điều kiện gia công N ngày (mặc định 30)                           */
/* ------------------------------------------------------------------ */
export function simulateProcessConditions({ line, days = 30, now = new Date() }) {
  const n = Math.max(7, Math.min(90, Number(days) || 30));
  const today = toVnParts(now);
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day) - i * 86400000);
    dates.push({ date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() });
  }

  const conditions = PROCESS_CONDITIONS.map((c) => {
    let ngCount = 0;
    const values = dates.map(({ date, weekday }) => {
      if (weekday === 0) return { date, value: null, status: 'OFF' }; // Chủ nhật nghỉ
      const rng = createRng(`${line.id}|${c.key}|${date}`);
      let v = c.nominal + (rng() - 0.5) * 2 * c.spread;
      // ~5% số ngày lệch ra ngoài quy cách
      if (rng() < 0.05) {
        const span = c.max - c.min;
        v = rng() < 0.5 ? c.min - span * range(rng, 0.03, 0.12) : c.max + span * range(rng, 0.03, 0.12);
      }
      v = round(v, c.decimals);
      const ok = v >= c.min && v <= c.max;
      if (!ok) ngCount++;
      return { date, value: v, status: ok ? 'OK' : 'NG' };
    });
    return {
      key: c.key,
      name: c.name,
      unit: c.unit,
      specMin: c.min,
      specMax: c.max,
      decimals: c.decimals,
      ngCount,
      values,
    };
  });

  const checked = conditions.reduce((a, c) => a + c.values.filter((v) => v.status !== 'OFF').length, 0);
  const ng = conditions.reduce((a, c) => a + c.ngCount, 0);
  return {
    simulated: true,
    lineId: line.id,
    days: n,
    dates,
    conditions,
    summary: { checked, ng, passRate: checked ? round(((checked - ng) / checked) * 100, 1) : null },
  };
}

/* ------------------------------------------------------------------ */
/* 3. What-If & Thác tổn thất (cứu đơn hàng)                            */
/* ------------------------------------------------------------------ */
/**
 * @param {object} opts
 * @param {object} opts.shiftData  Kết quả simulateLineShift của line cần cứu
 * @param {Array<object>} [opts.otherLines] Kết quả simulateLineShift của các line khác (để san tải)
 * @param {object} [opts.params] { otHours, reroutePct, orderQty }
 */
export function simulateWhatIf({ shiftData, otherLines = [], params = {} }) {
  const profile = LINE_PROFILES[shiftData.lineId] || DEFAULT_PROFILE;
  const perMin = profile.planPerHour / 60;
  const planTotal = shiftData.output.planTotal;
  // Đơn hàng mặc định = 95% kế hoạch ca (để What-If có ý nghĩa khi line bị dừng)
  const defaultOrder = Math.round((planTotal * 0.95) / 10) * 10;
  const required = Math.max(1, Number(params.orderQty) || defaultOrder);
  const otHours = Math.max(0, Math.min(6, Number(params.otHours ?? 2)));
  const reroutePct = Math.max(0, Math.min(100, Number(params.reroutePct ?? 50)));
  const baseline = shiftData.output.forecast;
  const elapsed = Math.max(1, shiftData.elapsedMin);
  const remainingMin = 480 - shiftData.elapsedMin;

  // --- Thác tổn thất: Kế hoạch ca → (trừ các tổn thất) → Dự kiến hiện tại → (+ phục hồi) → Kết quả ---
  const byCause = {};
  for (const s of shiftData.stops.filter((x) => x.type === 'LONG')) {
    byCause[s.cause] = (byCause[s.cause] || 0) + s.durationMin;
  }
  let losses = Object.entries(byCause).map(([cause, min]) => ({
    key: `long:${cause}`,
    label: cause,
    kind: 'LONG_STOP',
    pcs: Math.round(min * perMin),
  }));
  // dừng ngắn: phần đã xảy ra + phần dự kiến cho thời gian còn lại của ca
  const shortRate = shiftData.shortStops.minutes / elapsed;
  const shortPcs = Math.round((shiftData.shortStops.minutes + shortRate * remainingMin) * perMin);
  if (shortPcs > 0) losses.push({ key: 'short', label: 'Dừng ngắn (チョコ停)', kind: 'SHORT_STOP', pcs: shortPcs });

  const totalLoss = Math.max(0, planTotal - baseline);
  const known = losses.reduce((a, l) => a + l.pcs, 0);
  if (known > totalLoss && known > 0) {
    // co tỉ lệ để thác tổn thất cộng trừ khớp tuyệt đối
    const k = totalLoss / known;
    losses = losses.map((l) => ({ ...l, pcs: Math.round(l.pcs * k) }));
  }
  const residual = totalLoss - losses.reduce((a, l) => a + l.pcs, 0);
  if (residual > 0) losses.push({ key: 'speed_quality', label: 'Giảm tốc & hàng lỗi', kind: 'SPEED_QUALITY', pcs: residual });

  // --- Các phương án ---
  const gap = Math.max(0, required - baseline);
  const bestOther = otherLines
    .filter((l) => l.lineId !== shiftData.lineId)
    .sort((a, b) => b.oee.oee - a.oee.oee)[0];
  // line nhận san tải có thể gánh thêm tối đa ~8% kế hoạch ca của nó
  const otherSpare = bestOther ? Math.round(bestOther.output.planTotal * 0.08) : 0;
  const rerouteGain = Math.max(0, Math.min(Math.round((gap * reroutePct) / 100), otherSpare));
  const oeeFactor = shiftData.oee.oee > 0 ? shiftData.oee.oee / 100 : 0.8;
  const otGain = Math.round(otHours * profile.planPerHour * oeeFactor);
  // Thay linh kiện ngay khi giao ca: loại bỏ ~70% dừng ngắn còn lại + tránh lặp lại dừng dài (~20 phút)
  const fixGain = Math.round((shortRate * remainingMin * 0.7 + 20) * perMin);

  const mk = (id, title, gain, cost, recoveryH, extra = {}) => {
    const qty = baseline + gain;
    return {
      id,
      title,
      gainPcs: gain,
      finalQty: qty,
      shortfall: Math.max(0, required - qty),
      meetsDue: qty >= required,
      costUsd: cost,
      recoveryHours: recoveryH,
      oee: round(Math.min(99, shiftData.oee.oee * (qty / Math.max(1, baseline))), 1),
      ...extra,
    };
  };
  const scenarios = [
    mk('BASELINE', 'Chờ sửa (Baseline)', 0, 0, round(shiftData.longStops.minutes / 60 + 1, 1)),
    mk('REROUTE', `San tải sang ${bestOther ? bestOther.lineId : 'line khác'}`, rerouteGain, rerouteGain ? 300 + rerouteGain * 2 : 0, 1, {
      targetLineId: bestOther ? bestOther.lineId : null,
      reroutePct,
    }),
    mk('OVERTIME', `Tăng ca OT ${otHours}h`, otGain, Math.round(otHours * 275), otHours, { otHours }),
    mk('SHIFT_CHANGE_FIX', 'Thay linh kiện giao ca', fixGain, 350, 0.5),
  ];

  const baselineOk = scenarios[0].meetsDue;
  const options = scenarios.slice(1);
  const feasible = options.filter((s) => s.meetsDue);
  const recommended = baselineOk
    ? scenarios[0]
    : feasible.length
      ? feasible.slice().sort((a, b) => a.costUsd - b.costUsd)[0]
      : options.slice().sort((a, b) => b.finalQty - a.finalQty)[0];

  const waterfall = [
    { label: 'Kế hoạch ca', value: planTotal, type: 'TOTAL' },
    ...losses.map((l) => ({ label: l.label, value: -l.pcs, type: 'LOSS', kind: l.kind })),
    ...(recommended.gainPcs > 0 ? [{ label: `Phục hồi: ${recommended.title}`, value: recommended.gainPcs, type: 'GAIN' }] : []),
    { label: 'Dự kiến cuối ca', value: recommended.finalQty, type: 'TOTAL' },
  ];

  let recommendation;
  if (baselineOk) recommendation = `Không cần can thiệp: dự kiến ${baseline}/${required} pcs, kịp hạn giao.`;
  else if (recommended.meetsDue)
    recommendation = `${recommended.title}: đạt ${recommended.finalQty}/${required} pcs với chi phí thấp nhất ($${recommended.costUsd}), kịp hạn giao.`;
  else
    recommendation = `Chưa phương án nào đủ ${required} pcs. Tốt nhất: ${recommended.title} (${recommended.finalQty} pcs, thiếu ${recommended.shortfall}).`;

  return {
    simulated: true,
    lineId: shiftData.lineId,
    order: {
      code: profile.orderCode,
      product: profile.product,
      requiredQty: required,
      dueAt: `${SHIFTS[shiftData.shift].label.split('–')[1]} · ca ${shiftData.shift}`,
    },
    planQty: planTotal,
    baselineQty: baseline,
    params: { otHours, reroutePct },
    scenarios,
    recommendedId: recommended.id,
    recommendation,
    waterfall,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Tổng quan nhà máy                                                 */
/* ------------------------------------------------------------------ */
export function buildFactoryOverview({ lineShifts, machines = [], lines = [] }) {
  const totalPlan = lineShifts.reduce((a, l) => a + l.output.planSoFar, 0);
  const weightedOee = totalPlan
    ? lineShifts.reduce((a, l) => a + l.oee.oee * l.output.planSoFar, 0) / totalPlan
    : null;
  const avg = (k) =>
    lineShifts.length ? round(lineShifts.reduce((a, l) => a + l.oee[k], 0) / lineShifts.length, 1) : null;

  const status = { running: 0, alarmStop: 0, offline: 0 };
  for (const m of machines) {
    const s = String(m.status || '').toUpperCase();
    if (['RUNNING', 'ACTIVE', 'NORMAL', 'IDLE', 'WARNING'].includes(s)) status.running++;
    else if (['ALARM', 'STOPPED', 'STOP', 'ERROR', 'CRITICAL', 'FAULT'].includes(s)) status.alarmStop++;
    else status.offline++;
  }

  const topDowntime = lineShifts
    .map((l) => ({
      lineId: l.lineId,
      lineName: l.lineName,
      longStopMinutes: l.longStops.minutes,
      totalStopMinutes: l.longStops.minutes + l.shortStops.minutes,
      mainCause: l.longStops.longest
        ? `${l.longStops.longest.cause} ${l.longStops.longest.op}`
        : l.shortStops.count
          ? `Dừng ngắn × ${l.shortStops.count}`
          : null,
    }))
    .sort((a, b) => b.longStopMinutes - a.longStopMinutes || b.totalStopMinutes - a.totalStopMinutes)
    .slice(0, 5);

  return {
    simulated: true,
    shift: lineShifts[0] ? { date: lineShifts[0].date, shift: lineShifts[0].shift, label: lineShifts[0].shiftLabel } : null,
    oee: {
      oee: weightedOee === null ? null : round(weightedOee, 1),
      availability: avg('availability'),
      performance: avg('performance'),
      quality: avg('quality'),
    },
    lines: { total: lines.length || lineShifts.length, producing: lineShifts.filter((l) => l.state === 'RUNNING').length },
    machines: { total: machines.length, ...status },
    topDowntime,
  };
}
