/**
 * @file LineOutputMonitor.tsx
 * @description Giám sát sản lượng sản xuất của 1 dây chuyền trong 1 ca:
 *  - Dải 5 số liệu: Kế hoạch · Thực tế · Chênh lệch · Dự báo cuối ca · Takt/Cycle time
 *  - Biểu đồ lũy kế: kế hoạch (nét đứt) vs thực tế (vùng xanh) vs dự báo (chấm), vùng đỏ = dừng dài
 *  - Bảng sản lượng theo giờ có % đạt và ghi chú nguyên nhân
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LineShiftProduction } from '../../../types/production';
import { useCauseText } from '../../dashboard/production/useProduction';
import { minutesFromShiftStart } from './useLineProduction';

const nf = (v: number) => v.toLocaleString('en-US');

// Khung biểu đồ (đơn vị SVG)
const W = 700;
const H = 260;
const L = 52; // lề trái cho nhãn trục
const R = 690;
const TOP = 14;
const BOT = 222;

interface Props {
  data: LineShiftProduction | null;
  loading: boolean;
  shift: 1 | 2 | 3 | null;
  onChangeShift: (shift: 1 | 2 | 3) => void;
}

export function LineOutputMonitor({ data, loading, shift, onChangeShift }: Props) {
  const { t } = useTranslation();
  const causeText = useCauseText();

  const activeShift = shift ?? data?.shift ?? 1;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{t('lineView.output.title')}</h3>
        {data && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {t('lineView.output.subtitle', { shift: data.shift, date: data.date, time: data.updatedAt })}
            {data.simulated && <span className="ml-1.5">· {t('lineView.simulated')}</span>}
          </p>
        )}
      </div>
      <div role="group" aria-label="Shift" className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={activeShift === s}
            onClick={() => onChangeShift(s)}
            className={`min-h-[34px] px-3 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              activeShift === s
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t('lineView.output.shiftBtn', { shift: s })}
          </button>
        ))}
      </div>
    </div>
  );

  const shell = (children: ReactNode) => (
    <section className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs flex flex-col gap-4">
      {header}
      {children}
    </section>
  );

  if (loading && !data) return shell(<div className="h-[320px] rounded-lg bg-slate-100 dark:bg-white/5 animate-pulse" aria-busy="true" />);
  if (!data) return null;
  if (data.state === 'NOT_STARTED') {
    return shell(<p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">{t('lineView.output.notStarted')}</p>);
  }

  const startHour = Number(data.shiftLabel.slice(0, 2));
  const planTotal = data.output.planTotal;
  const maxQ = Math.max(planTotal, data.output.forecast) * 1.04;
  const X = (min: number) => L + (min / 480) * (R - L);
  const Y = (q: number) => BOT - (q / maxQ) * (BOT - TOP);

  // Điểm lũy kế thực tế theo từng mốc giờ đã chạy
  const pts: Array<[number, number]> = [[X(0), Y(0)]];
  let acc = 0;
  data.hourly.forEach((h, i) => {
    if (h.status === 'future' || h.actual === null) return;
    acc += h.actual;
    const endMin = h.status === 'running' ? data.elapsedMin : (i + 1) * 60;
    pts.push([X(endMin), Y(acc)]);
  });
  const nowX = X(data.elapsedMin);
  const nowY = Y(data.output.actual);
  const actualLine = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${X(0)},${BOT} ${actualLine} ${nowX.toFixed(1)},${BOT}`;
  const longBands = data.stops
    .filter((s) => s.type === 'LONG')
    .map((s) => {
      const m = minutesFromShiftStart(s.startedAt, startHour);
      return { x: X(m), w: Math.max(3, X(m + s.durationMin) - X(m)), s };
    });
  const gridQ = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((planTotal * f) / 100) * 100);
  const finished = data.state === 'FINISHED';
  const gap = data.output.actual - data.output.planSoFar;

  const stat = (label: string, value: ReactNode, tone = '', bg = '') => (
    <div className={`px-3.5 py-3 flex flex-col gap-1 min-w-0 ${bg}`}>
      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{label}</span>
      <strong className={`font-mono text-xl leading-none ${tone || 'text-slate-900 dark:text-white'}`}>{value}</strong>
    </div>
  );

  return shell(
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-x divide-y md:divide-y-0 divide-slate-200 dark:divide-slate-700">
        {stat(t('lineView.output.plan'), nf(planTotal))}
        {stat(t('lineView.output.actual', { time: data.updatedAt }), nf(data.output.actual), 'text-emerald-700 dark:text-emerald-400')}
        {stat(t('lineView.output.gap'), `${gap >= 0 ? '+' : '−'}${nf(Math.abs(gap))}`, gap >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}
        {stat(
          finished ? t('lineView.output.finished') : t('lineView.output.forecast'),
          <>
            {nf(data.output.forecast)} <span className="text-xs">({data.output.forecastPct}%)</span>
          </>,
          'text-amber-700 dark:text-amber-400',
          'bg-amber-50/70 dark:bg-amber-950/20'
        )}
        {stat(t('lineView.output.takt'), (
          <>
            {data.taktSec}s <span className={`text-sm ${data.cycleSec > data.taktSec ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>/ {data.cycleSec}s</span>
          </>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-5">
        {/* Biểu đồ lũy kế */}
        <div className="flex-[3] min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-slate-500" />{t('lineView.output.legendPlan')}</span>
            <span className="flex items-center gap-1.5"><span className="w-5 h-2.5 bg-emerald-200 dark:bg-emerald-900 border-t-2 border-emerald-700" />{t('lineView.output.legendActual')}</span>
            {!finished && <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted border-amber-600" />{t('lineView.output.legendForecast')}</span>}
            <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 bg-rose-100 dark:bg-rose-950" />{t('lineView.output.legendLong')}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('lineView.output.chartAria')} className="w-full h-auto">
            {longBands.map((b) => (
              <g key={b.s.id}>
                <rect x={b.x} y={TOP} width={b.w} height={BOT - TOP} className="fill-rose-100 dark:fill-rose-950/60" />
                <text x={b.x + b.w / 2} y={TOP + 12} fontSize="10" textAnchor="middle" className="fill-rose-700 dark:fill-rose-400" fontWeight="700">
                  {`${b.s.durationMin}'`}
                </text>
                <text x={b.x + b.w / 2} y={TOP + 24} fontSize="9" textAnchor="middle" className="fill-rose-700 dark:fill-rose-400">
                  {causeText(b.s.causeCode, b.s.op, b.s.cause)}
                </text>
              </g>
            ))}
            {gridQ.map((q) => (
              <g key={q}>
                <line x1={L} y1={Y(q)} x2={R} y2={Y(q)} className="stroke-slate-200 dark:stroke-slate-700" />
                <text x={L - 6} y={Y(q) + 3} fontSize="10" textAnchor="end" className="fill-slate-500">{nf(q)}</text>
              </g>
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <text key={i} x={X(i * 60)} y={BOT + 16} fontSize="10" textAnchor="middle" className="fill-slate-500">
                {`${String((startHour + i) % 24).padStart(2, '0')}:00`}
              </text>
            ))}
            <polygon points={area} className="fill-emerald-200/70 dark:fill-emerald-900/50" />
            <line x1={X(0)} y1={Y(0)} x2={X(480)} y2={Y(planTotal)} strokeDasharray="6 5" strokeWidth="2" className="stroke-slate-500" />
            <polyline points={actualLine} fill="none" strokeWidth="2.5" className="stroke-emerald-700 dark:stroke-emerald-400" />
            {!finished && (
              <line x1={nowX} y1={nowY} x2={X(480)} y2={Y(data.output.forecast)} strokeDasharray="2 4" strokeWidth="2.5" className="stroke-amber-600" />
            )}
            {!finished && <line x1={nowX} y1={TOP} x2={nowX} y2={BOT} strokeWidth="1" className="stroke-slate-900 dark:stroke-slate-200" />}
            <circle cx={nowX} cy={nowY} r="4" className="fill-emerald-700 dark:fill-emerald-400" />
            <text x={nowX - 6} y={nowY - 8} fontSize="11" textAnchor="end" fontWeight="700" className="fill-emerald-800 dark:fill-emerald-300">
              {nf(data.output.actual)}
            </text>
            <text x={R} y={Y(planTotal) - 6} fontSize="10" textAnchor="end" className="fill-slate-600 dark:fill-slate-400">
              {`${t('lineView.output.planCol')} ${nf(planTotal)}`}
            </text>
          </svg>
        </div>

        {/* Bảng theo giờ */}
        <div className="flex-[2] min-w-0 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <caption className="text-left text-xs font-extrabold text-slate-900 dark:text-white pb-2">{t('lineView.output.hourlyTitle')}</caption>
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700">{t('lineView.output.hour')}</th>
                <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('lineView.output.planCol')}</th>
                <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('lineView.output.actualCol')}</th>
                <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('lineView.output.pctCol')}</th>
                <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700">{t('lineView.output.noteCol')}</th>
              </tr>
            </thead>
            <tbody>
              {data.hourly.map((h) => {
                const plan = h.status === 'running' ? h.planSoFar : h.plan;
                const pct = h.actual !== null && plan > 0 ? Math.round((h.actual / plan) * 100) : null;
                const tone =
                  pct === null ? '' : pct >= 97 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : pct >= 90 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
                const note = h.longStop
                  ? t('lineView.output.longNote', { cause: causeText(h.longStop.causeCode), op: h.longStop.op, min: h.longStop.durationMin })
                  : h.status === 'running'
                    ? t('lineView.output.running')
                    : h.shortStopCount >= 3
                      ? t('lineView.output.shortNote', { count: h.shortStopCount })
                      : '';
                const end = `${String((Number(h.hour.slice(0, 2)) + 1) % 24).padStart(2, '0')}`;
                return (
                  <tr key={h.hour} className={h.longStop ? 'bg-rose-50 dark:bg-rose-950/20' : h.status === 'running' ? 'bg-slate-50 dark:bg-white/5' : ''}>
                    <td className="py-1.5 px-1.5 border-b border-slate-100 dark:border-slate-800 font-mono">{h.hour.slice(0, 2)}–{end}</td>
                    <td className="py-1.5 px-1.5 border-b border-slate-100 dark:border-slate-800 text-right font-mono text-slate-500">{nf(plan)}</td>
                    <td className="py-1.5 px-1.5 border-b border-slate-100 dark:border-slate-800 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {h.actual === null ? t('lineView.output.future') : nf(h.actual)}
                    </td>
                    <td className="py-1.5 px-1.5 border-b border-slate-100 dark:border-slate-800 text-right">
                      {pct !== null && <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${tone}`}>{pct}%</span>}
                    </td>
                    <td className="py-1.5 px-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">{note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
