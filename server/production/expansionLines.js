/**
 * @file expansionLines.js
 * @description 10 dây chuyền mở rộng (ngoài Line 1, 2, 3) gắn với các ô trên sơ đồ nhà máy.
 *
 * - Tạo thật trong CSDL giống Line 1/2/3: production_lines, machines, metric_mappings,
 *   metric_thresholds, collection_schedules và một ít lịch sử telemetry mẫu.
 * - Chỉ THÊM MỚI khi chưa có (idempotent): không sửa / xóa dữ liệu đang có.
 * - Tắt bằng biến môi trường SEED_EXPANSION_LINES=false nếu không muốn tạo.
 *
 * Số liệu sản xuất (OEE, sản lượng, NG) của các line này vẫn do ProductionSimulator sinh ra,
 * giống hệt Line 1/2/3.
 */

// Mã thông số trong metric_catalog
const MTR = {
  TMP: 'MTR-CAT-TMP-01',
  PRS_H: 'MTR-CAT-PRS-01',
  PRS_P: 'MTR-CAT-PRS-02',
  VIB: 'MTR-CAT-VIB-01',
  CUR: 'MTR-CAT-CUR-01',
  VOL: 'MTR-CAT-VOL-01',
  SPD: 'MTR-CAT-SPD-01',
  FLW: 'MTR-CAT-FLW-01',
  LVL: 'MTR-CAT-LVL-01',
  ENG: 'MTR-CAT-ENG-01',
  TRQ: 'MTR-CAT-TRQ-01',
};
const MTR_CODE = {
  [MTR.TMP]: 'TEMPERATURE',
  [MTR.PRS_H]: 'PRESSURE_HYDRAULIC',
  [MTR.PRS_P]: 'PRESSURE_PNEUMATIC',
  [MTR.VIB]: 'VIBRATION_RMS',
  [MTR.CUR]: 'CURRENT_PHASE',
  [MTR.VOL]: 'VOLTAGE_LINE',
  [MTR.SPD]: 'ROTATION_SPEED',
  [MTR.FLW]: 'FLOW_COOLANT',
  [MTR.LVL]: 'OIL_LEVEL',
  [MTR.ENG]: 'ENERGY_CONSUMPTION',
  [MTR.TRQ]: 'TORQUE_TIGHTENING',
};
export const MTR_INFO = {
  [MTR.TMP]: ['Nhiệt độ hoạt động', '°C'],
  [MTR.PRS_H]: ['Áp suất dầu thủy lực', 'bar'],
  [MTR.PRS_P]: ['Áp suất khí nén cấp', 'bar'],
  [MTR.VIB]: ['Vận tốc rung hiệu dụng (RMS)', 'mm/s'],
  [MTR.CUR]: ['Dòng điện tải động cơ', 'A'],
  [MTR.VOL]: ['Điện áp lưới cung cấp', 'V'],
  [MTR.SPD]: ['Tốc độ quay trục chính', 'RPM'],
  [MTR.FLW]: ['Lưu lượng dung dịch làm mát', 'L/min'],
  [MTR.LVL]: ['Mức dầu bôi trơn bình chứa', '%'],
  [MTR.ENG]: ['Công suất điện tiêu thụ', 'kW'],
  [MTR.TRQ]: ['Mô-men xoắn siết bulong', 'N.m'],
};

/** Thông số theo loại máy: [metric, cảnh báo min, cảnh báo max, nguy hiểm min, nguy hiểm max] */
export const TEMPLATES = {
  cnc_lathe: [[MTR.SPD, 1800, 3200, 1500, 3600], [MTR.VIB, 0, 4.5, 0, 7.1], [MTR.CUR, 12, 28, 8, 34], [MTR.FLW, 8, 16, 6, 20]],
  machining_center: [[MTR.SPD, 6000, 12000, 4000, 14000], [MTR.VIB, 0, 3.5, 0, 6], [MTR.TMP, 20, 45, 15, 55], [MTR.FLW, 10, 20, 8, 24]],
  gear_hobbing: [[MTR.SPD, 300, 800, 200, 950], [MTR.VIB, 0, 4.5, 0, 7.1], [MTR.TMP, 25, 45, 20, 55]],
  parts_washer: [[MTR.TMP, 50, 65, 45, 70], [MTR.FLW, 20, 40, 15, 45], [MTR.PRS_P, 4, 6, 3.5, 6.5]],
  leak_tester: [[MTR.PRS_P, 4.5, 5.5, 4.2, 5.8], [MTR.TMP, 20, 30, 18, 35]],
  assembly_station: [[MTR.TRQ, 25, 30, 23, 32], [MTR.CUR, 2, 6, 1, 8], [MTR.PRS_P, 4.5, 6, 4, 6.5]],
  tightening_robot: [[MTR.TRQ, 25, 30, 23, 32], [MTR.CUR, 2, 6, 1, 8], [MTR.ENG, 1, 3, 0.5, 4]],
  servo_press: [[MTR.CUR, 10, 20, 6, 24], [MTR.VIB, 0, 3.5, 0, 6], [MTR.ENG, 2, 6, 1, 8]],
  laser_marker: [[MTR.ENG, 0.5, 1.5, 0.3, 2], [MTR.TMP, 20, 35, 15, 40]],
  laser_welder: [[MTR.ENG, 3, 6, 2, 7.5], [MTR.TMP, 20, 30, 18, 35], [MTR.FLW, 6, 12, 4, 14]],
  dispensing_station: [[MTR.PRS_P, 3, 5, 2.5, 5.5], [MTR.TMP, 22, 28, 20, 32]],
  curing_oven: [[MTR.TMP, 110, 130, 100, 140], [MTR.ENG, 8, 14, 6, 16]],
  calibration_bench: [[MTR.PRS_P, 2, 4, 1.5, 4.5], [MTR.TMP, 22, 25, 20, 27]],
  vision_inspection: [[MTR.CUR, 1, 3, 0.5, 4], [MTR.TMP, 20, 35, 15, 40]],
  die_casting: [[MTR.PRS_H, 120, 160, 100, 180], [MTR.TMP, 180, 240, 160, 260], [MTR.FLW, 20, 40, 15, 45], [MTR.ENG, 40, 80, 30, 90]],
  trim_press: [[MTR.PRS_H, 80, 120, 70, 135], [MTR.LVL, 60, 95, 50, 100], [MTR.VIB, 0, 4.5, 0, 7.1]],
  cylindrical_grinder: [[MTR.SPD, 1200, 1800, 1000, 2000], [MTR.VIB, 0, 2.8, 0, 4.5], [MTR.FLW, 15, 30, 10, 35]],
  cmm: [[MTR.TMP, 19.5, 20.5, 19, 21], [MTR.PRS_P, 4, 5, 3.8, 5.2]],
  welding_robot: [[MTR.CUR, 150, 220, 130, 240], [MTR.VOL, 18, 26, 16, 28], [MTR.PRS_P, 4, 6, 3.5, 6.5]],
  testing_station: [[MTR.SPD, 800, 1500, 600, 1700], [MTR.VIB, 0, 4.5, 0, 7.1], [MTR.TMP, 20, 45, 15, 55]],
  valve_mini: [[MTR.TRQ, 2, 5, 1.5, 6], [MTR.PRS_P, 4, 6, 3.5, 6.5]],
};

/**
 * 10 line mở rộng. zone = id khu vực trong factoryMapConfig.ts.
 * Máy: [id = code, tên, loại]
 */
export const EXPANSION_LINES = [
  {
    id: 'LINE-04', code: 'LN-AT-04', zone: 'AT', name: 'Dây chuyền Hộp số AT (Automatic Transmission)',
    profile: { planPerHour: 300, idealCycleSec: 11.4, orderCode: 'VN229700-9025', product: 'Cụm hộp số AT', trouble: 1.8 },
    machines: [
      ['AT-CNC-01', 'Máy tiện CNC trục', 'cnc_lathe'],
      ['AT-HOB-01', 'Máy phay lăn răng', 'gear_hobbing'],
      ['AT-WSH-01', 'Máy rửa chi tiết', 'parts_washer'],
      ['AT-ASM-01', 'Trạm lắp cụm AT', 'assembly_station'],
      ['AT-LKT-01', 'Máy kiểm tra rò rỉ', 'leak_tester'],
    ],
  },
  {
    id: 'LINE-05', code: 'LN-AFM-05', zone: 'AFM', name: 'Dây chuyền Cảm biến lưu lượng khí AFM (Air Flow Meter)',
    profile: { planPerHour: 280, idealCycleSec: 12.3, orderCode: 'VN229700-9310', product: 'Cảm biến lưu lượng khí AFM', trouble: 1.4 },
    machines: [
      ['AFM-LWD-01', 'Máy hàn laser AFM', 'laser_welder'],
      ['AFM-DSP-01', 'Trạm dán chip cảm biến', 'dispensing_station'],
      ['AFM-CUR-01', 'Lò sấy keo', 'curing_oven'],
      ['AFM-CAL-01', 'Máy hiệu chuẩn cảm biến', 'calibration_bench'],
      ['AFM-VIS-01', 'Trạm kiểm tra ngoại quan camera', 'vision_inspection'],
    ],
  },
  {
    id: 'LINE-06', code: 'LN-JAT-06', zone: 'JATCO', name: 'Dây chuyền Lắp cụm hộp số JATCO (CVT Assembly)',
    profile: { planPerHour: 240, idealCycleSec: 14.2, orderCode: 'VN229700-6610', product: 'Cụm hộp số CVT JATCO' },
    machines: [
      ['JAT-ASM-01', 'Robot lắp ráp cụm', 'tightening_robot'],
      ['JAT-PRF-01', 'Máy ép servo vòng bi', 'servo_press'],
      ['JAT-TRQ-01', 'Trạm siết bulong', 'assembly_station'],
      ['JAT-TST-01', 'Trạm kiểm tra chức năng', 'testing_station'],
    ],
  },
  {
    id: 'LINE-07', code: 'LN-AVS-07', zone: 'AVS', name: 'Dây chuyền Lắp van AVS (Valve Assembly)',
    profile: { planPerHour: 360, idealCycleSec: 9.5, orderCode: 'VN229700-7120', product: 'Cụm van AVS' },
    machines: [
      ['AVS-ASM-01', 'Trạm lắp van', 'assembly_station'],
      ['AVS-PRF-01', 'Máy ép servo', 'servo_press'],
      ['AVS-LKT-01', 'Máy kiểm tra rò rỉ', 'leak_tester'],
      ['AVS-MRK-01', 'Máy khắc laser mã', 'laser_marker'],
    ],
  },
  {
    id: 'LINE-08', code: 'LN-HSG-08', zone: 'CVT_HOUSING', name: 'Dây chuyền Gia công vỏ hộp số (Housing Machining)',
    profile: { planPerHour: 120, idealCycleSec: 28.5, orderCode: 'VN229700-0412', product: 'Vỏ hộp số CVT' },
    machines: [
      ['HSG-MC-01', 'Trung tâm gia công CNC', 'machining_center'],
      ['HSG-WSH-01', 'Máy rửa chi tiết', 'parts_washer'],
      ['HSG-LKT-01', 'Máy kiểm tra rò rỉ', 'leak_tester'],
      ['HSG-CMM-01', 'Máy đo tọa độ CMM', 'cmm'],
    ],
  },
  {
    id: 'LINE-09', code: 'LN-DCS-09', zone: 'DECAST_1', name: 'Dây chuyền Đúc áp lực nhôm Decast 1 (Die Casting)',
    profile: { planPerHour: 90, idealCycleSec: 38, orderCode: 'VN229700-0410', product: 'Phôi đúc vỏ hộp số', trouble: 1.2 },
    machines: [
      ['DCS-DCM-01', 'Máy đúc áp lực nhôm', 'die_casting'],
      ['DCS-TRM-01', 'Máy cắt ba via', 'trim_press'],
      ['DCS-VIS-01', 'Trạm kiểm tra ngoại quan', 'vision_inspection'],
    ],
  },
  {
    id: 'LINE-10', code: 'LN-DCT-10', zone: 'DCT', name: 'Dây chuyền Gia công trục DCT (Shaft Machining)',
    profile: { planPerHour: 200, idealCycleSec: 17, orderCode: 'VN229700-5530', product: 'Trục hộp số DCT' },
    machines: [
      ['DCT-CNC-01', 'Máy tiện CNC trục', 'cnc_lathe'],
      ['DCT-GRD-01', 'Máy mài tròn ngoài', 'cylindrical_grinder'],
      ['DCT-WSH-01', 'Máy rửa chi tiết', 'parts_washer'],
      ['DCT-CMM-01', 'Máy đo tọa độ CMM', 'cmm'],
    ],
  },
  {
    id: 'LINE-11', code: 'LN-MH1-11', zone: 'MID_H1', name: 'Dây chuyền Gia công CNC H1 (Machining)',
    profile: { planPerHour: 150, idealCycleSec: 22.5, orderCode: 'VN229700-5101', product: 'Chi tiết gia công MID' },
    machines: [
      ['H1-MC-01', 'Trung tâm gia công CNC số 1', 'machining_center'],
      ['H1-MC-02', 'Trung tâm gia công CNC số 2', 'machining_center'],
      ['H1-WSH-01', 'Máy rửa chi tiết', 'parts_washer'],
    ],
  },
  {
    id: 'LINE-12', code: 'LN-WS7-12', zone: 'WS7', name: 'Trạm hàn WS7 (Welding Station)',
    profile: { planPerHour: 260, idealCycleSec: 13, orderCode: 'VN229700-3307', product: 'Cụm hàn khung' },
    machines: [
      ['WS7-ROB-01', 'Robot hàn hồ quang', 'welding_robot'],
      ['WS7-LWD-01', 'Máy hàn laser', 'laser_welder'],
      ['WS7-VIS-01', 'Trạm kiểm tra mối hàn', 'vision_inspection'],
    ],
  },
  {
    id: 'LINE-13', code: 'LN-OCV-13', zone: 'OCV3', name: 'Dây chuyền Van điều khiển dầu OCV3 (Oil Control Valve)',
    profile: { planPerHour: 420, idealCycleSec: 8.2, orderCode: 'VN229700-8803', product: 'Van điều khiển dầu OCV' },
    machines: [
      ['OCV-ASM-01', 'Bàn lắp ráp van mini', 'valve_mini'],
      ['OCV-LKT-01', 'Máy kiểm tra rò rỉ van', 'leak_tester'],
    ],
  },
];

/** Hồ sơ sản xuất & vị trí sơ đồ theo mã line (ProductionSimulator dùng) */
export const EXPANSION_PROFILES = Object.fromEntries(EXPANSION_LINES.map((l) => [l.code, l.profile]));
export const EXPANSION_ZONES = Object.fromEntries(EXPANSION_LINES.map((l) => [l.code, l.zone]));

// RNG tất định nhỏ cho số liệu mẫu
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function columnsOf(pool, table) {
  const [rows] = await pool.query(
    'SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table]
  );
  return new Set(rows.map((r) => r.c));
}

async function tableExists(pool, table) {
  const [rows] = await pool.query(
    'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
    [table]
  );
  return rows.length > 0;
}

/**
 * Thêm 10 line mở rộng vào CSDL nếu chưa có. An toàn khi chạy nhiều lần.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ insertTelemetryBatch?: (records: any[]) => Promise<any> }} [helpers]
 */
export async function ensureExpansionLines(pool, helpers = {}) {
  if (process.env.SEED_EXPANSION_LINES === 'false') return { skipped: true };
  const stats = { lines: 0, machines: 0, mappings: 0, thresholds: 0, schedules: 0, history: 0 };

  // Thông số mô-men xoắn có thể chưa có trong danh mục (CSDL cũ)
  await pool.query(
    `INSERT INTO metric_catalog (id, code, name, category, unit, dataType, validMin, validMax, description, status, createdBy)
     SELECT 'MTR-CAT-TRQ-01', 'TORQUE_TIGHTENING', 'Mô-men xoắn siết bulong', 'Other', 'N.m', 'FLOAT', 0.00, 200.00,
            'Lực siết bu lông đai ốc của robot lắp ráp', 'ACTIVE', 'system'
     WHERE NOT EXISTS (SELECT 1 FROM metric_catalog WHERE id = 'MTR-CAT-TRQ-01' OR code = 'TORQUE_TIGHTENING')`
  );
  const [catRows] = await pool.query('SELECT id FROM metric_catalog');
  const catalog = new Set(catRows.map((r) => r.id));

  const machineCols = await columnsOf(pool, 'machines');
  const hasMappings = await tableExists(pool, 'metric_mappings');
  const mappingCols = hasMappings ? await columnsOf(pool, 'metric_mappings') : new Set();
  const hasThresholds = hasMappings && (await tableExists(pool, 'metric_thresholds'));
  const hasSchedules = hasMappings && (await tableExists(pool, 'collection_schedules'));

  const historyRecords = [];
  const now = Date.now();

  for (const line of EXPANSION_LINES) {
    const [lr] = await pool.query('SELECT id FROM production_lines WHERE id = ? OR code = ? LIMIT 1', [line.id, line.code]);
    let lineId = lr[0]?.id;
    if (!lineId) {
      const plan = line.profile.planPerHour * 8;
      await pool.query(
        `INSERT INTO production_lines (id, name, code, status, safetyScore, targetOutput, actualOutput)
         VALUES (?, ?, ?, 'normal', ?, ?, ?)`,
        [line.id, line.name, line.code, 92 + Math.round(seeded(line.id)() * 6), plan, Math.round(plan * 0.9)]
      );
      lineId = line.id;
      stats.lines++;
    }

    for (const [code, name, type] of line.machines) {
      const [mr] = await pool.query('SELECT id FROM machines WHERE id = ? OR code = ? LIMIT 1', [code, code]);
      let machineId = mr[0]?.id;
      if (!machineId) {
        const rng = seeded(code);
        const cols = ['id', 'lineId', 'name', 'code', 'type', 'status', 'healthScore', 'uptimeHours', 'qrCodeUrl'];
        const vals = [code, lineId, name, code, type, 'normal', 90 + Math.round(rng() * 9), 150 + Math.round(rng() * 400), `/qr/${code.toLowerCase()}`];
        if (machineCols.has('management_status')) {
          cols.push('management_status');
          vals.push('ACTIVE');
        }
        if (machineCols.has('location')) {
          cols.push('location');
          vals.push(line.zone);
        }
        await pool.query(`INSERT INTO machines (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
        machineId = code;
        stats.machines++;
      }
      if (!hasMappings) continue;

      for (const [metricId, wMin, wMax, cMin, cMax] of TEMPLATES[type] || []) {
        if (!catalog.has(metricId)) continue;
        const mcode = MTR_CODE[metricId];
        const mappingCode = `MTR-${code}-${mcode}`;
        const mappingId = `MAP-${mappingCode}`.slice(0, 64);
        const [ex] = await pool.query('SELECT id FROM metric_mappings WHERE mapping_code = ? OR id = ? LIMIT 1', [mappingCode, mappingId]);
        if (ex.length) continue;
        const [label] = MTR_INFO[metricId];
        const mcols = ['id', 'machine_id', 'plc_id', 'metric_id', 'mapping_code', 'channel_name', 'sampling_rate_ms', 'monitoring_enabled', 'status'];
        const mvals = [mappingId, machineId, null, metricId, mappingCode, `${label} - ${name}`.slice(0, 100), 1000, 1, 'ACTIVE'];
        if (mappingCols.has('data_source_type')) {
          mcols.push('data_source_type');
          mvals.push('SIMULATED');
        }
        try {
          await pool.query(`INSERT INTO metric_mappings (${mcols.join(', ')}) VALUES (${mcols.map(() => '?').join(', ')})`, mvals);
        } catch (err) {
          // Cột data_source_type có thể là ENUM không có SIMULATED: thử lại không có cột này
          if (mcols.includes('data_source_type')) {
            mcols.pop();
            mvals.pop();
            await pool.query(`INSERT INTO metric_mappings (${mcols.join(', ')}) VALUES (${mcols.map(() => '?').join(', ')})`, mvals);
          } else throw err;
        }
        stats.mappings++;
        if (hasThresholds) {
          await pool.query(
            `INSERT INTO metric_thresholds (id, mapping_id, warning_min, warning_max, critical_min, critical_max, action_plan)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [`THR-${mappingCode}`.slice(0, 64), mappingId, wMin, wMax, cMin, cMax, `${label} - ${name}`]
          );
          stats.thresholds++;
        }
        if (hasSchedules) {
          await pool.query(
            `INSERT INTO collection_schedules (id, mapping_id, frequency_type, interval_seconds, is_active)
             VALUES (?, ?, 'INTERVAL', 1, 1)`,
            [`SCH-${mappingCode}`.slice(0, 64), mappingId]
          );
          stats.schedules++;
        }

        // Lịch sử mẫu 24 giờ (mỗi 2 giờ) cho máy vừa tạo, để trang Lịch sử dữ liệu có số liệu
        const unit = MTR_INFO[metricId][1];
        const rng = seeded(mappingCode);
        const mid = (wMin + wMax) / 2;
        const span = (wMax - wMin) / 2;
        for (let k = 12; k >= 1; k--) {
          let v = mid + (rng() - 0.5) * 2 * span * 0.8;
          if (rng() < 0.06) v = wMax + (cMax - wMax) * (0.3 + rng() * 0.5);
          const status = v >= cMax || v <= cMin ? 'critical' : v > wMax || v < wMin ? 'warning' : 'normal';
          historyRecords.push({
            lineId,
            lineName: line.name,
            machineId,
            machineName: name,
            metricId,
            metricName: label,
            value: Number(v.toFixed(2)),
            unit,
            status,
            source: 'simulation',
            timestamp: new Date(now - k * 2 * 3600000).toISOString(),
          });
        }
      }
    }
  }

  if (historyRecords.length && helpers.insertTelemetryBatch) {
    try {
      const res = await helpers.insertTelemetryBatch(historyRecords);
      stats.history = res?.insertedCount ?? historyRecords.length;
    } catch (err) {
      console.warn('[Expansion Lines] Không ghi được lịch sử mẫu:', err.message);
    }
  }
  return stats;
}
