/**
 * @file MetricHistoryChart.tsx
 * @description Biểu đồ biến thiên chỉ số đo lường Tầng 3 theo thời gian thực (Recharts AreaChart)
 * Tự động vẽ các đường giới hạn cảnh báo Warning / Critical (ReferenceLine)
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { MetricIndicator } from '../../types/hierarchy';

interface MetricHistoryChartProps {
  metric: MetricIndicator;
  height?: number;
}

// Tooltip tùy biến chuẩn Dark Mode công nghiệp
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
}

function CustomTooltip({ active, payload, label, unit }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-white/95 dark:bg-factory-card/95 border border-slate-200 dark:border-factory-border p-2.5 rounded-lg shadow-xl backdrop-blur-sm text-xs">
        <p className="text-slate-500 dark:text-gray-400 font-mono mb-1">Thời gian: {label}</p>
        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-mono text-sm">
          <span>Giá trị:</span>
          <span className="text-emerald-600 dark:text-emerald-400">{value}</span>
          <span className="text-xs text-slate-500 dark:text-gray-400 font-normal">{unit}</span>
        </p>
      </div>
    );
  }
  return null;
}

export function MetricHistoryChart({ metric, height = 280 }: MetricHistoryChartProps) {
  const isCritical = metric.status === 'critical';
  const isWarning = metric.status === 'warning';

  // Xác định màu sắc đường biểu diễn dựa trên trạng thái (mặc định là Emerald chuẩn tông màu nhà máy)
  const strokeColor = isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981';
  const fillColor = isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981';
  const gradientId = `gradient-${metric.id}`;

  // Tính toán dải trục Y tối ưu
  const values = metric.history.map((h) => h.value);
  const minVal = Math.min(...values, metric.criticalMin, metric.warningMin);
  const maxVal = Math.max(...values, metric.criticalMax, metric.warningMax);
  const padding = (maxVal - minVal) * 0.15 || 5;

  const yDomainMin = Number((minVal - padding).toFixed(1));
  const yDomainMax = Number((maxVal + padding).toFixed(1));

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-gray-400 mb-2 gap-2">
        <span className="font-semibold text-slate-800 dark:text-gray-300">Biến thiên thời gian thực:</span>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-rose-500 inline-block"></span>
            <span>Critical Max ({metric.criticalMax})</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-amber-500 inline-block"></span>
            <span>Warning Max ({metric.warningMax})</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1.5 rounded-sm bg-emerald-500 inline-block"></span>
            <span>Thực tế ({metric.unit})</span>
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metric.history} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fillColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={fillColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />

            <XAxis
              dataKey="timestamp"
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1F2937' }}
            />

            <YAxis
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1F2937' }}
              domain={[yDomainMin, yDomainMax]}
              tickFormatter={(v) => `${v}`}
            />

            <Tooltip content={<CustomTooltip unit={metric.unit} />} />

            {/* Đường ngưỡng Nguy hiểm trên (Critical Max) */}
            {metric.criticalMax !== undefined && (
              <ReferenceLine
                y={metric.criticalMax}
                stroke="#EF4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Crit Max: ${metric.criticalMax}`,
                  fill: '#EF4444',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* Đường ngưỡng Cảnh báo trên (Warning Max) */}
            {metric.warningMax !== undefined && (
              <ReferenceLine
                y={metric.warningMax}
                stroke="#F59E0B"
                strokeDasharray="3 3"
                strokeWidth={1.2}
                label={{
                  value: `Warn Max: ${metric.warningMax}`,
                  fill: '#F59E0B',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
            )}

            {/* Đường ngưỡng Cảnh báo dưới (Warning Min) nếu có giá trị khác 0 */}
            {metric.warningMin > 0 && (
              <ReferenceLine
                y={metric.warningMin}
                stroke="#F59E0B"
                strokeDasharray="3 3"
                strokeWidth={1.2}
                label={{
                  value: `Warn Min: ${metric.warningMin}`,
                  fill: '#F59E0B',
                  fontSize: 10,
                  position: 'insideBottomLeft',
                }}
              />
            )}

            {/* Đường ngưỡng Nguy hiểm dưới (Critical Min) nếu có */}
            {metric.criticalMin > 0 && (
              <ReferenceLine
                y={metric.criticalMin}
                stroke="#EF4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Crit Min: ${metric.criticalMin}`,
                  fill: '#EF4444',
                  fontSize: 10,
                  position: 'insideBottomRight',
                }}
              />
            )}

            {/* Vùng diện tích biến thiên */}
            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
