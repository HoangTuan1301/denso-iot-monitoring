/**
 * @file demoBaselines.ts
 * @description Danh mục giá trị danh định chuẩn (Nominal Baselines) cho hệ thống cảm biến DENSO IoT
 * Thay thế hoàn toàn việc giả định trung điểm (warningMin + warningMax)/2 bằng giá trị kỹ thuật có cơ sở:
 * 1. Tiêu chuẩn thiết bị công nghiệp DENSO (DENSO Equipment Specs)
 * 2. Tài liệu & Hình ảnh tham chiếu của Mentor (Mentor References)
 * 3. Điểm làm việc danh định của hệ thống cơ điện (Motor nominal frequency 50Hz, Hydraulic oil 52-56°C, Vibration ISO 10816)
 */

export interface MetricBaselineMeta {
  code: string;
  nominal: number;
  unit: string;
  source: 'DENSO_EQUIPMENT_SPEC' | 'MENTOR_REFERENCE' | 'FACTORY_BASELINE' | 'ESTIMATED_SAFE_POINT';
  description: string;
}

/**
 * Từ điển các giá trị danh định đã xác minh theo tiêu chuẩn nhà máy DENSO
 */
export const DEMO_METRIC_BASELINES: Record<string, MetricBaselineMeta> = {
  // --- 1. DÂY CHUYỀN 1: DẬP & HÀN KHUNG GẦM (LN-PRS-01) ---
  'MTR-FDR-01-PRS': {
    code: 'MTR-FDR-01-PRS',
    nominal: 6.2,
    unit: 'bar',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Áp suất khí nén cấp phôi tiêu chuẩn (Trạm cấp liệu A1)',
  },
  'MTR-FDR-01-SPD': {
    code: 'MTR-FDR-01-SPD',
    nominal: 45.0,
    unit: 'chi tiết/phút',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Tốc độ mâm xoay cấp phôi danh định',
  },
  'MTR-CYL-01-PRS': {
    code: 'MTR-CYL-01-PRS',
    nominal: 125.4,
    unit: 'bar',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Áp suất nén ép trục chính xi-lanh thủy lực SMC',
  },
  'MTR-CYL-01-TMP': {
    code: 'MTR-CYL-01-TMP',
    nominal: 54.2,
    unit: '°C',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Nhiệt độ dầu thủy lực tuần hoàn ổn định của máy ép',
  },
  'MTR-CYL-01-VIB': {
    code: 'MTR-CYL-01-VIB',
    nominal: 2.1,
    unit: 'mm/s',
    source: 'FACTORY_BASELINE',
    description: 'Độ rung khung máy dập theo tiêu chuẩn ISO 10816 Class II',
  },
  'MTR-ROB-02-TRQ': {
    code: 'MTR-ROB-02-TRQ',
    nominal: 34.8,
    unit: 'N.m',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Mô-men siết bu-lông của tay gắp robot Fanuc',
  },
  'MTR-ROB-02-MOT': {
    code: 'MTR-ROB-02-MOT',
    nominal: 46.5,
    unit: '°C',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Nhiệt độ cuộn dây Servo Motor trục 1',
  },

  // --- 2. THÔNG SỐ CHECK SHEET THAM CHIẾU (ẢNH MẪU MENTOR & CATALOG CHUẨN) ---
  'CURRENT_PHASE': {
    code: 'CURRENT_PHASE',
    nominal: 42.6,
    unit: 'A',
    source: 'MENTOR_REFERENCE',
    description: 'Dòng điện tải động cơ chuẩn theo ảnh tham chiếu Check Sheet OP50',
  },
  'TORQUE_TIGHTENING': {
    code: 'TORQUE_TIGHTENING',
    nominal: 35.0,
    unit: 'N.m',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Mô-men xoắn siết bulong tiêu chuẩn (35 N.m)',
  },
  'PRESSURE_HYDRAULIC': {
    code: 'PRESSURE_HYDRAULIC',
    nominal: 125.4,
    unit: 'bar',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Áp suất dầu thủy lực tuần hoàn tiêu chuẩn',
  },
  'PRESSURE_PNEUMATIC': {
    code: 'PRESSURE_PNEUMATIC',
    nominal: 6.2,
    unit: 'bar',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Áp suất khí nén cấp tiêu chuẩn',
  },
  'ROTATION_SPEED': {
    code: 'ROTATION_SPEED',
    nominal: 1450.0,
    unit: 'RPM',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Tốc độ quay trục chính danh định',
  },
  'TEMPERATURE': {
    code: 'TEMPERATURE',
    nominal: 54.2,
    unit: '°C',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Nhiệt độ làm việc danh định',
  },
  'VIBRATION_RMS': {
    code: 'VIBRATION_RMS',
    nominal: 2.1,
    unit: 'mm/s',
    source: 'FACTORY_BASELINE',
    description: 'Vận tốc rung hiệu dụng ISO 10816',
  },
  'ENERGY_CONSUMPTION': {
    code: 'ENERGY_CONSUMPTION',
    nominal: 45.0,
    unit: 'kW',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Công suất điện tiêu thụ danh định',
  },
  'OIL_LEVEL': {
    code: 'OIL_LEVEL',
    nominal: 85.0,
    unit: '%',
    source: 'FACTORY_BASELINE',
    description: 'Mức dầu bôi trơn an toàn',
  },
  'VOLTAGE_LINE': {
    code: 'VOLTAGE_LINE',
    nominal: 380.0,
    unit: 'V',
    source: 'FACTORY_BASELINE',
    description: 'Điện áp lưới cung cấp 3 pha',
  },
  'MTR-MS-10-CURRENT_PHASE': {
    code: 'MTR-MS-10-CURRENT_PHASE',
    nominal: 42.6,
    unit: 'A',
    source: 'MENTOR_REFERENCE',
    description: 'Dòng điện tải động cơ - Messi (MS-10)',
  },
  'MTR-MS-10-TORQUE_TIGHTENING': {
    code: 'MTR-MS-10-TORQUE_TIGHTENING',
    nominal: 35.0,
    unit: 'N.m',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Mô-men xoắn siết bulong - Messi (MS-10)',
  },
  'FLOW_COOLANT': {
    code: 'FLOW_COOLANT',
    nominal: 48.2,
    unit: 'L/min',
    source: 'MENTOR_REFERENCE',
    description: 'Lưu lượng dung dịch làm mát chuẩn theo ảnh tham chiếu Check Sheet OP50',
  },

  // --- 3. BẢNG 4 THÔNG SỐ VẬN HÀNH CHÍNH TRÊN LINE OVERVIEW & MACHINE DETAIL ---
  'HYDRAULIC_TEMP': {
    code: 'HYDRAULIC_TEMP',
    nominal: 56.2,
    unit: '°C',
    source: 'MENTOR_REFERENCE',
    description: 'Nhiệt độ dầu thủy lực chuẩn (ảnh tham chiếu Line Overview / Machine Detail)',
  },
  'SPINDLE_VIBRATION': {
    code: 'SPINDLE_VIBRATION',
    nominal: 3.1,
    unit: 'mm/s',
    source: 'MENTOR_REFERENCE',
    description: 'Độ rung trục chính danh định (ảnh tham chiếu)',
  },
  'MAIN_PUMP_PRESSURE': {
    code: 'MAIN_PUMP_PRESSURE',
    nominal: 0.62,
    unit: 'MPa',
    source: 'MENTOR_REFERENCE',
    description: 'Áp suất bơm chính danh định (ảnh tham chiếu)',
  },
  'MOTOR_LOAD_CURRENT': {
    code: 'MOTOR_LOAD_CURRENT',
    nominal: 18.4,
    unit: 'A',
    source: 'MENTOR_REFERENCE',
    description: 'Dòng điện tải động cơ danh định (ảnh tham chiếu)',
  },

  // --- 4. CÁC THIẾT BỊ KIỂM TRA & BĂNG CHUYỀN (LINE-02, LINE-03) ---
  'MTR-TST-01-PRS': {
    code: 'MTR-TST-01-PRS',
    nominal: 412.0,
    unit: 'kPa',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Áp suất buồng thử kín danh định',
  },
  'MTR-TST-01-LEAK': {
    code: 'MTR-TST-01-LEAK',
    nominal: 1.5,
    unit: 'sccm',
    source: 'FACTORY_BASELINE',
    description: 'Mức rò rỉ khí danh định tiêu chuẩn trong ngưỡng an toàn (< 4.0 sccm)',
  },
  'MTR-NVH-01-DB': {
    code: 'MTR-NVH-01-DB',
    nominal: 68.2,
    unit: 'dB',
    source: 'FACTORY_BASELINE',
    description: 'Mức áp suất âm thanh phòng tiêu âm thử nghiệm',
  },
  'MTR-NVH-01-RMS': {
    code: 'MTR-NVH-01-RMS',
    nominal: 1.85,
    unit: 'mm/s',
    source: 'FACTORY_BASELINE',
    description: 'Vận tốc rung hiệu dụng RMS bệ thử NVH',
  },
  'MTR-CVY-01-FREQ': {
    code: 'MTR-CVY-01-FREQ',
    nominal: 49.8,
    unit: 'Hz',
    source: 'FACTORY_BASELINE',
    description: 'Tần số lưới điện vận hành biến tần băng chuyền (~50 Hz)',
  },
  'MTR-CVY-01-TMP': {
    code: 'MTR-CVY-01-TMP',
    nominal: 52.0,
    unit: '°C',
    source: 'FACTORY_BASELINE',
    description: 'Nhiệt độ ổ bi danh định tiêu chuẩn trong ngưỡng an toàn (< 75.0 °C)',
  },
  'MTR-CVY-01-CUR': {
    code: 'MTR-CVY-01-CUR',
    nominal: 14.2,
    unit: 'A',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Dòng điện định mức động cơ kéo',
  },
  'MTR-PLT-01-CYC': {
    code: 'MTR-PLT-01-CYC',
    nominal: 8.4,
    unit: 'giây',
    source: 'DENSO_EQUIPMENT_SPEC',
    description: 'Thời gian hoàn tất 1 chu kỳ pallet tiêu chuẩn',
  },
};

/**
 * Tìm kiếm giá trị danh định (Baseline) hợp lệ nhất cho một metric:
 * 1. Tra cứu trực tiếp từ DEMO_METRIC_BASELINES theo mã ID hoặc mappingCode
 * 2. Tra cứu theo loại cảm biến / từ khóa tên thông số (tần số 50Hz, rung 2.1mm/s, nhiệt độ 54°C...)
 * 3. Sử dụng giá trị danh định khởi tạo ban đầu (nếu nằm trong ngưỡng an toàn)
 * 4. Fallback cuối cùng: Trung điểm ngưỡng cảnh báo (được đánh dấu là ESTIMATED_SAFE_POINT)
 */
export function resolveMetricNominalBaseline(metric: {
  id?: string;
  mappingCode?: string;
  name?: string;
  unit?: string;
  warningMin?: number | null;
  warningMax?: number | null;
  currentValue?: number | null;
  nominalValue?: number | null;
}): { nominal: number; source: MetricBaselineMeta['source'] } {
  // 1. Kiểm tra dictionary theo id hoặc mappingCode
  const key = metric.id || metric.mappingCode;
  if (key && DEMO_METRIC_BASELINES[key]) {
    return {
      nominal: DEMO_METRIC_BASELINES[key].nominal,
      source: DEMO_METRIC_BASELINES[key].source,
    };
  }

  // 2. Tra cứu theo từ khóa tên hoặc đơn vị
  const upperName = (metric.name || '').toUpperCase();
  const upperCode = (key || '').toUpperCase();
  const unit = (metric.unit || '').trim();

  // Dòng điện CheckSheet / OP50
  if (upperCode.includes('CURRENT') || upperName.includes('DÒNG ĐIỆN TẢI')) {
    if (metric.warningMax && metric.warningMax <= 30) {
      return { nominal: 18.4, source: 'MENTOR_REFERENCE' };
    }
    return { nominal: 42.6, source: 'MENTOR_REFERENCE' };
  }

  // Dung dịch làm mát
  if (upperCode.includes('COOLANT') || upperName.includes('LÀM MÁT')) {
    return { nominal: 48.2, source: 'MENTOR_REFERENCE' };
  }

  // Áp suất khí nén cấp phôi
  if (upperCode.includes('PRS') && unit === 'bar' && metric.warningMax && metric.warningMax <= 15) {
    return { nominal: 6.2, source: 'DENSO_EQUIPMENT_SPEC' };
  }

  // Áp suất dầu thủy lực
  if (upperCode.includes('PRS') && (unit === 'bar' || unit === 'MPa')) {
    if (unit === 'MPa') return { nominal: 0.62, source: 'MENTOR_REFERENCE' };
    return { nominal: 125.4, source: 'DENSO_EQUIPMENT_SPEC' };
  }

  // Nhiệt độ
  if (unit === '°C' || upperName.includes('NHIỆT ĐỘ')) {
    if (upperName.includes('SERVO') || upperName.includes('MOTOR')) {
      return { nominal: 46.5, source: 'DENSO_EQUIPMENT_SPEC' };
    }
    return { nominal: 54.2, source: 'DENSO_EQUIPMENT_SPEC' };
  }

  // Độ rung (ISO 10816: Độ rung danh định của máy móc bình thường là 1.8 - 2.5 mm/s, không bao giờ là trung điểm của 0 và 5!)
  if (unit === 'mm/s' || upperName.includes('RUNG') || upperCode.includes('VIB')) {
    return { nominal: 2.1, source: 'FACTORY_BASELINE' };
  }

  // Tần số biến tần (Lưới điện công nghiệp Việt Nam / Nhật Bản chuẩn là 50.0 Hz)
  if (unit === 'Hz' || upperName.includes('TẦN SỐ')) {
    return { nominal: 49.8, source: 'DENSO_EQUIPMENT_SPEC' };
  }

  // Mô-men xoắn siết bulong
  if (upperCode.includes('TRQ') || upperCode.includes('TORQUE') || upperName.includes('SIẾT') || upperName.includes('MÔ-MEN')) {
    return { nominal: 35.0, source: 'DENSO_EQUIPMENT_SPEC' };
  }

  // 3. Sử dụng nominalValue khai báo trực tiếp (nếu có)
  if (metric.nominalValue != null && !isNaN(Number(metric.nominalValue))) {
    return { nominal: Number(metric.nominalValue), source: 'FACTORY_BASELINE' };
  }

  // 4. Nếu giá trị khởi tạo hiện tại nằm trong vùng an toàn (lớn hơn min và nhỏ hơn max), sử dụng làm baseline
  const isAboveMin = metric.warningMin != null ? (metric.currentValue != null && metric.currentValue > metric.warningMin) : true;
  const isBelowMax = metric.warningMax != null ? (metric.currentValue != null && metric.currentValue < metric.warningMax) : true;
  if (metric.currentValue != null && isAboveMin && isBelowMax) {
    return { nominal: Number(metric.currentValue), source: 'FACTORY_BASELINE' };
  }

  // 5. Fallback cuối cùng nếu không có thông tin: Trung điểm hoặc 50% max nếu là ngưỡng một phía
  if (metric.warningMin != null && metric.warningMax != null) {
    return {
      nominal: Number(((metric.warningMin + metric.warningMax) / 2).toFixed(2)),
      source: 'ESTIMATED_SAFE_POINT',
    };
  }

  if (metric.warningMax != null && metric.warningMin == null) {
    return {
      nominal: Number((metric.warningMax * 0.5).toFixed(2)),
      source: 'ESTIMATED_SAFE_POINT',
    };
  }

  return { nominal: 50.0, source: 'ESTIMATED_SAFE_POINT' };
}
