/**
 * @file LineOutputMonitor.tsx
 * @description Giám sát sản lượng sản xuất của 1 dây chuyền (theo góp ý mentor DENSO):
 *  - 3 chế độ xem: Ca · theo giờ / Tuần · theo ngày / Tháng · theo tuần
 *  - 5 thẻ số: Kế hoạch · Thực tế · Chênh lệch · Dự báo (hoặc tuần/ngày tốt nhất) · Hàng lỗi NG
 *  - Biểu đồ cột Kế hoạch/Thực tế + đường lũy kế, dải chênh lệch so với kế hoạch
 *  - Biểu đồ hàng lỗi NG + loại lỗi nhiều nhất
 *  - Bảng chi tiết theo giờ (thu gọn được) ở chế độ ca
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Table2 } from 'lucide-react';
import type { LineShiftProduction, DefectCount } from '../../../types/production';
import { useCauseText } from '../../dashboard/production/useProduction';
import { useLineDaily } from './useLineProduction';
import { NgChart, OutputBarChart, VarianceStrip, nf, toneOf, type OutputSlot, type SlotGroup } from './OutputCharts';
import { tr, trData } from '../../../i18n/tr';
import { PlanEditModal, type PlanEditTarget } from './PlanEditModal';
import { apiClient } from '../../../services/api';
import { useAuthStore } from '../../../stores/useAuthStore';
import { lineDisplayName } from '../../../config/lineDisplayName';

type ViewMode = 'shift' | 'week' | 'month';

interface Props {
  data: LineShiftProduction | null;
  loading: boolean;
  shift: 1 | 2 | 3 | null;
  onChangeShift: (shift: 1 | 2 | 3) => void;
  lineCode?: string | null;
  /** Gọi sau khi sửa kế hoạch giờ để tải lại dữ liệu ca */
  onPlanChanged?: () => void;
}

const DAY_MS = 86400000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const addMonths = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1)).toISOString().slice(0, 10);
};
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${nf(Math.abs(v))}`;

function downloadCsv(name: string, rows: Array<Array<string | number | null>>) {
  const body = rows.map((r) => r.map((c) => (c === null ? '' : `"${String(c).replace(/"/g, '""')}"`)).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Kpi({ label, value, tone, sub, bar }: { label: string; value: ReactNode; tone: string; sub: ReactNode; bar?: { pct: number; mark: number; tone: string } }) {
  return (
    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-card flex flex-col gap-1.5 min-w-0">
      <span className="text-[10.5px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 truncate">{label}</span>
      <strong className={`font-mono text-2xl leading-none ${tone}`}>{value}</strong>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{sub}</span>
      {bar && (
        <div className="relative h-[5px] rounded-full bg-slate-100 dark:bg-white/[0.08] mt-1" aria-hidden="true">
          <div className={`h-[5px] rounded-full ${bar.tone}`} style={{ width: `${Math.min(100, bar.pct)}%` }} />
          <div className="absolute -top-[3px] w-0.5 h-[11px] bg-slate-900 dark:bg-white" style={{ left: `${Math.min(100, bar.mark)}%` }} />
        </div>
      )}
    </div>
  );
}

function Legend({ items }: { items: Array<{ kind: 'bar' | 'ghost' | 'dash' | 'line'; cls: string; label: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.kind === 'bar' && <span className={`w-2.5 h-2.5 rounded-[3px] ${it.cls}`} />}
          {it.kind === 'ghost' && <span className={`w-2.5 h-2.5 rounded-[3px] border-[1.5px] border-dashed ${it.cls}`} />}
          {it.kind === 'dash' && <span className={`w-[18px] border-t-2 border-dashed ${it.cls}`} />}
          {it.kind === 'line' && <span className={`w-[18px] h-[2.5px] rounded ${it.cls}`} />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Panel({ title, legend, children }: { title: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-card p-4 flex flex-col gap-2.5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[12.5px] font-extrabold tracking-wide text-slate-900 dark:text-white">{title}</h4>
        {legend}
      </div>
      {children}
    </section>
  );
}

function TopDefects({ items }: { items?: DefectCount[] }) {
  const list = (items || []).filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] text-[11px]">
      <span className="font-bold text-slate-500 dark:text-slate-400 mr-0.5">{tr('Lỗi nhiều nhất')}</span>
      {list.map((d) => (
        <span key={d.code} className="px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {trData(d.label)} <span className="font-mono">{nf(d.count)}</span>
        </span>
      ))}
    </div>
  );
}

const barLegend = (target: number, withGhost: boolean) => [
  { kind: 'bar' as const, cls: 'bg-blue-500', label: tr('Kế hoạch') },
  { kind: 'bar' as const, cls: 'bg-lime-400', label: tr('Thực tế') },
  { kind: 'bar' as const, cls: 'bg-amber-400', label: tr('Dưới {0}%', target) },
  ...(withGhost ? [{ kind: 'ghost' as const, cls: 'border-blue-500', label: tr('Chưa tới') }] : []),
  { kind: 'dash' as const, cls: 'border-slate-500 dark:border-slate-300', label: tr('Lũy kế KH') },
  { kind: 'line' as const, cls: 'bg-cyan-600 dark:bg-cyan-400', label: tr('Lũy kế TT') },
];

function VarianceBlock({ slots, target, width }: { slots: OutputSlot[]; target: number; width: number }) {
  return (
    <div className="border-t border-dashed border-slate-200 dark:border-factory-border pt-2">
      <p className="text-[10.5px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
        {tr('CHÊNH LỆCH SO VỚI KẾ HOẠCH')}{' '}
        <span className="font-semibold tracking-normal">
          · {tr('xanh: đạt mục tiêu ≥ {0}% · cam: {1}–{0}% · đỏ: < {1}%', target, target - 5)}
        </span>
      </p>
      <VarianceStrip slots={slots} targetPct={target} width={width} height={slots.length > 12 ? 112 : 92} />
    </div>
  );
}

export function LineOutputMonitor({ data, loading, shift, onChangeShift, lineCode, onPlanChanged }: Props) {
  const { t } = useTranslation();
  const causeText = useCauseText();
  const [mode, setMode] = useState<ViewMode>('shift');
  const [anchor, setAnchor] = useState<string | undefined>(undefined);
  const [showTable, setShowTable] = useState(false);
  const [planEdit, setPlanEdit] = useState<PlanEditTarget | null>(null);
  const role = useAuthStore((st) => st.currentUser?.role);
  const canEditPlan = role === 'ADMIN' || role === 'MAINTENANCE';
  const daily = useLineDaily(lineCode ?? data?.lineCode ?? null, mode === 'shift' ? null : mode, anchor);

  const activeShift = shift ?? data?.shift ?? 1;
  const modes: Array<[ViewMode, string]> = [
    ['shift', tr('Ca · theo giờ')],
    ['week', tr('Tuần · theo ngày')],
    ['month', tr('Tháng · theo tuần')],
  ];

  const segBtn = (active: boolean) =>
    `min-h-[34px] px-3 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-white dark:bg-factory-surface text-slate-900 dark:text-white shadow-sm dark:shadow-none dark:ring-1 dark:ring-factory-border'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
    }`;

  // ---------- Dữ liệu chế độ ca ----------
  const shiftView = useMemo(() => {
    if (!data || data.state === 'NOT_STARTED') return null;
    const target = data.output.targetPct ?? 85;
    const slots: OutputSlot[] = data.hourly.map((h) => {
      const frac = h.status === 'running' ? Math.max(0.05, (data.elapsedMin % 60) / 60 || 1) : undefined;
      return {
        label: h.hour,
        plan: h.plan,
        planCompare: h.status === 'running' ? h.planSoFar : h.plan,
        actual: h.status === 'future' ? null : h.actual,
        ng: h.status === 'future' ? null : (h.ng ?? null),
        status: h.status,
        frac,
        planEdited: !!h.planEdited,
      };
    });
    const ngThreshold = Math.max(1, Math.round(((data.hourly[0]?.plan ?? 0) * (data.output.ngTargetPct ?? 1)) / 100));
    return { target, slots, ngThreshold };
  }, [data]);

  // ---------- Dữ liệu chế độ tuần / tháng ----------
  const dayView = useMemo(() => {
    const d = daily.data;
    if (!d || mode === 'shift') return null;
    const work = d.days.filter((x) => x.status !== 'off');
    const slots: OutputSlot[] = work.map((x) => ({
      label: mode === 'week' ? `${dm(x.date)}` : x.date.slice(8, 10),
      plan: x.plan,
      planCompare: x.status === 'running' ? x.planSoFar : x.plan,
      actual: x.actual,
      ng: x.ng,
      status: x.status === 'off' ? 'future' : x.status,
      frac: x.status === 'running' && x.plan > 0 ? x.planSoFar / x.plan : undefined,
    }));
    let groups: SlotGroup[] | undefined;
    let ngGroups: SlotGroup[] | undefined;
    if (mode === 'month') {
      groups = [];
      ngGroups = [];
      for (const w of d.weeks) {
        const start = work.findIndex((x) => x.date === w.from);
        const end = work.findIndex((x) => x.date === w.to);
        if (start < 0 || end < 0) continue;
        const pct = w.planSoFar > 0 && w.actual !== null ? (w.actual / w.planSoFar) * 100 : null;
        groups.push({
          label: `W${w.week}`,
          start,
          end,
          value: pct === null ? '—' : `${pct.toFixed(1)}%`,
          tone: pct === null ? 'good' : toneOf(w.actual ?? 0, w.planSoFar, d.targetPct),
        });
        ngGroups.push({ label: `W${w.week}`, start, end, value: w.ng === null ? '—' : `NG ${nf(w.ng)}`, tone: 'ng' });
      }
    }
    const dayPlan = work.find((x) => x.plan > 0)?.plan ?? 0;
    const ngThreshold = Math.max(1, Math.round((dayPlan * d.ngTargetPct) / 100));
    return { d, slots, groups, ngGroups, ngThreshold, target: d.targetPct };
  }, [daily.data, mode]);

  // ---------- Thanh tiêu đề ----------
  const periodLabel = (() => {
    const d = daily.data;
    if (!d) return '';
    if (mode === 'week') return `${tr('Tuần')} W${d.days[0]?.week ?? ''} · ${dm(d.from)} – ${dm(d.to)}`;
    return `${tr('Tháng')} ${d.from.slice(5, 7)}/${d.from.slice(0, 4)}`;
  })();
  const canNext = !!daily.data && daily.data.to < daily.data.today;
  const step = (dir: -1 | 1) => {
    const base = daily.data?.from ?? daily.data?.today;
    if (!base) return;
    setAnchor(mode === 'week' ? addDays(base, dir * 7) : addMonths(base, dir));
  };

  const exportCsv = () => {
    if (mode === 'shift' && data) {
      downloadCsv(`${data.lineCode}_${data.date}_ca${data.shift}_san-luong.csv`, [
        [tr('Giờ'), tr('Kế hoạch'), tr('Thực tế'), tr('Chênh lệch'), 'NG', tr('Ghi chú')],
        ...data.hourly.map((h) => {
          const plan = h.status === 'running' ? h.planSoFar : h.plan;
          return [h.hour, plan, h.actual, h.actual === null ? null : h.actual - plan, h.ng ?? null, h.note ? trData(h.note) : ''];
        }),
      ]);
    } else if (daily.data) {
      const d = daily.data;
      downloadCsv(`${d.lineCode}_${d.from}_${d.to}_san-luong.csv`, [
        [tr('Ngày'), tr('Tuần'), tr('Kế hoạch'), tr('Thực tế'), tr('Chênh lệch'), 'NG'],
        ...d.days.filter((x) => x.status !== 'off').map((x) => {
          const plan = x.status === 'running' ? x.planSoFar : x.plan;
          return [x.date, `W${x.week}`, plan, x.actual, x.actual === null ? null : x.actual - plan, x.ng];
        }),
      ]);
    }
  };

  const subtitle =
    mode === 'shift'
      ? data
        ? t('lineView.output.subtitle', { shift: data.shift, date: data.date, time: data.updatedAt })
        : ''
      : daily.data
        ? `${daily.data.lineCode} · ${periodLabel} · ${tr('cập nhật {0}', daily.data.updatedAt)}`
        : '';

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('lineView.output.title')}</h3>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={tr('Chế độ xem')} className="flex max-w-full overflow-x-auto rounded-lg bg-slate-100 dark:bg-factory-bg dark:border dark:border-factory-border p-0.5 gap-0.5">
          {modes.map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setAnchor(undefined);
              }}
              className={segBtn(mode === m)}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'shift' ? (
          <div role="group" aria-label="Shift" className="flex rounded-lg bg-slate-100 dark:bg-factory-bg dark:border dark:border-factory-border p-0.5 gap-0.5">
            {([1, 2, 3] as const).map((s) => (
              <button key={s} type="button" aria-pressed={activeShift === s} onClick={() => onChangeShift(s)} className={segBtn(activeShift === s)}>
                {t('lineView.output.shiftBtn', { shift: s })}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-card">
            <button type="button" onClick={() => step(-1)} aria-label={tr('Kỳ trước')} className="w-9 h-[38px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-1 text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap min-w-[120px] text-center">{periodLabel || '…'}</span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={!canNext}
              aria-label={tr('Kỳ sau')}
              className="w-9 h-[38px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={exportCsv}
          className="h-[38px] px-3 rounded-lg border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-card text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-factory-surface flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {tr('Tải CSV')}
        </button>
      </div>
    </div>
  );

  const shell = (children: ReactNode) => (
    <section className="bg-slate-50/60 dark:bg-factory-bg/40 rounded-2xl border border-slate-200/80 dark:border-factory-border p-4 shadow-xs flex flex-col gap-3.5">
      {header}
      {children}
    </section>
  );
  const skeleton = <div className="h-[420px] rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" aria-busy="true" />;

  // ================= CHẾ ĐỘ TUẦN / THÁNG =================
  if (mode !== 'shift') {
    if (!dayView) return shell(daily.error ? <p className="text-sm text-rose-600 py-10 text-center">{daily.error}</p> : skeleton);
    const { d, slots, groups, ngGroups, ngThreshold, target } = dayView;
    const tt = d.totals;
    const gap = tt.actual - tt.planSoFar;
    const pctSoFar = tt.planSoFar > 0 ? (tt.actual / tt.planSoFar) * 100 : 0;
    // tuần (tháng) hoặc ngày (tuần) tốt nhất
    let best: { label: string; pct: number } | null = null;
    if (mode === 'month') {
      for (const w of d.weeks) {
        if (w.actual === null || w.planSoFar <= 0) continue;
        const p = (w.actual / w.planSoFar) * 100;
        if (!best || p > best.pct) best = { label: `W${w.week}`, pct: p };
      }
    } else {
      for (const x of d.days) {
        if (x.status !== 'done' || x.actual === null) continue;
        const p = (x.actual / x.plan) * 100;
        if (!best || p > best.pct) best = { label: dm(x.date), pct: p };
      }
    }
    const overDays = d.days.filter((x) => x.ng !== null && x.ng > ngThreshold).length;
    const W = 1080;
    return shell(
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <Kpi label={tr('Kế hoạch đến hôm nay')} value={nf(tt.planSoFar)} tone="text-blue-700 dark:text-blue-300" sub={tr('{0} ngày làm việc · cả kỳ {1}', tt.workDays, nf(tt.plan))} />
          <Kpi
            label={tr('Thực tế')}
            value={nf(tt.actual)}
            tone="text-lime-700 dark:text-lime-300"
            sub={tr('{0}% kế hoạch', pctSoFar.toFixed(1))}
            bar={{ pct: (tt.actual / Math.max(1, tt.plan)) * 100, mark: (tt.planSoFar / Math.max(1, tt.plan)) * 100, tone: 'bg-lime-600 dark:bg-lime-400' }}
          />
          <Kpi label={tr('Chênh lệch')} value={signed(gap)} tone={gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} sub={tr('so với kế hoạch đến hôm nay')} />
          <Kpi
            label={mode === 'month' ? tr('Tuần tốt nhất') : tr('Ngày tốt nhất')}
            value={best ? best.label : '—'}
            tone="text-emerald-600 dark:text-emerald-400"
            sub={best ? tr('{0}% kế hoạch', best.pct.toFixed(1)) : tr('Chưa có ngày hoàn thành')}
          />
          <Kpi
            label={tr('Hàng lỗi NG')}
            value={nf(tt.ng)}
            tone="text-rose-600 dark:text-rose-300"
            sub={tr('{0}% · {1} ngày vượt ngưỡng', tt.actual > 0 ? ((tt.ng / tt.actual) * 100).toFixed(2) : '0', overDays)}
          />
        </div>
        <Panel title={mode === 'month' ? tr('SẢN LƯỢNG THEO NGÀY · CHIA THEO TUẦN (pcs)') : tr('SẢN LƯỢNG THEO NGÀY (pcs)')} legend={<Legend items={barLegend(target, true)} />}>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <OutputBarChart slots={slots} targetPct={target} groups={groups} width={W} height={mode === 'month' ? 310 : 290} showValues={mode === 'week'} ariaLabel={tr('Sản lượng kế hoạch và thực tế theo ngày')} />
              <VarianceBlock slots={slots} target={target} width={W} />
            </div>
          </div>
        </Panel>
        <Panel
          title={tr('HÀNG LỖI NG THEO NGÀY (pcs)')}
          legend={<Legend items={[{ kind: 'line', cls: 'bg-rose-600 dark:bg-rose-400', label: 'NG' }, { kind: 'dash', cls: 'border-orange-500', label: tr('Ngưỡng {0}%', d.ngTargetPct) }]} />}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <NgChart slots={slots} threshold={ngThreshold} groups={ngGroups} width={W} height={mode === 'month' ? 230 : 210} alignWithBars />
            </div>
          </div>
          <TopDefects items={d.defectsByType} />
        </Panel>
      </>
    );
  }

  // ================= CHẾ ĐỘ CA =================
  if (loading && !data) return shell(skeleton);
  if (!data) return null;
  if (data.state === 'NOT_STARTED' || !shiftView) {
    return shell(<p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">{t('lineView.output.notStarted')}</p>);
  }
  const { target, slots, ngThreshold } = shiftView;
  const o = data.output;
  const finished = data.state === 'FINISHED';
  const gap = o.actual - o.planSoFar;
  const ngTarget = o.ngTarget ?? Math.round((o.planTotal * (o.ngTargetPct ?? 1)) / 100);
  const ngPct = o.actual > 0 ? (o.defects / o.actual) * 100 : 0;
  const planDefaultTotal = data.hourly.reduce((a, h) => a + (h.planDefault ?? h.plan), 0);
  const editedCount = data.hourly.filter((h) => h.planEdited).length;
  function openPlanEdit(i: number) {
    const h = data!.hourly[i];
    if (!h) return;
    const next = data!.hourly[i + 1]?.hour ?? `${String((Number(h.hour.slice(0, 2)) + 1) % 24).padStart(2, '0')}:00`;
    setPlanEdit({
      hourIndex: i,
      hourLabel: h.hour,
      nextLabel: next,
      plan: h.plan,
      planDefault: h.planDefault ?? h.plan,
      reason: h.planReason ?? null,
      shiftTotal: o.planTotal,
      shiftTotalDefault: planDefaultTotal,
    });
  }
  const savePlan = async (qty: number | null, reason: string) => {
    if (!planEdit) return;
    await apiClient.updateLinePlan(data.lineId, { date: data.date, shift: data.shift, hour: planEdit.hourIndex, qty, reason });
    setPlanEdit(null);
    onPlanChanged?.();
  };

  return shell(
    <>
      {planEdit && (
        <PlanEditModal
          target={planEdit}
          subtitle={tr('Ca {0} · {1} · {2} ({3})', data.shift, data.date, lineDisplayName(data.lineCode), data.lineCode)}
          onClose={() => setPlanEdit(null)}
          onSave={savePlan}
        />
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi
          label={t('lineView.output.plan')}
          value={nf(o.planTotal)}
          tone="text-blue-700 dark:text-blue-300"
          sub={
            editedCount
              ? tr('Đã sửa {0} giờ · mặc định {1}', editedCount, nf(planDefaultTotal))
              : tr('{0} pcs / giờ', nf(data.hourly[0]?.planDefault ?? data.hourly[0]?.plan ?? 0))
          }
        />
        <Kpi
          label={t('lineView.output.actual', { time: data.updatedAt })}
          value={nf(o.actual)}
          tone="text-lime-700 dark:text-lime-300"
          sub={tr('{0}% kế hoạch ca', Math.round((o.actual / Math.max(1, o.planTotal)) * 100))}
          bar={{ pct: (o.actual / Math.max(1, o.planTotal)) * 100, mark: (o.planSoFar / Math.max(1, o.planTotal)) * 100, tone: 'bg-lime-600 dark:bg-lime-400' }}
        />
        <Kpi
          label={t('lineView.output.gap')}
          value={signed(gap)}
          tone={gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
          sub={tr('KH đến {0}: {1}', data.updatedAt, nf(o.planSoFar))}
        />
        <Kpi
          label={finished ? t('lineView.output.finished') : t('lineView.output.forecast')}
          value={nf(o.forecast)}
          tone="text-amber-600 dark:text-amber-400"
          sub={tr('{0}% kế hoạch', o.forecastPct)}
        />
        <Kpi
          label={tr('Hàng lỗi NG')}
          value={nf(o.defects)}
          tone="text-rose-600 dark:text-rose-300"
          sub={tr('{0}% · mục tiêu ≤ {1} ({2}%)', ngPct.toFixed(2), nf(ngTarget), o.ngTargetPct ?? 1)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,8fr)_minmax(0,5fr)] gap-3.5">
        <Panel
          title={tr('SẢN LƯỢNG THEO GIỜ (pcs)')}
          legend={
            <Legend
              items={barLegend(target, false).map((it, k) =>
                k === 0 && canEditPlan && !finished ? { ...it, label: tr('Kế hoạch (bấm cột để sửa)') } : it
              )}
            />
          }
        >
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <OutputBarChart
                slots={slots}
                targetPct={target}
                width={660}
                height={270}
                ariaLabel={t('lineView.output.chartAria')}
                fullPlan
                onPlanClick={canEditPlan && !finished ? openPlanEdit : undefined}
              />
              <VarianceBlock slots={slots} target={target} width={660} />
            </div>
          </div>
        </Panel>
        <Panel
          title={tr('HÀNG LỖI NG THEO GIỜ (pcs)')}
          legend={<Legend items={[{ kind: 'line', cls: 'bg-rose-600 dark:bg-rose-400', label: 'NG' }, { kind: 'dash', cls: 'border-orange-500', label: tr('Ngưỡng {0}%', o.ngTargetPct ?? 1) }]} />}
        >
          <div className="flex-1 flex flex-col justify-center">
            <NgChart slots={slots} threshold={ngThreshold} width={400} height={300} />
          </div>
          <TopDefects items={o.defectsByType} />
        </Panel>
      </div>

      {/* Bảng chi tiết theo giờ (thu gọn) */}
      <div className="rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-card">
        <button
          type="button"
          aria-expanded={showTable}
          onClick={() => setShowTable((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
        >
          <span className="flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-slate-100">
            <Table2 className="w-4 h-4 text-slate-500" />
            {tr('Bảng chi tiết theo giờ')}
            <span className="font-medium text-slate-500 dark:text-slate-400">· {tr('% đạt và ghi chú dừng máy')}</span>
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {showTable ? tr('Thu gọn') : tr('Mở rộng')}
            <ChevronDown className={`w-4 h-4 transition-transform ${showTable ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {showTable && (
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700">{t('lineView.output.hour')}</th>
                  <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('lineView.output.planCol')}</th>
                  <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('lineView.output.actualCol')}</th>
                  <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('lineView.output.pctCol')}</th>
                  <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700 text-right">NG</th>
                  <th className="py-1.5 px-1.5 font-bold border-b border-slate-200 dark:border-slate-700">{t('lineView.output.noteCol')}</th>
                </tr>
              </thead>
              <tbody>
                {data.hourly.map((h) => {
                  const plan = h.status === 'running' ? h.planSoFar : h.plan;
                  const pct = h.actual !== null && plan > 0 ? Math.round((h.actual / plan) * 100) : null;
                  const tone = pct === null ? null : toneOf(h.actual ?? 0, plan, target);
                  const toneCls =
                    tone === 'good'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : tone === 'warn'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
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
                        {pct !== null && <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${toneCls}`}>{pct}%</span>}
                      </td>
                      <td className="py-1.5 px-1.5 border-b border-slate-100 dark:border-slate-800 text-right font-mono text-rose-600 dark:text-rose-300">{h.ng ?? '—'}</td>
                      <td className="py-1.5 px-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">{note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

