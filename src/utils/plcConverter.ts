/**
 * @file plcConverter.ts
 * @description Tiện ích chuyển đổi tín hiệu thô từ PLC/Cảm biến sang giá trị hiển thị kỹ thuật và đánh giá trạng thái ngưỡng
 */

import { PLCMappingConfig } from '../types/plc';
import { SystemStatus, MachineComponent } from '../types/hierarchy';

/**
 * Chuyển đổi giá trị thô nhận từ thanh ghi PLC sang giá trị đo kỹ thuật thực tế (Engineering Units)
 * 
 * @param rawValue Giá trị số thô đọc từ thanh ghi PLC (ví dụ: 0 - 4095 từ ADC 12-bit)
 * @param config Cấu hình ánh xạ thanh ghi (Mapping Config)
 * @returns Giá trị kỹ thuật sau khi đã xử lý (làm tròn 2 chữ số thập phân)
 */
export function convertPLCRawToEngineering(rawValue: number, config?: PLCMappingConfig): number {
  if (!config) {
    return Number(rawValue.toFixed(2));
  }

  const {
    dataType,
    rawMin = 0,
    rawMax = 4095,
    engMin = 0,
    engMax = 100,
    scaleMultiplier = 1,
    scaleOffset = 0,
    bitMaskIndex = 0,
  } = config;

  switch (dataType) {
    case 'DEC12': {
      // 12-bit ADC chuẩn (0 - 4095) ánh xạ tuyến tính sang dải kỹ thuật [engMin, engMax]
      // Công thức: Y = engMin + ((X - rawMin) / (rawMax - rawMin)) * (engMax - engMin)
      const clampedRaw = Math.max(rawMin, Math.min(rawMax, rawValue));
      const normalized = (clampedRaw - rawMin) / (rawMax - rawMin || 1);
      const engValue = engMin + normalized * (engMax - engMin);
      return Number(engValue.toFixed(2));
    }

    case 'BIT12': {
      // Thanh ghi 12-bit nhị phân: Trích xuất trạng thái bit tại chỉ số bitMaskIndex (0 - 11)
      const mask = 1 << bitMaskIndex;
      const bitValue = (Math.floor(rawValue) & mask) !== 0 ? 1 : 0;
      return bitValue;
    }

    case 'SCALE': {
      // Áp dụng công thức tuyến tính công nghiệp: Y = X * Scale + Offset
      const scaled = rawValue * scaleMultiplier + scaleOffset;
      return Number(scaled.toFixed(2));
    }

    case 'FLOAT32':
    case 'INT16':
    case 'UINT16':
    default:
      return Number(rawValue.toFixed(2));
  }
}

/**
 * Đánh giá trạng thái (Normal, Warning, Critical) của một chỉ số dựa trên 4 ngưỡng kỹ thuật
 * 
 * @param value Giá trị hiện tại của chỉ số
 * @param warningMin Ngưỡng cảnh báo dưới
 * @param warningMax Ngưỡng cảnh báo trên
 * @param criticalMin Ngưỡng nguy hiểm dưới
 * @param criticalMax Ngưỡng nguy hiểm trên
 */
export function evaluateMetricStatus(
  value: number,
  warningMin: number,
  warningMax: number,
  criticalMin: number,
  criticalMax: number
): SystemStatus {
  // Ưu tiên kiểm tra ngưỡng Nguy hiểm (Critical) trước
  if (value <= criticalMin || value >= criticalMax) {
    return 'critical';
  }
  // Kiểm tra ngưỡng Cảnh báo (Warning)
  if (value <= warningMin || value >= warningMax) {
    return 'warning';
  }
  // Nằm trong dải an toàn
  return 'normal';
}

/**
 * Tính toán Chỉ số an toàn (%) và Trạng thái tổng quan của toàn bộ Dây chuyền (Tầng 1)
 * dựa trên danh sách các Máy (Tầng 2) và Chỉ số đo lường (Tầng 3)
 */
export function calculateLineSafetyMetrics(machines: MachineComponent[]): {
  safetyScore: number;
  overallStatus: SystemStatus;
} {
  let totalMetrics = 0;
  let normalCount = 0;
  let warningCount = 0;
  let criticalCount = 0;

  for (const machine of machines) {
    for (const metric of machine.metrics) {
      totalMetrics++;
      if (metric.status === 'normal') normalCount++;
      else if (metric.status === 'warning') warningCount++;
      else if (metric.status === 'critical') criticalCount++;
    }
  }

  if (totalMetrics === 0) {
    return { safetyScore: 100, overallStatus: 'normal' };
  }

  // Điểm an toàn: 100% khi tất cả bình thường; mỗi cảnh báo warning trừ 15 điểm; critical trừ 40 điểm
  // Điểm tính theo tỷ lệ an toàn: (normal + 0.5 * warning) / total
  const weightedScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(((normalCount * 1.0 + warningCount * 0.5 + criticalCount * 0.0) / totalMetrics) * 100)
    )
  );

  let overallStatus: SystemStatus = 'normal';
  if (criticalCount > 0) {
    overallStatus = 'critical';
  } else if (warningCount > 0) {
    overallStatus = 'warning';
  }

  return {
    safetyScore: weightedScore,
    overallStatus,
  };
}
