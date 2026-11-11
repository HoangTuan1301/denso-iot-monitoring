/**
 * @file scripts/generate_ba_v2_part1.js
 * @description Part 1 of BA Documentation v2.0: Cover, Revision History, Sign-off, TOC, Chapters 1, 2, 3
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
  PageBreak,
  TableOfContents,
} from 'docx';
import {
  createPara,
  createH1,
  createH2,
  createH3,
  createCell,
  thinBorders,
  logoPath,
} from './generate_ba_v2_helpers.js';

export function getV2Part1Elements() {
  const elements = [];

  // =========================================================================
  // TRANG BÌA (COVER PAGE)
  // =========================================================================
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 400 },
          children: [
            new ImageRun({
              data: logoBuffer,
              transformation: { width: 220, height: 75 },
            }),
          ],
        })
      );
    } catch (e) {
      console.warn('Bỏ qua logo bìa:', e.message);
    }
  }

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: 'DỰ ÁN NGHIÊN CỨU & PHÁT TRIỂN HỆ THỐNG IIoT',
          font: 'Times New Roman',
          size: 26, // 13pt
          bold: true,
          color: '003366',
        }),
      ],
    })
  );

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 400 },
      children: [
        new TextRun({
          text: 'ĐỀ TÀI: GIÁM SÁT THỜI GIAN THỰC THIẾT BỊ VÀ DÂY CHUYỀN SẢN XUẤT (KAILINK)',
          font: 'Times New Roman',
          size: 22,
          bold: true,
          color: '4A5568',
        }),
      ],
    })
  );

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 500, after: 140 },
      children: [
        new TextRun({
          text: 'TÀI LIỆU ĐẶC TẢ YÊU CẦU NGHIỆP VỤ & PHÂN TÍCH HỆ THỐNG',
          font: 'Times New Roman',
          size: 36, // 18pt
          bold: true,
          color: '003366',
        }),
      ],
    })
  );

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 140 },
      children: [
        new TextRun({
          text: 'BUSINESS ANALYSIS & SOFTWARE REQUIREMENTS SPECIFICATION (BA / SRS)',
          font: 'Times New Roman',
          size: 22,
          bold: true,
          color: 'C53030', // Red
        }),
      ],
    })
  );

  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 500 },
      children: [
        new TextRun({
          text: 'PHIÊN BẢN v2.0 — BẢN CẬP NHẬT KIỂM TOÁN VÀ ĐẶC TẢ CHI TIẾT',
          font: 'Times New Roman',
          size: 24,
          bold: true,
          italics: true,
          color: '2D3748',
        }),
      ],
    })
  );

  const metaRows = [
    new TableRow({
      children: [
        createCell('Mã Dự Án / Repository', { bold: true, widthPercent: 35 }),
        createCell('denso-iot-monitoring (KaiLink)', { widthPercent: 65 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('Căn Cứ Mã Nguồn (Git Commit)', { bold: true }),
        createCell('feature/web-log-export (Commit Hash: 8ac31eabbb565788db640d73526df8daec8b0506)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Mã Tài Liệu', { bold: true }),
        createCell('BA-DENSO-IOT-2026-DOCX-V2.0'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Vai Trò Soạn Thảo', { bold: true }),
        createCell('Senior Business Analyst / Solution Architect / Documentation Auditor'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Tình Trạng Văn Bản', { bold: true }),
        createCell('Dự thảo kỹ thuật hoàn thiện — Chờ hội đồng chuyên môn thẩm định'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Ngày Hoàn Thành v2.0', { bold: true }),
        createCell('22/10/2026 (Cập nhật sau kiểm toán mã nguồn toàn diện)'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metaRows,
      borders: thinBorders,
    })
  );

  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // LỊCH SỬ PHIÊN BẢN TÀI LIỆU
  // =========================================================================
  elements.push(
    createPara('LỊCH SỬ PHIÊN BẢN TÀI LIỆU (DOCUMENT REVISION HISTORY)', {
      bold: true,
      size: 32, // 16pt
      color: '003366',
      alignment: AlignmentType.CENTER,
      spaceBefore: 200,
      spaceAfter: 160,
    })
  );

  const revRows = [
    new TableRow({
      children: [
        createCell('Phiên Bản', { isHeader: true, widthPercent: 12 }),
        createCell('Ngày', { isHeader: true, widthPercent: 14 }),
        createCell('Tác Giả / Người Sửa', { isHeader: true, widthPercent: 22 }),
        createCell('Nội Dung Thay Đổi & Lý Do Nâng Cấp', { isHeader: true, widthPercent: 37 }),
        createCell('Tình Trạng', { isHeader: true, widthPercent: 15 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('v0.1', { bold: true }),
        createCell('06/10/2026'),
        createCell('Development Team'),
        createCell('Dự thảo SRS kiến trúc sơ bộ phục vụ đăng ký đề tài Hackathon 2026.'),
        createCell('Bản nháp'),
      ],
    }),
    new TableRow({
      children: [
        createCell('v0.5', { bold: true }),
        createCell('15/10/2026'),
        createCell('Technical Lead'),
        createCell('Bổ sung nghiệm thu phân hệ Lịch sử hoạt động máy và xuất báo cáo 3 định dạng.'),
        createCell('Nghiệm thu nội bộ'),
      ],
    }),
    new TableRow({
      children: [
        createCell('v1.0', { bold: true }),
        createCell('22/10/2026 (Sáng)'),
        createCell('Business Analyst Team'),
        createCell('Khảo sát và lập tài liệu BA 10 chương lần đầu.'),
        createCell('Bản kiểm toán v1.0'),
      ],
    }),
    new TableRow({
      children: [
        createCell('v2.0', { bold: true }),
        createCell('22/10/2026 (Chiều)'),
        createCell('Senior BA & Lead QA'),
        createCell('Refactor toàn diện: Đặc tả độc lập 21 FRs chuẩn 19 trường; Đặc tả chi tiết 10 Use Cases có Main/Alt/Exception Flow; Chuẩn hóa 15 Business Rules khớp 100% mã nguồn; Đồng bộ mục lục; Chỉnh sửa thông tin phê duyệt khách quan; Bổ sung ma trận RTM hoàn chỉnh.'),
        createCell('Lưu trữ đối chiếu'),
      ],
    }),
    new TableRow({
      children: [
        createCell('v2.1', { bold: true }),
        createCell('22/10/2026'),
        createCell('Senior BA & OpenXML Specialist'),
        createCell('Khắc phục toàn diện mục lục: Thay thế mục lục thủ công bằng Word OpenXML Table of Contents tự động (TOC \\o "1-3" \\h \\z \\u), căn phải số trang với dấu chấm dẫn dot leader, định dạng chuẩn cấp độ Heading 1, 2, 3 và hỗ trợ Update Field.'),
        createCell('Chính thức v2.1 (Chờ duyệt)'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: revRows,
      borders: thinBorders,
    })
  );

  elements.push(createPara(' '));
  elements.push(
    createPara('Bảng Trách Nhiệm & Xác Nhận Thẩm Định (Sign-off & Review Status)', {
      bold: true,
      size: 28, // 14pt
      color: '004080',
      spaceBefore: 200,
      spaceAfter: 120,
    })
  );

  const signRows = [
    new TableRow({
      children: [
        createCell('Vai Trò Phê Duyệt', { isHeader: true, widthPercent: 25 }),
        createCell('Họ và Tên Dự Kiến', { isHeader: true, widthPercent: 28 }),
        createCell('Đơn Vị / Chức Vụ', { isHeader: true, widthPercent: 32 }),
        createCell('Tình Trạng Xác Nhận', { isHeader: true, widthPercent: 15 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('Tác giả biên soạn (BA)', { bold: true }),
        createCell('Nhóm Phân Tích Nghiệp Vụ'),
        createCell('BA & QA Documentation Reviewer'),
        createCell('Đã hoàn thiện v2.0'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Rà soát Kiến trúc & Mã nguồn', { bold: true }),
        createCell('Lead Software Engineer'),
        createCell('Phụ trách Kỹ thuật Dự án KaiLink'),
        createCell('Chờ thẩm định kỹ thuật'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Đại diện Vận hành Nhà máy', { bold: true }),
        createCell('Production Supervisor'),
        createCell('Phân xưởng Sản xuất Thí điểm'),
        createCell('Chờ xác nhận nghiệp vụ'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Phê duyệt Đề tài Dự án', { bold: true }),
        createCell('Hội Đồng Kỹ Thuật'),
        createCell('Ban Tổ Chức DENSO Hackathon 2026'),
        createCell('Chưa phê duyệt chính thức'),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: signRows,
      borders: thinBorders,
    })
  );

  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // MỤC LỤC TỰ ĐỘNG THỰC SỰ (WORD OPENXML TABLE OF CONTENTS)
  // =========================================================================
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 360, after: 240 },
      children: [
        new TextRun({
          text: 'MỤC LỤC TÀI LIỆU (TABLE OF CONTENTS)',
          font: 'Times New Roman',
          size: 32, // 16pt
          bold: true,
          color: '003366',
        }),
      ],
    })
  );

  elements.push(
    new TableOfContents('MỤC LỤC TÀI LIỆU', {
      hyperlink: true,
      headingStyleRange: '1-3',
    })
  );

  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // CHƯƠNG 1: GIỚI THIỆU DỰ ÁN
  // =========================================================================
  elements.push(createH1('CHƯƠNG 1: GIỚI THIỆU DỰ ÁN VÀ BỐI CẢNH NGHIỆP VỤ'));

  elements.push(createH2('1.1. Tổng quan dự án DENSO IoT Monitoring (KaiLink)'));
  elements.push(
    createPara(
      'Dự án "DENSO Industrial IoT Monitoring System" (mã phát triển nội bộ: KaiLink) là hệ thống ứng dụng web chuyên dụng phục vụ công tác giám sát, cảnh báo sớm và phân tích dữ liệu thiết bị, dây chuyền sản xuất tự động trong môi trường nhà máy sản xuất linh kiện ô tô công nghệ cao của Tập đoàn DENSO. Dự án được khởi tạo và phát triển nhằm tham gia sự kiện DENSO Hackathon 2026, đồng thời đặt nền móng kỹ thuật cho việc triển khai thí điểm tại các phân xưởng gia công cơ khí chính xác, dập khuôn và sơn tĩnh điện.'
    )
  );

  elements.push(createH2('1.2. Bối cảnh sản xuất và bài toán nghiệp vụ công nghiệp'));
  elements.push(
    createPara(
      'Trong ngành công nghiệp phụ tùng ô tô đòi hỏi độ chính xác tuyệt đối và thời gian giao hàng tức thì (Just-In-Time - JIT), dây chuyền sản xuất cơ khí, dập khuôn, sơn tĩnh điện và lắp ráp động cơ vận hành liên tục với nhịp chu kỳ (takt time) tính bằng giây. Một sự cố cơ khí bất ngờ xảy ra — ví dụ áp suất dầu thủy lực máy dập vượt ngưỡng an toàn, nhiệt độ vòng bi robot hàn tăng cao hoặc lưu lượng khí nén phun sơn bị sụt giảm — nếu không được cảnh báo sớm sẽ dẫn đến kẹt máy, biến dạng khuôn hoặc tạo ra hàng loạt sản phẩm lỗi, gây tổn thất nghiêm trọng về kinh tế và uy tín chuỗi cung ứng.'
    )
  );
  elements.push(
    createPara(
      'Phương thức giám sát truyền thống bộc lộ những hạn chế lớn: (1) Công nhân tuần tra định kỳ bằng mắt và ghi chép sổ giấy tạo ra độ trễ thông tin lớn; (2) Quản đốc không có bức tranh toàn cảnh đồng bộ giữa các công đoạn; (3) Quy trình tiếp nhận và xử lý sự cố thiếu bằng chứng kiểm toán (không rõ ai xử lý, lúc nào và áp dụng biện pháp gì).'
    )
  );

  elements.push(createH2('1.3. Mục tiêu xây dựng hệ thống'));
  elements.push(
    createPara(
      'Dự án xác định 4 mục tiêu cụ thể, đo lường được (SMART Goals):'
    )
  );
  elements.push(
    createPara(
      '1. Giám sát thời gian thực (Real-time Telemetry): Phản ánh tức thì các thông số vật lý quan trọng (Nhiệt độ, Áp suất, Độ rung, Dòng điện, Mô-men xoắn, Lưu lượng khí) với chu kỳ phát sóng 2 giây/lần qua giao thức WebSocket.'
    )
  );
  elements.push(
    createPara(
      '2. Cảnh báo sớm đa cấp (Early Warning & Digital Andon): Tự động so khớp dữ liệu đo lường với bộ 4 ngưỡng kỹ thuật (Warning Min/Max, Critical Min/Max) để kích hoạt tín hiệu thị giác (Xanh - Vàng - Đỏ nhấp nháy) trên màn hình trung tâm.'
    )
  );
  elements.push(
    createPara(
      '3. Số hóa quy trình xử lý sự cố (Closed-Loop Incident Management): Thiết lập quy trình 3 bước chuẩn công nghiệp: Chờ tiếp nhận (Pending) → Đã tiếp nhận (Acknowledged) → Đã giải quyết (Resolved) kèm biên bản nghiệm thu kỹ thuật.'
    )
  );
  elements.push(
    createPara(
      '4. Lưu trữ lịch sử & Xuất dữ liệu đa định dạng: Lưu trữ dữ liệu chuỗi thời gian bền vững vào MySQL chuẩn UTC, cung cấp bộ lọc liên hoàn theo ca làm việc (đặc biệt ca 3 qua đêm) và xuất ra 3 định dạng: Excel (.xlsx), CSV (UTF-8 BOM), JSON phục vụ báo cáo và đào tạo AI.'
    )
  );

  elements.push(createH2('1.4. Giá trị nghiệp vụ dự kiến'));
  elements.push(
    createPara(
      'Hệ thống kỳ vọng mang lại các giá trị đo lường được: nâng cao hiệu suất tổng thể thiết bị (OEE), rút ngắn thời gian trung bình để sửa chữa (MTTR) nhờ tra cứu nhanh bằng mã QR, loại bỏ 100% giấy tờ ghi chép thủ công và tạo lập cơ sở dữ liệu chuỗi thời gian sạch phục vụ bảo trì ngăn ngừa (Preventive/Predictive Maintenance).'
    )
  );

  elements.push(createH2('1.5. Phạm vi dự án và giới hạn phòng Lab'));
  elements.push(
    createPara(
      '• Phạm vi đã hoàn thành trong mã nguồn: Ứng dụng Web Dashboard responsive hoàn chỉnh, Backend Node.js/Express, WebSocket Server, CSDL quan hệ MySQL (denso_iot), xác thực bảo mật JWT, phân quyền RBAC 3 vai trò, bộ tạo dữ liệu mô phỏng tập trung 10 kênh đo chuẩn hóa và động cơ xuất file nhị phân OpenXML zero-dependency.'
    )
  );
  elements.push(
    createPara(
      '• Giới hạn cần làm rõ (Important Limitations): Toàn bộ dữ liệu cảm biến thời gian thực hiện đang được sinh ra bởi Bộ mô phỏng tập trung tại Backend (Simulation Engine) theo đúng đặc tính kỹ thuật máy móc DENSO, chưa kết nối dây mạng phần cứng thực tế với PLC ngoài đời thực. Các trạm PLC Siemens S7-1500 và Omron NX1P2 hiện diện dưới dạng mô hình phần mềm chuẩn giao thức (Software Protocol Model).'
    )
  );

  elements.push(createH2('1.6. Thuật ngữ và định nghĩa chuyên ngành'));
  const termRows = [
    new TableRow({
      children: [
        createCell('Thuật ngữ', { isHeader: true, widthPercent: 20 }),
        createCell('Tên tiếng Anh đầy đủ', { isHeader: true, widthPercent: 35 }),
        createCell('Định nghĩa và Ý nghĩa trong hệ thống KaiLink', { isHeader: true, widthPercent: 45 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('IIoT', { bold: true }),
        createCell('Industrial Internet of Things'),
        createCell('Mạng lưới vạn vật kết nối công nghiệp, kết nối cảm biến và thiết bị sản xuất về máy chủ giám sát trung tâm.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('PLC', { bold: true }),
        createCell('Programmable Logic Controller'),
        createCell('Bộ điều khiển khả trình công nghiệp, điều khiển cơ cấu chấp hành và đọc dữ liệu thanh ghi cảm biến.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Andon', { bold: true }),
        createCell('Andon System (Toyota TPS)'),
        createCell('Hệ thống thông báo thị giác/âm thanh trong nhà xưởng, báo hiệu tức thời khi dây chuyền gặp sự cố.'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Telemetry', { bold: true }),
        createCell('Telemetry Data Stream'),
        createCell('Dòng dữ liệu chuỗi thời gian ghi nhận các giá trị đo lường vật lý liên tục (nhiệt độ, áp suất, dòng điện...).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('RBAC', { bold: true }),
        createCell('Role-Based Access Control'),
        createCell('Mô hình kiểm soát truy cập dựa trên vai trò nghiệp vụ (Admin, Operator, Maintenance).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('OEE', { bold: true }),
        createCell('Overall Equipment Effectiveness'),
        createCell('Chỉ số đo lường hiệu suất tổng thể thiết bị sản xuất (Mức độ sẵn sàng x Hiệu suất x Chất lượng).'),
      ],
    }),
    new TableRow({
      children: [
        createCell('OpenXML', { bold: true }),
        createCell('Office Open XML (ISO/IEC 29500)'),
        createCell('Quy chuẩn file bảng tính nén (.xlsx) tiêu chuẩn quốc tế được sinh nhị phân bằng thuật toán PKZIP thuần.'),
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
  // CHƯƠNG 2: PHÂN TÍCH CÁC BÊN LIÊN QUAN VÀ MÔ HÌNH PHÂN QUYỀN
  // =========================================================================
  elements.push(createH1('CHƯƠNG 2: PHÂN TÍCH CÁC BÊN LIÊN QUAN VÀ MÔ HÌNH PHÂN QUYỀN (RBAC)'));

  elements.push(createH2('2.1. Xác định các bên liên quan (Stakeholder Matrix)'));
  elements.push(
    createPara(
      'Hệ thống DENSO IoT Monitoring phục vụ 5 nhóm đối tượng liên quan trong nhà máy:'
    )
  );
  elements.push(
    createPara(
      '1. Ban Giám đốc Khối Sản xuất (Plant Director / Production GM): Quan tâm tới các KPI cấp cao (Chỉ số an toàn toàn xưởng, số lượng cảnh báo nghiêm trọng, thời gian dừng chuyền).'
    )
  );
  elements.push(
    createPara(
      '2. Quản đốc & Trưởng ca sản xuất (Production Supervisor): Theo dõi trạng thái đồng bộ 3 dây chuyền, điều phối nhân lực khi có sự cố và nghiệm thu báo cáo ca.'
    )
  );
  elements.push(
    createPara(
      '3. Kỹ sư Tự động hóa & Kỹ thuật bảo trì (Maintenance & Automation Engineer): Cần thông tin chẩn đoán chuyên sâu (đồ thị rung động, nhiệt độ dầu, áp suất), cấu hình ngưỡng kỹ thuật, bật/tắt trạm truyền thông PLC và nghiệm thu đóng sự cố.'
    )
  );
  elements.push(
    createPara(
      '4. Công nhân vận hành tại trạm (Line Operator): Trực tiếp thao tác máy, xem trạng thái thiết bị của trạm mình phụ trách, bấm xác nhận tiếp nhận sự cố bước 1 khi phát sinh cảnh báo.'
    )
  );
  elements.push(
    createPara(
      '5. Quản trị viên hệ thống CNTT (IT / OT System Administrator): Quản trị tài khoản, phân quyền nhân sự, theo dõi nhật ký kiểm toán hệ thống và bảo đảm an toàn kết nối mạng.'
    )
  );

  elements.push(createH2('2.2. Phân tích chi tiết 3 vai trò người dùng trong hệ thống'));
  elements.push(
    createPara(
      'Căn cứ mã nguồn thực tế tại server/index.js và server/db-mysql.js, hệ thống triển khai 3 vai trò người dùng:'
    )
  );
  elements.push(
    createPara(
      '• ADMIN (Quản trị viên toàn quyền): Tài khoản mẫu admin@denso.com (Mã NV: DNS-1001). Toàn quyền cấu hình tham số, quản trị tài khoản người dùng, reset mật khẩu, chỉnh sửa ngưỡng cảm biến, bật/tắt PLC và truy xuất toàn bộ nhật ký kiểm toán hệ thống.'
    )
  );
  elements.push(
    createPara(
      '• MAINTENANCE (Kỹ thuật viên cơ điện & bảo trì): Tài khoản mẫu tech@denso.com (Mã NV: DNS-1088). Phụ trách giám sát sâu Tầng 2 & Tầng 3, tiếp nhận và hoàn tất nghiệm thu sự cố kèm biên bản giải pháp kỹ thuật, cấu hình ngưỡng và bật/tắt trạm PLC, xem nhật ký kiểm toán và xuất báo cáo lịch sử máy.'
    )
  );
  elements.push(
    createPara(
      '• OPERATOR (Công nhân vận hành chuyền): Tài khoản mẫu user@denso.com (Mã NV: DNS-1024). Được phân công cụ thể vào một dây chuyền (ví dụ LINE-01), có quyền xem dashboard, danh sách máy, tiếp nhận sự cố bước 1 và tra cứu lịch sử máy. Bị chặn truy cập vào các phân hệ cấu hình ngưỡng, quản trị người dùng và nhật ký kiểm toán.'
    )
  );

  elements.push(createH2('2.3. Ma trận phân quyền truy cập chức năng'));
  const rbacRows = [
    new TableRow({
      children: [
        createCell('Mã Phân Hệ', { isHeader: true, widthPercent: 12 }),
        createCell('Tên Chức Năng / Màn Hình', { isHeader: true, widthPercent: 38 }),
        createCell('OPERATOR', { isHeader: true, widthPercent: 16, align: AlignmentType.CENTER }),
        createCell('MAINTENANCE', { isHeader: true, widthPercent: 17, align: AlignmentType.CENTER }),
        createCell('ADMIN', { isHeader: true, widthPercent: 17, align: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-01', { bold: true }),
        createCell('Dashboard Tổng Quan Nhà Máy (Tầng 1)'),
        createCell('Xem', { align: AlignmentType.CENTER }),
        createCell('Xem', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-02', { bold: true }),
        createCell('Luồng & Thành Phần Máy Móc (Tầng 2 & 3)'),
        createCell('Xem', { align: AlignmentType.CENTER }),
        createCell('Xem & Chẩn đoán', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-03', { bold: true }),
        createCell('Nhật ký Sự cố: Tiếp nhận bước 1 (Acknowledge)'),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-03', { bold: true }),
        createCell('Nhật ký Sự cố: Nghiệm thu hoàn tất (Resolve)'),
        createCell('Chặn (Ẩn nút)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
        createCell('Cho phép', { align: AlignmentType.CENTER }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-04', { bold: true }),
        createCell('Cấu hình Ngưỡng Kỹ thuật & Trạm PLC'),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-05', { bold: true }),
        createCell('Lịch sử Hoạt động Máy & Xuất File Báo cáo'),
        createCell('Xem & Xuất', { align: AlignmentType.CENTER }),
        createCell('Xem & Xuất', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-06', { bold: true }),
        createCell('Quản trị Người dùng & Phân quyền MySQL'),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Toàn quyền CRUD', { align: AlignmentType.CENTER, bold: true }),
      ],
    }),
    new TableRow({
      children: [
        createCell('MOD-07', { bold: true }),
        createCell('Nhật ký Kiểm toán Hệ thống (Audit Logs)'),
        createCell('Chặn (403 Shield)', { align: AlignmentType.CENTER, bold: true }),
        createCell('Xem & Xuất CSV', { align: AlignmentType.CENTER }),
        createCell('Toàn quyền', { align: AlignmentType.CENTER, bold: true }),
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

  elements.push(createH2('2.4. Phân tích điểm chưa đồng bộ vai trò MAINTENANCE giữa UI và Backend'));
  elements.push(
    createPara(
      'Kiểm toán mã nguồn xác nhận: Backend MySQL và middleware Express phân biệt rõ 3 vai trò (`ADMIN`, `OPERATOR`, `MAINTENANCE`), bảo vệ các API bằng `requireRole([\'ADMIN\', \'MAINTENANCE\'])`. Tuy nhiên, trên giao diện người dùng `UserManagementView.tsx`, bộ lọc nhanh hiện tại chỉ hiển thị 2 nút "Quyền SỬA (Admin)" và "Quyền XEM (Operator)"; form thêm nhân viên mới cũng chưa hiển thị lựa chọn vai trò MAINTENANCE trong dropdown. Đây là điểm nợ kỹ thuật (Technical Debt) đã được ghi nhận trong bảng Change Log để hoàn thiện trong Sprint tới.'
    )
  );

  // =========================================================================
  // CHƯƠNG 3: PHÂN TÍCH QUY TRÌNH NGHIỆP VỤ VÀ QUY TẮC CỐT LÕI
  // =========================================================================
  elements.push(createH1('CHƯƠNG 3: PHÂN TÍCH QUY TRÌNH NGHIỆP VỤ VÀ QUY TẮC CỐT LÕI'));

  elements.push(createH2('3.1. Bài toán giám sát thiết bị nhà máy công nghiệp'));
  elements.push(
    createPara(
      'Mô hình sản xuất DENSO vận hành liên tục qua 3 dây chuyền nối tiếp: Dập & Hàn khung gầm (Line 1) → Sơn tĩnh điện (Line 2) → Lắp ráp hoàn thiện (Line 3). Mỗi máy móc có các tham số vật lý đặc trưng cần kiểm soát chặt chẽ nhằm ngăn chặn nguy cơ dừng chuyền đột ngột.'
    )
  );

  elements.push(createH2('3.2. Quy trình hiện tại (AS-IS) - Giả định khảo sát tham khảo'));
  elements.push(
    createPara(
      'LƯU Ý KHÁCH QUAN: Mô tả quy trình AS-IS dưới đây là giả định khảo sát nghiệp vụ tham khảo ban đầu từ tài liệu kiến trúc SRS, chưa phải kết quả đo lường time-motion study tại một nhà xưởng thực địa cụ thể.'
    )
  );
  elements.push(
    createPara(
      'Trong quy trình AS-IS truyền thống: Công nhân vận hành kiểm tra đồng hồ áp suất, nhiệt kế tại chỗ theo chu kỳ 2 - 4 giờ/lần; ghi chép vào sổ giấy kiểm tra trạm; khi máy có dấu hiệu lạ (kêu to, nóng), công nhân bấm dừng khẩn cấp và gọi bộ đàm cho tổ bảo trì; kỹ thuật viên di chuyển tới kiểm tra và sửa chữa; hoàn thành sửa chữa thì ký xác nhận vào sổ nhật trình. Ước tính thời gian gián đoạn từ khi có dấu hiệu suy hao đến khi xử lý thường kéo dài hàng chục phút.'
    )
  );

  elements.push(createH2('3.3. Quy trình đề xuất (TO-BE) - Giám sát IIoT thông minh'));
  elements.push(
    createPara(
      'Quy trình TO-BE được phần mềm KaiLink hỗ trợ hiện nay: Cảm biến/PLC gửi dữ liệu liên tục; máy chủ tự động so khớp 4 ngưỡng kỹ thuật; nếu vượt ngưỡng cảnh báo (Warning), hệ thống đổi màu vàng trên Dashboard; nếu vượt ngưỡng nguy hiểm (Critical), hệ thống kích hoạt cảnh báo đỏ nhấp nháy toàn xưởng và phát sinh bản ghi sự cố; nhân viên quét mã QR trên thân máy để mở ngay màn hình đo lường Tầng 3 và nhấn "Tiếp nhận"; kỹ thuật viên khắc phục xong nhập ghi chú nghiệm thu và bấm "Hoàn tất" để đóng sự cố; mọi hành động được lưu vết bất biến trong Audit Log và MySQL.'
    )
  );

  elements.push(createH2('3.4. Luồng xử lý dữ liệu Telemetry thời gian thực (Data Pipeline)'));
  elements.push(
    createPara(
      'Kiến trúc luồng dữ liệu thời gian thực được vận hành bởi 2 chu kỳ độc lập tại Backend:'
    )
  );
  elements.push(
    createPara(
      '1. Chu kỳ phát sóng WebSocket (2 giây/lần): Máy chủ WebSocket (`server/index.js`) phát sóng gói tin `iot_telemetry_tick` chứa các giá trị jitter ngẫu nhiên tới mọi trình duyệt đang mở để cập nhật chuyển động mượt mà của biểu đồ Recharts và thẻ KPI.'
    )
  );
  elements.push(
    createPara(
      '2. Chu kỳ ghi CSDL bền vững (5 giây/lần): Backend tự động trích xuất các kênh đo từ `CANONICAL_TELEMETRY_CHANNELS`, tính toán giá trị đo lường, đánh giá trạng thái và thực hiện ghi batch vào bảng `machine_telemetry_history` của MySQL với `source=\'simulation\'`.'
    )
  );

  elements.push(createH2('3.5. Quy trình xử lý sự cố 3 bước (Alarm Lifecycle Workflow)'));
  elements.push(
    createPara(
      'Vòng đời sự cố trải qua 3 trạng thái nghiêm ngặt: (1) Chờ tiếp nhận (Pending) → Bất kỳ ai cũng có thể nhấn "Đã nhận sửa"; (2) Đang xử lý (Acknowledged) → Ghi nhận tên nhân viên và giờ tiếp nhận; (3) Đã giải quyết (Resolved) → Chỉ vai trò MAINTENANCE hoặc ADMIN mới được mở modal nghiệm thu, bắt buộc nhập ghi chú giải pháp kỹ thuật trước khi đóng sự cố.'
    )
  );

  elements.push(createH2('3.6. Hệ thống 15 Quy tắc Nghiệp vụ Cốt lõi (Business Rules)'));
  elements.push(
    createPara(
      'Căn cứ đối chiếu trực tiếp với mã nguồn dự án, toàn bộ 15 Business Rules (BR-01 đến BR-15) được chuẩn hóa và truy vết đầy đủ như sau:'
    )
  );

  const brRows = [
    new TableRow({
      children: [
        createCell('Mã BR', { isHeader: true, widthPercent: 10 }),
        createCell('Tên Quy Tắc Nghiệp Vụ', { isHeader: true, widthPercent: 25 }),
        createCell('Nội Dung Chi Tiết & Ràng Buộc Kỹ Thuật', { isHeader: true, widthPercent: 45 }),
        createCell('Vị Trí Mã Nguồn Đối Chiếu', { isHeader: true, widthPercent: 20 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-01', { bold: true }),
        createCell('Đánh giá 4 ngưỡng kỹ thuật'),
        createCell('Giá trị đo V được đánh giá theo thứ tự: Nếu V <= criticalMin hoặc V >= criticalMax thì trạng thái là "critical"; nếu V <= warningMin hoặc V >= warningMax thì trạng thái là "warning"; ngược lại là "normal". Ngưỡng nguy hiểm luôn có độ ưu tiên cao hơn ngưỡng cảnh báo.'),
        createCell('plcConverter.ts\n(Dòng 72-89)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-02', { bold: true }),
        createCell('Tổng hợp trạng thái Máy Tầng 2'),
        createCell('Trạng thái của một Máy Tầng 2 phụ thuộc vào các chỉ số con Tầng 3: Nếu có ít nhất 1 chỉ số con là "critical" thì máy là "critical"; nếu không có critical nhưng có ít nhất 1 warning thì máy là "warning"; chỉ khi tất cả chỉ số con là "normal" thì máy mới là "normal".'),
        createCell('useMonitoringStore.ts\n(Dòng 339-349)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-03', { bold: true }),
        createCell('Điểm an toàn Dây chuyền'),
        createCell('Điểm an toàn dây chuyền (Safety Score %) = (Số chỉ số trạng thái normal / Tổng số chỉ số) * 100. Điểm an toàn toàn xưởng là trung bình cộng điểm an toàn của 3 dây chuyền.'),
        createCell('plcConverter.ts\n(Dòng 95-138)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-04', { bold: true }),
        createCell('Tiếp nhận sự cố (Acknowledge)'),
        createCell('Sự cố ở trạng thái Pending chỉ chuyển sang Acknowledged khi có nhân viên hợp lệ xác nhận. Hệ thống lưu vết tên người tiếp nhận, thời điểm ISO timestamp và tạo một bản ghi Audit Log tương ứng.'),
        createCell('useAlarmStore.ts\n(Dòng 33-50)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-05', { bold: true }),
        createCell('Nghiệm thu sự cố (Resolve)'),
        createCell('Chỉ tài khoản vai trò MAINTENANCE hoặc ADMIN mới được phép đóng sự cố. Bắt buộc phải có nội dung ghi chú giải pháp (Resolution Notes) trước khi chuyển trạng thái sang Resolved.'),
        createCell('useAlarmStore.ts (L53)\nAlarmLogView.tsx (L400)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-06', { bold: true }),
        createCell('Định danh Telemetry Chống trùng'),
        createCell('Mỗi bản ghi telemetry chuỗi thời gian có ID xác định được tính toán bằng hàm băm SHA-256 từ chuỗi tổ hợp: lineId_machineId_metricId_timestamp. Lệnh ghi CSDL sử dụng INSERT IGNORE để chống trùng lặp khi thử lại.'),
        createCell('server/db-mysql.js\n(Dòng 508-515)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-07', { bold: true }),
        createCell('Chuẩn hóa Múi giờ UTC & Quy đổi VN'),
        createCell('Toàn bộ CSDL MySQL và API trao đổi dữ liệu sử dụng múi giờ quốc tế UTC (+00:00). Bộ lọc theo ngày/giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7) bắt buộc phải chuyển đổi chính xác sang UTC trước khi truy vấn SQL.'),
        createCell('server/db-mysql.js\n(Dòng 59, 590-640)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-08', { bold: true }),
        createCell('Lọc Ca làm việc qua nửa đêm (Ca 3)'),
        createCell('Ca 3 có khung giờ 22:00 hôm nay đến 06:00 sáng hôm sau. Truy vấn SQL bắt buộc phải sử dụng phép cộng dương lịch (Calendar Day Increment) cho ngày kết thúc để bao phủ toàn bộ dữ liệu qua nửa đêm mà không bị thụt lùi ngày do lệch múi giờ.'),
        createCell('server/db-mysql.js\n(Dòng 620-645)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-09', { bold: true }),
        createCell('Khống chế trần xuất 10.000 dòng'),
        createCell('Khi xuất file (Excel, CSV, JSON), nếu tổng số bản ghi vượt quá 10.000 dòng, hệ thống bắt buộc từ chối xuất (HTTP 400), trả về thông báo yêu cầu người dùng thu hẹp bộ lọc nhằm bảo vệ bộ nhớ máy chủ.'),
        createCell('server/index.js (L781)\nserver/db-mysql.js (L680)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-10', { bold: true }),
        createCell('Khử lỗi CSV Formula Injection'),
        createCell('Khi xuất file CSV, bất kỳ ô dữ liệu nào bắt đầu bằng ký tự công thức (=, +, -, @) hoặc ký tự điều khiển bắt buộc phải được tiền tố thêm dấu nháy đơn (\') để vô hiệu hóa mã thực thi khi mở trên Microsoft Excel.'),
        createCell('src/utils/exportEngine.ts\n(Dòng 63-70)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-11', { bold: true }),
        createCell('Bảo vệ tài khoản & Không tự xóa chính mình'),
        createCell('Quản trị viên (Admin) không được phép tự xóa tài khoản của chính mình trong màn hình Quản lý người dùng. Mật khẩu khi tạo mới hoặc reset mặc định là "123456" và băm Bcrypt 10 vòng.'),
        createCell('server/index.js\n(Dòng 432-434)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-12', { bold: true }),
        createCell('Phân loại nguồn Telemetry (Simulation vs Device)'),
        createCell('Mọi bản ghi dữ liệu telemetry sinh ra từ môi trường thử nghiệm bắt buộc phải gắn nhãn source=\'simulation\'. Nhãn source=\'device\' chỉ được phép sử dụng khi dữ liệu bắt nguồn từ cổng kết nối phần cứng IoT Gateway thật.'),
        createCell('server/db-mysql.js (L230)\nsrc/types/hierarchy.ts (L99)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-13', { bold: true }),
        createCell('Giới hạn tệp ảnh đại diện (Multer Validation)'),
        createCell('File tải lên làm ảnh đại diện chỉ chấp nhận định dạng JPG, PNG, WEBP, SVG và dung lượng tối đa không vượt quá 5MB. Chỉ Admin mới được quyền đổi avatar cho nhân viên khác.'),
        createCell('server/index.js\n(Dòng 53-65, 505-508)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-14', { bold: true }),
        createCell('Danh mục cột sắp xếp hợp lệ (Whitelist Sort)'),
        createCell('Tham số sortBy trong API lịch sử máy chỉ chấp nhận một trong 7 cột hợp lệ: timestamp, value, lineId, machineId, metricId, status, createdAt. Mọi giá trị khác đều bị từ chối với HTTP 400 để chặn đứng SQL Injection.'),
        createCell('server/index.js (L628)\nserver/db-mysql.js (L451)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('BR-15', { bold: true }),
        createCell('Chuyển đổi tín hiệu thanh ghi PLC sang kỹ thuật'),
        createCell('Giá trị số thô đọc từ thanh ghi PLC (ví dụ 0 - 4095 từ ADC 12-bit) được chuyển đổi sang giá trị kỹ thuật theo cấu hình: DEC12 (ánh xạ tuyến tính), BIT12 (trích xuất bitmask nhị phân) hoặc SCALE (tuyến tính Y = X * Scale + Offset).'),
        createCell('src/utils/plcConverter.ts\n(Dòng 16-61)'),
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
