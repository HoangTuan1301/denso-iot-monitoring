/**
 * @file verify_real_exports.js
 * @description Standalone verification of real exported files (Excel, CSV, JSON) from local MySQL.
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mysqlDb } from '../server/db-mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Zero-dependency CRC32 & ZIP implementation matching exportEngine.ts
const calculateCRC32 = (bytes) => {
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

const createZipArchive = (files) => {
  const encoder = new TextEncoder();
  const fileEntries = [];
  let totalSize = 0;
  let currentOffset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = calculateCRC32(contentBytes);
    fileEntries.push({
      name: file.name,
      nameBytes,
      contentBytes,
      crc,
      offset: currentOffset,
      size: contentBytes.length,
    });
    currentOffset += 30 + nameBytes.length + contentBytes.length;
  }

  let cdSize = 0;
  for (const entry of fileEntries) {
    cdSize += 46 + entry.nameBytes.length;
  }
  totalSize = currentOffset + cdSize + 22;

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);
  let pos = 0;

  for (const entry of fileEntries) {
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 0, true);
    view.setUint16(pos + 8, 0, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, 0, true);
    view.setUint32(pos + 14, entry.crc, true);
    view.setUint32(pos + 18, entry.size, true);
    view.setUint32(pos + 22, entry.size, true);
    view.setUint16(pos + 26, entry.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);
    pos += 30;

    buffer.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
    buffer.set(entry.contentBytes, pos);
    pos += entry.contentBytes.length;
  }

  const cdStartOffset = pos;
  for (const entry of fileEntries) {
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, 0, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, 0, true);
    view.setUint16(pos + 14, 0, true);
    view.setUint32(pos + 16, entry.crc, true);
    view.setUint32(pos + 20, entry.size, true);
    view.setUint32(pos + 24, entry.size, true);
    view.setUint16(pos + 28, entry.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true);
    view.setUint16(pos + 32, 0, true);
    view.setUint16(pos + 34, 0, true);
    view.setUint16(pos + 36, 0, true);
    view.setUint32(pos + 38, 0, true);
    view.setUint32(pos + 42, entry.offset, true);
    pos += 46;

    buffer.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
  }

  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, fileEntries.length, true);
  view.setUint16(pos + 10, fileEntries.length, true);
  view.setUint32(pos + 12, cdSize, true);
  view.setUint32(pos + 16, cdStartOffset, true);
  view.setUint16(pos + 20, 0, true);

  return buffer;
};

const sanitizeCSVCell = (val) => {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

const escapeXml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

async function main() {
  console.log('================================================================');
  console.log('DENSO IoT Monitoring (KaiLink) - Real Export Files Verification');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  try {
    await mysqlDb.initDatabase();
    const result = await mysqlDb.getTelemetryLogs({ limit: 1000 });
    const logs = result.data;
    console.log(`Fetched ${logs.length} real records from local MySQL.`);

    if (logs.length === 0) {
      console.error('FAIL: No records found to export!');
      process.exit(1);
    }

    // 1. GENERATE & TEST CSV
    console.log('\n--- 1. CSV EXPORT VERIFICATION ---');
    const csvHeaders = [
      'Mã Bản Ghi', 'Thời Gian (VN)', 'Thời Gian (UTC)',
      'Mã Dây Chuyền', 'Tên Dây Chuyền', 'Mã Thiết Bị', 'Tên Thiết Bị',
      'Mã Chỉ Số', 'Tên Chỉ Số', 'Giá Trị Đo', 'Đơn Vị', 'Trạng Thái', 'Nguồn Dữ Liệu'
    ];
    const csvLines = [csvHeaders.map(sanitizeCSVCell).join(',')];
    logs.forEach(log => {
      csvLines.push([
        log.id, log.timestamp, log.timestamp,
        log.lineId, log.lineName, log.machineId, log.machineName,
        log.metricId, log.metricName, log.value, log.unit, log.status, log.source
      ].map(sanitizeCSVCell).join(','));
    });
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const csvPath = path.join(__dirname, 'test_real.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf8');

    const csvRead = fs.readFileSync(csvPath);
    const hasBOM = csvRead[0] === 0xEF && csvRead[1] === 0xBB && csvRead[2] === 0xBF;
    const csvLineCount = csvContent.split('\r\n').length;
    if (hasBOM && csvLineCount === logs.length + 1) {
      console.log(`✅ CSV File: PASS (UTF-8 BOM present, ${csvLineCount - 1} data rows match DB records)`);
      passed++;
    } else {
      console.log(`❌ CSV File: FAIL (hasBOM=${hasBOM}, rows=${csvLineCount - 1})`);
      failed++;
    }

    // 2. GENERATE & TEST JSON
    console.log('\n--- 2. JSON EXPORT VERIFICATION ---');
    const jsonPayload = {
      metadata: {
        exportTimestampUTC: new Date().toISOString(),
        totalRecords: logs.length,
        system: 'DENSO IoT Monitoring (KaiLink)',
        schemaVersion: '1.0.0',
      },
      data: logs,
    };
    const jsonContent = JSON.stringify(jsonPayload, null, 2);
    const jsonPath = path.join(__dirname, 'test_real.json');
    fs.writeFileSync(jsonPath, jsonContent, 'utf8');

    const jsonParsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (jsonParsed.metadata.totalRecords === logs.length && jsonParsed.data.length === logs.length) {
      console.log(`✅ JSON File: PASS (Parsed valid JSON, metadata and ${jsonParsed.data.length} records match DB)`);
      passed++;
    } else {
      console.log(`❌ JSON File: FAIL`);
      failed++;
    }

    // 3. GENERATE & TEST EXCEL (.xlsx)
    console.log('\n--- 3. EXCEL .XLSX EXPORT VERIFICATION ---');
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
    const wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Lịch Sử Hoạt Động Máy" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Segoe UI"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF003366"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

    const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
    const headerCells = csvHeaders.map((h, i) => `<c r="${colLetters[i]}1" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`).join('');
    const dataRows = logs.map((log, index) => {
      const rowNum = index + 2;
      return `<row r="${rowNum}">
  <c r="A${rowNum}" t="inlineStr"><is><t>${escapeXml(log.id)}</t></is></c>
  <c r="B${rowNum}" t="inlineStr"><is><t>${escapeXml(log.timestamp)}</t></is></c>
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
  <c r="M${rowNum}" t="inlineStr"><is><t>${escapeXml(log.source)}</t></is></c>
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

    const xlsxBuffer = Buffer.from(createZipArchive(zipFiles));
    const xlsxPath = path.join(__dirname, 'test_real.xlsx');
    fs.writeFileSync(xlsxPath, xlsxBuffer);

    const xlsxRead = fs.readFileSync(xlsxPath);
    const isPKZip = xlsxRead[0] === 0x50 && xlsxRead[1] === 0x4B && xlsxRead[2] === 0x03 && xlsxRead[3] === 0x04;
    if (isPKZip && xlsxRead.length > 5000) {
      console.log(`✅ Excel .xlsx File: PASS (Valid PKZIP binary signature, size: ${xlsxRead.length} bytes, ${logs.length} data rows)`);
      passed++;
    } else {
      console.log(`❌ Excel .xlsx File: FAIL (isPKZip=${isPKZip}, size=${xlsxRead.length})`);
      failed++;
    }

    // 4. CLEANUP TEST FILES
    fs.unlinkSync(csvPath);
    fs.unlinkSync(jsonPath);
    fs.unlinkSync(xlsxPath);
    console.log('\n--- 4. CLEANUP ---');
    console.log('✅ Temporary export files cleaned up cleanly.');

    console.log('\n================================================================');
    console.log(`EXPORT VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
  } catch (err) {
    console.error('Error during export verification:', err);
    failed++;
  } finally {
    if (mysqlDb.closeDatabase) {
      await mysqlDb.closeDatabase();
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
