/**
 * @file useUiStore.ts
 * @description Trạng thái giao diện dùng chung: menu trượt (drawer) trên điện thoại / máy tính bảng.
 */
import { create } from 'zustand';
import { useEffect, useState } from 'react';

interface UiState {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));

/** true khi màn hình ≥ 1024px (Tailwind `lg`): menu cố định bên trái; nhỏ hơn thì menu dạng trượt. */
export function useIsDesktop(): boolean {
  const query = '(min-width: 1024px)';
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}
