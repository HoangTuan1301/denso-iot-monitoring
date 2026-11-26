/**
 * @file oeeTone.tsx
 * @description Màu thẻ OEE theo ngưỡng (góp ý mentor 26/11): xanh ≥ 85 %, cam 80–85 %, đỏ < 80 %.
 * Dùng chung cho thẻ OEE nhà máy (Dashboard), thẻ OEE dây chuyền và Top 5.
 */
import { useTranslation } from 'react-i18next';

export const OEE_TARGET = 85;
export const OEE_WARN = 80;

export type OeeLevel = 'ok' | 'near' | 'low' | 'none';

export function oeeLevel(v: number | null | undefined): OeeLevel {
  if (v === null || v === undefined || Number.isNaN(v)) return 'none';
  return v >= OEE_TARGET ? 'ok' : v >= OEE_WARN ? 'near' : 'low';
}

/** Màu đặc (dùng cho chấm, số thứ tự, thanh) */
export const OEE_COLOR: Record<OeeLevel, string> = { ok: '#059669', near: '#D97706', low: '#DC2626', none: '#94A3B8' };

/** Lớp Tailwind cho nền / viền / chữ của thẻ */
export const OEE_CARD: Record<OeeLevel, { box: string; value: string; pill: string }> = {
  ok: {
    box: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
    value: 'text-emerald-700 dark:text-emerald-400',
    pill: 'text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800',
  },
  near: {
    box: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    value: 'text-amber-600 dark:text-amber-400',
    pill: 'text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800',
  },
  low: {
    box: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800',
    value: 'text-rose-600 dark:text-rose-400',
    pill: 'text-rose-700 border-rose-200 dark:text-rose-300 dark:border-rose-800',
  },
  none: {
    box: 'bg-white border-slate-200 dark:bg-factory-card dark:border-slate-800',
    value: 'text-slate-900 dark:text-white',
    pill: 'text-slate-500 border-slate-200 dark:border-slate-700',
  },
};

/** Nhãn trạng thái nhỏ: ● Đạt mục tiêu / ● Sát mục tiêu / ● Dưới 80 % */
export function OeeStatusPill({ value }: { value: number | null | undefined }) {
  const { t } = useTranslation();
  const lv = oeeLevel(value);
  if (lv === 'none') return null;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-white dark:bg-slate-900 ${OEE_CARD[lv].pill}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: OEE_COLOR[lv] }} />
      {t(`oeeTone.${lv}`, { target: OEE_TARGET, warn: OEE_WARN })}
    </span>
  );
}

/** Thanh OEE có vạch mục tiêu 85 % */
export function OeeProgress({ value }: { value: number | null | undefined }) {
  const lv = oeeLevel(value);
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative h-1.5 rounded-full bg-slate-900/10 dark:bg-white/10" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: OEE_COLOR[lv] }} />
      <div className="absolute -top-[3px] w-0.5 h-3 bg-slate-900 dark:bg-white" style={{ left: `${OEE_TARGET}%` }} />
    </div>
  );
}
