/**
 * @file ThresholdConfigModal.tsx
 * @description Modal Cấu hình Ngưỡng Cảnh báo (Warning & Critical Limits) cho Metric Mapping
 * Thiết kế chuẩn UI/UX theo ảnh mẫu 4:
 * - Dải thông tin metadata trên đỉnh: COMPONENT, METRIC, ĐƠN VỊ, HIỆN TẠI (giá trị thực tế).
 * - Banner xanh dương hướng dẫn cơ chế cảnh báo tự động.
 * - Mã rule & Tên gợi nhớ.
 * - Loại rule: THRESHOLD_GT (Ngưỡng trên), THRESHOLD_LT (Ngưỡng dưới), THRESHOLD_RANGE (Khoảng hai phía).
 * - Hai khối cấu hình trực quan: Khối Warning (Vàng) & Khối Critical (Đỏ).
 * - Tự động validate logic quan hệ các ngưỡng và giới hạn vật lý CSDL.
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { MetricMappingItem } from '../../types/metric';
import { apiClient } from '../../services/api';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { ModalPortal } from '../../components/common/ModalPortal';

interface ThresholdConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapping: MetricMappingItem | null;
  onSuccess: () => void;
}

export function ThresholdConfigModal({
  isOpen,
  onClose,
  mapping,
  onSuccess,
}: ThresholdConfigModalProps) {
  const { lines } = useMonitoringStore();

  const [isLoading, setIsLoading] = useState(false);
  const [ruleCode, setRuleCode] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState<'THRESHOLD_GT' | 'THRESHOLD_LT' | 'THRESHOLD_RANGE'>('THRESHOLD_GT');

  const [warningMin, setWarningMin] = useState<string>('');
  const [warningMax, setWarningMax] = useState<string>('');
  const [criticalMin, setCriticalMin] = useState<string>('');
  const [criticalMax, setCriticalMax] = useState<string>('');
  const [hasExistingThresholds, setHasExistingThresholds] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tìm giá trị đo thực tế hiện tại (nếu có telemetry)
  const currentMetricValue: number | null = (() => {
    if (!mapping) return null;
    for (const line of lines) {
      for (const machine of line.machines || []) {
        if (machine.id === mapping.machine_id) {
          const mVal = (machine.metrics || []).find(
            (m) => m.id === mapping.metricCode || m.id === mapping.metric_id || m.name === mapping.metricName
          );
          if (mVal && typeof mVal.currentValue === 'number') {
            return mVal.currentValue;
          }
        }
      }
    }
    return null;
  })();

  // Nạp cấu hình ngưỡng hiện tại từ Backend API
  useEffect(() => {
    if (isOpen && mapping) {
      setError(null);
      setSuccessMessage(null);
      setIsLoading(true);

      const mCode = mapping.machineCode || mapping.machine_id;
      const metCode = mapping.metricCode || mapping.metric_id;
      setRuleCode(`RULE_${mCode}_${metCode}`.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase());
      setRuleName(mapping.channel_name || `Cảnh báo ${metCode} cho ${mCode}`);

      apiClient
        .getThresholds(mapping.id)
        .then((res) => {
          const t = res.thresholds;
          if (t && (t.warning_min !== null || t.warning_max !== null || t.critical_min !== null || t.critical_max !== null)) {
            setHasExistingThresholds(true);
            setWarningMin(t.warning_min !== null ? String(t.warning_min) : '');
            setWarningMax(t.warning_max !== null ? String(t.warning_max) : '');
            setCriticalMin(t.critical_min !== null ? String(t.critical_min) : '');
            setCriticalMax(t.critical_max !== null ? String(t.critical_max) : '');
            if (t.action_plan) setRuleName(t.action_plan);

            // Tự động nhận diện loại rule
            if (t.warning_min !== null && t.warning_max !== null) {
              setRuleType('THRESHOLD_RANGE');
            } else if (t.warning_min !== null || t.critical_min !== null) {
              setRuleType('THRESHOLD_LT');
            } else {
              setRuleType('THRESHOLD_GT');
            }
          } else {
            setHasExistingThresholds(false);
            setWarningMin('');
            setWarningMax('');
            setCriticalMin('');
            setCriticalMax('');
            setRuleType('THRESHOLD_GT');
          }
        })
        .catch((err: any) => {
          console.warn('[Get Thresholds Error]:', err);
          setError(err.message || 'Lỗi khi tải cấu hình ngưỡng từ Backend.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, mapping]);

  if (!isOpen || !mapping) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let wMin: number | null = null;
    let wMax: number | null = null;
    let cMin: number | null = null;
    let cMax: number | null = null;

    if (ruleType === 'THRESHOLD_GT') {
      wMax = warningMax.trim() !== '' ? Number(warningMax) : null;
      cMax = criticalMax.trim() !== '' ? Number(criticalMax) : null;
      if (wMax === null && cMax === null) {
        setError('Vui lòng nhập ít nhất một giá trị ngưỡng trên (Warning Max hoặc Critical Max).');
        return;
      }
      if (wMax !== null && cMax !== null && wMax >= cMax) {
        setError(`Ngưỡng Warning Max (${wMax}) phải nhỏ hơn Critical Max (${cMax}).`);
        return;
      }
    } else if (ruleType === 'THRESHOLD_LT') {
      wMin = warningMin.trim() !== '' ? Number(warningMin) : null;
      cMin = criticalMin.trim() !== '' ? Number(criticalMin) : null;
      if (wMin === null && cMin === null) {
        setError('Vui lòng nhập ít nhất một giá trị ngưỡng dưới (Warning Min hoặc Critical Min).');
        return;
      }
      if (wMin !== null && cMin !== null && cMin >= wMin) {
        setError(`Ngưỡng Critical Min (${cMin}) phải nhỏ hơn Warning Min (${wMin}).`);
        return;
      }
    } else {
      // THRESHOLD_RANGE
      wMin = warningMin.trim() !== '' ? Number(warningMin) : null;
      wMax = warningMax.trim() !== '' ? Number(warningMax) : null;
      cMin = criticalMin.trim() !== '' ? Number(criticalMin) : null;
      cMax = criticalMax.trim() !== '' ? Number(criticalMax) : null;

      if (wMin === null && wMax === null && cMin === null && cMax === null) {
        setError('Vui lòng nhập các giá trị ngưỡng cảnh báo hai phía.');
        return;
      }
      if (wMin !== null && wMax !== null && wMin >= wMax) {
        setError(`Ngưỡng Warning Min (${wMin}) phải nhỏ hơn Warning Max (${wMax}).`);
        return;
      }
      if (cMin !== null && wMin !== null && cMin >= wMin) {
        setError(`Ngưỡng Critical Min (${cMin}) phải nhỏ hơn Warning Min (${wMin}).`);
        return;
      }
      if (wMax !== null && cMax !== null && wMax >= cMax) {
        setError(`Ngưỡng Warning Max (${wMax}) phải nhỏ hơn Critical Max (${cMax}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        warning_min: wMin,
        warning_max: wMax,
        critical_min: cMin,
        critical_max: cMax,
        action_plan: ruleName.trim() || undefined,
      };

      const res = await apiClient.setThresholds(mapping.id, payload);
      setSuccessMessage(res.message || 'Cập nhật ngưỡng cảnh báo thành công!');

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('[Set Thresholds Error]:', err);
      setError(err.message || 'Lỗi khi lưu ngưỡng cảnh báo vào CSDL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen && !!mapping} onClose={onClose}>
      <div
        className="w-full max-w-[700px] bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cấu hình ngưỡng cảnh báo
            </h3>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dải thông tin Metadata (Chuẩn Ảnh mẫu 4) */}
        <div className="grid grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-white/[0.02] px-4 py-2.5 text-[11px]">
          <div className="px-3">
            <span className="text-slate-400 block font-bold text-[10px]">THIẾT BỊ</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">
              {mapping.machineCode || mapping.machine_id}
            </span>
          </div>
          <div className="px-3">
            <span className="text-slate-400 block font-bold text-[10px]">THÔNG SỐ</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">
              {mapping.metricCode || mapping.mapping_code}
            </span>
          </div>
          <div className="px-3">
            <span className="text-slate-400 block font-bold text-[10px]">ĐƠN VỊ</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white block">
              {mapping.unit || '—'}
            </span>
          </div>
          <div className="px-3">
            <span className="text-slate-400 block font-bold text-[10px]">HIỆN TẠI</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
              {currentMetricValue !== null ? currentMetricValue.toFixed(1) : 'Chưa có dữ liệu'}
            </span>
          </div>
        </div>

        {/* Body Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Banner thông tin hướng dẫn xanh dương (Chuẩn Ảnh mẫu 4) */}
          <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300 text-xs leading-relaxed">
            {hasExistingThresholds ? (
              <span>
                Thông số này <strong>đã có ngưỡng cảnh báo</strong> trong CSDL. Bạn có thể điều chỉnh giá trị Warning và Critical bên dưới để cập nhật quy tắc giám sát.
              </span>
            ) : (
              <span>
                Thông số này <strong>chưa có ngưỡng cảnh báo</strong> — hệ thống vẫn thu thập và lưu lịch sử, nhưng không sinh Alert. Đặt ngưỡng bên dưới để bật cảnh báo tự động.
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Mã rule * */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Mã rule *
            </label>
            <input
              type="text"
              value={ruleCode}
              onChange={(e) => setRuleCode(e.target.value.toUpperCase())}
              placeholder="VD: RULE_PRS01_PRESSURE"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 2. Tên gợi nhớ * */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tên gợi nhớ *
            </label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="VD: Áp suất dầu xi lanh thủy lực vượt định mức"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 3. Loại rule */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Loại rule
            </label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="THRESHOLD_GT">THRESHOLD_GT (Vượt ngưỡng trên — High Alarm: quá áp, quá nhiệt)</option>
              <option value="THRESHOLD_LT">THRESHOLD_LT (Tụt ngưỡng dưới — Low Alarm: mất áp, tụt mức dầu)</option>
              <option value="THRESHOLD_RANGE">THRESHOLD_RANGE (Giới hạn khoảng hai phía — Min & Max)</option>
            </select>
          </div>

          {/* ========================================================================= */}
          {/* HAI KHỐI CẤU HÌNH NGƯỠNG: WARNING (VÀNG) & CRITICAL (ĐỎ) - CHUẨN ẢNH MẪU 4 */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Khối NGƯỠNG WARNING (Vàng hổ phách) */}
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>NGƯỠNG WARNING</span>
              </div>

              {ruleType === 'THRESHOLD_GT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Toán tử
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 text-center">
                      GT (&gt;)
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Giá trị ({mapping.unit || 'đv'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={warningMax}
                      onChange={(e) => setWarningMax(e.target.value)}
                      placeholder="VD: 80.0"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'THRESHOLD_LT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Toán tử
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 text-center">
                      LT (&lt;)
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Giá trị ({mapping.unit || 'đv'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={warningMin}
                      onChange={(e) => setWarningMin(e.target.value)}
                      placeholder="VD: 20.0"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'THRESHOLD_RANGE' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Warning Min</label>
                      <input
                        type="number"
                        step="any"
                        value={warningMin}
                        onChange={(e) => setWarningMin(e.target.value)}
                        placeholder="Min"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Warning Max</label>
                      <input
                        type="number"
                        step="any"
                        value={warningMax}
                        onChange={(e) => setWarningMax(e.target.value)}
                        placeholder="Max"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Khối NGƯỠNG CRITICAL (Đỏ) */}
            <div className="rounded-2xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/60 dark:bg-rose-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>NGƯỠNG CRITICAL</span>
              </div>

              {ruleType === 'THRESHOLD_GT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Toán tử
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 text-xs font-mono font-bold text-rose-700 dark:text-rose-400 text-center">
                      GT (&gt;)
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Giá trị ({mapping.unit || 'đv'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={criticalMax}
                      onChange={(e) => setCriticalMax(e.target.value)}
                      placeholder="VD: 95.0"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'THRESHOLD_LT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Toán tử
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 text-xs font-mono font-bold text-rose-700 dark:text-rose-400 text-center">
                      LT (&lt;)
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Giá trị ({mapping.unit || 'đv'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={criticalMin}
                      onChange={(e) => setCriticalMin(e.target.value)}
                      placeholder="VD: 10.0"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}

              {ruleType === 'THRESHOLD_RANGE' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Critical Min</label>
                      <input
                        type="number"
                        step="any"
                        value={criticalMin}
                        onChange={(e) => setCriticalMin(e.target.value)}
                        placeholder="Min"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Critical Max</label>
                      <input
                        type="number"
                        step="any"
                        value={criticalMax}
                        onChange={(e) => setCriticalMax(e.target.value)}
                        placeholder="Max"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Modal */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{hasExistingThresholds ? 'Cập nhật ngưỡng' : 'Tạo ngưỡng cảnh báo'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
