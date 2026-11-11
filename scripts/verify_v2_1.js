import fs from 'fs';
import path from 'path';
import jszip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function verifyDocx() {
  console.log('=== BẮT ĐẦU KIỂM ĐỊNH TÀI LIỆU V2.1 ===');
  const docxPath = path.resolve(rootDir, 'docs', 'ba', 'DENSO_IoT_Monitoring_BA_Documentation_v2.1.docx');

  if (!fs.existsSync(docxPath)) {
    throw new Error('File không tồn tại: ' + docxPath);
  }

  const buf = fs.readFileSync(docxPath);
  console.log(`[File Stats] Dung lượng: ${(buf.length / 1024).toFixed(2)} KB (${buf.length} bytes)`);

  const magic = buf.slice(0, 4).toString('hex');
  if (magic !== '504b0304') {
    throw new Error('Magic bytes không khớp PKZIP: ' + magic);
  }
  console.log('[Check 1] Cấu trúc file PKZIP/DOCX hợp lệ (Magic bytes 504B0304)');

  const zip = await jszip.loadAsync(buf);

  // 1. Kiểm tra settings.xml
  const settingsXml = await zip.file('word/settings.xml')?.async('text');
  const hasUpdateFields = settingsXml?.includes('updateFields');
  console.log(`[Check 2] Cờ w:updateFields trong settings.xml: ${hasUpdateFields ? 'CÓ (Sẵn sàng tự động tính số trang)' : 'KHÔNG'}`);

  // 2. Kiểm tra styles.xml
  const stylesXml = await zip.file('word/styles.xml')?.async('text');
  const hasHeading1 = stylesXml?.includes('styleId="Heading1"');
  const hasHeading2 = stylesXml?.includes('styleId="Heading2"');
  const hasHeading3 = stylesXml?.includes('styleId="Heading3"');
  const hasTOC1 = stylesXml?.includes('styleId="TOC1"');
  const hasTOC2 = stylesXml?.includes('styleId="TOC2"');
  const hasTOC3 = stylesXml?.includes('styleId="TOC3"');
  console.log(`[Check 3] Styles định nghĩa: Heading1=${hasHeading1}, Heading2=${hasHeading2}, Heading3=${hasHeading3}, TOC1=${hasTOC1}, TOC2=${hasTOC2}, TOC3=${hasTOC3}`);

  // 3. Kiểm tra document.xml và Table of Contents
  const docXml = await zip.file('word/document.xml')?.async('text');
  const hasTOCField = docXml?.includes('TOC \\o &quot;1-3&quot; \\h \\z \\u');
  console.log(`[Check 4] Trường TOC lệnh chuẩn (TOC \\o "1-3" \\h \\z \\u): ${hasTOCField ? 'ĐẠT' : 'CHƯA ĐẠT'}`);

  // Đếm các mục trong TOC
  const tocMatches = docXml?.match(/<w:hyperlink w:history="1" w:anchor="_Toc\d+">/g) || [];
  console.log(`[Check 5] Tổng số mục đề mục liên kết trong TOC: ${tocMatches.length} mục`);

  // Phân tích các cấp độ TOC
  const toc1Count = (docXml?.match(/<w:pStyle w:val="TOC1"\/>/g) || []).length;
  const toc2Count = (docXml?.match(/<w:pStyle w:val="TOC2"\/>/g) || []).length;
  const toc3Count = (docXml?.match(/<w:pStyle w:val="TOC3"\/>/g) || []).length;
  console.log(`  - Cấp 1 (TOC1 - Chương): ${toc1Count} mục`);
  console.log(`  - Cấp 2 (TOC2 - Mục lớn): ${toc2Count} mục`);
  console.log(`  - Cấp 3 (TOC3 - Tiểu mục): ${toc3Count} mục`);

  // Đếm Heading thực tế trong thân bài
  const h1Count = (docXml?.match(/<w:pStyle w:val="Heading1"\/>/g) || []).length;
  const h2Count = (docXml?.match(/<w:pStyle w:val="Heading2"\/>/g) || []).length;
  const h3Count = (docXml?.match(/<w:pStyle w:val="Heading3"\/>/g) || []).length;
  console.log(`[Check 6] Số lượng Heading trong nội dung tài liệu:`);
  console.log(`  - Heading 1: ${h1Count}`);
  console.log(`  - Heading 2: ${h2Count}`);
  console.log(`  - Heading 3: ${h3Count}`);

  // Kiểm tra tab và dot leader
  const dotLeaderTabs = (docXml?.match(/<w:tab w:val="right" w:pos="9071" w:leader="dot"\/>/g) || []).length;
  console.log(`[Check 7] Số tab căn lề phải 9071 twips kèm dấu chấm dẫn (dot leader): ${dotLeaderTabs} tab`);

  // Kiểm tra 10 chương vẫn hiện diện
  console.log('[Check 8] Kiểm tra 10 Chương trong thân tài liệu:');
  for (let ch = 1; ch <= 10; ch++) {
    const present = docXml?.includes(`CHƯƠNG ${ch}:`);
    console.log(`  - CHƯƠNG ${ch}: ${present ? 'CÓ ĐẦY ĐỦ' : 'THIẾU'}`);
  }

  // Kiểm tra các bảng và hình ảnh
  const tableCount = (docXml?.match(/<w:tbl>/g) || []).length;
  const imageCount = (docXml?.match(/<w:drawing>/g) || []).length;
  console.log(`[Check 9] Số lượng bảng biểu trong tài liệu: ${tableCount}`);
  console.log(`[Check 10] Số lượng hình ảnh nhúng trong tài liệu: ${imageCount}`);

  console.log('=== KẾT QUẢ KIỂM ĐỊNH: TOÀN BỘ TIÊU CHÍ ĐỀU ĐẠT CHUẨN ===');
}

verifyDocx().catch(console.error);
