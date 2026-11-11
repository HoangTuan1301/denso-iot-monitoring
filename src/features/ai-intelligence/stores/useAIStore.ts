/**
 * @file useAIStore.ts
 * @description Zustand state store quản lý trạng thái của phân hệ AI Giám sát & Dự đoán.
 */

import { create } from 'zustand';
import {
  AITabType,
  AIScenarioId,
  AIChatMessage,
} from '../types/ai';
import {
  AVAILABLE_SCENARIOS,
  computeAllEquipmentHealth,
  generateAnomalyEvents,
  generatePredictiveOrders,
  answerAssistantQuery,
} from '../simulation/aiSimulationEngine';

export interface AIStoreState {
  // Demo Mode & Scenarios
  isDemoActive: boolean;
  activeScenarioId: AIScenarioId;
  isSimulating: boolean;

  // Navigation
  activeTab: AITabType;

  // Selected filters
  selectedMachineId: string;
  selectedMetricCode: string;
  timeRangeHours: number;
  anomalySeverityFilter: 'ALL' | 'WARNING' | 'CRITICAL';
  anomalySearchQuery: string;

  // Chat Assistant State
  chatHistory: AIChatMessage[];
  isAssistantTyping: boolean;

  // Acknowledged anomalies & status changes tracking
  acknowledgedAnomalyIds: Set<string>;
  orderStatusOverrides: Record<string, 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>;

  // Actions
  setDemoActive: (active: boolean) => void;
  setScenario: (id: AIScenarioId) => void;
  setActiveTab: (tab: AITabType) => void;
  setSelectedMachineId: (id: string) => void;
  setSelectedMetricCode: (code: string) => void;
  setTimeRangeHours: (hours: number) => void;
  setAnomalySeverityFilter: (filter: 'ALL' | 'WARNING' | 'CRITICAL') => void;
  setAnomalySearchQuery: (query: string) => void;
  sendUserMessage: (query: string, machines: any[]) => void;
  acknowledgeAnomaly: (anomalyId: string) => void;
  updateOrderStatus: (orderId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => void;
  resetSimulation: () => void;
}

const INITIAL_CHAT_MESSAGES: AIChatMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'assistant',
    text: 'Xin chào! Tôi là **Trợ lý AI KaiLink** của DENSO IoT System. Tôi có thể hỗ trợ bạn chẩn đoán sức khỏe thiết bị, giải thích bất thường kỹ thuật và tư vấn kế hoạch bảo trì dự đoán theo thời gian thực.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    suggestedPrompts: [
      'Máy nào hiện đang có nguy cơ hỏng hóc cao nhất?',
      'Giải thích nguyên nhân cảnh báo nhiệt độ Máy dập MCH-PRS-01',
      'Đề xuất kế hoạch bảo dưỡng ca này',
      'Tổng quan sức khỏe 6 thiết bị',
    ],
  },
];

export const useAIStore = create<AIStoreState>((set, get) => ({
  isDemoActive: true,
  activeScenarioId: 'normal',
  isSimulating: false,

  activeTab: 'overview',

  selectedMachineId: 'MCH-PRS-01',
  selectedMetricCode: 'TEMP_HYD',
  timeRangeHours: 12,
  anomalySeverityFilter: 'ALL',
  anomalySearchQuery: '',

  chatHistory: INITIAL_CHAT_MESSAGES,
  isAssistantTyping: false,

  acknowledgedAnomalyIds: new Set<string>(),
  orderStatusOverrides: {},

  setDemoActive: (active: boolean) => set({ isDemoActive: active }),

  setScenario: (id: AIScenarioId) => {
    set({ isSimulating: true });
    // Dựa vào kịch bản, tự động chọn thiết bị trọng tâm
    const scenario = AVAILABLE_SCENARIOS.find((s) => s.id === id);
    let targetMachine = get().selectedMachineId;
    let targetMetric = get().selectedMetricCode;

    if (scenario && scenario.targetMachineId !== 'ALL') {
      targetMachine = scenario.targetMachineId;
      if (id === 'high_temp') targetMetric = 'TEMP_HYD';
      else if (id === 'abnormal_vibration') targetMetric = 'VIB_RMS';
    } else if (id === 'multiple_anomalies') {
      targetMachine = 'MCH-DRY-01';
      targetMetric = 'TEMP_CHAMBER';
    }

    setTimeout(() => {
      set({
        activeScenarioId: id,
        selectedMachineId: targetMachine,
        selectedMetricCode: targetMetric,
        isSimulating: false,
      });
    }, 250);
  },

  setActiveTab: (tab: AITabType) => set({ activeTab: tab }),

  setSelectedMachineId: (id: string) => {
    // Tự động gán thông số mặc định phù hợp khi đổi máy
    let defaultMetric = 'TEMP_HYD';
    if (id.includes('WLD')) defaultMetric = 'VIB_RMS';
    else if (id.includes('DRY')) defaultMetric = 'TEMP_CHAMBER';
    else if (id.includes('PNT')) defaultMetric = 'FLOW_RATE';
    else if (id.includes('ASM')) defaultMetric = 'TORQUE';
    else if (id.includes('TST')) defaultMetric = 'NOISE_LEVEL';

    set({ selectedMachineId: id, selectedMetricCode: defaultMetric });
  },

  setSelectedMetricCode: (code: string) => set({ selectedMetricCode: code }),

  setTimeRangeHours: (hours: number) => set({ timeRangeHours: hours }),

  setAnomalySeverityFilter: (filter) => set({ anomalySeverityFilter: filter }),

  setAnomalySearchQuery: (query) => set({ anomalySearchQuery: query }),

  sendUserMessage: (query: string, machines: any[]) => {
    if (!query.trim()) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    set((state) => ({
      chatHistory: [...state.chatHistory, userMsg],
      isAssistantTyping: true,
    }));

    setTimeout(() => {
      const scenarioId = get().activeScenarioId;
      const isDemoActive = get().isDemoActive;
      const currentScenario = AVAILABLE_SCENARIOS.find((s) => s.id === scenarioId) || AVAILABLE_SCENARIOS[0];
      const healthList = computeAllEquipmentHealth(machines, scenarioId, isDemoActive);
      const anomalies = generateAnomalyEvents(healthList, scenarioId, isDemoActive);
      const orders = generatePredictiveOrders(healthList, scenarioId, isDemoActive);
      const selectedMachine = healthList.find((h) => h.machineId === get().selectedMachineId) || null;

      const botResponse = answerAssistantQuery(query, {
        healthList,
        anomalies,
        orders,
        selectedMachine,
        scenario: currentScenario,
        isDemoActive,
      });

      set((state) => ({
        chatHistory: [...state.chatHistory, botResponse],
        isAssistantTyping: false,
      }));
    }, 450);
  },

  acknowledgeAnomaly: (anomalyId: string) => {
    set((state) => {
      const updated = new Set(state.acknowledgedAnomalyIds);
      updated.add(anomalyId);
      return { acknowledgedAnomalyIds: updated };
    });
  },

  updateOrderStatus: (orderId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    set((state) => ({
      orderStatusOverrides: {
        ...state.orderStatusOverrides,
        [orderId]: status,
      },
    }));
  },

  resetSimulation: () => {
    set({
      isSimulating: true,
      activeScenarioId: 'normal',
      selectedMachineId: 'MCH-PRS-01',
      selectedMetricCode: 'TEMP_HYD',
      acknowledgedAnomalyIds: new Set<string>(),
      orderStatusOverrides: {},
    });
    setTimeout(() => {
      set({ isSimulating: false });
    }, 200);
  },
}));
