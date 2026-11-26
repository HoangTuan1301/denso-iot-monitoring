/**
 * @file UnipulsePanel.tsx
 * @description Dữ liệu đo từ file CSV của thiết bị Unipulse: 4 ô tóm tắt (luôn hiện) + bảng 40 lần đo gần nhất
 * (thu gọn mặc định, bấm ▾ để xem).
 * Hiện dùng dữ liệu mô phỏng; cột sẽ chỉnh theo file CSV mẫu thật.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../services/api';
import type { UnipulseData } from '../../../types/machineDetail';
import { ExpandToggle } from './ExpandToggle';

const REFRESH_MS = 15_000;

export function UnipulsePanel({ machineId, className = '' }: { machineId: string; className?: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<UnipulseData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiClient
        .getUnipulseData(machineId, 40)
        .then((d) => alive && setData(d))
        .catch(() => {});
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [machineId]);

  if (!data) return <div className={`h-40 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse ${className}`} />;

  const okPct = data.summary.count ? ((data.summary.count - data.summary.ng) / data.summary.count) * 100 : 0;
  const tile = (label: string, value: string, tone: string) => (
    <div className={`rounded-xl border px-3 py-2 min-w-0 ${tone}`}>
      <div className="text-[11px] opacity-80 truncate">{label}</div>
      <strong className={`tabular-nums ${value.length > 12 ? 'text-xs sm:text-[13px]' : 'text-sm sm:text-base'}`}>{value}</strong>
    </div>
  );
  const th = 'sticky top-0 z-[1] bg-slate-50 dark:bg-slate-800 py-2 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700';

  return (
    <section className={`p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('machine.unipulse.title')}</h3>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {t('machine.unipulse.file', { file: data.fileName, time: data.importedAt })}
          </span>
          <ExpandToggle open={open} onToggle={() => setOpen((v) => !v)} controls={`unipulse-${machineId}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {tile(t('machine.unipulse.count'), String(data.summary.count), 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100')}
        {tile(t('machine.unipulse.okRate'), `${okPct.toFixed(1)}%`, 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300')}
        {tile('NG', t('machine.unipulse.times', { count: data.summary.ng }), 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300')}
        {tile(
          t('machine.unipulse.spec'),
          `${data.spec.loadMin}–${data.spec.loadMax} kN · ${data.spec.strokeMin}–${data.spec.strokeMax} mm`,
          'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100',
        )}
      </div>
      {open && (
      <>
      <div
        id={`unipulse-${machineId}`}
        tabIndex={0}
        aria-label={t('machine.unipulse.title')}
        className="h-[214px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 [scrollbar-width:thin]"
      >
        <table className="w-full table-fixed text-xs border-collapse">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[24%]" />
            <col className="w-[28%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} text-left`}>{t('machine.unipulse.time')}</th>
              <th className={`${th} text-right`}>{t('machine.unipulse.load')}</th>
              <th className={`${th} text-right`}>{t('machine.unipulse.stroke')}</th>
              <th className={`${th} text-center`}>{t('machine.unipulse.result')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const badLoad = r.loadKn < data.spec.loadMin || r.loadKn > data.spec.loadMax;
              const badStroke = r.strokeMm < data.spec.strokeMin || r.strokeMm > data.spec.strokeMax;
              return (
                <tr key={r.seq} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 px-3 font-mono text-slate-700 dark:text-slate-300">{r.time}</td>
                  <td className={`py-1.5 px-3 font-mono text-right tabular-nums ${badLoad ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-900 dark:text-white'}`}>
                    {r.loadKn.toFixed(2)}
                  </td>
                  <td className={`py-1.5 px-3 font-mono text-right tabular-nums ${badStroke ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-900 dark:text-white'}`}>
                    {r.strokeMm.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.result === 'OK' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                      {r.result}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {t('machine.unipulse.note')}
        {data.simulated && ` · ${t('lineView.simulated')}`}
      </p>
      </>
      )}
    </section>
  );
}
