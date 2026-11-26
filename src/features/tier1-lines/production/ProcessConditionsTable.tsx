/**
 * @file ProcessConditionsTable.tsx
 * @description Bảng theo dõi điều kiện gia công của 1 line trong N ngày (mặc định 30):
 * mỗi dòng 1 điều kiện kèm quy cách, mỗi cột 1 ngày ghi giá trị trung bình;
 * ô đỏ = ngoài quy cách (NG), cột Chủ nhật = nghỉ; cuối dòng đếm số lần NG. Có Xuất Excel (CSV).
 * Góp ý mentor 26/11: đánh dấu cột HÔM NAY; NG hôm nay → băng cảnh báo + khóa máy đến khi
 * "Xử lý & đo lại"; các ngày đã qua luôn đạt; ngày chưa tới tô xám "Chưa đo".
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
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
  const today = data?.today ?? '';
  const fixKey = data ? `kailink-pc-fix|${data.lineId}|${today}` : '';
  const [fixedAt, setFixedAt] = useState<string | null>(null);
  useEffect(() => {
    try {
      setFixedAt(fixKey ? localStorage.getItem(fixKey) : null);
    } catch {
      setFixedAt(null);
    }
  }, [fixKey]);

  // Sau khi "Xử lý & đo lại": giá trị hôm nay được đo lại về giá trị chuẩn (đạt quy cách)
  const view = useMemo(() => {
    if (!data) return null;
    const conditions = data.conditions.map((c) => {
      const values = c.values.map((v) =>
        fixedAt && v.date === today && v.status === 'NG'
          ? { ...v, value: Number((c.nominal ?? (c.specMin + c.specMax) / 2).toFixed(c.decimals)), status: 'OK' as const }
          : v
      );
      return { ...c, values, ngCount: values.filter((v) => v.status === 'NG').length };
    });
    const todayNg = conditions.flatMap((c) => c.values.filter((v) => v.date === today && v.status === 'NG').map((v) => ({ c, v })));
    const wasNgToday = data.conditions.some((c) => c.values.some((v) => v.date === today && v.status === 'NG'));
    const checked = conditions.reduce((a, c) => a + c.values.filter((v) => v.status === 'OK' || v.status === 'NG').length, 0);
    const ng = conditions.reduce((a, c) => a + c.ngCount, 0);
    const passRate = checked ? Math.round(((checked - ng) / checked) * 1000) / 10 : null;
    return { conditions, todayNg, wasNgToday, passRate };
  }, [data, fixedAt, today]);

  const markFixed = () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    try {
      localStorage.setItem(fixKey, time);
    } catch {
      /* bỏ qua khi trình duyệt chặn lưu */
    }
    setFixedAt(time);
  };
  const undoFix = () => {
    try {
      localStorage.removeItem(fixKey);
    } catch {
      /* bỏ qua */
    }
    setFixedAt(null);
  };

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
  if (!data || !view) return null;

  const exportCsv = () => {
    const head = ['Condition', 'Unit', 'Spec min', 'Spec max', ...data.dates.map((d) => d.date), 'NG'];
    const rows = view.conditions.map((c) => [
      paramName(c.key, c.name),
      c.unit,
      String(c.specMin),
      String(c.specMax),
      ...c.values.map((v) => (v.status === 'FUTURE' ? '' : v.status === 'OFF' || v.value === null ? 'OFF' : `${v.value.toFixed(c.decimals)}${v.status === 'NG' ? ' (NG)' : ''}`)),
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
          {view.passRate !== null && (
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1.5 rounded-full">
              {t('lineView.cond.passRate', { pct: view.passRate })}
            </span>
          )}
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${view.todayNg.length > 0 ? 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40' : 'text-slate-600 bg-slate-100 dark:bg-slate-800'}`}>
            {t('lineView.cond.ngToday', { count: view.todayNg.length })}
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

      {view.todayNg.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-3">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-rose-600 text-white flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-[240px]">
            <p className="text-sm font-extrabold text-rose-800 dark:text-rose-300">
              {t('lineView.cond.lockTitle', { date: fmtDay(today), count: view.todayNg.length })}
            </p>
            <p className="text-xs text-rose-900/80 dark:text-rose-200/80 mt-0.5">
              {t('lineView.cond.lockDetail', {
                items: view.todayNg
                  .map(({ c, v }) => `${paramName(c.key, c.name)} ${v.value?.toFixed(c.decimals)} ${c.unit} (${c.specMin} – ${c.specMax})`)
                  .join(' · '),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={markFixed}
            className="min-h-[38px] px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5"
          >
            <AlertTriangle className="w-4 h-4" /> {t('lineView.cond.fixBtn')}
          </button>
        </div>
      )}
      {fixedAt && view.wasNgToday && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="flex-1 text-sm font-bold text-emerald-800 dark:text-emerald-300">{t('lineView.cond.fixedTitle', { time: fixedAt })}</p>
          <button type="button" onClick={undoFix} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">
            {t('lineView.cond.undo')}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <div role="table" className="grid min-w-[1060px]" style={{ gridTemplateColumns: cols }}>
          {/* Hàng tiêu đề ngày */}
          <div role="columnheader" className="sticky left-0 z-10 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
            {t('lineView.cond.param')}
          </div>
          {data.dates.map((d) => {
            const sun = d.weekday === 0;
            const isToday = d.date === today;
            const [, m, day] = d.date.split('-');
            return (
              <div
                key={d.date}
                role="columnheader"
                aria-current={isToday ? 'date' : undefined}
                className={`py-1.5 flex flex-col items-center border-b border-l ${
                  isToday
                    ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-500 border-x-2 border-t-2'
                    : `border-slate-200 dark:border-slate-700 ${sun ? 'bg-slate-100 dark:bg-slate-800/80' : 'bg-slate-50 dark:bg-slate-800'}`
                }`}
              >
                <span className={`text-[9px] ${isToday ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-500'}`}>{sun ? t('lineView.cond.sun') : t('lineView.cond.month', { m: Number(m) })}</span>
                <span className={`text-[11px] font-bold ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>{Number(day)}</span>
                {isToday && <span className="text-[8px] font-extrabold uppercase text-blue-700 dark:text-blue-300 leading-none mt-0.5">{t('lineView.cond.today')}</span>}
              </div>
            );
          })}
          <div role="columnheader" className="py-2 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border-b border-l border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
            {t('lineView.cond.ng')}
          </div>

          {/* Các dòng điều kiện */}
          {view.conditions.map((c) => (
            <div key={c.key} role="row" className="contents">
              <div role="rowheader" className="sticky left-0 z-10 px-3 py-2 bg-white dark:bg-factory-card border-b border-slate-100 dark:border-slate-800 flex flex-col">
                <strong className="text-xs text-slate-900 dark:text-white">{paramName(c.key, c.name)}</strong>
                <span className="font-mono text-[10px] text-slate-500">{c.specMin} – {c.specMax} {c.unit}</span>
              </div>
              {c.values.map((v) => {
                const isToday = v.date === today;
                return (
                  <div
                    key={v.date}
                    role="cell"
                    title={`${v.date}: ${v.status === 'FUTURE' ? t('lineView.cond.future') : v.status === 'OFF' ? 'OFF' : `${v.value} ${c.unit} (${v.status})`}`}
                    className={`flex items-center justify-center border-b border-l font-mono text-[10px] ${
                      isToday ? 'border-x-2 border-x-blue-500 border-b-slate-100 dark:border-b-slate-800' : 'border-slate-100 dark:border-slate-800'
                    } ${
                      v.status === 'FUTURE'
                        ? 'kl-hatch'
                        : v.status === 'OFF'
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400'
                          : v.status === 'NG'
                            ? 'bg-rose-600 text-white font-bold'
                            : isToday
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-slate-900 dark:text-white font-bold'
                              : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {v.status === 'FUTURE' ? '' : v.status === 'OFF' || v.value === null ? '–' : v.value.toFixed(c.decimals)}
                  </div>
                );
              })}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-blue-500 bg-blue-100" />{t('lineView.cond.legendToday')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-600" />{t('lineView.cond.legendNg')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-slate-300 bg-white" />{t('lineView.cond.legendOk')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm kl-hatch border border-slate-300" />{t('lineView.cond.legendFuture')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="px-1 rounded-sm bg-slate-100 dark:bg-slate-800 text-[10px]">{t('lineView.cond.sun')}</span>{t('lineView.cond.legendOff')}</span>
      </div>
    </section>
  );
}

function fmtDay(iso: string) {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
}
