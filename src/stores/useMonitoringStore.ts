/**
 * @file useMonitoringStore.ts
 * @description Quản lý trạng thái cốt lõi của Mô hình Giám Sát 3 Tầng (Line -> Machine -> Metric),
 * đồng thời cung cấp luồng mô phỏng cập nhật dữ liệu cảm biến thời gian thực (Real-time IoT streaming),
 * trạm PLC kết nối (Modbus/TCP, OPC-UA) và Giả lập sự cố khẩn cấp.
 */

import { create } from 'zustand';
import { ProductionLine, MetricIndicator, SystemStatus } from '../types/hierarchy';
import { PLCMappingConfig } from '../types/plc';
import { initialProductionLines } from '../utils/mockData';
import { evaluateMetricStatus, calculateLineSafetyMetrics, convertPLCRawToEngineering } from '../utils/plcConverter';
import { useAlarmStore } from './useAlarmStore';
import { apiClient } from '../services/api';

export type NavigationTab = 'dashboard' | 'lines' | 'thresholds' | 'alarms' | 'users' | 'audit' | 'qr' | 'settings';

export interface PLCStation {
  id: string;
  name: string;
  protocol: 'Modbus/TCP' | 'OPC-UA';
  ipAddress: string;
  port: number;
  isConnected: boolean;
  latencyMs: number;
  tagsCount: number;
  lastSync: string;
  pollingRateMs: number;
}

const initialPLCStations: PLCStation[] = [
  {
    id: 'PLC-STATION-01',
    name: 'Trạm PLC Chính - Dây chuyền Dập & Hàn (Siemens S7-1500)',
    protocol: 'Modbus/TCP',
    ipAddress: '192.168.1.100',
    port: 502,
    isConnected: true,
    latencyMs: 12,
    tagsCount: 24,
    lastSync: 'Vừa xong',
    pollingRateMs: 1000,
  },
  {
    id: 'PLC-STATION-02',
    name: 'Trạm PLC Phụ - Dây chuyền Sơn & Lắp ráp (Omron NX1P2)',
    protocol: 'OPC-UA',
    ipAddress: '192.168.1.101',
    port: 4840,
    isConnected: true,
    latencyMs: 18,
    tagsCount: 16,
    lastSync: 'Vừa xong',
    pollingRateMs: 2500,
  },
];

interface MonitoringState {
  lines: ProductionLine[];
  selectedLineId: string | null;
  selectedMachineId: string | null;
  selectedMetricId: string | null;
  activeTab: NavigationTab;
  isRealtimeActive: boolean;

  // Quản lý trạm PLC
  plcStations: PLCStation[];
  togglePLCStationConnection: (stationId: string) => void;
  setPLCStationPollingRate: (stationId: string, rateMs: number) => void;

  // Điều hướng phân tầng
  setActiveTab: (tab: NavigationTab) => void;
  setSelectedLineId: (lineId: string | null) => void;
  setSelectedMachineId: (machineId: string | null) => void;
  setSelectedMetricId: (metricId: string | null) => void;
  toggleRealtime: (enabled?: boolean) => void;

  // Nghiệp vụ Admin: Cấu hình ngưỡng & Ánh xạ PLC
  updateMetricThresholds: (
    metricId: string,
    thresholds: {
      warningMin: number;
      warningMax: number;
      criticalMin: number;
      criticalMax: number;
    }
  ) => void;

  updateMetricPLC: (metricId: string, config: PLCMappingConfig) => void;
  addMetricToMachine: (machineId: string, newMetric: MetricIndicator) => void;
  deleteMetricFromMachine: (machineId: string, metricId: string) => void;

  // Xung nhịp thời gian thực (Tick IoT streaming)
  simulateTick: () => void;

  // Giả lập sự cố khẩn cấp ngẫu nhiên phục vụ demo thuyết trình
  triggerEmergencyDemo: () => {
    lineName: string;
    machineName: string;
    metricName: string;
    value: number;
    unit: string;
  } | null;
}

export const useMonitoringStore = create<MonitoringState>((set) => ({
  lines: initialProductionLines,
  selectedLineId: null,
  selectedMachineId: null,
  selectedMetricId: null,
  activeTab: 'dashboard',
  isRealtimeActive: true,
  plcStations: initialPLCStations,

  togglePLCStationConnection: (stationId) => {
    apiClient.recordAudit(
      'TOGGLE_PLC',
      stationId,
      `Chuyển đổi trạng thái kết nối trạm PLC ${stationId}`
    );
    set((state) => ({
      plcStations: state.plcStations.map((station) =>
        station.id === stationId
          ? {
              ...station,
              isConnected: !station.isConnected,
              latencyMs: !station.isConnected ? Math.floor(Math.random() * 15 + 8) : 0,
              lastSync: !station.isConnected ? 'Vừa kết nối lại' : 'Mất tín hiệu',
            }
          : station
      ),
    }));
  },

  setPLCStationPollingRate: (stationId, rateMs) =>
    set((state) => ({
      plcStations: state.plcStations.map((station) =>
        station.id === stationId ? { ...station, pollingRateMs: rateMs } : station
      ),
    })),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedLineId: (lineId) => set({ selectedLineId: lineId }),
  setSelectedMachineId: (machineId) => set({ selectedMachineId: machineId }),
  setSelectedMetricId: (metricId) => set({ selectedMetricId: metricId }),
  toggleRealtime: (enabled) =>
    set((state) => ({
      isRealtimeActive: enabled !== undefined ? enabled : !state.isRealtimeActive,
    })),

  /**
   * Cập nhật 4 ngưỡng kỹ thuật của một chỉ số
   */
  updateMetricThresholds: (metricId, thresholds) => {
    apiClient.recordAudit(
      'UPDATE_THRESHOLD',
      metricId,
      `Thiết lập 4 ngưỡng: W-Min:${thresholds.warningMin}, W-Max:${thresholds.warningMax}, C-Min:${thresholds.criticalMin}, C-Max:${thresholds.criticalMax}`
    );
    set((state) => {
      const updatedLines = state.lines.map((line) => {
        const updatedMachines = line.machines.map((machine) => {
          const updatedMetrics = machine.metrics.map((metric) => {
            if (metric.id !== metricId) return metric;

            const newStatus = evaluateMetricStatus(
              metric.currentValue,
              thresholds.warningMin,
              thresholds.warningMax,
              thresholds.criticalMin,
              thresholds.criticalMax
            );

            return {
              ...metric,
              ...thresholds,
              status: newStatus,
            };
          });

          return { ...machine, metrics: updatedMetrics };
        });

        const { safetyScore, overallStatus } = calculateLineSafetyMetrics(updatedMachines);
        return {
          ...line,
          machines: updatedMachines,
          safetyScore,
          status: overallStatus,
        };
      });

      return { lines: updatedLines };
    });
  },

  /**
   * Cập nhật cấu hình ánh xạ PLC cho Metric
   */
  updateMetricPLC: (metricId, config) =>
    set((state) => {
      const updatedLines = state.lines.map((line) => {
        const updatedMachines = line.machines.map((machine) => {
          const updatedMetrics = machine.metrics.map((metric) => {
            if (metric.id !== metricId) return metric;

            const raw = metric.rawVal ?? 1000;
            const engValue = convertPLCRawToEngineering(raw, config);
            const status = evaluateMetricStatus(
              engValue,
              metric.warningMin,
              metric.warningMax,
              metric.criticalMin,
              metric.criticalMax
            );

            return {
              ...metric,
              plcMapping: config,
              currentValue: engValue,
              status,
            };
          });

          return { ...machine, metrics: updatedMetrics };
        });

        const { safetyScore, overallStatus } = calculateLineSafetyMetrics(updatedMachines);
        return {
          ...line,
          machines: updatedMachines,
          safetyScore,
          status: overallStatus,
        };
      });

      return { lines: updatedLines };
    }),

  /**
   * Gán Metric mới vào một Máy/Component (Tầng 2)
   */
  addMetricToMachine: (machineId, newMetric) =>
    set((state) => {
      const updatedLines = state.lines.map((line) => {
        const updatedMachines = line.machines.map((machine) => {
          if (machine.id !== machineId) return machine;
          return {
            ...machine,
            metrics: [...machine.metrics, newMetric],
          };
        });

        const { safetyScore, overallStatus } = calculateLineSafetyMetrics(updatedMachines);
        return {
          ...line,
          machines: updatedMachines,
          safetyScore,
          status: overallStatus,
        };
      });

      return { lines: updatedLines };
    }),

  /**
   * Xóa Metric khỏi Máy
   */
  deleteMetricFromMachine: (machineId, metricId) =>
    set((state) => {
      const updatedLines = state.lines.map((line) => {
        const updatedMachines = line.machines.map((machine) => {
          if (machine.id !== machineId) return machine;
          return {
            ...machine,
            metrics: machine.metrics.filter((m) => m.id !== metricId),
          };
        });

        const { safetyScore, overallStatus } = calculateLineSafetyMetrics(updatedMachines);
        return {
          ...line,
          machines: updatedMachines,
          safetyScore,
          status: overallStatus,
        };
      });

      return { lines: updatedLines };
    }),

  /**
   * Mô phỏng tín hiệu cảm biến thời gian thực
   */
  simulateTick: () =>
    set((state) => {
      if (!state.isRealtimeActive) return state;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const updatedLines = state.lines.map((line) => {
        const updatedMachines = line.machines.map((machine) => {
          let machineHasCritical = false;
          let machineHasWarning = false;

          const updatedMetrics = machine.metrics.map((metric) => {
            const maxDelta = Math.max(0.2, (metric.warningMax - metric.warningMin) * 0.03);
            const delta = (Math.random() - 0.5) * maxDelta;
            let nextValue = Number((metric.currentValue + delta).toFixed(2));

            if (metric.criticalMin >= 0 && nextValue < 0) nextValue = 0;

            const nextStatus = evaluateMetricStatus(
              nextValue,
              metric.warningMin,
              metric.warningMax,
              metric.criticalMin,
              metric.criticalMax
            );

            if (nextStatus === 'critical') machineHasCritical = true;
            else if (nextStatus === 'warning') machineHasWarning = true;

            const newHistory = [
              ...metric.history.slice(-19),
              { timestamp: timeStr, value: nextValue },
            ];

            return {
              ...metric,
              currentValue: nextValue,
              status: nextStatus,
              history: newHistory,
              lastUpdated: timeStr,
            };
          });

          const machineStatus: SystemStatus = machineHasCritical
            ? 'critical'
            : machineHasWarning
            ? 'warning'
            : 'normal';

          return {
            ...machine,
            status: machineStatus,
            metrics: updatedMetrics,
          };
        });

        const { safetyScore, overallStatus } = calculateLineSafetyMetrics(updatedMachines);

        return {
          ...line,
          machines: updatedMachines,
          safetyScore,
          status: overallStatus,
        };
      });

      return { lines: updatedLines };
    }),

  /**
   * Giả lập sự cố khẩn cấp ngẫu nhiên (Demo Feature)
   */
  triggerEmergencyDemo: () => {
    let triggeredInfo: {
      lineName: string;
      machineName: string;
      metricName: string;
      value: number;
      unit: string;
    } | null = null;

    set((state) => {
      if (state.lines.length === 0) return state;

      // Chọn ngẫu nhiên 1 dây chuyền và 1 máy
      const lineIdx = Math.floor(Math.random() * state.lines.length);
      const targetLine = state.lines[lineIdx];
      if (targetLine.machines.length === 0) return state;

      const machineIdx = Math.floor(Math.random() * targetLine.machines.length);
      const targetMachine = targetLine.machines[machineIdx];
      if (targetMachine.metrics.length === 0) return state;

      // Chọn 1 metric để đẩy vượt ngưỡng nguy hiểm
      const metricIdx = Math.floor(Math.random() * targetMachine.metrics.length);
      const targetMetric = targetMachine.metrics[metricIdx];

      // Đẩy giá trị vượt 20% trên criticalMax
      const spikeValue = Number((targetMetric.criticalMax + (targetMetric.criticalMax - targetMetric.warningMax) * 1.5 + 2).toFixed(1));
      
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      triggeredInfo = {
        lineName: targetLine.name,
        machineName: targetMachine.name,
        metricName: targetMetric.name,
        value: spikeValue,
        unit: targetMetric.unit,
      };

      // Đẩy sự cố mới vào useAlarmStore
      useAlarmStore.getState().triggerNewAlarm({
        lineId: targetLine.id,
        lineName: targetLine.name,
        machineId: targetMachine.id,
        machineName: targetMachine.name,
        metricId: targetMetric.id,
        metricName: targetMetric.name,
        severity: 'critical',
        triggeredValue: spikeValue,
        thresholdValue: targetMetric.criticalMax,
        unit: targetMetric.unit,
        message: `Sự cố giả lập: ${targetMetric.name} tăng vọt lên ${spikeValue} ${targetMetric.unit}, vượt ngưỡng nguy hiểm (${targetMetric.criticalMax} ${targetMetric.unit})!`,
      });

      apiClient.recordAudit(
        'TRIGGER_EMERGENCY',
        targetMachine.name,
        `Giả lập sự cố khẩn cấp: ${targetMetric.name} tăng vọt ${spikeValue} ${targetMetric.unit} tại ${targetLine.name}`
      );

      const updatedLines = state.lines.map((l, lIdx) => {
        if (lIdx !== lineIdx) return l;

        const updatedMachines = l.machines.map((m, mIdx) => {
          if (mIdx !== machineIdx) return m;

          const updatedMetrics = m.metrics.map((mtr, mtrIdx) => {
            if (mtrIdx !== metricIdx) return mtr;

            return {
              ...mtr,
              currentValue: spikeValue,
              status: 'critical' as SystemStatus,
              history: [
                ...mtr.history.slice(-19),
                { timestamp: timeStr, value: spikeValue },
              ],
              lastUpdated: timeStr,
            };
          });

          return {
            ...m,
            status: 'critical' as SystemStatus,
            metrics: updatedMetrics,
          };
        });

        const { safetyScore, overallStatus } = calculateLineSafetyMetrics(updatedMachines);
        return {
          ...l,
          machines: updatedMachines,
          safetyScore,
          status: overallStatus,
        };
      });

      return { lines: updatedLines };
    });

    return triggeredInfo;
  },
}));
