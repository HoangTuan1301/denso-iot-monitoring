/**
 * @file ModalPortal.tsx
 * @description Thành phần Modal Portal & Backdrop dùng chung chuẩn DENSO Industrial IoT (KaiLink)
 * - Kết xuất (render) trực tiếp vào document.body bằng React Portal (createPortal)
 * - Lớp phủ (backdrop) phủ kín 100% viewport (w-screen, h-screen, fixed inset-0), bao trùm cả Header và Sidebar
 * - Thứ tự z-index cấp cao (z-[9999]) đảm bảo nổi lên trên Header (z-20), Sidebar (z-30)
 * - Tự động khóa cuộn trang (body scroll lock) khi modal mở và phục hồi an toàn khi modal đóng
 * - Chống layout shift khi khóa cuộn bằng cách bù trừ độ rộng scrollbar
 * - Hỗ trợ đóng khi click backdrop (có thể bật/tắt) và phím Escape
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Biến đếm số lượng modal đang mở toàn cục để kiểm soát body scroll lock an toàn
let globalOpenModalCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';

export interface ModalPortalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  backdropColor?: string;
  zIndex?: string;
}

export function ModalPortal({
  isOpen,
  onClose,
  children,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = '',
  backdropColor = 'bg-slate-950/75 dark:bg-black/80 backdrop-blur-[3px]',
  zIndex = 'z-[9999]',
}: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Khóa cuộn trang (Body Scroll Lock) an toàn đa modal
  useEffect(() => {
    if (!isOpen) return;

    if (globalOpenModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousBodyPaddingRight = document.body.style.paddingRight;

      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
    }
    globalOpenModalCount++;

    return () => {
      globalOpenModalCount = Math.max(0, globalOpenModalCount - 1);
      if (globalOpenModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow || '';
        document.body.style.paddingRight = previousBodyPaddingRight || '';
      }
    };
  }, [isOpen]);

  // Đóng khi nhấn phím Escape
  useEffect(() => {
    if (!isOpen || !closeOnEscape || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen || !mounted || typeof document === 'undefined') {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropClick && onClose) {
      onClose();
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 w-screen h-screen ${zIndex} flex items-center justify-center p-4 sm:p-6 overflow-y-auto ${backdropColor} ${className}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>,
    document.body
  );
}
