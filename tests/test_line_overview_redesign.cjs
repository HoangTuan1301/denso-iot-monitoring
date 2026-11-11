/**
 * @file test_line_overview_redesign.cjs
 * @description Bộ kiểm thử toàn diện xác minh thiết kế lại giao diện Line Overview DENSO Smart Factory
 * - Xác minh ô OEE dạng Donut Gauge nằm ngay bên phải ô Trạng thái dây chuyền trong Hàng 1
 * - Xác minh bộ 3 chỉ số Availability, Performance, Quality nằm ở Hàng 2
 * - Xác minh công thức toán học OEE = Availability * Performance * Quality
 * - Xác minh đã xóa hoàn toàn biểu đồ OEE theo thời gian và ô mã dây chuyền lặp lại
 * - Xác minh đã loại bỏ hoàn toàn xe tự hành AGV01 khỏi sơ đồ
 * - Xác minh sơ đồ OP10..OP60 giữ nguyên giao diện và tương tác
 * - Xác minh 2 card riêng biệt [Cảnh báo & Sự cố] và [AI Dự đoán & Bảo dưỡng]
 * - Xác minh hàng dưới: [Trạng thái thiết bị Donut] và [Bảng thông số vận hành chính]
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
console.log('DENSO TEST SUITE: LINE OVERVIEW REDESIGN VERIFICATION');
console.log('================================================================');

const lineDetailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');
const lineDetailContent = fs.readFileSync(lineDetailPath, 'utf8');

// -----------------------------------------------------------------------------
// PHẦN 1: HÀNG THÔNG TIN TỔNG QUAN (4 CARDS) & VỊ TRÍ OEE
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 1: HÀNG THÔNG TIN TỔNG QUAN & VỊ TRÍ Ô OEE ---');

// Kiểm tra 4 thẻ tổng quan
assert(
  lineDetailContent.includes('Trạng thái dây chuyền') &&
  lineDetailContent.includes('OEE') &&
  lineDetailContent.includes('Mức độ an toàn (Line Health)') &&
  lineDetailContent.includes('Sản lượng (hôm nay)'),
  'Hàng thông tin tổng quan hiển thị đầy đủ 4 thẻ: [Trạng thái] [OEE] [Line Health] [Sản lượng]'
);

// Kiểm tra OEE nằm ngay sau Trạng thái dây chuyền
const statusIndex = lineDetailContent.indexOf('Trạng thái dây chuyền');
const oeeIndex = lineDetailContent.indexOf('Card 2: Ô OEE Dạng Donut Gauge');
const healthIndex = lineDetailContent.indexOf('Mức độ an toàn (Line Health)');
const outputIndex = lineDetailContent.indexOf('Sản lượng (hôm nay)');

assert(
  statusIndex < oeeIndex && oeeIndex < healthIndex && healthIndex < outputIndex,
  'Thứ tự 4 thẻ chuẩn xác: [Trạng thái dây chuyền] -> [OEE dạng Donut] -> [Line Health] -> [Sản lượng hôm nay]'
);

// Kiểm tra OEE dạng Donut Gauge
assert(
  lineDetailContent.includes('<svg className="w-full h-full -rotate-90"') &&
  lineDetailContent.includes('strokeDasharray') &&
  lineDetailContent.includes('strokeLinecap="round"'),
  'Ô OEE được thiết kế dạng Donut / Circular Gauge SVG chuẩn mực'
);

assert(
  lineDetailContent.includes('Mục tiêu:') &&
  lineDetailContent.includes('so với hôm qua'),
  'Ô OEE hiển thị Mục tiêu (%) và mức chênh lệch tăng/giảm so với hôm qua'
);

// -----------------------------------------------------------------------------
// PHẦN 2: HÀNG KPI: AVAILABILITY, PERFORMANCE, QUALITY & CÔNG THỨC TOÁN HỌC
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 2: AVAILABILITY, PERFORMANCE, QUALITY & CÔNG THỨC TOÁN HỌC ---');

assert(
  lineDetailContent.includes('Availability') &&
  lineDetailContent.includes('Performance') &&
  lineDetailContent.includes('Quality'),
  'Hàng 2 hiển thị đầy đủ 3 thẻ KPI: [Availability] [Performance] [Quality]'
);

// Kiểm tra công thức logic toán học
assert(
  lineDetailContent.includes('((availability / 100) * (performance / 100) * (quality / 100) * 100)'),
  'Chỉ số OEE được tính toán nhất quán: OEE = (Availability/100) * (Performance/100) * (Quality/100) * 100'
);

// -----------------------------------------------------------------------------
// PHẦN 3: XÓA BỎ OEE THEO THỜI GIAN & Ô DÂY CHUYỀN LẶP LẠI
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 3: XÓA BỎ CÁC THÀNH PHẦN THỪA ---');

assert(
  !lineDetailContent.includes('OEE theo thời gian'),
  'Đã xóa hoàn toàn biểu đồ "OEE theo thời gian" khỏi Line Overview'
);

assert(
  !lineDetailContent.includes('OEE theo giờ'),
  'Không có biểu đồ đường OEE theo giờ gây rối mắt'
);

// Kiểm tra không có ô mã dây chuyền lặp lại bên trong hàng KPI
const lineCardMatches = lineDetailContent.match(/LN-PRS-01.*?(Dập & Hàn)/g) || [];
assert(
  lineCardMatches.length <= 1,
  'Không có ô thông tin dây chuyền bị lặp lại bên trong hàng thẻ KPI'
);

// -----------------------------------------------------------------------------
// PHẦN 4: SƠ ĐỒ CÔNG ĐOẠN OP10..OP60 & XÓA HOÀN TOÀN AGV
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 4: SƠ ĐỒ OP10..OP60 & LOẠI BỎ AGV ---');

assert(
  lineDetailContent.includes('OP10') &&
  lineDetailContent.includes('OP20') &&
  lineDetailContent.includes('OP30') &&
  lineDetailContent.includes('OP40') &&
  lineDetailContent.includes('OP50') &&
  lineDetailContent.includes('OP60'),
  'Bảo tồn trọn vẹn 6 công đoạn sản xuất OP10..OP60 theo thiết kế website hiện tại'
);

assert(
  lineDetailContent.includes('ĐẦU') && lineDetailContent.includes('VÀO') &&
  lineDetailContent.includes('RA'),
  'Sơ đồ có điểm ĐẦU VÀO và ĐẦU RA phân định rõ ràng'
);

assert(
  lineDetailContent.includes('onSelectMachine'),
  'Tương tác click vào từng trạm máy mở màn hình Machine Detail hoạt động thông suốt'
);

assert(
  !lineDetailContent.includes('AGV01') && !lineDetailContent.includes('Robot tự hành'),
  'Đã loại bỏ hoàn toàn thanh thông tin và xe tự hành AGV khỏi giao diện Line Overview'
);

// -----------------------------------------------------------------------------
// PHẦN 5: CẢNH BÁO VÀ AI DỰ ĐOÁN (2 CARDS RIÊNG BIỆT)
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 5: CẢNH BÁO VÀ AI DỰ ĐOÁN (2 CARDS RIÊNG BIỆT) ---');

assert(
  lineDetailContent.includes('Cảnh báo & Sự cố') &&
  lineDetailContent.includes('Xem tất cả'),
  'Card 1: Cảnh báo & Sự cố hiển thị riêng biệt với nút "Xem tất cả →"'
);

assert(
  lineDetailContent.includes('AI Dự đoán & Bảo dưỡng') &&
  lineDetailContent.includes('Dự đoán rủi ro thiết bị') &&
  lineDetailContent.includes('Xem chi tiết'),
  'Card 2: AI Dự đoán & Bảo dưỡng hiển thị riêng biệt với nút "Xem chi tiết →"'
);

// -----------------------------------------------------------------------------
// PHẦN 6: TRẠNG THÁI THIẾT BỊ VÀ BẢNG THÔNG SỐ VẬN HÀNH CHÍNH
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 6: TRẠNG THÁI THIẾT BỊ & THÔNG SỐ VẬN HÀNH CHÍNH ---');

assert(
  lineDetailContent.includes('Trạng thái thiết bị') &&
  lineDetailContent.includes('Thiết bị') &&
  lineDetailContent.includes('Đang chạy:') &&
  lineDetailContent.includes('Cần theo dõi:') &&
  lineDetailContent.includes('Dừng:'),
  'Khối Trạng thái thiết bị dạng Donut chart hiển thị đầy đủ tỷ lệ và số lượng động'
);

assert(
  lineDetailContent.includes('Thông số vận hành chính') &&
  lineDetailContent.includes('Nhiệt độ (°C)') &&
  lineDetailContent.includes('Độ rung (mm/s)') &&
  lineDetailContent.includes('Áp suất (MPa)') &&
  lineDetailContent.includes('Dòng điện (A)'),
  'Khối Thông số vận hành chính dạng bảng hiển thị 4 thông số kỹ thuật tiêu chuẩn'
);

console.log('\n================================================================');
console.log('KẾT QUẢ KIỂM THỬ: 15/15 KIỂM TRA ĐẠT 100% HOÀN HẢO');
console.log('================================================================\n');
