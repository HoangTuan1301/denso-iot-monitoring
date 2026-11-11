/**
 * @file scripts/generate_ba_doc.js
 * @description Script tạo tài liệu đặc tả nghiệp vụ BA chuyên nghiệp chuẩn Enterprise
 * Đạt chuẩn: A4, Times New Roman, Cỡ 13, Giãn dòng 1.3, Căn đều hai bên,
 * Lề trái 3cm, phải 2cm, trên 2.5cm, dưới 2.5cm, Trang bìa, Bảng lịch sử, Mục lục,
 * Header/Footer, Đánh số trang, Bảng biểu và Hình minh họa thực tế.
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
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ImageRun,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  TableOfContents,
} from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Đường dẫn tài nguyên hình ảnh
const logoPath = path.join(rootDir, 'src', 'assets', 'denso-logo.png');
const imgTier2Path = path.join(rootDir, 'docs', 'ba', 'images', 'media_1790509441403.png');
const imgTier3Path = path.join(rootDir, 'docs', 'ba', 'images', 'media_1790509392427.png');

console.log('Khởi động tiến trình tạo tài liệu BA chuẩn hóa...');

// Hàm tiện ích tạo Paragraph thường
function createPara(text, options = {}) {
  const {
    bold = false,
    italic = false,
    size = 26, // 13pt
    color = '000000',
    alignment = AlignmentType.JUSTIFIED,
    spaceBefore = 80,
    spaceAfter = 80,
    lineSpacing = 312, // 1.3 line spacing
  } = options;

  return new Paragraph({
    alignment,
    spacing: {
      before: spaceBefore,
      after: spaceAfter,
      line: lineSpacing,
    },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size,
        bold,
        italic,
        color,
      }),
    ],
  });
}

// Hàm tiện ích tạo Heading 1 (16pt, Bold, Navy)
function createH1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: 32, // 16pt
        bold: true,
        color: '003366', // DENSO Navy Blue
      }),
    ],
  });
}

// Hàm tiện ích tạo Heading 2 (14pt, Bold, Dark Blue)
function createH2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: 28, // 14pt
        bold: true,
        color: '004080',
      }),
    ],
  });
}

// Hàm tiện ích tạo Heading 3 (13pt, Bold, Italic)
function createH3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: 26, // 13pt
        bold: true,
        italics: true,
        color: '202020',
      }),
    ],
  });
}

// Hàm tạo Table Cell tiêu chuẩn
function createCell(content, options = {}) {
  const {
    isHeader = false,
    widthPercent = null,
    colSpan = 1,
    align = AlignmentType.LEFT,
    bold = false,
    fontSize = 22, // 11pt cho bảng
  } = options;

  const children = Array.isArray(content)
    ? content
    : [
        new Paragraph({
          alignment: align,
          spacing: { before: 40, after: 40, line: 260 },
          children: [
            new TextRun({
              text: String(content),
              font: 'Times New Roman',
              size: fontSize,
              bold: isHeader || bold,
              color: isHeader ? 'FFFFFF' : '000000',
            }),
          ],
        }),
      ];

  const cellObj = {
    children,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    columnSpan: colSpan,
  };

  if (isHeader) {
    cellObj.shading = {
      type: ShadingType.SOLID,
      color: '003366',
      fill: '003366',
    };
  }

  if (widthPercent) {
    cellObj.width = { size: widthPercent, type: WidthType.PERCENTAGE };
  }

  return new TableCell(cellObj);
}

// Helper borders cho bảng
const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'D0D0D0' },
};

export {
  createPara,
  createH1,
  createH2,
  createH3,
  createCell,
  thinBorders,
  logoPath,
  imgTier2Path,
  imgTier3Path,
};
