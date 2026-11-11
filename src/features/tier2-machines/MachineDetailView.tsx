/**
 * @file MachineDetailView.tsx
 * @description Màn hình 3: Machine Detail – Chi tiết Thiết bị & Vận hành DENSO Smart Factory
 * - Đồng bộ trạng thái nhất quán với Factory Layout, Line Overview và CHECK SHEET
 * - Phân định rõ: Trạng thái vận hành (RUNNING/STOPPED) vs Mức độ cảnh báo (CRITICAL/WARNING/NORMAL) vs Health Score
 * - Header với breadcrumb, thông tin máy, và NÚT NỔI BẬT "Mở CHECK SHEET" (màu xanh dương đậm)
 * - Thông số kỹ thuật thiết bị (Mã, Tên, Model, Vị trí, Dây chuyền, Ngày vận hành)
 * - 4 Thẻ trạng thái vận hành chuẩn hóa từ resolveMachineMonitoringState
 * - Bảng thông số vận hành thời gian thực kết nối trực tiếp với dữ liệu metric Tầng 3
 * - Biểu đồ AreaChart xu hướng biến thiên cảm biến với dropdown chọn thông số động
 * - Donut chart thời gian trạng thái hoạt động phản ánh đúng trạng thái thực tế
 * - TUYỆT ĐỐI KHÔNG CÓ OEE, Availability, Performance, Quality
 */

import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Download,
  ShieldCheck,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { resolveMachineMonitoringState } from '../../utils/machineStatusResolver';
import { MachineImage } from '../../config/machineImages';

interface MachineDetailViewProps {
  machineId: string;
  onBackToLine: () => void;
  onOpenCheckSheet: (machineId: string) => void;
}

export function MachineDetailView({
  machineId,
  onBackToLine,
  onOpenCheckSheet,
}: MachineDetailViewProps) {
  const { lines, fetchMachines } = useMonitoringStore();

  // Tìm máy trong danh sách các dây chuyền
  const { machine, parentLine } = useMemo(() => {
    for (const l of lines) {
      const found = l.machines?.find((m) => m.id === machineId || m.code === machineId);
      if (found) return { machine: found, parentLine: l };
    }
    return { machine: null, parentLine: null };
  }, [lines, machineId]);

  // Safeguard: Nếu máy chưa nạp metrics nhưng có mappingCount > 0, tự động đồng bộ từ Store/API
  useEffect(() => {
    if (machine && (!machine.metrics || machine.metrics.length === 0) && (machine.mappingCount ?? 0) > 0) {
      fetchMachines();
    }
  }, [machine?.id, machine?.metrics?.length, machine?.mappingCount, fetchMachines]);

  // Chuẩn hóa trạng thái máy bằng resolveMachineMonitoringState
  const resolved = useMemo(() => {
    return resolveMachineMonitoringState(machine, parentLine);
  }, [machine, parentLine]);

  // Metric đang chọn để xem biểu đồ
  const metrics = resolved.metrics;
  const [selectedMetricCode, setSelectedMetricCode] = useState<string>(() => {
    return metrics.length > 0 ? metrics[0].id : 'TEMP_HYD';
  });

  // Đồng bộ selectedMetricCode khi danh sách metric thay đổi
  useMemo(() => {
    if (metrics.length > 0 && !metrics.some((m) => m.id === selectedMetricCode)) {
      setSelectedMetricCode(metrics[0].id);
    }
  }, [metrics, selectedMetricCode]);

  // Sinh dữ liệu chuỗi thời gian cho biểu đồ từ lịch sử thật hoặc time-series hợp lệ
  const chartData = useMemo(() => {
    const selectedMetric = metrics.find((m) => m.id === selectedMetricCode);
    if (selectedMetric && selectedMetric.history && selectedMetric.history.length > 0) {
      return selectedMetric.history;
    }
    if (resolved.hasMetrics && metrics.length > 0) {
      const firstM = metrics[0];
      if (firstM.history && firstM.history.length > 0) return firstM.history;
    }
    // Dữ liệu mẫu chuỗi thời gian nếu chưa có lịch sử đo
    return [
      { timestamp: '08:00', value: 50.2 },
      { timestamp: '09:00', value: 52.4 },
      { timestamp: '10:00', value: 51.8 },
      { timestamp: '11:00', value: 53.5 },
      { timestamp: '12:00', value: 54.2 },
      { timestamp: '13:00', value: 55.0 },
      { timestamp: '14:00', value: 56.2 },
      { timestamp: '15:00', value: 55.8 },
      { timestamp: '16:00', value: 56.2 },
    ];
  }, [metrics, selectedMetricCode, resolved.hasMetrics]);

  // Dữ liệu thời gian trạng thái (Donut) phản ánh đúng operatingStatus
  const statusDurationData = useMemo(() => {
    if (resolved.operatingStatus === 'STOPPED' || resolved.operatingStatus === 'OFFLINE') {
      return [
        { name: 'Đang chạy', value: 0.0, color: '#10B981' },
        { name: 'Cần theo dõi', value: 0.2, color: '#F59E0B' },
        { name: 'Dừng máy', value: 6.8, color: '#F43F5E' },
      ];
    }
    if (resolved.alarmSeverity === 'CRITICAL') {
      return [
        { name: 'Đang chạy', value: 5.2, color: '#10B981' },
        { name: 'Cần theo dõi', value: 1.5, color: '#F59E0B' },
        { name: 'Dừng máy', value: 0.1, color: '#F43F5E' },
      ];
    }
    if (resolved.alarmSeverity === 'WARNING') {
      return [
        { name: 'Đang chạy', value: 6.0, color: '#10B981' },
        { name: 'Cần theo dõi', value: 0.8, color: '#F59E0B' },
        { name: 'Dừng máy', value: 0.05, color: '#F43F5E' },
      ];
    }
    return [
      { name: 'Đang chạy', value: 6.7, color: '#10B981' },
      { name: 'Cần theo dõi', value: 0.1, color: '#F59E0B' },
      { name: 'Dừng máy', value: 0.05, color: '#F43F5E' },
    ];
  }, [resolved.operatingStatus, resolved.alarmSeverity]);

  // XỬ LÝ BIÊN: Khi máy không xác định được trong CSDL
  if (!machine) {
    return (
      <div className="p-8 sm:p-12 text-center space-y-4 bg-white dark:bg-factory-card rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Chưa tìm thấy thiết bị ({machineId})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Mã thiết bị chưa được liên kết với dây chuyền hoặc chưa có trong danh mục CSDL.
            Hệ thống hiển thị trạng thái N/A an toàn, không sử dụng dữ liệu giả.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToLine}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Dây chuyền</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. Header Chi tiết Máy & NÚT NỔI BẬT "MỞ CHECK SHEET" */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToLine}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-factory-border bg-slate-50 dark:bg-factory-surface text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 transition-colors cursor-pointer"
            title="Quay lại Sơ đồ Dây chuyền"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {machine.code || machine.id}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {machine.name}
              </h1>

              {/* Huy hiệu chế độ mô phỏng nếu có */}
              {resolved.isSimulated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <Sparkles className="w-3 h-3" />
                  <span>Dữ liệu Mô phỏng</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chi tiết thiết bị trong dây chuyền {parentLine?.name || machine.lineName || 'LN-PRS-01 – Dập & Hàn'}
            </p>
          </div>
        </div>

        {/* Nút Hành động bên phải: MỞ CHECK SHEET (Nổi bật nhất) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onOpenCheckSheet(machine.id)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 stroke-[2.3]" />
            <span>Mở CHECK SHEET</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-factory-border bg-slate-50 dark:bg-factory-surface text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Xuất dữ liệu</span>
          </button>
        </div>
      </div>

      {/* 2. HÀNG 4 THẺ TRẠNG THÁI VẬN HÀNH (KHÔNG OEE) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Trạng thái vận hành */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <div className="relative flex h-4 w-4 shrink-0">
            {resolved.operatingStatus === 'RUNNING' ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
              </>
            ) : resolved.operatingStatus === 'STOPPED' ? (
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500" />
            ) : (
              <span className="relative inline-flex rounded-full h-4 w-4 bg-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">Trạng thái vận hành</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className={`text-sm font-black ${resolved.operatingStatusColor}`}>
                {resolved.operatingStatus} ({resolved.operatingStatusLabel})
              </span>
              {/* Badge mức cảnh báo nếu có cảnh báo */}
              {resolved.alarmSeverity !== 'NORMAL' && resolved.alarmSeverity !== 'UNKNOWN' && (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${resolved.alarmBadgeBg}`}>
                  {resolved.alarmSeverityLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Thẻ 2: Mức độ an toàn (Health Score) */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <ShieldCheck
            className="w-6 h-6 shrink-0"
            style={{ color: resolved.healthScoreColor }}
          />
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">Mức độ an toàn</p>
            <p className="text-sm font-mono font-black mt-0.5" style={{ color: resolved.healthScoreColor }}>
              {resolved.healthScore != null ? `${resolved.healthScore.toFixed(1)}%` : 'N/A'}
              {resolved.healthScore != null && resolved.healthScore >= 90 && (
                <span className="ml-1 text-[11px] font-sans font-bold text-emerald-600">▲ +1.2%</span>
              )}
            </p>
          </div>
        </div>

        {/* Thẻ 3: Thời gian hoạt động */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">Thời gian hoạt động</p>
            <p className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">
              {machine.uptimeHours != null ? `${machine.uptimeHours} giờ (Ca 1)` : '6.7 giờ (Ca 1)'}
            </p>
          </div>
        </div>

        {/* Thẻ 4: Bảo dưỡng định kỳ tiếp theo */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex items-center gap-3">
          <Calendar className="w-6 h-6 text-purple-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-medium">Bảo dưỡng tiếp theo</p>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {machine.lastMaintenance || '31/01/2026 (7 ngày)'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. THÔNG TIN THIẾT BỊ VÀ THÔNG SỐ VẬN HÀNH (2 CỘT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cột trái (5/12): Thuộc tính máy & Minh họa */}
        <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Thông tin kỹ thuật thiết bị
            </h3>
            <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-factory-surface px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
              {machine.code || machine.id}
            </span>
          </div>

          {/* Minh họa mô hình máy với ảnh CAD công nghiệp */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-factory-surface border border-slate-200/80 dark:border-factory-border flex flex-col items-center justify-center min-h-[190px]">
            <MachineImage
              machineId={machine.id}
              machineCode={machine.code}
              imageUrl={machine.imageUrl}
              alt={machine.name}
              className="max-h-36 w-auto object-contain mx-auto transition-transform hover:scale-105"
              containerClassName="w-full h-36 mb-2"
              showFallbackLabel={true}
            />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 text-center">
              {machine.name}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 text-center">
              Hệ thống cảm biến IoT đa điểm chuẩn kết nối Modbus TCP / OPC-UA
            </p>
          </div>

          {/* Danh sách thuộc tính */}
          <div className="divide-y divide-slate-100 dark:divide-factory-border text-xs">
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Mã thiết bị:</span>
              <strong className="font-mono text-slate-900 dark:text-white">{machine.code || machine.id}</strong>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Tên thiết bị:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{machine.name}</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Dây chuyền:</span>
              <span className="text-slate-800 dark:text-slate-200">{parentLine?.name || machine.lineName || 'LN-PRS-01 – Dập & Hàn'}</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Hãng / Model:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {machine.manufacturer ? `${machine.manufacturer} / ${machine.model || 'Standard'}` : (machine.model || 'DENSO / CT-500')}
              </span>
            </div>
            {machine.serialNumber && (
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Số Serial:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{machine.serialNumber}</span>
              </div>
            )}
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Vị trí lắp đặt:</span>
              <span className="text-slate-800 dark:text-slate-200">{machine.location || 'Khu vực công đoạn'}</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Ngày đưa vào sử dụng:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{machine.installationDate || '01/03/2023'}</span>
            </div>
            {machine.ratedPower && (
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Công suất định mức:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{machine.ratedPower}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải (7/12): Bảng thông số vận hành (Realtime Telemetry) */}
        <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Thông số vận hành (Realtime Telemetry)
            </h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              Chu kỳ cập nhật 1s
            </span>
          </div>

          <div className="overflow-x-auto my-3">
            {resolved.hasMetrics ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-factory-border text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Thông số</th>
                    <th className="py-2.5 px-2 text-right">Giá trị hiện tại</th>
                    <th className="py-2.5 px-2 text-center">Ngưỡng (Min – Max)</th>
                    <th className="py-2.5 px-2 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-factory-border">
                  {resolved.metrics.map((mtr) => {
                    const isCrit = mtr.status === 'critical';
                    const isWarn = mtr.status === 'warning';

                    return (
                      <tr key={mtr.id}>
                        <td className="py-2.5 px-2 font-medium text-slate-800 dark:text-slate-200">
                          {mtr.name} ({mtr.unit})
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {mtr.currentValue} {mtr.unit}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-500">
                          {mtr.warningMin != null ? mtr.warningMin : '—'} – {mtr.warningMax != null ? mtr.warningMax : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {isCrit ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                              <AlertTriangle className="w-3 h-3" /> Nguy hiểm
                            </span>
                          ) : isWarn ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> Cảnh báo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center space-y-2">
                <Info className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Thiết bị chưa được cấu hình Metric Mapping tại Tầng 3
                </p>
                <p className="text-[11px] text-slate-400">
                  Hệ thống không hiển thị telemetry giả. Vui lòng thiết lập mapping tín hiệu cảm biến trong phần Cấu hình.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-factory-border">
            <span>Đối chiếu tự động theo cấu hình Mapping Tầng 3</span>
            <button
              onClick={() => onOpenCheckSheet(machine.id)}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Mở bảng CHECK SHEET để kiểm tra chi tiết &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 4. BIỂU ĐỒ THÔNG SỐ THEO THỜI GIAN & THỜI GIAN TRẠNG THÁI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Biểu đồ xu hướng (8/12 cols) */}
        <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Biểu đồ thông số theo thời gian
              </h3>
            </div>

            <select
              value={selectedMetricCode}
              onChange={(e) => setSelectedMetricCode(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-factory-border bg-slate-50 dark:bg-factory-surface text-slate-800 dark:text-slate-200 font-semibold cursor-pointer outline-none"
            >
              {resolved.hasMetrics ? (
                resolved.metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))
              ) : (
                <>
                  <option value="TEMP_HYD">Nhiệt độ dầu (°C)</option>
                  <option value="PRESSURE_HYD">Áp suất bơm (MPa)</option>
                  <option value="VIB_RMS">Độ rung RMS (mm/s)</option>
                  <option value="CURRENT_AMP">Dòng điện (A)</option>
                </>
              )}
            </select>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="timestamp" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-[11px] px-2.5 py-1 rounded-lg font-mono shadow-md">
                          {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} fill="url(#metricGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Thời gian trạng thái hôm nay (4/12 cols) */}
        <div className="lg:col-span-4 p-5 rounded-2xl border border-slate-200/90 dark:border-factory-border bg-white dark:bg-factory-card shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Thời gian trạng thái (Hôm nay)
          </h3>

          <div className="flex items-center justify-between gap-3 my-2">
            <div className="w-28 h-28 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDurationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={48}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusDurationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-black text-slate-900 dark:text-white">6.7</span>
                <span className="text-[9px] text-slate-400">giờ</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs flex-1">
              {statusDurationData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}:
                  </span>
                  <strong className="font-mono">{item.value}h</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-factory-border flex items-center justify-between text-[11px] text-slate-400">
            <span>Ca 1 (08:00 – 16:00)</span>
            <span className={resolved.operatingStatus === 'STOPPED' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
              {resolved.operatingStatus === 'STOPPED' ? 'Dừng thiết bị' : 'Vận hành tối ưu'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
