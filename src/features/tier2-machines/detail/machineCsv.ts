/**
 * @file machineCsv.ts
 * @description Tải file CSV dữ liệu máy (demo).
 * File được sinh ngay lúc bấm theo ngày giờ hiện tại, đúng định dạng 2 file mẫu thực tế
 * (xem realCsv.ts). Lỗi bất ngờ → tạo nhanh check sheet từ thông số đang hiển thị.
 */
import { tr } from '../../../i18n/tr';
import { buildMachineCsv } from './realCsv';

interface MetricLike {
  name?: string;
  unit?: string;
  value?: number | null;
  warningMin?: number | null;
  warningMax?: number | null;
  criticalMin?: number | null;
  criticalMax?: number | null;
}

const q = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;

function fallbackCsv(machineId: string, metrics: MetricLike[]): string {
  const d = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const rows = [
    ['Machine', machineId, 'Date', d, 'Shift', ''].map(q).join(','),
    '',
    ['Parameter', 'Unit', 'Spec min', 'Spec max', 'Current', 'Start of shift', 'End of shift'].map(q).join(','),
    ...metrics.map((m) =>
      [m.name, m.unit, m.warningMin ?? m.criticalMin ?? '—', m.warningMax ?? m.criticalMax ?? '—', m.value ?? '', '', '']
        .map(q)
        .join(','),
    ),
  ];
  return '﻿' + rows.join('\r\n') + '\r\n';
}

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Tải CSV của máy: sinh tại thời điểm bấm, đúng định dạng file thực tế (Unipulse cho máy ép, KV log cho máy khác). */
export function downloadMachineCsv(
  machineId: string,
  machineCode: string | undefined,
  metrics: MetricLike[],
  machineName?: string
) {
  try {
    const f = buildMachineCsv({ id: machineId, code: machineCode, name: machineName, metrics });
    save(new Blob([f.content], { type: 'text/csv;charset=utf-8' }), f.fileName);
  } catch {
    const label = machineCode || machineId;
    save(new Blob([fallbackCsv(label, metrics)], { type: 'text/csv;charset=utf-8' }), `${label}_${tr('du-lieu-may')}.csv`);
  }
}
