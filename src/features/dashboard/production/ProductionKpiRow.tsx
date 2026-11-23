/**
 * @file ProductionKpiRow.tsx
 * @description Hàng thẻ KPI Dashboard tổng quan theo góp ý mentor:
 * OEE nhà máy · Tổng số dây chuyền · Tổng số máy · Trạng thái máy (Running / Alarm-Stop) · Offline / No data.
 */
import { useTranslation } from 'react-i18next';
import { Factory, Monitor, Activity, WifiOff, Gauge } from 'lucide-react';
import type { FactoryProductionOverview } from '../../../types/production';

const OEE_TARGET = 85;

function fmt(v: number | null | undefined, d = 1) {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(d);
}

export function ProductionKpiRow({ data, loading }: { data: FactoryProductionOverview | null; loading: boolean }) {
  const { t } = useTranslation();

  if (loading && !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5 animate-pulse" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-[118px] rounded-xl bg-slate-200/70 dark:bg-white/5 ${i === 0 ? 'col-span-2' : ''}`} />
        ))}
      </div>
    );
  }

  const oee = data?.oee.oee ?? null;
  const oeeOk = oee !== null && oee >= OEE_TARGET;
  const m = data?.machines;
  const online = m ? m.running + m.alarmStop : 0;

  const card =
    'bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[118px]';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
      {/* OEE nhà máy */}
      <div className="col-span-2 rounded-xl p-4 h-[118px] bg-slate-900 dark:bg-slate-950 text-white border border-slate-800 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[11px] font-bold tracking-wide text-slate-300 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" /> {t('dashboard.kpi.factoryOee')}
          </span>
          <span className="font-mono text-4xl font-extrabold leading-none">
            {fmt(oee)}
            <span className="text-xl">%</span>
          </span>
          <span className={`text-[11px] font-semibold ${oeeOk ? 'text-emerald-300' : 'text-amber-300'}`}>
            {t('dashboard.kpi.oeeTarget', { target: OEE_TARGET })}
            {data?.shift ? ` · ${t('dashboard.kpi.shift', { shift: data.shift.shift, label: data.shift.label })}` : ''}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 font-mono text-[11px] text-slate-200 shrink-0">
          <span>A · {fmt(data?.oee.availability)}%</span>
          <span>P · {fmt(data?.oee.performance)}%</span>
          <span>Q · {fmt(data?.oee.quality)}%</span>
        </div>
      </div>

      {/* Tổng số dây chuyền */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t('dashboard.kpi.totalLines')}</span>
          <Factory className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none">{data?.lines.total ?? '—'}</div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('dashboard.kpi.linesProducing', { count: data?.lines.producing ?? 0 })}
        </span>
      </div>

      {/* Tổng số máy */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t('dashboard.kpi.totalMachines')}</span>
          <Monitor className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none">{m?.total ?? '—'}</div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t('dashboard.kpi.machinesConnected', { online, total: m?.total ?? 0 })}
        </span>
      </div>

      {/* Trạng thái máy */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t('dashboard.kpi.machineStatus')}</span>
          <Activity className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {t('dashboard.kpi.running')}
            </span>
            <strong className="font-mono text-base text-slate-900 dark:text-white">{m?.running ?? '—'}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {t('dashboard.kpi.alarmStop')}
            </span>
            <strong className="font-mono text-base text-rose-600 dark:text-rose-400">{m?.alarmStop ?? '—'}</strong>
          </div>
        </div>
      </div>

      {/* Offline / No data */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{t('dashboard.kpi.offline')}</span>
          <WifiOff className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-3xl font-extrabold text-slate-600 dark:text-slate-300 font-mono leading-none">{m?.offline ?? '—'}</div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('dashboard.kpi.offlineHint')}</span>
      </div>
    </div>
  );
}
