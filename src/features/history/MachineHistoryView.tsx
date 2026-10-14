/**
 * @file MachineHistoryView.tsx
 * @description Giao diện Phân hệ Lịch sử hoạt động máy & Telemetry (Machine History & Activity Log)
 * Hỗ trợ bộ lọc đa tiêu chí (Line -> Machine cascade, khoảng ngày/giờ, ca làm việc qua đêm),
 * phân trang mượt mà, phân biệt rõ ràng Simulation/Device và xử lý trạng thái Degraded khi CSDL ngoại tuyến.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  History,
  Filter,
  RotateCcw,
  RefreshCw,
  Search,
  AlertTriangle,
  Database,
  Cpu,
  Radio,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  AlertOctagon,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { TelemetryFilterParams } from '../../types/hierarchy';
import { exportEngine } from '../../utils/exportEngine';
import { historyService } from '../../services/historyService';

export function MachineHistoryView() {
  const { lines } = useMonitoringStore();
  const {
    logs,
    metadata,
    isLoading,
    error,
    isDegraded,
    degradedMessage,
    filters,
    setFilters,
    setPage,
    setLimit,
    resetFilters,
    fetchLogs,
  } = useHistoryStore();

  // Trạng thái local của form lọc trước khi nhấn "Áp dụng bộ lọc"
  const [formFilters, setFormFilters] = useState<TelemetryFilterParams>({ ...filters });

  // Trạng thái menu và tiến trình xuất dữ liệu
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Tự động tải dữ liệu khi mở view lần đầu
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Đồng bộ formFilters nếu filters trong store thay đổi từ bên ngoài (ví dụ khi reset)
  useEffect(() => {
    setFormFilters({ ...filters });
  }, [filters]);

  // Đóng dropdown xuất khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#export-dropdown-container')) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // Hàm xử lý xuất dữ liệu an toàn theo bộ lọc hiện tại (tối đa 10.000 bản ghi)
  const handleExport = async (format: 'xlsx' | 'csv' | 'json') => {
    setIsExportMenuOpen(false);
    setExportWarning(null);
    setExportSuccessMsg(null);
    setIsExporting(true);

    try {
      // Gọi API với isExport: true để lấy trọn vẹn tập dữ liệu thỏa mãn bộ lọc
      const response = await historyService.getTelemetryLogs({
        ...filters,
        isExport: true,
      });

      // Nếu backend từ chối vì vượt trần an toàn 10.000 dòng
      if (response.metadata?.exportAllowed === false || response.metadata?.isTruncated) {
        setExportWarning(
          response.metadata?.warning ||
            `Số lượng bản ghi (${response.metadata?.totalRecords?.toLocaleString(
              'vi-VN'
            )}) vượt quá giới hạn xuất an toàn 10.000 dòng. Vui lòng thu hẹp bộ lọc ngày/giờ hoặc chọn dây chuyền/máy cụ thể để xuất báo cáo chính xác.`
        );
        setIsExporting(false);
        return;
      }

      const exportData = response.data || [];

      if (exportData.length === 0) {
        setExportWarning('Không tìm thấy bản ghi nào khớp với bộ lọc hiện tại để xuất.');
        setIsExporting(false);
        return;
      }

      if (format === 'xlsx') {
        exportEngine.exportToExcel(exportData);
        setExportSuccessMsg(`Đã xuất thành công ${exportData.length} bản ghi sang file Excel (.xlsx)!`);
      } else if (format === 'csv') {
        exportEngine.exportToCSV(exportData);
        setExportSuccessMsg(`Đã xuất thành công ${exportData.length} bản ghi sang file CSV (UTF-8 BOM)!`);
      } else if (format === 'json') {
        exportEngine.exportToJSON(exportData, response.metadata);
        setExportSuccessMsg(`Đã xuất thành công ${exportData.length} bản ghi sang file JSON (AI/ML Dataset)!`);
      }

      // Tự động ẩn thông báo thành công sau 5 giây
      setTimeout(() => {
        setExportSuccessMsg(null);
      }, 5000);
    } catch (err: any) {
      setExportWarning(err.message || 'Lỗi trong quá trình xuất dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  // Danh sách máy thuộc Line đã chọn (Cascade Line -> Machine)
  const availableMachines = useMemo(() => {
    if (!formFilters.lineId || formFilters.lineId === 'all') {
      return lines.flatMap((line) => line.machines);
    }
    const foundLine = lines.find((l) => l.id === formFilters.lineId);
    return foundLine ? foundLine.machines : [];
  }, [lines, formFilters.lineId]);

  // Danh sách chỉ số (Metric) thuộc máy đã chọn
  const availableMetrics = useMemo(() => {
    if (!formFilters.machineId || formFilters.machineId === 'all') {
      // Tập hợp tất cả metric độc nhất
      const metricMap = new Map<string, { id: string; name: string }>();
      availableMachines.forEach((machine) => {
        machine.metrics.forEach((m) => {
          if (!metricMap.has(m.id)) {
            metricMap.set(m.id, { id: m.id, name: m.name });
          }
        });
      });
      return Array.from(metricMap.values());
    }
    const foundMachine = availableMachines.find((m) => m.id === formFilters.machineId);
    return foundMachine ? foundMachine.metrics : [];
  }, [availableMachines, formFilters.machineId]);

  // Xử lý khi đổi Line: Nếu machine hiện tại không thuộc line mới thì reset về 'all'
  const handleLineChange = (newLineId: string) => {
    if (newLineId === 'all') {
      setFormFilters((prev) => ({
        ...prev,
        lineId: 'all',
        machineId: 'all',
        metricId: 'all',
      }));
      return;
    }

    const selectedLine = lines.find((l) => l.id === newLineId);
    const machineBelongsToLine = selectedLine?.machines.some(
      (m) => m.id === formFilters.machineId
    );

    setFormFilters((prev) => ({
      ...prev,
      lineId: newLineId,
      machineId: machineBelongsToLine ? prev.machineId : 'all',
      metricId: machineBelongsToLine ? prev.metricId : 'all',
    }));
  };

  // Xử lý khi đổi Machine: Nếu metric hiện tại không thuộc machine mới thì reset về 'all'
  const handleMachineChange = (newMachineId: string) => {
    if (newMachineId === 'all') {
      setFormFilters((prev) => ({
        ...prev,
        machineId: 'all',
        metricId: 'all',
      }));
      return;
    }

    const selectedMachine = availableMachines.find((m) => m.id === newMachineId);
    const metricBelongsToMachine = selectedMachine?.metrics.some(
      (m) => m.id === formFilters.metricId
    );

    setFormFilters((prev) => ({
      ...prev,
      machineId: newMachineId,
      metricId: metricBelongsToMachine ? prev.metricId : 'all',
    }));
  };

  // Áp dụng bộ lọc
  const handleApplyFilters = () => {
    setFilters(formFilters);
    fetchLogs();
  };

  // Đặt lại bộ lọc
  const handleResetFilters = () => {
    resetFilters();
  };

  // Chọn ca làm việc nhanh
  const handleShiftSelect = (shift: 'all' | 'shift1' | 'shift2' | 'shift3') => {
    switch (shift) {
      case 'shift1':
        setFormFilters((prev) => ({
          ...prev,
          startTime: '06:00',
          endTime: '14:00',
        }));
        break;
      case 'shift2':
        setFormFilters((prev) => ({
          ...prev,
          startTime: '14:00',
          endTime: '22:00',
        }));
        break;
      case 'shift3':
        // Ca đêm qua nửa đêm
        setFormFilters((prev) => ({
          ...prev,
          startTime: '22:00',
          endTime: '06:00',
        }));
        break;
      case 'all':
      default:
        setFormFilters((prev) => ({
          ...prev,
          startTime: '00:00',
          endTime: '23:59',
        }));
        break;
    }
  };

  // Format ngày giờ Việt Nam an toàn
  const formatDateTimeVN = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  // Tính số thứ tự bản ghi đang xem
  const totalRecords = metadata?.totalRecords || 0;
  const currentPage = metadata?.page || 1;
  const pageSize = metadata?.limit || 20;
  const totalPages = metadata?.totalPages || 1;
  const startRecord = totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TIÊU ĐỀ TRANG & THANH THAO TÁC                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Lịch Sử Hoạt Động Máy & Telemetry
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Truy vấn dữ liệu cảm biến thời gian thực, đánh giá ngưỡng an toàn và trạng thái thiết bị theo ca sản xuất.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Nút Làm mới */}
          <button
            onClick={() => fetchLogs()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer disabled:opacity-60"
            title="Tải lại dữ liệu mới nhất"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
            <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          {/* Menu Xuất Báo Cáo 3 Định Dạng */}
          <div className="relative" id="export-dropdown-container">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
              title="Xuất dữ liệu theo 3 định dạng Excel, CSV, JSON"
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? 'Đang chuẩn bị...' : 'Xuất dữ liệu'}</span>
            </button>

            {/* Dropdown Menu 3 Định dạng */}
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  Chọn định dạng xuất ({totalRecords} bản ghi)
                </div>

                {/* 1. Excel (.xlsx) */}
                <button
                  type="button"
                  onClick={() => handleExport('xlsx')}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Excel Workbook (.xlsx)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Bảng tính chuẩn có style màu sắc DENSO
                    </div>
                  </div>
                </button>

                {/* 2. CSV (.csv) */}
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors group cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                      CSV UTF-8 BOM (.csv)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tương thích Excel tiếng Việt & chống injection
                    </div>
                  </div>
                </button>

                {/* 3. JSON (.json) */}
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors group cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      JSON Dataset (.json)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Chuẩn hóa cho AI/ML Anomaly Training
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thông báo Thành công khi Xuất */}
      {exportSuccessMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-800 dark:text-emerald-300 shadow-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessMsg(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cảnh báo Giới hạn Xuất hoặc Lỗi Xuất */}
      {exportWarning && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-800 dark:text-rose-300 shadow-xs flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5 text-xs leading-relaxed">
            <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900 dark:text-rose-200 text-sm">
                Thông Báo Xuất Báo Cáo
              </p>
              <p className="mt-1">{exportWarning}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExportWarning(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CẢNH BÁO TRẠNG THÁI DEGRADED (CSDL NGOẠI TUYẾN / DỰ PHÒNG)              */}
      {/* ========================================================================= */}
      {isDegraded && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300 shadow-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1 text-xs leading-relaxed">
            <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
              Hệ thống đang hoạt động ở chế độ Dự phòng (Memory Fallback)
            </p>
            <p className="mt-1">
              Cơ sở dữ liệu lịch sử trung tâm (MySQL) hiện chưa sẵn sàng hoặc đang khởi động. Dữ liệu lịch sử lưu trữ dài hạn chưa khả dụng.
              {degradedMessage && <span className="block mt-0.5 font-mono text-[11px] opacity-90">Chi tiết: {degradedMessage}</span>}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. KHU VỰC BỘ LỌC ĐA TIÊU CHÍ (MULTI-CRITERIA FILTER)                     */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-factory-card rounded-2xl border border-slate-200 dark:border-factory-border p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-emerald-500" />
            <span>Bộ Lọc Tra Cứu Telemetry</span>
          </div>

          {/* Preset ca làm việc nhanh */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1 hidden sm:inline">
              Ca làm việc:
            </span>
            <button
              type="button"
              onClick={() => handleShiftSelect('shift1')}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors border cursor-pointer ${
                formFilters.startTime === '06:00' && formFilters.endTime === '14:00'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Ca 1 (06:00-14:00)
            </button>
            <button
              type="button"
              onClick={() => handleShiftSelect('shift2')}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors border cursor-pointer ${
                formFilters.startTime === '14:00' && formFilters.endTime === '22:00'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Ca 2 (14:00-22:00)
            </button>
            <button
              type="button"
              onClick={() => handleShiftSelect('shift3')}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors border cursor-pointer ${
                formFilters.startTime === '22:00' && formFilters.endTime === '06:00'
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Ca đêm qua nửa đêm (22:00 hôm nay - 06:00 hôm sau)"
            >
              Ca 3 (Đêm: 22:00-06:00)
            </button>
            <button
              type="button"
              onClick={() => handleShiftSelect('all')}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors border cursor-pointer ${
                formFilters.startTime === '00:00' && formFilters.endTime === '23:59'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Cả ngày (24h)
            </button>
          </div>
        </div>

        {/* Lưới các trường chọn lọc */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Lọc Dây chuyền */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Dây chuyền sản xuất
            </label>
            <select
              value={formFilters.lineId || 'all'}
              onChange={(e) => handleLineChange(e.target.value)}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Tất cả dây chuyền</option>
              {lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name} ({line.code})
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Thiết bị / Máy (Cascade) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Thiết bị / Máy
            </label>
            <select
              value={formFilters.machineId || 'all'}
              onChange={(e) => handleMachineChange(e.target.value)}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Tất cả thiết bị</option>
              {availableMachines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} ({machine.model || machine.id})
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Chỉ số đo lường (Metric) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Chỉ số đo lường
            </label>
            <select
              value={formFilters.metricId || 'all'}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, metricId: e.target.value }))}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Tất cả chỉ số</option>
              {availableMetrics.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Trạng thái */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Trạng thái cảnh báo
            </label>
            <select
              value={formFilters.status || 'all'}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, status: e.target.value as any }))}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="normal">Bình thường (Normal)</option>
              <option value="warning">Cảnh báo (Warning)</option>
              <option value="critical">Nguy hiểm (Critical)</option>
            </select>
          </div>

          {/* Ngày bắt đầu */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Từ ngày (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={formFilters.startDate || ''}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Đến ngày */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Đến ngày (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={formFilters.endDate || ''}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Giờ bắt đầu */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Từ giờ (HH:mm)
            </label>
            <input
              type="time"
              value={formFilters.startTime || '00:00'}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, startTime: e.target.value }))}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Giờ kết thúc */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Đến giờ (HH:mm)
            </label>
            <input
              type="time"
              value={formFilters.endTime || '23:59'}
              onChange={(e) => setFormFilters((prev) => ({ ...prev, endTime: e.target.value }))}
              className="w-full text-xs h-9.5 px-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-bg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Nút thao tác lọc */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Xóa bộ lọc</span>
          </button>
          <button
            type="button"
            onClick={handleApplyFilters}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Áp dụng bộ lọc</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BẢNG HIỂN THỊ LỊCH SỬ TELEMETRY (MACHINE ACTIVITY LOG TABLE)           */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-factory-card rounded-2xl border border-slate-200 dark:border-factory-border shadow-xs overflow-hidden">
        {/* Header bảng & Thông tin tóm tắt */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Nhật ký Telemetry
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {totalRecords > 0 ? `Hiển thị ${startRecord} - ${endRecord} / ${totalRecords} bản ghi` : '0 bản ghi'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Hiển thị mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-xs py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="10">10 dòng</option>
              <option value="20">20 dòng</option>
              <option value="50">50 dòng</option>
              <option value="100">100 dòng</option>
            </select>
          </div>
        </div>

        {/* Trạng thái lỗi */}
        {error && (
          <div className="p-8 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-3">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              onClick={() => fetchLogs()}
              className="mt-3 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Trạng thái đang tải */}
        {isLoading && !error && (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Đang truy vấn lịch sử hoạt động máy từ máy chủ...
            </p>
          </div>
        )}

        {/* Trạng thái rỗng */}
        {!isLoading && !error && logs.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 mb-3">
              <Database className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isDegraded
                ? 'CSDL trung tâm chưa kết nối. Chưa có bản ghi lịch sử nào được lưu trữ.'
                : 'Chưa có dữ liệu trong khoảng thời gian đã chọn.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Vui lòng thử mở rộng bộ lọc ngày/giờ, chọn dây chuyền khác hoặc bấm "Làm mới" sau khi thiết bị gửi dữ liệu.
            </p>
          </div>
        )}

        {/* Bảng dữ liệu chính */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider py-3 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-3.5 w-[15%]">THỜI GIAN (VN)</th>
                  <th className="py-3 px-2 w-[14%]">DÂY CHUYỀN</th>
                  <th className="py-3 px-2 w-[16%]">THIẾT BỊ / MÁY</th>
                  <th className="py-3 px-2 w-[16%]">CHỈ SỐ ĐO</th>
                  <th className="py-3 px-2 w-[12%]">GIÁ TRỊ ĐO</th>
                  <th className="py-3 px-2 w-[8%]">ĐƠN VỊ</th>
                  <th className="py-3 px-2 w-[10%]">TRẠNG THÁI</th>
                  <th className="py-3 px-3.5 w-[9%] text-right">NGUỒN DỮ LIỆU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {logs.map((log) => {
                  const isCrit = log.status === 'critical';
                  const isWarn = log.status === 'warning';
                  const isSimulation = log.source === 'simulation';

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Cột 1: Thời gian */}
                      <td className="py-3 px-3.5 font-mono text-slate-800 dark:text-slate-200">
                        <span>{formatDateTimeVN(log.timestamp)}</span>
                      </td>

                      {/* Cột 2: Dây chuyền */}
                      <td className="py-3 px-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.lineName}
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {log.lineId}
                        </p>
                      </td>

                      {/* Cột 3: Máy */}
                      <td className="py-3 px-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.machineName}
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {log.machineId}
                        </p>
                      </td>

                      {/* Cột 4: Chỉ số */}
                      <td className="py-3 px-2">
                        <span className="text-slate-800 dark:text-slate-200">
                          {log.metricName}
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {log.metricId}
                        </p>
                      </td>

                      {/* Cột 5: Giá trị đo */}
                      <td className="py-3 px-2 font-mono">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-xs ${
                            isCrit
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                              : isWarn
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          }`}
                        >
                          {Number(log.value).toFixed(2)}
                        </span>
                      </td>

                      {/* Cột 6: Đơn vị */}
                      <td className="py-3 px-2 font-mono text-slate-600 dark:text-slate-400">
                        {log.unit}
                      </td>

                      {/* Cột 7: Trạng thái (Pill Badge) */}
                      <td className="py-3 px-2">
                        {isCrit ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            CRITICAL
                          </span>
                        ) : isWarn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            WARNING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            NORMAL
                          </span>
                        )}
                      </td>

                      {/* Cột 8: Nguồn dữ liệu (Badge Simulation vs Real Device) */}
                      <td className="py-3 px-3.5 text-right">
                        {isSimulation ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                            <Cpu className="w-3 h-3 text-purple-500" />
                            Simulation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40">
                            <Radio className="w-3 h-3 text-sky-500" />
                            Device
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Thanh phân trang dưới chân bảng */}
        {totalRecords > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/20">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Trang <span className="font-semibold text-slate-700 dark:text-slate-200">{currentPage}</span> / {totalPages}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </button>

              {/* Các nút số trang rút gọn */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                let pageNumber = idx + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNumber = currentPage - 2 + idx;
                  if (pageNumber > totalPages) {
                    pageNumber = totalPages - (4 - idx);
                  }
                }
                const isActive = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    disabled={isLoading}
                    className={`min-w-[32px] h-8 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <span>Sau</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
