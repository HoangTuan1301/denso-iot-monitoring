/**
 * @file aiSimulationEngine.ts
 * @description Động cơ mô phỏng AI (AI Simulation Engine) chuẩn công nghiệp chạy độc lập trên frontend.
 * Cung cấp:
 * 1. Danh mục thông số chuẩn (Metric Catalog) đảm bảo tên, đơn vị, ngưỡng luôn nhất quán 100%.
 * 2. Thuật toán tính Điểm Sức Khỏe AI có thể giải thích (Explainable Health Score) với toán học khớp tuyệt đối.
 * 3. Sinh dữ liệu chuỗi thời gian Recharts với điểm dị biệt tương ứng từng kịch bản.
 * 4. Nhận diện sự kiện bất thường (Threshold Breach, Sudden Spike, Persistent Drift).
 * 5. Tạo phiếu công tác bảo trì dự đoán phân cấp P1-P4.
 * 6. Trợ lý hội thoại KaiLink phản hồi theo ngữ cảnh thiết bị.
 */

import {
  AIScenario,
  AIScenarioId,
  AIRiskLevel,
  AIEquipmentStatus,
  EquipmentHealthItem,
  AIAnomalyEvent,
  AIPredictiveOrder,
  AITrendPoint,
  AIChatMessage,
} from '../types/ai';

/* ------------------------------------------------------------------ */
/* 1. DANH MỤC THÔNG SỐ CHUẨN (METRIC CATALOG DEFINITIONS)             */
/* ------------------------------------------------------------------ */
export interface MetricMeta {
  code: string;
  name: string;
  unit: string;
  nominal: number;
  warningMax: number;
  criticalMax: number;
  description: string;
}

export const METRIC_CATALOG: Record<string, MetricMeta> = {
  TEMP_HYD: {
    code: 'TEMP_HYD',
    name: 'Nhiệt độ dầu thủy lực',
    unit: '°C',
    nominal: 52.4,
    warningMax: 70.0,
    criticalMax: 80.0,
    description: 'Nhiệt độ nhớt tuần hoàn trong hệ thống thủy lực máy dập',
  },
  VIB_RMS: {
    code: 'VIB_RMS',
    name: 'Độ rung hiệu dụng RMS',
    unit: 'mm/s',
    nominal: 2.2,
    warningMax: 4.5,
    criticalMax: 7.0,
    description: 'Vận tốc rung hiệu dụng khớp trục cơ khí theo ISO 10816',
  },
  PRESSURE_HYD: {
    code: 'PRESSURE_HYD',
    name: 'Áp suất bơm chính',
    unit: 'bar',
    nominal: 205.0,
    warningMax: 230.0,
    criticalMax: 250.0,
    description: 'Áp suất dầu thủy lực cung cấp cho xy-lanh ép',
  },
  TEMP_CHAMBER: {
    code: 'TEMP_CHAMBER',
    name: 'Nhiệt độ buồng sấy',
    unit: '°C',
    nominal: 145.0,
    warningMax: 170.0,
    criticalMax: 185.0,
    description: 'Nhiệt độ sấy hồng ngoại đối lưu bề mặt sản phẩm',
  },
  FLOW_RATE: {
    code: 'FLOW_RATE',
    name: 'Lưu lượng vòi phun sơn',
    unit: 'L/min',
    nominal: 4.2,
    warningMax: 6.0,
    criticalMax: 7.5,
    description: 'Tốc độ phun sơn tĩnh điện tự động',
  },
  TORQUE: {
    code: 'TORQUE',
    name: 'Mô-men siết bu-lông',
    unit: 'Nm',
    nominal: 95.0,
    warningMax: 125.0,
    criticalMax: 140.0,
    description: 'Lực xoắn siết bu-lông khung gầm của robot tự động',
  },
  NOISE_LEVEL: {
    code: 'NOISE_LEVEL',
    name: 'Độ ồn buồng thử nghiệm',
    unit: 'dB',
    nominal: 68.0,
    warningMax: 82.0,
    criticalMax: 90.0,
    description: 'Mức áp suất âm thanh trong chu kỳ kiểm tra tải',
  },
  CURRENT_PHASE: {
    code: 'CURRENT_PHASE',
    name: 'Dòng điện tải',
    unit: 'A',
    nominal: 18.5,
    warningMax: 28.0,
    criticalMax: 35.0,
    description: 'Cường độ dòng điện pha động cơ tải chính',
  },
  TEMP_MOTOR: {
    code: 'TEMP_MOTOR',
    name: 'Nhiệt độ động cơ trục',
    unit: '°C',
    nominal: 54.0,
    warningMax: 75.0,
    criticalMax: 88.0,
    description: 'Nhiệt độ cuộn dây stato động cơ servo',
  },
  AIR_FLOW: {
    code: 'AIR_FLOW',
    name: 'Lưu lượng khí đối lưu',
    unit: 'm³/h',
    nominal: 420.0,
    warningMax: 500.0,
    criticalMax: 550.0,
    description: 'Lưu lượng gió làm mát buồng nhiệt',
  },
};

/** Tra cứu thông tin chuẩn của một metric code, tránh hoàn toàn lỗi nhầm đơn vị */
export function getMetricDefinition(metricCode: string): MetricMeta {
  if (METRIC_CATALOG[metricCode]) {
    return METRIC_CATALOG[metricCode];
  }
  // Tìm kiếm theo tiền tố hoặc từ khóa thông minh
  const upper = metricCode.toUpperCase();
  if (upper.includes('TORQUE')) return METRIC_CATALOG.TORQUE;
  if (upper.includes('VIB')) return METRIC_CATALOG.VIB_RMS;
  if (upper.includes('CHAMBER')) return METRIC_CATALOG.TEMP_CHAMBER;
  if (upper.includes('TEMP')) return METRIC_CATALOG.TEMP_HYD;
  if (upper.includes('PRESS')) return METRIC_CATALOG.PRESSURE_HYD;
  if (upper.includes('FLOW')) return METRIC_CATALOG.FLOW_RATE;
  if (upper.includes('NOISE')) return METRIC_CATALOG.NOISE_LEVEL;
  if (upper.includes('CURRENT')) return METRIC_CATALOG.CURRENT_PHASE;

  // Mặc định an toàn
  return {
    code: metricCode,
    name: metricCode,
    unit: 'unit',
    nominal: 50,
    warningMax: 75,
    criticalMax: 90,
    description: 'Thông số cảm biến quan trắc',
  };
}

/* ------------------------------------------------------------------ */
/* 2. DANH SÁCH CÁC KỊCH BẢN MÔ PHỎNG (SCENARIOS)                     */
/* ------------------------------------------------------------------ */
export const AVAILABLE_SCENARIOS: AIScenario[] = [
  {
    id: 'normal',
    name: 'Kịch bản 1: Hoạt động Tiêu chuẩn (Normal Operation)',
    description: 'Tất cả thiết bị vận hành ổn định trong giới hạn định mức, không ghi nhận bất thường.',
    targetMachineId: 'ALL',
    targetMachineName: 'Toàn bộ thiết bị nhà máy',
    severity: 'low',
    recommendedAction: 'Duy trì kế hoạch giám sát tự động và kiểm tra định kỳ theo ca sản xuất.',
    rootCause: 'Hệ thống vận hành trơn tru, tải cơ khí và nhiệt độ ở mức tối ưu.',
  },
  {
    id: 'high_temp',
    name: 'Kịch bản 2: Quá nhiệt Trục chính & Dầu Thủy lực',
    description: 'Nhiệt độ dầu thủy lực Máy dập MCH-PRS-01 tăng vọt lên 86.4°C, vượt ngưỡng Critical (80°C).',
    targetMachineId: 'MCH-PRS-01',
    targetMachineName: 'Máy Dập Thủy Lực 500T (MCH-PRS-01)',
    severity: 'critical',
    recommendedAction: 'Giảm tải ngay và kiểm tra dàn làm mát dầu, vệ sinh lưới lọc thủy lực.',
    rootCause: 'Tắc nghẽn van tuần hoàn dầu làm mát hoặc quạt tản nhiệt dàn trao đổi nhiệt bị kẹt cánh.',
  },
  {
    id: 'abnormal_vibration',
    name: 'Kịch bản 3: Rung động Bất thường Robot Hàn',
    description: 'Độ rung RMS tại trục số 2 Robot hàn MCH-WLD-01 tăng vọt lên 8.4 mm/s (ngưỡng Warning: 4.5 mm/s).',
    targetMachineId: 'MCH-WLD-01',
    targetMachineName: 'Robot Hàn Điểm (MCH-WLD-01)',
    severity: 'high',
    recommendedAction: 'Kiểm tra độ rơ bạc đạn khớp trục và siết lại cụm bu-lông chân đế robot.',
    rootCause: 'Mòn ổ bi bạc đạn dẫn hướng trục xoay do thiếu mỡ bôi trơn công nghiệp chịu nhiệt.',
  },
  {
    id: 'multiple_anomalies',
    name: 'Kịch bản 4: Đa Thiết bị Bất thường Đồng thời',
    description: 'Lò sấy MCH-DRY-01 quá nhiệt buồng sấy (188°C) và Máy dập MCH-PRS-01 sụt áp suất ép.',
    targetMachineId: 'MCH-DRY-01',
    targetMachineName: 'Lò Sấy Công Nghiệp (MCH-DRY-01)',
    severity: 'critical',
    recommendedAction: 'Cắt tải nhiệt buồng sấy khẩn cấp và kích hoạt van xả áp an toàn.',
    rootCause: 'Hỏng rơ-le bán dẫn SSR điều khiển thanh gia nhiệt và hở phốt làm kín xi-lanh.',
  },
  {
    id: 'recovery',
    name: 'Kịch bản 5: Phục hồi Ổn định sau Bảo trì',
    description: 'Kỹ thuật viên đã thay dầu, tra mỡ và hiệu chuẩn cảm biến. Các chỉ số trở về vùng xanh.',
    targetMachineId: 'ALL',
    targetMachineName: 'Toàn bộ thiết bị sau bảo dưỡng',
    severity: 'low',
    recommendedAction: 'Ghi nhận hoàn tất phiếu bảo trì vào nhật ký và theo dõi ổn định trong 2 giờ.',
    rootCause: 'Bảo trì thành công, các cụm cơ cấu cơ khí và cảm biến đã ổn định hoàn toàn.',
  },
];

/* ------------------------------------------------------------------ */
/* 3. THUẬT TOÁN TÍNH ĐIỂM SỨC KHỎE (EXPLAINABLE HEALTH SCORE)         */
/* ------------------------------------------------------------------ */
export function computeEquipmentHealth(
  machine: { id: string; name: string; code?: string; lineId: string; type?: string },
  lineName: string,
  scenarioId: AIScenarioId,
  isDemoActive: boolean
): EquipmentHealthItem {
  // Điểm gốc chuẩn là 100 điểm tuyệt đối
  const base = 100;
  let tempPenalty = 0;
  let vibrationPenalty = 0;
  let pressurePenalty = 0;
  let currentPenalty = 0;
  let agePenalty = 2; // Khấu hao chu kỳ máy thông thường (-2 điểm)

  const mId = (machine.id || '').toUpperCase();
  const mCode = (machine.code || machine.id || '').toUpperCase();

  // Xác định thông số then chốt dựa vào chủng loại máy
  let keyMetric = METRIC_CATALOG.TEMP_HYD;
  if (mCode.includes('WLD') || mId.includes('WLD') || mCode.includes('ROB')) {
    keyMetric = METRIC_CATALOG.VIB_RMS;
  } else if (mCode.includes('DRY') || mId.includes('DRY')) {
    keyMetric = METRIC_CATALOG.TEMP_CHAMBER;
  } else if (mCode.includes('PNT') || mId.includes('PNT')) {
    keyMetric = METRIC_CATALOG.FLOW_RATE;
  } else if (mCode.includes('ASM') || mId.includes('ASM')) {
    keyMetric = METRIC_CATALOG.TORQUE;
  } else if (mCode.includes('TST') || mId.includes('TST')) {
    keyMetric = METRIC_CATALOG.NOISE_LEVEL;
  }

  let keyMetricValue = keyMetric.nominal;
  let activeAnomaliesCount = 0;
  let trendDirection: 'up' | 'down' | 'stable' = 'stable';
  let explanation = 'Thiết bị hoạt động trong giới hạn dung sai cho phép, không phát hiện nguy cơ.';

  if (!isDemoActive) {
    // Trạng thái tĩnh khi tạm dừng mô phỏng
    const healthScore = base - agePenalty;
    return {
      machineId: machine.id,
      machineCode: machine.code || machine.id,
      machineName: machine.name,
      lineId: machine.lineId,
      lineName,
      type: machine.type || 'Thiết bị công nghiệp',
      healthScore,
      riskLevel: 'LOW',
      status: 'NORMAL',
      factors: {
        base,
        tempPenalty: 0,
        vibrationPenalty: 0,
        pressurePenalty: 0,
        currentPenalty: 0,
        agePenalty,
        explanation: 'Dữ liệu đo lường thực tế ổn định, thông số nằm trong ngưỡng an toàn.',
      },
      activeAnomaliesCount: 0,
      trendDirection: 'stable',
      lastEvaluated: 'Vừa xong',
      keyMetricCode: keyMetric.code,
      keyMetricName: keyMetric.name,
      keyMetricValue: keyMetric.nominal,
      keyMetricUnit: keyMetric.unit,
    };
  }

  // Áp dụng tác động theo kịch bản mô phỏng
  switch (scenarioId) {
    case 'normal':
      agePenalty = 3;
      explanation = 'Tất cả thông số đo lường nằm trong giới hạn kiểm soát thống kê (SPC).';
      break;

    case 'high_temp':
      if (mId === 'MCH-PRS-01' || mCode.includes('PRS') || mCode.includes('STP')) {
        tempPenalty = 38;
        pressurePenalty = 8;
        keyMetricValue = 86.4;
        activeAnomaliesCount = 2;
        trendDirection = 'down';
        explanation = 'Phạt 38đ do nhiệt độ dầu vượt ngưỡng Critical (80°C). Phạt 8đ do suy giảm độ nhớt thủy lực.';
      } else {
        agePenalty = 4;
      }
      break;

    case 'abnormal_vibration':
      if (mId === 'MCH-WLD-01' || mCode.includes('WLD') || mCode.includes('ROB')) {
        vibrationPenalty = 44;
        currentPenalty = 6;
        keyMetricValue = 8.4;
        activeAnomaliesCount = 2;
        trendDirection = 'down';
        explanation = 'Phạt 44đ do độ rung RMS tăng vọt lên 8.4 mm/s (Z-score = 3.8). Cảnh báo mòn ổ bi trục xoay số 2.';
      } else {
        agePenalty = 3;
      }
      break;

    case 'multiple_anomalies':
      if (mId === 'MCH-DRY-01' || mCode.includes('DRY')) {
        tempPenalty = 42;
        activeAnomaliesCount = 2;
        keyMetricValue = 188.0;
        trendDirection = 'down';
        explanation = 'Phạt 42đ do nhiệt độ buồng sấy vượt ngưỡng tới hạn 185°C. Rơ-le gia nhiệt SSR bị dính tiếp điểm.';
      } else if (mId === 'MCH-PRS-01' || mCode.includes('PRS')) {
        pressurePenalty = 32;
        tempPenalty = 10;
        activeAnomaliesCount = 1;
        keyMetricValue = 142.0;
        trendDirection = 'down';
        explanation = 'Phạt 32đ do tụt áp suất ép chính. Phạt 10đ do rò rỉ nhiệt cục bộ.';
      } else {
        agePenalty = 5;
      }
      break;

    case 'recovery':
      agePenalty = 1;
      trendDirection = 'up';
      explanation = 'Thiết bị đã được bảo dưỡng, thay mới linh kiện và hiệu chuẩn, điểm sức khỏe phục hồi tối ưu.';
      break;
  }

  // TÍNH TOÁN ĐIỂM SỨC KHỎE KHỚP 100% VỚI CÁC KHOẢN PHẠT:
  // healthScore = base (100) - tổng các khoản phạt
  const totalPenalties = tempPenalty + vibrationPenalty + pressurePenalty + currentPenalty + agePenalty;
  const finalScore = Math.max(10, Math.min(100, base - totalPenalties));

  let riskLevel: AIRiskLevel = 'LOW';
  let status: AIEquipmentStatus = 'NORMAL';

  if (finalScore < 60) {
    riskLevel = 'CRITICAL';
    status = 'ANOMALOUS';
  } else if (finalScore < 80) {
    riskLevel = 'HIGH';
    status = 'WARNING';
  } else if (finalScore < 90) {
    riskLevel = 'MEDIUM';
    status = 'NORMAL';
  }

  return {
    machineId: machine.id,
    machineCode: machine.code || machine.id,
    machineName: machine.name,
    lineId: machine.lineId,
    lineName,
    type: machine.type || 'Thiết bị công nghiệp',
    healthScore: finalScore,
    riskLevel,
    status,
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
    lastEvaluated: 'Vừa xong',
    keyMetricCode: keyMetric.code,
    keyMetricName: keyMetric.name,
    keyMetricValue,
    keyMetricUnit: keyMetric.unit,
  };
}

/** Tính toán sức khỏe cho toàn bộ danh sách thiết bị nạp từ store */
export function computeAllEquipmentHealth(
  machines: any[],
  scenarioId: AIScenarioId,
  isDemoActive: boolean = true
): EquipmentHealthItem[] {
  return machines.map((m) =>
    computeEquipmentHealth(
      {
        id: m.id,
        name: m.name,
        code: m.code || m.id,
        lineId: m.lineId || 'LINE-01',
        type: m.type,
      },
      m.lineName || 'Dây chuyền sản xuất',
      scenarioId,
      isDemoActive
    )
  );
}

/* ------------------------------------------------------------------ */
/* 4. SINH DỮ LIỆU BIỂU ĐỒ XU HƯỚNG THEO THỜI GIAN (RECHARTS)         */
/* ------------------------------------------------------------------ */
export function generateTrendPoints(
  machineId: string,
  metricCode: string,
  scenarioId: AIScenarioId,
  isDemoActive: boolean,
  timeRange: '15m' | '1h' | '24h' = '15m'
): AITrendPoint[] {
  const pointsCount = timeRange === '15m' ? 15 : timeRange === '1h' ? 20 : 24;
  const points: AITrendPoint[] = [];
  const now = Date.now();
  const stepMs = timeRange === '15m' ? 60000 : timeRange === '1h' ? 3 * 60000 : 60 * 60000;

  // Lấy định nghĩa chuẩn của metric từ catalog
  const meta = getMetricDefinition(metricCode);
  const nominal = meta.nominal;
  const warnMax = meta.warningMax;
  const critMax = meta.criticalMax;
  const unit = meta.unit;

  const mUpper = (machineId || '').toUpperCase();
  const isTargetMachine =
    (scenarioId === 'high_temp' && (mUpper.includes('PRS') || mUpper.includes('STP'))) ||
    (scenarioId === 'abnormal_vibration' && (mUpper.includes('WLD') || mUpper.includes('ROB'))) ||
    (scenarioId === 'multiple_anomalies' && (mUpper.includes('DRY') || mUpper.includes('PRS')));

  for (let i = pointsCount - 1; i >= 0; i--) {
    const time = new Date(now - i * stepMs);
    const timeLabel = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    let val = nominal + Math.sin(i * 0.6) * (nominal * 0.04);

    let isAnomaly = false;
    let anomalyType: any = undefined;
    let note = undefined;

    if (isDemoActive && isTargetMachine) {
      if (scenarioId === 'high_temp' && (metricCode.includes('TEMP') || metricCode === 'TEMP_HYD')) {
        if (i < 6) {
          const progress = (6 - i) / 6;
          val = nominal + 12 + progress * 22; // Lên tới ~86.4°C
          if (val >= warnMax) {
            isAnomaly = true;
            anomalyType = val >= critMax ? 'THRESHOLD_BREACH' : 'SUDDEN_SPIKE';
            note = val >= critMax ? 'Vượt ngưỡng Nguy hiểm (Critical)' : 'Vượt ngưỡng Cảnh báo (Warning)';
          }
        }
      } else if (scenarioId === 'abnormal_vibration' && (metricCode.includes('VIB') || metricCode === 'VIB_RMS')) {
        if (i < 6) {
          val = nominal + 2.0 + (6 - i) * 0.75; // Vọt lên 8.4 mm/s
          isAnomaly = true;
          anomalyType = val >= critMax ? 'THRESHOLD_BREACH' : 'SUDDEN_SPIKE';
          note = 'Dao động cộng hưởng cơ khí vượt chuẩn ISO 10816';
        }
      } else if (scenarioId === 'multiple_anomalies') {
        if (metricCode.includes('TEMP') && mUpper.includes('DRY')) {
          if (i < 6) {
            val = nominal + 15 + (6 - i) * 5; // Vọt lên 188°C
            isAnomaly = true;
            anomalyType = 'THRESHOLD_BREACH';
            note = 'Nhiệt buồng sấy vượt quá ngưỡng tới hạn sơn tĩnh điện';
          }
        } else if (metricCode.includes('PRESS') && mUpper.includes('PRS')) {
          if (i < 6) {
            val = nominal - 25 - (6 - i) * 7; // Tụt áp xuống 142 bar
            isAnomaly = true;
            anomalyType = 'PERSISTENT_DRIFT';
            note = 'Tụt áp lực kéo dài qua nhiều chu kỳ dập';
          }
        }
      }
    } else if (isDemoActive && scenarioId === 'recovery') {
      if (i > 8) {
        val = nominal + (i - 8) * 1.2;
      } else {
        val = nominal - 0.5 + Math.random() * 1.0;
      }
    }

    points.push({
      timestamp: timeLabel,
      value: Number(val.toFixed(1)),
      unit,
      warningMax: warnMax,
      criticalMax: critMax,
      isAnomaly,
      anomalyType,
      note,
    });
  }

  return points;
}

/* ------------------------------------------------------------------ */
/* 5. SINH DANH SÁCH CÁC SỰ KIỆN BẤT THƯỜNG (ANOMALY EVENTS)         */
/* ------------------------------------------------------------------ */
export function generateAnomalyEvents(
  _healthList: EquipmentHealthItem[],
  scenarioId: AIScenarioId,
  isDemoActive: boolean
): AIAnomalyEvent[] {
  if (!isDemoActive) return [];

  const events: AIAnomalyEvent[] = [];
  const now = new Date();
  const formatTime = (minsAgo: number) =>
    new Date(now.getTime() - minsAgo * 60000).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  if (scenarioId === 'high_temp') {
    events.push({
      id: 'ANM-PRS-001',
      timestamp: formatTime(3),
      machineId: 'MCH-PRS-01',
      machineCode: 'MCH-PRS-01',
      machineName: 'Máy Dập Thủy Lực 500T Komatsu',
      lineName: 'Dây Chuyền Dập & Đột',
      metricCode: 'TEMP_HYD',
      metricName: 'Nhiệt độ dầu thủy lực',
      category: 'Nhiệt độ',
      value: 86.4,
      unit: '°C',
      warningThreshold: 70.0,
      criticalThreshold: 80.0,
      severity: 'CRITICAL',
      detectionRule: 'THRESHOLD_BREACH',
      ruleExplanation: 'Giá trị tức thời 86.4°C vượt ngưỡng Critical (80.0°C). Tốc độ tăng nhiệt: +3.2°C/phút.',
      deviationPercent: 8.0,
    });
    events.push({
      id: 'ANM-PRS-002',
      timestamp: formatTime(12),
      machineId: 'MCH-PRS-01',
      machineCode: 'MCH-PRS-01',
      machineName: 'Máy Dập Thủy Lực 500T Komatsu',
      lineName: 'Dây Chuyền Dập & Đột',
      metricCode: 'PRESSURE_HYD',
      metricName: 'Áp suất bơm chính',
      category: 'Áp suất',
      value: 236.0,
      unit: 'bar',
      warningThreshold: 230.0,
      criticalThreshold: 250.0,
      severity: 'WARNING',
      detectionRule: 'SUDDEN_SPIKE',
      ruleExplanation: 'Xung áp đột biến vượt ngưỡng cảnh báo sau hành trình ép dập tải nặng.',
      deviationPercent: 2.6,
    });
  } else if (scenarioId === 'abnormal_vibration') {
    events.push({
      id: 'ANM-WLD-001',
      timestamp: formatTime(5),
      machineId: 'MCH-WLD-01',
      machineCode: 'MCH-WLD-01',
      machineName: 'Robot Hàn Điểm Fanuc R-2000iC',
      lineName: 'Dây Chuyền Dập & Đột',
      metricCode: 'VIB_RMS',
      metricName: 'Độ rung hiệu dụng RMS',
      category: 'Rung động',
      value: 8.4,
      unit: 'mm/s',
      warningThreshold: 4.5,
      criticalThreshold: 7.0,
      severity: 'CRITICAL',
      detectionRule: 'THRESHOLD_BREACH',
      ruleExplanation: 'Biên độ rung vượt tiêu chuẩn rung động công nghiệp ISO 10816 class III (+20%).',
      deviationPercent: 20.0,
    });
  } else if (scenarioId === 'multiple_anomalies') {
    events.push({
      id: 'ANM-DRY-001',
      timestamp: formatTime(2),
      machineId: 'MCH-DRY-01',
      machineCode: 'MCH-DRY-01',
      machineName: 'Lò Sấy Hồng Ngoại Đối Lưu',
      lineName: 'Dây Chuyền Sơn Tĩnh Điện',
      metricCode: 'TEMP_CHAMBER',
      metricName: 'Nhiệt độ buồng sấy',
      category: 'Nhiệt độ',
      value: 188.0,
      unit: '°C',
      warningThreshold: 170.0,
      criticalThreshold: 185.0,
      severity: 'CRITICAL',
      detectionRule: 'THRESHOLD_BREACH',
      ruleExplanation: 'Nhiệt độ lò sấy vượt ngưỡng tới hạn gây rủi ro phồng rộp màng sơn chi tiết.',
      deviationPercent: 1.6,
    });
    events.push({
      id: 'ANM-PRS-003',
      timestamp: formatTime(8),
      machineId: 'MCH-PRS-01',
      machineCode: 'MCH-PRS-01',
      machineName: 'Máy Dập Thủy Lực 500T Komatsu',
      lineName: 'Dây Chuyền Dập & Đột',
      metricCode: 'PRESSURE_HYD',
      metricName: 'Áp suất bơm chính',
      category: 'Áp suất',
      value: 142.0,
      unit: 'bar',
      warningThreshold: 200.0,
      criticalThreshold: 160.0,
      severity: 'CRITICAL',
      detectionRule: 'PERSISTENT_DRIFT',
      ruleExplanation: 'Tụt giảm áp suất kéo dài liên tục qua 6 chu kỳ ép phôi (-29% so với định mức).',
      deviationPercent: 29.0,
    });
  }

  return events;
}

/* ------------------------------------------------------------------ */
/* 6. SINH PHIẾU CÔNG TÁC BẢO TRÌ DỰ ĐOÁN (PREDICTIVE ORDERS)        */
/* ------------------------------------------------------------------ */
export function generatePredictiveOrders(
  _healthList: EquipmentHealthItem[],
  scenarioId: AIScenarioId,
  isDemoActive: boolean
): AIPredictiveOrder[] {
  if (!isDemoActive || scenarioId === 'normal') {
    return [
      {
        id: 'WO-ROUTINE-001',
        machineId: 'MCH-PRS-01',
        machineCode: 'MCH-PRS-01',
        machineName: 'Máy Dập Thủy Lực 500T Komatsu',
        lineName: 'Dây Chuyền Dập & Đột',
        priority: 'P4_ROUTINE',
        healthScore: 97,
        component: 'Lưới lọc hút dầu đáy bồn',
        symptom: 'Các chỉ số ổn định, tích lũy 480 giờ vận hành.',
        rootCause: 'Bảo trì ngăn ngừa theo khuyến nghị nhà sản xuất Komatsu.',
        recommendedAction: 'Vệ sinh lưới lọc hút và kiểm tra mức dầu thùng chứa.',
        estimatedTimeToDegrade: '> 720 giờ máy (Mô phỏng Demo)',
        estimatedWorkHours: 1.0,
        suggestedTools: ['Cờ lê tròng 19mm', 'Khay hứng dầu', 'Dung dịch tẩy rửa công nghiệp'],
        status: 'PENDING',
      },
    ];
  }

  if (scenarioId === 'high_temp') {
    return [
      {
        id: 'WO-HIGH-TEMP-001',
        machineId: 'MCH-PRS-01',
        machineCode: 'MCH-PRS-01',
        machineName: 'Máy Dập Thủy Lực 500T Komatsu',
        lineName: 'Dây Chuyền Dập & Đột',
        priority: 'P1_CRITICAL',
        healthScore: 52,
        component: 'Van tỉ lệ & Bộ tản nhiệt dầu thủy lực',
        symptom: 'Nhiệt độ dầu đạt 86.4°C, áp suất dao động bất thường.',
        rootCause: 'Tắc van điều lưu giải nhiệt hoặc kẹt cánh quạt làm mát.',
        recommendedAction: 'Dừng máy kiểm tra khẩn cấp cánh tản nhiệt và thông rửa đường ống giải nhiệt.',
        estimatedTimeToDegrade: 'Khoảng 4 - 6 giờ máy (Mô phỏng Demo)',
        estimatedWorkHours: 2.5,
        suggestedTools: ['Đồng hồ đo áp suất 400 bar', 'Súng nhiệt hồng ngoại', 'Bộ cờ lê lực'],
        status: 'PENDING',
      },
    ];
  }

  if (scenarioId === 'abnormal_vibration') {
    return [
      {
        id: 'WO-VIB-001',
        machineId: 'MCH-WLD-01',
        machineCode: 'MCH-WLD-01',
        machineName: 'Robot Hàn Điểm Fanuc R-2000iC',
        lineName: 'Dây Chuyền Dập & Đột',
        priority: 'P2_HIGH',
        healthScore: 48,
        component: 'Ổ bi đỡ & Khớp xoay trục số 2 J2',
        symptom: 'Độ rung RMS vọt lên 8.4 mm/s, xuất hiện tiếng rít cơ khí.',
        rootCause: 'Mòn ổ bi bạc đạn dẫn hướng trục do suy giảm mỡ bôi trơn.',
        recommendedAction: 'Bơm mỡ bôi trơn chuyên dụng mỡ cao áp Mobilux EP2 và siết bu-lông chân đế.',
        estimatedTimeToDegrade: 'Khoảng 12 - 16 giờ máy (Mô phỏng Demo)',
        estimatedWorkHours: 2.0,
        suggestedTools: ['Súng bơm mỡ áp lực cao', 'Cờ lê lực 120Nm', 'Máy đo rung cầm tay'],
        status: 'PENDING',
      },
    ];
  }

  if (scenarioId === 'multiple_anomalies') {
    return [
      {
        id: 'WO-MULTI-001',
        machineId: 'MCH-DRY-01',
        machineCode: 'MCH-DRY-01',
        machineName: 'Lò Sấy Hồng Ngoại Đối Lưu',
        lineName: 'Dây Chuyền Sơn Tĩnh Điện',
        priority: 'P1_CRITICAL',
        healthScore: 54,
        component: 'Rơ-le bán dẫn SSR & Thanh gia nhiệt buồng sấy 1',
        symptom: 'Nhiệt độ buồng sấy không ngắt tại 170°C, leo dốc lên 188°C.',
        rootCause: 'Rơ-le SSR điều khiển thanh nhiệt bị dính tiếp điểm ngõ ra.',
        recommendedAction: 'Ngắt nguồn rơ-le SSR, kiểm tra điện trở cách điện và thay thế khối rơ-le Omron.',
        estimatedTimeToDegrade: 'Khoảng 2 - 4 giờ máy (Mô phỏng Demo)',
        estimatedWorkHours: 1.5,
        suggestedTools: ['Đồng hồ vạn năng Fluke', 'Kìm bấm cos', 'Rơ-le SSR Omron G3NA'],
        status: 'PENDING',
      },
      {
        id: 'WO-MULTI-002',
        machineId: 'MCH-PRS-01',
        machineCode: 'MCH-PRS-01',
        machineName: 'Máy Dập Thủy Lực 500T Komatsu',
        lineName: 'Dây Chuyền Dập & Đột',
        priority: 'P2_HIGH',
        healthScore: 58,
        component: 'Phốt làm kín Piston ép chính',
        symptom: 'Áp suất ép giảm từ 210 bar xuống 142 bar trong ca làm việc.',
        rootCause: 'Rách viền phốt thủy lực chịu mài mòn cao sau 1800 giờ máy.',
        recommendedAction: 'Thay thế cụm phốt làm kín Piston Seal Kit 120mm.',
        estimatedTimeToDegrade: 'Khoảng 18 - 24 giờ máy (Mô phỏng Demo)',
        estimatedWorkHours: 3.5,
        suggestedTools: ['Bộ móc tháo phốt thủy lực', 'Bộ Piston Seal Kit Komatsu', 'Cờ lê thủy lực'],
        status: 'PENDING',
      },
    ];
  }

  // recovery
  return [
    {
      id: 'WO-REC-001',
      machineId: 'MCH-PRS-01',
      machineCode: 'MCH-PRS-01',
      machineName: 'Máy Dập Thủy Lực 500T Komatsu',
      lineName: 'Dây Chuyền Dập & Đột',
      priority: 'P4_ROUTINE',
      healthScore: 98,
      component: 'Hệ thống tuần hoàn làm mát',
      symptom: 'Các thông số đã phục hồi về mức chuẩn.',
      rootCause: 'Đã hoàn tất quy trình bảo dưỡng.',
      recommendedAction: 'Nghiệm thu ca và đưa vào nhật ký số.',
      estimatedTimeToDegrade: '> 1000 giờ máy (Mô phỏng Demo)',
      estimatedWorkHours: 0.5,
      suggestedTools: ['Biên bản nghiệm thu số'],
      status: 'COMPLETED',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 7. TRỢ LÝ HỘI THOẠI AI (DENSO AI ASSISTANT ENGINE)                 */
/* ------------------------------------------------------------------ */
export function answerAssistantQuery(
  userQuery: string,
  context: {
    healthList: EquipmentHealthItem[];
    anomalies: AIAnomalyEvent[];
    orders: AIPredictiveOrder[];
    selectedMachine: EquipmentHealthItem | null;
    scenario: AIScenario;
    isDemoActive: boolean;
  }
): AIChatMessage {
  const q = userQuery.toLowerCase().trim();
  const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // 1. Hỏi về thiết bị nguy cấp nhất / rủi ro cao nhất
  if (q.includes('nguy cơ') || q.includes('nguy cấp') || q.includes('hỏng') || q.includes('kém nhất') || q.includes('rủi ro cao')) {
    const worst = [...context.healthList].sort((a, b) => a.healthScore - b.healthScore)[0];
    if (worst && worst.healthScore < 80) {
      return {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: `Hiện tại thiết bị có nguy cơ cao nhất là **${worst.machineCode}** (${worst.machineName}) thuộc **${worst.lineName}** với Điểm Sức khỏe chỉ đạt **${worst.healthScore}/100** (Mức rủi ro: **${worst.riskLevel}**).\n\n**Nguyên nhân:**\n- ${worst.factors.explanation}\n- Đã ghi nhận **${worst.activeAnomaliesCount}** cảnh báo bất thường trong ca làm việc.\n\n**Hành động khuyến nghị:**\n${context.scenario.recommendedAction}`,
        timestamp: now,
        highlightCard: {
          title: `${worst.machineCode} — Cần can thiệp khẩn cấp`,
          subtitle: `Điểm sức khỏe suy giảm nghiêm trọng (${worst.healthScore}/100)`,
          score: worst.healthScore,
          badge: worst.riskLevel,
          badgeColor: 'rose',
        },
        suggestedPrompts: [
          `Đề xuất quy trình bảo trì cho ${worst.machineCode}`,
          'Tổng quan sức khỏe toàn xưởng',
          'Danh sách phiếu bảo trì cần ưu tiên',
        ],
      };
    }

    return {
      id: `bot-${Date.now()}`,
      sender: 'assistant',
      text: `Toàn bộ ${context.healthList.length} thiết bị hiện đang hoạt động ổn định trong vùng an toàn (Điểm sức khỏe trung bình đạt **${Math.round(
        context.healthList.reduce((s, m) => s + m.healthScore, 0) / context.healthList.length
      )}/100**). Không có thiết bị nào rơi vào tình trạng nguy cấp.`,
      timestamp: now,
      suggestedPrompts: [
        'Kế hoạch bảo trì định kỳ tiếp theo',
        'Phân tích xu hướng thông số 24 giờ qua',
      ],
    };
  }

  // 2. Hỏi về giải thích cảnh báo nhiệt độ hoặc máy dập
  if (q.includes('nhiệt độ') || q.includes('máy dập') || q.includes('mch-prs-01') || q.includes('prs')) {
    return {
      id: `bot-${Date.now()}`,
      sender: 'assistant',
      text: `**Phân tích Kỹ thuật Máy Dập MCH-PRS-01:**\n- **Thông số:** Nhiệt độ dầu thủy lực ghi nhận mức **86.4°C** (vượt ngưỡng Critical 80.0°C).\n- **Độ lệch chuẩn:** Cao hơn định mức vận hành an toàn **+8.0%**.\n- **Nguyên nhân cốt lõi (Root Cause):** Tắc nghẽn van tuần hoàn dầu giải nhiệt hoặc quạt dàn làm mát bị kẹt rác cơ khí.\n- **Hậu quả nếu kéo dài:** Dầu loãng làm tụt áp suất ép chính, có thể gây cháy phốt xy-lanh trong 4 - 6 giờ máy tới.`,
      timestamp: now,
      highlightCard: {
        title: 'Cảnh báo Nhiệt độ Dầu Thủy lực',
        subtitle: 'MCH-PRS-01 — Vượt ngưỡng Critical 80.0°C',
        score: 52,
        badge: 'CRITICAL',
        badgeColor: 'rose',
      },
      suggestedPrompts: [
        'Đề xuất công cụ bảo trì cho MCH-PRS-01',
        'Xem các sự kiện bất thường của MCH-PRS-01',
      ],
    };
  }

  // 3. Hỏi về rung động robot hàn
  if (q.includes('rung') || q.includes('robot') || q.includes('wld') || q.includes('hàn')) {
    return {
      id: `bot-${Date.now()}`,
      sender: 'assistant',
      text: `**Chẩn đoán Rung động Robot Hàn MCH-WLD-01:**\n- **Thông số:** Độ rung RMS trục J2 đạt **8.4 mm/s** (tiêu chuẩn ISO 10816 class III chỉ cho phép tối đa 7.0 mm/s).\n- **Quy tắc AI kích hoạt:** VƯỢT NGƯỠNG ĐỈNH (Threshold Breach, Z-score = 3.8).\n- **Khuyến nghị kỹ thuật:** Bơm mỡ bôi trơn công nghiệp Mobilux EP2 vào ổ bi khớp xoay J2 và siết kiểm tra 4 bu-lông chân đế robot bằng cờ lê lực 120Nm.`,
      timestamp: now,
      highlightCard: {
        title: 'Bất thường Rung động Khớp Trục J2',
        subtitle: 'MCH-WLD-01 — Độ rung 8.4 mm/s',
        score: 48,
        badge: 'HIGH',
        badgeColor: 'amber',
      },
      suggestedPrompts: [
        'Thời gian dự kiến hỏng ổ bi là bao lâu?',
        'Có cần dừng dây chuyền ngay lập tức không?',
      ],
    };
  }

  // 4. Hỏi về kế hoạch bảo trì ca này
  if (q.includes('kế hoạch') || q.includes('bảo trì') || q.includes('bảo dưỡng') || q.includes('phiếu')) {
    const p1Orders = context.orders.filter((o) => o.priority === 'P1_CRITICAL');
    const p2Orders = context.orders.filter((o) => o.priority === 'P2_HIGH');

    let text = `Trong ca làm việc hiện hành, AI đã lập **${context.orders.length} phiếu công tác bảo trì dự đoán**:\n\n`;
    if (p1Orders.length > 0) {
      text += `🚨 **Ưu tiên P1 (Khẩn cấp - Can thiệp ngay):**\n`;
      p1Orders.forEach((o) => {
        text += `- **${o.machineCode}**: ${o.component} — Dự kiến suy thoái sau ${o.estimatedTimeToDegrade}.\n`;
      });
      text += `\n`;
    }
    if (p2Orders.length > 0) {
      text += `⚠️ **Ưu tiên P2 (Ưu tiên cao - Xử lý trong ca):**\n`;
      p2Orders.forEach((o) => {
        text += `- **${o.machineCode}**: ${o.component} — Thời lượng: ${o.estimatedWorkHours} giờ công.\n`;
      });
    }

    return {
      id: `bot-${Date.now()}`,
      sender: 'assistant',
      text,
      timestamp: now,
      suggestedPrompts: [
        'Xem chi tiết công cụ cần chuẩn bị',
        'Cách cập nhật trạng thái phiếu bảo trì',
      ],
    };
  }

  // 5. Mặc định: Phân tích tổng quan thiết bị
  const avgHealth = Math.round(
    context.healthList.reduce((acc, cur) => acc + cur.healthScore, 0) / (context.healthList.length || 1)
  );

  return {
    id: `bot-${Date.now()}`,
    sender: 'assistant',
    text: `Hệ thống DENSO KaiLink đang giám sát **${context.healthList.length} thiết bị** trên 3 dây chuyền sản xuất.\n\n- **Chỉ số Sức khỏe Trung bình:** ${avgHealth}/100 điểm.\n- **Kịch bản vận hành hiện hành:** ${context.scenario.name}.\n- **Số lượng dị biệt quan trắc:** ${context.anomalies.length} sự kiện.\n- **Số phiếu bảo trì dự đoán:** ${context.orders.length} đầu việc.\n\nBạn có thể hỏi tôi bất kỳ câu hỏi kỹ thuật nào về tình trạng từng thiết bị, nguyên nhân cảnh báo hoặc quy trình khắc phục.`,
    timestamp: now,
    suggestedPrompts: [
      'Máy nào hiện đang có nguy cơ hỏng hóc cao nhất?',
      'Giải thích nguyên nhân cảnh báo nhiệt độ Máy dập MCH-PRS-01',
      'Đề xuất kế hoạch bảo dưỡng ca này',
    ],
  };
}
