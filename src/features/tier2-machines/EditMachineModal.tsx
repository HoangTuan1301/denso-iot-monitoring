/**
 * @file EditMachineModal.tsx
 * @description Modal Thông tin & Chỉnh sửa thiết bị máy móc (DENSO IoT - Chuẩn công nghiệp)
 * - Chiều rộng desktop 680px (650-720px), căn giữa, backdrop tối mờ nhẹ (blur 3px)
 * - Tải chính xác thông tin của thiết bị được chọn
 * - Mã Component & Dây chuyền ở chế độ chỉ đọc (Read-only) kèm giải thích bảo toàn toàn vẹn dữ liệu
 * - Cho phép chỉnh sửa an toàn: Tên thiết bị, Loại thiết bị, Vị trí xưởng, Mô tả kỹ thuật, Trạng thái quản lý (active/inactive)
 * - Gọi trực tiếp API PUT /api/machines/:id, không xóa/tạo lại máy, không mất mapping hay telemetry
 * - Độc lập hoàn toàn với chu kỳ WebSocket và background store updates (chống lỗi tự reset form)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Edit3, X, AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { MachineComponent } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { ModalPortal } from '../../components/common/ModalPortal';

interface EditMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineComponent | null;
  lineName?: string;
  onUpdated?: () => void;
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

export function EditMachineModal({
  isOpen,
  onClose,
  machine,
  lineName,
  onUpdated,
}: EditMachineModalProps) {
  const { updateMachine } = useMonitoringStore();

  const [name, setName] = useState('');
  const [type, setType] = useState('general');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [managementStatus, setManagementStatus] = useState<'active' | 'inactive'>('active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  // Lưu lại giá trị ban đầu để kiểm tra dirty state
  const initialValuesRef = useRef({
    name: '',
    type: 'general',
    location: '',
    description: '',
    managementStatus: 'active' as 'active' | 'inactive',
  });

  // Khóa cuộn trang chính khi modal mở
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Khởi tạo form CHỈ KHI modal chuyển từ ĐÓNG (false) sang MỞ (true)
  // Tuyệt đối không reset khi WebSocket phát packet hay telemetry store re-render
  useEffect(() => {
    if (isOpen && !wasOpenRef.current && machine) {
      const initName = machine.name || '';
      const initType = machine.type || 'general';
      const initLocation = machine.location || '';
      const initDesc = machine.description || '';
      const initMgmt = machine.managementStatus || 'active';

      setName(initName);
      setType(initType);
      setLocation(initLocation);
      setDescription(initDesc);
      setManagementStatus(initMgmt);

      initialValuesRef.current = {
        name: initName,
        type: initType,
        location: initLocation,
        description: initDesc,
        managementStatus: initMgmt,
      };

      setErrorMessage(null);
      setSuccessMessage(null);

      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);

      wasOpenRef.current = true;
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, machine]);

  // Kiểm tra dữ liệu form có thay đổi so với ban đầu không
  const isDirty =
    name !== initialValuesRef.current.name ||
    type !== initialValuesRef.current.type ||
    location !== initialValuesRef.current.location ||
    description !== initialValuesRef.current.description ||
    managementStatus !== initialValuesRef.current.managementStatus;

  // Đóng modal an toàn: Cảnh báo nếu form đã chỉnh sửa
  const handleSafeClose = useCallback(() => {
    if (isSubmitting) return;

    if (isDirty) {
      const confirmed = window.confirm(
        'Bạn có các thay đổi chưa được lưu. Bạn có chắc chắn muốn đóng và hủy bỏ thay đổi không?'
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
    if (!machine || isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Tên thiết bị không được để trống.');
      firstInputRef.current?.focus();
      return;
    }

    try {
      setIsSubmitting(true);

      await updateMachine(machine.id, {
        name: trimmedName,
        type,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        managementStatus,
      });

      setSuccessMessage(`Đã cập nhật thông tin thiết bị ${trimmedName} thành công!`);

      setTimeout(() => {
        onUpdated?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('[Update Machine Error]:', err);
      const msg =
        err.data?.message ||
        err.message ||
        (typeof err === 'string' ? err : 'Không thể cập nhật thông tin thiết bị.');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !machine) return null;

  return (
    <ModalPortal isOpen={isOpen && !!machine} onClose={handleSafeClose}>
      {/* Container Modal (Chuẩn chiều rộng 680px, max-height 88vh) */}
      <div
        className="w-full max-w-[680px] max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-edit-device-title"
      >
        {/* ========================================================================= */}
        {/* HEADER CỐ ĐỊNH                                                            */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="modal-edit-device-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2"
              >
                <span>Thông tin & Chỉnh sửa thiết bị</span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {machine.code || machine.id}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                Cập nhật thông số vận hành và mô tả kỹ thuật của thiết bị
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
        {/* BODY CUỘN ĐỘC LẬP                                                         */}
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

          {/* Hàng 1: Mã Component & Dây chuyền sản xuất (READ-ONLY BẢO VỆ TOÀN VẸN) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span>Mã thiết bị (Component Code)</span>
                <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={machine.code || machine.id}
                  disabled
                  className="w-full text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 p-2.5 cursor-not-allowed uppercase"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Mã định danh kỹ thuật cố định để đảm bảo toàn vẹn dữ liệu đo lường.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span>Dây chuyền sản xuất</span>
                <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={lineName ? `[${machine.lineId}] ${lineName}` : `Dây chuyền ${machine.lineId}`}
                  disabled
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 p-2.5 cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Liên kết cố định để kế thừa trạm PLC của dây chuyền và metric mapping.
              </p>
            </div>
          </div>

          {/* Hàng 2: Tên thiết bị (EDITABLE) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tên thiết bị <span className="text-rose-500">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Máy dập thủy lực 500T Komatsu"
              disabled={isSubmitting}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 font-semibold"
              required
            />
          </div>

          {/* Hàng 3: Loại thiết bị & Vị trí xưởng (EDITABLE) */}
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
                placeholder="VD: Trạm dập dầm ngang A1 - Xưởng 1"
                disabled={isSubmitting}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Hàng 4: Mô tả kỹ thuật / Ghi chú (EDITABLE) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Mô tả kỹ thuật / Ghi chú
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Máy gia công áp lực cao, đã hiệu chuẩn kỳ kiểm tra gần nhất"
              disabled={isSubmitting}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 resize-none"
            />
          </div>

          {/* Hàng 5: Trạng thái Quản lý & Trạng thái Giám sát */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Trạng thái quản lý thiết bị:
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                    <input
                      type="radio"
                      name="editManagementStatus"
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
                      name="editManagementStatus"
                      value="inactive"
                      checked={managementStatus === 'inactive'}
                      onChange={() => setManagementStatus('inactive')}
                      className="accent-slate-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Ngừng sử dụng (Inactive)</span>
                  </label>
                </div>
              </div>

              {/* Trạng thái giám sát (Chỉ đọc) */}
              <div className="text-left sm:text-right">
                <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Trạng thái giám sát:
                </span>
                <div className="mt-1 flex items-center sm:justify-end gap-1.5">
                  {(() => {
                    const s = (machine.status || '').toLowerCase();
                    if (s === 'critical') {
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30">
                          Nguy hiểm
                        </span>
                      );
                    }
                    if (s === 'warning') {
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                          Cảnh báo
                        </span>
                      );
                    }
                    if (s === 'normal') {
                      return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                          Bình thường
                        </span>
                      );
                    }
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                        Chưa có dữ liệu
                      </span>
                    );
                  })()}
                  {machine.healthScore !== null && machine.healthScore !== undefined && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      ({machine.healthScore}%)
                    </span>
                  )}
                </div>
              </div>
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
                <span>Đang lưu thay đổi...</span>
              </>
            ) : (
              <span>Lưu thay đổi</span>
            )}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
