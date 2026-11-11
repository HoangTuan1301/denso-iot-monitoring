/**
 * @file ProductionFlow3D.ts
 * @description Môi trường sàn nhà xưởng 3D và luồng truyền động công đoạn (Production Flow)
 * cho Line 1 (LN-PRS-01) - Phiên bản Digital Twin Công nghiệp cao cấp.
 * - Sàn epoxy nguyên khối màu xám nhạt bóng nhẹ (đã gỡ bỏ lưới ô vuông dày đặc)
 * - Vạch kẻ an toàn 5S phân định từng trạm máy (Workstation Safety Cells)
 * - Băng chuyền con lăn thép (Roller Conveyor) với dải LED dẫn hướng dòng chảy sản phẩm
 * - Bục ĐẦU VÀO (INPUT) và ĐẦU RA (OUTPUT) thiết kế bục kim loại phay xước chuyên nghiệp
 */

import * as THREE from 'three';
import { LINE_FLOW_BOUNDS, LINE1_STATIONS_3D } from './line3DLayout';

export interface ProductionEnvironment3D {
  group: THREE.Group;
  animate: (time: number) => void;
  dispose: () => void;
}

export function createProductionEnvironment(isDarkMode: boolean = false): ProductionEnvironment3D {
  const envGroup = new THREE.Group();

  const floorWidth = LINE_FLOW_BOUNDS.floorWidth;
  const floorDepth = LINE_FLOW_BOUNDS.floorDepth;

  // 1. SÀN NHÀ XƯỞNG EPOXY CÔNG NGHIỆP NGUYÊN KHỐI (Không dùng lưới kẻ thô)
  const floorGeo = new THREE.BoxGeometry(floorWidth, 0.4, floorDepth);
  const floorMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0x0f172a : 0xe2e8f0, // Epoxy light grey in light mode, dark slate in dark mode
    metalness: 0.2,
    roughness: 0.35, // Độ bóng mịn của sàn epoxy công nghiệp
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  envGroup.add(floor);

  // Viền vát cạnh trang trí sàn (Beveled Base Trim)
  const trimGeo = new THREE.BoxGeometry(floorWidth + 0.4, 0.15, floorDepth + 0.4);
  const trimMat = new THREE.MeshStandardMaterial({
    color: isDarkMode ? 0x0284c7 : 0x059669,
    metalness: 0.5,
    roughness: 0.4,
  });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.y = -0.3;
  envGroup.add(trim);

  // 2. PHÂN VÙNG AN TOÀN 5S (SAFETY CELLS) CHO TỪNG TRẠM MÁY
  const yellowLineMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.1,
    roughness: 0.6,
  });

  LINE1_STATIONS_3D.forEach((st) => {
    const cellW = 3.0;
    const cellD = 3.8;

    // Khung chữ nhật viền an toàn quanh từng máy
    const cellFrameGeo = new THREE.BoxGeometry(cellW, 0.015, cellD);
    const cellPlate = new THREE.Mesh(
      cellFrameGeo,
      new THREE.MeshStandardMaterial({
        color: isDarkMode ? 0x1e293b : 0xf1f5f9,
        roughness: 0.5,
      })
    );
    cellPlate.position.set(st.posX, 0.008, st.posZ);
    cellPlate.receiveShadow = true;
    envGroup.add(cellPlate);

    // Vạch vàng an toàn 2 bên
    const sideMarkGeo = new THREE.BoxGeometry(0.1, 0.02, cellD);
    const markL = new THREE.Mesh(sideMarkGeo, yellowLineMat);
    markL.position.set(st.posX - cellW / 2, 0.015, st.posZ);
    const markR = new THREE.Mesh(sideMarkGeo, yellowLineMat);
    markR.position.set(st.posX + cellW / 2, 0.015, st.posZ);
    envGroup.add(markL, markR);
  });

  // 3. ĐƯỜNG BĂNG TẢI CON LĂN TRUYỀN ĐỘNG LOGIC (Industrial Roller Conveyor)
  const trackLength = LINE_FLOW_BOUNDS.outputX - LINE_FLOW_BOUNDS.inputX;

  // Khung dầm 2 bên băng tải (Side Rails)
  const railGeo = new THREE.BoxGeometry(trackLength, 0.18, 0.06);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.85,
    roughness: 0.25,
  });

  const railFront = new THREE.Mesh(railGeo, railMat);
  railFront.position.set(0, LINE_FLOW_BOUNDS.conveyorY, LINE_FLOW_BOUNDS.conveyorZ + 0.5);
  const railBack = new THREE.Mesh(railGeo, railMat);
  railBack.position.set(0, LINE_FLOW_BOUNDS.conveyorY, LINE_FLOW_BOUNDS.conveyorZ - 0.5);
  envGroup.add(railFront, railBack);

  // Chân đỡ băng tải (Support Legs) đặt cách đều
  const legCount = 9;
  const legStep = trackLength / (legCount - 1);
  const legGeo = new THREE.BoxGeometry(0.08, LINE_FLOW_BOUNDS.conveyorY, 1.05);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });

  for (let i = 0; i < legCount; i++) {
    const leg = new THREE.Mesh(legGeo, legMat);
    const legX = LINE_FLOW_BOUNDS.inputX + i * legStep;
    leg.position.set(legX, LINE_FLOW_BOUNDS.conveyorY / 2, LINE_FLOW_BOUNDS.conveyorZ);
    envGroup.add(leg);
  }

  // Mặt con lăn thép (Steel Rollers Array)
  const rollerCount = 42;
  const rollerStep = trackLength / (rollerCount + 1);
  const rollerGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.94, 12);
  const rollerMat = new THREE.MeshStandardMaterial({
    color: 0xcfd8dc,
    metalness: 0.95,
    roughness: 0.15,
  });

  for (let i = 0; i < rollerCount; i++) {
    const roller = new THREE.Mesh(rollerGeo, rollerMat);
    const rX = LINE_FLOW_BOUNDS.inputX + (i + 1) * rollerStep;
    roller.position.set(rX, LINE_FLOW_BOUNDS.conveyorY, LINE_FLOW_BOUNDS.conveyorZ);
    roller.rotation.x = Math.PI / 2;
    envGroup.add(roller);
  }

  // 4. DẢI LED DẪN HƯỚNG DÒNG SẢN PHẨM (Directional Flow Light Pulses)
  const pulseCount = 7;
  const pulses: THREE.Mesh[] = [];
  const pulseMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
  });

  const pulseStep = trackLength / (pulseCount + 1);
  for (let i = 0; i < pulseCount; i++) {
    const arrowGeo = new THREE.ConeGeometry(0.14, 0.35, 4);
    const arrow = new THREE.Mesh(arrowGeo, pulseMat);
    const pX = LINE_FLOW_BOUNDS.inputX + (i + 1) * pulseStep;
    arrow.position.set(pX, LINE_FLOW_BOUNDS.conveyorY + 0.12, LINE_FLOW_BOUNDS.conveyorZ);
    arrow.rotation.z = -Math.PI / 2;
    arrow.rotation.x = Math.PI / 2;
    envGroup.add(arrow);
    pulses.push(arrow);
  }

  // 5. BỤC ĐẦU VÀO (INPUT Station - Trạm nạp liệu)
  const ioMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8, // Blue DENSO
    metalness: 0.4,
    roughness: 0.3,
  });

  const inputGeo = new THREE.BoxGeometry(1.6, 1.1, 1.5);
  const inputStation = new THREE.Mesh(inputGeo, ioMat);
  inputStation.position.set(LINE_FLOW_BOUNDS.inputX, 0.55, LINE_FLOW_BOUNDS.conveyorZ);
  inputStation.castShadow = true;
  envGroup.add(inputStation);

  // Đĩa xoay pallet đầu vào
  const plateGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 24);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
  const inputPlate = new THREE.Mesh(plateGeo, plateMat);
  inputPlate.position.set(LINE_FLOW_BOUNDS.inputX, 1.15, LINE_FLOW_BOUNDS.conveyorZ);
  envGroup.add(inputPlate);

  // 6. BỤC ĐẦU RA (OUTPUT Station - Trạm thu thành phẩm)
  const outputGeo = new THREE.BoxGeometry(1.6, 1.1, 1.5);
  const outputStation = new THREE.Mesh(outputGeo, ioMat);
  outputStation.position.set(LINE_FLOW_BOUNDS.outputX, 0.55, LINE_FLOW_BOUNDS.conveyorZ);
  outputStation.castShadow = true;
  envGroup.add(outputStation);

  const outputPlate = new THREE.Mesh(plateGeo, plateMat);
  outputPlate.position.set(LINE_FLOW_BOUNDS.outputX, 1.15, LINE_FLOW_BOUNDS.conveyorZ);
  envGroup.add(outputPlate);

  const animate = (time: number) => {
    // Hiệu ứng sóng ánh sáng nhẹ của các mũi tên dòng sản phẩm
    pulses.forEach((arrow, idx) => {
      const phase = (time * 0.003 + idx * 0.7) % Math.PI;
      const intensity = 0.4 + 0.9 * Math.sin(phase);
      (arrow.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    });
  };

  const dispose = () => {
    floorGeo.dispose();
    floorMat.dispose();
    trimGeo.dispose();
    trimMat.dispose();
    yellowLineMat.dispose();
    railGeo.dispose();
    railMat.dispose();
    legGeo.dispose();
    legMat.dispose();
    rollerGeo.dispose();
    rollerMat.dispose();
    pulseMat.dispose();
    ioMat.dispose();
    plateGeo.dispose();
    plateMat.dispose();
  };

  return { group: envGroup, animate, dispose };
}
