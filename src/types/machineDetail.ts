/**
 * @file machineDetail.ts
 * @description Kiểu dữ liệu cho màn Chi tiết máy: tài liệu máy, check sheet đầu/cuối ca, dữ liệu Unipulse.
 */
export type MachineDocCategory = 'DRAWING' | 'PROGRAM' | 'OTHER';

export interface MachineDocument {
  id: string;
  machineId: string;
  category: MachineDocCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note?: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface CheckSheetItem {
  metricId: string;
  name: string;
  unit: string;
  value: number | null;
  min: number | null;
  max: number | null;
  result: 'OK' | 'NG';
}

export interface CheckSheetRecord {
  id: string;
  machineId: string;
  date: string;
  shift: number;
  checkType: 'START' | 'END';
  result: 'OK' | 'NG';
  items: CheckSheetItem[];
  note: string | null;
  checkedBy: string | null;
  checkedByName: string | null;
  createdAt: string;
}

export interface UnipulseData {
  simulated: boolean;
  machineId: string;
  source: string;
  fileName: string;
  importedAt: string | null;
  spec: { loadMin: number; loadMax: number; strokeMin: number; strokeMax: number };
  rows: Array<{ seq: number; time: string; loadKn: number; strokeMm: number; result: 'OK' | 'NG' }>;
  summary: { count: number; ng: number };
}
