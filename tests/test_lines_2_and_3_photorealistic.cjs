/**
 * @file test_lines_2_and_3_photorealistic.cjs
 * @description Bộ kiểm thử tự động toàn diện xác minh:
 * 1. Line 1 (LN-PRS-01): Giữ nguyên 100% UI Reference (6 máy, 1 ĐẦU VÀO, 1 ĐẦU RA, không 6 thẻ thống kê)
 * 2. Line 2 (LN-PNT-02): Chuẩn thiết kế Line 1, đúng 4 máy (OP10..OP40), không OP50/OP60, phân bố đều
 * 3. Line 3 (LN-ASM-03): Chuẩn thiết kế Line 1, đúng 4 máy (OP10..OP40), không OP50/OP60, MS-10 đúng MCH-MS10
 * 4. Tích hợp trơn tru trong LineDetailView.tsx
 * 5. Tài nguyên đồ họa JPEG, PNG cho 14 máy và 3 dây chuyền
 */

const fs = require('fs');
const path = require('path');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

console.log('\n================================================================');
console.log('KIỂM THỬ: HOÀN THIỆN LINE 2 & LINE 3 THEO THIẾT KẾ LINE 1 ĐÃ DUYỆT');
console.log('================================================================\n');

// GROUP 1: Kiểm tra tài nguyên hình ảnh
console.log('--- TEST GROUP 1: Tài nguyên ảnh phối cảnh và CAD ---');
const line1Body = path.join(__dirname, '../public/images/lines/line1-diagram-body.jpg');
const line2Body = path.join(__dirname, '../public/images/lines/line2-diagram-body.jpg');
const line3Body = path.join(__dirname, '../public/images/lines/line3-diagram-body.jpg');

assert(fs.existsSync(line1Body), 'Ảnh nền Line 1 (line1-diagram-body.jpg) tồn tại');
assert(fs.existsSync(line2Body), 'Ảnh nền Line 2 (line2-diagram-body.jpg) tồn tại');
assert(fs.existsSync(line3Body), 'Ảnh nền Line 3 (line3-diagram-body.jpg) tồn tại');

const stat1 = fs.statSync(line1Body);
const stat2 = fs.statSync(line2Body);
const stat3 = fs.statSync(line3Body);
assert(stat1.size > 20000, `Kích thước ảnh Line 1 hợp lệ: ${stat1.size} bytes`);
assert(stat2.size > 20000, `Kích thước ảnh Line 2 hợp lệ: ${stat2.size} bytes`);
assert(stat3.size > 20000, `Kích thước ảnh Line 3 hợp lệ: ${stat3.size} bytes`);

// Kiểm tra 8 ảnh CAD của Line 2 và Line 3
const line23Machines = [
  'DRY-01.png', 'MC-DRY-01.png', 'MC-PNT-01.png', 'PNT-01.png',
  'ASM-01.png', 'MC-TST-01.png', 'MS-10.png', 'TST-01.png'
];
line23Machines.forEach(m => {
  const p = path.join(__dirname, '../public/images/machines', m);
  assert(fs.existsSync(p), `Ảnh CAD thiết bị ${m} tồn tại`);
});

// GROUP 2: Kiểm tra Source of Truth Line 1
console.log('\n--- TEST GROUP 2: Bảo toàn Line 1 (UI Reference / Source of Truth) ---');
const line1Path = path.join(__dirname, '../src/features/tier1-lines/Line1PhotorealisticView.tsx');
assert(fs.existsSync(line1Path), 'Line1PhotorealisticView.tsx tồn tại');
const line1Content = fs.readFileSync(line1Path, 'utf8');

assert(line1Content.includes('DEFAULT_OP_CONFIGS'), 'Line 1 có cấu hình công đoạn');
assert(line1Content.includes('OP10') && line1Content.includes('OP60'), 'Line 1 đủ 6 công đoạn OP10..OP60');
assert(!line1Content.includes('ĐẦU VÀO →') && !line1Content.includes('ĐẦU RA →'), 'Line 1 không render đè text ĐẦU VÀO/ĐẦU RA HTML (tránh duplicate)');
assert(!line1Content.includes('Tổng thiết bị</p>') && !line1Content.includes('Sản lượng (24h)</p>'), 'Line 1 không chứa 6 thẻ thống kê phụ trong JSX');
assert(line1Content.includes('Maximize2'), 'Line 1 hỗ trợ nút phóng to Fullscreen');

// GROUP 3: Kiểm tra cấu hình và Component Line 2 (LN-PNT-02)
console.log('\n--- TEST GROUP 3: Line 2 (LN-PNT-02) - Chuẩn 4 công đoạn ---');
const line2Path = path.join(__dirname, '../src/features/tier1-lines/Line2PhotorealisticView.tsx');
assert(fs.existsSync(line2Path), 'Line2PhotorealisticView.tsx tồn tại');
const line2Content = fs.readFileSync(line2Path, 'utf8');

assert(line2Content.includes("lineId=\"LN-PNT-02\""), 'Line 2 gán đúng lineId LN-PNT-02');
assert(line2Content.includes('LINE2_STATION_CONFIGS'), 'Line 2 sử dụng cấu hình LINE2_STATION_CONFIGS');

const genericPath = path.join(__dirname, '../src/features/tier1-lines/LineGenericPhotorealisticView.tsx');
assert(fs.existsSync(genericPath), 'LineGenericPhotorealisticView.tsx tồn tại');
const genericContent = fs.readFileSync(genericPath, 'utf8');

// Kiểm tra 4 trạm của Line 2
assert(genericContent.includes("'MCH-DRY-01'") && genericContent.includes("'DRY-01'"), 'Line 2 OP10: DRY-01 (MCH-DRY-01) Lò sấy Kawasumi');
assert(genericContent.includes("'MC-DRY-01'"), 'Line 2 OP20: MC-DRY-01 Trạm sấy hồng ngoại');
assert(genericContent.includes("'MC-PNT-01'"), 'Line 2 OP30: MC-PNT-01 Trạm phun sơn tự động');
assert(genericContent.includes("'MCH-PNT-01'") && genericContent.includes("'PNT-01'"), 'Line 2 OP40: PNT-01 (MCH-PNT-01) Buồng phun robot Yaskawa');

// Tuyệt đối không có OP50 / OP60 trong Line 2
const line2ConfigBlock = genericContent.substring(
  genericContent.indexOf('LINE2_STATION_CONFIGS'),
  genericContent.indexOf('LINE3_STATION_CONFIGS')
);
assert(!line2ConfigBlock.includes('OP50') && !line2ConfigBlock.includes('OP60'), 'Line 2 tuyệt đối KHÔNG có OP50 hoặc OP60');

// GROUP 4: Kiểm tra cấu hình và Component Line 3 (LN-ASM-03)
console.log('\n--- TEST GROUP 4: Line 3 (LN-ASM-03) - Chuẩn 4 công đoạn ---');
const line3Path = path.join(__dirname, '../src/features/tier1-lines/Line3PhotorealisticView.tsx');
assert(fs.existsSync(line3Path), 'Line3PhotorealisticView.tsx tồn tại');
const line3Content = fs.readFileSync(line3Path, 'utf8');

assert(line3Content.includes("lineId=\"LN-ASM-03\""), 'Line 3 gán đúng lineId LN-ASM-03');
assert(line3Content.includes('LINE3_STATION_CONFIGS'), 'Line 3 sử dụng cấu hình LINE3_STATION_CONFIGS');

// Kiểm tra 4 trạm của Line 3
assert(genericContent.includes("'MCH-ASM-01'") && genericContent.includes("'ASM-01'"), 'Line 3 OP10: ASM-01 (MCH-ASM-01) Robot siết bulong Atlas Copco');
assert(genericContent.includes("'MC-TST-01'"), 'Line 3 OP20: MC-TST-01 Trạm kiểm tra chức năng');
assert(genericContent.includes("'MCH-MS10'") && genericContent.includes("'MS-10'"), 'Line 3 OP30: MS-10 (MCH-MS10) Messi');
assert(genericContent.includes("'MCH-TST-01'") && genericContent.includes("'TST-01'"), 'Line 3 OP40: TST-01 (MCH-TST-01) Băng chuyền kiểm tra TestBench');

// Tuyệt đối không có OP50 / OP60 trong Line 3
const line3ConfigBlock = genericContent.substring(genericContent.indexOf('LINE3_STATION_CONFIGS'));
assert(!line3ConfigBlock.includes('OP50') && !line3ConfigBlock.includes('OP60'), 'Line 3 tuyệt đối KHÔNG có OP50 hoặc OP60');

// GROUP 5: Kiểm tra tích hợp LineDetailView.tsx
console.log('\n--- TEST GROUP 5: Tích hợp trong LineDetailView.tsx ---');
const detailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');
assert(fs.existsSync(detailPath), 'LineDetailView.tsx tồn tại');
const detailContent = fs.readFileSync(detailPath, 'utf8');

assert(detailContent.includes('Line1PhotorealisticView'), 'LineDetailView import Line1PhotorealisticView');
assert(detailContent.includes('Line2PhotorealisticView'), 'LineDetailView import Line2PhotorealisticView');
assert(detailContent.includes('Line3PhotorealisticView'), 'LineDetailView import Line3PhotorealisticView');

assert(detailContent.includes('isLine1'), 'LineDetailView xác định isLine1');
assert(detailContent.includes('isLine2'), 'LineDetailView xác định isLine2');
assert(detailContent.includes('isLine3'), 'LineDetailView xác định isLine3');

assert(detailContent.includes('<Line2PhotorealisticView'), 'LineDetailView render <Line2PhotorealisticView /> khi isLine2');
assert(detailContent.includes('<Line3PhotorealisticView'), 'LineDetailView render <Line3PhotorealisticView /> khi isLine3');

// GROUP 6: Kiểm tra tương tác, UX và phong cách thiết kế
console.log('\n--- TEST GROUP 6: Tương tác, UX và phong cách đồng nhất ---');
assert(genericContent.includes('onSelectMachine'), 'LineGenericPhotorealisticView hỗ trợ callback onSelectMachine');
assert(genericContent.includes('setIsFullscreen'), 'LineGenericPhotorealisticView hỗ trợ Fullscreen modal');
assert(genericContent.includes('aspect-[1024/240]'), 'Bảo toàn tỷ lệ đồ họa công nghiệp 1024/240');
assert(genericContent.includes('resolveMachineMonitoringState') || genericContent.includes('statusLabel'), 'Trạng thái động từ Zustand / Monitoring Store');
assert(!genericContent.includes('Tổng thiết bị') && !genericContent.includes('Sản lượng (24h)'), 'Không có hàng 6 thẻ thống kê phụ bên dưới');

console.log('\n----------------------------------------------------------------');
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('----------------------------------------------------------------\n');

if (passedTests === totalTests) {
  console.log('>>> TẤT CẢ CÁC ĐIỀU KIỆN NGHIỆM THU ĐÃ HOÀN TOÀN ĐẠT CHUẨN! <<<');
  process.exit(0);
} else {
  console.error('>>> CÒN TESTS THẤT BẠI. CẦN KHẮC PHỤC NGAY! <<<');
  process.exit(1);
}
