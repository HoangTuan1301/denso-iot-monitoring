/**
 * @file CreateMachineModal.tsx
 * @description Modal thêm thiết bị máy móc mới vào Dây chuyền sản xuất (Chuẩn UI/UX DENSO IoT)
 * - Thiết kế layout công nghiệp hiện đại, chiều rộng 680px (650-720px), max-height 88vh
 * - Lớp nền backdrop màu đen bán trong suốt có backdrop-filter: blur(3px)
 * - Header & Footer cố định, Body cuộn độc lập khi nội dung dài
 * - Không hiển thị khối PLC lặp lại (Backend tự liên kết theo Dây chuyền đã chọn)
 * - Tách biệt Trạng thái quản lý (active/inactive) và Trạng thái giám sát (Chưa có dữ liệu / UNKNOWN)
 * - Khóa cuộn trang chính, xử lý phím Escape, cảnh báo xác nhận khi click backdrop nếu form đã nhập dữ liệu
 * - Gọi trực tiếp API REST POST /api/machines với đầy đủ JWT Bearer token và xử lý lỗi chi tiết
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { ProductionLine } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { ModalPortal } from '../../components/common/ModalPortal';

interface CreateMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: ProductionLine[];
  defaultLineId?: string;
  onCreated?: () => void;
}

const COMMON_MACHINE_TYPES = [
  { key: 'stamping', label: 'Máy dập thủy lực / dập phôi (Stamping)' },
  { key: 'welding', label: 'Robot hàn / Trạm hàn tự động (Welding)' },
  { key: 'coating', label: 'Buồng sơn tĩnh điện / buồng sấy (Coating)' },
  { key: 'assembly', label: 'Trạm siết bulong / trạm ép vòng bi (Assembly)' },
  { key: 'inspection', label: 'Máy đo kích thước quang học / Test rò rỉ (Inspection)' },
  { key: 'feeder', label: 'Hệ thống cấp phôi / gắp phôi tự động (Feeder)' },
  { key: 'general', label: 'Thiết bị phụ trợ / Máy gia công chung (General)' },
];

export function CreateMachineModal({
  isOpen,
  onClose,
  lines,
  defaultLineId,
  onCreated,
}: CreateMachineModalProps) {
  const { createMachine } = useMonitoringStore();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [lineId, setLineId] = useState(defaultLineId || lines[0]?.id || 'LINE-01');
  const [type, setType] = useState('stamping');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [managementStatus, setManagementStatus] = useState<'active' | 'inactive'>('active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  // Kiểm tra form có đang chứa dữ liệu người dùng đã nhập hay không (dirty state)
  const isDirty = Boolean(name.trim() || code.trim() || location.trim() || description.trim());

  // Khóa cuộn trang chính khi modal đang mở
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Khởi tạo/Reset form CHỈ KHI modal chuyển từ ĐÓNG (false) sang MỞ (true)
  // Tuyệt đối không reset khi lines, telemetry hay store cập nhật ngầm trong nền
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setLineId(defaultLineId || lines[0]?.id || 'LINE-01');
      setName('');
      setCode('');
      setType('stamping');
      setLocation('');
      setDescription('');
      setManagementStatus('active');
      setErrorMessage(null);
      setSuccessMessage(null);

      // Tự động focus vào trường Tên thiết bị
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);

      wasOpenRef.current = true;
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  // Đóng an toàn có hỏi xác nhận nếu form đã nhập dữ liệu
  const handleSafeClose = useCallback(() => {
    if (isSubmitting) return;

    if (isDirty) {
      const confirmed = window.confirm(
        'Bạn có các thông tin thiết bị chưa lưu. Bạn có chắc chắn muốn hủy bỏ không?'
      );
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, isSubmitting, onClose]);

  // Xử lý phím Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSafeClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSafeClose]);


  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    // 1. Validation Dây chuyền
    if (!lineId) {
      setErrorMessage('Vui lòng chọn Dây chuyền sản xuất tiếp nhận thiết bị.');
      return;
    }

    // 2. Validation Tên thiết bị
    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập Tên thiết bị.');
      firstInputRef.current?.focus();
      return;
    }

    // 3. Validation Mã thiết bị
    if (!trimmedCode) {
      setErrorMessage('Vui lòng nhập Mã thiết bị duy nhất.');
      return;
    }

    if (!/^[A-Z0-9\-_]+$/i.test(trimmedCode)) {
      setErrorMessage(
        'Mã thiết bị chỉ được chứa chữ cái, số, dấu gạch nối (-) hoặc gạch dưới (_).'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      // Gửi request tạo máy mới: Trạng thái giám sát khởi tạo là 'no_data' (Chưa có dữ liệu)
      await createMachine({
        lineId,
        name: trimmedName,
        code: trimmedCode,
        type,
        status: 'no_data',
        managementStatus,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });

      setSuccessMessage(
        `Đã tạo thành công thiết bị ${trimmedName} (${trimmedCode}) vào dây chuyền!`
      );

      setTimeout(() => {
        onCreated?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('[Create Device Error]:', err);
      const msg =
        err.data?.message ||
        err.message ||
        (typeof err === 'string' ? err : 'Không thể tạo mới thiết bị. Vui lòng kiểm tra lại quyền truy cập hoặc kết nối.');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal isOpen={isOpen} onClose={handleSafeClose}>
      {/* Container Modal (Chuẩn chiều rộng 650-720px, max-height 88vh, border & shadow tinh tế) */}
      <div
        className="w-full max-w-[680px] max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-add-device-title"
      >
        {/* ========================================================================= */}
        {/* HEADER CỐ ĐỊNH                                                            */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="modal-add-device-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight"
              >
                Thêm thiết bị mới
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                Đăng ký thiết bị vào dây chuyền sản xuất
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BODY CUỘN ĐỘC LẬP KHI DÀI                                                 */}
        {/* ========================================================================= */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Thông báo lỗi */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* Thông báo thành công */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Trường 1: Dây chuyền sản xuất (Bắt buộc) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Dây chuyền sản xuất <span className="text-rose-500">*</span>
            </label>
            <select
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              required
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  [{l.code}] {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Trường 2 & 3: Tên thiết bị & Mã thiết bị (Layout 2 cột trên Desktop, 1 cột Mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tên thiết bị <span className="text-rose-500">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Robot Hàn Khung Cửa 02"
                disabled={isSubmitting}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Mã thiết bị (duy nhất) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: ROB-WLD-02"
                disabled={isSubmitting}
                className="w-full text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase disabled:opacity-60"
                required
              />
            </div>
          </div>

          {/* Trường 4 & 5: Loại thiết bị & Vị trí (Layout 2 cột trên Desktop, 1 cột Mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Loại thiết bị
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={isSubmitting}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              >
                {COMMON_MACHINE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Vị trí xưởng
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="VD: Trạm gia công A4 - Xưởng 1"
                disabled={isSubmitting}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Trường 6: Mô tả kỹ thuật / Ghi chú */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Mô tả kỹ thuật / Ghi chú
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Robot hàn điểm Fanuc R-2000iC, buồng nén áp lực cao"
              disabled={isSubmitting}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            />
          </div>

          {/* Phân định Trạng thái: Quản lý thiết bị & Giám sát */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Trạng thái quản lý thiết bị:
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="radio"
                    name="managementStatus"
                    value="active"
                    checked={managementStatus === 'active'}
                    onChange={() => setManagementStatus('active')}
                    className="accent-emerald-600 w-4 h-4 cursor-pointer"
                  />
                  <span>Đang sử dụng (Active)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                  <input
                    type="radio"
                    name="managementStatus"
                    value="inactive"
                    checked={managementStatus === 'inactive'}
                    onChange={() => setManagementStatus('inactive')}
                    className="accent-slate-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Ngừng sử dụng (Inactive)</span>
                </label>
              </div>
            </div>

            {/* Trạng thái giám sát khởi tạo */}
            <div className="flex items-start gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 shrink-0 text-blue-500 mt-0.5" />
              <span>
                <strong>Trạng thái giám sát khởi tạo:</strong> <span className="font-semibold text-slate-700 dark:text-slate-300">Chưa có dữ liệu (UNKNOWN)</span>. Hệ thống không giả lập trạng thái Bình thường mà sẽ tự động cập nhật khi có dữ liệu đo lường thực tế từ tệp tin hoặc trạm PLC.
              </span>
            </div>
          </div>
        </form>

        {/* ========================================================================= */}
        {/* FOOTER CỐ ĐỊNH                                                            */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>Lưu thiết bị</span>
            )}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
