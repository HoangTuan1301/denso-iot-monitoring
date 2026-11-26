/**
 * @file PlanEditModal.tsx
 * @description Hộp sửa kế hoạch 1 giờ trong ca (góp ý mentor 26/11, thiết kế 13c):
 * hộp lớn ở giữa, nền xung quanh mờ đi; nút −/+, ô số lớn, so với mặc định, tổng ca, lý do.
 */
import { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus, Loader2 } from 'lucide-react';
import { tr } from '../../../i18n/tr';

const nf = (v: number) => v.toLocaleString('en-US');

export interface PlanEditTarget {
  hourIndex: number;
  hourLabel: string;
  nextLabel: string;
  plan: number;
  planDefault: number;
  reason: string | null;
  shiftTotal: number;
  shiftTotalDefault: number;
}

export function PlanEditModal({
  target,
  subtitle,
  onClose,
  onSave,
}: {
  target: PlanEditTarget;
  subtitle: string;
  onClose: () => void;
  onSave: (qty: number | null, reason: string) => Promise<void>;
}) {
  const [qty, setQty] = useState<string>(String(target.plan));
  const [reason, setReason] = useState(target.reason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const n = Number(qty);
  const valid = qty.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 10000;
  const value = valid ? Math.round(n) : target.plan;
  const delta = value - target.planDefault;
  const total = target.shiftTotal - target.plan + value;
  const totalDiff = total - target.shiftTotalDefault;
  const step = (d: number) => setQty(String(Math.max(0, Math.min(10000, value + d))));

  const submit = async (q: number | null) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(q, q === null ? '' : reason.trim());
    } catch (e: any) {
      setError(e?.message || tr('Không lưu được kế hoạch.'));
      setSaving(false);
    }
  };

  const tone = (d: number) => (d === 0 ? 'bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]" onClick={() => !saving && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-edit-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !saving) void submit(value);
        }}
        className="w-full max-w-[460px] rounded-2xl bg-white dark:bg-factory-card border border-slate-200 dark:border-slate-700 shadow-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="plan-edit-title" className="text-lg font-extrabold text-slate-900 dark:text-white">
              {tr('Sửa kế hoạch giờ {0} – {1}', target.hourLabel, target.nextLabel)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label={tr('Đóng')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-qty" className="text-xs font-bold text-slate-700 dark:text-slate-300">{tr('Số lượng kế hoạch (pcs)')}</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step(-10)} aria-label={tr('Giảm 10')} className="w-12 h-14 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              <Minus className="w-5 h-5" />
            </button>
            <input
              id="plan-qty"
              ref={inputRef}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
              className={`flex-1 min-w-0 h-14 rounded-xl border-2 text-center font-mono text-3xl font-extrabold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none ${valid ? 'border-blue-500' : 'border-rose-500'}`}
            />
            <button type="button" onClick={() => step(10)} aria-label={tr('Tăng 10')} className="w-12 h-14 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {!valid && <span className="text-xs text-rose-600">{tr('Nhập số từ 0 đến 10.000.')}</span>}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl px-2 py-2 bg-slate-50 dark:bg-slate-800/60">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tr('Mặc định')}</div>
            <strong className="font-mono text-slate-900 dark:text-white">{nf(target.planDefault)}</strong>
          </div>
          <div className={`rounded-xl px-2 py-2 ${tone(delta)}`}>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tr('Thay đổi')}</div>
            <strong className="font-mono">{delta > 0 ? '+' : delta < 0 ? '−' : ''}{nf(Math.abs(delta))}</strong>
          </div>
          <div className={`rounded-xl px-2 py-2 ${tone(totalDiff)}`}>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tr('Tổng ca')}</div>
            <strong className="font-mono text-[13px] whitespace-nowrap">{nf(total)} / {nf(target.shiftTotalDefault)}</strong>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-reason" className="text-xs font-bold text-slate-700 dark:text-slate-300">{tr('Lý do (không bắt buộc)')}</label>
          <input
            id="plan-reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr('Ví dụ: họp an toàn 7 phút')}
            className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={saving || (target.plan === target.planDefault && !target.reason)}
            onClick={() => void submit(null)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
          >
            {tr('Về mặc định ({0})', nf(target.planDefault))}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
            {tr('Hủy')}
          </button>
          <button type="submit" disabled={!valid || saving} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {tr('Lưu')}
          </button>
        </div>
      </form>
    </div>
  );
}
