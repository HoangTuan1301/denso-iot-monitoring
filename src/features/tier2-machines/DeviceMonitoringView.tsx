/**
 * @file DeviceMonitoringView.tsx
 * @description Màn hình Giám sát Thiết bị Vận hành (Device Operational Monitoring) chuẩn DENSO KaiLink
 * - Tập trung chuyên sâu vào theo dõi vận hành, thông số đo lường thực tế, trạng thái cảnh báo và biểu đồ
 * - Phân biệt hoàn toàn với trang cấu hình "Dây chuyền & Thiết bị" (chuyên trách theo dõi vận hành, không có chức năng tạo mới hay chỉnh sửa danh mục)
 * - Tái sử dụng trọn vẹn màn hình Chi tiết Component (MachineDetailModal) với biểu đồ AreaChart, tabs thời gian, QR và ngưỡng
 * - Bổ sung khu vực Thống kê Tổng quan (4 KPI Top Cards) dựa trên dữ liệu thực tế
 * - Bộ lọc đa tiêu chí: Lọc theo Dây chuyền (chuẩn mã LN-PRS-01, LN-ASM-03), Trạng thái, Nguồn dữ liệu, và Tìm kiếm
 * - Hỗ trợ chuyển đổi 2 chế độ xem: Dạng Lưới Thẻ (Grid Cards) và Dạng Bảng Giám sát (Operational Table)
 * - Tự động cập nhật thời gian thực qua WebSocket và đồng bộ CSDL TEST (denso_iot_phase1_test)
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  LayoutGrid,
  List,
  Search,
  RefreshCw,
  LineChart,
  QrCode,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { socketClient } from '../../services/socket';
import { MachineComponent } from '../../types/hierarchy';
import { MachineDetailModal } from '../tier3-metrics/MachineDetailModal';
import { QRCodeModal } from '../../components/qr/QRCodeModal';
import { Tooltip } from '../../components/common/Tooltip';

export function DeviceMonitoringView() {
  const {
    lines,
    selectedLineId,
    fetchLines,
    fetchMachines,
    fetchLatestTelemetry,
    isRealtimeActive,
    simulateTick,
  } = useMonitoringStore();

  const { alarms } = useAlarmStore();

  // Modal states
  const [selectedMachine, setSelectedMachine] = useState<MachineComponent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Filter & Search states
  const [lineFilter, setLineFilter] = useState<string>(selectedLineId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Đồng bộ lineFilter nếu có selectedLineId từ Dashboard
  useEffect(() => {
    if (selectedLineId) {
      setLineFilter(selectedLineId);
    }
  }, [selectedLineId]);

  // Nạp dữ liệu ban đầu và lắng nghe sự kiện thời gian thực
  useEffect(() => {
    fetchLines();
    fetchMachines();
    fetchLatestTelemetry();

    const unsubMachineUpdated = socketClient.on('machine_updated', () => {
      fetchMachines();
    });
    const unsubTelemetry = socketClient.on('telemetry_packet', () => {
      fetchLatestTelemetry();
    });

    return () => {
      unsubMachineUpdated();
      unsubTelemetry();
    };
  }, [fetchLines, fetchMachines, fetchLatestTelemetry]);

  // Gom toàn bộ máy từ các dây chuyền
  const allMachines = useMemo(() => {
    const list: MachineComponent[] = [];
    for (const line of lines) {
      for (const m of line.machines || []) {
        list.push({
          ...m,
          lineId: line.id,
          lineName: line.name,
        });
      }
    }
    return list;
  }, [lines]);

  // Helper tìm thông tin chuẩn của dây chuyền (hóa giải khác biệt LINE-03 vs LN-ASM-03)
  const getLineInfo = (lineId: string) => {
    const found = lines.find((l) => l.id === lineId || l.code === lineId);
    return {
      id: found?.id || lineId,
      code: found?.code || lineId,
      name: found?.name || lineId,
      label: found ? `${found.code} — ${found.name}` : lineId,
    };
  };

  // Tính toán số lượng sự cố chưa giải quyết của từng máy
  const pendingAlarmsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of alarms) {
      if (a.status !== 'resolved') {
        const mId = a.machineId;
        map.set(mId, (map.get(mId) || 0) + 1);
      }
    }
    return map;
  }, [alarms]);

  // Thống kê tổng quan KPI 4 Cards
  const stats = useMemo(() => {
    const total = allMachines.length;
    let normalCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let noDataCount = 0;
    let activeMonitoring = 0;

    for (const m of allMachines) {
      if (m.managementStatus !== 'inactive') {
        activeMonitoring++;
      }
      if (m.status === 'critical') {
        criticalCount++;
      } else if (m.status === 'warning') {
        warningCount++;
      } else if (m.status === 'normal') {
        normalCount++;
      } else {
        noDataCount++;
      }
    }

    return {
      total,
      activeMonitoring,
      normalCount,
      warningCount,
      criticalCount,
      noDataCount,
    };
  }, [allMachines]);

  // Lọc danh sách thiết bị
  const filteredMachines = useMemo(() => {
    return allMachines.filter((m) => {
      // 1. Lọc Dây chuyền
      if (lineFilter !== 'all') {
        const lineInfo = getLineInfo(m.lineId);
        if (m.lineId !== lineFilter && lineInfo.code !== lineFilter && lineInfo.id !== lineFilter) {
          return false;
        }
      }

      // 2. Lọc Trạng thái
      if (statusFilter !== 'all') {
        if (statusFilter === 'normal' && m.status !== 'normal') return false;
        if (statusFilter === 'warning' && m.status !== 'warning') return false;
        if (statusFilter === 'critical' && m.status !== 'critical') return false;
        if (statusFilter === 'no_data' && m.status !== 'no_data' && m.status !== 'offline') return false;
      }

      // 3. Lọc Nguồn dữ liệu
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'FILE_INGEST' && m.dataSourceType !== 'FILE_INGEST') return false;
        if (sourceFilter === 'PLC_DIRECT' && m.dataSourceType === 'FILE_INGEST') return false;
      }

      // 4. Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const lineInfo = getLineInfo(m.lineId);
        const matchCode = (m.code || m.id).toLowerCase().includes(q);
        const matchName = m.name.toLowerCase().includes(q);
        const matchLine = lineInfo.code.toLowerCase().includes(q) || lineInfo.name.toLowerCase().includes(q);
        const matchType = (m.type || '').toLowerCase().includes(q);
        const matchPlc = (m.plc?.name || m.plcName || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchLine && !matchType && !matchPlc) {
          return false;
        }
      }

      return true;
    });
  }, [allMachines, lineFilter, statusFilter, sourceFilter, searchTerm, lines]);

  // Mở modal xem chi tiết
  const handleOpenDetails = (machine: MachineComponent) => {
    setSelectedMachine(machine);
    setIsDetailModalOpen(true);
  };

  // Mở modal xem mã QR
  const handleOpenQR = (machine: MachineComponent) => {
    setSelectedMachine(machine);
    setIsQRModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. HEADER CHÍNH: TIÊU ĐỀ & ĐIỀU KHIỂN THỜI GIAN THỰC                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-factory-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Giám sát Thiết bị
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Theo dõi tình trạng vận hành, chỉ số đo lường thực tế và cảnh báo theo thời gian thực cho từng thiết bị.
              </p>
            </div>
          </div>
        </div>

        {/* Nút tác vụ nhanh: Realtime indicator & nút Refresh */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Live Streaming Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
              isRealtimeActive
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRealtimeActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
              }`}
            />
            <span>{isRealtimeActive ? 'LIVE TELEMETRY' : 'PAUSED'}</span>
          </div>

          <button
            onClick={() => {
              fetchLines();
              fetchMachines();
              fetchLatestTelemetry();
              simulateTick();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors cursor-pointer"
            title="Làm mới dữ liệu từ CSDL"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KHU VỰC THỐNG KÊ TỔNG QUAN (4 TOP-LEVEL KPI CARDS)                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng thiết bị */}
        <div className="bg-white dark:bg-factory-card p-5 rounded-2xl border border-factory-border shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Tổng số thiết bị
            </span>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
              {stats.total}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-medium">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.activeMonitoring}</span> máy đang kích hoạt giám sát
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Hoạt động bình thường */}
        <div className="bg-white dark:bg-factory-card p-5 rounded-2xl border border-factory-border shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Hoạt động bình thường
            </span>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {stats.normalCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Chỉ số kỹ thuật đạt chuẩn an toàn
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Cảnh báo */}
        <div className="bg-white dark:bg-factory-card p-5 rounded-2xl border border-factory-border shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Cảnh báo thông số
            </span>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {stats.warningCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Vượt ngưỡng Warning cần theo dõi
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Nguy hiểm / Cần xử lý */}
        <div className="bg-white dark:bg-factory-card p-5 rounded-2xl border border-factory-border shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Nguy hiểm / Sự cố
            </span>
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 font-mono">
              {stats.criticalCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Vượt ngưỡng Critical hoặc có sự cố
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. THANH ĐIỀU KHIỂN & BỘ LỌC ĐA TIÊU CHÍ (FILTER BAR)                     */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-factory-card p-4 rounded-2xl border border-factory-border shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* 1. Lọc theo Dây chuyền (Hiển thị LN-PRS-01, LN-ASM-03 chuẩn hóa) */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Dây chuyền sản xuất
            </label>
            <select
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Tất cả dây chuyền ({allMachines.length} máy)</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name} ({l.machines?.length || 0} máy)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Lọc theo Trạng thái vận hành */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Trạng thái giám sát
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="normal">Bình thường (NORMAL)</option>
              <option value="warning">Cảnh báo (WARNING)</option>
              <option value="critical">Nguy hiểm (CRITICAL)</option>
              <option value="no_data">Chưa có dữ liệu / Offline</option>
            </select>
          </div>

          {/* 3. Lọc theo Nguồn dữ liệu (CSV vs PLC) */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Nguồn dữ liệu
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Tất cả nguồn</option>
              <option value="FILE_INGEST">FILE CSV (TEST)</option>
              <option value="PLC_DIRECT">PLC / MODBUS</option>
            </select>
          </div>

          {/* 4. Ô tìm kiếm thiết bị */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Tìm kiếm thiết bị
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Mã máy (MC-CYL-01), tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Thanh trạng thái phụ: Số lượng kết quả & Nút chuyển chế độ Grid / Table */}
        <div className="flex items-center justify-between pt-2 border-t border-factory-border text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Hiển thị <strong className="text-slate-900 dark:text-white font-mono">{filteredMachines.length}</strong> / {allMachines.length} thiết bị
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Lưới thẻ</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Bảng danh sách</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. HIỂN THỊ DANH SÁCH THIẾT BỊ: GRID VIEW HOẶC TABLE VIEW                  */}
      {/* ========================================================================= */}
      {filteredMachines.length === 0 ? (
        <div className="bg-white dark:bg-factory-card rounded-2xl border border-factory-border p-12 text-center">
          <Cpu className="w-12 h-12 mx-auto text-slate-400 mb-3 opacity-60" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Không tìm thấy thiết bị phù hợp
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Không có thiết bị nào thỏa mãn bộ lọc hiện tại. Vui lòng chọn lại dây chuyền hoặc xóa từ khóa tìm kiếm.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ------------------------------------------------------------------ */
        /* 4A. CHẾ ĐỘ XEM LƯỚI THẺ (GRID CARDS)                              */
        /* ------------------------------------------------------------------ */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredMachines.map((machine) => {
            const lineInfo = getLineInfo(machine.lineId);
            const isCritical = machine.status === 'critical';
            const isWarning = machine.status === 'warning';
            const isNormal = machine.status === 'normal';
            const pendingAlarms = pendingAlarmsMap.get(machine.id) || pendingAlarmsMap.get(machine.code || '') || 0;
            const isFile = machine.dataSourceType === 'FILE_INGEST';

            return (
              <div
                key={machine.id}
                className={`bg-white dark:bg-factory-card rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isCritical
                    ? 'border-rose-500/70 shadow-rose-950/20'
                    : isWarning
                    ? 'border-amber-500/60 shadow-amber-950/10'
                    : 'border-factory-border hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Phần trên của Card */}
                <div className="p-5 space-y-4">
                  {/* Dòng 1: Badge mã thiết bị, Badge Dây chuyền & Trạng thái */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                        {machine.code || machine.id}
                      </span>
                      <span
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 truncate max-w-[140px]"
                        title={lineInfo.label}
                      >
                        {lineInfo.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {pendingAlarms > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse shadow-xs">
                          <AlertOctagon className="w-3 h-3" />
                          {pendingAlarms} sự cố
                        </span>
                      )}

                      {isNormal ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Bình thường
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Cảnh báo
                        </span>
                      ) : isCritical ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-400 animate-alarm-blink">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Nguy hiểm
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Chưa có dữ liệu
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dòng 2: Tên thiết bị & Vị trí */}
                  <div>
                    <h3
                      className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1 hover:text-emerald-600 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetails(machine)}
                    >
                      {machine.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate" title={lineInfo.name}>
                        {lineInfo.name}
                      </span>
                      {machine.location && (
                        <>
                          <span>&bull;</span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {machine.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dòng 3: Dải thông tin Trạm PLC kế thừa & Nguồn dữ liệu */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Cpu className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="text-slate-500">PLC:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                        {machine.plc?.name || machine.plcName || 'Chưa liên kết PLC'}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isFile ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                          FILE CSV
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          PLC DIRECT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dòng 4: Các Metric tiêu biểu đang thu thập */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Thông số đo lường ({machine.metrics?.length || 0})</span>
                      <span>Giá trị thực tế</span>
                    </div>

                    {!machine.metrics || machine.metrics.length === 0 ? (
                      <div className="p-3 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                        Chưa cấu hình thông số đo lường cho thiết bị này.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {machine.metrics.slice(0, 3).map((metric) => {
                          const mCrit = metric.status === 'critical';
                          const mWarn = metric.status === 'warning';

                          return (
                            <div
                              key={metric.id}
                              onClick={() => handleOpenDetails(machine)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                                mCrit
                                  ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60'
                                  : mWarn
                                  ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/50'
                                  : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                              }`}
                            >
                              <div className="truncate max-w-[180px]">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      mCrit
                                        ? 'bg-rose-500 animate-ping'
                                        : mWarn
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {metric.name}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                  {metric.id.replace('MTR-', '')}
                                  {metric.lastUpdated && ` • ${metric.lastUpdated}`}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`font-mono text-sm font-extrabold ${
                                    mCrit
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : mWarn
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {metric.currentValue}
                                </span>{' '}
                                <span className="font-mono text-[11px] text-slate-500 font-medium">
                                  {metric.unit || '—'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Thẻ: Nút Xem chi tiết & Mã QR */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-factory-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenQR(machine)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    title="Xem mã QR của thiết bị"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Mã QR</span>
                  </button>

                  <button
                    onClick={() => handleOpenDetails(machine)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    <span>Xem chi tiết</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ------------------------------------------------------------------ */
        /* 4B. CHẾ ĐỘ XEM BẢNG GIÁM SÁT (OPERATIONAL TABLE)                  */
        /* ------------------------------------------------------------------ */
        <div className="bg-white dark:bg-factory-card rounded-2xl border border-factory-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-factory-border text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-white/[0.01]">
                  <th className="py-3.5 px-4 w-[12%]">MÃ THIẾT BỊ</th>
                  <th className="py-3.5 px-4 w-[20%]">TÊN THIẾT BỊ</th>
                  <th className="py-3.5 px-4 w-[16%]">DÂY CHUYỀN</th>
                  <th className="py-3.5 px-4 w-[12%]">TRẠM PLC</th>
                  <th className="py-3.5 px-4 w-[12%]">TRẠNG THÁI</th>
                  <th className="py-3.5 px-4 w-[18%]">THÔNG SỐ ĐO CHÍNH</th>
                  <th className="py-3.5 px-4 w-[10%] text-right">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-factory-border">
                {filteredMachines.map((machine) => {
                  const lineInfo = getLineInfo(machine.lineId);
                  const isCritical = machine.status === 'critical';
                  const isWarning = machine.status === 'warning';
                  const isNormal = machine.status === 'normal';
                  const pendingAlarms = pendingAlarmsMap.get(machine.id) || 0;

                  return (
                    <tr
                      key={machine.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Cột 1: Mã thiết bị */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {machine.code || machine.id}
                      </td>

                      {/* Cột 2: Tên thiết bị & Vị trí */}
                      <td className="py-3.5 px-4">
                        <div
                          className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 cursor-pointer"
                          onClick={() => handleOpenDetails(machine)}
                        >
                          {machine.name}
                        </div>
                        {machine.location && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{machine.location}</span>
                          </div>
                        )}
                      </td>

                      {/* Cột 3: Dây chuyền */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block">
                          {lineInfo.code}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate block max-w-[160px]" title={lineInfo.name}>
                          {lineInfo.name}
                        </span>
                      </td>

                      {/* Cột 4: Trạm PLC */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[130px]">
                          {machine.plc?.name || machine.plcName || 'Chưa liên kết'}
                        </span>
                      </td>

                      {/* Cột 5: Trạng thái & Sự cố */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {isNormal ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Bình thường
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Cảnh báo
                            </span>
                          ) : isCritical ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-400 animate-alarm-blink">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Nguy hiểm
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                              Chưa có dữ liệu
                            </span>
                          )}

                          {pendingAlarms > 0 && (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertOctagon className="w-3 h-3" />
                              {pendingAlarms} sự cố
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 6: Thông số đo chính */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                          {machine.metrics && machine.metrics.length > 0 ? (
                            machine.metrics.slice(0, 2).map((metric) => (
                              <span
                                key={metric.id}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono"
                              >
                                <span className="text-slate-500">{metric.id.replace('MTR-', '')}:</span>{' '}
                                <strong className="text-emerald-600 dark:text-emerald-400">{metric.currentValue}</strong>{' '}
                                <span className="text-[10px] text-slate-400">{metric.unit}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">Chưa có metric</span>
                          )}
                        </div>
                      </td>

                      {/* Cột 7: Hành động */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Tooltip content="Tra cứu mã QR">
                            <button
                              onClick={() => handleOpenQR(machine)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>

                          <Tooltip content="Mở chi tiết & biểu đồ lịch sử">
                            <button
                              onClick={() => handleOpenDetails(machine)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                              <span>Chi tiết</span>
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TÁI SỬ DỤNG MODAL CHI TIẾT THIẾT BỊ (MachineDetailModal)               */}
      {/* ========================================================================= */}
      {selectedMachine && (
        <MachineDetailModal
          machine={selectedMachine}
          lineName={getLineInfo(selectedMachine.lineId).name}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onOpenQR={() => {
            setIsDetailModalOpen(false);
            setIsQRModalOpen(true);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. TÁI SỬ DỤNG MODAL MÃ QR (QRCodeModal)                                 */}
      {/* ========================================================================= */}
      {selectedMachine && (
        <QRCodeModal
          machine={selectedMachine}
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
        />
      )}
    </div>
  );
}
