/**
 * @file scripts/generate_ba_doc_content_part2.js
 * @description Nội dung Chương 4, Chương 5 và Chương 6 của tài liệu BA
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
  createCell,
  thinBorders,
} from './generate_ba_doc_helpers.js';

export function getPart2Elements() {
  const elements = [];

  // =========================================================================
  // CHƯƠNG 4: ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 4: ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)'));

  elements.push(createH2('4.1. Bảng tổng hợp yêu cầu chức năng (FR-001 đến FR-021)'));
  elements.push(
    createPara(
      'Dưới đây là danh mục toàn bộ 21 yêu cầu chức năng được trích xuất trực tiếp từ mã nguồn triển khai thực tế của dự án DENSO IoT Monitoring, phân nhóm theo 8 module nghiệp vụ:'
    )
  );

  const frListRows = [
    new TableRow({
      children: [
        createCell('Mã FR', { isHeader: true, widthPercent: 10 }),
        createCell('Tên Chức Năng', { isHeader: true, widthPercent: 25 }),
        createCell('Module', { isHeader: true, widthPercent: 15 }),
        createCell('Actor', { isHeader: true, widthPercent: 15 }),
        createCell('Trạng Thái', { isHeader: true, widthPercent: 15 }),
        createCell('File Mã Nguồn Đối Chiếu', { isHeader: true, widthPercent: 20 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-001', { bold: true }),
        createCell('Đăng nhập JWT & Dual Auth'),
        createCell('M1 - Xác thực'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L192)\nLoginPage.tsx'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-002', { bold: true }),
        createCell('Xác thực Phiên & Tự động Gia hạn'),
        createCell('M1 - Xác thực'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L288)\napi.ts (L14)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-003', { bold: true }),
        createCell('Đăng xuất & Ghi vết Audit'),
        createCell('M1 - Xác thực'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L313)\nuseAuthStore.ts'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-004', { bold: true }),
        createCell('Dashboard KPI Tổng Quan Tầng 1'),
        createCell('M2 - 3 Tầng'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('LineOverviewDashboard.tsx\nserver/index.js (L884)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-005', { bold: true }),
        createCell('Quản lý Luồng & Máy móc Tầng 2'),
        createCell('M2 - 3 Tầng'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('MachineListView.tsx\nserver/db-mysql.js (L182)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-006', { bold: true }),
        createCell('Xem Chi Tiết Chỉ Số & Đồ Thị Tầng 3'),
        createCell('M2 - 3 Tầng'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('MachineDetailModal.tsx\nMetricHistoryChart.tsx'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-007', { bold: true }),
        createCell('Đánh Giá 4 Ngưỡng & Chuyển Đổi PLC'),
        createCell('M4 - Cấu hình'),
        createCell('Hệ thống'),
        createCell('Đã triển khai'),
        createCell('plcConverter.ts (L16-L89)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-008', { bold: true }),
        createCell('Cấu hình 4 Ngưỡng Kỹ thuật Cảm biến'),
        createCell('M4 - Cấu hình'),
        createCell('Admin, Tech'),
        createCell('Đã triển khai'),
        createCell('ThresholdConfigView.tsx\nuseMonitoringStore.ts (L154)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-009', { bold: true }),
        createCell('Giám sát & Bật/Tắt Trạm PLC'),
        createCell('M4 - Cấu hình'),
        createCell('Admin, Tech'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L583)\nserver/db-mysql.js (L417)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-010', { bold: true }),
        createCell('Quy trình Xử lý Sự cố 3 Bước'),
        createCell('M3 - Sự cố'),
        createCell('Tất cả'),
        createCell('Triển khai 1 phần'),
        createCell('AlarmLogView.tsx\nuseAlarmStore.ts (L33)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-011', { bold: true }),
        createCell('Kích hoạt Sự cố Giả lập Khẩn cấp'),
        createCell('M3 - Sự cố'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('Header.tsx (L130)\nuseMonitoringStore.ts (L368)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-012', { bold: true }),
        createCell('Quản trị Người dùng & Phân quyền CRUD'),
        createCell('M6 - User Mgmt'),
        createCell('Admin'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L331-L491)\nUserManagementView.tsx'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-013', { bold: true }),
        createCell('Tải lên & Cập nhật Ảnh Đại Diện Multer'),
        createCell('M6 - User Mgmt'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L496)\nUserManagementView.tsx'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-014', { bold: true }),
        createCell('Nhật ký Kiểm toán Hệ thống & Xuất CSV'),
        createCell('M7 - Audit'),
        createCell('Admin, Tech'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L548)\nAuditLogView.tsx'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-015', { bold: true }),
        createCell('Mã QR Thiết Bị & Tra cứu Nhanh'),
        createCell('M8 - QR Code'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('QRCodeModal.tsx\nMachineListView.tsx (L42)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-016', { bold: true }),
        createCell('Truy vấn Lịch sử Hoạt động Máy MySQL'),
        createCell('M5 - Lịch sử'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L657)\nMachineHistoryView.tsx'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-017', { bold: true }),
        createCell('Lọc Đa Tiêu Chí & Ca Đêm Qua Nửa Đêm'),
        createCell('M5 - Lịch sử'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('server/db-mysql.js (L550)\nstage4a_test.js (L300)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-018', { bold: true }),
        createCell('Động cơ Xuất Dữ liệu Excel/CSV/JSON'),
        createCell('M5 - Lịch sử'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('src/utils/exportEngine.ts\nverify_real_exports.js'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-019', { bold: true }),
        createCell('Chặn Giới hạn Xuất Trần 10.000 Bản ghi'),
        createCell('M5 - Lịch sử'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L781)\nserver/db-mysql.js (L680)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-020', { bold: true }),
        createCell('Bộ ghi Telemetry Tự động Chạy Ngầm'),
        createCell('M5 - Lịch sử'),
        createCell('Hệ thống'),
        createCell('Đã triển khai'),
        createCell('server/index.js (L905-L954)\nserver/db-mysql.js (L462)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-021', { bold: true }),
        createCell('Giao diện Thích ứng Dark/Light Mode'),
        createCell('Hệ thống UI'),
        createCell('Tất cả'),
        createCell('Đã triển khai'),
        createCell('ThemeToggle.tsx\nuseThemeStore.ts'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: frListRows,
      borders: thinBorders,
    })
  );

  elements.push(createH2('4.2. Đặc tả chi tiết các phân hệ chức năng trọng yếu'));

  // FR-001 & FR-002
  elements.push(createH3('Đặc tả FR-001 & FR-002: Xác thực Người dùng & Phiên Đăng nhập (JWT Dual Auth)'));
  elements.push(createPara('• Mục tiêu: Cung cấp cơ chế đăng nhập an toàn bằng định danh nhân viên DENSO, phân quyền truy cập theo vai trò và duy trì phiên làm việc không gián đoạn.'));
  elements.push(createPara('• Dữ liệu đầu vào: Email (định dạng @denso.com) và mật khẩu dạng text.'));
  elements.push(createPara('• Dữ liệu đầu ra: JWT Access Token (hạn 8 giờ), Refresh Token (hạn 7 ngày) và Object thông tin hồ sơ nhân viên (không chứa password hash).'));
  elements.push(createPara('• Quy trình xử lý (Flow): (1) Kiểm tra email/password không rỗng; (2) Truy vấn MySQL tìm bản ghi theo email; nếu MySQL phản hồi, kiểm tra mật khẩu qua bcrypt.compareSync(); (3) Nếu MySQL offline hoặc không phản hồi, tự động chuyển sang kiểm tra mảng fallbackUsers; (4) Nếu khớp mật khẩu, tạo token và trả về HTTP 200; nếu không khớp trả về HTTP 401; (5) Tự động ghi bản ghi Audit Log LOGIN.'));
  elements.push(createPara('• Business Rules: Mật khẩu băm Bcrypt 10 vòng; tài khoản có status=\'INACTIVE\' bị từ chối đăng nhập (HTTP 403).'));
  elements.push(createPara('• Tiêu chí nghiệm thu (Acceptance Criteria): Đăng nhập đúng email/pass trả về token; đăng nhập sai trả về thông báo lỗi thân thiện tiếng Việt; tự động logout khi token hết hạn.'));

  // FR-004 & FR-005
  elements.push(createH3('Đặc tả FR-004 & FR-005: Giám sát Phân cấp 3 Tầng Nhà máy (Line -> Machine -> Metric)'));
  elements.push(createPara('• Mục tiêu: Cung cấp góc nhìn từ vĩ mô toàn xưởng đến vi mô từng cảm biến máy móc, giúp phát hiện ngay dây chuyền đang suy giảm chỉ số an toàn.'));
  elements.push(createPara('• Dữ liệu đầu vào: Gói tin WebSocket iot_telemetry_tick từ Backend phát sóng mỗi 2 giây.'));
  elements.push(createPara('• Dữ liệu đầu ra: 4 thẻ KPI toàn xưởng, danh sách 3 dây chuyền (LineCard), thanh pipeline chuyển đổi luồng và bảng danh sách máy Tầng 2 kèm nhãn trạng thái màu sắc.'));
  elements.push(createPara('• Business Rules (BR-01, 02, 03): Một máy bị Critical khi có ít nhất 1 metric con Critical; điểm an toàn dây chuyền tỷ lệ thuận với số lượng metric Normal.'));
  elements.push(createPara('• Acceptance Criteria: Khi có sự cố Critical, banner cảnh báo xuất hiện trên đầu trang; đổi màu thẻ chuyền tương ứng; biểu đồ cập nhật không gây giật lag trình duyệt.'));

  // FR-008 & FR-009
  elements.push(createH3('Đặc tả FR-008 & FR-009: Cấu hình Ngưỡng Cảm biến & Trạm Truyền thông PLC'));
  elements.push(createPara('• Mục tiêu: Cho phép kỹ sư tự động hóa điều chỉnh dải an toàn cho từng cảm biến và kiểm soát kết nối tới các trạm PLC Siemens/Omron.'));
  elements.push(createPara('• Điều kiện thực hiện (Pre-condition): Đăng nhập với vai trò ADMIN hoặc MAINTENANCE. Tài khoản OPERATOR bị hiển thị màn hình 403 Shield.'));
  elements.push(createPara('• Quy trình xử lý: (1) Chọn dây chuyền và loại chỉ số; (2) Thay đổi giá trị Warning/Critical Min/Max; (3) Nhấn Lưu cấu hình; hệ thống cập nhật Store và tự động gửi API POST /api/audit-logs ghi nhận thay đổi; (4) Tại danh sách PLC, nhấn công tắc chuyển trạng thái kết nối, Backend cập nhật độ trễ (latency) và phát sóng WebSocket plc_update.'));
  elements.push(createPara('• Acceptance Criteria: Dữ liệu ngưỡng cập nhật tức thời; trạng thái các máy con tự động tính toán lại màu sắc dựa trên ngưỡng mới; ghi đầy đủ IP và nội dung thay đổi vào Audit Log.'));

  // FR-010 & FR-011
  elements.push(createH3('Đặc tả FR-010 & FR-011: Quản lý Nhật ký Sự cố & Quy trình Xử lý 3 Bước'));
  elements.push(createPara('• Mục tiêu: Chuẩn hóa quy trình phản ứng nhanh khi có sự cố cơ khí trên chuyền, đảm bảo không sự cố nào bị bỏ quên.'));
  elements.push(createPara('• Quy trình xử lý: Sự cố phát sinh ở trạng thái Pending → Nhân viên bấm "Đã nhận sửa" → Chuyển sang Acknowledged (ghi nhận tên và giờ) → Thợ kỹ thuật bấm "Hoàn thành" → Mở Modal nhập biên bản nghiệm thu → Lưu sang Resolved.'));
  elements.push(createPara('• Business Rules (BR-04, 05): Bắt buộc nhập biên bản nghiệm thu; tài khoản OPERATOR bị ẩn nút Hoàn thành.'));
  elements.push(createPara('• Acceptance Criteria: Lọc được theo Dây chuyền, Mức độ (Warning/Critical), Trạng thái (Pending/Ack/Resolved); xuất báo cáo danh sách sự cố ra file CSV UTF-8 có BOM mở không lỗi tiếng Việt trên Excel.'));

  // FR-016, 017, 018, 019
  elements.push(createH3('Đặc tả FR-016 đến FR-019: Lịch sử Hoạt động Máy & Động cơ Xuất Báo cáo Đa định dạng'));
  elements.push(createPara('• Mục tiêu: Cung cấp kho dữ liệu chuỗi thời gian bền vững lưu trữ trong MySQL, hỗ trợ bộ lọc liên hoàn và xuất file báo cáo phục vụ quản lý và phân tích AI.'));
  elements.push(createPara('• Bộ lọc liên hoàn: Tuyến lọc phân cấp Dây chuyền (Line) → Máy (Machine) → Chỉ số (Metric); Lọc theo trạng thái (normal/warning/critical); Lọc theo khoảng ngày và giờ; Nút chọn nhanh Ca làm việc: Ca 1 (06:00-14:00), Ca 2 (14:00-22:00) và Ca 3 qua đêm (22:00-06:00).'));
  elements.push(createPara('• Business Rules (BR-06, 07, 08, 09, 10): Chống trùng lặp bằng SHA-256; chuẩn hóa UTC; xử lý bước nhảy ngày dương lịch cho ca đêm; khống chế trần xuất 10.000 dòng; khử formula injection trên CSV; xuất Excel chuẩn OpenXML nén nhị phân PKZIP zero-dependency.'));
  elements.push(createPara('• Acceptance Criteria: Dữ liệu tải về mở được trên Excel hiển thị đúng dấu tiếng Việt; số lượng bản ghi giữa 3 file Excel, CSV, JSON hoàn toàn trùng khớp với nhau và với kết quả đếm trong MySQL.'));

  // =========================================================================
  // CHƯƠNG 5: USE CASE SPECIFICATION
  // =========================================================================
  elements.push(createH1('CHƯƠNG 5: ĐẶC TẢ USE CASE (USE CASE SPECIFICATION)'));

  elements.push(createH2('5.1. Danh sách Use Case tổng quan'));
  elements.push(
    createPara(
      'Hệ thống bao gồm 10 Use Case nghiệp vụ chính bao quát toàn bộ hoạt động từ vận hành, bảo trì đến quản trị cấp cao:'
    )
  );

  const ucListRows = [
    new TableRow({
      children: [
        createCell('Mã UC', { isHeader: true, widthPercent: 12 }),
        createCell('Tên Use Case', { isHeader: true, widthPercent: 30 }),
        createCell('Actor Chính', { isHeader: true, widthPercent: 20 }),
        createCell('Trigger (Sự kiện kích hoạt)', { isHeader: true, widthPercent: 23 }),
        createCell('Tham chiếu FR', { isHeader: true, widthPercent: 15 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-01', { bold: true }),
        createCell('Đăng nhập hệ thống'),
        createCell('Tất cả người dùng'),
        createCell('Mở ứng dụng hoặc phiên hết hạn'),
        createCell('FR-001, 002'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-02', { bold: true }),
        createCell('Giám sát Dashboard tổng quan'),
        createCell('Operator, Tech, Admin'),
        createCell('Đăng nhập thành công'),
        createCell('FR-004'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-03', { bold: true }),
        createCell('Xem chi tiết chỉ số & đồ thị máy'),
        createCell('Operator, Tech, Admin'),
        createCell('Nhấp vào thẻ máy hoặc quét mã QR'),
        createCell('FR-005, 006, 015'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-04', { bold: true }),
        createCell('Tiếp nhận sự cố cảnh báo'),
        createCell('Operator, Tech, Admin'),
        createCell('Có sự cố Pending phát sinh'),
        createCell('FR-010'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-05', { bold: true }),
        createCell('Nghiệm thu & Hoàn tất sự cố'),
        createCell('Maintenance, Admin'),
        createCell('Sự cố đã được khắc phục tại xưởng'),
        createCell('FR-010'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-06', { bold: true }),
        createCell('Cấu hình 4 ngưỡng kỹ thuật'),
        createCell('Maintenance, Admin'),
        createCell('Điều chỉnh quy chuẩn công nghệ'),
        createCell('FR-008'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-07', { bold: true }),
        createCell('Bật/Tắt kết nối trạm PLC'),
        createCell('Maintenance, Admin'),
        createCell('Bảo trì định kỳ đường truyền'),
        createCell('FR-009'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-08', { bold: true }),
        createCell('Quản lý tài khoản & phân quyền'),
        createCell('Admin'),
        createCell('Có nhân sự mới hoặc chuyển đổi ca'),
        createCell('FR-012, 013'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-09', { bold: true }),
        createCell('Truy vấn lịch sử máy & Xuất file'),
        createCell('Operator, Tech, Admin'),
        createCell('Lập báo cáo ca hoặc phân tích lỗi'),
        createCell('FR-016, 017, 018'),
      ],
    }),
    new TableRow({
      children: [
        createCell('UC-10', { bold: true }),
        createCell('Giả lập sự cố khẩn cấp demo'),
        createCell('Admin, Tech, Operator'),
        createCell('Nhấn nút "Kích hoạt sự cố demo"'),
        createCell('FR-011'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: ucListRows,
      borders: thinBorders,
    })
  );

  elements.push(createH2('5.2. Đặc tả chi tiết Use Case trọng yếu UC-09: Truy vấn Lịch sử Máy & Xuất Báo Cáo'));
  elements.push(createPara('• Tên Use Case: UC-09 - Truy vấn Lịch sử Hoạt động Máy & Xuất Báo Cáo Đa Định Dạng.'));
  elements.push(createPara('• Actor chính: Kỹ thuật viên (Maintenance), Quản trị viên (Admin), Công nhân vận hành (Operator).'));
  elements.push(createPara('• Điều kiện tiên quyết (Pre-conditions): Người dùng đã đăng nhập hợp lệ vào hệ thống; tab "Lịch sử máy" khả dụng trên Sidebar hoặc Header.'));
  elements.push(createPara('• Điều kiện sau khi hoàn thành (Post-conditions): Bảng dữ liệu hiển thị đúng tập bản ghi telemetry từ CSDL MySQL; nếu chọn xuất file, trình duyệt tự động tải xuống file Excel (.xlsx), CSV (.csv) hoặc JSON (.json) với cấu trúc dữ liệu toàn vẹn.'));
  elements.push(createPara('• Luồng chính (Main Flow):'));
  elements.push(createPara('  1. Người dùng chọn tab "Lịch sử máy" trên thanh điều hướng.'));
  elements.push(createPara('  2. Giao diện tải mặc định 20 bản ghi mới nhất từ CSDL MySQL qua API GET /api/telemetry/logs.'));
  elements.push(createPara('  3. Người dùng chọn Dây chuyền (Line 1) → Menu Thiết bị tự động lọc danh sách máy con thuộc Line 1 → Người dùng chọn Máy (MC-CYL-01) → Menu Chỉ số tự động lọc các metric của máy.'));
  elements.push(createPara('  4. Người dùng bấm nút chọn nhanh "Ca 3 (Đêm)", hệ thống tự động điền khung giờ 22:00 - 06:00.'));
  elements.push(createPara('  5. Người dùng nhấn nút "Áp dụng bộ lọc". Hệ thống gửi request với đầy đủ tham số và render lại bảng kết quả cùng số liệu phân trang.'));
  elements.push(createPara('  6. Người dùng nhấn nút "Xuất dữ liệu" và chọn định dạng mong muốn (ví dụ: "Xuất Excel (.xlsx)").'));
  elements.push(createPara('  7. Hệ thống gọi API ngầm với isExport=true để lấy toàn bộ dữ liệu thỏa mãn bộ lọc (tối đa 10.000 dòng).'));
  elements.push(createPara('  8. Động cơ exportEngine tạo file nhị phân OpenXML hợp lệ và kích hoạt hộp thoại tải file an toàn trên trình duyệt.'));
  elements.push(createPara('• Luồng ngoại lệ (Exception Flows):'));
  elements.push(createPara('  - E1: Số lượng bản ghi vượt quá 10.000 dòng → Backend từ chối với HTTP 400 và exportAllowed=false. Giao diện hiển thị cảnh báo màu vàng yêu cầu người dùng thu hẹp khoảng thời gian hoặc lọc cụ thể theo máy.'));
  elements.push(createPara('  - E2: CSDL MySQL ngoại tuyến hoặc chưa sẵn sàng → Hệ thống trả về trạng thái status=\'degraded\'. Giao diện hiển thị biểu tượng Database màu hổ phách cảnh báo "Cơ sở dữ liệu trung tâm đang bảo trì, chức năng lịch sử tạm thời ở chế độ suy giảm" mà không gây sập ứng dụng.'));

  // =========================================================================
  // CHƯƠNG 6: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 6: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)'));

  elements.push(createH2('6.1. Bảo mật hệ thống (Security)'));
  elements.push(
    createPara(
      'Hệ thống áp dụng các nguyên tắc phòng vệ chiều sâu (Defense-in-Depth):'
    )
  );
  elements.push(
    createPara(
      '• Xác thực kép (JWT Authentication): Sử dụng cặp Access Token (ký bằng HMAC SHA-256, thời hạn 8 giờ) và Refresh Token (thời hạn 7 ngày). Token được tự động gắn vào Header Authorization: Bearer <token> cho mọi request qua apiClient.'
    )
  );
  elements.push(
    createPara(
      '• Băm mật khẩu (Password Hashing): Mật khẩu người dùng trong MySQL được băm bằng thuật toán Bcrypt với hệ số Salt Rounds = 10. Tuyệt đối không lưu mật khẩu dạng bản rõ (plaintext).'
    )
  );
  elements.push(
    createPara(
      '• Chống tấn công SQL Injection: Toàn bộ truy vấn trong server/db-mysql.js sử dụng SQL Parameterized Queries (cú pháp dấu hỏi chấm ? của mysql2/promise). Cột sắp xếp sortBy được kiểm tra nghiêm ngặt qua danh sách trắng (Whitelist Validation) gồm 7 cột hợp lệ, triệt tiêu nguy cơ chèn câu lệnh phá hoại.'
    )
  );
  elements.push(
    createPara(
      '• Phòng chống CSV Formula Injection: Toàn bộ dữ liệu xuất ra CSV được kiểm tra; nếu ô bắt đầu bằng các ký tự nguy hiểm (=, +, -, @, \\t, \\r), động cơ xuất tự động chèn thêm dấu nháy đơn (\') vào đầu để vô hiệu hóa việc Excel thực thi mã độc.'
    )
  );

  elements.push(createH2('6.2. Hiệu năng & Tối ưu hóa xử lý (Performance)'));
  elements.push(
    createPara(
      '• Độ trễ truyền thông thời gian thực: Giao thức WebSocket thuần (thư viện ws) duy trì kết nối hai chiều liên tục, thời gian truyền gói tin telemetry từ Backend tới Browser đạt dưới 100ms trên mạng LAN nội bộ nhà máy.'
    )
  );
  elements.push(
    createPara(
      '• Tối ưu hóa CSDL (Database Indexing): Bảng machine_telemetry_history được đánh chỉ mục tổ hợp tối ưu cho các truy vấn phổ biến nhất: idx_line_time (lineId, timestamp DESC), idx_machine_time (machineId, timestamp DESC), idx_metric_time (metricId, timestamp DESC) và idx_time_status (timestamp DESC, status).'
    )
  );
  elements.push(
    createPara(
      '• Giới hạn hiển thị đồ thị (Sliding Window): Biểu đồ Recharts chỉ lưu giữ và vẽ 20 điểm dữ liệu chuỗi thời gian gần nhất trong bộ nhớ trình duyệt, ngăn chặn hiện tượng tràn RAM và giật lag khi mở dashboard liên tục nhiều ngày trên màn hình Andon.'
    )
  );
  elements.push(
    createPara(
      '• Giới hạn trần xuất an toàn (10.000 dòng): Giúp máy chủ Node.js không bao giờ bị vượt ngưỡng bộ nhớ heap khi có nhiều người dùng cùng tải dữ liệu lịch sử.'
    )
  );

  elements.push(createH2('6.3. Tính sẵn sàng & Chống sập (Availability & Fault Tolerance)'));
  elements.push(
    createPara(
      '• Kiến trúc Dual-Storage Fallback: Khi CSDL MySQL bị ngắt kết nối hoặc nhà cung cấp cloud (Render/Aiven) đang khởi động, Backend tự động chuyển sang cơ chế xác thực bộ nhớ dự phòng (In-Memory Fallback) với 3 tài khoản mặc định, đảm bảo màn hình Dashboard và WebSocket vẫn hoạt động bình thường.'
    )
  );
  elements.push(
    createPara(
      '• Cơ chế kết nối lại CSDL có kiểm soát (Retry Loop): Hàm connectDatabaseWithRetry() thử kết nối CSDL tối đa 10 lần với khoảng nghỉ 4 giây/lần. Máy chủ luôn mở cổng HTTP ngay lập tức để vượt qua quy trình Healthcheck của các nền tảng PaaS mà không bao giờ gọi process.exit(1) làm sập ứng dụng.'
    )
  );

  elements.push(createH2('6.4. Tính toàn vẹn dữ liệu (Data Integrity)'));
  elements.push(
    createPara(
      '• Chuẩn hóa múi giờ quốc tế: MySQL connection pool cấu hình timezone: \'+00:00\'. Toàn bộ thời gian được lưu trữ chuẩn DATETIME(3) với độ chính xác mili-giây. Khi người dùng lọc theo giờ Việt Nam, hệ thống chuyển đổi tường minh sang UTC trước khi truy vấn SQL.'
    )
  );
  elements.push(
    createPara(
      '• Độ chính xác số học: Các giá trị cảm biến được lưu trữ dưới dạng DECIMAL(10, 2) trong CSDL, bảo toàn tuyệt đối 2 chữ số thập phân, không bị hiện tượng sai số dấu phẩy động (Floating-point precision issue) khi tổng hợp số liệu.'
    )
  );

  elements.push(createH2('6.5. Trải nghiệm người dùng & Khả năng tương thích (Usability & Compatibility)'));
  elements.push(
    createPara(
      '• Giao diện chuẩn công nghiệp: Ứng dụng hỗ trợ hoàn hảo cả 2 chế độ Sáng (Light Mode - tối ưu cho văn phòng quản đốc) và Tối (Dark Mode - tối ưu cho màn hình TV Andon treo trên cao trong nhà xưởng).'
    )
  );
  elements.push(
    createPara(
      '• Khả năng phản hồi trên đa thiết bị (Responsive Design): Giao diện tự động co giãn từ màn hình máy tính bàn, máy tính bảng công nghiệp đến điện thoại di động của kỹ thuật viên hiện trường.'
    )
  );
  elements.push(
    createPara(
      '• Tương thích Microsoft Excel: File CSV được gắn tiền tố 3 byte UTF-8 BOM (0xEF 0xBB 0xBF), cho phép người dùng nhấp đúp mở trực tiếp trên mọi phiên bản Excel mà không bao giờ bị lỗi hiển thị phông chữ tiếng Việt có dấu.'
    )
  );

  return elements;
}
