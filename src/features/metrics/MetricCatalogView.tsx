/**
 * @file MetricCatalogView.tsx
 * @description Phân hệ Quản Lý Danh Mục Thông Số (Metric Catalog) Chuẩn DENSO Industrial IoT
 * Thiết kế chuẩn UI/UX theo ảnh mẫu 1 & 2:
 * - Header với tiêu đề "Danh mục Thông số", mô tả hệ thống, nút "+ Thêm thông số" màu xanh.
 * - 4 thẻ thống kê trực quan: Tổng thông số, Đang hoạt động, Đã được gán, Chưa được gán (dữ liệu Backend thực tế).
 * - Thanh tìm kiếm nhanh & đếm số lượng bản ghi hiển thị.
 * - Bảng danh mục thông số: Mã, Tên hiển thị, Kiểu dữ liệu, Đơn vị, Nhóm, Đang gán, Bật/Tắt, Hành động.
 * - Modal Thêm/Sửa thông số (Ảnh mẫu 2): Form chuẩn công nghiệp, khu vực gán vào Thiết bị (nhóm theo Dây chuyền sản xuất).
 * - Tương thích hoàn hảo Dark Mode & Light Mode, không tràn màn hình, hỗ trợ responsive.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Gauge,
  CheckCircle2,
  XCircle,
  Activity,
  Search,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  X,
  Cpu,
  Lock,
  Loader2,
} from 'lucide-react';
import { Tooltip } from '../../components/common/Tooltip';
import { CustomSwitch } from '../../components/common/CustomSwitch';
import { ModalPortal } from '../../components/common/ModalPortal';
import { apiClient } from '../../services/api';
import { socketClient } from '../../services/socket';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  MetricCatalogItem,
  MetricCategory,
  MetricDataType,
  MetricSummary,
} from '../../types/metric';

/* ------------------------------------------------------------------ */
/* Danh mục chuẩn và Kiểu dữ liệu hỗ trợ                               */
/* ------------------------------------------------------------------ */
const CATEGORIES: { label: string; value: MetricCategory }[] = [
  { label: 'Áp suất (Pressure)', value: 'Pressure' },
  { label: 'Nhiệt độ (Temperature)', value: 'Temperature' },
  { label: 'Độ rung (Vibration)', value: 'Vibration' },
  { label: 'Dòng điện (Current)', value: 'Current' },
  { label: 'Điện áp (Voltage)', value: 'Voltage' },
  { label: 'Tốc độ (Speed)', value: 'Speed' },
  { label: 'Lưu lượng (Flow)', value: 'Flow' },
  { label: 'Mức (Level)', value: 'Level' },
  { label: 'Khác (Other)', value: 'Other' },
];

const DATA_TYPES: { label: string; value: MetricDataType }[] = [
  { label: 'FLOAT (Số thực)', value: 'FLOAT' },
  { label: 'INTEGER (Số nguyên)', value: 'INTEGER' },
  { label: 'BOOLEAN (Đúng/Sai)', value: 'BOOLEAN' },
  { label: 'STRING (Chuỗi ký tự)', value: 'STRING' },
  { label: 'ENUM (Danh mục liệt kê)', value: 'ENUM' },
];

function getCategoryDisplay(cat: string): { name: string; className: string } {
  switch (cat) {
    case 'Pressure':
      return { name: 'ÁP SUẤT', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' };
    case 'Temperature':
      return { name: 'NHIỆT ĐỘ', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' };
    case 'Vibration':
      return { name: 'ĐỘ RUNG', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' };
    case 'Current':
      return { name: 'DÒNG ĐIỆN', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' };
    case 'Voltage':
      return { name: 'ĐIỆN ÁP', className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' };
    case 'Speed':
      return { name: 'TỐC ĐỘ', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' };
    case 'Flow':
      return { name: 'LƯU LƯỢNG', className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20' };
    case 'Level':
      return { name: 'MỨC DẦU', className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20' };
    default:
      return { name: 'CÔNG NGHIỆP', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20' };
  }
}

export function MetricCatalogView() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = (currentUser?.role || 'OPERATOR').toUpperCase() === 'ADMIN';

  // Dữ liệu danh sách & thống kê thực tế từ Backend
  const [metrics, setMetrics] = useState<MetricCatalogItem[]>([]);
  const [summary, setSummary] = useState<MetricSummary>({
    total: 0,
    active: 0,
    inactive: 0,
    totalMapped: 0,
    assigned: 0,
    unassigned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Tìm kiếm
  const [search, setSearch] = useState('');

  // Phản hồi toast / alert
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // State Modal Thêm / Sửa Thông Số
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricCatalogItem | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<MetricCategory>('Pressure');
  const [formUnit, setFormUnit] = useState('bar');
  const [formDataType, setFormDataType] = useState<MetricDataType>('FLOAT');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Xác nhận Đổi Trạng Thái
  const [statusTargetMetric, setStatusTargetMetric] = useState<MetricCatalogItem | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Modal Xác nhận Xóa Thông Số
  const [metricToDelete, setMetricToDelete] = useState<MetricCatalogItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Tải dữ liệu Metric từ Backend REST API                             */
  /* ------------------------------------------------------------------ */
  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.getMetrics({
        limit: 100, // Tải đầy đủ để lọc mượt mà
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      setMetrics(res.metrics || []);
      if (res.summary) {
        const assigned = res.summary.assigned ?? res.summary.totalMapped ?? 0;
        const unassigned = res.summary.unassigned ?? Math.max(0, (res.summary.total || 0) - assigned);
        setSummary({
          ...res.summary,
          assigned,
          unassigned,
        });
      }
    } catch (err: any) {
      console.error('[Fetch Metrics Error]:', err);
      showFeedback('error', err.message || 'Không thể tải danh mục thông số từ máy chủ.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Lắng nghe WebSocket đồng bộ thời gian thực
  useEffect(() => {
    const unsubCreated = socketClient.on('metric_created', () => fetchMetrics());
    const unsubUpdated = socketClient.on('metric_updated', () => fetchMetrics());
    const unsubDeleted = socketClient.on('metric_deleted', () => fetchMetrics());
    const unsubStatus = socketClient.on('metric_status_updated', () => fetchMetrics());
    const unsubAssigned = socketClient.on('metric_assignments_updated', () => fetchMetrics());
    const unsubMappingCreated = socketClient.on('mapping_created', () => fetchMetrics());
    const unsubMappingDeleted = socketClient.on('mapping_deleted', () => fetchMetrics());

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubStatus();
      unsubAssigned();
      unsubMappingCreated();
      unsubMappingDeleted();
    };
  }, [fetchMetrics]);

  /* ------------------------------------------------------------------ */
  /* Mở Modal Tạo Mới / Chỉnh Sửa                                      */
  /* ------------------------------------------------------------------ */
  const handleOpenCreateModal = () => {
    setEditingMetric(null);
    setFormCode('');
    setFormName('');
    setFormCategory('Pressure');
    setFormUnit('bar');
    setFormDataType('FLOAT');
    setFormDescription('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (metric: MetricCatalogItem) => {
    setEditingMetric(metric);
    setFormCode(metric.code);
    setFormName(metric.name);
    setFormCategory(metric.category);
    setFormUnit(metric.unit);
    setFormDataType(metric.dataType);
    setFormDescription(metric.description || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  /* ------------------------------------------------------------------ */
  /* Xử lý Gửi Form Lưu Thông Số (Create / Update)                      */
  /* ------------------------------------------------------------------ */
  const handleSaveMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation cơ sở
    const cleanCode = formCode.trim().toUpperCase();
    const cleanName = formName.trim();
    const cleanUnit = formUnit.trim();

    if (!cleanCode) {
      setFormError('Mã thông số là bắt buộc (ví dụ: PRESSURE_HYDRAULIC).');
      return;
    }
    if (!/^[A-Z0-9_]{2,64}$/.test(cleanCode)) {
      setFormError('Mã thông số chỉ chấp nhận chữ in hoa (A-Z), số (0-9) và gạch dưới (_), độ dài 2-64 ký tự.');
      return;
    }
    if (!cleanName || cleanName.length < 2) {
      setFormError('Tên hiển thị thông số phải từ 2 ký tự trở lên.');
      return;
    }
    if (!cleanUnit) {
      setFormError('Đơn vị đo lường là bắt buộc (ví dụ: bar, °C, mm/s).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingMetric) {
        // Cập nhật thông số hiện có (không can thiệp mapping của thiết bị)
        await apiClient.updateMetric(editingMetric.id, {
          code: cleanCode,
          name: cleanName,
          category: formCategory,
          unit: cleanUnit,
          dataType: formDataType,
          description: formDescription.trim() || undefined,
        });
        showFeedback('success', `Đã cập nhật thành công thông số "${cleanName}".`);
      } else {
        // Tạo mới thông số
        await apiClient.createMetric({
          code: cleanCode,
          name: cleanName,
          category: formCategory,
          unit: cleanUnit,
          dataType: formDataType,
          description: formDescription.trim() || undefined,
        });
        showFeedback('success', `Đã tạo mới thành công thông số "${cleanName}".`);
      }

      setIsFormModalOpen(false);
      await fetchMetrics();
    } catch (err: any) {
      console.error('[Save Metric Error]:', err);
      setFormError(err.message || 'Lỗi khi lưu thông số vào CSDL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Xử lý Đổi Trạng Thái Bật/Tắt (Toggle Status)                       */
  /* ------------------------------------------------------------------ */
  const handleToggleStatusClick = (metric: MetricCatalogItem) => {
    setStatusTargetMetric(metric);
    setIsStatusModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusTargetMetric) return;
    setIsTogglingStatus(true);
    try {
      const newStatus = statusTargetMetric.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await apiClient.updateMetricStatus(statusTargetMetric.id, newStatus);
      showFeedback(
        'success',
        `Đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'ngừng kích hoạt'} thông số "${statusTargetMetric.name}".`
      );
      setIsStatusModalOpen(false);
      await fetchMetrics();
    } catch (err: any) {
      console.error('[Toggle Status Error]:', err);
      showFeedback('error', err.message || 'Không thể đổi trạng thái thông số.');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Mở modal xác nhận xóa thông số
  const handleOpenDeleteModal = (metric: MetricCatalogItem) => {
    setMetricToDelete(metric);
    setIsDeleteModalOpen(true);
  };

  // Thực hiện xóa thông số qua Backend API
  const handleConfirmDelete = async () => {
    if (!metricToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await apiClient.deleteMetric(metricToDelete.id);
      showFeedback('success', res.message || `Đã xóa thông số "${metricToDelete.name}" thành công.`);
      setIsDeleteModalOpen(false);
      setMetricToDelete(null);
      await fetchMetrics();
    } catch (err: any) {
      console.warn('[Delete Metric Error]:', err);
      showFeedback('error', err.message || 'Không thể xóa thông số.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Lọc thông số theo ô tìm kiếm
  const filteredMetrics = metrics.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const catDisplay = getCategoryDisplay(m.category).name.toLowerCase();
    return (
      m.code.toLowerCase().includes(term) ||
      m.name.toLowerCase().includes(term) ||
      (m.description && m.description.toLowerCase().includes(term)) ||
      m.category.toLowerCase().includes(term) ||
      catDisplay.includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100 max-w-[1600px] mx-auto pb-12">
      {/* ========================================================================= */}
      {/* 1. HEADER (TIÊU ĐỀ, MÔ TẢ, NÚT THÊM THÔNG SỐ)                             */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Cấu hình</span>
            <span>/</span>
            <span className="text-emerald-600 dark:text-emerald-400">Danh mục Thông số</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Danh mục Thông số
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Chỉ số đo lường chuẩn hóa dùng chung cho toàn hệ thống giám sát nhà máy DENSO.
          </p>
        </div>

        <div>
          {isAdmin ? (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Thêm thông số</span>
            </button>
          ) : (
            <Tooltip content="Chỉ Quản trị viên (ADMIN) mới có quyền tạo mới thông số">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold text-xs cursor-not-allowed">
                <Plus className="w-4 h-4" />
                <span>Thêm thông số</span>
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Thông báo Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BỐN THẺ THỐNG KÊ (4 STATS CARDS - CHUẨN ẢNH MẪU 1)                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng thông số (Green accent) */}
        <div className="bg-factory-card rounded-2xl border border-factory-border p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Gauge className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Tổng thông số</span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
              {summary.total}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {summary.active} đang hoạt động
            </p>
          </div>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
        </div>

        {/* Card 2: Đang hoạt động (Blue accent) */}
        <div className="bg-factory-card rounded-2xl border border-factory-border p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Đang hoạt động</span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-blue-600 dark:text-blue-400">
              {summary.active}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium font-mono">
              ACTIVE
            </p>
          </div>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
        </div>

        {/* Card 3: Đã được gán (Amber accent) */}
        <div className="bg-factory-card rounded-2xl border border-factory-border p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Đã được gán</span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
              {summary.assigned ?? summary.totalMapped ?? 0}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Đã gán vào thiết bị
            </p>
          </div>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
        </div>

        {/* Card 4: Chưa được gán (Teal accent) */}
        <div className="bg-factory-card rounded-2xl border border-factory-border p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Chưa được gán</span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black font-mono text-teal-600 dark:text-teal-400">
              {summary.unassigned ?? Math.max(0, summary.total - (summary.assigned ?? summary.totalMapped ?? 0))}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Chưa gán vào thiết bị
            </p>
          </div>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. THANH TÌM KIẾM THEO MÃ, TÊN, NHÓM (CHUẨN ẢNH MẪU 1)                    */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã, tên hoặc nhóm thông số..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-factory-card text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-xs"
          />
        </div>

        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {filteredMetrics.length}/{metrics.length} thông số
        </span>
      </div>

      {/* ========================================================================= */}
      {/* 4. BẢNG DANH MỤC THÔNG SỐ (MAIN TABLE CARD - CHUẨN ẢNH MẪU 1)             */}
      {/* ========================================================================= */}
      <div className="bg-factory-card rounded-2xl border border-factory-border shadow-xs overflow-hidden">
        {/* Header bảng */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-factory-border bg-slate-50/50 dark:bg-white/[0.02]">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Thông số</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filteredMetrics.length} bản ghi
          </span>
        </div>

        {/* Nội dung bảng */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="text-xs font-medium">Đang tải danh mục thông số từ CSDL...</span>
            </div>
          ) : filteredMetrics.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Gauge className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-semibold">Không tìm thấy thông số nào</p>
              <p className="text-xs text-slate-500">Thử thay đổi từ khóa tìm kiếm hoặc bấm Thêm thông số mới.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-factory-border text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/30 dark:bg-white/[0.01]">
                  <th className="py-3.5 px-6 w-[20%]">MÃ THÔNG SỐ</th>
                  <th className="py-3.5 px-6 w-[26%]">TÊN HIỂN THỊ</th>
                  <th className="py-3.5 px-4 w-[10%]">KIỂU</th>
                  <th className="py-3.5 px-4 w-[10%]">ĐƠN VỊ</th>
                  <th className="py-3.5 px-4 w-[12%]">NHÓM</th>
                  <th className="py-3.5 px-4 w-[10%]">ĐANG GÁN</th>
                  <th className="py-3.5 px-4 w-[6%] text-center">BẬT</th>
                  <th className="py-3.5 px-6 w-[8%] text-right">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-factory-border">
                {filteredMetrics.map((metric) => {
                  const cat = getCategoryDisplay(metric.category);
                  const isActive = metric.status === 'ACTIVE';
                  const assignedCount = metric.assignedCount ?? 0;

                  return (
                    <tr
                      key={metric.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Cột 1: Mã thông số */}
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-white">
                        {metric.code}
                      </td>

                      {/* Cột 2: Tên hiển thị + mô tả */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {metric.name}
                        </div>
                        {metric.description && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {metric.description}
                          </div>
                        )}
                      </td>

                      {/* Cột 3: Kiểu dữ liệu */}
                      <td className="py-4 px-4 font-mono font-bold text-slate-600 dark:text-slate-300">
                        {metric.dataType || 'NUMBER'}
                      </td>

                      {/* Cột 4: Đơn vị */}
                      <td className="py-4 px-4 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                        {metric.unit || '—'}
                      </td>

                      {/* Cột 5: Nhóm */}
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${cat.className}`}>
                          {cat.name}
                        </span>
                      </td>

                      {/* Cột 6: Đang gán */}
                      <td className="py-4 px-4">
                        {assignedCount > 0 ? (
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {assignedCount} thiết bị
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">
                            Chưa gán
                          </span>
                        )}
                      </td>

                      {/* Cột 7: Toggle Bật/Tắt */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          <CustomSwitch
                            isSelected={isActive}
                            size="sm"
                            color="success"
                            aria-label={`Bật tắt ${metric.name}`}
                            onValueChange={() => {
                              if (isAdmin) {
                                handleToggleStatusClick(metric);
                              }
                            }}
                          />
                        </div>
                      </td>

                      {/* Cột 8: Hành động */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Sửa */}
                          <Tooltip content={isAdmin ? 'Chỉnh sửa thông số' : 'Chỉ Quản trị viên mới được sửa'}>
                            <button
                              onClick={() => {
                                if (isAdmin) handleOpenEditModal(metric);
                              }}
                              disabled={!isAdmin}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isAdmin
                                  ? 'bg-slate-100 dark:bg-factory-bg border-slate-200 dark:border-factory-border text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 cursor-pointer'
                                  : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-factory-bg border-slate-200 dark:border-factory-border text-slate-400'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>

                          {/* Nút Xóa thông số */}
                          <Tooltip content={isAdmin ? 'Xóa thông số' : 'Chỉ Quản trị viên mới được xóa'}>
                            <button
                              onClick={() => {
                                if (isAdmin) handleOpenDeleteModal(metric);
                              }}
                              disabled={!isAdmin}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isAdmin
                                  ? 'bg-slate-100 dark:bg-factory-bg border-slate-200 dark:border-factory-border text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 cursor-pointer'
                                  : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-factory-bg border-slate-200 dark:border-factory-border text-slate-400'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL THÊM / SỬA THÔNG SỐ (CHUẨN ẢNH MẪU 2)                            */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <ModalPortal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)}>
          <div
            className="w-full max-w-[720px] bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingMetric ? `Sửa thông số: ${editingMetric.code}` : 'Thêm thông số mới'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form (Cuộn độc lập) */}
            <form onSubmit={handleSaveMetric} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Mã thông số */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mã thông số *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="VD: PRESSURE_HYDRAULIC"
                    disabled={Boolean(editingMetric && (editingMetric.assignedCount || 0) > 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-60"
                  />
                  {editingMetric && (editingMetric.assignedCount || 0) > 0 && (
                    <Tooltip content="Mã thông số đã có mapping vào thiết bị, không thể sửa mã để bảo toàn CSDL.">
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* 2. Tên hiển thị */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên hiển thị *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Áp suất dầu thủy lực"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* 3. Ba trường: Kiểu, Đơn vị, Nhóm */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Kiểu */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kiểu
                  </label>
                  <select
                    value={formDataType}
                    onChange={(e) => setFormDataType(e.target.value as MetricDataType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {DATA_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Đơn vị */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Đơn vị
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="VD: bar, °C, mm/s"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Nhóm */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nhóm
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MetricCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Mô tả */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mô tả
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú kỹ thuật về thông số này..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Footer Modal (Cố định ở đáy) */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
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
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL XÁC NHẬN ĐỔI TRẠNG THÁI (BẬT / TẮT)                              */}
      {/* ========================================================================= */}
      {isStatusModalOpen && statusTargetMetric && (
        <ModalPortal
          isOpen={isStatusModalOpen && !!statusTargetMetric}
          onClose={() => setIsStatusModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Xác nhận đổi trạng thái
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn{' '}
              <strong className="text-slate-900 dark:text-white font-mono">
                {statusTargetMetric.status === 'ACTIVE' ? 'NGỪNG HOẠT ĐỘNG' : 'KÍCH HOẠT'}
              </strong>{' '}
              thông số{' '}
              <strong className="text-slate-900 dark:text-white">"{statusTargetMetric.name}"</strong> (
              <span className="font-mono">{statusTargetMetric.code}</span>)?
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                disabled={isTogglingStatus}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmToggleStatus}
                disabled={isTogglingStatus}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                {isTogglingStatus ? 'Đang cập nhật...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL XÁC NHẬN XÓA THÔNG SỐ (CHUẨN BẢO VỆ DỮ LIỆU)                     */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && metricToDelete && (
        <ModalPortal
          isOpen={isDeleteModalOpen && !!metricToDelete}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setMetricToDelete(null);
            }
          }}
          closeOnBackdropClick={!isDeleting}
          closeOnEscape={!isDeleting}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Xác nhận xóa thông số
              </h3>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>Bạn có chắc chắn muốn xóa thông số sau khỏi Danh mục chuẩn?</p>
              
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mã thông số:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{metricToDelete.code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tên thông số:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{metricToDelete.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Đơn vị:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{metricToDelete.unit || '—'}</span>
                </div>
                {metricToDelete.assignedCount !== undefined && metricToDelete.assignedCount > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500">Đang gán:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{metricToDelete.assignedCount} thiết bị</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-[11px] leading-relaxed">
                <strong>Cảnh báo:</strong> Thao tác xóa không thể hoàn tác. Nếu thông số đang có dữ liệu phụ thuộc (thiết bị đang gán, cấu hình ngưỡng hoặc lịch sử đo lường telemetry), Backend sẽ từ chối xóa để đảm bảo toàn vẹn dữ liệu.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  if (!isDeleting) {
                    setIsDeleteModalOpen(false);
                    setMetricToDelete(null);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa thông số</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
