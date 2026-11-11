/**
 * @file api.ts
 * @description API Client chuẩn RESTful có gắn tự động Authorization: Bearer <token>
 * và quản lý phiên xác thực JWT an toàn.
 */

import { AuthResponse, UserProfile } from '../types/auth';
import { AuditLogEntry } from '../types/audit';
import { ProductionLine, MachineComponent } from '../types/hierarchy';
import {
  MetricCatalogItem,
  MetricFilterParams,
  MetricListResponse,
  MetricUsageDetails,
  CreateMetricPayload,
  UpdateMetricPayload,
  MetricMappingItem,
  MetricThresholds,
  CollectionSchedule,
  CreateMappingPayload,
  UpdateMappingPayload,
} from '../types/metric';

const TOKEN_KEY = 'denso_iot_access_token';
const REFRESH_TOKEN_KEY = 'denso_iot_refresh_token';
const USER_KEY = 'denso_iot_user_profile';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: (): UserProfile | null => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setSession: (authData: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, authData.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// Tự động nhận diện URL Backend Render nếu chạy trên môi trường Vercel hoặc cloud
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  // Nếu đang mở trên tên miền vercel.app, tự động trỏ về Render backend
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://denso-iot-monitoring.onrender.com';
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();

// Hàm gửi HTTP Request có tự động đính kèm Bearer Token và timeout
export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.getAccessToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Nếu có API_BASE_URL và endpoint bắt đầu bằng '/', nối vào
  const fullUrl = API_BASE_URL && endpoint.startsWith('/') ? `${API_BASE_URL}${endpoint}` : endpoint;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout để không treo UI khi server ngủ

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      // Phiên làm việc hết hạn
      tokenStorage.clearSession();
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.warn(`[API Error] Phản hồi non-JSON từ ${fullUrl}:`, text.slice(0, 150));
      throw new Error('Máy chủ đang khởi động hoặc chưa sẵn sàng. Vui lòng thử lại sau giây lát.');
    }

    const data = await response.json();

    if (!response.ok) {
      const error: any = new Error(data.message || `Lỗi yêu cầu: ${response.statusText}`);
      error.status = response.status;
      error.errorCode = data.errorCode;
      error.code = data.code || data.errorCode;
      error.data = data;
      error.currentPlcId = data.currentPlcId;
      error.currentPlcName = data.currentPlcName;
      error.sourceMachineId = data.sourceMachineId;
      error.sourceMachineName = data.sourceMachineName;
      throw error;
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Máy chủ Backend phản hồi quá lâu (đang khởi động). Vui lòng thử lại.');
    }
    throw err;
  }
}

// =========================================================================
// CÁC DỊCH VỤ API TƯƠNG TÁC BACKEND
// =========================================================================
export const apiClient = {
  // --- Auth ---
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      tokenStorage.setSession(res);
      return res;
    } catch (err: any) {
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('Không thể kết nối đến máy chủ Backend. Máy chủ có thể đang ngủ hoặc chưa khởi động.');
      }
      throw err;
    }
  },

  async getMe(): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/api/auth/me');
  },

  async logout(): Promise<void> {
    // 1. Luôn xóa session ngay lập tức
    tokenStorage.clearSession();
    // 2. Báo server với timeout ngắn (2s) để không chặn luồng
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const fullUrl = API_BASE_URL ? `${API_BASE_URL}/api/auth/logout` : '/api/auth/logout';
      await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      }).catch(() => {});
      clearTimeout(timeoutId);
    } catch {
      // bỏ qua lỗi
    }
  },

  // --- Users Management ---
  async getUsers(): Promise<{ users: UserProfile[] }> {
    return request<{ users: UserProfile[] }>('/api/users');
  },

  async createUser(userData: {
    username?: string;
    fullName: string;
    role: string;
    status?: string;
    employeeId?: string;
    email?: string;
    password?: string;
    assignedLineId?: string;
    avatarUrl?: string | null;
  }): Promise<{ user: UserProfile; message: string }> {
    return request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<{ user: UserProfile }> {
    return request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    return request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  async resetPassword(id: string, newPassword: string = '123456'): Promise<{ message: string; defaultPassword?: string }> {
    return request(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },

  async uploadAvatar(file: File, userId?: string): Promise<{ avatarUrl: string; user: UserProfile; message: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    if (userId) {
      formData.append('userId', userId);
    }
    return request('/api/users/upload-avatar', {
      method: 'POST',
      body: formData,
    });
  },

  // --- Audit Logs ---
  async getAuditLogs(filters: { action?: string; search?: string } = {}): Promise<{ auditLogs: AuditLogEntry[] }> {
    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/audit-logs${query}`);
  },

  async recordAudit(action: string, target: string, details: string): Promise<void> {
    try {
      await request('/api/audit-logs', {
        method: 'POST',
        body: JSON.stringify({ action, target, details }),
      });
    } catch {
      // Không chặn luồng chính nếu ghi log thất bại
    }
  },

  // --- Metric Catalog (Danh mục Metric) ---
  async getMetrics(filters: MetricFilterParams = {}): Promise<MetricListResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.search) params.append('search', filters.search);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.dataType && filters.dataType !== 'all') params.append('dataType', filters.dataType);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const query = params.toString() ? `?${params.toString()}` : '';
    return request<MetricListResponse>(`/api/metrics${query}`);
  },

  async getMetricById(id: string): Promise<{ metric: MetricCatalogItem }> {
    return request<{ metric: MetricCatalogItem }>(`/api/metrics/${encodeURIComponent(id)}`);
  },

  async getMetricUsage(id: string): Promise<{ usage: MetricUsageDetails }> {
    return request<{ usage: MetricUsageDetails }>(`/api/metrics/${encodeURIComponent(id)}/usage`);
  },

  async createMetric(payload: CreateMetricPayload): Promise<{ message: string; metric: MetricCatalogItem }> {
    return request<{ message: string; metric: MetricCatalogItem }>('/api/metrics', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMetric(id: string, payload: UpdateMetricPayload): Promise<{ message: string; metric: MetricCatalogItem }> {
    return request<{ message: string; metric: MetricCatalogItem }>(`/api/metrics/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updateMetricStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<{ message: string; metric: MetricCatalogItem }> {
    return request<{ message: string; metric: MetricCatalogItem }>(`/api/metrics/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async deleteMetric(id: string): Promise<{ success: boolean; message: string; metric?: MetricCatalogItem }> {
    return request<{ success: boolean; message: string; metric?: MetricCatalogItem }>(
      `/api/metrics/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // --- Production Lines (Bước 2B / 2F-1) ---
  async getLines(filters: { status?: string; search?: string } = {}): Promise<{ lines: ProductionLine[] }> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ lines: ProductionLine[] }>(`/api/lines${query}`);
  },

  async getLineById(id: string): Promise<{ line: ProductionLine }> {
    return request<{ line: ProductionLine }>(`/api/lines/${encodeURIComponent(id)}`);
  },

  // --- Machines & Components (Bước 2B / 2F-1) ---
  async getMachines(filters: { lineId?: string; status?: string; type?: string; search?: string } = {}): Promise<{ machines: MachineComponent[] }> {
    const params = new URLSearchParams();
    if (filters.lineId && filters.lineId !== 'all') params.append('lineId', filters.lineId);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ machines: MachineComponent[] }>(`/api/machines${query}`);
  },

  async getMachineById(id: string): Promise<{ machine: MachineComponent }> {
    return request<{ machine: MachineComponent }>(`/api/machines/${encodeURIComponent(id)}`);
  },

  async uploadMachineImage(file: File, machineId?: string): Promise<{ imageUrl: string; filename: string; size: number; message: string }> {
    const formData = new FormData();
    formData.append('image', file);
    if (machineId) {
      formData.append('machineId', machineId);
    }
    return request('/api/machines/upload-image', {
      method: 'POST',
      body: formData,
    });
  },

  async createMachine(payload: {
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
  }): Promise<{ message: string; machine: MachineComponent }> {
    return request<{ message: string; machine: MachineComponent }>('/api/machines', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMachine(
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
  ): Promise<{ message: string; machine: MachineComponent }> {
    return request<{ message: string; machine: MachineComponent }>(`/api/machines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // --- PLC Stations (Bước 2B / 2F-1) ---
  async getPLCStations(): Promise<{ stations: any[] }> {
    return request<{ stations: any[] }>('/api/plc-stations');
  },

  // --- Line-Level PLC Assignment & Detachment (Kiến trúc theo Dây chuyền) ---
  async assignLinePLC(
    lineId: string,
    payload: { plcId: string; confirmDestReplace?: boolean; confirmSourceTransfer?: boolean }
  ): Promise<{ message: string; success: boolean; line?: any; plc?: any; transferredFromLine?: string; replacedPlc?: string }> {
    return request<{ message: string; success: boolean; line?: any; plc?: any; transferredFromLine?: string; replacedPlc?: string }>(
      `/api/lines/${encodeURIComponent(lineId)}/plc`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async unassignLinePLC(
    lineId: string
  ): Promise<{ message: string; success: boolean; lineId?: string; unassignedPlcId?: string }> {
    return request<{ message: string; success: boolean; lineId?: string; unassignedPlcId?: string }>(
      `/api/lines/${encodeURIComponent(lineId)}/plc`,
      {
        method: 'DELETE',
      }
    );
  },

  // --- PLC Assignment & Detachment (Deprecated machine-level) ---
  async assignPLC(
    machineId: string,
    payload: { plcId: string; confirmDestReplace?: boolean; confirmSourceTransfer?: boolean }
  ): Promise<{ message: string; success: boolean; machine?: any; plc?: any }> {
    return request<{ message: string; success: boolean; machine?: any; plc?: any }>(
      `/api/machines/${encodeURIComponent(machineId)}/plc`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async unassignPLC(
    machineId: string
  ): Promise<{ message: string; success: boolean; machineId?: string }> {
    return request<{ message: string; success: boolean; machineId?: string }>(
      `/api/machines/${encodeURIComponent(machineId)}/plc`,
      {
        method: 'DELETE',
      }
    );
  },

  // =========================================================================
  // GIAI ĐOẠN 2 - BƯỚC 2C / 2F-2: MAPPINGS, THRESHOLDS & SCHEDULES
  // =========================================================================

  // --- Metric Mappings ---
  async getMappings(filters: {
    machineId?: string;
    plcId?: string;
    metricId?: string;
    status?: string;
    monitoring_enabled?: string;
    search?: string;
  } = {}): Promise<{ mappings: MetricMappingItem[] }> {
    const params = new URLSearchParams();
    if (filters.machineId && filters.machineId !== 'all') params.append('machineId', filters.machineId);
    if (filters.plcId && filters.plcId !== 'all') params.append('plcId', filters.plcId);
    if (filters.metricId && filters.metricId !== 'all') params.append('metricId', filters.metricId);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.monitoring_enabled && filters.monitoring_enabled !== 'all') {
      params.append('monitoring_enabled', filters.monitoring_enabled);
    }
    if (filters.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ mappings: MetricMappingItem[] }>(`/api/mappings${query}`);
  },

  async getMappingById(id: string): Promise<{ mapping: MetricMappingItem }> {
    return request<{ mapping: MetricMappingItem }>(`/api/mappings/${encodeURIComponent(id)}`);
  },

  async createMapping(
    payload: CreateMappingPayload
  ): Promise<{ message: string; mapping: MetricMappingItem }> {
    return request<{ message: string; mapping: MetricMappingItem }>('/api/mappings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMapping(
    id: string,
    payload: UpdateMappingPayload
  ): Promise<{ message: string; mapping: MetricMappingItem }> {
    return request<{ message: string; mapping: MetricMappingItem }>(
      `/api/mappings/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async deactivateMapping(
    id: string
  ): Promise<{ message: string; mappingId: string; status: string; monitoring_enabled: number }> {
    return request<{ message: string; mappingId: string; status: string; monitoring_enabled: number }>(
      `/api/mappings/${encodeURIComponent(id)}/deactivate`,
      {
        method: 'PATCH',
      }
    );
  },

  async deleteMapping(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/mappings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async assignMetricMachines(
    id: string,
    machineIds: string[]
  ): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(
      `/api/metrics/${encodeURIComponent(id)}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({ machineIds }),
      }
    );
  },

  async toggleMappingMonitoring(
    id: string,
    enable: boolean
  ): Promise<{ message: string; mapping: MetricMappingItem }> {
    return request<{ message: string; mapping: MetricMappingItem }>(
      `/api/mappings/${encodeURIComponent(id)}/monitoring`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enable }),
      }
    );
  },

  // --- Metric Thresholds ---
  async getThresholds(mappingId: string): Promise<{ thresholds: MetricThresholds | null }> {
    return request<{ thresholds: MetricThresholds | null }>(
      `/api/mappings/${encodeURIComponent(mappingId)}/thresholds`
    );
  },

  async setThresholds(
    mappingId: string,
    payload: {
      warning_min?: number | null;
      warning_max?: number | null;
      critical_min?: number | null;
      critical_max?: number | null;
      action_plan?: string | null;
    }
  ): Promise<{ message: string; thresholds: MetricThresholds }> {
    return request<{ message: string; thresholds: MetricThresholds }>(
      `/api/mappings/${encodeURIComponent(mappingId)}/thresholds`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  // --- Collection Schedules ---
  async getSchedule(mappingId: string): Promise<{ schedule: CollectionSchedule | null }> {
    return request<{ schedule: CollectionSchedule | null }>(
      `/api/mappings/${encodeURIComponent(mappingId)}/schedule`
    );
  },

  async setSchedule(
    mappingId: string,
    payload: {
      frequency_type: 'INTERVAL' | 'CRON' | 'CONTINUOUS';
      interval_seconds?: number | null;
      cron_expression?: string | null;
      is_active?: boolean;
    }
  ): Promise<{ message: string; schedule: CollectionSchedule }> {
    return request<{ message: string; schedule: CollectionSchedule }>(
      `/api/mappings/${encodeURIComponent(mappingId)}/schedule`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  // =========================================================================
  // FILE INGESTION & REAL-TIME TELEMETRY APIS (GIAI ĐOẠN 2F-3)
  // =========================================================================
  async getLatestTelemetry(params?: { machineId?: string; lineId?: string }): Promise<{
    success: boolean;
    total: number;
    timestamp: string;
    data: Array<{
      id: string;
      lineId: string;
      lineName?: string;
      machineId: string;
      machineName?: string;
      metricId: string;
      metricName?: string;
      value: number;
      unit: string;
      status: string;
      source: string;
      dataSourceType: 'FILE_INGEST' | 'PLC_DIRECT' | 'SIMULATED';
      fileTagName?: string;
      quality: 'GOOD' | 'UNCERTAIN' | 'BAD';
      isLive: boolean;
      isStale: boolean;
      ageSeconds: number;
      measuredAt: string;
      plcStationId?: string | null;
      thresholds: {
        warningMin: number | null;
        warningMax: number | null;
        criticalMin: number | null;
        criticalMax: number | null;
      };
    }>;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.machineId && params.machineId !== 'all') searchParams.append('machineId', params.machineId);
    if (params?.lineId && params.lineId !== 'all') searchParams.append('lineId', params.lineId);
    const qs = searchParams.toString();
    return request(`/api/telemetry/latest${qs ? `?${qs}` : ''}`);
  },

  async getIngestionStatus(): Promise<{
    enabled: boolean;
    status: 'RUNNING' | 'PAUSED' | 'DISABLED';
    watchDirectory: string | null;
    activeProfiles: number;
    profiles: Array<{ profileId: string; name: string; mode: string; expectedCycleSeconds: number }>;
    stats: Record<string, number> | null;
    database: string;
    timestamp: string;
  }> {
    return request('/api/ingestion/status');
  },

  async getIngestionFiles(params?: { limit?: number; status?: string; machineId?: string }): Promise<{
    files: Array<{
      id: string;
      file_hash: string;
      file_name: string;
      file_size: number;
      machine_id: string | null;
      total_records: number;
      valid_records: number;
      error_records: number;
      conflict_records: number;
      status: 'PROCESSING' | 'COMMITTED' | 'FAILED' | 'DUPLICATE' | 'PARTIAL';
      error_details?: string | null;
      file_modified_at?: string | null;
      ingested_at: string;
      processed_at?: string | null;
    }>;
    total: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.status) searchParams.append('status', params.status);
    if (params?.machineId) searchParams.append('machineId', params.machineId);
    const qs = searchParams.toString();
    return request(`/api/ingestion/files${qs ? `?${qs}` : ''}`);
  },

  async getIngestionConflicts(params?: { limit?: number; fileId?: string; machineId?: string }): Promise<{
    conflicts: Array<{
      id: string;
      file_id: string;
      machine_id: string;
      mapping_code: string;
      data_no: number;
      measured_at: string;
      existing_value: number;
      incoming_value: number;
      resolution: string;
      detected_at: string;
    }>;
    total: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.fileId) searchParams.append('fileId', params.fileId);
    if (params?.machineId) searchParams.append('machineId', params.machineId);
    const qs = searchParams.toString();
    return request(`/api/ingestion/conflicts${qs ? `?${qs}` : ''}`);
  },
};
