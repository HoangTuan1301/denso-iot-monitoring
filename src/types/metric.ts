/**
 * @file metric.ts
 * @description Định nghĩa các kiểu dữ liệu cho Danh mục Metric chuẩn (Metric Catalog)
 * trong Hệ thống Giám Sát Nhà Máy DENSO KaiLink.
 */

export type MetricCategory =
  | 'Temperature'
  | 'Pressure'
  | 'Vibration'
  | 'Current'
  | 'Voltage'
  | 'Speed'
  | 'Flow'
  | 'Level'
  | 'Other';

export type MetricDataType = 'FLOAT' | 'INTEGER' | 'BOOLEAN' | 'STRING' | 'ENUM';

export type MetricStatus = 'ACTIVE' | 'INACTIVE';

export interface MetricCatalogItem {
  id: string;
  code: string;
  name: string;
  category: MetricCategory;
  unit: string;
  dataType: MetricDataType;
  validMin: number | null;
  validMax: number | null;
  description: string | null;
  status: MetricStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  assignedCount?: number;
  assignedMachineIds?: string[];
}

export interface MetricSummary {
  total: number;
  active: number;
  inactive: number;
  totalMapped: number;
  assigned?: number;
  unassigned?: number;
}

export interface MetricListResponse {
  metrics: MetricCatalogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: MetricSummary;
}

export interface MetricFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  dataType?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ReferencingMachine {
  lineId: string;
  lineName: string;
  machineId: string;
  machineName: string;
  metricId: string;
  metricName: string;
  sampleCount: number;
  lastSeen: string;
}

export interface MetricUsageDetails {
  metricId: string;
  code: string;
  name: string;
  status: MetricStatus;
  usageCount: number;
  referencingMachines: ReferencingMachine[];
}

export interface CreateMetricPayload {
  code: string;
  name: string;
  category: MetricCategory;
  unit: string;
  dataType?: MetricDataType;
  validMin?: number | null;
  validMax?: number | null;
  description?: string;
  status?: MetricStatus;
  assignedMachineIds?: string[];
}

export interface UpdateMetricPayload {
  code?: string;
  name?: string;
  category?: MetricCategory;
  unit?: string;
  dataType?: MetricDataType;
  validMin?: number | null;
  validMax?: number | null;
  description?: string;
  status?: MetricStatus;
  assignedMachineIds?: string[];
}

// =========================================================================
// BƯỚC 2C / 2F-2: METRIC MAPPINGS, THRESHOLDS & COLLECTION SCHEDULES
// =========================================================================

export type MappingStatus = 'ACTIVE' | 'NOT_CONFIGURED' | 'DEACTIVATED';

export interface MetricMappingItem {
  id: string;
  machine_id: string;
  machineName?: string;
  machineCode?: string;
  lineId?: string;
  lineName?: string;
  plc_id: string | null;
  plcName?: string | null;
  plcStatus?: string | null;
  plcEnabled?: boolean | number | null;
  plcIsDemo?: boolean | number | null;
  metric_id: string;
  metricCode?: string;
  metricName?: string;
  metricCategory?: MetricCategory;
  unit?: string;
  dataType?: MetricDataType;
  validMin?: number | null;
  validMax?: number | null;
  mapping_code: string;
  channel_name: string;
  plc_register: string | null;
  scale_factor: number;
  sampling_rate_ms: number;
  monitoring_enabled: number | boolean;
  status: MappingStatus;
  created_at: string;
  updated_at: string;
  // Threshold fields (từ LEFT JOIN CSDL)
  thresholdId?: string | null;
  warning_min?: number | null;
  warning_max?: number | null;
  critical_min?: number | null;
  critical_max?: number | null;
  action_plan?: string | null;
  // Schedule fields (từ LEFT JOIN CSDL)
  scheduleId?: string | null;
  frequency_type?: 'INTERVAL' | 'CRON' | 'CONTINUOUS' | null;
  interval_seconds?: number | null;
  cron_expression?: string | null;
  scheduleIsActive?: boolean | number | null;
  thresholds?: MetricThresholds | null;
  schedule?: CollectionSchedule | null;
}

export interface MetricThresholds {
  id?: string;
  mapping_id?: string;
  warning_min: number | null;
  warning_max: number | null;
  critical_min: number | null;
  critical_max: number | null;
  action_plan?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionSchedule {
  id?: string;
  mapping_id?: string;
  frequency_type: 'INTERVAL' | 'CRON' | 'CONTINUOUS';
  interval_seconds: number | null;
  cron_expression: string | null;
  is_active: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMappingPayload {
  machine_id: string;
  metric_id: string;
  mapping_code: string;
  channel_name: string;
  plc_id?: string | null;
  plc_register?: string | null;
  scale_factor?: number;
  sampling_rate_ms?: number;
}

export interface UpdateMappingPayload {
  mapping_code?: string;
  channel_name?: string;
  plc_id?: string | null;
  plc_register?: string | null;
  scale_factor?: number;
  sampling_rate_ms?: number;
}
