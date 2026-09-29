/**
 * @file useThemeStore.ts
 * @description Quản lý trạng thái giao diện Sáng / Tối (Light / Dark Mode) có đồng bộ vào localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark', // Mặc định là Dark Mode công nghiệp
      toggleTheme: () => {
        const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeClass(nextTheme);
        set({ theme: nextTheme });
      },
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
    }),
    {
      name: 'denso-iot-theme-mode',
    }
  )
);

/**
 * Áp dụng class 'dark' hoặc 'light' lên thẻ <html> và <body>
 */
export function applyThemeClass(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}
