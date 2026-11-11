/**
 * @file types.ts
 * @description Định nghĩa các kiểu dữ liệu cho phân hệ CHECK SHEET (Kiểm tra & Giám sát thông số máy)
 */

export interface CheckSheetMetricItem {
  stt: number;
  metricCode: string;
  metricName: string;
  currentValue: number;
  unit: string;
  warningMin?: number | null;
  warningMax?: number | null;
  criticalMin?: number | null;
  criticalMax?: number | null;
  status: 'OK' | 'WARNING' | 'NG' | 'NO_DATA';
  lastUpdated: string;
  history: Array<{ time: string; value: number }>;
}

export interface CheckSheetSession {
  sessionId: string;
  machineId: string;
  machineName: string;
  lineId: string;
  lineName: string;
  shift: string;
  checkedAt: string;
  checkedBy: string;
  overallResult: 'OK' | 'WARNING' | 'NG';
  items: CheckSheetMetricItem[];
}
