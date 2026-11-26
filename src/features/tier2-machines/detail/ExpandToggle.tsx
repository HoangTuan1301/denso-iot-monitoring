/**
 * @file ExpandToggle.tsx
 * @description Nút mũi tên mở rộng / thu gọn ở góc tiêu đề các ô trong Chi tiết máy
 * (mặc định thu gọn — bấm ▾ mới hiện nội dung, bấm ▴ để ẩn lại).
 */
import { ChevronDown } from 'lucide-react';
import { tr } from '../../../i18n/tr';

export function ExpandToggle({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      title={open ? tr('Thu gọn') : tr('Mở rộng')}
      className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-lg border border-slate-200 dark:border-factory-border bg-white dark:bg-factory-surface text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
    >
      {open ? tr('Thu gọn') : tr('Mở rộng')}
      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}
