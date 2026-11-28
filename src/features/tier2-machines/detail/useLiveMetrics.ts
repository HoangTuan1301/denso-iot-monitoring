/**
 * @file useLiveMetrics.ts
 * @description Thông số "sống" cho màn Chi tiết máy.
 *  - Quy cách: dùng ngưỡng cấu hình trong CSDL nếu đã đặt thật; nếu vẫn là ngưỡng mặc định
 *    (chỉ có trần 80, không có sàn) thì dùng quy cách chuẩn theo loại thông số
 *  - Giá trị: với máy chạy mô phỏng, sinh tín hiệu dao động quanh tâm quy cách mỗi giây
 *    (thỉnh thoảng trôi về gần giới hạn) và giữ 120 điểm gần nhất (≈ 2 phút) để vẽ biểu đồ.
 *    Máy có dữ liệu thật (PLC / file) thì dùng giá trị thật.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MetricIndicator } from '../../../types/hierarchy';

export type LiveStatus = 'ok' | 'near' | 'ng';

export interface LiveMetric {
  id: string;
  name: string;
  unit: string;
  min: number | null;
  max: number | null;
  decimals: number;
  value: number;
  history: number[];
  status: LiveStatus;
  simulated: boolean;
}

interface Spec {
  min: number | null;
  max: number;
  dec: number;
}

/** Quy cách chuẩn theo mã thông số. */
const BY_CODE: Record<string, Spec> = {
  CURRENT_PHASE: { min: 8, max: 14, dec: 1 },
  POWER_CONSUMPTION: { min: 3, max: 7.5, dec: 2 },
  FLOW_COOLANT: { min: 8, max: 16, dec: 1 },
  OIL_LEVEL: { min: 60, max: 95, dec: 0 },
  VIBRATION_RMS: { min: 0, max: 4.5, dec: 2 },
  VOLTAGE_LINE: { min: 370, max: 400, dec: 0 },
  PRESSURE_HYDRAULIC: { min: 35, max: 45, dec: 1 },
  PRESSURE_PNEUMATIC: { min: 0.45, max: 0.55, dec: 2 },
  ROTATION_SPEED: { min: 30, max: 60, dec: 0 },
  TEMPERATURE: { min: 20, max: 55, dec: 1 },
  TORQUE: { min: 25, max: 30, dec: 1 },
};

/** Riêng từng máy (khớp file CSV mẫu). Khóa: `<machineId>:<mã thông số>`. */
const BY_MACHINE: Record<string, Spec> = {
  'MC-ASM-01:FLOW_COOLANT': { min: 12, max: 20, dec: 1 },
  'MC-CYL-01:CURRENT_PHASE': { min: 25, max: 42, dec: 1 },
  'MCH-PRS-01:CURRENT_PHASE': { min: 25, max: 42, dec: 1 },
  'MCH-PRS-01:POWER_CONSUMPTION': { min: 12, max: 22, dec: 2 },
  'MCH-PRS-01:FLOW_COOLANT': { min: 12, max: 20, dec: 1 },
  'MC-TEST-C01:PRESSURE_HYDRAULIC': { min: 38, max: 46, dec: 1 },
  'MC-TEST-C01:ROTATION_SPEED': { min: 1450, max: 1550, dec: 0 },
  'MCH-TST-01:ROTATION_SPEED': { min: 1450, max: 1550, dec: 0 },
  'MCH-WLD-01:ROTATION_SPEED': { min: 800, max: 1200, dec: 0 },
  'MCH-WLD-01:TEMPERATURE': { min: 20, max: 60, dec: 1 },
  'MCH-DRY-01:ROTATION_SPEED': { min: 40, max: 60, dec: 0 },
  'MCH-PNT-01:TEMPERATURE': { min: 22, max: 28, dec: 1 },
};

/** Đoán mã thông số khi dữ liệu không mang mã (dựa vào đơn vị). */
const BY_UNIT: Record<string, string> = {
  A: 'CURRENT_PHASE',
  kW: 'POWER_CONSUMPTION',
  'L/min': 'FLOW_COOLANT',
  '%': 'OIL_LEVEL',
  'mm/s': 'VIBRATION_RMS',
  V: 'VOLTAGE_LINE',
  bar: 'PRESSURE_HYDRAULIC',
  MPa: 'PRESSURE_PNEUMATIC',
  RPM: 'ROTATION_SPEED',
  rpm: 'ROTATION_SPEED',
  '°C': 'TEMPERATURE',
  'N·m': 'TORQUE',
  Nm: 'TORQUE',
};

const decOf = (n: number) => (Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2);

function specFor(machineId: string, m: MetricIndicator): Spec {
  const wMin = m.warningMin ?? null;
  const wMax = m.warningMax ?? null;
  const configured = wMin !== null && wMax !== null && wMax > wMin;
  if (configured) return { min: wMin, max: wMax as number, dec: decOf(wMax as number) };
  const raw = (m as unknown as { metricCode?: string }).metricCode || '';
  const code = Object.keys(BY_CODE).find((c) => raw.toUpperCase().includes(c)) || BY_UNIT[m.unit] || '';
  return BY_MACHINE[`${machineId}:${code}`] || BY_CODE[code] || { min: wMin, max: wMax ?? 100, dec: 1 };
}

const HISTORY = 120;

/** RNG tất định theo chuỗi (để lịch sử ban đầu ổn định giữa các lần mở trang). */
function rng(seed: string) {
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
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

interface SignalState {
  value: number;
  drift: number;
  history: number[];
  r: () => number;
}

function centerOf(s: Spec) {
  return s.min === null || s.min === 0 ? s.max * 0.45 : (s.min + s.max) / 2;
}

function step(st: SignalState, s: Spec) {
  const lo = s.min ?? 0;
  const half = (s.max - lo) / 2;
  const c = centerOf(s);
  // Thỉnh thoảng đổi hướng trôi để có lúc tiến sát giới hạn
  if (st.r() < 0.04) st.drift = (st.r() - 0.5) * half * 1.1;
  const target = c + st.drift;
  st.value += (target - st.value) * 0.15 + gauss(st.r) * half * 0.09;
  // giữ trong khoảng nhìn được (cho phép vượt giới hạn rất ít)
  const pad = half * 0.25;
  st.value = Math.min(s.max + pad, Math.max(lo - (s.min === null || s.min === 0 ? 0 : pad), st.value));
  return st.value;
}

function statusOf(v: number, s: Spec): LiveStatus {
  const lo = s.min;
  if ((lo !== null && v < lo) || v > s.max) return 'ng';
  const span = s.max - (lo ?? 0);
  const near = span * 0.08;
  if (v > s.max - near || (lo !== null && lo !== 0 && v < lo + near)) return 'near';
  return 'ok';
}

export function useLiveMetrics(machineId: string, metrics: MetricIndicator[], running: boolean): LiveMetric[] {
  const signals = useRef<Map<string, SignalState>>(new Map());
  const [tick, setTick] = useState(0);

  const specs = useMemo(() => {
    const map = new Map<string, Spec>();
    for (const m of metrics) map.set(m.id, specFor(machineId, m));
    return map;
  }, [machineId, metrics]);

  // Khởi tạo lịch sử ~2 phút cho mỗi thông số mô phỏng
  for (const m of metrics) {
    if (signals.current.has(m.id)) continue;
    const s = specs.get(m.id)!;
    const st: SignalState = { value: centerOf(s), drift: 0, history: [], r: rng(`${machineId}|${m.id}`) };
    for (let i = 0; i < HISTORY; i++) st.history.push(step(st, s));
    signals.current.set(m.id, st);
  }

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      for (const m of metrics) {
        const st = signals.current.get(m.id);
        const s = specs.get(m.id);
        if (!st || !s) continue;
        st.history.push(step(st, s));
        if (st.history.length > HISTORY) st.history.shift();
      }
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, metrics, specs]);

  return useMemo(
    () =>
      metrics.map((m) => {
        const s = specs.get(m.id)!;
        const real = m.dataSourceType === 'PLC_DIRECT' || m.dataSourceType === 'FILE_INGEST';
        const st = signals.current.get(m.id)!;
        const history = real
          ? (m.history || []).map((h) => Number(h.value)).filter((v) => Number.isFinite(v)).slice(-HISTORY)
          : [...st.history];
        const value = real ? Number(m.currentValue) : history[history.length - 1];
        return {
          id: m.id,
          // Tên kênh dạng "Thông số - Tên máy": chỉ giữ phần thông số cho gọn
          name: m.name.split(' - ')[0],
          unit: m.unit,
          min: s.min,
          max: s.max,
          decimals: s.dec,
          value,
          history,
          status: statusOf(value, s),
          simulated: !real,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, specs, tick],
  );
}

export const fmtNum = (v: number | null | undefined, dec: number) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(dec);
