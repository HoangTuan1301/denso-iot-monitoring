/**
 * @file ThemeToggle.tsx
 * @description Nút bấm chuyển đổi nhanh giao diện Sáng / Tối (Light / Dark Mode)
 */

import { Button, Tooltip } from '@heroui/react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <Tooltip
      content={isDark ? 'Chuyển sang Giao diện Sáng (Light)' : 'Chuyển sang Giao diện Tối (Dark)'}
      placement="bottom"
    >
      <Button
        isIconOnly
        size="sm"
        variant="flat"
        className="text-gray-400 hover:text-white transition-transform active:scale-95"
        onPress={toggleTheme}
        aria-label="Toggle theme mode"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
        ) : (
          <Moon className="w-4 h-4 text-blue-500 hover:-rotate-12 transition-transform" />
        )}
      </Button>
    </Tooltip>
  );
}
