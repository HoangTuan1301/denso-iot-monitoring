/**
 * @file useHistoryStore.ts
 * @description Quản lý trạng thái phân hệ Lịch sử hoạt động máy (Machine Activity Log / Telemetry History)
 * Hỗ trợ bộ lọc đa tiêu chí, phân trang, chống race condition và xử lý trạng thái degraded.
 */

import { create } from 'zustand';
import {
  MachineActivityLog,
  TelemetryFilterParams,
  TelemetryLogsMetadata,
} from '../types/hierarchy';
import { historyService } from '../services/historyService';

// Lấy ngày hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) định dạng YYYY-MM-DD
export const getTodayVNDate = (): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

export const DEFAULT_FILTERS: TelemetryFilterParams = {
  lineId: 'all',
  machineId: 'all',
  metricId: 'all',
  status: 'all',
  startDate: getTodayVNDate(),
  endDate: getTodayVNDate(),
  startTime: '00:00',
  endTime: '23:59',
  page: 1,
  limit: 20,
  sortBy: 'timestamp',
  sortOrder: 'DESC',
};

interface HistoryState {
  // Trạng thái dữ liệu
  logs: MachineActivityLog[];
  metadata: TelemetryLogsMetadata | null;
  isLoading: boolean;
  error: string | null;

  // Trạng thái máy chủ & CSDL
  isDegraded: boolean;
  degradedMessage: string | null;

  // Trạng thái bộ lọc & phân trang
  filters: TelemetryFilterParams;

  // Hành động
  setFilters: (newFilters: Partial<TelemetryFilterParams>) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  resetFilters: () => void;
  fetchLogs: () => Promise<void>;
}

// Biến nội bộ quản lý chống xung đột luồng gọi mạng (Race Condition Protection)
let currentRequestId = 0;
let activeAbortController: AbortController | null = null;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  logs: [],
  metadata: null,
  isLoading: false,
  error: null,
  isDegraded: false,
  degradedMessage: null,
  filters: { ...DEFAULT_FILTERS },

  /**
   * Cập nhật từng phần của bộ lọc, tự động reset page về 1 nếu thay đổi tiêu chí lọc
   */
  setFilters: (newFilters) => {
    set((state) => ({
      filters: {
        ...state.filters,
        ...newFilters,
        // Reset về trang 1 khi thay đổi bất kỳ tiêu chí lọc nào
        page: 1,
      },
    }));
  },

  /**
   * Chuyển trang và tự động gọi fetch dữ liệu trang mới
   */
  setPage: (page) => {
    set((state) => ({
      filters: {
        ...state.filters,
        page,
      },
    }));
    get().fetchLogs();
  },

  /**
   * Thay đổi số bản ghi mỗi trang, reset về trang 1 và gọi fetch
   */
  setLimit: (limit) => {
    set((state) => ({
      filters: {
        ...state.filters,
        limit,
        page: 1,
      },
    }));
    get().fetchLogs();
  },

  /**
   * Đặt lại toàn bộ bộ lọc về mặc định
   */
  resetFilters: () => {
    set({
      filters: {
        ...DEFAULT_FILTERS,
        startDate: getTodayVNDate(),
        endDate: getTodayVNDate(),
      },
      error: null,
    });
    get().fetchLogs();
  },

  /**
   * Truy vấn lịch sử từ API backend kèm cơ chế hủy request cũ (AbortController)
   * Tuyệt đối không tạo dữ liệu giả khi API trả về rỗng.
   */
  fetchLogs: async () => {
    // 1. Hủy bỏ request trước đó nếu chưa phản hồi
    if (activeAbortController) {
      activeAbortController.abort();
    }
    const abortController = new AbortController();
    activeAbortController = abortController;

    const thisRequestId = ++currentRequestId;
    set({ isLoading: true, error: null });

    try {
      const response = await historyService.getTelemetryLogs(
        get().filters,
        abortController.signal
      );

      // Nếu đã có request mới hơn hoàn thành trước, bỏ qua kết quả này
      if (thisRequestId !== currentRequestId) {
        return;
      }

      const isDegradedState =
        response.metadata?.status === 'degraded' ||
        response.metadata?.dataSource === 'Memory_Fallback';

      set({
        logs: response.data || [],
        metadata: response.metadata,
        isDegraded: isDegradedState,
        degradedMessage: response.metadata?.warning || null,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      // Bỏ qua lỗi do chủ động hủy request (AbortError)
      if (err.name === 'AbortError') {
        return;
      }

      if (thisRequestId === currentRequestId) {
        set({
          isLoading: false,
          error: err.message || 'Không thể tải lịch sử hoạt động máy. Vui lòng thử lại sau.',
          // Giữ logs rỗng, không tự tạo mock data
          logs: [],
        });
      }
    } finally {
      if (activeAbortController === abortController) {
        activeAbortController = null;
      }
    }
  },
}));
