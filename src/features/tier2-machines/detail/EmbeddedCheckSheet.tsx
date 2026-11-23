/**
 * @file EmbeddedCheckSheet.tsx
 * @description CHECK SHEET đầu ca / cuối ca nằm ngay trong màn Chi tiết máy (thay cho trang Check Sheet riêng).
 *  - 4 ô trạng thái: Check đầu ca · Check cuối ca · Ngoài quy cách gần đây · Đo liên tục
 *  - Mỗi thông số (theo Metric Mapping thật) 1 thẻ: giá trị hiện tại, quy cách, biểu đồ nhỏ có vùng quy cách
 *  - Bảng kết quả đầu ca / cuối ca lưu trong CSDL, ghi chú, nút ghi nhận, Start/Stop đo, Xuất CSV
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { apiClient } from '../../../services/api';
import { useMonitoringStore } from '../../../stores/useMonitoringStore';
import type { MetricIndicator } from '../../../types/hierarchy';
import type { CheckSheetRecord } from '../../../types/machineDetail';

const SHIFT_LABEL: Record<number, string> = { 1: '06:00–14:00', 2: '14:00–22:00', 3: '22:00–06:00' };
const SHIFT_END_CHECK: Record<number, string> = { 1: '13:50', 2: '21:50', 3: '05:50' };

/** Ca và ngày sản xuất hiện tại theo giờ Việt Nam (ca 3 sau nửa đêm thuộc ngày hôm trước). */
function currentVnShift(now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const h = vn.getUTCHours();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  if (h >= 6 && h < 14) return { shift: 1, date: day(vn) };
  if (h >= 14 && h < 22) return { shift: 2, date: day(vn) };
  if (h >= 22) return { shift: 3, date: day(vn) };
  return { shift: 3, date: day(new Date(vn.getTime() - 86_400_000)) };
}

const inSpec = (v: number, m: MetricIndicator) =>
  (m.warningMin == null || v >= m.warningMin) && (m.warningMax == null || v <= m.warningMax);
const fmt = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '—' : String(Math.round(v * 100) / 100));

interface Props {
  machineId: string;
  machineCode: string;
  metrics: MetricIndicator[];
}

export function EmbeddedCheckSheet({ machineId, machineCode, metrics }: Props) {
  const { t, i18n } = useTranslation();
  const { isRealtimeActive, toggleRealtime } = useMonitoringStore();
  const now = currentVnShift();
  const [shift, setShift] = useState<number>(now.shift);
  const date = now.date;
  const [records, setRecords] = useState<CheckSheetRecord[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; key: string; msg?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.getCheckSheets(machineId, { date, shift });
      setRecords(res.records);
    } catch {
      setRecords([]);
    }
  }, [machineId, date, shift]);

  useEffect(() => {
    load();
  }, [load]);

  const startRec = [...records].reverse().find((r) => r.checkType === 'START') || null;
  const endRec = [...records].reverse().find((r) => r.checkType === 'END') || null;
  const nextType: 'START' | 'END' | null = !startRec ? 'START' : !endRec ? 'END' : null;
  const isCurrentShift = shift === now.shift;

  // Điểm đo ngoài quy cách trong lịch sử gần đây
  const ngInfo = useMemo(() => {
    let count = 0;
    let worst: string | null = null;
    let worstCount = 0;
    for (const m of metrics) {
      const c = (m.history || []).filter((h) => !inSpec(h.value, m)).length;
      count += c;
      if (c > worstCount) {
        worstCount = c;
        worst = m.name;
      }
    }
    return { count, worst };
  }, [metrics]);
  const samples = metrics.reduce((a, m) => a + (m.history?.length || 0), 0);

  const timeFmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(iso));

  const recordTile = (rec: CheckSheetRecord | null, label: string, pendingText: string) => {
    const ok = rec ? rec.items.filter((i) => i.result === 'OK').length : 0;
    const tone = !rec
      ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
      : rec.result === 'OK'
        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
        : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300';
    return (
      <div className={`rounded-xl border p-3 flex flex-col gap-1 min-w-0 ${tone}`}>
        <span className="text-[10px] font-extrabold tracking-wide">{label}</span>
        <strong className="text-base leading-tight">
          {rec
            ? rec.result === 'OK'
              ? t('machine.cs.passed', { ok, total: rec.items.length })
              : t('machine.cs.failed', { ok, total: rec.items.length })
            : t('machine.cs.notChecked')}
        </strong>
        <span className="text-[11px] opacity-80 truncate">
          {rec ? t('machine.cs.by', { time: timeFmt(rec.createdAt), name: rec.checkedByName || rec.checkedBy || '' }) : pendingText}
        </span>
      </div>
    );
  };

  const save = async () => {
    if (!nextType) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiClient.createCheckSheet({
        machineId,
        date,
        shift,
        checkType: nextType,
        note: note.trim() || undefined,
        items: metrics.map((m) => ({
          metricId: m.id,
          name: m.name,
          unit: m.unit,
          value: Number(m.currentValue),
          min: m.warningMin ?? null,
          max: m.warningMax ?? null,
        })),
      });
      setNote('');
      setMessage({ ok: true, key: 'machine.cs.saved' });
      await load();
    } catch (err: any) {
      setMessage({ ok: false, key: 'machine.cs.error', msg: err?.message || '' });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [
      ['Machine', machineCode, 'Date', date, 'Shift', String(shift)],
      [],
      ['Parameter', 'Unit', 'Spec min', 'Spec max', 'Current', 'Start of shift', 'End of shift'],
      ...metrics.map((m) => [
        m.name,
        m.unit,
        fmt(m.warningMin),
        fmt(m.warningMax),
        fmt(Number(m.currentValue)),
        fmt(startRec?.items.find((i) => i.metricId === m.id)?.value),
        fmt(endRec?.items.find((i) => i.metricId === m.id)?.value),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `check-sheet_${machineCode}_${date}_ca${shift}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="check-sheet" aria-label={t('machine.cs.title')} className="scroll-mt-4 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#DC0032] text-white flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('machine.cs.title')}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('machine.cs.subtitle', { code: machineCode, date, count: metrics.length })}
            </p>
          </div>
        </div>
        <div role="group" aria-label="Shift" className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={shift === s}
              onClick={() => setShift(s)}
              className={`min-h-[34px] px-3 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                shift === s ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('machine.cs.shift', { shift: s, label: SHIFT_LABEL[s] })}
            </button>
          ))}
        </div>
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">{t('machine.cs.noMetrics')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {recordTile(startRec, t('machine.cs.startTile'), t('machine.cs.notChecked'))}
            {recordTile(endRec, t('machine.cs.endTile'), t('machine.cs.waitingEnd', { time: SHIFT_END_CHECK[shift] }))}
            <div className={`rounded-xl border p-3 flex flex-col gap-1 min-w-0 ${ngInfo.count > 0 ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300'}`}>
              <span className="text-[10px] font-extrabold tracking-wide">{t('machine.cs.ngTile')}</span>
              <strong className="text-base leading-tight truncate">
                {ngInfo.count > 0 ? t('machine.cs.ngSome', { count: ngInfo.count, name: ngInfo.worst }) : t('machine.cs.ngNone')}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/5 p-3 flex flex-col gap-1 min-w-0 text-slate-700 dark:text-slate-300">
              <span className="text-[10px] font-extrabold tracking-wide">{t('machine.cs.measureTile')}</span>
              <strong className="text-base leading-tight flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {isRealtimeActive ? t('machine.cs.recording') : t('machine.cs.stopped')}
              </strong>
              <span className="text-[11px] opacity-80">{t('machine.cs.samples', { count: samples })}</span>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-4 items-start">
            {/* Thẻ từng thông số */}
            <div className="flex-[3] min-w-0 w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {metrics.map((m) => (
                <ParamCard key={m.id} metric={m} />
              ))}
            </div>

            {/* Bảng kết quả & ghi nhận */}
            <div className="flex-[2] min-w-0 w-full xl:max-w-[400px] rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 flex flex-col gap-3">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{t('machine.cs.resultTitle')}</h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 px-1 font-bold border-b border-slate-200 dark:border-slate-700">{t('machine.cs.param')}</th>
                    <th className="py-1.5 px-1 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('machine.cs.start')}</th>
                    <th className="py-1.5 px-1 font-bold border-b border-slate-200 dark:border-slate-700 text-right">{t('machine.cs.end')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const s = startRec?.items.find((i) => i.metricId === m.id);
                    const e = endRec?.items.find((i) => i.metricId === m.id);
                    const cell = (it?: { value: number | null; result: 'OK' | 'NG' }) =>
                      it ? (
                        <span className={it.result === 'OK' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 font-bold'}>
                          {it.result === 'OK' ? '✓' : '✗'} {fmt(it.value)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      );
                    return (
                      <tr key={m.id}>
                        <td className="py-1.5 px-1 border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={m.name}>{m.name}</td>
                        <td className="py-1.5 px-1 border-b border-slate-100 dark:border-slate-800 text-right font-mono">{cell(s)}</td>
                        <td className="py-1.5 px-1 border-b border-slate-100 dark:border-slate-800 text-right font-mono">{cell(e)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {nextType && isCurrentShift && (
                <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t('machine.cs.noteLabel')}
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('machine.cs.notePlaceholder')}
                    maxLength={500}
                    className="font-normal text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2 resize-y"
                  />
                </label>
              )}

              {message && <p className={`text-[11px] font-semibold ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>{t(message.key, { msg: message.msg })}</p>}

              <button
                type="button"
                disabled={!nextType || !isCurrentShift || saving}
                onClick={save}
                className="min-h-[44px] rounded-lg bg-[#DC0032] hover:bg-[#B8002A] disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-extrabold cursor-pointer"
              >
                {saving ? t('machine.cs.saving') : nextType === 'START' ? t('machine.cs.recordStart') : nextType === 'END' ? t('machine.cs.recordEnd') : t('machine.cs.done')}
              </button>
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => toggleRealtime(true)} disabled={isRealtimeActive} className="min-h-[38px] rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold disabled:opacity-50 cursor-pointer">
                  {t('machine.cs.startMeasure')}
                </button>
                <button type="button" onClick={() => toggleRealtime(false)} disabled={!isRealtimeActive} className="min-h-[38px] rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold disabled:opacity-50 cursor-pointer">
                  {t('machine.cs.stopMeasure')}
                </button>
                <button type="button" onClick={exportCsv} className="min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[11px] font-bold cursor-pointer">
                  {t('machine.cs.exportCsv')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Thẻ 1 thông số: giá trị hiện tại + biểu đồ nhỏ có vùng quy cách (xanh) và điểm NG (đỏ) */
function ParamCard({ metric: m }: { metric: MetricIndicator }) {
  const { t } = useTranslation();
  const value = Number(m.currentValue);
  const hasSpec = m.warningMin != null || m.warningMax != null;
  const ok = inSpec(value, m);
  const hist = (m.history || []).slice(-30);

  const W = 300;
  const H = 96;
  const vals = [...hist.map((h) => h.value), value];
  const lo0 = Math.min(...vals, m.warningMin ?? Infinity);
  const hi0 = Math.max(...vals, m.warningMax ?? -Infinity);
  const pad = (hi0 - lo0 || Math.abs(hi0) || 1) * 0.15;
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const x = (i: number) => (hist.length <= 1 ? W / 2 : (i / (hist.length - 1)) * W);
  const pts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.value).toFixed(1)}`).join(' ');
  const bandTop = m.warningMax != null ? y(m.warningMax) : 0;
  const bandBot = m.warningMin != null ? y(m.warningMin) : H;

  return (
    <div className={`rounded-xl p-3 flex flex-col gap-2 min-w-0 ${hasSpec && !ok ? 'border-2 border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/10' : 'border border-slate-200 dark:border-slate-700'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-xs text-slate-900 dark:text-white truncate" title={m.name}>{m.name}</strong>
          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
            {hasSpec ? t('machine.cs.spec', { min: m.warningMin ?? '—', max: m.warningMax ?? '—' }) : t('machine.cs.noSpec')}
          </span>
        </div>
        {hasSpec && (
          <span className={`shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
            {ok ? t('machine.cs.inSpec') : t('machine.cs.outSpec')}
          </span>
        )}
      </div>
      <span className="font-mono text-2xl font-extrabold leading-none text-slate-900 dark:text-white">
        {fmt(value)} <span className="text-xs font-semibold text-slate-500">{m.unit}</span>
      </span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('machine.cs.sparkAria', { name: m.name, min: m.warningMin ?? '—', max: m.warningMax ?? '—' })}
        className="w-full h-[96px]"
        preserveAspectRatio="none"
      >
        {hasSpec && <rect x="0" y={Math.min(bandTop, bandBot)} width={W} height={Math.abs(bandBot - bandTop)} className="fill-emerald-100 dark:fill-emerald-950/50" />}
        {m.warningMax != null && <line x1="0" x2={W} y1={bandTop} y2={bandTop} strokeDasharray="5 4" className="stroke-rose-400" />}
        {m.warningMin != null && <line x1="0" x2={W} y1={bandBot} y2={bandBot} strokeDasharray="5 4" className="stroke-rose-400" />}
        {hist.length > 1 && <polyline points={pts} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" className="stroke-blue-600 dark:stroke-blue-400" />}
        {hist.map((h, i) => (!inSpec(h.value, m) ? <circle key={i} cx={x(i)} cy={y(h.value)} r="4" className="fill-rose-600" /> : null))}
        {Number.isFinite(value) && (
          <circle cx={hist.length > 1 ? W - 4 : W / 2} cy={y(value)} r="4" className={hasSpec && !ok ? 'fill-rose-600' : 'fill-blue-600 dark:fill-blue-400'} />
        )}
      </svg>
    </div>
  );
}
