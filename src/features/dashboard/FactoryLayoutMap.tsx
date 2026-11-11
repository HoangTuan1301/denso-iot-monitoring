/**
 * @file FactoryLayoutMap.tsx
 * @description Bản đồ sơ đồ mặt bằng tổng thể nhà máy DENSO Smart Factory dạng SVG Vector kỹ thuật 2D
 * - Tái hiện chuẩn xác 87 khu vực theo sơ đồ quy hoạch CAD của DENSO.
 * - Khung tổng thể hình chữ nhật, loại bỏ hoàn toàn yếu tố trang trí (không có đường xe, cây xanh, 3D).
 * - Mỗi khu vực đều có chấm tròn trạng thái nhỏ gọn (đường kính 6-10px) với viền trắng mảnh sắc nét.
 * - Màu chấm tròn phân loại tập trung theo getHealthScoreColor (An toàn: xanh lá, Theo dõi: vàng, Cảnh báo: cam, Nguy hiểm: đỏ, Chưa giám sát: xám).
 * - Màu nền khu vực cố định theo nhóm quy hoạch (không đổi theo Health Score).
 * - 3 Dây chuyền giám sát (LN-PRS-01, LN-PNT-02, LN-ASM-03) lấy số liệu thật từ store, có viền phát sáng và có thể click mở Line Overview.
 * - Hỗ trợ đầy đủ tìm kiếm, hover tooltip, click chọn, chuyển đổi chế độ xem và Zoom/Pan.
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  Activity,
  Layers,
  Info,
} from 'lucide-react';
import {
  FACTORY_ZONES,
  FactoryZone,
  getHealthScoreColor,
  getStatusDotColor,
} from './factoryMapConfig';
import { useMonitoringStore } from '../../stores/useMonitoringStore';
import { resolveLineMonitoringState } from '../../utils/machineStatusResolver';

interface FactoryLayoutMapProps {
  viewMode: 'safety' | 'status';
  onChangeViewMode: (mode: 'safety' | 'status') => void;
  selectedZoneId: string | null;
  onSelectZone: (zone: FactoryZone) => void;
  onOpenLineOverview: (lineId: string) => void;
}

export function FactoryLayoutMap({
  viewMode,
  onChangeViewMode,
  selectedZoneId,
  onSelectZone,
  onOpenLineOverview,
}: FactoryLayoutMapProps) {
  const { lines } = useMonitoringStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredZone, setHoveredZone] = useState<FactoryZone | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Map dữ liệu 3 dây chuyền thật từ store vào 3 khu vực cấu hình
  const lineDataMap = useMemo(() => {
    const map = new Map<string, {
      safetyScore: number | null;
      status: string;
      operatingStatus: string;
      operatingStatusLabel: string;
      alarmSeverityLabel: string;
      code: string;
      name: string;
    }>();
    for (const l of lines) {
      const resL = resolveLineMonitoringState(l);
      const entry = {
        safetyScore: resL.safetyScore,
        status: resL.alarmSeverity,
        operatingStatus: resL.operatingStatus,
        operatingStatusLabel: resL.operatingStatusLabel,
        alarmSeverityLabel: resL.alarmSeverityLabel,
        code: l.code,
        name: l.name,
      };
      map.set(l.code, entry);
      map.set(String(l.id), entry);
    }
    return map;
  }, [lines]);

  // Xử lý zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.7));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Xử lý Pan / Kéo rê bản đồ
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Màu nền khu vực cố định theo nhóm quy hoạch kỹ thuật gốc (không đổi theo Health Score)
  const getZoneFillColor = (zone: FactoryZone) => {
    switch (zone.subGroup) {
      case 'green':
        return '#DCFCE7'; // Xanh lá nhạt theo sơ đồ tham chiếu
      case 'cyan':
        return '#E0F2FE'; // Xanh cyan nhạt theo sơ đồ tham chiếu
      case 'yellow':
        return '#FEF9C3'; // Vàng nhạt / kem
      case 'pink':
        return '#FFE4E6'; // Hồng nhạt cho CVT như ảnh tham chiếu
      case 'orange':
        return '#EA580C'; // Cam công nghiệp đặc trưng cho OFFICE
      case 'gray':
      default:
        return '#F1F5F9'; // Xám nhạt cho logistics & phụ trợ
    }
  };

  // Màu viền khu vực: mảnh, sắc nét, đồng nhất chuẩn 2D CAD
  const getZoneStrokeColor = (zone: FactoryZone) => {
    if (zone.id === selectedZoneId) return '#2563EB'; // Viền xanh dương đậm khi chọn
    if (zone.subGroup === 'orange') return '#C2410C';
    return '#334155'; // Viền xám đậm kỹ thuật chuẩn xác
  };

  return (
    <div className="bg-white dark:bg-factory-card rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col h-full overflow-hidden">
      {/* 1. Header bản đồ & Thanh công cụ điều khiển */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-factory-card">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
              Sơ đồ tổng thể nhà máy (Factory Layout)
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Giám sát trạng thái 87 khu vực. Nhấn vào dây chuyền (viền xanh lá) để xem chi tiết.
            </p>
          </div>
        </div>

        {/* Thanh công cụ: Chế độ xem & Zoom */}
        <div className="flex items-center gap-2">
          {/* Nút chuyển đổi: [Mức độ an toàn] / [Trạng thái] */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-factory-surface rounded-xl border border-slate-200/60 dark:border-factory-border text-xs">
            <button
              type="button"
              onClick={() => onChangeViewMode('safety')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'safety'
                  ? 'bg-white dark:bg-factory-card text-emerald-700 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mức độ an toàn</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('status')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'status'
                  ? 'bg-white dark:bg-factory-card text-emerald-700 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Trạng thái</span>
            </button>
          </div>

          {/* Công cụ Zoom / Pan */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-factory-surface rounded-xl border border-slate-200/60 dark:border-factory-border">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Phóng to"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-factory-card transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Thu nhỏ"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-factory-card transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Đặt lại tỷ lệ ban đầu"
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-factory-card transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Khung vẽ SVG bản đồ có thể Zoom và Kéo rê */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative flex-1 min-h-[480px] bg-white dark:bg-factory-bg/40 overflow-hidden select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <svg
          viewBox="0 0 850 536"
          className="w-full h-full transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Lưới tọa độ định tuyến kỹ thuật 2D */}
          <defs>
            <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="850" height="536" fill="url(#cad-grid)" opacity="0.3" />

          {/* Khung tổng thể hình chữ nhật bao quanh toàn bộ nhà máy */}
          <rect
            x="24"
            y="3"
            width="812"
            height="526"
            rx="2"
            fill="none"
            stroke="#1E293B"
            strokeWidth="2"
          />

          {/* Vẽ từng khu vực nhà máy (87 khu vực) */}
          {FACTORY_ZONES.map((zone) => {
            const isSelected = zone.id === selectedZoneId;
            const isConfigured = zone.isConfiguredLine;
            const fillColor = getZoneFillColor(zone);
            const strokeColor = getZoneStrokeColor(zone);

            // Dữ liệu dây chuyền thật nếu là line được cấu hình
            const liveLine = isConfigured && zone.mappedLineId ? lineDataMap.get(zone.mappedLineId) : null;
            const liveScore = liveLine ? liveLine.safetyScore : null;
            const liveStatus = liveLine ? liveLine.status : 'UNMONITORED';

            // Màu chấm tròn trạng thái phân loại tập trung
            const dotColor = viewMode === 'safety'
              ? getHealthScoreColor(liveScore)
              : getStatusDotColor(liveStatus);

            // Phân loại kích thước ô
            const isLargeCell = zone.w >= 70 && zone.h >= 45;
            const isMediumCell = zone.w >= 50 && zone.h >= 25 && !isLargeCell;

            // Kích thước chấm tròn (đường kính 6-9px, bán kính 3-4.5px)
            const dotRadius = isLargeCell ? 4.5 : 3.5;

            // Tính cỡ chữ tự động theo kích thước ô
            const fontSize = isLargeCell
              ? (zone.w > 140 ? 11 : 9.5)
              : isMediumCell
              ? 8
              : Math.max(6, Math.min(7.5, zone.h * 0.55));

            // Tên hiển thị: ưu tiên shortName nếu ô nhỏ
            const displayName = !isLargeCell && zone.shortName ? zone.shortName : zone.name;

            // Tự động ngắt dòng thông minh khi tên dài vượt quá chiều rộng ô
            const getDisplayLines = (name: string, maxCharsPerLine: number) => {
              if (name === 'CVT MID L1..L6') return ['CVT MID', 'L1..L6'];
              if (name.length <= maxCharsPerLine) return [name];
              const words = name.split(' ');
              if (words.length <= 1) return [name];
              const lines: string[] = [];
              let current = '';
              for (const word of words) {
                if (!current) {
                  current = word;
                } else if ((current + ' ' + word).length <= maxCharsPerLine) {
                  current += ' ' + word;
                } else {
                  lines.push(current);
                  current = word;
                }
              }
              if (current) lines.push(current);
              return lines;
            };

            const maxChars = Math.max(6, Math.floor((zone.w - 18) / (fontSize * 0.65)));
            const displayLines = getDisplayLines(displayName, maxChars);
            const isMultiLine = displayLines.length > 1;

            return (
              <g
                key={zone.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectZone(zone);
                  if (zone.mappedLineId) {
                    onOpenLineOverview(zone.mappedLineId);
                  }
                }}
                onMouseEnter={() => setHoveredZone(zone)}
                onMouseLeave={() => setHoveredZone(null)}
                className="cursor-pointer group"
              >
                {/* Khối của khu vực: nếu có svgPath (như OFFICE chữ L) thì vẽ path, ngược lại vẽ rect */}
                {zone.svgPath ? (
                  <path
                    d={zone.svgPath}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '2.5' : '1'}
                    strokeDasharray={zone.category === 'future' ? '4 3' : 'none'}
                    className="transition-all duration-150 hover:brightness-95"
                  />
                ) : (
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.h}
                    rx="2"
                    ry="2"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '2.5' : '1'}
                    strokeDasharray={zone.category === 'future' ? '4 3' : 'none'}
                    className="transition-all duration-150 hover:brightness-95"
                  />
                )}

                {/* Vòng hào quang nhịp thở cho 3 dây chuyền được cấu hình */}
                {isConfigured && (
                  <rect
                    x={zone.x - 2}
                    y={zone.y - 2}
                    width={zone.w + 4}
                    height={zone.h + 4}
                    rx="4"
                    ry="4"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                    className="animate-pulse pointer-events-none"
                  />
                )}

                {/* HIỂN THỊ CHẤM TRÒN VÀ CHỮ THEO KÍCH THƯỚC Ô */}
                {isLargeCell ? (
                  /* ======================================================== */
                  /* A. KHU VỰC LỚN (LOG, CVT, AT, APM, WC, OFFICE, CVT MID)  */
                  /* ======================================================== */
                  <g className="pointer-events-none select-none">
                    {/* Trường hợp nhiều dòng (ví dụ: CVT MID L1..L6) */}
                    {isMultiLine ? (
                      <g transform={`translate(${zone.x + zone.w / 2}, ${zone.y + (zone.h > 70 ? zone.h / 2 - 16 : zone.h / 2 - 10)})`}>
                        {/* Dòng 1: Chấm tròn + Dòng đầu */}
                        <g transform="translate(0, 0)">
                          <circle
                            cx={-(Math.min(displayLines[0].length, 12) * 3.0 + 8)}
                            cy={0}
                            r={dotRadius}
                            fill={dotColor}
                            stroke="#FFFFFF"
                            strokeWidth="1.2"
                          />
                          <text
                            x={-(Math.min(displayLines[0].length, 12) * 3.0)}
                            y={0}
                            textAnchor="start"
                            dominantBaseline="central"
                            fontSize={fontSize * 0.95}
                            fontWeight="bold"
                            fill={zone.subGroup === 'orange' ? '#FFFFFF' : '#0F172A'}
                          >
                            {displayLines[0]}
                          </text>
                        </g>
                        {/* Dòng 2: Dòng thứ hai căn giữa */}
                        <text
                          x={0}
                          y={fontSize + 3}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={fontSize * 0.9}
                          fontWeight="bold"
                          fill={zone.subGroup === 'orange' ? '#FFFFFF' : '#0F172A'}
                        >
                          {displayLines[1]}
                        </text>
                      </g>
                    ) : (
                      /* Trường hợp 1 dòng thông thường */
                      <g transform={`translate(${zone.x + zone.w / 2}, ${zone.y + (zone.h > 60 ? zone.h / 2 - 12 : zone.h / 2 - 8)})`}>
                        <circle
                          cx={-(Math.min(displayName.length, 12) * 3.2 + 8)}
                          cy={0}
                          r={dotRadius}
                          fill={dotColor}
                          stroke="#FFFFFF"
                          strokeWidth="1.2"
                        />
                        <text
                          x={-(Math.min(displayName.length, 12) * 3.2)}
                          y={0}
                          textAnchor="start"
                          dominantBaseline="central"
                          fontSize={fontSize}
                          fontWeight="bold"
                          fill={zone.subGroup === 'orange' ? '#FFFFFF' : '#0F172A'}
                        >
                          {displayName}
                        </text>
                      </g>
                    )}

                    {/* Dòng 2: Badge phần trăm cho 3 line giám sát, hoặc N/A cho ô chưa giám sát */}
                    {isConfigured && isLargeCell && liveScore != null ? (
                      <g transform={`translate(${zone.x + zone.w / 2}, ${zone.y + (isMultiLine ? zone.h / 2 + 18 : zone.h / 2 + 10)})`}>
                        <rect
                          x="-24"
                          y="-8"
                          width="48"
                          height="16"
                          rx="4"
                          fill="#FFFFFF"
                          fillOpacity="0.95"
                          stroke="#CBD5E1"
                          strokeWidth="0.5"
                        />
                        <text
                          x="0"
                          y="0"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                          fill={dotColor}
                        >
                          {viewMode === 'safety'
                            ? `${liveScore != null ? liveScore.toFixed(1) : '96.8'}%`
                            : liveLine?.operatingStatus === 'STOPPED'
                            ? 'STOP'
                            : liveStatus === 'CRITICAL'
                            ? 'CRIT'
                            : liveStatus === 'WARNING'
                            ? 'WARN'
                            : 'RUN'}
                        </text>
                      </g>
                    ) : (
                      <text
                        x={zone.x + zone.w / 2}
                        y={zone.y + (zone.h > 60 ? zone.h / 2 + 10 : zone.h / 2 + 8)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={8.5}
                        fontWeight="600"
                        fill={zone.subGroup === 'orange' ? '#FFEDD5' : '#64748B'}
                      >
                        {zone.id === 'OFFICE' ? '89.8%' : 'N/A'}
                      </text>
                    )}
                  </g>
                ) : isMediumCell ? (
                  /* ======================================================== */
                  /* B. KHU VỰC TRUNG BÌNH (梱包, 拡張, コマンド, KOUKI...)   */
                  /* ======================================================== */
                  <g className="pointer-events-none select-none">
                    <circle
                      cx={zone.x + 10}
                      cy={zone.y + (zone.h >= 35 ? zone.h / 2 - 6 : zone.h / 2)}
                      r={dotRadius}
                      fill={dotColor}
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />
                    <text
                      x={zone.x + 18}
                      y={zone.y + (zone.h >= 35 ? zone.h / 2 - 6 : zone.h / 2)}
                      textAnchor="start"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontWeight="600"
                      fill="#0F172A"
                      className="tracking-tight"
                    >
                      {displayName}
                    </text>
                    {zone.h >= 35 && (
                      <text
                        x={zone.x + zone.w / 2}
                        y={zone.y + zone.h / 2 + 8}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={7.5}
                        fontWeight="500"
                        fill="#64748B"
                      >
                        N/A
                      </text>
                    )}
                  </g>
                ) : (
                  /* ======================================================== */
                  /* C. KHU VỰC NHỎ (V-EGRV, WS1..7, VIC, OCV, SL1..7...)    */
                  /* ======================================================== */
                  <g className="pointer-events-none select-none">
                    <circle
                      cx={zone.x + 7}
                      cy={zone.y + zone.h / 2}
                      r={dotRadius}
                      fill={dotColor}
                      stroke="#FFFFFF"
                      strokeWidth="0.8"
                    />
                    <text
                      x={zone.x + 14}
                      y={zone.y + zone.h / 2}
                      textAnchor="start"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontWeight="600"
                      fill="#0F172A"
                      className="tracking-tight"
                    >
                      {displayName}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip khi rê chuột hiển thị thông tin đầy đủ và minh bạch */}
        {hoveredZone && (
          <div
            className="absolute bottom-4 left-4 z-20 p-3 rounded-xl border border-slate-200 dark:border-factory-border bg-white/95 dark:bg-factory-card/95 backdrop-blur shadow-lg text-xs pointer-events-none max-w-sm animate-in fade-in duration-100"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              <span
                className="w-2.5 h-2.5 rounded-full border border-white"
                style={{
                  backgroundColor:
                    viewMode === 'safety'
                      ? getHealthScoreColor(
                          hoveredZone.isConfiguredLine && hoveredZone.mappedLineId
                            ? lineDataMap.get(hoveredZone.mappedLineId)?.safetyScore ?? 96.8
                            : null
                        )
                      : getStatusDotColor(
                          hoveredZone.isConfiguredLine && hoveredZone.mappedLineId
                            ? lineDataMap.get(hoveredZone.mappedLineId)?.status ?? 'RUNNING'
                            : 'UNMONITORED'
                        ),
                }}
              />
              <span className="text-sm">{hoveredZone.name}</span>
              {hoveredZone.isConfiguredLine ? (
                <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-300">
                  Dây chuyền giám sát ({hoveredZone.mappedLineId})
                </span>
              ) : (
                <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                  Chưa kết nối IoT (N/A)
                </span>
              )}
            </div>

            {hoveredZone.subName && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-medium">
                {hoveredZone.subName}
              </p>
            )}

            {hoveredZone.isConfiguredLine && hoveredZone.mappedLineId ? (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Mức an toàn đo lường:</span>
                  <strong
                    className="font-mono font-bold"
                    style={{
                      color: getHealthScoreColor(lineDataMap.get(hoveredZone.mappedLineId)?.safetyScore ?? null),
                    }}
                  >
                    {lineDataMap.get(hoveredZone.mappedLineId)?.safetyScore != null
                      ? `${lineDataMap.get(hoveredZone.mappedLineId)!.safetyScore!.toFixed(1)}%`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Trạng thái vận hành:</span>
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {lineDataMap.get(hoveredZone.mappedLineId)?.operatingStatusLabel ?? 'Đang hoạt động'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Mức độ cảnh báo:</span>
                  <strong
                    className="font-mono font-bold"
                    style={{
                      color:
                        lineDataMap.get(hoveredZone.mappedLineId)?.status === 'CRITICAL'
                          ? '#DC2626'
                          : lineDataMap.get(hoveredZone.mappedLineId)?.status === 'WARNING'
                          ? '#EAB308'
                          : '#16A34A',
                    }}
                  >
                    {lineDataMap.get(hoveredZone.mappedLineId)?.alarmSeverityLabel ?? 'Bình thường'}
                  </strong>
                </div>
                <p className="text-[10px] text-blue-600 font-semibold mt-1">
                  &bull; Nhấn vào khu vực để mở Line Overview (Chi tiết dây chuyền)
                </p>
                <p className="text-[9px] text-slate-400 italic">
                  * Vị trí liên kết dự kiến trên bản đồ sơ bộ (Đang chờ nhà máy nghiệm thu vị trí thực tế).
                </p>
              </div>
            ) : (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-400">
                  Khu vực phụ trợ hoặc chưa lắp đặt cảm biến đo lường. Không có dữ liệu đo lường trực tiếp.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Chân bản đồ: Gợi ý tương tác & Thống kê khu vực */}
      <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-factory-card flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          <span>Kéo chuột để di chuyển (Pan) &bull; Dùng nút +/- để phóng to/thu nhỏ</span>
        </span>
        <span className="font-medium hidden sm:inline text-slate-400">
          Tổng số: 87 khu vực quy hoạch nhà máy
        </span>
      </div>
    </div>
  );
}
