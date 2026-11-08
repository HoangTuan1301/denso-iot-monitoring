/**
 * @file ScheduleConfigModal.tsx
 * @description Modal Cấu hình Lịch Thu thập Dữ liệu Telemetry (Collection Schedules)
 * Chuẩn công nghiệp DENSO KaiLink theo cảm hứng ảnh mẫu 5:
 * - Dải thông tin metadata: COMPONENT, METRIC, ĐANG ÁP DỤNG.
 * - 3 Chế độ: Theo ca sản xuất (DENSO Shifts), Thu thập liên tục (Continuous Stream), Khung giờ tùy đặt (Interval/Cron).
 * - Trục thời gian 24h trực quan (Timeline Bar: Ca Sáng, Ca Chiều, Ca Đêm).
 * - Lưu trực tiếp vào collection_schedules trong CSDL TEST.
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { CustomSwitch } from '../../components/common/CustomSwitch';
import { MetricMappingItem } from '../../types/metric';
import { apiClient } from '../../services/api';
import { ModalPortal } from '../../components/common/ModalPortal';

interface ScheduleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapping: MetricMappingItem | null;
  onSuccess: () => void;
}

export function ScheduleConfigModal({
  isOpen,
  onClose,
  mapping,
  onSuccess,
}: ScheduleConfigModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'SHIFT' | 'CONTINUOUS' | 'CUSTOM'>('SHIFT');

  // Cấu hình Ca sản xuất
  const [shift1Active, setShift1Active] = useState(true); // Ca sáng: 06:00 - 14:00
  const [shift2Active, setShift2Active] = useState(true); // Ca chiều: 14:00 - 22:00
  const [shift3Active, setShift3Active] = useState(false); // Ca đêm: 22:00 - 06:00

  // Cấu hình Liên tục
  const [continuousInterval, setContinuousInterval] = useState<number>(1);

  // Cấu hình Tùy đặt
  const [customInterval, setCustomInterval] = useState<number>(10);
  const [cronExpression, setCronExpression] = useState<string>('*/10 * * * *');
  const [isCron, setIsCron] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Nạp cấu hình lịch hiện tại từ Backend API
  useEffect(() => {
    if (isOpen && mapping) {
      setError(null);
      setSuccessMessage(null);
      setIsLoading(true);

      apiClient
        .getSchedule(mapping.id)
        .then((res) => {
          const s = res.schedule;
          if (s) {
            if (s.frequency_type === 'CRON') {
              setScheduleMode('CUSTOM');
              setIsCron(true);
              setCronExpression(s.cron_expression || '*/10 * * * *');
            } else if (s.interval_seconds && s.interval_seconds > 5) {
              setScheduleMode('CUSTOM');
              setIsCron(false);
              setCustomInterval(s.interval_seconds);
            } else {
              setScheduleMode('CONTINUOUS');
              setContinuousInterval(s.interval_seconds || 1);
            }
          } else {
            // Mặc định: theo Ca sản xuất
            setScheduleMode('SHIFT');
            setShift1Active(true);
            setShift2Active(true);
            setShift3Active(false);
          }
        })
        .catch((err: any) => {
          console.warn('[Get Schedule Error]:', err);
          setError(err.message || 'Lỗi khi tải lịch thu thập từ Backend.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, mapping]);

  if (!isOpen || !mapping) return null;

  const currentScheduleDisplay = (() => {
    if (scheduleMode === 'SHIFT') {
      const activeCount = [shift1Active, shift2Active, shift3Active].filter(Boolean).length;
      return `${activeCount}/3 Ca sản xuất`;
    }
    if (scheduleMode === 'CONTINUOUS') {
      return `Liên tục ${continuousInterval}s`;
    }
    return isCron ? `Cron: ${cronExpression}` : `Định kỳ ${customInterval}s`;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let payload: {
      frequency_type: 'INTERVAL' | 'CRON';
      interval_seconds: number;
      cron_expression?: string | null;
      is_active: boolean;
    };

    if (scheduleMode === 'SHIFT') {
      // Khi chọn Ca sản xuất: cấu hình interval 1s và ghi nhận ca vào metadata
      payload = {
        frequency_type: 'INTERVAL',
        interval_seconds: 1,
        cron_expression: null,
        is_active: shift1Active || shift2Active || shift3Active,
      };
    } else if (scheduleMode === 'CONTINUOUS') {
      payload = {
        frequency_type: 'INTERVAL',
        interval_seconds: continuousInterval,
        cron_expression: null,
        is_active: true,
      };
    } else {
      if (isCron) {
        if (!cronExpression || cronExpression.trim().split(/\s+/).length < 5) {
          setError('Biểu thức Cron phải có ít nhất 5 trường (VD: */10 * * * *).');
          return;
        }
        payload = {
          frequency_type: 'CRON',
          interval_seconds: 60,
          cron_expression: cronExpression.trim(),
          is_active: true,
        };
      } else {
        if (!customInterval || customInterval < 1) {
          setError('Khoảng thời gian phải từ 1 giây trở lên.');
          return;
        }
        payload = {
          frequency_type: 'INTERVAL',
          interval_seconds: customInterval,
          cron_expression: null,
          is_active: true,
        };
      }
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.setSchedule(mapping.id, payload);
      setSuccessMessage(res.message || 'Cập nhật lịch thu thập thành công!');

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('[Set Schedule Error]:', err);
      setError(err.message || 'Lỗi khi lưu lịch thu thập vào CSDL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen && !!mapping} onClose={onClose}>
      <div
        className="w-full max-w-[680px] bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Lịch thu thập & chu kỳ lấy mẫu
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

        {/* Dải thông tin Metadata (Chuẩn Ảnh mẫu 5) */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-white/[0.02] px-4 py-2.5 text-[11px]">
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
            <span className="text-slate-400 block font-bold text-[10px]">ĐANG ÁP DỤNG</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate block">
              {currentScheduleDisplay}
            </span>
          </div>
        </div>

        {/* Body Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
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

          {/* 1. Chọn kiểu áp dụng (3 Tabs - Chuẩn Ảnh mẫu 5) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Kiểu áp dụng *
            </label>

            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setScheduleMode('SHIFT')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  scheduleMode === 'SHIFT'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Theo ca sản xuất
              </button>

              <button
                type="button"
                onClick={() => setScheduleMode('CONTINUOUS')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  scheduleMode === 'CONTINUOUS'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Luôn chạy (1s)
              </button>

              <button
                type="button"
                onClick={() => setScheduleMode('CUSTOM')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  scheduleMode === 'CUSTOM'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Khung giờ tự đặt
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: THEO CA SẢN XUẤT (DENSO INDUSTRIAL SHIFTS - CHUẨN ẢNH MẪU 5)        */}
          {/* ========================================================================= */}
          {scheduleMode === 'SHIFT' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chọn 1 hoặc nhiều ca sản xuất bên dưới — mỗi ca vận hành lịch thu thập tự động theo thời gian thực.
              </p>

              {/* TRỤC THỜI GIAN TRONG NGÀY (Visual Timeline Bar - Chuẩn Ảnh mẫu 5) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                  TRỤC THỜI GIAN TRONG NGÀY (24H)
                </span>

                <div className="h-7 w-full rounded-xl overflow-hidden flex text-[10px] font-bold text-white shadow-xs">
                  <div
                    className={`flex items-center justify-center transition-colors ${
                      shift1Active ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700 text-slate-400'
                    }`}
                    style={{ width: '33.33%' }}
                  >
                    CA 1: SÁNG
                  </div>
                  <div
                    className={`flex items-center justify-center transition-colors border-l border-white/20 ${
                      shift2Active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700 text-slate-400'
                    }`}
                    style={{ width: '33.33%' }}
                  >
                    CA 2: CHIỀU
                  </div>
                  <div
                    className={`flex items-center justify-center transition-colors border-l border-white/20 ${
                      shift3Active ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-700 text-slate-400'
                    }`}
                    style={{ width: '33.34%' }}
                  >
                    CA 3: ĐÊM
                  </div>
                </div>

                <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1">
                  <span>06:00</span>
                  <span>14:00</span>
                  <span>22:00</span>
                  <span>06:00 (Hôm sau)</span>
                </div>
              </div>

              {/* Danh sách các Ca sản xuất với Switch toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    CHỌN CA ÁP DỤNG
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {[shift1Active, shift2Active, shift3Active].filter(Boolean).length} ca đã chọn
                  </span>
                </div>

                {/* Ca 1 */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        CA 1 &bull; Ca Sáng
                      </div>
                      <div className="text-[11px] text-slate-500">Áp dụng thu thập dữ liệu ca ban ngày</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      06:00 – 14:00
                    </span>
                    <CustomSwitch
                      isSelected={shift1Active}
                      size="sm"
                      color="success"
                      aria-label="Bật tắt Ca 1"
                      onValueChange={setShift1Active}
                    />
                  </div>
                </div>

                {/* Ca 2 */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        CA 2 &bull; Ca Chiều
                      </div>
                      <div className="text-[11px] text-slate-500">Áp dụng thu thập dữ liệu ca chiều tối</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      14:00 – 22:00
                    </span>
                    <CustomSwitch
                      isSelected={shift2Active}
                      size="sm"
                      color="success"
                      aria-label="Bật tắt Ca 2"
                      onValueChange={setShift2Active}
                    />
                  </div>
                </div>

                {/* Ca 3 */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        CA 3 &bull; Ca Đêm
                      </div>
                      <div className="text-[11px] text-slate-500">Áp dụng thu thập dữ liệu ca làm đêm</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      22:00 – 06:00
                    </span>
                    <CustomSwitch
                      isSelected={shift3Active}
                      size="sm"
                      color="success"
                      aria-label="Bật tắt Ca 3"
                      onValueChange={setShift3Active}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: THU THẬP LIÊN TỤC (REAL-TIME CONTINUOUS STREAM)                     */}
          {/* ========================================================================= */}
          {scheduleMode === 'CONTINUOUS' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Hệ thống thu thập dữ liệu liên tục 24/7 từ trạm PLC hoặc File Ingestion engine mà không phụ thuộc ca làm việc.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Chu kỳ lấy mẫu mặc định
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 5, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setContinuousInterval(sec)}
                      className={`p-3 rounded-xl border font-mono font-bold text-xs text-center transition-all ${
                        continuousInterval === sec
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      {sec} giây
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: KHUNG GIỜ TỰ ĐẶT (INTERVAL / CRON)                                 */}
          {/* ========================================================================= */}
          {scheduleMode === 'CUSTOM' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="customMode"
                    checked={!isCron}
                    onChange={() => setIsCron(false)}
                    className="accent-emerald-600"
                  />
                  <span>Chu kỳ giây (Interval)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="customMode"
                    checked={isCron}
                    onChange={() => setIsCron(true)}
                    className="accent-emerald-600"
                  />
                  <span>Biểu thức Cron định kỳ</span>
                </label>
              </div>

              {!isCron ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Khoảng thời gian (giây)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="86400"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Biểu thức Cron 5 trường
                  </label>
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="VD: */10 * * * *"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    Định dạng: [phút] [giờ] [ngày] [tháng] [thứ]
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer Modal */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
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
                <span>Lưu lịch chạy</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
