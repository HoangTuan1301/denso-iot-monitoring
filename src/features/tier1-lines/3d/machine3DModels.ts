/**
 * @file machine3DModels.ts
 * @description Bộ tạo hình học 3D cơ khí công nghiệp chi tiết cao (High-Fidelity Procedural Industrial Digital Twin)
 * cho 6 máy Line 1 (LN-PRS-01) DENSO Smart Factory.
 * 
 * Mỗi máy được thiết kế tỉ mỉ với đầy đủ cụm chi tiết cơ khí:
 * 1. OP10: Trạm siết bulong tự động đa trục (Atlas Copco Tightener Gantry)
 * 2. OP20: Máy dập xi-lanh thủy lực 4 trụ crom SMC
 * 3. OP30: Máy cấp phôi tự động phễu xoắn ốc & gantry pick-and-place DENSO-FEED
 * 4. OP40: Trạm máy thử nghiệm giai đoạn C buồng kín đa cảm biến IoT (CAD Mentor)
 * 5. OP50: Máy dập thủy lực hạng nặng 500 Tấn Komatsu kèm rèm quang an toàn
 * 6. OP60: Robot hàn điểm 6 trục Fanuc R-2000iC kèm dress pack và hàng rào an toàn
 */

import * as THREE from 'three';
import { STATUS_COLORS_3D } from './line3DLayout';

// =========================================================================
// BẢNG VẬT LIỆU CÔNG NGHIỆP TÁI SỬ DỤNG (Metallic / Roughness / Clearcoat)
// =========================================================================
const MATS = {
  // Thép đúc kết cấu bệ máy
  castIronDark: new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.6,
    roughness: 0.4,
  }),
  // Nhôm định hình Bosch Rexroth / T-slot profiles
  aluminumExtrusion: new THREE.MeshStandardMaterial({
    color: 0xa0aec0,
    metalness: 0.85,
    roughness: 0.22,
  }),
  // Thép mạ crom gương cho piston, ti trượt, trục dẫn hướng
  steelChrome: new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.95,
    roughness: 0.1,
  }),
  // Thép carbon xám công nghiệp
  steelGrey: new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.7,
    roughness: 0.35,
  }),
  // Màu xanh thương hiệu DENSO (Emerald Green cao cấp)
  densoEmerald: new THREE.MeshStandardMaterial({
    color: 0x059669,
    metalness: 0.35,
    roughness: 0.35,
  }),
  // Màu vàng thương hiệu Robot Fanuc
  fanucYellow: new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.25,
    roughness: 0.35,
  }),
  // Màu vàng an toàn 5S / Caution Yellow
  safetyYellow: new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.15,
    roughness: 0.5,
  }),
  // Kính mica bảo vệ trong suốt chống vỡ
  acrylicGlass: new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    metalness: 0.05,
    roughness: 0.05,
    transparent: true,
    opacity: 0.32,
  }),
  // Màn hình cảm ứng HMI công nghiệp đang sáng
  hmiScreen: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.75,
    roughness: 0.2,
  }),
  // Đồng đỏ dẫn điện cho đầu hàn / cọc tiếp điểm
  copperAlloy: new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.85,
    roughness: 0.25,
  }),
  // Ống ruột gà đen / Cao su giảm chấn
  blackRubber: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.9,
    metalness: 0.1,
  }),
  // Tia hồng ngoại rèm an toàn (Red Infrared beam)
  laserBeam: new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.65,
  }),
};

export interface Machine3DObject extends THREE.Group {
  updateStatus: (status: 'OK' | 'WARNING' | 'CRITICAL' | 'STOPPED' | 'OFFLINE') => void;
  setStatusGlow: (highlighted: boolean) => void;
}

/**
 * Tạo tháp đèn tín hiệu Andon 3 tầng kèm đèn trạng thái chính (createAndonLight)
 */
function createAndonLight(height: number = 3.6): {
  mesh: THREE.Group;
  statusLight: THREE.Mesh;
  lightMaterial: THREE.MeshStandardMaterial;
} {
  const andonGroup = new THREE.Group();

  // Cột crom đứng
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, height, 16);
  const pole = new THREE.Mesh(poleGeo, MATS.steelChrome);
  pole.position.y = height / 2;
  pole.castShadow = true;
  andonGroup.add(pole);

  // Đèn tín hiệu chính Andon Lens
  const lensGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.38, 20);
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: STATUS_COLORS_3D.OK.hex,
    emissive: STATUS_COLORS_3D.OK.emissive,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const statusLight = new THREE.Mesh(lensGeo, lightMaterial);
  statusLight.position.y = height + 0.18;
  andonGroup.add(statusLight);

  // Nắp tháp đèn màu đen
  const capGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20);
  const cap = new THREE.Mesh(capGeo, MATS.blackRubber);
  cap.position.y = height + 0.38;
  andonGroup.add(cap);

  return { mesh: andonGroup, statusLight, lightMaterial };
}

// Bí danh tương thích ngược và an toàn đa mục đích
export const createIndustrialAndon = createAndonLight;

/**
 * 1. OP10: Trạm siết bulong tự động đa trục (Atlas Copco Multi-spindle Tightener)
 */
export function createTightenerStation(machineId: string, machineCode: string): Machine3DObject {
  const group = new THREE.Group() as Machine3DObject;
  group.userData = { machineId, machineCode, stationCode: 'OP10' };

  // Bệ máy thép hàn gia cường
  const baseGeo = new THREE.BoxGeometry(2.3, 0.45, 2.2);
  const base = new THREE.Mesh(baseGeo, MATS.castIronDark);
  base.position.y = 0.225;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 4 chân đế chống rung mạ crom
  for (let x of [-1.0, 1.0]) {
    for (let z of [-0.95, 0.95]) {
      const footGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.15, 16);
      const foot = new THREE.Mesh(footGeo, MATS.steelChrome);
      foot.position.set(x, 0.075, z);
      group.add(foot);
    }
  }

  // Khung nhôm định hình 4 cột gantry (Aluminum Extrusion Profiles)
  const colGeo = new THREE.BoxGeometry(0.12, 2.6, 0.12);
  for (let x of [-0.95, 0.95]) {
    for (let z of [-0.85, 0.85]) {
      const col = new THREE.Mesh(colGeo, MATS.aluminumExtrusion);
      col.position.set(x, 1.55, z);
      col.castShadow = true;
      group.add(col);

      // Ke góc gia cường (Corner gussets)
      const gussetGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      const gusset = new THREE.Mesh(gussetGeo, MATS.aluminumExtrusion);
      gusset.position.set(x, 0.55, z);
      group.add(gusset);
    }
  }

  // Dầm ngang chịu lực trên đỉnh
  const topFrameGeo = new THREE.BoxGeometry(2.0, 0.15, 1.8);
  const topFrame = new THREE.Mesh(topFrameGeo, MATS.aluminumExtrusion);
  topFrame.position.set(0, 2.85, 0);
  group.add(topFrame);

  // Dầm trượt X-axis servo ballscrew
  const slideBeamGeo = new THREE.BoxGeometry(1.7, 0.22, 0.35);
  const slideBeam = new THREE.Mesh(slideBeamGeo, MATS.steelGrey);
  slideBeam.position.set(0, 2.5, 0);
  group.add(slideBeam);

  // Động cơ servo dẫn động trục đứng (Z-axis Servo Motor)
  const servoMotorGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 16);
  const servoMotor = new THREE.Mesh(servoMotorGeo, MATS.densoEmerald);
  servoMotor.position.set(0, 2.95, 0);
  group.add(servoMotor);

  // Cụm đầu siết đa trục trượt đứng (Tightening Carriage)
  const headGeo = new THREE.BoxGeometry(0.9, 0.75, 0.7);
  const head = new THREE.Mesh(headGeo, MATS.densoEmerald);
  head.position.set(0, 1.85, 0);
  head.castShadow = true;
  group.add(head);

  // 4 cụm súng siết lực điện tử độc lập kèm đầu tuýp crom
  const offsets = [
    [-0.22, -0.18],
    [0.22, -0.18],
    [-0.22, 0.18],
    [0.22, 0.18],
  ];
  offsets.forEach(([sx, sz]) => {
    // Thân súng siết
    const nutrunnerGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.65, 16);
    const nutrunner = new THREE.Mesh(nutrunnerGeo, MATS.castIronDark);
    nutrunner.position.set(sx, 1.35, sz);
    group.add(nutrunner);

    // Trục xoay mạ crom
    const bitGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 12);
    const bit = new THREE.Mesh(bitGeo, MATS.steelChrome);
    bit.position.set(sx, 0.95, sz);
    group.add(bit);
  });

  // Vách mica trong suốt bao che an toàn
  const shieldGeo = new THREE.BoxGeometry(1.95, 1.8, 1.75);
  const shield = new THREE.Mesh(shieldGeo, MATS.acrylicGlass);
  shield.position.set(0, 1.55, 0);
  group.add(shield);

  // Tay đỡ HMI và màn hình điều khiển cảm ứng
  const armGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 12);
  const arm = new THREE.Mesh(armGeo, MATS.steelChrome);
  arm.position.set(1.15, 1.6, 0.6);
  arm.rotation.z = Math.PI / 4;
  group.add(arm);

  const hmiBoxGeo = new THREE.BoxGeometry(0.48, 0.34, 0.08);
  const hmiBox = new THREE.Mesh(hmiBoxGeo, MATS.hmiScreen);
  hmiBox.position.set(1.4, 1.95, 0.6);
  hmiBox.rotation.y = -Math.PI / 5;
  group.add(hmiBox);

  // Tủ điện điều khiển Rittal cạnh máy
  const cabGeo = new THREE.BoxGeometry(0.35, 1.5, 0.7);
  const cab = new THREE.Mesh(cabGeo, MATS.aluminumExtrusion);
  cab.position.set(-1.1, 1.2, 0);
  group.add(cab);

  // Tháp đèn Andon
  const andon = createAndonLight(3.2);
  andon.mesh.position.set(-1.0, 0.45, -0.9);
  group.add(andon.mesh);

  group.traverse((child) => {
    child.userData.machineId = machineId;
    child.userData.machineCode = machineCode;
    child.userData.parentGroup = group;
  });

  group.updateStatus = (status) => {
    const color = STATUS_COLORS_3D[status] || STATUS_COLORS_3D.OK;
    andon.lightMaterial.color.setHex(color.hex);
    andon.lightMaterial.emissive.setHex(color.emissive);
  };

  group.setStatusGlow = (highlighted) => {
    base.material = highlighted ? MATS.densoEmerald : MATS.castIronDark;
  };

  return group;
}

/**
 * 2. OP20: Máy dập xi lanh thủy lực 4 trụ crom SMC (Hydraulic Cylinder Press)
 */
export function createHydraulicPressStation(machineId: string, machineCode: string): Machine3DObject {
  const group = new THREE.Group() as Machine3DObject;
  group.userData = { machineId, machineCode, stationCode: 'OP20' };

  // Bệ máy đúc nguyên khối dày
  const baseGeo = new THREE.BoxGeometry(2.3, 0.55, 2.1);
  const base = new THREE.Mesh(baseGeo, MATS.castIronDark);
  base.position.y = 0.275;
  base.castShadow = true;
  group.add(base);

  // Bàn dập dưới (Bolster Bed) mạ phay xước có rãnh chữ T
  const bolsterGeo = new THREE.BoxGeometry(1.6, 0.15, 1.4);
  const bolster = new THREE.Mesh(bolsterGeo, MATS.steelChrome);
  bolster.position.set(0, 0.62, 0);
  group.add(bolster);

  // 4 cột trụ chịu lực tròn mạ crom sáng bóng (Tie-rod Columns)
  for (let x of [-0.85, 0.85]) {
    for (let z of [-0.75, 0.75]) {
      const colGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.2, 20);
      const col = new THREE.Mesh(colGeo, MATS.steelChrome);
      col.position.set(x, 1.85, z);
      col.castShadow = true;
      group.add(col);

      // Đai ốc lục giác giữ cột (Hex nuts)
      const nutGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.15, 6);
      const nutTop = new THREE.Mesh(nutGeo, MATS.castIronDark);
      nutTop.position.set(x, 3.4, z);
      const nutBot = new THREE.Mesh(nutGeo, MATS.castIronDark);
      nutBot.position.set(x, 0.55, z);
      group.add(nutTop, nutBot);
    }
  }

  // Khung dầm đỉnh (Crown Crosshead)
  const crownGeo = new THREE.BoxGeometry(2.1, 0.65, 1.9);
  const crown = new THREE.Mesh(crownGeo, MATS.castIronDark);
  crown.position.set(0, 3.3, 0);
  crown.castShadow = true;
  group.add(crown);

  // Xi lanh thủy lực chính áp suất cao màu xanh DENSO
  const cylGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.4, 24);
  const cyl = new THREE.Mesh(cylGeo, MATS.densoEmerald);
  cyl.position.set(0, 3.95, 0);
  group.add(cyl);

  // Mặt bích gắn ống dầu thủy lực
  const flangeGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.1, 24);
  const flange = new THREE.Mesh(flangeGeo, MATS.steelGrey);
  flange.position.set(0, 4.4, 0);
  group.add(flange);

  // Cần piston thủy lực crom bóng loáng
  const pistonGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.5, 20);
  const piston = new THREE.Mesh(pistonGeo, MATS.steelChrome);
  piston.position.set(0, 2.5, 0);
  group.add(piston);

  // Bàn dập trượt trên (Moving Ram / Platen)
  const ramGeo = new THREE.BoxGeometry(1.5, 0.4, 1.3);
  const ram = new THREE.Mesh(ramGeo, MATS.steelGrey);
  ram.position.set(0, 1.75, 0);
  ram.castShadow = true;
  group.add(ram);

  // Khuôn dập định hình gắn trên ram
  const dieUpperGeo = new THREE.BoxGeometry(0.9, 0.25, 0.8);
  const dieUpper = new THREE.Mesh(dieUpperGeo, MATS.steelChrome);
  dieUpper.position.set(0, 1.45, 0);
  group.add(dieUpper);

  // Cụm nguồn trạm bơm thủy lực (HPU Tank & Pump) bên cạnh
  const tankGeo = new THREE.BoxGeometry(0.65, 1.4, 0.85);
  const tank = new THREE.Mesh(tankGeo, MATS.aluminumExtrusion);
  tank.position.set(-1.25, 1.0, -0.4);
  group.add(tank);

  // Đồng hồ đo áp suất thủy lực tròn (Pressure Gauge)
  const gaugeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16);
  const gauge = new THREE.Mesh(gaugeGeo, MATS.steelChrome);
  gauge.position.set(-0.95, 1.8, 0.35);
  gauge.rotation.z = Math.PI / 2;
  group.add(gauge);

  // Tháp đèn Andon
  const andon = createAndonLight(4.0);
  andon.mesh.position.set(1.05, 0.55, -0.9);
  group.add(andon.mesh);

  group.traverse((child) => {
    child.userData.machineId = machineId;
    child.userData.machineCode = machineCode;
    child.userData.parentGroup = group;
  });

  group.updateStatus = (status) => {
    const color = STATUS_COLORS_3D[status] || STATUS_COLORS_3D.OK;
    andon.lightMaterial.color.setHex(color.hex);
    andon.lightMaterial.emissive.setHex(color.emissive);
  };

  group.setStatusGlow = (highlighted) => {
    base.material = highlighted ? MATS.densoEmerald : MATS.castIronDark;
  };

  return group;
}

/**
 * 3. OP30: Máy cấp phôi tự động phễu xoắn ốc & gantry (DENSO-FEED)
 */
export function createFeederStation(machineId: string, machineCode: string): Machine3DObject {
  const group = new THREE.Group() as Machine3DObject;
  group.userData = { machineId, machineCode, stationCode: 'OP30' };

  // Khung đế hàn ống thép
  const baseGeo = new THREE.BoxGeometry(2.2, 0.42, 2.0);
  const base = new THREE.Mesh(baseGeo, MATS.castIronDark);
  base.position.y = 0.21;
  base.castShadow = true;
  group.add(base);

  // Thùng cấp liệu số lượng lớn (Bulk Storage Hopper) trên giá nghiêng
  const hopperGeo = new THREE.BoxGeometry(0.6, 0.7, 0.5);
  const hopper = new THREE.Mesh(hopperGeo, MATS.steelGrey);
  hopper.position.set(-0.85, 1.85, -0.45);
  hopper.rotation.z = 0.15;
  group.add(hopper);

  // Phễu rung xoắn ốc (Vibratory Bowl Feeder) hình nón cụt
  const bowlGeo = new THREE.CylinderGeometry(0.75, 0.48, 0.75, 24);
  const bowl = new THREE.Mesh(bowlGeo, MATS.steelChrome);
  bowl.position.set(-0.25, 1.45, -0.2);
  bowl.castShadow = true;
  group.add(bowl);

  // Bệ rung điện từ (Electromagnetic Drive Base)
  const driveGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.45, 24);
  const drive = new THREE.Mesh(driveGeo, MATS.castIronDark);
  drive.position.set(-0.25, 0.85, -0.2);
  group.add(drive);

  // Máng dẫn phôi tuyến tính (Linear Feeder Track) có ray dẫn hướng
  const trackGeo = new THREE.BoxGeometry(1.6, 0.08, 0.18);
  const track = new THREE.Mesh(trackGeo, MATS.aluminumExtrusion);
  track.position.set(0.35, 1.15, 0.25);
  track.rotation.y = 0.25;
  group.add(track);

  // Cụm gắp phôi khí nén tốc độ cao (High-Speed Pneumatic Pick-and-Place)
  const gantryPillarGeo = new THREE.BoxGeometry(0.12, 1.8, 0.12);
  const gantryPillar = new THREE.Mesh(gantryPillarGeo, MATS.aluminumExtrusion);
  gantryPillar.position.set(0.75, 1.1, 0.55);
  group.add(gantryPillar);

  // Tay trượt ngang gantry
  const horizArmGeo = new THREE.BoxGeometry(0.85, 0.12, 0.12);
  const horizArm = new THREE.Mesh(horizArmGeo, MATS.densoEmerald);
  horizArm.position.set(0.5, 1.9, 0.55);
  group.add(horizArm);

  // Cụm xi lanh trượt đứng Z-stroke và tay kẹp khí nén
  const zCylGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 12);
  const zCyl = new THREE.Mesh(zCylGeo, MATS.steelChrome);
  zCyl.position.set(0.2, 1.55, 0.55);
  group.add(zCyl);

  // Ngón kẹp phôi song song (Parallel Gripper)
  const gripperGeo = new THREE.BoxGeometry(0.14, 0.1, 0.14);
  const gripper = new THREE.Mesh(gripperGeo, MATS.castIronDark);
  gripper.position.set(0.2, 1.2, 0.55);
  group.add(gripper);

  // Tủ điều khiển PLC / Van khí nén (Pneumatics Enclosure)
  const plcBoxGeo = new THREE.BoxGeometry(0.4, 1.3, 0.65);
  const plcBox = new THREE.Mesh(plcBoxGeo, MATS.aluminumExtrusion);
  plcBox.position.set(0.9, 0.95, -0.4);
  group.add(plcBox);

  // Cụm lọc khí nén FRL có đồng hồ đo áp suất
  const frlGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 12);
  const frl = new THREE.Mesh(frlGeo, MATS.acrylicGlass);
  frl.position.set(0.7, 1.0, -0.65);
  group.add(frl);

  // Tháp đèn Andon
  const andon = createAndonLight(2.9);
  andon.mesh.position.set(-0.95, 0.42, -0.75);
  group.add(andon.mesh);

  group.traverse((child) => {
    child.userData.machineId = machineId;
    child.userData.machineCode = machineCode;
    child.userData.parentGroup = group;
  });

  group.updateStatus = (status) => {
    const color = STATUS_COLORS_3D[status] || STATUS_COLORS_3D.OK;
    andon.lightMaterial.color.setHex(color.hex);
    andon.lightMaterial.emissive.setHex(color.emissive);
  };

  group.setStatusGlow = (highlighted) => {
    base.material = highlighted ? MATS.densoEmerald : MATS.castIronDark;
  };

  return group;
}

/**
 * 4. OP40: Máy thử nghiệm giai đoạn C buồng kín IoT (Phase C CAD Mentor Station)
 */
export function createTestChamberStation(machineId: string, machineCode: string): Machine3DObject {
  const group = new THREE.Group() as Machine3DObject;
  group.userData = { machineId, machineCode, stationCode: 'OP40' };

  // Bệ máy nhôm định hình kết hợp tủ ngăn dưới
  const baseGeo = new THREE.BoxGeometry(2.3, 0.45, 2.1);
  const base = new THREE.Mesh(baseGeo, MATS.castIronDark);
  base.position.y = 0.225;
  base.castShadow = true;
  group.add(base);

  // Buồng kiểm tra kín khí trung tâm màu xám bạc công nghiệp
  const chamberGeo = new THREE.BoxGeometry(1.85, 1.75, 1.7);
  const chamber = new THREE.Mesh(chamberGeo, MATS.aluminumExtrusion);
  chamber.position.set(0, 1.35, 0);
  chamber.castShadow = true;
  group.add(chamber);

  // Cửa quan sát kính chống lóa phía trước
  const windowFrameGeo = new THREE.BoxGeometry(1.3, 1.0, 0.08);
  const winFrame = new THREE.Mesh(windowFrameGeo, MATS.densoEmerald);
  winFrame.position.set(0, 1.45, 0.86);
  group.add(winFrame);

  const glassGeo = new THREE.BoxGeometry(1.15, 0.85, 0.03);
  const glass = new THREE.Mesh(glassGeo, MATS.acrylicGlass);
  glass.position.set(0, 1.45, 0.88);
  group.add(glass);

  // Cụm đầu đo cảm biến IoT gắn trên nóc buồng (Modbus/OPC-UA Multi-sensor Hub)
  const sensorHubGeo = new THREE.BoxGeometry(0.65, 0.3, 0.55);
  const sensorHub = new THREE.Mesh(sensorHubGeo, MATS.densoEmerald);
  sensorHub.position.set(0, 2.38, 0);
  group.add(sensorHub);

  // 3 cút nối cáp cảm biến tín hiệu (Sensor Glands)
  for (let x of [-0.2, 0, 0.2]) {
    const glandGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 12);
    const gland = new THREE.Mesh(glandGeo, MATS.steelChrome);
    gland.position.set(x, 2.58, 0);
    group.add(gland);
  }

  // Màn hình chẩn đoán HMI màu xanh công nghiệp
  const hmiArmGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 12);
  const hmiArm = new THREE.Mesh(hmiArmGeo, MATS.steelChrome);
  hmiArm.position.set(1.1, 1.6, 0.5);
  hmiArm.rotation.z = Math.PI / 4;
  group.add(hmiArm);

  const screenGeo = new THREE.BoxGeometry(0.55, 0.4, 0.08);
  const screen = new THREE.Mesh(screenGeo, MATS.hmiScreen);
  screen.position.set(1.35, 1.9, 0.5);
  screen.rotation.y = -Math.PI / 4;
  group.add(screen);

  // Đầu quét mã vạch / 2D DataMatrix trên giá cổ ngỗng
  const scannerGeo = new THREE.BoxGeometry(0.12, 0.08, 0.2);
  const scanner = new THREE.Mesh(scannerGeo, MATS.castIronDark);
  scanner.position.set(0.8, 1.25, 0.85);
  group.add(scanner);

  // Tháp đèn Andon
  const andon = createAndonLight(3.4);
  andon.mesh.position.set(-1.0, 0.45, -0.9);
  group.add(andon.mesh);

  group.traverse((child) => {
    child.userData.machineId = machineId;
    child.userData.machineCode = machineCode;
    child.userData.parentGroup = group;
  });

  group.updateStatus = (status) => {
    const color = STATUS_COLORS_3D[status] || STATUS_COLORS_3D.OK;
    andon.lightMaterial.color.setHex(color.hex);
    andon.lightMaterial.emissive.setHex(color.emissive);
  };

  group.setStatusGlow = (highlighted) => {
    base.material = highlighted ? MATS.densoEmerald : MATS.castIronDark;
  };

  return group;
}

/**
 * 5. OP50: Máy dập thủy lực hạng nặng 500 Tấn Komatsu (500T Stamping Press)
 */
export function createHeavyPressStation(machineId: string, machineCode: string): Machine3DObject {
  const group = new THREE.Group() as Machine3DObject;
  group.userData = { machineId, machineCode, stationCode: 'OP50' };

  // Khối bệ máy cực dày chịu tải 500 Tấn
  const baseGeo = new THREE.BoxGeometry(2.9, 0.65, 2.5);
  const base = new THREE.Mesh(baseGeo, MATS.castIronDark);
  base.position.y = 0.325;
  base.castShadow = true;
  group.add(base);

  // Bàn kẹp khuôn dưới (Heavy Bolster Plate)
  const bolsterGeo = new THREE.BoxGeometry(1.9, 0.2, 1.7);
  const bolster = new THREE.Mesh(bolsterGeo, MATS.steelChrome);
  bolster.position.set(0, 0.75, 0);
  group.add(bolster);

  // 2 trụ đứng khung hộp đúc nguyên khối Komatsu (Heavy Monoblock Uprights)
  const colGeo = new THREE.BoxGeometry(0.55, 3.5, 2.2);
  const colL = new THREE.Mesh(colGeo, MATS.castIronDark);
  colL.position.set(-1.18, 2.4, 0);
  colL.castShadow = true;

  const colR = new THREE.Mesh(colGeo, MATS.castIronDark);
  colR.position.set(1.18, 2.4, 0);
  colR.castShadow = true;
  group.add(colL, colR);

  // Vòm dầm hộp đỉnh đồ sộ (Enclosed Crown Gearbox Housing) màu xanh DENSO
  const crownGeo = new THREE.BoxGeometry(2.9, 1.25, 2.3);
  const crown = new THREE.Mesh(crownGeo, MATS.densoEmerald);
  crown.position.set(0, 4.45, 0);
  crown.castShadow = true;
  group.add(crown);

  // Trục truyền động và nắp bảo vệ bánh đà quán tính (Flywheel Cover)
  const flywheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.35, 24);
  const flywheel = new THREE.Mesh(flywheelGeo, MATS.steelGrey);
  flywheel.position.set(1.5, 4.45, 0);
  flywheel.rotation.z = Math.PI / 2;
  group.add(flywheel);

  // Khối trượt dập 8 điểm dẫn hướng (500T Ram Slide)
  const slideGeo = new THREE.BoxGeometry(1.75, 0.85, 1.6);
  const slide = new THREE.Mesh(slideGeo, MATS.steelChrome);
  slide.position.set(0, 2.65, 0);
  slide.castShadow = true;
  group.add(slide);

  // Khối khuôn dập trên dập khung gầm
  const upperDieGeo = new THREE.BoxGeometry(1.4, 0.35, 1.2);
  const upperDie = new THREE.Mesh(upperDieGeo, MATS.steelGrey);
  upperDie.position.set(0, 2.15, 0);
  group.add(upperDie);

  // Rèm quang an toàn hồng ngoại (Infrared Optical Light Curtains)
  for (let x of [-0.85, 0.85]) {
    // Trụ cảm biến an toàn màu vàng
    const curPostGeo = new THREE.BoxGeometry(0.08, 1.9, 0.08);
    const curPost = new THREE.Mesh(curPostGeo, MATS.safetyYellow);
    curPost.position.set(x, 1.7, 1.05);
    group.add(curPost);
  }

  // Chùm tia laser hồng ngoại bảo vệ an toàn
  const beamGeo = new THREE.PlaneGeometry(1.65, 1.7);
  const beam = new THREE.Mesh(beamGeo, MATS.laserBeam);
  beam.position.set(0, 1.7, 1.05);
  group.add(beam);

  // Bục điều khiển 2 tay an toàn của công nhân (Two-hand palm station)
  const consoleGeo = new THREE.BoxGeometry(0.6, 0.9, 0.4);
  const consoleBox = new THREE.Mesh(consoleGeo, MATS.aluminumExtrusion);
  consoleBox.position.set(0, 0.45, 1.55);
  group.add(consoleBox);

  // Tháp đèn Andon đỉnh máy
  const andon = createAndonLight(5.2);
  andon.mesh.position.set(-1.25, 0.65, -1.05);
  group.add(andon.mesh);

  group.traverse((child) => {
    child.userData.machineId = machineId;
    child.userData.machineCode = machineCode;
    child.userData.parentGroup = group;
  });

  group.updateStatus = (status) => {
    const color = STATUS_COLORS_3D[status] || STATUS_COLORS_3D.OK;
    andon.lightMaterial.color.setHex(color.hex);
    andon.lightMaterial.emissive.setHex(color.emissive);
  };

  group.setStatusGlow = (highlighted) => {
    base.material = highlighted ? MATS.densoEmerald : MATS.castIronDark;
  };

  return group;
}

/**
 * 6. OP60: Robot hàn điểm 6 trục Fanuc R-2000iC (Spot Welding Robot)
 */
export function createWeldingRobotStation(machineId: string, machineCode: string): Machine3DObject {
  const group = new THREE.Group() as Machine3DObject;
  group.userData = { machineId, machineCode, stationCode: 'OP60' };

  // Bệ gắn sàn thép tròn dày
  const baseGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.45, 24);
  const base = new THREE.Mesh(baseGeo, MATS.castIronDark);
  base.position.y = 0.225;
  base.castShadow = true;
  group.add(base);

  // Khớp xoay J1 (Turntable Waist) vàng Fanuc
  const j1Geo = new THREE.CylinderGeometry(0.58, 0.68, 0.55, 24);
  const j1 = new THREE.Mesh(j1Geo, MATS.fanucYellow);
  j1.position.y = 0.725;
  j1.castShadow = true;
  group.add(j1);

  // Khối đối trọng xilanh khí nén sau lưng J2
  const counterGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.9, 16);
  const counter = new THREE.Mesh(counterGeo, MATS.castIronDark);
  counter.position.set(-0.35, 1.35, 0);
  counter.rotation.z = 0.4;
  group.add(counter);

  // Khớp vai J2 và cánh tay dưới (Lower Arm) vươn cao
  const j2Geo = new THREE.BoxGeometry(0.38, 1.5, 0.38);
  const j2 = new THREE.Mesh(j2Geo, MATS.fanucYellow);
  j2.position.set(0.18, 1.55, 0);
  j2.rotation.z = -0.32;
  j2.castShadow = true;
  group.add(j2);

  // Khớp khuỷu J3 (Elbow Casting)
  const elbowGeo = new THREE.SphereGeometry(0.32, 16, 16);
  const elbow = new THREE.Mesh(elbowGeo, MATS.castIronDark);
  elbow.position.set(0.42, 2.25, 0);
  group.add(elbow);

  // Cánh tay trên J4/J5 (Upper Arm & Forearm) vươn chúc về phía trước
  const j4Geo = new THREE.BoxGeometry(1.35, 0.28, 0.28);
  const j4 = new THREE.Mesh(j4Geo, MATS.fanucYellow);
  j4.position.set(1.0, 2.35, 0);
  j4.rotation.z = 0.18;
  j4.castShadow = true;
  group.add(j4);

  // Cụm cổ tay J6 (Articulated Wrist Assembly)
  const wristGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.32, 16);
  const wrist = new THREE.Mesh(wristGeo, MATS.castIronDark);
  wrist.position.set(1.68, 2.22, 0);
  wrist.rotation.z = Math.PI / 2;
  group.add(wrist);

  // Cụm súng hàn điểm chữ C servo (Servo Spot Welding Gun)
  const gunFrameGeo = new THREE.BoxGeometry(0.5, 0.45, 0.28);
  const gunFrame = new THREE.Mesh(gunFrameGeo, MATS.castIronDark);
  gunFrame.position.set(1.95, 2.2, 0);
  group.add(gunFrame);

  // Động cơ servo kẹp súng hàn
  const gunMotorGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 12);
  const gunMotor = new THREE.Mesh(gunMotorGeo, MATS.densoEmerald);
  gunMotor.position.set(1.95, 2.5, 0);
  group.add(gunMotor);

  // 2 tay gọng hàn và đầu điện cực đồng đỏ (Copper Spot Electrodes)
  const armUpperGeo = new THREE.BoxGeometry(0.35, 0.08, 0.08);
  const armUpper = new THREE.Mesh(armUpperGeo, MATS.copperAlloy);
  armUpper.position.set(2.25, 2.38, 0);

  const armLowerGeo = new THREE.BoxGeometry(0.35, 0.08, 0.08);
  const armLower = new THREE.Mesh(armLowerGeo, MATS.copperAlloy);
  armLower.position.set(2.25, 2.02, 0);

  const tipGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 12);
  const tipUpper = new THREE.Mesh(tipGeo, MATS.copperAlloy);
  tipUpper.position.set(2.4, 2.28, 0);

  const tipLower = new THREE.Mesh(tipGeo, MATS.copperAlloy);
  tipLower.position.set(2.4, 2.12, 0);

  group.add(armUpper, armLower, tipUpper, tipLower);

  // Ống ruột gà dẫn cáp tín hiệu & nước làm mát (Cable Dress Pack) uốn lượn
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.1, 0.8, -0.3),
    new THREE.Vector3(0.1, 1.4, -0.35),
    new THREE.Vector3(0.5, 2.2, -0.25),
    new THREE.Vector3(1.4, 2.4, -0.15),
    new THREE.Vector3(1.85, 2.3, 0),
  ]);
  const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.045, 8, false);
  const tube = new THREE.Mesh(tubeGeo, MATS.blackRubber);
  group.add(tube);

  // Hàng rào lưới bảo vệ an toàn xung quanh robot (Safety Perimeter Fence)
  const fenceGeo = new THREE.BoxGeometry(2.6, 1.6, 0.04);
  const fence = new THREE.Mesh(fenceGeo, MATS.safetyYellow);
  fence.position.set(0.8, 0.8, -1.35);
  group.add(fence);

  // Tháp đèn Andon
  const andon = createAndonLight(3.6);
  andon.mesh.position.set(-0.95, 0.45, -0.95);
  group.add(andon.mesh);

  group.traverse((child) => {
    child.userData.machineId = machineId;
    child.userData.machineCode = machineCode;
    child.userData.parentGroup = group;
  });

  group.updateStatus = (status) => {
    const color = STATUS_COLORS_3D[status] || STATUS_COLORS_3D.OK;
    andon.lightMaterial.color.setHex(color.hex);
    andon.lightMaterial.emissive.setHex(color.emissive);
  };

  group.setStatusGlow = (highlighted) => {
    base.material = highlighted ? MATS.densoEmerald : MATS.castIronDark;
  };

  return group;
}

/**
 * Factory tạo đối tượng 3D tương ứng theo loại công đoạn
 */
export function createMachine3D(
  modelType: string,
  machineId: string,
  machineCode: string
): Machine3DObject {
  switch (modelType) {
    case 'tightener':
      return createTightenerStation(machineId, machineCode);
    case 'hydraulic_press':
      return createHydraulicPressStation(machineId, machineCode);
    case 'feeder':
      return createFeederStation(machineId, machineCode);
    case 'test_chamber':
      return createTestChamberStation(machineId, machineCode);
    case 'heavy_press':
      return createHeavyPressStation(machineId, machineCode);
    case 'welding_robot':
      return createWeldingRobotStation(machineId, machineCode);
    default:
      return createTestChamberStation(machineId, machineCode);
  }
}
