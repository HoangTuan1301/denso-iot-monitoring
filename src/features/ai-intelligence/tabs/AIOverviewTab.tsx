/**
 * @file AIOverviewTab.tsx
 * @description Tab 1: AI Command Center V2.1 — Industrial AI Intelligence Dashboard
 * 
 * TINH CHỈNH V2.1:
 * 1. Xóa hoàn toàn thanh Bộ lọc vận hành (Global Filter Bar), đưa KPI Cards lên ngay dưới tabs.
 * 2. Sơ đồ Nhà máy (Factory Equipment Map) mở rộng full-width cả hàng, hiển thị rõ 3 dây chuyền và đầy đủ 14 máy.
 * 3. Đồng bộ trạng thái: Chỉ máy có sự cố chuyển CRITICAL đỏ, các máy khác giữ nguyên trạng thái thực.
 * 4. Heatmap: Không cắt cụt mã máy (ASM-01, CYL-01...), hỗ trợ cuộn ngang responsive, đồng bộ với Schematic.
 * 5. Thiết bị cần chú ý: Hiển thị đúng máy có nguy cơ cao nhất hoặc thiết bị hoạt động ổn định khi bình thường.
 * 6. AI Insights & Kế hoạch Hành động: Nút "Tạo phiếu bảo trì" nhỏ gọn (h-8.5, 34px), cùng hàng với "Xem phân tích →".
 * 7. Nội dung Insights nhất quán: Khi bình thường không hiển thị khuyến nghị kiểm tra sự cố cũ của robot.
 */

import React, { useMemo } from 'react';
import {
  Layers,
  Database,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Activity,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  Info,
  Zap,
  Leaf,
  Clock,
  Sparkles,
  PieChart as PieChartIcon,
  PlusCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AIProcessedMachine, AIOverallKPIs } from '../adapters/aiTelemetryAdapter';
import { useAIStore } from '../stores/useAIStore';
import { useMonitoringStore } from '../../../stores/useMonitoringStore';
import { ProductionLine } from '../../../types/hierarchy';
import { SemiCircleHealthGauge } from '../components/SemiCircleHealthGauge';
import { EquipmentRiskHeatmap } from '../components/EquipmentRiskHeatmap';
import { OEECircularAnalytics } from '../components/OEECircularAnalytics';

interface AIOverviewTabProps {
  allMachines: AIProcessedMachine[];
  kpis: AIOverallKPIs;
  lines?: ProductionLine[];
  onSelectMachine?: (machineId: string) => void;
  onNavigateToTab?: (tab: 'overview' | 'anomaly' | 'predictive' | 'assistant') => void;
}

/**
 * Vòng tròn phần trăm tiến độ mini chuẩn SVG (sắc nét, không méo, không phụ thuộc thư viện ngoài)
 */
const MiniProgressRing: React.FC<{
  percent: number;
  strokeColor: string;
  bgTrackColor?: string;
  textColor?: string;
  textClass?: string;
}> = ({
  percent,
  strokeColor,
  bgTrackColor = '#e2e8f0',
  textColor,
  textClass,
}) => {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = 14;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const finalClass = textClass || textColor || 'text-slate-800 dark:text-slate-200';

  return (
    <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
      <svg className="w-9 h-9 sm:w-10 sm:h-10 transform -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={bgTrackColor}
          strokeWidth={strokeWidth}
          className="opacity-40 dark:opacity-20"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span className={`absolute text-[10px] sm:text-[11px] font-black ${finalClass}`}>
        {Math.round(clamped)}%
      </span>
    </div>
  );
};

export const AIOverviewTab: React.FC<AIOverviewTabProps> = ({
  allMachines,
  kpis,
  lines: propLines,
  onSelectMachine,
  onNavigateToTab,
}) => {
  const { setActiveTab, setSelectedMachineId } = useAIStore();
  const { lines: storeLines } = useMonitoringStore();
  const lines = propLines || storeLines;

  // Danh sách máy cần chú ý (sắp xếp ưu tiên: CRITICAL -> WARNING -> AN TOÀN)
  const attentionMachines = useMemo(() => {
    const list = [...allMachines];
    return list.sort((a, b) => {
      const getPriority = (m: AIProcessedMachine) => {
        if (m.hasActiveSpike || m.riskLevel === 'CRITICAL') return 3;
        if (m.riskLevel === 'HIGH') return 2;
        if (!m.isNoData) return 1;
        return 0;
      };
      return getPriority(b) - getPriority(a);
    });
  }, [allMachines]);

  // Máy đang có sự cố khẩn cấp (nếu có)
  const criticalMachine = allMachines.find((m) => m.hasActiveSpike || m.riskLevel === 'CRITICAL');

  // Dữ liệu biểu đồ Xu hướng Sức khỏe & Cảnh báo (Dual-axis / Multi-line AreaChart)
  const healthTrendData = useMemo(() => {
    const baseScore = kpis.avgHealthScore ?? 98;
    const hours = ['12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '04:00', '06:00', '08:00', '10:00'];
    const data = [];

    for (let i = 0; i < hours.length; i++) {
      const isLatest = i === hours.length - 1;
      const hour = hours[i];

      // Khi có sự cố giả lập, điểm ở thời điểm gần nhất sụt xuống ~52-58
      let score = baseScore;
      let warnings = 0;
      let anomalies = 0;

      if (kpis.hasActiveEmergency) {
        if (isLatest) {
          score = criticalMachine?.healthScore || 58;
          anomalies = 1;
          warnings = 1;
        } else {
          score = baseScore - Math.sin(i * 0.8) * 1.5;
        }
      } else {
        const offset = Math.sin(i * 1.1) * 1.2;
        score = Number((baseScore - 1.0 + offset).toFixed(1));
      }

      data.push({
        time: hour,
        healthScore: Math.min(100, Math.max(50, Math.round(score))),
        warnings,
        anomalies,
      });
    }

    return data;
  }, [kpis.avgHealthScore, kpis.hasActiveEmergency, criticalMachine]);

  // Dữ liệu biểu đồ Donut Phân bố Mức độ Rủi ro
  const riskDonutData = useMemo(() => {
    return [
      { name: 'An toàn', value: kpis.normalCount, color: '#10b981' },
      { name: 'Cảnh báo', value: kpis.warningCount, color: '#f59e0b' },
      { name: 'Nguy hiểm', value: kpis.criticalCount, color: '#ef4444' },
      { name: 'Chưa đánh giá', value: kpis.machinesNoData, color: '#94a3b8' },
    ];
  }, [kpis]);

  // Điều hướng xem thiết bị chi tiết
  const handleInspectMachine = (machineId: string) => {
    setSelectedMachineId(machineId);
    if (onSelectMachine) onSelectMachine(machineId);
    if (onNavigateToTab) onNavigateToTab('anomaly');
    else setActiveTab('anomaly');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* TẦNG 1: 7 THẺ TỔNG QUAN KPI (CHUẨN THIẾT KẾ INDUSTRIAL SAAS DASHBOARD)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* KPI 1: Tổng thiết bị */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between relative overflow-hidden min-h-[112px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              Tổng thiết bị
            </span>
          </div>
          <div className="mt-2 relative z-10">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {kpis.totalMachines}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">máy</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              Thiết bị giám sát
            </p>
          </div>
          {/* Họa tiết robot công nghiệp mờ góc phải dưới */}
          <svg
            className="absolute right-1 bottom-1 w-12 h-12 text-slate-300/35 dark:text-slate-700/20 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 20h16M7 20v-3l4-4M11 13l4-7 4 3-3 6M19 6l2-2M15 9l2-2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7" cy="17" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
          </svg>
        </div>

        {/* KPI 2: Có dữ liệu */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between min-h-[112px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Database className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              Có dữ liệu
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1.5">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {kpis.machinesWithData}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">máy</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {kpis.dataRatioPercent}% tổng thiết bị
              </p>
            </div>
            <MiniProgressRing
              percent={kpis.dataRatioPercent}
              strokeColor="#0d9488"
              textClass="text-teal-700 dark:text-teal-300"
            />
          </div>
        </div>

        {/* KPI 3: Chưa có dữ liệu */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between min-h-[112px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              Chưa có dữ liệu
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1.5">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-700 dark:text-slate-300 tracking-tight">
                  {kpis.machinesNoData}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">máy</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {Math.max(0, 100 - kpis.dataRatioPercent)}% tổng thiết bị
              </p>
            </div>
            <MiniProgressRing
              percent={Math.max(0, 100 - kpis.dataRatioPercent)}
              strokeColor="#64748b"
              textClass="text-slate-600 dark:text-slate-300"
            />
          </div>
        </div>

        {/* KPI 4: An toàn */}
        <div className="bg-[#f0fdf4] dark:bg-emerald-950/20 rounded-2xl p-3.5 border border-emerald-200/70 dark:border-emerald-800/60 shadow-xs flex flex-col justify-between min-h-[112px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 truncate">
              An toàn
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {kpis.normalCount}
              </span>
              <span className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-400">máy</span>
            </div>
            <p className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 truncate">
              {kpis.machinesWithData > 0 ? Math.round((kpis.normalCount / kpis.machinesWithData) * 100) : 0}% (trên máy có dữ liệu)
            </p>
          </div>
        </div>

        {/* KPI 5: Cảnh báo */}
        <div className="bg-[#fffbeb] dark:bg-amber-950/20 rounded-2xl p-3.5 border border-amber-200/70 dark:border-amber-800/60 shadow-xs flex flex-col justify-between min-h-[112px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-amber-800 dark:text-amber-200 truncate">
              Cảnh báo
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {kpis.warningCount}
              </span>
              <span className="text-xs font-semibold text-amber-700/80 dark:text-amber-400">máy</span>
            </div>
            <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-400/80 mt-0.5 truncate">
              {kpis.machinesWithData > 0 ? Math.round((kpis.warningCount / kpis.machinesWithData) * 100) : 0}% (trên máy có dữ liệu)
            </p>
          </div>
        </div>

        {/* KPI 6: Nguy hiểm */}
        <div
          className={`rounded-2xl p-3.5 border shadow-xs flex flex-col justify-between min-h-[112px] transition-all duration-200 ${
            kpis.criticalCount > 0
              ? 'bg-[#fff1f2] dark:bg-rose-950/30 border-rose-400 dark:border-rose-700 shadow-md shadow-rose-950/10'
              : 'bg-[#fff1f2] dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                kpis.criticalCount > 0
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-400'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-rose-800 dark:text-rose-200 truncate">
              Nguy hiểm
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {kpis.criticalCount}
              </span>
              <span className="text-xs font-semibold text-rose-700/80 dark:text-rose-400">máy</span>
            </div>
            <p className="text-[11px] font-medium text-rose-700/80 dark:text-rose-400/80 mt-0.5 truncate">
              {kpis.machinesWithData > 0 ? Math.round((kpis.criticalCount / kpis.machinesWithData) * 100) : 0}% (trên máy có dữ liệu)
            </p>
          </div>
        </div>

        {/* KPI 7: OEE (ước tính) */}
        <div className="bg-[#f0fdfa] dark:bg-teal-950/20 rounded-2xl p-3.5 border border-teal-200/70 dark:border-teal-800/60 shadow-xs flex flex-col justify-between min-h-[112px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-teal-800 dark:text-teal-200 truncate">
              OEE (ước tính)
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-teal-700 dark:text-teal-300 tracking-tight">
                {kpis.machinesWithData > 0 ? '87.6%' : 'N/A'}
              </span>
            </div>
            <p className="text-[11px] font-medium text-teal-700/80 dark:text-teal-400/80 mt-0.5 truncate">
              Hiệu suất thiết bị tổng thể
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TẦNG 2: HEALTH ANALYTICS & RISK DISTRIBUTION (3 CARDS)                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card 1: Đồng hồ bán nguyệt Điểm Sức khỏe Nhà máy (Col-span 3) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-2 mb-1 border-b border-slate-100 dark:border-slate-700/60">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Điểm Sức khỏe Nhà máy
            </h4>
          </div>

          <div className="py-2">
            <SemiCircleHealthGauge
              score={kpis.avgHealthScore ?? 98}
              subtitle={`Trung bình (${kpis.machinesWithData} máy có dữ liệu)`}
              trendText={
                kpis.hasActiveEmergency
                  ? '▼ -40.0 điểm (Diễn tập sự cố Header)'
                  : '▲ +1.2 điểm so với 24h trước'
              }
              isSpike={kpis.hasActiveEmergency}
            />
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center border-t border-slate-100 dark:border-slate-800">
            Tổng hợp dữ liệu cảm biến đa chiều (Nhiệt, Rung, Áp, Dòng)
          </div>
        </div>

        {/* Card 2: Biểu đồ Xu hướng Sức khỏe & Cảnh báo (Col-span 5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Xu hướng Sức khỏe &amp; Cảnh báo
              </h4>
            </div>

            {/* Chú giải biểu đồ */}
            <div className="flex items-center gap-2.5 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-1.5 rounded-sm bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400">Health Score (TB)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-1.5 rounded-sm bg-amber-400" />
                <span className="text-slate-600 dark:text-slate-400">Số cảnh báo</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-1.5 rounded-sm bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-400">Số bất thường</span>
              </div>
            </div>
          </div>

          {/* Area & Line Composed Chart */}
          <div className="h-[185px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={healthTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" domain={[50, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 4]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="healthScore"
                  name="Điểm sức khỏe (TB)"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorHealth)"
                />
                <Line
                  yAxisId="right"
                  type="stepAfter"
                  dataKey="warnings"
                  name="Số cảnh báo"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="stepAfter"
                  dataKey="anomalies"
                  name="Số bất thường"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center border-t border-slate-100 dark:border-slate-800">
            Diễn biến điểm số trung bình và số lượng sự kiện bất thường ghi nhận
          </div>
        </div>

        {/* Card 3: Biểu đồ Donut Phân bố Mức độ Rủi ro (Col-span 4) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Phân bố Mức độ Rủi ro
              </h4>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-1">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={56}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {riskDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {kpis.machinesWithData}
                </span>
                <span className="text-[9px] text-slate-400 leading-tight">Có dữ liệu</span>
              </div>
            </div>

            {/* Bảng chú giải phân bố rủi ro */}
            <div className="space-y-1.5 text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>An toàn</span>
                </span>
                <span className="font-bold text-emerald-600">{kpis.normalCount} máy</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Cảnh báo</span>
                </span>
                <span className="font-bold text-amber-500">{kpis.warningCount} máy</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Nguy hiểm</span>
                </span>
                <span className="font-bold text-rose-600">{kpis.criticalCount} máy</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span>Chưa đánh giá</span>
                </span>
                <span className="font-bold text-slate-400">{kpis.machinesNoData} máy</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center border-t border-slate-100 dark:border-slate-800">
            Tỷ lệ rủi ro phân loại theo ngưỡng kiểm soát thống kê Z-score
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TẦNG 3: VẬN HÀNH TRỌNG ĐIỂM (3 CARDS)                                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Thiết bị nổi bật cần chú ý */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Thiết bị nổi bật cần chú ý
              </h4>
            </div>
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('anomaly')}
              className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>

          {/* List of 3 highlighted devices */}
          <div className="space-y-2 flex-1">
            {attentionMachines.slice(0, 3).map((m) => {
              const isCrit = m.hasActiveSpike || m.riskLevel === 'CRITICAL';
              const isWarn = m.riskLevel === 'HIGH';

              return (
                <div
                  key={m.machineId}
                  onClick={() => handleInspectMachine(m.machineId)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs hover:border-emerald-500 ${
                    isCrit
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                      : isWarn
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{m.machineCode}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          isCrit
                            ? 'bg-rose-500 text-white'
                            : isWarn
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {isCrit ? 'CRITICAL' : isWarn ? 'CẢNH BÁO' : 'AN TOÀN'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                      {m.machineName} ({m.lineName.split(' ')[0]})
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                      <span>{m.keyMetricValue} {m.keyMetricUnit}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-right">
                    <span
                      className={`text-sm font-black ${
                        isCrit ? 'text-rose-600' : isWarn ? 'text-amber-500' : 'text-emerald-600'
                      }`}
                    >
                      {m.healthScore != null ? `${m.healthScore}/100` : 'N/A'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center">
            Nhấn vào thiết bị để phân tích chi tiết Z-score
          </div>
        </div>

        {/* Card 2: Dự đoán Bảo trì (RUL) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Dự đoán Bảo trì (RUL)
              </h4>
            </div>
            <span title="RUL: Thời gian ước tính còn lại trước khi cần bảo trì" className="inline-flex cursor-help">
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </span>
          </div>

          {/* RUL Table */}
          <div className="space-y-2 flex-1">
            <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800">
              <span>Thiết bị</span>
              <span className="text-center">RUL ước tính</span>
              <span className="text-right">Mức rủi ro</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-3 items-center">
                <span className="font-bold text-slate-800 dark:text-slate-200">ROB-01</span>
                <span className="text-center font-bold text-rose-600 dark:text-rose-400">~ 7 ngày</span>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    Cao
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 items-center">
                <span className="font-bold text-slate-800 dark:text-slate-200">PRS-01</span>
                <span className="text-center font-semibold text-slate-700 dark:text-slate-300">~ 42 ngày</span>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    Trung bình
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 items-center">
                <span className="font-bold text-slate-800 dark:text-slate-200">WLD-01</span>
                <span className="text-center font-semibold text-slate-700 dark:text-slate-300">~ 68 ngày</span>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Thấp
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            RUL: Thời gian ước tính còn lại trước khi cần bảo trì
          </div>
        </div>

        {/* Card 3: Hiệu suất & Năng lượng */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Hiệu suất &amp; Năng lượng
              </h4>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="space-y-2 flex-1">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Tiêu thụ điện (24h)</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">12,840 kWh</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">▼ -3.6%</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Suất tiêu thụ</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">0.92 kWh/chi tiết</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">▼ -4.1%</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-blue-500" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Ước tính CO₂</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">9.6 tấn</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">▼ -3.6%</span>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            Dữ liệu quan trắc trạm biến áp trung thế DENSO
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TẦNG 5: OPERATIONAL ANALYTICS & AI INSIGHTS (4 CARDS)                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chỉ số Vận hành (OEE) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <OEECircularAnalytics
            overallOEE={87.6}
            availability={92.8}
            performance={94.5}
            quality={99.2}
          />
        </div>

        {/* Card 2: Bản đồ Rủi ro Thiết bị (Heatmap) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <EquipmentRiskHeatmap
            lines={lines}
            allMachines={allMachines}
            onSelectMachine={(mId) => handleInspectMachine(mId)}
          />
        </div>

        {/* Card 3: Dòng thời gian Cảnh báo & Sự kiện */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Dòng thời gian Cảnh báo &amp; Sự kiện
              </h4>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Live</span>
          </div>

          {/* Event Items */}
          <div className="space-y-2 flex-1 text-xs">
            {kpis.hasActiveEmergency && criticalMachine ? (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0 animate-bounce" />
                <div>
                  <span className="font-bold text-rose-700 dark:text-rose-300 block text-[11px]">
                    {criticalMachine.machineCode}: {criticalMachine.keyMetricName} vượt ngưỡng ({criticalMachine.keyMetricValue} {criticalMachine.keyMetricUnit})
                  </span>
                  <span className="text-[10px] text-rose-500 dark:text-rose-400">Vừa xong • Diễn tập giả lập sự cố</span>
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
              <span className="text-[10px] font-bold text-slate-400 w-9 shrink-0">10:28</span>
              <div>
                <p className="font-medium text-[11px]">ROB-01: Hoàn tất đo rung định kỳ (2.1 mm/s)</p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
              <span className="text-[10px] font-bold text-slate-400 w-9 shrink-0">09:15</span>
              <div>
                <p className="font-medium text-[11px]">Hệ thống AI: Bắt đầu chu kỳ giám sát thời gian thực</p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
              <span className="text-[10px] font-bold text-slate-400 w-9 shrink-0">08:02</span>
              <div>
                <p className="font-medium text-[11px]">DC1: Trạng thái 6 thiết bị hoạt động ổn định</p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
              <span className="text-[10px] font-bold text-slate-400 w-9 shrink-0">07:10</span>
              <div>
                <p className="font-medium text-[11px]">Đồng bộ dữ liệu PLC thành công (10/14)</p>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-right border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('anomaly')}
              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-end gap-1 ml-auto font-semibold cursor-pointer"
            >
              <span>Xem lịch sử chi tiết</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4: AI Insights & Kế hoạch Hành động (TỐI ƯU UX V2.1) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                AI Insights &amp; Kế hoạch Hành động
              </h4>
            </div>
          </div>

          {/* AI Content callout */}
          <div className="space-y-2.5 flex-1 text-xs">
            {kpis.hasActiveEmergency || criticalMachine ? (
              <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Phát hiện rủi ro tại {criticalMachine?.machineCode || 'Thiết bị'}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  Thông số {criticalMachine?.keyMetricName} tăng vọt ({criticalMachine?.keyMetricValue} {criticalMachine?.keyMetricUnit}), Z-score: +4.2σ vượt ngưỡng tới hạn. Nguy cơ sự cố cơ khí.
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hệ thống vận hành tối ưu</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  Toàn bộ thiết bị đang vận hành trong dải định mức an toàn, độ lệch chuẩn Z-score thấp. Không phát hiện dấu hiệu dị biệt nguy hiểm.
                </p>
              </div>
            )}

            {/* Khuyến nghị hành động (Checklist động theo ngữ cảnh thực tế) */}
            <div className="space-y-1 text-[11px]">
              <span className="font-bold text-slate-600 dark:text-slate-400">Khuyến nghị:</span>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                {kpis.hasActiveEmergency || criticalMachine ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-600 font-bold">!</span>
                      <span>Kiểm tra cụm cảm biến và khu vực vận hành {criticalMachine?.machineCode}.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-600 font-bold">!</span>
                      <span>Giảm tải vận hành hoặc cô lập thiết bị để tránh hư hỏng dây chuyền.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-600 font-bold">!</span>
                      <span>Tạo phiếu bảo trì ưu tiên cao P1 xử lý ngay trong ca làm việc.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Duy trì chu kỳ kiểm tra định kỳ theo kế hoạch vận hành.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Giám sát trực tuyến các thông số nhiệt độ và rung qua telemetry.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Chuẩn bị kế hoạch bảo trì phòng ngừa (PM) cho các cụm cơ khí.</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons (Bố cục compact 32-36px, chữ trên 1 dòng, không xuống dòng, trên cùng 1 hàng) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('predictive')}
              className="inline-flex items-center gap-1.5 px-3 h-8.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 dark:bg-slate-750 dark:text-slate-200 dark:hover:bg-emerald-600 border border-slate-200 dark:border-slate-700 transition-all text-xs font-semibold whitespace-nowrap cursor-pointer shadow-2xs"
              title="Mở phân hệ tạo phiếu bảo trì dự đoán"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white shrink-0" />
              <span>Tạo phiếu bảo trì</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('assistant')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold whitespace-nowrap flex items-center gap-1 cursor-pointer"
            >
              <span>Xem phân tích</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
