/**
 * @file alarm.ts
 * @description Định nghĩa các kiểu dữ liệu cho Hệ thống Cảnh báo sự cố (Alarms & Incidents)
 */


/**
 * Mức độ nghiêm trọng của sự cố:
 * - warning: Cảnh báo vượt ngưỡng chú ý
 * - critical: Nguy hiểm, dừng dây chuyền hoặc nguy cơ hỏng hóc cao
 */
export type AlarmSeverity = 'warning' | 'critical';

/**
 * Trạng thái xử lý sự cố của nhân viên kỹ thuật / Operator:
 * - pending: Mới phát sinh, chưa có ai tiếp nhận
 * - acknowledged: Thợ kỹ thuật đã bấm "Đã nhận sửa"
 * - resolved: Đã sửa chữa và khắc phục xong ("Đã hoàn thành")
 */
export type AlarmWorkflowStatus = 'pending' | 'acknowledged' | 'resolved';

/**
 * Bản ghi chi tiết sự cố cảnh báo trong xưởng
 */
export interface AlarmEvent {
  id: string;                    // Mã sự cố (ví dụ: "ALM-20260927-001")
  lineId: string;                // Thuộc Dây chuyền nào
  lineName: string;              // Tên dây chuyền
  machineId: string;             // Thuộc Máy nào
  machineName: string;           // Tên máy
  metricId: string;              // Chỉ số vượt ngưỡng
  metricName: string;            // Tên chỉ số đo lường
  severity: AlarmSeverity;       // Mức độ nguy hiểm
  triggeredValue: number;        // Giá trị đo được tại thời điểm xảy ra sự cố
  thresholdValue: number;        // Ngưỡng bị vượt qua
  unit: string;                  // Đơn vị đo
  message: string;               // Thông điệp mô tả sự cố
  timestamp: string;             // Thời gian phát sinh cảnh báo (ISO string)
  
  // Thông tin xử lý quy trình
  status: AlarmWorkflowStatus;   // Trạng thái tiếp nhận
  assignedTo?: string;           // Tên người tiếp nhận xử lý
  acknowledgedAt?: string;       // Thời gian bấm "Đã nhận sửa"
  resolvedAt?: string;           // Thời gian bấm "Đã hoàn thành"
  resolutionNotes?: string;      // Ghi chú cách giải quyết sự cố
}
