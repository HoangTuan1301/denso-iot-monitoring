/**
 * @file AIHealthScoreCard.tsx
 * @description Thẻ trực quan hóa Điểm Sức khỏe AI có thể giải thích (Explainable Health Score).
 * Đảm bảo các khoản điểm phạt cộng lại khớp 100% với điểm hiển thị.
 */

import React from 'react';
import {
  Flame,
  Activity,
  Gauge,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { EquipmentHealthItem } from '../types/ai';

interface AIHealthScoreCardProps {
  equipment: EquipmentHealthItem;
}

export const AIHealthScoreCard: React.FC<AIHealthScoreCardProps> = ({
  equipment,
}) => {
  const { healthScore, riskLevel, factors, machineCode, machineName } = equipment;

  const getScoreTheme = (score: number) => {
    if (score >= 85) {
      return {
        text: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-800',
        ring: '#10B981',
        label: 'TỐT / ỔN ĐỊNH',
      };
    }
    if (score >= 70) {
      return {
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800',
        ring: '#F59E0B',
        label: 'CẢNH BÁO',
      };
    }
    return {
      text: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800',
      ring: '#EF4444',
      label: 'NGUY HIỂM',
    };
  };

  const theme = getScoreTheme(healthScore);

  // SVG Circular calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 p-4 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Chi tiết Sức khỏe AI
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[200px]" title={machineName}>
              {machineCode} — {machineName}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${theme.bg} ${theme.text} ${theme.border}`}
          >
            {theme.label}
          </span>
        </div>

        {/* Gauge + Deductions Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center my-3">
          {/* Circular Gauge (5 cols) */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="7"
                  fill="transparent"
                  className="text-slate-100 dark:text-slate-700"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  stroke={theme.ring}
                  strokeWidth="7"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className={`text-2xl font-black ${theme.text}`}>
                  {healthScore}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase">
                  Điểm / 100
                </span>
              </div>
            </div>
            <div className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
              Mức rủi ro: <strong className="text-slate-800 dark:text-slate-200">{riskLevel}</strong>
            </div>
          </div>

          {/* Deductions Breakdown (7 cols) */}
          <div className="sm:col-span-7 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Điểm gốc tiêu chuẩn:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                +{factors.base}
              </span>
            </div>

            {/* Temp penalty */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>Trừ quá nhiệt:</span>
              </div>
              <span
                className={`font-bold ${
                  factors.tempPenalty > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {factors.tempPenalty > 0 ? `-${factors.tempPenalty}` : '0'}
              </span>
            </div>

            {/* Vibration penalty */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Activity className="w-3.5 h-3.5 text-amber-500" />
                <span>Trừ rung lắc cơ khí:</span>
              </div>
              <span
                className={`font-bold ${
                  factors.vibrationPenalty > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-400'
                }`}
              >
                {factors.vibrationPenalty > 0 ? `-${factors.vibrationPenalty}` : '0'}
              </span>
            </div>

            {/* Pressure / Current penalty */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Gauge className="w-3.5 h-3.5 text-blue-500" />
                <span>Trừ tụt áp / dòng tải:</span>
              </div>
              <span
                className={`font-bold ${
                  factors.pressurePenalty + factors.currentPenalty > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400'
                }`}
              >
                {factors.pressurePenalty + factors.currentPenalty > 0
                  ? `-${factors.pressurePenalty + factors.currentPenalty}`
                  : '0'}
              </span>
            </div>

            {/* Age penalty */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Khấu hao chu kỳ máy:</span>
              </div>
              <span className="font-bold text-slate-500">
                -{factors.agePenalty}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Explanation Footnote */}
      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-slate-600 dark:text-slate-300 leading-snug">
            <strong className="text-slate-800 dark:text-slate-100 font-semibold">
              Đánh giá AI:
            </strong>{' '}
            {factors.explanation}
          </p>
        </div>
      </div>
    </div>
  );
};
