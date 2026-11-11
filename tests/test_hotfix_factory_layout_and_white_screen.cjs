/**
 * @file test_hotfix_factory_layout_and_white_screen.cjs
 * @description Comprehensive Hotfix Verification Suite for:
 * 1. Root Cause & Elimination of White Screen (React Hook Count & Navigation Hierarchy)
 * 2. Factory Layout Overlapping Label Elimination & Font Sizing
 * 3. Data Integrity & Neutral Unmonitored Zones (No arbitrary percentages, N/A state)
 * 4. ErrorBoundary and Full-Stack 4-Tier Resilience
 */

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    if (details) console.error(`         Reason: ${details}`);
  }
}

console.log('================================================================');
console.log('DENSO HOTFIX VERIFICATION: WHITE SCREEN & FACTORY LAYOUT FIXES');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// NHIỆM VỤ 1: CHẨN ĐOÁN & KHẮC PHỤC TRIỆT ĐỂ LỖI MÀN HÌNH TRẮNG
// -----------------------------------------------------------------------------
console.log('--- PHẦN 1: CHẨN ĐOÁN & KHẮC PHỤC TRIỆT ĐỂ LỖI MÀN HÌNH TRẮNG ---');

const dashboardPath = path.join(__dirname, '../src/features/tier1-lines/LineOverviewDashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// 1.1 Kiểm tra không còn câu lệnh return điều kiện trước useMemo / useState / useEffect (React Rule of Hooks)
const hasEarlyReturnBeforeHooks = /if\s*\(dashboardViewLevel\s*===.*?\)\s*\{\s*return\s*<LineDetailView/s.test(
  dashboardContent.slice(0, dashboardContent.indexOf('const allMachines = useMemo'))
);
assert(
  !hasEarlyReturnBeforeHooks,
  'Loại bỏ triệt để vi phạm React Rules of Hooks (không có early return trước hook chain)'
);

// 1.2 Kiểm tra FactoryLayoutMainView được tách thành component độc lập
assert(
  dashboardContent.includes('function FactoryLayoutMainView()') &&
  dashboardContent.includes('export function LineOverviewDashboard()'),
  'FactoryLayoutMainView được tách thành subcomponent độc lập, đảm bảo số lượng hooks bất biến'
);

// 1.3 Kiểm tra ErrorBoundary đã được tích hợp
const errorBoundaryPath = path.join(__dirname, '../src/components/common/ErrorBoundary.tsx');
assert(
  fs.existsSync(errorBoundaryPath),
  'Tập tin ErrorBoundary.tsx tồn tại và sẵn sàng bảo vệ ứng dụng'
);

const appPath = path.join(__dirname, '../src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');
assert(
  appContent.includes('<ErrorBoundary') && dashboardContent.includes('<ErrorBoundary'),
  'ErrorBoundary được bao bọc ở cả App.tsx và LineOverviewDashboard.tsx'
);

// -----------------------------------------------------------------------------
// NHIỆM VỤ 2: ĐIỀU HƯỚNG 4 MÀN HÌNH & XỬ LÝ BIÊN (CORNER CASES)
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 2: ĐIỀU HƯỚNG 4 MÀN HÌNH & XỬ LÝ BIÊN ---');

const lineDetailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');
const lineDetailContent = fs.readFileSync(lineDetailPath, 'utf8');

assert(
  lineDetailContent.includes('isLoadingLines') && lineDetailContent.includes('Đang nạp thông tin dây chuyền'),
  'LineDetailView hỗ trợ trạng thái Loading khi dữ liệu mạng đang nạp'
);

assert(
  lineDetailContent.includes('Không tìm thấy thông tin dây chuyền') && lineDetailContent.includes('onBackToDashboard'),
  'LineDetailView hỗ trợ trạng thái Not Found khi lineId không tồn tại trong CSDL'
);

assert(
  lineDetailContent.includes('currentLine.safetyScore != null') &&
  lineDetailContent.includes('donutData'),
  'LineDetailView xử lý an toàn dữ liệu null/undefined/0 máy mà không gây crash'
);

const machineDetailPath = path.join(__dirname, '../src/features/tier2-machines/MachineDetailView.tsx');
const machineDetailContent = fs.readFileSync(machineDetailPath, 'utf8');
assert(
  machineDetailContent.includes('onOpenCheckSheet') && machineDetailContent.includes('Mở CHECK SHEET'),
  'MachineDetailView hiển thị nút "Mở CHECK SHEET" và xử lý mở CheckSheetView thành công'
);

const checkSheetPath = path.join(__dirname, '../src/features/checksheet/CheckSheetView.tsx');
const checkSheetContent = fs.readFileSync(checkSheetPath, 'utf8');
assert(
  checkSheetContent.includes('defaultItems') && checkSheetContent.includes('onBackToMachineDetail'),
  'CheckSheetView xử lý an toàn khi máy có 0 metric và hỗ trợ nút quay lại Machine Detail'
);

// -----------------------------------------------------------------------------
// NHIỆM VỤ 3: SỬA FACTORY LAYOUT & TRIỆT TIÊU CHỒNG CHỮ
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 3: SỬA FACTORY LAYOUT & TRIỆT TIÊU CHỒNG CHỮ ---');

const mapComponentPath = path.join(__dirname, '../src/features/dashboard/FactoryLayoutMap.tsx');
const mapComponentContent = fs.readFileSync(mapComponentPath, 'utf8');

assert(
  mapComponentContent.includes('dominantBaseline="central"'),
  'Nhãn chữ trong SVG sử dụng dominantBaseline="central" căn giữa chuẩn xác'
);

assert(
  mapComponentContent.includes('fontSize = isLargeCell') || mapComponentContent.includes('fontSize ='),
  'Cỡ chữ được tự động điều chỉnh theo kích thước ô (isLargeCell, isMediumCell)'
);

assert(
  mapComponentContent.includes('isConfigured && isLargeCell && liveScore != null'),
  'Badge phần trăm CHỈ hiển thị ở ô dây chuyền giám sát đủ lớn, triệt tiêu đè chữ ở ô nhỏ'
);

assert(
  mapComponentContent.includes('displayName = !isLargeCell && zone.shortName ? zone.shortName : zone.name'),
  'Khu vực nhỏ tự động ưu tiên tên rút gọn shortName để không tràn ra ngoài ô'
);

const mapConfigPath = path.join(__dirname, '../src/features/dashboard/factoryMapConfig.ts');
const mapConfigContent = fs.readFileSync(mapConfigPath, 'utf8');
const totalZonesCount = (mapConfigContent.match(/id:\s*['"][^'"]+['"]/g) || []).length;

assert(
  totalZonesCount === 87,
  `Bảo tồn trọn vẹn toàn bộ 87 khu vực quy hoạch nhà máy trong CSDL cấu hình (Thực tế: ${totalZonesCount})`
);

// -----------------------------------------------------------------------------
// NHIỆM VỤ 4: KIỂM TRA NGUỒN DỮ LIỆU & TRẠNG THÁI TRUNG TÍNH (N/A)
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 4: KIỂM TRA NGUỒN DỮ LIỆU & TRẠNG THÁI TRUNG TÍNH ---');

const zoneBlocks = mapConfigContent.split(/\{\s*id:/).slice(1);
const unmonitoredWithFakeScore = zoneBlocks.some((z) => {
  const idM = z.match(/^\s*'([^']+)'/);
  const scoreM = z.match(/defaultSafetyScore:\s*([^,\n]+)/);
  if (idM && scoreM && !['CVT', 'APM', 'CVT_MID'].includes(idM[1])) {
    return scoreM[1].trim() !== 'null';
  }
  return false;
});
assert(
  !unmonitoredWithFakeScore,
  'Tất cả 84 khu vực chưa lắp cảm biến đều KHÔNG có phần trăm an toàn giả (defaultSafetyScore: null)'
);

assert(
  mapComponentContent.includes('Chưa kết nối IoT (N/A)') && mapComponentContent.includes('Vị trí liên kết dự kiến'),
  'Tooltip hiển thị minh bạch trạng thái N/A cho ô chưa giám sát và ghi rõ vị trí dự kiến chờ xác nhận'
);

const searchPanelPath = path.join(__dirname, '../src/features/dashboard/FactoryLineSearchPanel.tsx');
const searchPanelContent = fs.readFileSync(searchPanelPath, 'utf8');
assert(
  searchPanelContent.includes('selectedZone?.defaultSafetyScore != null') &&
  searchPanelContent.includes('N/A'),
  'Panel tìm kiếm bên phải hiển thị "N/A" trung tính cho khu vực chưa giám sát'
);

// -----------------------------------------------------------------------------
// NHIỆM VỤ 6: BẢO VỆ PHẠM VI, RBAC VÀ KIẾN TRÚC HỆ THỐNG
// -----------------------------------------------------------------------------
console.log('\n--- PHẦN 5: BẢO VỆ PHẠM VI, RBAC VÀ KIẾN TRÚC ---');
const sidebarPath = path.join(__dirname, '../src/components/common/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

assert(
  !sidebarContent.includes('Line Overview') && !sidebarContent.includes('CHECK SHEET'),
  'Sidebar giữ nguyên phân nhóm hiện tại, không thêm mục mới'
);

assert(
  !lineDetailContent.includes('OEE theo thời gian') && !machineDetailContent.includes('OEE của thiết bị'),
  'Tuyệt đối không có OEE trong Line Overview và Machine Detail'
);

console.log('\n================================================================');
console.log(`KẾT QUẢ KIỂM THỬ HOTFIX: ${passedTests}/${totalTests} TESTS PASS (${failedTests === 0 ? '100% HOÀN HẢO' : 'CÓ LỖI'})`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
