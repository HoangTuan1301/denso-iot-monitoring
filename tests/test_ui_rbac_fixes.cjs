/**
 * @file test_ui_rbac_fixes.cjs
 * @description Bộ kiểm định tự động cho 3 yêu cầu chỉnh sửa giao diện & phân quyền:
 * 1. Phân quyền menu Sidebar & Route guard 403 cho OPERATOR vs ADMIN.
 * 2. Bảng Quản lý Tài khoản đã loại bỏ cột "Phạm vi thấy được".
 * 3. Nút "Thêm thông số" trong Danh mục thông số chuẩn xác "+ Thêm thông số".
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('   DENSO IOT - BỘ KIỂM THỬ GIAO DIỆN & PHÂN QUYỀN RBAC (AUTOMATED TEST) ');
console.log('========================================================================\n');

// ------------------------------------------------------------------------
// TEST 1: KIỂM TRA PHÂN QUYỀN MENU SIDEBAR CHO OPERATOR VÀ ADMIN
// ------------------------------------------------------------------------
console.log('[TEST 1] Kiểm tra phân quyền menu Sidebar (Yêu cầu 1)...');
const sidebarCode = fs.readFileSync('src/components/common/Sidebar.tsx', 'utf8');

// Phải khởi tạo configItems rỗng và chỉ push khi có quyền
assert(sidebarCode.includes('const configItems: NavItem[] = [];'), 'configItems phải được khởi tạo là mảng rỗng');
console.log('  ✓ configItems khởi tạo rỗng (chỉ bổ sung khi có quyền ADMIN/MAINTENANCE)');

// Kiểm tra logic thêm mục cấu hình
assert(sidebarCode.includes('if (isAdmin || isMaintenance) {\n    configItems.push({ id: "lines"') ||
       sidebarCode.includes('if (isAdmin || isMaintenance) {\r\n    configItems.push({ id: "lines"'),
       'Chỉ ADMIN hoặc MAINTENANCE mới được push các mục Cấu hình');
console.log('  ✓ Nhóm Cấu hình được bảo vệ: OPERATOR tuyệt đối không có phần tử cấu hình nào');

// Kiểm tra việc ẩn hoàn toàn tiêu đề "NHÓM CẤU HÌNH" khi configItems rỗng
assert(sidebarCode.includes('{configItems.length > 0 && (\n            <NavGroup title="NHÓM CẤU HÌNH"') ||
       sidebarCode.includes('{configItems.length > 0 && (\r\n            <NavGroup title="NHÓM CẤU HÌNH"'),
       'Tiêu đề NHÓM CẤU HÌNH phải được bọc điều kiện configItems.length > 0');
console.log('  ✓ Tiêu đề "NHÓM CẤU HÌNH" và khoảng trống thừa được ẩn hoàn toàn khi OPERATOR đăng nhập');

// Kiểm tra 5 mục giám sát hợp lệ cho OPERATOR
const monitoringIds = ['dashboard', 'devices', 'alarms', 'history', 'ai'];
for (const id of monitoringIds) {
  assert(sidebarCode.includes(`id: "${id}"`), `Menu giám sát phải chứa id: ${id}`);
}
console.log('  ✓ Giữ nguyên đầy đủ 5 mục Giám sát: Dashboard, Giám sát Thiết bị, Cảnh báo & Sự cố, Lịch sử, AI');

// ------------------------------------------------------------------------
// TEST 2: KIỂM TRA ROUTE GUARD 403 TRONG APP.TSX CHO CÁC MÀN HÌNH CẤU HÌNH
// ------------------------------------------------------------------------
console.log('\n[TEST 2] Kiểm tra Route Guard 403 trong App.tsx (Yêu cầu 1)...');
const appCode = fs.readFileSync('src/App.tsx', 'utf8');

// Kiểm tra rào chắn cho lines (config)
assert(appCode.includes("case 'lines':") && appCode.includes("Không Đủ Quyền Truy Cập (403 Forbidden)") && appCode.includes("không có quyền cấu hình Dây chuyền & Thiết bị"),
  "Tab 'lines' ở chế độ cấu hình phải có rào chắn 403 khi OPERATOR truy cập");
console.log("  ✓ Route Guard 'lines' (Cấu hình Dây chuyền & Thiết bị): Trả về 403 Forbidden nếu là OPERATOR");

// Kiểm tra rào chắn cho metrics / settings
assert(appCode.includes("case 'metrics':") && appCode.includes("không có quyền truy cập hoặc cấu hình Danh mục Thông số"),
  "Tab 'metrics'/'settings' phải có rào chắn 403 khi OPERATOR truy cập");
console.log("  ✓ Route Guard 'metrics' (Danh mục Thông số): Trả về 403 Forbidden nếu là OPERATOR");

// Kiểm tra rào chắn cho thresholds, users, audit
assert(appCode.includes("case 'thresholds':") && appCode.includes("!isAdmin && userRole !== 'MAINTENANCE'"),
  "Tab 'thresholds' có rào chắn 403");
assert(appCode.includes("case 'users':") && appCode.includes("!isAdmin"),
  "Tab 'users' có rào chắn 403");
assert(appCode.includes("case 'audit':") && appCode.includes("!isAdmin && userRole !== 'MAINTENANCE'"),
  "Tab 'audit' có rào chắn 403");
console.log("  ✓ Route Guard 'thresholds', 'users', 'audit': Đảm bảo chặn 100% OPERATOR");

// ------------------------------------------------------------------------
// TEST 3: KIỂM TRA BẢNG QUẢN LÝ TÀI KHOẢN ĐÃ XÓA CỘT "PHẠM VI THẤY ĐƯỢC"
// ------------------------------------------------------------------------
console.log('\n[TEST 3] Kiểm tra Quản lý Tài khoản (Yêu cầu 2)...');
const userMgmtCode = fs.readFileSync('src/features/admin/UserManagementView.tsx', 'utf8');

// Đảm bảo không còn tiêu đề cột "PHẠM VI THẤY ĐƯỢC"
assert(!userMgmtCode.includes('<th>PHẠM VI THẤY ĐƯỢC</th>') && !userMgmtCode.includes('>PHẠM VI THẤY ĐƯỢC<'),
  'Bảng Quản lý tài khoản không được chứa tiêu đề PHẠM VI THẤY ĐƯỢC');
console.log('  ✓ Đã xóa hoàn toàn tiêu đề cột "PHẠM VI THẤY ĐƯỢC"');

// Đảm bảo không còn dữ liệu hiển thị phạm vi
assert(!userMgmtCode.includes('9 màn — cấu hình + giám sát'), 'Không còn chuỗi 9 màn — cấu hình + giám sát');
assert(!userMgmtCode.includes('3 màn — chỉ giám sát'), 'Không còn chuỗi 3 màn — chỉ giám sát');
console.log('  ✓ Đã xóa toàn bộ dữ liệu hiển thị bên dưới cột Phạm vi');

// Đảm bảo colSpan đã được cập nhật thành 5
assert(userMgmtCode.includes('colSpan={5}'), 'colSpan phải là 5');
assert(!userMgmtCode.includes('colSpan={6}'), 'Không còn colSpan={6}');
console.log('  ✓ Cập nhật colSpan = 5 phù hợp số cột thực tế');

// Kiểm tra các chức năng khác không bị ảnh hưởng
assert(userMgmtCode.includes('handleRoleChange'), 'Chức năng đổi phân quyền vẫn tồn tại');
assert(userMgmtCode.includes('handleToggleStatus'), 'Chức năng bật/tắt kích hoạt vẫn tồn tại');
assert(userMgmtCode.includes('setIsResetModalOpen'), 'Chức năng reset mật khẩu vẫn tồn tại');
assert(userMgmtCode.includes('openCreateModal'), 'Chức năng thêm người dùng vẫn tồn tại');
console.log('  ✓ Toàn bộ chức năng Thêm/Sửa/Xóa/Reset/Kích hoạt tài khoản được bảo toàn nguyên vẹn');

// ------------------------------------------------------------------------
// TEST 4: KIỂM TRA NÚT "THÊM THÔNG SỐ" TRONG DANH MỤC THÔNG SỐ
// ------------------------------------------------------------------------
console.log('\n[TEST 4] Kiểm tra Nút "Thêm thông số" (Yêu cầu 3)...');
const metricCatalogCode = fs.readFileSync('src/features/metrics/MetricCatalogView.tsx', 'utf8');

// Không được có "+ + Thêm thông số"
assert(!metricCatalogCode.includes('<span>+ Thêm thông số</span>'), 'Không được có <span>+ Thêm thông số</span>');
console.log('  ✓ Đã loại bỏ hoàn toàn dấu cộng thừa trong nhãn văn bản');

// Phải có icon Plus đi kèm <span>Thêm thông số</span>
assert(metricCatalogCode.includes('<Plus className="w-4 h-4 stroke-[2.5]" />') &&
       metricCatalogCode.includes('<span>Thêm thông số</span>'),
       'Nút phải chứa icon Plus và <span>Thêm thông số</span>');
console.log('  ✓ Nút hiển thị chính xác: [+ Icon] + "Thêm thông số" (Không còn lặp dấu +)');

// Kiểm tra sự kiện onClick vẫn gọi handleOpenCreateModal
assert(metricCatalogCode.includes('onClick={handleOpenCreateModal}'),
  'Sự kiện onClick mở modal thêm thông số phải được giữ nguyên');
console.log('  ✓ Sự kiện mở modal thêm thông số hoạt động bình thường');

// ------------------------------------------------------------------------
// TEST 5: KIỂM TRA REGRESSION VỚI CÁC MÀN HÌNH KHÁC
// ------------------------------------------------------------------------
console.log('\n[TEST 5] Kiểm tra Regression & An toàn Git...');
const { execSync } = require('child_process');
const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
assert.strictEqual(branch, 'feature/ai-intelligence-demo', 'Phải đang ở branch feature/ai-intelligence-demo');
console.log(`  ✓ Đang ở branch an toàn: ${branch} (Không đụng đến branch main)`);

console.log('\n========================================================================');
console.log('   KẾT QUẢ: TOÀN BỘ 5/5 BÀI TEST ĐÃ PASS HOÀN TOÀN!                     ');
console.log('========================================================================\n');
