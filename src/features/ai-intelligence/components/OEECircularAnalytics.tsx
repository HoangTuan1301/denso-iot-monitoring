/**
 * @file OEECircularAnalytics.tsx
 * @description Khối phân tích Chỉ số Vận hành OEE (Khớp thiết kế tham chiếu Image V2)
 * Hiển thị OEE tổng thể và phân rã 3 thành phần A (Sẵn sàng) x P (Hiệu suất) x Q (Chất lượng).
 */

import React from 'react';
import { Gauge } from 'lucide-react';

interface OEECircularAnalyticsProps {
  overallOEE?: number;
  availability?: number;
  performance?: number;
  quality?: number;
}

export const OEECircularAnalytics: React.FC<OEECircularAnalyticsProps> = ({
  overallOEE = 87.6,
  availability = 92.8,
  performance = 94.5,
  quality = 99.2,
}) => {
  // Bán kính vòng tròn OEE: R = 38, chu vi = 2 * PI * 38 = 238.76
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - overallOEE / 100);

  return (
    <div className="h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Chỉ số Vận hành (OEE)
          </h4>
        </div>
        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          Ước tính ca
        </span>
      </div>

      {/* Main content: Circular gauge on left + 3 breakdown bars on right */}
      <div className="flex-1 flex items-center justify-between gap-3 my-1">
        {/* Left: Circular gauge */}
        <div className="flex flex-col items-center justify-center shrink-0 w-[110px]">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle track */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-slate-100 dark:stroke-slate-750"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Progress stroke */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-emerald-500 transition-all duration-700 ease-out"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Center percentage */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {overallOEE.toFixed(1)}%
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
            OEE Nhà máy
          </span>
        </div>

        {/* Right: 3 Breakdown bars */}
        <div className="flex-1 space-y-2.5">
          {/* Availability */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Availability (A)</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{availability}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-750 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${availability}%` }}
              />
            </div>
          </div>

          {/* Performance */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Performance (P)</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{performance}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-750 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${performance}%` }}
              />
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Quality (Q)</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{quality}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-750 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${quality}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
        <span>A × P × Q = 87.6%</span>
        <span>Mô hình định lượng chuẩn DENSO</span>
      </div>
    </div>
  );
};
