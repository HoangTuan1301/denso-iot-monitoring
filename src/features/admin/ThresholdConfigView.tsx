/**
 * @file ThresholdConfigView.tsx
 * @description Màn hình Cấu hình Kênh đo (Mapping) & Ngưỡng cảnh báo theo chuẩn UI/UX ảnh mẫu 3, 4, 5
 * - Bố cục 2 cột (Master - Detail):
 *   + Cột trái (Component / Thiết bị): Danh sách máy theo Dây chuyền, bộ đếm X/X, tìm kiếm, badge loại, số metric & rule
 *   + Cột phải (Metric cho Component): Header kèm bộ đếm X/Y đã gán, tìm kiếm,
 *     Dải metadata máy/PLC, danh sách Thẻ Metric (Card List) với dấu tích trạng thái, mã in hoa font-mono,
 *     trạng thái (Bình thường / Cảnh báo / Nghiêm trọng / Không áp dụng),
 *     Pill Ngưỡng (W ... C ...) hoặc nút "+ Đặt ngưỡng",
 *     Pill Lịch chạy / Ca làm việc hoặc nút "+ Lịch thu thập",
 *     Nút chỉnh sửa và nút Xóa/Bỏ gán kèm xác nhận.
 * - Modal Cấu hình Ngưỡng (Ảnh 4) và Modal Lịch thu thập (Ảnh 5).
 * - Tích hợp WebSocket thời gian thực và đồng bộ CSDL TEST.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sliders,
  Plus,
  RefreshCw,
  Search,
  Layers,
  Edit3,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Check,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { socketClient } from '../../services/socket';
import { apiClient } from '../../services/api';
import { MetricMappingItem, MetricCatalogItem } from '../../types/metric';
import { MachineComponent } from '../../types/hierarchy';
import { Tooltip } from '../../components/common/Tooltip';
import { ModalPortal } from '../../components/common/ModalPortal';
import { MappingFormModal } from './MappingFormModal';
import { ThresholdConfigModal } from './ThresholdConfigModal';
import { ScheduleConfigModal } from './ScheduleConfigModal';

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

function formatThresholdSummary(mapping: MetricMappingItem): string {
  const parts: string[] = [];
  const wMin = mapping.warning_min ?? mapping.thresholds?.warning_min ?? null;
  const wMax = mapping.warning_max ?? mapping.thresholds?.warning_max ?? null;
  const cMin = mapping.critical_min ?? mapping.thresholds?.critical_min ?? null;
  const cMax = mapping.critical_max ?? mapping.thresholds?.critical_max ?? null;

  if (wMin !== null && !isNaN(Number(wMin))) {
    parts.push(`W < ${wMin}`);
  }
  if (wMax !== null && !isNaN(Number(wMax))) {
    parts.push(`W > ${wMax}`);
  }
  if (cMin !== null && !isNaN(Number(cMin))) {
    parts.push(`C < ${cMin}`);
  }
  if (cMax !== null && !isNaN(Number(cMax))) {
    parts.push(`C > ${cMax}`);
  }
  return parts.length > 0 ? parts.join(' • ') : '';
}

function formatScheduleSummary(mapping: MetricMappingItem): string {
  const freq = mapping.frequency_type || mapping.schedule?.frequency_type;
  const cron = mapping.cron_expression || mapping.schedule?.cron_expression;
  const interval = mapping.interval_seconds ?? mapping.schedule?.interval_seconds ?? null;

  if (freq === 'CRON' && cron) {
    return `CRON: ${cron}`;
  }
  if (freq === 'CONTINUOUS' || interval === 1) {
    return 'LIÊN TỤC (1s)';
  }
  if (interval && !isNaN(Number(interval))) {
    return `${interval}s`;
  }
  if (freq === 'INTERVAL') {
    return 'ĐỊNH KỲ';
  }
  return '';
}

export function ThresholdConfigView() {
  const {
    lines,
    selectedMachineId,
    setSelectedMachineId,
    fetchLines,
    fetchMachines,
  } = useMonitoringStore();

  const { currentUser } = useAuthStore();
  const userRole = (currentUser?.role || 'OPERATOR').toUpperCase();
  const isAdmin = userRole === 'ADMIN';
  const isMaintenance = userRole === 'MAINTENANCE';
  const canManageMapping = isAdmin || isMaintenance;

  // Dây chuyền & Máy
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [machineSearchTerm, setMachineSearchTerm] = useState('');
  const [metricSearchTerm, setMetricSearchTerm] = useState('');

  // Dữ liệu từ Backend API
  const [allMappings, setAllMappings] = useState<MetricMappingItem[]>([]);
  const [catalogMetrics, setCatalogMetrics] = useState<MetricCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Modals
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingModalMode, setMappingModalMode] = useState<'create' | 'edit'>('create');
  const [selectedMappingForEdit, setSelectedMappingForEdit] = useState<MetricMappingItem | null>(null);

  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [selectedMappingForThreshold, setSelectedMappingForThreshold] = useState<MetricMappingItem | null>(null);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedMappingForSchedule, setSelectedMappingForSchedule] = useState<MetricMappingItem | null>(null);

  // Tải danh sách mappings & metrics
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mappingsRes, metricsRes] = await Promise.all([
        apiClient.getMappings({}),
        apiClient.getMetrics({ limit: 100 }),
      ]);
      setAllMappings(mappingsRes.mappings || []);
      setCatalogMetrics(metricsRes.metrics || []);
    } catch (err: any) {
      console.warn('[Load Data Error]:', err);
      setActionAlert({
        type: 'error',
        message: err.message || 'Lỗi khi tải dữ liệu từ Backend.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Nạp ban đầu
  useEffect(() => {
    if (lines.length === 0) {
      fetchLines();
      fetchMachines();
    }
    loadData();
  }, [lines.length, fetchLines, fetchMachines, loadData]);

  // Lắng nghe WebSocket
  useEffect(() => {
    const handleRefresh = () => {
      loadData();
    };

    const unsubMappingCreated = socketClient.on('mapping_created', handleRefresh);
    const unsubMappingUpdated = socketClient.on('mapping_updated', handleRefresh);
    const unsubMappingDeleted = socketClient.on('mapping_deleted', handleRefresh);
    const unsubMappingDeactivated = socketClient.on('mapping_deactivated', handleRefresh);
    const unsubMonitoringToggled = socketClient.on('mapping_monitoring_toggled', handleRefresh);
    const unsubThresholdsUpdated = socketClient.on('thresholds_updated', handleRefresh);
    const unsubScheduleUpdated = socketClient.on('schedule_updated', handleRefresh);

    return () => {
      unsubMappingCreated();
      unsubMappingUpdated();
      unsubMappingDeleted();
      unsubMappingDeactivated();
      unsubMonitoringToggled();
      unsubThresholdsUpdated();
      unsubScheduleUpdated();
    };
  }, [loadData]);

  // Tập hợp danh sách tất cả máy móc phẳng theo dây chuyền
  const allMachines = useMemo(() => {
    const list: (MachineComponent & { lineCode: string; lineName: string })[] = [];
    for (const l of lines) {
      for (const m of l.machines || []) {
        list.push({
          ...m,
          lineCode: l.code,
          lineName: l.name,
        });
      }
    }
    return list;
  }, [lines]);

  // Lọc máy theo Line & Search Term
  const filteredMachines = useMemo(() => {
    return allMachines.filter((m) => {
      if (lineFilter !== 'all' && m.lineId !== lineFilter) return false;
      if (machineSearchTerm.trim()) {
        const q = machineSearchTerm.toLowerCase();
        const matchCode = (m.code || m.id).toLowerCase().includes(q);
        const matchName = m.name.toLowerCase().includes(q);
        const matchType = (m.type || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchType) return false;
      }
      return true;
    });
  }, [allMachines, lineFilter, machineSearchTerm]);

  // Xác định máy hiện đang chọn
  const currentMachine = useMemo(() => {
    if (selectedMachineId) {
      const found = allMachines.find((m) => m.id === selectedMachineId);
      if (found) return found;
    }
    return filteredMachines[0] || allMachines[0] || null;
  }, [selectedMachineId, allMachines, filteredMachines]);

  // Đồng bộ selectedMachineId nếu chưa có
  useEffect(() => {
    if (!selectedMachineId && currentMachine) {
      setSelectedMachineId(currentMachine.id);
    }
  }, [selectedMachineId, currentMachine, setSelectedMachineId]);

  // State xử lý Checkbox & Modal xác nhận gỡ mapping
  const [togglingMetricId, setTogglingMetricId] = useState<string | null>(null);
  const [unmapTarget, setUnmapTarget] = useState<{ metric: MetricCatalogItem; mapping: MetricMappingItem } | null>(null);
  const [isUnmapping, setIsUnmapping] = useState(false);

  // Mappings cho máy được chọn
  const mappingsForCurrentMachine = useMemo(() => {
    if (!currentMachine) return [];
    return allMappings.filter((m) => m.machine_id === currentMachine.id);
  }, [allMappings, currentMachine]);

  // Tra cứu nhanh mapping theo metric_id cho currentMachine
  const mappingByMetricId = useMemo(() => {
    const map = new Map<string, MetricMappingItem>();
    for (const m of mappingsForCurrentMachine) {
      map.set(m.metric_id, m);
    }
    return map;
  }, [mappingsForCurrentMachine]);

  // Hiển thị TOÀN BỘ thông số catalog cho thiết bị được chọn, kèm trạng thái mapping
  const displayedMetricsWithMapping = useMemo(() => {
    return catalogMetrics
      .map((metric) => {
        const mapping = mappingByMetricId.get(metric.id) || null;
        return {
          metric,
          mapping,
          isMapped: Boolean(mapping),
        };
      })
      .filter(({ metric, mapping }) => {
        if (!metricSearchTerm.trim()) return true;
        const q = metricSearchTerm.toLowerCase();
        const matchCode = metric.code.toLowerCase().includes(q);
        const matchName = metric.name.toLowerCase().includes(q);
        const matchCat = (metric.category || '').toLowerCase().includes(q);
        const matchUnit = (metric.unit || '').toLowerCase().includes(q);
        const matchMappingCode = mapping ? mapping.mapping_code.toLowerCase().includes(q) : false;
        const matchChannel = mapping ? (mapping.channel_name || '').toLowerCase().includes(q) : false;
        return matchCode || matchName || matchCat || matchUnit || matchMappingCode || matchChannel;
      });
  }, [catalogMetrics, mappingByMetricId, metricSearchTerm]);

  // Tính số lượng metric và rule cho từng máy
  const machineStatsMap = useMemo(() => {
    const map = new Map<string, { metricCount: number; ruleCount: number }>();
    for (const m of allMachines) {
      const machineMaps = allMappings.filter((item) => item.machine_id === m.id);
      const metricCount = machineMaps.length;
      const ruleCount = machineMaps.filter(
        (item) =>
          item.thresholdId ||
          item.thresholds?.id ||
          item.warning_min !== null ||
          item.warning_max !== null ||
          item.thresholds?.warning_max !== null ||
          item.critical_min !== null ||
          item.critical_max !== null ||
          item.thresholds?.critical_max !== null
      ).length;
      map.set(m.id, { metricCount, ruleCount });
    }
    return map;
  }, [allMachines, allMappings]);

  // Xử lý bật/tắt checkbox gán thông số cho thiết bị
  const handleToggleMetricAssignment = async (metric: MetricCatalogItem, mapping: MetricMappingItem | null) => {
    if (!canManageMapping) {
      setActionAlert({
        type: 'warning',
        message: 'Bạn không có quyền thay đổi gán thông số (yêu cầu ADMIN hoặc MAINTENANCE).',
      });
      return;
    }
    if (!currentMachine) return;

    if (mapping) {
      // Đã gán -> Mở modal xác nhận trước khi gỡ
      setUnmapTarget({ metric, mapping });
    } else {
      // Chưa gán -> Thực hiện gán ngay
      try {
        setTogglingMetricId(metric.id);
        const cleanMachineCode = (currentMachine.code || currentMachine.id).replace(/[^A-Za-z0-9_-]/g, '');
        const cleanMetricCode = metric.code.replace(/[^A-Za-z0-9_-]/g, '');
        const mappingCode = `MTR-${cleanMachineCode}-${cleanMetricCode}`.substring(0, 64);
        const channelName = `${metric.name} - ${currentMachine.name}`;

        await apiClient.createMapping({
          machine_id: currentMachine.id,
          metric_id: metric.id,
          mapping_code: mappingCode,
          channel_name: channelName,
        });

        setActionAlert({
          type: 'success',
          message: `Đã gán thành công thông số "${metric.name}" (${metric.code}) vào thiết bị "${currentMachine.name}".`,
        });
        await loadData();
      } catch (err: any) {
        console.error('[Assign Metric Error]:', err);
        setActionAlert({
          type: 'error',
          message: err.message || 'Lỗi khi gán thông số vào thiết bị.',
        });
      } finally {
        setTogglingMetricId(null);
      }
    }
  };

  // Xác nhận gỡ mapping khỏi thiết bị
  const handleConfirmUnmap = async () => {
    if (!unmapTarget) return;
    setIsUnmapping(true);
    setActionAlert(null);
    try {
      await apiClient.deleteMapping(unmapTarget.mapping.id);
      setActionAlert({
        type: 'success',
        message: `Đã gỡ thông số "${unmapTarget.metric.name}" (${unmapTarget.metric.code}) khỏi thiết bị "${currentMachine?.name}". Thông số trong Danh mục vẫn được bảo toàn.`,
      });
      setUnmapTarget(null);
      await loadData();
    } catch (err: any) {
      console.error('[Unmap Metric Error]:', err);
      setActionAlert({
        type: 'error',
        message: err.message || 'Không thể gỡ thông số khỏi thiết bị.',
      });
    } finally {
      setIsUnmapping(false);
    }
  };

  // Tính trạng thái đánh giá hiện tại của metric
  const getMetricTelemetryStatus = (mapping: MetricMappingItem) => {
    const hasThresholds =
      mapping.warning_min !== null ||
      mapping.warning_max !== null ||
      mapping.critical_min !== null ||
      mapping.critical_max !== null;

    if (!hasThresholds) {
      return { status: 'none', label: 'Không áp dụng', color: 'slate' };
    }

    // Tra cứu giá trị thực tế nếu có trong telemetry
    let currentValue: number | null = null;
    if (currentMachine && currentMachine.metrics) {
      const mVal = currentMachine.metrics.find(
        (item) => item.id === mapping.metricCode || item.id === mapping.metric_id || item.name === mapping.metricName
      );
      if (mVal && typeof mVal.currentValue === 'number') {
        currentValue = mVal.currentValue;
      }
    }

    if (currentValue === null) {
      return { status: 'normal', label: 'Bình thường', color: 'emerald' };
    }

    // Kiểm tra Critical
    if (mapping.critical_max !== null && mapping.critical_max !== undefined && currentValue >= mapping.critical_max) {
      return { status: 'critical', label: 'Nghiêm trọng', color: 'rose' };
    }
    if (mapping.critical_min !== null && mapping.critical_min !== undefined && currentValue <= mapping.critical_min) {
      return { status: 'critical', label: 'Nghiêm trọng', color: 'rose' };
    }

    // Kiểm tra Warning
    if (mapping.warning_max !== null && mapping.warning_max !== undefined && currentValue >= mapping.warning_max) {
      return { status: 'warning', label: 'Cảnh báo', color: 'amber' };
    }
    if (mapping.warning_min !== null && mapping.warning_min !== undefined && currentValue <= mapping.warning_min) {
      return { status: 'warning', label: 'Cảnh báo', color: 'amber' };
    }

    return { status: 'normal', label: 'Bình thường', color: 'emerald' };
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HEADER: TIÊU ĐỀ & MÔ TẢ CHUẨN UI MẪU 3                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Cấu hình / Mapping & Ngưỡng cảnh báo
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Mapping & Ngưỡng cảnh báo
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Chọn dây chuyền — chọn thiết bị — gán thông số và cấu hình ngưỡng cảnh báo, lịch thu thập cho từng thông số.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Thông báo thao tác */}
      {actionAlert && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
            actionAlert.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : actionAlert.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : actionAlert.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionAlert.message}</span>
          </div>
          <button
            onClick={() => setActionAlert(null)}
            className="opacity-70 hover:opacity-100 text-sm font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BỐ CỤC 2 CỘT CHUẨN ẢNH MẪU 3 (MASTER - DETAIL)                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ======================================================================= */}
        {/* CỘT TRÁI (4 CỘT): THIẾT BỊ                                              */}
        {/* ======================================================================= */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
          {/* Header Thiết bị & Bộ đếm X/X */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Thiết bị
            </h2>
            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {filteredMachines.length}/{allMachines.length}
            </span>
          </div>

          {/* Chọn Dây chuyền sản xuất */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Dây chuyền sản xuất
            </label>
            <select
              value={lineFilter}
              onChange={(e) => {
                setLineFilter(e.target.value);
                // Tự động chọn máy đầu tiên của luồng mới
                const lineMachines = allMachines.filter((m) =>
                  e.target.value === 'all' ? true : m.lineId === e.target.value
                );
                if (lineMachines.length > 0) {
                  setSelectedMachineId(lineMachines[0].id);
                }
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Tất cả dây chuyền ({allMachines.length} máy)</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name} ({l.machines?.length || 0} máy)
                </option>
              ))}
            </select>
          </div>

          {/* Tìm thiết bị theo mã hoặc tên */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm thiết bị theo mã, tên..."
              value={machineSearchTerm}
              onChange={(e) => setMachineSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Danh sách Thiết bị */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredMachines.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Không tìm thấy thiết bị phù hợp.
              </div>
            ) : (
              filteredMachines.map((m) => {
                const isSelected = currentMachine?.id === m.id;
                const stats = machineStatsMap.get(m.id) || { metricCount: 0, ruleCount: 0 };

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMachineId(m.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 border-l-4 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-xs font-bold ${
                        isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                      }`}>
                        {m.code || m.id}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {m.lineCode}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1 truncate">
                      {m.name}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {m.type || 'THIẾT BỊ'}
                      </span>

                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {stats.metricCount} thông số &bull; {stats.ruleCount} quy tắc
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* CỘT PHẢI (8 CỘT): THÔNG SỐ CỦA THIẾT BỊ ĐƯỢC CHỌN                       */}
        {/* ======================================================================= */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          {currentMachine ? (
            <>
              {/* Header Cột Phải: "Thông số của [TÊN THIẾT BỊ]" & Bộ đếm X/Y */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Thông số của {currentMachine.name} ({currentMachine.code || currentMachine.id})
                  </h2>
                </div>

                <div className="text-xs font-mono font-semibold text-slate-500">
                  {mappingsForCurrentMachine.length}/{catalogMetrics.length} đã gán
                </div>
              </div>

              {/* Thanh công cụ: Ô tìm kiếm thông số */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm thông số theo mã, tên hoặc nhóm..."
                  value={metricSearchTerm}
                  onChange={(e) => setMetricSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Dải metadata thiết bị: Tên · Loại · Nguồn dữ liệu/PLC */}
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 py-1">
                <span>{currentMachine.name}</span>
                <span>&bull;</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {currentMachine.type || 'THIẾT BỊ'}
                </span>
                <span>&bull;</span>
                <span>
                  Nguồn PLC:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {currentMachine.plc?.name || currentMachine.plcName || currentMachine.plcId || 'Trạm PLC Dây chuyền'}
                  </strong>
                </span>
              </div>

              {/* Danh sách thẻ Thông số (Hiển thị TOÀN BỘ thông số catalog theo yêu cầu 2.1) */}
              <div className="space-y-3 pt-1">
                {displayedMetricsWithMapping.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <Sliders className="w-8 h-8 opacity-40 mx-auto text-slate-400" />
                    <div>
                      {metricSearchTerm.trim()
                        ? `Không tìm thấy thông số nào phù hợp với từ khóa "${metricSearchTerm}".`
                        : 'Chưa có thông số nào trong Danh mục Thông số.'}
                    </div>
                  </div>
                ) : (
                  displayedMetricsWithMapping.map(({ metric, mapping, isMapped }) => {
                    const catBadge = getCategoryDisplay(metric.category);

                    if (isMapped && mapping) {
                      // =======================================================
                      // 1. THÔNG SỐ ĐÃ ĐƯỢC GÁN CHO THIẾT BỊ (Checkbox TÍCH SẴN)
                      // =======================================================
                      const statusInfo = getMetricTelemetryStatus(mapping);
                      const thresholdText = formatThresholdSummary(mapping);
                      const scheduleText = formatScheduleSummary(mapping);
                      const isActive = Boolean(mapping.monitoring_enabled) && mapping.status === 'ACTIVE';

                      return (
                        <div
                          key={metric.id}
                          className={`rounded-2xl border p-4 transition-all ${
                            isActive
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-80'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Khối Thông tin Metric (Bên trái) */}
                            <div className="flex items-start gap-3">
                              {/* Checkbox ĐÃ TÍCH: Nhấn để mở xác nhận gỡ gán */}
                              <Tooltip content={canManageMapping ? 'Bỏ tích để gỡ thông số khỏi thiết bị' : 'Yêu cầu quyền ADMIN hoặc MAINTENANCE'}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleMetricAssignment(metric, mapping)}
                                  disabled={!canManageMapping || togglingMetricId === metric.id}
                                  className="mt-0.5 w-5 h-5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
                                >
                                  {togglingMetricId === metric.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  )}
                                </button>
                              </Tooltip>

                              {/* Mã, Nhóm, Status Badge & Tên */}
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                                    {metric.code}
                                  </span>

                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catBadge.className}`}>
                                    {catBadge.name}
                                  </span>

                                  {/* Badge Trạng thái đánh giá */}
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                      statusInfo.color === 'rose'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                        : statusInfo.color === 'amber'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                        : statusInfo.color === 'emerald'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        statusInfo.color === 'rose'
                                          ? 'bg-rose-600'
                                          : statusInfo.color === 'amber'
                                          ? 'bg-amber-600'
                                          : statusInfo.color === 'emerald'
                                          ? 'bg-emerald-600'
                                          : 'bg-slate-400'
                                      }`}
                                    />
                                    {statusInfo.label}
                                  </span>
                                </div>

                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {mapping.channel_name || metric.name}{' '}
                                  {metric.unit && <span>&bull; {metric.unit}</span>}
                                  {mapping.plc_register && (
                                    <span className="font-mono text-[11px] ml-1 text-slate-400">
                                      ({mapping.plc_register} x{mapping.scale_factor || 1.0})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Khối Điều khiển: Ngưỡng & Lịch & Hành động (Bên phải) */}
                            <div className="flex flex-wrap items-center gap-2 md:self-center">
                              {/* CỤM CẤU HÌNH NGƯỠNG */}
                              {thresholdText ? (
                                <button
                                  onClick={() => {
                                    setSelectedMappingForThreshold(mapping);
                                    setIsThresholdModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                >
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    Ngưỡng:
                                  </span>
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                    {thresholdText}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedMappingForThreshold(mapping);
                                    setIsThresholdModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-500 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <span className="text-[11px] font-bold">Ngưỡng:</span>
                                  <span className="italic">Chưa cấu hình</span>
                                  <Plus className="w-3 h-3 text-amber-600 ml-0.5" />
                                </button>
                              )}

                              {/* CỤM CẤU HÌNH LỊCH CHẠY / PHIÊN */}
                              {scheduleText ? (
                                <button
                                  onClick={() => {
                                    setSelectedMappingForSchedule(mapping);
                                    setIsScheduleModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                >
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    Phiên:
                                  </span>
                                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                                    {scheduleText}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedMappingForSchedule(mapping);
                                    setIsScheduleModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-800/80 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-500 text-blue-700 dark:text-blue-400 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <span className="text-[11px] font-bold">Lịch:</span>
                                  <span className="italic">Chưa cấu hình</span>
                                  <Plus className="w-3 h-3 text-blue-600 ml-0.5" />
                                </button>
                              )}

                              {/* Nút sửa Mapping (plc_register, scale_factor, channel_name) */}
                              {canManageMapping && (
                                <Tooltip content="Chỉnh sửa kênh đo">
                                  <button
                                    onClick={() => {
                                      setSelectedMappingForEdit(mapping);
                                      setMappingModalMode('edit');
                                      setIsMappingModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </Tooltip>
                              )}

                              {/* Nút Xóa / Bỏ gán mapping */}
                              {canManageMapping && (
                                <Tooltip content="Bỏ gán thông số khỏi thiết bị">
                                  <button
                                    onClick={() => setUnmapTarget({ metric, mapping })}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-400 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // =======================================================
                      // 2. THÔNG SỐ CHƯA GÁN (Checkbox CHƯA TÍCH)
                      // =======================================================
                      return (
                        <div
                          key={metric.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 opacity-80 hover:opacity-100"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Khối Thông tin Metric (Bên trái) */}
                            <div className="flex items-start gap-3">
                              {/* Checkbox CHƯA TÍCH: Nhấn để gán ngay */}
                              <Tooltip content={canManageMapping ? 'Tích chọn để gán thông số này vào thiết bị' : 'Yêu cầu quyền ADMIN hoặc MAINTENANCE'}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleMetricAssignment(metric, null)}
                                  disabled={!canManageMapping || togglingMetricId === metric.id}
                                  className="mt-0.5 w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500 hover:bg-emerald-50/30 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  {togglingMetricId === metric.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 stroke-[2] opacity-0 hover:opacity-40 text-emerald-600" />
                                  )}
                                </button>
                              </Tooltip>

                              {/* Mã, Tên, Đơn vị, Kiểu */}
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                                    {metric.code}
                                  </span>

                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catBadge.className}`}>
                                    {catBadge.name}
                                  </span>

                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                                    {metric.dataType}
                                  </span>
                                </div>

                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                  {metric.name} &bull; {metric.unit}
                                  {metric.description && (
                                    <span className="text-slate-400 ml-1 italic">— {metric.description}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Bên phải: Trạng thái chưa gán & Nút gán nhanh */}
                            <div className="flex items-center gap-2 md:self-center">
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
                                Chưa gán
                              </span>
                              {canManageMapping && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleMetricAssignment(metric, null)}
                                  disabled={togglingMetricId === metric.id}
                                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                  + Gán vào thiết bị
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400">
              Vui lòng chọn một Thiết bị bên trái để xem cấu hình thông số và ngưỡng cảnh báo.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CÁC MODAL NGHIỆP VỤ (XÁC NHẬN GỠ MAPPING, FORM MAPPING, THRESHOLD, SCHEDULE) */}
      {/* ========================================================================= */}

      {/* Modal Xác nhận Gỡ Thông Số khỏi Thiết Bị */}
      {unmapTarget && (
        <ModalPortal isOpen={!!unmapTarget} onClose={() => setUnmapTarget(null)}>
          <div
            className="w-full max-w-md bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Xác nhận gỡ thông số khỏi thiết bị
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Thiết bị: <strong className="text-slate-700 dark:text-slate-200">{currentMachine?.name}</strong> ({currentMachine?.code || currentMachine?.id})
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã thông số:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{unmapTarget.metric.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tên hiển thị:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{unmapTarget.metric.name}</span>
              </div>
              {unmapTarget.mapping.channel_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Kênh đo:</span>
                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{unmapTarget.mapping.channel_name}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Hành động này sẽ gỡ kênh đo và xóa các cấu hình ngưỡng cảnh báo, lịch thu thập của thông số này trên thiết bị <strong className="text-slate-800 dark:text-slate-200">{currentMachine?.name}</strong>.
            </p>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              &bull; Thông số trong <strong>Danh mục Thông số</strong> vẫn được bảo toàn nguyên vẹn.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnmapTarget(null)}
                disabled={isUnmapping}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmUnmap}
                disabled={isUnmapping}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isUnmapping ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang gỡ...</span>
                  </>
                ) : (
                  <span>Gỡ thông số</span>
                )}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Gán / Sửa Mapping Thông Số */}
      <MappingFormModal
        isOpen={isMappingModalOpen}
        onClose={() => {
          setIsMappingModalOpen(false);
          setSelectedMappingForEdit(null);
        }}
        mode={mappingModalMode}
        machine={currentMachine}
        initialMapping={selectedMappingForEdit}
        existingMetricIds={mappingsForCurrentMachine.map((m) => m.metric_id)}
        onSuccess={loadData}
      />

      {/* Modal Cấu hình Ngưỡng (Ảnh mẫu 4) */}
      <ThresholdConfigModal
        isOpen={isThresholdModalOpen}
        onClose={() => {
          setIsThresholdModalOpen(false);
          setSelectedMappingForThreshold(null);
        }}
        mapping={selectedMappingForThreshold}
        onSuccess={loadData}
      />

      {/* Modal Lịch thu thập / Phiên giao dịch (Ảnh mẫu 5) */}
      <ScheduleConfigModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedMappingForSchedule(null);
        }}
        mapping={selectedMappingForSchedule}
        onSuccess={loadData}
      />
    </div>
  );
}
