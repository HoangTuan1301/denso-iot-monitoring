/**
 * @file scripts/generate_ba_v2_part4.js
 * @description Part 4 of BA Documentation v2.0:
 *  - Chapter 7: Kiến Trúc Dữ Liệu & Mô Hình Hóa (ERD, Data Dictionary 6 bảng, DFD 0/1, MySQL vs Zustand)
 *  - Chapter 8: Đặc Tả Giao Diện Người Dùng (10 Màn hình SCR-01..10 kèm ảnh minh chứng thực tế)
 */

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  WidthType,
  AlignmentType,
} from 'docx';

import {
  createPara,
  createH1,
  createH2,
  createH3,
  createH4,
  createCell,
  createImageParas,
  thinBorders,
  imgLoginPath,
  imgTier2Path,
  imgTier3Path,
  imgRenderLogPath,
} from './generate_ba_v2_helpers.js';

export function getV2Part4Elements() {
  const elements = [];

  // =========================================================================
  // CHƯƠNG 7: KIẾN TRÚC DỮ LIỆU & MÔ HÌNH HÓA (DATA ARCHITECTURE & MODELING)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 7: KIẾN TRÚC DỮ LIỆU & MÔ HÌNH HÓA (DATA ARCHITECTURE & MODELING)'));

  elements.push(
    createPara(
      'Chương 7 mô tả chi tiết kiến trúc dữ liệu và mô hình hóa của hệ thống DENSO IoT Monitoring (KaiLink). Hệ thống áp dụng mô hình phân tách hai tầng dữ liệu: Tầng dữ liệu quan hệ bền vững (Relational Persistent Storage) trên hệ quản trị cơ sở dữ liệu MySQL 8.0 cho thông tin cấu hình, người dùng, chuỗi thời gian telemetry và nhật ký kiểm toán; cùng với Tầng dữ liệu trạng thái bộ nhớ đệm thời gian thực (In-Memory Real-time State) trên Client (Zustand Store) kết hợp bộ phát thanh WebSocket từ Backend Node.js. Toàn bộ định nghĩa bảng và kiểu dữ liệu dưới đây được trích xuất trực tiếp từ mã nguồn thực tế tại server/db-mysql.js.'
    )
  );

  // 7.1 ERD
  elements.push(createH2('7.1. Sơ đồ mối quan hệ thực thể (Entity Relationship Diagram - ERD)'));
  elements.push(
    createPara(
      'Cơ sở dữ liệu quan hệ của hệ thống KaiLink bao gồm 6 bảng thực thể chính được thiết kế chuẩn hóa để phục vụ các luồng nghiệp vụ giám sát nhà máy:'
    )
  );

  const erdText =
`+------------------+         1 : N         +----------------------+
| production_lines |--------------------->|       machines       |
+------------------+                      +----------------------+
| PK: id           |                      | PK: id               |
|     name         |                      | FK: lineId --------->|
|     code         |                      |     name             |
|     safetyScore  |                      |     code             |
|     targetOutput |                      |     type             |
|     actualOutput |                      |     status           |
+------------------+                      |     healthScore      |
         |                                +----------------------+
         | 1 : N                                     |
         |                                           | 1 : N
         v                                           v
+----------------------------------------------------------------+
|                   machine_telemetry_history                    |
+----------------------------------------------------------------+
| PK: id (SHA-256 Deterministic Hash)                            |
|     timestamp DATETIME(3) (Chuẩn hóa UTC ISO-8601)             |
| FK: lineId, lineName                                           |
| FK: machineId, machineName                                     |
|     metricId, metricName, value DECIMAL(10,2), unit            |
|     status ('normal', 'warning', 'critical')                   |
|     source ('simulation', 'device')                            |
| FK: plcStationId (NULLable)                                    |
+----------------------------------------------------------------+
                               ^
+------------------+           |
|   plc_stations   |-----------+ (Tham chiếu luận lý qua plcStationId)
+------------------+
| PK: id           |
|     name         |
|     protocol     |
|     ipAddress    |
+------------------+

+------------------+         1 : N         +----------------------+
|      users       |--------------------->|      audit_logs      |
+------------------+                      +----------------------+
| PK: id           |                      | PK: id               |
|     employeeId   |                      | FK: userId           |
|     email        |                      |     userEmail        |
|     role         |                      |     action           |
|     assignedLine |                      |     target, details  |
+------------------+                      +----------------------+`;

  elements.push(
    createPara(erdText, {
      size: 20,
      font: 'Consolas',
      color: '1A365D',
      alignment: AlignmentType.LEFT,
      bgColor: 'F7FAFC',
    })
  );

  // 7.2 Data Dictionary
  elements.push(createH2('7.2. Từ điển dữ liệu chi tiết (Data Dictionary - 6 Bảng MySQL 8.0)'));
  elements.push(
    createPara(
      'Dưới đây là từ điển dữ liệu chi tiết của toàn bộ 6 bảng cơ sở dữ liệu quan hệ, được đối chiếu trực tiếp với các câu lệnh DDL trong server/db-mysql.js:'
    )
  );

  // Helper tạo bảng từ điển
  const renderDictionaryTable = (title, columns) => {
    elements.push(createH3(title));
    const rows = [
      new TableRow({
        children: [
          createCell('Tên trường', { isHeader: true, widthPercent: 18 }),
          createCell('Kiểu dữ liệu', { isHeader: true, widthPercent: 16 }),
          createCell('Ràng buộc', { isHeader: true, widthPercent: 22 }),
          createCell('Mặc định', { isHeader: true, widthPercent: 14 }),
          createCell('Mô tả nghiệp vụ', { isHeader: true, widthPercent: 30 }),
        ],
      }),
    ];
    columns.forEach((col) => {
      rows.push(
        new TableRow({
          children: [
            createCell(col[0], { bold: true }),
            createCell(col[1]),
            createCell(col[2]),
            createCell(col[3]),
            createCell(col[4]),
          ],
        })
      );
    });
    elements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: thinBorders,
      })
    );
    elements.push(createPara(' '));
  };

  // Bảng 1: users
  renderDictionaryTable('7.2.1 Bảng users (Tài khoản người dùng & Hồ sơ phân quyền)', [
    ['id', 'VARCHAR(64)', 'PRIMARY KEY, NOT NULL', 'None', 'Mã định danh duy nhất (vd: usr-admin-01)'],
    ['employeeId', 'VARCHAR(32)', 'UNIQUE, NOT NULL', 'None', 'Mã số thẻ nhân viên DENSO (vd: DNS-1001)'],
    ['fullName', 'VARCHAR(128)', 'NOT NULL', 'None', 'Họ và tên đầy đủ của nhân viên'],
    ['email', 'VARCHAR(128)', 'UNIQUE, NOT NULL', 'None', 'Địa chỉ email công ty dùng để đăng nhập'],
    ['password', 'VARCHAR(255)', 'NOT NULL', 'None', 'Mật khẩu băm Bcrypt 10 vòng muối (Salted Hash)'],
    ['role', "ENUM('ADMIN', 'OPERATOR', 'MAINTENANCE')", 'NOT NULL', "'OPERATOR'", 'Vai trò phân quyền RBAC'],
    ['assignedLineId', 'VARCHAR(64)', 'NULLABLE', "'ALL'", 'Dây chuyền được phân công phụ trách'],
    ['avatarUrl', 'VARCHAR(255)', 'NULLABLE', 'NULL', 'Đường dẫn ảnh đại diện (/uploads/avatars/...)'],
    ['status', "ENUM('ACTIVE', 'INACTIVE')", 'NOT NULL', "'ACTIVE'", 'Trạng thái hoạt động tài khoản'],
    ['createdAt', 'DATETIME', 'NOT NULL', 'CURRENT_TIMESTAMP', 'Thời điểm tạo tài khoản'],
    ['lastLoginAt', 'DATETIME', 'NULLABLE', 'NULL', 'Thời điểm đăng nhập thành công gần nhất'],
  ]);

  // Bảng 2: production_lines
  renderDictionaryTable('7.2.2 Bảng production_lines (Danh mục dây chuyền sản xuất)', [
    ['id', 'VARCHAR(64)', 'PRIMARY KEY, NOT NULL', 'None', 'Mã dây chuyền (vd: LINE-01, LINE-02)'],
    ['name', 'VARCHAR(128)', 'NOT NULL', 'None', 'Tên đầy đủ của dây chuyền sản xuất'],
    ['code', 'VARCHAR(64)', 'NOT NULL', 'None', 'Mã ký hiệu nội bộ (vd: LN-PRS-01)'],
    ['status', 'VARCHAR(32)', 'NOT NULL', "'normal'", "Trạng thái vận hành ('normal', 'warning', 'critical')"],
    ['safetyScore', 'INT', 'NOT NULL', '95', 'Điểm an toàn dây chuyền (0 - 100%)'],
    ['targetOutput', 'INT', 'NOT NULL', '1200', 'Mục tiêu sản lượng ca kế hoạch (pcs)'],
    ['actualOutput', 'INT', 'NOT NULL', '1140', 'Sản lượng thực tế lũy kế ghi nhận (pcs)'],
    ['createdAt', 'DATETIME', 'NOT NULL', 'CURRENT_TIMESTAMP', 'Thời điểm khởi tạo bản ghi'],
  ]);

  // Bảng 3: machines
  renderDictionaryTable('7.2.3 Bảng machines (Danh mục máy móc & Thiết bị công nghiệp Tầng 2)', [
    ['id', 'VARCHAR(64)', 'PRIMARY KEY, NOT NULL', 'None', 'Mã định danh duy nhất của máy (vd: MCH-PRS-01)'],
    ['lineId', 'VARCHAR(64)', 'INDEX idx_line_id, NOT NULL', 'None', 'Khóa ngoại luận lý tham chiếu production_lines.id'],
    ['name', 'VARCHAR(128)', 'NOT NULL', 'None', 'Tên thiết bị (vd: Máy Dập Thủy Lực 500T Komatsu)'],
    ['code', 'VARCHAR(64)', 'NOT NULL', 'None', 'Mã máy tại xưởng (vd: STP-01, ROB-01)'],
    ['type', 'VARCHAR(64)', 'NOT NULL', 'None', 'Chủng loại thiết bị (hydraulic_press, welding_robot, ...)'],
    ['status', 'VARCHAR(32)', 'NOT NULL', "'normal'", "Trạng thái vận hành ('normal', 'warning', 'critical')"],
    ['healthScore', 'INT', 'NOT NULL', '95', 'Chỉ số sức khỏe kỹ thuật thiết bị (0 - 100%)'],
    ['uptimeHours', 'INT', 'NOT NULL', '120', 'Tổng số giờ vận hành liên tục lũy kế'],
    ['qrCodeUrl', 'VARCHAR(255)', 'NULLABLE', 'NULL', 'Đường dẫn ảnh mã QR dán trên thân máy'],
    ['createdAt', 'DATETIME', 'NOT NULL', 'CURRENT_TIMESTAMP', 'Thời điểm khởi tạo bản ghi'],
  ]);

  // Bảng 4: plc_stations
  renderDictionaryTable('7.2.4 Bảng plc_stations (Danh mục trạm PLC kết nối)', [
    ['id', 'VARCHAR(64)', 'PRIMARY KEY, NOT NULL', 'None', 'Mã trạm PLC (vd: PLC-STATION-01)'],
    ['name', 'VARCHAR(128)', 'NOT NULL', 'None', 'Tên trạm điều khiển (Siemens S7-1500 / Omron NX1P2)'],
    ['protocol', 'VARCHAR(32)', 'NOT NULL', 'None', "Giao thức truyền thông ('Modbus/TCP', 'OPC-UA')"],
    ['ipAddress', 'VARCHAR(64)', 'NOT NULL', 'None', 'Địa chỉ IP mạng công nghiệp (vd: 192.168.1.100)'],
    ['port', 'INT', 'NOT NULL', 'None', 'Cổng dịch vụ (502 cho Modbus, 4840 cho OPC-UA)'],
    ['isConnected', 'BOOLEAN', 'NOT NULL', 'TRUE', 'Trạng thái kết nối truyền thông thời gian thực'],
    ['latencyMs', 'INT', 'NOT NULL', '12', 'Độ trễ truyền thông vòng (Ping Latency) tính bằng ms'],
    ['tagsCount', 'INT', 'NOT NULL', '24', 'Tổng số thanh ghi (Register Tags) được quét định kỳ'],
    ['lastSync', 'VARCHAR(64)', 'NOT NULL', "'Vừa xong'", 'Chuỗi biểu thị thời gian đồng bộ dữ liệu gần nhất'],
    ['pollingRateMs', 'INT', 'NOT NULL', '1000', 'Chu kỳ quét dữ liệu của tiến trình polling (ms)'],
  ]);

  // Bảng 5: machine_telemetry_history
  renderDictionaryTable('7.2.5 Bảng machine_telemetry_history (Chuỗi thời gian lịch sử hoạt động máy)', [
    ['id', 'VARCHAR(96)', 'PRIMARY KEY, NOT NULL', 'None', 'Khóa chính xác định SHA-256 (machineId+metricId+timestamp)'],
    ['timestamp', 'DATETIME(3)', 'INDEX idx_time_status, NOT NULL', 'None', 'Thời điểm đo chính xác mili-giây, lưu theo chuẩn UTC'],
    ['lineId', 'VARCHAR(64)', 'INDEX idx_line_time, NOT NULL', 'None', 'Mã dây chuyền phát sinh dữ liệu'],
    ['lineName', 'VARCHAR(128)', 'NOT NULL', 'None', 'Tên dây chuyền tại thời điểm ghi nhận (Denormalization)'],
    ['machineId', 'VARCHAR(64)', 'INDEX idx_machine_time, NOT NULL', 'None', 'Mã máy phát sinh dữ liệu'],
    ['machineName', 'VARCHAR(128)', 'NOT NULL', 'None', 'Tên máy tại thời điểm ghi nhận'],
    ['metricId', 'VARCHAR(64)', 'INDEX idx_metric_time, NOT NULL', 'None', 'Mã thông số kỹ thuật (vd: oil_pressure, motor_temp)'],
    ['metricName', 'VARCHAR(128)', 'NOT NULL', 'None', 'Tên hiển thị thông số (vd: Áp suất dầu thủy lực)'],
    ['value', 'DECIMAL(10, 2)', 'NOT NULL', 'None', 'Giá trị đo lường sau quy đổi từ thanh ghi thô'],
    ['unit', 'VARCHAR(32)', 'NOT NULL', 'None', 'Đơn vị đo lường công nghiệp (bar, °C, mm/s, A, rpm)'],
    ['status', "ENUM('normal', 'warning', 'critical')", 'INDEX idx_time_status, NOT NULL', 'None', 'Trạng thái ngưỡng kỹ thuật tại thời điểm lấy mẫu'],
    ['source', "ENUM('simulation', 'device')", 'NOT NULL', "'simulation'", "Nguồn dữ liệu: 'device' (PLC thực) hoặc 'simulation' (giả lập)"],
    ['plcStationId', 'VARCHAR(64)', 'NULLABLE', 'NULL', 'Mã trạm PLC thu thập (nếu có liên kết)'],
    ['createdAt', 'DATETIME', 'NOT NULL', 'CURRENT_TIMESTAMP', 'Thời điểm chèn bản ghi vào cơ sở dữ liệu'],
  ]);

  // Bảng 6: audit_logs
  renderDictionaryTable('7.2.6 Bảng audit_logs (Nhật ký kiểm toán & Truy vết hệ thống)', [
    ['id', 'VARCHAR(64)', 'PRIMARY KEY, NOT NULL', 'None', 'Mã kiểm toán duy nhất (vd: AUD-INIT-001)'],
    ['userId', 'VARCHAR(64)', 'NULLABLE', 'NULL', 'Định danh người dùng thực hiện hành động'],
    ['userEmail', 'VARCHAR(128)', 'NULLABLE', 'NULL', 'Email người dùng thực hiện hành động'],
    ['userName', 'VARCHAR(128)', 'NULLABLE', 'NULL', 'Họ tên nhân viên thực hiện hành động'],
    ['employeeId', 'VARCHAR(32)', 'NULLABLE', 'NULL', 'Mã số thẻ nhân viên thực hiện'],
    ['action', 'VARCHAR(64)', 'INDEX idx_action, NOT NULL', 'None', 'Mã hành động kiểm toán (LOGIN, ACK_ALARM, EXPORT_LOGS, ...)'],
    ['target', 'VARCHAR(128)', 'NULLABLE', 'NULL', 'Đối tượng tác động (auth, alarm, user, telemetry, export)'],
    ['details', 'TEXT', 'NULLABLE', 'NULL', 'Chi tiết mô tả ngữ cảnh hoặc thông số sự kiện'],
    ['ipAddress', 'VARCHAR(64)', 'NULLABLE', 'NULL', 'Địa chỉ IP Client của máy trạm gửi yêu cầu'],
    ['timestamp', 'DATETIME', 'INDEX idx_timestamp, NOT NULL', 'CURRENT_TIMESTAMP', 'Thời điểm ghi nhận hành động kiểm toán'],
  ]);

  // 7.3 DFD
  elements.push(createH2('7.3. Sơ đồ luồng dữ liệu (Data Flow Diagram - DFD)'));

  elements.push(createH3('7.3.1 DFD Mức 0 (Sơ đồ ngữ cảnh - Context Diagram)'));
  elements.push(
    createPara(
      'Sơ đồ DFD Mức 0 mô tả phạm vi ranh giới hệ thống KaiLink trong tương tác với các thực thể bên ngoài:'
    )
  );

  const dfd0Text =
`                               +-------------------------------+
                               |  Trạm PLC / Bộ Giả Lập Tín Hiệu |
                               +-------------------------------+
                                               |
                                               | 1. Gói tin Telemetry (Modbus/OPC-UA/Sim)
                                               v
+------------------+             +---------------------------+             +-----------------------+
|  Vận hành viên   | <=========> |                           | <=========> |  Kỹ sư Bảo trì / Admin |
|    (Operator)    | 2. Giám sát |   HỆ THỐNG GIÁM SÁT IoT   | 3. Xử lý sự |    (Maintenance/Admin)|
+------------------+    & Cảnh   |      DENSO KAILINK        |    cố, cấu  +-----------------------+
                        báo máy  +---------------------------+    hình, xuất
                                        |             |           dữ liệu
                                        |             |
                                4. Lưu  |             | 5. Truy vấn & Xuất file
                                        v             v
                             +-------------+     +-------------------+
                             | MySQL 8.0   |     | File Xuất Báo Cáo |
                             | Persistence |     | (.xlsx, .csv, json|
                             +-------------+     +-------------------+`;

  elements.push(
    createPara(dfd0Text, {
      size: 20,
      font: 'Consolas',
      color: '1A365D',
      alignment: AlignmentType.LEFT,
    })
  );

  elements.push(createH3('7.3.2 DFD Mức 1 (Sơ đồ phân rã chức năng - Decomposition Diagram)'));
  elements.push(
    createPara(
      'Hệ thống được phân rã thành 5 tiến trình luồng dữ liệu chính:\n' +
      '• Tiến trình 1.0 (Tiếp nhận & Chuẩn hóa Telemetry): Tiếp nhận thanh ghi thô từ PLC/Sim, chuyển đổi sang đơn vị kỹ thuật (BR-15), chuẩn hóa UTC (BR-07), sinh ID xác định SHA-256 (BR-06) và ghi vào machine_telemetry_history.\n' +
      '• Tiến trình 2.0 (Đánh giá Ngưỡng & Cảnh báo): Đối chiếu giá trị đo với 4 ngưỡng vận hành (BR-01), tính toán trạng thái máy (BR-02), cập nhật điểm an toàn dây chuyền (BR-03) và phát tín hiệu cảnh báo qua WebSocket tới Zustand useAlarmStore.\n' +
      '• Tiến trình 3.0 (Xác thực & Phân quyền): Kiểm tra định danh JWT, phân quyền vai trò RBAC, bảo vệ tài khoản quản trị (BR-11), kiểm tra tải lên avatar (BR-13) và ghi vết vào audit_logs.\n' +
      '• Tiến trình 4.0 (Truy vấn Lịch sử Vận hành): Tiếp nhận tham số bộ lọc từ MachineHistoryView, xử lý cuộn ngày ca đêm (BR-08), kiểm tra whitelist sắp xếp (BR-14) và truy vấn MySQL.\n' +
      '• Tiến trình 5.0 (Xuất Dữ liệu Đa Định dạng): Giới hạn an toàn 10,000 dòng (BR-09), làm sạch công thức chống CSV Injection (BR-10) và đóng gói nhị phân trả về máy trạm.'
    )
  );

  // 7.4 So sánh kỹ thuật MySQL vs Zustand
  elements.push(createH2('7.4. So sánh kỹ thuật: Lưu trữ Telemetry (MySQL) vs Quản lý Cảnh Báo (Zustand)'));
  elements.push(
    createPara(
      'Một nội dung cốt lõi của tài liệu BA v2.0 là phân định minh bạch giữa cơ chế lưu trữ chuỗi thời gian Telemetry và cơ chế quản lý sự cố Cảnh báo (Alarms). Bảng dưới đây so sánh toàn diện 8 khía cạnh kỹ thuật:'
    )
  );

  const compareRows = [
    new TableRow({
      children: [
        createCell('Tiêu chí so sánh', { isHeader: true, widthPercent: 20 }),
        createCell('Lưu trữ Telemetry Lịch Sử (MySQL 8.0)', { isHeader: true, widthPercent: 40 }),
        createCell('Quản lý Cảnh Báo Hiện Tại (Zustand Store)', { isHeader: true, widthPercent: 40 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('1. Nơi lưu trữ vật lý', { bold: true }),
        createCell('Bảng machine_telemetry_history trên CSDL MySQL 8.0 Development / Cloud.'),
        createCell('Bộ nhớ RAM trình duyệt máy trạm (Client Memory) qua React Zustand Store (useAlarmStore.ts).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('2. Độ bền vững qua F5/Reload', { bold: true }),
        createCell('Bền vững tuyệt đối (Persistent). Dữ liệu bảo toàn vĩnh viễn qua mọi thao tác F5, đóng trình duyệt hoặc restart server.'),
        createCell('Tạm thời trong phiên (Volatile). Dữ liệu cảnh báo bị đặt lại (reset) về danh sách mẫu khi người dùng làm mới trang (F5) hoặc đóng tab.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('3. Định danh bản ghi (ID)', { bold: true }),
        createCell('Định danh xác định SHA-256 Hash tính toán từ machineId, metricId và timestamp UTC (BR-06). Không bao giờ sinh trùng khi ghi lại.'),
        createCell('Chuỗi ngẫu nhiên sinh bằng Math.random() hoặc ALM-timestamp (tồn tại rủi ro xung đột mã sự cố khi chạy song song nhiều máy trạm).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('4. Dung lượng & Tải ghi', { bold: true }),
        createCell('Thiết kế chỉ mục B-Tree 4 tầng phục vụ hàng trăm ngàn dòng. Giới hạn xuất an toàn 10,000 bản ghi/lần (BR-09).'),
        createCell('Giới hạn trong mảng JavaScript client (khoảng vài trăm cảnh báo). Không thể mở rộng lưu trữ lịch sử sự cố nhiều năm.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('5. Khả năng truy vấn & Lọc', { bold: true }),
        createCell('Hỗ trợ câu lệnh SQL SELECT linh hoạt: lọc theo máy, dây chuyền, thông số, trạng thái, ca kíp sản xuất, phân trang LIMIT/OFFSET.'),
        createCell('Lọc mảng phía client (Array filter). Không có phân trang cơ sở dữ liệu.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('6. Ghi vết kiểm toán', { bold: true }),
        createCell('Ghi vết sự kiện xuất file vào bảng audit_logs với đầy đủ thông tin người xuất, số dòng, định dạng file.'),
        createCell('Chỉ gọi API ghi nhận audit_logs khi người dùng nhấn nút Xác nhận (Acknowledge) hoặc Khắc phục (Resolve).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('7. Rủi ro nghiệp vụ hiện tại', { bold: true }),
        createCell('Hiệu năng phụ thuộc tài nguyên máy chủ MySQL và độ trễ mạng internet kết nối CSDL đám mây.'),
        createCell('Kỹ sư bảo trì không thể tra cứu lại các sự cố cảnh báo đã xảy ra trong các ca trước nếu đã bị đóng tab trình duyệt.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('8. Lộ trình giải quyết Giai đoạn 2', { bold: true }),
        createCell('Bổ sung cơ chế nén dữ liệu cũ định kỳ (Data Archiving) và phân vùng bảng (Partitioning by RANGE(timestamp)).'),
        createCell('BẮT BUỘC thiết kế bảng alarms trong MySQL, chuyển đổi toàn bộ luồng tạo, xác nhận và giải quyết cảnh báo sang Backend API.'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: compareRows,
      borders: thinBorders,
    })
  );

  elements.push(createPara(' '));

  // =========================================================================
  // CHƯƠNG 8: ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG (UI/UX SPECIFICATION - 10 MÀN HÌNH)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 8: ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG (UI/UX SPECIFICATION)'));

  elements.push(
    createPara(
      'Chương 8 đặc tả chi tiết 10 màn hình giao diện người dùng của hệ thống DENSO IoT Monitoring (KaiLink). Giao diện được xây dựng trên nền tảng React 19, TypeScript, TailwindCSS và thư viện HeroUI v2. Thiết kế tuân thủ bảng màu chuẩn DENSO Corporate Identity (Màu đỏ chủ đạo #E60012, màu xanh hải quân #1A237E, nền tối công nghiệp #0F172A). Đối với các màn hình trọng yếu, tài liệu cung cấp hình ảnh chụp thực tế từ hệ thống đang chạy.'
    )
  );

  const renderScreenSpecTable = (screenId, title, fields) => {
    const screenNum = parseInt(screenId.replace('SCR-', ''), 10);
    elements.push(createH2(`8.${screenNum}. ${screenId}: ${title}`));
    const rows = [];
    fields.forEach(([label, value]) => {
      rows.push(
        new TableRow({
          children: [
            createCell(label, { bold: true, widthPercent: 28 }),
            createCell(value, { widthPercent: 72 }),
          ],
        })
      );
    });
    elements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: thinBorders,
      })
    );
    elements.push(createPara(' '));
  };

  // SCR-01
  renderScreenSpecTable('SCR-01', 'Hộp Thoại Đăng Nhập Hệ Thống (Login View)', [
    ['Mã & Tên màn hình', 'SCR-01: Hộp Thoại Đăng Nhập Hệ Thống (Login Modal)'],
    ['File mã nguồn Frontend', 'src/components/LoginModal.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Trạng thái Modal phủ (Overlay) khi nhấn nút "Đăng nhập" tại Header hoặc phiên hết hạn'],
    ['Đối tượng người dùng', 'Tất cả người dùng (ADMIN, OPERATOR, MAINTENANCE)'],
    ['Bố cục tổng quan (Layout)', 'Hộp thoại Modal căn giữa màn hình, hiệu ứng làm mờ nền (Backdrop Blur), phong cách DENSO Dark Theme. Header chứa Logo DENSO, tiêu đề "HỆ THỐNG GIÁM SÁT IoT" và phân hệ "Đăng nhập tài khoản nhà máy".'],
    ['Các điều khiển & Tương tác', '1. Input Email / Mã nhân viên (Placeholder: admin@denso.com).\n2. Input Mật khẩu (Che ký tự dạng password, có nút bật/tắt hiển thị mật khẩu).\n3. Nút chọn nhanh tài khoản Demo (Admin, Vận hành viên, Kỹ sư bảo trì).\n4. Checkbox "Ghi nhớ đăng nhập trên thiết bị này".\n5. Nút "Đăng nhập hệ thống" (DENSO Red Button, hiển thị Spinner khi đang xử lý).\n6. Nút đóng hộp thoại (Icon X góc phải trên).'],
    ['Ràng buộc & Xử lý lỗi', 'Kiểm tra định dạng email và độ dài mật khẩu (tối thiểu 6 ký tự). Nếu sai tài khoản hoặc mật khẩu, hiển thị thông báo lỗi màu đỏ "Email hoặc mật khẩu không chính xác". Nếu server ngoại tuyến, hiển thị banner "Không thể kết nối đến máy chủ xác thực".'],
  ]);

  elements.push(...createImageParas(imgLoginPath, 420, 260, 'Hình 8.1: Giao diện Hộp thoại Đăng nhập Hệ thống KaiLink (SCR-01)'));

  // SCR-02
  renderScreenSpecTable('SCR-02', 'Dashboard Tổng Quan Nhà Máy Cấp 1 (Tier 1 Plant Overview)', [
    ['Mã & Tên màn hình', 'SCR-02: Dashboard Tổng Quan Nhà Máy Cấp 1 (Tier 1 Plant Overview)'],
    ['File mã nguồn Frontend', 'src/components/PlantOverviewView.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Màn hình mặc định khi truy cập ứng dụng (view: plant-overview)'],
    ['Đối tượng người dùng', 'Ban Giám đốc Nhà máy, Quản đốc Phân xưởng, Trưởng ca Vận hành, Kỹ sư Quản lý Chất lượng'],
    ['Bố cục tổng quan (Layout)', 'Bố cục Dashboard công nghiệp dạng Grid. Hàng trên cùng gồm 4 Thẻ chỉ số tổng hợp KPI (Tổng số máy, Máy đang chạy bình thường, Máy cảnh báo, Máy dừng khẩn cấp). Khu vực trung tâm hiển thị sơ đồ mặt bằng các dây chuyền sản xuất (Production Lines Grid) với thẻ chỉ số an toàn Safety Score (%) của từng dây chuyền. Khu vực bên phải hiển thị biểu đồ phân bổ trạng thái và danh sách cảnh báo khẩn cấp nhất.'],
    ['Các điều khiển & Tương tác', '1. Thẻ dây chuyền (Line Card): Click chuột để chuyển sâu xuống Dashboard Cấp 2 tương ứng.\n2. Bộ lọc trạng thái dây chuyền: Tất cả, Bình thường, Cảnh báo, Nguy cấp.\n3. Nút kích hoạt chế độ xem Digital Andon toàn màn hình.\n4. Nút cập nhật dữ liệu thủ công (Manual Refresh) kèm đèn báo WebSocket thời gian thực.'],
    ['Dữ liệu hiển thị', 'Tên dây chuyền, mã dây chuyền, trạng thái tổng hợp (BR-02), Điểm số an toàn Safety Score (BR-03), Sản lượng kế hoạch vs Thực tế, Tỷ lệ hoàn thành kế hoạch (%).'],
  ]);

  // SCR-03
  renderScreenSpecTable('SCR-03', 'Dashboard Giám Sát Dây Chuyền Cấp 2 (Tier 2 Line Overview)', [
    ['Mã & Tên màn hình', 'SCR-03: Dashboard Giám Sát Dây Chuyền Cấp 2 (Tier 2 Line Overview)'],
    ['File mã nguồn Frontend', 'src/components/Tier2Overview.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Trạng thái xem chi tiết dây chuyền khi người dùng click vào một dây chuyền từ Cấp 1'],
    ['Đối tượng người dùng', 'Trưởng ca Vận hành, Vận hành viên dây chuyền, Kỹ sư bảo trì phụ trách'],
    ['Bố cục tổng quan (Layout)', 'Header hiển thị Breadcrumb định vị ("Trang chủ > Dây chuyền Dập & Hàn"), chỉ số an toàn dây chuyền và nút quay lại Cấp 1. Nội dung chính hiển thị danh sách các máy móc thiết bị thuộc dây chuyền (Dạng thẻ thiết bị công nghiệp Machine Cards). Mỗi thẻ hiển thị trạng thái vận hành đèn màu (Xanh/Vàng/Đỏ), Điểm sức khỏe Health Score (%), số giờ chạy liên tục (Uptime Hours), mã QR thiết bị và 3 thông số đo quan trọng nhất.'],
    ['Các điều khiển & Tương tác', '1. Click vào Thẻ máy (Machine Card) để mở màn hình Chi tiết Máy Cấp 3 (SCR-04).\n2. Nút "Xem Lịch sử Máy" để chuyển nhanh sang MachineHistoryView với bộ lọc máy tương ứng.\n3. Nút Quét mã QR thiết bị để truy cập hồ sơ bảo trì vật lý.'],
    ['Dữ liệu hiển thị', 'Tên máy, mã máy xưởng (vd: STP-01 Komatsu 500T), chủng loại thiết bị, trạng thái vận hành, Health Score, Uptime, thông số tải trọng/nhiệt độ/áp suất thời gian thực.'],
  ]);

  elements.push(...createImageParas(imgTier2Path, 420, 260, 'Hình 8.2: Giao diện Dashboard Giám sát Cấp 2 - Danh mục Máy móc Thiết bị (SCR-03)'));

  // SCR-04
  renderScreenSpecTable('SCR-04', 'Dashboard Chi Tiết Máy & Linh Kiện Cấp 3 (Tier 3 Machine Detail)', [
    ['Mã & Tên màn hình', 'SCR-04: Dashboard Chi Tiết Máy & Linh Kiện Cấp 3 (Tier 3 Machine Detail)'],
    ['File mã nguồn Frontend', 'src/components/Tier3Detail.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Trạng thái xem sâu linh kiện cụ thể của thiết bị (view: tier3-detail)'],
    ['Đối tượng người dùng', 'Kỹ sư Bảo trì Cơ điện, Chuyên gia Kỹ thuật thiết bị, Vận hành viên máy'],
    ['Bố cục tổng quan (Layout)', 'Header hiển thị thông tin máy, thông số trạm PLC kết nối (IP, Port, Protocol, Polling Rate). Khu vực trên hiển thị các đồng hồ đo kỹ thuật số (Digital Gauges) cho các thông số trọng yếu: Áp suất dầu thủy lực, Nhiệt độ động cơ chính, Độ rung động ổ bi RMS, Dòng điện tiêu thụ. Khu vực dưới hiển thị đồ thị sóng Telemetry thời gian thực (Real-time Waveform Chart) vẽ xu hướng biến thiên thông số trong 60 giây gần nhất.'],
    ['Các điều khiển & Tương tác', '1. Nút chuyển đổi thông số hiển thị trên đồ thị sóng (Áp suất / Nhiệt độ / Độ rung / Dòng điện).\n2. Nút "Xem toàn bộ lịch sử đo" dẫn sang màn hình MachineHistoryView.\n3. Nút "Mô phỏng kích hoạt sự cố" (phục vụ kiểm thử tại phòng Lab).'],
    ['Dữ liệu hiển thị', 'Giá trị số đo hiện thời, đơn vị đo, màu cảnh báo theo ngưỡng (BR-01), giá trị trung bình ca, giá trị đỉnh (Peak), ngưỡng cảnh báo Warning / Critical.'],
  ]);

  elements.push(...createImageParas(imgTier3Path, 420, 260, 'Hình 8.3: Giao diện Chi tiết Máy & Đồ thị Telemetry Linh kiện Cấp 3 (SCR-04)'));

  // SCR-05
  renderScreenSpecTable('SCR-05', 'Bảng Hiển Thị Cảnh Báo Nhà Máy Digital Andon (Andon View)', [
    ['Mã & Tên màn hình', 'SCR-05: Bảng Hiển Thị Cảnh Báo Nhà Máy Digital Andon (Andon View)'],
    ['File mã nguồn Frontend', 'src/components/AndonView.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Chế độ xem toàn màn hình (view: andon)'],
    ['Đối tượng người dùng', 'Hiển thị trên các màn hình TV lớn (55 - 75 inch) treo tại xưởng sản xuất cho toàn bộ công nhân và quản đốc'],
    ['Bố cục tổng quan (Layout)', 'Thiết kế độ tương phản cực cao (High Contrast Industrial Display), phông chữ kích thước lớn dễ đọc từ khoảng cách 10 - 20 mét. Bố cục chia thành các khối dây chuyền sản xuất tương ứng. Khi có sự cố Critical, toàn bộ khối máy hoặc dây chuyền sẽ nhấp nháy đèn viền màu đỏ đậm (#E60012) kèm âm thanh cảnh báo còi Andon.'],
    ['Các điều khiển & Tương tác', '1. Nút bật/tắt toàn màn hình (Toggle Fullscreen - F11).\n2. Nút bật/tắt âm thanh còi báo động (Mute Audio Alarm).\n3. Tự động cập nhật không cần tải lại trang thông qua kết nối WebSocket thời gian thực.'],
    ['Dữ liệu hiển thị', 'Đồng hồ thời gian thực nhà máy (Asia/Ho_Chi_Minh), Tên dây chuyền, Tên máy đang phát sinh sự cố, Loại sự cố, Mã màu Andon (Xanh lá: Chạy ổn định; Vàng: Cảnh báo nhẹ; Đỏ: Dừng khẩn cấp).'],
  ]);

  // SCR-06
  renderScreenSpecTable('SCR-06', 'Nhật Ký Cảnh Báo & Xử Lý Sự Cố (Alarm Log View)', [
    ['Mã & Tên màn hình', 'SCR-06: Nhật Ký Cảnh Báo & Xử Lý Sự Cố (Alarm Log View)'],
    ['File mã nguồn Frontend', 'src/components/AlarmLogView.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Trạng thái xem nhật ký sự cố (view: alarm-logs)'],
    ['Đối tượng người dùng', 'Kỹ sư Bảo trì, Quản trị viên, Vận hành viên'],
    ['Bố cục tổng quan (Layout)', 'Thanh trên cùng chứa các thẻ thống kê cảnh báo (Tổng số sự cố, Cảnh báo đang mở, Đã xác nhận, Đã xử lý). Bảng dữ liệu danh sách cảnh báo dạng bảng công nghiệp, hỗ trợ phân loại màu theo mức độ nghiêm trọng (Warning: Vàng hổ phách, Critical: Đỏ DENSO). Phía trên bảng là thanh công cụ tìm kiếm và lọc đa điều kiện.'],
    ['Các điều khiển & Tương tác', '1. Nút "Xác nhận sự cố" (Acknowledge) trên từng dòng cảnh báo (Dành cho Operator/Maintenance/Admin - BR-04).\n2. Nút "Đã xử lý" (Resolve) mở modal nhập biên bản xử lý sự cố (Dành riêng cho Maintenance và Admin - BR-05).\n3. Bộ lọc trạng thái: Tất cả, Đang mở (Active), Đã xác nhận (Acknowledged), Đã xử lý (Resolved).\n4. Bộ lọc mức độ: Tất cả, Cảnh báo (Warning), Nguy cấp (Critical).'],
    ['Dữ liệu hiển thị', 'Mã cảnh báo, Thời điểm phát sinh, Dây chuyền, Máy móc, Thông số vi phạm, Giá trị đo tại thời điểm lỗi, Giá trị ngưỡng vi phạm, Trạng thái xử lý, Người tiếp nhận xử lý.'],
  ]);

  // SCR-07
  renderScreenSpecTable('SCR-07', 'Lịch Sử Hoạt Động & Telemetry Máy (Machine History View)', [
    ['Mã & Tên màn hình', 'SCR-07: Lịch Sử Hoạt Động & Telemetry Máy (Machine History View)'],
    ['File mã nguồn Frontend', 'src/components/MachineHistoryView.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Trạng thái tra cứu lịch sử chuỗi thời gian (view: machine-history)'],
    ['Đối tượng người dùng', 'Kỹ sư Vận hành, Kỹ sư Bảo trì Cơ điện, Quản trị viên Nhà máy, Kỹ sư Phân tích Dữ liệu'],
    ['Bố cục tổng quan (Layout)', 'Bố cục 3 tầng chuyên nghiệp: Tầng 1 là Thanh công cụ bộ lọc nâng cao (Line, Machine, Metric, Status, Source, Preset ca sản xuất, Khoảng ngày giờ bắt đầu - kết thúc). Tầng 2 là Hàng thông tin trạng thái truy vấn (Hiển thị tổng số bản ghi tìm thấy, chỉ báo nguồn dữ liệu CSDL bình thường hoặc Degraded Mode, nút Làm mới và nút "Xuất Dữ Liệu"). Tầng 3 là Bảng dữ liệu lịch sử phân trang (20/50/100 bản ghi/trang).'],
    ['Các điều khiển & Tương tác', '1. Dropdown chọn Dây chuyền (Tự động tải lại danh sách Máy tương ứng).\n2. Dropdown chọn Máy cụ thể.\n3. Dropdown chọn Thông số đo kỹ thuật.\n4. Dropdown chọn Trạng thái (Tất cả, Bình thường, Cảnh báo, Nguy cấp).\n5. Dropdown chọn Nguồn dữ liệu (Tất cả, Giả lập, Thiết bị thực).\n6. Nút chọn nhanh Ca kíp (Ca 1, Ca 2, Ca 3, Hôm nay, Hôm qua - BR-08).\n7. Bộ chọn khoảng ngày giờ (DateTime Picker).\n8. Nút "Mở hộp thoại Xuất file" kích hoạt SCR-08.\n9. Điều khiển phân trang (Trang trước, Trang sau, Chọn số dòng/trang).'],
    ['Dữ liệu hiển thị', 'Mã bản ghi SHA-256 rút gọn, Thời điểm ghi nhận (hiển thị giờ địa phương Asia/Ho_Chi_Minh), Tên dây chuyền, Tên máy, Tên thông số kỹ thuật, Giá trị số đo, Đơn vị đo, Huy hiệu trạng thái đèn màu (Normal/Warning/Critical), Huy hiệu nguồn dữ liệu (Simulated/Device).'],
  ]);

  // SCR-08
  renderScreenSpecTable('SCR-08', 'Hộp Thoại Cấu Hình & Xuất Dữ Liệu (Export Modal)', [
    ['Mã & Tên màn hình', 'SCR-08: Hộp Thoại Cấu Hình & Xuất Dữ Liệu (Export Modal)'],
    ['File mã nguồn Frontend', 'src/components/ExportModal.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Hộp thoại Modal hiển thị khi nhấn nút "Xuất Dữ Liệu" tại SCR-07'],
    ['Đối tượng người dùng', 'Người dùng có quyền xuất báo cáo (Admin, Maintenance, Operator)'],
    ['Bố cục tổng quan (Layout)', 'Hộp thoại thiết kế dạng thẻ công nghiệp, hiển thị rõ ràng tóm tắt phạm vi dữ liệu xuất (Dây chuyền, Máy, Thông số, Khoảng thời gian đã lọc). Cho phép người dùng lựa chọn 1 trong 3 định dạng xuất file: Excel Workbook (.xlsx), CSV Text File (.csv), hoặc JSON Data (.json). Hiển thị cảnh báo giới hạn an toàn 10,000 dòng dữ liệu (BR-09).'],
    ['Các điều khiển & Tương tác', '1. Thẻ chọn định dạng file: Excel (.xlsx), CSV (.csv), JSON (.json).\n2. Tùy chọn phạm vi: Toàn bộ kết quả lọc (tối đa 10,000 dòng) hoặc Chỉ trang hiện tại.\n3. Nút "Tải file về máy" (Kèm thanh tiến trình Progress Bar khi đang tải và đóng gói dữ liệu).\n4. Nút "Hủy bỏ" đóng hộp thoại.'],
    ['Ràng buộc & Xử lý lỗi', 'Tự động kiểm tra an toàn chống tràn bộ nhớ trình duyệt. Tự động áp dụng cơ chế làm sạch ký tự công thức chống tấn công CSV Injection (BR-10). Nếu backend phản hồi lỗi kết nối cơ sở dữ liệu, hiển thị cảnh báo đỏ và giữ nguyên hộp thoại.'],
  ]);

  // SCR-09
  renderScreenSpecTable('SCR-09', 'Quản Lý Người Dùng & Phân Quyền (User Management View)', [
    ['Mã & Tên màn hình', 'SCR-09: Quản Lý Người Dùng & Phân Quyền Hệ Thống (User Management View)'],
    ['File mã nguồn Frontend', 'src/components/UserManagementView.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Màn hình quản trị người dùng (view: user-management), yêu cầu quyền ADMIN'],
    ['Đối tượng người dùng', 'Chỉ dành riêng cho Quản trị viên Hệ thống (ADMIN)'],
    ['Bố cục tổng quan (Layout)', 'Header chứa tiêu đề quản lý người dùng, tổng số tài khoản và nút "Thêm tài khoản mới". Phía dưới là thanh tìm kiếm nhanh (theo tên, email, mã nhân viên) và bộ nút lọc nhanh theo vai trò. Nội dung chính là Bảng danh sách người dùng với ảnh đại diện Avatar, Họ tên, Mã nhân viên, Email, Vai trò (Role Badge), Dây chuyền phụ trách, Trạng thái (Hoạt động / Khóa), và Cột thao tác (Sửa, Khóa/Mở, Xóa).'],
    ['Các điều khiển & Tương tác', '1. Nút "Thêm người dùng mới" mở Modal nhập thông tin nhân viên.\n2. Bộ lọc nhanh vai trò: Tất cả, ADMIN, OPERATOR (Lưu ý: nút lọc MAINTENANCE hiện chưa có trên UI dù backend hỗ trợ đầy đủ - Điểm lệch FR-016).\n3. Nút Sửa tài khoản (Cập nhật họ tên, vai trò, dây chuyền phụ trách).\n4. Nút Khóa / Kích hoạt tài khoản.\n5. Nút Xóa tài khoản (Bảo vệ không cho phép Admin tự xóa chính mình - BR-11).'],
    ['Dữ liệu hiển thị', 'Avatar, Họ tên, Mã nhân viên DNS, Email, Vai trò, Dây chuyền phụ trách, Ngày tạo, Thời điểm đăng nhập gần nhất.'],
  ]);

  // SCR-10
  renderScreenSpecTable('SCR-10', 'Nhật Ký Kiểm Toán & Truy Vết An Toàn (Audit Log View)', [
    ['Mã & Tên màn hình', 'SCR-10: Nhật Ký Kiểm Toán & Truy Vết An Toàn (Audit Log View)'],
    ['File mã nguồn Frontend', 'src/components/AuditLogView.tsx'],
    ['Đường dẫn URL / Trạng thái', 'Màn hình kiểm toán hệ thống (view: audit-logs), yêu cầu quyền ADMIN'],
    ['Đối tượng người dùng', 'Chỉ dành riêng cho Quản trị viên Hệ thống (ADMIN) và Bộ phận An toàn Thông tin'],
    ['Bố cục tổng quan (Layout)', 'Bố cục dạng bảng nhật ký an ninh bảo mật cao. Header hiển thị tổng số sự kiện kiểm toán được ghi nhận. Thanh công cụ hỗ trợ tìm kiếm từ khóa trong chi tiết nhật ký và bộ lọc theo loại hành động kiểm toán (LOGIN, LOGOUT, ACK_ALARM, RESOLVE_ALARM, EXPORT_LOGS, CREATE_USER, DELETE_USER). Bảng dữ liệu hiển thị theo thứ tự thời gian giảm dần (sự kiện mới nhất ở trên cùng).'],
    ['Các điều khiển & Tương tác', '1. Ô tìm kiếm từ khóa trong trường chi tiết nhật ký (details).\n2. Dropdown lọc theo loại hành động (Action Filter).\n3. Điều khiển phân trang dữ liệu.\n4. Nút "Làm mới nhật ký" để truy vấn các bản ghi mới phát sinh.'],
    ['Dữ liệu hiển thị', 'Mã kiểm toán (Audit ID), Thời điểm ghi nhận (Giờ:Phút:Giây Ngày/Tháng/Năm), Họ tên và Email người thực hiện, Mã nhân viên, Mã hành động (Huy hiệu màu sắc tương ứng), Đối tượng tác động (Target), Chi tiết nội dung thao tác, Địa chỉ IP máy trạm thực hiện.'],
  ]);

  // Minh chứng vận hành Backend / Cloud
  elements.push(createH2('8.11. Minh chứng trạng thái vận hành Backend & Cơ sở dữ liệu Cloud'));
  elements.push(
    createPara(
      'Dưới đây là hình ảnh nhật ký vận hành trực tiếp (Live Server Logs) từ môi trường đám mây Render, minh chứng kết nối cơ sở dữ liệu MySQL thành công, khởi tạo các bảng quan hệ và tiến trình phát thanh WebSocket hoạt động ổn định:'
    )
  );

  elements.push(...createImageParas(imgRenderLogPath, 420, 240, 'Hình 8.4: Nhật ký vận hành trực tiếp của Backend KaiLink trên nền tảng Cloud Render'));

  return elements;
}
