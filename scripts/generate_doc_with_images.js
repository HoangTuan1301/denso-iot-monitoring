/**
 * @file scripts/generate_doc_with_images.js
 * @description Generates the official Word document 'Thong_Ke_Giao_Dien_Chuc_Nang_DENSO_Co_Hinh_Anh.docx'
 * preserving 100% of the approved text from 'Thong_Ke_Giao_Dien_Chuc_Nang_DENSO.docx'
 * and embedding real screenshots captured from the live DENSO IoT Monitoring web application.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  Header,
  Footer,
  PageNumber,
  ImageRun,
} from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDocxPath = path.join(rootDir, 'Thong_Ke_Giao_Dien_Chuc_Nang_DENSO_Co_Hinh_Anh.docx');
const outDocxBaPath = path.join(rootDir, 'docs', 'ba', 'Thong_Ke_Giao_Dien_Chuc_Nang_DENSO_Co_Hinh_Anh.docx');
const imgDir = path.join(rootDir, 'docs', 'ba', 'images', 'actual');

// Border styles
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const tableBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
  insideHorizontal: thinBorder,
  insideVertical: thinBorder,
};

function createP(text, options = {}) {
  const {
    bold = false,
    italic = false,
    size = 24, // 12pt
    color = '1E293B',
    alignment = AlignmentType.JUSTIFIED,
    spaceBefore = 60,
    spaceAfter = 60,
    lineSpacing = 260,
  } = options;

  return new Paragraph({
    alignment,
    spacing: { before: spaceBefore, after: spaceAfter, line: lineSpacing },
    children: [
      new TextRun({ text, font: 'Times New Roman', size, bold, italics: italic, color }),
    ],
  });
}

function createH1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({ text, font: 'Times New Roman', size: 30, bold: true, color: '003366' }),
    ],
  });
}

function createH2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({ text, font: 'Times New Roman', size: 26, bold: true, color: '0F4C81' }),
    ],
  });
}

function createH3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 120, after: 60 },
    children: [
      new TextRun({ text, font: 'Times New Roman', size: 24, bold: true, color: '1E293B' }),
    ],
  });
}

function createBullet(text, boldPrefix = '') {
  const children = [];
  if (boldPrefix) {
    children.push(new TextRun({ text: boldPrefix + ' ', font: 'Times New Roman', size: 24, bold: true, color: '0F172A' }));
  }
  children.push(new TextRun({ text, font: 'Times New Roman', size: 24, color: '334155' }));

  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 30, after: 30, line: 240 },
    children,
  });
}

function createCell(content, options = {}) {
  const {
    isHeader = false,
    widthPercent = null,
    bgColor = null,
    bold = false,
    size = 21, // 10.5pt
    alignment = AlignmentType.LEFT,
    color = isHeader ? 'FFFFFF' : '1E293B',
  } = options;

  let paras = [];
  if (typeof content === 'string') {
    paras = content.split('\n').map((line) => {
      return new Paragraph({
        alignment,
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({ text: line, font: 'Times New Roman', size, bold: isHeader || bold, color }),
        ],
      });
    });
  } else if (Array.isArray(content)) {
    paras = content;
  }

  const fill = isHeader ? '003366' : bgColor;
  const cellObj = {
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: paras,
  };

  if (fill) {
    cellObj.shading = { type: ShadingType.SOLID, color: fill, fill };
  }
  if (widthPercent) {
    cellObj.width = { size: widthPercent, type: WidthType.PERCENTAGE };
  }

  return new TableCell(cellObj);
}

function createImageBlock(imgFileName, width, height, caption) {
  const fullPath = path.join(imgDir, imgFileName);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] Ảnh không tồn tại: ${fullPath}`);
    return [];
  }
  const imgData = fs.readFileSync(fullPath);

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [
        new ImageRun({
          data: imgData,
          transformation: { width, height },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: caption,
          font: 'Times New Roman',
          size: 20, // 10pt
          italics: true,
          color: '475569',
          bold: true,
        }),
      ],
    }),
  ];
}

function buildDocument() {
  const elements = [];

  // =========================================================================
  // TIÊU ĐỀ BÁO CÁO
  // =========================================================================
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
      children: [
        new TextRun({
          text: 'DỰ ÁN HỆ THỐNG GIÁM SÁT IoT NHÀ MÁY DENSO (KaiLink)',
          font: 'Times New Roman',
          size: 24,
          bold: true,
          color: '003366',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: 'BÁO CÁO RÀ SOÁT TÀI KHOẢN ĐĂNG NHẬP, HỆ THỐNG PHÂN QUYỀN (SỬA - XEM) VÀ GIAO DIỆN CHỨC NĂNG THỰC TẾ',
          font: 'Times New Roman',
          size: 30,
          bold: true,
          color: 'E60012',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: 'Bản đầy đủ có minh họa ảnh chụp giao diện website trực tiếp phục vụ Trưởng nhóm và Ban Quản lý',
          font: 'Times New Roman',
          size: 22,
          italics: true,
          color: '475569',
        }),
      ],
    })
  );

  // =========================================================================
  // PHẦN 1. THỰC TRẠNG PHÂN QUYỀN TRÊN GIAO DIỆN QUẢN LÝ NGƯỜI DÙNG
  // =========================================================================
  elements.push(
    createH1('PHẦN 1. THỰC TRẠNG PHÂN QUYỀN TRÊN GIAO DIỆN QUẢN LÝ NGƯỜI DÙNG'),
    createP('Khi truy cập trực tiếp vào màn hình "Quản Lý Người Dùng & Phân Quyền" trên website thực tế, hệ thống hiện đang quy chuẩn cơ chế phân quyền thành đúng 2 LOẠI QUYỀN TRUY CẬP CHÍNH THỨC, không hiển thị trực tiếp 3 vai trò riêng biệt. Cụ thể:'),
    createBullet('Hiển thị trên thẻ thống kê Top-Card thứ 2 và tùy chọn Dropdown "SỬA (Quản trị)". Người sở hữu quyền này được cấp phạm vi truy cập: "9 màn — cấu hình + giám sát".', '1. Quyền SỬA (Quản trị / Admin):'),
    createBullet('Hiển thị trên thẻ thống kê Top-Card thứ 3 và tùy chọn Dropdown "XEM (Vận hành)". Người sở hữu quyền này được cấp phạm vi truy cập: "3 màn — chỉ giám sát".', '2. Quyền XEM (Vận hành / Operator):'),
    createP('Dưới đây là cấu trúc hiển thị thực tế của 3 Thẻ thống kê (Top-Cards) trên đầu trang Quản Lý Người Dùng:'),
    createBullet('Đếm tổng số lượng tài khoản nhân viên đang lưu trữ trên hệ thống, kèm dòng trạng thái: "[X] đang hoạt động · [Y] bị khóa".', '• Thẻ 1 - Tổng tài khoản:'),
    createBullet('Chữ màu xanh lá nổi bật, đếm số lượng tài khoản có quyền Quản trị, kèm dòng mô tả: "Quản trị & cấu hình hệ thống".', '• Thẻ 2 - Quyền SỬA (Admin):'),
    createBullet('Chữ màu xanh dương nổi bật, đếm số lượng tài khoản thuộc đội vận hành, kèm dòng mô tả: "Đội vận hành theo dõi".', '• Thẻ 3 - Quyền XEM (Operator):')
  );

  const topCardTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          createCell('Thẻ Top-Card trên UI', { isHeader: true, widthPercent: 25 }),
          createCell('Tên hiển thị & Màu sắc', { isHeader: true, widthPercent: 25 }),
          createCell('Số lượng ghi nhận trên UI', { isHeader: true, widthPercent: 22 }),
          createCell('Phạm vi quyền hạn gắn liền', { isHeader: true, widthPercent: 28 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Thẻ thống kê 1', { bold: true }),
          createCell('TỔNG TÀI KHOẢN\n(Slate / Xám đen)'),
          createCell('Tổng số nhân sự\n(Ví dụ: 3 - 4 tài khoản)'),
          createCell('Theo dõi tổng số người dùng trong CSDL nhà máy'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Thẻ thống kê 2', { bold: true }),
          createCell('QUYỀN SỬA (Admin)\n(Emerald / Xanh lá)', { color: '15803D', bold: true }),
          createCell('Tài khoản Quản trị\n(Thực tế hiển thị: 1 - 2 TK)'),
          createCell('Toàn quyền: 9 màn hình\n(Cấu hình + Giám sát)', { bold: true }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Thẻ thống kê 3', { bold: true }),
          createCell('QUYỀN XEM (Operator)\n(Blue / Xanh dương)', { color: '1D4ED8', bold: true }),
          createCell('Tài khoản Vận hành\n(Thực tế hiển thị: 2 TK)'),
          createCell('Giới hạn: 3 màn hình cốt lõi\n(Chỉ theo dõi giám sát)', { bold: true }),
        ],
      }),
    ],
  });
  elements.push(topCardTable);

  // [ẢNH PHẦN 1] Chèn ảnh thực tế ngay sau nội dung giải thích hai loại quyền
  elements.push(
    ...createImageBlock(
      'hinh_1_1_quan_ly_nguoi_dung_phan_quyen.png',
      530,
      348,
      'Hình 1.1. Màn hình Quản Lý Người Dùng & Phân Quyền trên website thực tế (Thể hiện 3 Thẻ Top-Card và 2 loại Quyền SỬA / XEM)'
    )
  );

  // =========================================================================
  // PHẦN 2. GIẢI THÍCH NGUYÊN NHÂN KHÁC BIỆT GIỮA CODE VÀ GIAO DIỆN
  // =========================================================================
  elements.push(
    createH1('PHẦN 2. GIẢI THÍCH NGUYÊN NHÂN KHÁC BIỆT GIỮA CODE VÀ GIAO DIỆN'),
    createP('Vấn đề Trưởng nhóm phát hiện: "Báo cáo trước đây liệt kê 3 vai trò, nhưng giao diện thực tế chỉ hiển thị 2 loại quyền". Dưới đây là kết quả kiểm tra toàn diện mã nguồn và giao diện:'),
    createH2('2.1. Bản chất của các vai trò ADMIN, OPERATOR, MAINTENANCE'),
    createBullet('Là vai trò chính thức, hiện diện xuyên suốt từ mã nguồn, cơ sở dữ liệu cho đến giao diện người dùng. Được ánh xạ tương ứng 100% với "Quyền SỬA (Quản trị)" trên bảng phân quyền.', '• ADMIN (Quản trị viên):'),
    createBullet('Là vai trò chính thức dành cho công nhân nhà xưởng, hiện diện xuyên suốt toàn bộ hệ thống. Được ánh xạ tương ứng 100% với "Quyền XEM (Vận hành)" trên bảng phân quyền.', '• OPERATOR (Vận hành viên):'),
    createBullet('Là một VAI TRÒ NỘI BỘ (Internal Role) tồn tại trong tầng dữ liệu Backend (MySQL) và logic định tuyến (Router). Tuy nhiên, trên giao diện Quản Lý Người Dùng (Frontend), giao diện đã thu gọn (collapsed) vai trò này vào nhóm Quyền XEM.', '• MAINTENANCE (Kỹ thuật bảo trì):'),
    createH2('2.2. Cơ chế Thu Gọn (Mapping / Grouping) trên Giao Diện Quản Trị'),
    createP('Trong mã nguồn màn hình Quản Lý Người Dùng (UserManagementView), giao diện đã áp dụng quy tắc nghiệp vụ 2 cấp độ (2-Tier RBAC) để tối ưu hóa việc quản lý:'),
    createBullet('Nếu tài khoản có vai trò là ADMIN -> Hệ thống xếp vào nhóm "Quyền SỬA" (Quản trị & cấu hình, 9 màn hình).', '1. Quy tắc ánh xạ Quyền SỬA:'),
    createBullet('Nếu tài khoản có vai trò KHÔNG PHẢI ADMIN (bao gồm cả OPERATOR và MAINTENANCE) -> Hệ thống tự động xếp vào nhóm "Quyền XEM" (Đội vận hành, 3 màn hình). Cụ thể, công thức tính trên UI là: operatorCount = users.filter(u => u.role !== "ADMIN").length.', '2. Quy tắc ánh xạ Quyền XEM:'),
    createBullet('Trên từng dòng danh sách nhân viên, hộp chọn (Dropdown) quyền truy cập CHỈ CÓ ĐÚNG 2 TÙY CHỌN: "SỬA (Quản trị)" và "XEM (Vận hành)". Hoàn toàn không có lựa chọn mang tên "MAINTENANCE".', '3. Dropdown phân quyền tại bảng:'),
    createBullet('Khi Admin bấm nút "+ Thêm người dùng" hoặc sửa tài khoản, hộp thoại mở ra cũng CHỈ CHO PHÉP CHỌN 2 QUYỀN: "XEM — chỉ theo dõi giám sát" hoặc "SỬA — quản trị & cấu hình hệ thống".', '4. Modal thêm/sửa tài khoản:'),
    createH2('2.3. Phân Biệt Vai Trò Nghiệp Vụ Nhà Máy Với Quyền Truy Cập Website'),
    createP('Cần phân biệt rõ hai khái niệm để tránh nhầm lẫn trong báo cáo bàn giao:'),
    createBullet('Chức danh vị trí của con người làm việc tại nhà máy Denso ngoài đời thực (Kỹ sư phụ trách kỹ thuật/bảo trì máy móc; Công nhân đứng máy trực ca sản xuất; Quản đốc/Trưởng nhóm phụ trách điều hành).', '• Vai trò nghiệp vụ (Business Job Roles):'),
    createBullet('Cấp độ đặc quyền tài khoản được cấp trên trang web phần mềm KaiLink. Hiện tại website chỉ phân bổ đúng 2 cấp độ: "Quyền SỬA" (Toàn quyền 9 màn) và "Quyền XEM" (Giám sát 3 màn).', '• Quyền truy cập phần mềm (System Access Permissions):')
  );

  const rolePermTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          createCell('Vai trò nghiệp vụ tại nhà máy', { isHeader: true, widthPercent: 28 }),
          createCell('Tài khoản mẫu có sẵn', { isHeader: true, widthPercent: 24 }),
          createCell('Quyền truy cập trên UI quản trị', { isHeader: true, widthPercent: 24 }),
          createCell('Phạm vi màn hình thực tế', { isHeader: true, widthPercent: 24 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Công nhân vận hành trực ca\n(Operator / Worker)', { bold: true }),
          createCell('user@denso.com\n(Mật khẩu: user123)'),
          createCell('QUYỀN XEM\n(Vận hành)', { bold: true, color: '1D4ED8' }),
          createCell('3 màn hình giám sát cốt lõi\n(Dashboard, Luồng máy, Alert)'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Kỹ sư bảo trì thiết bị\n(Maintenance Engineer)', { bold: true }),
          createCell('tech@denso.com\n(Mật khẩu: tech123)'),
          createCell('QUYỀN XEM (mặc định UI)\nhoặc CẤP QUYỀN SỬA', { bold: true, color: 'B45309' }),
          createCell('Xem giám sát; Cần quyền SỬA để chỉnh Ngưỡng & Trạm PLC'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Quản trị viên / Quản đốc xưởng\n(Factory Admin / Lead)', { bold: true }),
          createCell('admin@denso.com\n(Mật khẩu: admin123)'),
          createCell('QUYỀN SỬA\n(Quản trị)', { bold: true, color: '15803D' }),
          createCell('9 màn hình toàn diện\n(Cấu hình + Giám sát + Phân quyền)'),
        ],
      }),
    ],
  });
  elements.push(rolePermTable);

  // =========================================================================
  // PHẦN 3. CHI TIẾT MÀN HÌNH & CHỨC NĂNG THEO QUYỀN SỬA (QUẢN TRỊ — 9 MÀN HÌNH)
  // =========================================================================
  elements.push(
    createH1('PHẦN 3. CHI TIẾT MÀN HÌNH & CHỨC NĂNG THEO QUYỀN SỬA (QUẢN TRỊ — 9 MÀN HÌNH)'),
    createP('Tài khoản có "Quyền SỬA" (Admin) nắm toàn bộ thẩm quyền điều hành hệ thống. Nhãn trên bảng Quản lý Người dùng ghi chú: "9 màn — cấu hình + giám sát", bao gồm trọn vẹn các phân hệ sau:'),

    // Mục 1: Header & Nút Giả lập Sự cố
    createBullet('Thanh điều hướng trên cùng kèm nút độc quyền "Giả lập Sự cố Khẩn cấp" (ngọn lửa nhấp nháy đỏ) phục vụ diễn tập quy trình Andon.', '1. Thanh Header & Giả lập Sự cố:'),
    ...createImageBlock(
      'hinh_2_1_header_gialap_suco.png',
      540,
      47,
      'Hình 2.1. Thanh Header và Nút "Giả lập Sự cố Khẩn cấp" (Độc quyền dành riêng cho Admin)'
    ),

    // Mục 2: Dashboard Cấp 1
    createBullet('Hiển thị 4 thẻ KPI toàn xưởng, Banner báo động khẩn cấp và danh sách các thẻ chuyền sản xuất (Line Cards).', '2. Dashboard Cấp 1 (Tổng quan Nhà máy):'),
    ...createImageBlock(
      'hinh_2_2_dashboard_tong_quan.png',
      530,
      348,
      'Hình 2.2. Giao diện Dashboard Cấp 1 - Giám sát Tổng quan Toàn Nhà máy'
    ),

    // Mục 3: Luồng & Thành phần Cấp 2
    createBullet('Thanh tiến trình sản xuất, danh mục máy móc theo dây chuyền, công tắc bật/tắt giám sát máy tại chỗ, nút tạo mã QR.', '3. Luồng & Thành phần Cấp 2 (Dây chuyền & Máy):'),
    ...createImageBlock(
      'hinh_2_3_luong_thanh_phan_may.png',
      530,
      348,
      'Hình 2.3. Giao diện Luồng Dây chuyền & Danh mục Thiết bị Máy móc (Cấp 2)'
    ),

    // Mục 4: Chi tiết Component Cấp 3
    createBullet('3 thẻ đo lớn (Rung, Nhiệt, Áp), đồ thị sóng cuộn thời gian thực 60 giây, bộ lọc thời gian (1h/6h/24h) và vạch ngưỡng an toàn.', '4. Hộp thoại Chi tiết Component Cấp 3:'),
    ...createImageBlock(
      'hinh_2_4_chitiet_component_dothi.png',
      530,
      348,
      'Hình 2.4. Hộp thoại Chi tiết Thiết bị & Đồ thị Sóng Cảm biến Thời gian thực (Cấp 3)'
    ),

    // Mục 5: Tem Mã QR Máy
    createBullet('Xem hình ảnh tem QR định danh thiết bị, nút tải file ảnh SVG và nút in tem trực tiếp (Print) dán lên thân máy.', '5. Hộp thoại Tem Mã QR Máy:'),
    ...createImageBlock(
      'hinh_2_5_hopthoai_ma_qr.png',
      530,
      348,
      'Hình 2.5. Hộp thoại Tem Mã QR Định danh Thiết bị và Chức năng Tải / In Tem'
    ),

    // Mục 6: Alert Log
    createBullet('4 thẻ đếm sự cố, bộ lọc đa năng, bảng sự cố Andon, nút "Tiếp nhận" (Ack), nút "Hoàn thành" (Resolve) và nút xuất báo cáo.', '6. Nhật ký Cảnh báo & Sự cố (Alert Log & Andon):'),
    ...createImageBlock(
      'hinh_2_6_nhatky_canhbao_suco.png',
      530,
      348,
      'Hình 2.6. Giao diện Nhật ký Cảnh báo & Sự cố Andon Toàn Nhà máy (Alert Logs)'
    ),

    // Mục 7: Machine History & Export
    createBullet('Bộ lọc liên hoàn (Dây chuyền -> Máy -> Thông số -> Ca làm việc 1/2/3 -> Ngày giờ) và menu xuất file Excel (.xlsx), CSV, JSON.', '7. Lịch sử Hoạt động Máy & Xuất Dữ liệu:'),
    ...createImageBlock(
      'hinh_2_7_lichsu_xuat_dulieu.png',
      530,
      348,
      'Hình 2.7. Giao diện Tra cứu Lịch sử Hoạt động & Menu Xuất Dữ liệu Đa Định dạng (Excel, CSV, JSON)'
    ),

    // Mục 8: Thresholds & PLC
    createBullet('Quản lý thông số kết nối các trạm PLC ảo/thực, chỉnh sửa 4 giá trị ngưỡng đo an toàn (Cảnh báo & Nguy hiểm).', '8. Mapping & Cấu hình Ngưỡng (Thresholds & PLC):'),
    ...createImageBlock(
      'hinh_2_8_mapping_cauhinh_nguong.png',
      530,
      348,
      'Hình 2.8. Giao diện Mapping Cấu hình 4 Ngưỡng Cảm biến & Trạng thái Kết nối Trạm PLC'
    ),

    // Mục 9: User Management Admin
    createBullet('Độc quyền chỉ Admin nhìn thấy: Bảng danh sách tài khoản nhân viên, nút đổi quyền SỬA/XEM, bật/tắt tài khoản, đặt lại mật khẩu, tải ảnh đại diện Avatar và xóa tài khoản vĩnh viễn.', '9. Phân hệ Quản Lý Người Dùng & Phân Quyền:'),
    ...createImageBlock(
      'hinh_2_9_quanly_nguoidung_admin.png',
      530,
      348,
      'Hình 2.9. Phân hệ Quản trị Người dùng & Thiết lập Quyền SỬA / XEM cho Nhân sự'
    )
  );

  // =========================================================================
  // PHẦN 4. CHI TIẾT MÀN HÌNH & CHỨC NĂNG THEO QUYỀN XEM (VẬN HÀNH — 3 MÀN HÌNH CỐT LÕI)
  // =========================================================================
  elements.push(
    createH1('PHẦN 4. CHI TIẾT MÀN HÌNH & CHỨC NĂNG THEO QUYỀN XEM (VẬN HÀNH — 3 MÀN HÌNH CỐT LÕI)'),
    createP('Tài khoản có "Quyền XEM" (Đội Vận hành / Công nhân) được thiết kế tinh giản, loại bỏ hoàn toàn các khu vực cấu hình nhạy cảm. Nhãn trên bảng Quản lý Người dùng ghi chú: "3 màn — chỉ giám sát", tập trung vào 3 khu vực nghiệp vụ cốt lõi:'),
    createH2('4.1. Ba Phân Hệ Giám Sát Cốt Lõi Được Thao Tác'),

    // Mục 1: Dashboard Cấp 1 (Operator)
    createBullet('Theo dõi chỉ số an toàn toàn xưởng (%), tình trạng các dây chuyền và tiếp nhận cảnh báo máy dừng trên banner đỏ.', '1. Màn hình Dashboard Tổng quan (Cấp 1):'),
    ...createImageBlock(
      'hinh_3_1_operator_dashboard.png',
      530,
      348,
      'Hình 3.1. Giao diện Dashboard Tổng quan dưới góc nhìn Công nhân Vận hành (Huy hiệu OPERATOR, Ẩn nút Giả lập Sự cố)'
    ),

    // Mục 2: Luồng & Chi tiết Máy (Operator)
    createBullet('Theo dõi danh mục máy móc, trạng thái hoạt động thực tế và mở xem đồ thị dao động cảm biến sóng cuộn 60 giây.', '2. Màn hình Luồng & Chi tiết Máy (Cấp 2 & Cấp 3):'),
    ...createImageBlock(
      'hinh_3_2_operator_lines.png',
      530,
      348,
      'Hình 3.2. Màn hình Luồng & Chi tiết Máy của Tài khoản Vận hành (Chỉ có quyền theo dõi)'
    ),

    // Mục 3: Cảnh báo Sự cố & Tiếp nhận Andon (Operator)
    createBullet('Theo dõi danh sách sự cố Andon phát sinh. Khi có chuông còi báo động, công nhân bấm nút "Tiếp nhận" (Acknowledge) để tắt chuông và xác nhận xử lý hiện trường. Đồng thời được phép tra cứu lịch sử và tải file xuất dữ liệu máy.', '3. Màn hình Cảnh Báo Sự Cố & Lịch Sử Hoạt Động:'),
    ...createImageBlock(
      'hinh_3_3_operator_alarms_history.png',
      530,
      348,
      'Hình 3.3. Màn hình Nhật ký Sự cố Andon của Công nhân (Sẵn sàng thao tác nút "Tiếp nhận" khi có báo động)'
    ),

    createH2('4.2. Các Khu Vực Bị Khóa / Chặn Hoàn Toàn Đối Với Quyền XEM'),
    createP('Để đảm bảo an toàn tuyệt đối cho nhà máy, các phân hệ sau bị ẩn khỏi thanh Menu của người có Quyền XEM, nếu cố tình truy cập sẽ bị chặn bằng màn hình cảnh báo lỗi 403 Forbidden:'),
    createBullet('Người có Quyền XEM không có nút "Giả lập Sự cố" trên Header. Không thể tùy tiện kích hoạt báo động giả trong xưởng.', '• Nút Giả lập Sự cố:'),
    createBullet('Bị ẩn khỏi Menu bên trái. Nếu bấm nút "Cấu hình ngưỡng" từ màn hình máy, hệ thống báo lỗi 403: "Không Đủ Quyền Truy Cập - Tài khoản nhân viên vận hành không có quyền thay đổi thông số kỹ thuật và cấu hình trạm PLC".', '• Phân hệ Mapping & Cấu hình Ngưỡng:'),
    createBullet('Bị ẩn hoàn toàn khỏi Menu bên trái. Khi truy cập, hệ thống chặn với thông báo: "Nhật Ký Kiểm Toán Bị Khóa - Yêu cầu tài khoản Quản trị viên hoặc Kỹ thuật bảo trì".', '• Phân hệ Nhật ký Kiểm toán (Audit Logs):'),
    createBullet('Bị ẩn hoàn toàn khỏi Menu bên trái. Không thể xem danh sách nhân sự, không thể phân quyền hay can thiệp tài khoản.', '• Phân hệ Quản lý Người dùng:')
  );

  // =========================================================================
  // PHẦN 5. PHÂN BỔ QUYỀN HẠN THỰC TẾ CHO KỸ SƯ VÀ CÔNG NHÂN
  // =========================================================================
  elements.push(
    createH1('PHẦN 5. PHÂN BỔ QUYỀN HẠN THỰC TẾ CHO KỸ SƯ VÀ CÔNG NHÂN'),
    createP('Dựa trên cấu trúc 2 loại quyền truy cập hiện có trên website, việc phân bổ tài khoản cho Kỹ sư và Công nhân trong nhà máy được làm rõ như sau:'),
    createH2('5.1. Vị Trí Của Công Nhân Vận Hành (Operator)'),
    createBullet('Tài khoản: user@denso.com (hoặc các tài khoản công nhân do Admin tạo mới).', '•'),
    createBullet('Quyền truy cập trên UI: Ánh xạ 100% vào QUYỀN XEM (Vận hành).', '•'),
    createBullet('Trách nhiệm trên website: Giám sát máy trong ca làm việc, nhận diện đèn còi Andon, bấm nút "Tiếp nhận" (Ack) để chuyển trạng thái sự cố sang Đang xử lý, tra cứu lịch sử đo.', '•'),
    createBullet('Giới hạn: Tuyệt đối không can thiệp vào ngưỡng an toàn cảm biến và cấu hình trạm PLC.', '•'),
    createH2('5.2. Vị Trí Của Kỹ Sư Kỹ Thuật / Bảo Trì (Maintenance)'),
    createBullet('Tài khoản: tech@denso.com.', '•'),
    createBullet('Thực trạng trên UI hiện tại: Nếu để mặc định trong trang Quản Lý Người Dùng, tài khoản Kỹ sư bị tính vào nhóm Quyền XEM (vì u.role !== "ADMIN"). Khi đó Kỹ sư chỉ có thể xem giám sát và nghiệm thu sự cố.', '•'),
    createBullet('Giải pháp phân quyền thực tế: Trong hoạt động nhà xưởng, Kỹ sư là người có chuyên môn trực tiếp điều chỉnh ngưỡng kỹ thuật và kiểm tra đường truyền PLC. Do website hiện chỉ có 2 mức quyền (SỬA và XEM), để Kỹ sư thực hiện được việc chỉnh ngưỡng và kết nối trạm PLC trên giao diện web, Quản trị viên cần CẤP QUYỀN SỬA cho tài khoản Kỹ sư.', '•'),
    createBullet('Lưu ý bảo mật: Nếu được cấp Quyền SỬA, Kỹ sư sẽ có quyền truy cập vào cả trang Quản lý Người dùng. Trong tương lai, khuyến nghị nhóm phát triển bổ sung thêm tùy chọn quyền thứ 3 trên UI: "BẢO TRÌ (Kỹ sư)" để Kỹ sư có quyền chỉnh ngưỡng nhưng không có quyền xóa/sửa tài khoản nhân sự.', '•')
  );

  // =========================================================================
  // PHẦN 6. BẢNG MA TRẬN ĐỐI CHIẾU QUYỀN HẠN VÀ THAO TÁC CHI TIẾT
  // =========================================================================
  elements.push(
    createH1('PHẦN 6. BẢNG MA TRẬN ĐỐI CHIẾU QUYỀN HẠN VÀ THAO TÁC CHI TIẾT'),
    createP('Bảng dưới đây đối chiếu chi tiết giữa 2 loại Quyền trên giao diện (SỬA vs XEM) và quyền hạn thực tế của từng vai trò nghiệp vụ:'),
    createH2('6.1. Bảng Ma Trận Quyền Hạn Thực Tế Trên Website')
  );

  const matrixTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          createCell('Chức năng thao tác trên Website', { isHeader: true, widthPercent: 34 }),
          createCell('Quyền XEM\n(Công nhân vận hành)', { isHeader: true, widthPercent: 22 }),
          createCell('Kỹ sư bảo trì\n(Nghiệp vụ thực tế)', { isHeader: true, widthPercent: 22 }),
          createCell('Quyền SỬA\n(Quản trị viên)', { isHeader: true, widthPercent: 22 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Đăng nhập tài khoản & Chọn chế độ sáng/tối', { bold: true }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Bật/Tắt luồng truyền dữ liệu thời gian thực', { bold: true }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Bấm nút "Giả lập Sự cố Khẩn cấp"', { bold: true }),
          createCell('Không (Không có nút)', { bold: true, color: 'B91C1C' }),
          createCell('Không (Không có nút)', { bold: true, color: 'B91C1C' }),
          createCell('Có (Độc quyền Admin)', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Xem Dashboard Tổng quan Cấp 1', { bold: true }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Xem Danh mục Máy & Đồ thị sóng 60s Cấp 3', { bold: true }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Tải và In tem Mã QR thiết bị dán máy', { bold: true }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Bấm nút "Tiếp nhận" sự cố Andon (Ack)', { bold: true }),
          createCell('Có (Thao tác chính)', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Bấm "Hoàn thành" & Nhập biên bản nghiệm thu', { bold: true }),
          createCell('Có nút (nhưng thuộc vai trò Kỹ sư)', { color: 'B45309' }),
          createCell('Có (Thao tác chính)', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Tra cứu & Xuất Lịch sử máy (Excel/CSV/JSON)', { bold: true }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Truy cập trang "Mapping & Cấu hình Ngưỡng"', { bold: true }),
          createCell('Không (Bị chặn 403)', { bold: true, color: 'B91C1C' }),
          createCell('Cần quyền SỬA (hoặc role MT)', { bold: true, color: 'B45309' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Chỉnh sửa 4 giá trị ngưỡng đo & trạm PLC', { bold: true }),
          createCell('Không (Bị khóa)', { bold: true, color: 'B91C1C' }),
          createCell('Cần quyền SỬA', { bold: true, color: 'B45309' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Truy cập xem "Nhật ký Kiểm toán" (Audit Logs)', { bold: true }),
          createCell('Không (Bị chặn 403)', { bold: true, color: 'B91C1C' }),
          createCell('Cần quyền SỬA (hoặc role MT)', { bold: true, color: 'B45309' }),
          createCell('Có', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Truy cập "Quản lý Người dùng & Phân quyền"', { bold: true }),
          createCell('Không (Bị ẩn & Chặn 403)', { bold: true, color: 'B91C1C' }),
          createCell('Không (Nếu là role MT)', { bold: true, color: 'B91C1C' }),
          createCell('Có (Độc quyền Admin)', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Thêm, Sửa, Đổi quyền SỬA/XEM, Xóa tài khoản', { bold: true }),
          createCell('Không', { bold: true, color: 'B91C1C' }),
          createCell('Không', { bold: true, color: 'B91C1C' }),
          createCell('Có (Độc quyền Admin)', { bold: true, color: '15803D' }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Tải lên ảnh đại diện nhân viên (Avatar)', { bold: true }),
          createCell('Không', { bold: true, color: 'B91C1C' }),
          createCell('Không', { bold: true, color: 'B91C1C' }),
          createCell('Có (Độc quyền Admin)', { bold: true, color: '15803D' }),
        ],
      }),
    ],
  });
  elements.push(matrixTable);

  // =========================================================================
  // PHẦN 7. KẾT LUẬN & TRẢ LỜI CÁC CÂU HỎI TRỌNG TÂM
  // =========================================================================
  elements.push(
    createH1('PHẦN 7. KẾT LUẬN & TRẢ LỜI CÁC CÂU HỎI TRỌNG TÂM'),
    createP('Để phục vụ báo cáo ngắn gọn, chuẩn xác với Trưởng nhóm, dưới đây là câu trả lời trực diện cho 4 câu hỏi cốt lõi:'),
    createH2('7.1. Website hiện có bao nhiêu loại tài khoản đăng nhập?'),
    createP('Thực tế có 3 TÀI KHOẢN ĐĂNG NHẬP MẪU đã được tạo sẵn trong cơ sở dữ liệu và hoạt động trơn tru:'),
    createBullet('Tài khoản Quản trị toàn hệ thống (admin@denso.com / admin123) — Mã NV: DNS-1001.', '1. Tài khoản Admin:'),
    createBullet('Tài khoản Công nhân trực ca vận hành (user@denso.com / user123) — Mã NV: DNS-1024.', '2. Tài khoản Operator:'),
    createBullet('Tài khoản Kỹ thuật viên bảo trì thiết bị (tech@denso.com / tech123) — Mã NV: DNS-1088.', '3. Tài khoản Maintenance:'),
    createP('Lưu ý trên giao diện: Tại hộp thoại Đăng nhập, hệ thống hiển thị 2 NÚT BẤM ĐĂNG NHẬP NHANH tiện ích cho buổi demo: Nút ADMIN và Nút OPERATOR.'),
    createH2('7.2. Website có bao nhiêu loại quyền truy cập trên giao diện quản trị?'),
    createP('Trên giao diện Quản Lý Người Dùng & Phân Quyền, hệ thống quy chuẩn thành ĐÚNG 2 LOẠI QUYỀN TRUY CẬP CHÍNH THỨC:'),
    createBullet('Truy cập toàn bộ 9 màn hình cấu hình và giám sát. Thống kê hiển thị trên thẻ Top-Card 2 "Quyền SỬA (Admin)".', '1. QUYỀN SỬA (Quản trị):'),
    createBullet('Giới hạn truy cập 3 màn hình giám sát cơ bản. Thống kê hiển thị trên thẻ Top-Card 3 "Quyền XEM (Operator)".', '2. QUYỀN XEM (Vận hành):'),
    createH2('7.3. Kỹ sư tương ứng với quyền nào?'),
    createP('• Về mặt nghiệp vụ: Kỹ sư cần thực hiện chẩn đoán rung nhiệt, nghiệm thu đóng sự cố, hiệu chỉnh 4 ngưỡng an toàn cảm biến và bật/tắt trạm PLC.'),
    createP('• Về mặt giao diện hiện tại: Vì giao diện chỉ có 2 mức quyền SỬA và XEM, tài khoản Kỹ sư nếu để mặc định sẽ bị xếp vào nhóm Quyền XEM (bị chặn vào trang Cấu hình Ngưỡng). Do đó, để Kỹ sư thực hiện được đầy đủ chức năng nghiệp vụ của mình trên website, Kỹ sư cần được cấp QUYỀN SỬA.'),
    createH2('7.4. Công nhân tương ứng với quyền nào?'),
    createP('• Công nhân vận hành tương ứng 100% với QUYỀN XEM (Vận hành).'),
    createP('• Công nhân chỉ thực hiện nhiệm vụ giám sát trực quan dây chuyền trong ca kíp, nhận diện chuông còi Andon, bấm nút "Tiếp nhận" (Acknowledge) khi xảy ra sự cố và tra cứu/xuất lịch sử máy, hoàn toàn bị chặn khỏi các phân hệ cấu hình kỹ thuật.')
  );

  return elements;
}

async function run() {
  console.log('=== BẮT ĐẦU TẠO FILE BÁO CÁO CÓ HÌNH ẢNH: Thong_Ke_Giao_Dien_Chuc_Nang_DENSO_Co_Hinh_Anh.docx ===');

  const elements = buildDocument();

  const defaultHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: 'DENSO INDUSTRIAL IoT (KaiLink) | BÁO CÁO GIAO DIỆN & PHÂN QUYỀN CÓ MINH HỌA ẢNH THỰC TẾ',
            font: 'Times New Roman',
            size: 18,
            color: '64748B',
            italics: true,
          }),
        ],
      }),
    ],
  });

  const defaultFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: 'Báo cáo kiểm thử & đối chiếu trực quan website - Dự án KaiLink               ',
            font: 'Times New Roman',
            size: 18,
            color: '64748B',
          }),
          new TextRun({
            text: 'Trang ',
            font: 'Times New Roman',
            size: 18,
            color: '64748B',
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Times New Roman',
            size: 18,
            bold: true,
            color: '003366',
          }),
          new TextRun({
            text: ' / ',
            font: 'Times New Roman',
            size: 18,
            color: '64748B',
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: 'Times New Roman',
            size: 18,
            bold: true,
            color: '003366',
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: 'Business Analyst & Software Tester',
    title: 'Báo cáo Thống kê Giao diện và Hệ thống Phân quyền DENSO IoT Monitoring (Bản có hình ảnh minh họa)',
    description: 'Báo cáo đối chiếu thực tế giữa 2 loại quyền truy cập trên UI (SỬA vs XEM), các tài khoản đăng nhập mẫu và ảnh chụp màn hình trực tiếp từ website đang hoạt động.',
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1150, bottom: 1150, left: 1150, right: 1150 },
          },
        },
        headers: { default: defaultHeader },
        footers: { default: defaultFooter },
        children: elements,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  // Ghi file tại thư mục gốc
  fs.writeFileSync(outDocxPath, buffer);
  console.log(`[OK] Đã xuất file Word có hình ảnh thành công tại: ${outDocxPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  // Sao lưu 1 bản vào docs/ba/
  if (fs.existsSync(path.dirname(outDocxBaPath))) {
    fs.writeFileSync(outDocxBaPath, buffer);
    console.log(`[OK] Đã sao lưu 1 bản vào: ${outDocxBaPath}`);
  }
}

run().catch((err) => {
  console.error('Lỗi tạo file Word:', err);
  process.exit(1);
});
