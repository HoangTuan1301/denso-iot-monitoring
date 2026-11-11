/**
 * @file test_cad_images_and_unified_navigation.cjs
 * @description Bộ kiểm thử tự động xác minh:
 * 1. Tích hợp cấu hình hình ảnh CAD cho 14 thiết bị DENSO Smart Factory
 * 2. Thống nhất màn hình Machine Detail giữa Flow A (Dashboard) và Flow B (Giám sát Thiết bị)
 * 3. Bảo toàn Metric Mapping, CHECK SHEET, và điều hướng ngữ cảnh
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
console.log('KIỂM THỬ: TÍCH HỢP HÌNH ẢNH CAD 14 THIẾT BỊ & THỐNG NHẤT MACHINE DETAIL');
console.log('================================================================\n');

// 1. Kiểm tra cấu hình machineImages.tsx
console.log('--- TEST GROUP 1: Cấu hình tập trung machineImages.tsx ---');
let configPath = path.join(__dirname, '../src/config/machineImages.tsx');
if (!fs.existsSync(configPath)) {
  configPath = path.join(__dirname, '../src/config/machineImages.ts');
}
assert(fs.existsSync(configPath), 'File src/config/machineImages.tsx tồn tại');

const configContent = fs.readFileSync(configPath, 'utf8');

const requiredMachines = [
  { dbId: 'MC-ASM-01', code: 'MC-ASM-01', name: 'Trạm siết bulong tự động', line: 'LN-PRS-01' },
  { dbId: 'MC-CYL-01', code: 'MC-CYL-01', name: 'Máy dập xi lanh thủy lực', line: 'LN-PRS-01' },
  { dbId: 'MC-FDR-01', code: 'MC-FDR-01', name: 'Máy cấp phôi tự động', line: 'LN-PRS-01' },
  { dbId: 'MC-TEST-C01', code: 'MC-PHASE-C', name: 'Máy thử nghiệm giai đoạn C', line: 'LN-PRS-01' },
  { dbId: 'MCH-WLD-01', code: 'ROB-01', name: 'Robot hàn điểm Fanuc R-2000iC', line: 'LN-PRS-01' },
  { dbId: 'MCH-PRS-01', code: 'STP-01', name: 'Máy dập thủy lực 500T Komatsu', line: 'LN-PRS-01' },
  { dbId: 'MCH-DRY-01', code: 'DRY-01', name: 'Lò sấy nhiệt hồng ngoại Kawasumi', line: 'LN-PNT-02' },
  { dbId: 'MC-DRY-01', code: 'MC-DRY-01', name: 'Trạm sấy hồng ngoại', line: 'LN-PNT-02' },
  { dbId: 'MC-PNT-01', code: 'MC-PNT-01', name: 'Trạm phun sơn tự động', line: 'LN-PNT-02' },
  { dbId: 'MCH-PNT-01', code: 'PNT-01', name: 'Buồng phun sơn robot Yaskawa EPX', line: 'LN-PNT-02' },
  { dbId: 'MCH-ASM-01', code: 'ASM-01', name: 'Robot siết bulong tự động Atlas Copco', line: 'LN-ASM-03' },
  { dbId: 'MC-TST-01', code: 'MC-TST-01', name: 'Trạm kiểm tra chức năng', line: 'LN-ASM-03' },
  { dbId: 'MCH-MS10', code: 'MS-10', name: 'Messi', line: 'LN-ASM-03' },
  { dbId: 'MCH-TST-01', code: 'TST-01', name: 'Băng chuyền kiểm tra cuối dòng TestBench', line: 'LN-ASM-03' },
];

assert(requiredMachines.length === 14, 'Tổng cộng đúng 14 thiết bị cần quản lý');

requiredMachines.forEach((m) => {
  const hasDbId = configContent.includes(`'${m.dbId}'`);
  const hasCode = configContent.includes(m.code);
  assert(hasDbId && hasCode, `Đăng ký máy ${m.dbId} (Code: ${m.code}, ${m.name}) đầy đủ`);
});

assert(configContent.includes('export function getMachineImageConfig'), 'Xuất hàm getMachineImageConfig');
assert(configContent.includes('export function getMachineImagePath'), 'Xuất hàm getMachineImagePath');
assert(configContent.includes('export function MachineImage'), 'Xuất component MachineImage với onError fallback');

// 2. Kiểm tra thư mục public/images/machines
console.log('\n--- TEST GROUP 2: Thư mục tài nguyên ảnh tĩnh ---');
const imagesDir = path.join(__dirname, '../public/images/machines');
assert(fs.existsSync(imagesDir), 'Thư mục public/images/machines đã được khởi tạo');

// 3. Kiểm tra tích hợp ảnh trong MachineDetailView
console.log('\n--- TEST GROUP 3: Tích hợp hình ảnh trong MachineDetailView ---');
const machineDetailPath = path.join(__dirname, '../src/features/tier2-machines/MachineDetailView.tsx');
const machineDetailContent = fs.readFileSync(machineDetailPath, 'utf8');

assert(machineDetailContent.includes('import { MachineImage } from'), 'MachineDetailView đã import MachineImage');
assert(machineDetailContent.includes('<MachineImage'), 'MachineDetailView sử dụng MachineImage trong thẻ Thông tin kỹ thuật');
assert(!machineDetailContent.includes('<Cpu className="w-16 h-16 text-emerald-600/80 mb-2" />'), 'Đã gỡ bỏ icon Cpu chung ở vị trí minh họa máy');

// 4. Kiểm tra tích hợp ảnh trong LineDetailView
console.log('\n--- TEST GROUP 4: Tích hợp hình ảnh trong LineDetailView (OP10..OP60) ---');
const lineDetailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');
const lineDetailContent = fs.readFileSync(lineDetailPath, 'utf8');

assert(lineDetailContent.includes('import { MachineImage } from'), 'LineDetailView đã import MachineImage');
assert(lineDetailContent.includes('<MachineImage'), 'LineDetailView sử dụng MachineImage trong card công đoạn OP10..OP60');

// 5. Kiểm tra thống nhất điều hướng Flow B trong DeviceMonitoringView
console.log('\n--- TEST GROUP 5: Thống nhất điều hướng Flow B (Giám sát Thiết bị -> MachineDetailView) ---');
const deviceMonitoringPath = path.join(__dirname, '../src/features/tier2-machines/DeviceMonitoringView.tsx');
const deviceMonitoringContent = fs.readFileSync(deviceMonitoringPath, 'utf8');

assert(deviceMonitoringContent.includes('import { MachineDetailView } from'), 'DeviceMonitoringView đã import MachineDetailView');
assert(deviceMonitoringContent.includes('import { CheckSheetView } from'), 'DeviceMonitoringView đã import CheckSheetView');
assert(deviceMonitoringContent.includes('import { MachineImage } from'), 'DeviceMonitoringView đã import MachineImage');
assert(deviceMonitoringContent.includes('detailMachineId'), 'DeviceMonitoringView quản lý trạng thái detailMachineId');
assert(deviceMonitoringContent.includes('isCheckSheetOpen'), 'DeviceMonitoringView quản lý trạng thái isCheckSheetOpen');
assert(deviceMonitoringContent.includes('<MachineDetailView'), 'DeviceMonitoringView hiển thị trực tiếp MachineDetailView khi chọn máy');
assert(deviceMonitoringContent.includes('<CheckSheetView'), 'DeviceMonitoringView hỗ trợ mở CheckSheetView từ MachineDetailView');
assert(deviceMonitoringContent.includes('onBackToLine={() => setDetailMachineId(null)}'), 'Nút quay lại đưa người dùng về danh sách Giám sát Thiết bị theo ngữ cảnh');
assert(!deviceMonitoringContent.includes('<MachineDetailModal'), 'Đã loại bỏ hoàn toàn việc dùng popup MachineDetailModal riêng biệt');

// 6. Kiểm tra bảo toàn Metric Mapping và CHECK SHEET
console.log('\n--- TEST GROUP 6: Bảo toàn Metric Mapping và CHECK SHEET ---');
const storePath = path.join(__dirname, '../src/stores/useMonitoringStore.ts');
const storeContent = fs.readFileSync(storePath, 'utf8');
assert(storeContent.includes('fetchMappings'), 'Bảo toàn fetchMappings trong useMonitoringStore');
assert(storeContent.includes('const wMin = mapItem.warning_min != null ? Number(mapItem.warning_min)'), 'Bảo toàn ngưỡng warningMin null');
assert(storeContent.includes('activeEmergencyMetricId'), 'Bảo toàn cơ chế Emergency Demo');

console.log('\n----------------------------------------------------------------');
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log('----------------------------------------------------------------\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
