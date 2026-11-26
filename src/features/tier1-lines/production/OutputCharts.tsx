/**
 * @file OutputCharts.tsx
 * @description Các biểu đồ SVG của "Giám sát sản lượng sản xuất" (theo góp ý mentor):
 *  - OutputBarChart: cột Kế hoạch / Thực tế + đường lũy kế (trục phải) + đường mục tiêu
 *  - VarianceStrip:  dải chênh lệch thực tế so với kế hoạch, ngay dưới biểu đồ cột
 *  - NgChart:        đường số hàng lỗi NG + ngưỡng
 * Dùng chung cho chế độ xem theo giờ (1 ca) và theo ngày (tuần / tháng).
 */
import { useId } from 'react';
import { tr } from '../../../i18n/tr';

export const nf = (v: number) => Math.round(v).toLocaleString('en-US');

export type SlotStatus = 'done' | 'running' | 'future';

export interface OutputSlot {
  label: string;
  /** Kế hoạch đầy đủ của ô (giờ / ngày) */
  plan: number;
  /** Kế hoạch để so sánh: = plan nếu đã xong, = kế hoạch tới hiện tại nếu đang chạy */
  planCompare: number;
  actual: number | null;
  ng: number | null;
  status: SlotStatus;
  /** Ô đang chạy: tỉ lệ thời gian đã trôi qua (0–1) */
  frac?: number;
  /** Kế hoạch của ô đã được sửa tay */
  planEdited?: boolean;
}

export interface SlotGroup {
  label: string;
  start: number;
  end: number;
  /** Chữ phụ trên nhãn nhóm (VD "96.0%" hoặc "NG 412") */
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'ng';
}

/** Tông màu theo tỉ lệ đạt so với mục tiêu: đạt / sát mục tiêu (≤ 5 điểm) / thấp */
export function toneOf(actual: number, planCompare: number, targetPct: number): 'good' | 'warn' | 'bad' {
  if (planCompare <= 0) return 'good';
  const pct = (actual / planCompare) * 100;
  return pct >= targetPct ? 'good' : pct >= targetPct - 5 ? 'warn' : 'bad';
}

const TONE_FILL = {
  good: 'fill-emerald-600 dark:fill-emerald-400',
  warn: 'fill-amber-500 dark:fill-amber-400',
  bad: 'fill-rose-600 dark:fill-rose-400',
  ng: 'fill-rose-600 dark:fill-rose-300',
} as const;

function niceStep(max: number, n = 4) {
  const raw = max / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const st = m * mag;
    if (st >= raw && st % 1 === 0) return st;
  }
  return Math.ceil(raw);
}

const short = (v: number) => (v >= 1000 ? `${Math.round((v / 1000) * 10) / 10}k` : String(Math.round(v)));

/** Đường dẫn cột bo góc trên */
function topBar(x: number, y: number, w: number, h: number, r = 3) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function GroupBands({ groups, L, slot, T, B }: { groups: SlotGroup[]; L: number; slot: number; T: number; B: number }) {
  return (
    <>
      {groups.map((g, gi) => {
        const x0 = L + g.start * slot;
        const x1 = L + (g.end + 1) * slot;
        const cx = (x0 + x1) / 2;
        const text = `${g.label} ${g.value}`;
        const w = text.length * 6.4 + 18;
        return (
          <g key={g.label + gi}>
            {gi % 2 === 0 && (
              <rect x={x0} y={T - 28} width={x1 - x0} height={B - T + 28} rx={8} className="fill-slate-900/[0.035] dark:fill-white/[0.03]" />
            )}
            <rect x={cx - w / 2} y={T - 24} width={w} height={20} rx={10} className="fill-white dark:fill-factory-surface stroke-slate-200 dark:stroke-factory-border" />
            <text x={cx} y={T - 10} fontSize={11} textAnchor="middle" fontWeight={800} className="fill-slate-900 dark:fill-slate-100">
              {g.label}{' '}
              <tspan className={`font-mono ${TONE_FILL[g.tone]}`}>{g.value}</tspan>
            </text>
          </g>
        );
      })}
    </>
  );
}

interface BarProps {
  slots: OutputSlot[];
  targetPct: number;
  groups?: SlotGroup[];
  width: number;
  height: number;
  showValues?: boolean;
  ariaLabel: string;
  /** Bấm vào cột kế hoạch (chế độ ca) để sửa; không truyền = không cho sửa */
  onPlanClick?: (index: number) => void;
  /** Kế hoạch hiện đủ ngay từ đầu cho cả giờ đang chạy / giờ tới (không "tự nhảy") */
  fullPlan?: boolean;
}

export function OutputBarChart({ slots, targetPct, groups, width: W, height: H, showValues = true, ariaLabel, onPlanClick, fullPlan = false }: BarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const L = 50;
  const R = W - 62;
  const T = groups ? 44 : 20;
  const B = H - 26;
  const n = Math.max(1, slots.length);
  const slot = (R - L) / n;
  const bw = Math.min(20, slot * 0.32);
  const maxPlan = Math.max(1, ...slots.map((s) => s.plan), ...slots.map((s) => s.actual ?? 0));
  const ymax = maxPlan * 1.18;
  const Y = (v: number) => B - (v / ymax) * (B - T);
  const step = niceStep(ymax);
  const ticks: number[] = [];
  for (let v = 0; v <= ymax; v += step) ticks.push(v);

  // Lũy kế (trục phải)
  const cumPlan: number[] = [];
  slots.reduce((acc, s, i) => (cumPlan[i] = acc + s.plan), 0);
  const totalPlan = cumPlan[cumPlan.length - 1] || 1;
  const cmax = totalPlan * 1.08;
  const CY = (v: number) => B - (v / cmax) * (B - T);
  const cstep = niceStep(cmax);
  const cticks: number[] = [];
  for (let v = 0; v <= cmax; v += cstep) cticks.push(v);

  const actPts: Array<[number, number]> = [[L, B]];
  let accA = 0;
  let accP = 0;
  slots.forEach((s, i) => {
    if (s.actual === null || s.status === 'future') return;
    accA += s.actual;
    accP += s.planCompare;
    const x = s.status === 'running' ? L + slot * (i + Math.max(0.05, Math.min(1, s.frac ?? 0.5))) : L + slot * (i + 1);
    actPts.push([x, CY(accA)]);
  });
  const planLine = `${L},${B} ` + cumPlan.map((v, i) => `${(L + slot * (i + 1)).toFixed(1)},${CY(v).toFixed(1)}`).join(' ');
  const actLine = actPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = actPts[actPts.length - 1];
  const diff = accA - accP;
  const t1 = `${tr('LK thực tế')} ${nf(accA)}`;
  const t2 = `${tr('LK KH')} ${nf(accP)} (${diff >= 0 ? '+' : '−'}${nf(Math.abs(diff))})`;
  const boxW = Math.max(t1.length * 6.6, t2.length * 6.2) + 18;
  const boxX = last[0] - boxW - 10 > L ? last[0] - boxW - 10 : last[0] + 10;
  const boxY = Math.max(T, Math.min(B - 40, last[1] - 6));
  const targetLabel = `${tr('Mục tiêu')} ${targetPct}%`;
  const runIdx = slots.findIndex((s) => s.status === 'running');
  const yTarget = Y((slots.find((s) => s.plan > 0)?.plan ?? 0) * (targetPct / 100));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="w-full h-auto block">
      <defs>
        <linearGradient id={`gp${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B82F6" stopOpacity="0.95" />
          <stop offset="1" stopColor="#3B82F6" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`ga${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A3E635" />
          <stop offset="1" stopColor="#65A30D" />
        </linearGradient>
        <linearGradient id={`gl${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>

      {groups && <GroupBands groups={groups} L={L} slot={slot} T={T} B={B} />}

      {ticks.map((v) => (
        <g key={`t${v}`}>
          <line x1={L} y1={Y(v)} x2={R} y2={Y(v)} className="stroke-slate-200/80 dark:stroke-white/[0.07]" />
          <text x={L - 8} y={Y(v) + 3.5} fontSize={10} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 font-mono">{nf(v)}</text>
        </g>
      ))}
      {cticks.map((v) => (
        <text key={`c${v}`} x={R + 8} y={CY(v) + 3.5} fontSize={10} className="fill-cyan-700 dark:fill-cyan-300 font-mono">{short(v)}</text>
      ))}

      {runIdx >= 0 && (
        <g>
          <rect x={L + runIdx * slot + 2} y={T} width={slot - 4} height={B - T} rx={6} className="fill-blue-500/[0.08]" />
          <text x={L + (runIdx + 0.5) * slot} y={T + 11} fontSize={9.5} textAnchor="middle" fontWeight={800} className="fill-blue-700 dark:fill-blue-300">
            {tr('ĐANG CHẠY')}
          </text>
        </g>
      )}

      {slots.map((s, i) => {
        const cx = L + slot * (i + 0.5);
        const px = cx - bw - 1;
        const ax = cx + 1;
        const fut = s.status === 'future';
        const solidPlan = s.status === 'running' ? s.planCompare : s.plan;
        const low = s.actual !== null && s.planCompare > 0 && s.actual < (s.planCompare * targetPct) / 100;
        return (
          <g key={s.label + i}>
            {fullPlan ? (
              <>
                <path
                  d={topBar(px, Y(s.plan), bw, B - Y(s.plan))}
                  fill={`url(#gp${uid})`}
                  opacity={fut ? 0.4 : 1}
                  stroke={s.planEdited ? 'currentColor' : 'none'}
                  strokeWidth={s.planEdited ? 1.6 : 0}
                  className={s.planEdited ? 'text-slate-900 dark:text-white' : undefined}
                />
                {showValues && (
                  <text x={px + bw / 2} y={Y(s.plan) - 6} fontSize={9.5} textAnchor="middle" fontWeight={700} className="font-mono fill-blue-700 dark:fill-blue-300">
                    {nf(s.plan)}
                    {s.planEdited ? '*' : ''}
                  </text>
                )}
              </>
            ) : (
              <>
                {(fut || s.status === 'running') && (
                  <rect
                    x={px}
                    y={Y(s.plan)}
                    width={bw}
                    height={Math.max(0, (fut ? B : Y(solidPlan)) - Y(s.plan))}
                    rx={3}
                    fill="none"
                    strokeDasharray="3 3"
                    className="stroke-blue-500/60"
                  />
                )}
                {!fut && <path d={topBar(px, Y(solidPlan), bw, B - Y(solidPlan))} fill={`url(#gp${uid})`} />}
              </>
            )}
            {onPlanClick && (
              <rect
                x={px - 4}
                y={T}
                width={bw + 8}
                height={B - T}
                fill="transparent"
                className="cursor-pointer hover:fill-blue-500/10"
                role="button"
                tabIndex={0}
                aria-label={tr('Sửa kế hoạch giờ {0}', s.label)}
                onClick={() => onPlanClick(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPlanClick(i);
                  }
                }}
              >
                <title>{tr('Bấm để sửa kế hoạch giờ {0}', s.label)}</title>
              </rect>
            )}
            {s.actual !== null && !fut && (
              <>
                <path d={topBar(ax, Y(s.actual), bw, B - Y(s.actual))} fill={`url(#${low ? 'gl' : 'ga'}${uid})`} />
                {showValues && (
                  <text
                    x={ax + bw / 2}
                    y={Y(s.actual) - 6}
                    fontSize={10}
                    textAnchor="middle"
                    fontWeight={700}
                    className={`font-mono ${low ? 'fill-amber-700 dark:fill-amber-400' : 'fill-lime-800 dark:fill-lime-200'}`}
                  >
                    {nf(s.actual)}
                  </text>
                )}
              </>
            )}
            <text x={cx} y={B + 17} fontSize={10} textAnchor="middle" className={`font-mono ${fut ? 'fill-slate-300 dark:fill-slate-600' : 'fill-slate-500 dark:fill-slate-400'}`}>
              {s.label}
            </text>
          </g>
        );
      })}

      <line x1={L} y1={yTarget} x2={R} y2={yTarget} strokeWidth={1.5} strokeDasharray="6 5" className="stroke-orange-500 dark:stroke-orange-400" />
      <rect x={R - targetLabel.length * 6.1 - 14} y={yTarget + 4} width={targetLabel.length * 6.1 + 14} height={17} rx={5} className="fill-white/90 dark:fill-factory-bg/90 stroke-orange-500/50" />
      <text x={R - 7} y={yTarget + 16} fontSize={10} textAnchor="end" fontWeight={700} className="fill-orange-600 dark:fill-orange-400">{targetLabel}</text>

      {/* Lũy kế */}
      <polyline points={planLine} fill="none" strokeWidth={5} className="stroke-white/80 dark:stroke-factory-bg/70" />
      <polyline points={planLine} fill="none" strokeWidth={1.75} strokeDasharray="5 4" className="stroke-slate-600 dark:stroke-slate-300" />
      {actPts.length > 1 && (
        <>
          <polyline points={actLine} fill="none" strokeWidth={6} className="stroke-white/80 dark:stroke-factory-bg/70" />
          <polyline points={actLine} fill="none" strokeWidth={2.75} strokeLinejoin="round" className="stroke-cyan-600 dark:stroke-cyan-400" />
          <circle cx={last[0]} cy={last[1]} r={4.5} strokeWidth={2} className="fill-cyan-600 dark:fill-cyan-400 stroke-white dark:stroke-factory-bg" />
          <rect x={boxX} y={boxY} width={boxW} height={36} rx={7} className="fill-white dark:fill-factory-surface stroke-cyan-200 dark:stroke-cyan-900" />
          <text x={boxX + 9} y={boxY + 14} fontSize={10.5} fontWeight={800} className="fill-cyan-800 dark:fill-cyan-300">
            {tr('LK thực tế')} <tspan className="font-mono">{nf(accA)}</tspan>
          </text>
          <text x={boxX + 9} y={boxY + 28} fontSize={10} className="fill-slate-500 dark:fill-slate-400">
            {tr('LK KH')} <tspan className="font-mono">{`${nf(accP)} (${diff >= 0 ? '+' : '−'}${nf(Math.abs(diff))})`}</tspan>
          </text>
        </>
      )}
    </svg>
  );
}

/** Dải chênh lệch (thực tế − kế hoạch) — thẳng hàng với biểu đồ cột phía trên */
export function VarianceStrip({ slots, targetPct, width: W, height: H }: { slots: OutputSlot[]; targetPct: number; width: number; height: number }) {
  const L = 50;
  const R = W - 62;
  const T = 14;
  const B = H - 6;
  const Z = (T + B) / 2;
  const n = Math.max(1, slots.length);
  const slot = (R - L) / n;
  const bw = Math.min(26, slot * 0.5);
  const diffs = slots.map((s) => (s.actual === null || s.status === 'future' ? null : s.actual - s.planCompare));
  const vmax = Math.max(1, ...diffs.map((d) => Math.abs(d ?? 0)));
  const half = (B - T) / 2 - 13;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr('Chênh lệch thực tế so với kế hoạch')} className="w-full h-auto block">
      <line x1={L} y1={Z} x2={R} y2={Z} className="stroke-slate-200 dark:stroke-factory-border" />
      <text x={L - 8} y={Z + 3.5} fontSize={10} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 font-mono">0</text>
      {slots.map((s, i) => {
        const d = diffs[i];
        if (d === null) return null;
        const tone = toneOf(s.actual ?? 0, s.planCompare, targetPct);
        const h = Math.max(4, (Math.abs(d) / vmax) * half);
        const cx = L + slot * (i + 0.5);
        const y = d >= 0 ? Z - h : Z;
        return (
          <g key={s.label + i}>
            <rect x={cx - bw / 2} y={y} width={bw} height={h} rx={2} className={TONE_FILL[tone]} fillOpacity={0.9} />
            <text
              x={cx}
              y={d >= 0 ? Z - h - 4 : Z + h + 11}
              fontSize={n > 12 ? 9.5 : 10.5}
              textAnchor="middle"
              fontWeight={800}
              className={`font-mono ${TONE_FILL[tone]}`}
            >
              {`${d >= 0 ? '+' : '−'}${nf(Math.abs(d))}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface NgProps {
  slots: OutputSlot[];
  /** Ngưỡng NG cho mỗi ô (VD 1% kế hoạch giờ / ngày) */
  threshold: number;
  groups?: SlotGroup[];
  width: number;
  height: number;
  /** Căn trục X thẳng hàng với biểu đồ cột (lề phải 62) */
  alignWithBars?: boolean;
}

export function NgChart({ slots, threshold, groups, width: W, height: H, alignWithBars }: NgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const L = alignWithBars ? 50 : 40;
  const R = alignWithBars ? W - 62 : W - 14;
  const T = groups ? 44 : 20;
  const B = H - 26;
  const n = Math.max(1, slots.length);
  const slot = (R - L) / n;
  const vals = slots.map((s) => (s.status === 'future' ? null : s.ng));
  const ymax = Math.max(threshold * 1.6, ...vals.map((v) => v ?? 0)) * 1.15;
  const Y = (v: number) => B - (v / ymax) * (B - T);
  const step = niceStep(ymax);
  const ticks: number[] = [];
  for (let v = 0; v <= ymax; v += step) ticks.push(v);
  const pts = slots
    .map((_s, i) => (vals[i] === null || vals[i] === undefined ? null : ([L + slot * (i + 0.5), Y(vals[i] as number), vals[i] as number] as const)))
    .filter((p): p is readonly [number, number, number] => p !== null);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const thLabel = `≤ ${nf(threshold)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr('Số lượng hàng lỗi NG')} className="w-full h-auto block">
      <defs>
        <linearGradient id={`gn${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F87171" stopOpacity="0.32" />
          <stop offset="1" stopColor="#F87171" stopOpacity="0" />
        </linearGradient>
      </defs>
      {groups && <GroupBands groups={groups} L={L} slot={slot} T={T} B={B} />}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} y1={Y(v)} x2={R} y2={Y(v)} className="stroke-slate-200/80 dark:stroke-white/[0.07]" />
          <text x={L - 8} y={Y(v) + 3.5} fontSize={10} textAnchor="end" className="fill-slate-400 dark:fill-slate-500 font-mono">{nf(v)}</text>
        </g>
      ))}
      {pts.length > 0 && <polygon points={`${pts[0][0]},${B} ${line} ${pts[pts.length - 1][0]},${B}`} fill={`url(#gn${uid})`} />}
      <line x1={L} y1={Y(threshold)} x2={R} y2={Y(threshold)} strokeWidth={1.5} strokeDasharray="6 5" className="stroke-orange-500 dark:stroke-orange-400" />
      <rect x={R - thLabel.length * 6.4 - 14} y={Y(threshold) - 21} width={thLabel.length * 6.4 + 14} height={17} rx={5} className="fill-orange-500/15" />
      <text x={R - 7} y={Y(threshold) - 9} fontSize={10} textAnchor="end" fontWeight={700} className="fill-orange-600 dark:fill-orange-400">{thLabel}</text>
      {pts.length > 1 && <polyline points={line} fill="none" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" className="stroke-rose-600 dark:stroke-rose-400" />}
      {pts.map(([x, y, v], i) => {
        const over = v > threshold;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={over ? 5 : 3.5} strokeWidth={2} className={`stroke-rose-600 dark:stroke-rose-400 ${over ? 'fill-white dark:fill-factory-card' : 'fill-rose-600 dark:fill-rose-400'}`} />
            {(!groups || over) && (
              <text x={x} y={y - 10} fontSize={10} textAnchor="middle" fontWeight={800} className="font-mono fill-rose-700 dark:fill-rose-300">{nf(v)}</text>
            )}
          </g>
        );
      })}
      {slots.map((s, i) => (
        <text
          key={s.label + i}
          x={L + slot * (i + 0.5)}
          y={B + 17}
          fontSize={10}
          textAnchor="middle"
          className={`font-mono ${s.status === 'future' ? 'fill-slate-300 dark:fill-slate-600' : 'fill-slate-500 dark:fill-slate-400'}`}
        >
          {s.label}
        </text>
      ))}
    </svg>
  );
}
