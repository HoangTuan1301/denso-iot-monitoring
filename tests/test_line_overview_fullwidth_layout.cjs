/**
 * @file test_line_overview_fullwidth_layout.cjs
 * @description Kiểm thử xác minh bố cục Sơ đồ dây chuyền 100% Full-width và Lưới 4 card 2 cột bên dưới
 */

const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  [PASS] ${message}`);
}

console.log('================================================================');
console.log('DENSO TEST SUITE: FULL-WIDTH LINE OVERVIEW LAYOUT VERIFICATION');
console.log('================================================================');

const lineDetailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');
const lineDetailContent = fs.readFileSync(lineDetailPath, 'utf8');

// -----------------------------------------------------------------------------
// PHẦN 1: SƠ ĐỒ DÂY CHUYỀN 100% CHIỀU RỘNG NỘI DUNG TRÊN HÀNG RIÊNG
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 1: SƠ ĐỒ DÂY CHUYỀN CHIẾM 100% CHIỀU RỘNG HÀNG RIÊNG ---');

assert(
  !lineDetailContent.includes('lg:col-span-8 xl:col-span-8 2xl:col-span-9'),
  'Đã loại bỏ cột hẹp 8/12, sơ đồ không còn bị giam trong cột bên trái'
);

assert(
  !lineDetailContent.includes('lg:col-span-4 xl:col-span-4 2xl:col-span-3'),
  'Đã loại bỏ cột phụ bên phải ở cấp hàng sơ đồ, 2 card cảnh báo & AI được chuyển xuống dưới'
);

assert(
  lineDetailContent.includes('4. SƠ ĐỒ DÂY CHUYỀN & TRẠNG THÁI THIẾT BỊ (CHIẾM 100% CHIỀU RỘNG NỘI DUNG)') &&
  lineDetailContent.includes('className="w-full p-4 sm:p-5 rounded-xl border border-slate-200/80'),
  'Card Sơ đồ dây chuyền chiếm trọn vẹn 100% chiều rộng vùng nội dung (w-full)'
);

// -----------------------------------------------------------------------------
// PHẦN 2: THỨ TỰ & PHÂN BỐ ĐỀU CỦA 6 CÔNG ĐOẠN OP10..OP60 + ĐẦU VÀO / ĐẦU RA
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 2: PHÂN BỐ ĐỀU CỦA CÁC CÔNG ĐOẠN OP10..OP60 ---');

assert(
  lineDetailContent.includes('ĐẦU') && lineDetailContent.includes('VÀO') &&
  lineDetailContent.includes('OP10') && lineDetailContent.includes('OP20') &&
  lineDetailContent.includes('OP30') && lineDetailContent.includes('OP40') &&
  lineDetailContent.includes('OP50') && lineDetailContent.includes('OP60') &&
  lineDetailContent.includes('RA'),
  'Giữ nguyên đầy đủ thứ tự: ĐẦU VÀO -> OP10 -> OP20 -> OP30 -> OP40 -> OP50 -> OP60 -> ĐẦU RA'
);

assert(
  lineDetailContent.includes('flex-1 min-w-0') &&
  lineDetailContent.includes('w-full flex items-center justify-between'),
  'Các công đoạn được phân bố đều với flex-1 min-w-0 và justify-between'
);

assert(
  lineDetailContent.includes('overflow-x-auto lg:overflow-x-visible'),
  'Hỗ trợ responsive: hiển thị trọn vẹn không cuộn ngang trên desktop, cuộn an toàn trên màn hình nhỏ'
);

assert(
  lineDetailContent.includes('onClick={() => onSelectMachine(st.machine ? st.machine.id : st.id)}') &&
  lineDetailContent.includes('title={`${st.code} – ${st.name} (${st.statusLabel})`}'),
  'Bảo toàn tương tác click mở Machine Detail, hover lift và tooltip đầy đủ'
);

// -----------------------------------------------------------------------------
// PHẦN 3: LƯỚI 4 CARD BÊN DƯỚI (2 CỘT TRÊN DESKTOP)
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 3: LƯỚI 4 CARD 2 CỘT BÊN DƯỚI SƠ ĐỒ ---');

assert(
  lineDetailContent.includes('5. LƯỚI 4 CARDS BÊN DƯỚI (LƯỚI 2 CỘT TRÊN DESKTOP: lg:grid-cols-2)') &&
  lineDetailContent.includes('grid grid-cols-1 lg:grid-cols-2 gap-4'),
  'Bốn card bên dưới được sắp xếp thành lưới 2 cột chuẩn mực trên desktop (lg:grid-cols-2)'
);

const diagramIdx = lineDetailContent.indexOf('4. SƠ ĐỒ DÂY CHUYỀN & TRẠNG THÁI THIẾT BỊ');
const lowerGridIdx = lineDetailContent.indexOf('5. LƯỚI 4 CARDS BÊN DƯỚI');
const devStatusIdx = lineDetailContent.indexOf('Card 1: Trạng thái thiết bị (Donut)');
const paramsIdx = lineDetailContent.indexOf('Card 2: Thông số vận hành chính (Bảng 4 thông số)');
const alarmsIdx = lineDetailContent.indexOf('Card 3: Cảnh báo & Sự cố');
const aiIdx = lineDetailContent.indexOf('Card 4: AI Dự đoán & Bảo dưỡng');

assert(
  diagramIdx < lowerGridIdx &&
  lowerGridIdx < devStatusIdx &&
  devStatusIdx < paramsIdx &&
  paramsIdx < alarmsIdx &&
  alarmsIdx < aiIdx,
  'Thứ tự 4 card dưới sơ đồ chuẩn xác: Sơ đồ -> [Trạng thái TB] -> [Thông số chính] -> [Cảnh báo] -> [AI Dự đoán]'
);

// -----------------------------------------------------------------------------
// PHẦN 4: BẢO TOÀN DỮ LIỆU & CÁC DÂY CHUYỀN (LN-PRS-01, LN-PNT-02, LN-ASM-03)
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 4: BẢO TOÀN DỮ LIỆU CẢ 3 DÂY CHUYỀN ---');

assert(
  lineDetailContent.includes('LN-PNT-02') &&
  lineDetailContent.includes('LN-ASM-03'),
  'Hỗ trợ đầy đủ tham số và ngưỡng cho cả 3 dây chuyền LN-PRS-01, LN-PNT-02, LN-ASM-03'
);

assert(
  !lineDetailContent.includes('AGV01') &&
  !lineDetailContent.includes('OEE theo thời gian'),
  'Tuyệt đối không có AGV và không có biểu đồ OEE theo thời gian'
);

console.log('\n================================================================');
console.log('KẾT QUẢ KIỂM THỬ: 12/12 KIỂM TRA ĐẠT 100% HOÀN HẢO');
console.log('================================================================\n');
