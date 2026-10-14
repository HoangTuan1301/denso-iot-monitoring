/**
 * @file exportEngine.ts
 * @description Động cơ xuất báo cáo chuyên dụng cho phân hệ Lịch sử hoạt động máy (Machine Telemetry History).
 * Hỗ trợ 3 định dạng:
 * 1. Excel (.xlsx): Binary OpenXML tiêu chuẩn, có định dạng tiêu đề, không phụ thuộc thư viện ngoài (Zero-dependency).
 * 2. CSV (.csv): UTF-8 BOM, tương thích tiếng Việt trên Excel, chống lỗi bảo mật Formula Injection.
 * 3. JSON (.json): Cấu trúc phân cấp chuẩn, sẵn sàng tích hợp huấn luyện mô hình AI/ML Anomaly Detection.
 */

import { MachineActivityLog, TelemetryLogsMetadata } from '../types/hierarchy';

/**
 * Format thời gian UTC sang giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh)
 */
export const formatDateTimeVN = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
};

/**
 * Kích hoạt tải file an toàn trên trình duyệt
 */
export const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Tạo timestamp ngắn cho tên file xuất (VD: 20261015_083015)
 */
export const getExportTimestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now).replace(/-/g, '');
  const t = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${d}_${t}`;
};

/**
 * Làm sạch ô dữ liệu CSV để phòng chống lỗ hổng bảo mật Formula Injection (CSV Injection)
 * Nếu ô bắt đầu bằng =, +, -, @, Tab hoặc Carriage Return, tự động chèn dấu nháy đơn '
 */
const sanitizeCSVCell = (val: any): string => {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Escape các ký tự đặc biệt cho XML trong file XLSX
 */
const escapeXml = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Tính toán mã kiểm tra toàn vẹn CRC-32 chuẩn ZIP
 */
const calculateCRC32 = (bytes: Uint8Array): number => {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
};

/**
 * Bộ đóng gói file ZIP nhị phân thuần túy theo chuẩn PKZIP (Compression Method 0: Store)
 * Chuẩn Open Packaging Conventions ISO/IEC 29500-2 cho phép file .xlsx được lưu trữ không nén (Stored).
 */
const createZipArchive = (files: { name: string; content: string }[]): Uint8Array => {
  const encoder = new TextEncoder();
  const fileEntries: {
    nameBytes: Uint8Array;
    contentBytes: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  let totalSize = 0;
  let currentOffset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = calculateCRC32(contentBytes);
    fileEntries.push({
      nameBytes,
      contentBytes,
      crc,
      offset: currentOffset,
    });

    // Kích thước Local File Header: 30 bytes + name length + content length
    currentOffset += 30 + nameBytes.length + contentBytes.length;
  }

  // Central Directory Offset
  const cdOffset = currentOffset;
  let cdSize = 0;

  for (const entry of fileEntries) {
    // Kích thước Central Directory Header: 46 bytes + name length
    cdSize += 46 + entry.nameBytes.length;
  }

  // End of Central Directory: 22 bytes
  totalSize = cdOffset + cdSize + 22;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  let pos = 0;

  // 1. Ghi các Local File Headers & Data
  for (const entry of fileEntries) {
    // Local File Header Signature 0x04034b50 (PK\x03\x04)
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true); // Version needed: 2.0
    view.setUint16(pos + 6, 0, true);  // General purpose bit flag
    view.setUint16(pos + 8, 0, true);  // Compression method: 0 (Store)
    view.setUint16(pos + 10, 0, true); // File last mod time
    view.setUint16(pos + 12, 0, true); // File last mod date
    view.setUint32(pos + 14, entry.crc, true); // CRC-32
    view.setUint32(pos + 18, entry.contentBytes.length, true); // Compressed size
    view.setUint32(pos + 22, entry.contentBytes.length, true); // Uncompressed size
    view.setUint16(pos + 26, entry.nameBytes.length, true);    // File name length
    view.setUint16(pos + 28, 0, true);                         // Extra field length
    pos += 30;

    uint8.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;

    uint8.set(entry.contentBytes, pos);
    pos += entry.contentBytes.length;
  }

  // 2. Ghi Central Directory Headers
  for (const entry of fileEntries) {
    // Central Directory Header Signature 0x02014b50 (PK\x01\x02)
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true); // Version made by
    view.setUint16(pos + 6, 20, true); // Version needed to extract
    view.setUint16(pos + 8, 0, true);  // Flags
    view.setUint16(pos + 10, 0, true); // Method: Store
    view.setUint16(pos + 12, 0, true); // Time
    view.setUint16(pos + 14, 0, true); // Date
    view.setUint32(pos + 16, entry.crc, true);
    view.setUint32(pos + 20, entry.contentBytes.length, true);
    view.setUint32(pos + 24, entry.contentBytes.length, true);
    view.setUint16(pos + 28, entry.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true); // Extra field len
    view.setUint16(pos + 32, 0, true); // Comment len
    view.setUint16(pos + 34, 0, true); // Disk number start
    view.setUint16(pos + 36, 0, true); // Internal attributes
    view.setUint32(pos + 38, 0, true); // External attributes
    view.setUint32(pos + 42, entry.offset, true); // Relative offset of local header
    pos += 46;

    uint8.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
  }

  // 3. Ghi End of Central Directory Record
  view.setUint32(pos, 0x06054b50, true); // EOCD Signature (PK\x05\x06)
  view.setUint16(pos + 4, 0, true);      // Number of this disk
  view.setUint16(pos + 6, 0, true);      // Disk with start of CD
  view.setUint16(pos + 8, fileEntries.length, true);  // Entries on this disk
  view.setUint16(pos + 10, fileEntries.length, true); // Total entries
  view.setUint32(pos + 12, cdSize, true);             // Size of CD
  view.setUint32(pos + 16, cdOffset, true);           // Offset of CD
  view.setUint16(pos + 20, 0, true);                  // Comment len

  return uint8;
};

// ============================================================================
// CÁC HÀM XUẤT DỮ LIỆU CHÍNH (EXPORT ENGINE API)
// ============================================================================

export const exportEngine = {
  /**
   * Xuất danh sách telemetry ra file CSV với UTF-8 BOM và chống Formula Injection
   */
  exportToCSV(logs: MachineActivityLog[], customFilename?: string): void {
    const filename = customFilename || `DENSO_Telemetry_Export_${getExportTimestamp()}.csv`;

    const headers = [
      'Mã Bản Ghi',
      'Thời Gian (VN)',
      'Thời Gian (UTC)',
      'Mã Dây Chuyền',
      'Tên Dây Chuyền',
      'Mã Thiết Bị',
      'Tên Thiết Bị',
      'Mã Chỉ Số',
      'Tên Chỉ Số',
      'Giá Trị Đo',
      'Đơn Vị',
      'Trạng Thái',
      'Nguồn Dữ Liệu',
    ];

    const rows = logs.map((log) => [
      sanitizeCSVCell(log.id),
      sanitizeCSVCell(formatDateTimeVN(log.timestamp)),
      sanitizeCSVCell(log.timestamp),
      sanitizeCSVCell(log.lineId),
      sanitizeCSVCell(log.lineName),
      sanitizeCSVCell(log.machineId),
      sanitizeCSVCell(log.machineName),
      sanitizeCSVCell(log.metricId),
      sanitizeCSVCell(log.metricName),
      sanitizeCSVCell(Number(log.value).toFixed(2)),
      sanitizeCSVCell(log.unit),
      sanitizeCSVCell(log.status.toUpperCase()),
      sanitizeCSVCell(log.source === 'simulation' ? 'Mô phỏng (Simulation)' : 'Thiết bị (Device)'),
    ]);

    // Thêm UTF-8 Byte Order Mark (\uFEFF) ở đầu file để Excel mở font tiếng Việt không bị lỗi
    const csvContent =
      '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
  },

  /**
   * Xuất dữ liệu telemetry ra file JSON chuẩn hóa cho AI/ML Dataset Pipeline
   */
  exportToJSON(
    logs: MachineActivityLog[],
    metadata?: TelemetryLogsMetadata | null,
    customFilename?: string
  ): void {
    const filename = customFilename || `DENSO_Telemetry_Dataset_${getExportTimestamp()}.json`;

    const exportPayload = {
      exportMetadata: {
        system: 'DENSO IoT Monitoring Platform (KaiLink)',
        exportedAtUTC: new Date().toISOString(),
        exportedAtVN: formatDateTimeVN(new Date().toISOString()),
        totalRecords: logs.length,
        schemaVersion: '1.0',
        dataSource: metadata?.dataSource || 'Central_MySQL_Database',
        description:
          'Time-series sensor telemetry data for industrial equipment predictive maintenance & AI anomaly detection training.',
        appliedFilters: metadata?.appliedFilters || {},
      },
      records: logs.map((log) => ({
        id: log.id,
        timestampUTC: log.timestamp,
        timestampVN: formatDateTimeVN(log.timestamp),
        line: {
          id: log.lineId,
          name: log.lineName,
        },
        machine: {
          id: log.machineId,
          name: log.machineName,
        },
        metric: {
          id: log.metricId,
          name: log.metricName,
          value: Number(log.value),
          unit: log.unit,
        },
        evaluation: {
          status: log.status,
          isAnomaly: log.status === 'critical',
          isWarning: log.status === 'warning',
        },
        source: log.source,
      })),
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    triggerDownload(blob, filename);
  },

  /**
   * Xuất dữ liệu ra file Microsoft Excel (.xlsx) chuẩn OpenXML có style tiêu đề
   * Hoàn toàn Zero-dependency, định dạng ô số cho tính toán/vẽ biểu đồ.
   */
  exportToExcel(logs: MachineActivityLog[], customFilename?: string): void {
    const filename = customFilename || `DENSO_Telemetry_Report_${getExportTimestamp()}.xlsx`;

    // 1. [Content_Types].xml
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    // 2. _rels/.rels
    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    // 3. xl/_rels/workbook.xml.rels
    const wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    // 4. xl/workbook.xml
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Machine_Telemetry" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    // 5. xl/styles.xml (Tiêu đề chữ đậm màu trắng, nền xanh lá Emerald #059669 đặc trưng DENSO)
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><b/><name val="Calibri"/><sz val="11"/><color rgb="FFFFFFFF"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF059669"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/></border>
  </borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

    // 6. xl/worksheets/sheet1.xml
    const headers = [
      'Mã Bản Ghi',
      'Thời Gian (VN)',
      'Thời Gian (UTC)',
      'Mã Dây Chuyền',
      'Tên Dây Chuyền',
      'Mã Thiết Bị',
      'Tên Thiết Bị',
      'Mã Chỉ Số',
      'Tên Chỉ Số',
      'Giá Trị Đo',
      'Đơn Vị',
      'Trạng Thái',
      'Nguồn Dữ Liệu',
    ];

    const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

    // Dòng 1: Tiêu đề cột (style s="1")
    const headerCells = headers
      .map(
        (h, i) =>
          `<c r="${colLetters[i]}1" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`
      )
      .join('');

    // Dòng dữ liệu bắt đầu từ row 2
    const dataRows = logs.map((log, index) => {
      const rowNum = index + 2;
      const timeVN = formatDateTimeVN(log.timestamp);
      const isSim = log.source === 'simulation' ? 'Mô phỏng (Simulation)' : 'Thiết bị (Device)';

      return `<row r="${rowNum}">
  <c r="A${rowNum}" t="inlineStr"><is><t>${escapeXml(log.id)}</t></is></c>
  <c r="B${rowNum}" t="inlineStr"><is><t>${escapeXml(timeVN)}</t></is></c>
  <c r="C${rowNum}" t="inlineStr"><is><t>${escapeXml(log.timestamp)}</t></is></c>
  <c r="D${rowNum}" t="inlineStr"><is><t>${escapeXml(log.lineId)}</t></is></c>
  <c r="E${rowNum}" t="inlineStr"><is><t>${escapeXml(log.lineName)}</t></is></c>
  <c r="F${rowNum}" t="inlineStr"><is><t>${escapeXml(log.machineId)}</t></is></c>
  <c r="G${rowNum}" t="inlineStr"><is><t>${escapeXml(log.machineName)}</t></is></c>
  <c r="H${rowNum}" t="inlineStr"><is><t>${escapeXml(log.metricId)}</t></is></c>
  <c r="I${rowNum}" t="inlineStr"><is><t>${escapeXml(log.metricName)}</t></is></c>
  <c r="J${rowNum}"><v>${Number(log.value) || 0}</v></c>
  <c r="K${rowNum}" t="inlineStr"><is><t>${escapeXml(log.unit)}</t></is></c>
  <c r="L${rowNum}" t="inlineStr"><is><t>${escapeXml(log.status.toUpperCase())}</t></is></c>
  <c r="M${rowNum}" t="inlineStr"><is><t>${escapeXml(isSim)}</t></is></c>
</row>`;
    });

    const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">${headerCells}</row>
    ${dataRows.join('\n')}
  </sheetData>
</worksheet>`;

    const zipFiles = [
      { name: '[Content_Types].xml', content: contentTypesXml },
      { name: '_rels/.rels', content: rootRelsXml },
      { name: 'xl/_rels/workbook.xml.rels', content: wbRelsXml },
      { name: 'xl/workbook.xml', content: workbookXml },
      { name: 'xl/styles.xml', content: stylesXml },
      { name: 'xl/worksheets/sheet1.xml', content: worksheetXml },
    ];

    const zipBytes = createZipArchive(zipFiles);
    const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerDownload(blob, filename);
  },
};
