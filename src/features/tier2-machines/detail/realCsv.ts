/**
 * @file realCsv.ts
 * @description Sinh file CSV của máy theo đúng 2 mẫu thực tế của nhóm, tại thời điểm bấm "Tải CSV":
 *   1) Unipulse F381 (sóng lực ép, 1 file / 1 lần ép): gw-unipulse-F381_YYMMDDhhmmss.csv — máy ép
 *   2) Keyence KV log (vị trí đo POS1–POS3, 1 file / ngày): gw-kv-csv-file-log_YYYYMMDDhhmm.csv — các máy khác
 * Số liệu tất định theo mã máy + ngày/giờ (tải lại cùng lúc ra cùng file).
 */
/* ------------------------------ tiện ích ------------------------------ */
export function rngOf(seed: string) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => {
  let u = 0;
  for (let i = 0; i < 6; i++) u += r();
  return (u - 3) / Math.SQRT1_2 / 1.73;
};
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const BOM = '﻿';

/* ------------------------- 1) UNIPULSE F381 --------------------------- */
export type UnipulseKind = 'OK' | 'HOLD_NG' | 'WAVE_NG';
export function genUnipulse(
  machineId: string,
  { date, time, equipmentId = 0, kind = 'OK' }: { date: string; time: string; equipmentId?: number; kind?: UnipulseKind }
) {
  const r = rngOf(`${machineId}|uni|${date}|${time}`);
  const N = 2048;
  const t0 = 1140 + Math.round(r() * 20); // bắt đầu tiếp xúc
  const tp = t0 + 285 + Math.round(r() * 20); // đỉnh
  const tEnd = t0 + 440 + Math.round(r() * 15); // tụt âm sâu nhất
  const period = 19.5 + r() * 1.5; // chu kỳ rung (ms)
  const base = 0.55 + r() * 0.06;
  const peakC = kind === 'HOLD_NG' ? 3.25 + r() * 0.3 : kind === 'WAVE_NG' ? 2.1 + r() * 0.3 : 2.6 + r() * 0.35;
  const amp0 = 0.48 + r() * 0.06;
  const vMin = -(1.9 + r() * 0.35);
  const endV = 0.68 + r() * 0.1;
  // nền: trôi chậm + nhiễu
  let drift = 0;
  const ys: number[] = [];
  for (let t = 0; t < N; t++) {
    drift = 0.93 * drift + 0.012 * gauss(r);
    const wander = 0.035 * Math.sin(t / 37 + 1.3) + 0.02 * Math.sin(t / 11.5);
    let y;
    if (t < t0) {
      y = base + wander + drift;
    } else if (t < tEnd - 15) {
      // pha ép: tâm dâng lên tới đỉnh rồi hạ xuống, có rung hình sin
      let c;
      if (t <= tp) c = 0.25 + (peakC - 0.25) * Math.pow((t - t0) / (tp - t0), 2.1);
      else c = peakC - (peakC + 0.85) * Math.pow((t - tp) / (tEnd - 15 - tp), 1.4);
      const k = (t - t0) / (tEnd - t0);
      const a = amp0 * (1 - 0.35 * k) * Math.min(1, (t - t0) / 6) * (t > tp ? Math.max(0.35, 1 - (t - tp) / 220) : 1);
      y = c + a * Math.sin((2 * Math.PI * (t - t0)) / period + Math.PI / 2) + drift * 0.3;
    } else if (t <= tEnd) {
      // tụt nhanh xuống điểm âm sâu nhất
      const prev = ys[t - 1];
      const f = (t - (tEnd - 15)) / 15;
      y = prev + (vMin - prev) * Math.min(1, f * f * 1.2 + 0.08);
    } else {
      // hồi phục: nhánh nhanh + dâng chậm về nền
      const s = t - tEnd;
      y = endV + (-0.55 - endV) * Math.exp(-s / 150) + (vMin + 0.55) * Math.exp(-s / 14) + 0.015 * Math.sin(s / 9) + drift * 0.5;
    }
    ys.push(y);
  }
  // NG sóng: chèn 1 vấu bất thường trong pha ép
  let ngPoint: { x: number; y: number } | null = null;
  if (kind === 'WAVE_NG') {
    const at = t0 + 120 + Math.round(r() * 60);
    for (let t = at - 8; t <= at + 8; t++) ys[t] += 1.1 * Math.exp(-((t - at) ** 2) / 18);
    ngPoint = { x: at, y: ys[at] };
  }
  const hdr = [
    `"Equipment ID",${equipmentId}`,
    `"Wave No.",""`,
    `"Date","${date}"`,
    `"Time","${time}"`,
    `"Work No.",0`,
    `"Start(ms)",0.000`,
    `"Stop(ms)",${(N - 1).toFixed(3)}`,
    `"All Result","${kind === 'OK' ? 'OK' : 'NG'}"`,
    `"Wave Result","${kind === 'WAVE_NG' ? 'NG' : 'OK'}"`,
    `"All Hold Result","${kind === 'HOLD_NG' ? 'NG' : 'OK'}"`,
    '',
    `,"Wave Result NG Point"`,
    `"Y(N)",${ngPoint ? `${ngPoint.y.toFixed(2)}` : '"NONDATA"'}`,
    `"X(ms)",${ngPoint ? `${ngPoint.x.toFixed(3)}` : '"NONDATA"'}`,
    '',
    `"Wave Data"`,
    `"X(ms)","Measure Wave(N)"`,
  ];
  const body = ys.map((y, t) => `${t.toFixed(3)},${(Math.abs(y) < 0.005 ? 0 : y).toFixed(2)}`);
  const content = BOM + [...hdr, ...body].join('\r\n') + '\r\n';
  const [yy, mm, dd] = date.split('-');
  const fileName = `gw-unipulse-F381_${yy.slice(2)}${mm}${dd}${time.replace(/:/g, '')}.csv`;
  return { fileName, content };
}

/* --------------------------- 2) KEYENCE KV ---------------------------- */
/** untilSec: chỉ lấy các dòng tới giây này trong ngày (giờ VN); bỏ trống = cả ngày */
export function genKv(machineId: string, { date, untilSec }: { date: string; untilSec?: number }) {
  const r = rngOf(`${machineId}|kv|${date}`);
  const [Y, M, D] = date.split('-');
  const dStr = `${Y}/${M}/${D}`;
  // danh nghĩa riêng từng máy (đơn vị 0,1 µm như mẫu)
  const nom = [42550 + Math.round(gauss(r) * 150), 41800 + Math.round(gauss(r) * 150), 42850 + Math.round(gauss(r) * 150)];
  const sd = [260, 320, 280];
  const rows: (string | number)[][] = [];
  let sec = 8 * 3600 + 15 * 60 + Math.round(r() * 600); // ~08:15–08:25
  const push = (vals: number[]) => rows.push([rows.length, dStr, fmt(sec), ...vals.map((v) => Math.round(v))]);
  const fmt = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  const master = (lvl: number) => [0, 1, 2].map(() => lvl + Math.round(gauss(r) * 45 + 20));
  const step = (a: number, b: number) => (sec += a + Math.round(r() * (b - a)));

  // Hiệu chuẩn master đầu ngày: giữa → cao → thấp
  push(master(43000)); step(12, 20);
  push(master(46000)); step(300, 340);
  push(master(40000)); step(180, 200);
  // vài chi tiết chạy thử sau khi chỉnh máy
  const trial = [nom[0] - 650, nom[1] + 330, nom[2] - 50];
  for (let i = 0; i < 3; i++) { push(trial.map((v) => v + gauss(r) * 40)); step(45, 110); }
  sec = 9 * 3600 + 30 * 60 + Math.round(r() * 300); // vào sản xuất ~09:30

  const breaks: [number, number, string?][] = [
    [10 * 3600 + 13 * 60 + Math.round(r() * 300), 12 * 60 + Math.round(r() * 5 * 60)], // giải lao sáng
    [11 * 3600 + 5 * 60 + Math.round(r() * 600), 32 * 60 + Math.round(r() * 6 * 60)], // dừng giữa trưa
    [12 * 3600 + 5 * 60 + Math.round(r() * 300), 40 * 60 + Math.round(r() * 8 * 60), 'lunch'], // ăn trưa
    [14 * 3600 + 18 * 60 + Math.round(r() * 300), 7 * 60 + Math.round(r() * 3 * 60)], // giải lao chiều
  ];
  const END = 16 * 3600 + Math.round(r() * 300);
  let drift = 0;
  let bi = 0;
  while (sec < END) {
    if (bi < breaks.length && sec >= breaks[bi][0]) {
      const [, dur, kind] = breaks[bi++];
      sec += dur;
      if (kind === 'lunch') {
        // kiểm tra lại master sau giờ nghỉ trưa
        push(master(43000)); step(12, 20);
        push(master(46000)); step(30, 45);
        push(master(46000)); step(140, 160);
        push(master(46000)); step(190, 210);
        push(master(40000));
        sec += 45 * 60 + Math.round(r() * 15 * 60);
      }
      continue;
    }
    const hour = sec / 3600;
    // POS1 trôi lên dần sau trưa (nhiệt máy), có nhiễu tự tương quan
    drift = 0.8 * drift + gauss(r) * 60;
    const warm = hour > 13 ? Math.min(1, (hour - 13) / 1.5) * 420 : 0;
    const v = [
      nom[0] + warm + drift + gauss(r) * sd[0],
      nom[1] + warm * 0.6 + gauss(r) * sd[1],
      nom[2] + gauss(r) * sd[2],
    ];
    push(v);
    step(46, 58);
    if (r() < 0.08) step(70, 200); // chờ hàng / dừng ngắn
  }
  // master cuối ngày + 1 chi tiết kiểm tra
  push(master(43000)); step(18, 25);
  push(master(46000)); step(75, 90);
  push(master(40000)); step(190, 210);
  push([nom[0] - 300, nom[1] + 500, nom[2] + 400].map((v) => v + gauss(r) * 50));

  const toSec = (x: (string | number)[]) => {
    const [h, m, s2] = String(x[2]).split(':').map(Number);
    return h * 3600 + m * 60 + s2;
  };
  const kept = untilSec === undefined ? rows : rows.filter((x) => toSec(x) <= untilSec);
  if (!kept.length) return null;
  const last = String(kept[kept.length - 1][2]).split(':');
  const fileName = `gw-kv-csv-file-log_${Y}${M}${D}${last[0]}${last[1]}.csv`;
  const content = BOM + ['DATA No,DATE,TIME,POS1,POS2,POS3', ...kept.map((x) => x.join(','))].join('\n') + '\n';
  return { fileName, content };
}


/* ------------------------ chọn loại file theo máy ------------------------ */
export interface CsvMachine {
  id: string;
  code?: string;
  name?: string;
  metrics?: { name?: string }[];
}

/** Máy ép / dập (có lực ép / tên "ép", "dập" / mã PRS, PRF, CYL) → Unipulse; còn lại → KV log */
export function isPressMachine(m: CsvMachine): boolean {
  const key = `${m.id} ${m.code || ''}`.toUpperCase();
  if (/PRS|PRF|PRESS|CYL/.test(key)) return true;
  if (/(^|\s)(ép|dập)(\s|$)|press/i.test(m.name || '')) return true;
  return (m.metrics || []).some((x) => /lực ép|press force/i.test(x.name || ''));
}

/** Sinh file CSV của máy tại thời điểm `now` (giờ VN). */
export function buildMachineCsv(m: CsvMachine, now: Date = new Date()): { fileName: string; content: string } {
  const key = m.code || m.id;
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const date = vn.toISOString().slice(0, 10);
  if (isPressMachine(m)) {
    // lần ép gần nhất: chu kỳ ~14 giây
    const slot = Math.floor(vn.getTime() / 14000);
    const t = new Date(slot * 14000);
    const time = t.toISOString().slice(11, 19);
    const r = rngOf(`${key}|slot|${slot}`)();
    const kind: UnipulseKind = r < 0.08 ? 'HOLD_NG' : r < 0.12 ? 'WAVE_NG' : 'OK';
    const equipmentId = 1 + Math.floor(rngOf(`${key}|eq`)() * 8);
    return genUnipulse(key, { date: t.toISOString().slice(0, 10), time, equipmentId, kind });
  }
  const sec = vn.getUTCHours() * 3600 + vn.getUTCMinutes() * 60 + vn.getUTCSeconds();
  const today = genKv(key, { date, untilSec: sec });
  if (today) return today;
  // trước giờ làm việc: log đầy đủ của hôm trước
  const prev = new Date(vn.getTime() - 86400_000).toISOString().slice(0, 10);
  return genKv(key, { date: prev })!;
}
