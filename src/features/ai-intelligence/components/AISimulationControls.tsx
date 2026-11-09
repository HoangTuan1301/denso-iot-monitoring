/**
 * @file AISimulationControls.tsx
 * @description Toolbar điều khiển mô phỏng AI tinh gọn (Compact Industrial Simulation Bar).
 * Tối giản diện tích, đưa chi tiết kịch bản vào panel mở rộng và hỗ trợ toast thông báo khi áp dụng.
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  X,
} from 'lucide-react';
import { useAIStore } from '../stores/useAIStore';
import { AVAILABLE_SCENARIOS } from '../simulation/aiSimulationEngine';
import { AIScenarioId } from '../types/ai';

export const AISimulationControls: React.FC = () => {
  const {
    isDemoActive,
    activeScenarioId,
    isSimulating,
    setDemoActive,
    setScenario,
    resetSimulation,
  } = useAIStore();

  const [showDetails, setShowDetails] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentScenario =
    AVAILABLE_SCENARIOS.find((s) => s.id === activeScenarioId) ||
    AVAILABLE_SCENARIOS[0];

  const handleRunScenario = () => {
    setScenario(activeScenarioId);
    setToastMessage(`Đã kích hoạt: ${currentScenario.name}`);
  };

  const handleReset = () => {
    resetSimulation();
    setToastMessage('Đã đặt lại về Kịch bản 1: Hoạt động Tiêu chuẩn');
  };

  // Tự động tắt toast sau 3.5 giây
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const getSeverityPill = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400">
            <AlertOctagon className="w-3 h-3" /> Nguy cấp
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" /> Rủi ro cao
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Tiêu chuẩn
          </span>
        );
    }
  };

  return (
    <div className="relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute -top-12 right-0 z-50 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900/90 text-white text-xs shadow-lg backdrop-blur-xs border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Compact Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/70 px-3.5 py-2.5 shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Left: Status & Scenario Dropdown */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status indicator */}
            <button
              onClick={() => setDemoActive(!isDemoActive)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                isDemoActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title="Nhấn để bật/tắt chế độ mô phỏng"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isDemoActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span>{isDemoActive ? 'Mô phỏng: Hoạt động' : 'Tạm dừng'}</span>
            </button>

            {/* Scenario Dropdown */}
            <div className="relative min-w-[260px] sm:min-w-[320px]">
              <select
                aria-label="Chọn kịch bản mô phỏng AI"
                value={activeScenarioId}
                onChange={(e) => setScenario(e.target.value as AIScenarioId)}
                className="w-full text-xs font-semibold pl-3 pr-8 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-xs"
              >
                {AVAILABLE_SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Info toggle button */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                showDetails
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
              title="Xem thông tin chi tiết kịch bản"
            >
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Chi tiết</span>
              {showDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Run button */}
            <button
              onClick={handleRunScenario}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs disabled:opacity-50"
              title="Áp dụng kịch bản và tính toán lại toàn bộ thông số"
            >
              <Play className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Đang tính...' : 'Chạy kịch bản'}</span>
            </button>

            {/* Reset button */}
            <button
              onClick={handleReset}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-colors"
              title="Đặt lại về Kịch bản 1 mặc định"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          </div>
        </div>

        {/* Collapsible Scenario Detail Panel */}
        {showDetails && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700/50 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs animate-in fade-in duration-150">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Mục tiêu & Mức độ:</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {currentScenario.targetMachineName}
                </span>
                {getSeverityPill(currentScenario.severity)}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Mô tả hiện tượng:</span>
              <p className="text-slate-700 dark:text-slate-300 mt-1 leading-snug">
                {currentScenario.description}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Khuyến nghị xử lý:</span>
              <p className="text-emerald-700 dark:text-emerald-400 font-medium mt-1 leading-snug">
                {currentScenario.recommendedAction}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
