/**
 * @file AIIntelligenceView.tsx
 * @description Phân hệ AI Giám sát & Dự đoán (DENSO Modern Industrial AI Command Center)
 * Điều phối 4 tab chức năng với kiến trúc Single Source of Truth từ useMonitoringStore.
 * Loại bỏ hoàn toàn dropdown giả lập sự cố riêng lẻ, tích hợp đồng bộ với nút "Giả lập Sự cố" trên Header.
 */

import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Wrench,
  Bot,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { useAIStore } from './stores/useAIStore';
import { AITabType } from './types/ai';
import {
  processAllEquipment,
  extractDynamicAnomalies,
  extractDynamicPredictiveOrders,
} from './adapters/aiTelemetryAdapter';
import { AIOverviewTab } from './tabs/AIOverviewTab';
import { AIAnomalyDetectionTab } from './tabs/AIAnomalyDetectionTab';
import { AIPredictiveMaintenanceTab } from './tabs/AIPredictiveMaintenanceTab';
import { AIAssistantTab } from './tabs/AIAssistantTab';

export const AIIntelligenceView: React.FC = () => {
  const { lines, activeEmergencyMetricId } = useMonitoringStore();
  const { alarms } = useAlarmStore();
  const { activeTab, setActiveTab, selectedMachineId, setSelectedMachineId } = useAIStore();

  // 1. Single Source of Truth: Xử lý 14 máy từ useMonitoringStore
  const { allMachines, kpis } = useMemo(() => {
    return processAllEquipment(lines, activeEmergencyMetricId, alarms);
  }, [lines, activeEmergencyMetricId, alarms]);

  // 2. Trích xuất danh sách bất thường động (Z-score ±3σ)
  const anomalies = useMemo(() => {
    return extractDynamicAnomalies(allMachines, alarms);
  }, [allMachines, alarms]);

  // 3. Trích xuất danh sách phiếu bảo trì dự đoán động
  const orders = useMemo(() => {
    return extractDynamicPredictiveOrders(allMachines, anomalies);
  }, [allMachines, anomalies]);

  // Kiểm tra cờ cảnh báo để gắn chấm đỏ trên tab
  const hasActiveAlert = kpis.hasActiveEmergency || kpis.criticalCount > 0 || kpis.warningCount > 0;

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
      hasAlert: hasActiveAlert,
    },
    {
      id: 'predictive',
      label: 'Dự đoán bảo trì',
      icon: <Wrench className="w-4 h-4" />,
    },
    {
      id: 'assistant',
      label: 'Trợ lý AI KaiLink',
      icon: <Bot className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-4 p-1 sm:p-2 bg-slate-50/50 dark:bg-slate-900/40 min-h-screen">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BANNER ĐỘNG THEO TAB (Khớp ảnh tham chiếu V2)               */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#0c242b] via-[#0d2a32] to-[#133842] px-5 py-4 rounded-2xl border border-teal-900/40 shadow-sm relative overflow-hidden">
          {/* Ảnh nền mờ nhà máy cánh tay robot */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2/3 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
            style={{ backgroundImage: `url('/images/factory-login-bg.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c242b] via-[#0c242b]/90 to-transparent pointer-events-none" />

          <div className="z-10">
            <h2 className="text-lg font-black text-white tracking-tight">
              AI Command Center
            </h2>
            <p className="text-xs text-emerald-100/80 mt-0.5 font-normal">
              Trung tâm phân tích, giám sát, dự đoán và tối ưu vận hành thiết bị DENSO Smart Factory
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-2 z-10">
            <div className="bg-white/95 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-white/20">
              <span className="text-xs font-black tracking-widest text-[#e60012]">
                DENSO
              </span>
              <span className="text-[11px] font-bold text-slate-700">
                Smart Factory
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'anomaly' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#0c242b] via-[#0d2a32] to-[#133842] px-5 py-4 rounded-2xl border border-teal-900/40 shadow-sm relative overflow-hidden">
          {/* Ảnh nền mờ nhà máy cánh tay robot */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2/3 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
            style={{ backgroundImage: `url('/images/factory-login-bg.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c242b] via-[#0c242b]/90 to-transparent pointer-events-none" />

          <div className="z-10">
            <h2 className="text-lg font-black text-white tracking-tight">
              Phát hiện bất thường
            </h2>
            <p className="text-xs text-emerald-100/80 mt-0.5 font-normal">
              Giám sát dữ liệu cảm biến, phát hiện sớm các dấu hiệu bất thường trong quá trình vận hành thiết bị.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-2 z-10">
            <div className="bg-white/95 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-white/20">
              <span className="text-xs font-black tracking-widest text-[#e60012]">
                DENSO
              </span>
              <span className="text-[11px] font-bold text-slate-700">
                Smart Factory
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'predictive' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#0c242b] via-[#0d2a32] to-[#133842] px-5 py-4 rounded-2xl border border-teal-900/40 shadow-sm relative overflow-hidden">
          {/* Ảnh nền mờ nhà máy cánh tay robot */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2/3 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
            style={{ backgroundImage: `url('/images/factory-login-bg.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c242b] via-[#0c242b]/90 to-transparent pointer-events-none" />

          <div className="z-10">
            <h2 className="text-lg font-black text-white tracking-tight">
              Dự đoán bảo trì
            </h2>
            <p className="text-xs text-emerald-100/80 mt-0.5 font-normal">
              Đánh giá sức khỏe thiết bị, nhận diện nguy cơ hư hỏng và hỗ trợ lập kế hoạch bảo trì.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-2 z-10">
            <div className="bg-white/95 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-white/20">
              <span className="text-xs font-black tracking-widest text-[#e60012]">
                DENSO
              </span>
              <span className="text-[11px] font-bold text-slate-700">
                Smart Factory
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assistant' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#0c242b] via-[#0d2a32] to-[#133842] px-5 py-4 rounded-2xl border border-teal-900/40 shadow-sm relative overflow-hidden">
          {/* Ảnh nền mờ nhà máy cánh tay robot */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2/3 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
            style={{ backgroundImage: `url('/images/factory-login-bg.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c242b] via-[#0c242b]/90 to-transparent pointer-events-none" />

          <div className="z-10">
            <h2 className="text-lg font-black text-white tracking-tight">
              Trợ lý AI KaiLink
            </h2>
            <p className="text-xs text-emerald-100/80 mt-0.5 font-normal">
              Hỗ trợ tra cứu thông tin thiết bị, phân tích cảnh báo và đề xuất phương án xử lý.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-2 z-10">
            <div className="bg-white/95 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-white/20">
              <span className="text-xs font-black tracking-widest text-[#e60012]">
                DENSO
              </span>
              <span className="text-[11px] font-bold text-slate-700">
                Smart Factory
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. THANH ĐIỀU HƯỚNG 4 TAB (Đồng bộ, có Badge cảnh báo đỏ khi có sự cố)    */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-800/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.hasAlert && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. NỘI DUNG TAB HIỆN TẠI (Truyền toàn bộ dữ liệu động đồng bộ)             */}
      {/* ========================================================================= */}
      <div className="transition-all duration-150">
        {activeTab === 'overview' && (
          <AIOverviewTab
            allMachines={allMachines}
            kpis={kpis}
            lines={lines}
            onSelectMachine={(mId) => setSelectedMachineId(mId)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'anomaly' && (
          <AIAnomalyDetectionTab
            allMachines={allMachines}
            anomalies={anomalies}
            selectedMachineId={selectedMachineId}
            onSelectMachine={(mId) => setSelectedMachineId(mId)}
          />
        )}

        {activeTab === 'predictive' && (
          <AIPredictiveMaintenanceTab
            allMachines={allMachines}
            orders={orders}
            onSelectMachine={(mId) => setSelectedMachineId(mId)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'assistant' && (
          <AIAssistantTab
            allMachines={allMachines}
            selectedMachineId={selectedMachineId}
            onSelectMachine={(mId) => setSelectedMachineId(mId)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}
      </div>
    </div>
  );
};

export default AIIntelligenceView;
