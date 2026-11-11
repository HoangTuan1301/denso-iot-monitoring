/**
 * @file AITrendChart.tsx
 * @description Biểu đồ chuỗi thời gian Recharts hiển thị xu hướng dữ liệu, ngưỡng cảnh báo và điểm bất thường AI.
 * Đảm bảo tên thông số, đơn vị, giá trị và ngưỡng luôn khớp nhau tuyệt đối.
 */

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, Activity } from 'lucide-react';
import { AITrendPoint } from '../types/ai';

interface AITrendChartProps {
  data: AITrendPoint[];
  metricCode: string;
  metricName: string;
  unit: string;
  machineName: string;
  timeRangeHours: number;
  onTimeRangeChange: (hours: number) => void;
  availableMetrics?: { code: string; name: string; unit: string }[];
  onSelectMetric?: (code: string) => void;
}

export const AITrendChart: React.FC<AITrendChartProps> = ({
  data,
  metricCode,
  metricName,
  unit,
  machineName,
  timeRangeHours,
  onTimeRangeChange,
  availableMetrics,
  onSelectMetric,
}) => {
  // Tìm ngưỡng cảnh báo và nguy cấp từ dữ liệu
  const limits = useMemo(() => {
    if (!data || data.length === 0) return { warning: 70, critical: 80 };
    const p = data[0];
    return {
      warning: p.warningMax,
      critical: p.criticalMax,
    };
  }, [data]);

  const hasAnomaly = useMemo(() => {
    return data.some((d) => d.isAnomaly);
  }, [data]);

  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const isCurrentlyBreached = latestValue >= limits.warning;

  // Custom Dot renderer để làm nổi bật các điểm bất thường
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.isAnomaly) {
      return <circle key={`dot-empty-${cx}-${cy}`} cx={cx} cy={cy} r={0} fill="transparent" />;
    }

    return (
      <g key={`anomaly-dot-${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r={5} fill="#EF4444" stroke="#FFFFFF" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={8} fill="none" stroke="#EF4444" strokeWidth={1.5} className="animate-ping opacity-75" />
      </g>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point: AITrendPoint = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs backdrop-blur-xs">
          <div className="font-semibold text-slate-300 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-4">
            <span>Thời điểm: {point.timestamp}</span>
            {point.isAnomaly && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/30 text-rose-300 border border-rose-500/50 font-bold">
                BẤT THƯỜNG AI
              </span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Giá trị:</span>
              <span className="font-bold text-sm text-emerald-400">
                {point.value} {point.unit}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-amber-400">
              <span>Ngưỡng Cảnh báo:</span>
              <span>{point.warningMax} {point.unit}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-rose-400">
              <span>Ngưỡng Nguy hiểm:</span>
              <span>{point.criticalMax} {point.unit}</span>
            </div>
            {point.note && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-[11px] text-slate-300 italic">
                {point.note}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 p-4 shadow-xs flex flex-col justify-between h-full">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Xu hướng Thông số Cảm biến
            </h4>
            {hasAnomaly && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400">
                <AlertTriangle className="w-2.5 h-2.5" /> Có dị biệt
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-sm">
            {machineName} — {metricName}
          </p>
        </div>

        {/* Filters: Metric select & Time range */}
        <div className="flex flex-wrap items-center gap-2">
          {availableMetrics && onSelectMetric && (
            <select
              aria-label="Chọn thông số đo lường"
              value={metricCode}
              onChange={(e) => onSelectMetric(e.target.value)}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {availableMetrics.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          )}

          {/* Time range buttons */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900 text-xs">
            {[6, 12, 24].map((hours) => (
              <button
                key={hours}
                onClick={() => onTimeRangeChange(hours)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                  timeRangeHours === hours
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {hours}h
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chart Graphic */}
      <div className="w-full h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="aiMetricGradientModern" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isCurrentlyBreached ? '#EF4444' : '#10B981'}
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor={isCurrentlyBreached ? '#EF4444' : '#10B981'}
                  stopOpacity={0.0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.15} vertical={false} />

            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
              interval="preserveStartEnd"
              minTickGap={25}
            />

            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
              domain={[
                (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.85)),
                (dataMax: number) => Math.ceil(Math.max(dataMax, limits.critical) * 1.1),
              ]}
              unit={` ${unit}`}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Warning limit line */}
            <ReferenceLine
              y={limits.warning}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Warning: ${limits.warning} ${unit}`,
                position: 'insideTopRight',
                fill: '#D97706',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />

            {/* Critical limit line */}
            <ReferenceLine
              y={limits.critical}
              stroke="#EF4444"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: `Critical: ${limits.critical} ${unit}`,
                position: 'insideTopRight',
                fill: '#DC2626',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />

            {/* Area Series with custom anomaly dot */}
            <Area
              type="monotone"
              dataKey="value"
              stroke={isCurrentlyBreached ? '#EF4444' : '#10B981'}
              strokeWidth={2}
              fill="url(#aiMetricGradientModern)"
              dot={(props: any) => renderCustomDot(props)}
              activeDot={{ r: 5, fill: '#10B981', stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Footer */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500" />
            Quan trắc
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-amber-500 border-dashed" />
            Cảnh báo ({limits.warning} {unit})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-500" />
            Nguy hiểm ({limits.critical} {unit})
          </span>
        </div>

        <div className="text-right">
          Hiện hành: <strong className={isCurrentlyBreached ? 'text-rose-600 font-bold' : 'text-slate-800 dark:text-slate-200'}>{latestValue} {unit}</strong>
        </div>
      </div>
    </div>
  );
};
