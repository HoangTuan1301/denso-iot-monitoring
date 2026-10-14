/**
 * @file historyService.ts
 * @description Dịch vụ API Frontend truy vấn lịch sử hoạt động máy (Machine Activity Log / Telemetry History)
 * Tái sử dụng request client và cơ chế xác thực JWT bảo mật có sẵn.
 */

import { request } from './api';
import { TelemetryFilterParams, TelemetryLogsResponse } from '../types/hierarchy';

export const historyService = {
  /**
   * Truy vấn danh sách lịch sử telemetry kèm bộ lọc đa tiêu chí và phân trang
   * @param params Tham số lọc (lineId, machineId, metricId, status, khoảng thời gian, phân trang, sắp xếp)
   * @param signal AbortSignal để hủy request cũ nếu có request mới thay thế
   */
  async getTelemetryLogs(
    params: TelemetryFilterParams = {},
    signal?: AbortSignal
  ): Promise<TelemetryLogsResponse> {
    const searchParams = new URLSearchParams();

    if (params.lineId && params.lineId !== 'all') {
      searchParams.append('lineId', params.lineId);
    }
    if (params.machineId && params.machineId !== 'all') {
      searchParams.append('machineId', params.machineId);
    }
    if (params.metricId && params.metricId !== 'all') {
      searchParams.append('metricId', params.metricId);
    }
    if (params.status && params.status !== 'all') {
      searchParams.append('status', params.status);
    }
    if (params.startDate) {
      searchParams.append('startDate', params.startDate);
    }
    if (params.endDate) {
      searchParams.append('endDate', params.endDate);
    }
    if (params.startTime) {
      searchParams.append('startTime', params.startTime);
    }
    if (params.endTime) {
      searchParams.append('endTime', params.endTime);
    }
    if (params.page !== undefined && params.page !== null) {
      searchParams.append('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== null) {
      searchParams.append('limit', String(params.limit));
    }
    if (params.sortBy) {
      searchParams.append('sortBy', params.sortBy);
    }
    if (params.sortOrder) {
      searchParams.append('sortOrder', params.sortOrder);
    }
    if (params.isExport !== undefined && params.isExport !== null) {
      searchParams.append('isExport', String(params.isExport));
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/telemetry/logs${queryString ? `?${queryString}` : ''}`;

    return request<TelemetryLogsResponse>(endpoint, {
      method: 'GET',
      signal,
    });
  },
};
