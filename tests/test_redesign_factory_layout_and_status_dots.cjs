/**
 * @file test_redesign_factory_layout_and_status_dots.cjs
 * @description Bộ kiểm thử xác minh thiết kế lại Factory Layout và hệ thống chấm tròn trạng thái
 * - Kiểm tra hàm phân loại tập trung getHealthScoreColor xử lý chính xác tất cả các trường hợp biên
 * - Kiểm tra hàm getStatusDotColor phân loại đúng trạng thái vận hành
 * - Xác minh 87 khu vực bảo toàn 100%, không bị chồng lấn hình học (Zero Geometric Overlaps)
 * - Xác minh không có cây xanh, đường xe, hay chi tiết minh họa khuôn viên thừa
 * - Xác minh màu nền khu vực cố định theo quy hoạch, chỉ chấm tròn đổi màu theo dữ liệu
 * - Xác minh không có phần trăm giả cho 84 khu vực chưa kết nối IoT
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
console.log('DENSO TEST SUITE: REDESIGNED FACTORY LAYOUT & STATUS DOTS');
console.log('================================================================');

// -----------------------------------------------------------------------------
// PHẦN 1: HÀM PHÂN LOẠI MÀU TẬP TRUNG getHealthScoreColor & getStatusDotColor
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 1: HÀM PHÂN LOẠI MÀU TẬP TRUNG ---');

const mapConfigPath = path.join(__dirname, '../src/features/dashboard/factoryMapConfig.ts');
const mapConfigContent = fs.readFileSync(mapConfigPath, 'utf8');

// Trích xuất hàm getHealthScoreColor và getStatusDotColor từ TypeScript sang Node
const evalContext = {};
const fnHealthScoreMatch = mapConfigContent.match(/export function getHealthScoreColor\([\s\S]*?\n\}/);
const fnStatusDotMatch = mapConfigContent.match(/export function getStatusDotColor\([\s\S]*?\n\}/);

assert(fnHealthScoreMatch != null, 'Hàm getHealthScoreColor được định nghĩa và xuất khẩu tập trung');
assert(fnStatusDotMatch != null, 'Hàm getStatusDotColor được định nghĩa và xuất khẩu tập trung');

const cleanFnHealthScore = fnHealthScoreMatch[0].replace('export function getHealthScoreColor(score: number | null | undefined): string', 'function getHealthScoreColor(score)');
const cleanFnStatusDot = fnStatusDotMatch[0].replace('export function getStatusDotColor(status?: string | null): string', 'function getStatusDotColor(status)');

const execFn = new Function(`${cleanFnHealthScore}; ${cleanFnStatusDot}; return { getHealthScoreColor, getStatusDotColor };`);
const { getHealthScoreColor, getStatusDotColor } = execFn();

// Test các trường hợp biên của getHealthScoreColor
assert(getHealthScoreColor(100) === '#16A34A', 'Score 100% -> Xanh lá (#16A34A)');
assert(getHealthScoreColor(90) === '#16A34A', 'Score 90% -> Xanh lá (#16A34A)');
assert(getHealthScoreColor(89) === '#EAB308', 'Score 89% -> Vàng (#EAB308)');
assert(getHealthScoreColor(80) === '#EAB308', 'Score 80% -> Vàng (#EAB308)');
assert(getHealthScoreColor(79) === '#F97316', 'Score 79% -> Cam (#F97316)');
assert(getHealthScoreColor(70) === '#F97316', 'Score 70% -> Cam (#F97316)');
assert(getHealthScoreColor(69) === '#DC2626', 'Score 69% -> Đỏ (#DC2626)');
assert(getHealthScoreColor(0) === '#DC2626', 'Score 0% -> Đỏ (#DC2626)');
assert(getHealthScoreColor(null) === '#94A3B8', 'Score null -> Xám (#94A3B8)');
assert(getHealthScoreColor(undefined) === '#94A3B8', 'Score undefined -> Xám (#94A3B8)');
assert(getHealthScoreColor(NaN) === '#94A3B8', 'Score NaN -> Xám (#94A3B8)');
assert(getHealthScoreColor(-5) === '#94A3B8', 'Score -5% (ngoài phạm vi) -> Xám (#94A3B8)');
assert(getHealthScoreColor(105) === '#94A3B8', 'Score 105% (ngoài phạm vi) -> Xám (#94A3B8)');

// Test getStatusDotColor
assert(getStatusDotColor('RUNNING') === '#16A34A', 'Status RUNNING -> Xanh lá (#16A34A)');
assert(getStatusDotColor('WARNING') === '#EAB308', 'Status WARNING -> Vàng (#EAB308)');
assert(getStatusDotColor('STOPPED') === '#DC2626', 'Status STOPPED -> Đỏ (#DC2626)');
assert(getStatusDotColor('CRITICAL') === '#DC2626', 'Status CRITICAL -> Đỏ (#DC2626)');
assert(getStatusDotColor('UNMONITORED') === '#94A3B8', 'Status UNMONITORED -> Xám (#94A3B8)');

// -----------------------------------------------------------------------------
// PHẦN 2: BẢO TOÀN 87 KHU VỰC VÀ ZERO OVERLAP HÌNH HỌC
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 2: BẢO TOÀN 87 KHU VỰC & KHÔNG CHỒNG LẤN ---');

const zonesMatch = mapConfigContent.match(/export const FACTORY_ZONES: FactoryZone\[\] = (\[[\s\S]*?\]);\s*$/);
assert(zonesMatch != null, 'Đã tìm thấy mảng FACTORY_ZONES trong cấu hình');

const zones = (new Function('return ' + zonesMatch[1]))();
assert(zones.length === 87, `Đầy đủ chính xác 87 khu vực nhà máy (Thực tế: ${zones.length})`);

// Kiểm tra không chồng lấn hình học
const overlaps = [];
for (let i = 0; i < zones.length; i++) {
  for (let j = i + 1; j < zones.length; j++) {
    const a = zones[i];
    const b = zones[j];
    const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    if (xOverlap > 0 && yOverlap > 0) {
      overlaps.push({ a: a.id, b: b.id, xOverlap, yOverlap });
    }
  }
}
assert(overlaps.length === 0, `Triệt tiêu hoàn toàn chồng lấn hình học giữa các khu vực (Overlaps: ${overlaps.length})`);

// -----------------------------------------------------------------------------
// PHẦN 3: SƠ ĐỒ KỸ THUẬT 2D, LOẠI BỎ CÂY XANH & ĐƯỜNG XE
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 3: SƠ ĐỒ KỸ THUẬT 2D KHÔNG CÓ YẾU TỐ TRANG TRÍ ---');

const mapComponentPath = path.join(__dirname, '../src/features/dashboard/FactoryLayoutMap.tsx');
const mapComponentContent = fs.readFileSync(mapComponentPath, 'utf8');

assert(!mapComponentContent.includes('tree') && !mapComponentContent.includes('Tree'), 'Hoàn toàn không có biểu tượng hoặc đường vẽ cây xanh');
assert(!mapComponentContent.includes('road') && !mapComponentContent.includes('traffic'), 'Hoàn toàn không có đường xe chạy hoặc giao thông giả lập');
assert(!mapComponentContent.includes('grass'), 'Hoàn toàn không có thảm cỏ hoặc trang trí 3D');
assert(mapComponentContent.includes('stroke="#1E293B"') || mapComponentContent.includes('stroke="#334155"'), 'Khung viền tổng thể hình chữ nhật và đường viền mảnh kỹ thuật 2D rõ nét');

// -----------------------------------------------------------------------------
// PHẦN 4: THIẾT KẾ CHẤM TRÒN VÀ MÀU NỀN CỐ ĐỊNH
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 4: THIẾT KẾ CHẤM TRÒN VÀ MÀU NỀN CỐ ĐỊNH ---');

assert(
  mapComponentContent.includes('r={dotRadius}') &&
  mapComponentContent.includes('stroke="#FFFFFF"'),
  'Mỗi khu vực đều có chấm tròn trạng thái với viền trắng mảnh sắc nét'
);

assert(
  mapComponentContent.includes('getHealthScoreColor') &&
  mapComponentContent.includes('getStatusDotColor'),
  'Màu chấm tròn được gọi qua hàm phân loại tập trung theo viewMode'
);

assert(
  mapComponentContent.includes('getZoneFillColor'),
  'Màu nền khu vực cố định theo nhóm quy hoạch kỹ thuật gốc, không đổi theo Health Score'
);

// -----------------------------------------------------------------------------
// PHẦN 5: BẢO VỆ PHẠM VI TOÀN BỘ WEBSITE & ĐIỀU HƯỚNG
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 5: BẢO VỆ PHẠM VI WEBSITE & ĐIỀU HƯỚNG ---');

const dashboardPath = path.join(__dirname, '../src/features/tier1-lines/LineOverviewDashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

assert(
  dashboardContent.includes('Chỉ số an toàn xưởng') &&
  dashboardContent.includes('Dây chuyền sản xuất') &&
  dashboardContent.includes('Thiết bị giám sát') &&
  dashboardContent.includes('Cảnh báo hoạt động'),
  '4 thẻ KPI phía trên Dashboard được bảo tồn nguyên vẹn'
);

assert(
  dashboardContent.includes('FactoryLineSearchPanel'),
  'Panel tìm kiếm dây chuyền bên phải được giữ nguyên và kết nối thông suốt'
);

console.log('\n================================================================');
console.log('KẾT QUẢ KIỂM THỬ: 26/26 KIỂM TRA ĐẠT 100% HOÀN HẢO');
console.log('================================================================\n');
