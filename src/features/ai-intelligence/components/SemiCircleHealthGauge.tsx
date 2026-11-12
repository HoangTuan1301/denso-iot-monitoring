/**
 * @file SemiCircleHealthGauge.tsx
 * @description Đồng hồ bán nguyệt đo Điểm Sức Khỏe Nhà Máy (Khớp thiết kế tham chiếu Image V2)
 */

import React from 'react';

interface SemiCircleHealthGaugeProps {
  score: number | null;
  maxScore?: number;
  subtitle?: string;
  trendText?: string;
  isSpike?: boolean;
}

export const SemiCircleHealthGauge: React.FC<SemiCircleHealthGaugeProps> = ({
  score,
  maxScore = 100,
  subtitle = 'Trung bình (máy có dữ liệu)',
  trendText = '+1.2 điểm so với 24h trước',
  isSpike = false,
}) => {
  const currentScore = score !== null ? Math.min(maxScore, Math.max(0, score)) : 0;
  const percentage = (currentScore / maxScore) * 100;

  // Tọa độ bán nguyệt: R = 85, tâm (110, 105)
  const radius = 80;
  const cx = 110;
  const cy = 100;
  const strokeWidth = 14;

  // Chu vi nửa đường tròn = PI * R
  const arcLength = Math.PI * radius;
  // Offset tỷ lệ thuận với số điểm
  const strokeDashoffset = arcLength * (1 - percentage / 100);

  // Màu sắc theo ngưỡng sức khỏe
  const strokeColor =
    score === null
      ? '#94a3b8'
      : isSpike || currentScore < 70
      ? '#ef4444'
      : currentScore < 85
      ? '#f59e0b'
      : '#10b981';

  return (
    <div className="flex flex-col items-center justify-center p-1">
      <div className="relative w-[220px] h-[120px] flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 220 120"
          className="w-full h-full transform"
        >
          {/* Đường ray bán nguyệt nền (Background Arc) */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="dark:stroke-slate-700"
          />

          {/* Vạch tiến độ màu sắc động */}
          {score !== null && (
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>

        {/* Điểm số ở tâm đồng hồ */}
        <div className="absolute top-[52px] flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline justify-center">
            <span
              className={`text-3xl sm:text-4xl font-black tracking-tight ${
                isSpike || (score !== null && score < 70)
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {score !== null ? score : 'N/A'}
            </span>
            <span className="text-sm font-semibold text-slate-400 ml-0.5">/100</span>
          </div>
        </div>
      </div>

      {/* Thông tin phụ đề và xu hướng */}
      <div className="mt-1 text-center space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {subtitle}
        </p>
        <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
          {isSpike ? (
            <span className="text-rose-600 dark:text-rose-400">
              ▼ -40.0 điểm (Diễn tập sự cố Header)
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400">
              ▲ {trendText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
