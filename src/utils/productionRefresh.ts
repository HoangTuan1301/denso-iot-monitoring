/**
 * @file productionRefresh.ts
 * @description Tải lại dữ liệu sản xuất ngay (sau khi giả lập / khôi phục sự cố, hoặc khi bật lại Realtime)
 * và kiểm tra Realtime có đang tạm dừng không (các hook tự làm mới sẽ bỏ qua khi tạm dừng).
 */
import { useMonitoringStore } from '../stores/useMonitoringStore';

export const PRODUCTION_REFRESH_EVENT = 'kailink:production-refresh';

export function requestProductionRefresh() {
  window.dispatchEvent(new Event(PRODUCTION_REFRESH_EVENT));
}

/** Cho phép tự làm mới theo chu kỳ? (false khi người dùng bấm tạm dừng Realtime) */
export function isAutoRefreshOn() {
  return useMonitoringStore.getState().isRealtimeActive;
}
