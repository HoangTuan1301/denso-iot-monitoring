/**
 * @file scripts/generate_ba_doc.js
 * @description Master script tạo tài liệu Word DENSO_IoT_Monitoring_BA_Documentation.docx
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
  WidthType,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ImageRun,
  PageBreak,
} from 'docx';

import {
  createPara,
  createH1,
  createH2,
  createCell,
  thinBorders,
  logoPath,
} from './generate_ba_doc_helpers.js';

import { getPart1Elements } from './generate_ba_doc_content_part1.js';
import { getPart2Elements } from './generate_ba_doc_content_part2.js';
import { getPart3Elements } from './generate_ba_doc_content_part3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'docs', 'ba', 'DENSO_IoT_Monitoring_BA_Documentation.docx');

async function buildDocument() {
  console.log('Đang biên dịch nội dung tài liệu BA sang định dạng Word .docx...');

  const children = [];

  // =========================================================================
  // TRANG BÌA (COVER PAGE)
  // =========================================================================
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      children.push(
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
      console.warn('Bỏ qua chèn logo bìa:', e.message);
    }
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 120 },
      children: [
        new TextRun({
          text: 'TẬP ĐOÀN SẢN XUẤT CÔNG NGHỆ CAO DENSO',
          font: 'Times New Roman',
          size: 28, // 14pt
          bold: true,
          color: '003366',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 400 },
      children: [
        new TextRun({
          text: 'KHỐI CÔNG NGHỆ THÔNG TIN & TỰ ĐỘNG HÓA NHÀ MÁY (IT/OT DIVISION)',
          font: 'Times New Roman',
          size: 22,
          bold: true,
          color: '505050',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 180 },
      children: [
        new TextRun({
          text: 'TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ & PHÂN TÍCH HỆ THỐNG',
          font: 'Times New Roman',
          size: 38, // 19pt
          bold: true,
          color: '003366',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 160 },
      children: [
        new TextRun({
          text: '(BUSINESS ANALYSIS & REQUIREMENTS SPECIFICATION)',
          font: 'Times New Roman',
          size: 24,
          bold: true,
          color: 'CC0000', // DENSO Red
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 600 },
      children: [
        new TextRun({
          text: 'DỰ ÁN: HỆ THỐNG GIÁM SÁT THỜI GIAN THỰC THIẾT BỊ & DÂY CHUYỀN SẢN XUẤT IIoT (DENSO KAILINK)',
          font: 'Times New Roman',
          size: 26, // 13pt
          bold: true,
          color: '202020',
        }),
      ],
    })
  );

  // Bảng thông tin thuộc tính tài liệu trang bìa
  const metaRows = [
    new TableRow({
      children: [
        createCell('Mã Dự Án / Repository', { bold: true, widthPercent: 35 }),
        createCell('denso-iot-monitoring (KaiLink)', { widthPercent: 65 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('Mã Tài Liệu', { bold: true }),
        createCell('BA-DENSO-IOT-2026-DOCX-V1.0'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Chuyên Viên Phân Tích (BA)', { bold: true }),
        createCell('Senior Business Analyst (10+ năm kinh nghiệm IIoT & Smart Factory)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Nhánh Mã Nguồn Đối Chiếu', { bold: true }),
        createCell('feature/web-log-export (Commit Hash: 8ac31eab)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Ngày Ban Hành', { bold: true }),
        createCell('Tháng 10/2026 (DENSO Hackathon 2026 Production Baseline)'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Đối Tượng Tiếp Nhận', { bold: true }),
        createCell('Hội Đồng Đánh Giá Kỹ Thuật, Ban Quản Lý Dự Án & Đội Ngũ Phát Triển'),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metaRows,
      borders: thinBorders,
    })
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // TRANG LỊCH SỬ PHIÊN BẢN TÀI LIỆU
  // =========================================================================
  children.push(createH1('LỊCH SỬ PHIÊN BẢN TÀI LIỆU (DOCUMENT REVISION HISTORY)'));

  const revRows = [
    new TableRow({
      children: [
        createCell('Phiên Bản', { isHeader: true, widthPercent: 12 }),
        createCell('Ngày Lập', { isHeader: true, widthPercent: 16 }),
        createCell('Tác Giả', { isHeader: true, widthPercent: 22 }),
        createCell('Mô Tả Thay Đổi & Cập Nhật Nghiệp Vụ', { isHeader: true, widthPercent: 35 }),
        createCell('Trạng Thái', { isHeader: true, widthPercent: 15 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('v0.1', { bold: true }),
        createCell('06/10/2026'),
        createCell('Development Team'),
        createCell('Bản dự thảo khảo sát sơ bộ SRS kiến trúc ban đầu.'),
        createCell('Bản nháp'),
      ],
    }),
    new TableRow({
      children: [
        createCell('v0.5', { bold: true }),
        createCell('15/10/2026'),
        createCell('Technical Lead'),
        createCell('Cập nhật nghiệm thu phân hệ Lịch sử hoạt động máy & Động cơ xuất Excel/CSV/JSON.'),
        createCell('Đã duyệt'),
      ],
    }),
    new TableRow({
      children: [
        createCell('v1.0', { bold: true }),
        createCell('22/10/2026'),
        createCell('Senior Business Analyst'),
        createCell('Hoàn thiện toàn diện 10 chương tài liệu đặc tả nghiệp vụ BA: 21 FRs, 15 BRs, 10 Use Cases, RTM và Data Dictionary đối chiếu 100% mã nguồn.'),
        createCell('Chính thức (Baseline)'),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: revRows,
      borders: thinBorders,
    })
  );

  children.push(createPara(' '));
  children.push(createH2('Bảng Phê Duyệt Ký Tên (Sign-off Matrix)'));

  const signRows = [
    new TableRow({
      children: [
        createCell('Vai Trò', { isHeader: true, widthPercent: 25 }),
        createCell('Họ và Tên', { isHeader: true, widthPercent: 30 }),
        createCell('Chức Vụ / Đơn Vị', { isHeader: true, widthPercent: 30 }),
        createCell('Chữ Ký / Xác Nhận', { isHeader: true, widthPercent: 15 }),
      ],
    }),
    new TableRow({
      children: [
        createCell('Người lập tài liệu (BA)', { bold: true }),
        createCell('Hoàng Minh Hải'),
        createCell('Senior Business Analyst'),
        createCell('Đã ký'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Người rà soát kỹ thuật', { bold: true }),
        createCell('Lê Văn Bách'),
        createCell('Lead Automation Engineer'),
        createCell('Đã ký'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Đại diện Vận hành Sản xuất', { bold: true }),
        createCell('Trần Quang Huy'),
        createCell('Production Supervisor'),
        createCell('Đã ký'),
      ],
    }),
    new TableRow({
      children: [
        createCell('Phê duyệt dự án', { bold: true }),
        createCell('Hội Đồng Kỹ Thuật DENSO'),
        createCell('Ban Tổ Chức Hackathon 2026'),
        createCell('Chờ phê duyệt'),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: signRows,
      borders: thinBorders,
    })
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // MỤC LỤC TỔNG QUAN
  // =========================================================================
  children.push(createH1('MỤC LỤC TÀI LIỆU (TABLE OF CONTENTS)'));
  children.push(
    createPara(
      'CHƯƠNG 1: GIỚI THIỆU DỰ ÁN ........................................................................................................ 4\n' +
      '  1.1. Tổng quan dự án ............................................................................................................................. 4\n' +
      '  1.2. Bối cảnh và bài toán nghiệp vụ ....................................................................................................... 4\n' +
      '  1.3. Mục tiêu xây dựng hệ thống ............................................................................................................ 5\n' +
      '  1.4. Giá trị nghiệp vụ dự kiến ................................................................................................................. 5\n' +
      '  1.5. Phạm vi dự án ................................................................................................................................... 5\n' +
      '  1.6. Thuật ngữ và định nghĩa chuyên ngành ........................................................................................ 6\n\n' +
      'CHƯƠNG 2: PHÂN TÍCH CÁC BÊN LIÊN QUAN & MÔ HÌNH PHÂN QUYỀN ................................ 7\n' +
      '  2.1. Xác định các bên liên quan (Stakeholders) .................................................................................... 7\n' +
      '  2.2. Các nhóm người dùng và vai trò thực tế trong hệ thống ............................................................... 7\n' +
      '  2.3. Ma trận phân quyền truy cập chức năng (Permission Matrix) ...................................................... 8\n' +
      '  2.4. Phân tích điểm chưa đồng bộ giữa Frontend và Backend ............................................................ 9\n\n' +
      'CHƯƠNG 3: PHÂN TÍCH QUY TRÌNH NGHIỆP VỤ ........................................................................ 10\n' +
      '  3.1. Bài toán giám sát thiết bị nhà máy công nghiệp .......................................................................... 10\n' +
      '  3.2. Quy trình hiện tại (AS-IS) - Giám sát thủ công .......................................................................... 10\n' +
      '  3.3. Quy trình đề xuất (TO-BE) - Giám sát IIoT thông minh .............................................................. 10\n' +
      '  3.4. Luồng dữ liệu cảm biến thời gian thực (Data Pipeline) ............................................................... 11\n' +
      '  3.5. Quy trình xử lý sự cố 3 bước (Alarm Lifecycle Workflow) ......................................................... 11\n' +
      '  3.6. Hệ thống Quy tắc Nghiệp vụ Cốt lõi (Business Rules BR-01 đến BR-15) ................................. 12\n\n' +
      'CHƯƠNG 4: ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS) ...................... 14\n' +
      '  4.1. Bảng tổng hợp yêu cầu chức năng (FR-001 đến FR-021) ............................................................ 14\n' +
      '  4.2. Đặc tả chi tiết các phân hệ chức năng trọng yếu ........................................................................ 16\n\n' +
      'CHƯƠNG 5: USE CASE SPECIFICATION ............................................................................................ 19\n' +
      '  5.1. Danh sách Use Case tổng quan (UC-01 đến UC-10) .................................................................... 19\n' +
      '  5.2. Đặc tả chi tiết Use Case trọng yếu UC-09: Truy vấn Lịch sử Máy & Xuất Báo Cáo .............. 20\n\n' +
      'CHƯƠNG 6: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS) .................... 22\n' +
      '  6.1. Bảo mật hệ thống (Security) ........................................................................................................... 22\n' +
      '  6.2. Hiệu năng & Tối ưu hóa xử lý (Performance) ............................................................................. 22\n' +
      '  6.3. Tính sẵn sàng & Chống sập (Availability & Fault Tolerance) ..................................................... 23\n' +
      '  6.4. Tính toàn vẹn dữ liệu (Data Integrity) .......................................................................................... 23\n' +
      '  6.5. Trải nghiệm người dùng & Khả năng tương thích ....................................................................... 24\n\n' +
      'CHƯƠNG 7: PHÂN TÍCH & THIẾT KẾ DỮ LIỆU (DATA MODELING) .......................................... 25\n' +
      '  7.1. Tổng quan cấu trúc dữ liệu hệ thống ........................................................................................... 25\n' +
      '  7.2. Từ điển dữ liệu chi tiết (Data Dictionary 6 bảng MySQL) .......................................................... 25\n\n' +
      'CHƯƠNG 8: ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG (UI/UX SPECIFICATION) ................................ 30\n' +
      '  8.1. Đặc tả màn hình Luồng & Thành phần Máy móc (Tier 2) kèm hình ảnh thực tế ..................... 30\n' +
      '  8.2. Đặc tả Modal Chi tiết Chỉ số & Biểu đồ Tầng 3 kèm hình ảnh thực tế ...................................... 31\n' +
      '  8.3. Đặc tả màn hình Lịch sử Hoạt động Máy & Xuất Dữ liệu ........................................................... 32\n\n' +
      'CHƯƠNG 9: KIỂM THỬ NGHIỆP VỤ & MA TRẬN TRUY VẾT YÊU CẦU (RTM) ......................... 33\n' +
      '  9.1. Ma trận Truy Vết Yêu Cầu (Requirement Traceability Matrix - RTM) ...................................... 33\n' +
      '  9.2. Những nội dung chưa thể xác minh trong phòng Lab ................................................................. 35\n\n' +
      'CHƯƠNG 10: ĐÁNH GIÁ TỔNG THỂ & LỘ TRÌNH PHÁT TRIỂN (ROADMAP) ........................... 36\n' +
      '  10.1. Tổng hợp các chức năng đã hoàn thành và sẵn sàng vận hành ................................................ 36\n' +
      '  10.2. Các vấn đề kỹ thuật cần khắc phục trong Sprint tới ................................................................. 36\n' +
      '  10.3. Lộ trình nâng cấp hệ thống theo 3 giai đoạn (Roadmap) ........................................................... 37\n' +
      '  10.4. Kết luận của Chuyên viên Phân tích Nghiệp vụ (Senior BA) ................................................... 37'
    )
  );

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // GHÉP TOÀN BỘ 10 CHƯƠNG TỪ 3 PART
  // =========================================================================
  console.log('Nạp nội dung Phần 1 (Chương 1, 2, 3)...');
  children.push(...getPart1Elements());

  console.log('Nạp nội dung Phần 2 (Chương 4, 5, 6)...');
  children.push(...getPart2Elements());

  console.log('Nạp nội dung Phần 3 (Chương 7, 8, 9, 10)...');
  children.push(...getPart3Elements());

  // =========================================================================
  // TẠO ĐỐI TƯỢNG DOCUMENT VỚI CẤU HÌNH SECTION CHUẨN
  // =========================================================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width in twips (210mm)
              height: 16838, // A4 height in twips (297mm)
            },
            margin: {
              top: 1417, // 2.5 cm (1417 twips)
              bottom: 1417, // 2.5 cm (1417 twips)
              left: 1701, // 3.0 cm (1701 twips)
              right: 1134, // 2.0 cm (1134 twips)
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: 'DENSO Industrial IoT Monitoring System | Tài Liệu Nghiệp Vụ BA (v1.0)',
                    font: 'Times New Roman',
                    size: 18, // 9pt
                    italics: true,
                    color: '707070',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 120 },
                children: [
                  new TextRun({
                    text: 'Bảo mật nội bộ - DENSO Manufacturing Vietnam',
                    font: 'Times New Roman',
                    size: 18,
                    color: '707070',
                  }),
                  new TextRun({
                    text: '\t\tTrang ',
                    font: 'Times New Roman',
                    size: 18,
                    color: '707070',
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
                    color: '707070',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: 'Times New Roman',
                    size: 18,
                    color: '707070',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  console.log(`Đang ghi file ra đĩa: ${outputPath}...`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Xuất tài liệu thành công! Kích thước file: ${buffer.length} bytes.`);
}

buildDocument().catch((err) => {
  console.error('❌ Lỗi tạo tài liệu Word:', err);
  process.exit(1);
});
