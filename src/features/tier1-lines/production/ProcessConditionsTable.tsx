/**
 * @file ProcessConditionsTable.tsx
 * @description Bảng theo dõi điều kiện gia công của 1 line trong N ngày (mặc định 30):
 * mỗi dòng 1 điều kiện kèm quy cách, mỗi cột 1 ngày ghi giá trị trung bình;
 * ô đỏ = ngoài quy cách (NG), cột Chủ nhật = nghỉ; cuối dòng đếm số lần NG. Có Xuất Excel (CSV).
 */
import { useTranslation } from 'react-i18next';
import type { ProcessConditionsResponse } from '../../../types/production';

interface Props {
  data: ProcessConditionsResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ProcessConditionsTable({ data, loading, error, onRetry }: Props) {
  const { t } = useTranslation();
  const paramName = (key: string, fallback: string) => t(`lineView.cond.param_${key}`, { defaultValue: fallback });

  if (loading && !data) {
    return <div className="h-[260px] rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" aria-busy="true" />;
  }
  if (error && !data) {
    return (
      <section className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 text-sm">
        <p className="text-rose-600 font-semibold">{t('lineView.error')}</p>
        <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">{t('lineView.retry')}</button>
      </section>
    );
  }
  if (!data) return null;

  const exportCsv = () => {
    const head = ['Condition', 'Unit', 'Spec min', 'Spec max', ...data.dates.map((d) => d.date), 'NG'];
    const rows = data.conditions.map((c) => [
      paramName(c.key, c.name),
      c.unit,
      String(c.specMin),
      String(c.specMax),
      ...c.values.map((v) => (v.status === 'OFF' || v.value === null ? 'OFF' : `${v.value.toFixed(c.decimals)}${v.status === 'NG' ? ' (NG)' : ''}`)),
      String(c.ngCount),
    ]);
    const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `process-conditions_${data.lineCode}_${data.days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cols = `160px repeat(${data.dates.length}, minmax(28px, 1fr)) 44px`;

  return (
    <section className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{t('lineView.cond.title', { days: data.days })}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {t('lineView.cond.subtitle')}
            {data.simulated && <span className="ml-1.5">· {t('lineView.simulated')}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.summary.passRate !== null && (
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1.5 rounded-full">
              {t('lineView.cond.passRate', { pct: data.summary.passRate })}
            </span>
          )}
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${data.summary.ng > 0 ? 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40' : 'text-slate-600 bg-slate-100 dark:bg-slate-800'}`}>
            {t('lineView.cond.ngCount', { count: data.summary.ng })}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            className="min-h-[34px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {t('lineView.cond.export')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <div role="table" className="grid min-w-[1060px]" style={{ gridTemplateColumns: cols }}>
          {/* Hàng tiêu đề ngày */}
          <div role="columnheader" className="sticky left-0 z-10 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
            {t('lineView.cond.param')}
          </div>
          {data.dates.map((d) => {
            const sun = d.weekday === 0;
            const [, m, day] = d.date.split('-');
            return (
              <div
                key={d.date}
                role="columnheader"
                className={`py-1.5 flex flex-col items-center border-b border-l border-slate-200 dark:border-slate-700 ${sun ? 'bg-slate-100 dark:bg-slate-800/80' : 'bg-slate-50 dark:bg-slate-800'}`}
              >
                <span className="text-[9px] text-slate-500">{sun ? t('lineView.cond.sun') : t('lineView.cond.month', { m: Number(m) })}</span>
                <span className="text-[11px] font-bold text-slate-900 dark:text-white">{Number(day)}</span>
              </div>
            );
          })}
          <div role="columnheader" className="py-2 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border-b border-l border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
            {t('lineView.cond.ng')}
          </div>

          {/* Các dòng điều kiện */}
          {data.conditions.map((c) => (
            <div key={c.key} role="row" className="contents">
              <div role="rowheader" className="sticky left-0 z-10 px-3 py-2 bg-white dark:bg-factory-card border-b border-slate-100 dark:border-slate-800 flex flex-col">
                <strong className="text-xs text-slate-900 dark:text-white">{paramName(c.key, c.name)}</strong>
                <span className="font-mono text-[10px] text-slate-500">{c.specMin} – {c.specMax} {c.unit}</span>
              </div>
              {c.values.map((v) => (
                <div
                  key={v.date}
                  role="cell"
                  title={`${v.date}: ${v.status === 'OFF' ? 'OFF' : `${v.value} ${c.unit} (${v.status})`}`}
                  className={`flex items-center justify-center border-b border-l border-slate-100 dark:border-slate-800 font-mono text-[10px] ${
                    v.status === 'OFF'
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400'
                      : v.status === 'NG'
                        ? 'bg-rose-600 text-white font-bold'
                        : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {v.status === 'OFF' || v.value === null ? '–' : v.value.toFixed(c.decimals)}
                </div>
              ))}
              <div
                role="cell"
                className={`flex items-center justify-center border-b border-l border-slate-200 dark:border-slate-700 font-mono text-xs font-extrabold ${
                  c.ngCount > 0 ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30' : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {c.ngCount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
