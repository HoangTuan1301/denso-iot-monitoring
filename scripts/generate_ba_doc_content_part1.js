/**
 * @file scripts/generate_ba_doc_content_part1.js
 * @description Nội dung Chương 1, Chương 2 và Chương 3 của tài liệu BA
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

export function getPart1Elements() {
  const elements = [];

  // =========================================================================
  // CHƯƠNG 1: GIỚI THIỆU DỰ ÁN
  // =========================================================================
  elements.push(createH1('CHƯƠNG 1: GIỚI THIỆU DỰ ÁN'));

  elements.push(createH2('1.1. Tổng quan dự án'));
  elements.push(
    createPara(
      'Dự án "DENSO Industrial IoT Monitoring System" (mã định danh nội bộ: KaiLink) là hệ thống ứng dụng web chuyên dụng phục vụ công tác giám sát, cảnh báo sớm và phân tích dữ liệu thiết bị, dây chuyền sản xuất tự động trong môi trường nhà máy thông minh của Tập đoàn DENSO. Được thiết kế ban đầu phục vụ sự kiện công nghệ kỹ thuật DENSO Hackathon 2026 và định hướng mở rộng ứng dụng thực tiễn vào các xưởng gia công cơ khí chính xác, dự án tập trung giải quyết bài toán cốt lõi: số hóa hoàn toàn hoạt động giám sát sức khỏe máy móc, giảm thiểu tối đa thời gian dừng chuyền không kế hoạch (Unplanned Downtime) và tạo lập nền tảng dữ liệu chuỗi thời gian bền vững cho chiến lược bảo trì dự đoán (Predictive Maintenance).'
    )
  );

  elements.push(createH2('1.2. Bối cảnh và bài toán nghiệp vụ'));
  elements.push(
    createPara(
      'Trong các nhà máy sản xuất phụ tùng và cụm chi tiết ô tô công nghệ cao của DENSO (như kim phun điện tử, hệ thống điều hòa ô tô, radar cảm biến và cụm đánh lửa), dây chuyền gia công cơ khí, dập khuôn, sơn tĩnh điện và lắp ráp hoạt động với chu kỳ tính bằng giây. Một sự cố cơ khí bất ngờ xảy ra — ví dụ như quá nhiệt dầu thủy lực máy dập, độ rung ổ bi robot hàn vượt ngưỡng hay sụt áp khí nén buồng sơn — nếu không được phát hiện kịp thời sẽ dẫn đến kẹt trục, hỏng khuôn hoặc tạo ra hàng loạt sản phẩm lỗi, gây thiệt hại hàng chục nghìn USD cho mỗi giờ dừng dây chuyền.'
    )
  );
  elements.push(
    createPara(
      'Trước khi hệ thống được triển khai, các nhà máy thường áp dụng phương thức giám sát truyền thống với nhiều điểm nghẽn nghiệp vụ nghiêm trọng:'
    )
  );
  elements.push(
    createPara(
      '• Tuần tra và ghi chép thủ công (Manual Walk-around): Kỹ thuật viên phải di chuyển giữa các trạm máy để xem đồng hồ áp suất và nhiệt kế rồi ghi vào sổ kiểm tra giấy theo chu kỳ 2 - 4 giờ/lần. Phương thức này có độ trễ thông tin quá lớn, hoàn toàn bất lực trước các sự cố tăng áp hoặc quá nhiệt đột ngột.'
    )
  );
  elements.push(
    createPara(
      '• Thiếu bức tranh toàn cảnh tập trung (Information Silos): Quản đốc phân xưởng không thể nắm bắt được trạng thái tổng thể của toàn bộ 3 dây chuyền cùng lúc. Khi một máy ở công đoạn trước gặp trục trặc, công đoạn sau không nhận được cảnh báo sớm để chủ động điều tiết tải sản xuất.'
    )
  );
  elements.push(
    createPara(
      '• Quy trình ứng cứu sự cố thiếu vết kiểm toán (No Incident Traceability): Khi đèn còi Andon tại chỗ bật sáng, việc tiếp nhận và khắc phục diễn ra rời rạc bằng bộ đàm hoặc miệng; không có hệ thống ghi lại chính xác ai là người tiếp nhận lúc mấy giờ, nguyên nhân kỹ thuật là gì và giải pháp khắc phục ra sao.'
    )
  );

  elements.push(createH2('1.3. Mục tiêu xây dựng hệ thống'));
  elements.push(
    createPara(
      'Hệ thống DENSO IoT Monitoring được xây dựng nhằm đáp ứng 4 mục tiêu chiến lược cụ thể (SMART Goals):'
    )
  );
  elements.push(
    createPara(
      '1. Giám sát thời gian thực (Real-time Telemetry): Thu thập liên tục và phản ánh tức thì các thông số vật lý quan trọng (Nhiệt độ, Áp suất, Độ rung, Dòng điện, Mô-men xoắn, Lưu lượng khí) với chu kỳ phát sóng 2 giây/lần qua giao thức WebSocket.'
    )
  );
  elements.push(
    createPara(
      '2. Cảnh báo sớm đa cấp (Early Warning & Digital Andon): Tự động đánh giá giá trị đo lường với bộ 4 ngưỡng kỹ thuật (Warning Min/Max, Critical Min/Max) để kích hoạt trạng thái cảnh báo thị giác tức thời (Xanh - Vàng - Đỏ nhấp nháy) trên bảng điều khiển trung tâm.'
    )
  );
  elements.push(
    createPara(
      '3. Số hóa quy trình xử lý sự cố (Closed-Loop Incident Management): Thiết lập quy trình 3 bước chuẩn công nghiệp: Chờ tiếp nhận (Pending) → Đã tiếp nhận (Acknowledged) → Đã hoàn thành khắc phục (Resolved) kèm biên bản ghi chú kỹ thuật và nhật ký kiểm toán bất biến.'
    )
  );
  elements.push(
    createPara(
      '4. Lưu trữ lịch sử & Xuất báo cáo chuyên sâu (Data Foundation & Export Engine): Lưu trữ tập trung toàn bộ dữ liệu telemetry vào CSDL quan hệ MySQL chuẩn múi giờ UTC, cung cấp công cụ lọc linh hoạt theo ca làm việc (đặc biệt ca 3 qua đêm) và xuất dữ liệu ra 3 định dạng tiêu chuẩn: Excel (.xlsx), CSV (UTF-8 BOM), JSON phục vụ báo cáo quản trị và huấn luyện mô hình AI.'
    )
  );

  elements.push(createH2('1.4. Giá trị nghiệp vụ dự kiến'));
  elements.push(
    createPara(
      'Việc đưa hệ thống vào vận hành mang lại những giá trị kinh tế và quản trị rõ rệt: nâng cao chỉ số hiệu suất tổng thể thiết bị (OEE), rút ngắn thời gian trung bình để sửa chữa (MTTR) nhờ thông tin chẩn đoán tức thời qua mã QR, loại bỏ 100% việc ghi chép giấy thủ công và tạo ra kho dữ liệu phục vụ phân tích quy luật hao mòn cơ khí phục vụ bảo trì ngăn ngừa.'
    )
  );

  elements.push(createH2('1.5. Phạm vi dự án'));
  elements.push(
    createPara(
      '• Phạm vi đã hoàn thành trong hệ thống hiện tại: Ứng dụng Web Dashboard responsive hoàn chỉnh, máy chủ Backend Node.js/Express, máy chủ WebSocket, CSDL trung tâm MySQL (denso_iot), cơ chế đăng nhập bảo mật JWT, phân quyền RBAC 3 vai trò, công cụ mô phỏng 10 kênh telemetry chuẩn hóa của nhà máy, bộ ghi tự động vào CSDL và động cơ xuất file báo cáo 3 định dạng zero-dependency.'
    )
  );
  elements.push(
    createPara(
      '• Giới hạn phạm vi cần làm rõ (Limitations): Hệ thống hiện tại đang sử dụng bộ sinh dữ liệu mô phỏng tập trung tại Backend (Simulation Engine) theo đúng đặc tính kỹ thuật của máy DENSO, chưa kết nối trực tiếp với cáp mạng phần cứng PLC ngoài đời thực. Các trạm PLC Siemens S7-1500 và Omron NX1P2 hiện diện dưới dạng mô hình phần mềm chuẩn giao thức (Software Protocol Model).'
    )
  );

  elements.push(createH2('1.6. Thuật ngữ và định nghĩa'));
  const termRows = [
    new TableRow({
      children: [
        createCell('Thuật ngữ / Viết tắt', { isHeader: true, widthPercent: 25 }),
        createCell('Tên tiếng Anh đầy đủ', { isHeader: true, widthPercent: 35 }),
        createCell('Định nghĩa và Ý nghĩa trong hệ thống', { isHeader: true, widthPercent: 40 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('IIoT', { bold: true }),
        createCell('Industrial Internet of Things'),
        createCell('Mạng lưới vạn vật kết nối trong công nghiệp, thu thập dữ liệu máy móc phục vụ giám sát và tối ưu hóa vận hành.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('PLC', { bold: true }),
        createCell('Programmable Logic Controller'),
        createCell('Bộ điều khiển logic khả trình chuyên dụng trong nhà máy điều khiển cơ cấu chấp hành và đọc tín hiệu cảm biến.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Andon', { bold: true }),
        createCell('Andon System (Tiếng Nhật)'),
        createCell('Hệ thống cảnh báo thị giác/âm thanh trong phương thức sản xuất Toyota (TPS), thông báo ngay khi có bất thường trên chuyền.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Telemetry', { bold: true }),
        createCell('Telemetry Data Stream'),
        createCell('Dòng dữ liệu chuỗi thời gian ghi nhận các giá trị đo lường vật lý từ cảm biến (nhiệt độ, áp suất, độ rung...).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('RBAC', { bold: true }),
        createCell('Role-Based Access Control'),
        createCell('Mô hình kiểm soát truy cập và phân quyền người dùng dựa trên vai trò nghiệp vụ (Admin, Operator, Maintenance).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('OEE', { bold: true }),
        createCell('Overall Equipment Effectiveness'),
        createCell('Hiệu suất tổng thể thiết bị, đo lường mức độ sẵn sàng, hiệu suất vận hành và tỷ lệ chất lượng sản phẩm.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('OpenXML', { bold: true }),
        createCell('Office Open XML (ISO/IEC 29500)'),
        createCell('Định dạng nhị phân file bảng tính nén (.xlsx) tiêu chuẩn quốc tế được sinh trực tiếp bằng thuật toán PKZIP thuần.'),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: termRows,
      borders: thinBorders,
    })
  );

  // =========================================================================
  // CHƯƠNG 2: PHÂN TÍCH CÁC BÊN LIÊN QUAN & MÔ HÌNH PHÂN QUYỀN
  // =========================================================================
  elements.push(createH1('CHƯƠNG 2: PHÂN TÍCH CÁC BÊN LIÊN QUAN & MÔ HÌNH PHÂN QUYỀN'));

  elements.push(createH2('2.1. Xác định các bên liên quan (Stakeholders)'));
  elements.push(
    createPara(
      'Hệ thống DENSO IoT Monitoring phục vụ nhiều phòng ban trong cơ cấu vận hành nhà máy:'
    )
  );
  elements.push(
    createPara(
      '1. Ban Giám đốc Khối Sản xuất (Plant Director / Production GM): Quan tâm tới các KPI cấp cao (Chỉ số an toàn toàn xưởng, số lượng cảnh báo nghiêm trọng trong tháng, tỷ lệ dừng máy).'
    )
  );
  elements.push(
    createPara(
      '2. Quản đốc & Trưởng ca sản xuất (Production Supervisor): Theo dõi liên tục trạng thái 3 dây chuyền, tiếp nhận cảnh báo khẩn cấp và điều phối công nhân xử lý.'
    )
  );
  elements.push(
    createPara(
      '3. Kỹ sư Tự động hóa & Kỹ thuật bảo trì (Maintenance & Automation Engineer): Cần thông tin chẩn đoán chuyên sâu (đồ thị rung động, nhiệt độ dầu, áp suất khí nén), cấu hình ngưỡng kỹ thuật, bật/tắt trạm truyền thông PLC và nghiệm thu đóng sự cố.'
    )
  );
  elements.push(
    createPara(
      '4. Công nhân vận hành tại trạm (Line Operator): Trực tiếp thao tác với máy, xem trạng thái thiết bị của trạm mình phụ trách, bấm xác nhận tiếp nhận sự cố bước 1 khi phát sinh cảnh báo.'
    )
  );
  elements.push(
    createPara(
      '5. Quản trị viên hệ thống CNTT (IT / OT System Administrator): Quản trị tài khoản người dùng, cấp phát quyền, theo dõi nhật ký kiểm toán hệ thống và bảo đảm an toàn kết nối.'
    )
  );

  elements.push(createH2('2.2. Các nhóm người dùng và vai trò thực tế trong hệ thống'));
  elements.push(
    createPara(
      'Dựa trên mã nguồn triển khai thực tế tại server/index.js và server/db-mysql.js, hệ thống định nghĩa 3 vai trò người dùng cốt lõi:'
    )
  );
  elements.push(
    createPara(
      '• ADMIN (Quản trị viên toàn quyền): Tài khoản mặc định admin@denso.com (Mã NV: DNS-1001). Nắm toàn quyền cấu hình tham số, quản trị tài khoản, reset mật khẩu, thay đổi ngưỡng kỹ thuật và xem toàn bộ nhật ký hệ thống.'
    )
  );
  elements.push(
    createPara(
      '• MAINTENANCE (Kỹ thuật viên bảo trì cơ điện): Tài khoản mặc định tech@denso.com (Mã NV: DNS-1088). Phụ trách giám sát sâu Tier 2 & Tier 3, tiếp nhận và hoàn tất nghiệm thu sự cố kèm biên bản giải pháp, cấu hình ngưỡng và bật/tắt trạm PLC, xem nhật ký kiểm toán.'
    )
  );
  elements.push(
    createPara(
      '• OPERATOR (Công nhân vận hành chuyền): Tài khoản mặc định user@denso.com (Mã NV: DNS-1024). Được phân công cụ thể vào một dây chuyền (ví dụ LINE-01), có quyền xem dashboard, danh sách máy, tiếp nhận sự cố bước 1 và tra cứu lịch sử máy. Bị hệ thống chặn truy cập vào các trang cấu hình nhạy cảm.'
    )
  );

  elements.push(createH2('2.3. Ma trận phân quyền truy cập chức năng'));
  const rbacRows = [
    new TableRow({
      children: [
        createCell('Mã Chức năng', { isHeader: true, widthPercent: 15 }),
        createCell('Tên Phân hệ / Màn hình', { isHeader: true, widthPercent: 35 }),
        createCell('OPERATOR', { isHeader: true, widthPercent: 15, align: AlignmentType.CENTER }),
        createCell('MAINTENANCE', { isHeader: true, widthPercent: 17, align: AlignmentType.CENTER }),
        createCell('ADMIN', { isHeader: true, widthPercent: 18, align: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-04', { bold: true }),
        createCell('Dashboard Tổng Quan Nhà Máy (Tầng 1)'),
        createCell('Xem', { align: AlignmentType.CENTER }),
        createCell('Xem', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-05, 06', { bold: true }),
        createCell('Luồng & Thành phần Máy móc (Tầng 2 & 3)'),
        createCell('Xem', { align: AlignmentType.CENTER }),
        createCell('Xem & Chẩn đoán', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-10', { bold: true }),
        createCell('Nhật ký Sự cố: Tiếp nhận bước 1 (Acknowledge)'),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-10', { bold: true }),
        createCell('Nhật ký Sự cố: Nghiệm thu hoàn tất (Resolve)'),
        createCell('Chặn (Ẩn nút)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-08, 09', { bold: true }),
        createCell('Cấu hình Ngưỡng & Trạm Truyền thông PLC'),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-16, 18', { bold: true }),
        createCell('Lịch sử Hoạt động Máy & Xuất File Báo cáo'),
        createCell('Xem & Xuất', { align: AlignmentType.CENTER }),
        createCell('Xem & Xuất', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-14', { bold: true }),
        createCell('Nhật ký Kiểm toán Hệ thống (Audit Logs)'),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Xem & Xuất CSV', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('FR-12, 13', { bold: true }),
        createCell('Quản trị Người dùng & Cấp quyền MySQL'),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Toàn quyền CRUD', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rbacRows,
      borders: thinBorders,
    })
  );

  elements.push(createH2('2.4. Phân tích điểm chưa đồng bộ giữa Frontend và Backend'));
  elements.push(
    createPara(
      'Trong quá trình rà soát mã nguồn chuyên sâu, Senior BA phát hiện một điểm chưa đồng bộ kỹ thuật cần ghi nhận rõ để nhóm phát triển tiếp tục hoàn thiện trong sprint tiếp theo:'
    )
  );
  elements.push(
    createPara(
      '• Tại Backend và CSDL MySQL: Trường role của bảng users được định nghĩa kiểu ENUM(\'ADMIN\', \'OPERATOR\', \'MAINTENANCE\'). Các middleware requireRole([\'ADMIN\', \'MAINTENANCE\']) tại server/index.js hoàn toàn cho phép tài khoản vai trò MAINTENANCE truy cập hợp lệ vào API trạm PLC, Audit Log và Telemetry.'
    )
  );
  elements.push(
    createPara(
      '• Tại Frontend UI: Trong màn hình Quản lý Người dùng (UserManagementView.tsx), bộ lọc vai trò hiện tại chỉ có các lựa chọn "Tất cả", "Quyền SỬA (Admin)" và "Quyền XEM (Operator)"; form tạo tài khoản mặc định gán role là OPERATOR. Tuy nhiên, hệ thống vẫn lưu trữ đúng tài khoản DNS-1088 với role MAINTENANCE trong MySQL và người dùng có thể chuyển đổi vai trò linh hoạt qua useAuthStore. Nhóm BA khuyến nghị bổ sung tùy chọn vai trò Kỹ thuật viên (MAINTENANCE) trực tiếp trên bộ lọc giao diện để đồng bộ 100% với backend.'
    )
  );

  // =========================================================================
  // CHƯƠNG 3: PHÂN TÍCH QUY TRÌNH NGHIỆP VỤ
  // =========================================================================
  elements.push(createH1('CHƯƠNG 3: PHÂN TÍCH QUY TRÌNH NGHIỆP VỤ'));

  elements.push(createH2('3.1. Bài toán giám sát thiết bị nhà máy công nghiệp'));
  elements.push(
    createPara(
      'Mô hình sản xuất của DENSO vận hành theo dây chuyền liên tục gồm 3 công đoạn chính: Dập & Hàn khung gầm (Line 1) → Sơn tĩnh điện (Line 2) → Lắp ráp hoàn thiện (Line 3). Mỗi dây chuyền gồm nhiều máy móc phức tạp với các cụm đo lường quan trọng: áp suất ép xi-lanh thủy lực, nhiệt độ vòng bi, tốc độ cấp phôi, lưu lượng khí nén phun sơn và mô-men xoắn siết bulong động cơ. Mục tiêu nghiệp vụ là phải phát hiện biến thiên bất thường trước khi máy đạt tới ngưỡng hỏng hóc vật lý.'
    )
  );

  elements.push(createH2('3.2. Quy trình hiện tại (AS-IS) - Giám sát thủ công'));
  elements.push(
    createPara(
      'Quy trình AS-IS dựa hoàn toàn vào sự can thiệp thủ công: (1) Công nhân vận hành quan sát đồng hồ cơ khí tại chỗ theo lịch trình; (2) Khi có tiếng ồn lạ hoặc nhiệt độ nóng bất thường, công nhân dừng chuyền thủ công bằng nút Emergency Stop; (3) Gọi điện hoặc phát loa gọi đội bảo trì; (4) Kỹ thuật viên di chuyển tới mang theo dụng cụ đo kiểm tra; (5) Khắc phục xong ghi chép vào sổ tay bảo dưỡng. Độ trễ từ khi phát sinh dấu hiệu suy hao đến khi can thiệp thường kéo dài từ 30 đến 120 phút.'
    )
  );

  elements.push(createH2('3.3. Quy trình đề xuất (TO-BE) - Giám sát IIoT thông minh'));
  elements.push(
    createPara(
      'Quy trình TO-BE số hóa toàn diện luồng thông tin: (1) Cảm biến/PLC đọc tín hiệu liên tục; (2) Hệ thống tự động so khớp 4 ngưỡng kỹ thuật; (3) Nếu vượt ngưỡng cảnh báo (Warning), hệ thống đổi màu vàng và hiển thị trên màn hình điều hành; nếu vượt ngưỡng nguy hiểm (Critical), hệ thống kích hoạt Digital Andon đỏ nhấp nháy toàn xưởng và phát sinh bản ghi sự cố mới vào hàng đợi; (4) Công nhân/Kỹ thuật viên tại hiện trường quét mã QR trên máy để mở ngay màn hình đo lường Tầng 3 và nhấn "Tiếp nhận"; (5) Sau khi xử lý dứt điểm thông số về an toàn, Kỹ thuật viên nhập ghi chú giải pháp và nhấn "Hoàn thành" để đóng sự cố; (6) Mọi hành động được tự động ghi vào nhật ký kiểm toán và CSDL lịch sử.'
    )
  );

  elements.push(createH2('3.4. Luồng dữ liệu cảm biến thời gian thực (Data Pipeline)'));
  elements.push(
    createPara(
      'Luồng dữ liệu trong phiên bản hiện tại được chuẩn hóa tập trung tại Backend:'
    )
  );
  elements.push(
    createPara(
      '1. Mô hình kênh đo chuẩn (Canonical Telemetry Engine): Backend định nghĩa 10 kênh đo lường chuẩn mực đại diện cho 3 dây chuyền (áp suất cấp phôi, tốc độ cấp phôi, áp suất ép thủy lực, nhiệt độ dầu, mô-men siết bulong, lưu lượng sơn, nhiệt độ sấy, mô-men siết robot, độ rung băng chuyền).'
    )
  );
  elements.push(
    createPara(
      '2. Chu kỳ ghi CSDL bền vững (Persistent Logging Interval): Cứ mỗi 5 giây, tiến trình chạy ngầm của máy chủ Backend tính toán giá trị jitter ngẫu nhiên trong dải biến thiên thực tế, gắn nhãn trạng thái (Normal/Warning/Critical), gắn cờ source=\'simulation\' và thực hiện ghi batch vào bảng machine_telemetry_history của MySQL.'
    )
  );
  elements.push(
    createPara(
      '3. Chu kỳ phát sóng thời gian thực (WebSocket Real-time Broadcast): Cứ mỗi 2 giây, máy chủ WebSocket phát sóng gói tin iot_telemetry_tick tới toàn bộ trình duyệt đang kết nối để kích hoạt xung nhịp simulateTick(), giúp giao diện Dashboard và biểu đồ Recharts cập nhật mượt mà.'
    )
  );

  elements.push(createH2('3.5. Quy trình xử lý sự cố 3 bước (Alarm Lifecycle Workflow)'));
  elements.push(
    createPara(
      'Vòng đời của một sự cố kỹ thuật trong hệ thống trải qua 3 trạng thái nghiêm ngặt:'
    )
  );
  elements.push(
    createPara(
      '• Trạng thái 1: Chờ tiếp nhận (Pending) - Sự cố vừa phát sinh do cảm biến vượt ngưỡng hoặc do kích hoạt nút Giả lập khẩn cấp. Banner đỏ nhấp nháy trên Dashboard. Bất kỳ nhân viên nào (Operator, Tech, Admin) cũng có thể nhấn nút "Tiếp nhận" (Acknowledge).'
    )
  );
  elements.push(
    createPara(
      '• Trạng thái 2: Đang xử lý (Acknowledged) - Hệ thống khóa trạng thái, ghi nhận tên người tiếp nhận và thời gian tiếp nhận vào hệ thống. Nút "Đã nhận sửa" đổi thành nút xanh "Hoàn tất" (Resolve). Chỉ Kỹ thuật viên (Maintenance) hoặc Quản trị viên (Admin) mới có quyền mở modal nghiệm thu.'
    )
  );
  elements.push(
    createPara(
      '• Trạng thái 3: Đã giải quyết (Resolved) - Kỹ thuật viên điền nội dung biên bản xử lý kỹ thuật (ví dụ: "Đã châm thêm dầu làm mát, nhiệt độ ổn định ở 52°C") và nhấn Xác nhận. Sự cố được chuyển vào danh mục đã đóng, không còn xuất hiện trong danh sách cần xử lý gấp.'
    )
  );

  elements.push(createH2('3.6. Hệ thống Quy tắc Nghiệp vụ Cốt lõi (Business Rules)'));
  const brRows = [
    new TableRow({
      children: [
        createCell('Mã BR', { isHeader: true, widthPercent: 12 }),
        createCell('Tên Quy tắc Nghiệp vụ', { isHeader: true, widthPercent: 28 }),
        createCell('Nội dung & Ràng buộc Kỹ thuật', { isHeader: true, widthPercent: 60 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-01', { bold: true }),
        createCell('Đánh giá 4 ngưỡng kỹ thuật'),
        createCell('Một chỉ số đo lường (Metric) có giá trị V được đánh giá theo thứ tự: Nếu V <= criticalMin hoặc V >= criticalMax thì trạng thái là "critical"; nếu V <= warningMin hoặc V >= warningMax thì trạng thái là "warning"; ngược lại là "normal". Ngưỡng nguy hiểm luôn có độ ưu tiên cao hơn ngưỡng cảnh báo.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-02', { bold: true }),
        createCell('Tổng hợp trạng thái Máy Tầng 2'),
        createCell('Trạng thái của một Máy/Thiết bị Tầng 2 phụ thuộc vào các chỉ số con Tầng 3: Nếu có ít nhất 1 chỉ số con là "critical" thì máy chuyển sang "critical"; nếu không có critical nhưng có ít nhất 1 warning thì máy là "warning"; chỉ khi tất cả chỉ số con là "normal" thì máy mới là "normal".'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-03', { bold: true }),
        createCell('Công thức Điểm an toàn Dây chuyền'),
        createCell('Điểm an toàn dây chuyền (Safety Score %) được tính bằng: (Số chỉ số trạng thái normal / Tổng số chỉ số) * 100. Điểm an toàn xưởng là trung bình cộng của 3 dây chuyền.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-04', { bold: true }),
        createCell('Tiếp nhận sự cố (Acknowledge)'),
        createCell('Bản ghi sự cố ở trạng thái Pending chỉ được chuyển sang Acknowledged khi có nhân viên hợp lệ xác nhận. Hệ thống ghi nhận tên người tiếp nhận, thời điểm ISO timestamp và tạo một bản ghi Audit Log tương ứng.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-05', { bold: true }),
        createCell('Nghiệm thu sự cố (Resolve)'),
        createCell('Chỉ tài khoản vai trò MAINTENANCE hoặc ADMIN mới được phép đóng sự cố. Bắt buộc phải có nội dung ghi chú giải pháp (Resolution Notes) trước khi hoàn tất.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-06', { bold: true }),
        createCell('Định danh Telemetry Chống trùng'),
        createCell('Mỗi bản ghi telemetry chuỗi thời gian phải có ID xác định được tính toán bằng hàm băm SHA-256 từ chuỗi tổ hợp: lineId_machineId_metricId_timestamp. Lệnh ghi CSDL sử dụng INSERT IGNORE để chống trùng lặp tuyệt đối khi thử lại (Retry).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-07', { bold: true }),
        createCell('Chuẩn hóa Múi giờ UTC & Quy đổi VN'),
        createCell('Toàn bộ CSDL MySQL và API trao đổi dữ liệu sử dụng múi giờ chuẩn quốc tế UTC (+00:00). Bộ lọc theo ngày/giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7) bắt buộc phải chuyển đổi chính xác sang UTC trước khi truy vấn SQL.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-08', { bold: true }),
        createCell('Lọc Ca làm việc qua nửa đêm (Ca 3)'),
        createCell('Ca 3 có khung giờ từ 22:00 hôm nay đến 06:00 sáng hôm sau. Truy vấn SQL bắt buộc phải sử dụng phép cộng dương lịch (Calendar Day Increment) cho ngày kết thúc để bao phủ toàn bộ dữ liệu qua nửa đêm mà không bị thụt lùi ngày do lệch múi giờ.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-09', { bold: true }),
        createCell('Khống chế trần xuất an toàn (10.000 dòng)'),
        createCell('Khi người dùng kích hoạt xuất file (Excel, CSV, JSON), nếu tổng số bản ghi thỏa mãn bộ lọc vượt quá 10.000 dòng, hệ thống bắt buộc từ chối xuất (HTTP 400), trả về thông báo yêu cầu người dùng thu hẹp bộ lọc nhằm bảo vệ bộ nhớ máy chủ.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-10', { bold: true }),
        createCell('Khử lỗ hổng CSV Formula Injection'),
        createCell('Khi xuất file CSV, bất kỳ ô dữ liệu nào bắt đầu bằng các ký tự công thức (=, +, -, @) hoặc ký tự điều khiển bắt buộc phải được tiền tố thêm dấu nháy đơn (\') để vô hiệu hóa mã thực thi khi mở trên Microsoft Excel.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-11', { bold: true }),
        createCell('Bảo vệ tài khoản & Không tự xóa chính mình'),
        createCell('Quản trị viên (Admin) không được phép thực hiện thao tác xóa tài khoản của chính mình trong màn hình Quản lý người dùng. Mật khẩu khi tạo mới hoặc reset mặc định là "123456" và phải được băm Bcrypt 10 vòng.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-12', { bold: true }),
        createCell('Phân loại nguồn Telemetry (Simulation vs Device)'),
        createCell('Mọi bản ghi dữ liệu telemetry sinh ra từ môi trường thử nghiệm bắt buộc phải gắn nhãn source=\'simulation\'. Nhãn source=\'device\' chỉ được phép sử dụng khi dữ liệu bắt nguồn từ cổng kết nối phần cứng IoT Gateway thật.'),
      ],
    }),
  ];
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: brRows,
      borders: thinBorders,
    })
  );

  return elements;
}
