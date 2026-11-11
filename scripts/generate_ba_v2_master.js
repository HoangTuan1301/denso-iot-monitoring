/**
 * @file scripts/generate_ba_v2_master.js
 * @description Master script to assemble and generate DENSO IoT Monitoring BA Documentation v2.1
 * Target: docs/ba/DENSO_IoT_Monitoring_BA_Documentation_v2.1.docx
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jszip from 'jszip';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  PageBreak,
  HeadingLevel,
} from 'docx';

import { getV2Part1Elements } from './generate_ba_v2_part1.js';
import { getV2Part2Elements } from './generate_ba_v2_part2.js';
import { getV2Part3Elements } from './generate_ba_v2_part3.js';
import { getV2Part4Elements } from './generate_ba_v2_part4.js';
import { getV2Part5Elements } from './generate_ba_v2_part5.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function generateCompleteDocx() {
  console.log('=== BẮT ĐẦU TẠO TÀI LIỆU BA V2.1 HOÀN CHỈNH CHO DENSO KAILINK ===');

  const part1 = getV2Part1Elements();
  console.log(`[OK] Đã nạp Phần 1 (Bìa, Lịch sử v2.1, TOC động OpenXML, Chương 1, 2, 3): ${part1.length} phần tử`);

  const part2 = getV2Part2Elements();
  console.log(`[OK] Đã nạp Phần 2 (Chương 4 - 21 Yêu cầu chức năng FR-001..021): ${part2.length} phần tử`);

  const part3 = getV2Part3Elements();
  console.log(`[OK] Đã nạp Phần 3 (Chương 5 - 10 Ca sử dụng UC-01..10, Chương 6 - NFRs): ${part3.length} phần tử`);

  const part4 = getV2Part4Elements();
  console.log(`[OK] Đã nạp Phần 4 (Chương 7 - ERD/DFD/Dictionary, Chương 8 - 10 Màn hình UI): ${part4.length} phần tử`);

  const part5 = getV2Part5Elements();
  console.log(`[OK] Đã nạp Phần 5 (Chương 9 - RTM, 25 Test Cases, Chương 10 - Roadmap): ${part5.length} phần tử`);

  // Ghép các phần tử với ngắt trang giữa các chương
  const allChildren = [
    ...part1,
    new Paragraph({ children: [new PageBreak()] }),
    ...part2,
    new Paragraph({ children: [new PageBreak()] }),
    ...part3,
    new Paragraph({ children: [new PageBreak()] }),
    ...part4,
    new Paragraph({ children: [new PageBreak()] }),
    ...part5,
  ];

  console.log(`[Tổng hợp] Tổng số phần tử văn bản trong tài liệu: ${allChildren.length}`);

  // Header & Footer
  const defaultHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: 'HỆ THỐNG GIÁM SÁT IoT NHÀ MÁY DENSO (KaiLink) | ĐẶC TẢ NGHIỆP VỤ BA v2.1',
            font: 'Times New Roman',
            size: 18, // 9pt
            color: '718096',
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
            text: 'Mã tài liệu: DENSO-BA-DOC-v2.1 | Lưu hành nội bộ dự án KaiLink                    ',
            font: 'Times New Roman',
            size: 18, // 9pt
            color: '718096',
          }),
          new TextRun({
            text: 'Trang ',
            font: 'Times New Roman',
            size: 18, // 9pt
            color: '718096',
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
            color: '718096',
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
    creator: 'Senior Business Analyst & Solution Architect (Google Antigravity)',
    title: 'Đặc Tả Yêu Cầu Nghiệp Vụ - Hệ Thống Giám Sát IoT Nhà Máy DENSO (KaiLink) v2.1',
    description: 'Tài liệu phân tích nghiệp vụ, kiến trúc dữ liệu và đặc tả yêu cầu phần mềm phiên bản 2.1 có Table of Contents động OpenXML.',
    features: {
      updateFields: true,
    },
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Times New Roman',
            size: 32, // 16pt
            bold: true,
            color: '003366',
          },
          paragraph: {
            spacing: { before: 360, after: 160 },
            heading: HeadingLevel.HEADING_1,
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Times New Roman',
            size: 28, // 14pt
            bold: true,
            color: '004080',
          },
          paragraph: {
            spacing: { before: 260, after: 120 },
            heading: HeadingLevel.HEADING_2,
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Times New Roman',
            size: 26, // 13pt
            bold: true,
            italics: true,
            color: '1A365D',
          },
          paragraph: {
            spacing: { before: 180, after: 80 },
            heading: HeadingLevel.HEADING_3,
          },
        },
        {
          id: 'TOC1',
          name: 'toc 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Times New Roman',
            size: 26, // 13pt
            bold: true,
            color: '003366',
          },
          paragraph: {
            spacing: { line: 276, before: 60, after: 60 },
          },
        },
        {
          id: 'TOC2',
          name: 'toc 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Times New Roman',
            size: 24, // 12pt
            color: '2D3748',
          },
          paragraph: {
            spacing: { line: 276, before: 30, after: 30 },
            indent: { left: 280 },
          },
        },
        {
          id: 'TOC3',
          name: 'toc 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Times New Roman',
            size: 22, // 11pt
            color: '4A5568',
          },
          paragraph: {
            spacing: { line: 276, before: 20, after: 20 },
            indent: { left: 560 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,  // 210mm (A4)
              height: 16838, // 297mm (A4)
            },
            margin: {
              top: 1417,     // 2.5 cm
              bottom: 1417,  // 2.5 cm
              left: 1701,    // 3.0 cm
              right: 1134,   // 2.0 cm
            },
          },
        },
        headers: {
          default: defaultHeader,
        },
        footers: {
          default: defaultFooter,
        },
        children: allChildren,
      },
    ],
  });

  const outputPath = path.resolve(rootDir, 'docs', 'ba', 'DENSO_IoT_Monitoring_BA_Documentation_v2.1.docx');
  console.log(`[Đang xuất file] Đường dẫn file đầu ra: ${outputPath}`);

  const rawBuffer = await Packer.toBuffer(doc);

  // Post-processing bằng JSZip để chuẩn hóa tuyệt đối trường TOC OpenXML
  console.log('[Hậu xử lý OpenXML] Đang tối ưu hóa cấu trúc trường Table of Contents...');
  const zip = await jszip.loadAsync(rawBuffer);

  // 1. Kiểm tra và tối ưu word/document.xml
  let docXml = await zip.file('word/document.xml').async('text');

  // Đảm bảo lệnh TOC chuẩn xác: TOC \o "1-3" \h \z \u
  docXml = docXml.replace(/TOC \\h \\o &quot;1-3&quot;/g, 'TOC \\o &quot;1-3&quot; \\h \\z \\u');
  docXml = docXml.replace(/TOC \\o &quot;1-3&quot; \\h/g, 'TOC \\o &quot;1-3&quot; \\h \\z \\u');

  // Chuẩn hóa vị trí tab căn phải số trang khớp chính xác lề phải 2.0cm (9071 twips) và dấu chấm dẫn dot leader
  docXml = docXml.replace(/w:pos="9026"/g, 'w:pos="9071"');

  // Thêm thụt lề rõ ràng cho TOC2 và TOC3 nếu chưa có trong pPr
  docXml = docXml.replace(
    /(<w:pPr><w:pStyle w:val="TOC2"\/>)/g,
    '$1<w:ind w:left="280"/>'
  );
  docXml = docXml.replace(
    /(<w:pPr><w:pStyle w:val="TOC3"\/>)/g,
    '$1<w:ind w:left="560"/>'
  );

  zip.file('word/document.xml', docXml);

  // 2. Đảm bảo word/settings.xml có cờ updateFields
  let settingsXml = await zip.file('word/settings.xml')?.async('text');
  if (settingsXml) {
    if (!settingsXml.includes('w:updateFields')) {
      settingsXml = settingsXml.replace(
        /<\/w:settings>/,
        '<w:updateFields w:val="true"/></w:settings>'
      );
      zip.file('word/settings.xml', settingsXml);
      console.log('[Hậu xử lý OpenXML] Đã bật cờ updateFields w:val="true" trong word/settings.xml');
    } else {
      console.log('[Hậu xử lý OpenXML] Cờ updateFields đã sẵn sàng trong word/settings.xml');
    }
  }

  const finalBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputPath, finalBuffer);

  const fileStats = fs.statSync(outputPath);
  console.log(`=== XUẤT TÀI LIỆU V2.1 THÀNH CÔNG ===`);
  console.log(`Tên file: DENSO_IoT_Monitoring_BA_Documentation_v2.1.docx`);
  console.log(`Dung lượng file: ${(fileStats.size / 1024).toFixed(2)} KB (${fileStats.size} bytes)`);
}

generateCompleteDocx().catch((err) => {
  console.error('[LỖI BIÊN DỊCH]:', err);
  process.exit(1);
});
