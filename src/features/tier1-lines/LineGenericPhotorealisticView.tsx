/**
 * @file LineGenericPhotorealisticView.tsx
 * @description Sơ đồ dây chuyền & trạng thái thiết bị đa năng cho Line 2 (LN-PNT-02) và Line 3 (LN-ASM-03)
 * thiết kế bám sát 100% phong cách thẩm mỹ và kiến trúc đã được duyệt của Line 1 (LN-PRS-01):
 * - Bố cục ngang chuẩn xác: Sàn epoxy xám bóng phối cảnh 2.5D, vạch an toàn 5S vàng, mũi tên xanh, băng tải con lăn thép
 * - 4 máy lớn sắc nét, phân bố đều theo chiều ngang (OP10..OP40), không có OP50/OP60, không khoảng trống thừa
 * - Duy nhất 1 nhãn ĐẦU VÀO ở đầu trái và 1 nhãn ĐẦU RA ở đầu phải
 * - Thẻ thông tin công đoạn nổi lơ lửng: Mã OP, Tên thiết bị, Badge trạng thái thời gian thực từ Monitoring Store
 * - Đường chỉ dẫn màu xanh nối từ đáy thẻ xuống đỉnh máy
 * - Tương tác: Hover sáng viền xanh, Click thẻ hoặc máy mở trực tiếp Machine Detail & CHECK SHEET với đúng Database ID
 * - Nút phóng to (Fullscreen) mở rộng sơ đồ cố định toàn màn hình, không xoay 3D
 * - Không có hàng 6 thẻ thống kê phụ phía dưới (ôm sát sơ đồ)
 */

import { useState, useMemo } from 'react';
import {
  Activity,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  StopCircle,
  X,
} from 'lucide-react';
import { tr } from '../../i18n/tr';

export interface StationFlowData {
  id: string;
  code: string;
  name: string;
  actualCode?: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'STOPPED' | 'OFFLINE';
  statusLabel: string;
  machine?: any;
  resolved?: any;
}

export interface LineStationConfig {
  op: string;
  code: string;
  name: string;
  defaultId: string;
  percentX: number;
  /** Ảnh máy đã tách nền (PNG/WebP trong suốt) đặt lên băng tải */
  image?: string;
  /** Hệ số chiều cao ảnh máy (1 = mặc định) để cân đối máy dài / máy cao */
  scale?: number;
}

export interface LineGenericPhotorealisticViewProps {
  lineId: string;
  lineCode: string;
  lineTitle: string;
  lineSubtitle: string;
  bgImageUrl: string;
  stationConfigs: LineStationConfig[];
  flowStations: StationFlowData[];
  onSelectMachine: (machineId: string) => void;
  currentLine?: any;
  /** Độ rộng ảnh máy (% sơ đồ); line nhiều máy dùng nhỏ hơn */
  imageWidthPct?: number;
}

export function LineGenericPhotorealisticView({
  lineCode,
  lineTitle,
  lineSubtitle,
  bgImageUrl,
  stationConfigs,
  flowStations,
  onSelectMachine,
  currentLine,
  imageWidthPct,
}: LineGenericPhotorealisticViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredOp, setHoveredOp] = useState<string | null>(null);

  // Ánh xạ dữ liệu 4 trạm kết hợp cấu hình hiển thị chuẩn
  const stations = useMemo(() => {
    return stationConfigs.map((cfg, index) => {
      // 1. Ưu tiên khớp chính xác theo Database ID hoặc Machine Code chuẩn
      const live =
        flowStations.find(
          (st) =>
            st.id === cfg.defaultId ||
            st.machine?.id === cfg.defaultId ||
            st.actualCode === cfg.code ||
            st.code === cfg.code
        ) ||
        flowStations.find((st) => st.code === cfg.op) ||
        flowStations[index] ||
        null;

      // 2. Bảo đảm machineId và tên máy luôn tuân theo cấu hình chuẩn của trạm nếu live không khớp định danh chính xác
      const isExactMatch = Boolean(
        live &&
          (live.id === cfg.defaultId ||
            live.machine?.id === cfg.defaultId ||
            live.actualCode === cfg.code ||
            live.code === cfg.code)
      );

      const machineId = isExactMatch ? (live?.machine?.id || live?.id || cfg.defaultId) : cfg.defaultId;
      const name = isExactMatch ? (live?.name || cfg.name) : cfg.name;
      const status = live?.status || 'OK';
      const statusLabel =
        status === 'CRITICAL'
          ? tr("Sự cố")
          : status === 'WARNING'
          ? tr("Cảnh báo")
          : status === 'STOPPED' || status === 'OFFLINE'
          ? tr("Tạm dừng")
          : tr("Đang chạy");

      return {
        op: cfg.op,
        code: cfg.code,
        name,
        machineId,
        status,
        statusLabel,
        percentX: cfg.percentX,
        image: cfg.image,
        scale: cfg.scale ?? 1,
        liveData: live,
      };
    });
  }, [stationConfigs, flowStations]);

  // Thống kê số lượng máy vận hành
  const stats = useMemo(() => {
    let running = 0;
    let paused = 0;
    let warning = 0;
    let stopped = 0;

    stations.forEach((st) => {
      if (st.status === 'CRITICAL') {
        stopped++;
      } else if (st.status === 'STOPPED' || st.status === 'OFFLINE') {
        paused++;
      } else if (st.status === 'WARNING') {
        warning++;
      } else {
        running++;
      }
    });

    const total = stations.length;
    const outputToday = currentLine?.todayOutput ?? 980;

    return { total, running, paused, warning, stopped, outputToday };
  }, [stations, currentLine]);

  // Bảo toàn thống kê vận hành nội bộ
  void stats;

  /**
   * Component render khung sơ đồ dây chuyền trung tâm (dùng chung trong Card và Modal toàn màn hình)
   */
  /**
   * Component render khung sơ đồ dây chuyền trung tâm (dùng chung trong Card và Modal toàn màn hình)
   */
  const renderDiagramContent = () => {
    return (
      <div className="relative w-full overflow-hidden select-none">
        {/* Vùng cuộn ngang an toàn cho màn hình nhỏ, bảo toàn tỷ lệ 1024/240 */}
        <div className="overflow-x-auto overflow-y-hidden pb-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          <div className="relative min-w-[940px] lg:min-w-0 w-full aspect-[1024/240] rounded-xl overflow-hidden bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            {/* 1. NỀN DÂY CHUYỀN: vẽ bằng SVG khi có ảnh máy tách nền, ngược lại dùng ảnh nền cũ */}
            {stations.every((st) => st.image) ? (
              <ConveyorScene stations={stations} hoveredOp={hoveredOp} imageWidthPct={imageWidthPct} />
            ) : (
              <img
                src={bgImageUrl}
                alt={`DENSO ${lineCode} Layout`}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none"
              />
            )}

            {/* 2. CÁC THẺ TRẠNG THÁI NỔI LƠ LỬNG + ĐƯỜNG CHỈ DẪN XANH (OVERLAY REACT DYNAMIC) */}
            {stations.map((st) => {
              const isHovered = hoveredOp === st.op;
              const isCritical = st.status === 'CRITICAL';
              const isWarning = st.status === 'WARNING';
              const isStopped = st.status === 'STOPPED' || st.status === 'OFFLINE';

              return (
                <div
                  key={st.op}
                  style={{
                    left: `${st.percentX}%`,
                    top: '2%',
                    transform: 'translateX(-50%)',
                  }}
                  className={`absolute z-20 flex flex-col items-center transition-transform duration-200 ${
                    isHovered ? 'scale-105 z-30' : ''
                  }`}
                  onMouseEnter={() => setHoveredOp(st.op)}
                  onMouseLeave={() => setHoveredOp(null)}
                >
                  {/* Card thông tin công đoạn (Nền trắng bo góc mềm, shadow tinh tế) */}
                  <button
                    type="button"
                    onClick={() => onSelectMachine(st.machineId)}
                    className={`w-[125px] sm:w-[136px] px-2 py-1.5 rounded-2xl border text-center transition-all cursor-pointer shadow-sm ${
                      isCritical
                        ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-500 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/40 shadow-rose-500/20'
                        : isWarning
                        ? 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-500 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/30'
                        : isStopped
                        ? 'bg-slate-100/95 dark:bg-slate-900/90 border-slate-400 text-slate-800 dark:text-slate-200'
                        : 'bg-white/95 dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                    title={tr("Nhấn để mở Machine Detail & CHECK SHEET cho {0} ({1})", st.code, st.name)}
                  >
                    {/* Hàng 1: Mã OP (Màu xanh dương đậm) */}
                    <div className="font-mono font-black text-xs text-blue-600 dark:text-blue-400 tracking-wide leading-none">
                      {st.op}
                    </div>

                    {/* Hàng 2: Tên thiết bị */}
                    <div className="text-[10px] font-bold text-slate-800 dark:text-slate-100 leading-tight mt-1 line-clamp-2 h-[24px] flex items-center justify-center">
                      {st.name}
                    </div>

                    {/* Hàng 3: Badge trạng thái */}
                    <div className="mt-1 flex justify-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isCritical
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 animate-pulse'
                            : isWarning
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse'
                            : isStopped
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {isCritical ? (
                          <AlertOctagon className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        ) : isStopped ? (
                          <StopCircle className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        )}
                        <span>{st.statusLabel}</span>
                      </span>
                    </div>
                  </button>

                  {/* Đường chỉ dẫn màu xanh nối thẻ với đúng máy */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-[1.5px] h-4 sm:h-5 transition-colors ${
                        isHovered ? 'bg-blue-600 dark:bg-blue-400' : 'bg-blue-400/80 dark:bg-blue-500/80'
                      }`}
                    />
                    <div
                      className={`w-1.5 h-1.5 rounded-full -mt-0.5 transition-colors ${
                        isHovered ? 'bg-blue-600' : 'bg-blue-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}

            {/* 3. CÁC VÙNG HOTSPOT TƯƠNG TÁC ĐỘC LẬP TRÊN TỪNG MÁY (Clickable Machine Zones) */}
            {stations.map((st) => {
              const isHovered = hoveredOp === st.op;
              return (
                <div
                  key={`hotspot-${st.op}`}
                  style={{
                    left: `${st.percentX}%`,
                    transform: 'translateX(-50%)',
                  }}
                  onClick={() => onSelectMachine(st.machineId)}
                  onMouseEnter={() => setHoveredOp(st.op)}
                  onMouseLeave={() => setHoveredOp(null)}
                  className={`absolute top-[30%] bottom-[6%] w-[15%] min-w-[110px] max-w-[170px] z-10 cursor-pointer rounded-xl transition-all duration-150 ${
                    isHovered
                      ? 'bg-blue-500/5 ring-2 ring-blue-500/40'
                      : ''
                  }`}
                  title={tr("Nhấn vào máy {0} ({1}) để xem Machine Detail", st.code, st.name)}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-factory-card shadow-xs space-y-4">
      {/* ========================================================================= */}
      {/* 1. KHU VỰC TIÊU ĐỀ CARD (Bám sát ảnh mẫu Line 1 đã duyệt)                   */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-3">
        {/* Phía trên bên trái: Icon + Tiêu đề + Phụ đề */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 shadow-2xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
              {lineTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {lineSubtitle}
            </p>
          </div>
        </div>

        {/* Góc trên bên phải: 4 Công đoạn + Nút phóng to */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-factory-surface px-3 py-1.5 rounded-full border border-slate-200/70 dark:border-slate-700/60 shadow-2xs">
            {stations.length} {tr("Công đoạn")}
          </span>

          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
            title={tr("Mở sơ đồ ở chế độ toàn màn hình")}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KHU VỰC DÂY CHUYỀN BỐ CỤC NGANG 4 MÁY CÂN ĐỐI                            */}
      {/* ========================================================================= */}
      {renderDiagramContent()}

      {/* ========================================================================= */}
      {/* 3. MODAL TOÀN MÀN HÌNH (FULLSCREEN OVERLAY KHI NHẤN NÚT PHÓNG TO)            */}
      {/* ========================================================================= */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
          <div className="max-w-7xl w-full mx-auto my-auto bg-white dark:bg-factory-card rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-100">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lineTitle} {tr("(Toàn màn hình)")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr("Bấm vào bất kỳ máy nào để mở Machine Detail & CHECK SHEET")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title={tr("Đóng toàn màn hình")}
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title={tr("Đóng")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Nội dung sơ đồ */}
            <div className="py-2">{renderDiagramContent()}</div>

            {/* Chú thích hướng dẫn tương tác */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <span>{tr("💡 Nhấp trực tiếp vào máy hoặc thẻ OP để mở nhanh Machine Detail")}</span>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {tr("Quay lại giao diện chính")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cấu hình chuẩn 4 công đoạn Line 2 (LN-PNT-02)
 */
/**
 * Cấu hình chuẩn 4 công đoạn Line 2 (LN-PNT-02)
 */
export const LINE2_STATION_CONFIGS: LineStationConfig[] = [
  { op: 'OP10', code: 'DRY-01', name: tr("Lò sấy nhiệt hồng ngoại Kawasumi"), defaultId: 'MCH-DRY-01', percentX: 20.0, image: '/images/machines/cutout/DRY-01.webp', scale: 0.9 },
  { op: 'OP20', code: 'MC-DRY-01', name: tr("Trạm sấy hồng ngoại"), defaultId: 'MC-DRY-01', percentX: 40.0, image: '/images/machines/cutout/MC-DRY-01.webp' },
  { op: 'OP30', code: 'MC-PNT-01', name: tr("Trạm phun sơn tự động"), defaultId: 'MC-PNT-01', percentX: 60.0, image: '/images/machines/cutout/MC-PNT-01.webp' },
  { op: 'OP40', code: 'PNT-01', name: tr("Buồng phun sơn robot Yaskawa EPX"), defaultId: 'MCH-PNT-01', percentX: 80.0, image: '/images/machines/cutout/PNT-01.webp' },
];

/**
 * Cấu hình chuẩn 4 công đoạn Line 3 (LN-ASM-03)
 */
/**
 * Cấu hình chuẩn 4 công đoạn Line 3 (LN-ASM-03)
 */
export const LINE3_STATION_CONFIGS: LineStationConfig[] = [
  { op: 'OP10', code: 'ASM-01', name: tr("Robot siết bulong tự động Atlas Copco"), defaultId: 'MCH-ASM-01', percentX: 20.0, image: '/images/machines/cutout/ASM-01.webp' },
  { op: 'OP20', code: 'MC-TST-01', name: tr("Trạm kiểm tra chức năng"), defaultId: 'MC-TST-01', percentX: 40.0, image: '/images/machines/cutout/MC-TST-01.webp' },
  { op: 'OP30', code: 'MS-10', name: 'Messi', defaultId: 'MCH-MS10', percentX: 60.0, image: '/images/machines/cutout/MS-10.webp' },
  { op: 'OP40', code: 'TST-01', name: tr("Băng chuyền kiểm tra cuối dòng TestBench"), defaultId: 'MCH-TST-01', percentX: 80.0, image: '/images/machines/cutout/TST-01.webp', scale: 0.82 },
];

/**
 * Nền dây chuyền vẽ bằng SVG (thay ảnh JPG cũ có khung trắng quanh máy):
 * sàn, ray an toàn màu cam, băng tải con lăn, chân đỡ và mũi tên hướng dòng chảy.
 * viewBox 1024×240 khớp tỉ lệ khung sơ đồ; tự đổi màu theo chế độ sáng/tối.
 */
function ConveyorBackdrop({ stationXs }: { stationXs: number[] }) {
  const W = 1024;
  const xs = stationXs.map((p) => (p / 100) * W);
  // vị trí mũi tên: giữa các máy + trước máy đầu, sau máy cuối
  const gaps = [
    (70 + xs[0]) / 2 - 20,
    ...xs.slice(1).map((x, i) => (xs[i] + x) / 2),
    (xs[xs.length - 1] + W - 70) / 2 + 20,
  ];
  const legs = [92, W - 92];
  const rollers: number[] = [];
  for (let x = 66; x < W - 66; x += 14) rollers.push(x);
  return (
    <svg
      viewBox={`0 0 ${W} 240`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full pointer-events-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lnFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="[stop-color:#f8fafc] dark:[stop-color:#0f172a]" />
          <stop offset="0.6" className="[stop-color:#eef2f7] dark:[stop-color:#111c2e]" />
          <stop offset="1" className="[stop-color:#dfe6ef] dark:[stop-color:#16233a]" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height="240" fill="url(#lnFloor)" />
      {/* vùng sàn dưới băng tải */}
      <rect x="0" y="186" width={W} height="54" className="fill-slate-300/40 dark:fill-slate-700/30" />
      {/* ray an toàn màu cam (vòng kín) */}
      <path
        d={`M 16 148 L ${W - 16} 148 M 16 148 L 16 228 L ${W - 16} 228 L ${W - 16} 148`}
        fill="none"
        stroke="#f0a030"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* chân đỡ băng tải */}
      {legs.map((x, i) => (
        <g key={`leg-${i}`} className="fill-slate-500 dark:fill-slate-500">
          <rect x={x - 3} y="184" width="6" height="36" />
          <rect x={x - 14} y="217" width="28" height="5" rx="1" />
        </g>
      ))}
      {/* băng tải con lăn */}
      <rect x="62" y="167" width={W - 124} height="19" rx="2" className="fill-slate-500 dark:fill-slate-600" />
      {rollers.map((x) => (
        <rect
          key={`r-${x}`}
          x={x}
          y="170"
          width="9"
          height="13"
          rx="1.5"
          className="fill-slate-100 stroke-slate-400 dark:fill-slate-300 dark:stroke-slate-500"
          strokeWidth="1"
        />
      ))}
      {/* mũi tên hướng dòng chảy */}
      {gaps.map((x, i) => (
        <g key={`ch-${i}`} transform={`translate(${x - 9} 214)`} className="fill-none stroke-blue-500" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 0 0 L 5 5 L 0 10" />
          <path d="M 7 0 L 12 5 L 7 10" />
        </g>
      ))}
    </svg>
  );
}

export interface SceneStation {
  op: string;
  name: string;
  percentX: number;
  image?: string;
  scale?: number;
}

/**
 * Cảnh dây chuyền dùng chung cho Line 1/2/3: nền băng tải SVG, nhãn ĐẦU VÀO / ĐẦU RA
 * và ảnh từng máy (ảnh gốc đã tách nền, cùng ảnh với màn Chi tiết máy).
 */
export function ConveyorScene({
  stations,
  hoveredOp,
  imageWidthPct = 18.5,
  imageHeightPct = 58,
}: {
  stations: SceneStation[];
  hoveredOp: string | null;
  imageWidthPct?: number;
  imageHeightPct?: number;
}) {
  return (
    <>
      <ConveyorBackdrop stationXs={stations.map((st) => st.percentX)} />
      {/* Nhãn ĐẦU VÀO / ĐẦU RA (dịch theo ngôn ngữ) */}
      {[
        { side: 'left', label: tr("ĐẦU\nVÀO") },
        { side: 'right', label: tr("ĐẦU\nRA") },
      ].map((lb) => (
        <div
          key={lb.side}
          className="absolute z-[5] flex items-center justify-center rounded-[3px] bg-blue-700 text-white font-black text-center leading-tight shadow-sm whitespace-pre-line"
          style={{
            [lb.side]: '1.4%',
            top: '59%',
            width: '4.6%',
            height: '17%',
            fontSize: 'clamp(7px, 0.85vw, 11px)',
          } as React.CSSProperties}
        >
          {lb.label + ' →'}
        </div>
      ))}
      {/* Ảnh từng máy */}
      {stations.map((st) =>
        st.image ? (
          <img
            key={`img-${st.op}`}
            src={st.image}
            alt={st.name}
            loading="lazy"
            draggable={false}
            className={`absolute z-[6] object-contain object-bottom pointer-events-none select-none transition-transform duration-200 drop-shadow-[0_6px_6px_rgba(15,23,42,0.18)] ${
              hoveredOp === st.op ? 'scale-[1.04]' : ''
            }`}
            style={{
              left: `${st.percentX}%`,
              bottom: '7%',
              width: `${imageWidthPct}%`,
              height: `${Math.round(imageHeightPct * (st.scale ?? 1))}%`,
              transform: 'translateX(-50%)',
              transformOrigin: 'bottom center',
            }}
          />
        ) : null,
      )}
    </>
  );
}
