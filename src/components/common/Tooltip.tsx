/**
 * @file Tooltip.tsx
 * @description Thành phần Tooltip chuẩn công nghiệp cho DENSO IoT System (KaiLink)
 * - Sử dụng React Portal kết xuất trực tiếp vào document.body, chống hoàn toàn hiện tượng
 *   bị cắt bởi overflow: hidden, overflow-x: auto (bảng thiết bị) hoặc stacking context.
 * - Tự động tính toán vị trí fixed theo getBoundingClientRect() của phần tử kích hoạt.
 * - Tự động lật (flip) và kẹp vị trí (clamping) trong phạm vi màn hình, đặc biệt ở cạnh phải
 *   bảng thiết bị và cột hành động.
 * - Hỗ trợ hover chuột, bàn phím focus, phím Escape, cuộn trang tự ẩn hoặc tái định vị.
 * - Tương thích hoàn hảo Dark Mode & Light Mode với đổ bóng, bo góc, padding nhỏ gọn.
 */

import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  ReactNode,
  ReactElement,
  cloneElement,
} from 'react';
import { createPortal } from 'react-dom';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  placement?: TooltipPlacement;
  delay?: number;
  offset?: number;
  isDisabled?: boolean;
  className?: string;
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 150,
  offset = 8,
  isDisabled = false,
  className = '',
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; actualPlacement: TooltipPlacement }>({
    top: 0,
    left: 0,
    actualPlacement: placement,
  });

  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Tính toán vị trí fixed trong viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const screenPadding = 8;
    const gap = offset;

    let top = 0;
    let left = 0;
    let currentPlacement = placement;

    // 1. Tính toán vị trí cơ sở theo placement mong muốn
    if (placement === 'top') {
      top = triggerRect.top - tooltipRect.height - gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

      // Auto-flip xuống bottom nếu tràn đỉnh màn hình
      if (top < screenPadding) {
        top = triggerRect.bottom + gap;
        currentPlacement = 'bottom';
      }
    } else if (placement === 'bottom') {
      top = triggerRect.bottom + gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

      // Auto-flip lên top nếu tràn đáy màn hình
      if (top + tooltipRect.height > window.innerHeight - screenPadding) {
        top = triggerRect.top - tooltipRect.height - gap;
        currentPlacement = 'top';
      }
    } else if (placement === 'right') {
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.right + gap;

      // Auto-flip sang left nếu tràn cạnh phải màn hình
      if (left + tooltipRect.width > window.innerWidth - screenPadding) {
        left = triggerRect.left - tooltipRect.width - gap;
        currentPlacement = 'left';
      }
    } else if (placement === 'left') {
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.left - tooltipRect.width - gap;

      // Auto-flip sang right nếu tràn cạnh trái màn hình
      if (left < screenPadding) {
        left = triggerRect.right + gap;
        currentPlacement = 'right';
      }
    }

    // 2. Kẹp vị trí ngang (Horizontal Clamping): ngăn tuyệt đối tràn ra ngoài cạnh phải / trái
    if (left + tooltipRect.width > window.innerWidth - screenPadding) {
      left = window.innerWidth - tooltipRect.width - screenPadding;
    }
    if (left < screenPadding) {
      left = screenPadding;
    }

    // 3. Kẹp vị trí dọc (Vertical Clamping)
    if (top + tooltipRect.height > window.innerHeight - screenPadding) {
      top = window.innerHeight - tooltipRect.height - screenPadding;
    }
    if (top < screenPadding) {
      top = screenPadding;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      actualPlacement: currentPlacement,
    });
    setIsPositioned(true);
  }, [offset, placement]);

  const handleShow = useCallback(() => {
    if (isDisabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delay);
  }, [content, delay, isDisabled]);

  const handleHide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(false);
    setIsPositioned(false);
  }, []);

  // Đóng tooltip khi nhấn phím Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleHide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleHide]);

  // Cập nhật vị trí đồng bộ trước khi browser paint
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updatePosition]);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Xử lý ref kết hợp của child trigger
  const setTriggerElement = (node: HTMLElement | null) => {
    triggerRef.current = node;
    const childRef = (children as any).ref;
    if (typeof childRef === 'function') {
      childRef(node);
    } else if (childRef && typeof childRef === 'object') {
      childRef.current = node;
    }
  };

  // Tránh xung đột với native title của trình duyệt
  const triggerProps: Record<string, any> = {
    ref: setTriggerElement,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      children.props.onMouseEnter?.(e);
      handleShow();
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      children.props.onMouseLeave?.(e);
      handleHide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(e);
      handleShow();
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(e);
      handleHide();
    },
  };

  // Nếu child có title, loại bỏ để tránh xung đột tooltip kép của browser
  const clonedChild = cloneElement(children, {
    ...triggerProps,
    title: undefined,
  });

  const portalContent =
    isOpen && content && !isDisabled && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              pointerEvents: 'none',
              zIndex: 99999,
              opacity: isPositioned ? 1 : 0,
              transform: isPositioned ? 'scale(1)' : 'scale(0.96)',
              transition: 'opacity 120ms ease-out, transform 120ms ease-out',
            }}
            className={[
              // Box model & Layout
              'px-2.5 py-1.5 rounded-lg text-center select-none shadow-xl',
              // Typography
              'text-[11px] font-medium tracking-wide whitespace-nowrap leading-none',
              // Dark Mode & Light Mode
              'bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 border border-slate-700/80 dark:border-slate-800 shadow-slate-950/40',
              // Hiệu ứng mờ nền nhẹ
              'backdrop-blur-[2px]',
              className,
            ].join(' ')}
          >
            {content}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {clonedChild}
      {portalContent}
    </>
  );
}
