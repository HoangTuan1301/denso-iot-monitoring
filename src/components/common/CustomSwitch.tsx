/**
 * @file CustomSwitch.tsx
 * @description Component Công tắc gạt (Switch / Toggle) tùy chỉnh chuẩn 100% Tailwind CSS
 * Dạng viên thuốc bo tròn mềm mại (rounded-full), trượt mượt mà,
 * TUYỆT ĐỐI không dùng thẻ input checkbox mặc định, ngăn chặn hoàn toàn lỗi vỡ layout hoặc hiện ô vuông thô.
 * Tương thích hoàn hảo Dark Mode & Light Mode.
 */

import React, { useState } from 'react';

export interface CustomSwitchProps {
  /**
   * Trạng thái bật/tắt (controlled)
   */
  isSelected?: boolean;
  checked?: boolean;

  /**
   * Trạng thái mặc định ban đầu (uncontrolled)
   */
  defaultSelected?: boolean;
  defaultChecked?: boolean;

  /**
   * Callback khi chuyển trạng thái
   */
  onValueChange?: (isSelected: boolean) => void;
  onChange?: (isSelected: boolean) => void;

  /**
   * Kích thước công tắc
   * @default 'sm'
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Tông màu khi Bật (Mặc định: Xanh lá cây tươi Emerald)
   * @default 'success'
   */
  color?: 'success' | 'primary' | 'danger';

  /**
   * Vô hiệu hóa thao tác
   */
  disabled?: boolean;
  isDisabled?: boolean;

  /**
   * Nhãn text đi kèm (tùy chọn)
   */
  label?: string;

  /**
   * Vị trí nhãn text
   * @default 'right'
   */
  labelPlacement?: 'left' | 'right';

  /**
   * Thuộc tính hỗ trợ tiếp cận
   */
  'aria-label'?: string;

  /**
   * Class tùy biến thêm cho container
   */
  className?: string;

  /**
   * Ngăn chặn nổi bọt sự kiện click lên thẻ cha (Card/Row)
   * @default true
   */
  stopPropagation?: boolean;
}

export const CustomSwitch: React.FC<CustomSwitchProps> = ({
  isSelected,
  checked,
  defaultSelected = false,
  defaultChecked,
  onValueChange,
  onChange,
  size = 'sm',
  color = 'success',
  disabled = false,
  isDisabled = false,
  label,
  labelPlacement = 'right',
  'aria-label': ariaLabel,
  className = '',
  stopPropagation = true,
}) => {
  const isBlocked = disabled || isDisabled;

  // Xác định trạng thái controlled hay uncontrolled
  const isControlled = isSelected !== undefined || checked !== undefined;
  const initialValue = isControlled
    ? Boolean(isSelected ?? checked)
    : Boolean(defaultSelected || defaultChecked);

  const [internalState, setInternalState] = useState<boolean>(initialValue);
  const activeValue = isControlled ? Boolean(isSelected ?? checked) : internalState;

  const handleToggle = (e?: React.MouseEvent) => {
    if (stopPropagation && e) {
      e.stopPropagation();
    }
    if (isBlocked) return;
    const nextVal = !activeValue;
    if (!isControlled) {
      setInternalState(nextVal);
    }
    onValueChange?.(nextVal);
    onChange?.(nextVal);
  };

  // Cấu hình kích thước Track (viên thuốc) và Thumb (nút trượt tròn trắng)
  const sizeStyles = {
    sm: {
      track: 'w-10 h-5 p-0.5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-5',
    },
    md: {
      track: 'w-12 h-6 p-0.5',
      thumb: 'w-5 h-5',
      translate: 'translate-x-6',
    },
    lg: {
      track: 'w-14 h-7.5 p-1',
      thumb: 'w-5.5 h-5.5',
      translate: 'translate-x-6.5',
    },
  }[size];

  // Màu nền khi BẬT (ON): Xanh lá tươi rực rỡ
  const activeBgColor = {
    success: 'bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-xs shadow-emerald-500/20',
    primary: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 shadow-xs shadow-blue-500/20',
    danger: 'bg-rose-500 hover:bg-rose-600 dark:bg-rose-500 shadow-xs shadow-rose-500/20',
  }[color];

  // Màu nền khi TẮT (OFF): Màu xám slate trung tính, rõ nét trên cả Dark & Light Mode
  const inactiveBgColor = 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600/80';

  const switchElement = (
    <button
      type="button"
      role="switch"
      aria-checked={activeValue}
      aria-label={ariaLabel || label || 'Công tắc gạt'}
      disabled={isBlocked}
      onClick={handleToggle}
      className={[
        // Cấu trúc viên thuốc bo tròn mềm mại chuẩn Tailwind
        'appearance-none relative inline-flex shrink-0 cursor-pointer rounded-full items-center',
        sizeStyles.track,
        // Hiệu ứng chuyển trạng thái mượt mà
        'transition-all duration-200 ease-in-out select-none',
        activeValue ? activeBgColor : inactiveBgColor,
        // Focus ring hỗ trợ bàn phím
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
        isBlocked ? 'opacity-50 cursor-not-allowed' : 'active:scale-95',
        className,
      ].join(' ')}
    >
      {/* Nút tròn màu trắng (Thumb) trượt dứt khoát sang phải khi ON, về trái khi OFF */}
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0',
          sizeStyles.thumb,
          'transform transition-transform duration-200 ease-in-out',
          activeValue ? sizeStyles.translate : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );

  if (!label) {
    return switchElement;
  }

  return (
    <label
      onClick={handleToggle}
      className={[
        'inline-flex items-center gap-2 cursor-pointer select-none',
        isBlocked ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {labelPlacement === 'left' && (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
      )}
      {switchElement}
      {labelPlacement === 'right' && (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
      )}
    </label>
  );
};

export default CustomSwitch;
