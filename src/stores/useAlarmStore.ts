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
   * Thêm cảnh báo mới khi cảm biến vượt ngưỡng
   */
  triggerNewAlarm: (newAlarm: Omit<AlarmEvent, 'id' | 'timestamp' | 'status'>) => void;
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

  triggerNewAlarm: (newAlarmData) =>
    set((state) => {
      const id = `ALM-${Date.now()}`;
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
