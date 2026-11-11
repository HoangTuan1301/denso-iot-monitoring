/**
 * @file test_runtime_3d_instantiation.ts
 * @description Kiểm thử Runtime thực tế khởi tạo đối tượng 3D cho toàn bộ 6 máy Line 1 (OP10 - OP60)
 * Đảm bảo không có bất kỳ ReferenceError, undefined function call hay lỗi runtime nào khi render 3D.
 */

import {
  createMachine3D,
  createTightenerStation,
  createHydraulicPressStation,
  createFeederStation,
  createTestChamberStation,
  createHeavyPressStation,
  createWeldingRobotStation,
  createIndustrialAndon,
  Machine3DObject,
} from '../src/features/tier1-lines/3d/machine3DModels';
import { createProductionEnvironment } from '../src/features/tier1-lines/3d/ProductionFlow3D';
import { LINE1_STATIONS_3D } from '../src/features/tier1-lines/3d/line3DLayout';

console.log('================================================================');
console.log('KIỂM THỬ RUNTIME: KHỞI TẠO 6 MÔ HÌNH 3D VÀ MÔI TRƯỜNG DIGITAL TWIN');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

// 1. Kiểm tra bí danh Andon Helper
console.log('--- TEST 1: Kiểm tra Helper Andon ---');
try {
  const andon = createIndustrialAndon(3.5);
  assert(!!andon && !!andon.mesh && !!andon.statusLight, 'createIndustrialAndon khởi tạo thành công không lỗi runtime');
} catch (err: any) {
  assert(false, `createIndustrialAndon thất bại: ${err.message}`);
}

// 2. Khởi tạo trực tiếp từng trạm máy (Direct Station Factory Calls)
console.log('\n--- TEST 2: Khởi tạo trực tiếp từng hàm trạm OP10 -> OP60 ---');

const stationsToTest = [
  { name: 'OP10 Tightener', fn: () => createTightenerStation('MC-ASM-01', 'MC-ASM-01'), expectedCode: 'OP10' },
  { name: 'OP20 Hydraulic Press', fn: () => createHydraulicPressStation('MC-CYL-01', 'MC-CYL-01'), expectedCode: 'OP20' },
  { name: 'OP30 Feeder', fn: () => createFeederStation('MC-FDR-01', 'MC-FDR-01'), expectedCode: 'OP30' },
  { name: 'OP40 Test Chamber', fn: () => createTestChamberStation('MC-TEST-C01', 'MC-PHASE-C'), expectedCode: 'OP40' },
  { name: 'OP50 Heavy Press', fn: () => createHeavyPressStation('MCH-PRS-01', 'STP-01'), expectedCode: 'OP50' },
  { name: 'OP60 Welding Robot', fn: () => createWeldingRobotStation('MCH-WLD-01', 'ROB-01'), expectedCode: 'OP60' },
];

for (const item of stationsToTest) {
  try {
    const obj: Machine3DObject = item.fn();
    assert(
      !!obj && obj.userData?.stationCode === item.expectedCode,
      `Khởi tạo thành công ${item.name} (stationCode = ${obj.userData?.stationCode})`
    );

    // Thử cập nhật toàn bộ trạng thái vận hành
    obj.updateStatus('OK');
    obj.updateStatus('WARNING');
    obj.updateStatus('CRITICAL');
    obj.updateStatus('STOPPED');
    assert(true, `${item.name}: Gọi updateStatus() qua tất cả các trạng thái không lỗi`);

    // Thử hiệu ứng Highlight
    obj.setStatusGlow(true);
    obj.setStatusGlow(false);
    assert(true, `${item.name}: Gọi setStatusGlow() không lỗi`);

    // Đếm số lượng mesh con
    let meshCount = 0;
    obj.traverse((child) => {
      if ((child as any).isMesh) meshCount++;
    });
    assert(meshCount >= 5, `${item.name}: Có cấu trúc cơ khí chi tiết (${meshCount} meshes con)`);
  } catch (err: any) {
    assert(false, `Khởi tạo ${item.name} thất bại: ${err.stack || err.message}`);
  }
}

// 3. Khởi tạo qua Factory createMachine3D theo danh sách LINE1_STATIONS_3D
console.log('\n--- TEST 3: Khởi tạo qua createMachine3D() cho toàn bộ LINE1_STATIONS_3D ---');

LINE1_STATIONS_3D.forEach((stCfg) => {
  try {
    const obj = createMachine3D(stCfg.modelType, stCfg.defaultDbId, stCfg.defaultMachineCode);
    assert(
      !!obj && typeof obj.updateStatus === 'function',
      `createMachine3D('${stCfg.modelType}') cho ${stCfg.opCode} (${stCfg.defaultMachineCode}) thành công 100%`
    );
  } catch (err: any) {
    assert(false, `createMachine3D('${stCfg.modelType}') cho ${stCfg.opCode} ném ngoại lệ: ${err.message}`);
  }
});

// 4. Kiểm tra môi trường Production Environment
console.log('\n--- TEST 4: Khởi tạo Production Environment (Sàn, Băng tải, 5S) ---');
try {
  const envLight = createProductionEnvironment(false);
  assert(!!envLight && !!envLight.group, 'Khởi tạo Production Environment (Light Mode) thành công');
  envLight.animate(100);
  assert(true, 'Gọi env.animate() thành công');
  envLight.dispose();

  const envDark = createProductionEnvironment(true);
  assert(!!envDark && !!envDark.group, 'Khởi tạo Production Environment (Dark Mode) thành công');
  envDark.animate(200);
  envDark.dispose();
} catch (err: any) {
  assert(false, `Khởi tạo Production Environment thất bại: ${err.message}`);
}

console.log('\n----------------------------------------------------------------');
console.log(`KẾT QUẢ KIỂM THỬ RUNTIME: ${passCount}/${passCount + failCount} TESTS PASSED (${((passCount / (passCount + failCount)) * 100).toFixed(1)}%)`);
console.log('----------------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
