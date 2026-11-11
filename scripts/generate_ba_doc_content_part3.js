/**
 * @file scripts/generate_ba_doc_content_part3.js
 * @description Nội dung Chương 7, Chương 8, Chương 9 và Chương 10 của tài liệu BA
 */

import fs from 'fs';
import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  WidthType,
  AlignmentType,
  ImageRun,
} from 'docx';
import {
  createPara,
  createH1,
  createH2,
  createH3,
  createCell,
  thinBorders,
  imgTier2Path,
  imgTier3Path,
} from './generate_ba_doc_helpers.js';

export function getPart3Elements() {
  const elements = [];

  // =========================================================================
  // CHƯƠNG 7: PHÂN TÍCH & THIẾT KẾ DỮ LIỆU (DATA MODELING)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 7: PHÂN TÍCH & THIẾT KẾ DỮ LIỆU (DATA MODELING)'));

  elements.push(createH2('7.1. Tổng quan cấu trúc dữ liệu hệ thống'));
  elements.push(
    createPara(
      'Hệ thống DENSO IoT Monitoring sử dụng Cơ sở dữ liệu quan hệ MySQL phiên bản 8.0+ (database: denso_iot, charset: utf8mb4, collation: utf8mb4_unicode_ci). Dữ liệu được tổ chức thành 6 bảng quan hệ chặt chẽ phản ánh trọn vẹn mô hình sản xuất phân cấp 3 Tầng và hoạt động kiểm toán nhà máy:'
    )
  );

  elements.push(createH2('7.2. Từ điển dữ liệu chi tiết (Data Dictionary)'));

  // 1. users
  elements.push(createH3('1. Bảng USERS (Quản lý Tài khoản & Hồ sơ Nhân viên)'));
  const usersRows = [
    new TableRow({
      children: [
        createCell('Tên Trường', { isHeader: true, widthPercent: 20 }),
        createCell('Kiểu Dữ Liệu', { isHeader: true, widthPercent: 18 }),
        createCell('Khóa / Null', { isHeader: true, widthPercent: 17 }),
        createCell('Giá Trị Mặc Định', { isHeader: true, widthPercent: 15 }),
        createCell('Mô Tả Nghiệp Vụ', { isHeader: true, widthPercent: 30 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('id', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('PRIMARY KEY, NOT NULL'),
        createCell('None'),
        createCell('Mã định danh duy nhất (UUID/Timestamp băm)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('employeeId', { bold: true }),
        createCell('VARCHAR(32)'),
        createCell('UNIQUE, NOT NULL'),
        createCell('None'),
        createCell('Mã nhân viên DENSO chuẩn (ví dụ: DNS-1001)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('fullName', { bold: true }),
        createCell('VARCHAR(128)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Họ và tên đầy đủ của nhân viên'),
      ],
    }),
    new TableRow({
      children: [
        createCell('email', { bold: true }),
        createCell('VARCHAR(128)'),
        createCell('UNIQUE, NOT NULL'),
        createCell('None'),
        createCell('Email nội bộ công ty dùng để đăng nhập'),
      ],
    }),
    new TableRow({
      children: [
        createCell('password', { bold: true }),
        createCell('VARCHAR(255)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Mật khẩu đã được băm Bcrypt (10 rounds)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('role', { bold: true }),
        createCell("ENUM('ADMIN','OPERATOR','MAINTENANCE')"),
        createCell('NOT NULL'),
        createCell("'OPERATOR'"),
        createCell('Vai trò phân quyền RBAC'),
      ],
    }),
    new TableRow({
      children: [
        createCell('assignedLineId', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('NULL'),
        createCell("'ALL'"),
        createCell('Dây chuyền được phân công trực tiếp'),
      ],
    }),
    new TableRow({
      children: [
        createCell('avatarUrl', { bold: true }),
        createCell('VARCHAR(255)'),
        createCell('NULL'),
        createCell('NULL'),
        createCell('Đường dẫn ảnh đại diện tĩnh (/uploads/avatars/...)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('status', { bold: true }),
        createCell("ENUM('ACTIVE','INACTIVE')"),
        createCell('NOT NULL'),
        createCell("'ACTIVE'"),
        createCell('Trạng thái hoạt động của tài khoản'),
      ],
    }),
    new TableRow({
      children: [
        createCell('createdAt', { bold: true }),
        createCell('DATETIME'),
        createCell('NULL'),
        createCell('CURRENT_TIMESTAMP'),
        createCell('Thời điểm tạo tài khoản (UTC)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('lastLoginAt', { bold: true }),
        createCell('DATETIME'),
        createCell('NULL'),
        createCell('NULL'),
        createCell('Thời điểm đăng nhập thành công gần nhất (UTC)'),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: usersRows,
      borders: thinBorders,
    })
  );

  // 2. production_lines
  elements.push(createH3('2. Bảng PRODUCTION_LINES (Dây chuyền Sản xuất - Tầng 1)'));
  const linesRows = [
    new TableRow({
      children: [
        createCell('Tên Trường', { isHeader: true, widthPercent: 20 }),
        createCell('Kiểu Dữ Liệu', { isHeader: true, widthPercent: 18 }),
        createCell('Khóa / Null', { isHeader: true, widthPercent: 17 }),
        createCell('Mặc Định', { isHeader: true, widthPercent: 15 }),
        createCell('Mô Tả Nghiệp Vụ', { isHeader: true, widthPercent: 30 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('id', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('PRIMARY KEY, NOT NULL'),
        createCell('None'),
        createCell('Mã dây chuyền (LINE-01, LINE-02, LINE-03)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('name', { bold: true }),
        createCell('VARCHAR(128)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Tên đầy đủ của dây chuyền sản xuất'),
      ],
    }),
    new TableRow({
      children: [
        createCell('code', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Mã ký hiệu nội bộ (LN-PRS-01, LN-PNT-02...)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('status', { bold: true }),
        createCell('VARCHAR(32)'),
        createCell('NOT NULL'),
        createCell("'normal'"),
        createCell('Trạng thái tổng quan (normal, warning, critical)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('safetyScore', { bold: true }),
        createCell('INT'),
        createCell('NULL'),
        createCell('95'),
        createCell('Chỉ số an toàn tổng hợp (%)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('targetOutput', { bold: true }),
        createCell('INT'),
        createCell('NULL'),
        createCell('1200'),
        createCell('Sản lượng mục tiêu của ca (chi tiết)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('actualOutput', { bold: true }),
        createCell('INT'),
        createCell('NULL'),
        createCell('1140'),
        createCell('Sản lượng thực tế đã hoàn thành'),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: linesRows,
      borders: thinBorders,
    })
  );

  // 3. machines
  elements.push(createH3('3. Bảng MACHINES (Máy móc & Thiết bị Kỹ thuật - Tầng 2)'));
  const machRows = [
    new TableRow({
      children: [
        createCell('Tên Trường', { isHeader: true, widthPercent: 20 }),
        createCell('Kiểu Dữ Liệu', { isHeader: true, widthPercent: 18 }),
        createCell('Khóa / Null', { isHeader: true, widthPercent: 17 }),
        createCell('Mặc Định', { isHeader: true, widthPercent: 15 }),
        createCell('Mô Tả Nghiệp Vụ', { isHeader: true, widthPercent: 30 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('id', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('PRIMARY KEY, NOT NULL'),
        createCell('None'),
        createCell('Mã định danh máy (MCH-PRS-01, MCH-WLD-01...)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('lineId', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('INDEX, NOT NULL'),
        createCell('None'),
        createCell('Khóa ngoại tham chiếu bảng production_lines'),
      ],
    }),
    new TableRow({
      children: [
        createCell('name', { bold: true }),
        createCell('VARCHAR(128)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Tên thương mại của máy (Máy dập 500T Komatsu...)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('code', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Mã trạm (STP-01, ROB-01, PNT-01...)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('type', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Chủng loại máy (hydraulic_press, welding_robot...)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('status', { bold: true }),
        createCell('VARCHAR(32)'),
        createCell('NOT NULL'),
        createCell("'normal'"),
        createCell('Trạng thái sức khỏe máy (normal/warning/critical)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('healthScore', { bold: true }),
        createCell('INT'),
        createCell('NULL'),
        createCell('95'),
        createCell('Điểm sức khỏe thiết bị (0 - 100)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('uptimeHours', { bold: true }),
        createCell('INT'),
        createCell('NULL'),
        createCell('120'),
        createCell('Số giờ vận hành liên tục không sự cố'),
      ],
    }),
    new TableRow({
      children: [
        createCell('qrCodeUrl', { bold: true }),
        createCell('VARCHAR(255)'),
        createCell('NULL'),
        createCell('NULL'),
        createCell('Đường dẫn QR Code nhận diện thiết bị'),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: machRows,
      borders: thinBorders,
    })
  );

  // 4. machine_telemetry_history
  elements.push(createH3('4. Bảng MACHINE_TELEMETRY_HISTORY (Lịch sử Telemetry Chuỗi Thời Gian)'));
  const telemRows = [
    new TableRow({
      children: [
        createCell('Tên Trường', { isHeader: true, widthPercent: 18 }),
        createCell('Kiểu Dữ Liệu', { isHeader: true, widthPercent: 18 }),
        createCell('Khóa / Null', { isHeader: true, widthPercent: 16 }),
        createCell('Mặc Định', { isHeader: true, widthPercent: 15 }),
        createCell('Mô Tả Nghiệp Vụ', { isHeader: true, widthPercent: 33 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('id', { bold: true }),
        createCell('VARCHAR(96)'),
        createCell('PRIMARY KEY, NOT NULL'),
        createCell('None'),
        createCell('Khóa xác định SHA-256 từ line_machine_metric_time'),
      ],
    }),
    new TableRow({
      children: [
        createCell('timestamp', { bold: true }),
        createCell('DATETIME(3)'),
        createCell('INDEX, NOT NULL'),
        createCell('None'),
        createCell('Thời điểm ghi nhận sự kiện (Múi giờ UTC, độ chính xác ms)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('lineId', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('INDEX, NOT NULL'),
        createCell('None'),
        createCell('Mã dây chuyền phát sinh dữ liệu'),
      ],
    }),
    new TableRow({
      children: [
        createCell('lineName', { bold: true }),
        createCell('VARCHAR(128)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Tên dây chuyền thời điểm ghi nhận'),
      ],
    }),
    new TableRow({
      children: [
        createCell('machineId', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('INDEX, NOT NULL'),
        createCell('None'),
        createCell('Mã máy đo lường'),
      ],
    }),
    new TableRow({
      children: [
        createCell('machineName', { bold: true }),
        createCell('VARCHAR(128)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Tên máy đo lường'),
      ],
    }),
    new TableRow({
      children: [
        createCell('metricId', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('INDEX, NOT NULL'),
        createCell('None'),
        createCell('Mã chỉ số cảm biến (MTR-CYL-01-PRS...)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('metricName', { bold: true }),
        createCell('VARCHAR(128)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Tên chỉ số kỹ thuật'),
      ],
    }),
    new TableRow({
      children: [
        createCell('value', { bold: true }),
        createCell('DECIMAL(10, 2)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Giá trị số thực đo lường kỹ thuật (chính xác 2 thập phân)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('unit', { bold: true }),
        createCell('VARCHAR(32)'),
        createCell('NOT NULL'),
        createCell('None'),
        createCell('Đơn vị đo (bar, °C, mm/s, N·m, L/min)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('status', { bold: true }),
        createCell("ENUM('normal','warning','critical')"),
        createCell('INDEX, NOT NULL'),
        createCell('None'),
        createCell('Trạng thái đánh giá tại thời điểm đo'),
      ],
    }),
    new TableRow({
      children: [
        createCell('source', { bold: true }),
        createCell("ENUM('simulation','device')"),
        createCell('NOT NULL'),
        createCell("'simulation'"),
        createCell('Nguồn gốc dữ liệu (Mô phỏng vs Cảm biến thật)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('plcStationId', { bold: true }),
        createCell('VARCHAR(64)'),
        createCell('NULL'),
        createCell('NULL'),
        createCell('Trạm PLC tiếp nhận tín hiệu'),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: telemRows,
      borders: thinBorders,
    })
  );

  // 5. audit_logs & 6. plc_stations
  elements.push(createH3('5. Bảng AUDIT_LOGS & Bảng PLC_STATIONS'));
  elements.push(
    createPara(
      '• Bảng AUDIT_LOGS: id VARCHAR(64) PK, userId VARCHAR(64), userEmail VARCHAR(128), userName VARCHAR(128), employeeId VARCHAR(32), action VARCHAR(64) (LOGIN, LOGOUT, CREATE_USER, UPDATE_USER, DELETE_USER, RESET_PASSWORD, UPDATE_THRESHOLD, TOGGLE_PLC, ACKNOWLEDGE_ALARM, RESOLVE_ALARM), target VARCHAR(128), details TEXT, ipAddress VARCHAR(64), timestamp DATETIME DEFAULT CURRENT_TIMESTAMP.'
    )
  );
  elements.push(
    createPara(
      '• Bảng PLC_STATIONS: id VARCHAR(64) PK, name VARCHAR(128), protocol VARCHAR(32) (Modbus/TCP, OPC-UA), ipAddress VARCHAR(64), port INT, isConnected BOOLEAN, latencyMs INT, tagsCount INT, lastSync VARCHAR(64), pollingRateMs INT.'
    )
  );

  // =========================================================================
  // CHƯƠNG 8: ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG (UI/UX SPECIFICATION)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 8: ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG (UI/UX SPECIFICATION)'));

  elements.push(createH2('8.1. Đặc tả màn hình Luồng & Thành phần Máy móc (Tier 2 Machine List)'));
  elements.push(
    createPara(
      'Màn hình Luồng & Thành phần (MachineListView.tsx) là trung tâm điều phối giám sát kỹ thuật của phân xưởng. Giao diện được cấu trúc theo bố cục 2 vùng rõ ràng: (1) Thanh Pipeline ngang hiển thị tiến độ và trạng thái 3 dây chuyền sản xuất; (2) Danh mục máy móc chi tiết với mã QR nhận diện, nút chẩn đoán thông số và công tắc chuyển trạng thái giám sát (CustomSwitch).'
    )
  );

  // Chèn hình ảnh thực tế Tier 2 nếu có
  if (fs.existsSync(imgTier2Path)) {
    try {
      const imgBuffer = fs.readFileSync(imgTier2Path);
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 80 },
          children: [
            new ImageRun({
              data: imgBuffer,
              transformation: { width: 550, height: 260 },
            }),
          ],
        })
      );
      elements.push(
        createPara(
          'Hình 8.1: Giao diện thực tế Màn hình Luồng & Thành phần (Tier 2 - Machine List View)',
          { italic: true, alignment: AlignmentType.CENTER, size: 22 }
        )
      );
    } catch (e) {
      console.warn('Bỏ qua chèn ảnh Tier 2:', e.message);
    }
  }

  elements.push(createH2('8.2. Đặc tả Modal Chi tiết Chỉ số & Biểu đồ Tầng 3 (Machine Detail Modal)'));
  elements.push(
    createPara(
      'Khi người dùng nhấp vào nút "Chẩn đoán" trên bất kỳ máy nào hoặc quét mã QR tại hiện trường, hệ thống mở Modal Chi tiết Component (MachineDetailModal.tsx). Giao diện hiển thị: (1) Banner thuộc tính máy và dây chuyền; (2) Các thẻ chỉ số đo lường hiện tại (Nhiệt độ, Áp suất, Độ rung, Dòng điện) với mã màu trạng thái; (3) Biểu đồ diện tích biến thiên chuỗi thời gian Recharts (AreaChart) với 3 dải mốc thời gian: 1 giờ, 6 giờ và 24 giờ.'
    )
  );

  // Chèn hình ảnh thực tế Tier 3 nếu có
  if (fs.existsSync(imgTier3Path)) {
    try {
      const imgBuffer3 = fs.readFileSync(imgTier3Path);
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 80 },
          children: [
            new ImageRun({
              data: imgBuffer3,
              transformation: { width: 550, height: 260 },
            }),
          ],
        })
      );
      elements.push(
        createPara(
          'Hình 8.2: Giao diện thực tế Modal Chi tiết Chỉ số & Biểu đồ Biến thiên Chuỗi thời gian (Tier 3)',
          { italic: true, alignment: AlignmentType.CENTER, size: 22 }
        )
      );
    } catch (e) {
      console.warn('Bỏ qua chèn ảnh Tier 3:', e.message);
    }
  }

  elements.push(createH2('8.3. Đặc tả màn hình Lịch sử Hoạt động Máy & Xuất Dữ liệu (MachineHistoryView)'));
  elements.push(
    createPara(
      'Màn hình Lịch sử hoạt động máy (MachineHistoryView.tsx) là phân hệ phục vụ truy vấn và kết xuất dữ liệu lịch sử. Được tích hợp bảng dữ liệu HeroUI Table với các tính năng chuyên nghiệp:'
    )
  );
  elements.push(
    createPara(
      '• Thanh lọc Cascade phân cấp: Menu chọn Dây chuyền → Menu Thiết bị tự động cập nhật theo chuyền đã chọn → Menu Chỉ số tự động lọc theo thiết bị.'
    )
  );
  elements.push(
    createPara(
      '• Phím tắt ca làm việc: 3 nút bấm một chạm "Ca 1 (06:00 - 14:00)", "Ca 2 (14:00 - 22:00)" và "Ca 3 Đêm (22:00 - 06:00)" tự động tính toán chính xác bước nhảy ngày dương lịch UTC.'
    )
  );
  elements.push(
    createPara(
      '• Menu Xuất dữ liệu đa định dạng: Dropdown menu cung cấp 3 lựa chọn xuất file: (1) Excel (.xlsx) OpenXML nén nhị phân có styling; (2) CSV (.csv) UTF-8 có BOM chống lỗi font tiếng Việt; (3) JSON (.json) phân cấp phục vụ huấn luyện mô hình AI.'
    )
  );
  elements.push(
    createPara(
      '• Cảnh báo an toàn (Safety Banners): Cảnh báo màu vàng khi số lượng kết quả vượt trần 10.000 dòng; Biểu tượng Database màu hổ phách cảnh báo trạng thái Degraded Mode khi CSDL trung tâm ngoại tuyến.'
    )
  );

  // =========================================================================
  // CHƯƠNG 9: KIỂM THỬ NGHIỆP VỤ & MA TRẬN TRUY VẾT YÊU CẦU (RTM)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 9: KIỂM THỬ NGHIỆP VỤ & MA TRẬN TRUY VẾT YÊU CẦU (RTM)'));

  elements.push(createH2('9.1. Ma trận Truy Vết Yêu Cầu (Requirement Traceability Matrix - RTM)'));
  elements.push(
    createPara(
      'Ma trận RTM dưới đây thiết lập mối liên kết truy vết 2 chiều khép kín từ Mục tiêu nghiệp vụ (Business Goal) → Yêu cầu chức năng (FR) → Quy tắc nghiệp vụ (BR) → File Mã nguồn thực tế → Kịch bản kiểm thử (Test Case):'
    )
  );

  const rtmRows = [
    new TableRow({
      children: [
        createCell('Mã FR', { isHeader: true, widthPercent: 8 }),
        createCell('Mục Tiêu Nghiệp Vụ', { isHeader: true, widthPercent: 20 }),
        createCell('Quy Tắc BR', { isHeader: true, widthPercent: 12 }),
        createCell('File Mã Nguồn Chính', { isHeader: true, widthPercent: 35 }),
        createCell('Mã Test Case', { isHeader: true, widthPercent: 15 }),
        createCell('Kết Quả', { isHeader: true, widthPercent: 10 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-001', { bold: true }),
        createCell('Xác thực danh tính an toàn'),
        createCell('BR-11'),
        createCell('server/index.js (L192)\nLoginPage.tsx'),
        createCell('API-04'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-004', { bold: true }),
        createCell('Giám sát toàn diện 3 chuyền'),
        createCell('BR-01, 02, 03'),
        createCell('LineOverviewDashboard.tsx\nuseMonitoringStore.ts'),
        createCell('DB-08'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-008', { bold: true }),
        createCell('Cài đặt ngưỡng kỹ thuật'),
        createCell('BR-01'),
        createCell('ThresholdConfigView.tsx\nserver/index.js (L559)'),
        createCell('API-04'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-009', { bold: true }),
        createCell('Điều khiển kết nối trạm PLC'),
        createCell('BR-01'),
        createCell('server/index.js (L583)\nserver/db-mysql.js (L417)'),
        createCell('ENV-01'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-010', { bold: true }),
        createCell('Chuẩn hóa xử lý sự cố'),
        createCell('BR-04, 05'),
        createCell('AlarmLogView.tsx\nuseAlarmStore.ts'),
        createCell('TC-ALM-01'),
        createCell('PASS (Mem)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-012', { bold: true }),
        createCell('Quản trị tài khoản & RBAC'),
        createCell('BR-11'),
        createCell('server/index.js (L331)\nUserManagementView.tsx'),
        createCell('API-04'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-014', { bold: true }),
        createCell('Nhật ký kiểm toán minh bạch'),
        createCell('BR-11'),
        createCell('server/index.js (L548)\nAuditLogView.tsx'),
        createCell('TC-AUD-01'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-016', { bold: true }),
        createCell('Lưu trữ lịch sử máy bền vững'),
        createCell('BR-06, 07, 12'),
        createCell('server/db-mysql.js (L217)\nserver/index.js (L657)'),
        createCell('DB-03, 04, 05'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-017', { bold: true }),
        createCell('Lọc dữ liệu ca đêm chính xác'),
        createCell('BR-07, 08'),
        createCell('server/db-mysql.js (L550)\nMachineHistoryView.tsx'),
        createCell('DB-09'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-018', { bold: true }),
        createCell('Xuất 3 định dạng Excel/CSV/JSON'),
        createCell('BR-10'),
        createCell('src/utils/exportEngine.ts\nverify_real_exports.js'),
        createCell('EXP-01 đến 06'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-019', { bold: true }),
        createCell('Bảo vệ an toàn bộ nhớ máy chủ'),
        createCell('BR-09'),
        createCell('server/index.js (L781)\nserver/db-mysql.js (L680)'),
        createCell('DB-10A'),
        createCell('PASS', { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-020', { bold: true }),
        createCell('Ghi telemetry tự động ngầm 5s'),
        createCell('BR-06, 12'),
        createCell('server/index.js (L905)\nserver/db-mysql.js (L462)'),
        createCell('DB-01, 02'),
        createCell('PASS', { bold: true }),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rtmRows,
      borders: thinBorders,
    })
  );

  elements.push(createH2('9.2. Những nội dung chưa thể xác minh trong phòng Lab'));
  elements.push(
    createPara(
      'Là một chuyên viên phân tích nghiệp vụ đề cao tính khách quan và tính chính xác kỹ thuật, tôi liệt kê rõ các nội dung chưa đủ bằng chứng để xác minh thực tế:'
    )
  );
  elements.push(
    createPara(
      '1. Khả năng kết nối phần cứng PLC thực tế: Do hạn chế của môi trường thử nghiệm phòng Lab, hệ thống chưa được cắm cáp Ethernet công nghiệp kết nối trực tiếp vào module CPU của Siemens S7-1500 hoặc Omron NX1P2 tại nhà xưởng. Cần thực hiện kiểm thử thực địa (On-site Field Testing) trong giai đoạn tiếp theo.'
    )
  );
  elements.push(
    createPara(
      '2. Khả năng chịu tải đồng thời trên 1.000 người dùng: Hệ thống mới kiểm thử xác nhận tính đúng đắn về mặt chức năng và tính toàn vẹn dữ liệu trong phạm vi môi trường Development; chưa thực hiện bài kiểm thử tải áp lực (Stress Test) mô phỏng hàng nghìn kết nối WebSocket đồng thời.'
    )
  );
  elements.push(
    createPara(
      '3. Độ trễ mạng viễn thông diện rộng (WAN): Các kiểm nghiệm độ trễ < 100ms được đo lường trên môi trường mạng cục bộ máy chủ; chưa đo đạc trên hạ tầng 4G/5G công nghiệp khi kỹ thuật viên truy cập từ ngoài nhà máy.'
    )
  );

  // =========================================================================
  // CHƯƠNG 10: ĐÁNH GIÁ TỔNG THỂ & LỘ TRÌNH PHÁT TRIỂN (ROADMAP)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 10: ĐÁNH GIÁ TỔNG THỂ & LỘ TRÌNH PHÁT TRIỂN (ROADMAP)'));

  elements.push(createH2('10.1. Tổng hợp các chức năng đã hoàn thành và sẵn sàng vận hành'));
  elements.push(
    createPara(
      'Hệ thống DENSO IoT Monitoring đã hoàn thành xuất sắc các phân hệ cốt lõi: Nền tảng CSDL MySQL bền vững, kiến trúc phân quyền RBAC 2 đầu chặt chẽ, luồng phát sóng WebSocket thời gian thực, bảng điều khiển 3 Tầng trực quan, cơ chế tiếp nhận sự cố khẩn cấp, tra cứu mã QR và đặc biệt là phân hệ Lịch sử hoạt động máy với động cơ xuất dữ liệu 3 định dạng không phụ thuộc thư viện ngoài (Zero-dependency).'
    )
  );

  elements.push(createH2('10.2. Các vấn đề kỹ thuật cần khắc phục trong Sprint tới'));
  elements.push(
    createPara(
      '1. Bảng CSDL sự cố (Alarms Table): Cần chuyển đổi lưu trữ sự cố từ bộ nhớ Client Zustand (useAlarmStore) thành bảng quan hệ alarms trong MySQL để lưu vết sự cố vĩnh viễn và liên kết khóa ngoại với machine_telemetry_history.'
    )
  );
  elements.push(
    createPara(
      '2. Đồng bộ vai trò MAINTENANCE trên giao diện: Bổ sung tùy chọn lọc và phân quyền trực tiếp vai trò Kỹ thuật viên bảo trì trên trang Quản lý Người dùng (UserManagementView).'
    )
  );
  elements.push(
    createPara(
      '3. Tối ưu hóa kích thước gói đóng gói (Code Splitting): Phân tách các module nặng bằng dynamic import() để giảm kích thước bundle frontend (hiện có chunk > 500KB) nhằm tối ưu tốc độ tải trang ban đầu trên thiết bị di động công nghiệp.'
    )
  );

  elements.push(createH2('10.3. Lộ trình nâng cấp hệ thống theo 3 giai đoạn (Roadmap)'));
  elements.push(
    createPara(
      '• Giai đoạn 1 (Hiện tại - Pilot Lab): Hoàn thiện toàn bộ Web Dashboard, Backend, WebSocket, CSDL MySQL và động cơ xuất dữ liệu lịch sử trên môi trường mô phỏng tập trung. Đạt 100% tiêu chí demo cho DENSO Hackathon 2026.'
    )
  );
  elements.push(
    createPara(
      '• Giai đoạn 2 (Quý 1/2027 - Triển khai Thí điểm Pilot Line 1): Lắp đặt bộ chuyển đổi Industrial IoT Gateway (hỗ trợ Modbus/TCP và OPC-UA) tại Dây chuyền Dập & Hàn; kết nối đọc dữ liệu thực tế từ 2 máy Komatsu và Fanuc; đánh giá độ trễ và độ tin cậy trong môi trường nhiễu công nghiệp.'
    )
  );
  elements.push(
    createPara(
      '• Giai đoạn 3 (Quý 3/2027 - Mở rộng Toàn xưởng & Trí Tuệ Nhân Tạo AI): Triển khai Gateway trên toàn bộ 3 dây chuyền sản xuất; tích hợp mô hình học máy (Machine Learning Anomaly Detection) sử dụng tập dữ liệu JSON đã được chuẩn hóa để dự đoán sớm nguy cơ kẹt trục và quá nhiệt trước 48 giờ; tích hợp cổng gửi tin nhắn thông báo khẩn cấp tới ứng dụng nhắn tin của quản đốc.'
    )
  );

  elements.push(createH2('10.4. Kết luận của Chuyên viên Phân tích Nghiệp vụ (Senior BA)'));
  elements.push(
    createPara(
      'Hệ thống DENSO Industrial IoT Monitoring (KaiLink) sở hữu nền tảng kiến trúc vững chắc, logic nghiệp vụ thực tế bám sát quy trình sản xuất của Tập đoàn DENSO và mã nguồn có chất lượng hoàn thiện cao. Bộ tài liệu nghiệp vụ BA này phản ánh chính xác 100% hiện trạng phần mềm đã được kiểm thử, đóng vai trò là kim chỉ nam đặc tả nghiệp vụ phục vụ công tác nghiệm thu của Hội đồng Kỹ thuật và là nền tảng vững vàng cho các giai đoạn nâng cấp mở rộng trong tương lai.'
    )
  );

  return elements;
}
