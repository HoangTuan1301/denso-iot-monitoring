/**
 * @file AIOverviewTab.tsx
 * @description Tab 1 Redesign: Modern Industrial AI Command Center Overview
 * - Hàng 1: 4 Thẻ KPI tinh chuẩn (Tổng máy, Sức khỏe trung bình, Cảnh báo, Nguy hiểm)
 * - Hàng 2: 3 Khối phân tích (Chi tiết sức khỏe máy chọn, Phân bổ rủi ro, Biểu đồ xu hướng Recharts)
 * - Hàng 3: Top 5 thiết bị cần chú ý nhất kèm nút mở rộng toàn bộ
 */

import React, { useMemo, useState } from 'react';
import {
  Cpu,
  Activity,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Shield,
  SlidersHorizontal,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useAIStore } from '../stores/useAIStore';
import {
  computeAllEquipmentHealth,
  generateTrendPoints,
  getMetricDefinition,
} from '../simulation/aiSimulationEngine';
import { AIHealthScoreCard } from '../components/AIHealthScoreCard';
import { AITrendChart } from '../components/AITrendChart';
import { AIRiskLevel } from '../types/ai';

interface AIOverviewTabProps {
  machines: any[];
}

export const AIOverviewTab: React.FC<AIOverviewTabProps> = ({ machines }) => {
  const {
    activeScenarioId,
    isDemoActive,
    selectedMachineId,
    selectedMetricCode,
    timeRangeHours,
    setSelectedMachineId,
    setSelectedMetricCode,
    setTimeRangeHours,
  } = useAIStore();

  const [showAllMachines, setShowAllMachines] = useState(false);

  // Tính toán sức khỏe cho tất cả thiết bị
  const allEquipmentHealth = useMemo(() => {
    return computeAllEquipmentHealth(machines, activeScenarioId, isDemoActive);
  }, [machines, activeScenarioId, isDemoActive]);

  // Thiết bị đang được chọn
  const selectedEquipment = useMemo(() => {
    return (
      allEquipmentHealth.find((e) => e.machineId === selectedMachineId) ||
      allEquipmentHealth[0] || {
        machineId: 'MCH-PRS-01',
        machineCode: 'MCH-PRS-01',
        machineName: 'Máy Dập Thủy Lực 500T Komatsu',
        lineId: 'LINE-01',
        lineName: 'Dây Chuyền Dập & Đột',
        type: 'Dập Thủy Lực',
        healthScore: 97,
        riskLevel: 'LOW' as AIRiskLevel,
        status: 'NORMAL' as const,
        factors: {
          base: 100,
          tempPenalty: 0,
          vibrationPenalty: 0,
          pressurePenalty: 0,
          currentPenalty: 0,
          agePenalty: 3,
          explanation: 'Dữ liệu hoạt động ổn định.',
        },
        activeAnomaliesCount: 0,
        trendDirection: 'stable' as const,
        lastEvaluated: 'Vừa xong',
        keyMetricCode: 'TEMP_HYD',
        keyMetricName: 'Nhiệt độ dầu thủy lực',
        keyMetricValue: 52.4,
        keyMetricUnit: '°C',
      }
    );
  }, [allEquipmentHealth, selectedMachineId]);

  // Dữ liệu biểu đồ xu hướng
  const trendData = useMemo(() => {
    const rangeParam = timeRangeHours <= 6 ? '15m' : timeRangeHours <= 12 ? '1h' : '24h';
    return generateTrendPoints(
      selectedEquipment.machineId,
      selectedMetricCode,
      activeScenarioId,
      isDemoActive,
      rangeParam
    );
  }, [selectedEquipment.machineId, selectedMetricCode, activeScenarioId, isDemoActive, timeRangeHours]);

  // Thông tin metric chuẩn hiện hành
  const currentMetricMeta = useMemo(() => {
    return getMetricDefinition(selectedMetricCode);
  }, [selectedMetricCode]);

  // Hàng 1: KPIs tổng hợp
  const kpis = useMemo(() => {
    const total = allEquipmentHealth.length;
    const warningCount = allEquipmentHealth.filter((e) => e.riskLevel === 'HIGH').length;
    const criticalCount = allEquipmentHealth.filter((e) => e.riskLevel === 'CRITICAL').length;
    const normalCount = allEquipmentHealth.filter((e) => e.riskLevel === 'LOW' || e.riskLevel === 'MEDIUM').length;

    const avgScore = total > 0
      ? Math.round(allEquipmentHealth.reduce((acc, cur) => acc + cur.healthScore, 0) / total)
      : 100;

    return { total, warningCount, criticalCount, normalCount, avgScore };
  }, [allEquipmentHealth]);

  // Hàng 2: Phân bổ rủi ro (Risk Distribution)
  const riskDistribution = useMemo(() => {
    const total = allEquipmentHealth.length || 1;
    const critical = allEquipmentHealth.filter((e) => e.riskLevel === 'CRITICAL').length;
    const high = allEquipmentHealth.filter((e) => e.riskLevel === 'HIGH').length;
    const medium = allEquipmentHealth.filter((e) => e.riskLevel === 'MEDIUM').length;
    const low = allEquipmentHealth.filter((e) => e.riskLevel === 'LOW').length;

    return {
      critical: { count: critical, pct: Math.round((critical / total) * 100) },
      high: { count: high, pct: Math.round((high / total) * 100) },
      medium: { count: medium, pct: Math.round((medium / total) * 100) },
      low: { count: low, pct: Math.round((low / total) * 100) },
    };
  }, [allEquipmentHealth]);

  // Hàng 3: Danh sách thiết bị sắp xếp theo điểm sức khỏe tăng dần (rủi ro cao nhất đứng đầu)
  const sortedByRisk = useMemo(() => {
    return [...allEquipmentHealth].sort((a, b) => a.healthScore - b.healthScore);
  }, [allEquipmentHealth]);

  // Top 5 hoặc toàn bộ
  const displayedMachines = showAllMachines ? sortedByRisk : sortedByRisk.slice(0, 5);

  const getRiskBadge = (risk: AIRiskLevel) => {
    switch (risk) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400">
            <AlertOctagon className="w-3 h-3" /> Nguy hiểm
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" /> Cảnh báo
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400">
            Trung bình
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> An toàn
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500';
    if (score >= 65) return 'text-amber-600 dark:text-amber-400 bg-amber-500';
    return 'text-rose-600 dark:text-rose-400 bg-rose-500';
  };

  // Danh mục thông số đo lường sẵn có theo thiết bị
  const availableMetrics = useMemo(() => {
    const code = (selectedEquipment.machineCode || '').toUpperCase();
    if (code.includes('WLD') || code.includes('ROB')) {
      return [
        { code: 'VIB_RMS', name: 'Độ rung RMS', unit: 'mm/s' },
        { code: 'TEMP_MOTOR', name: 'Nhiệt độ động cơ', unit: '°C' },
        { code: 'CURRENT_PHASE', name: 'Dòng điện tải hàn', unit: 'A' },
      ];
    }
    if (code.includes('DRY')) {
      return [
        { code: 'TEMP_CHAMBER', name: 'Nhiệt độ buồng sấy', unit: '°C' },
        { code: 'AIR_FLOW', name: 'Lưu lượng khí đối lưu', unit: 'm³/h' },
      ];
    }
    if (code.includes('PNT')) {
      return [
        { code: 'FLOW_RATE', name: 'Lưu lượng sơn', unit: 'L/min' },
        { code: 'PRESSURE_HYD', name: 'Áp suất vòi phun', unit: 'bar' },
      ];
    }
    if (code.includes('ASM')) {
      return [
        { code: 'TORQUE', name: 'Mô-men siết bu-lông', unit: 'Nm' },
        { code: 'VIB_RMS', name: 'Độ rung đầu siết', unit: 'mm/s' },
      ];
    }
    if (code.includes('TST')) {
      return [
        { code: 'NOISE_LEVEL', name: 'Độ ồn buồng test', unit: 'dB' },
        { code: 'PRESSURE_HYD', name: 'Áp suất test rò rỉ', unit: 'bar' },
      ];
    }
    return [
      { code: 'TEMP_HYD', name: 'Nhiệt độ dầu thủy lực', unit: '°C' },
      { code: 'PRESSURE_HYD', name: 'Áp suất bơm chính', unit: 'bar' },
      { code: 'VIB_RMS', name: 'Độ rung hành trình dập', unit: 'mm/s' },
    ];
  }, [selectedEquipment.machineCode]);

  return (
    <div className="space-y-4">
      {/* ============================================================= */}
      {/* HÀNG 1 – 4 THẺ KPI CHÍNH                                      */}
      {/* ============================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Tổng thiết bị */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Tổng thiết bị</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {kpis.total}
            </span>
            <span className="text-xs text-slate-400 font-medium">máy giám sát</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            3 Dây chuyền sản xuất DENSO
          </div>
        </div>

        {/* KPI 2: Sức khỏe trung bình */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Sức khỏe trung bình</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                kpis.avgScore >= 85
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : kpis.avgScore >= 70
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {kpis.avgScore}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ 100 điểm</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                kpis.avgScore >= 85
                  ? 'bg-emerald-500'
                  : kpis.avgScore >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${kpis.avgScore}%` }}
            />
          </div>
        </div>

        {/* KPI 3: Thiết bị cảnh báo */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Thiết bị cảnh báo</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {kpis.warningCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">cần theo dõi</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-700/80 dark:text-amber-400/80">
            Dị biệt thông số mức trung bình
          </div>
        </div>

        {/* KPI 4: Thiết bị nguy hiểm */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Thiết bị nguy hiểm</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {kpis.criticalCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">can thiệp ngay</span>
          </div>
          <div className="mt-2 text-[11px] text-rose-700/80 dark:text-rose-400/80">
            Vượt ngưỡng tới hạn định mức
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* HÀNG 2 – 3 KHỐI PHÂN TÍCH                                     */}
      {/* ============================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Khối 1 (4 cols): Equipment Health Overview (Thẻ giải thích điểm) */}
        <div className="lg:col-span-4">
          <AIHealthScoreCard equipment={selectedEquipment} />
        </div>

        {/* Khối 2 (3 cols): Risk Distribution (Phân bổ mức độ rủi ro) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Phân bổ Mức độ Rủi ro
              </h4>
              <Shield className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 mt-4 text-xs">
              {/* An toàn */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    An toàn (85-100đ)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {riskDistribution.low.count} máy ({riskDistribution.low.pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${riskDistribution.low.pct}%` }}
                  />
                </div>
              </div>

              {/* Trung bình */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Trung bình (75-84đ)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {riskDistribution.medium.count} máy ({riskDistribution.medium.pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${riskDistribution.medium.pct}%` }}
                  />
                </div>
              </div>

              {/* Cảnh báo */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Rủi ro cao (60-74đ)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {riskDistribution.high.count} máy ({riskDistribution.high.pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${riskDistribution.high.pct}%` }}
                  />
                </div>
              </div>

              {/* Nguy hiểm */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Nguy hiểm (&lt; 60đ)
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {riskDistribution.critical.count} máy ({riskDistribution.critical.pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${riskDistribution.critical.pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-400">
            Đánh giá sức khỏe tự động theo thời gian thực
          </div>
        </div>

        {/* Khối 3 (5 cols): Sensor Trend Analytics (Biểu đồ xu hướng thông số) */}
        <div className="lg:col-span-5">
          <AITrendChart
            data={trendData}
            metricCode={selectedMetricCode}
            metricName={currentMetricMeta.name}
            unit={currentMetricMeta.unit}
            machineName={selectedEquipment.machineName}
            timeRangeHours={timeRangeHours}
            onTimeRangeChange={setTimeRangeHours}
            availableMetrics={availableMetrics}
            onSelectMetric={setSelectedMetricCode}
          />
        </div>
      </div>

      {/* ============================================================= */}
      {/* HÀNG 3 – THIẾT BỊ CẦN CHÚ Ý (TOP 5 + XEM TẤT CẢ)               */}
      {/* ============================================================= */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 overflow-hidden shadow-xs">
        {/* Card Toolbar */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {showAllMachines ? 'Toàn bộ Thiết bị Giám sát' : 'Top 5 Thiết bị Cần chú ý (Ưu tiên theo Rủi ro)'}
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sắp xếp theo thứ tự điểm sức khỏe từ thấp đến cao. Nhấp vào hàng để phân tích chi tiết.
            </p>
          </div>

          {/* Toggle View All button */}
          <button
            onClick={() => setShowAllMachines(!showAllMachines)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            <span>{showAllMachines ? 'Thu gọn (Top 5)' : `Xem tất cả (${allEquipmentHealth.length} máy)`}</span>
            {showAllMachines ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Compact Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-700/60 font-semibold">
                <th className="py-2.5 px-4">Thiết bị</th>
                <th className="py-2.5 px-3">Dây chuyền</th>
                <th className="py-2.5 px-4 w-40">Điểm sức khỏe</th>
                <th className="py-2.5 px-3">Mức rủi ro</th>
                <th className="py-2.5 px-3">Thông số chủ chốt</th>
                <th className="py-2.5 px-3 text-right">Xem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {displayedMachines.map((item) => {
                const isSelected = item.machineId === selectedMachineId;
                const scoreColor = getScoreColor(item.healthScore);
                const isProdMachine = item.machineCode.startsWith('MCH-');

                return (
                  <tr
                    key={item.machineId}
                    onClick={() => setSelectedMachineId(item.machineId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20 font-medium'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    {/* Machine Code & Name */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1.5 h-6 rounded-full ${
                            isSelected ? 'bg-emerald-600' : 'bg-transparent'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {item.machineCode}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                isProdMachine
                                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {isProdMachine ? 'Chính tuyến' : 'Phụ trợ'}
                            </span>
                          </div>
                          <div
                            className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]"
                            title={item.machineName}
                          >
                            {item.machineName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Line */}
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {item.lineName}
                    </td>

                    {/* Health Score + Progress */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-extrabold text-sm ${scoreColor.split(' ')[0]}`}>
                          {item.healthScore}
                          <span className="text-[10px] text-slate-400 font-normal">/100</span>
                        </span>
                        {item.trendDirection === 'up' && (
                          <span title="Đang cải thiện">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          </span>
                        )}
                        {item.trendDirection === 'down' && (
                          <span title="Suy giảm">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                          </span>
                        )}
                        {item.trendDirection === 'stable' && (
                          <span title="Ổn định">
                            <Minus className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreColor.split(' ')[1]}`}
                          style={{ width: `${item.healthScore}%` }}
                        />
                      </div>
                    </td>

                    {/* Risk Badge */}
                    <td className="py-2.5 px-3">{getRiskBadge(item.riskLevel)}</td>

                    {/* Key Metric Value & Unit */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.keyMetricValue} {item.keyMetricUnit}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.keyMetricName}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMachineId(item.machineId);
                        }}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
