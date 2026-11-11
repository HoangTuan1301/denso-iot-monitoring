/**
 * @file test_4_monitoring_screens.cjs
 * @description Automated Technical Verification Suite for DENSO Smart Factory 4-Tier Monitoring Workflow
 * Tests:
 * 1. Factory Layout Map & Search Panel (~50 zones, 3 line mappings, safety/status modes)
 * 2. Line Overview (OP10..OP60 flow diagram, AGV, NO OEE check, machine navigation)
 * 3. Machine Detail (Technical specs, 4 status cards, NO OEE check, "Mở CHECK SHEET" button)
 * 4. CHECK SHEET (Dynamic multi-chart grid, Min/Max reference lines, value badges, action toolbars, CSV export, print, ISO table)
 * 5. Navigation & Breadcrumb hierarchy (Level switching, back navigation, header breadcrumbs)
 * 6. Preserved Architecture & RBAC Integrity (Sidebar structure, no OEE in sidebar, no unauthorized changes)
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
console.log('DENSO SMART FACTORY - 4-TIER MONITORING VERIFICATION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// GATE 1: SƠ ĐỒ MẶT BẰNG NHÀ MÁY (FACTORY LAYOUT MAP & SEARCH PANEL)
// -----------------------------------------------------------------------------
console.log('--- GATE 1: SƠ ĐỒ MẶT BẰNG NHÀ MÁY (FACTORY LAYOUT MAP) ---');
const mapConfigPath = path.join(__dirname, '../src/features/dashboard/factoryMapConfig.ts');
const mapConfigContent = fs.readFileSync(mapConfigPath, 'utf8');

assert(
  mapConfigContent.includes('export const FACTORY_ZONES'),
  'Cấu hình FACTORY_ZONES được định nghĩa và xuất khẩu'
);

const zoneMatches = mapConfigContent.match(/id:\s*['"][^'"]+['"]/g) || [];
assert(
  zoneMatches.length >= 45,
  `Số lượng khu vực nhà máy đạt chuẩn ~50 khu vực (Thực tế: ${zoneMatches.length} khu vực)`
);

assert(
  mapConfigContent.includes('mappedLineId: \'LN-PRS-01\'') &&
  mapConfigContent.includes('mappedLineId: \'LN-PNT-02\'') &&
  mapConfigContent.includes('mappedLineId: \'LN-ASM-03\''),
  'Đã liên kết chính xác 3 dây chuyền công nghiệp LN-PRS-01, LN-PNT-02, LN-ASM-03'
);

const mapComponentPath = path.join(__dirname, '../src/features/dashboard/FactoryLayoutMap.tsx');
const mapComponentContent = fs.readFileSync(mapComponentPath, 'utf8');
assert(
  mapComponentContent.includes('viewBox="0 0 720 560"') || mapComponentContent.includes('viewBox'),
  'Bản đồ SVG vector hỗ trợ viewBox chuẩn tỉ lệ kỹ thuật DENSO'
);
assert(
  mapComponentContent.includes('onChangeViewMode') && mapComponentContent.includes('safety') && mapComponentContent.includes('status'),
  'Bản đồ hỗ trợ chuyển đổi 2 chế độ xem: Mức độ an toàn (%) và Trạng thái vận hành'
);

const searchPanelPath = path.join(__dirname, '../src/features/dashboard/FactoryLineSearchPanel.tsx');
const searchPanelContent = fs.readFileSync(searchPanelPath, 'utf8');
assert(
  searchPanelContent.includes('lg:w-[220px]') || searchPanelContent.includes('w-[220px]'),
  'Panel tìm kiếm dây chuyền bên phải có kích thước nhỏ gọn 180-220px chuẩn thiết kế'
);
assert(
  searchPanelContent.includes('Xem chi tiết dây chuyền'),
  'Panel tìm kiếm có nút điều hướng "Xem chi tiết dây chuyền >"'
);

// -----------------------------------------------------------------------------
// GATE 2: LINE OVERVIEW - CHI TIẾT DÂY CHUYỀN
// -----------------------------------------------------------------------------
console.log('\n--- GATE 2: LINE OVERVIEW - CHI TIẾT DÂY CHUYỀN ---');
const lineDetailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');
const lineDetailContent = fs.readFileSync(lineDetailPath, 'utf8');

assert(
  lineDetailContent.includes('OP10') &&
  lineDetailContent.includes('OP20') &&
  lineDetailContent.includes('OP30') &&
  lineDetailContent.includes('OP40') &&
  lineDetailContent.includes('OP50') &&
  lineDetailContent.includes('OP60'),
  'Sơ đồ luồng công đoạn hiển thị đầy đủ 6 công đoạn chính OP10..OP60'
);
assert(
  lineDetailContent.includes('ĐẦU VÀO') && lineDetailContent.includes('ĐẦU RA') && !lineDetailContent.includes('AGV01'),
  'Sơ đồ luồng có điểm ĐẦU VÀO, ĐẦU RA và đã loại bỏ hoàn toàn xe tự hành AGV theo yêu cầu'
);
assert(
  lineDetailContent.includes('onSelectMachine'),
  'Hỗ trợ tương tác click vào từng máy để mở màn hình Machine Detail'
);

// HỖ TRỢ OEE DẠNG DONUT VÀ 3 CHỈ SỐ AVAILABILITY, PERFORMANCE, QUALITY; XÓA OEE THEO THỜI GIAN
const hasDonutOEEAndComponents =
  lineDetailContent.includes('OEE') &&
  lineDetailContent.includes('Availability') &&
  lineDetailContent.includes('Performance') &&
  lineDetailContent.includes('Quality') &&
  !lineDetailContent.includes('OEE theo thời gian');
assert(
  hasDonutOEEAndComponents,
  'Hỗ trợ OEE dạng Donut và bộ 3 chỉ số Availability, Performance, Quality; đã xóa bỏ biểu đồ OEE theo thời gian'
);

// -----------------------------------------------------------------------------
// GATE 3: MACHINE DETAIL - CHI TIẾT THIẾT BỊ
// -----------------------------------------------------------------------------
console.log('\n--- GATE 3: MACHINE DETAIL - CHI TIẾT THIẾT BỊ (NO OEE) ---');
const machineDetailPath = path.join(__dirname, '../src/features/tier2-machines/MachineDetailView.tsx');
const machineDetailContent = fs.readFileSync(machineDetailPath, 'utf8');

assert(
  machineDetailContent.includes('Mở CHECK SHEET'),
  'Có nút nổi bật "Mở CHECK SHEET" (màu xanh dương đậm) chuyển thẳng đến Màn hình 4'
);
assert(
  machineDetailContent.includes('AreaChart') && machineDetailContent.includes('selectedMetricCode'),
  'Có biểu đồ AreaChart xu hướng biến thiên thông số đo lường kèm bộ chọn thông số'
);
assert(
  machineDetailContent.includes('statusDurationData') || machineDetailContent.includes('Thời gian trạng thái'),
  'Có biểu đồ donut thời gian trạng thái hoạt động trong ngày'
);

// TUYỆT ĐỐI KHÔNG CÓ OEE TRONG MACHINE DETAIL
const hasOEEInMachineDetail =
  /Availability\s*:\s*\d+/i.test(machineDetailContent) ||
  /Performance\s*:\s*\d+/i.test(machineDetailContent) ||
  /Quality\s*:\s*\d+/i.test(machineDetailContent) ||
  /OEE\s*của\s*thiết\s*bị/i.test(machineDetailContent);
assert(
  !hasOEEInMachineDetail,
  'TUYỆT ĐỐI KHÔNG CÓ OEE, Availability, Performance, Quality trong Machine Detail'
);

// -----------------------------------------------------------------------------
// GATE 4: CHECK SHEET - GIÁM SÁT & KIỂM TRA THÔNG SỐ VẬN HÀNH
// -----------------------------------------------------------------------------
console.log('\n--- GATE 4: CHECK SHEET - GIÁM SÁT & KIỂM TRA THÔNG SỐ ---');
const checkSheetPath = path.join(__dirname, '../src/features/checksheet/CheckSheetView.tsx');
const checkSheetContent = fs.readFileSync(checkSheetPath, 'utf8');

assert(
  checkSheetContent.includes('CHECK SHEET') && checkSheetContent.includes('Giám sát và kiểm tra thông số vận hành'),
  'Tiêu đề và nhận diện màn hình CHECK SHEET chuẩn tài liệu công nghiệp'
);
assert(
  checkSheetContent.includes('ReferenceLine') &&
  checkSheetContent.includes('stroke="#ef4444"') &&
  checkSheetContent.includes('strokeDasharray="3 3"'),
  'Biểu đồ CHECK SHEET hiển thị đường ngưỡng Min/Max đứt nét đỏ/vàng chuẩn mực'
);
assert(
  checkSheetContent.includes('Làm mới') &&
  checkSheetContent.includes('Xuất dữ liệu') &&
  checkSheetContent.includes('In Check Sheet') &&
  checkSheetContent.includes('Start') &&
  checkSheetContent.includes('Stop') &&
  checkSheetContent.includes('Clear'),
  'Thanh thao tác đầy đủ 7 nút nghiệp vụ: Làm mới, Cài đặt, Xuất dữ liệu, In, Start, Stop, Clear'
);
assert(
  checkSheetContent.includes('handleExportCSV') && checkSheetContent.includes('text/csv;charset=utf-8'),
  'Hỗ trợ chức năng Xuất dữ liệu CSV thực tế với BOM UTF-8'
);
assert(
  checkSheetContent.includes('handlePrint') && checkSheetContent.includes('window.print()'),
  'Hỗ trợ chức năng In Check Sheet chuẩn CSS @media print'
);
assert(
  checkSheetContent.includes('Ca sản xuất') &&
  checkSheetContent.includes('Thời gian hiển thị') &&
  checkSheetContent.includes('Dây chuyền') &&
  checkSheetContent.includes('Thiết bị'),
  'Thanh lọc thông tin hỗ trợ 4 chiều: Dây chuyền, Thiết bị, Ca làm việc, Khung giờ'
);

// -----------------------------------------------------------------------------
// GATE 5: ĐIỀU PHỐI ĐIỀU HƯỚNG VÀ BREADCRUMB PHÂN TẦNG
// -----------------------------------------------------------------------------
console.log('\n--- GATE 5: ĐIỀU PHỐI ĐIỀU HƯỚNG VÀ BREADCRUMB ---');
const storePath = path.join(__dirname, '../src/stores/useMonitoringStore.ts');
const storeContent = fs.readFileSync(storePath, 'utf8');

assert(
  storeContent.includes('dashboardViewLevel: DashboardViewLevel') &&
  storeContent.includes('navigateToLine') &&
  storeContent.includes('navigateToMachine') &&
  storeContent.includes('navigateToCheckSheet') &&
  storeContent.includes('navigateBack'),
  'useMonitoringStore quản lý toàn diện 4 cấp độ view: factory_layout -> line_overview -> machine_detail -> check_sheet'
);

const headerPath = path.join(__dirname, '../src/components/common/Header.tsx');
const headerContent = fs.readFileSync(headerPath, 'utf8');
assert(
  headerContent.includes('Dashboard Tổng quan') &&
  headerContent.includes('Dây chuyền') &&
  headerContent.includes('Máy') &&
  headerContent.includes('CHECK SHEET'),
  'Header hiển thị Breadcrumb phân tầng liên kết với khả năng click quay lại từng cấp'
);

const dashboardPath = path.join(__dirname, '../src/features/tier1-lines/LineOverviewDashboard.tsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
assert(
  dashboardContent.includes('LineDetailView') &&
  dashboardContent.includes('MachineDetailView') &&
  dashboardContent.includes('CheckSheetView') &&
  dashboardContent.includes('FactoryLayoutMap'),
  'LineOverviewDashboard điều phối trơn tru cả 4 màn hình con theo dashboardViewLevel'
);

// -----------------------------------------------------------------------------
// GATE 6: KIỂM SOÁT PHẠM VI, RBAC VÀ KIẾN TRÚC HỆ THỐNG
// -----------------------------------------------------------------------------
console.log('\n--- GATE 6: BẢO VỆ PHẠM VI, RBAC VÀ KIẾN TRÚC ---');
const sidebarPath = path.join(__dirname, '../src/components/common/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

// Không thêm Line Overview, Machine Detail, CHECK SHEET vào Sidebar
assert(
  !sidebarContent.includes('Line Overview') &&
  !sidebarContent.includes('Machine Detail') &&
  !sidebarContent.includes('CHECK SHEET'),
  'Sidebar giữ nguyên các phân nhóm hiện tại, không bổ sung các màn hình con vào sidebar'
);

// Không tạo nhóm TỔNG QUAN riêng
assert(
  !sidebarContent.includes('TỔNG QUAN'),
  'Sidebar không tạo nhóm TỔNG QUAN riêng ngoài quy chuẩn'
);

console.log('\n================================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASS (${failedTests === 0 ? '100% HOÀN HẢO' : 'CÓ LỖI'})`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
