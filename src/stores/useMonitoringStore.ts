/**
 * @file useMonitoringStore.ts
 * @description Quản lý trạng thái cốt lõi của Mô hình Giám Sát 3 Tầng (Line -> Machine -> Metric),
 * đồng thời cung cấp luồng mô phỏng cập nhật dữ liệu cảm biến thời gian thực (Real-time IoT streaming),
 * trạm PLC kết nối (Modbus/TCP, OPC-UA) và Giả lập sự cố khẩn cấp.
 */

import { create } from 'zustand';
import { ProductionLine, MetricIndicator, SystemStatus, MachineComponent } from '../types/hierarchy';
import { PLCMappingConfig } from '../types/plc';
import { MetricMappingItem } from '../types/metric';
import { initialProductionLines } from '../utils/mockData';
import { evaluateMetricStatus, calculateLineSafetyMetrics, convertPLCRawToEngineering } from '../utils/plcConverter';
import { useAlarmStore } from './useAlarmStore';
import { apiClient } from '../services/api';
import { useHistoryStore } from './useHistoryStore';
import { resolveMetricNominalBaseline } from '../utils/demoBaselines';

export type NavigationTab = 'dashboard' | 'lines' | 'devices' | 'thresholds' | 'alarms' | 'history' | 'users' | 'audit' | 'qr' | 'settings' | 'metrics' | 'ai';
export type DashboardViewLevel = 'factory_layout' | 'line_overview' | 'machine_detail' | 'check_sheet';

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
  activeEmergencyMetricId: string | null;
  activeEmergencyMachineId: string | null;
  activeTab: NavigationTab;
  activeNavGroup: 'config' | 'monitoring';
  isRealtimeActive: boolean;

  // Điều hướng 4 màn hình giám sát chuyên sâu (Factory Layout -> Line -> Machine -> CheckSheet)
  dashboardViewLevel: DashboardViewLevel;
  setDashboardViewLevel: (level: DashboardViewLevel) => void;
  navigateToLine: (lineId: string) => void;
  navigateToMachine: (machineId: string, lineId?: string) => void;
  navigateToCheckSheet: (machineId: string, lineId?: string) => void;
  navigateBack: () => void;

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
  fetchMappings: () => Promise<void>;
  createMachine: (payload: {
    lineId: string;
    name: string;
    code: string;
    type?: string;
    status?: string;
    managementStatus?: 'active' | 'inactive';
    location?: string;
    description?: string;
    imageUrl?: string;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    installationDate?: string;
    ratedPower?: string;
    technicalNotes?: string;
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
      imageUrl?: string;
      manufacturer?: string;
      model?: string;
      serialNumber?: string;
      installationDate?: string;
      ratedPower?: string;
      technicalNotes?: string;
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

  // Khôi phục trạng thái chuẩn sau diễn tập giả lập sự cố
  resetEmergencyDemo: () => void;

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
  activeEmergencyMetricId: null,
  activeEmergencyMachineId: null,
  dashboardViewLevel: 'factory_layout',
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
      const [res, mappingsRes] = await Promise.all([
        apiClient.getMachines(lineId ? { lineId } : {}),
        apiClient.getMappings({}).catch((err: any) => {
          console.warn('[fetchMachines getMappings Warning]:', err.message);
          return { mappings: [] };
        }),
      ]);

      if (res && Array.isArray(res.machines) && res.machines.length > 0) {
        set((state) => {
          const allMappings = mappingsRes?.mappings || [];

          // Nhóm các mapping ACTIVE và monitoring_enabled theo machine_id
          const activeMappingsByMachine = new Map<string, MetricMappingItem[]>();
          for (const mapItem of allMappings) {
            const isMonitoringEnabled =
              mapItem.monitoring_enabled === 1 ||
              mapItem.monitoring_enabled === true ||
              (mapItem as any).monitoring_enabled === '1';
            const isActive = mapItem.status === 'ACTIVE' || !mapItem.status;

            if (isActive && isMonitoringEnabled && mapItem.machine_id) {
              if (!activeMappingsByMachine.has(mapItem.machine_id)) {
                activeMappingsByMachine.set(mapItem.machine_id, []);
              }
              activeMappingsByMachine.get(mapItem.machine_id)!.push(mapItem);
            }
          }

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

              // 1. Lấy danh sách mapping hợp lệ từ CSDL cho máy này (đối chiếu bằng machine_id chuẩn)
              const configuredMappings = activeMappingsByMachine.get(apiM.id) || [];
              const existingMetrics = existing?.metrics || [];
              const existingMetricsMap = new Map<string, MetricIndicator>();
              for (const em of existingMetrics) {
                if (em.id) existingMetricsMap.set(em.id, em);
                if (em.mappingCode) existingMetricsMap.set(em.mappingCode, em);
                if (em.mappingId) existingMetricsMap.set(em.mappingId, em);
                if (em.metricId) existingMetricsMap.set(em.metricId, em);
              }

              // 2. Chuyển đổi mapping thành danh sách MetricIndicator chuẩn hóa
              let resolvedMetrics: MetricIndicator[] = [];

              if (configuredMappings.length > 0) {
                resolvedMetrics = configuredMappings.map((mapItem) => {
                  const metricIdentifier = mapItem.mapping_code || mapItem.id;
                  const existingMetric =
                    existingMetricsMap.get(metricIdentifier) ||
                    existingMetricsMap.get(mapItem.id) ||
                    existingMetricsMap.get(mapItem.metric_id) ||
                    (mapItem.mapping_code ? existingMetricsMap.get(mapItem.mapping_code) : undefined);

                  // Hỗ trợ ngưỡng một phía: warningMin hoặc criticalMin có thể là null, KHÔNG tự chuyển null thành 0
                  const wMin = mapItem.warning_min != null ? Number(mapItem.warning_min) : (mapItem.thresholds?.warning_min != null ? Number(mapItem.thresholds.warning_min) : null);
                  const wMax = mapItem.warning_max != null ? Number(mapItem.warning_max) : (mapItem.thresholds?.warning_max != null ? Number(mapItem.thresholds.warning_max) : null);
                  const cMin = mapItem.critical_min != null ? Number(mapItem.critical_min) : (mapItem.thresholds?.critical_min != null ? Number(mapItem.thresholds.critical_min) : null);
                  const cMax = mapItem.critical_max != null ? Number(mapItem.critical_max) : (mapItem.thresholds?.critical_max != null ? Number(mapItem.thresholds.critical_max) : null);

                  const displayName = mapItem.channel_name || mapItem.metricName || mapItem.metricCode || metricIdentifier;
                  const unit = mapItem.unit || '';

                  // Baseline kỹ thuật chuẩn từ demoBaselines
                  const { nominal } = resolveMetricNominalBaseline({
                    id: metricIdentifier,
                    mappingCode: mapItem.mapping_code,
                    name: displayName,
                    unit,
                    warningMin: wMin ?? undefined,
                    warningMax: wMax ?? undefined,
                  });

                  if (existingMetric) {
                    // BẢO TOÀN DỮ LIỆU ĐANG HOẠT ĐỘNG:
                    // Giữ nguyên currentValue, history, trạng thái Emergency Demo nếu đang diễn ra
                    const curVal = existingMetric.currentValue != null && !isNaN(existingMetric.currentValue)
                      ? existingMetric.currentValue
                      : nominal;
                    const evalStatus = existingMetric.isEmergencySpike
                      ? ('critical' as SystemStatus)
                      : evaluateMetricStatus(curVal, wMin, wMax, cMin, cMax);

                    return {
                      ...existingMetric,
                      id: metricIdentifier,
                      name: displayName,
                      unit,
                      currentValue: curVal,
                      status: evalStatus,
                      warningMin: wMin,
                      warningMax: wMax,
                      criticalMin: cMin,
                      criticalMax: cMax,
                      dataSourceType: existingMetric.dataSourceType || (mapItem.data_source_type as any) || 'SIMULATED',
                      mappingCode: mapItem.mapping_code,
                      metricId: mapItem.metric_id,
                      mappingId: mapItem.id,
                      metricCode: mapItem.metricCode || mapItem.mapping_code,
                      machineId: apiM.id,
                      nominalValue: nominal,
                    };
                  }

                  // Tạo mới metric trong DEMO MODE với Baseline kỹ thuật an toàn
                  const initialStatus = evaluateMetricStatus(nominal, wMin, wMax, cMin, cMax);
                  const nowStr = new Date().toTimeString().slice(0, 8);

                  return {
                    id: metricIdentifier,
                    name: displayName,
                    unit,
                    currentValue: nominal,
                    status: initialStatus,
                    warningMin: wMin,
                    warningMax: wMax,
                    criticalMin: cMin,
                    criticalMax: cMax,
                    history: [
                      { timestamp: nowStr, value: nominal },
                    ],
                    lastUpdated: 'Vừa xong',
                    dataSourceType: (mapItem.data_source_type as any) || 'SIMULATED',
                    isLive: false,
                    mappingCode: mapItem.mapping_code,
                    metricId: mapItem.metric_id,
                    mappingId: mapItem.id,
                    metricCode: mapItem.metricCode || mapItem.mapping_code,
                    machineId: apiM.id,
                    nominalValue: nominal,
                  };
                });
              } else if (existing?.metrics && existing.metrics.length > 0 && apiM.status !== 'no_data') {
                // Chỉ bảo toàn metrics mock có sẵn nếu máy KHÔNG phải là no_data từ API
                resolvedMetrics = existing.metrics;
              } else {
                // Không tự tạo mapping cho máy chưa được cấu hình hoặc máy no_data
                resolvedMetrics = [];
              }

              const actualMappingCount = configuredMappings.length > 0 ? configuredMappings.length : (apiM.mappingCount ?? 0);

              if (existing) {
                return {
                  ...existing,
                  name: apiM.name,
                  code: apiM.code || apiM.id,
                  type: apiM.type,
                  status: (apiM.status ? (apiM.status.toLowerCase() as SystemStatus) : (existing.status || 'no_data')),
                  managementStatus: (apiM as any).managementStatus || existing.managementStatus || 'active',
                  location: apiM.location || existing.location || `Xưởng ${line.name}`,
                  description: apiM.description !== undefined ? apiM.description : existing.description,
                  healthScore: apiM.healthScore !== undefined ? apiM.healthScore : null,
                  uptimeHours: apiM.uptimeHours !== undefined ? apiM.uptimeHours : (existing.uptimeHours ?? 0),
                  qrCodeUrl: apiM.qrCodeUrl ?? existing.qrCodeUrl,
                  mappingCount: actualMappingCount,
                  metrics: resolvedMetrics,
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
                metrics: resolvedMetrics,
                mappingCount: actualMappingCount,
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

  fetchMappings: async () => {
    // Gọi fetchMachines để đồng bộ lại toàn bộ máy và mappings
    await get().fetchMachines();
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
    dashboardViewLevel: tab === 'dashboard' ? 'factory_layout' : state.dashboardViewLevel,
  })),

  setDashboardViewLevel: (level) => set({ dashboardViewLevel: level }),

  navigateToLine: (lineId) => set({
    selectedLineId: lineId,
    dashboardViewLevel: 'line_overview',
    activeTab: 'dashboard',
    activeNavGroup: 'monitoring',
  }),

  navigateToMachine: (machineId, lineId) => set((state) => ({
    selectedMachineId: machineId,
    selectedLineId: lineId || state.selectedLineId,
    dashboardViewLevel: 'machine_detail',
    activeTab: 'dashboard',
    activeNavGroup: 'monitoring',
  })),

  navigateToCheckSheet: (machineId, lineId) => set((state) => ({
    selectedMachineId: machineId,
    selectedLineId: lineId || state.selectedLineId,
    dashboardViewLevel: 'check_sheet',
    activeTab: 'dashboard',
    activeNavGroup: 'monitoring',
  })),

  navigateBack: () => set((state) => {
    if (state.dashboardViewLevel === 'check_sheet') {
      return { dashboardViewLevel: 'machine_detail' };
    }
    if (state.dashboardViewLevel === 'machine_detail') {
      return { dashboardViewLevel: state.selectedLineId ? 'line_overview' : 'factory_layout' };
    }
    if (state.dashboardViewLevel === 'line_overview') {
      return { dashboardViewLevel: 'factory_layout', selectedLineId: null };
    }
    return { dashboardViewLevel: 'factory_layout' };
  }),
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
   * Mô phỏng tín hiệu cảm biến thời gian thực sử dụng thuật toán hồi quy trung tâm (Mean Reversion)
   * Giữ dữ liệu dao động ổn định quanh giá trị danh định chuẩn (Baseline) và tách biệt hoàn toàn vòng đời Emergency Demo
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
            const isEmergencyTarget =
              metric.isEmergencySpike === true ||
              metric.id === state.activeEmergencyMetricId;

            // 1. CHẾ ĐỘ EMERGENCY DEMO: Duy trì giá trị trong vùng nguy hiểm cho đến khi người dùng bấm "Khôi phục Sự cố"
            if (isEmergencyTarget) {
              const { nominal } = resolveMetricNominalBaseline(metric);
              const emergencyJitter = (Math.random() - 0.5) * 0.4;
              let nextValue = Number((metric.currentValue + emergencyJitter).toFixed(2));
              const critMax = metric.criticalMax != null ? Number(metric.criticalMax) : (metric.warningMax != null ? Number(metric.warningMax) * 1.2 : nominal * 1.5);
              const minCritical = critMax + 0.5;
              if (nextValue < minCritical) nextValue = minCritical;

              machineHasCritical = true;

              const newHistory = [
                ...metric.history.slice(-19),
                { timestamp: timeStr, value: nextValue },
              ];

              return {
                ...metric,
                isEmergencySpike: true,
                currentValue: nextValue,
                status: 'critical' as SystemStatus,
                history: newHistory,
                lastUpdated: timeStr,
              };
            }

            // 2. CHẾ ĐỘ NORMAL DEMO: Thuật toán Ornstein-Uhlenbeck Mean Reversion kéo về Baseline danh định kỹ thuật
            const { nominal } = resolveMetricNominalBaseline(metric);
            const wMin = metric.warningMin != null ? Number(metric.warningMin) : 0;
            const wMax = metric.warningMax != null ? Number(metric.warningMax) : (nominal > 0 ? nominal * 2 : 100);
            const span = Math.max(1, wMax - wMin);

            // Lực đàn hồi kéo về tâm danh định an toàn (theta = 0.12)
            const theta = 0.12;
            const pull = (nominal - metric.currentValue) * theta;

            // Dao động tự nhiên ngẫu nhiên nhẹ (1.5% biên độ an toàn)
            const jitterRange = Math.max(0.08, span * 0.015);
            const noise = (Math.random() - 0.5) * jitterRange;
            let nextValue = Number((metric.currentValue + pull + noise).toFixed(2));

            // RÀNG BUỘC BẢO VỆ AN TOÀN TUYỆT ĐỐI CHO NORMAL DEMO (Mục 4.2):
            // Telemetry dao động nhẹ quanh nominal, có khoảng đệm an toàn 5% cách xa ngưỡng warning
            // Đảm bảo không bao giờ tự phát sinh cảnh báo giả hoặc trôi dạt do random noise
            const safeMargin = Math.max(0.05, span * 0.05);
            if (metric.warningMin != null) {
              const minSafe = Number(metric.warningMin) + safeMargin;
              if (nextValue < minSafe) nextValue = minSafe;
            }
            if (metric.warningMax != null) {
              const maxSafe = Number(metric.warningMax) - safeMargin;
              if (nextValue > maxSafe) nextValue = maxSafe;
            }

            if (metric.criticalMin != null && Number(metric.criticalMin) >= 0 && nextValue < 0) nextValue = 0;

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
              isEmergencySpike: false,
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
            : (machine.status === 'no_data' || machine.status === 'offline' || machine.status === 'unknown')
            ? machine.status
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
   * Khôi phục toàn bộ hệ thống về trạng thái chuẩn bình thường sau khi diễn tập sự cố
   * CHỈ giải quyết các cảnh báo Demo (ALM-DEMO), tuyệt đối không xóa lịch sử hay cảnh báo thật
   */
  resetEmergencyDemo: () => {
    useAlarmStore.getState().resolveDemoAlarms('Đã khôi phục trạng thái chuẩn sau diễn tập Demo.');
    set((state) => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const updatedLines = state.lines.map((l) => {
        const updatedMachines = l.machines.map((m) => {
          const updatedMetrics = m.metrics.map((mtr) => {
            const isTarget = mtr.isEmergencySpike || mtr.id === state.activeEmergencyMetricId || mtr.status !== 'normal';
            if (!isTarget) return mtr;

            const { nominal } = resolveMetricNominalBaseline(mtr);
            return {
              ...mtr,
              isEmergencySpike: false,
              currentValue: nominal,
              status: 'normal' as SystemStatus,
              history: [
                ...mtr.history.slice(-19),
                { timestamp: timeStr, value: nominal },
              ],
              lastUpdated: timeStr,
            };
          });

          return {
            ...m,
            status: (m.status === 'no_data' || m.status === 'offline' || m.status === 'unknown') ? m.status : ('normal' as SystemStatus),
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

      return { lines: updatedLines, activeEmergencyMetricId: null, activeEmergencyMachineId: null };
    });
  },

  /**
   * Giả lập sự cố khẩn cấp ngẫu nhiên (Demo Feature)
   * Duy trì trạng thái nguy hiểm liên tục cho đến khi bấm Khôi phục Sự cố
   * Đảm bảo tính nhất quán: Mỗi lần kích hoạt chỉ tác động đúng DUY NHẤT 1 máy mục tiêu (Single target)
   */
  triggerEmergencyDemo: () => {
    let triggeredInfo: {
      lineName: string;
      machineName: string;
      metricName: string;
      value: number;
      unit: string;
    } | null = null;

    // Dọn dẹp cảnh báo demo cũ trước khi tạo mới để không bị cộng dồn
    useAlarmStore.getState().resolveDemoAlarms('Tự động hoàn tất kịch bản cũ trước khi bắt đầu kịch bản mới.');

    set((state) => {
      if (state.lines.length === 0) return state;

      // 1. Sanitize: Đưa toàn bộ các máy đang bị spike trước đó về bình thường trước khi áp dụng sự cố mới
      const baseLines = state.lines.map((l) => ({
        ...l,
        machines: l.machines.map((m) => {
          let hadSpike = false;
          const cleanedMetrics = m.metrics.map((mtr) => {
            if (mtr.isEmergencySpike) {
              hadSpike = true;
              const { nominal } = resolveMetricNominalBaseline(mtr);
              return {
                ...mtr,
                isEmergencySpike: false,
                currentValue: nominal,
                status: 'normal' as SystemStatus,
              };
            }
            return mtr;
          });
          return {
            ...m,
            status: hadSpike ? ((m.status === 'no_data' || m.status === 'offline') ? m.status : ('normal' as SystemStatus)) : m.status,
            metrics: cleanedMetrics,
          };
        }),
      }));

      // 2. Tìm dây chuyền và máy mục tiêu
      let lineIdx = baseLines.findIndex((l) => l.id === state.selectedLineId || l.code === state.selectedLineId);
      if (lineIdx === -1) lineIdx = 0;
      const targetLine = baseLines[lineIdx];
      if (targetLine.machines.length === 0) return { lines: baseLines };

      // Tìm máy có metrics hợp lệ để giả lập sự cố
      const validMachines = targetLine.machines.filter((m) => m.metrics && m.metrics.length > 0 && m.status !== 'no_data');
      if (validMachines.length === 0) return { lines: baseLines };

      let targetMachine: MachineComponent;
      if (state.selectedMachineId) {
        const found = targetLine.machines.find((m) => m.id === state.selectedMachineId || m.code === state.selectedMachineId);
        targetMachine = found && found.metrics.length > 0 ? found : validMachines[0];
      } else {
        targetMachine = validMachines[0];
      }

      const machineIdx = targetLine.machines.findIndex((m) => m.id === targetMachine.id);
      if (machineIdx === -1) return { lines: baseLines };

      let metricIdx = targetMachine.metrics.findIndex((mtr) => mtr.id === state.selectedMetricId);
      if (metricIdx === -1) {
        metricIdx = 0;
      }
      const targetMetric = targetMachine.metrics[metricIdx];

      // Đẩy giá trị vượt 20% trên criticalMax
      const crit = targetMetric.criticalMax != null ? Number(targetMetric.criticalMax) : (targetMetric.warningMax != null ? Number(targetMetric.warningMax) * 1.2 : 100);
      const warn = targetMetric.warningMax != null ? Number(targetMetric.warningMax) : crit * 0.8;
      const spikeValue = Number((crit + (crit - warn) * 1.5 + 2).toFixed(1));
      
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      triggeredInfo = {
        lineName: targetLine.name,
        machineName: targetMachine.name,
        metricName: targetMetric.name,
        value: spikeValue,
        unit: targetMetric.unit,
      };

      // Đẩy sự cố mới vào useAlarmStore với cờ isDemo = true và nguồn 'DEMO'
      useAlarmStore.getState().triggerNewAlarm({
        lineId: targetLine.id,
        lineName: targetLine.name,
        machineId: targetMachine.id,
        machineName: targetMachine.name,
        metricId: targetMetric.id,
        metricName: targetMetric.name,
        severity: 'critical',
        triggeredValue: spikeValue,
        thresholdValue: crit,
        unit: targetMetric.unit,
        message: `Sự cố giả lập: ${targetMetric.name} tăng vọt lên ${spikeValue} ${targetMetric.unit}, vượt ngưỡng nguy hiểm (${crit} ${targetMetric.unit})!`,
        isDemo: true,
        source: 'DEMO',
      });

      apiClient.recordAudit(
        'TRIGGER_EMERGENCY',
        targetMachine.name,
        `Giả lập sự cố khẩn cấp: ${targetMetric.name} tăng vọt ${spikeValue} ${targetMetric.unit} tại ${targetLine.name}`
      );

      const updatedLines = baseLines.map((l, lIdx) => {
        if (lIdx !== lineIdx) return l;

        const updatedMachines = l.machines.map((m, mIdx) => {
          if (mIdx !== machineIdx) return m;

          const updatedMetrics = m.metrics.map((mtr, mtrIdx) => {
            if (mtrIdx !== metricIdx) return mtr;

            return {
              ...mtr,
              isEmergencySpike: true,
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

      return {
        lines: updatedLines,
        activeEmergencyMetricId: targetMetric.id,
        activeEmergencyMachineId: targetMachine.id,
      };
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
            const matchesId = metric.id === packet.metricId || metric.id === packet.mappingCode;
            const matchesCode = metric.mappingCode && (metric.mappingCode === packet.metricId || metric.mappingCode === packet.mappingCode);
            const matchesMappingId = metric.mappingId && (metric.mappingId === packet.mappingId || metric.mappingId === packet.metricId);
            if (!matchesId && !matchesCode && !matchesMappingId) return metric;
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
