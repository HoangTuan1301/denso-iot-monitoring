// Sinh file CSV mẫu cho từng máy (demo) → public/data/machine-csv/<machineId>.csv
// Mỗi file gồm 2 phần, theo đúng 2 mẫu của nhóm:
//   1) Check sheet ca:  Parameter, Unit, Spec min, Spec max, Current, Start of shift, End of shift
//   2) Điều kiện gia công 30 ngày: Condition, Unit, Spec min, Spec max, <30 ngày>, NG
// Dữ liệu sinh tất định (cùng máy → cùng số liệu), Chủ nhật = OFF.
// Chạy lại: node scripts/gen-machine-csv.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public/data/machine-csv');
const END_DATE = '2026-11-24';
const DAYS = 30;
const SHEET_DATE = '2026-11-24';
const SHEET_SHIFT = '1';

// Quy cách chuẩn theo loại thông số: [đơn vị, min, max, số lẻ]
const P = {
  current:   (min = 8, max = 14) => ({ name: 'Dòng điện tải động cơ', unit: 'A', min, max, dec: 1 }),
  power:     (min = 3, max = 7.5) => ({ name: 'Công suất điện tiêu thụ', unit: 'kW', min, max, dec: 2 }),
  coolant:   (min = 8, max = 16) => ({ name: 'Lưu lượng dung dịch làm mát', unit: 'L/min', min, max, dec: 1 }),
  oilLevel:  () => ({ name: 'Mức dầu bôi trơn bình chứa', unit: '%', min: 60, max: 95, dec: 0 }),
  vibration: () => ({ name: 'Vận tốc rung hiệu dụng (RMS)', unit: 'mm/s', min: 0, max: 4.5, dec: 2 }),
  voltage:   () => ({ name: 'Điện áp lưới cung cấp', unit: 'V', min: 370, max: 400, dec: 0 }),
  oilPress:  (min = 35, max = 45) => ({ name: 'Áp suất dầu thủy lực', unit: 'bar', min, max, dec: 1 }),
  speed:     (min, max) => ({ name: 'Tốc độ quay trục chính', unit: 'RPM', min, max, dec: 0 }),
  temp:      (min = 20, max = 55) => ({ name: 'Nhiệt độ hoạt động', unit: '°C', min, max, dec: 1 }),
  oilTemp:   () => ({ name: 'Nhiệt độ dầu', unit: '°C', min: 40, max: 55, dec: 0 }),
  air:       () => ({ name: 'Áp lực khí', unit: 'MPa', min: 0.45, max: 0.55, dec: 2 }),
  force:     () => ({ name: 'Lực ép', unit: 'kN', min: 18, max: 22, dec: 1 }),
  torque:    () => ({ name: 'Lực xiết', unit: 'N·m', min: 25, max: 30, dec: 1 }),
};

// Máy → danh sách thông số (khớp mapping thực tế trên hệ thống + điều kiện gia công của line)
const MACHINES = {
  // Line 1 – LN-PRS-01
  'MC-ASM-01':  [P.torque(), P.current(), P.power(), P.coolant(12, 20)],
  'MC-CYL-01':  [P.force(), P.oilTemp(), P.current(25, 42), P.oilLevel(), P.vibration(), P.voltage()],
  'MC-FDR-01':  [P.air(), P.coolant(), P.oilPress(), P.speed(30, 60)],
  'MC-TEST-C01':[P.oilPress(38, 46), P.speed(1450, 1550), P.temp()],
  'MCH-PRS-01': [P.force(), P.oilTemp(), P.current(25, 42), P.power(12, 22), P.coolant(12, 20)],
  'MCH-WLD-01': [P.air(), P.speed(800, 1200), P.temp(20, 60), P.vibration()],
  // Line 2 – LN-PNT-02
  'MC-DRY-01':  [P.temp(160, 185), P.current(), P.power(5, 12), P.coolant()],
  'MC-PNT-01':  [P.air(), P.temp(22, 28), P.oilLevel()],
  'MCH-DRY-01': [P.temp(160, 185), P.speed(40, 60), P.power(8, 15)],
  'MCH-PNT-01': [P.air(), P.temp(22, 28), P.vibration()],
  // Line 3 – LN-ASM-03
  'MC-TST-01':  [P.air(), P.current(), P.power(), P.coolant()],
  'MCH-ASM-01': [P.torque(), P.current(), P.power(), P.coolant()],
  'MCH-MS10':   [P.torque(), P.current(), P.power(), P.coolant(), P.oilLevel()],
  'MCH-TST-01': [P.vibration(), P.speed(1450, 1550), P.current(), P.power(), P.coolant(), P.oilLevel()],
  // Line mô phỏng LN-AT-04
  'SIM-LN-AT-04-M1': [P.speed(1800, 2200), P.coolant(), P.current(), P.vibration()],
  'SIM-LN-AT-04-M2': [P.speed(600, 900), P.coolant(), P.current(), P.vibration()],
  'SIM-LN-AT-04-M3': [P.temp(50, 60), P.oilPress(3, 5), P.power()],
  'SIM-LN-AT-04-M4': [P.torque(), P.air(), P.current()],
  'SIM-LN-AT-04-M5': [P.air(), P.temp(), P.current()],
  // Line mô phỏng LN-AFM-05
  'SIM-LN-AFM-05-M1': [P.current(80, 120), P.air(), P.temp(20, 45)],
  'SIM-LN-AFM-05-M2': [P.air(), P.temp(22, 28), P.force()],
  'SIM-LN-AFM-05-M3': [P.temp(115, 125), P.power(4, 8)],
  'SIM-LN-AFM-05-M4': [P.temp(23, 27), P.voltage()],
};

// RNG tất định theo chuỗi
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const fmt = (v, dec) => v.toFixed(dec);
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const row = (cells) => cells.map(q).join(',');

function dates() {
  const end = new Date(`${END_DATE}T00:00:00Z`);
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (DAYS - 1 - i));
    return { iso: d.toISOString().slice(0, 10), sunday: d.getUTCDay() === 0 };
  });
}

function sample(r, p, spread = 0.22) {
  const mid = (p.min + p.max) / 2;
  const half = (p.max - p.min) / 2;
  // Thông số có min = 0 (VD: rung) dao động quanh 45% ngưỡng trên
  const center = p.min === 0 ? p.max * 0.45 : mid;
  return center + gauss(r) * half * spread;
}

function build(machineId, params) {
  const r = rng(machineId);
  const lines = [];
  lines.push(row(['Machine', machineId, 'Date', SHEET_DATE, 'Shift', SHEET_SHIFT]));
  lines.push('');
  lines.push(row(['Parameter', 'Unit', 'Spec min', 'Spec max', 'Current', 'Start of shift', 'End of shift']));
  for (const p of params) {
    const v = () => fmt(Math.min(p.max, Math.max(p.min, sample(r, p, 0.15))), p.dec + 1);
    lines.push(row([p.name, p.unit, fmt(p.min, p.dec), fmt(p.max, p.dec), v(), v(), v()]));
  }
  lines.push('');
  const ds = dates();
  lines.push(row(['Condition', 'Unit', 'Spec min', 'Spec max', ...ds.map((d) => d.iso), 'NG']));
  for (const p of params) {
    // 0–2 ngày NG ngẫu nhiên trong 30 ngày
    const workIdx = ds.map((d, i) => (d.sunday ? -1 : i)).filter((i) => i >= 0);
    const ngDays = new Set();
    const ngWanted = Math.floor(r() * 3);
    while (ngDays.size < ngWanted) ngDays.add(workIdx[Math.floor(r() * workIdx.length)]);
    let ng = 0;
    const cells = ds.map((d, i) => {
      if (d.sunday) return 'OFF';
      let v = Math.min(p.max, Math.max(p.min, sample(r, p)));
      if (ngDays.has(i)) {
        const step = (p.max - p.min) * (0.06 + r() * 0.08) || 0.1;
        v = r() < 0.5 && p.min > 0 ? p.min - step : p.max + step;
        ng += 1;
        return `${fmt(v, p.dec)} (NG)`;
      }
      return fmt(v, p.dec);
    });
    lines.push(row([p.name, p.unit, fmt(p.min, p.dec), fmt(p.max, p.dec), ...cells, String(ng)]));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

fs.mkdirSync(OUT, { recursive: true });
for (const [id, params] of Object.entries(MACHINES)) {
  fs.writeFileSync(path.join(OUT, `${id}.csv`), build(id, params), 'utf8');
}
console.log(`Đã tạo ${Object.keys(MACHINES).length} file CSV trong ${path.relative(ROOT, OUT)}`);
