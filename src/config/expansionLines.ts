/**
 * @file expansionLines.ts
 * @description Cấu hình hiển thị 10 dây chuyền mở rộng (khớp server/production/expansionLines.js):
 * thứ tự trạm, ảnh máy đã tách nền và độ lớn máy trên sơ đồ băng chuyền.
 * Ô nhỏ trên sơ đồ nhà máy = ít máy hơn / máy nhỏ hơn (VD OCV3 chỉ 2 máy để bàn).
 */
import { tr } from '../i18n/tr';
import type { LineStationConfig } from '../features/tier1-lines/LineGenericPhotorealisticView';

const IMG = (f: string) => `/images/machines/cutout/${f}.webp`;

/** Ảnh + hệ số chiều cao theo mã máy */
export const EXPANSION_MACHINE_IMAGES: Record<string, { image: string; scale?: number }> = {
  'AT-CNC-01': { image: IMG('N01'), scale: 0.86 },
  'AT-HOB-01': { image: IMG('N03') },
  'AT-WSH-01': { image: IMG('N04'), scale: 0.8 },
  'AT-ASM-01': { image: IMG('MC-ASM-01') },
  'AT-LKT-01': { image: IMG('N05'), scale: 0.92 },
  'AFM-LWD-01': { image: IMG('N08') },
  'AFM-DSP-01': { image: IMG('N12') },
  'AFM-CUR-01': { image: IMG('MC-DRY-01'), scale: 0.82 },
  'AFM-CAL-01': { image: IMG('N13') },
  'AFM-VIS-01': { image: IMG('N16') },
  'JAT-ASM-01': { image: IMG('ASM-01') },
  'JAT-PRF-01': { image: IMG('N10') },
  'JAT-TRQ-01': { image: IMG('MC-ASM-01') },
  'JAT-TST-01': { image: IMG('MC-TST-01') },
  'AVS-ASM-01': { image: IMG('MC-ASM-01'), scale: 0.92 },
  'AVS-PRF-01': { image: IMG('N10'), scale: 0.95 },
  'AVS-LKT-01': { image: IMG('N05'), scale: 0.9 },
  'AVS-MRK-01': { image: IMG('N09'), scale: 0.88 },
  'HSG-MC-01': { image: IMG('N02') },
  'HSG-WSH-01': { image: IMG('N04'), scale: 0.8 },
  'HSG-LKT-01': { image: IMG('N05'), scale: 0.92 },
  'HSG-CMM-01': { image: IMG('N15') },
  'DCS-DCM-01': { image: IMG('N06'), scale: 0.9 },
  'DCS-TRM-01': { image: IMG('N07'), scale: 1.05 },
  'DCS-VIS-01': { image: IMG('N16'), scale: 0.88 },
  'DCT-CNC-01': { image: IMG('N01'), scale: 0.86 },
  'DCT-GRD-01': { image: IMG('N11'), scale: 0.9 },
  'DCT-WSH-01': { image: IMG('N04'), scale: 0.8 },
  'DCT-CMM-01': { image: IMG('N15') },
  'H1-MC-01': { image: IMG('N02') },
  'H1-MC-02': { image: IMG('N02') },
  'H1-WSH-01': { image: IMG('N04'), scale: 0.8 },
  'WS7-ROB-01': { image: IMG('ROB-01') },
  'WS7-LWD-01': { image: IMG('N08') },
  'WS7-VIS-01': { image: IMG('N16'), scale: 0.9 },
  // Line nhỏ OCV3: máy để bàn, vẽ nhỏ hơn
  'OCV-ASM-01': { image: IMG('N14'), scale: 0.72 },
  'OCV-LKT-01': { image: IMG('N05'), scale: 0.72 },
};

interface ExpansionLineView {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  /** [mã máy, tên máy] theo thứ tự công đoạn */
  machines: Array<[string, string]>;
  /** Độ rộng ảnh máy (% chiều rộng sơ đồ) */
  imageWidthPct?: number;
}

const LINES: ExpansionLineView[] = [
  {
    id: 'LINE-04', code: 'LN-AT-04', title: tr('Dây chuyền Hộp số AT'),
    subtitle: tr('Gia công trục, phay răng, rửa, lắp cụm và kiểm tra rò rỉ hộp số AT'),
    machines: [['AT-CNC-01', tr('Máy tiện CNC trục')], ['AT-HOB-01', tr('Máy phay lăn răng')], ['AT-WSH-01', tr('Máy rửa chi tiết')], ['AT-ASM-01', tr('Trạm lắp cụm AT')], ['AT-LKT-01', tr('Máy kiểm tra rò rỉ')]],
  },
  {
    id: 'LINE-05', code: 'LN-AFM-05', title: tr('Dây chuyền Cảm biến lưu lượng khí AFM'),
    subtitle: tr('Hàn laser, dán chip, sấy keo, hiệu chuẩn và kiểm tra ngoại quan cảm biến AFM'),
    machines: [['AFM-LWD-01', tr('Máy hàn laser AFM')], ['AFM-DSP-01', tr('Trạm dán chip cảm biến')], ['AFM-CUR-01', tr('Lò sấy keo')], ['AFM-CAL-01', tr('Máy hiệu chuẩn cảm biến')], ['AFM-VIS-01', tr('Trạm kiểm tra ngoại quan camera')]],
  },
  {
    id: 'LINE-06', code: 'LN-JAT-06', title: tr('Dây chuyền Lắp cụm hộp số JATCO'),
    subtitle: tr('Lắp ráp, ép vòng bi, siết bulong và kiểm tra chức năng cụm hộp số CVT'),
    machines: [['JAT-ASM-01', tr('Robot lắp ráp cụm')], ['JAT-PRF-01', tr('Máy ép servo vòng bi')], ['JAT-TRQ-01', tr('Trạm siết bulong')], ['JAT-TST-01', tr('Trạm kiểm tra chức năng')]],
  },
  {
    id: 'LINE-07', code: 'LN-AVS-07', title: tr('Dây chuyền Lắp van AVS'),
    subtitle: tr('Lắp van, ép servo, kiểm tra rò rỉ và khắc mã laser'),
    machines: [['AVS-ASM-01', tr('Trạm lắp van')], ['AVS-PRF-01', tr('Máy ép servo')], ['AVS-LKT-01', tr('Máy kiểm tra rò rỉ')], ['AVS-MRK-01', tr('Máy khắc laser mã')]],
  },
  {
    id: 'LINE-08', code: 'LN-HSG-08', title: tr('Dây chuyền Gia công vỏ hộp số'),
    subtitle: tr('Gia công CNC, rửa, kiểm tra rò rỉ và đo CMM vỏ hộp số CVT'),
    machines: [['HSG-MC-01', tr('Trung tâm gia công CNC')], ['HSG-WSH-01', tr('Máy rửa chi tiết')], ['HSG-LKT-01', tr('Máy kiểm tra rò rỉ')], ['HSG-CMM-01', tr('Máy đo tọa độ CMM')]],
  },
  {
    id: 'LINE-09', code: 'LN-DCS-09', title: tr('Dây chuyền Đúc áp lực nhôm Decast 1'),
    subtitle: tr('Đúc áp lực, cắt ba via và kiểm tra ngoại quan phôi đúc'),
    machines: [['DCS-DCM-01', tr('Máy đúc áp lực nhôm')], ['DCS-TRM-01', tr('Máy cắt ba via')], ['DCS-VIS-01', tr('Trạm kiểm tra ngoại quan')]],
    imageWidthPct: 24,
  },
  {
    id: 'LINE-10', code: 'LN-DCT-10', title: tr('Dây chuyền Gia công trục DCT'),
    subtitle: tr('Tiện CNC, mài tròn ngoài, rửa và đo CMM trục hộp số DCT'),
    machines: [['DCT-CNC-01', tr('Máy tiện CNC trục')], ['DCT-GRD-01', tr('Máy mài tròn ngoài')], ['DCT-WSH-01', tr('Máy rửa chi tiết')], ['DCT-CMM-01', tr('Máy đo tọa độ CMM')]],
  },
  {
    id: 'LINE-11', code: 'LN-MH1-11', title: tr('Dây chuyền Gia công CNC H1'),
    subtitle: tr('2 trung tâm gia công CNC và máy rửa chi tiết'),
    machines: [['H1-MC-01', tr('Trung tâm gia công CNC số 1')], ['H1-MC-02', tr('Trung tâm gia công CNC số 2')], ['H1-WSH-01', tr('Máy rửa chi tiết')]],
    imageWidthPct: 21,
  },
  {
    id: 'LINE-12', code: 'LN-WS7-12', title: tr('Trạm hàn WS7'),
    subtitle: tr('Robot hàn hồ quang, hàn laser và kiểm tra mối hàn'),
    machines: [['WS7-ROB-01', tr('Robot hàn hồ quang')], ['WS7-LWD-01', tr('Máy hàn laser')], ['WS7-VIS-01', tr('Trạm kiểm tra mối hàn')]],
    imageWidthPct: 21,
  },
  {
    id: 'LINE-13', code: 'LN-OCV-13', title: tr('Dây chuyền Van điều khiển dầu OCV3'),
    subtitle: tr('Line nhỏ: bàn lắp ráp van mini và máy kiểm tra rò rỉ van'),
    machines: [['OCV-ASM-01', tr('Bàn lắp ráp van mini')], ['OCV-LKT-01', tr('Máy kiểm tra rò rỉ van')]],
    imageWidthPct: 17,
  },
];

export interface ExpansionLineConfig {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  stations: LineStationConfig[];
  imageWidthPct: number;
}

/** Vị trí ngang (%) của n trạm: trải đều giữa ĐẦU VÀO và ĐẦU RA */
function spread(n: number): number[] {
  if (n === 1) return [50];
  const a = n <= 2 ? 32 : n === 3 ? 22 : 16;
  const b = 100 - a;
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export const EXPANSION_LINE_CONFIGS: ExpansionLineConfig[] = LINES.map((l) => {
  const xs = spread(l.machines.length);
  return {
    id: l.id,
    code: l.code,
    title: l.title,
    subtitle: l.subtitle,
    imageWidthPct: l.imageWidthPct ?? (l.machines.length >= 5 ? 14.5 : 18),
    stations: l.machines.map(([code, name], i) => ({
      op: `OP${(i + 1) * 10}`,
      code,
      name,
      defaultId: code,
      percentX: Math.round(xs[i] * 10) / 10,
      image: EXPANSION_MACHINE_IMAGES[code]?.image,
      scale: EXPANSION_MACHINE_IMAGES[code]?.scale,
    })),
  };
});

export function findExpansionLine(idOrCode?: string | null): ExpansionLineConfig | null {
  if (!idOrCode) return null;
  return EXPANSION_LINE_CONFIGS.find((l) => l.id === idOrCode || l.code === idOrCode) || null;
}
