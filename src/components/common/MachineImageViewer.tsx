/**
 * @file MachineImageViewer.tsx
 * @description Component xem ảnh CAD thiết bị phóng to dạng Modal chuẩn DENSO KaiLink
 * - Hỗ trợ xem ảnh rõ nét với tỷ lệ gốc (object-contain)
 * - Tích hợp bộ điều khiển zoom (50% đến 300%, bước 25%)
 * - Cho phép kéo ảnh (pan) khi zoom > 100%
 * - Giao diện Modal chuẩn theo ảnh thiết kế tham chiếu
 * - Tự động đồng bộ nguồn ảnh CAD từ registry/thumbnail
 */

import { useState, useRef, useEffect, useMemo, MouseEvent } from 'react';
import { X, Plus, Minus, Image as ImageIcon } from 'lucide-react';
import { ModalPortal } from './ModalPortal';
import {
  MachineImage,
  MachineImageProps,
  getMachineImageConfig,
} from '../../config/machineImages';

export interface MachineImageViewerProps extends MachineImageProps {
  /** Tên thiết bị hiển thị ở modal header */
  name?: string;
  /** Mã thiết bị hiển thị ở modal header */
  code?: string;
}

export function MachineImageViewer({
  machineId,
  machineCode,
  imageUrl,
  alt,
  className = 'w-full h-full object-contain',
  containerClassName = '',
  fallbackIconClassName = 'w-10 h-10 text-emerald-600/70 dark:text-emerald-400/70',
  showFallbackLabel = false,
  name,
  code,
}: MachineImageViewerProps) {
  // -------------------------------------------------------------------------
  // 1. Trạng thái đóng/mở modal và điều khiển zoom/pan
  // -------------------------------------------------------------------------
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });

  // -------------------------------------------------------------------------
  // 2. Lấy thông tin registry và danh sách ảnh fallback đồng bộ với MachineImage
  // -------------------------------------------------------------------------
  const cfg = getMachineImageConfig(machineId) || getMachineImageConfig(machineCode);
  const displayName = name || cfg?.machineName || alt || 'Thiết bị công nghiệp';
  const displayCode = code || cfg?.machineCode || machineCode || machineId || 'MCH';
  const baseCode = cfg?.machineCode || machineCode || machineId || 'MCH';

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

  // Reset trạng thái zoom, pan và ảnh khi modal mở hoặc thiết bị thay đổi
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setSrcIndex(0);
      setHasError(false);
      setUserImgError(false);
    }
  }, [isOpen, machineId, machineCode, imageUrl]);

  // Tính toán đường dẫn ảnh cho modal (ưu tiên imageUrl -> thử từng extension theo candidates)
  const hasUserImage = Boolean(imageUrl && !userImgError);
  const currentModalSrc = hasUserImage
    ? (imageUrl as string)
    : candidateSources[srcIndex] || `/images/machines/${baseCode}.png`;

  const handleImageError = () => {
    if (hasUserImage) {
      setUserImgError(true);
      return;
    }
    if (srcIndex < candidateSources.length - 1) {
      setSrcIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  // -------------------------------------------------------------------------
  // 3. Xử lý điều khiển Zoom (50% đến 300%, bước 25%)
  // -------------------------------------------------------------------------
  const clampZoom = (val: number) => Math.min(300, Math.max(50, Math.round(val)));
  const handleZoomIn = () => setZoom((z) => clampZoom(z + 25));
  const handleZoomOut = () => setZoom((z) => clampZoom(z - 25));

  // -------------------------------------------------------------------------
  // 4. Xử lý kéo ảnh (Pan) khi zoom > 100%
  // -------------------------------------------------------------------------
  const handleMouseDown = (e: MouseEvent) => {
    if (zoom <= 100) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    startOffsetRef.current = { ...offset };
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || zoom <= 100) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: startOffsetRef.current.x + dx,
      y: startOffsetRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <>
      {/* ===================================================================== */}
      {/* THUMBNAIL TẠI TRANG CHI TIẾT: Click vào để mở Modal                   */}
      {/* ===================================================================== */}
      <div
        className="cursor-pointer group/thumb relative transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
        onClick={() => setIsOpen(true)}
        title="Nhấn để xem ảnh phóng to"
      >
        <MachineImage
          machineId={machineId}
          machineCode={machineCode}
          imageUrl={imageUrl}
          alt={alt || displayName}
          className={className}
          containerClassName={containerClassName}
          fallbackIconClassName={fallbackIconClassName}
          showFallbackLabel={showFallbackLabel}
        />
      </div>

      {/* ===================================================================== */}
      {/* MODAL XEM ẢNH PHÓNG TO: Giao diện bám sát ảnh tham chiếu             */}
      {/* ===================================================================== */}
      <ModalPortal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        backdropColor="bg-slate-950/60 dark:bg-black/75 backdrop-blur-[2px]"
      >
        <div
          className="relative bg-white dark:bg-[#1a2332] rounded-[22px] max-w-[940px] w-full mx-auto shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER MODAL */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Icon hình ảnh vuông bo tròn với nền xanh nhạt */}
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/15">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  {displayName}
                </h2>
                <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 block mt-0.5">
                  {displayCode}
                </span>
              </div>
            </div>

            {/* Nút đóng X lớn với nền tròn nhạt */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* BODY: KHU VỰC HIỂN THỊ ẢNH LỚN CHÍNH GIỮA */}
          <div className="px-6 py-2 flex-1">
            <div
              className="relative w-full h-[62vh] min-h-[380px] max-h-[580px] bg-slate-50/60 dark:bg-[#131b26] rounded-2xl border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-center overflow-hidden select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor: zoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {!hasError ? (
                <img
                  src={currentModalSrc}
                  alt={displayName}
                  onError={handleImageError}
                  draggable={false}
                  className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-150 ease-out"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom / 100})`,
                    transformOrigin: 'center center',
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    {displayCode} &bull; Hình ảnh thiết bị đang được cập nhật
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* FOOTER: THANH ĐIỀU KHIỂN ZOOM [ - ] 100% [ + ] */}
          <div className="flex items-center justify-center pb-5 pt-2">
            <div className="inline-flex items-center gap-4 bg-slate-100/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white shadow-xs flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Thu nhỏ"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="font-mono font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 min-w-[48px] text-center select-none">
                {zoom}%
              </span>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 300}
                className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white shadow-xs flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Phóng to"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </>
  );
}
