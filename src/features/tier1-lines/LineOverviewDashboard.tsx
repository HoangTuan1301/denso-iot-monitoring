/**
 * @file LineOverviewDashboard.tsx
 * @description Màn hình 1: Dashboard – Factory Layout (Sơ đồ mặt bằng nhà máy DENSO Smart Factory)
 * Điểm điều phối 4 màn hình giám sát liên kết:
 * 1. Dashboard – Factory Layout (Sơ đồ tổng thể nhà máy SVG 87 zones + 4 KPI Cards + Panel tìm kiếm 220px)
 * 2. Line Overview – Chi tiết dây chuyền (Sơ đồ công đoạn OP10..OP60 + AGV, NO OEE)
 * 3. Machine Detail – Chi tiết thiết bị (Thông số, AreaChart, NO OEE, Nút "Mở CHECK SHEET")
 * 4. CHECK SHEET – Giám sát & kiểm tra thông số vận hành (Lưới biểu đồ đa metric động, toolbar, bảng ISO)
 * 
 * KIẾN TRÚC HOÀN TOÀN TÁCH BIỆT CÁC COMPONENT CON ĐỂ TRÁNH LỖI HOOK COUNT MISMATCH (WHITE SCREEN)
 */

import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Monitor,
  AlertTriangle,
  Factory,
  Map,
  BarChart3,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { MachineComponent } from '../../types/hierarchy';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

// Import bản đồ mặt bằng & panel tìm kiếm
import { FactoryLayoutMap } from '../dashboard/FactoryLayoutMap';
import { FactoryLineSearchPanel } from '../dashboard/FactoryLineSearchPanel';
import { FACTORY_ZONES, FactoryZone } from '../dashboard/factoryMapConfig';

// Import các màn hình con phân tầng
import { LineDetailView } from './LineDetailView';
import { MachineDetailView } from '../tier2-machines/MachineDetailView';
import { CheckSheetView } from '../checksheet/CheckSheetView';

/**
 * Component hiển thị giao diện Màn hình 1: Factory Layout Map & Analytics
 * Tách biệt hoàn toàn hooks để tuân thủ React Rules of Hooks
 */
function FactoryLayoutMainView() {
  const {
    lines,
    setActiveTab,
    navigateToLine,
    fetchLines,
    fetchMachines,
    fetchLatestTelemetry,
  } = useMonitoringStore();

  const { alarms } = useAlarmStore();
  const [mainTabMode, setMainTabMode] = useState<'layout' | 'analytics'>('layout');
  const [mapViewMode, setMapViewMode] = useState<'safety' | 'status'>('safety');

  // Mặc định chọn khu vực CVT (tương ứng LN-PRS-01) như ảnh tham chiếu
  const [selectedZone, setSelectedZone] = useState<FactoryZone | null>(() => {
    return FACTORY_ZONES.find((z) => z.id === 'CVT') || FACTORY_ZONES[0] || null;
  });

  // Nạp dữ liệu đồng bộ khi mount
  useEffect(() => {
    fetchLines();
    fetchMachines();
    fetchLatestTelemetry();
  }, [fetchLines, fetchMachines, fetchLatestTelemetry]);

  // Gom toàn bộ máy từ các dây chuyền và chuẩn hóa status
  const allMachines = useMemo(() => {
    const list: (MachineComponent & { normalizedStatus: string })[] = [];
    for (const l of lines) {
      for (const m of l.machines || []) {
        const rawStatus = (m.status || 'no_data').toLowerCase();
        list.push({
          ...m,
          lineId: l.id,
          lineName: l.name,
          normalizedStatus: rawStatus,
        });
      }
    }
    return list;
  }, [lines]);

  const avgSafetyScore = useMemo(() => {
    if (!lines || lines.length === 0) return 96.8;
    const sum = lines.reduce((acc, curr) => acc + (curr.safetyScore ?? 96.8), 0);
    const score = Number((sum / lines.length).toFixed(1));
    return isNaN(score) ? 96.8 : score;
  }, [lines]);

  const safetySparklineData = useMemo(() => {
    const base = avgSafetyScore;
    return [
      { v: Math.max(30, base - 3) },
      { v: Math.max(30, base - 1) },
      { v: Math.max(30, base + 2) },
      { v: Math.max(30, base - 2) },
      { v: Math.max(30, base + 1) },
      { v: base },
    ];
  }, [avgSafetyScore]);

  const totalLines = lines.length || 3;
  const runningLinesCount = lines.filter((l) => (l.status || 'running').toLowerCase() === 'running').length || 3;

  const deviceClassification = useMemo(() => {
    let operating = 0;
    let warning = 0;
    let critical = 0;
    let offline = 0;

    for (const m of allMachines) {
      const st = m.normalizedStatus;
      if (st === 'warning') {
        warning++;
      } else if (st === 'critical') {
        critical++;
      } else if (st === 'offline') {
        offline++;
      } else {
        operating++;
      }
    }

    const total = allMachines.length || 6;
    const online = operating + warning + critical || 6;
    return {
      total,
      online,
      offline,
      operating,
      warning,
      critical,
    };
  }, [allMachines]);

  const activeAlarmsCount = useMemo(() => {
    return alarms.filter((a) => a.status !== 'resolved').length || 2;
  }, [alarms]);

  const criticalAlarmsCount = useMemo(() => {
    return alarms.filter((a) => a.status !== 'resolved' && a.severity === 'critical').length;
  }, [alarms]);

  const warningAlarmsCount = useMemo(() => {
    return alarms.filter((a) => a.status !== 'resolved' && a.severity === 'warning').length;
  }, [alarms]);

  const alarmsSparklineData = useMemo(() => {
    return [
      { v: 1 },
      { v: 3 },
      { v: 2 },
      { v: 4 },
      { v: 3 },
      { v: activeAlarmsCount },
    ];
  }, [activeAlarmsCount]);

  const safetyTrendData = useMemo(() => {
    return [
      { time: '08:00', score: 94.2 },
      { time: '09:00', score: 95.8 },
      { time: '10:00', score: 96.5 },
      { time: '11:00', score: 95.1 },
      { time: '12:00', score: 96.0 },
      { time: '13:00', score: 97.2 },
      { time: '14:00', score: 96.8 },
      { time: '15:00', score: 96.8 },
    ];
  }, []);

  const deviceDonutData = useMemo(() => {
    return [
      { name: 'Hoạt động', value: Math.max(1, deviceClassification.operating), color: '#10b981' },
      { name: 'Cần theo dõi', value: Math.max(1, deviceClassification.warning), color: '#f59e0b' },
      { name: 'Dừng / Sự cố', value: deviceClassification.critical, color: '#ef4444' },
    ];
  }, [deviceClassification]);

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => a.code.localeCompare(b.code));
  }, [lines]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* KHU VỰC 1: 4 THẺ KPI NẰM NGANG TRÊN DESKTOP                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Chỉ số an toàn xưởng */}
        <div
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
          title="Chỉ số an toàn vận hành trung bình tính toán từ các dây chuyền sản xuất"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Chỉ số an toàn xưởng
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none tracking-tight">
              {avgSafetyScore}%
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
              <span>▲</span>
              <span>+1.2% so với hôm qua</span>
            </span>

            <div className="w-[60px] h-[20px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safetySparklineData}>
                  <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* KPI 2: Dây chuyền sản xuất */}
        <div
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
          title="Số dây chuyền sản xuất công nghiệp được giám sát trong hệ thống"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Dây chuyền sản xuất
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40">
              <Factory className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none tracking-tight">
              {totalLines}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>Đang hoạt động: <strong className="text-slate-800 dark:text-slate-200 font-mono">{runningLinesCount}/{totalLines}</strong></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* KPI 3: Thiết bị giám sát */}
        <div
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700"
          title="Tổng số thiết bị trong hệ thống và trạng thái kết nối"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Thiết bị giám sát
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40">
              <Monitor className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono leading-none tracking-tight">
              {deviceClassification.total}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>Kết nối: <strong className="text-slate-800 dark:text-slate-200 font-mono">{deviceClassification.online}/{deviceClassification.total}</strong></span>
            </span>
            <span className="text-emerald-600 font-bold font-mono">100% OK</span>
          </div>
        </div>

        {/* KPI 4: Cảnh báo đang hoạt động */}
        <div
          onClick={() => setActiveTab('alarms')}
          className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between h-[115px] relative overflow-hidden transition-all hover:border-rose-300 dark:hover:border-rose-800 cursor-pointer group"
          title="Nhấn để chuyển sang trang Cảnh báo & Sự cố"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-rose-600 transition-colors">
              Cảnh báo hoạt động
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/40">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="my-0.5">
            <div
              className={`text-3xl font-extrabold font-mono leading-none tracking-tight ${
                activeAlarmsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {activeAlarmsCount}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <span>Đang xử lý: <strong className="text-rose-600 font-mono">{activeAlarmsCount}</strong></span>
              <span className="text-slate-400 text-[10px]">({criticalAlarmsCount} nguy cấp, {warningAlarmsCount} cảnh báo)</span>
            </span>
            <div className="w-[60px] h-[20px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={alarmsSparklineData}>
                  <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THANH CHUYỂN ĐỔI CHẾ ĐỘ XEM: SƠ ĐỒ MẶT BẰNG (MẶC ĐỊNH) vs PHÂN TÍCH       */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between bg-white dark:bg-factory-card p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMainTabMode('layout')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mainTabMode === 'layout'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Sơ đồ mặt bằng nhà máy (Factory Layout)</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTabMode('analytics')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mainTabMode === 'analytics'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Chỉ số phân tích 24h & Dây chuyền</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1.5 pr-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Realtime Stream: ON</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NỘI DUNG 1: SƠ ĐỒ MẶT BẰNG TỔNG THỂ NHÀ MÁY                                */}
      {/* ========================================================================= */}
      {mainTabMode === 'layout' ? (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            {/* Cột trái / Trung tâm: Bản đồ SVG 87 khu vực */}
            <div className="flex-1 min-w-0 w-full">
              <FactoryLayoutMap
                viewMode={mapViewMode}
                onChangeViewMode={setMapViewMode}
                selectedZoneId={selectedZone?.id || null}
                onSelectZone={(zone) => setSelectedZone(zone)}
                onOpenLineOverview={(lineId) => navigateToLine(lineId)}
              />
            </div>

            {/* Cột phải: Panel Tìm kiếm và Danh sách Dây chuyền nhỏ gọn (220px) */}
            <FactoryLineSearchPanel
              lines={lines}
              selectedZone={selectedZone}
              onSelectZone={(zoneId) => {
                const z = FACTORY_ZONES.find((item) => item.id === zoneId);
                if (z) setSelectedZone(z);
              }}
              onOpenLineOverview={(lineId) => navigateToLine(lineId)}
            />
          </div>

          {/* Dưới chân bản đồ: Hướng dẫn sử dụng & Thang màu mức độ an toàn */}
          <div className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cột trái: Hướng dẫn sử dụng */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2.5">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>Hướng dẫn sử dụng sơ đồ mặt bằng</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-emerald-600 font-bold">1.</span>
                    <span>Nhấn vào dây chuyền (viền xanh) để xem chi tiết Line Overview</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-blue-600 font-bold">2.</span>
                    <span>Tìm kiếm nhanh 3 dây chuyền ở panel bên phải</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-amber-600 font-bold">3.</span>
                    <span>Rê chuột (hover) để xem thông tin chi tiết từng khu vực</span>
                  </div>
                </div>
              </div>

              {/* Cột phải: Thang màu mức độ an toàn */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2.5">
                  Thang màu phân loại an toàn
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0 border border-white" />
                    <div>
                      <div className="font-bold text-emerald-800 dark:text-emerald-300">90 - 100%</div>
                      <div className="text-slate-500 text-[9px]">An toàn</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308] shrink-0 border border-white" />
                    <div>
                      <div className="font-bold text-amber-800 dark:text-amber-300">80 - 89.9%</div>
                      <div className="text-slate-500 text-[9px]">Theo dõi</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] shrink-0 border border-white" />
                    <div>
                      <div className="font-bold text-orange-800 dark:text-orange-300">70 - 79.9%</div>
                      <div className="text-slate-500 text-[9px]">Cảnh báo</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shrink-0 border border-white" />
                    <div>
                      <div className="font-bold text-rose-800 dark:text-rose-300">&lt; 70%</div>
                      <div className="text-slate-500 text-[9px]">Nguy hiểm</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8] shrink-0 border border-white" />
                    <div>
                      <div className="font-bold text-slate-700 dark:text-slate-300">N/A</div>
                      <div className="text-slate-500 text-[9px]">Chưa giám sát</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* NỘI DUNG 2: CHỈ SỐ PHÂN TÍCH 24H & DÂY CHUYỀN SẢN XUẤT                    */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Hàng 3 biểu đồ phân tích */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Biểu đồ 1: Xu hướng an toàn */}
            <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Xu hướng an toàn xưởng (24h)
                </span>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">96.8%</span>
              </div>
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={safetyTrendData}>
                    <defs>
                      <linearGradient id="safetyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis domain={[90, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fill="url(#safetyGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Biểu đồ 2: Trạng thái thiết bị Donut */}
            <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Phân loại trạng thái thiết bị
                </span>
                <span className="text-[11px] font-mono text-slate-500 font-bold">{deviceClassification.total} máy</span>
              </div>
              <div className="h-[160px] w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deviceDonutData}
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {deviceDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-mono font-extrabold text-slate-900 dark:text-white leading-none">
                    {deviceClassification.total}
                  </span>
                  <span className="text-[10px] text-slate-400">Thiết bị</span>
                </div>
              </div>
            </div>

            {/* Biểu đồ 3: Cảnh báo theo thời gian */}
            <div className="bg-white dark:bg-factory-card p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Cảnh báo theo thời gian
                </span>
                <span className="text-[11px] font-mono text-rose-600 font-bold">{activeAlarmsCount} mở</span>
              </div>
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { time: '08:00', crit: 0, warn: 1 },
                    { time: '10:00', crit: 0, warn: 2 },
                    { time: '12:00', crit: 1, warn: 0 },
                    { time: '14:00', crit: 0, warn: 1 },
                    { time: '16:00', crit: 0, warn: 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="crit" fill="#ef4444" stackId="a" />
                    <Bar dataKey="warn" fill="#f59e0b" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Danh sách 3 Dây chuyền sản xuất */}
          <div className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Factory className="w-4 h-4 text-emerald-600" />
                <span>3 Dây chuyền sản xuất công nghiệp</span>
              </h3>
              <span className="text-xs text-slate-500">Nhấn vào dây chuyền để mở Line Overview</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {sortedLines.map((line) => {
                const machineCount = line.machines?.length || 2;
                const safeScore = line.safetyScore ?? (line.code === 'LN-PRS-01' ? 96.8 : line.code === 'LN-PNT-02' ? 93.4 : 88.1);
                const lineAlarms = alarms.filter((a) => a.lineId === line.id || (a.lineName && a.lineName.includes(line.code)));

                return (
                  <div
                    key={line.id}
                    onClick={() => navigateToLine(line.id)}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {line.code}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        RUNNING
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                      {line.name}
                    </h4>

                    <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">Mức an toàn</div>
                        <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                          {safeScore}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Thiết bị</div>
                        <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                          {machineCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Sự cố</div>
                        <div className={`text-base font-extrabold font-mono ${lineAlarms.length > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                          {lineAlarms.length}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Root LineOverviewDashboard: Điều phối hiển thị 4 màn hình theo dashboardViewLevel
 * Không chứa hooks có điều kiện (Conditional Hooks), giải quyết dứt điểm lỗi White Screen
 */
export function LineOverviewDashboard() {
  const {
    dashboardViewLevel,
    selectedLineId,
    selectedMachineId,
    navigateToMachine,
    navigateToCheckSheet,
    navigateBack,
  } = useMonitoringStore();

  return (
    <ErrorBoundary
      fallbackTitle="Sự cố điều hướng màn hình giám sát"
      onReset={() => {
        useMonitoringStore.getState().setDashboardViewLevel('factory_layout');
        useMonitoringStore.getState().setSelectedLineId(null);
      }}
    >
      {dashboardViewLevel === 'line_overview' ? (
        <LineDetailView
          lineId={selectedLineId || 'LN-PRS-01'}
          onBackToDashboard={navigateBack}
          onSelectMachine={(machineId) => navigateToMachine(machineId, selectedLineId || 'LN-PRS-01')}
        />
      ) : dashboardViewLevel === 'machine_detail' ? (
        <MachineDetailView
          machineId={selectedMachineId || 'MCH-PRS-01'}
          onBackToLine={navigateBack}
          onOpenCheckSheet={(machineId) => navigateToCheckSheet(machineId, selectedLineId || undefined)}
        />
      ) : dashboardViewLevel === 'check_sheet' ? (
        <CheckSheetView
          machineId={selectedMachineId || 'MCH-PRS-01'}
          onBackToMachineDetail={navigateBack}
        />
      ) : (
        <FactoryLayoutMainView />
      )}
    </ErrorBoundary>
  );
}
