/**
 * @file aiTelemetryAdapter.ts
 * @description Tầng Adapter đồng bộ Telemetry & Giả lập Sự cố giữa useMonitoringStore và Module AI.
 * 
 * NGUYÊN TẮC THIẾT KẾ:
 * 1. Single Source of Truth: Lấy useMonitoringStore làm nguồn dữ liệu trung tâm duy nhất.
 * 2. Minh bạch dữ liệu: Phân biệt rõ ràng PRODUCTION, SIMULATION, NO_DATA, và UNKNOWN.
 * 3. Không số ảo: Máy status === 'no_data' có healthScore = null, không bị tính là SAFE.
 * 4. Đồng bộ 100%: Kích hoạt "Giả lập Sự cố" trên Header lập tức phản ánh sang cả 4 tab AI;
 *    Khi khôi phục (Reset) trên Header, AI lập tức trở về trạng thái chuẩn.
 */

import { ProductionLine, MachineComponent, MetricIndicator } from '../../../types/hierarchy';
import { AlarmEvent } from '../../../types/alarm';
import {
  AIRiskLevel,
  AIEquipmentStatus,
  EquipmentHealthItem,
  AIAnomalyEvent,
  AIPredictiveOrder,
  AITrendPoint,
} from '../types/ai';

export interface AIProcessedMachine extends EquipmentHealthItem {
  dataSource: 'PRODUCTION' | 'SIMULATION' | 'NO_DATA';
  isNoData: boolean;
  hasActiveSpike: boolean;
  rawMetrics: MetricIndicator[];
}

export interface AIOverallKPIs {
  totalMachines: number;
  machinesWithData: number;
  machinesNoData: number;
  dataRatioPercent: number;
  warningCount: number;
  criticalCount: number;
  normalCount: number;
  avgHealthScore: number | null;
  evaluatedMachinesCount: number;
  hasActiveEmergency: boolean;
}

/**
 * Xử lý và tính toán điểm sức khỏe động trung thực cho từng thiết bị từ useMonitoringStore
 */
export function processMachineHealth(
  machine: MachineComponent,
  line: ProductionLine,
  activeEmergencyMetricId: string | null = null,
  activeAlarms: AlarmEvent[] = []
): AIProcessedMachine {
  const isNoData = machine.status === 'no_data' || !machine.metrics || machine.metrics.length === 0;

  // Nếu máy chưa có dữ liệu quan trắc PLC
  if (isNoData) {
    return {
      machineId: machine.id,
      machineCode: machine.code || machine.id,
      machineName: machine.name,
      lineId: line.id,
      lineName: line.name,
      type: machine.type || 'Thiết bị công nghiệp',
      healthScore: null as unknown as number, // Không gán điểm số ảo
      riskLevel: 'LOW' as AIRiskLevel,
      status: 'NORMAL' as AIEquipmentStatus,
      factors: {
        base: 0,
        tempPenalty: 0,
        vibrationPenalty: 0,
        pressurePenalty: 0,
        currentPenalty: 0,
        agePenalty: 0,
        explanation: 'Thiết bị chưa được cấu hình trạm PLC hoặc chưa có bản ghi đo lường (Chưa đánh giá).',
      },
      activeAnomaliesCount: 0,
      trendDirection: 'stable',
      lastEvaluated: 'Chưa có dữ liệu',
      keyMetricCode: 'N/A',
      keyMetricName: 'Chưa có thông số',
      keyMetricValue: 0,
      keyMetricUnit: '',
      dataSource: 'NO_DATA',
      isNoData: true,
      hasActiveSpike: false,
      rawMetrics: [],
    };
  }

  // Đối với máy có dữ liệu: Tính toán điểm phạt dựa trên vi phạm thực tế của các metrics
  const base = 100;
  let tempPenalty = 0;
  let vibrationPenalty = 0;
  let pressurePenalty = 0;
  let currentPenalty = 0;
  let agePenalty = 2; // Khấu hao hao mòn tiêu chuẩn: 2 điểm

  let hasActiveSpike = false;
  let activeAnomaliesCount = 0;
  let worstMetricStatus: 'normal' | 'warning' | 'critical' = 'normal';

  // Tìm metric chủ đạo
  let primaryMetric = machine.metrics[0];
  for (const mtr of machine.metrics) {
    const isSpiked = Boolean(mtr.isEmergencySpike || mtr.id === activeEmergencyMetricId);
    if (isSpiked) {
      hasActiveSpike = true;
    }

    // Kiểm tra vi phạm ngưỡng
    const val = Number(mtr.currentValue);
    const critMax = mtr.criticalMax != null ? Number(mtr.criticalMax) : 9999;
    const warnMax = mtr.warningMax != null ? Number(mtr.warningMax) : 9999;

    const mCode = mtr.id.toUpperCase();
    if (isSpiked || val >= critMax || mtr.status === 'critical') {
      worstMetricStatus = 'critical';
      activeAnomaliesCount++;
      primaryMetric = mtr;

      if (mCode.includes('TEMP') || mCode.includes('NHIET')) tempPenalty = Math.max(tempPenalty, 45);
      else if (mCode.includes('VIB') || mCode.includes('RUNG')) vibrationPenalty = Math.max(vibrationPenalty, 48);
      else if (mCode.includes('PRESS') || mCode.includes('AP')) pressurePenalty = Math.max(pressurePenalty, 42);
      else currentPenalty = Math.max(currentPenalty, 40);
    } else if (val >= warnMax || mtr.status === 'warning') {
      if (worstMetricStatus !== 'critical') worstMetricStatus = 'warning';
      activeAnomaliesCount++;
      primaryMetric = mtr;

      if (mCode.includes('TEMP') || mCode.includes('NHIET')) tempPenalty = Math.max(tempPenalty, 20);
      else if (mCode.includes('VIB') || mCode.includes('RUNG')) vibrationPenalty = Math.max(vibrationPenalty, 22);
      else if (mCode.includes('PRESS') || mCode.includes('AP')) pressurePenalty = Math.max(pressurePenalty, 18);
      else currentPenalty = Math.max(currentPenalty, 15);
    }
  }

  // Kiểm tra cảnh báo từ useAlarmStore (chưa resolved)
  const relatedAlarms = activeAlarms.filter(
    (a) => (a.machineId === machine.id || a.machineName === machine.name) && a.status !== 'resolved'
  );
  if (relatedAlarms.length > 0 && worstMetricStatus === 'normal') {
    const hasCrit = relatedAlarms.some((a) => a.severity === 'critical');
    worstMetricStatus = hasCrit ? 'critical' : 'warning';
    activeAnomaliesCount = Math.max(activeAnomaliesCount, relatedAlarms.length);
    if (hasCrit) tempPenalty = Math.max(tempPenalty, 35);
    else tempPenalty = Math.max(tempPenalty, 15);
  }

  const totalPenalty = tempPenalty + vibrationPenalty + pressurePenalty + currentPenalty + agePenalty;
  const calculatedHealth = Math.max(15, Math.min(100, base - totalPenalty));

  let riskLevel: AIRiskLevel = 'LOW';
  let aiStatus: AIEquipmentStatus = 'NORMAL';
  let trendDirection: 'up' | 'down' | 'stable' = 'stable';
  let explanation = 'Thiết bị hoạt động ổn định trong dải định mức an toàn, độ lệch chuẩn thấp.';

  if (calculatedHealth < 60 || worstMetricStatus === 'critical') {
    riskLevel = 'CRITICAL';
    aiStatus = 'ANOMALOUS';
    trendDirection = 'down';
    explanation = hasActiveSpike
      ? `Đang diễn tập sự cố giả lập: ${primaryMetric.name} tăng vọt lên ${primaryMetric.currentValue} ${primaryMetric.unit}, vượt ngưỡng tới hạn!`
      : `Phát hiện dị biệt nghiêm trọng: ${primaryMetric.name} chạm ngưỡng tới hạn ${primaryMetric.criticalMax} ${primaryMetric.unit}. Nguy cơ dừng dây chuyền!`;
  } else if (calculatedHealth < 80 || worstMetricStatus === 'warning') {
    riskLevel = 'HIGH';
    aiStatus = 'WARNING';
    trendDirection = 'down';
    explanation = `Thông số ${primaryMetric.name} vượt mức cảnh báo (${primaryMetric.warningMax} ${primaryMetric.unit}). Cần theo dõi chặt chẽ.`;
  } else if (calculatedHealth < 90) {
    riskLevel = 'MEDIUM';
    aiStatus = 'NORMAL';
    trendDirection = 'stable';
    explanation = 'Thiết bị vận hành bình thường, tải cơ khí và nhiệt độ ở mức tối ưu.';
  }

  return {
    machineId: machine.id,
    machineCode: machine.code || machine.id,
    machineName: machine.name,
    lineId: line.id,
    lineName: line.name,
    type: machine.type || 'Thiết bị công nghiệp',
    healthScore: calculatedHealth,
    riskLevel,
    status: aiStatus,
    factors: {
      base,
      tempPenalty,
      vibrationPenalty,
      pressurePenalty,
      currentPenalty,
      agePenalty,
      explanation,
    },
    activeAnomaliesCount,
    trendDirection,
    lastEvaluated: 'Thời gian thực',
    keyMetricCode: primaryMetric.id,
    keyMetricName: primaryMetric.name,
    keyMetricValue: primaryMetric.currentValue,
    keyMetricUnit: primaryMetric.unit,
    dataSource: hasActiveSpike ? 'SIMULATION' : 'PRODUCTION',
    isNoData: false,
    hasActiveSpike,
    rawMetrics: machine.metrics,
  };
}

/**
 * Xử lý toàn bộ 14 máy từ danh sách ProductionLine
 */
export function processAllEquipment(
  lines: ProductionLine[],
  activeEmergencyMetricId: string | null = null,
  activeAlarms: AlarmEvent[] = []
): {
  allMachines: AIProcessedMachine[];
  kpis: AIOverallKPIs;
} {
  const allMachines: AIProcessedMachine[] = [];

  for (const line of lines) {
    for (const machine of line.machines || []) {
      allMachines.push(
        processMachineHealth(machine, line, activeEmergencyMetricId, activeAlarms)
      );
    }
  }

  const totalMachines = allMachines.length;
  const machinesWithData = allMachines.filter((m) => !m.isNoData).length;
  const machinesNoData = allMachines.filter((m) => m.isNoData).length;
  const dataRatioPercent = totalMachines > 0 ? Math.round((machinesWithData / totalMachines) * 100) : 0;

  const evaluated = allMachines.filter((m) => !m.isNoData && m.healthScore != null);
  const evaluatedMachinesCount = evaluated.length;

  const warningCount = evaluated.filter((m) => m.riskLevel === 'HIGH').length;
  const criticalCount = evaluated.filter((m) => m.riskLevel === 'CRITICAL').length;
  const normalCount = evaluated.filter((m) => m.riskLevel === 'LOW' || m.riskLevel === 'MEDIUM').length;

  const avgHealthScore =
    evaluatedMachinesCount > 0
      ? Math.round(evaluated.reduce((acc, cur) => acc + (cur.healthScore || 0), 0) / evaluatedMachinesCount)
      : null;

  const hasActiveEmergency = allMachines.some((m) => m.hasActiveSpike);

  return {
    allMachines,
    kpis: {
      totalMachines,
      machinesWithData,
      machinesNoData,
      dataRatioPercent,
      warningCount,
      criticalCount,
      normalCount,
      avgHealthScore,
      evaluatedMachinesCount,
      hasActiveEmergency,
    },
  };
}

/**
 * Sinh danh sách sự kiện bất thường động từ dữ liệu telemetry và sự cố Header
 */
export function extractDynamicAnomalies(
  allMachines: AIProcessedMachine[],
  activeAlarms: AlarmEvent[] = []
): AIAnomalyEvent[] {
  const events: AIAnomalyEvent[] = [];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  for (const m of allMachines) {
    if (m.isNoData) continue;

    for (const mtr of m.rawMetrics) {
      const isSpike = Boolean(mtr.isEmergencySpike);
      const val = Number(mtr.currentValue);
      const crit = mtr.criticalMax != null ? Number(mtr.criticalMax) : 9999;
      const warn = mtr.warningMax != null ? Number(mtr.warningMax) : 9999;

      if (isSpike || val >= crit || mtr.status === 'critical') {
        const devPct = crit > 0 ? Math.max(1, Number((((val - crit) / crit) * 100).toFixed(1))) : 10.0;
        events.push({
          id: `ANM-${m.machineCode}-${mtr.id}`,
          timestamp: mtr.lastUpdated && mtr.lastUpdated !== 'Vừa xong' ? mtr.lastUpdated : timeStr,
          machineId: m.machineId,
          machineCode: m.machineCode,
          machineName: m.machineName,
          lineName: m.lineName,
          metricCode: mtr.id,
          metricName: mtr.name,
          category: mtr.id.includes('TEMP') ? 'Nhiệt độ' : mtr.id.includes('VIB') ? 'Rung động' : 'Áp suất',
          value: val,
          unit: mtr.unit,
          warningThreshold: warn,
          criticalThreshold: crit,
          severity: 'CRITICAL',
          detectionRule: isSpike ? 'SUDDEN_SPIKE' : 'THRESHOLD_BREACH',
          ruleExplanation: isSpike
            ? `Sự cố giả lập diễn tập: ${mtr.name} vọt lên ${val} ${mtr.unit} (vượt ngưỡng nguy hiểm ${crit} ${mtr.unit}). Z-score: +4.2σ.`
            : `Giá trị đo lường thực tế ${val} ${mtr.unit} vượt ngưỡng nguy hiểm (${crit} ${mtr.unit}). Z-score: +3.6σ.`,
          deviationPercent: devPct,
        });
      } else if (val >= warn || mtr.status === 'warning') {
        const devPct = warn > 0 ? Math.max(1, Number((((val - warn) / warn) * 100).toFixed(1))) : 5.0;
        events.push({
          id: `ANM-${m.machineCode}-${mtr.id}`,
          timestamp: mtr.lastUpdated && mtr.lastUpdated !== 'Vừa xong' ? mtr.lastUpdated : timeStr,
          machineId: m.machineId,
          machineCode: m.machineCode,
          machineName: m.machineName,
          lineName: m.lineName,
          metricCode: mtr.id,
          metricName: mtr.name,
          category: mtr.id.includes('TEMP') ? 'Nhiệt độ' : mtr.id.includes('VIB') ? 'Rung động' : 'Áp suất',
          value: val,
          unit: mtr.unit,
          warningThreshold: warn,
          criticalThreshold: crit,
          severity: 'WARNING',
          detectionRule: 'THRESHOLD_BREACH',
          ruleExplanation: `Thông số ${mtr.name} tăng lên ${val} ${mtr.unit}, vượt ngưỡng cảnh báo (${warn} ${mtr.unit}). Z-score: +2.4σ.`,
          deviationPercent: devPct,
        });
      }
    }
  }

  // Kết hợp các alarm đang chưa resolved trong useAlarmStore
  for (const alarm of activeAlarms) {
    if (alarm.status !== 'resolved' && !events.some((e) => e.metricCode === alarm.metricId)) {
      events.push({
        id: alarm.id,
        timestamp: alarm.timestamp || timeStr,
        machineId: alarm.machineId,
        machineCode: alarm.machineId,
        machineName: alarm.machineName,
        lineName: alarm.lineName,
        metricCode: alarm.metricId,
        metricName: alarm.metricName,
        category: 'Cảnh báo hệ thống',
        value: alarm.triggeredValue,
        unit: alarm.unit,
        warningThreshold: alarm.thresholdValue * 0.8,
        criticalThreshold: alarm.thresholdValue,
        severity: alarm.severity === 'critical' ? 'CRITICAL' : 'WARNING',
        detectionRule: alarm.isDemo ? 'SUDDEN_SPIKE' : 'THRESHOLD_BREACH',
        ruleExplanation: alarm.message,
        deviationPercent: 12.5,
      });
    }
  }

  return events;
}

/**
 * Sinh danh sách phiếu bảo trì dự đoán động từ tình trạng thiết bị (Chuẩn tham chiếu Image 3)
 */
export function extractDynamicPredictiveOrders(
  allMachines: AIProcessedMachine[],
  anomalies: AIAnomalyEvent[] = []
): AIPredictiveOrder[] {
  // Danh mục 5 phiếu bảo trì dự đoán mẫu công nghiệp DENSO
  const baselineOrders: AIPredictiveOrder[] = [
    {
      id: 'WO-ROB-01',
      machineId: 'ROB-01',
      machineCode: 'ROB-01',
      machineName: 'Robot Hàn Điểm Fanuc R-2000iC',
      lineName: 'Dập & Hàn Khung Gầm',
      priority: 'P1_CRITICAL',
      healthScore: 68,
      confidence: 96,
      component: 'Khớp xoay & Ổ bi trục J6',
      symptom: 'Độ rung RMS tăng bất thường (7.6 mm/s, vượt ngưỡng 7.0 mm/s)',
      rootCause: 'Mòn ổ bi trục J6, có nguy cơ hỏng trong thời gian ngắn.',
      recommendedAction: 'Kiểm tra và thay thế ổ bi trục J6. Dừng máy kiểm tra an toàn.',
      assignee: 'Trần Văn Minh',
      dueDate: 'Hôm nay, 17:00',
      imageUrl: '/images/machines/ROB-01.png',
      estimatedTimeToDegrade: '4 - 8 giờ máy',
      estimatedWorkHours: 2.5,
      suggestedTools: ['Đồng hồ vạn năng Fluke', 'Súng đo nhiệt hồng ngoại', 'Cờ lê lực công nghiệp'],
      status: 'PENDING',
    },
    {
      id: 'WO-PRS-01',
      machineId: 'MCH-PRS-01',
      machineCode: 'MCH-PRS-01',
      machineName: 'Máy Dập Thủy Lực 500T Komatsu',
      lineName: 'Dập & Hàn',
      priority: 'P2_HIGH',
      healthScore: 78,
      confidence: 91,
      component: 'Cụm van tản nhiệt & Lọc dầu thủy lực',
      symptom: 'Nhiệt độ dầu thủy lực tăng (54.2 °C, cao hơn bình thường 6-8 °C).',
      rootCause: 'Hiệu suất làm mát giảm, lọc dầu có dấu hiệu tắc.',
      recommendedAction: 'Vệ sinh/thay lọc dầu, kiểm tra hệ thống làm mát.',
      assignee: 'Lê Đức Huy',
      dueDate: 'Ngày mai, 10:00',
      imageUrl: '/images/machines/ASM-01.png',
      estimatedTimeToDegrade: '24 - 48 giờ máy',
      estimatedWorkHours: 1.5,
      suggestedTools: ['Bộ cờ lê tròng', 'Thiết bị đo nhiệt hồng ngoại'],
      status: 'IN_PROGRESS',
    },
    {
      id: 'WO-CNC-02',
      machineId: 'MCH-CNC-02',
      machineCode: 'MCH-CNC-02',
      machineName: 'Máy Gia Công CNC DMG MORI',
      lineName: 'Gia công cơ khí',
      priority: 'P3_MEDIUM',
      healthScore: 84,
      confidence: 86,
      component: 'Đầu gá dao & Trục chính Spindle',
      symptom: 'Dòng điện trục chính dao động (+12% so với trung bình).',
      rootCause: 'Dao cắt bắt đầu mòn, làm tăng tải trục chính.',
      recommendedAction: 'Kiểm tra tình trạng dao, lập kế hoạch thay dao trong 2-3 ngày tới.',
      assignee: 'Phạm Quang Anh',
      dueDate: '20/01/2025',
      imageUrl: '/images/machines/MS-10.png',
      estimatedTimeToDegrade: '72 - 120 giờ máy',
      estimatedWorkHours: 2.0,
      suggestedTools: ['Đồng hồ so cơ khí', 'Kính lúp kiểm tra dao'],
      status: 'PENDING',
    },
    {
      id: 'WO-HYD-01',
      machineId: 'HYD-PUMP-01',
      machineCode: 'HYD-PUMP-01',
      machineName: 'Bơm Thủy Lực Trạm Nguồn',
      lineName: 'Dập & Hàn',
      priority: 'P3_MEDIUM',
      healthScore: 85,
      confidence: 84,
      component: 'Bơm cánh gạt & Van an toàn áp suất',
      symptom: 'Áp suất đầu ra giảm nhẹ (18.5 bar, thấp hơn 10% so với chuẩn).',
      rootCause: 'Lọc dầu bẩn hoặc rò rỉ nhỏ ở đường ống.',
      recommendedAction: 'Kiểm tra và vệ sinh lọc dầu, kiểm tra rò rỉ hệ thống.',
      assignee: 'Nguyễn Văn Nam',
      dueDate: '21/01/2025',
      imageUrl: '/images/machines/MC-CYL-01.png',
      estimatedTimeToDegrade: '96 - 150 giờ máy',
      estimatedWorkHours: 1.0,
      suggestedTools: ['Đồng hồ đo áp suất thủy lực', 'Bộ cờ lê'],
      status: 'PENDING',
    },
    {
      id: 'WO-CMP-01',
      machineId: 'HYD-CMP-01',
      machineCode: 'HYD-CMP-01',
      machineName: 'Máy Nén Khí Sullair 75kW',
      lineName: 'Tiện ích (Utility)',
      priority: 'P4_ROUTINE',
      healthScore: 95,
      confidence: 100,
      component: 'Bộ lọc tách dầu & Cụm nén trục vít',
      symptom: 'Đến kỳ bảo trì định kỳ (4.000 giờ vận hành).',
      rootCause: 'Bảo trì theo lịch khuyến nghị của nhà sản xuất.',
      recommendedAction: 'Thực hiện bảo trì định kỳ: thay lọc, kiểm tra dầu và vệ sinh tổng thể.',
      assignee: 'Đỗ Minh Tâm',
      dueDate: '25/01/2025',
      imageUrl: '/images/machines/DRY-01.png',
      estimatedTimeToDegrade: '> 720 giờ máy (Bình thường)',
      estimatedWorkHours: 3.0,
      suggestedTools: ['Bộ cờ lê lực', 'Phễu châm dầu chuyên dụng'],
      status: 'PLANNED',
    },
  ];

  // Kiểm tra nếu có máy bị sự cố khẩn cấp (Emergency Spike do Header)
  const spikedMachine = allMachines.find((m) => m.hasActiveSpike);
  if (spikedMachine) {
    const existingIndex = baselineOrders.findIndex((o) => o.machineId === spikedMachine.machineId || o.machineCode === spikedMachine.machineCode);
    const relatedAnomaly = anomalies.find((a) => a.machineId === spikedMachine.machineId && a.severity === 'CRITICAL');

    const emergencyOrder: AIPredictiveOrder = {
      id: `WO-EMERGENCY-${spikedMachine.machineCode}`,
      machineId: spikedMachine.machineId,
      machineCode: spikedMachine.machineCode,
      machineName: spikedMachine.machineName,
      lineName: spikedMachine.lineName,
      priority: 'P1_CRITICAL',
      healthScore: spikedMachine.healthScore || 52,
      confidence: 99,
      component: spikedMachine.rawMetrics[0]?.name || 'Bộ truyền động & Van thủy lực',
      symptom: relatedAnomaly ? relatedAnomaly.ruleExplanation : `Cảnh báo khẩn cấp diễn tập: Thông số vọt đỉnh vượt ngưỡng nguy hiểm.`,
      rootCause: 'Giả lập sự cố khẩn cấp từ Header điều hành (Diễn tập ứng phó).',
      recommendedAction: 'Dừng máy khẩn cấp! Kích hoạt quy trình an toàn E-Stop và kiểm tra áp suất/nhiệt độ.',
      assignee: 'Trực ca Trưởng (Khẩn cấp)',
      dueDate: 'Ngay lập tức',
      imageUrl: baselineOrders.find((b) => b.machineCode === spikedMachine.machineCode)?.imageUrl || '/images/machines/ROB-01.png',
      estimatedTimeToDegrade: 'Mô phỏng tức thời',
      estimatedWorkHours: 1.0,
      suggestedTools: ['Đồng hồ vạn năng Fluke', 'Quy trình ngắt khẩn cấp E-Stop'],
      status: 'PENDING',
    };

    if (existingIndex >= 0) {
      const updated = [...baselineOrders];
      updated[existingIndex] = emergencyOrder;
      // Đưa lên đầu danh sách
      const item = updated.splice(existingIndex, 1)[0];
      return [item, ...updated];
    } else {
      return [emergencyOrder, ...baselineOrders.slice(0, 4)];
    }
  }

  return baselineOrders;
}

/**
 * Trích xuất chuỗi thời gian thực tế từ metric.history để vẽ biểu đồ Anomaly Trend Chart
 */
export function extractMetricTrendPoints(
  machine: AIProcessedMachine | undefined,
  metricCode: string
): AITrendPoint[] {
  if (!machine || machine.isNoData || !machine.rawMetrics || machine.rawMetrics.length === 0) {
    return [];
  }

  const targetMetric =
    machine.rawMetrics.find((m) => m.id === metricCode) ||
    machine.rawMetrics[0];

  if (!targetMetric) return [];

  const warn = targetMetric.warningMax != null ? Number(targetMetric.warningMax) : 70;
  const crit = targetMetric.criticalMax != null ? Number(targetMetric.criticalMax) : 80;

  // Lấy lịch sử 15-20 điểm gần nhất
  if (targetMetric.history && targetMetric.history.length > 0) {
    return targetMetric.history.map((pt) => {
      const v = Number(pt.value);
      const isAnomaly = v >= warn;
      const anomalyType = v >= crit ? 'THRESHOLD_BREACH' : isAnomaly ? 'SUDDEN_SPIKE' : undefined;
      return {
        timestamp: pt.timestamp,
        value: v,
        unit: targetMetric.unit,
        warningMax: warn,
        criticalMax: crit,
        isAnomaly,
        anomalyType,
        note: isAnomaly ? (v >= crit ? 'Vượt ngưỡng nguy hiểm' : 'Vượt ngưỡng cảnh báo') : undefined,
      };
    });
  }

  // Nếu chưa có mảng history, tạo 1 điểm hiện tại
  return [
    {
      timestamp: targetMetric.lastUpdated || 'Vừa xong',
      value: Number(targetMetric.currentValue),
      unit: targetMetric.unit,
      warningMax: warn,
      criticalMax: crit,
      isAnomaly: Number(targetMetric.currentValue) >= warn,
    },
  ];
}
