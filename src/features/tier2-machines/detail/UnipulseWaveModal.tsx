/**
 * @file UnipulseWaveModal.tsx
 * @description Biểu đồ sóng ép (tải – hành trình) của một lần đo Unipulse (góp ý mentor 26/11).
 * File CSV hiện chỉ có tải đỉnh và hành trình cuối, nên đường sóng được DỰNG MÔ PHỎNG từ 2 giá trị đó
 * (đoạn chạy không tải → tiếp xúc → ép tăng nhanh tới tải đỉnh) để demo. Khi có file sóng thật sẽ thay dữ liệu.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X as XIcon, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import type { UnipulseData } from '../../../types/machineDetail';

type Row = UnipulseData['rows'][number];

/** Dựng ~180 điểm (hành trình, tải) kết thúc đúng tại (strokeMm, loadKn) */
export function buildWave(r: Row): Array<[number, number]> {
  let seed = r.seq * 9301 + 49297;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const end = r.strokeMm;
  const contact = end * (0.7 + rnd() * 0.04);
  const raw: Array<[number, number]> = [];
  const N = 180;
  for (let i = 0; i <= N; i++) {
    const s = (end * i) / N;
    let f: number;
    if (s < contact) f = 0.075 * s;
    else {
      const k = (s - contact) / (end - contact);
      f = 0.075 * contact + Math.pow(k, 2.2) * 30;
    }
    f += (rnd() - 0.5) * 0.12;
    raw.push([s, Math.max(0, f)]);
  }
  const scale = r.loadKn / raw[raw.length - 1][1];
  return raw.map(([s, f], i) => [s, i === raw.length - 1 ? r.loadKn : f * scale]);
}

export function UnipulseWaveModal({
  data,
  index,
  machineId,
  onClose,
  onIndex,
}: {
  data: UnipulseData;
  index: number;
  machineId: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const { t } = useTranslation();
  const row = data.rows[index];
  const ngRow = useMemo(() => data.rows.find((r, i) => r.result === 'NG' && i !== index) || null, [data.rows, index]);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index < data.rows.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowRight' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, data.rows.length, onClose, onIndex]);

  if (!row) return null;
  const wave = buildWave(row);
  const cmp = compare && ngRow ? buildWave(ngRow) : null;
  const { spec } = data;

  const W = 680;
  const H = 340;
  const L = 52;
  const R = W - 16;
  const T = 16;
  const B = H - 44;
  const xMax = Math.ceil((Math.max(spec.strokeMax, row.strokeMm, ngRow?.strokeMm ?? 0) + 2) / 5) * 5;
  const yMax = Math.ceil((Math.max(spec.loadMax, row.loadKn, cmp ? ngRow!.loadKn : 0) + 3) / 5) * 5;
  const X = (s: number) => L + (s / xMax) * (R - L);
  const Y = (f: number) => B - (f / yMax) * (B - T);
  const path = (pts: Array<[number, number]>) => 'M' + pts.map(([s, f]) => `${X(s).toFixed(1)},${Y(f).toFixed(1)}`).join(' L');
  const xTicks = Array.from({ length: xMax / 10 + 1 }, (_, i) => i * 10).filter((v) => v <= xMax);
  const yTicks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);
  const ok = row.result === 'OK';
  const color = ok ? '#2563EB' : '#DC2626';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wave-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[760px] max-h-[92vh] overflow-auto rounded-2xl bg-white dark:bg-factory-card border border-slate-200 dark:border-slate-700 shadow-2xl p-5 flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="wave-title" className="text-base font-extrabold text-slate-900 dark:text-white">
              {t('machine.unipulse.wave.title', { time: row.time })}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('machine.unipulse.wave.sub', { machine: machineId, n: wave.length })}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
              {row.result}
            </span>
            <button type="button" onClick={onClose} aria-label={t('machine.unipulse.wave.close')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('machine.unipulse.wave.title', { time: row.time })} className="block">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={R} y1={Y(v)} y2={Y(v)} className="stroke-slate-100 dark:stroke-slate-800" />
              <text x={L - 8} y={Y(v) + 4} fontSize={10} textAnchor="end" className="fill-slate-400">{v}</text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={X(v)} y={B + 16} fontSize={10} textAnchor="middle" className="fill-slate-400">{v}</text>
          ))}
          <rect
            x={X(spec.strokeMin)}
            y={Y(spec.loadMax)}
            width={Math.max(3, X(spec.strokeMax) - X(spec.strokeMin))}
            height={Y(spec.loadMin) - Y(spec.loadMax)}
            fill="#10B981"
            fillOpacity={0.15}
            stroke="#059669"
            strokeDasharray="3 2"
          />
          {cmp && <path d={path(cmp)} fill="none" stroke="#DC2626" strokeWidth={1.6} strokeDasharray="5 3" opacity={0.85} />}
          <path d={path(wave)} fill="none" stroke={color} strokeWidth={2.4} />
          <circle cx={X(row.strokeMm)} cy={Y(row.loadKn)} r={5} fill={color} />
          <text x={X(row.strokeMm) - 10} y={Y(row.loadKn) - 10} fontSize={12} fontWeight={800} textAnchor="end" fill={color}>
            {row.loadKn.toFixed(2)} kN @ {row.strokeMm.toFixed(2)} mm
          </text>
          <text x={(L + R) / 2} y={H - 6} fontSize={11} textAnchor="middle" className="fill-slate-500">{t('machine.unipulse.wave.axisX')}</text>
          <text x={14} y={(T + B) / 2} fontSize={11} textAnchor="middle" transform={`rotate(-90 14 ${(T + B) / 2})`} className="fill-slate-500">
            {t('machine.unipulse.wave.axisY')}
          </text>
        </svg>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 rounded" style={{ background: color }} />{t('machine.unipulse.wave.current')}</span>
          {cmp && ngRow && (
            <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-rose-600" />{t('machine.unipulse.wave.compareNg', { time: ngRow.time })}</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 border border-dashed border-emerald-600 bg-emerald-500/15" />
            {t('machine.unipulse.wave.okZone', { load: `${spec.loadMin}–${spec.loadMax}`, stroke: `${spec.strokeMin}–${spec.strokeMax}` })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={index >= data.rows.length - 1}
            onClick={() => onIndex(index + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {t('machine.unipulse.wave.prev')}
          </button>
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => onIndex(index - 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
          >
            {t('machine.unipulse.wave.next')} <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {ngRow && (
            <button
              type="button"
              aria-pressed={compare}
              onClick={() => setCompare((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${compare ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}
            >
              <Activity className="w-3.5 h-3.5" /> {compare ? t('machine.unipulse.wave.hideCompare') : t('machine.unipulse.wave.compare')}
            </button>
          )}
          <span className="ml-auto text-[10.5px] text-slate-400">{index + 1} / {data.rows.length}</span>
        </div>
        <p className="text-[10.5px] text-slate-400">{t('machine.unipulse.wave.note')}</p>
      </div>
    </div>
  );
}
