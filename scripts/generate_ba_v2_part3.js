/**
 * @file scripts/generate_ba_v2_part3.js
 * @description Part 3 of BA Documentation v2.0: Chapter 5 (10 Use Cases in full specification + Diagrams) & Chapter 6 (NFR)
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
} from './generate_ba_v2_helpers.js';

// Danh sách dữ liệu đặc tả chi tiết 10 Use Cases
const ucData = [
  {
    id: 'UC-01',
    name: 'Đăng nhập hệ thống & Duy trì phiên làm việc',
    objective: 'Xác thực danh tính người dùng bằng email nhân viên DENSO, phân quyền truy cập và duy trì phiên an toàn.',
    primaryActor: 'Tất cả người dùng (Admin, Maintenance, Operator)',
    secondaryActor: 'Hệ thống xác thực JWT & CSDL MySQL (hoặc In-memory fallback)',
    trigger: 'Người dùng mở ứng dụng chưa đăng nhập hoặc phiên làm việc đã hết hạn.',
    preconditions: 'Trình duyệt truy cập vào URL máy chủ web; dịch vụ Backend đang hoạt động.',
    postconditions: 'Cấp phát token, lưu thông tin vào localStorage và chuyển hướng vào Dashboard.',
    mainFlow: '1. Người dùng truy cập trang web, hiển thị màn hình LoginPage.\n2. Người dùng nhập Email và Mật khẩu (hoặc nhấp chọn tài khoản mẫu Admin/Operator tại chân trang).\n3. Nhấn nút "Đăng Nhập".\n4. Frontend gửi POST /api/auth/login kèm thông tin.\n5. Backend kiểm tra tài khoản trong MySQL (băm Bcrypt). Nếu MySQL offline, kiểm tra danh sách fallbackUsers.\n6. Nếu hợp lệ, sinh JWT access token và refresh token.\n7. Cập nhật thời điểm lastLoginAt và ghi bản ghi Audit Log LOGIN.\n8. Trả về token và hồ sơ an toàn. Frontend lưu phiên và hiển thị giao diện chính.',
    altFlows: 'A1: Sử dụng tài khoản mẫu: Người dùng nhấp vào thẻ Admin hoặc Operator ở chân trang LoginPage, hệ thống tự động điền email và mật khẩu mẫu rồi đăng nhập tức thì.',
    exceptionFlows: 'E1: Email hoặc mật khẩu rỗng -> Báo lỗi "Vui lòng cung cấp đầy đủ email và mật khẩu".\nE2: Thông tin xác thực không đúng -> Báo lỗi "Email hoặc mật khẩu không chính xác".\nE3: Tài khoản bị khóa (status=INACTIVE) -> Báo lỗi "Tài khoản đã bị tạm khóa. Vui lòng liên hệ Admin".',
    businessRules: 'BR-06, BR-11 (Băm Bcrypt 10 vòng, chặn tài khoản INACTIVE).',
    acceptanceCriteria: 'Given người dùng ở trang đăng nhập, When nhập đúng email và mật khẩu, Then được chuyển hướng vào Dashboard trong vòng 1 giây.',
    relatedFR: 'FR-001, FR-002',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
  {
    id: 'UC-02',
    name: 'Giám sát chỉ số an toàn toàn xưởng & Trạng thái 3 dây chuyền',
    objective: 'Theo dõi tổng quan sức khỏe toàn bộ nhà máy, phát hiện sớm các dây chuyền đang suy giảm an toàn.',
    primaryActor: 'Operator, Maintenance, Admin',
    secondaryActor: 'WebSocket Server (phát sóng dữ liệu chuỗi thời gian)',
    trigger: 'Người dùng đăng nhập thành công hoặc chuyển về tab "Dashboard".',
    preconditions: 'Phiên làm việc còn hiệu lực; kết nối WebSocket được thiết lập.',
    postconditions: 'Màn hình hiển thị đầy đủ 4 thẻ KPI, Banner cảnh báo nếu có sự cố nguy hiểm và danh sách 3 dây chuyền.',
    mainFlow: '1. Người dùng chọn tab "Dashboard".\n2. Hệ thống tải dữ liệu 3 dây chuyền từ useMonitoringStore.\n3. Tính toán avgSafetyScore toàn xưởng và phân loại trạng thái chuyền.\n4. Nếu có sự cố Critical chưa giải quyết, hiển thị Banner đỏ nhấp nháy trên đầu trang.\n5. Lắng nghe gói tin iot_telemetry_tick từ WebSocket mỗi 2 giây để cập nhật chuyển động mượt mà.\n6. Người dùng có thể nhấp vào một thẻ LineCard để chuyển sâu vào danh mục máy Tầng 2.',
    altFlows: 'A1: Tạm dừng cập nhật thời gian thực: Người dùng gạt công tắc "Realtime" trên Header để tạm ngưng xung nhịp mô phỏng phục vụ quan sát số liệu tĩnh.',
    exceptionFlows: 'E1: Mất kết nối WebSocket -> Trình duyệt kích hoạt cơ chế tự động kết nối lại (auto-reconnect) sau 3 giây mà không làm gián đoạn giao diện.',
    businessRules: 'BR-01, BR-02, BR-03 (Công thức tính điểm an toàn và lan truyền trạng thái).',
    acceptanceCriteria: 'Given xưởng đang có 1 máy dập vượt ngưỡng Critical, When mở Dashboard, Then Banner cảnh báo đỏ xuất hiện ngay lập tức kèm tên máy và tên chỉ số bị lỗi.',
    relatedFR: 'FR-004',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
  {
    id: 'UC-03',
    name: 'Xem chi tiết chỉ số kỹ thuật & Đồ thị chuỗi thời gian máy',
    objective: 'Chẩn đoán sâu tình trạng kỹ thuật của từng thiết bị, xem biểu đồ biến thiên 20 điểm đo gần nhất.',
    primaryActor: 'Operator, Maintenance, Admin',
    secondaryActor: 'Recharts Rendering Engine',
    trigger: 'Nhấn nút "Chẩn đoán" trên hàng máy hoặc quét mã QR thiết bị tại hiện trường.',
    preconditions: 'Thiết bị tồn tại trong danh mục máy Tầng 2.',
    postconditions: 'Modal Chi tiết Component hiển thị đầy đủ thuộc tính, lưới metric và biểu đồ AreaChart.',
    mainFlow: '1. Người dùng chọn 1 máy trong danh sách Luồng & Thành phần và nhấn "Chẩn đoán".\n2. Hệ thống mở Modal Chi tiết Component kích thước lớn.\n3. Hiển thị thông số máy: model, mã trạm, vị trí, giờ hoạt động.\n4. Hiển thị danh mục chỉ số đo lường (áp suất, nhiệt độ, độ rung...). Nhấp chọn 1 chỉ số.\n5. Vẽ biểu đồ Recharts AreaChart hiển thị 20 điểm đo gần nhất kèm đường nét đứt biểu diễn ngưỡng Critical và Warning.\n6. Người dùng chọn dải thời gian xem (1h, 6h, 24h) hoặc bấm "Làm mới dữ liệu".',
    altFlows: 'A1: Mở nhanh mã QR: Từ trong Modal chẩn đoán, người dùng bấm nút icon QR để xem mã QR của chính máy đó.',
    exceptionFlows: 'E1: Máy chưa có chỉ số nào được cấu hình -> Hiển thị thông báo "Không có chỉ số đo lường".',
    businessRules: 'BR-01, BR-02, BR-15 (Đánh giá ngưỡng và thang đo kỹ thuật).',
    acceptanceCriteria: 'Given người dùng mở máy xi-lanh ép thủy lực 01, When nhấp chọn "Áp suất nén ép trục", Then biểu đồ diện tích hiển thị dải đo quanh 142.5 bar với đường giới hạn rõ ràng.',
    relatedFR: 'FR-005, FR-006, FR-015',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
  {
    id: 'UC-04',
    name: 'Tiếp nhận sự cố kỹ thuật bước 1 (Acknowledge Alarm)',
    objective: 'Xác nhận có người tiếp nhận xử lý khi máy móc gặp sự cố, chấm dứt tình trạng cảnh báo vô chủ.',
    primaryActor: 'Operator, Maintenance, Admin',
    secondaryActor: 'Hệ thống Audit Log MySQL',
    trigger: 'Có cảnh báo sự cố mới phát sinh ở trạng thái Pending.',
    preconditions: 'Sự cố đang ở trạng thái Pending; người dùng đang đăng nhập hợp lệ.',
    postconditions: 'Sự cố chuyển sang Acknowledged; lưu vết tên người tiếp nhận và thời gian vào hệ thống.',
    mainFlow: '1. Người dùng mở trang "Nhật ký sự cố" (AlarmLogView.tsx) hoặc nhấp nút điều hướng từ Banner cảnh báo.\n2. Tìm sự cố đang ở trạng thái "Chờ tiếp nhận" (Pending).\n3. Nhấn nút "Đã nhận sửa" (Acknowledge).\n4. useAlarmStore cập nhật status=\'acknowledged\', assignedTo = currentUser.name, acknowledgedAt = ISO timestamp.\n5. Tự động gửi POST /api/audit-logs ghi nhận hành động ACKNOWLEDGE_ALARM.\n6. Nút hành động đổi sang nút xanh "Hoàn tất" (Resolve).',
    altFlows: 'A1: Tìm kiếm sự cố: Người dùng nhập từ khóa tìm kiếm theo tên máy hoặc tên chỉ số để định vị sự cố nhanh.',
    exceptionFlows: 'E1: Sự cố đã có người khác tiếp nhận trước đó -> Nút hành động tự động chuyển sang trạng thái đang xử lý.',
    businessRules: 'BR-04 (Tiếp nhận sự cố và ghi vết kiểm toán).',
    acceptanceCriteria: 'Given sự cố quá nhiệt máy cấp phôi đang Pending, When công nhân bấm "Đã nhận sửa", Then trạng thái đổi sang Acknowledged và hiển thị tên công nhân tiếp nhận.',
    relatedFR: 'FR-010',
    status: 'Đã triển khai một phần (Zustand Store + Audit Log MySQL)',
  },
  {
    id: 'UC-05',
    name: 'Nghiệm thu kỹ thuật & Hoàn tất đóng sự cố (Resolve Alarm)',
    objective: 'Ghi nhận biện pháp khắc phục kỹ thuật, nghiệm thu thông số đã an toàn và chính thức đóng sự cố.',
    primaryActor: 'Maintenance, Admin (Chặn Operator)',
    secondaryActor: 'Hệ thống Audit Log MySQL',
    trigger: 'Kỹ thuật viên đã xử lý xong sự cố cơ khí tại hiện trường.',
    preconditions: 'Sự cố đang ở trạng thái Acknowledged; người dùng có vai trò MAINTENANCE hoặc ADMIN.',
    postconditions: 'Sự cố chuyển sang trạng thái Resolved, ghi chú nghiệm thu được lưu vết vĩnh viễn.',
    mainFlow: '1. Kỹ thuật viên mở trang Nhật ký sự cố.\n2. Tìm sự cố đã tiếp nhận trước đó (Acknowledged).\n3. Nhấn nút "Hoàn thành" màu xanh.\n4. Hệ thống mở Modal xác nhận hoàn tất sự cố.\n5. Kỹ thuật viên kiểm tra nội dung và điền biên bản giải pháp kỹ thuật (Resolution Notes).\n6. Nhấn nút "Xác nhận hoàn tất".\n7. useAlarmStore cập nhật status=\'resolved\', resolvedAt, resolutionNotes.\n8. Gửi POST /api/audit-logs ghi nhận RESOLVE_ALARM kèm chi tiết giải pháp.',
    altFlows: 'A1: Đóng Modal không lưu: Kỹ thuật viên bấm Hủy hoặc icon X, sự cố giữ nguyên trạng thái Acknowledged.',
    exceptionFlows: 'E1: Tài khoản OPERATOR đăng nhập -> Nút "Hoàn tất" bị ẩn hoàn toàn, không thể kích hoạt Modal nghiệm thu.\nE2: Biên bản giải pháp bị để trống -> Hệ thống yêu cầu nhập nội dung trước khi bấm lưu.',
    businessRules: 'BR-05 (Chỉ Maintenance/Admin mới được đóng sự cố; bắt buộc có biên bản nghiệm thu).',
    acceptanceCriteria: 'Given kỹ thuật viên mở modal nghiệm thu, When nhập ghi chú "Đã châm thêm dầu thủy lực" và xác nhận, Then sự cố chuyển sang Resolved và được ghi vào Audit Log.',
    relatedFR: 'FR-010',
    status: 'Đã triển khai một phần (Zustand Store + Audit Log MySQL)',
  },
  {
    id: 'UC-06',
    name: 'Cấu hình 4 ngưỡng kỹ thuật cảnh báo cho cảm biến',
    objective: 'Thiết lập các mốc giới hạn an toàn công nghệ cho từng chỉ số đo lường theo tiêu chuẩn sản xuất.',
    primaryActor: 'Maintenance, Admin (Chặn Operator bằng 403 Shield)',
    secondaryActor: 'useMonitoringStore & Audit Log MySQL',
    trigger: 'Có thay đổi về quy chuẩn công nghệ hoặc thay khuôn, đổi vật liệu gia công.',
    preconditions: 'Đăng nhập với vai trò ADMIN hoặc MAINTENANCE; mở tab "thresholds".',
    postconditions: 'Ngưỡng mới được lưu vào Store, các máy tự động cập nhật lại trạng thái an toàn.',
    mainFlow: '1. Người dùng chọn tab "Cấu hình ngưỡng".\n2. Hệ thống kiểm tra quyền. Nếu là Operator, hiển thị thẻ 403 Shield. Nếu hợp lệ, mở danh mục cảm biến.\n3. Lọc theo Dây chuyền và Loại chỉ số (Nhiệt độ, Áp suất, Độ rung, Điện).\n4. Người dùng chỉnh sửa các trường: Ngưỡng cảnh báo (Min/Max), Ngưỡng nguy hiểm (Min/Max).\n5. Nhấn nút "Lưu" (icon Save).\n6. useMonitoringStore gọi updateMetricThresholds(), tính toán lại trạng thái các máy.\n7. Tự động gửi POST /api/audit-logs ghi nhận hành động UPDATE_THRESHOLD.',
    altFlows: 'A1: Đặt lại giá trị ban đầu: Người dùng bấm icon Hoàn tác (RotateCcw) để khôi phục lại các giá trị ngưỡng trước khi sửa.',
    exceptionFlows: 'E1: Nhập giá trị sai quy tắc (Critical Min > Warning Min) -> Hệ thống cảnh báo giá trị không hợp lệ.',
    businessRules: 'BR-01, BR-04 (Quy tắc đánh giá 4 ngưỡng và ghi vết kiểm toán).',
    acceptanceCriteria: 'Given Admin đăng nhập, When sửa Critical Max của áp suất từ 180 lên 190 bar và bấm Lưu, Then giá trị được áp dụng ngay và ghi vào Audit Log.',
    relatedFR: 'FR-008',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
  {
    id: 'UC-07',
    name: 'Quản lý kết nối truyền thông trạm PLC công nghiệp',
    objective: 'Bật/Tắt đường truyền tín hiệu tới các trạm PLC Siemens và Omron phục vụ công tác bảo trì đường truyền.',
    primaryActor: 'Maintenance, Admin',
    secondaryActor: 'Backend API & CSDL MySQL (plc_stations)',
    trigger: 'Cần bảo trì mạng công nghiệp hoặc ngắt tín hiệu trạm máy để sửa chữa phần cứng.',
    preconditions: 'Đăng nhập với vai trò ADMIN hoặc MAINTENANCE; mở tab "thresholds".',
    postconditions: 'Trạng thái trạm PLC trong CSDL đổi sang Online hoặc Disconnected, phát sóng qua WebSocket.',
    mainFlow: '1. Người dùng mở tab "Cấu hình ngưỡng", cuộn tới khối "Trạm PLC Công nghiệp".\n2. Xem danh sách 2 trạm: Siemens S7-1500 (Modbus/TCP) và Omron NX1P2 (OPC-UA).\n3. Gạt công tắc trạng thái của trạm PLC cần điều khiển.\n4. Frontend gửi POST /api/plc-stations/:id/toggle.\n5. Backend cập nhật trường isConnected trong bảng plc_stations của MySQL.\n6. Ghi Audit Log hành động TOGGLE_PLC.\n7. Phát sóng WebSocket plc_update tới toàn bộ client để đồng bộ giao diện.',
    altFlows: 'A1: Điều chỉnh tốc độ lấy mẫu: Người dùng chọn lại chu kỳ Polling Rate (1000ms hoặc 2500ms) cho trạm PLC.',
    exceptionFlows: 'E1: Trạm PLC không tồn tại -> Backend trả về HTTP 404 "Không tìm thấy trạm PLC".',
    businessRules: 'BR-04 (Ghi vết kiểm toán bắt buộc).',
    acceptanceCriteria: 'Given trạm Siemens đang Online, When gạt công tắc tắt, Then trạng thái chuyển sang Mất tín hiệu, độ trễ về 0ms và phát sóng đồng bộ cho toàn bộ người dùng.',
    relatedFR: 'FR-009',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
  {
    id: 'UC-08',
    name: 'Quản lý tài khoản người dùng & Phân quyền nhân viên',
    objective: 'Cấp phát, cập nhật quyền hạn, khóa tài khoản và đặt lại mật khẩu cho nhân sự nhà máy.',
    primaryActor: 'Admin (Chặn hoàn toàn Operator và Maintenance)',
    secondaryActor: 'Backend API & CSDL MySQL (users)',
    trigger: 'Có nhân sự mới, thuyên chuyển ca làm việc hoặc nhân viên quên mật khẩu.',
    preconditions: 'Đăng nhập với vai trò ADMIN; mở tab "users".',
    postconditions: 'Dữ liệu tài khoản được cập nhật trong MySQL, mật khẩu được băm Bcrypt 10 vòng.',
    mainFlow: '1. Admin chọn tab "Người dùng".\n2. Hệ thống tải danh sách nhân viên từ MySQL qua GET /api/users.\n3. Thêm mới: Nhấn "Thêm nhân viên", nhập thông tin, chọn vai trò và chuyền phụ trách -> Gửi POST /api/users -> Lưu MySQL.\n4. Đặt lại mật khẩu: Nhấn icon Chìa khóa trên hàng nhân viên -> Xác nhận trong Modal -> Gửi POST /api/users/:id/reset-password -> Mật khẩu về mặc định 123456.\n5. Khóa tài khoản: Gạt công tắc CustomSwitch -> status chuyển sang INACTIVE.\n6. Xóa tài khoản: Nhấn icon Thùng rác -> Xác nhận Modal -> Gửi DELETE /api/users/:id.\n7. Mọi thao tác đều được ghi vào bảng audit_logs và phát sóng WebSocket.',
    altFlows: 'A1: Đổi ảnh đại diện: Admin bấm icon máy ảnh trên avatar nhân viên để tải ảnh đại diện mới qua Multer.',
    exceptionFlows: 'E1: Admin tự xóa tài khoản của chính mình -> Backend chặn với HTTP 400 "Không thể tự xóa tài khoản của chính mình".\nE2: Trùng mã nhân viên hoặc email -> Backend trả về HTTP 400 (ER_DUP_ENTRY).',
    businessRules: 'BR-11, BR-13 (Bảo vệ tài khoản quản trị và giới hạn ảnh Multer 5MB).',
    acceptanceCriteria: 'Given Admin ở trang Quản lý Người dùng, When bấm Đặt lại mật khẩu cho nhân viên DNS-1024, Then mật khẩu được đặt về "123456" và lưu vết vào CSDL.',
    relatedFR: 'FR-012, FR-013',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
  {
    id: 'UC-09',
    name: 'Truy vấn lịch sử hoạt động máy & Xuất báo cáo đa định dạng',
    objective: 'Truy vấn dữ liệu telemetry chuỗi thời gian trong MySQL, lọc theo ca làm việc và xuất file báo cáo.',
    primaryActor: 'Operator, Maintenance, Admin',
    secondaryActor: 'Export Engine (PKZIP OpenXML, CSV UTF-8 BOM, JSON) & MySQL',
    trigger: 'Người dùng cần lập báo cáo ca, kiểm tra dữ liệu sự cố hoặc lấy dữ liệu huấn luyện AI.',
    preconditions: 'Người dùng chọn tab "history"; CSDL MySQL có dữ liệu lịch sử.',
    postconditions: 'Dữ liệu hiển thị chuẩn xác trên bảng; tệp báo cáo được tải về an toàn trên trình duyệt.',
    mainFlow: '1. Người dùng chọn tab "Lịch sử máy".\n2. Hệ thống tải 20 bản ghi mới nhất từ MySQL qua GET /api/telemetry/logs.\n3. Người dùng lọc Cascade: chọn Dây chuyền → chọn Máy → chọn Chỉ số → chọn Trạng thái.\n4. Chọn nhanh ca làm việc: nhấn "Ca 3 (Đêm)" (tự điền 22:00 - 06:00 sáng hôm sau).\n5. Nhấn "Áp dụng bộ lọc", backend truy vấn và render bảng kết quả.\n6. Người dùng nhấn nút "Xuất dữ liệu" và chọn: Excel (.xlsx), CSV (.csv) hoặc JSON (.json).\n7. Backend kiểm tra số lượng bản ghi: nếu <= 10.000 dòng thì trả về toàn bộ dữ liệu.\n8. exportEngine tự đóng gói file chuẩn hóa và kích hoạt tải về trên máy tính.',
    altFlows: 'A1: Đặt lại bộ lọc: Người dùng bấm "Đặt lại", hệ thống xóa trắng các điều kiện lọc và nạp lại dữ liệu mặc định.',
    exceptionFlows: 'E1: Số bản ghi vượt quá 10.000 dòng -> Backend từ chối xuất (HTTP 400), hiển thị Banner vàng yêu cầu người dùng thu hẹp bộ lọc.\nE2: CSDL MySQL ngoại tuyến -> Hệ thống chuyển sang trạng thái Degraded Mode, hiển thị cảnh báo CSDL bảo trì.',
    businessRules: 'BR-06, BR-07, BR-08, BR-09, BR-10, BR-12 (Chuẩn hóa UTC, ca đêm qua nửa đêm, trần 10.000 dòng, khử CSV injection).',
    acceptanceCriteria: 'Given người dùng lọc Ca 3 đêm ngày 15/10/2026, When bấm xuất Excel, Then file .xlsx tải về mở được trên Microsoft Excel, có đúng số lượng bản ghi và định dạng cột chuẩn.',
    relatedFR: 'FR-016, FR-017, FR-018, FR-019',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
  {
    id: 'UC-10',
    name: 'Kích hoạt sự cố giả lập khẩn cấp phục vụ diễn tập',
    objective: 'Giả lập tình huống máy móc gặp sự cố nguy hiểm đột xuất để kiểm tra phản ứng của hệ thống và nhân viên.',
    primaryActor: 'Admin, Maintenance, Operator',
    secondaryActor: 'useAlarmStore & Audit Log MySQL',
    trigger: 'Người dùng nhấn nút "Sự cố khẩn cấp (Demo)" trên thanh Header.',
    preconditions: 'Hệ thống có ít nhất 1 dây chuyền và 1 máy đang hoạt động.',
    postconditions: 'Một máy chuyển sang trạng thái Critical, phát sinh bản ghi sự cố mới trong hàng đợi.',
    mainFlow: '1. Người dùng bấm nút "Sự cố khẩn cấp (Demo)" trên thanh Header.\n2. useMonitoringStore chọn ngẫu nhiên 1 dây chuyền, 1 máy và 1 chỉ số.\n3. Đẩy giá trị đo lường vượt ngưỡng Critical Max lên 20%.\n4. Đẩy sự cố mới vào useAlarmStore với severity=\'critical\', status=\'pending\'.\n5. Cập nhật trạng thái máy và dây chuyền sang Critical.\n6. Ghi Audit Log hành động TRIGGER_EMERGENCY.\n7. Dashboard xuất hiện Banner đỏ nhấp nháy, chuông cảnh báo trên Header nhấp nháy đỏ.',
    altFlows: 'A1: Điều hướng nhanh: Từ Banner cảnh báo khẩn cấp, người dùng bấm "Đến Nhật Ký Sự Cố" để xử lý ngay.',
    exceptionFlows: 'E1: Không có dây chuyền nào trong hệ thống -> Bỏ qua thao tác không gây lỗi.',
    businessRules: 'BR-01, BR-02, BR-03 (Lan truyền trạng thái nguy hiểm từ Metric lên Machine và Line).',
    acceptanceCriteria: 'Given hệ thống đang bình thường, When bấm nút Sự cố khẩn cấp, Then điểm an toàn dây chuyền giảm tức thì, máy tương ứng chuyển sang màu đỏ và phát sinh sự cố trong danh sách.',
    relatedFR: 'FR-011',
    status: 'Đã triển khai hoàn tất và có bằng chứng',
  },
];

export function getV2Part3Elements() {
  const elements = [];

  // =========================================================================
  // CHƯƠNG 5: USE CASE SPECIFICATION
  // =========================================================================
  elements.push(createH1('CHƯƠNG 5: ĐẶC TẢ CHI TIẾT 10 USE CASE VÀ CÁC SƠ ĐỒ NGHIỆP VỤ'));

  elements.push(createH2('5.1. Sơ đồ Use Case Diagram tổng quan toàn hệ thống'));
  elements.push(
    createPara(
      'Hệ thống DENSO IoT Monitoring được phân định rõ ràng giữa 3 Actor chính: OPERATOR (Công nhân vận hành), MAINTENANCE (Kỹ thuật viên cơ điện) và ADMIN (Quản trị viên hệ thống). Mối quan hệ giữa các Actor và 10 Use Case được mô hình hóa qua cấu trúc phân quyền:'
    )
  );

  // Bảng phân rã Use Case theo Actor
  const ucActorRows = [
    new TableRow({
      children: [
        createCell('Actor', { isHeader: true, widthPercent: 20 }),
        createCell('Mô Tả Vai Trò Nghiệp Vụ', { isHeader: true, widthPercent: 30 }),
        createCell('Danh Sách Use Case Được Quyền Thực Hiện', { isHeader: true, widthPercent: 50 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('OPERATOR', { bold: true }),
        createCell('Công nhân vận hành trực tiếp tại dây chuyền sản xuất'),
        createCell('UC-01 (Đăng nhập), UC-02 (Giám sát Dashboard), UC-03 (Xem chi tiết chỉ số), UC-04 (Tiếp nhận sự cố bước 1), UC-09 (Xem lịch sử máy), UC-10 (Kích hoạt sự cố diễn tập).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('MAINTENANCE', { bold: true }),
        createCell('Kỹ thuật viên bảo trì cơ điện và kỹ sư tự động hóa'),
        createCell('Bao gồm toàn bộ quyền của Operator, cộng thêm: UC-05 (Nghiệm thu đóng sự cố), UC-06 (Cấu hình ngưỡng kỹ thuật), UC-07 (Bật/Tắt trạm PLC), Xem nhật ký kiểm toán Audit Log.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('ADMIN', { bold: true }),
        createCell('Quản trị viên toàn quyền hệ thống IT/OT'),
        createCell('Toàn quyền thực hiện tất cả 10 Use Case, độc quyền thực hiện UC-08 (Quản lý người dùng, phân quyền RBAC và đặt lại mật khẩu trong CSDL MySQL).'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: ucActorRows,
      borders: thinBorders,
    })
  );

  elements.push(createH2('5.2. Đặc tả độc lập chi tiết 10 Use Case nghiệp vụ'));

  // Duyệt qua từng Use Case và in bảng đặc tả
  ucData.forEach((uc) => {
    elements.push(createH3(`Đặc tả ${uc.id}: ${uc.name}`));

    const rows = [
      new TableRow({
        children: [
          createCell('Mã Use Case (ID)', { bold: true, widthPercent: 28 }),
          createCell(uc.id, { bold: true, widthPercent: 72 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Tên Use Case', { bold: true }),
          createCell(uc.name),
        ],
      }),
      new TableRow({
        children: [
          createCell('Mục Tiêu Nghiệp Vụ', { bold: true }),
          createCell(uc.objective),
        ],
      }),
      new TableRow({
        children: [
          createCell('Tác Nhân Chính (Primary Actor)', { bold: true }),
          createCell(uc.primaryActor),
        ],
      }),
      new TableRow({
        children: [
          createCell('Tác Nhân Phụ (Secondary Actor)', { bold: true }),
          createCell(uc.secondaryActor),
        ],
      }),
      new TableRow({
        children: [
          createCell('Sự Kiện Kích Hoạt (Trigger)', { bold: true }),
          createCell(uc.trigger),
        ],
      }),
      new TableRow({
        children: [
          createCell('Điều Kiện Tiên Quyết (Preconditions)', { bold: true }),
          createCell(uc.preconditions),
        ],
      }),
      new TableRow({
        children: [
          createCell('Điều Kiện Sau Cùng (Postconditions)', { bold: true }),
          createCell(uc.postconditions),
        ],
      }),
      new TableRow({
        children: [
          createCell('Luồng Xử Lý Chính (Main Flow)', { bold: true }),
          createCell(uc.mainFlow),
        ],
      }),
      new TableRow({
        children: [
          createCell('Luồng Thay Thế (Alternative Flows)', { bold: true }),
          createCell(uc.altFlows),
        ],
      }),
      new TableRow({
        children: [
          createCell('Luồng Ngoại Lệ (Exception Flows)', { bold: true }),
          createCell(uc.exceptionFlows),
        ],
      }),
      new TableRow({
        children: [
          createCell('Quy Tắc Nghiệp Vụ (Business Rules)', { bold: true }),
          createCell(uc.businessRules),
        ],
      }),
      new TableRow({
        children: [
          createCell('Tiêu Chí Nghiệm Thu (Acceptance Criteria)', { bold: true }),
          createCell(uc.acceptanceCriteria, { italic: true }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Yêu Cầu Chức Năng Liên Quan (Related FR)', { bold: true }),
          createCell(uc.relatedFR),
        ],
      }),
      new TableRow({
        children: [
          createCell('Trạng Thái Triển Khai Thực Tế', { bold: true }),
          createCell(uc.status, { bold: true }),
        ],
      }),
    ];

    elements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: thinBorders,
      })
    );

    elements.push(createPara(' '));
  });

  elements.push(createH2('5.3. Sơ đồ tuần tự kỹ thuật (Sequence Diagrams) cho các kịch bản trọng yếu'));
  elements.push(
    createPara(
      'Dưới đây là mô tả chi tiết luồng trao đổi gói tin giữa Client (Browser), Server (Node.js/Express/WebSocket) và Database (MySQL) cho 3 kịch bản vận hành then chốt của hệ thống:'
    )
  );

  elements.push(createH3('5.3.1. Kịch bản 1: Xác thực Đăng nhập JWT Dual Mode (Sequence Flow)'));
  elements.push(createPara('1. Client gửi: POST /api/auth/login { email, password }'));
  elements.push(createPara('2. Backend gọi: mysqlDb.getUserByEmail(email)'));
  elements.push(createPara('3. Database MySQL trả về bản ghi user (chứa passwordHash) hoặc ném lỗi nếu MySQL offline.'));
  elements.push(createPara('4. Nếu MySQL phản hồi: Backend kiểm tra bcrypt.compareSync(password, hash). Nếu khớp -> sinh JWT token -> gọi mysqlDb.updateUser() và mysqlDb.addAuditLog(LOGIN) -> trả về HTTP 200 { user, accessToken, refreshToken }.'));
  elements.push(createPara('5. Nếu MySQL offline: Backend chuyển hướng sang fallbackUsers -> kiểm tra mật khẩu -> sinh token dự phòng -> trả về HTTP 200 (Chế độ Dự phòng An toàn).'));
  elements.push(createPara('6. Client nhận token, lưu vào localStorage và khởi chạy giao tiếp WebSocket.'));

  elements.push(createH3('5.3.2. Kịch bản 2: Vòng đời Xử lý Sự cố & Cảnh báo (Alarm Handling Sequence)'));
  elements.push(createPara('1. Cảm biến/Simulator phát hiện giá trị vượt ngưỡng Critical -> useAlarmStore kích hoạt triggerNewAlarm() -> Sự cố chuyển sang trạng thái Pending (Đèn còi nhấp nháy).'));
  elements.push(createPara('2. Operator bấm "Đã nhận sửa" -> Client gọi acknowledgeAlarm(alarmId, name) -> Chuyển sang Acknowledged -> Client gửi POST /api/audit-logs ghi nhận sự kiện tiếp nhận.'));
  elements.push(createPara('3. Kỹ thuật viên xử lý kỹ thuật xong tại máy, bấm "Hoàn tất" -> Mở Modal nhập resolutionNotes.'));
  elements.push(createPara('4. Kỹ thuật viên nhấn Xác nhận -> Client gọi resolveAlarm(alarmId, notes) -> Chuyển sang Resolved -> Client gửi POST /api/audit-logs ghi nhận hoàn tất kèm biên bản giải pháp.'));

  elements.push(createH3('5.3.3. Kịch bản 3: Truy vấn Lịch sử Máy & Xuất File Báo Cáo (Export Pipeline Sequence)'));
  elements.push(createPara('1. Client chọn bộ lọc (Line, Machine, Ca 3 đêm) và bấm "Xuất Excel" -> Gọi historyService.getTelemetryLogs({ ...filters, isExport: true }).'));
  elements.push(createPara('2. Backend nhận cờ isExport=true -> Chuyển đổi giờ VN sang UTC -> Thực hiện SELECT COUNT(*) trong MySQL.'));
  elements.push(createPara('3. Nếu tổng số bản ghi > 10.000 -> Backend lập tức trả về HTTP 400 { exportAllowed: false, warning: "Vượt giới hạn 10.000 dòng" }.'));
  elements.push(createPara('4. Nếu tổng số bản ghi <= 10.000 -> Backend thực hiện SELECT dữ liệu -> Trả về JSON { success: true, data: [...] }.'));
  elements.push(createPara('5. Client nhận mảng data -> exportEngine đóng gói file nhị phân OpenXML PKZIP -> Kích hoạt tải file kailink_telemetry_[timestamp].xlsx về máy tính.'));

  // =========================================================================
  // CHƯƠNG 6: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)
  // =========================================================================
  elements.push(createH1('CHƯƠNG 6: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)'));

  elements.push(createH2('6.1. Bảo mật hệ thống (Security)'));
  elements.push(
    createPara(
      'Hệ thống áp dụng các nguyên tắc phòng vệ chiều sâu nhiều tầng (Defense-in-Depth):'
    )
  );
  elements.push(
    createPara(
      '• Xác thực JWT kép (Dual-Token Architecture): Sử dụng cặp Access Token (hạn 8 giờ) và Refresh Token (hạn 7 ngày). Token được tự động đính kèm vào Header Authorization: Bearer <token> cho mọi request API.'
    )
  );
  elements.push(
    createPara(
      '• Băm mật khẩu một chiều (One-Way Hashing): Mật khẩu người dùng trong CSDL MySQL luôn được băm bằng thuật toán Bcrypt với hệ số Salt Rounds = 10. Tuyệt đối không lưu mật khẩu dạng bản rõ (plaintext).'
    )
  );
  elements.push(
    createPara(
      '• Phòng chống SQL Injection: 100% câu truy vấn CSDL trong server/db-mysql.js sử dụng Parameterized Queries (cú pháp ? của thư viện mysql2/promise). Cột sắp xếp sortBy được kiểm tra qua danh sách trắng (Whitelist Validation) gồm 7 cột hợp lệ.'
    )
  );
  elements.push(
    createPara(
      '• Phòng chống CSV Formula Injection: Toàn bộ dữ liệu xuất ra CSV được kiểm tra; nếu ô bắt đầu bằng ký tự công thức (=, +, -, @), hệ thống tự động tiền tố dấu nháy đơn (\') để vô hiệu hóa việc Microsoft Excel thực thi mã độc.'
    )
  );

  elements.push(createH2('6.2. Hiệu năng & Độ trễ truyền thông (Performance & Latency)'));
  elements.push(
    createPara(
      'LƯU Ý KHÁCH QUAN: Các thông số hiệu năng dưới đây là kết quả đo đạc thực tế trên môi trường máy chủ cục bộ (LAN / Localhost) trong quá trình chạy bộ test Stage 4A; chưa phản ánh độ trễ trên hạ tầng mạng viễn thông công nghiệp diện rộng (WAN / 4G / 5G).'
    )
  );
  elements.push(
    createPara(
      '• Độ trễ WebSocket trên LAN: Kết nối WebSocket thuần (thư viện ws) duy trì truyền thông hai chiều liên tục, thời gian truyền gói tin telemetry từ Backend tới Browser đo được dưới 100ms trên mạng nội bộ.'
    )
  );
  elements.push(
    createPara(
      '• Tối ưu hóa truy vấn CSDL: Bảng machine_telemetry_history được đánh chỉ mục tổ hợp B-Tree tối ưu: idx_line_time, idx_machine_time, idx_metric_time và idx_time_status.'
    )
  );
  elements.push(
    createPara(
      '• Bộ đệm đồ thị trượt (Sliding Window Buffer): Biểu đồ Recharts chỉ lưu giữ 20 điểm đo gần nhất trong RAM trình duyệt, ngăn chặn hoàn toàn hiện tượng tràn bộ nhớ khi mở dashboard liên tục nhiều ngày trên màn hình Andon.'
    )
  );

  elements.push(createH2('6.3. Tính sẵn sàng & Dự phòng chống sập (Availability & Fault Tolerance)'));
  elements.push(
    createPara(
      '• Kiến trúc Dual-Storage Fallback: Khi CSDL MySQL bị ngắt kết nối hoặc nhà cung cấp cloud (Render/Aiven) đang khởi động, Backend tự động chuyển sang cơ chế xác thực bộ nhớ dự phòng (In-Memory Fallback) với 3 tài khoản mẫu, đảm bảo ứng dụng không bị sập.'
    )
  );
  elements.push(
    createPara(
      '• Cơ chế kết nối lại có kiểm soát (Retry Loop): Hàm connectDatabaseWithRetry() thử kết nối CSDL tối đa 10 lần với khoảng nghỉ 4 giây. Máy chủ luôn mở cổng HTTP ngay lập tức để vượt qua quy trình Healthcheck của các nền tảng PaaS.'
    )
  );

  elements.push(createH2('6.4. Tính toàn vẹn dữ liệu (Data Integrity)'));
  elements.push(
    createPara(
      '• Chuẩn hóa múi giờ quốc tế: MySQL connection pool cấu hình timezone: \'+00:00\'. Toàn bộ thời gian được lưu trữ chuẩn DATETIME(3) với độ chính xác mili-giây. Khi người dùng lọc theo giờ Việt Nam, hệ thống chuyển đổi tường minh sang UTC trước khi truy vấn.'
    )
  );
  elements.push(
    createPara(
      '• Độ chính xác số học: Các giá trị cảm biến được lưu trữ dưới dạng DECIMAL(10, 2) trong CSDL, bảo toàn tuyệt đối 2 chữ số thập phân, không bị hiện tượng sai số dấu phẩy động.'
    )
  );

  elements.push(createH2('6.5. Trải nghiệm người dùng & Khả năng tương thích (Usability & Compatibility)'));
  elements.push(
    createPara(
      '• Giao diện chuẩn công nghiệp: Hỗ trợ hoàn hảo cả 2 chế độ Sáng (Light Mode - tối ưu cho văn phòng quản đốc) và Tối (Dark Mode - tối ưu cho màn hình TV Andon treo trên cao trong nhà xưởng).'
    )
  );
  elements.push(
    createPara(
      '• Khả năng phản hồi đa thiết bị: Giao diện tự động co giãn từ màn hình PC điều hành, máy tính bảng công nghiệp đến điện thoại di động của kỹ thuật viên hiện trường.'
    )
  );
  elements.push(
    createPara(
      '• Tương thích Microsoft Excel: File CSV được gắn tiền tố 3 byte UTF-8 BOM (0xEF 0xBB 0xBF), cho phép nhấp đúp mở trực tiếp trên mọi phiên bản Excel mà không bị lỗi phông chữ tiếng Việt có dấu.'
    )
  );

  return elements;
}
