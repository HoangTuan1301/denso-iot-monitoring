/**
 * @file ProductionDecisionPanel.tsx
 * @description Cột phải Dashboard tổng quan – công cụ ra quyết định cứu đơn hàng:
 *   1. Top 5 line có thời gian dừng dài (chọn line)
 *   2. Mô phỏng What-If 4 phương án cho line đang chọn (chọn phương án)
 *   3. Thác tổn thất: Kế hoạch ca → các tổn thất → (+ phục hồi) → Dự kiến cuối ca, có vạch đơn hàng
 *   4. Khuyến nghị + Xuất báo cáo (CSV)
 */
import { fyFileTag } from '../../../utils/fiscalYear';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ArrowRight, RefreshCw } from 'lucide-react';
import type { FactoryProductionOverview, WhatIfResponse, WhatIfScenario, LineProductionStatus } from '../../../types/production';
import { useLineWhatIf, useCauseText } from './useProduction';
import { OEE_COLOR, oeeLevel } from './oeeTone';
import { lineDisplayName } from '../../../config/lineDisplayName';
import { trData } from '../../../i18n/tr';

const STATUS_COLOR: Record<LineProductionStatus, string> = {
  ALARM: '#DC2626',
  WARNING: '#D97706',
  RUNNING: '#059669',
  IDLE: '#94A3B8',
};

interface Props {
  overview: FactoryProductionOverview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedLineCode: string | null;
  onSelectLine: (lineCode: string) => void;
  onOpenLine: (lineId: string) => void;
}

const nf = (v: number) => v.toLocaleString('en-US');

export function ProductionDecisionPanel({ overview, loading, error, onRetry, selectedLineCode, onSelectLine, onOpenLine }: Props) {
  const { t } = useTranslation();
  const causeText = useCauseText();
  const top = overview?.topDowntime ?? [];
  const selected = top.find((l) => l.lineCode === selectedLineCode) || null;
  const whatIf = useLineWhatIf(selectedLineCode);
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  // Mỗi khi đổi line hoặc có dữ liệu mới: chọn sẵn phương án được khuyến nghị
  useEffect(() => {
    setScenarioId(whatIf.data?.recommendedId ?? null);
  }, [whatIf.data]);

  const scenarioName = (s: WhatIfScenario) =>
    s.id === 'REROUTE'
      ? s.targetLineCode
        ? t('decision.scenario.REROUTE', { line: s.targetLineCode })
        : t('decision.scenario.REROUTE_NONE')
      : s.id === 'OVERTIME'
        ? t('decision.scenario.OVERTIME', { hours: s.otHours ?? '' })
        : t(`decision.scenario.${s.id}`);

  if (error && !overview) {
    return (
      <aside className="w-full lg:w-[400px] shrink-0 bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 text-sm">
        <p className="text-rose-600 font-semibold">{t('decision.error')}</p>
        <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> {t('decision.retry')}
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-full lg:w-[400px] shrink-0 flex flex-col gap-3" aria-label={t('decision.top5Title')}>
      {/* 1. TOP 5 */}
      <section className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{t('decision.top5Title')}</h3>
          {overview?.shift && (
            <span className="text-[10px] text-slate-500">{t('dashboard.kpi.shift', { shift: overview.shift.shift, label: overview.shift.label })}</span>
          )}
        </div>
        {loading && !overview ? (
          <div className="space-y-2 animate-pulse">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 rounded-lg bg-slate-100 dark:bg-white/5" />)}</div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {top.map((l, i) => {
              const active = l.lineCode === selectedLineCode;
              const lv = l.emergency || l.productionStatus === 'ALARM' ? 'low' : oeeLevel(l.oee);
              const color = lv === 'none' ? STATUS_COLOR[l.productionStatus] || STATUS_COLOR.RUNNING : OEE_COLOR[lv];
              const minutes = l.totalStopMinutes;
              return (
                <li key={l.lineCode}>
                  <button
                    type="button"
                    onClick={() => onSelectLine(l.lineCode)}
                    aria-pressed={active}
                    className={`w-full min-h-[46px] flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="w-5 h-5 shrink-0 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center" style={{ background: color }}>
                      {i + 1}
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-extrabold text-slate-900 dark:text-white">{lineDisplayName(l.lineCode)}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {l.virtual ? t('decision.virtualTag') : trData(l.lineName).replace(/^Dây chuyền\s+/i, '')} · {l.lineCode}
                      </span>
                    </span>
                    <span className="font-mono text-xs font-extrabold shrink-0" style={{ color }}>
                      {l.oee !== null && l.oee !== undefined ? `${l.oee.toFixed(1)}%` : '—'}
                    </span>
                    <span className="flex flex-col items-end min-w-[84px]">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{t('decision.stopMinutes', { count: minutes })}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                        {l.mainCauseCode === 'SHORT_STOP'
                          ? t('cause.SHORT_STOP_COUNT', { count: l.shortStopCount })
                          : causeText(l.mainCauseCode, l.mainCauseOp, l.mainCause) || '—'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* 2–4. WHAT-IF / THÁC TỔN THẤT / KHUYẾN NGHỊ */}
      {selected && (
        <WhatIfBlock
          data={whatIf.data}
          loading={whatIf.loading}
          error={whatIf.error}
          onRetry={whatIf.reload}
          lineCode={selected.lineCode}
          lineId={selected.lineId}
          virtual={selected.virtual}
          scenarioId={scenarioId}
          onSelectScenario={setScenarioId}
          scenarioName={scenarioName}
          onOpenLine={onOpenLine}
        />
      )}
    </aside>
  );
}

function WhatIfBlock({
  data,
  loading,
  error,
  onRetry,
  lineCode,
  lineId,
  virtual,
  scenarioId,
  onSelectScenario,
  scenarioName,
  onOpenLine,
}: {
  data: WhatIfResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  lineCode: string;
  lineId: string;
  virtual: boolean;
  scenarioId: string | null;
  onSelectScenario: (id: string) => void;
  scenarioName: (s: WhatIfScenario) => string;
  onOpenLine: (lineId: string) => void;
}) {
  const { t } = useTranslation();
  const causeText = useCauseText();
  const scenario = data?.scenarios.find((s) => s.id === scenarioId) || data?.scenarios.find((s) => s.id === data?.recommendedId) || null;

  const bars = useMemo(() => {
    if (!data || !scenario) return [];
    const list: Array<{ label: string; value: number; start: number; end: number; kind: 'total' | 'loss' | 'gain' }> = [];
    list.push({ label: t('decision.plan'), value: data.planQty, start: 0, end: data.planQty, kind: 'total' });
    let level = data.planQty;
    for (const l of data.losses) {
      if (l.pcs <= 0) continue;
      list.push({ label: causeText(l.code, null, l.label), value: -l.pcs, start: level - l.pcs, end: level, kind: 'loss' });
      level -= l.pcs;
    }
    if (scenario.gainPcs > 0) {
      list.push({ label: t('decision.recover'), value: scenario.gainPcs, start: level, end: level + scenario.gainPcs, kind: 'gain' });
    }
    list.push({ label: t('decision.final'), value: scenario.finalQty, start: 0, end: scenario.finalQty, kind: 'total' });
    return list;
  }, [data, scenario, t, causeText]);

  if (loading && !data) {
    return <div className="h-[420px] rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" aria-busy="true" />;
  }
  if (error && !data) {
    return (
      <section className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-sm">
        <p className="text-rose-600 font-semibold">{t('decision.error')}</p>
        <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">{t('decision.retry')}</button>
      </section>
    );
  }
  if (!data || !scenario) return null;

  const required = data.order.requiredQty;
  // Trục rút gọn: bắt đầu gần mức thấp nhất để các tổn thất nhỏ vẫn nhìn rõ (cột tổng vẽ từ đáy trục)
  const lowest = Math.min(required, ...bars.filter((b) => b.kind !== 'total').map((b) => b.start), ...bars.map((b) => b.end));
  const top = Math.max(required, ...bars.map((b) => b.end));
  const floor = Math.max(0, Math.floor((lowest - (top - lowest) * 0.6) / 100) * 100);
  const maxV = top + (top - floor) * 0.08;
  const H = 150;
  const y = (v: number) => (Math.max(0, v - floor) / (maxV - floor)) * H;
  const rec = data.scenarios.find((s) => s.id === data.recommendedId)!;

  let recText: string;
  if (rec.id === 'BASELINE') recText = t('decision.recNoAction', { qty: nf(rec.finalQty), req: nf(required) });
  else if (rec.meetsDue) recText = t('decision.recBest', { name: scenarioName(rec), qty: nf(rec.finalQty), req: nf(required), cost: nf(rec.costUsd) });
  else recText = t('decision.recNone', { name: scenarioName(rec), qty: nf(rec.finalQty), req: nf(required), short: nf(rec.shortfall) });

  const exportReport = () => {
    const rows: string[][] = [
      ['DENSO KaiLink – What-If report', '', '', '', '', ''],
      ['Line', lineCode, 'Order', data.order.code, 'Required (pcs)', String(required)],
      ['Simulated data', 'yes', 'Generated at', new Date().toLocaleString(), '', ''],
      [],
      ['Scenario', 'Final qty (pcs)', 'Gain (pcs)', 'Shortfall (pcs)', 'Cost (USD)', 'On time'],
      ...data.scenarios.map((s) => [scenarioName(s), String(s.finalQty), String(s.gainPcs), String(s.shortfall), String(s.costUsd), s.meetsDue ? 'YES' : 'NO']),
      [],
      ['Loss waterfall', 'pcs'],
      ...bars.map((b) => [b.label, String(b.value)]),
      [],
      ['Recommendation', recText],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `what-if_${lineCode}_${fyFileTag(new Date().toISOString().slice(0, 10))}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{t('decision.whatIfTitle', { line: lineDisplayName(lineCode) })}</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t('decision.order', { code: data.order.code, qty: nf(required), due: t('decision.due', { time: data.order.dueTime, shift: data.order.shift }) })}
            </p>
          </div>
          {!virtual && (
            <button
              type="button"
              onClick={() => onOpenLine(lineId)}
              title={t('decision.openLine')}
              aria-label={t('decision.openLine')}
              className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:border-emerald-400 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.scenarios.map((s) => {
            const active = s.id === scenario.id;
            const isBest = s.id === data.recommendedId;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectScenario(s.id)}
                className={`flex flex-col gap-1.5 p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-2 border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30'
                    : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-start justify-between gap-1">
                  <span className="text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">{scenarioName(s)}</span>
                  {isBest && <span className="shrink-0 text-[8px] font-extrabold text-white bg-emerald-600 px-1.5 py-0.5 rounded-full">{t('decision.best')}</span>}
                </span>
                <span className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>{t('decision.oee')} <b className="font-mono text-slate-900 dark:text-white">{s.oee}%</b></span>
                  <span>{t('decision.qty')} <b className="font-mono text-slate-900 dark:text-white">{nf(s.finalQty)}</b></span>
                  <span>{t('decision.cost')} <b className="font-mono text-slate-900 dark:text-white">${nf(s.costUsd)}</b></span>
                  <span>{t('decision.recovery')} <b className="font-mono text-slate-900 dark:text-white">{s.recoveryHours}h</b></span>
                </span>
                <span
                  className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    s.meetsDue
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                >
                  {s.meetsDue
                    ? `${t('decision.meets')} · ${t('decision.surplus', { count: nf(s.finalQty - required) })}`
                    : t('decision.short', { count: nf(s.shortfall) })}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{t('decision.waterfallTitle')}</h3>
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 truncate">{t('decision.scenarioLabel', { name: scenarioName(scenario) })}</span>
        </div>
        <div
          role="img"
          aria-label={bars.map((b) => `${b.label} ${b.value}`).join(', ')}
          className="relative grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
        >
          {/* Vạch đơn hàng */}
          <div className="absolute left-0 right-0 border-t border-dashed border-blue-500 pointer-events-none z-10" style={{ bottom: `${y(required) + 30}px` }}>
            <span className="absolute -top-3.5 left-0 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-white/90 dark:bg-slate-900/90 px-1 rounded">
              {t('decision.orderLine', { qty: nf(required) })}
            </span>
          </div>
          {bars.map((b, i) => {
            const color = b.kind === 'loss' ? '#DC2626' : b.kind === 'gain' ? '#059669' : i === 0 ? '#2563EB' : '#0F172A';
            const bottom = y(b.start);
            const h = Math.max(3, y(b.end) - y(b.start));
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="relative w-full" style={{ height: H + 18 }}>
                  <span
                    className="absolute left-0 right-0 text-center font-mono text-[10px] font-bold"
                    style={{ bottom: bottom + h + 3, color: b.kind === 'total' && i > 0 ? undefined : color }}
                  >
                    <span className={b.kind === 'total' && i > 0 ? 'text-slate-900 dark:text-white' : ''}>
                      {b.kind === 'loss' ? `−${nf(-b.value)}` : b.kind === 'gain' ? `+${nf(b.value)}` : nf(b.value)}
                    </span>
                  </span>
                  <span
                    className={`absolute left-[18%] right-[18%] rounded ${b.kind === 'total' && i > 0 ? 'bg-slate-900 dark:bg-slate-200' : ''}`}
                    style={{ bottom, height: h, background: b.kind === 'total' && i > 0 ? undefined : color }}
                  />
                </div>
                <span className="mt-1 h-[26px] text-[9px] leading-tight text-slate-600 dark:text-slate-400 text-center line-clamp-2">{b.label}</span>
              </div>
            );
          })}
        </div>
        {floor > 0 && (
          <p className="mt-1 text-[9px] text-slate-400 text-right">{t('decision.axisFrom', { value: nf(floor) })}</p>
        )}
      </section>

      <section className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 p-3.5 flex flex-col gap-2.5">
        <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{t('decision.recommendTitle')}</h3>
        <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">{recText}</p>
        <button
          type="button"
          onClick={exportReport}
          className="min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Download className="w-4 h-4" /> {t('decision.export')}
        </button>
      </section>
    </>
  );
}
