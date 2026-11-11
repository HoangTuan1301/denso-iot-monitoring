/**
 * @file useAlarmStore.ts
 * @description Quản lý danh sách cảnh báo sự cố và quy trình xử lý của Kỹ thuật viên / Operator
 */

import { create } from 'zustand';
import { AlarmEvent, AlarmWorkflowStatus } from '../types/alarm';
import { initialAlarms } from '../utils/mockData';
import { apiClient } from '../services/api';

interface AlarmState {
  alarms: AlarmEvent[];

  /**
   * Thợ kỹ thuật bấm "Đã nhận sửa"
   */
  acknowledgeAlarm: (alarmId: string, technicianName: string) => void;

  /**
   * Thợ kỹ thuật bấm "Đã hoàn thành" khắc phục sự cố
   */
  resolveAlarm: (alarmId: string, resolutionNotes: string) => void;

  /**
   * Khôi phục tất cả các sự cố đang hoạt động về trạng thái đã giải quyết
   */
  resolveAllAlarms: (resolutionNotes?: string) => void;

  /**
   * Khôi phục CHỈ các cảnh báo phát sinh từ phiên Giả lập sự cố Demo (isDemo = true hoặc id bắt đầu bằng ALM-DEMO-)
   * Tuyệt đối không xóa hay giải quyết các cảnh báo lịch sử hoặc cảnh báo vận hành thật
   */
  resolveDemoAlarms: (resolutionNotes?: string) => void;

  /**
   * Thêm cảnh báo mới khi cảm biến vượt ngưỡng
   */
  triggerNewAlarm: (newAlarm: Omit<AlarmEvent, 'id' | 'timestamp' | 'status'> & { isDemo?: boolean; source?: string }) => void;
}

export const useAlarmStore = create<AlarmState>((set) => ({
  alarms: initialAlarms,

  acknowledgeAlarm: (alarmId: string, technicianName: string) => {
    apiClient.recordAudit(
      'ACKNOWLEDGE_ALARM',
      alarmId,
      `Nhân viên ${technicianName} đã tiếp nhận xử lý sự cố.`
    );
    set((state) => ({
      alarms: state.alarms.map((alarm) =>
        alarm.id === alarmId
          ? {
              ...alarm,
              status: 'acknowledged' as AlarmWorkflowStatus,
              assignedTo: technicianName,
              acknowledgedAt: new Date().toISOString(),
            }
          : alarm
      ),
    }));
  },

  resolveAlarm: (alarmId: string, resolutionNotes: string) => {
    apiClient.recordAudit(
      'RESOLVE_ALARM',
      alarmId,
      `Đã khắc phục hoàn tất sự cố. Ghi chú: ${resolutionNotes}`
    );
    set((state) => ({
      alarms: state.alarms.map((alarm) =>
        alarm.id === alarmId
          ? {
              ...alarm,
              status: 'resolved' as AlarmWorkflowStatus,
              resolvedAt: new Date().toISOString(),
              resolutionNotes,
            }
          : alarm
      ),
    }));
  },

  resolveAllAlarms: (resolutionNotes = 'Đã khôi phục trạng thái chuẩn sau diễn tập.') => {
    set((state) => ({
      alarms: state.alarms.map((alarm) =>
        alarm.status !== 'resolved'
          ? {
              ...alarm,
              status: 'resolved' as AlarmWorkflowStatus,
              resolvedAt: new Date().toISOString(),
              resolutionNotes,
            }
          : alarm
      ),
    }));
  },

  resolveDemoAlarms: (resolutionNotes = 'Đã khôi phục sự cố diễn tập Demo.') => {
    set((state) => ({
      alarms: state.alarms.map((alarm) => {
        const isDemoAlarm =
          alarm.isDemo === true ||
          alarm.id.startsWith('ALM-DEMO') ||
          alarm.source === 'DEMO' ||
          alarm.message.includes('Sự cố giả lập');

        if (isDemoAlarm && alarm.status !== 'resolved') {
          return {
            ...alarm,
            status: 'resolved' as AlarmWorkflowStatus,
            resolvedAt: new Date().toISOString(),
            resolutionNotes,
          };
        }
        return alarm;
      }),
    }));
  },

  triggerNewAlarm: (newAlarmData) =>
    set((state) => {
      const isDemo = newAlarmData.isDemo ?? false;
      const id = isDemo ? `ALM-DEMO-${Date.now()}` : `ALM-${Date.now()}`;
      const timestamp = new Date().toISOString();
      const newAlarm: AlarmEvent = {
        ...newAlarmData,
        id,
        timestamp,
        status: 'pending',
      };
      return {
        alarms: [newAlarm, ...state.alarms],
      };
    }),
}));
