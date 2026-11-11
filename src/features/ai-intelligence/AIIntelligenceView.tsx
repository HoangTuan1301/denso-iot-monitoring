/**
 * @file AIIntelligenceView.tsx
 * @description Màn hình chính phân hệ AI Giám sát & Dự đoán (Modern Industrial AI Command Center)
 * Điều phối 4 tab chức năng với giao diện chuẩn Enterprise tối giản, trực quan, hỗ trợ Light/Dark mode.
 */

import React, { useMemo } from 'react';
import {
  BrainCircuit,
  LayoutDashboard,
  ShieldAlert,
  Wrench,
  Bot,
  Info,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAIStore } from './stores/useAIStore';
import { AITabType } from './types/ai';
import { AISimulationControls } from './components/AISimulationControls';
import { AIOverviewTab } from './tabs/AIOverviewTab';
import { AIAnomalyDetectionTab } from './tabs/AIAnomalyDetectionTab';
import { AIPredictiveMaintenanceTab } from './tabs/AIPredictiveMaintenanceTab';
import { AIAssistantTab } from './tabs/AIAssistantTab';

// Dữ liệu dự phòng chuẩn 6 thiết bị DENSO nếu store chưa nạp
const FALLBACK_MACHINES = [
  {
    id: 'MCH-PRS-01',
    code: 'MCH-PRS-01',
    name: 'Máy Dập Thủy Lực 500T Komatsu',
    lineId: 'LINE-01',
    lineName: 'Dây Chuyền Dập & Đột',
    type: 'Dập Thủy Lực',
  },
  {
    id: 'MCH-WLD-01',
    code: 'MCH-WLD-01',
    name: 'Robot Hàn Điểm Fanuc R-2000iC',
    lineId: 'LINE-01',
    lineName: 'Dây Chuyền Dập & Đột',
    type: 'Robot Hàn',
  },
  {
    id: 'MCH-DRY-01',
    code: 'MCH-DRY-01',
    name: 'Lò Sấy Hồng Ngoại Đối Lưu',
    lineId: 'LINE-02',
    lineName: 'Dây Chuyền Sơn Tĩnh Điện',
    type: 'Lò Sấy Công Nghiệp',
  },
  {
    id: 'MCH-PNT-01',
    code: 'MCH-PNT-01',
    name: 'Buồng Phun Sơn Robot Tự Động',
    lineId: 'LINE-02',
    lineName: 'Dây Chuyền Sơn Tĩnh Điện',
    type: 'Buồng Sơn Robot',
  },
  {
    id: 'MCH-ASM-01',
    code: 'MCH-ASM-01',
    name: 'Bàn Gá Lắp Ráp Khung Gầm',
    lineId: 'LINE-03',
    lineName: 'Dây Chuyền Lắp Ráp & Kiểm Tra',
    type: 'Bàn Gá Lắp Ráp',
  },
  {
    id: 'MCH-TST-01',
    code: 'MCH-TST-01',
    name: 'Trạm Thử Nghiệm Tải & Rò Rỉ Khí',
    lineId: 'LINE-03',
    lineName: 'Dây Chuyền Lắp Ráp & Kiểm Tra',
    type: 'Trạm Kiểm Thử QA',
  },
];

export const AIIntelligenceView: React.FC = () => {
  const { lines } = useMonitoringStore();
  const { activeTab, setActiveTab, activeScenarioId } = useAIStore();

  // Trích xuất danh sách máy thực tế từ store
  const machines = useMemo(() => {
    if (lines && lines.length > 0) {
      const extracted = lines.flatMap((l) =>
        (l.machines || []).map((m: any) => ({
          ...m,
          lineId: l.id,
          lineName: l.name,
        }))
      );
      if (extracted.length > 0) return extracted;
    }
    return FALLBACK_MACHINES;
  }, [lines]);

  const tabs: { id: AITabType; label: string; icon: React.ReactNode; hasAlert?: boolean }[] = [
    {
      id: 'overview',
      label: 'Tổng quan AI',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'anomaly',
      label: 'Phát hiện Bất thường',
      icon: <ShieldAlert className="w-4 h-4" />,
      hasAlert: activeScenarioId !== 'normal',
    },
    {
      id: 'predictive',
      label: 'Dự đoán Bảo trì',
      icon: <Wrench className="w-4 h-4" />,
    },
    {
      id: 'assistant',
      label: 'Trợ lý AI KaiLink',
      icon: <Bot className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-3.5 p-1 sm:p-2 bg-slate-50/50 dark:bg-slate-900/40 min-h-screen">
      {/* 1. Page Header (Tối giản, chuyên nghiệp) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                AI Giám sát & Dự đoán (AI Intelligence)
              </h2>
              <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Command Center
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đánh giá sức khỏe thiết bị thời gian thực, phát hiện dị biệt và lập lịch bảo trì dự đoán
            </p>
          </div>
        </div>

        {/* Safety Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          <span>Mô phỏng an toàn — Cách ly với CSDL & PLC vật lý</span>
        </div>
      </div>

      {/* 2. Compact Simulation Toolbar */}
      <AISimulationControls />

      {/* 3. 4-Tab Navigation Bar */}
      <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-800/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.hasAlert && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Active Tab Content */}
      <div className="transition-all duration-150">
        {activeTab === 'overview' && <AIOverviewTab machines={machines} />}
        {activeTab === 'anomaly' && <AIAnomalyDetectionTab machines={machines} />}
        {activeTab === 'predictive' && <AIPredictiveMaintenanceTab machines={machines} />}
        {activeTab === 'assistant' && <AIAssistantTab machines={machines} />}
      </div>
    </div>
  );
};

export default AIIntelligenceView;
