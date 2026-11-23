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
  Factory,
  Map,
  BarChart3,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
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
import { ProductionKpiRow } from '../dashboard/production/ProductionKpiRow';
import { ProductionDecisionPanel } from '../dashboard/production/ProductionDecisionPanel';
import { useProductionOverview, useCauseText } from '../dashboard/production/useProduction';
import type { ZoneProductionState } from '../dashboard/FactoryLayoutMap';
import { useTranslation } from 'react-i18next';
import { FACTORY_ZONES, FactoryZone } from '../dashboard/factoryMapConfig';

// Import các màn hình con phân tầng
import { LineDetailView } from './LineDetailView';
import { MachineDetailView } from '../tier2-machines/MachineDetailView';
import { CheckSheetView } from '../checksheet/CheckSheetView';

/**
 * Component hiển thị giao diện Màn hình 1: Factory Layout Map & Analytics
 * Tách biệt hoàn toàn hooks để tuân thủ React Rules of Hooks
 */
/** Hướng dẫn sử dụng sơ đồ + thang màu theo chế độ đang xem (nằm ngay dưới sơ đồ) */
function FactoryMapGuide({ viewMode }: { viewMode: 'safety' | 'status' }) {
  const { t } = useTranslation();
  const safetyScale = [
    { color: '#16A34A', range: '90 – 100%', label: t('mapGuide.safe'), cls: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
    { color: '#EAB308', range: '80 – 89.9%', label: t('mapGuide.watch'), cls: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
    { color: '#F97316', range: '70 – 79.9%', label: t('mapGuide.caution'), cls: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' },
    { color: '#DC2626', range: '< 70%', label: t('mapGuide.danger'), cls: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' },
    { color: '#94A3B8', range: 'N/A', label: t('mapGuide.unmonitored'), cls: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  ];
  const statusScale = [
    { color: '#16A34A', range: t('dashboard.mapLegend.running'), label: t('mapGuide.runningHint'), cls: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
    { color: '#EAB308', range: t('dashboard.mapLegend.warning'), label: t('mapGuide.warningHint'), cls: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
    { color: '#DC2626', range: t('dashboard.mapLegend.alarm'), label: t('mapGuide.alarmHint'), cls: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' },
    { color: '#94A3B8', range: 'N/A', label: t('mapGuide.unmonitored'), cls: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  ];
  const scale = viewMode === 'safety' ? safetyScale : statusScale;
  const steps = [t('mapGuide.step1'), t('mapGuide.step2'), t('mapGuide.step3')];
  const stepColor = ['text-emerald-600', 'text-blue-600', 'text-amber-600'];

  return (
    <div className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2.5">
            <Info className="w-4 h-4 text-blue-600" />
            <span>{t('mapGuide.title')}</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            {steps.map((txt, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className={`${stepColor[i]} font-bold`}>{i + 1}.</span>
                <span>{txt}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2.5">
            {viewMode === 'safety' ? t('mapGuide.safetyScale') : t('mapGuide.statusScale')}
          </h4>
          <div className={`grid grid-cols-2 gap-2 text-[10px] ${viewMode === 'safety' ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
            {scale.map((c) => (
              <div key={c.range} className={`flex items-center gap-1.5 p-1.5 rounded border ${c.cls}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white" style={{ background: c.color }} />
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{c.range}</div>
                  <div className="text-slate-500 text-[9px] truncate">{c.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FactoryLayoutMainView() {
  const {
    lines,
    navigateToLine,
    fetchLines,
    fetchMachines,
    fetchLatestTelemetry,
  } = useMonitoringStore();

  const { alarms } = useAlarmStore();
  const [mainTabMode, setMainTabMode] = useState<'layout' | 'analytics'>('layout');
  // Mặc định xem "Trạng thái" (OEE + line bất thường); "Mức độ an toàn" giữ nguyên hiển thị cũ
  const [mapViewMode, setMapViewMode] = useState<'safety' | 'status'>('status');

  // Mặc định chọn khu vực CVT (tương ứng LN-PRS-01) như ảnh tham chiếu
  const [selectedZone, setSelectedZone] = useState<FactoryZone | null>(() => {
    return FACTORY_ZONES.find((z) => z.id === 'CVT') || FACTORY_ZONES[0] || null;
  });

  // Dữ liệu sản xuất (mô phỏng): KPI, trạng thái line trên sơ đồ, Top 5, What-If
  const { t } = useTranslation();
  const causeText = useCauseText();
  const production = useProductionOverview();
  const [selectedLineCode, setSelectedLineCode] = useState<string | null>(null);

  // Mặc định chọn line dừng lâu nhất khi có dữ liệu
  useEffect(() => {
    const top = production.data?.topDowntime;
    if (!selectedLineCode && top && top.length > 0) setSelectedLineCode(top[0].lineCode);
  }, [production.data, selectedLineCode]);

  const productionZones = useMemo(() => {
    const map: Record<string, ZoneProductionState> = {};
    for (const l of production.data?.lineStates ?? []) {
      if (!l.zoneId) continue;
      map[l.zoneId] = {
        status: l.productionStatus,
        oee: l.oee,
        note: l.statusCode ? causeText(l.statusCode, l.statusOp, l.statusNote) : null,
        lineId: l.lineId,
        lineCode: l.lineCode,
        virtual: l.virtual,
      };
    }
    return map;
  }, [production.data, causeText]);

  const handleSelectProductionLine = (lineCode: string) => {
    setSelectedLineCode(lineCode);
    const zoneId = production.data?.lineStates.find((l) => l.lineCode === lineCode)?.zoneId;
    const z = zoneId ? FACTORY_ZONES.find((item) => item.id === zoneId) : null;
    if (z) setSelectedZone(z);
  };

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
      {/* KHU VỰC 1: THẺ KPI SẢN XUẤT (OEE nhà máy · line · máy · trạng thái máy · offline) */}
      <ProductionKpiRow data={production.data} loading={production.loading} />
      {production.data?.simulated && (
        <p className="-mt-2 text-[10px] text-slate-500 dark:text-slate-400 text-right">* {t('common.simulatedData')}</p>
      )}

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
            {/* Cột trái / Trung tâm: Bản đồ SVG 87 khu vực + hướng dẫn & thang màu ngay bên dưới */}
            <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
              <FactoryLayoutMap
                productionZones={productionZones}
                onSelectProductionLine={handleSelectProductionLine}
                viewMode={mapViewMode}
                onChangeViewMode={setMapViewMode}
                selectedZoneId={selectedZone?.id || null}
                onSelectZone={(zone) => setSelectedZone(zone)}
                onOpenLineOverview={(lineId) => navigateToLine(lineId)}
              />
              <FactoryMapGuide viewMode={mapViewMode} />
            </div>

            {/* Cột phải: Top 5 line dừng lâu → What-If → Thác tổn thất → Khuyến nghị */}
            <ProductionDecisionPanel
              overview={production.data}
              loading={production.loading}
              error={production.error}
              onRetry={production.reload}
              selectedLineCode={selectedLineCode}
              onSelectLine={handleSelectProductionLine}
              onOpenLine={(lineId) => navigateToLine(lineId)}
            />
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
