/**
 * @file scripts/generate_ba_v2_part5.js
 * @description Part 5 of BA Documentation v2.0:
 *  - Chapter 9: Ma Trận Truy Vết Yêu Cầu & Kế Hoạch Kiểm Thử (RTM 21 FRs, 25 Test Cases, Lab Limitations)
 *  - Chapter 10: Đánh Giá Tổng Thể, Lộ Trình Phát Triển & Kết Luận BA (Roadmap 3 giai đoạn & Sign-off)
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
  thinBorders,
} from './generate_ba_v2_helpers.js';

export function getV2Part5Elements() {
  const elements = [];

  // =========================================================================
  // CHƯƠNG 9: MA TRẬN TRUY VẾT YÊU CẦU & KẾ HOẠCH KIỂM THỬ (RTM & TEST PLAN)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 9: MA TRẬN TRUY VẾT YÊU CẦU & KẾ HOẠCH KIỂM THỬ (RTM & TEST PLAN)'));

  elements.push(
    createPara(
      'Chương 9 thiết lập Ma trận truy vết yêu cầu (Requirements Traceability Matrix - RTM) đa chiều nhằm bảo đảm tính toàn vẹn và khả năng kiểm chứng của toàn bộ 21 yêu cầu chức năng (FR-001 đến FR-021) xuyên suốt từ mục tiêu nghiệp vụ, quy tắc nghiệp vụ, ca sử dụng, vị trí mã nguồn triển khai thực tế cho đến các ca kiểm thử nghiệm thu. Đồng thời, chương này cung cấp danh mục 25 ca kiểm thử chi tiết và tuyên bố minh bạch các giới hạn thực nghiệm phòng thí nghiệm (Lab Limitations).'
    )
  );

  // 9.1 RTM Table
  elements.push(createH2('9.1. Ma trận truy vết yêu cầu hoàn chỉnh (Complete Traceability Matrix)'));
  elements.push(
    createPara(
      'Bảng dưới đây ánh xạ 1-1 từng yêu cầu chức năng với các thành phần trong vòng đời phát triển của dự án KaiLink:'
    )
  );

  const rtmRows = [
    new TableRow({
      children: [
        createCell('Mã FR', { isHeader: true, widthPercent: 8 }),
        createCell('Tên chức năng', { isHeader: true, widthPercent: 18 }),
        createCell('Mục tiêu', { isHeader: true, widthPercent: 8 }),
        createCell('Quy tắc (BR)', { isHeader: true, widthPercent: 10 }),
        createCell('Ca sử dụng (UC)', { isHeader: true, widthPercent: 9 }),
        createCell('File mã nguồn triển khai thực tế', { isHeader: true, widthPercent: 23 }),
        createCell('Ca test (TC)', { isHeader: true, widthPercent: 10 }),
        createCell('Trạng thái xác minh', { isHeader: true, widthPercent: 14 }),
      ],
    }),
  ];

  const rtmData = [
    ['FR-001', 'Đăng nhập & Cấp JWT', 'BG-03', 'BR-11', 'UC-01', 'src/components/LoginModal.tsx\nserver/index.js (L300-340)', 'TC-01, TC-02', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-002', 'Đăng xuất & Hủy phiên', 'BG-03', 'BR-11', 'UC-01', 'src/stores/useAuthStore.ts\nserver/index.js (L345-360)', 'TC-03', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-003', 'Phân quyền vai trò RBAC', 'BG-03', 'BR-11, BR-13', 'UC-01, UC-08', 'server/index.js (L110-140, authenticateJWT)', 'TC-04, TC-05', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-004', 'Cập nhật Profile & Avatar', 'BG-03', 'BR-13', 'UC-01', 'src/components/UserProfileModal.tsx\nserver/index.js (L500-550)', 'TC-06, TC-07', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-005', 'Dashboard Cấp 1 (Plant)', 'BG-01, BG-02', 'BR-02, BR-03', 'UC-02', 'src/components/PlantOverviewView.tsx', 'TC-08', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-006', 'Dashboard Cấp 2 (Line)', 'BG-01, BG-02', 'BR-02', 'UC-02', 'src/components/Tier2Overview.tsx', 'TC-09', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-007', 'Dashboard Cấp 3 (Detail)', 'BG-01, BG-02', 'BR-01, BR-15', 'UC-02', 'src/components/Tier3Detail.tsx\nsrc/utils/plcConverter.ts', 'TC-10', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-008', 'Hiển thị Digital Andon', 'BG-01, BG-04', 'BR-01, BR-02', 'UC-03', 'src/components/AndonView.tsx', 'TC-11', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-009', 'Quản lý Trạm PLC ảo', 'BG-01', 'BR-12, BR-15', 'UC-02', 'src/components/PLCManagerModal.tsx\nserver/db-mysql.js (L195-204)', 'TC-12', 'MÔ PHỎNG LAB (PASS)'],
    ['FR-010', 'Phát hiện Vi phạm Ngưỡng', 'BG-01, BG-04', 'BR-01', 'UC-04', 'src/utils/plcConverter.ts (L72-89)', 'TC-13', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-011', 'Xác nhận Cảnh báo (Ack)', 'BG-04', 'BR-04', 'UC-04', 'src/stores/useAlarmStore.ts (L33-50)\nsrc/components/AlarmLogView.tsx', 'TC-14', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-012', 'Khắc phục Cảnh báo (Resolve)', 'BG-04', 'BR-05', 'UC-04', 'src/stores/useAlarmStore.ts (L53-71)\nsrc/components/AlarmLogView.tsx', 'TC-15', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-013', 'Truy vấn Lịch sử Máy', 'BG-02, BG-05', 'BR-06, BR-07, BR-14', 'UC-05', 'src/components/MachineHistoryView.tsx\nserver/db-mysql.js (L440-485)', 'TC-16, TC-17', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-014', 'Bộ lọc & Chuyển đổi Ca', 'BG-02, BG-05', 'BR-07, BR-08', 'UC-05', 'src/stores/useHistoryStore.ts\nserver/db-mysql.js (L590-645)', 'TC-18, TC-19', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-015', 'Xuất Excel, CSV, JSON', 'BG-05', 'BR-09, BR-10', 'UC-06', 'src/utils/exportEngine.ts\nsrc/components/ExportModal.tsx', 'TC-20, TC-21', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-016', 'Quản lý Tài khoản (CRUD)', 'BG-03', 'BR-11', 'UC-08', 'src/components/UserManagementView.tsx\nserver/index.js (L390-480)', 'TC-22', 'LỆCH UI VAI TRÒ (PASS*)'],
    ['FR-017', 'Xem Nhật ký Kiểm toán', 'BG-03', 'BR-11', 'UC-09', 'src/components/AuditLogView.tsx\nserver/db-mysql.js (L320-360)', 'TC-23', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-018', 'Chế độ hoạt động Suy giảm', 'BG-01, BG-05', 'BR-06, BR-07', 'UC-05', 'src/services/historyService.ts\nserver/db-mysql.js (L480-500)', 'TC-24', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-019', 'Tự động tạo Dữ liệu mẫu', 'BG-01', 'BR-06, BR-07, BR-12', 'UC-02', 'server/db-mysql.js (L500-580, seedHistory)', 'TC-25', 'ĐÃ XÁC MINH (PASS)'],
    ['FR-020', 'Bảo trì dự đoán (PdM)', 'BG-01, BG-04', 'BR-01, BR-03', 'UC-07', 'src/components/PredictiveMaintenanceModal.tsx', '-', 'ĐỀ XUẤT (GIAI ĐOẠN 3)'],
    ['FR-021', 'Thông báo Đa kênh (Alert)', 'BG-04', 'BR-01, BR-04', 'UC-10', 'server/notificationService.js (Ý niệm kiến trúc)', '-', 'ĐỀ XUẤT (GIAI ĐOẠN 2)'],
  ];

  rtmData.forEach((row) => {
    rtmRows.push(
      new TableRow({
        children: [
          createCell(row[0], { bold: true }),
          createCell(row[1]),
          createCell(row[2]),
          createCell(row[3]),
          createCell(row[4]),
          createCell(row[5]),
          createCell(row[6]),
          createCell(row[7], { italic: true }),
        ],
      })
    );
  });

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rtmRows,
      borders: thinBorders,
    })
  );

  elements.push(createPara(' '));

  // 9.2 Danh mục 25 Test Cases
  elements.push(createH2('9.2. Danh mục 25 Ca kiểm thử chi tiết (Test Cases TC-01 đến TC-25)'));
  elements.push(
    createPara(
      'Dưới đây là đặc tả chi tiết 25 ca kiểm thử thực nghiệm dùng để thẩm định và nghiệm thu hệ thống KaiLink tại mốc phát triển Stage 4A:'
    )
  );

  const testCases = [
    ['TC-01', 'Đăng nhập thành công với tài khoản Admin hợp lệ', 'FR-001', 'Server Node.js và MySQL đang chạy. Người dùng mở LoginModal.', '1. Nhập email: admin@denso.com\n2. Nhập mật khẩu: admin123\n3. Bấm "Đăng nhập hệ thống"', 'Đăng nhập thành công, nhận JWT token hợp lệ, lưu token vào sessionStorage, chuyển sang màn hình Plant Overview, ghi 1 bản ghi LOGIN vào audit_logs.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-02', 'Đăng nhập thất bại khi sai mật khẩu', 'FR-001', 'Người dùng mở LoginModal.', '1. Nhập email: admin@denso.com\n2. Nhập mật khẩu: sai_mat_khau\n3. Bấm "Đăng nhập hệ thống"', 'Hiển thị thông báo lỗi màu đỏ "Email hoặc mật khẩu không chính xác", không cấp token, không chuyển màn hình.', 'PASS (Đã kiểm thử)'],
    ['TC-03', 'Đăng xuất khỏi hệ thống an toàn', 'FR-002', 'Người dùng đang ở trạng thái đã đăng nhập.', '1. Nhấn avatar trên thanh Header\n2. Chọn "Đăng xuất"\n3. Xác nhận đăng xuất', 'Hủy token trong sessionStorage, đặt lại thông tin user về null, quay về màn hình Login, ghi nhận hành động LOGOUT trong audit_logs.', 'PASS (Đã kiểm thử)'],
    ['TC-04', 'Chặn truy cập trái phép tài nguyên Admin khi là Operator', 'FR-003', 'Người dùng đăng nhập với vai trò OPERATOR.', '1. Dùng Postman gửi request GET /api/admin/users kèm token của Operator', 'API trả về mã lỗi HTTP 403 Forbidden kèm thông điệp "Yêu cầu quyền Quản trị viên (ADMIN)".', 'PASS (Đã kiểm thử)'],
    ['TC-05', 'Cơ chế xác thực Middleware từ chối request không có Token', 'FR-003', 'Người dùng chưa đăng nhập.', '1. Gửi request GET /api/telemetry/logs không đính kèm Bearer token trong Header', 'API trả về mã lỗi HTTP 401 Unauthorized kèm thông điệp "Yêu cầu xác thực tài khoản".', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-06', 'Cập nhật ảnh đại diện Avatar hợp lệ', 'FR-004', 'Người dùng đã đăng nhập.', '1. Mở UserProfileModal\n2. Tải lên file ảnh avatar.jpg kích thước 1.2MB\n3. Nhấn "Lưu thay đổi"', 'Upload thành công, lưu file vào thư mục /uploads/avatars/, cập nhật avatarUrl trong bảng users, hiển thị ảnh mới ngay trên Header.', 'PASS (Đã kiểm thử)'],
    ['TC-07', 'Từ chối tải lên file Avatar quá dung lượng 5MB hoặc sai định dạng', 'FR-004', 'Người dùng mở UserProfileModal.', '1. Tải lên file tailieu.pdf hoặc file anh.png kích thước 8MB', 'Hệ thống báo lỗi "File không hợp lệ hoặc kích thước vượt quá giới hạn 5MB", từ chối xử lý.', 'PASS (Đã kiểm thử)'],
    ['TC-08', 'Hiển thị dữ liệu tổng hợp Cấp 1 và tính điểm Safety Score', 'FR-005', 'Dữ liệu máy phát sinh bình thường.', '1. Mở màn hình Plant Overview\n2. Quan sát 4 thẻ KPI và điểm Safety Score các dây chuyền', 'Hiển thị đúng tổng số máy, số máy bình thường/cảnh báo/nguy cấp. Điểm Safety Score tính chính xác theo BR-03.', 'PASS (Đã kiểm thử)'],
    ['TC-09', 'Điều hướng và hiển thị danh mục máy Cấp 2', 'FR-006', 'Tại Cấp 1, người dùng click vào dây chuyền LINE-01.', '1. Click thẻ "Dây chuyền Dập & Hàn"\n2. Quan sát danh sách máy', 'Chuyển mượt sang màn hình Cấp 2, hiển thị đầy đủ 2 máy (MCH-PRS-01, MCH-WLD-01) kèm Health Score và Uptime.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-10', 'Đồ thị sóng Telemetry Cấp 3 cập nhật thời gian thực', 'FR-007', 'Người dùng mở màn hình Cấp 3 máy MCH-PRS-01.', '1. Quan sát đồ thị sóng áp suất dầu thủy lực trong 60 giây', 'Đồ thị cập nhật điểm dữ liệu mới mỗi giây thông qua WebSocket streaming, giá trị nằm trong dải [190 - 225] bar.', 'PASS (Đã kiểm thử)'],
    ['TC-11', 'Bảng Digital Andon nhấp nháy đỏ khi có sự cố Critical', 'FR-008', 'Kích hoạt một sự cố Critical trên máy MCH-PRS-01.', '1. Mở màn hình Digital Andon\n2. Quan sát giao diện khi sự cố phát sinh', 'Khối máy Dập nhấp nháy viền đỏ rực (#E60012), hiển thị tên máy, thông số vi phạm và phát tín hiệu cảnh báo thị giác.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-12', 'Truy vấn danh mục trạm PLC ảo từ CSDL MySQL', 'FR-009', 'CSDL MySQL đã seed 2 trạm PLC.', '1. Gửi request GET /api/plc-stations kèm token hợp lệ', 'Trả về HTTP 200 kèm danh sách 2 trạm PLC (Siemens S7-1500, Omron NX1P2) với thông số IP, Port, Protocol, TagsCount.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-13', 'Phát hiện vi phạm 4 ngưỡng đo lường kỹ thuật', 'FR-010', 'Bộ tạo giá trị đo sinh giá trị nhiệt độ motor: 88°C (Ngưỡng Critical > 85°C).', '1. Đưa giá trị 88°C vào hàm evaluateMetricStatus', 'Hàm trả về trạng thái "critical", kích hoạt phát cảnh báo lên giao diện và đổi màu đèn cảnh báo sang đỏ.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-14', 'Vận hành viên xác nhận sự cố cảnh báo (Acknowledge)', 'FR-011', 'Có 1 cảnh báo trạng thái ACTIVE trên AlarmLogView.', '1. Operator nhấn nút "Xác nhận sự cố" trên dòng cảnh báo', 'Trạng thái cảnh báo chuyển sang ACKNOWLEDGED, hiển thị thời điểm xác nhận và tên người xác nhận, âm thanh còi ngừng kêu.', 'PASS (Đã kiểm thử)'],
    ['TC-15', 'Kỹ sư bảo trì xử lý sự cố và nhập biên bản (Resolve)', 'FR-012', 'Có 1 cảnh báo trạng thái ACKNOWLEDGED.', '1. Maintenance nhấn "Đã xử lý"\n2. Nhập nội dung: "Đã châm thêm dầu thủy lực ISO VG 46"\n3. Bấm xác nhận', 'Trạng thái chuyển sang RESOLVED, lưu ghi chú xử lý vào bản ghi, ghi vết RESOLVE_ALARM vào audit_logs.', 'PASS (Đã kiểm thử)'],
    ['TC-16', 'Truy vấn lịch sử máy phân trang và sắp xếp hợp lệ', 'FR-013', 'Bảng machine_telemetry_history có trên 100 bản ghi.', '1. Gửi request GET /api/telemetry/logs?page=1&limit=20&sortBy=timestamp&sortOrder=desc', 'Trả về HTTP 200, metadata.pagination (total, page: 1, limit: 20, totalPages), danh sách 20 bản ghi sắp xếp mới nhất lên đầu.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-17', 'Chặn tham số sortBy không hợp lệ (SQL Injection Defense)', 'FR-013', 'Gửi tham số sortBy độc hại.', '1. Gửi request GET /api/telemetry/logs?sortBy=invalid_column;DROP TABLE users;--', 'Backend bắt lỗi whitelist, tự động fallback về sắp xếp mặc định "timestamp DESC" hoặc trả về lỗi 400 Bad Request hợp lệ.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-18', 'Chuyển đổi thời gian ca kíp Việt Nam sang UTC chính xác', 'FR-014', 'Người dùng chọn Ca 1 ngày 15/10/2026 (06:00 - 14:00 GMT+7).', '1. Chọn lọc Ca 1 ngày 15/10/2026 trên giao diện\n2. Gửi truy vấn', 'Khoảng thời gian gửi tới CSDL MySQL chuẩn hóa chính xác: 2026-10-14T23:00:00.000Z đến 2026-10-15T07:00:00.000Z theo BR-07.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-19', 'Xử lý cuộn ngày của Ca 3 qua đêm (Overnight Rollover)', 'FR-014', 'Người dùng chọn Ca 3 ngày 15/10/2026 (22:00 - 06:00 sáng hôm sau).', '1. Chọn lọc Ca 3 ngày 15/10/2026\n2. Quan sát khoảng thời gian UTC', 'Thời điểm kết thúc tự động cộng thêm 1 ngày theo lịch UTC (Date.UTC rollover), truy vấn chính xác dữ liệu ca đêm (BR-08).', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-20', 'Xuất file Excel (.xlsx) chứa dữ liệu lịch sử', 'FR-015', 'Người dùng đã lọc 50 bản ghi lịch sử.', '1. Mở ExportModal\n2. Chọn định dạng Excel (.xlsx)\n3. Bấm "Tải file về máy"', 'Trình duyệt tải về file kaiLink_telemetry_history_YYYYMMDD_HHmmss.xlsx, mở được trên Microsoft Excel, có đủ tiêu đề và dữ liệu.', 'PASS (Đã kiểm thử thực tế)'],
    ['TC-21', 'Làm sạch công thức nguy hiểm trong file CSV (CSV Injection Defense)', 'FR-015', 'Bản ghi telemetry có giá trị metricName chứa ký tự =cmd|... hoặc +SUM(...).', '1. Chọn xuất file định dạng CSV (.csv)\n2. Tải và mở file bằng Notepad', 'Các ô bắt đầu bằng ký tự =, +, -, @, Tab, CR tự động được thêm tiền tố dấu nháy đơn (\') phía trước (BR-10).', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-22', 'Bảo vệ tài khoản Quản trị viên không bị tự xóa', 'FR-016', 'Admin đang đăng nhập tài khoản id: usr-admin-01.', '1. Gửi request DELETE /api/admin/users/usr-admin-01', 'Backend từ chối thực hiện, trả về HTTP 400 Bad Request "Không thể tự xóa tài khoản quản trị viên đang đăng nhập" (BR-11).', 'PASS (Đã kiểm thử)'],
    ['TC-23', 'Ghi nhật ký kiểm toán hành động xuất file dữ liệu', 'FR-017', 'Người dùng thực hiện xuất file 50 bản ghi telemetry.', '1. Thực hiện xuất file CSV thành công\n2. Mở AuditLogView kiểm tra', 'Ghi nhận 1 bản ghi mới với action: "EXPORT_LOGS", target: "telemetry", details ghi rõ format: csv, count: 50.', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-24', 'Tự động kích hoạt Chế độ suy giảm khi CSDL ngoại tuyến', 'FR-018', 'Dịch vụ CSDL MySQL bị ngắt kết nối.', '1. Gửi request GET /api/telemetry/logs khi tắt MySQL', 'Backend không sập (crash), tự động trả về mảng dữ liệu mô phỏng fallback kèm header "x-data-source: degraded_memory".', 'PASS (Đã kiểm thử Stage 4A)'],
    ['TC-25', 'Sinh ID xác định chống trùng lặp khi ghi nhận Telemetry', 'FR-019', 'Tiến trình tự động ghi lịch sử telemetry chạy định kỳ.', '1. Ghi 1 bản ghi telemetry với machineId, metricId, timestamp xác định\n2. Cố tình ghi đè lại bản ghi đó', 'ID sinh ra giống hệt nhau bằng SHA-256 (BR-06), câu lệnh INSERT IGNORE bỏ qua bản ghi trùng, bảng không bị nhân bản dữ liệu.', 'PASS (Đã kiểm thử Stage 4A)'],
  ];

  const tcRows = [
    new TableRow({
      children: [
        createCell('Mã TC', { isHeader: true, widthPercent: 8 }),
        createCell('Tên ca kiểm thử', { isHeader: true, widthPercent: 20 }),
        createCell('Mã FR', { isHeader: true, widthPercent: 8 }),
        createCell('Điều kiện tiên quyết', { isHeader: true, widthPercent: 16 }),
        createCell('Các bước thực hiện', { isHeader: true, widthPercent: 18 }),
        createCell('Kết quả mong đợi', { isHeader: true, widthPercent: 20 }),
        createCell('Kết quả thực nghiệm', { isHeader: true, widthPercent: 10 }),
      ],
    }),
  ];

  testCases.forEach((tc) => {
    tcRows.push(
      new TableRow({
        children: [
          createCell(tc[0], { bold: true }),
          createCell(tc[1]),
          createCell(tc[2]),
          createCell(tc[3]),
          createCell(tc[4]),
          createCell(tc[5]),
          createCell(tc[6], { italic: true }),
        ],
      })
    );
  });

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tcRows,
      borders: thinBorders,
    })
  );

  elements.push(createPara(' '));

  // 9.3 Lab Limitations
  elements.push(createH2('9.3. Giới hạn thử nghiệm phòng Lab và Điều kiện chưa xác minh trên thực tế'));
  elements.push(
    createPara(
      'Để bảo đảm tính trung thực tuyệt đối của tài liệu BA và phản ánh đúng mức độ hoàn thiện của hệ thống, chuyên gia phân tích nghiệp vụ thiết lập các tuyên bố loại trừ và giới hạn kỹ thuật sau đây:'
    )
  );

  const labWarningText =
    'TUYÊN BỐ GIỚI HẠN THỰC NGHIỆM PHÒNG THÍ NGHIỆM (LAB LIMITATIONS DECLARATION):\n\n' +
    '1. Mô hình hóa PLC ảo: Toàn bộ các trạm PLC (Siemens S7-1500, Omron NX1P2) trong phiên bản hiện tại là mô hình phần mềm giả lập (Mock / Loopback Protocol Software Model), chạy trên cùng một máy chủ hoặc mạng cục bộ. Hệ thống CHƯA ĐƯỢC ĐẤU NỐI VẬT LÝ với các tủ điện PLC, biến tần, cảm biến công nghiệp thật tại xưởng thông qua cáp mạng công nghiệp (Profinet / Industrial Ethernet).\n\n' +
    '2. Đo lường độ trễ mạng: Chỉ số độ trễ truyền thông WebSocket < 100ms chỉ mới được đo lường thực nghiệm trong điều kiện mạng nội bộ phòng Lab (Localhost và mạng LAN nội bộ 1Gbps). Chỉ số này CHƯA ĐƯỢC KIỂM CHỨNG trên hạ tầng mạng diện rộng nhà máy (Industrial Wi-Fi / Private 5G) khi có can nhiễu điện từ trường mạnh phát sinh từ các máy dập cơ học lớn và robot hàn công nghiệp.\n\n' +
    '3. Kiểm thử tải đồng thời: Năng lực đáp ứng 1,000 kết nối đồng thời nêu trong Chương 6 là CHỈ SỐ MỤC TIÊU THIẾT KẾ KIẾN TRÚC (Target Capacity), chưa được xác nhận thông qua các bài kiểm thử tải căng thẳng (Stress Testing / Soak Testing) bằng các công cụ chuyên dụng như k6 hay Apache JMeter.\n\n' +
    '4. Số liệu quy trình AS-IS: Khoảng thời gian di chuyển và ghi chép thủ công từ 30 đến 120 phút trong quy trình AS-IS (Chương 3) là SỐ LIỆU GIẢ ĐỊNH THAM CHIẾU NGÀNH (Reference Assumption) dựa trên khảo sát sơ bộ, không phải là kết quả của một nghiên cứu đo lường thời gian chuyển động thực nghiệm chính thức (Time-Motion Study) tại các xưởng của DENSO.';

  elements.push(
    createPara(labWarningText, {
      bold: true,
      color: '9B2C2C',
      bgColor: 'FFF5F5',
    })
  );

  // =========================================================================
  // CHƯƠNG 10: ĐÁNH GIÁ TỔNG THỂ, LỘ TRÌNH PHÁT TRIỂN & KẾT LUẬN BA
  // =========================================================================
  elements.push(createH1('CHƯƠNG 10: ĐÁNH GIÁ TỔNG THỂ, LỘ TRÌNH PHÁT TRIỂN & KẾT LUẬN BA (EVALUATION, ROADMAP & CONCLUSION)'));

  // 10.1 Đánh giá ưu điểm
  elements.push(createH2('10.1. Đánh giá ưu điểm và điểm mạnh của hệ thống hiện tại'));
  elements.push(
    createPara(
      'Sau quá trình audit toàn diện source code và dữ liệu triển khai của dự án KaiLink tại commit 8ac31eabbb565788db640d73526df8daec8b0506, chuyên gia BA đánh giá hệ thống sở hữu nhiều ưu điểm vượt trội về mặt thiết kế kiến trúc và nghiệp vụ:\n' +
      '• Chuẩn hóa dữ liệu chuỗi thời gian chặt chẽ: Hệ thống đã khắc phục triệt để lỗi lệch múi giờ bằng việc quy đổi thống nhất toàn bộ dữ liệu telemetry về chuẩn UTC khi ghi nhận vào CSDL MySQL, hỗ trợ xử lý mượt mà bài toán cuộn ngày của ca kíp sản xuất qua đêm (BR-07, BR-08).\n' +
      '• Cơ chế chống trùng lặp dữ liệu thông minh: Sử dụng thuật toán SHA-256 sinh khóa chính xác định (BR-06) kết hợp câu lệnh INSERT IGNORE, loại bỏ hoàn toàn nguy cơ phình to CSDL do các tiến trình retry mạng đẩy dữ liệu lặp lại.\n' +
      '• Động cơ xuất dữ liệu đa định dạng an toàn: Cho phép kết xuất dữ liệu dung lượng lớn ra 3 định dạng phổ biến (Excel, CSV, JSON) với cơ chế bảo vệ kép: giới hạn trần 10,000 dòng chống tràn RAM và làm sạch ký tự công thức chống tấn công CSV Formula Injection (BR-09, BR-10).\n' +
      '• Giao diện người dùng công nghiệp chuẩn mực: Bố cục 3 tầng trực quan (Plant -> Line -> Machine), màu sắc đồng bộ nhận diện thương hiệu DENSO, hỗ trợ màn hình Digital Andon tương phản cao phục vụ vận hành thực tế tại nhà xưởng.\n' +
      '• Khả năng phục hồi cao (Degraded Mode): Ứng dụng tích hợp cơ chế tự động chuyển đổi sang bộ nhớ đệm giả lập khi CSDL gặp sự cố, đảm bảo trải nghiệm người dùng không bị gián đoạn (Graceful Degradation).'
    )
  );

  // 10.2 Nợ kỹ thuật
  elements.push(createH2('10.2. Nợ kỹ thuật (Technical Debt) và Rủi ro tồn đọng cần xử lý'));
  elements.push(
    createPara(
      'Bên cạnh các thành tựu đạt được, hệ thống vẫn tồn tại các khoản nợ kỹ thuật cần được giải quyết dứt điểm trước khi đưa vào sản xuất thương mại:'
    )
  );

  const debtRows = [
    new TableRow({
      children: [
        createCell('Mã nợ', { isHeader: true, widthPercent: 12 }),
        createCell('Mô tả vấn đề tồn đọng', { isHeader: true, widthPercent: 32 }),
        createCell('Mức độ rủi ro', { isHeader: true, widthPercent: 18 }),
        createCell('Giải pháp khắc phục đề xuất', { isHeader: true, widthPercent: 38 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('TD-01', { bold: true }),
        createCell('Lưu trữ Cảnh báo (Alarms) trên RAM Zustand: Cảnh báo chưa được lưu vào MySQL, sẽ bị mất khi người dùng làm mới trang F5 hoặc tắt trình duyệt.'),
        createCell('NGHIÊM TRỌNG (Critical)'),
        createCell('Xây dựng bảng alarms trong MySQL 8.0, chuyển toàn bộ API tạo, xác nhận (ack) và xử lý (resolve) cảnh báo về Backend Node.js trong Giai đoạn 2.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('TD-02', { bold: true }),
        createCell('Lệch phân quyền UI Quản lý người dùng: Giao diện UserManagementView chỉ có nút lọc nhanh ADMIN và OPERATOR, thiếu nút lọc MAINTENANCE dù backend và CSDL hỗ trợ đầy đủ.'),
        createCell('TRUNG BÌNH (Medium)'),
        createCell('Bổ sung nút lọc vai trò MAINTENANCE và ô chọn vai trò này trong Modal tạo/sửa người dùng tại src/components/UserManagementView.tsx.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('TD-03', { bold: true }),
        createCell('Mô hình PLC ảo: Các trạm PLC Siemens S7-1500 và Omron NX1P2 đang là mô hình phần mềm trong bộ nhớ, chưa có kết nối vật lý với thiết bị phần cứng thật.'),
        createCell('CAO (High)'),
        createCell('Triển khai phần mềm cổng trung gian công nghiệp (Edge Gateway Kepware KEPServerEX hoặc Node-RED) để kết nối vật lý với thanh ghi PLC thật trong Giai đoạn 2.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('TD-04', { bold: true }),
        createCell('Thiếu cơ chế lưu đệm Redis: Mỗi truy vấn lịch sử telemetry đều quét trực tiếp vào MySQL, có thể gây quá tải khi hàng trăm máy trạm cùng truy vấn báo cáo.'),
        createCell('TRUNG BÌNH (Medium)'),
        createCell('Tích hợp Redis Caching cho các dữ liệu ít biến động (danh mục máy, dây chuyền) và các truy vấn telemetry gần nhất (thời gian sống TTL 5 giây).'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: debtRows,
      borders: thinBorders,
    })
  );

  elements.push(createPara(' '));

  // 10.3 Roadmap 3 Giai đoạn
  elements.push(createH2('10.3. Lộ trình phát triển 3 Giai đoạn (3-Phase Implementation Roadmap)'));
  elements.push(
    createPara(
      'Để chuyển đổi thành công hệ thống KaiLink từ phiên bản thử nghiệm phòng thí nghiệm sang hệ sinh thái giám sát sản xuất hoàn chỉnh toàn nhà máy DENSO, BA đề xuất lộ trình triển khai gồm 3 giai đoạn chiến lược:'
    )
  );

  const roadmapRows = [
    new TableRow({
      children: [
        createCell('Giai đoạn', { isHeader: true, widthPercent: 18 }),
        createCell('Mục tiêu chính', { isHeader: true, widthPercent: 24 }),
        createCell('Hạng mục công việc kỹ thuật', { isHeader: true, widthPercent: 30 }),
        createCell('Thời gian', { isHeader: true, widthPercent: 14 }),
        createCell('Tiêu chí nghiệm thu', { isHeader: true, widthPercent: 14 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('Giai đoạn 1 (Hiện tại):\nThử nghiệm Lab & Hackathon', { bold: true }),
        createCell('Xây dựng thành công phiên bản nguyên mẫu (MVP) hoàn chỉnh về giao diện, kiến trúc CSDL, API lịch sử và động cơ xuất file.'),
        createCell('1. Hoàn thiện Dashboard 3 tầng, Andon View.\n2. CSDL MySQL 6 bảng chuẩn hóa UTC.\n3. API Telemetry History & Export Engine.\n4. Đóng gói mã nguồn nhánh feature/web-log-export.'),
        createCell('ĐÃ HOÀN THÀNH\n(Tháng 10/2026)'),
        createCell('Đạt PASS trên bộ test tích hợp Stage 4A và demo thành công các chức năng.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Giai đoạn 2 (3 - 6 tháng):\nThí điểm Dây chuyền D-01', { bold: true }),
        createCell('Đưa hệ thống vào vận hành thử nghiệm trên Dây chuyền Dập D-01 thực tế tại nhà máy DENSO Việt Nam.'),
        createCell('1. Kết nối cổng IoT Gateway với PLC Siemens S7-1500 thật qua Modbus/TCP.\n2. Chuyển đổi quản lý Cảnh báo sang bảng alarms trong MySQL.\n3. Bổ sung nút lọc vai trò MAINTENANCE trên UI.\n4. Tích hợp gửi cảnh báo khẩn cấp qua Telegram/Email Bot.\n5. Đánh giá độ trễ mạng trong môi trường xưởng.'),
        createCell('Quý 1 - Quý 2 / 2027'),
        createCell('Hệ thống vận hành liên tục 30 ngày không sập, ghi nhận chính xác 100% sự cố dừng máy.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Giai đoạn 3 (6 - 12 tháng):\nToàn nhà máy & AI PdM', { bold: true }),
        createCell('Triển khai nhân rộng cho toàn bộ các dây chuyền và tích hợp hệ thống trí tuệ nhân tạo bảo trì dự đoán.'),
        createCell('1. Mở rộng kết nối cho toàn bộ các dây chuyền Hàn, Sơn, Lắp ráp.\n2. Triển khai mô hình AI/ML dự đoán hỏng hóc sớm ổ bi/động cơ (FR-020).\n3. Tích hợp liên thông hai chiều với hệ thống ERP SAP và MES nhà máy.\n4. Triển khai kiến trúc cụm máy chủ có khả năng mở rộng cao (High Availability Cluster).'),
        createCell('Quý 3 - Quý 4 / 2027'),
        createCell('Toàn bộ nhà máy vận hành trên nền tảng KaiLink, giảm 20% chi phí bảo trì đột xuất, nâng OEE lên 88%.'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: roadmapRows,
      borders: thinBorders,
    })
  );

  elements.push(createPara(' '));

  // 10.4 Kết luận của BA
  elements.push(createH2('10.4. Kết luận của Chuyên gia Phân tích Nghiệp vụ & Khuyến nghị'));
  elements.push(
    createPara(
      'Tài liệu Đặc tả Yêu cầu Nghiệp vụ (BA Documentation v2.0) của hệ thống DENSO IoT Monitoring (KaiLink) đã được lập một cách toàn diện, trung thực và bám sát 100% cấu trúc mã nguồn thực tế tại commit 8ac31eabbb565788db640d73526df8daec8b0506. Mọi thông tin về mô hình dữ liệu, quy tắc nghiệp vụ, giao diện người dùng và kết quả kiểm nghiệm đều đã được đối soát kỹ lưỡng, loại bỏ hoàn toàn các tuyên bố chưa được kiểm chứng.'
    )
  );

  elements.push(
    createPara(
      'Tại thời điểm ban hành, tài liệu mang trạng thái "CHỜ THẨM ĐỊNH KỸ THUẬT" (Pending Technical Sign-off) để sẵn sàng trình Hội đồng Kỹ thuật và Trưởng nhóm xem xét phê duyệt. Khi được thông qua, tài liệu v2.0 này sẽ đóng vai trò là kim chỉ nam pháp lý và kỹ thuật vững chắc cho các giai đoạn phát triển tiếp theo của dự án KaiLink.'
    )
  );

  const signoffSummaryText =
    'XÁC NHẬN CỦA ĐƠN VỊ BIÊN SOẠN:\n' +
    'Tài liệu được hoàn thiện và xuất bản tự động vào ngày 22 tháng 10 năm 2026 bởi Lead Business Analyst & Technical Reviewer.\n' +
    'Mã kiểm tra tài liệu: DENSO-BA-DOC-V2.0-FINAL\n' +
    'Nhánh mã nguồn đối chiếu: feature/web-log-export\n' +
    'Trạng thái phê duyệt: Chờ thẩm định kỹ thuật (Pending Review)';

  elements.push(
    createPara(signoffSummaryText, {
      bold: true,
      color: '003366',
      bgColor: 'EDF2F7',
    })
  );

  return elements;
}
