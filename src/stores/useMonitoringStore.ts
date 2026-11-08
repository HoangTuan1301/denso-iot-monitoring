/**
 * @file useMonitoringStore.ts
 * @description Quản lý trạng thái cốt lõi của Mô hình Giám Sát 3 Tầng (Line -> Machine -> Metric),
 * đồng thời cung cấp luồng mô phỏng cập nhật dữ liệu cảm biến thời gian thực (Real-time IoT streaming),
 * trạm PLC kết nối (Modbus/TCP, OPC-UA) và Giả lập sự cố khẩn cấp.
 */

import { create } from 'zustand';
import { ProductionLine, MetricIndicator, SystemStatus, MachineComponent } from '../types/hierarchy';
import { PLCMappingConfig } from '../types/plc';
import { initialProductionLines } from '../utils/mockData';
import { evaluateMetricStatus, calculateLineSafetyMetrics, convertPLCRawToEngineering } from '../utils/plcConverter';
import { useAlarmStore } from './useAlarmStore';
import { apiClient } from '../services/api';
import { useHistoryStore } from './useHistoryStore';

export type NavigationTab = 'dashboard' | 'lines' | 'devices' | 'thresholds' | 'alarms' | 'history' | 'users' | 'audit' | 'qr' | 'settings' | 'metrics';

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
  isLoadingLines: boolean;
  linesError: string | null;
  isLoadingMachines: boolean;
  machinesError: string | null;
  isLoadingTelemetry: boolean;
  telemetryError: string | null;
  ingestionOverview: {
    enabled: boolean;
    status: 'RUNNING' | 'PAUSED' | 'DISABLED';
    watchDirectory: string | null;
    activeProfiles: number;
    files: any[];
    stats: Record<string, number> | null;
  } | null;

  selectedLineId: string | null;
  selectedMachineId: string | null;
  selectedMetricId: string | null;
  activeTab: NavigationTab;
  activeNavGroup: 'config' | 'monitoring';
  isRealtimeActive: boolean;

  // Quản lý trạm PLC
  plcStations: PLCStation[];
  togglePLCStationConnection: (stationId: string) => void;
  setPLCStationPollingRate: (stationId: string, rateMs: number) => void;

  // Điều hướng phân tầng
  setActiveTab: (tab: NavigationTab, group?: 'config' | 'monitoring') => void;
  setSelectedLineId: (lineId: string | null) => void;
  setSelectedMachineId: (machineId: string | null) => void;
  setSelectedMetricId: (metricId: string | null) => void;
  toggleRealtime: (enabled?: boolean) => void;

  // Tải dữ liệu từ Backend REST API (Bước 2F-1 & Kiến trúc PLC theo Dây chuyền)
  fetchLines: () => Promise<void>;
  fetchMachines: (lineId?: string) => Promise<void>;
  createMachine: (payload: {
    lineId: string;
    name: string;
    code: string;
    type?: string;
    status?: string;
    managementStatus?: 'active' | 'inactive';
    location?: string;
    description?: string;
  }) => Promise<any>;
  updateMachine: (
    id: string,
    payload: {
      name?: string;
      type?: string;
      location?: string;
      description?: string;
      managementStatus?: 'active' | 'inactive';
      status?: string;
    }
  ) => Promise<any>;
  assignLinePLC: (
    lineId: string,
    plcId: string,
    options?: { confirmDestReplace?: boolean; confirmSourceTransfer?: boolean }
  ) => Promise<any>;
  unassignLinePLC: (lineId: string) => Promise<any>;
  assignMachinePLC: (
    machineId: string,
    plcId: string,
    options?: { confirmDestReplace?: boolean; confirmSourceTransfer?: boolean }
  ) => Promise<any>;
  unassignMachinePLC: (machineId: string) => Promise<any>;

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

  // Dữ liệu đo lường thực tế từ Backend & WebSocket (Giai đoạn 2F-3)
  fetchLatestTelemetry: (params?: { machineId?: string; lineId?: string }) => Promise<void>;
  fetchIngestionOverview: () => Promise<void>;
  handleLiveTelemetryPacket: (packet: any) => void;
  handleHistoricalBatchIngested: (batch: any) => void;
}

// Bộ đệm LRU chống nhận trùng eventId khi WebSocket reconnect (Vấn đề 2)
const processedPacketIds = new Set<string>();

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  lines: initialProductionLines,
  isLoadingLines: false,
  linesError: null,
  isLoadingMachines: false,
  machinesError: null,
  isLoadingTelemetry: false,
  telemetryError: null,
  ingestionOverview: null,
  selectedLineId: null,
  selectedMachineId: null,
  selectedMetricId: null,
  activeTab: 'dashboard',
  activeNavGroup: 'monitoring',
  isRealtimeActive: true,
  plcStations: initialPLCStations,

  fetchLines: async () => {
    set({ isLoadingLines: true, linesError: null });
    try {
      const res = await apiClient.getLines();
      if (res && Array.isArray(res.lines) && res.lines.length > 0) {
        set((state) => {
          const updatedLines = res.lines.map((apiLine) => {
            const existingLine = state.lines.find((l) => l.id === apiLine.id);
            return {
              ...apiLine,
              machines: existingLine ? existingLine.machines : [],
              safetyScore: Number(apiLine.safetyScore) || (existingLine?.safetyScore ?? 100),
              status: apiLine.status || (existingLine?.status ?? 'normal'),
            };
          });
          return { lines: updatedLines, isLoadingLines: false, linesError: null };
        });
      } else {
        set({ isLoadingLines: false });
      }
    } catch (err: any) {
      console.warn('[fetchLines Error]:', err.message);
      set({ isLoadingLines: false, linesError: err.message || 'Không thể nạp danh sách dây chuyền' });
    }
  },

  fetchMachines: async (lineId?: string) => {
    set({ isLoadingMachines: true, machinesError: null });
    try {
      const res = await apiClient.getMachines(lineId ? { lineId } : {});
      if (res && Array.isArray(res.machines) && res.machines.length > 0) {
        set((state) => {
          const updatedLines = state.lines.map((line) => {
            if (lineId && line.id !== lineId) return line;

            const machinesForLine = res.machines.filter((m) => m.lineId === line.id);
            if (machinesForLine.length === 0) return line;

            const existingMachinesMap = new Map(line.machines.map((m) => [m.id, m]));

            const mergedMachines: MachineComponent[] = machinesForLine.map((apiM) => {
              const existing = existingMachinesMap.get(apiM.id);
              const plcId = apiM.plc?.id || apiM.plcId || null;
              const plcName = apiM.plc?.name || apiM.plcName || plcId || '';
              const plcProtocol = apiM.plc?.protocol || apiM.plcProtocol || 'Modbus/TCP';
              const plcStatus = apiM.plc?.status || apiM.plcStatus || 'UNKNOWN';
              const plcEnabled = apiM.plc ? Boolean(apiM.plc.enabled) : Boolean((apiM as any).plcEnabled);
              const plcIsDemo = apiM.plc ? Boolean(apiM.plc.isDemo) : Boolean((apiM as any).plcIsDemo);

              const plcObj = plcId ? {
                id: plcId,
                name: String(plcName),
                protocol: plcProtocol,
                status: plcStatus,
                enabled: plcEnabled,
                isDemo: plcIsDemo,
              } : null;

              if (existing) {
                return {
                  ...existing,
                  name: apiM.name,
                  code: apiM.code || apiM.id,
                  type: apiM.type,
                  status: ((apiM.status ? apiM.status.toLowerCase() : existing.status) || 'no_data') as SystemStatus,
                  managementStatus: (apiM as any).managementStatus || existing.managementStatus || 'active',
                  location: apiM.location || existing.location || `Xưởng ${line.name}`,
                  description: apiM.description !== undefined ? apiM.description : existing.description,
                  healthScore: apiM.healthScore ?? existing.healthScore,
                  uptimeHours: apiM.uptimeHours ?? existing.uptimeHours,
                  qrCodeUrl: apiM.qrCodeUrl ?? existing.qrCodeUrl,
                  mappingCount: apiM.mappingCount ?? existing.mappingCount,
                  plcId: plcId || null,
                  plcName: plcName || null,
                  plcProtocol: plcProtocol || null,
                  plcStatus: plcStatus || null,
                  plc: plcObj,
                };
              }

              return {
                id: apiM.id,
                lineId: apiM.lineId,
                lineName: line.name,
                name: apiM.name,
                code: apiM.code || apiM.id,
                type: apiM.type,
                status: (apiM.status ? apiM.status.toLowerCase() : 'no_data') as SystemStatus,
                managementStatus: (apiM as any).managementStatus || 'active',
                location: apiM.location || `Xưởng ${line.name}`,
                description: apiM.description || null,
                healthScore: apiM.healthScore ?? null,
                uptimeHours: apiM.uptimeHours ?? 0,
                qrCodeUrl: apiM.qrCodeUrl || '',
                metrics: [],
                mappingCount: apiM.mappingCount ?? 0,
                plcId: plcId || null,
                plcName: plcName || null,
                plcProtocol: plcProtocol || null,
                plcStatus: plcStatus || null,
                plc: plcObj,
              };
            });

            const { safetyScore, overallStatus } = calculateLineSafetyMetrics(mergedMachines);

            return {
              ...line,
              machines: mergedMachines,
              safetyScore: line.safetyScore ?? safetyScore,
              status: line.status ?? overallStatus,
            };
          });

          return { lines: updatedLines, isLoadingMachines: false, machinesError: null };
        });
      } else {
        set({ isLoadingMachines: false });
      }
    } catch (err: any) {
      console.warn('[fetchMachines Error]:', err.message);
      set({ isLoadingMachines: false, machinesError: err.message || 'Không thể nạp danh sách máy' });
    }
  },

  assignLinePLC: async (lineId, plcId, options = {}) => {
    const res = await apiClient.assignLinePLC(lineId, {
      plcId,
      confirmDestReplace: options.confirmDestReplace,
      confirmSourceTransfer: options.confirmSourceTransfer,
    });
    await Promise.all([get().fetchLines(), get().fetchMachines()]);
    return res;
  },

  unassignLinePLC: async (lineId) => {
    const res = await apiClient.unassignLinePLC(lineId);
    await Promise.all([get().fetchLines(), get().fetchMachines()]);
    return res;
  },

  assignMachinePLC: async (machineId, plcId, options = {}) => {
    const res = await apiClient.assignPLC(machineId, {
      plcId,
      confirmDestReplace: options.confirmDestReplace,
      confirmSourceTransfer: options.confirmSourceTransfer,
    });
    await get().fetchMachines();
    return res;
  },

  unassignMachinePLC: async (machineId) => {
    const res = await apiClient.unassignPLC(machineId);
    await get().fetchMachines();
    return res;
  },

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

  setActiveTab: (tab, group) => set((state) => ({
    activeTab: tab,
    activeNavGroup: group || (['dashboard', 'alarms', 'history', 'devices'].includes(tab) ? 'monitoring' : (tab === 'lines' ? state.activeNavGroup : 'config')),
  })),
  createMachine: async (payload) => {
    const res = await apiClient.createMachine(payload);
    await Promise.all([get().fetchLines(), get().fetchMachines()]);
    if (payload.lineId) {
      set({ selectedLineId: payload.lineId });
    }
    return res;
  },
  updateMachine: async (id, payload) => {
    const res = await apiClient.updateMachine(id, payload);
    await Promise.all([get().fetchLines(), get().fetchMachines()]);
    return res;
  },
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

  // =========================================================================
  // DỮ LIỆU ĐO LƯỜNG THỰC TẾ & FILE INGESTION (GIAI ĐOẠN 2F-3)
  // =========================================================================

  fetchLatestTelemetry: async (params) => {
    set({ isLoadingTelemetry: true, telemetryError: null });
    try {
      const res = await apiClient.getLatestTelemetry(params);
      if (res && res.success && Array.isArray(res.data)) {
        set((state) => {
          // Gom nhóm theo machineId
          const dataByMachine = new Map<string, any[]>();
          for (const item of res.data) {
            if (!dataByMachine.has(item.machineId)) {
              dataByMachine.set(item.machineId, []);
            }
            dataByMachine.get(item.machineId)!.push(item);
          }

          const updatedLines: ProductionLine[] = state.lines.map((line) => {
            const updatedMachines: MachineComponent[] = line.machines.map((machine) => {
              const machineTelemetry = dataByMachine.get(machine.id);
              if (!machineTelemetry || machineTelemetry.length === 0) {
                return machine;
              }

              const existingMetricsMap = new Map(machine.metrics.map((m) => [m.id, m]));
              let maxMeasuredAt = machine.lastMeasuredAt;
              let hasLive = false;

              const mergedMetrics: MetricIndicator[] = machineTelemetry.map((tItem) => {
                const metricId = tItem.metricId;
                const existing = existingMetricsMap.get(metricId);

                const measuredDate = new Date(tItem.measuredAt);
                const timeStr = measuredDate.toTimeString().slice(0, 8);
                const fullDateTimeStr = `${tItem.measuredAt.slice(0, 10)} ${timeStr}`;

                if (!maxMeasuredAt || tItem.measuredAt > maxMeasuredAt) {
                  maxMeasuredAt = tItem.measuredAt;
                }
                if (tItem.isLive) hasLive = true;

                const newHistory = existing
                  ? [...existing.history.slice(-19), { timestamp: timeStr, value: tItem.value }]
                  : [{ timestamp: timeStr, value: tItem.value }];

                const wMin = tItem.thresholds?.warningMin ?? (existing?.warningMin ?? 0);
                const wMax = tItem.thresholds?.warningMax ?? (existing?.warningMax ?? 100);
                const cMin = tItem.thresholds?.criticalMin ?? (existing?.criticalMin ?? 0);
                const cMax = tItem.thresholds?.criticalMax ?? (existing?.criticalMax ?? 100);

                return {
                  id: metricId,
                  name: tItem.metricName || metricId,
                  unit: tItem.unit || 'raw',
                  currentValue: tItem.value,
                  status: (tItem.status as SystemStatus) || 'normal',
                  warningMin: wMin,
                  warningMax: wMax,
                  criticalMin: cMin,
                  criticalMax: cMax,
                  history: newHistory,
                  lastUpdated: timeStr,
                  measuredAt: fullDateTimeStr,
                  quality: (tItem.quality || 'GOOD') as 'GOOD' | 'UNCERTAIN' | 'BAD',
                  dataSourceType: (tItem.dataSourceType || 'FILE_INGEST') as 'FILE_INGEST' | 'PLC_DIRECT' | 'SIMULATED',
                  isLive: Boolean(tItem.isLive),
                  isStale: Boolean(tItem.isStale),
                  ageSeconds: tItem.ageSeconds,
                  fileTagName: tItem.fileTagName,
                  mappingCode: tItem.metricId,
                };
              });

              // Bổ sung các metrics hiện có không nằm trong danh sách trả về
              for (const m of machine.metrics) {
                if (!mergedMetrics.some((mm) => mm.id === m.id)) {
                  mergedMetrics.push(m);
                }
              }

              const { overallStatus } = calculateLineSafetyMetrics([{ ...machine, metrics: mergedMetrics }]);

              return {
                ...machine,
                metrics: mergedMetrics,
                status: overallStatus,
                lastMeasuredAt: maxMeasuredAt,
                streamStatus: (hasLive ? 'STREAMING' : 'IDLE') as 'STREAMING' | 'IDLE' | 'STALE' | 'UNKNOWN',
                dataSourceType: 'FILE_INGEST' as const,
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

          return { lines: updatedLines, isLoadingTelemetry: false, telemetryError: null };
        });
      } else {
        set({ isLoadingTelemetry: false });
      }
    } catch (err: any) {
      console.warn('[fetchLatestTelemetry Error]:', err.message);
      set({ isLoadingTelemetry: false, telemetryError: err.message });
    }
  },

  handleLiveTelemetryPacket: (packet) => {
    if (!packet || !packet.metricId || !packet.machineId) return;

    // Chống nhận trùng eventId khi reconnect (Idempotency)
    if (packet.id) {
      if (processedPacketIds.has(packet.id)) return;
      processedPacketIds.add(packet.id);
      if (processedPacketIds.size > 2000) {
        const first = processedPacketIds.values().next().value;
        if (first) processedPacketIds.delete(first);
      }
    }

    set((state) => {
      const now = new Date(packet.timestamp || Date.now());
      const timeStr = now.toTimeString().slice(0, 8);
      const fullDateTimeStr = `${packet.timestamp?.slice(0, 10) || ''} ${timeStr}`.trim();

      const updatedLines: ProductionLine[] = state.lines.map((line) => {
        if (packet.lineId && line.id !== packet.lineId) {
          if (!line.machines.some((m) => m.id === packet.machineId)) return line;
        }

        const updatedMachines: MachineComponent[] = line.machines.map((machine) => {
          if (machine.id !== packet.machineId) return machine;

          let foundMetric = false;
          const updatedMetrics: MetricIndicator[] = machine.metrics.map((metric) => {
            if (metric.id !== packet.metricId && metric.id !== packet.mappingCode) return metric;
            foundMetric = true;

            const newHistory = [
              ...metric.history.slice(-19),
              { timestamp: timeStr, value: Number(packet.value) },
            ];

            return {
              ...metric,
              currentValue: Number(packet.value),
              status: (packet.status as SystemStatus) || metric.status,
              history: newHistory,
              lastUpdated: timeStr,
              measuredAt: fullDateTimeStr,
              quality: (packet.quality || 'GOOD') as 'GOOD' | 'UNCERTAIN' | 'BAD',
              dataSourceType: (packet.subSource === 'PLC_DIRECT' ? 'PLC_DIRECT' : 'FILE_INGEST') as 'FILE_INGEST' | 'PLC_DIRECT' | 'SIMULATED',
              isLive: Boolean(packet.isLive),
            };
          });

          if (!foundMetric) {
            updatedMetrics.push({
              id: packet.metricId,
              name: packet.metricName || packet.metricId,
              unit: packet.unit || 'raw',
              currentValue: Number(packet.value),
              status: (packet.status as SystemStatus) || 'normal',
              warningMin: 0,
              warningMax: 100,
              criticalMin: 0,
              criticalMax: 100,
              history: [{ timestamp: timeStr, value: Number(packet.value) }],
              lastUpdated: timeStr,
              measuredAt: fullDateTimeStr,
              quality: (packet.quality || 'GOOD') as 'GOOD' | 'UNCERTAIN' | 'BAD',
              dataSourceType: (packet.subSource === 'PLC_DIRECT' ? 'PLC_DIRECT' : 'FILE_INGEST') as 'FILE_INGEST' | 'PLC_DIRECT' | 'SIMULATED',
              isLive: Boolean(packet.isLive),
              mappingCode: packet.mappingCode || packet.metricId,
            });
          }

          const { overallStatus } = calculateLineSafetyMetrics([{ ...machine, metrics: updatedMetrics }]);

          return {
            ...machine,
            metrics: updatedMetrics,
            status: overallStatus,
            lastMeasuredAt: packet.timestamp,
            streamStatus: (packet.fileStreamStatus === 'STREAMING' ? 'STREAMING' : 'IDLE') as 'STREAMING' | 'IDLE' | 'STALE' | 'UNKNOWN',
            dataSourceType: 'FILE_INGEST' as const,
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
    });
  },

  handleHistoricalBatchIngested: (batch) => {
    if (!batch) return;
    set((state) => {
      const updatedLines = state.lines.map((line) => {
        if (!line.machines.some((m) => m.id === batch.machineId)) return line;
        const updatedMachines = line.machines.map((m) => {
          if (m.id !== batch.machineId) return m;
          return {
            ...m,
            lastFileIngestedAt: batch.ingestedAt,
            lastMeasuredAt: batch.latestMeasuredAt || m.lastMeasuredAt,
          };
        });
        return { ...line, machines: updatedMachines };
      });
      return { lines: updatedLines };
    });

    // Tự động làm mới store lịch sử để biểu đồ cập nhật
    try {
      useHistoryStore.getState().fetchLogs();
    } catch {}
  },

  fetchIngestionOverview: async () => {
    try {
      const [statusRes, filesRes] = await Promise.all([
        apiClient.getIngestionStatus().catch(() => null),
        apiClient.getIngestionFiles({ limit: 10 }).catch(() => null),
      ]);

      if (statusRes) {
        set({
          ingestionOverview: {
            enabled: Boolean(statusRes.enabled),
            status: statusRes.status || 'DISABLED',
            watchDirectory: statusRes.watchDirectory || null,
            activeProfiles: statusRes.activeProfiles || 0,
            files: filesRes?.files || [],
            stats: statusRes.stats || null,
          },
        });
      }
    } catch (err: any) {
      console.warn('[fetchIngestionOverview Error]:', err.message);
    }
  },
}));
