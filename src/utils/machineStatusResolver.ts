/**
 * @file machineStatusResolver.ts
 * @description Bộ chuẩn hóa và đồng bộ trạng thái thống nhất (Unified State Resolver)
 * Phân định rõ 3 khái niệm độc lập theo chuẩn công nghiệp DENSO Smart Factory:
 * 1. Trạng thái vận hành (Physical / Operational Status): RUNNING | STOPPED | IDLE | OFFLINE | UNKNOWN
 * 2. Mức độ cảnh báo (Alarm Severity): NORMAL | WARNING | CRITICAL | UNKNOWN
 * 3. Mức độ an toàn (Health Score): 0 - 100% hoặc null (N/A)
 * 
 * Đảm bảo: Cùng một máy, cùng một thời điểm, cùng một chế độ dữ liệu
 * PHẢI hiển thị trạng thái nhất quán trên cả 4 màn hình:
 * Factory Layout -> Line Overview -> Machine Detail -> CHECK SHEET
 */

import { MachineComponent, ProductionLine, MetricIndicator } from '../types/hierarchy';
import { getHealthScoreColor } from '../features/dashboard/factoryMapConfig';

export type OperationalStatus = 'RUNNING' | 'STOPPED' | 'IDLE' | 'OFFLINE' | 'UNKNOWN';
export type AlarmSeverity = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface ResolvedMachineState {
  machineId: string;
  machineCode: string;
  machineName: string;
  lineId: string;
  lineName: string;

  // C1: Trạng thái vận hành
  operatingStatus: OperationalStatus;
  operatingStatusLabel: string;
  operatingStatusColor: string;
  operatingDotColor: string;

  // C2: Mức độ cảnh báo
  alarmSeverity: AlarmSeverity;
  alarmSeverityLabel: string;
  alarmSeverityColor: string;
  alarmBadgeBg: string;

  // C3: Mức độ an toàn
  healthScore: number | null;
  healthScoreColor: string;

  // Metadata & Nguồn dữ liệu
  isSimulated: boolean;
  hasMetrics: boolean;
  metrics: MetricIndicator[];
  activeAlarmsCount: number;
  criticalMetricsCount: number;
  warningMetricsCount: number;
  normalMetricsCount: number;
  dataSource: 'PLC_DIRECT' | 'FILE_INGEST' | 'SIMULATION' | 'OFFLINE' | 'UNLINKED';
}

export interface ResolvedLineState {
  lineId: string;
  lineCode: string;
  lineName: string;

  // Trạng thái vận hành dây chuyền
  operatingStatus: 'RUNNING' | 'STOPPED' | 'OFFLINE' | 'UNKNOWN';
  operatingStatusLabel: string;

  // Mức độ cảnh báo dây chuyền
  alarmSeverity: AlarmSeverity;
  alarmSeverityLabel: string;
  alarmSeverityColor: string;

  // Mức độ an toàn tổng hợp
  safetyScore: number | null;
  healthColor: string;

  // Thống kê thiết bị
  totalMachines: number;
  runningCount: number;
  stoppedCount: number;
  warningCount: number;
  criticalCount: number;
  offlineCount: number;
}

/**
 * Chuẩn hóa trạng thái máy duy nhất cho toàn hệ thống
 */
export function resolveMachineMonitoringState(
  machine: MachineComponent | null | undefined,
  line?: ProductionLine | null
): ResolvedMachineState {
  // 1. Trường hợp không tìm thấy máy hoặc máy chưa được cấu hình
  if (!machine) {
    return {
      machineId: 'UNKNOWN',
      machineCode: 'N/A',
      machineName: 'Thiết bị chưa liên kết',
      lineId: line?.id || 'UNKNOWN',
      lineName: line?.name || 'N/A',
      operatingStatus: 'UNKNOWN',
      operatingStatusLabel: 'Chưa liên kết / N/A',
      operatingStatusColor: 'text-slate-400',
      operatingDotColor: '#94A3B8',
      alarmSeverity: 'UNKNOWN',
      alarmSeverityLabel: 'N/A',
      alarmSeverityColor: '#94A3B8',
      alarmBadgeBg: 'bg-slate-100 text-slate-600',
      healthScore: null,
      healthScoreColor: '#94A3B8',
      isSimulated: false,
      hasMetrics: false,
      metrics: [],
      activeAlarmsCount: 0,
      criticalMetricsCount: 0,
      warningMetricsCount: 0,
      normalMetricsCount: 0,
      dataSource: 'UNLINKED',
    };
  }

  const metrics = machine.metrics || [];
  const hasMetrics = metrics.length > 0;

  // Đếm các trạng thái metric thực tế
  let criticalMetricsCount = 0;
  let warningMetricsCount = 0;
  let normalMetricsCount = 0;

  for (const mtr of metrics) {
    if (mtr.status === 'critical') criticalMetricsCount++;
    else if (mtr.status === 'warning') warningMetricsCount++;
    else if (mtr.status === 'normal') normalMetricsCount++;
  }

  // Xác định chế độ mô phỏng
  const isSimulated = metrics.some((m) => m.dataSourceType === 'SIMULATED') ||
    (machine.plc && machine.plc.isDemo) ||
    false;

  // =========================================================================
  // BƯỚC 1: XÁC ĐỊNH MỨC ĐỘ CẢNH BÁO (ALARM SEVERITY)
  // =========================================================================
  let alarmSeverity: AlarmSeverity = 'NORMAL';
  if (criticalMetricsCount > 0 || (machine.status as any) === 'critical') {
    alarmSeverity = 'CRITICAL';
  } else if (warningMetricsCount > 0 || (machine.status as any) === 'warning') {
    alarmSeverity = 'WARNING';
  } else if (machine.status === 'offline' || machine.status === 'no_data' || machine.status === 'unknown') {
    alarmSeverity = 'UNKNOWN';
  }

  const alarmSeverityLabel =
    alarmSeverity === 'CRITICAL'
      ? 'Nguy hiểm'
      : alarmSeverity === 'WARNING'
      ? 'Cần theo dõi'
      : alarmSeverity === 'NORMAL'
      ? 'Bình thường'
      : 'Chưa có dữ liệu';

  const alarmSeverityColor =
    alarmSeverity === 'CRITICAL'
      ? '#DC2626'
      : alarmSeverity === 'WARNING'
      ? '#EAB308'
      : alarmSeverity === 'NORMAL'
      ? '#16A34A'
      : '#94A3B8';

  const alarmBadgeBg =
    alarmSeverity === 'CRITICAL'
      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
      : alarmSeverity === 'WARNING'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      : alarmSeverity === 'NORMAL'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

  // =========================================================================
  // BƯỚC 2: XÁC ĐỊNH TRẠNG THÁI VẬN HÀNH (OPERATING STATUS)
  // =========================================================================
  let operatingStatus: OperationalStatus = 'RUNNING';
  let operatingStatusLabel = 'Đang chạy';
  let operatingStatusColor = 'text-emerald-600 dark:text-emerald-400';
  let operatingDotColor = '#16A34A';

  // Nếu có khai báo operationalStatus rõ ràng
  if ((machine as any).operationalStatus) {
    operatingStatus = (machine as any).operationalStatus;
  } else if (machine.managementStatus === 'inactive') {
    operatingStatus = 'STOPPED';
    operatingStatusLabel = 'Ngừng sử dụng';
    operatingStatusColor = 'text-slate-500';
    operatingDotColor = '#64748B';
  } else if (machine.status === 'offline') {
    operatingStatus = 'OFFLINE';
    operatingStatusLabel = 'Mất kết nối';
    operatingStatusColor = 'text-slate-500';
    operatingDotColor = '#94A3B8';
  } else if (machine.status === 'no_data' && !hasMetrics) {
    operatingStatus = 'UNKNOWN';
    operatingStatusLabel = 'Chưa kết nối PLC';
    operatingStatusColor = 'text-slate-400';
    operatingDotColor = '#94A3B8';
  } else {
    // Máy đang vận hành
    operatingStatus = 'RUNNING';
    operatingStatusLabel = 'Đang chạy';
    operatingStatusColor = 'text-emerald-600 dark:text-emerald-400';
    operatingDotColor = '#16A34A';
  }

  // =========================================================================
  // BƯỚC 3: XÁC ĐỊNH MỨC ĐỘ AN TOÀN (HEALTH SCORE)
  // =========================================================================
  let healthScore: number | null = null;
  if (hasMetrics) {
    // Tính toán động từ các metric: 100% khi toàn bộ bình thường, cảnh báo trừ 50%, nguy hiểm trừ 100%
    const score = Math.round(
      ((normalMetricsCount * 1.0 + warningMetricsCount * 0.5 + criticalMetricsCount * 0.0) / metrics.length) * 100
    );
    healthScore = Math.max(0, Math.min(100, score));
  } else if (machine.healthScore != null && !isNaN(Number(machine.healthScore))) {
    healthScore = Number(machine.healthScore);
  } else {
    healthScore = null;
  }

  const healthScoreColor = getHealthScoreColor(healthScore);

  // Xác định nguồn dữ liệu
  let dataSource: ResolvedMachineState['dataSource'] = 'PLC_DIRECT';
  if (isSimulated) dataSource = 'SIMULATION';
  else if (operatingStatus === 'OFFLINE') dataSource = 'OFFLINE';
  else if (!hasMetrics) dataSource = 'UNLINKED';
  else if (metrics.some((m) => m.dataSourceType === 'FILE_INGEST')) dataSource = 'FILE_INGEST';

  return {
    machineId: machine.id,
    machineCode: machine.code || machine.id,
    machineName: machine.name,
    lineId: machine.lineId || line?.id || '',
    lineName: line?.name || machine.lineName || '',
    operatingStatus,
    operatingStatusLabel,
    operatingStatusColor,
    operatingDotColor,
    alarmSeverity,
    alarmSeverityLabel,
    alarmSeverityColor,
    alarmBadgeBg,
    healthScore,
    healthScoreColor,
    isSimulated,
    hasMetrics,
    metrics,
    activeAlarmsCount: criticalMetricsCount + warningMetricsCount,
    criticalMetricsCount,
    warningMetricsCount,
    normalMetricsCount,
    dataSource,
  };
}

/**
 * Chuẩn hóa trạng thái Dây chuyền duy nhất cho toàn hệ thống
 */
export function resolveLineMonitoringState(line: ProductionLine | null | undefined): ResolvedLineState {
  if (!line) {
    return {
      lineId: 'UNKNOWN',
      lineCode: 'N/A',
      lineName: 'Chưa xác định',
      operatingStatus: 'UNKNOWN',
      operatingStatusLabel: 'N/A',
      alarmSeverity: 'UNKNOWN',
      alarmSeverityLabel: 'N/A',
      alarmSeverityColor: '#94A3B8',
      safetyScore: null,
      healthColor: '#94A3B8',
      totalMachines: 0,
      runningCount: 0,
      stoppedCount: 0,
      warningCount: 0,
      criticalCount: 0,
      offlineCount: 0,
    };
  }

  const machines = line.machines || [];
  let runningCount = 0;
  let stoppedCount = 0;
  let warningCount = 0;
  let criticalCount = 0;
  let offlineCount = 0;

  for (const m of machines) {
    const resM = resolveMachineMonitoringState(m, line);
    if (resM.operatingStatus === 'STOPPED') stoppedCount++;
    else if (resM.operatingStatus === 'OFFLINE') offlineCount++;
    else runningCount++;

    if (resM.alarmSeverity === 'CRITICAL') criticalCount++;
    else if (resM.alarmSeverity === 'WARNING') warningCount++;
  }

  // Mức độ cảnh báo của Dây chuyền
  let alarmSeverity: AlarmSeverity = 'NORMAL';
  const rawStatus = (line.status || '').toLowerCase();
  if (criticalCount > 0 || rawStatus === 'critical' || rawStatus === 'error') {
    alarmSeverity = 'CRITICAL';
  } else if (warningCount > 0 || rawStatus === 'warning') {
    alarmSeverity = 'WARNING';
  } else if (rawStatus === 'offline') {
    alarmSeverity = 'UNKNOWN';
  }

  const alarmSeverityLabel =
    alarmSeverity === 'CRITICAL'
      ? 'Nguy hiểm'
      : alarmSeverity === 'WARNING'
      ? 'Cần theo dõi'
      : alarmSeverity === 'NORMAL'
      ? 'Bình thường'
      : 'Mất kết nối';

  const alarmSeverityColor =
    alarmSeverity === 'CRITICAL'
      ? '#DC2626'
      : alarmSeverity === 'WARNING'
      ? '#EAB308'
      : alarmSeverity === 'NORMAL'
      ? '#16A34A'
      : '#94A3B8';

  // Trạng thái vận hành của Dây chuyền
  let operatingStatus: ResolvedLineState['operatingStatus'] = 'RUNNING';
  let operatingStatusLabel = 'Đang hoạt động';

  if (rawStatus === 'stopped' || (stoppedCount > 0 && runningCount === 0)) {
    operatingStatus = 'STOPPED';
    operatingStatusLabel = 'Tạm dừng';
  } else if (rawStatus === 'offline' || (offlineCount === machines.length && machines.length > 0)) {
    operatingStatus = 'OFFLINE';
    operatingStatusLabel = 'Mất kết nối';
  } else {
    operatingStatus = 'RUNNING';
    operatingStatusLabel = 'Đang hoạt động';
  }

  const safetyScore = line.safetyScore != null && !isNaN(Number(line.safetyScore))
    ? Number(line.safetyScore)
    : null;

  const healthColor = getHealthScoreColor(safetyScore);

  return {
    lineId: line.id,
    lineCode: line.code,
    lineName: line.name,
    operatingStatus,
    operatingStatusLabel,
    alarmSeverity,
    alarmSeverityLabel,
    alarmSeverityColor,
    safetyScore,
    healthColor,
    totalMachines: machines.length,
    runningCount,
    stoppedCount,
    warningCount,
    criticalCount,
    offlineCount,
  };
}
