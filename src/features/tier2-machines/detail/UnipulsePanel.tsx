/**
 * @file UnipulsePanel.tsx
 * @description Bảng dữ liệu đo từ file CSV của thiết bị Unipulse (tải ép, hành trình, kết quả OK/NG).
 * Hiện dùng dữ liệu mô phỏng; cột sẽ chỉnh theo file CSV mẫu thật.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../services/api';
import type { UnipulseData } from '../../../types/machineDetail';

const REFRESH_MS = 15_000;

export function UnipulsePanel({ machineId }: { machineId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<UnipulseData | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiClient
        .getUnipulseData(machineId, 6)
        .then((d) => alive && setData(d))
        .catch(() => {});
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [machineId]);

  if (!data) return <div className="h-40 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{t('machine.unipulse.title')}</h4>
        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
          {t('machine.unipulse.file', { file: data.fileName, time: data.importedAt })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-[11px] text-slate-500 dark:text-slate-400">
              <th className="py-1.5 px-1.5 font-bold">{t('machine.unipulse.time')}</th>
              <th className="py-1.5 px-1.5 font-bold text-right">{t('machine.unipulse.load')}</th>
              <th className="py-1.5 px-1.5 font-bold text-right">{t('machine.unipulse.stroke')}</th>
              <th className="py-1.5 px-1.5 font-bold text-center">{t('machine.unipulse.result')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.seq} className="border-t border-slate-200/70 dark:border-slate-700/70">
                <td className="py-1.5 px-1.5 font-mono text-slate-700 dark:text-slate-300">{r.time}</td>
                <td className={`py-1.5 px-1.5 font-mono text-right ${r.loadKn < data.spec.loadMin || r.loadKn > data.spec.loadMax ? 'text-rose-600 font-bold' : 'text-slate-900 dark:text-white'}`}>
                  {r.loadKn.toFixed(2)}
                </td>
                <td className="py-1.5 px-1.5 font-mono text-right text-slate-900 dark:text-white">{r.strokeMm.toFixed(2)}</td>
                <td className="py-1.5 px-1.5 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.result === 'OK' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                    {r.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {t('machine.unipulse.ng', { count: data.summary.ng, total: data.summary.count })} · {t('machine.unipulse.note')}
        {data.simulated && ` · ${t('lineView.simulated')}`}
      </p>
    </div>
  );
}
