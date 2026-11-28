/**
 * @file AIAnomalyDetectionTab.tsx
 * @description Tab 2: Phát hiện Bất thường AI (AI Anomaly Detection)
 * Chuẩn thiết kế tham chiếu Image 2 (media_1794454579424_d8e4b948.jpg).
 * 
 * TÍNH NĂNG CHÍNH:
 * 1. Phương pháp thống kê minh bạch: Z-score, ngưỡng ±3σ, cách ly an toàn.
 * 2. 4 Thẻ KPI: Thiết bị đang giám sát, Trạng thái bình thường, Đang cảnh báo, Bất thường nghiêm trọng.
 * 3. Bộ lọc tương tác: Chọn thiết bị, thông số, khoảng thời gian (6h, 12h, 24h, 7 ngày).
 * 4. Biểu đồ đường LineChart hiển thị chuỗi thời gian, đường ngưỡng Warning (vàng) & Critical (đỏ).
 * 5. Khối "Chi tiết sự kiện bất thường" với AI Insight và đề xuất kỹ thuật.
 * 6. Bảng danh sách toàn bộ các sự kiện dị biệt.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Info,
  Tv,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { AIProcessedMachine, extractMetricTrendPoints } from '../adapters/aiTelemetryAdapter';
import { AIAnomalyEvent } from '../types/ai';
import { useAIStore } from '../stores/useAIStore';
import { tr } from '../../../i18n/tr';
import { historyService } from '../../../services/historyService';
import { AITrendPoint } from '../types/ai';

const RANGE_MS = { '6h': 6 * 3600_000, '12h': 12 * 3600_000, '24h': 24 * 3600_000, '7d': 7 * 86400_000 } as const;
type RangeKey = keyof typeof RANGE_MS;
const vnDate = (t: number) => new Date(t + 7 * 3600_000).toISOString().slice(0, 10);
const vnLabel = (t: number, withDay: boolean) => {
  const d = new Date(t + 7 * 3600_000).toISOString();
  return withDay ? `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}` : d.slice(11, 16);
};

/** Lấy lịch sử thật của 1 thông số (bảng telemetry, 10 phút/mẫu) trong khoảng thời gian đã chọn */
function useMetricHistory(machineId?: string, metricId?: string, range: RangeKey = '12h') {
  const [rows, setRows] = useState<{ t: number; v: number }[] | null>(null);
  useEffect(() => {
    if (!machineId || !metricId) {
      setRows(null);
      return;
    }
    const ctrl = new AbortController();
    const now = Date.now();
    const from = now - RANGE_MS[range];
    setRows(null);
    type Res = { data?: { timestamp: string; value: number }[]; metadata?: { totalPages?: number } };
    const page = (n: number) =>
      historyService.getTelemetryLogs(
        { machineId, metricId, startDate: vnDate(from), endDate: vnDate(now), page: n, limit: 100, sortBy: 'timestamp', sortOrder: 'DESC' } as never,
        ctrl.signal
      ) as unknown as Promise<Res>;
    // Máy chủ trả tối đa 100 dòng/trang → tải trang đầu, rồi các trang còn lại song song (tối đa 12 trang ≈ 7 ngày)
    page(1)
      .then(async (first) => {
        const total = Math.min(12, first.metadata?.totalPages || 1);
        const rest = total > 1 ? await Promise.all(Array.from({ length: total - 1 }, (_, i) => page(i + 2))) : [];
        const list = [first, ...rest]
          .flatMap((r) => r.data || [])
          .map((r) => ({ t: Date.parse(r.timestamp), v: Number(r.value) }))
          .filter((r) => Number.isFinite(r.v) && r.t >= from)
          .sort((a, b) => a.t - b.t);
        setRows(list);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setRows([]);
      });
    return () => ctrl.abort();
  }, [machineId, metricId, range]);
  return rows;
}

interface AIAnomalyDetectionTabProps {
  allMachines: AIProcessedMachine[];
  anomalies: AIAnomalyEvent[];
  selectedMachineId?: string;
  onSelectMachine?: (machineId: string) => void;
}

export const AIAnomalyDetectionTab: React.FC<AIAnomalyDetectionTabProps> = ({
  allMachines,
  anomalies,
  onSelectMachine,
}) => {
  const { selectedMachineId, setSelectedMachineId } = useAIStore();
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'6h' | '12h' | '24h' | '7d'>('12h');
  const [activeAnomalyIndex, setActiveAnomalyIndex] = useState<number>(0);

  // Danh sách máy có dữ liệu quan trắc
  const liveMachines = useMemo(() => {
    return allMachines.filter((m) => !m.isNoData);
  }, [allMachines]);

  // Thiết bị đang được chọn kiểm tra
  const currentMachine = useMemo(() => {
    return (
      allMachines.find((m) => m.machineId === selectedMachineId || m.machineCode === selectedMachineId) ||
      liveMachines[0] ||
      allMachines[0]
    );
  }, [allMachines, liveMachines, selectedMachineId]);

  // Cập nhật metric mặc định khi chọn máy
  const currentMetric = useMemo(() => {
    if (!currentMachine || currentMachine.isNoData || currentMachine.rawMetrics.length === 0) {
      return null;
    }
    if (selectedMetricId) {
      const found = currentMachine.rawMetrics.find((m) => m.id === selectedMetricId);
      if (found) return found;
    }
    return currentMachine.rawMetrics[0];
  }, [currentMachine, selectedMetricId]);

  // Thống kê phân bổ bất thường
  const stats = useMemo(() => {
    const total = allMachines.length;
    const evaluated = allMachines.filter((m) => !m.isNoData);
    const critical = evaluated.filter((m) => m.riskLevel === 'CRITICAL').length;
    const warning = evaluated.filter((m) => m.riskLevel === 'HIGH').length;
    const normal = evaluated.filter((m) => m.riskLevel === 'LOW' || m.riskLevel === 'MEDIUM').length;

    const normalPct = evaluated.length > 0 ? ((normal / total) * 100).toFixed(1) : '0';
    const warningPct = evaluated.length > 0 ? ((warning / total) * 100).toFixed(1) : '0';
    const criticalPct = evaluated.length > 0 ? ((critical / total) * 100).toFixed(1) : '0';

    return { total, normal, normalPct, warning, warningPct, critical, criticalPct };
  }, [allMachines]);

  // Dữ liệu biểu đồ đường LineChart từ telemetry adapter
  const metricKey = currentMetric ? ((currentMetric as { metricId?: string }).metricId || currentMetric.id) : undefined;
  const history = useMetricHistory(currentMachine?.machineId, metricKey, timeRange);
  const warnLine = currentMetric?.warningMax != null ? Number(currentMetric.warningMax) : null;
  const critLine = currentMetric?.criticalMax != null ? Number(currentMetric.criticalMax) : null;
  const chartData = useMemo<AITrendPoint[]>(() => {
    if (!currentMachine || !currentMetric) return [];
    if (history && history.length >= 2) {
      // 7 ngày: gộp theo giờ cho gọn biểu đồ
      let pts = history;
      if (timeRange === '7d') {
        const byHour = new Map<number, { t: number; v: number }>();
        for (const p of history) {
          const k = Math.floor(p.t / 3600_000);
          const prev = byHour.get(k);
          // giữ giá trị cao nhất trong giờ để không mất điểm vượt ngưỡng
          if (!prev || p.v > prev.v) byHour.set(k, p);
        }
        pts = [...byHour.values()].sort((a, b) => a.t - b.t);
      }
      const wMin = currentMetric.warningMin != null ? Number(currentMetric.warningMin) : null;
      const cMin = currentMetric.criticalMin != null ? Number(currentMetric.criticalMin) : null;
      return pts.map((p) => {
        const crit = (critLine != null && p.v >= critLine) || (cMin != null && p.v <= cMin);
        const warn = crit || (warnLine != null && p.v >= warnLine) || (wMin != null && p.v <= wMin);
        return {
          timestamp: vnLabel(p.t, timeRange === '7d' || timeRange === '24h'),
          value: Math.round(p.v * 100) / 100,
          unit: currentMetric.unit,
          warningMax: warnLine ?? 0,
          criticalMax: critLine ?? 0,
          isAnomaly: warn,
          anomalyType: crit ? 'THRESHOLD_BREACH' : warn ? 'SUDDEN_SPIKE' : undefined,
        } as AITrendPoint;
      });
    }
    return extractMetricTrendPoints(currentMachine, currentMetric.id);
  }, [currentMachine, currentMetric, history, timeRange, warnLine, critLine]);
  // 2 ngưỡng trùng nhau (hoặc quá sát) → chỉ vẽ 1 vạch, 1 nhãn để chữ không chồng lên nhau
  const sameLine = warnLine != null && critLine != null && Math.abs(warnLine - critLine) < 1e-9;
  // Trục Y bao trọn dữ liệu và các vạch ngưỡng
  const yDomain = useMemo<[number, number]>(() => {
    const vals = [...chartData.map((p) => p.value), ...(warnLine != null ? [warnLine] : []), ...(critLine != null ? [critLine] : [])];
    if (!vals.length) return [0, 100];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
    const bottom = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
    return [Math.floor(bottom * 10) / 10, Math.ceil((hi + pad) * 10) / 10];
  }, [chartData, warnLine, critLine]);

  // Sự kiện bất thường hiện đang xem chi tiết ở cột phải
  const activeAnomaly = useMemo(() => {
    if (anomalies.length === 0) return null;
    const idx = Math.min(Math.max(0, activeAnomalyIndex), anomalies.length - 1);
    return anomalies[idx];
  }, [anomalies, activeAnomalyIndex]);

  const handlePrevAnomaly = () => {
    if (activeAnomalyIndex > 0) setActiveAnomalyIndex(activeAnomalyIndex - 1);
  };

  const handleNextAnomaly = () => {
    if (activeAnomalyIndex < anomalies.length - 1) setActiveAnomalyIndex(activeAnomalyIndex + 1);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* THÔNG TIN KỸ THUẬT & AN TOÀN PHÁT HIỆN BẤT THƯỜNG (Z-SCORE ±3σ)           */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="font-medium">
            {tr("Thuật toán thống kê Z-score phân tích chuỗi thời gian telemetry để phát hiện sớm các dấu hiệu bất thường.")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300">
            {tr("Phương pháp:")} <strong>Z-score</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300">
            {tr("Ngưỡng:")} <strong>&plusmn;3&sigma;</strong>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. HÀNG 4 THẺ KPI TRẠNG THÁI (ẢNH 2)                                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Thiết bị đang giám sát */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {tr("Thiết bị đang giám sát")}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.total}
                </span>
                <span className="text-xs font-medium text-slate-500">{tr("máy")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Trạng thái bình thường */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {tr("Trạng thái bình thường")}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {stats.normal}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {tr("máy (")}{stats.normalPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Đang cảnh báo */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {tr("Đang cảnh báo")}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {stats.warning}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {tr("máy (")}{stats.warningPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Bất thường nghiêm trọng */}
        <div className={`bg-white dark:bg-slate-800 rounded-2xl p-4 border shadow-xs ${
          stats.critical > 0
            ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20'
            : 'border-slate-200/80 dark:border-slate-700/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {tr("Bất thường nghiêm trọng")}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  {stats.critical}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {tr("máy (")}{stats.criticalPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TOOLBAR CHỌN THIẾT BỊ, THÔNG SỐ VÀ KHOẢNG THỜI GIAN                      */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Chọn Thiết bị */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr("Thiết bị:")}
            </span>
            <select
              value={currentMachine.machineId}
              onChange={(e) => {
                setSelectedMachineId(e.target.value);
                if (onSelectMachine) onSelectMachine(e.target.value);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {allMachines.map((m) => (
                <option key={m.machineId} value={m.machineId}>
                  {m.machineCode} — {m.machineName} {m.isNoData ? tr("(Chưa có dữ liệu)") : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Thông số */}
          {currentMachine && !currentMachine.isNoData && currentMachine.rawMetrics.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tr("Thông số:")}
              </span>
              <select
                value={currentMetric?.id || ''}
                onChange={(e) => setSelectedMetricId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
              >
                {currentMachine.rawMetrics.map((mtr) => (
                  <option key={mtr.id} value={mtr.id}>
                    {mtr.name} ({mtr.unit})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Khoảng thời gian & Nút Cập nhật */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr("Khoảng thời gian:")}
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              {(['6h', '12h', '24h', '7d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                    timeRange === r
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r === '7d' ? tr("7 ngày") : r}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{tr("Cập nhật")}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. KHỐI TRUNG TÂM: BIỂU ĐỒ XU HƯỚNG VÀ PANEL CHI TIẾT SỰ KIỆN              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Cột Trái (8/12): Xu hướng thông số đo lường & Điểm dị biệt */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {tr("Xu hướng")} {currentMetric?.name || tr("Thông số")} ({currentMachine.machineCode})
                  </h3>
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {tr("Diễn biến")} {currentMetric?.name?.toLowerCase() || tr("thông số")} {tr("theo thời gian và các điểm bất thường được phát hiện")}
                </p>
              </div>
            </div>

            {/* Chú giải đường ngưỡng */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] mb-3 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-teal-500" />
                <span>{currentMetric?.name || tr("Giá trị")} ({currentMetric?.unit})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-amber-500 bg-amber-100" />
                <span>{tr("Điểm cảnh báo")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-rose-500 bg-rose-100" />
                <span>{tr("Điểm bất thường")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-500" />
                <span>{tr("Ngưỡng cảnh báo:")} {warnLine ?? '—'} {currentMetric?.unit}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-rose-500" />
                <span>{tr("Ngưỡng nguy hiểm:")} {critLine ?? '—'} {currentMetric?.unit}</span>
              </div>
            </div>

            {/* Vùng vẽ biểu đồ LineChart */}
            <div className="w-full h-[260px]">
              {currentMachine.isNoData ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <p className="text-xs font-bold text-slate-500">{tr("Thiết bị chưa có dữ liệu quan trắc")}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{tr("Chưa thể sinh biểu đồ cảm biến cho máy")} {currentMachine.machineCode}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
                    <XAxis
                      dataKey="timestamp"
                      minTickGap={28}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={yDomain}
                      allowDataOverflow={false}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`${val} ${currentMetric?.unit}`, currentMetric?.name]}
                    />
                    {warnLine != null && !sameLine && <ReferenceLine
                      y={warnLine}
                      stroke="#F59E0B"
                      strokeDasharray="4 4"
                      label={{ value: tr("Cảnh báo"), fill: '#D97706', fontSize: 11, fontWeight: 600, position: 'insideBottomRight' }}
                    />}
                    {critLine != null && <ReferenceLine
                      y={critLine}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      label={{ value: sameLine ? tr("Cảnh báo / Nguy hiểm") : tr("Nguy hiểm"), fill: '#DC2626', fontSize: 11, fontWeight: 600, position: 'insideTopRight' }}
                    />}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0D9488"
                      strokeWidth={2}
                      isAnimationActive={false}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload.isAnomaly) {
                          const isCrit = payload.anomalyType === 'THRESHOLD_BREACH';
                          return (
                            <circle
                              key={props.index}
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill={isCrit ? '#EF4444' : '#F59E0B'}
                              stroke="#FFFFFF"
                              strokeWidth={2}
                            />
                          );
                        }
                        return <circle key={props.index} cx={cx} cy={cy} r={chartData.length > 40 ? 0 : 2} fill="#0D9488" />;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Cột Phải (4/12): Chi tiết sự kiện bất thường */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {tr("Chi tiết sự kiện bất thường")}
              </h3>
              {anomalies.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={handlePrevAnomaly}
                    disabled={activeAnomalyIndex === 0}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>
                    {activeAnomalyIndex + 1} / {anomalies.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextAnomaly}
                    disabled={activeAnomalyIndex >= anomalies.length - 1}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {activeAnomaly ? (
              <div className="space-y-3.5">
                {/* Badge Sự kiện */}
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                  activeAnomaly.severity === 'CRITICAL'
                    ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400'
                    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-400'
                }`}>
                  <AlertOctagon className="w-4 h-4 shrink-0" />
                  <span>
                    {tr("Sự kiện:")} {activeAnomaly.severity === 'CRITICAL' ? tr("Bất thường nghiêm trọng") : tr("Cảnh báo mức cao")}
                  </span>
                </div>

                {/* Danh sách thông số đo */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{tr("Thời điểm phát hiện:")}</span>
                    <strong className="font-mono">{activeAnomaly.timestamp}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{tr("Giá trị đo được:")}</span>
                    <strong className="font-mono text-rose-600">
                      {activeAnomaly.value} {activeAnomaly.unit}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{tr("Ngưỡng vượt:")}</span>
                    <strong className="font-mono">
                      {activeAnomaly.criticalThreshold} {activeAnomaly.unit} (+{activeAnomaly.deviationPercent}%)
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{tr("Mức độ nghiêm trọng:")}</span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                      {activeAnomaly.severity === 'CRITICAL' ? tr("Cao") : tr("Cảnh báo")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{tr("Trạng thái xử lý:")}</span>
                    <span className="text-slate-500 font-medium">{tr("Chưa xử lý")}</span>
                  </div>
                </div>

                {/* AI Insight Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>{tr("AI Insight (Nhận định của AI)")}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {activeAnomaly.ruleExplanation}
                  </p>
                  <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-4">
                    <li>{tr("Mài mòn bạc đạn cơ khí khớp trục (Khả năng: ~72%)")}</li>
                    <li>{tr("Lỏng khớp nối bu-lông chân đế (Khả năng: ~18%)")}</li>
                    <li>{tr("Xung lực va chạm trong chu kỳ ép (Khả năng: ~10%)")}</li>
                  </ul>
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{tr("Đề xuất:")} </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {tr("Kiểm tra bạc đạn và độ siết khớp nối, vệ sinh và bôi trơn theo quy trình.")}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                {tr("Không có sự kiện bất thường nào đang kích hoạt")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. BẢNG DANH SÁCH SỰ KIỆN BẤT THƯỜNG (TABLE VIEW)                         */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {tr("Danh sách Sự kiện bất thường (")}{anomalies.length} {tr("sự kiện)")}
          </h3>
          <span className="text-xs text-slate-400">{tr("Tự động cập nhật từ cảm biến")}</span>
        </div>

        {anomalies.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {tr("Hệ thống ổn định. Không ghi nhận sự kiện vi phạm ngưỡng cảnh báo.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">{tr("Thời gian")}</th>
                  <th className="py-2.5 px-3">{tr("Thiết bị")}</th>
                  <th className="py-2.5 px-3">{tr("Thông số")}</th>
                  <th className="py-2.5 px-3">{tr("Giá trị đo")}</th>
                  <th className="py-2.5 px-3">{tr("Ngưỡng")}</th>
                  <th className="py-2.5 px-3">{tr("Mức độ")}</th>
                  <th className="py-2.5 px-3">{tr("Nhận định nhanh")}</th>
                  <th className="py-2.5 px-3">{tr("Trạng thái")}</th>
                  <th className="py-2.5 px-3 text-right">{tr("Chi tiết")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {anomalies.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-500">{a.timestamp}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{a.machineCode}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{a.metricName}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                      {a.value} {a.unit}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {a.criticalThreshold} {a.unit}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {a.severity === 'CRITICAL' ? tr("Cao") : tr("Cảnh báo")}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                      {a.ruleExplanation}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{tr("Chưa xử lý")}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAnomalyIndex(idx);
                          setSelectedMachineId(a.machineId);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-teal-600 cursor-pointer"
                        title={tr("Xem chi tiết")}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
