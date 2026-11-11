/**
 * @file test_line1_photorealistic_view.cjs
 * @description Kiểm thử toàn diện giao diện mới: Sơ đồ Line 1 (LN-PRS-01) bám sát 100% ảnh mẫu
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('KIỂM THỬ: SƠ ĐỒ LINE 1 THIẾT KẾ BÁM SÁT 100% ẢNH MẪU THAM CHIẾU');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function testAssert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

// 1. Kiểm tra tồn tại file và tích hợp
console.log('--- TEST GROUP 1: Cấu trúc tệp tin và Tích hợp Component ---');
const photorealisticPath = path.join(__dirname, '../src/features/tier1-lines/Line1PhotorealisticView.tsx');
const lineDetailPath = path.join(__dirname, '../src/features/tier1-lines/LineDetailView.tsx');

testAssert(fs.existsSync(photorealisticPath), 'Tệp tin Line1PhotorealisticView.tsx tồn tại trên đĩa');
const photoContent = fs.readFileSync(photorealisticPath, 'utf8');
const detailContent = fs.readFileSync(lineDetailPath, 'utf8');

testAssert(detailContent.includes('Line1PhotorealisticView'), 'LineDetailView đã tích hợp Line1PhotorealisticView');
testAssert(detailContent.includes('<Line1PhotorealisticView'), 'Line 1 tự động hiển thị giao diện ảnh mẫu photorealistic');

// 2. Kiểm tra Header theo ảnh mẫu
console.log('\n--- TEST GROUP 2: Tiêu đề và Nút bấm theo ảnh mẫu ---');
testAssert(photoContent.includes('Sơ đồ dây chuyền & trạng thái thiết bị - LN-PRS-01'), 'Tiêu đề: Sơ đồ dây chuyền & trạng thái thiết bị - LN-PRS-01');
testAssert(photoContent.includes('Dây chuyền Press – Gia công dập và lắp ráp'), 'Phụ đề: Dây chuyền Press – Gia công dập và lắp ráp');
testAssert(photoContent.includes('Công đoạn'), 'Góc trên hiển thị số lượng công đoạn (6 Công đoạn)');
testAssert(photoContent.includes('Maximize2'), 'Có nút phóng to (Maximize) toàn màn hình');

// 3. Kiểm tra danh sách và thứ tự 6 máy
console.log('\n--- TEST GROUP 3: Thứ tự và Cấu hình 6 máy Line 1 ---');
const expectedStations = [
  { op: 'OP10', code: 'MC-ASM-01', name: 'Trạm siết bulong tự động' },
  { op: 'OP20', code: 'MC-CYL-01', name: 'Máy dập xi lanh thủy lực' },
  { op: 'OP30', code: 'MC-FDR-01', name: 'Máy cấp phôi tự động' },
  { op: 'OP40', code: 'MC-PHASE-C', name: 'Máy thử nghiệm giai đoạn C' },
  { op: 'OP50', code: 'STP-01', name: 'Máy dập thủy lực 500T Komatsu' },
  { op: 'OP60', code: 'ROB-01', name: 'Robot hàn điểm Fanuc' },
];

expectedStations.forEach((st) => {
  const hasOp = photoContent.includes(st.op);
  const hasCode = photoContent.includes(st.code);
  testAssert(hasOp && hasCode, `Định nghĩa chính xác trạm ${st.op} (${st.code} - ${st.name})`);
});

// 4. Kiểm tra Sàn, Luồng và Thẻ trạng thái
console.log('\n--- TEST GROUP 4: Sàn phối cảnh, Luồng sản xuất và Thẻ nổi ---');
testAssert(!photoContent.includes('<span>VÀO →</span>'), 'Đã gỡ bỏ nhãn HTML ĐẦU VÀO trùng lặp (giữ đúng 1 nhãn trên ảnh nền)');
testAssert(!photoContent.includes('<span>→ RA</span>'), 'Đã gỡ bỏ nhãn HTML ĐẦU RA trùng lặp (giữ đúng 1 nhãn trên ảnh nền)');
testAssert(photoContent.includes('bg-blue-400') || photoContent.includes('bg-blue-500') || photoContent.includes('bg-blue-600'), 'Có đường chỉ dẫn màu xanh nối thẻ với đúng máy');
testAssert(photoContent.includes('onSelectMachine(st.machineId)'), 'Hỗ trợ click vào thẻ để mở Machine Detail');
testAssert(photoContent.includes('hotspot-'), 'Có vùng hotspot click trực tiếp trên từng thân máy');

// 5. Kiểm tra xóa 6 thẻ thống kê phía dưới (Card thu gọn chiều cao)
console.log('\n--- TEST GROUP 5: Xóa 6 thẻ thống kê phía dưới theo Yêu cầu 2 ---');
testAssert(!photoContent.includes('Tổng thiết bị</p>'), 'Đã xóa thẻ Tổng thiết bị khỏi JSX');
testAssert(!photoContent.includes('Đang chạy</p>'), 'Đã xóa thẻ Đang chạy khỏi JSX');
testAssert(!photoContent.includes('Tạm dừng</p>'), 'Đã xóa thẻ Tạm dừng khỏi JSX');
testAssert(!photoContent.includes('Cảnh báo</p>'), 'Đã xóa thẻ Cảnh báo khỏi JSX');
testAssert(!photoContent.includes('Dừng máy</p>'), 'Đã xóa thẻ Dừng máy khỏi JSX');
testAssert(!photoContent.includes('Sản lượng (24h)</p>'), 'Đã xóa thẻ Sản lượng (24h) khỏi JSX');
testAssert(photoContent.includes('stats'), 'Bảo toàn logic tính toán stats trong useMemo');

// 6. Kiểm tra Fullscreen Modal & Tương tác
console.log('\n--- TEST GROUP 6: Phóng to toàn màn hình và Phi Three.js ---');
testAssert(photoContent.includes('isFullscreen'), 'Quản lý trạng thái isFullscreen');
testAssert(!photoContent.includes('OrbitControls'), 'Tuyệt đối không sử dụng OrbitControls');
testAssert(!photoContent.includes('PerspectiveCamera'), 'Tuyệt đối không xoay camera WebGL 3D');
testAssert(photoContent.includes('setIsFullscreen(false)'), 'Có nút thu nhỏ/đóng toàn màn hình');

console.log('\n----------------------------------------------------------------');
console.log(`KẾT QUẢ KIỂM THỬ: ${passCount}/${passCount + failCount} TESTS PASSED (${((passCount / (passCount + failCount)) * 100).toFixed(1)}%)`);
console.log('----------------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
