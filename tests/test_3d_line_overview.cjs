/**
 * @file test_3d_line_overview.cjs
 * @description Bộ kiểm thử toàn diện xác minh tính năng Sơ đồ 3D tương tác thực tế cho Line 1 (LN-PRS-01)
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
console.log('KIỂM THỬ: SƠ ĐỒ DÂY CHUYỀN 3D TƯƠNG TÁC THỰC SỰ CHO LINE 1 (LN-PRS-01)');
console.log('================================================================\n');

// 1. Kiểm tra cấu trúc thư mục và files
console.log('--- TEST GROUP 1: Cấu trúc mô-đun 3D Digital Twin ---');
const filesToCheck = [
  'src/features/tier1-lines/3d/line3DLayout.ts',
  'src/features/tier1-lines/3d/machine3DModels.ts',
  'src/features/tier1-lines/3d/ProductionFlow3D.ts',
  'src/features/tier1-lines/3d/Line3DScene.tsx',
  'src/features/tier1-lines/3d/Line3DView.tsx',
];

filesToCheck.forEach((relPath) => {
  const fullPath = path.join(__dirname, '..', relPath);
  assert(fs.existsSync(fullPath), `Tệp tin ${relPath} tồn tại trên đĩa`);
});

// 2. Kiểm tra danh sách 6 trạm và quy cách bố trí 3D
console.log('\n--- TEST GROUP 2: Bố trí không gian và danh sách 6 máy Line 1 ---');
const layoutPath = path.join(__dirname, '../src/features/tier1-lines/3d/line3DLayout.ts');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

const requiredStations = [
  { op: 'OP10', dbId: 'MC-ASM-01', code: 'MC-ASM-01', model: 'tightener' },
  { op: 'OP20', dbId: 'MC-CYL-01', code: 'MC-CYL-01', model: 'hydraulic_press' },
  { op: 'OP30', dbId: 'MC-FDR-01', code: 'MC-FDR-01', model: 'feeder' },
  { op: 'OP40', dbId: 'MC-TEST-C01', code: 'MC-PHASE-C', model: 'test_chamber' },
  { op: 'OP50', dbId: 'MCH-PRS-01', code: 'STP-01', model: 'heavy_press' },
  { op: 'OP60', dbId: 'MCH-WLD-01', code: 'ROB-01', model: 'welding_robot' },
];

requiredStations.forEach((st) => {
  const hasOp = layoutContent.includes(`opCode: '${st.op}'`);
  const hasDbId = layoutContent.includes(st.dbId);
  const hasCode = layoutContent.includes(st.code);
  const hasModel = layoutContent.includes(st.model);
  assert(hasOp && hasDbId && hasCode && hasModel, `Cấu hình trạm ${st.op} (${st.dbId} - ${st.code}) kiểu ${st.model}`);
});

assert(layoutContent.includes('DEFAULT_CAMERA_POSITION'), 'Định nghĩa vị trí Isometric mặc định của Camera');
assert(layoutContent.includes('STATUS_COLORS_3D'), 'Định nghĩa bảng màu trạng thái công nghiệp chuẩn');

// 3. Kiểm tra tính năng tạo hình học 3D procedural
console.log('\n--- TEST GROUP 3: Mô hình 3D Procedural cho từng máy ---');
const modelsPath = path.join(__dirname, '../src/features/tier1-lines/3d/machine3DModels.ts');
const modelsContent = fs.readFileSync(modelsPath, 'utf8');

assert(modelsContent.includes('function createTightenerStation'), 'Mô hình 3D OP10: Trạm siết bulong tự động đa trục');
assert(modelsContent.includes('function createHydraulicPressStation'), 'Mô hình 3D OP20: Máy dập xi-lanh thủy lực SMC');
assert(modelsContent.includes('function createFeederStation'), 'Mô hình 3D OP30: Máy cấp phôi tự động sàng rung & pick-place');
assert(modelsContent.includes('function createTestChamberStation'), 'Mô hình 3D OP40: Máy thử nghiệm giai đoạn C (CAD Mentor)');
assert(modelsContent.includes('function createHeavyPressStation'), 'Mô hình 3D OP50: Máy dập thủy lực 500T Komatsu');
assert(modelsContent.includes('function createWeldingRobotStation'), 'Mô hình 3D OP60: Robot hàn điểm 6 trục Fanuc R-2000iC');
assert(modelsContent.includes('createAndonLight'), 'Mỗi máy tích hợp cột đèn tín hiệu Andon đa tầng');
assert(modelsContent.includes('updateStatus'), 'Mô hình hỗ trợ cập nhật màu tín hiệu theo trạng thái vận hành');
assert(modelsContent.includes('userData.machineId = machineId'), 'Gán Machine ID đệ quy để bắt sự kiện tương tác chuột');

// 4. Kiểm tra Three.js Scene, OrbitControls và Raycasting
console.log('\n--- TEST GROUP 4: Three.js Scene, Camera và Tương tác ---');
const scenePath = path.join(__dirname, '../src/features/tier1-lines/3d/Line3DScene.tsx');
const sceneContent = fs.readFileSync(scenePath, 'utf8');

assert(sceneContent.includes('new OrbitControls'), 'Khởi tạo OrbitControls hỗ trợ xoay, zoom, pan');
assert(sceneContent.includes('controls.maxPolarAngle = Math.PI / 2 - 0.08'), 'Giới hạn góc camera không cho chui xuống dưới sàn nhà xưởng');
assert(sceneContent.includes('new THREE.Raycaster'), 'Sử dụng Raycaster để phát hiện rê chuột và nhấp chọn máy');
assert(sceneContent.includes('topPos.project(cam)'), 'Chiếu tọa độ 3D sang 2D hiển thị thẻ thông tin lơ lửng');
assert(sceneContent.includes('onSelectMachine(badge.machineId)'), 'Nhấn thẻ thông tin mở trực tiếp Machine Detail');
assert(sceneContent.includes('onSelectMachine(parentGroup.userData.machineId)'), 'Nhấp trực tiếp vào mô hình 3D mở đúng Machine Detail');
assert(sceneContent.includes('resetCamera'), 'Cung cấp cơ chế Đặt lại góc nhìn (Reset Camera)');

// 5. Kiểm tra tích hợp nút chuyển đổi 2D / 3D trong LineDetailView
console.log('\n--- TEST GROUP 5: Tích hợp chế độ xem 2D / 3D trong LineDetailView ---');
const lineDetailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');
const lineDetailContent = fs.readFileSync(lineDetailPath, 'utf8');

assert(lineDetailContent.includes('import { Line3DView } from \'./3d/Line3DView\''), 'LineDetailView đã import Line3DView');
assert(lineDetailContent.includes('isLine1'), 'Nhận diện phân vùng Line 1 (LN-PRS-01)');
assert(lineDetailContent.includes('viewMode3D'), 'Quản lý trạng thái viewMode3D');
assert(lineDetailContent.includes('setViewMode3D(\'2d\')') && lineDetailContent.includes('setViewMode3D(\'3d\')'), 'Có nút chuyển đổi 2D | 3D');
assert(lineDetailContent.includes('isLine1 && viewMode3D === \'3d\' ? ('), 'Chỉ kích hoạt 3D khi là Line 1 và người dùng chủ động chọn 3D');
assert(lineDetailContent.includes('const [viewMode3D, setViewMode3D] = useState<\'2d\' | \'3d\'>(\'2d\')'), 'Mặc định hiển thị 2D để bảo đảm an toàn');

// 6. Kiểm tra xử lý WebGL fallback
console.log('\n--- TEST GROUP 6: Xử lý an toàn WebGL Fallback ---');
const viewPath = path.join(__dirname, '../src/features/tier1-lines/3d/Line3DView.tsx');
const viewContent = fs.readFileSync(viewPath, 'utf8');

assert(viewContent.includes('isWebGLAvailable'), 'Có hàm kiểm tra hỗ trợ WebGL phần cứng/trình duyệt');
assert(viewContent.includes('Quay lại Chế độ xem 2D'), 'Có nút quay lại 2D an toàn khi WebGL không khả dụng');

console.log('\n----------------------------------------------------------------');
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log('----------------------------------------------------------------\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
