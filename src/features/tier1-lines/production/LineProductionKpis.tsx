/**
 * @file LineProductionKpis.tsx
 * @description 4 thẻ KPI của Chi tiết dây chuyền theo góp ý mentor:
 * OEE (machine) · Thời gian dừng ngắn (チョコ停) · Thời gian dừng dài (ドカ停) · Sản lượng line.
 */
import { useTranslation } from 'react-i18next';
import type { LineShiftProduction } from '../../../types/production';
import { useCauseText } from '../../dashboard/production/useProduction';
import { OEE_CARD, OEE_TARGET, OeeProgress, OeeStatusPill, oeeLevel } from '../../dashboard/production/oeeTone';

const nf = (v: number) => v.toLocaleString('en-US');

export function LineProductionKpis({ data, loading }: { data: LineShiftProduction | null; loading: boolean }) {
  const { t } = useTranslation();
  const causeText = useCauseText();

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[118px] rounded-xl bg-slate-200/70 dark:bg-white/5" />)}
      </div>
    );
  }
  if (!data) return null;

  const notStarted = data.state === 'NOT_STARTED';
  const outPct = data.output.planSoFar > 0 ? Math.round((data.output.actual / data.output.planSoFar) * 1000) / 10 : 0;
  const longest = data.longStops.longest;
  const card = 'p-4 rounded-xl border shadow-xs flex flex-col justify-between h-[118px] min-w-0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* OEE – màu theo ngưỡng (góp ý mentor 26/11) */}
      <div className={`${card} ${OEE_CARD[notStarted ? 'none' : oeeLevel(data.oee.oee)].box}`}>
        <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300">
          <span className="truncate">{t('lineView.kpi.oee')}</span>
          {notStarted ? (
            <span className="shrink-0 text-slate-500">{t('lineView.kpi.oeeTarget', { target: OEE_TARGET })}</span>
          ) : (
            <OeeStatusPill value={data.oee.oee} />
          )}
        </span>
        <span className="flex items-baseline gap-2">
          <span className={`font-mono text-3xl font-extrabold leading-none ${OEE_CARD[notStarted ? 'none' : oeeLevel(data.oee.oee)].value}`}>
            {notStarted ? '—' : `${data.oee.oee}%`}
          </span>
          {!notStarted && <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('lineView.kpi.oeeTarget', { target: OEE_TARGET })}</span>}
        </span>
        {!notStarted && <OeeProgress value={data.oee.oee} />}
        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
          A {data.oee.availability}% · P {data.oee.performance}% · Q {data.oee.quality}%
        </span>
      </div>

      {/* Dừng ngắn */}
      <div className={`${card} bg-white dark:bg-factory-card border-slate-200/80 dark:border-slate-800`}>
        <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
          <span className="truncate">{t('lineView.kpi.shortStop')}</span>
          <span className="shrink-0 text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">チョコ停</span>
        </span>
        <span className="font-mono text-3xl font-extrabold leading-none text-amber-700 dark:text-amber-400">
          {t('lineView.kpi.minutes', { count: data.shortStops.minutes })}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {t('lineView.kpi.shortSub', { count: data.shortStops.count, threshold: data.settings.shortStopThresholdMin })}
        </span>
      </div>

      {/* Dừng dài */}
      <div className={`${card} bg-white dark:bg-factory-card ${data.longStops.minutes > 0 ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200/80 dark:border-slate-800'}`}>
        <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
          <span className="truncate">{t('lineView.kpi.longStop')}</span>
          <span className="shrink-0 text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.5 rounded">ドカ停</span>
        </span>
        <span className={`font-mono text-3xl font-extrabold leading-none ${data.longStops.minutes > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
          {t('lineView.kpi.minutes', { count: data.longStops.minutes })}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {longest
            ? `${t('lineView.kpi.longSub', { count: data.longStops.count })} · ${t('lineView.kpi.longest', { cause: causeText(longest.causeCode, longest.op, longest.cause), min: longest.durationMin })}`
            : t('lineView.kpi.noLong')}
        </span>
      </div>

      {/* Sản lượng */}
      <div className={`${card} bg-white dark:bg-factory-card border-slate-200/80 dark:border-slate-800`}>
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t('lineView.kpi.output')}</span>
        <span className="font-mono text-2xl font-extrabold leading-none text-slate-900 dark:text-white">
          {nf(data.output.actual)} <span className="text-sm font-semibold text-slate-500">/ {nf(data.output.planTotal)} pcs</span>
        </span>
        <div className="flex flex-col gap-1">
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (data.output.actual / data.output.planTotal) * 100)}%` }} />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {notStarted ? t('lineView.kpi.notStarted') : t('lineView.kpi.outputSub', { pct: outPct })}
          </span>
        </div>
      </div>
    </div>
  );
}
