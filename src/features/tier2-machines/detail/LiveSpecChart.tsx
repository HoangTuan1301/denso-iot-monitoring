/**
 * @file LiveSpecChart.tsx
 * @description Biểu đồ lớn cho 1 thông số trong Check sheet:
 *  giá trị hiện tại, vùng quy cách (xanh), giới hạn trên/dưới (đỏ đứt nét),
 *  đường 2 phút gần nhất cập nhật mỗi giây, chấm nháy ở điểm mới nhất,
 *  thống kê MIN / MAX / TB / Cpk.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type LiveMetric, fmtNum } from './useLiveMetrics';

const W = 600;
const H = 200;

export function LiveSpecChart({ metric: m, startValue }: { metric: LiveMetric; startValue?: number }) {
  const { t } = useTranslation();

  const g = useMemo(() => {
    const data = m.history.length ? m.history : [m.value];
    const lo = m.min ?? 0;
    const hi = m.max ?? Math.max(...data);
    const span = hi - lo || 1;
    // Trục dọc bám quanh khoảng quy cách để thấy rõ dao động
    let yMin = m.min === null || m.min === 0 ? 0 : lo - span * 0.35;
    let yMax = hi + span * 0.35;
    yMin = Math.min(yMin, ...data);
    yMax = Math.max(yMax, ...data);
    const Y = (v: number) => ((yMax - v) / (yMax - yMin)) * H;
    const n = data.length;
    const X = (i: number) => (n <= 1 ? W : (i / (n - 1)) * W);
    const line = data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const area = `${line} L${W},${H} L0,${H} Z`;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(data.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
    const cpk =
      sd > 0
        ? Math.min(m.max !== null ? (m.max - mean) / (3 * sd) : Infinity, m.min !== null && m.min !== 0 ? (mean - m.min) / (3 * sd) : Infinity)
        : null;
    return {
      line,
      area,
      bandTop: Y(hi),
      bandBottom: m.min === null ? H : Y(lo),
      yHi: Y(hi),
      yLo: m.min === null || m.min === 0 ? null : Y(lo),
      lastY: Y(data[n - 1]),
      ticks: [yMax, (yMax + yMin) / 2, yMin],
      stats: {
        min: Math.min(...data),
        max: Math.max(...data),
        mean,
        cpk: cpk !== null && Number.isFinite(cpk) ? cpk : null,
      },
    };
  }, [m]);

  const tone =
    m.status === 'ng'
      ? { border: 'border-rose-300 dark:border-rose-700', line: '#E11D48', fill: '#FFE4E6', value: 'text-rose-600 dark:text-rose-400' }
      : m.status === 'near'
        ? { border: 'border-amber-300 dark:border-amber-700', line: '#D97706', fill: '#FEF3C7', value: 'text-amber-700 dark:text-amber-400' }
        : { border: 'border-slate-200 dark:border-slate-700', line: '#2563EB', fill: '#DBEAFE', value: 'text-slate-900 dark:text-white' };
  const badge =
    m.status === 'ng'
      ? ['bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300', t('machine.cs.outSpec')]
      : m.status === 'near'
        ? ['bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', t('machine.cs.near')]
        : ['bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', t('machine.cs.inSpec')];

  const delta = startValue !== undefined && Number.isFinite(startValue) ? m.value - startValue : null;
  const dec = m.decimals;
  const specText = t('machine.cs.spec', { min: fmtNum(m.min, dec), max: fmtNum(m.max, dec) });

  return (
    <article className={`rounded-xl border ${tone.border} bg-white dark:bg-slate-900/40 p-3.5 flex flex-col gap-2 min-w-0`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={m.name}>
            {m.name}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {specText} {m.unit}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge[0]}`}>{badge[1]}</span>
      </div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        <strong className={`font-mono text-[28px] leading-none font-extrabold tabular-nums ${tone.value}`}>{fmtNum(m.value, dec)}</strong>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{m.unit}</span>
        {delta !== null && (
          <span className="ml-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
            {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : '−'}
            {fmtNum(Math.abs(delta), dec)} {t('machine.cs.vsStart')}
          </span>
        )}
      </div>

      {/* Vùng biểu đồ: SVG co giãn + nhãn trục bằng HTML để chữ không bị méo */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5">
        <div className="flex flex-col justify-between h-[150px] text-[10px] font-mono text-slate-400 text-right tabular-nums">
          {g.ticks.map((v, i) => (
            <span key={i}>{fmtNum(v, dec)}</span>
          ))}
        </div>
        <div className="relative h-[150px]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full rounded-md bg-slate-50 dark:bg-slate-800/50"
            role="img"
            aria-label={t('machine.cs.sparkAria', { name: m.name, min: fmtNum(m.min, dec), max: fmtNum(m.max, dec) })}
          >
            <rect x="0" y={g.bandTop} width={W} height={Math.max(0, g.bandBottom - g.bandTop)} fill="#10B981" opacity="0.14" />
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={W * f} x2={W * f} y1="0" y2={H} stroke="#94A3B8" strokeOpacity="0.25" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1="0" x2={W} y1={g.yHi} y2={g.yHi} stroke="#EF4444" strokeWidth="1.2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            {g.yLo !== null && (
              <line x1="0" x2={W} y1={g.yLo} y2={g.yLo} stroke="#EF4444" strokeWidth="1.2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            )}
            <path d={g.area} fill={tone.line} opacity="0.1" />
            <path d={g.line} fill="none" stroke={tone.line} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Điểm mới nhất (nháy) */}
          <span
            className="absolute right-0 h-3 w-3 -translate-y-1/2 translate-x-1/2"
            style={{ top: `${(g.lastY / H) * 100}%` }}
            aria-hidden="true"
          >
            <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: tone.line }} />
            <span className="absolute inset-[2px] rounded-full ring-2 ring-white dark:ring-slate-900" style={{ background: tone.line }} />
          </span>
        </div>
        <span />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>{t('machine.cs.ago2m')}</span>
          <span>{t('machine.cs.ago1m')}</span>
          <span>{t('machine.cs.now')}</span>
        </div>
      </div>

      <dl className="grid grid-cols-4 gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
        {[
          ['MIN', fmtNum(g.stats.min, dec)],
          ['MAX', fmtNum(g.stats.max, dec)],
          [t('machine.cs.avg'), fmtNum(g.stats.mean, dec)],
          ['Cpk', g.stats.cpk === null ? '—' : g.stats.cpk.toFixed(2)],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-[10px] font-bold tracking-wide text-slate-500 dark:text-slate-400">{k}</dt>
            <dd className={`font-mono text-xs font-bold tabular-nums ${k === 'Cpk' && g.stats.cpk !== null && g.stats.cpk < 1 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
