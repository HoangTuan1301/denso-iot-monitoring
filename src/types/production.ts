/**
 * @file production.ts
 * @description Kiểu dữ liệu cho API sản xuất (OEE, dừng máy, sản lượng, điều kiện gia công, What-If).
 * Dữ liệu hiện là mô phỏng (`simulated: true`) — giao diện cần hiện nhãn "Dữ liệu mô phỏng".
 */

export interface ProductionSettings {
  shortStopThresholdMin: number;
}

export interface OeeBreakdown {
  oee: number | null;
  availability: number | null;
  performance: number | null;
  quality: number | null;
}

export type StopType = 'SHORT' | 'LONG';
export type LineProductionStatus = 'RUNNING' | 'WARNING' | 'ALARM' | 'IDLE';

export interface StopEvent {
  id: string;
  machineId: string;
  machineName: string;
  op: string;
  startedAt: string; // HH:mm (giờ VN)
  durationMin: number;
  type: StopType;
  causeCode: string;
  cause: string;
}

export interface HourlyOutput {
  hour: string; // "06:00"
  plan: number;
  planSoFar: number;
  actual: number | null;
  status: 'done' | 'running' | 'future';
  stopMinutes: number;
  note: string | null;
}

export interface LineShiftProduction {
  simulated: boolean;
  lineId: string;
  lineCode: string;
  lineName: string;
  /** Line chỉ có trong mô phỏng (không có trong CSDL) */
  virtual: boolean;
  /** Id khu vực trên sơ đồ nhà máy */
  zoneId: string | null;
  productionStatus: LineProductionStatus;
  statusNote: string | null;
  /** Mã nguyên nhân (JAM, POWER, ...) hoặc LOW_OEE — dùng để dịch */
  statusCode: string | null;
  statusOp: string | null;
  date: string;
  shift: 1 | 2 | 3;
  shiftLabel: string;
  state: 'NOT_STARTED' | 'RUNNING' | 'FINISHED';
  elapsedMin: number;
  updatedAt: string;
  settings: ProductionSettings;
  oee: OeeBreakdown;
  shortStops: { count: number; minutes: number };
  longStops: { count: number; minutes: number; longest: StopEvent | null };
  output: {
    planTotal: number;
    planSoFar: number;
    actual: number;
    good: number;
    defects: number;
    gapToPlanSoFar: number;
    forecast: number;
    forecastPct: number;
  };
  taktSec: number;
  cycleSec: number;
  hourly: HourlyOutput[];
  stops: StopEvent[];
}

export interface FactoryProductionOverview {
  simulated: boolean;
  shift: { date: string; shift: number; label: string } | null;
  oee: OeeBreakdown;
  lines: { total: number; producing: number };
  machines: { total: number; running: number; alarmStop: number; offline: number };
  lineStates: Array<{
    lineId: string;
    lineCode: string;
    lineName: string;
    virtual: boolean;
    zoneId: string | null;
    productionStatus: LineProductionStatus;
    statusNote: string | null;
    statusCode: string | null;
    statusOp: string | null;
    oee: number;
    output: number;
    forecastPct: number;
  }>;
  topDowntime: Array<{
    lineId: string;
    lineCode: string;
    lineName: string;
    virtual: boolean;
    zoneId: string | null;
    productionStatus: LineProductionStatus;
    longStopMinutes: number;
    totalStopMinutes: number;
    mainCauseCode: string | null;
    mainCauseOp: string | null;
    shortStopCount: number;
    mainCause: string | null;
  }>;
}

export interface ProcessConditionSeries {
  key: string;
  name: string;
  unit: string;
  specMin: number;
  specMax: number;
  decimals: number;
  ngCount: number;
  values: Array<{ date: string; value: number | null; status: 'OK' | 'NG' | 'OFF' }>;
}

export interface ProcessConditionsResponse {
  simulated: boolean;
  lineId: string;
  lineCode: string;
  days: number;
  dates: Array<{ date: string; weekday: number }>;
  conditions: ProcessConditionSeries[];
  summary: { checked: number; ng: number; passRate: number | null };
}

export type WhatIfScenarioId = 'BASELINE' | 'REROUTE' | 'OVERTIME' | 'SHIFT_CHANGE_FIX';

export interface WhatIfScenario {
  id: WhatIfScenarioId;
  title: string;
  gainPcs: number;
  finalQty: number;
  shortfall: number;
  meetsDue: boolean;
  costUsd: number;
  recoveryHours: number;
  oee: number;
  targetLineId?: string | null;
  targetLineCode?: string | null;
  reroutePct?: number;
  otHours?: number;
}

export interface WhatIfResponse {
  simulated: boolean;
  lineId: string;
  lineCode: string;
  order: { code: string; product: string; requiredQty: number; dueAt: string; dueTime: string; shift: number };
  planQty: number;
  baselineQty: number;
  params: { otHours: number; reroutePct: number };
  losses: Array<{ code: string; label: string; kind: 'LONG_STOP' | 'SHORT_STOP' | 'SPEED_QUALITY'; pcs: number }>;
  scenarios: WhatIfScenario[];
  recommendedId: WhatIfScenarioId;
  recommendation: string;
  waterfall: Array<{
    label: string;
    value: number;
    type: 'TOTAL' | 'LOSS' | 'GAIN';
    kind?: 'LONG_STOP' | 'SHORT_STOP' | 'SPEED_QUALITY';
  }>;
}
