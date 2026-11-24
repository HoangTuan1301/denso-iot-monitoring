/**
 * @file machineCsv.ts
 * @description Tải file CSV dữ liệu máy (demo).
 * Mỗi máy được cấp sẵn 1 file trong public/data/machine-csv/<machineId>.csv
 * (sinh bằng `node scripts/gen-machine-csv.mjs`). Nếu máy chưa có file,
 * tạo nhanh phần check sheet từ thông số đang hiển thị để nút luôn dùng được.
 */
import { tr } from '../../../i18n/tr';

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

/** Tải CSV của máy; thử theo id rồi theo mã máy, cuối cùng tạo từ thông số hiện tại. */
export async function downloadMachineCsv(machineId: string, machineCode: string | undefined, metrics: MetricLike[]) {
  const label = machineCode || machineId;
  const fileName = `${label}_${tr('du-lieu-may')}.csv`;
  for (const key of [machineId, machineCode].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`/data/machine-csv/${encodeURIComponent(key)}.csv`, { cache: 'no-cache' });
      const type = res.headers.get('content-type') || '';
      // Máy chủ tĩnh có thể trả index.html (200) cho đường dẫn không tồn tại
      if (res.ok && !type.includes('text/html')) {
        save(await res.blob(), fileName);
        return;
      }
    } catch {
      /* thử cách tiếp theo */
    }
  }
  save(new Blob([fallbackCsv(label, metrics)], { type: 'text/csv;charset=utf-8' }), fileName);
}
