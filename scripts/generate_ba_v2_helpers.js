/**
 * @file scripts/generate_ba_v2_helpers.js
 * @description Helper functions for generating DENSO IoT Monitoring BA Documentation v2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Paragraph,
  TextRun,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  ImageRun,
} from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Resource paths
const logoPath = path.join(rootDir, 'src', 'assets', 'denso-logo.png');
const imgLoginPath = path.join(rootDir, 'docs', 'ba', 'images', 'media_1791738942317.png');
const imgTier2Path = path.join(rootDir, 'docs', 'ba', 'images', 'media_1790509441403.png');
const imgTier3Path = path.join(rootDir, 'docs', 'ba', 'images', 'media_1790509392427.png');
const imgRenderLogPath = path.join(rootDir, 'docs', 'ba', 'images', 'media_1791370113609.png');

function createPara(text, options = {}) {
  const {
    bold = false,
    italic = false,
    size = 26, // 13pt
    color = '000000',
    alignment = AlignmentType.JUSTIFIED,
    spaceBefore = 80,
    spaceAfter = 80,
    lineSpacing = 312, // 1.3
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
        italics: italic,
        color,
      }),
    ],
  });
}

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
        color: '1A365D',
      }),
    ],
  });
}

function createH4(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 140, after: 60 },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: 24, // 12pt
        bold: true,
        color: '2D3748',
      }),
    ],
  });
}

function createCell(content, options = {}) {
  const {
    isHeader = false,
    widthPercent = null,
    colSpan = 1,
    align = AlignmentType.LEFT,
    bold = false,
    italic = false,
    fontSize = 22, // 11pt
    bgColor = null,
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
              italics: italic,
              color: isHeader ? 'FFFFFF' : '000000',
            }),
          ],
        }),
      ];

  const cellObj = {
    children,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    columnSpan: colSpan,
  };

  if (isHeader) {
    cellObj.shading = {
      type: ShadingType.SOLID,
      color: '003366',
      fill: '003366',
    };
  } else if (bgColor) {
    cellObj.shading = {
      type: ShadingType.SOLID,
      color: bgColor,
      fill: bgColor,
    };
  }

  if (widthPercent) {
    cellObj.width = { size: widthPercent, type: WidthType.PERCENTAGE };
  }

  return new TableCell(cellObj);
}

function createImageParas(imagePath, width = 450, height = 280, caption = '') {
  if (!fs.existsSync(imagePath)) {
    console.warn(`[WARN] Ảnh không tồn tại tại: ${imagePath}`);
    return [];
  }
  try {
    const imgBuffer = fs.readFileSync(imagePath);
    const paras = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 80 },
        children: [
          new ImageRun({
            data: imgBuffer,
            transformation: { width, height },
          }),
        ],
      }),
    ];
    if (caption) {
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 180 },
          children: [
            new TextRun({
              text: caption,
              font: 'Times New Roman',
              size: 22, // 11pt
              italics: true,
              color: '4A5568',
            }),
          ],
        })
      );
    }
    return paras;
  } catch (e) {
    console.warn(`[WARN] Không thể nạp ảnh ${imagePath}:`, e.message);
    return [];
  }
}

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E0' },
};

export {
  createPara,
  createH1,
  createH2,
  createH3,
  createH4,
  createCell,
  createImageParas,
  thinBorders,
  logoPath,
  imgLoginPath,
  imgTier2Path,
  imgTier3Path,
  imgRenderLogPath,
};
