/**
 * @file mockData.ts
 * @description Bộ dữ liệu mẫu chuẩn công nghiệp cho Hệ thống Giám sát 3 Tầng Nhà máy Denso
 */

import { ProductionLine, MetricHistoryPoint } from '../types/hierarchy';
import { AlarmEvent } from '../types/alarm';
import { UserProfile } from '../types/auth';

/**
 * Hàm hỗ trợ sinh dữ liệu lịch sử đo lường (Time-series) cho 15 phút gần nhất
 */
function generateHistoricalData(baseValue: number, variance: number, points: number = 15): MetricHistoryPoint[] {
  const history: MetricHistoryPoint[] = [];
  const now = new Date();

  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 1000);
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');
    
    // Tạo dao động ngẫu nhiên xung quanh giá trị chuẩn
    const randomOffset = (Math.random() - 0.5) * 2 * variance;
    const value = Number(Math.max(0, baseValue + randomOffset).toFixed(2));

    history.push({
      timestamp: `${hours}:${minutes}:${seconds}`,
      value,
    });
  }

  return history;
}

/**
 * Dữ liệu 3 Tầng Giám Sát Nhà Máy (Tầng 1 -> Tầng 2 -> Tầng 3)
 */
export const initialProductionLines: ProductionLine[] = [
  // ==========================================================================
  // LINE 1: DÂY CHUYỀN LẮP RÁP ĐỘNG CƠ (ASSEMBLY LINE 1)
  // ==========================================================================
  {
    id: 'LINE-01',
    name: 'Dây chuyền Lắp ráp Động cơ 01',
    code: 'LINE-ASM-01',
    status: 'normal',
    safetyScore: 98,
    operatingHours: 1420,
    description: 'Chuyên gia công và lắp ghép chi tiết lốc máy & trục khuỷu động cơ',
    machines: [
      {
        id: 'MC-FDR-01',
        name: 'Máy cấp phôi tự động 01',
        model: 'DENSO-FEED-V2',
        lineId: 'LINE-01',
        status: 'normal',
        qrCode: 'DENSO-MC-FDR-01',
        location: 'Trạm A1 - Khu vực Cấp liệu',
        lastMaintenance: '2026-09-10',
        metrics: [
          {
            id: 'MTR-FDR-01-PRS',
            name: 'Áp suất khí nén cấp phôi',
            unit: 'bar',
            currentValue: 6.2,
            rawVal: 2540,
            status: 'normal',
            warningMin: 4.5,
            warningMax: 7.5,
            criticalMin: 3.5,
            criticalMax: 8.5,
            plcMapping: {
              address: 'D1000',
              dataType: 'DEC12',
              rawMin: 0,
              rawMax: 4095,
              engMin: 0,
              engMax: 10,
              description: 'Cảm biến áp suất khí nén cấp trạm A1',
            },
            history: generateHistoricalData(6.2, 0.3),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-FDR-01-SPD',
            name: 'Tốc độ cấp phôi',
            unit: 'chi tiết/phút',
            currentValue: 45.0,
            rawVal: 450,
            status: 'normal',
            warningMin: 30.0,
            warningMax: 60.0,
            criticalMin: 20.0,
            criticalMax: 70.0,
            plcMapping: {
              address: 'D1002',
              dataType: 'SCALE',
              scaleMultiplier: 0.1,
              scaleOffset: 0,
              description: 'Tốc độ mâm xoay cấp liệu',
            },
            history: generateHistoricalData(45.0, 2.5),
            lastUpdated: 'Vừa xong',
          },
        ],
      },
      {
        id: 'MC-CYL-01',
        name: 'Máy ép xi-lanh thủy lực 01',
        model: 'SMC-HYD-500T',
        lineId: 'LINE-01',
        status: 'normal',
        qrCode: 'DENSO-MC-CYL-01',
        location: 'Trạm A2 - Ép định vị',
        lastMaintenance: '2026-09-18',
        metrics: [
          {
            id: 'MTR-CYL-01-PRS',
            name: 'Áp suất nén ép trục',
            unit: 'bar',
            currentValue: 125.4,
            rawVal: 2570,
            status: 'normal',
            warningMin: 90.0,
            warningMax: 145.0,
            criticalMin: 80.0,
            criticalMax: 160.0,
            plcMapping: {
              address: 'D1010',
              dataType: 'DEC12',
              rawMin: 0,
              rawMax: 4095,
              engMin: 0,
              engMax: 200,
              description: 'Áp lực bơm dầu nén xi lanh',
            },
            history: generateHistoricalData(125.4, 4.0),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-CYL-01-TMP',
            name: 'Nhiệt độ dầu thủy lực',
            unit: '°C',
            currentValue: 54.2,
            rawVal: 1850,
            status: 'normal',
            warningMin: 30.0,
            warningMax: 65.0,
            criticalMin: 20.0,
            criticalMax: 75.0,
            plcMapping: {
              address: 'D1012',
              dataType: 'DEC12',
              rawMin: 0,
              rawMax: 4095,
              engMin: 0,
              engMax: 120,
              description: 'Nhiệt độ bể chứa dầu tuần hoàn',
            },
            history: generateHistoricalData(54.2, 1.2),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-CYL-01-VIB',
            name: 'Độ rung khung máy',
            unit: 'mm/s',
            currentValue: 2.1,
            rawVal: 21,
            status: 'normal',
            warningMin: 0.0,
            warningMax: 4.5,
            criticalMin: 0.0,
            criticalMax: 7.0,
            plcMapping: {
              address: 'D1014',
              dataType: 'SCALE',
              scaleMultiplier: 0.1,
              scaleOffset: 0,
              description: 'Cảm biến gia tốc rung trục Z',
            },
            history: generateHistoricalData(2.1, 0.4),
            lastUpdated: 'Vừa xong',
          },
        ],
      },
      {
        id: 'MC-ROB-02',
        name: 'Robot siết bu-lông tự động 02',
        model: 'DENSO-VS-068',
        lineId: 'LINE-01',
        status: 'normal',
        qrCode: 'DENSO-MC-ROB-02',
        location: 'Trạm A3 - Siết nắp máy',
        lastMaintenance: '2026-09-22',
        metrics: [
          {
            id: 'MTR-ROB-02-TRQ',
            name: 'Mô-men siết Torque',
            unit: 'N.m',
            currentValue: 34.8,
            rawVal: 34.8,
            status: 'normal',
            warningMin: 30.0,
            warningMax: 40.0,
            criticalMin: 28.0,
            criticalMax: 42.0,
            plcMapping: {
              address: 'D1020',
              dataType: 'FLOAT32',
              description: 'Lực xoắn đầu trục siết ốc',
            },
            history: generateHistoricalData(34.8, 1.1),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-ROB-02-MOT',
            name: 'Nhiệt độ Servo Motor Trục 1',
            unit: '°C',
            currentValue: 46.5,
            rawVal: 1587,
            status: 'normal',
            warningMin: 25.0,
            warningMax: 65.0,
            criticalMin: 15.0,
            criticalMax: 80.0,
            plcMapping: {
              address: 'D1024',
              dataType: 'DEC12',
              rawMin: 0,
              rawMax: 4095,
              engMin: 0,
              engMax: 120,
              description: 'Cảm biến nhiệt gắn trong stator servo',
            },
            history: generateHistoricalData(46.5, 1.5),
            lastUpdated: 'Vừa xong',
          },
        ],
      },
    ],
  },

  // ==========================================================================
  // LINE 2: DÂY CHUYỀN KIỂM THỬ & ĐO LƯỜNG (TESTING & CALIBRATION LINE 2)
  // Có 1 cảnh báo Warning để thể hiện visual alert
  // ==========================================================================
  {
    id: 'LINE-02',
    name: 'Dây chuyền Kiểm thử & Hiệu chuẩn 02',
    code: 'LINE-TST-02',
    status: 'warning',
    safetyScore: 84,
    operatingHours: 980,
    description: 'Kiểm tra độ kín khít rò rỉ áp suất và phân tích độ rung ồn âm học',
    machines: [
      {
        id: 'MC-TST-01',
        name: 'Bàn thử rò rỉ khí áp suất cao',
        model: 'COSMO-AIR-LEAK-800',
        lineId: 'LINE-02',
        status: 'warning',
        qrCode: 'DENSO-MC-TST-01',
        location: 'Trạm T1 - Thử kín buồng nén',
        lastMaintenance: '2026-09-05',
        metrics: [
          {
            id: 'MTR-TST-01-PRS',
            name: 'Áp suất buồng thử kín',
            unit: 'kPa',
            currentValue: 412.0,
            rawVal: 3375,
            status: 'normal',
            warningMin: 380.0,
            warningMax: 440.0,
            criticalMin: 350.0,
            criticalMax: 470.0,
            plcMapping: {
              address: 'D2000',
              dataType: 'DEC12',
              rawMin: 0,
              rawMax: 4095,
              engMin: 0,
              engMax: 500,
              description: 'Áp suất duy trì buồng test',
            },
            history: generateHistoricalData(412.0, 5.0),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-TST-01-LEAK',
            name: 'Lưu lượng rò rỉ khí (Leak Rate)',
            unit: 'sccm',
            currentValue: 4.8, // Vượt warningMax 4.0!
            rawVal: 48,
            status: 'warning',
            warningMin: 0.0,
            warningMax: 4.0,
            criticalMin: 0.0,
            criticalMax: 8.0,
            plcMapping: {
              address: 'D2002',
              dataType: 'SCALE',
              scaleMultiplier: 0.1,
              scaleOffset: 0,
              description: 'Cảm biến chênh lệch áp vi mô đo rò rỉ',
            },
            history: generateHistoricalData(4.8, 0.6),
            lastUpdated: 'Vừa xong',
          },
        ],
      },
      {
        id: 'MC-NVH-01',
        name: 'Trạm đo rung & âm thanh NVH',
        model: 'DENSO-NVH-PRO',
        lineId: 'LINE-02',
        status: 'normal',
        qrCode: 'DENSO-MC-NVH-01',
        location: 'Trạm T2 - Phòng cách âm',
        lastMaintenance: '2026-09-15',
        metrics: [
          {
            id: 'MTR-NVH-01-DB',
            name: 'Độ ồn trung bình (Noise Level)',
            unit: 'dB',
            currentValue: 68.2,
            rawVal: 682,
            status: 'normal',
            warningMin: 40.0,
            warningMax: 82.0,
            criticalMin: 30.0,
            criticalMax: 90.0,
            plcMapping: {
              address: 'D2010',
              dataType: 'SCALE',
              scaleMultiplier: 0.1,
              scaleOffset: 0,
              description: 'Microphone đo áp suất âm thanh phòng kiểm tra',
            },
            history: generateHistoricalData(68.2, 2.0),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-NVH-01-RMS',
            name: 'Vận tốc rung hiệu dụng RMS',
            unit: 'mm/s',
            currentValue: 1.85,
            rawVal: 185,
            status: 'normal',
            warningMin: 0.0,
            warningMax: 3.5,
            criticalMin: 0.0,
            criticalMax: 5.5,
            plcMapping: {
              address: 'D2012',
              dataType: 'SCALE',
              scaleMultiplier: 0.01,
              scaleOffset: 0,
              description: 'Cảm biến đo rung 3 trục piezoelectric',
            },
            history: generateHistoricalData(1.85, 0.2),
            lastUpdated: 'Vừa xong',
          },
        ],
      },
    ],
  },

  // ==========================================================================
  // LINE 3: DÂY CHUYỀN ĐÓNG GÓI & BĂNG CHUYỀN (PACKAGING LINE 3)
  // Có 1 cảnh báo Critical để thử nghiệm nhấp nháy đỏ & quy trình nhận sửa
  // ==========================================================================
  {
    id: 'LINE-03',
    name: 'Dây chuyền Đóng gói & Vận chuyển 03',
    code: 'LINE-PKG-03',
    status: 'critical',
    safetyScore: 68,
    operatingHours: 2310,
    description: 'Hệ thống băng chuyền phân loại tự động và robot xếp thùng lên pallet',
    machines: [
      {
        id: 'MC-CVY-01',
        name: 'Động cơ Băng chuyền biến tần 01',
        model: 'MITSUBISHI-FR-A800',
        lineId: 'LINE-03',
        status: 'critical',
        qrCode: 'DENSO-MC-CVY-01',
        location: 'Trạm P1 - Băng tải trung chuyển',
        lastMaintenance: '2026-08-20',
        metrics: [
          {
            id: 'MTR-CVY-01-FREQ',
            name: 'Tần số biến tần Inverter',
            unit: 'Hz',
            currentValue: 49.8,
            rawVal: 498,
            status: 'normal',
            warningMin: 35.0,
            warningMax: 55.0,
            criticalMin: 25.0,
            criticalMax: 60.0,
            plcMapping: {
              address: 'D3000',
              dataType: 'SCALE',
              scaleMultiplier: 0.1,
              scaleOffset: 0,
              description: 'Tần số điều khiển tốc độ băng tải',
            },
            history: generateHistoricalData(49.8, 1.0),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-CVY-01-TMP',
            name: 'Nhiệt độ Vòng bi Động cơ',
            unit: '°C',
            currentValue: 88.5, // Vượt criticalMax 85.0! (Critical)
            rawVal: 3018,
            status: 'critical',
            warningMin: 30.0,
            warningMax: 75.0,
            criticalMin: 20.0,
            criticalMax: 85.0,
            plcMapping: {
              address: 'D3004',
              dataType: 'DEC12',
              rawMin: 0,
              rawMax: 4095,
              engMin: 0,
              engMax: 120,
              description: 'Nhiệt độ cảm biến PT100 tại ổ bi số 1',
            },
            history: generateHistoricalData(88.5, 3.5),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-CVY-01-CUR',
            name: 'Dòng điện tiêu thụ',
            unit: 'A',
            currentValue: 14.2,
            rawVal: 142,
            status: 'normal',
            warningMin: 5.0,
            warningMax: 18.0,
            criticalMin: 2.0,
            criticalMax: 22.0,
            plcMapping: {
              address: 'D3002',
              dataType: 'SCALE',
              scaleMultiplier: 0.1,
              scaleOffset: 0,
              description: 'Dòng tải ngõ ra biến tần',
            },
            history: generateHistoricalData(14.2, 1.1),
            lastUpdated: 'Vừa xong',
          },
        ],
      },
      {
        id: 'MC-PLT-01',
        name: 'Robot Xếp thùng Pallet 02',
        model: 'FANUC-M-410iC',
        lineId: 'LINE-03',
        status: 'normal',
        qrCode: 'DENSO-MC-PLT-01',
        location: 'Trạm P2 - Cuối line bốc dỡ',
        lastMaintenance: '2026-09-12',
        metrics: [
          {
            id: 'MTR-PLT-01-VAC',
            name: 'Áp suất chân không giác hút',
            unit: 'kPa',
            currentValue: -78.4,
            rawVal: 1420,
            status: 'normal',
            warningMin: -85.0,
            warningMax: -60.0,
            criticalMin: -90.0,
            criticalMax: -50.0,
            plcMapping: {
              address: 'D3022',
              dataType: 'DEC12',
              rawMin: 0,
              rawMax: 4095,
              engMin: -100,
              engMax: 0,
              description: 'Áp suất âm đầu gắp giác hút',
            },
            history: generateHistoricalData(-78.4, 2.5),
            lastUpdated: 'Vừa xong',
          },
          {
            id: 'MTR-PLT-01-CYC',
            name: 'Thời gian 1 chu kỳ gắp',
            unit: 'giây',
            currentValue: 8.4,
            rawVal: 84,
            status: 'normal',
            warningMin: 6.0,
            warningMax: 12.0,
            criticalMin: 4.0,
            criticalMax: 15.0,
            plcMapping: {
              address: 'D3020',
              dataType: 'SCALE',
              scaleMultiplier: 0.1,
              scaleOffset: 0,
              description: 'Đồng hồ đếm chu kỳ cycle time',
            },
            history: generateHistoricalData(8.4, 0.5),
            lastUpdated: 'Vừa xong',
          },
        ],
      },
    ],
  },
];

/**
 * Danh sách sự cố ban đầu (Alarms)
 */
export const initialAlarms: AlarmEvent[] = [
  {
    id: 'ALM-20260927-001',
    lineId: 'LINE-03',
    lineName: 'Dây chuyền Đóng gói 03',
    machineId: 'MC-CVY-01',
    machineName: 'Động cơ Băng chuyền 01',
    metricId: 'MTR-CVY-01-TMP',
    metricName: 'Nhiệt độ Vòng bi Động cơ',
    severity: 'critical',
    triggeredValue: 88.5,
    thresholdValue: 85.0,
    unit: '°C',
    message: 'Nhiệt độ ổ bi vượt ngưỡng nguy hiểm 85°C. Nguy cơ cháy kẹt động cơ!',
    timestamp: '2026-09-27T16:40:00+07:00',
    status: 'pending', // Chờ thợ nhận việc
  },
  {
    id: 'ALM-20260927-002',
    lineId: 'LINE-02',
    lineName: 'Dây chuyền Kiểm thử 02',
    machineId: 'MC-TST-01',
    machineName: 'Bàn thử rò rỉ khí áp suất cao',
    metricId: 'MTR-TST-01-LEAK',
    metricName: 'Lưu lượng rò rỉ khí',
    severity: 'warning',
    triggeredValue: 4.8,
    thresholdValue: 4.0,
    unit: 'sccm',
    message: 'Tỷ lệ rò rỉ khí nén vượt ngưỡng cảnh báo 4.0 sccm. Cần kiểm tra gioăng làm kín.',
    timestamp: '2026-09-27T16:25:00+07:00',
    status: 'acknowledged',
    assignedTo: 'Trần Văn Kỹ Thuật (TECH-089)',
    acknowledgedAt: '2026-09-27T16:28:15+07:00',
  },
  {
    id: 'ALM-20260927-003',
    lineId: 'LINE-01',
    lineName: 'Dây chuyền Lắp ráp Động cơ 01',
    machineId: 'MC-CYL-01',
    machineName: 'Máy ép xi-lanh thủy lực 01',
    metricId: 'MTR-CYL-01-PRS',
    metricName: 'Áp suất nén ép trục',
    severity: 'warning',
    triggeredValue: 148.2,
    thresholdValue: 145.0,
    unit: 'bar',
    message: 'Áp lực bơm thủy lực tăng nhẹ trên 145 bar trong chu kỳ ép nén.',
    timestamp: '2026-09-27T14:10:00+07:00',
    status: 'resolved',
    assignedTo: 'Nguyễn Văn Vận Hành (OP-012)',
    acknowledgedAt: '2026-09-27T14:12:00+07:00',
    resolvedAt: '2026-09-27T14:35:00+07:00',
    resolutionNotes: 'Đã xả van bypass và cân chỉnh lại van điều áp trạm nguồn thủy lực.',
  },
];

/**
 * Danh sách người dùng hệ thống (RBAC)
 */
export const mockUsers: UserProfile[] = [
  {
    id: 'usr-admin-01',
    employeeId: 'DNS-1001',
    name: 'Hoàng Minh Hải',
    fullName: 'Hoàng Minh Hải',
    email: 'admin@denso.com',
    code: 'DNS-1001',
    role: 'ADMIN',
    assignedLineId: 'ALL',
    status: 'active',
    shift: 'Ca 1 (Sáng)',
  },
  {
    id: 'usr-op-01',
    employeeId: 'DNS-1024',
    name: 'Nguyễn Văn Vận Hành',
    fullName: 'Nguyễn Văn Vận Hành',
    email: 'user@denso.com',
    code: 'DNS-1024',
    role: 'OPERATOR',
    assignedLineId: 'LINE-01',
    status: 'active',
    shift: 'Ca 1 (Sáng)',
  },
  {
    id: 'usr-tech-01',
    employeeId: 'DNS-1088',
    name: 'Trần Văn Kỹ Thuật',
    fullName: 'Trần Văn Kỹ Thuật',
    email: 'tech@denso.com',
    code: 'DNS-1088',
    role: 'MAINTENANCE',
    assignedLineId: 'LINE-02',
    status: 'active',
    shift: 'Ca 1 (Sáng)',
  },
];
