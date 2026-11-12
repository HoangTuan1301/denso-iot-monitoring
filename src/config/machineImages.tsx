/**
 * @file machineImages.ts
 * @description Quản lý tập trung ánh xạ hình ảnh CAD thiết bị công nghiệp (Industrial CAD Illustration)
 * cho toàn bộ 14 thiết bị DENSO Smart Factory.
 * - Ánh xạ ưu tiên theo Database ID chuẩn (ID-first mapping)
 * - Fallback linh hoạt qua Machine Code (Code fallback)
 * - Hỗ trợ các định dạng tiêu chuẩn: .webp, .png, .jpg
 * - Cung cấp component MachineImage xử lý onError tự động và render placeholder công nghiệp
 * - Không gây lỗi mạng hoặc loop console khi chưa có file ảnh
 */

import { useState, useMemo } from 'react';
import { Cpu, Box } from 'lucide-react';

export interface MachineImageConfig {
  databaseId: string;
  machineCode: string;
  machineName: string;
  lineId: string;
  imageFileName: string;
  primaryPath: string;
  description: string;
}

/**
 * Bảng đăng ký ánh xạ 14 thiết bị chuẩn DENSO Smart Factory
 * Tuân thủ tuyệt đối quy tắc: Ánh xạ theo Database ID với fallback Machine Code,
 * không phụ thuộc vào tên máy hiển thị.
 */
export const MACHINE_IMAGE_REGISTRY: Record<string, MachineImageConfig> = {
  // === DÂY CHUYỀN 1: LN-PRS-01 (Dập & Hàn Khung Gầm) ===
  'MC-ASM-01': {
    databaseId: 'MC-ASM-01',
    machineCode: 'MC-ASM-01',
    machineName: 'Trạm siết bulong tự động',
    lineId: 'LN-PRS-01',
    imageFileName: 'MC-ASM-01.webp',
    primaryPath: '/images/machines/MC-ASM-01.webp',
    description: 'Trạm siết bulong mô-men xoắn tự động đa trục',
  },
  'MC-CYL-01': {
    databaseId: 'MC-CYL-01',
    machineCode: 'MC-CYL-01',
    machineName: 'Máy dập xi lanh thủy lực',
    lineId: 'LN-PRS-01',
    imageFileName: 'MC-CYL-01.webp',
    primaryPath: '/images/machines/MC-CYL-01.webp',
    description: 'Máy ép/dập xi-lanh thủy lực áp suất cao SMC',
  },
  'MC-FDR-01': {
    databaseId: 'MC-FDR-01',
    machineCode: 'MC-FDR-01',
    machineName: 'Máy cấp phôi tự động',
    lineId: 'LN-PRS-01',
    imageFileName: 'MC-FDR-01.webp',
    primaryPath: '/images/machines/MC-FDR-01.webp',
    description: 'Hệ thống nạp và cấp phôi phôi tự động DENSO-FEED',
  },
  'MC-TEST-C01': {
    databaseId: 'MC-TEST-C01',
    machineCode: 'MC-PHASE-C',
    machineName: 'Máy thử nghiệm giai đoạn C',
    lineId: 'LN-PRS-01',
    imageFileName: 'MC-PHASE-C.webp',
    primaryPath: '/images/machines/MC-PHASE-C.webp',
    description: 'Trạm máy thử nghiệm giai đoạn C tích hợp cảm biến IoT Modbus/OPC-UA (CAD chuẩn Mentor)',
  },
  'MCH-WLD-01': {
    databaseId: 'MCH-WLD-01',
    machineCode: 'ROB-01',
    machineName: 'Robot hàn điểm Fanuc R-2000iC',
    lineId: 'LN-PRS-01',
    imageFileName: 'ROB-01.webp',
    primaryPath: '/images/machines/ROB-01.webp',
    description: 'Robot hàn điểm công nghiệp 6 trục Fanuc R-2000iC',
  },
  'MCH-PRS-01': {
    databaseId: 'MCH-PRS-01',
    machineCode: 'STP-01',
    machineName: 'Máy dập thủy lực 500T Komatsu',
    lineId: 'LN-PRS-01',
    imageFileName: 'STP-01.webp',
    primaryPath: '/images/machines/STP-01.webp',
    description: 'Máy dập thủy lực công suất lớn 500 Tấn Komatsu',
  },

  // === DÂY CHUYỀN 2: LN-PNT-02 (Sơn Tĩnh Điện) ===
  'MCH-DRY-01': {
    databaseId: 'MCH-DRY-01',
    machineCode: 'DRY-01',
    machineName: 'Lò sấy nhiệt hồng ngoại Kawasumi',
    lineId: 'LN-PNT-02',
    imageFileName: 'DRY-01-new.png',
    primaryPath: '/images/machines/DRY-01-new.png',
    description: 'Buồng lò sấy nhiệt hồng ngoại điều nhiệt tự động Kawasumi',
  },
  'MC-DRY-01': {
    databaseId: 'MC-DRY-01',
    machineCode: 'MC-DRY-01',
    machineName: 'Trạm sấy hồng ngoại',
    lineId: 'LN-PNT-02',
    imageFileName: 'MC-DRY-01-new.png',
    primaryPath: '/images/machines/MC-DRY-01-new.png',
    description: 'Trạm tiền sấy hồng ngoại công đoạn sơn',
  },
  'MC-PNT-01': {
    databaseId: 'MC-PNT-01',
    machineCode: 'MC-PNT-01',
    machineName: 'Trạm phun sơn tự động',
    lineId: 'LN-PNT-02',
    imageFileName: 'MC-PNT-01-new.png',
    primaryPath: '/images/machines/MC-PNT-01-new.png',
    description: 'Trạm phun phủ bề mặt sơn tĩnh điện tự động',
  },
  'MCH-PNT-01': {
    databaseId: 'MCH-PNT-01',
    machineCode: 'PNT-01',
    machineName: 'Buồng phun sơn robot Yaskawa EPX',
    lineId: 'LN-PNT-02',
    imageFileName: 'PNT-01-new.png',
    primaryPath: '/images/machines/PNT-01-new.png',
    description: 'Buồng robot sơn cánh tay chuyển động linh hoạt Yaskawa EPX',
  },

  // === DÂY CHUYỀN 3: LN-ASM-03 (Lắp Ráp Hoàn Thiện) ===
  'MCH-ASM-01': {
    databaseId: 'MCH-ASM-01',
    machineCode: 'ASM-01',
    machineName: 'Robot siết bulong tự động Atlas Copco',
    lineId: 'LN-ASM-03',
    imageFileName: 'ASM-01-new.png',
    primaryPath: '/images/machines/ASM-01-new.png',
    description: 'Hệ thống siết lực chính xác cao Atlas Copco Tensor',
  },
  'MC-TST-01': {
    databaseId: 'MC-TST-01',
    machineCode: 'MC-TST-01',
    machineName: 'Trạm kiểm tra chức năng',
    lineId: 'LN-ASM-03',
    imageFileName: 'MC-TST-01-new.png',
    primaryPath: '/images/machines/MC-TST-01-new.png',
    description: 'Trạm kiểm tra chức năng rò rỉ khí và kín khít',
  },
  'MCH-MS10': {
    databaseId: 'MCH-MS10',
    machineCode: 'MS-10',
    machineName: 'Messi',
    lineId: 'LN-ASM-03',
    imageFileName: 'MS-10-new.png',
    primaryPath: '/images/machines/MS-10-new.png',
    description: 'Trạm gia công chuyên dụng MS-10 (gán 2 metric TORQUE_TIGHTENING & CURRENT_PHASE)',
  },
  'MCH-TST-01': {
    databaseId: 'MCH-TST-01',
    machineCode: 'TST-01',
    machineName: 'Băng chuyền kiểm tra cuối dòng TestBench',
    lineId: 'LN-ASM-03',
    imageFileName: 'TST-01-new.png',
    primaryPath: '/images/machines/TST-01-new.png',
    description: 'Băng chuyền kiểm tra tổng thể cuối chuyền TestBench',
  },
};

// Ánh xạ phụ từ Machine Code sang Database ID (Code fallback lookup)
const CODE_TO_DB_ID_MAP: Record<string, string> = {
  'MC-ASM-01': 'MC-ASM-01',
  'MC-CYL-01': 'MC-CYL-01',
  'MC-FDR-01': 'MC-FDR-01',
  'MC-PHASE-C': 'MC-TEST-C01',
  'ROB-01': 'MCH-WLD-01',
  'STP-01': 'MCH-PRS-01',
  'DRY-01': 'MCH-DRY-01',
  'MC-DRY-01': 'MC-DRY-01',
  'MC-PNT-01': 'MC-PNT-01',
  'PNT-01': 'MCH-PNT-01',
  'ASM-01': 'MCH-ASM-01',
  'MC-TST-01': 'MC-TST-01',
  'MS-10': 'MCH-MS10',
  'TST-01': 'MCH-TST-01',
};

/**
 * Lấy cấu hình ảnh thiết bị theo ID hoặc Code
 */
export function getMachineImageConfig(idOrCode?: string | null): MachineImageConfig | null {
  if (!idOrCode) return null;
  const cleanKey = idOrCode.trim();

  // 1. Tìm trực tiếp theo Database ID
  if (MACHINE_IMAGE_REGISTRY[cleanKey]) {
    return MACHINE_IMAGE_REGISTRY[cleanKey];
  }

  // 2. Tìm fallback theo Machine Code
  const dbId = CODE_TO_DB_ID_MAP[cleanKey];
  if (dbId && MACHINE_IMAGE_REGISTRY[dbId]) {
    return MACHINE_IMAGE_REGISTRY[dbId];
  }

  // 3. Quét case-insensitive
  const upperKey = cleanKey.toUpperCase();
  for (const [key, cfg] of Object.entries(MACHINE_IMAGE_REGISTRY)) {
    if (key.toUpperCase() === upperKey || cfg.machineCode.toUpperCase() === upperKey) {
      return cfg;
    }
  }

  return null;
}

/**
 * Lấy đường dẫn ảnh sơ cấp của thiết bị
 */
export function getMachineImagePath(idOrCode?: string | null): string | null {
  const cfg = getMachineImageConfig(idOrCode);
  return cfg ? cfg.primaryPath : null;
}

export interface MachineImageProps {
  machineId?: string | null;
  machineCode?: string | null;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  containerClassName?: string;
  fallbackIconClassName?: string;
  showFallbackLabel?: boolean;
}

/**
 * Component MachineImage hiển thị hình ảnh CAD của thiết bị:
 * - Ưu tiên 1: Ảnh do người dùng upload/tùy chỉnh (imageUrl)
 * - Ưu tiên 2: Ảnh tĩnh được ánh xạ theo Database ID / Machine Code trong registry
 * - Ưu tiên 3: Industrial CAD placeholder
 * - Không gây lỗi vỡ hình ảnh hay console loop
 */
export function MachineImage({
  machineId,
  machineCode,
  imageUrl,
  alt,
  className = 'w-full h-full object-contain',
  containerClassName = '',
  fallbackIconClassName = 'w-10 h-10 text-emerald-600/70 dark:text-emerald-400/70',
  showFallbackLabel = false,
}: MachineImageProps) {
  const cfg = getMachineImageConfig(machineId) || getMachineImageConfig(machineCode);
  const identifier = machineCode || machineId || 'MCH';

  // Thử các nguồn ảnh ứng viên: ưu tiên primaryPath / imageFileName, sau đó fallback .webp -> .png -> .jpg
  const baseCode = cfg?.machineCode || identifier;
  const primaryFile = cfg?.primaryPath || (cfg?.imageFileName ? `/images/machines/${cfg.imageFileName}` : null);
  const baseFile = cfg?.imageFileName
    ? cfg.imageFileName.replace(/\.[^/.]+$/, '')
    : baseCode;

  const candidateSources = useMemo(() => {
    const list: string[] = [];
    if (primaryFile) list.push(primaryFile);
    ['webp', 'png', 'jpg'].forEach((ext) => {
      const p = `/images/machines/${baseFile}.${ext}`;
      if (!list.includes(p)) list.push(p);
    });
    if (cfg?.machineCode && cfg.machineCode !== baseFile) {
      ['webp', 'png', 'jpg'].forEach((ext) => {
        const p = `/images/machines/${cfg.machineCode}.${ext}`;
        if (!list.includes(p)) list.push(p);
      });
    }
    return list;
  }, [primaryFile, baseFile, cfg?.machineCode]);

  const [srcIndex, setSrcIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [userImgError, setUserImgError] = useState(false);

  // Nếu có imageUrl hợp lệ và chưa bị lỗi, ưu tiên hiển thị imageUrl
  const hasUserImage = Boolean(imageUrl && !userImgError);
  const currentSrc = hasUserImage
    ? (imageUrl as string)
    : candidateSources[srcIndex] || `/images/machines/${baseCode}.png`;

  const handleError = () => {
    if (hasUserImage) {
      // Khi ảnh upload bị lỗi, chuyển sang fallback ảnh tĩnh
      setUserImgError(true);
      return;
    }
    if (srcIndex < candidateSources.length - 1) {
      setSrcIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  if (!cfg && !machineCode && !machineId) {
    return (
      <div className={`flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 dark:bg-factory-surface border border-dashed border-slate-200 dark:border-factory-border ${containerClassName}`}>
        <Box className={fallbackIconClassName} />
        {showFallbackLabel && (
          <span className="text-[10px] font-mono text-slate-400 mt-1">Chưa xác định</span>
        )}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50/80 dark:bg-factory-surface/80 border border-slate-200/80 dark:border-factory-border ${containerClassName}`}>
        <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 mb-1">
          <Cpu className={fallbackIconClassName} />
        </div>
        {showFallbackLabel && (
          <div className="text-center mt-1">
            <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 block">
              {cfg?.machineCode || identifier}
            </span>
            <span className="text-[9px] text-slate-400">Chờ nạp ảnh CAD</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${containerClassName}`}>
      <img
        src={currentSrc}
        alt={alt || cfg?.machineName || identifier}
        onError={handleError}
        className={`${className} transition-opacity duration-200`}
        loading="lazy"
      />
    </div>
  );
}
