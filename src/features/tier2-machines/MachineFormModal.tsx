/**
 * @file MachineFormModal.tsx
 * @description Modal đa năng Thêm mới & Chỉnh sửa thiết bị máy móc (DENSO Smart Factory)
 * - Tái sử dụng thống nhất cho cả 2 chế độ: CREATE (Thêm mới) và EDIT (Chỉnh sửa)
 * - Thiết kế công nghiệp 3 Tabs:
 *   + Tab 1: THÔNG TIN CHUNG (Dây chuyền, Mã máy, Tên máy, Loại máy, Vị trí, Mô tả, Trạng thái quản lý)
 *   + Tab 2: HÌNH ẢNH THIẾT BỊ (Xem trước ảnh CAD, Upload từ máy tính PNG/JPG/WEBP <= 5MB, Thay đổi & Xóa ảnh an toàn)
 *   + Tab 3: THÔNG SỐ KỸ THUẬT (Hãng sản xuất, Model, Serial, Ngày vận hành, Công suất định mức, Ghi chú, Thông tin PLC)
 * - Phân biệt rành mạch Management Status (Active/Inactive) và Operating Status (Giám sát vận hành)
 * - Bảo toàn Database ID, không làm gián đoạn Metric Mapping hay Telemetry đang chạy
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Edit3,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Upload,
  Trash2,
  Image as ImageIcon,
  Sliders,
  FileText,
  Info,
  Cpu,
} from 'lucide-react';
import { MachineComponent, ProductionLine } from '../../types/hierarchy';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { ModalPortal } from '../../components/common/ModalPortal';
import { MachineImage } from '../../config/machineImages';
import { apiClient } from '../../services/api';

export interface MachineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  machine?: MachineComponent | null;
  lines: ProductionLine[];
  defaultLineId?: string;
  lineName?: string;
  onSuccess?: () => void;
}

export const COMMON_MACHINE_TYPES = [
  { key: 'stamping', label: 'Máy dập thủy lực / dập phôi (Stamping)' },
  { key: 'welding', label: 'Robot hàn / Trạm hàn tự động (Welding)' },
  { key: 'coating', label: 'Buồng sơn tĩnh điện / buồng sấy (Coating)' },
  { key: 'assembly', label: 'Trạm siết bulong / trạm ép vòng bi (Assembly)' },
  { key: 'inspection', label: 'Máy đo kích thước quang học / Test rò rỉ (Inspection)' },
  { key: 'feeder', label: 'Hệ thống cấp phôi / gắp phôi tự động (Feeder)' },
  { key: 'general', label: 'Thiết bị phụ trợ / Máy gia công chung (General)' },
];

type ActiveTab = 'general' | 'image' | 'specs';

export function MachineFormModal({
  isOpen,
  onClose,
  mode,
  machine,
  lines,
  defaultLineId,
  lineName,
  onSuccess,
}: MachineFormModalProps) {
  const { createMachine, updateMachine } = useMonitoringStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('general');

  // --- TAB 1: THÔNG TIN CHUNG ---
  const [lineId, setLineId] = useState(defaultLineId || lines[0]?.id || 'LINE-01');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('stamping');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [managementStatus, setManagementStatus] = useState<'active' | 'inactive'>('active');

  // --- TAB 2: HÌNH ẢNH THIẾT BỊ ---
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- TAB 3: THÔNG SỐ KỸ THUẬT ---
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [ratedPower, setRatedPower] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');

  // Trạng thái Form & Thông báo
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  // Lưu lại snapshot ban đầu để kiểm tra isDirty
  const initialSnapshotRef = useRef<any>({});

  // Khóa cuộn trang khi mở modal
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Khởi tạo / Nạp dữ liệu khi modal chuyển từ ĐÓNG -> MỞ
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setActiveTab('general');
      setErrorMessage(null);
      setSuccessMessage(null);
      setUploadError(null);
      setUploadSuccess(null);
      setSelectedFile(null);

      if (mode === 'edit' && machine) {
        const initLineId = machine.lineId || defaultLineId || 'LINE-01';
        const initCode = machine.code || machine.id || '';
        const initName = machine.name || '';
        const initType = machine.type || 'general';
        const initLocation = machine.location || '';
        const initDesc = machine.description || '';
        const initMgmt = machine.managementStatus || 'active';

        const initImg = machine.imageUrl || null;
        const initManuf = machine.manufacturer || '';
        const initModel = machine.model || '';
        const initSerial = machine.serialNumber || '';
        const initInstallDate = machine.installationDate || '';
        const initPower = machine.ratedPower || '';
        const initTechNotes = machine.technicalNotes || '';

        setLineId(initLineId);
        setCode(initCode);
        setName(initName);
        setType(initType);
        setLocation(initLocation);
        setDescription(initDesc);
        setManagementStatus(initMgmt);

        setImageUrl(initImg);
        setImagePreview(initImg);

        setManufacturer(initManuf);
        setModel(initModel);
        setSerialNumber(initSerial);
        setInstallationDate(initInstallDate);
        setRatedPower(initPower);
        setTechnicalNotes(initTechNotes);

        initialSnapshotRef.current = {
          lineId: initLineId,
          code: initCode,
          name: initName,
          type: initType,
          location: initLocation,
          description: initDesc,
          managementStatus: initMgmt,
          imageUrl: initImg,
          manufacturer: initManuf,
          model: initModel,
          serialNumber: initSerial,
          installationDate: initInstallDate,
          ratedPower: initPower,
          technicalNotes: initTechNotes,
        };
      } else {
        // Mode CREATE
        const initLineId = defaultLineId || lines[0]?.id || 'LINE-01';
        setLineId(initLineId);
        setCode('');
        setName('');
        setType('stamping');
        setLocation('');
        setDescription('');
        setManagementStatus('active');

        setImageUrl(null);
        setImagePreview(null);

        setManufacturer('');
        setModel('');
        setSerialNumber('');
        setInstallationDate('');
        setRatedPower('');
        setTechnicalNotes('');

        initialSnapshotRef.current = {
          lineId: initLineId,
          code: '',
          name: '',
          type: 'stamping',
          location: '',
          description: '',
          managementStatus: 'active',
          imageUrl: null,
          manufacturer: '',
          model: '',
          serialNumber: '',
          installationDate: '',
          ratedPower: '',
          technicalNotes: '',
        };
      }

      // Tự động focus vào ô Tên thiết bị
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);

      wasOpenRef.current = true;
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, mode, machine, defaultLineId, lines]);

  // Kiểm tra form có thay đổi so với snapshot ban đầu không
  const isDirty =
    name !== initialSnapshotRef.current.name ||
    (mode === 'create' && (code !== initialSnapshotRef.current.code || lineId !== initialSnapshotRef.current.lineId)) ||
    type !== initialSnapshotRef.current.type ||
    location !== initialSnapshotRef.current.location ||
    description !== initialSnapshotRef.current.description ||
    managementStatus !== initialSnapshotRef.current.managementStatus ||
    imageUrl !== initialSnapshotRef.current.imageUrl ||
    selectedFile !== null ||
    manufacturer !== initialSnapshotRef.current.manufacturer ||
    model !== initialSnapshotRef.current.model ||
    serialNumber !== initialSnapshotRef.current.serialNumber ||
    installationDate !== initialSnapshotRef.current.installationDate ||
    ratedPower !== initialSnapshotRef.current.ratedPower ||
    technicalNotes !== initialSnapshotRef.current.technicalNotes;

  // Đóng modal an toàn (hỏi xác nhận nếu form đã chỉnh sửa)
  const handleSafeClose = useCallback(() => {
    if (isSubmitting || isUploadingImage) return;

    if (isDirty) {
      const confirmed = window.confirm(
        'Bạn có các thông tin thiết bị chưa lưu. Bạn có chắc chắn muốn đóng và hủy bỏ không?'
      );
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, isSubmitting, isUploadingImage, onClose]);

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

  // --- XỬ LÝ CHỌN VÀ TẢI ẢNH THIẾT BỊ ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    // 1. Kiểm tra kích thước file (tối đa 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('Dung lượng tệp vượt quá giới hạn cho phép (tối đa 5MB).');
      return;
    }

    // 2. Kiểm tra định dạng ảnh (PNG, JPG, JPEG, WEBP)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setUploadError('Chỉ hỗ trợ tệp ảnh định dạng PNG, JPG, JPEG hoặc WEBP.');
      return;
    }

    setSelectedFile(file);

    // Tạo blob preview ngay lập tức
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Nếu đang ở chế độ Edit hoặc có backend upload, tải trực tiếp lên server
    try {
      setIsUploadingImage(true);
      const res = await apiClient.uploadMachineImage(file, machine?.id);
      setImageUrl(res.imageUrl);
      setUploadSuccess(`Đã tải lên ảnh thiết bị thành công (${Math.round(file.size / 1024)} KB)`);
    } catch (err: any) {
      console.warn('[Upload Image Warning]:', err);
      // Nếu server chưa hỗ trợ hoặc offline, giữ preview blob tạm thời
      setUploadError(
        err.message || 'Không thể tải ảnh lên máy chủ. Ảnh sẽ được lưu khi gửi form.'
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Xóa ảnh thiết bị
  const handleRemoveImage = () => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn xóa ảnh tùy chỉnh này và khôi phục ảnh CAD mặc định của DENSO?'
    );
    if (!confirmed) return;

    setSelectedFile(null);
    setImageUrl(null);
    setImagePreview(null);
    setUploadError(null);
    setUploadSuccess('Đã gỡ ảnh tùy chỉnh. Thiết bị sẽ sử dụng ảnh CAD tiêu chuẩn.');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- XỬ LÝ SUBMIT FORM ---
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isUploadingImage) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    // 1. Validation Dây chuyền
    if (!lineId) {
      setActiveTab('general');
      setErrorMessage('Vui lòng chọn Dây chuyền sản xuất tiếp nhận thiết bị.');
      return;
    }

    // 2. Validation Tên máy
    if (!trimmedName) {
      setActiveTab('general');
      setErrorMessage('Vui lòng nhập Tên thiết bị.');
      nameInputRef.current?.focus();
      return;
    }

    // 3. Validation Mã máy (với Create mode)
    if (mode === 'create') {
      if (!trimmedCode) {
        setActiveTab('general');
        setErrorMessage('Vui lòng nhập Mã thiết bị duy nhất.');
        return;
      }
      if (!/^[A-Z0-9\-_]+$/i.test(trimmedCode)) {
        setActiveTab('general');
        setErrorMessage(
          'Mã thiết bị chỉ được chứa chữ cái, số, dấu gạch nối (-) hoặc gạch dưới (_).'
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Nếu còn file chưa upload lên server
      let finalImageUrl = imageUrl;
      if (selectedFile && !imageUrl) {
        try {
          const upRes = await apiClient.uploadMachineImage(selectedFile, machine?.id);
          finalImageUrl = upRes.imageUrl;
        } catch (upErr: any) {
          console.warn('[Pending Upload Error]:', upErr);
        }
      }

      if (mode === 'create') {
        await createMachine({
          lineId,
          name: trimmedName,
          code: trimmedCode,
          type,
          status: 'no_data',
          managementStatus,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
          imageUrl: finalImageUrl || undefined,
          manufacturer: manufacturer.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          installationDate: installationDate.trim() || undefined,
          ratedPower: ratedPower.trim() || undefined,
          technicalNotes: technicalNotes.trim() || undefined,
        });

        setSuccessMessage(`Đã thêm mới thiết bị ${trimmedName} (${trimmedCode}) thành công!`);
      } else {
        // Mode EDIT
        if (!machine) return;
        await updateMachine(machine.id, {
          name: trimmedName,
          type,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
          managementStatus,
          imageUrl: finalImageUrl || undefined,
          manufacturer: manufacturer.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          installationDate: installationDate.trim() || undefined,
          ratedPower: ratedPower.trim() || undefined,
          technicalNotes: technicalNotes.trim() || undefined,
        });

        setSuccessMessage(`Đã cập nhật thông tin thiết bị ${trimmedName} thành công!`);
      }

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('[Submit Machine Error]:', err);
      const msg =
        err.data?.message ||
        err.message ||
        (typeof err === 'string'
          ? err
          : 'Lỗi khi lưu dữ liệu thiết bị. Vui lòng kiểm tra lại kết nối hoặc quyền truy cập.');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal isOpen={isOpen}>
      {/* Nền Backdrop làm mờ nhẹ (blur 3px) */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-[3px] animate-in fade-in duration-150"
        onClick={handleSafeClose}
      >
        {/* Khung Modal chính: max-w-[700px], bo góc 2xl, bóng đổ hiện đại */}
        <div
          className="relative flex flex-col w-full max-w-[700px] max-h-[90vh] bg-white dark:bg-factory-card rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ================================================================= */}
          {/* 1. HEADER CỐ ĐỊNH (Căn chỉnh nhận diện thương hiệu DENSO)          */}
          {/* ================================================================= */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-2xs ${
                  mode === 'create'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border-blue-100 dark:border-blue-900/60'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60'
                }`}
              >
                {mode === 'create' ? <Plus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {mode === 'create' ? 'Thêm thiết bị máy móc mới' : 'Thông tin & Chỉnh sửa thiết bị'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  {mode === 'create'
                    ? 'Khai báo thông số kỹ thuật và gán vào dây chuyền sản xuất'
                    : `Cập nhật thông tin vận hành cho ${machine?.code || machine?.id || 'thiết bị'}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSafeClose}
              disabled={isSubmitting || isUploadingImage}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Đóng (Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ================================================================= */}
          {/* 2. THANH TAB ĐIỀU HƯỚNG 3 MỤC                                      */}
          {/* ================================================================= */}
          <div className="flex items-center gap-1 px-5 sm:px-6 pt-3 pb-2 border-b border-slate-200/70 dark:border-slate-800 bg-white dark:bg-factory-card shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Thông tin chung</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer relative ${
                activeTab === 'image'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Hình ảnh thiết bị</span>
              {imagePreview && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'specs'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Thông số kỹ thuật</span>
            </button>
          </div>

          {/* ================================================================= */}
          {/* 3. NỘI DUNG FORM CUỘN ĐỘC LẬP                                      */}
          {/* ================================================================= */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* THÔNG BÁO LỖI HOẶC THÀNH CÔNG */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/90 dark:bg-rose-950/40 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/90 dark:bg-emerald-950/40 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{successMessage}</div>
              </div>
            )}

            {/* TAB 1: THÔNG TIN CHUNG */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                {/* Hàng 1: Dây chuyền & Mã thiết bị */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Dây chuyền sản xuất */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Dây chuyền sản xuất <span className="text-rose-500">*</span>
                    </label>
                    {mode === 'create' ? (
                      <select
                        value={lineId}
                        onChange={(e) => setLineId(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      >
                        {lines.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.code || l.id})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={lineName || machine?.lineName || machine?.lineId || lineId}
                          readOnly
                          className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium cursor-not-allowed"
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
                      </div>
                    )}
                  </div>

                  {/* Mã thiết bị (Machine Code) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Mã thiết bị <span className="text-rose-500">*</span>
                    </label>
                    {mode === 'create' ? (
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="VD: MC-ASM-02"
                        disabled={isSubmitting}
                        className="w-full h-10 px-3 font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors uppercase"
                      />
                    ) : (
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={machine?.code || machine?.id || code}
                          readOnly
                          className="w-full h-10 px-3 pr-8 font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs sm:text-sm cursor-not-allowed"
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Hàng 2: Tên thiết bị & Loại máy */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tên thiết bị */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tên thiết bị <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Trạm siết bulong tự động 02"
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Loại thiết bị */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Loại thiết bị công nghiệp
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    >
                      {COMMON_MACHINE_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Hàng 3: Vị trí xưởng & Trạng thái quản lý */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Vị trí xưởng */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Vị trí xưởng (Location)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="VD: Trạm OP10 - Phân xưởng 1"
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Trạng thái quản lý */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Trạng thái quản lý thiết bị
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setManagementStatus('active')}
                        className={`h-10 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          managementStatus === 'active'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Active (Đang dùng)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setManagementStatus('inactive')}
                        className={`h-10 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          managementStatus === 'inactive'
                            ? 'bg-slate-100 border-slate-500 text-slate-800 dark:bg-slate-800 dark:text-slate-200 ring-2 ring-slate-500/30'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>Inactive (Ngừng dùng)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hàng 4: Mô tả kỹ thuật */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Mô tả kỹ thuật & Ghi chú vận hành
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nhập mô tả tóm tắt về chức năng, phạm vi ứng dụng và đặc điểm thiết bị..."
                    disabled={isSubmitting}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* Chú thích phân biệt Management Status vs Operating Status */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-300 text-xs">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <p>
                    <strong>Lưu ý công nghiệp:</strong> Trạng thái quản lý (Active/Inactive) phân định
                    thiết bị có đang trong biên chế sản xuất hay không. Trạng thái vận hành thực tế
                    (Đang chạy / Cảnh báo / Dừng máy) được hệ thống giám sát IoT tự động tính toán từ cảm biến.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: HÌNH ẢNH THIẾT BỊ */}
            {activeTab === 'image' && (
              <div className="space-y-5">
                {/* Vùng xem trước ảnh (Preview Box) */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                  <div className="w-44 h-36 shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-factory-card flex items-center justify-center p-2 relative shadow-xs">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview máy"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <MachineImage
                        machineId={machine?.id}
                        machineCode={code || machine?.code}
                        alt={name || 'Thiết bị'}
                        className="w-full h-full object-contain"
                        showFallbackLabel
                      />
                    )}

                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center text-white">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {code || machine?.code || 'CHƯA CÓ MÃ'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {imagePreview ? 'Ảnh tải lên' : 'Ảnh CAD tiêu chuẩn'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                      {name || 'Thiết bị chưa đặt tên'}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Ảnh này sẽ được hiển thị đồng bộ tại Sơ đồ dây chuyền, Giám sát Thiết bị,
                      Machine Detail và Bảng CHECK SHEET.
                    </p>

                    {/* Các nút thao tác ảnh */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage || isSubmitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{imagePreview ? 'Thay đổi ảnh' : 'Tải ảnh lên'}</span>
                      </button>

                      {imagePreview && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          disabled={isUploadingImage || isSubmitting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Gỡ ảnh</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input File ẩn */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Thông báo trạng thái upload */}
                {uploadError && (
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {/* Hướng dẫn tiêu chuẩn ảnh */}
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Quy chuẩn tệp hình ảnh công nghiệp DENSO:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                    <li>Hỗ trợ định dạng ảnh raster: <strong>PNG, JPG, JPEG, WEBP</strong>.</li>
                    <li>Khuyến khích sử dụng ảnh <strong>PNG nền trong suốt (transparent)</strong> hoặc CAD 3D rendered.</li>
                    <li>Dung lượng tệp tối đa: <strong>5.0 MB</strong> cho mỗi thiết bị.</li>
                    <li>Độ phân giải tối ưu: Chiều ngang từ <strong>600px đến 1200px</strong>.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 3: THÔNG SỐ KỸ THUẬT */}
            {activeTab === 'specs' && (
              <div className="space-y-4">
                {/* Hàng 1: Hãng sản xuất & Model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hãng sản xuất */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Hãng sản xuất (Manufacturer)
                    </label>
                    <input
                      type="text"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      placeholder="VD: Komatsu, Fanuc, Atlas Copco..."
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Model máy */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Model thiết bị
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="VD: SMC-HYD-500, EPX-2000..."
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Hàng 2: Số Serial & Ngày đưa vào sử dụng */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Số serial */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Số Serial (S/N)
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="VD: SN-2026-JP-8812"
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Ngày đưa vào sử dụng */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Ngày đưa vào sử dụng (Commissioning)
                    </label>
                    <input
                      type="date"
                      value={installationDate}
                      onChange={(e) => setInstallationDate(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Hàng 3: Công suất định mức */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Thông số công suất / Tải trọng định mức
                  </label>
                  <input
                    type="text"
                    value={ratedPower}
                    onChange={(e) => setRatedPower(e.target.value)}
                    placeholder="VD: 500 Tấn, 45 kW, 220V - 50Hz, 3.2 bar..."
                    disabled={isSubmitting}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Hàng 4: Ghi chú kỹ thuật */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ghi chú kỹ thuật & Đặc điểm bảo trì
                  </label>
                  <textarea
                    rows={2}
                    value={technicalNotes}
                    onChange={(e) => setTechnicalNotes(e.target.value)}
                    placeholder="Lịch bảo dưỡng định kỳ, yêu cầu dầu mỡ bôi trơn, tiêu chuẩn kiểm định..."
                    disabled={isSubmitting}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* Khối Trạm PLC liên kết (Read-only an toàn) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Trạm PLC thu thập tín hiệu</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Cấu hình độc lập
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {machine?.plc ? (
                      <>
                        Đang liên kết với PLC <strong>{machine.plc.name}</strong> ({machine.plc.protocol}
                        {(machine.plc as any).ipAddress ? ` @ ${(machine.plc as any).ipAddress}:${(machine.plc as any).port}` : ''})
                      </>
                    ) : (
                      'Chưa gán trạm PLC trực tiếp. Thiết bị nhận dữ liệu từ trạm PLC chung của dây chuyền.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* 4. FOOTER CỐ ĐỊNH (NÚT HỦY & NÚT LƯU)                             */}
          {/* ================================================================= */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 shrink-0">
            <button
              type="button"
              onClick={handleSafeClose}
              disabled={isSubmitting || isUploadingImage}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isUploadingImage}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                  mode === 'create'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : mode === 'create' ? (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Tạo thiết bị</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
