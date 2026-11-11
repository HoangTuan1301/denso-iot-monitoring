/**
 * @file line3DLayout.ts
 * @description Định nghĩa tọa độ không gian 3D, quy cách bố trí dây chuyền và bảng màu công nghiệp
 * cho phân hệ 3D Digital Twin - Line 1 (LN-PRS-01) DENSO Smart Factory.
 * - Tối ưu hóa khoảng cách và tỷ lệ hiển thị giúp 6 máy nổi bật, không bị lọt thỏm trong không gian
 * - Tọa độ camera Isometric 3/4 căn chuẩn theo bounding box của dây chuyền
 */

export interface Station3DConfig {
  opCode: string;
  defaultDbId: string;
  defaultMachineCode: string;
  name: string;
  modelType: 'tightener' | 'hydraulic_press' | 'feeder' | 'test_chamber' | 'heavy_press' | 'welding_robot';
  posX: number;
  posY: number;
  posZ: number;
  rotationY: number;
  scale: number;
  description: string;
}

/**
 * Tọa độ và thông số bố trí của 6 trạm công đoạn trên Line 1 (LN-PRS-01)
 * Khoảng cách được căn chỉnh tối ưu (bước ~3.4 - 3.6m), tỷ lệ hiển thị phóng lớn
 * giúp lấp đầy khung nhìn một cách trực quan, chuyên nghiệp.
 */
export const LINE1_STATIONS_3D: Station3DConfig[] = [
  {
    opCode: 'OP10',
    defaultDbId: 'MC-ASM-01',
    defaultMachineCode: 'MC-ASM-01',
    name: 'Trạm siết bulong tự động',
    modelType: 'tightener',
    posX: -8.5,
    posY: 0,
    posZ: 0,
    rotationY: 0,
    scale: 1.25,
    description: 'Trạm siết mô-men xoắn tự động đa trục gantry Atlas Copco',
  },
  {
    opCode: 'OP20',
    defaultDbId: 'MC-CYL-01',
    defaultMachineCode: 'MC-CYL-01',
    name: 'Máy dập xi lanh thủy lực',
    modelType: 'hydraulic_press',
    posX: -5.1,
    posY: 0,
    posZ: 0,
    rotationY: 0,
    scale: 1.25,
    description: 'Máy ép xi-lanh thủy lực định hình 4 trụ crom SMC',
  },
  {
    opCode: 'OP30',
    defaultDbId: 'MC-FDR-01',
    defaultMachineCode: 'MC-FDR-01',
    name: 'Máy cấp phôi tự động',
    modelType: 'feeder',
    posX: -1.7,
    posY: 0,
    posZ: 0,
    rotationY: 0,
    scale: 1.25,
    description: 'Hệ thống phễu rung xoắn ốc & tay gắp phôi DENSO-FEED',
  },
  {
    opCode: 'OP40',
    defaultDbId: 'MC-TEST-C01',
    defaultMachineCode: 'MC-PHASE-C',
    name: 'Máy thử nghiệm giai đoạn C',
    modelType: 'test_chamber',
    posX: 1.7,
    posY: 0,
    posZ: 0,
    rotationY: 0,
    scale: 1.25,
    description: 'Buồng thử nghiệm giai đoạn C đa cảm biến IoT (CAD Mentor)',
  },
  {
    opCode: 'OP50',
    defaultDbId: 'MCH-PRS-01',
    defaultMachineCode: 'STP-01',
    name: 'Máy dập thủy lực 500T Komatsu',
    modelType: 'heavy_press',
    posX: 5.3,
    posY: 0,
    posZ: 0,
    rotationY: 0,
    scale: 1.35,
    description: 'Máy dập hạng nặng 500 Tấn Komatsu dập khung gầm',
  },
  {
    opCode: 'OP60',
    defaultDbId: 'MCH-WLD-01',
    defaultMachineCode: 'ROB-01',
    name: 'Robot hàn điểm Fanuc R-2000iC',
    modelType: 'welding_robot',
    posX: 8.8,
    posY: 0,
    posZ: 0,
    rotationY: 0,
    scale: 1.25,
    description: 'Robot hàn điểm tự động Fanuc R-2000iC 6 bậc tự do',
  },
];

/**
 * Tọa độ các điểm mút luồng chuyền và kích thước sàn nhà máy tối ưu
 */
export const LINE_FLOW_BOUNDS = {
  inputX: -12.2,
  outputX: 12.2,
  conveyorY: 0.65,
  conveyorZ: 0,
  floorWidth: 27,
  floorDepth: 13,
};

/**
 * Bảng màu trạng thái công nghiệp chuẩn hóa cho mô hình 3D
 */
export const STATUS_COLORS_3D = {
  OK: {
    hex: 0x10b981,
    emissive: 0x059669,
    css: '#10b981',
    label: 'Đang chạy',
  },
  WARNING: {
    hex: 0xf59e0b,
    emissive: 0xd97706,
    css: '#f59e0b',
    label: 'Cần theo dõi',
  },
  CRITICAL: {
    hex: 0xef4444,
    emissive: 0xb91c1c,
    css: '#ef4444',
    label: 'Nguy hiểm',
  },
  STOPPED: {
    hex: 0x64748b,
    emissive: 0x334155,
    css: '#64748b',
    label: 'Dừng máy',
  },
  OFFLINE: {
    hex: 0x475569,
    emissive: 0x1e293b,
    css: '#475569',
    label: 'Mất kết nối',
  },
};

/**
 * Vị trí camera Isometric mặc định (Góc 3/4 nhìn trực diện cận cảnh, ôm trọn 6 máy)
 */
export const DEFAULT_CAMERA_POSITION = {
  x: 0,
  y: 8.2,
  z: 14.5,
};

export const DEFAULT_CAMERA_TARGET = {
  x: 0,
  y: 1.3,
  z: 0,
};
