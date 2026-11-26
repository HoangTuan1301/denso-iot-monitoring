/**
 * @file UnipulsePanel.tsx
 * @description Dữ liệu đo từ file CSV của thiết bị Unipulse: 4 ô tóm tắt (luôn hiện) + bảng 40 lần đo gần nhất
 * (thu gọn mặc định, bấm ▾ để xem).
 * Hiện dùng dữ liệu mô phỏng; cột sẽ chỉnh theo file CSV mẫu thật.
 */
import { PRODUCTION_REFRESH_EVENT, isAutoRefreshOn } from '../../../utils/productionRefresh';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../services/api';
import type { UnipulseData } from '../../../types/machineDetail';
import { ExpandToggle } from './ExpandToggle';
import { UnipulseWaveModal } from './UnipulseWaveModal';
import { Activity } from 'lucide-react';

const REFRESH_MS = 15_000;

export function UnipulsePanel({ machineId, className = '' }: { machineId: string; className?: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<UnipulseData | null>(null);
  const [open, setOpen] = useState(false);
  const [wave, setWave] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiClient
        .getUnipulseData(machineId, 40)
        .then((d) => alive && setData(d))
        .catch(() => {});
    load();
    const id = window.setInterval(() => isAutoRefreshOn() && load(), REFRESH_MS);
    const onRefresh = () => load();
    window.addEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener(PRODUCTION_REFRESH_EVENT, onRefresh);
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
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('machine.unipulse.title')}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWave(0)}
              disabled={!data.rows.length}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" /> {t('machine.unipulse.wave.btn')}
            </button>
            <ExpandToggle open={open} onToggle={() => setOpen((v) => !v)} controls={`unipulse-${machineId}`} />
          </div>
        </div>
        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
          {t('machine.unipulse.file', { file: data.fileName, time: data.importedAt })}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.7fr] gap-2">
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
            <col className="w-[27%]" />
            <col className="w-[22%]" />
            <col className="w-[28%]" />
            <col className="w-[23%]" />
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
            {data.rows.map((r, i) => {
              const badLoad = r.loadKn < data.spec.loadMin || r.loadKn > data.spec.loadMax;
              const badStroke = r.strokeMm < data.spec.strokeMin || r.strokeMm > data.spec.strokeMax;
              return (
                <tr
                  key={r.seq}
                  onClick={() => setWave(i)}
                  title={t('machine.unipulse.wave.rowHint')}
                  className="border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/20"
                >
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
                    <Activity className="inline-block w-3.5 h-3.5 ml-1.5 text-blue-500 align-[-2px]" aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {t('machine.unipulse.note')}
      </p>
      </>
      )}
      {wave !== null && data.rows[wave] && (
        <UnipulseWaveModal data={data} index={wave} machineId={machineId} onClose={() => setWave(null)} onIndex={setWave} />
      )}
    </section>
  );
}
