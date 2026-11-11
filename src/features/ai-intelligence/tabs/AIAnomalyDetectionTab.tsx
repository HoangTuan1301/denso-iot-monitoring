/**
 * @file AIAnomalyDetectionTab.tsx
 * @description Tab 2 Redesign: Phát hiện Bất thường AI (AI Anomaly Detection)
 * - Biểu đồ xu hướng lớn với bộ lọc thiết bị & thông số trực quan
 * - Thẻ phân tích giải thích nguyên nhân ngắn gọn, súc tích
 * - Đảm bảo tên thông số, đơn vị, giá trị và ngưỡng luôn khớp nhau 100%
 */

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  CheckCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAIStore } from '../stores/useAIStore';
import {
  computeAllEquipmentHealth,
  generateAnomalyEvents,
  generateTrendPoints,
  getMetricDefinition,
} from '../simulation/aiSimulationEngine';
import { AITrendChart } from '../components/AITrendChart';

interface AIAnomalyDetectionTabProps {
  machines: any[];
}

export const AIAnomalyDetectionTab: React.FC<AIAnomalyDetectionTabProps> = ({
  machines,
}) => {
  const {
    activeScenarioId,
    isDemoActive,
    selectedMachineId,
    selectedMetricCode,
    timeRangeHours,
    anomalySeverityFilter,
    anomalySearchQuery,
    acknowledgedAnomalyIds,
    setSelectedMachineId,
    setSelectedMetricCode,
    setTimeRangeHours,
    setAnomalySeverityFilter,
    setAnomalySearchQuery,
    acknowledgeAnomaly,
  } = useAIStore();

  // Tạo danh sách bất thường theo kịch bản hiện hành
  const allAnomalies = useMemo(() => {
    const healthList = computeAllEquipmentHealth(machines, activeScenarioId, isDemoActive);
    return generateAnomalyEvents(healthList, activeScenarioId, isDemoActive);
  }, [activeScenarioId, isDemoActive, machines]);

  // Lọc theo bộ lọc tìm kiếm & mức độ
  const filteredAnomalies = useMemo(() => {
    return allAnomalies.filter((item) => {
      const matchSeverity =
        anomalySeverityFilter === 'ALL' || item.severity === anomalySeverityFilter;
      const matchQuery =
        anomalySearchQuery === '' ||
        item.machineCode.toLowerCase().includes(anomalySearchQuery.toLowerCase()) ||
        item.machineName.toLowerCase().includes(anomalySearchQuery.toLowerCase()) ||
        item.metricName.toLowerCase().includes(anomalySearchQuery.toLowerCase()) ||
        item.ruleExplanation.toLowerCase().includes(anomalySearchQuery.toLowerCase());
      return matchSeverity && matchQuery;
    });
  }, [allAnomalies, anomalySeverityFilter, anomalySearchQuery]);

  // Thiết bị đang chọn
  const currentMachine = useMemo(() => {
    return (
      machines.find((m) => m.id === selectedMachineId || m.code === selectedMachineId) ||
      machines[0] || {
        id: 'MCH-PRS-01',
        name: 'Máy Dập Thủy Lực 500T Komatsu',
        code: 'MCH-PRS-01',
      }
    );
  }, [machines, selectedMachineId]);

  // Metadata thông số chuẩn
  const currentMetricMeta = useMemo(() => {
    return getMetricDefinition(selectedMetricCode);
  }, [selectedMetricCode]);

  // Dữ liệu biểu đồ xu hướng
  const trendData = useMemo(() => {
    const rangeParam = timeRangeHours <= 6 ? '15m' : timeRangeHours <= 12 ? '1h' : '24h';
    return generateTrendPoints(
      selectedMachineId,
      selectedMetricCode,
      activeScenarioId,
      isDemoActive,
      rangeParam
    );
  }, [selectedMachineId, selectedMetricCode, activeScenarioId, isDemoActive, timeRangeHours]);

  const getRuleBadge = (rule: string) => {
    switch (rule) {
      case 'THRESHOLD_BREACH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
            Vượt ngưỡng đỉnh
          </span>
        );
      case 'SUDDEN_SPIKE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
            Xung đột biến
          </span>
        );
      case 'PERSISTENT_DRIFT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
            Trôi dạt dữ liệu
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar with Machine & Metric Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Phân tích & Phát hiện Dị biệt Cảm biến (AI Anomaly Detection)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Áp dụng thuật toán thống kê Z-score kết hợp ngưỡng kỹ thuật kép (Warning / Critical)
            </p>
          </div>

          {/* Quick Selectors: Machine & Metric */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Machine select */}
            <select
              aria-label="Chọn thiết bị quan sát"
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code || m.id} - {m.name}
                </option>
              ))}
            </select>

            {/* Metric select */}
            <select
              aria-label="Chọn thông số quan sát"
              value={selectedMetricCode}
              onChange={(e) => setSelectedMetricCode(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="TEMP_HYD">Nhiệt độ dầu (°C)</option>
              <option value="VIB_RMS">Độ rung RMS (mm/s)</option>
              <option value="PRESSURE_HYD">Áp suất bơm (bar)</option>
              <option value="TEMP_CHAMBER">Nhiệt buồng sấy (°C)</option>
              <option value="FLOW_RATE">Lưu lượng sơn (L/min)</option>
              <option value="TORQUE">Mô-men siết (Nm)</option>
              <option value="NOISE_LEVEL">Độ ồn buồng test (dB)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Large Trend Chart (Biểu đồ xu hướng lớn) */}
      <AITrendChart
        data={trendData}
        metricCode={selectedMetricCode}
        metricName={currentMetricMeta.name}
        unit={currentMetricMeta.unit}
        machineName={currentMachine.name || currentMachine.code || selectedMachineId}
        timeRangeHours={timeRangeHours}
        onTimeRangeChange={setTimeRangeHours}
      />

      {/* 3. Short Anomaly Cause Cards & Event Table (Thẻ ngắn & Bảng sự kiện) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 overflow-hidden shadow-xs">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Nhật ký Sự kiện Bất thường ({filteredAnomalies.length} sự kiện)
            </h4>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm sự kiện..."
                value={anomalySearchQuery}
                onChange={(e) => setAnomalySearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>

            {/* Severity Filter */}
            <select
              aria-label="Lọc theo mức độ"
              value={anomalySeverityFilter}
              onChange={(e) => setAnomalySeverityFilter(e.target.value as any)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="CRITICAL">Nguy hiểm</option>
              <option value="WARNING">Cảnh báo</option>
            </select>
          </div>
        </div>

        {/* Short Anomaly Event Cards Grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAnomalies.map((item) => {
            const isAck = acknowledgedAnomalyIds.has(item.id);
            const isCritical = item.severity === 'CRITICAL';

            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedMachineId(item.machineId);
                  setSelectedMetricCode(item.metricCode);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  item.machineId === selectedMachineId
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                } ${isAck ? 'opacity-70' : ''}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {item.machineCode}
                    </span>
                    {getRuleBadge(item.detectionRule)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-slate-400">
                      {item.timestamp}
                    </span>
                    {isCritical ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400">
                        Nguy hiểm
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400">
                        Cảnh báo
                      </span>
                    )}
                  </div>
                </div>

                {/* Values & Metric */}
                <div className="my-2 flex items-baseline justify-between text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">{item.metricName}:</span>{' '}
                    <strong className="text-rose-600 dark:text-rose-400 font-bold text-sm">
                      {item.value} {item.unit}
                    </strong>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Ngưỡng max: {item.criticalThreshold} {item.unit} (+{item.deviationPercent}%)
                  </div>
                </div>

                {/* Short Technical Explanation Card */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-700 dark:text-slate-300 leading-snug">
                  {item.ruleExplanation}
                </div>

                {/* Action button */}
                <div className="mt-2.5 pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/40 text-xs">
                  <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {item.lineName}
                  </span>
                  {isAck ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCheck className="w-3.5 h-3.5" /> Đã tiếp nhận
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        acknowledgeAnomaly(item.id);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      Tiếp nhận
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredAnomalies.length === 0 && (
            <div className="col-span-2 py-10 text-center text-xs text-slate-400">
              Không có sự kiện bất thường nào trong phạm vi kịch bản hiện tại.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
