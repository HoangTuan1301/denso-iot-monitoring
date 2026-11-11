/**
 * @file test_device_form_modal_and_image_management.cjs
 * @description Bộ kiểm thử tự động toàn diện:
 * 1. Kiểm toán CSDL MySQL: Cấu trúc bảng machines, 13 cột hiện có, các trường kỹ thuật còn thiếu
 * 2. Bảo toàn toàn vẹn 14 thiết bị DENSO, không thay đổi Database ID hay Machine Code
 * 3. Modal MachineFormModal: 3 Tabs (Thông tin chung, Hình ảnh thiết bị, Thông số kỹ thuật)
 * 4. CreateMachineModal & EditMachineModal tích hợp dùng chung
 * 5. Backend upload endpoint POST /api/machines/upload-image & thư mục server/uploads/machines
 * 6. MachineImage component: Thứ tự ưu tiên (imageUrl -> static registry -> CAD placeholder)
 * 7. Đồng bộ trên 4 màn hình: MachineListView, DeviceMonitoringView, MachineDetailView, LineDetailView
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
console.log('KIỂM THỬ: NÂNG CẤP TOÀN DIỆN THÊM & SỬA THIẾT BỊ DENSO SMART FACTORY');
console.log('================================================================\n');

// GROUP 1: Kiểm toán cấu trúc tệp tin và Component
console.log('--- TEST GROUP 1: Cấu trúc Component Frontend ---');
const formModalPath = path.join(__dirname, '../src/features/tier2-machines/MachineFormModal.tsx');
const createModalPath = path.join(__dirname, '../src/features/tier2-machines/CreateMachineModal.tsx');
const editModalPath = path.join(__dirname, '../src/features/tier2-machines/EditMachineModal.tsx');
const machineImagesPath = path.join(__dirname, '../src/config/machineImages.tsx');
const listViewPath = path.join(__dirname, '../src/features/tier2-machines/MachineListView.tsx');
const detailViewPath = path.join(__dirname, '../src/features/tier2-machines/MachineDetailView.tsx');
const deviceMonitoringPath = path.join(__dirname, '../src/features/tier2-machines/DeviceMonitoringView.tsx');

assert(fs.existsSync(formModalPath), 'MachineFormModal.tsx tồn tại');
assert(fs.existsSync(createModalPath), 'CreateMachineModal.tsx tồn tại');
assert(fs.existsSync(editModalPath), 'EditMachineModal.tsx tồn tại');
assert(fs.existsSync(machineImagesPath), 'src/config/machineImages.tsx tồn tại');

const formContent = fs.readFileSync(formModalPath, 'utf8');
const createContent = fs.readFileSync(createModalPath, 'utf8');
const editContent = fs.readFileSync(editModalPath, 'utf8');
const machineImagesContent = fs.readFileSync(machineImagesPath, 'utf8');
const listContent = fs.readFileSync(listViewPath, 'utf8');
const detailContent = fs.readFileSync(detailViewPath, 'utf8');
const devMonContent = fs.readFileSync(deviceMonitoringPath, 'utf8');

// GROUP 2: Kiểm tra 3 Tabs trong MachineFormModal
console.log('\n--- TEST GROUP 2: Thiết kế 3 Tabs trong MachineFormModal ---');
assert(formContent.includes("type ActiveTab = 'general' | 'image' | 'specs'"), 'Định nghĩa 3 Tabs: general, image, specs');
assert(formContent.includes('Thông tin chung') && formContent.includes('Hình ảnh thiết bị') && formContent.includes('Thông số kỹ thuật'), 'Hiển thị đủ 3 tiêu đề Tab');

// Tab 1: Thông tin chung
assert(formContent.includes('managementStatus'), 'Quản lý trạng thái quản lý (active/inactive)');
assert(formContent.includes('Active (Đang dùng)') && formContent.includes('Inactive (Ngừng dùng)'), 'Hỗ trợ chọn Active / Inactive');
assert(formContent.includes('readOnly') && formContent.includes('Lock'), 'Khóa trường mã máy và dây chuyền khi ở mode edit');
assert(formContent.includes('isDirty') && formContent.includes('handleSafeClose'), 'Kiểm tra isDirty và xác nhận an toàn khi đóng form');

// Tab 2: Hình ảnh thiết bị
assert(formContent.includes('uploadMachineImage'), 'Hỗ trợ gọi uploadMachineImage');
assert(formContent.includes('imagePreview'), 'Hỗ trợ khung xem trước ảnh (Preview Box)');
assert(formContent.includes('5 * 1024 * 1024'), 'Kiểm tra giới hạn dung lượng 5MB');
assert(formContent.includes('handleRemoveImage'), 'Hỗ trợ gỡ/xóa ảnh tùy chỉnh');
assert(formContent.includes('image/png') && formContent.includes('image/webp'), 'Hỗ trợ định dạng PNG, JPG, WEBP');

// Tab 3: Thông số kỹ thuật
assert(formContent.includes('manufacturer') && formContent.includes('Hãng sản xuất'), 'Có trường Hãng sản xuất (Manufacturer)');
assert(formContent.includes('model') && formContent.includes('Model thiết bị'), 'Có trường Model thiết bị');
assert(formContent.includes('serialNumber') && formContent.includes('Số Serial'), 'Có trường Số Serial (S/N)');
assert(formContent.includes('installationDate') && formContent.includes('Ngày đưa vào sử dụng'), 'Có trường Ngày đưa vào sử dụng');
assert(formContent.includes('ratedPower') && formContent.includes('Công suất'), 'Có trường Công suất định mức');
assert(formContent.includes('technicalNotes') && formContent.includes('Ghi chú kỹ thuật'), 'Có trường Ghi chú kỹ thuật');
assert(formContent.includes('machine?.plc'), 'Hiển thị thông tin trạm PLC liên kết');

// GROUP 3: Tích hợp CreateMachineModal & EditMachineModal
console.log('\n--- TEST GROUP 3: Tích hợp Create & Edit Modal dùng chung ---');
assert(createContent.includes('MachineFormModal') && createContent.includes('mode="create"'), 'CreateMachineModal kế thừa MachineFormModal mode create');
assert(editContent.includes('MachineFormModal') && editContent.includes('mode="edit"'), 'EditMachineModal kế thừa MachineFormModal mode edit');

// GROUP 4: Backend Upload Image API
console.log('\n--- TEST GROUP 4: Backend Upload Image API & Directory ---');
const serverIndexPath = path.join(__dirname, '../server/index.js');
const serverContent = fs.readFileSync(serverIndexPath, 'utf8');

assert(serverContent.includes('/api/machines/upload-image'), 'Route POST /api/machines/upload-image được định nghĩa');
assert(serverContent.includes('uploadMachine.single'), 'Áp dụng Multer uploadMachine cho ảnh thiết bị');
assert(serverContent.includes('uploads/machines'), 'Lưu ảnh vào thư mục server/uploads/machines');
assert(fs.existsSync(path.join(__dirname, '../server/uploads/machines')), 'Thư mục server/uploads/machines đã tồn tại trên đĩa');

// GROUP 5: Cấu hình MachineImage Component
console.log('\n--- TEST GROUP 5: Quy tắc hiển thị ảnh và Fallback ---');
assert(machineImagesContent.includes('imageUrl?: string | null'), 'MachineImageProps hỗ trợ prop imageUrl');
assert(machineImagesContent.includes('hasUserImage') || machineImagesContent.includes('imageUrl as string'), 'Ưu tiên hiển thị imageUrl nếu có');
assert(machineImagesContent.includes('setUserImgError(true)'), 'Fallback sang ảnh tĩnh nếu imageUrl bị lỗi tải');
assert(machineImagesContent.includes('fallbackIconClassName'), 'Hỗ trợ CAD placeholder công nghiệp');

// GROUP 6: Đồng bộ hiển thị trên các màn hình
console.log('\n--- TEST GROUP 6: Đồng bộ hiển thị trên toàn hệ thống ---');
assert(listContent.includes('<MachineImage'), 'MachineListView hiển thị thumbnail CAD/ảnh thiết bị');
assert(detailContent.includes('imageUrl={machine.imageUrl}'), 'MachineDetailView truyền imageUrl vào MachineImage');
assert(detailContent.includes('machine.manufacturer'), 'MachineDetailView hiển thị Hãng sản xuất');
assert(devMonContent.includes('imageUrl={machine.imageUrl}'), 'DeviceMonitoringView truyền imageUrl cho MachineImage');

// GROUP 7: Kiểm toán CSDL MySQL Read-Only
console.log('\n--- TEST GROUP 7: Kiểm toán CSDL MySQL & 14 Thiết bị ---');
async function runDatabaseAudit() {
  try {
    const db = await import('../server/db-mysql.js');
    await db.initDatabase();
    const pool = db.getPool();

    // 1. Kiểm tra cấu trúc bảng machines
    const [cols] = await pool.query('DESCRIBE machines');
    const colNames = cols.map(c => c.Field);

    assert(colNames.includes('id'), 'Bảng machines có cột PK: id');
    assert(colNames.includes('code'), 'Bảng machines có cột code');
    assert(colNames.includes('name'), 'Bảng machines có cột name');
    assert(colNames.includes('lineId'), 'Bảng machines có cột lineId');
    assert(colNames.includes('management_status'), 'Bảng machines có cột management_status');
    assert(colNames.includes('location'), 'Bảng machines có cột location');
    assert(colNames.includes('description'), 'Bảng machines có cột description');

    // 2. Kiểm tra bảo toàn 14 thiết bị
    const [machines] = await pool.query('SELECT id, code, name, lineId FROM machines ORDER BY id ASC');
    assert(machines.length === 14, `Bảo toàn đúng 14 thiết bị hiện tại (thực tế: ${machines.length})`);

    const ids = machines.map(m => m.id);
    const expectedIds = [
      'MC-ASM-01', 'MC-CYL-01', 'MC-DRY-01', 'MC-FDR-01', 'MC-PNT-01', 'MC-TEST-C01', 'MC-TST-01',
      'MCH-ASM-01', 'MCH-DRY-01', 'MCH-MS10', 'MCH-PNT-01', 'MCH-PRS-01', 'MCH-TST-01', 'MCH-WLD-01'
    ];
    let allIdsMatched = true;
    expectedIds.forEach(id => {
      if (!ids.includes(id)) allIdsMatched = false;
    });
    assert(allIdsMatched, 'Toàn bộ 14 Database IDs không bị thay đổi');

    // 3. Kiểm tra bảo toàn Metric Mappings
    const [mappings] = await pool.query('SELECT COUNT(*) as count FROM metric_mappings');
    assert(mappings[0].count >= 18, `Bảo toàn Metric Mappings (hiện có: ${mappings[0].count} mappings)`);

    console.log('\n----------------------------------------------------------------');
    console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
    console.log('----------------------------------------------------------------\n');

    if (passedTests === totalTests) {
      console.log('>>> TẤT CẢ CÁC ĐIỀU KIỆN KIỂM THỬ ĐÃ HOÀN TOÀN ĐẠT CHUẨN! <<<');
      process.exit(0);
    } else {
      console.error('>>> CÒN TESTS THẤT BẠI. CẦN KHẮC PHỤC NGAY! <<<');
      process.exit(1);
    }
  } catch (err) {
    console.error('[DB Audit Error]:', err.message);
    process.exit(1);
  }
}

runDatabaseAudit();
