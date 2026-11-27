/**
 * @file EmbeddedCheckSheet.tsx
 * @description CHECK SHEET đầu ca / cuối ca nằm ngay trong màn Chi tiết máy.
 *  - Hàng nhãn trạng thái gọn: Check đầu ca · Check cuối ca · Ngoài quy cách · Đang đo (+ nút Dừng/Bắt đầu đo)
 *  - Biểu đồ lớn cho từng thông số: giá trị hiện tại, vùng quy cách, đường 2 phút gần nhất
 *    cập nhật mỗi giây, thống kê MIN / MAX / TB / Cpk
 *  - Cột phải: bảng kết quả đầu ca / cuối ca lưu trong CSDL, ghi chú, nút ghi nhận
 */
import { fyFileTag } from '../../../utils/fiscalYear';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, FileSpreadsheet } from 'lucide-react';
import { apiClient } from '../../../services/api';
import { useMonitoringStore } from '../../../stores/useMonitoringStore';
import type { CheckSheetRecord } from '../../../types/machineDetail';
import { type LiveMetric, fmtNum } from './useLiveMetrics';
import { LiveSpecChart } from './LiveSpecChart';

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

const fmt = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '—' : String(Math.round(v * 100) / 100));

interface Props {
  machineId: string;
  machineCode: string;
  /** Thông số sống (giá trị + lịch sử 2 phút + quy cách) – xem useLiveMetrics */
  metrics: LiveMetric[];
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

  // Thông số đang ngoài quy cách / sát ngưỡng
  const ngCount = metrics.filter((m) => m.status === 'ng').length;
  const nearCount = metrics.filter((m) => m.status === 'near').length;

  const timeFmt = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(iso));

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
          value: Number(m.value.toFixed(m.decimals + 1)),
          min: m.min,
          max: m.max,
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
        fmtNum(m.min, m.decimals),
        fmtNum(m.max, m.decimals),
        fmtNum(m.value, m.decimals + 1),
        fmt(startRec?.items.find((i) => i.metricId === m.id)?.value),
        fmt(endRec?.items.find((i) => i.metricId === m.id)?.value),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `check-sheet_${machineCode}_${/^\d{4}-/.test(String(date)) ? fyFileTag(String(date)) : date}_ca${shift}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chip = (dot: string, tone: string, label: string, value: string, pulse = false) => (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      {label && <span className="text-slate-600 dark:text-slate-300">{label}:</span>}
      <strong className="font-bold">{value}</strong>
    </div>
  );
  const recordChip = (rec: CheckSheetRecord | null, label: string, pending: string) => {
    if (!rec)
      return chip('bg-amber-500', 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300', label, pending);
    const ok = rec.items.filter((i) => i.result === 'OK').length;
    const text = `${rec.result === 'OK' ? t('machine.cs.passed', { ok, total: rec.items.length }) : t('machine.cs.failed', { ok, total: rec.items.length })} · ${timeFmt(rec.createdAt)}`;
    return rec.result === 'OK'
      ? chip('bg-emerald-500', 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300', label, text)
      : chip('bg-rose-500', 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300', label, text);
  };
  const startValueOf = (m: LiveMetric) => {
    const v = startRec?.items.find((i) => i.metricId === m.id)?.value;
    return v !== undefined && v !== null ? Number(v) : m.history[0];
  };

  return (
    <section id="check-sheet" aria-label={t('machine.cs.title')} className="scroll-mt-4 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col gap-4">
      {/* Tiêu đề + chọn ca + xuất CSV */}
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
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('machine.cs.exportCsv')}
          </button>
        </div>
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">{t('machine.cs.noMetrics')}</p>
      ) : (
        <>
          {/* Hàng nhãn trạng thái gọn */}
          <div className="flex flex-wrap items-center gap-2">
            {recordChip(startRec, t('machine.cs.startTile'), t('machine.cs.notChecked'))}
            {recordChip(endRec, t('machine.cs.endTile'), t('machine.cs.waitingEnd', { time: SHIFT_END_CHECK[shift] }))}
            {ngCount > 0
              ? chip('bg-rose-500', 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300', t('machine.cs.ngTile'), t('machine.cs.paramCount', { count: ngCount }))
              : nearCount > 0
                ? chip('bg-amber-500', 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300', t('machine.cs.ngTile'), t('machine.cs.nearCount', { count: nearCount }))
                : chip('bg-emerald-500', 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300', t('machine.cs.ngTile'), t('machine.cs.paramCount', { count: 0 }))}
            {isRealtimeActive
              ? chip('bg-emerald-500', 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300', '', t('machine.cs.measuring'), true)
              : chip('bg-slate-400', 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300', '', t('machine.cs.stopped'))}
            <button
              type="button"
              onClick={() => toggleRealtime()}
              className={`ml-auto min-h-[32px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                isRealtimeActive
                  ? 'border-rose-200 text-rose-700 bg-white hover:bg-rose-50 dark:border-rose-800/60 dark:bg-transparent dark:text-rose-300'
                  : 'border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 dark:border-emerald-700 dark:bg-transparent dark:text-emerald-300'
              }`}
            >
              {isRealtimeActive ? t('machine.cs.stopMeasure') : t('machine.cs.startMeasure')}
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
            {/* Biểu đồ lớn từng thông số */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {metrics.map((m) => (
                <LiveSpecChart key={m.id} metric={m} startValue={startValueOf(m)} />
              ))}
            </div>

            {/* Kết quả check + ghi nhận */}
            <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{t('machine.cs.resultTitleShift', { shift })}</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 text-left font-bold border-b border-slate-200 dark:border-slate-700">{t('machine.cs.param')}</th>
                    <th className="py-1.5 text-right font-bold border-b border-slate-200 dark:border-slate-700">{t('machine.cs.start')}</th>
                    <th className="py-1.5 text-right font-bold border-b border-slate-200 dark:border-slate-700">{t('machine.cs.end')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const cell = (rec: CheckSheetRecord | null) => {
                      const it = rec?.items.find((i) => i.metricId === m.id);
                      if (!it) return <span className="text-slate-400">—</span>;
                      return (
                        <span className={`font-mono font-bold ${it.result === 'OK' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {fmtNum(Number(it.value), m.decimals)}
                        </span>
                      );
                    };
                    return (
                      <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">
                          <span className="line-clamp-2">{m.name}</span>
                          <span className="text-[10px] text-slate-400"> ({m.unit})</span>
                        </td>
                        <td className="py-2 text-right">{cell(startRec)}</td>
                        <td className="py-2 text-right">{cell(endRec)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('machine.cs.noteLabel')}</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={t('machine.cs.notePlaceholder')}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 resize-y"
                />
              </label>
              <button
                type="button"
                disabled={!nextType || !isCurrentShift || saving}
                onClick={save}
                className="min-h-[44px] rounded-xl bg-[#DC0032] hover:bg-[#B8002A] disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-extrabold cursor-pointer transition-colors"
              >
                {saving ? t('machine.cs.saving') : nextType === 'START' ? t('machine.cs.recordStart') : nextType === 'END' ? t('machine.cs.recordEnd') : t('machine.cs.done')}
              </button>
              {message && (
                <p className={`text-xs font-semibold ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {t(message.key, { msg: message.msg })}
                </p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('machine.cs.autoJudge')}</p>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
