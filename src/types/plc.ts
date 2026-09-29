/**
 * @file plc.ts
 * @description Định nghĩa các kiểu dữ liệu và cấu hình ánh xạ tín hiệu thô từ PLC/Cảm biến sang giá trị hiển thị kỹ thuật
 */

/**
 * Các kiểu dữ liệu thô phổ biến truyền từ PLC/Controller công nghiệp:
 * - DEC12: Số nguyên 12-bit (0 - 4095) từ ngõ vào Analog (ADC 12-bit)
 * - BIT12: Thanh ghi trạng thái 12-bit nhị phân (chẩn đoán lỗi, bit cảnh báo)
 * - INT16: Số nguyên có dấu 16-bit (-32768 đến 32767)
 * - UINT16: Số nguyên không dấu 16-bit (0 đến 65535)
 * - FLOAT32: Số thực chuẩn IEEE 754 (32-bit float)
 * - SCALE: Áp dụng công thức chuyển đổi kỹ thuật Tuyến tính: Y = X * Scale + Offset
 */
export type PLCRawDataType = 'DEC12' | 'BIT12' | 'INT16' | 'UINT16' | 'FLOAT32' | 'SCALE';

/**
 * Cấu hình ánh xạ chi tiết cho một thanh ghi PLC gắn vào Metric
 */
export interface PLCMappingConfig {
  address: string;             // Địa chỉ thanh ghi PLC (ví dụ: "D1000", "MW102", "DB1.DBD0")
  dataType: PLCRawDataType;    // Kiểu dữ liệu thô từ PLC
  rawMin?: number;             // Giá trị thô nhỏ nhất (ví dụ: 0 đối với DEC12)
  rawMax?: number;             // Giá trị thô lớn nhất (ví dụ: 4095 đối với DEC12)
  engMin?: number;             // Giá trị kỹ thuật tương ứng nhỏ nhất (ví dụ: 0 bar)
  engMax?: number;             // Giá trị kỹ thuật tương ứng lớn nhất (ví dụ: 100 bar)
  scaleMultiplier?: number;    // Hệ số nhân (cho kiểu SCALE, mặc định: 1)
  scaleOffset?: number;        // Độ lệch cộng thêm (cho kiểu SCALE, mặc định: 0)
  bitMaskIndex?: number;       // Vị trí bit cần theo dõi trong thanh ghi BIT12 (0 - 11)
  description?: string;        // Ghi chú chức năng thanh ghi
}
