/**
 * @file assistantEngine.ts
 * @description "Bộ não" của Trợ lý AI KaiLink: đoán ý câu hỏi (intent) và soạn câu trả lời văn xuôi
 * từ dữ liệu trực tiếp của hệ thống:
 *  - Sức khỏe / thông số máy (AIProcessedMachine, từ useMonitoringStore)
 *  - Cảnh báo (useAlarmStore)
 *  - Sản lượng, OEE, dừng máy theo ca (/api/production/*)
 * Phần dự báo (giờ chạm ngưỡng, hạn bảo dưỡng) là mô hình mô phỏng tất định theo ngày:
 * cùng một ngày hỏi lại sẽ ra cùng kết quả, khớp với dữ liệu đang hiển thị.
 *
 * Định dạng câu trả lời (markdown rút gọn, render trong AIAssistantTab):
 *  - Đoạn văn cách nhau một dòng trống; **đậm**; dòng bắt đầu "1. " là danh sách đánh số, "- " là gạch đầu dòng.
 */
import { tr, trData } from '../../../i18n/tr';
import { LINE_DISPLAY_NAME } from '../../../config/lineDisplayName';
import type { AIProcessedMachine } from '../adapters/aiTelemetryAdapter';
import type { ProductionLine, MetricIndicator } from '../../../types/hierarchy';
import type { AlarmEvent } from '../../../types/alarm';
import type { FactoryProductionOverview, LineShiftProduction } from '../../../types/production';
import type { IntentId, IntentParams } from './questionBank';

// ---------------------------------------------------------------------------
// Kiểu dữ liệu
// ---------------------------------------------------------------------------
export interface Chip {
  label: string;
  intent: IntentId;
  params?: IntentParams;
}

export interface TimelineItem {
  label: string;
  hours: number; // số giờ tính từ bây giờ
  severity: 'critical' | 'warning';
}

export interface AssistantAnswer {
  text: string;
  sources: string;
  chips: Chip[];
  timeline?: { hours: number; items: TimelineItem[] };
}

export interface AssistantContext {
  machines: AIProcessedMachine[];
  lines: ProductionLine[];
  alarms: AlarmEvent[];
  now: Date;
  getOverview: () => Promise<FactoryProductionOverview | null>;
  getLineShift: (lineId: string) => Promise<LineShiftProduction | null>;
}

// ---------------------------------------------------------------------------
// Tiện ích định dạng
// ---------------------------------------------------------------------------
const LOCALE = (() => {
  try {
    const l = localStorage.getItem('denso_iot_lang') || 'vi';
    return l === 'en' ? 'en-US' : l === 'ja' ? 'ja-JP' : 'vi-VN';
  } catch {
    return 'vi-VN';
  }
})();
export const nf = (v: number, dec = 0) =>
  v.toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec });
const b = (s: string | number) => `**${s}**`;
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Giờ dự kiến sau h giờ, làm tròn 15 phút */
function clockAfter(now: Date, h: number) {
  const t = new Date(now.getTime() + h * 3600_000);
  t.setMinutes(Math.round(t.getMinutes() / 15) * 15, 0, 0);
  return clock(t);
}
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const compact = (s: string) => norm(s).replace(/[^a-z0-9]/g, '');

/** Hash ổn định → số 0..1 */
function rand01(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Ca làm việc: 06–14, 14–22, 22–06 */
function shiftInfo(now: Date) {
  const h = now.getHours();
  const shift = h >= 6 && h < 14 ? 1 : h >= 14 && h < 22 ? 2 : 3;
  const endH = shift === 1 ? 14 : shift === 2 ? 22 : 6;
  return { shift, end: `${pad(endH)}:00` };
}

// ---------------------------------------------------------------------------
// Tên ngắn dây chuyền + nhận diện thực thể trong câu hỏi
// ---------------------------------------------------------------------------
const LINE_SHORT: Record<string, string> = LINE_DISPLAY_NAME;
const EXTRA_ALIAS: Record<string, string[]> = {
  'LN-PRS-01': ['line1', 'line01', 'line 1', 'day chuyen 1', 'dap han'], 'LN-PNT-02': ['line2', 'line02', 'line 2', 'son'],
  'LN-ASM-03': ['line3', 'line03', 'line 3', 'lap rap hoan thien', 'cvt mid'], 'LN-HSG-08': ['vo hop so', 'housing'], 'LN-DCS-09': ['decast', 'duc'],
  'LN-MH1-11': ['mid h1'], 'LN-OCV-13': ['ocv'], 'LN-JAT-06': ['jatco'],
};
const lineShort = (l: { code: string; name: string }) => LINE_SHORT[l.code] || trData(l.name);
/** "Decast 1 (LN-DCS-09)" */
const lineLabel = (l: { code: string; name: string }) => `${lineShort(l)} (${l.code})`;

function findLine(ctx: AssistantContext, idOrCode?: string) {
  if (!idOrCode) return undefined;
  return ctx.lines.find((l) => l.id === idOrCode || l.code === idOrCode);
}
function findMachine(ctx: AssistantContext, idOrCode?: string) {
  if (!idOrCode) return undefined;
  return ctx.machines.find((m) => m.machineId === idOrCode || m.machineCode === idOrCode);
}

/** Tìm máy được nhắc tới trong câu (theo mã máy hoặc id) */
export function detectMachine(ctx: AssistantContext, text: string) {
  const c = compact(text);
  const cands = [...ctx.machines].sort((a, b2) => b2.machineCode.length - a.machineCode.length);
  return cands.find((m) => {
    const codes = [m.machineCode, m.machineId].map(compact).filter((x) => x.length >= 4);
    return codes.some((x) => c.includes(x));
  });
}
/** Tìm dây chuyền được nhắc tới trong câu */
export function detectLine(ctx: AssistantContext, text: string) {
  const n = norm(text);
  const c = compact(text);
  for (const l of ctx.lines) {
    if (c.includes(compact(l.code)) || c.includes(compact(l.id))) return l;
  }
  // Ưu tiên alias dài trước để "line 1" không khớp nhầm "line 13"
  const pairs: Array<[string, ProductionLine]> = [];
  for (const l of ctx.lines) {
    const short = LINE_SHORT[l.code];
    if (short) pairs.push([norm(short), l]);
    (EXTRA_ALIAS[l.code] || []).forEach((a) => pairs.push([a, l]));
  }
  pairs.sort((a, b2) => b2[0].length - a[0].length);
  for (const [alias, l] of pairs) {
    const re = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s?')}($|[^a-z0-9])`);
    if (re.test(n)) return l;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Đoán ý câu hỏi gõ tự do
// ---------------------------------------------------------------------------
export function matchIntent(ctx: AssistantContext, text: string): { intent: IntentId; params: IntentParams } {
  const n = norm(text);
  const has = (...ks: string[]) => ks.some((k) => n.includes(k));
  const machine = detectMachine(ctx, text);
  const line = machine ? undefined : detectLine(ctx, text);
  const params: IntentParams = { machineId: machine?.machineId, lineId: line?.id };
  const hm = n.match(/(\d{1,3})\s*(gio|tieng|h\b|hours?|hrs?)/);
  if (hm) params.hours = Math.min(168, Math.max(1, Number(hm[1])));

  // Hướng dẫn xử lý
  if (has('dau thuy luc', 'hydraulic oil', 'nhiet dau')) return { intent: 'guide_hydraulic', params };
  if (has('mo-men', 'mo men', 'momen', 'torque', 'luc siet')) return { intent: 'guide_torque', params };
  if (has('1.000 gio', '1000 gio', '1000h', '1,000', 'robot han') && has('bao duong', 'quy trinh', 'maintenance', 'pm')) return { intent: 'guide_robot_pm', params };
  if (has('ro ri', 'leak')) return { intent: 'guide_leak', params };
  if (has('rung', 'vibration') && !machine) return { intent: 'guide_vibration', params };

  // Chào hỏi / trợ giúp
  if (/^(xin chao|chao|hello|hi|hey)\b/.test(n) && n.length < 30) return { intent: 'greeting', params };
  if (has('ban lam duoc gi', 'giup gi', 'what can you', 'huong dan su dung', 'help')) return { intent: 'help', params };

  // Báo cáo
  if (has('ban giao', 'handover')) return { intent: 'handover', params };
  if (has('tom tat', 'bao cao ca', 'summary', 'summar')) return { intent: 'shift_summary', params };
  if (has('top 3', 'top3', 'rui ro hom nay', 'top risk')) return { intent: 'top_risks', params };
  if (has('so sanh', 'compare')) return { intent: 'compare_oee', params };
  if (has('tot nhat', 'best')) return { intent: 'best_line', params };

  // Theo máy
  if (machine) {
    if (has('vi sao', 'tai sao', 'nguyen nhan', 'why', 'canh bao gi')) return { intent: 'machine_why', params };
    if (has('lich su', 'history', 'su co')) return { intent: 'machine_alarms', params };
    if (has('thong so', 'metric', 'gia tri', 'so lieu')) return { intent: 'machine_metrics', params };
    return { intent: 'machine_status', params };
  }

  // Dự báo bảo trì
  if (has('hieu chuan', 'calib')) return { intent: 'calibration_due', params };
  if (has('linh kien', 'phu tung', 'spare', 'part')) return { intent: 'parts_due', params };
  if (has('dinh ky', 'tuan nay', 'this week', 'preventive')) return { intent: 'pm_week', params };
  if (hm || has('sap toi', 'du bao', 'forecast', 'next', 'can bao tri', 'bao tri')) return { intent: 'forecast', params: { ...params, hours: params.hours || 6 } };
  if (has('nguy co', 'rui ro', 'sap hong', 'kem nhat', 'risk')) return { intent: 'highest_risk', params };

  // Sản lượng & OEE
  if (has('dung may nhieu', 'downtime', 'dung lau', 'mat thoi gian')) return { intent: 'top_downtime', params };
  if (/\bng\b/.test(n) || has('phe pham', 'loi san pham', 'defect', 'hang loi')) return { intent: 'ng_rate', params };
  if (has('cham ke hoach', 'cham nhat', 'thap nhat', 'behind')) return { intent: 'behind_plan', params };
  if (has('cuoi ca', 'end of shift', 'du kien dat')) return { intent: 'end_of_shift', params };
  if (line && has('ke hoach', 'san luong', 'oee', 'dat bao nhieu', 'output', 'plan')) return { intent: 'line_output', params };
  if (has('oee')) return { intent: 'factory_oee', params };
  if (has('ke hoach', 'san luong', 'output')) return { intent: line ? 'line_output' : 'factory_oee', params };

  // Tình trạng
  if (has('dang dung', 'dung chuyen', 'stopped', 'ngung')) return { intent: 'lines_stopped', params };
  if (has('canh bao', 'alarm', 'alert')) return { intent: 'open_alarms', params };
  if (has('vuot nguong', 'over threshold', 'ngoai nguong')) return { intent: 'over_threshold', params };
  if (has('mat ket noi', 'offline', 'chua co du lieu', 'no data', 'ket noi')) return { intent: 'no_data', params };
  if (line) return { intent: 'line_status', params };
  if (has('toan xuong', 'tinh hinh', 'tong quan', 'overview', 'the nao')) return { intent: 'factory_status', params };
  return { intent: 'fallback', params };
}

// ---------------------------------------------------------------------------
// Mô hình dự báo (mô phỏng tất định theo ngày)
// ---------------------------------------------------------------------------
interface ForecastItem {
  m: AIProcessedMachine;
  hours: number;
  kind: 'NOW' | 'TREND' | 'PM';
  metric?: MetricIndicator;
  threshold?: number;
  rate?: number;
  runHours?: number;
  interval?: number;
}

function pmInterval(m: AIProcessedMachine) {
  const s = norm(`${m.machineName} ${m.type}`);
  if (/(dap|press|duc|die|cat ba via)/.test(s)) return 500;
  if (/(cmm|vision|camera|ro ri|leak|khac|marker|hieu chuan|calib)/.test(s)) return 2000;
  return 1000;
}

/** Thông số gần ngưỡng cảnh báo nhất (tính theo % khoảng an toàn còn lại) */
function closestMetric(m: AIProcessedMachine) {
  let best: { metric: MetricIndicator; thr: number; margin: number } | null = null;
  for (const x of m.rawMetrics || []) {
    const v = x.currentValue;
    if (typeof v !== 'number' || !isFinite(v)) continue;
    const cands: Array<[number, number]> = [];
    if (x.warningMax != null) cands.push([x.warningMax, x.warningMax - v]);
    if (x.warningMin != null) cands.push([x.warningMin, v - x.warningMin]);
    for (const [thr, gap] of cands) {
      const span = x.warningMax != null && x.warningMin != null ? Math.abs(x.warningMax - x.warningMin) : Math.abs(thr) || 1;
      const margin = gap / (span || 1);
      if (!best || margin < best.margin) best = { metric: x, thr, margin };
    }
  }
  return best;
}

function machineForecast(m: AIProcessedMachine, now: Date): ForecastItem | null {
  if (m.isNoData) return null;
  const bad = (m.rawMetrics || []).find((x) => x.status === 'critical') || (m.rawMetrics || []).find((x) => x.status === 'warning');
  if (bad) {
    const thr = bad.currentValue > (bad.warningMax ?? Infinity) ? bad.warningMax ?? undefined : bad.warningMin ?? bad.warningMax ?? undefined;
    return { m, hours: 0, kind: 'NOW', metric: bad, threshold: thr ?? undefined };
  }
  const key = `${m.machineCode}|${dayKey(now)}`;
  const items: ForecastItem[] = [];
  const cm = closestMetric(m);
  if (cm && cm.margin > 0) {
    const health = typeof m.healthScore === 'number' ? m.healthScore : 90;
    const factor = Math.min(1, Math.max(0.35, health / 95));
    const r = rand01(key + '|trend');
    const hours = (2 + 400 * r * r) * factor;
    const rate = (cm.thr - cm.metric.currentValue) / hours;
    items.push({ m, hours, kind: 'TREND', metric: cm.metric, threshold: cm.thr, rate });
  }
  const interval = pmInterval(m);
  const elapsedToday = (now.getHours() + now.getMinutes() / 60 + 18) % 24; // giờ chạy kể từ 06:00
  const runHours = Math.min(interval - 0.5, Math.round(interval * (0.45 + 0.53 * rand01(key.split('|')[0] + '|pm')) + elapsedToday));
  items.push({ m, hours: interval - runHours, kind: 'PM', runHours, interval });
  return items.sort((a, b2) => a.hours - b2.hours)[0];
}

function forecastAll(ctx: AssistantContext) {
  return ctx.machines.map((m) => machineForecast(m, ctx.now)).filter((x): x is ForecastItem => !!x);
}

/** Tên thông số bỏ phần hậu tố " - Tên máy" (dữ liệu CSDL đặt tên kiểu "Áp suất dầu - Máy ép") */
const metricName = (x: { name: string }) => trData(x.name).split(' - ')[0].trim();
function metricLabel(x: MetricIndicator) {
  const n = metricName(x);
  return /^[A-Z]{2,}/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
}
const fmtVal = (v: number) => nf(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);

/** Một câu giải thích lý do cho mục dự báo */
function reasonSentence(f: ForecastItem, now: Date) {
  const code = b(f.m.machineCode);
  if (f.kind === 'NOW' && f.metric) {
    return tr('{0} của máy {1} đang ở {2} {3}, đã ra ngoài ngưỡng cảnh báo. Nên xử lý ngay trong ca này.',
      metricName(f.metric), code, b(fmtVal(f.metric.currentValue)), f.metric.unit);
  }
  if (f.kind === 'TREND' && f.metric && f.threshold != null && f.rate != null) {
    const dir = f.rate >= 0 ? tr('tăng') : tr('giảm');
    return tr('{0} của máy {1} đang {2} khoảng {3} {4} mỗi giờ, hiện ở {5} {4}. Nếu giữ xu hướng này thì khoảng {6} sẽ chạm ngưỡng cảnh báo {7} {4}.',
      metricName(f.metric), code, dir, b(fmtVal(Math.abs(f.rate))), f.metric.unit, b(fmtVal(f.metric.currentValue)),
      b(clockAfter(now, f.hours)), fmtVal(f.threshold));
  }
  return tr('Máy {0} đã chạy {1} / {2} giờ, sẽ đến hạn bảo dưỡng định kỳ vào khoảng {3}.',
    code, b(nf(f.runHours || 0)), nf(f.interval || 0), b(clockAfter(now, f.hours)));
}

function lineOf(ctx: AssistantContext, m: AIProcessedMachine) {
  return ctx.lines.find((l) => l.id === m.lineId) || { id: m.lineId, code: m.lineId, name: m.lineName };
}

// ---------------------------------------------------------------------------
// Sản lượng: tải ca hiện tại của tất cả dây chuyền
// ---------------------------------------------------------------------------
async function allLineShifts(ctx: AssistantContext) {
  const res = await Promise.all(ctx.lines.map((l) => ctx.getLineShift(l.id).catch(() => null)));
  return res.filter((x): x is LineShiftProduction => !!x && !x.virtual);
}
const pctOf = (s: LineShiftProduction) => (s.output.planSoFar > 0 ? (s.output.actual / s.output.planSoFar) * 100 : 0);
const ngPct = (s: LineShiftProduction) => (s.output.actual > 0 ? (s.output.defects / s.output.actual) * 100 : 0);
const targetPct = (s: LineShiftProduction) => s.output.targetPct ?? 85;
const shortOfShift = (s: LineShiftProduction) => LINE_SHORT[s.lineCode] || trData(s.lineName);

function noProduction(): AssistantAnswer {
  return {
    text: tr('Mình chưa lấy được dữ liệu sản lượng ca này từ máy chủ (có thể máy chủ đang khởi động lại). Bạn thử hỏi lại sau ít phút nhé, trong lúc đó mình vẫn trả lời được các câu về tình trạng máy và dự báo bảo trì.'),
    sources: tr('API sản lượng'),
    chips: [
      { label: tr('Tình hình toàn xưởng lúc này thế nào?'), intent: 'factory_status' },
      { label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Kiến thức hướng dẫn xử lý (tĩnh)
// ---------------------------------------------------------------------------
function guide(intent: IntentId): AssistantAnswer {
  const src = tr('hướng dẫn vận hành & bảo dưỡng của máy · kinh nghiệm bảo trì');
  const more: Chip[] = [
    { label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } },
    { label: tr('Máy nào đang vượt ngưỡng?'), intent: 'over_threshold' },
  ];
  switch (intent) {
    case 'guide_hydraulic':
      return {
        text: [
          tr('Nhiệt dầu thủy lực cao (thường trên **55 °C**) làm dầu loãng, giảm áp và mòn bơm nhanh. Bạn xử lý theo thứ tự từ dễ đến khó như sau:'),
          [
            tr('1. Kiểm tra **mức dầu** trong thùng chứa, thiếu dầu là nguyên nhân hay gặp nhất.'),
            tr('2. Xem **bộ làm mát dầu**: quạt có chạy không, két tản nhiệt có bám bụi không, van nước làm mát có mở đủ không.'),
            tr('3. Kiểm tra **lõi lọc dầu**; lọc nghẹt làm bơm phải làm việc nặng hơn và sinh nhiệt.'),
            tr('4. Nghe tiếng **bơm** và sờ nhiệt đường hồi: bơm mòn hoặc van xả áp bị rò sẽ làm dầu nóng cục bộ.'),
          ].join('\n'),
          tr('Nếu nhiệt độ vượt **60 °C** thì nên giảm tải hoặc dừng máy để tránh hỏng phớt. Sau khi xử lý, theo dõi xu hướng nhiệt trong 1–2 giờ để chắc chắn đã ổn định.'),
        ].join('\n\n'),
        sources: src,
        chips: [{ label: tr('Máy nào có nguy cơ hỏng cao nhất hôm nay?'), intent: 'highest_risk' }, ...more],
      };
    case 'guide_torque':
      return {
        text: [
          tr('Khi mô-men siết báo NG, bạn nên kiểm tra theo thứ tự này để tìm nhanh nguyên nhân:'),
          [
            tr('1. **Đầu khẩu (socket)**: mòn hoặc lắp lỏng là lỗi phổ biến nhất, thay đầu khẩu nếu đã quá số lần siết khuyến nghị.'),
            tr('2. **Chi tiết đầu vào**: ren bẩn, bulong sai loại hoặc lỗ ren có ba via làm mô-men tăng giả.'),
            tr('3. **Hiệu chuẩn súng siết**: chạy thử trên bộ kiểm mô-men chuẩn; lệch quá ±3 % thì hiệu chuẩn lại.'),
            tr('4. **Chương trình siết**: xem lại mô-men mục tiêu, góc siết và tốc độ trong bộ điều khiển.'),
          ].join('\n'),
          tr('Các sản phẩm bị NG cần được cách ly và siết lại hoặc kiểm tra 100 % trước khi chuyển công đoạn sau.'),
        ].join('\n\n'),
        sources: src,
        chips: more,
      };
    case 'guide_robot_pm':
      return {
        text: [
          tr('Bảo dưỡng định kỳ 1.000 giờ cho robot hàn mất khoảng **2–3 giờ**, nên làm vào giờ nghỉ ca. Các bước chính:'),
          [
            tr('1. Ngắt điện, khóa an toàn (LOTO) và đưa robot về tư thế bảo dưỡng.'),
            tr('2. Vệ sinh **béc hàn, chụp khí** và thay **ống dẫn dây (liner)** nếu đã mòn.'),
            tr('3. Kiểm tra **cáp hàn, cáp tín hiệu** ở các khớp xoay, tìm vết nứt hoặc gập.'),
            tr('4. Bổ sung hoặc thay **mỡ bôi trơn** hộp giảm tốc các trục theo bảng của hãng.'),
            tr('5. Kiểm tra **lưu lượng khí bảo vệ** và rò rỉ đường khí.'),
            tr('6. Chạy chương trình kiểm tra điểm gốc (TCP) và hàn thử 3–5 mẫu.'),
          ].join('\n'),
          tr('Ghi kết quả vào phiếu bảo trì trên KaiLink để hệ thống đặt lại bộ đếm giờ chạy.'),
        ].join('\n\n'),
        sources: src,
        chips: [{ label: tr('Tuần này cần bảo dưỡng định kỳ những máy nào?'), intent: 'pm_week' }, ...more],
      };
    case 'guide_vibration':
      return {
        text: [
          tr('Độ rung trục chính tăng là dấu hiệu sớm của hỏng ổ bi hoặc mất cân bằng. Bạn có thể khoanh vùng như sau:'),
          [
            tr('1. Kiểm tra **kẹp phôi và dao**: phôi kẹp lệch hoặc dao mẻ là nguyên nhân dễ xử lý nhất.'),
            tr('2. So sánh rung khi **chạy không tải** và **có tải**: không tải vẫn rung cao thì nghi ổ bi hoặc mất cân bằng.'),
            tr('3. Kiểm tra **nhiệt độ ổ trục**; vừa rung vừa nóng thì thiếu bôi trơn hoặc ổ bi sắp hỏng.'),
            tr('4. Kiểm tra **bulong chân máy** và đế máy có bị lỏng không.'),
          ].join('\n'),
          tr('Nếu rung vượt ngưỡng cảnh báo và tăng liên tục, nên giảm tốc độ trục chính và lên lịch thay ổ bi sớm.'),
        ].join('\n\n'),
        sources: src,
        chips: more,
      };
    default:
      return {
        text: [
          tr('Khi máy kiểm tra rò rỉ báo NG hàng loạt, nhiều khả năng lỗi nằm ở **máy kiểm tra** chứ không phải sản phẩm. Bạn làm theo các bước:'),
          [
            tr('1. Chạy **mẫu chuẩn OK** và **mẫu chuẩn NG**: nếu mẫu OK cũng báo NG thì lỗi do máy.'),
            tr('2. Kiểm tra **gioăng đồ gá bịt kín**: rách hoặc biến dạng sẽ làm rò khí giả.'),
            tr('3. Kiểm tra **áp khí cấp** và van điều áp chính xác, áp không ổn định làm kết quả dao động.'),
            tr('4. Kiểm tra **nhiệt độ chi tiết**: chi tiết vừa rửa còn ấm sẽ làm sai lệch phép đo chênh áp.'),
          ].join('\n'),
          tr('Sau khi sửa, kiểm tra lại toàn bộ sản phẩm bị NG trong khoảng thời gian xảy ra lỗi.'),
        ].join('\n\n'),
        sources: src,
        chips: more,
      };
  }
}

// ---------------------------------------------------------------------------
// Soạn câu trả lời
// ---------------------------------------------------------------------------
const SRC_FORECAST = () => tr('xu hướng cảm biến · ngưỡng cảnh báo · giờ chạy máy');
const SRC_PROD = () => tr('sản lượng theo giờ · dữ liệu NG · lịch sử dừng máy');
const SRC_LIVE = () => tr('thông số trực tiếp · trạng thái máy · cảnh báo');

export async function answerQuestion(
  ctx: AssistantContext,
  intent: IntentId,
  params: IntentParams = {},
  userName?: string
): Promise<AssistantAnswer> {
  const now = ctx.now;
  const withData = ctx.machines.filter((m) => !m.isNoData);

  switch (intent) {
    // ======================= DỰ BÁO BẢO TRÌ =======================
    case 'forecast': {
      const H = params.hours || 6;
      const items = forecastAll(ctx).filter((f) => f.hours <= H).sort((a, c) => a.hours - c.hours);
      const byLine = new Map<string, ForecastItem[]>();
      items.forEach((f) => byLine.set(f.m.lineId, [...(byLine.get(f.m.lineId) || []), f]));
      const groups = [...byLine.values()];
      if (!groups.length) {
        return {
          text: tr('Mình đã xem dữ liệu của cả {0} dây chuyền. Trong {1} giờ tới chưa có dây chuyền nào cần bảo trì: các thông số đều còn cách ngưỡng cảnh báo khá xa và chưa máy nào đến hạn bảo dưỡng định kỳ.',
            b(ctx.lines.length), b(H)),
          sources: SRC_FORECAST(),
          chips: [
            { label: tr('Dự báo 24 giờ tới cho toàn xưởng'), intent: 'forecast', params: { hours: 24 } },
            { label: tr('Máy nào có nguy cơ hỏng cao nhất hôm nay?'), intent: 'highest_risk' },
          ],
        };
      }
      const shown = groups.slice(0, 5);
      const list = shown.map((g, i) => {
        const l = lineOf(ctx, g[0].m);
        const lead = i === 0 ? tr('{0} là gấp nhất.', b(lineLabel(l))) : `${b(lineLabel(l))}:`;
        const extra = g.length > 1 ? ' ' + tr('Ngoài ra còn {0} máy khác trên dây chuyền này cũng cần để ý.', g.length - 1) : '';
        return `${i + 1}. ${lead} ${reasonSentence(g[0], now)}${extra}`;
      });
      const rest = ctx.lines.length - groups.length;
      const parts: string[] = [
        tr('Mình vừa xem dữ liệu 24 giờ qua của cả {0} dây chuyền. Trong {1} giờ tới (đến khoảng {2}), có {3} nên được ưu tiên bảo trì, xếp theo mức độ gấp:',
          b(ctx.lines.length), H, clockAfter(now, H), b(tr('{0} dây chuyền', groups.length))),
        list.join('\n'),
      ];
      if (groups.length > shown.length) parts.push(tr('Còn {0} dây chuyền khác có mức độ thấp hơn, bạn có thể xem đầy đủ ở tab Dự đoán bảo trì.', groups.length - shown.length));
      parts.push(
        (rest > 0 ? tr('{0} dây chuyền còn lại đang ổn định, mình chưa thấy dấu hiệu cần can thiệp trong {1} giờ tới.', rest, H) + ' ' : '') +
          tr('Bạn có muốn mình tóm tắt chi tiết máy {0} trước không?', items[0].m.machineCode)
      );
      return {
        text: parts.join('\n\n'),
        sources: SRC_FORECAST(),
        timeline: {
          hours: H,
          items: shown.map((g) => ({ label: lineShort(lineOf(ctx, g[0].m)), hours: g[0].hours, severity: g[0].hours <= H / 3 || g[0].kind === 'NOW' ? 'critical' : 'warning' })),
        },
        chips: [
          { label: tr('Xem chi tiết máy {0}', items[0].m.machineCode), intent: 'machine_status', params: { machineId: items[0].m.machineId } },
          H < 24
            ? { label: tr('Dự báo 24 giờ tới cho toàn xưởng'), intent: 'forecast', params: { hours: 24 } }
            : { label: tr('Tuần này cần bảo dưỡng định kỳ những máy nào?'), intent: 'pm_week' },
          { label: tr('Top 3 rủi ro hôm nay là gì?'), intent: 'top_risks' },
        ],
      };
    }

    case 'highest_risk': {
      const scored = withData.filter((m) => typeof m.healthScore === 'number').sort((a, c) => a.healthScore - c.healthScore);
      const worst = scored[0];
      if (!worst) return answerQuestion(ctx, 'no_data', params, userName);
      if (worst.healthScore >= 85) {
        const soon = forecastAll(ctx).sort((a, c) => a.hours - c.hours)[0];
        return {
          text: [
            tr('Hiện chưa có máy nào ở vùng rủi ro cao: điểm sức khỏe thấp nhất trong xưởng vẫn đạt {0}/100 ({1}).', b(nf(worst.healthScore)), worst.machineCode),
            soon ? tr('Máy cần để ý sớm nhất là {0} thuộc {1}. {2}', b(soon.m.machineCode), b(lineLabel(lineOf(ctx, soon.m))), reasonSentence(soon, now)) : '',
            tr('Mình sẽ cảnh báo ngay khi có thông số đi ra ngoài ngưỡng.'),
          ].filter(Boolean).join('\n\n'),
          sources: SRC_FORECAST(),
          chips: soon
            ? [
                { label: tr('Xem chi tiết máy {0}', soon.m.machineCode), intent: 'machine_status', params: { machineId: soon.m.machineId } },
                { label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } },
              ]
            : [],
        };
      }
      const f = machineForecast(worst, now);
      const l = lineOf(ctx, worst);
      const second = scored.slice(1, 3).map((m) => `${b(m.machineCode)} (${nf(m.healthScore)}/100)`).join(tr(' và '));
      return {
        text: [
          tr('Máy có nguy cơ cao nhất lúc này là {0} – {1}, thuộc {2}, với điểm sức khỏe {3}/100.',
            b(worst.machineCode), trData(worst.machineName), b(lineLabel(l)), b(nf(worst.healthScore))),
          f ? reasonSentence(f, now) : '',
          tr('Đánh giá của mô hình: {0}', trData(worst.factors.explanation)),
          second ? tr('Hai máy tiếp theo cần để ý là {0}.', second) : '',
        ].filter(Boolean).join('\n\n'),
        sources: SRC_FORECAST(),
        chips: [
          { label: tr('Vì sao máy {0} báo cảnh báo?', worst.machineCode), intent: 'machine_why', params: { machineId: worst.machineId } },
          { label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } },
        ],
      };
    }

    case 'pm_week': {
      const pm = withData
        .map((m) => {
          const key = `${m.machineCode}|${dayKey(now)}`;
          const interval = pmInterval(m);
          const elapsed = (now.getHours() + 18) % 24;
          const run = Math.min(interval - 0.5, Math.round(interval * (0.45 + 0.53 * rand01(key.split('|')[0] + '|pm')) + elapsed));
          return { m, left: interval - run, run, interval };
        })
        .filter((x) => x.left <= 7 * 16) // 2 ca/ngày × 8 giờ × 7 ngày
        .sort((a, c) => a.left - c.left);
      if (!pm.length) {
        return { text: tr('Tuần này chưa có máy nào đến hạn bảo dưỡng định kỳ.'), sources: tr('giờ chạy máy · chu kỳ bảo dưỡng'), chips: [{ label: tr('Linh kiện nào sắp cần thay?'), intent: 'parts_due' }] };
      }
      const days = (h: number) => Math.max(0, Math.floor(h / 16));
      const dayTxt = (h: number) => (days(h) === 0 ? tr('hôm nay') : tr('khoảng {0} ngày nữa', days(h)));
      const list = pm.slice(0, 8).map((x, i) =>
        tr('{0}. {1} ({2}) – đã chạy {3}/{4} giờ, đến hạn {5}.', i + 1, b(x.m.machineCode), lineShort(lineOf(ctx, x.m)), nf(x.run), nf(x.interval), b(dayTxt(x.left))));
      return {
        text: [
          tr('Tuần này có {0} đến hạn bảo dưỡng định kỳ (tính theo 2 ca mỗi ngày). Mình xếp theo hạn gần nhất:', b(tr('{0} máy', pm.length))),
          list.join('\n'),
          pm.length > 8 ? tr('Còn {0} máy nữa, bạn xem đủ trong tab Dự đoán bảo trì.', pm.length - 8) : '',
          tr('Gợi ý: gom các máy cùng dây chuyền vào cùng một lần dừng để đỡ mất sản lượng.'),
        ].filter(Boolean).join('\n\n'),
        sources: tr('giờ chạy máy · chu kỳ bảo dưỡng'),
        chips: [
          { label: tr('Quy trình bảo dưỡng 1.000 giờ cho robot hàn?'), intent: 'guide_robot_pm' },
          { label: tr('Linh kiện nào sắp cần thay?'), intent: 'parts_due' },
        ],
      };
    }

    case 'parts_due': {
      const PARTS: Array<[RegExp, string, number]> = [
        [/(siet|tightening|bulong)/, tr('đầu khẩu siết'), 50000],
        [/(han|weld)/, tr('béc hàn và ống dẫn dây'), 8000],
        [/(son|paint)/, tr('đầu phun sơn'), 600],
        [/(say|dry|oven|curing)/, tr('đèn sấy / điện trở gia nhiệt'), 4000],
        [/(dap|press|duc|die|cat ba via)/, tr('lõi lọc dầu thủy lực'), 500],
        [/(tien|phay|cnc|gia cong|mai|grind|hob)/, tr('mảnh dao cắt'), 1200],
        [/(ro ri|leak)/, tr('gioăng đồ gá bịt kín'), 20000],
      ];
      const rows = withData
        .map((m) => {
          const s = norm(`${m.machineName} ${m.type}`);
          const p = PARTS.find(([re]) => re.test(s));
          if (!p) return null;
          const used = Math.min(0.99, 0.6 + 0.39 * rand01(`${m.machineCode}|part|${dayKey(now)}`));
          return { m, part: p[1], life: p[2], used };
        })
        .filter((x): x is { m: AIProcessedMachine; part: string; life: number; used: number } => !!x && x.used >= 0.88)
        .sort((a, c) => c.used - a.used)
        .slice(0, 6);
      if (!rows.length) return { text: tr('Hiện chưa có linh kiện nào dùng quá 88 % tuổi thọ khuyến nghị.'), sources: tr('bộ đếm chu kỳ / giờ chạy'), chips: [] };
      return {
        text: [
          tr('Có {0} linh kiện đã dùng trên 88 % tuổi thọ khuyến nghị, nên chuẩn bị sẵn hàng thay thế:', b(rows.length)),
          rows.map((r, i) => tr('{0}. {1} của máy {2} ({3}): đã dùng {4} tuổi thọ (khuyến nghị {5}).', i + 1, b(r.part), b(r.m.machineCode), lineShort(lineOf(ctx, r.m)), b(`${nf(r.used * 100)} %`), nf(r.life))).join('\n'),
          tr('Bạn nên kiểm tra tồn kho các linh kiện này trước để không phải dừng máy chờ hàng.'),
        ].join('\n\n'),
        sources: tr('bộ đếm chu kỳ / giờ chạy'),
        chips: [{ label: tr('Tuần này cần bảo dưỡng định kỳ những máy nào?'), intent: 'pm_week' }],
      };
    }

    case 'calibration_due': {
      const cal = withData
        .filter((m) => /(kiem tra|test|cmm|vision|camera|ro ri|leak|hieu chuan|calib|siet|tightening|do )/.test(norm(`${m.machineName} ${m.type}`)))
        .map((m) => ({ m, days: Math.round(1 + 44 * rand01(`${m.machineCode}|cal|${now.getFullYear()}-${now.getMonth()}`)) }))
        .sort((a, c) => a.days - c.days)
        .slice(0, 5);
      if (!cal.length) return { text: tr('Chưa có máy đo / kiểm tra nào sắp đến hạn hiệu chuẩn.'), sources: tr('lịch hiệu chuẩn thiết bị đo'), chips: [] };
      return {
        text: [
          tr('Đây là các máy đo / kiểm tra có hạn hiệu chuẩn gần nhất:'),
          cal.map((c, i) => tr('{0}. {1} – {2} ({3}): còn {4} ngày.', i + 1, b(c.m.machineCode), trData(c.m.machineName), lineShort(lineOf(ctx, c.m)), b(c.days))).join('\n'),
          cal[0].days <= 7 ? tr('{0} còn dưới 1 tuần, bạn nên đặt lịch với bộ phận QC ngay.', b(cal[0].m.machineCode)) : tr('Chưa có máy nào gấp trong tuần này.'),
        ].join('\n\n'),
        sources: tr('lịch hiệu chuẩn thiết bị đo'),
        chips: [{ label: tr('Máy kiểm tra rò rỉ báo NG hàng loạt thì xử lý ra sao?'), intent: 'guide_leak' }],
      };
    }

    // ======================= TÌNH TRẠNG =======================
    case 'lines_stopped': {
      const ov = await ctx.getOverview().catch(() => null);
      if (!ov) return noProduction();
      const states = ov.lineStates.filter((s) => !s.virtual);
      const isStop = (s: (typeof states)[number]) => (s.productionStatus === 'ALARM' || s.productionStatus === 'IDLE') && s.statusCode !== 'LOW_OEE';
      const stopped = states.filter(isStop);
      const warn = states.filter((s) => !isStop(s) && s.productionStatus !== 'RUNNING');
      if (!stopped.length) {
        return {
          text: [
            tr('Hiện không có dây chuyền nào dừng hẳn: {0}/{1} dây chuyền đang sản xuất, {2}/{3} máy đang chạy.', b(ov.lines.producing), ov.lines.total, b(ov.machines.running), ov.machines.total),
            warn.length ? tr('Có {0} dây chuyền đang chạy chậm hoặc có cảnh báo: {1}.', b(warn.length), warn.map((s) => `${b(LINE_SHORT[s.lineCode] || trData(s.lineName))}${s.statusNote ? ` (${trData(s.statusNote)})` : ''}`).join(', ')) : tr('Tất cả đang chạy bình thường.'),
          ].join('\n\n'),
          sources: tr('trạng thái sản xuất theo dây chuyền'),
          chips: [{ label: tr('Dây chuyền nào dừng máy nhiều nhất ca này?'), intent: 'top_downtime' }],
        };
      }
      return {
        text: [
          tr('Hiện có {0} đang dừng:', b(tr('{0} dây chuyền', stopped.length))),
          stopped.map((s, i) => `${i + 1}. ${b(`${LINE_SHORT[s.lineCode] || trData(s.lineName)} (${s.lineCode})`)}: ${s.statusNote ? trData(s.statusNote) : tr('chưa rõ nguyên nhân')}${s.statusOp ? ` – ${s.statusOp}` : ''}.`).join('\n'),
          tr('Các dây chuyền còn lại vẫn đang chạy; {0}/{1} máy đang hoạt động.', b(ov.machines.running), ov.machines.total),
        ].join('\n\n'),
        sources: tr('trạng thái sản xuất theo dây chuyền'),
        chips: [{ label: tr('Dây chuyền nào dừng máy nhiều nhất ca này?'), intent: 'top_downtime' }, { label: tr('Có bao nhiêu cảnh báo chưa xử lý?'), intent: 'open_alarms' }],
      };
    }

    case 'open_alarms': {
      const open = ctx.alarms.filter((a) => a.status !== 'resolved');
      const pending = open.filter((a) => a.status === 'pending');
      const crit = open.filter((a) => a.severity === 'critical');
      if (!open.length) {
        return { text: tr('Hiện không có cảnh báo nào chưa xử lý. Tất cả cảnh báo trong ca đã được đóng.'), sources: tr('nhật ký cảnh báo'), chips: [{ label: tr('Máy nào đang vượt ngưỡng?'), intent: 'over_threshold' }] };
      }
      const latest = [...open].sort((a, c) => c.timestamp.localeCompare(a.timestamp)).slice(0, 4);
      return {
        text: [
          tr('Hiện có {0} chưa xử lý xong: {1} đang chờ tiếp nhận và {2} đã có người nhận sửa. Trong đó {3} ở mức nguy hiểm.',
            b(tr('{0} cảnh báo', open.length)), b(pending.length), b(open.length - pending.length), b(crit.length)),
          tr('Các cảnh báo mới nhất:'),
          latest.map((a, i) => tr('{0}. {1} – {2}: {3} {4} {5} (ngưỡng {6}), lúc {7}.', i + 1, b(trData(a.machineName)), trData(a.lineName), metricName({ name: a.metricName }), b(fmtVal(a.triggeredValue)), a.unit, fmtVal(a.thresholdValue), clock(new Date(a.timestamp)))).join('\n'),
          pending.length ? tr('Bạn nên phân công người tiếp nhận các cảnh báo đang chờ trong menu Cảnh báo & Sự cố.') : '',
        ].filter(Boolean).join('\n\n'),
        sources: tr('nhật ký cảnh báo'),
        chips: [{ label: tr('Máy nào đang vượt ngưỡng?'), intent: 'over_threshold' }, { label: tr('Top 3 rủi ro hôm nay là gì?'), intent: 'top_risks' }],
      };
    }

    case 'over_threshold': {
      const over = withData.flatMap((m) => (m.rawMetrics || []).filter((x) => x.status === 'warning' || x.status === 'critical').map((x) => ({ m, x })));
      if (!over.length) {
        return {
          text: tr('Hiện không có máy nào vượt ngưỡng. Tất cả {0} máy đang có dữ liệu đều nằm trong vùng an toàn.', b(withData.length)),
          sources: SRC_LIVE(),
          chips: [{ label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } }],
        };
      }
      return {
        text: [
          tr('Hiện có {0} thông số đang ngoài ngưỡng:', b(over.length)),
          over.slice(0, 6).map(({ m, x }, i) => {
            const thr = x.warningMax != null && x.currentValue > x.warningMax ? x.warningMax : x.warningMin;
            return tr('{0}. Máy {1} ({2}): {3} = {4} {5}{6}, mức {7}.', i + 1, b(m.machineCode), lineShort(lineOf(ctx, m)), metricLabel(x), b(fmtVal(x.currentValue)), x.unit,
              thr != null ? ' ' + tr('(ngưỡng {0})', fmtVal(thr)) : '', x.status === 'critical' ? b(tr('nguy hiểm')) : tr('cảnh báo'));
          }).join('\n'),
          tr('Bạn có thể bấm vào từng máy để xem chi tiết và lịch sử thông số.'),
        ].join('\n\n'),
        sources: SRC_LIVE(),
        chips: [{ label: tr('Vì sao máy {0} báo cảnh báo?', over[0].m.machineCode), intent: 'machine_why', params: { machineId: over[0].m.machineId } }],
      };
    }

    case 'no_data': {
      const nd = ctx.machines.filter((m) => m.isNoData);
      if (!nd.length) {
        return { text: tr('Tất cả {0} máy đều đang gửi dữ liệu bình thường, không có máy nào mất kết nối.', b(ctx.machines.length)), sources: tr('trạng thái kết nối PLC'), chips: [{ label: tr('Tình hình toàn xưởng lúc này thế nào?'), intent: 'factory_status' }] };
      }
      return {
        text: [
          tr('Có {0} chưa có dữ liệu hoặc mất kết nối:', b(tr('{0} máy', nd.length))),
          nd.slice(0, 8).map((m, i) => `${i + 1}. ${b(m.machineCode)} – ${trData(m.machineName)} (${lineShort(lineOf(ctx, m))})`).join('\n'),
          tr('Những máy này không được tính điểm sức khỏe. Bạn kiểm tra cấu hình trạm PLC trong menu Dây chuyền & Thiết bị.'),
        ].join('\n\n'),
        sources: tr('trạng thái kết nối PLC'),
        chips: [{ label: tr('Tình hình toàn xưởng lúc này thế nào?'), intent: 'factory_status' }],
      };
    }

    case 'factory_status': {
      const ov = await ctx.getOverview().catch(() => null);
      const warnM = withData.filter((m) => m.status !== 'NORMAL');
      const avgH = withData.length ? withData.reduce((s, m) => s + (m.healthScore || 0), 0) / withData.length : 0;
      const open = ctx.alarms.filter((a) => a.status !== 'resolved').length;
      const soon = forecastAll(ctx).filter((f) => f.hours <= 6);
      const soonLines = new Set(soon.map((f) => f.m.lineId)).size;
      const p1 = ov
        ? tr('Lúc {0}, nhà máy có {1}/{2} dây chuyền đang sản xuất và {3}/{4} máy đang chạy. OEE toàn xưởng ca này đạt {5}.', clock(now), b(ov.lines.producing), ov.lines.total, b(ov.machines.running), ov.machines.total, b(`${nf(ov.oee.oee ?? 0, 1)} %`))
        : tr('Lúc {0}, hệ thống đang theo dõi {1} dây chuyền và {2} máy.', clock(now), b(ctx.lines.length), b(ctx.machines.length));
      return {
        text: [
          p1,
          tr('Về thiết bị: điểm sức khỏe trung bình {0}/100, có {1} máy đang ở mức cảnh báo và {2} cảnh báo chưa xử lý.', b(nf(avgH)), b(warnM.length), b(open)),
          soonLines ? tr('Dự báo có {0} cần bảo trì trong 6 giờ tới.', b(tr('{0} dây chuyền', soonLines))) : tr('Chưa có dây chuyền nào cần bảo trì trong 6 giờ tới.'),
        ].join('\n\n'),
        sources: SRC_LIVE(),
        chips: [
          { label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } },
          { label: tr('Dây chuyền nào đang chậm kế hoạch nhất?'), intent: 'behind_plan' },
          { label: tr('Tóm tắt ca hiện tại cho quản đốc'), intent: 'shift_summary' },
        ],
      };
    }

    // ======================= SẢN LƯỢNG & OEE =======================
    case 'line_output': {
      const line = findLine(ctx, params.lineId) || ctx.lines[0];
      if (!line) return noProduction();
      const s = await ctx.getLineShift(line.id).catch(() => null);
      if (!s) return noProduction();
      const o = s.output;
      const p = pctOf(s);
      const tgt = targetPct(s);
      const defects = [...(o.defectsByType || [])].sort((a, c) => c.count - a.count);
      const worstHour = s.hourly.filter((h) => h.status === 'done' && h.actual != null).map((h) => ({ h, gap: (h.actual || 0) - h.plan })).sort((a, c) => a.gap - c.gap)[0];
      const name = lineShort(line);
      const parts: string[] = [
        tr('Tính đến {0}, ca {1} của {2} đã làm được {3} sản phẩm, tức {4} kế hoạch tới giờ này, {5} mục tiêu {6} %.',
          clock(now), s.shift, b(name), b(`${nf(o.actual)} / ${nf(o.planSoFar)}`), b(`${nf(p, 1)} %`), p >= tgt ? tr('cao hơn') : tr('thấp hơn'), tgt),
        tr('Chất lượng: tỉ lệ NG là {0} ({1} sản phẩm){2}.', b(`${nf(ngPct(s), 1)} %`), nf(o.defects),
          defects[0] && defects[0].count > 0 ? ', ' + tr('nhiều nhất là {0} ({1} cái)', trData(defects[0].label).toLowerCase(), defects[0].count) : ''),
      ];
      if (worstHour && worstHour.gap < 0) {
        const lh = worstHour.h.longStop;
        parts.push(tr('Khung {0} hụt nhiều nhất, thiếu {1} sản phẩm so với kế hoạch{2}.', worstHour.h.hour, b(Math.abs(worstHour.gap)),
          lh ? ' ' + tr('do dừng máy {0} phút ở {1}', lh.durationMin, lh.op) : worstHour.h.stopMinutes ? ' ' + tr('do dừng ngắn tổng {0} phút', worstHour.h.stopMinutes) : ''));
      }
      parts.push(tr('Nếu giữ tốc độ hiện tại, cuối ca dự kiến đạt khoảng {0} ({1} sản phẩm). OEE ca này: {2}.', b(`${nf(o.forecastPct, 0)} %`), nf(o.forecast), b(`${nf(s.oee.oee ?? 0, 1)} %`)));
      return {
        text: parts.join('\n\n'),
        sources: SRC_PROD(),
        chips: [
          { label: tr('Dây chuyền nào đang chậm kế hoạch nhất?'), intent: 'behind_plan' },
          { label: tr('Dây chuyền {0} có máy nào đang có vấn đề không?', name), intent: 'line_status', params: { lineId: line.id } },
          { label: tr('Tóm tắt ca hiện tại cho quản đốc'), intent: 'shift_summary' },
        ],
      };
    }

    case 'behind_plan':
    case 'best_line':
    case 'compare_oee':
    case 'ng_rate':
    case 'factory_oee':
    case 'end_of_shift':
    case 'top_downtime':
    case 'shift_summary':
    case 'handover': {
      const shifts = await allLineShifts(ctx);
      if (!shifts.length) return noProduction();
      const sh = shiftInfo(now);
      const tot = shifts.reduce((a, s) => ({ plan: a.plan + s.output.planSoFar, act: a.act + s.output.actual, ng: a.ng + s.output.defects, fc: a.fc + s.output.forecast, pt: a.pt + s.output.planTotal }), { plan: 0, act: 0, ng: 0, fc: 0, pt: 0 });
      const ov = await ctx.getOverview().catch(() => null);
      const facOee = ov?.oee.oee ?? shifts.reduce((a, s) => a + (s.oee.oee ?? 0), 0) / shifts.length;
      const byPct = [...shifts].sort((a, c) => pctOf(a) - pctOf(c));
      const byOee = [...shifts].sort((a, c) => (c.oee.oee ?? 0) - (a.oee.oee ?? 0));
      const stopMin = (s: LineShiftProduction) => s.longStops.minutes + s.shortStops.minutes;

      if (intent === 'behind_plan') {
        const slow = byPct.filter((s) => pctOf(s) < targetPct(s));
        const w = byPct[0];
        return {
          text: [
            slow.length
              ? tr('Có {0} đang dưới mục tiêu {1} %. Chậm nhất là {2}: mới đạt {3} kế hoạch tới giờ này ({4} sản phẩm), thiếu {5} sản phẩm.',
                b(tr('{0} dây chuyền', slow.length)), targetPct(w), b(shortOfShift(w)), b(`${nf(pctOf(w), 1)} %`), `${nf(w.output.actual)} / ${nf(w.output.planSoFar)}`, b(nf(Math.abs(w.output.gapToPlanSoFar))))
              : tr('Hiện chưa có dây chuyền nào dưới mục tiêu. Thấp nhất là {0} với {1} kế hoạch.', b(shortOfShift(w)), b(`${nf(pctOf(w), 1)} %`)),
            w.longStops.longest ? tr('Nguyên nhân chính ở {0} là lần dừng {1} phút tại {2} ({3}) lúc {4}.', shortOfShift(w), b(w.longStops.longest.durationMin), w.longStops.longest.op, trData(w.longStops.longest.cause).toLowerCase(), w.longStops.longest.startedAt) : '',
            slow.length > 1 ? tr('Các dây chuyền khác dưới mục tiêu: {0}.', slow.slice(1, 5).map((s) => `${shortOfShift(s)} (${nf(pctOf(s), 1)} %)`).join(', ')) : '',
          ].filter(Boolean).join('\n\n'),
          sources: SRC_PROD(),
          chips: [
            { label: tr('Ca này line {0} đạt bao nhiêu % kế hoạch?', shortOfShift(w)), intent: 'line_output', params: { lineId: w.lineId } },
            { label: tr('Dây chuyền nào dừng máy nhiều nhất ca này?'), intent: 'top_downtime' },
          ],
        };
      }
      if (intent === 'best_line') {
        const best = byOee[0];
        return {
          text: [
            tr('Dây chuyền chạy tốt nhất ca này là {0}: OEE {1}, đạt {2} kế hoạch tới giờ này và tỉ lệ NG chỉ {3}.',
              b(`${shortOfShift(best)} (${best.lineCode})`), b(`${nf(best.oee.oee ?? 0, 1)} %`), b(`${nf(pctOf(best), 1)} %`), b(`${nf(ngPct(best), 1)} %`)),
            tr('Xếp sau là {0}.', byOee.slice(1, 3).map((s) => `${b(shortOfShift(s))} (OEE ${nf(s.oee.oee ?? 0, 1)} %)`).join(tr(' và '))),
          ].join('\n\n'),
          sources: SRC_PROD(),
          chips: [{ label: tr('So sánh OEE các dây chuyền ca này'), intent: 'compare_oee' }],
        };
      }
      if (intent === 'compare_oee') {
        const avail = (s: LineShiftProduction) => s.oee.availability ?? 0;
        const perf = (s: LineShiftProduction) => s.oee.performance ?? 0;
        return {
          text: [
            tr('OEE ca này của các dây chuyền, từ cao xuống thấp (toàn xưởng: {0}):', b(`${nf(facOee, 1)} %`)),
            byOee.map((s, i) => tr('{0}. {1}: {2} (khả dụng {3} %, hiệu suất {4} %)', i + 1, b(shortOfShift(s)), b(`${nf(s.oee.oee ?? 0, 1)} %`), nf(avail(s), 0), nf(perf(s), 0))).join('\n'),
            tr('Chênh lệch giữa cao nhất và thấp nhất là {0} điểm. {1} thấp chủ yếu do {2}.', b(nf((byOee[0].oee.oee ?? 0) - (byOee[byOee.length - 1].oee.oee ?? 0), 1)),
              b(shortOfShift(byOee[byOee.length - 1])), avail(byOee[byOee.length - 1]) < perf(byOee[byOee.length - 1]) ? tr('thời gian dừng máy') : tr('chạy chậm hơn nhịp chuẩn')),
          ].join('\n\n'),
          sources: SRC_PROD(),
          chips: [{ label: tr('Dây chuyền nào dừng máy nhiều nhất ca này?'), intent: 'top_downtime' }, { label: tr('Dây chuyền nào chạy tốt nhất ca này?'), intent: 'best_line' }],
        };
      }
      if (intent === 'ng_rate') {
        const types = new Map<string, { label: string; count: number }>();
        shifts.forEach((s) => (s.output.defectsByType || []).forEach((d) => types.set(d.code, { label: d.label, count: (types.get(d.code)?.count || 0) + d.count })));
        const top = [...types.values()].sort((a, c) => c.count - a.count);
        const worst = [...shifts].sort((a, c) => ngPct(c) - ngPct(a))[0];
        const ngT = shifts[0].output.ngTargetPct ?? 1;
        const pctAll = tot.act ? (tot.ng / tot.act) * 100 : 0;
        return {
          text: [
            tr('Ca này toàn xưởng có {0} sản phẩm NG trên tổng {1} sản phẩm, tỉ lệ {2} – {3} mục tiêu {4} %.', b(nf(tot.ng)), nf(tot.act), b(`${nf(pctAll, 2)} %`), pctAll <= ngT ? tr('đạt') : tr('vượt'), nf(ngT, 0)),
            top.length ? tr('Lỗi gặp nhiều nhất: {0}.', top.slice(0, 3).map((d) => `${trData(d.label).toLowerCase()} (${nf(d.count)})`).join(', ')) : '',
            tr('Dây chuyền có tỉ lệ NG cao nhất là {0} với {1}.', b(shortOfShift(worst)), b(`${nf(ngPct(worst), 2)} %`)),
          ].filter(Boolean).join('\n\n'),
          sources: SRC_PROD(),
          chips: [{ label: tr('Ca này line {0} đạt bao nhiêu % kế hoạch?', shortOfShift(worst)), intent: 'line_output', params: { lineId: worst.lineId } }],
        };
      }
      if (intent === 'factory_oee') {
        return {
          text: [
            tr('OEE toàn xưởng ca {0} đang đạt {1}.', sh.shift, b(`${nf(facOee, 1)} %`)) + (ov ? ' ' + tr('Trong đó khả dụng {0} %, hiệu suất {1} % và chất lượng {2} %.', nf(ov.oee.availability ?? 0, 1), nf(ov.oee.performance ?? 0, 1), nf(ov.oee.quality ?? 0, 1)) : ''),
            tr('Sản lượng tới giờ này là {0} sản phẩm, đạt {1} kế hoạch.', b(`${nf(tot.act)} / ${nf(tot.plan)}`), b(`${nf(tot.plan ? (tot.act / tot.plan) * 100 : 0, 1)} %`)),
            tr('Cao nhất là {0} ({1} %), thấp nhất là {2} ({3} %).', b(shortOfShift(byOee[0])), nf(byOee[0].oee.oee ?? 0, 1), b(shortOfShift(byOee[byOee.length - 1])), nf(byOee[byOee.length - 1].oee.oee ?? 0, 1)),
          ].join('\n\n'),
          sources: SRC_PROD(),
          chips: [{ label: tr('So sánh OEE các dây chuyền ca này'), intent: 'compare_oee' }, { label: tr('Cuối ca dự kiến đạt bao nhiêu sản phẩm?'), intent: 'end_of_shift' }],
        };
      }
      if (intent === 'end_of_shift') {
        const fcPct = tot.pt ? (tot.fc / tot.pt) * 100 : 0;
        const risky = shifts.filter((s) => s.output.forecastPct < targetPct(s)).sort((a, c) => a.output.forecastPct - c.output.forecastPct);
        return {
          text: [
            tr('Nếu giữ tốc độ hiện tại, đến {0} toàn xưởng dự kiến làm được khoảng {1} sản phẩm, tức {2} kế hoạch cả ca ({3}).', sh.end, b(nf(tot.fc)), b(`${nf(fcPct, 1)} %`), nf(tot.pt)),
            risky.length ? tr('Có {0} dự kiến không đạt mục tiêu: {1}.', b(tr('{0} dây chuyền', risky.length)), risky.slice(0, 4).map((s) => `${b(shortOfShift(s))} (${nf(s.output.forecastPct, 0)} %)`).join(', ')) : tr('Tất cả dây chuyền đều dự kiến đạt mục tiêu.'),
          ].join('\n\n'),
          sources: SRC_PROD(),
          chips: [{ label: tr('Dây chuyền nào đang chậm kế hoạch nhất?'), intent: 'behind_plan' }],
        };
      }
      if (intent === 'top_downtime') {
        const bySt = [...shifts].sort((a, c) => stopMin(c) - stopMin(a));
        const w = bySt[0];
        const allStops = shifts.flatMap((s) => s.stops.map((x) => ({ s, x }))).sort((a, c) => c.x.durationMin - a.x.durationMin);
        return {
          text: [
            tr('{0} dừng máy nhiều nhất ca này, tổng {1} phút ({2} lần dừng dài, {3} lần dừng ngắn).', b(`${shortOfShift(w)} (${w.lineCode})`), b(nf(stopMin(w))), w.longStops.count, w.shortStops.count),
            allStops[0] ? tr('Lần dừng lâu nhất toàn xưởng: {0} phút ở {1} – {2}, lúc {3}, nguyên nhân {4}.', b(allStops[0].x.durationMin), shortOfShift(allStops[0].s), allStops[0].x.op, allStops[0].x.startedAt, trData(allStops[0].x.cause).toLowerCase()) : '',
            tr('Tiếp theo là {0}.', bySt.slice(1, 4).map((s) => `${b(shortOfShift(s))} (${nf(stopMin(s))} ${tr('phút')})`).join(', ')),
          ].filter(Boolean).join('\n\n'),
          sources: SRC_PROD(),
          chips: [{ label: tr('Ca này line {0} đạt bao nhiêu % kế hoạch?', shortOfShift(w)), intent: 'line_output', params: { lineId: w.lineId } }],
        };
      }
      // shift_summary / handover
      const risks = forecastAll(ctx).sort((a, c) => a.hours - c.hours).slice(0, 3);
      const open = ctx.alarms.filter((a) => a.status !== 'resolved');
      const longest = shifts.flatMap((s) => s.stops.map((x) => ({ s, x }))).sort((a, c) => c.x.durationMin - a.x.durationMin)[0];
      const slow = byPct.filter((s) => pctOf(s) < targetPct(s));
      if (intent === 'handover') {
        return {
          text: [
            tr('Nội dung bàn giao ca {0} (lúc {1}), bạn có thể sao chép và chỉnh sửa:', sh.shift, clock(now)),
            [
              tr('- Sản lượng: {0} sản phẩm, đạt {1} kế hoạch; NG {2}.', `${nf(tot.act)} / ${nf(tot.plan)}`, `${nf(tot.plan ? (tot.act / tot.plan) * 100 : 0, 1)} %`, `${nf(tot.act ? (tot.ng / tot.act) * 100 : 0, 2)} %`),
              tr('- OEE toàn xưởng: {0} %.', nf(facOee, 1)),
              slow.length ? tr('- Dây chuyền dưới mục tiêu: {0}.', slow.slice(0, 4).map(shortOfShift).join(', ')) : tr('- Tất cả dây chuyền đạt mục tiêu.'),
              longest ? tr('- Sự cố dừng lâu nhất: {0} – {1}, {2} phút ({3}).', shortOfShift(longest.s), longest.x.op, longest.x.durationMin, trData(longest.x.cause).toLowerCase()) : '',
              tr('- Cảnh báo chưa đóng: {0}.', open.length),
              risks.length ? tr('- Ca sau cần theo dõi: {0}.', risks.map((r) => `${r.m.machineCode} (${lineShort(lineOf(ctx, r.m))}, ~${clockAfter(now, r.hours)})`).join('; ')) : '',
            ].filter(Boolean).join('\n'),
          ].join('\n\n'),
          sources: tr('sản lượng ca · cảnh báo · dự báo bảo trì'),
          chips: [{ label: tr('Top 3 rủi ro hôm nay là gì?'), intent: 'top_risks' }],
        };
      }
      return {
        text: [
          tr('Tóm tắt ca {0} tính đến {1}:', sh.shift, clock(now)),
          tr('Toàn xưởng làm được {0} sản phẩm, đạt {1} kế hoạch tới giờ này, OEE {2} và tỉ lệ NG {3}.', b(`${nf(tot.act)} / ${nf(tot.plan)}`), b(`${nf(tot.plan ? (tot.act / tot.plan) * 100 : 0, 1)} %`), b(`${nf(facOee, 1)} %`), b(`${nf(tot.act ? (tot.ng / tot.act) * 100 : 0, 2)} %`)),
          slow.length
            ? tr('{0} đang dưới mục tiêu, chậm nhất là {1} ({2} %).', b(tr('{0} dây chuyền', slow.length)), b(shortOfShift(slow[0])), nf(pctOf(slow[0]), 1))
            : tr('Tất cả dây chuyền đều đạt mục tiêu.'),
          longest ? tr('Sự cố đáng chú ý nhất là lần dừng {0} phút ở {1} – {2} ({3}).', b(longest.x.durationMin), shortOfShift(longest.s), longest.x.op, trData(longest.x.cause).toLowerCase()) : '',
          risks.length ? tr('Về thiết bị, cần để ý {0} trong vài giờ tới; hiện còn {1} cảnh báo chưa đóng.', risks.map((r) => b(r.m.machineCode)).join(', '), b(open.length)) : '',
          tr('Dự kiến cuối ca đạt khoảng {0} kế hoạch cả ca.', b(`${nf(tot.pt ? (tot.fc / tot.pt) * 100 : 0, 0)} %`)),
        ].filter(Boolean).join('\n\n'),
        sources: tr('sản lượng ca · cảnh báo · dự báo bảo trì'),
        chips: [{ label: tr('Soạn nội dung bàn giao ca'), intent: 'handover' }, { label: tr('Top 3 rủi ro hôm nay là gì?'), intent: 'top_risks' }],
      };
    }

    // ======================= THEO MÁY / DÂY CHUYỀN =======================
    case 'machine_status':
    case 'machine_why':
    case 'machine_alarms':
    case 'machine_metrics': {
      const m = findMachine(ctx, params.machineId);
      if (!m) {
        return {
          text: tr('Mình chưa nhận ra máy bạn hỏi. Bạn gõ kèm mã máy nhé, ví dụ: {0}, {1} hoặc {2}.', b('DCS-DCM-01'), b('JAT-PRF-01'), b('MC-ASM-01')),
          sources: tr('danh mục thiết bị'),
          chips: [{ label: tr('Máy DCS-DCM-01 đang thế nào?'), intent: 'machine_status', params: { machineId: 'DCS-DCM-01' } }],
        };
      }
      const l = lineOf(ctx, m);
      const head = `${b(m.machineCode)} – ${trData(m.machineName)}`;
      if (m.isNoData) {
        return {
          text: tr('Máy {0} thuộc {1} hiện chưa có dữ liệu đo (chưa cấu hình trạm PLC hoặc mất kết nối), nên mình chưa đánh giá được tình trạng.', head, b(lineLabel(l))),
          sources: tr('trạng thái kết nối PLC'),
          chips: [{ label: tr('Có máy nào mất kết nối hoặc chưa có dữ liệu không?'), intent: 'no_data' }],
        };
      }
      const mets = (m.rawMetrics || []).filter((x) => typeof x.currentValue === 'number');
      const bad = mets.filter((x) => x.status === 'warning' || x.status === 'critical');
      const f = machineForecast(m, now);
      const alarms = ctx.alarms.filter((a) => a.machineId === m.machineId).sort((a, c) => c.timestamp.localeCompare(a.timestamp));
      const chips: Chip[] = [
        { label: tr('Thông số hiện tại của máy {0}?', m.machineCode), intent: 'machine_metrics', params: { machineId: m.machineId } },
        { label: tr('Lịch sử cảnh báo của {0} hôm nay?', m.machineCode), intent: 'machine_alarms', params: { machineId: m.machineId } },
        { label: tr('Dây chuyền {0} có máy nào đang có vấn đề không?', lineShort(l)), intent: 'line_status', params: { lineId: l.id } },
      ];
      const thrTxt = (x: MetricIndicator) =>
        x.warningMin != null && x.warningMax != null ? `${fmtVal(x.warningMin)} – ${fmtVal(x.warningMax)}` : x.warningMax != null ? `≤ ${fmtVal(x.warningMax)}` : x.warningMin != null ? `≥ ${fmtVal(x.warningMin)}` : '—';

      if (intent === 'machine_metrics') {
        return {
          text: [
            tr('Thông số hiện tại của máy {0} ({1}):', head, lineShort(l)),
            mets.map((x) => `- ${metricName(x)}: ${b(`${fmtVal(x.currentValue)} ${x.unit}`)} (${tr('ngưỡng')} ${thrTxt(x)})${x.status === 'warning' || x.status === 'critical' ? ' – ' + b(tr('ngoài ngưỡng')) : ''}`).join('\n'),
            bad.length ? tr('Có {0} thông số đang ngoài ngưỡng, bạn nên kiểm tra máy.', b(bad.length)) : tr('Tất cả thông số đang trong ngưỡng.'),
          ].join('\n\n'),
          sources: SRC_LIVE(),
          chips: chips.filter((c) => c.intent !== 'machine_metrics'),
        };
      }
      if (intent === 'machine_alarms') {
        return {
          text: alarms.length
            ? [
                tr('Máy {0} có {1} trong nhật ký:', head, b(tr('{0} cảnh báo', alarms.length))),
                alarms.slice(0, 6).map((a, i) => tr('{0}. {1} – {2} {3} {4} (ngưỡng {5}), {6}.', i + 1, clock(new Date(a.timestamp)), metricName({ name: a.metricName }), b(fmtVal(a.triggeredValue)), a.unit, fmtVal(a.thresholdValue),
                  a.status === 'resolved' ? tr('đã xử lý') : a.status === 'acknowledged' ? tr('đang xử lý') : b(tr('chưa tiếp nhận')))).join('\n'),
              ].join('\n\n')
            : tr('Máy {0} không có cảnh báo nào trong nhật ký hôm nay. Máy đang chạy ổn định với điểm sức khỏe {1}/100.', head, b(nf(m.healthScore))),
          sources: tr('nhật ký cảnh báo'),
          chips: chips.filter((c) => c.intent !== 'machine_alarms'),
        };
      }
      if (intent === 'machine_why') {
        if (!bad.length) {
          return {
            text: [
              tr('Hiện máy {0} không có thông số nào vượt ngưỡng, điểm sức khỏe {1}/100.', head, b(nf(m.healthScore))),
              f && f.kind !== 'PM' ? reasonSentence(f, now) : f ? reasonSentence(f, now) : '',
              alarms[0] ? tr('Cảnh báo gần nhất lúc {0}: {1} đạt {2} {3}, {4}.', clock(new Date(alarms[0].timestamp)), metricName({ name: alarms[0].metricName }), fmtVal(alarms[0].triggeredValue), alarms[0].unit, alarms[0].status === 'resolved' ? tr('đã xử lý') : tr('chưa đóng')) : '',
            ].filter(Boolean).join('\n\n'),
            sources: SRC_LIVE(),
            chips,
          };
        }
        const x = bad[0];
        return {
          text: [
            tr('Máy {0} báo cảnh báo vì {1} đang ở {2}, ngoài ngưỡng cho phép ({3}).', head, metricLabel(x), b(`${fmtVal(x.currentValue)} ${x.unit}`), thrTxt(x)),
            tr('Đánh giá của mô hình: {0}', trData(m.factors.explanation)),
            tr('Bạn nên kiểm tra máy trong ca này; nếu cần hướng dẫn, hãy hỏi mình "{0}".', /dau|nhiet|temp/.test(norm(x.name)) ? tr('Nhiệt dầu thủy lực cao thì xử lý thế nào?') : /rung|vib/.test(norm(x.name)) ? tr('Độ rung trục chính tăng cao thì làm gì?') : tr('Mô-men siết NG thì kiểm tra gì trước?')),
          ].join('\n\n'),
          sources: SRC_LIVE(),
          chips,
        };
      }
      // machine_status
      return {
        text: [
          tr('Máy {0} ở {1} hiện có điểm sức khỏe {2}/100 và {3}.', head, b(lineLabel(l)), b(nf(m.healthScore)), bad.length ? b(tr('{0} thông số ngoài ngưỡng', bad.length)) : tr('tất cả thông số đều trong ngưỡng')),
          mets.length ? tr('Một vài số liệu chính: {0}.', mets.slice(0, 3).map((x) => `${metricLabel(x)} ${b(`${fmtVal(x.currentValue)} ${x.unit}`)}`).join(', ')) : '',
          f ? (f.kind === 'PM' ? reasonSentence(f, now) : tr('Dự báo: {0}', reasonSentence(f, now))) : '',
          alarms.length ? tr('Hôm nay máy có {0} cảnh báo, {1} chưa đóng.', alarms.length, alarms.filter((a) => a.status !== 'resolved').length) : tr('Hôm nay máy chưa có cảnh báo nào.'),
        ].filter(Boolean).join('\n\n'),
        sources: SRC_LIVE(),
        chips: [{ label: tr('Vì sao máy {0} báo cảnh báo?', m.machineCode), intent: 'machine_why', params: { machineId: m.machineId } }, ...chips.slice(0, 2)],
      };
    }

    case 'line_status': {
      const line = findLine(ctx, params.lineId);
      if (!line) {
        return {
          text: tr('Mình chưa nhận ra dây chuyền bạn hỏi. Bạn có thể gõ tên ngắn như {0}, {1}, {2} hoặc mã {3}.', b('JATCO'), b('Decast 1'), b('CVT'), b('LN-DCS-09')),
          sources: tr('danh mục dây chuyền'),
          chips: [{ label: tr('Dây chuyền Decast 1 có máy nào đang có vấn đề không?'), intent: 'line_status', params: { lineId: 'LINE-09' } }],
        };
      }
      const ms = ctx.machines.filter((m) => m.lineId === line.id);
      const issues = ms.filter((m) => !m.isNoData && (m.rawMetrics || []).some((x) => x.status === 'warning' || x.status === 'critical'));
      const fc = ms.map((m) => machineForecast(m, now)).filter((x): x is ForecastItem => !!x).sort((a, c) => a.hours - c.hours)[0];
      const s = await ctx.getLineShift(line.id).catch(() => null);
      return {
        text: [
          tr('{0} có {1}: {2}.', b(lineLabel(line)), b(tr('{0} máy', ms.length)), ms.map((m) => m.machineCode).join(', ')),
          issues.length
            ? tr('Có {0} đang có thông số ngoài ngưỡng: {1}.', b(tr('{0} máy', issues.length)), issues.map((m) => b(m.machineCode)).join(', '))
            : tr('Hiện không có máy nào vượt ngưỡng.'),
          fc ? tr('Máy cần để ý nhất: {0}', reasonSentence(fc, now)) : '',
          s ? tr('Sản lượng ca này: {0} sản phẩm ({1} kế hoạch), OEE {2}.', `${nf(s.output.actual)} / ${nf(s.output.planSoFar)}`, b(`${nf(pctOf(s), 1)} %`), b(`${nf(s.oee.oee ?? 0, 1)} %`)) : '',
        ].filter(Boolean).join('\n\n'),
        sources: SRC_LIVE(),
        chips: [
          ...(fc ? [{ label: tr('Xem chi tiết máy {0}', fc.m.machineCode), intent: 'machine_status' as IntentId, params: { machineId: fc.m.machineId } }] : []),
          { label: tr('Ca này line {0} đạt bao nhiêu % kế hoạch?', lineShort(line)), intent: 'line_output', params: { lineId: line.id } },
        ],
      };
    }

    // ======================= BÁO CÁO: TOP RỦI RO =======================
    case 'top_risks': {
      const fc = forecastAll(ctx).sort((a, c) => a.hours - c.hours);
      const seen = new Set<string>();
      const top = fc.filter((f) => (seen.has(f.m.lineId) ? false : (seen.add(f.m.lineId), true))).slice(0, 3);
      return {
        text: [
          tr('Ba rủi ro lớn nhất hôm nay, xếp theo thời gian cần xử lý:'),
          top.map((f, i) => `${i + 1}. ${b(lineLabel(lineOf(ctx, f.m)))}: ${reasonSentence(f, now)}`).join('\n'),
          tr('Bạn có muốn mình soạn nội dung bàn giao ca kèm các rủi ro này không?'),
        ].join('\n\n'),
        sources: SRC_FORECAST(),
        timeline: { hours: Math.max(6, Math.ceil(top[top.length - 1]?.hours || 6)), items: top.map((f) => ({ label: lineShort(lineOf(ctx, f.m)), hours: f.hours, severity: f.hours <= 3 || f.kind === 'NOW' ? 'critical' : 'warning' })) },
        chips: [{ label: tr('Soạn nội dung bàn giao ca'), intent: 'handover' }, { label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } }],
      };
    }

    case 'guide_hydraulic':
    case 'guide_torque':
    case 'guide_robot_pm':
    case 'guide_vibration':
    case 'guide_leak':
      return guide(intent);

    case 'greeting':
    case 'help':
      return {
        text: [
          intent === 'greeting' ? tr('Chào {0}! Mình là trợ lý KaiLink.', userName || tr('bạn')) : tr('Mình có thể giúp bạn mấy việc sau:'),
          [
            tr('- Dự báo bảo trì: dây chuyền / máy nào cần bảo trì trong vài giờ tới, linh kiện sắp thay, lịch hiệu chuẩn.'),
            tr('- Tình trạng hiện tại: dây chuyền đang dừng, máy vượt ngưỡng, cảnh báo chưa xử lý.'),
            tr('- Sản lượng & OEE theo ca, theo từng dây chuyền.'),
            tr('- Hỏi về một máy cụ thể bằng mã máy, ví dụ DCS-DCM-01.'),
            tr('- Hướng dẫn xử lý sự cố thường gặp và soạn báo cáo, bàn giao ca.'),
          ].join('\n'),
          tr('Bạn cứ hỏi tự nhiên như nói chuyện với đồng nghiệp nhé.'),
        ].join('\n\n'),
        sources: tr('KaiLink'),
        chips: [
          { label: tr('Tình hình toàn xưởng lúc này thế nào?'), intent: 'factory_status' },
          { label: tr('Trong 6 giờ tới dây chuyền nào cần bảo trì?'), intent: 'forecast', params: { hours: 6 } },
        ],
      };

    default:
      return {
        text: [
          tr('Mình chưa hiểu rõ câu hỏi này. Bạn thử hỏi theo một trong các hướng sau nhé:'),
          [
            tr('- "Trong 6 giờ tới dây chuyền nào cần bảo trì?"'),
            tr('- "Ca này line JATCO đạt bao nhiêu % kế hoạch?"'),
            tr('- "Máy DCS-DCM-01 đang thế nào?"'),
            tr('- "Nhiệt dầu thủy lực cao thì xử lý thế nào?"'),
          ].join('\n'),
          tr('Hoặc chọn một câu trong Bộ câu hỏi mẫu bên phải.'),
        ].join('\n\n'),
        sources: tr('KaiLink'),
        chips: [{ label: tr('Bạn làm được những gì?'), intent: 'help' }],
      };
  }
}

/** Số liệu nhanh cho lời chào ở màn hình bắt đầu */
export function quickStats(ctx: AssistantContext) {
  const soon = forecastAll(ctx).filter((f) => f.hours <= 6);
  return {
    lines: ctx.lines.length,
    machines: ctx.machines.length,
    openAlarms: ctx.alarms.filter((a) => a.status !== 'resolved').length,
    linesNeedMaintenance: new Set(soon.map((f) => f.m.lineId)).size,
  };
}
