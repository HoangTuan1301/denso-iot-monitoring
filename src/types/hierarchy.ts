/**
 * @file hierarchy.ts
 * @description Định nghĩa các kiểu dữ liệu cho Mô hình 3 Tầng Giám Sát Nhà Máy (Line -> Machine -> Metric)
 */

import { PLCMappingConfig } from './plc';

/**
 * Trạng thái vận hành của Line, Machine hoặc Metric
 * - normal: An toàn / Bình thường (Màu xanh)
 * - warning: Cảnh báo vượt ngưỡng nhẹ (Màu vàng)
 * - critical: Nguy hiểm, cần can thiệp gấp (Màu đỏ nhấp nháy)
 */
export type SystemStatus = 'normal' | 'warning' | 'critical';

/**
 * Điểm dữ liệu lịch sử theo thời gian phục vụ vẽ biểu đồ (Tầng 3)
 */
export interface MetricHistoryPoint {
  timestamp: string; // ISO string hoặc định dạng HH:mm:ss
  value: number;     // Giá trị đo được tại thời điểm đó
}

/**
 * ============================================================================
 * TẦNG 3 - CHỈ SỐ ĐO LƯỜNG (METRIC / INDICATOR)
 * ============================================================================
 * Trực thuộc một Máy/Thiết bị (Tầng 2).
 * Đại diện cho các giá trị cảm biến thực tế: Nhiệt độ, Độ rung, Áp suất, v.v.
 */
export interface MetricIndicator {
  id: string;                    // Mã định danh chỉ số (ví dụ: "METRIC-PRESS-01")
  name: string;                  // Tên hiển thị (ví dụ: "Áp suất buồng nén")
  unit: string;                  // Đơn vị đo (ví dụ: "bar", "°C", "mm/s", "RPM", "%")
  currentValue: number;          // Giá trị thực tế hiển thị sau khi đã giải mã từ PLC
  rawVal?: number;               // Giá trị thô trực tiếp từ thanh ghi PLC (nếu có)
  status: SystemStatus;          // Trạng thái đánh giá dựa trên ngưỡng
  
  // Cấu hình 4 ngưỡng kỹ thuật
  warningMin: number;            // Ngưỡng cảnh báo dưới
  warningMax: number;            // Ngưỡng cảnh báo trên
  criticalMin: number;           // Ngưỡng nguy hiểm dưới
  criticalMax: number;           // Ngưỡng nguy hiểm trên

  // Cấu hình ánh xạ tín hiệu thô từ PLC
  plcMapping?: PLCMappingConfig;

  // Lịch sử biến thiên phục vụ vẽ biểu đồ biến thiên thời gian thực
  history: MetricHistoryPoint[];

  // Thời gian cập nhật gần nhất
  lastUpdated: string;
}

/**
 * ============================================================================
 * TẦNG 2 - THÀNH PHẦN / MÁY (MACHINE / COMPONENT)
 * ============================================================================
 * Trực thuộc một Dây chuyền sản xuất (Tầng 1).
 * Chứa danh sách các Metric đo lường và Mã QR nhận diện cho kỹ thuật viên.
 */
export interface MachineComponent {
  id: string;                    // Mã máy (ví dụ: "MC-CYL-01")
  name: string;                  // Tên thiết bị (ví dụ: "Máy xi-lanh ép thủy lực 01")
  model: string;                 // Model máy (ví dụ: "SMC-HYD-500")
  lineId: string;                // Thuộc Dây chuyền nào (Khóa ngoại trỏ về Tầng 1)
  status: SystemStatus;          // Trạng thái tổng hợp từ các chỉ số con
  qrCode: string;                // Chuỗi nhận diện QR Code (ví dụ: "DENSO-MC-CYL-01")
  location: string;              // Vị trí lắp đặt trong xưởng (ví dụ: "Trạm A3 - Khu vực 1")
  metrics: MetricIndicator[];    // Danh sách các chỉ số kỹ thuật Tầng 3
  lastMaintenance?: string;      // Ngày bảo trì gần nhất
}

/**
 * ============================================================================
 * TẦNG 1 - LUỒNG / DÂY CHUYỀN (LINE)
 * ============================================================================
 * Cụm hoặc dây chuyền sản xuất cấp cao nhất.
 * Hiển thị trạng thái tổng quan và % chỉ số an toàn toàn dây chuyền.
 */
export interface ProductionLine {
  id: string;                    // Mã dây chuyền (ví dụ: "LINE-01")
  name: string;                  // Tên dây chuyền (ví dụ: "Dây chuyền Lắp ráp Động cơ")
  code: string;                  // Mã ngắn (ví dụ: "LINE-ASM-01")
  status: SystemStatus;          // Trạng thái tổng quan của toàn dây chuyền
  safetyScore: number;           // Chỉ số an toàn toàn dây chuyền (0 - 100%)
  operatingHours: number;        // Số giờ hoạt động liên tục (hours)
  machines: MachineComponent[];  // Danh sách các máy/thiết bị trực thuộc (Tầng 2)
  description?: string;          // Mô tả nhiệm vụ của dây chuyền
}
