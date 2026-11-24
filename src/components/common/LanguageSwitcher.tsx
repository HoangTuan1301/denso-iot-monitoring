/**
 * @file LanguageSwitcher.tsx
 * @description Nút chọn ngôn ngữ dạng menu thả xuống có cờ (VI / EN / 日本語),
 *              ghi nhớ lựa chọn trong trình duyệt.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../../i18n';
import { useMonitoringStore, NAV_RESTORE_KEY } from '../../stores/useMonitoringStore';

/** Tên ngôn ngữ luôn viết bằng chính ngôn ngữ đó để ai cũng nhận ra. */
const NATIVE_NAME: Record<AppLanguage, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
};

/**
 * Đổi ngôn ngữ: lưu lựa chọn + vị trí màn hình hiện tại rồi tải lại trang,
 * để mọi chuỗi (kể cả dữ liệu mô phỏng khai báo sẵn) được dịch đồng bộ.
 */
function switchLanguage(lng: AppLanguage, change: (l: string) => unknown) {
  try {
    const st = useMonitoringStore.getState();
    sessionStorage.setItem(
      NAV_RESTORE_KEY,
      JSON.stringify({
        selectedLineId: st.selectedLineId,
        selectedMachineId: st.selectedMachineId,
        dashboardViewLevel: st.dashboardViewLevel,
        activeTab: st.activeTab,
        activeNavGroup: st.activeNavGroup,
      }),
    );
  } catch {
    /* bỏ qua */
  }
  Promise.resolve(change(lng)).finally(() => window.location.reload());
}

/** Cờ tròn vẽ bằng SVG (cờ emoji không hiển thị trên Windows). */
export function FlagIcon({ lang, size = 22 }: { lang: AppLanguage; size?: number }) {
  const id = `flag-clip-${lang}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 rounded-full shadow-sm ring-1 ring-black/10">
      <defs>
        <clipPath id={id}>
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {lang === 'vi' && (
          <>
            <rect width="32" height="32" fill="#DA251D" />
            <polygon
              fill="#FFFF00"
              points="16,7.2 18.1,13.6 24.8,13.6 19.4,17.6 21.4,24 16,20.1 10.6,24 12.6,17.6 7.2,13.6 13.9,13.6"
            />
          </>
        )}
        {lang === 'ja' && (
          <>
            <rect width="32" height="32" fill="#FFFFFF" />
            <circle cx="16" cy="16" r="7.2" fill="#BC002D" />
          </>
        )}
        {lang === 'en' && (
          <>
            <rect width="32" height="32" fill="#012169" />
            <path d="M0 0 L32 32 M32 0 L0 32" stroke="#FFFFFF" strokeWidth="6.4" />
            <path d="M0 0 L32 32 M32 0 L0 32" stroke="#C8102E" strokeWidth="2.2" />
            <path d="M16 0 V32 M0 16 H32" stroke="#FFFFFF" strokeWidth="10" />
            <path d="M16 0 V32 M0 16 H32" stroke="#C8102E" strokeWidth="6" />
          </>
        )}
      </g>
    </svg>
  );
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'vi') as AppLanguage;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0 select-none">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('lang.label')}: ${NATIVE_NAME[current]}`}
        title={t('lang.label')}
        onClick={() => setOpen((o) => !o)}
        className={[
          'flex items-center gap-1.5 rounded-xl border transition-colors cursor-pointer',
          compact ? 'h-8 px-1.5' : 'h-9 px-2',
          open
            ? 'border-emerald-500/70 bg-emerald-500/10 ring-2 ring-emerald-500/20'
            : 'border-slate-200 bg-slate-100 hover:border-emerald-500/50 dark:border-factory-border dark:bg-factory-surface',
        ].join(' ')}
      >
        <FlagIcon lang={current} size={compact ? 20 : 22} />
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('lang.label')}
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {SUPPORTED_LANGUAGES.map((lng) => {
            const active = current === lng;
            return (
              <li key={lng} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!active) switchLanguage(lng, (l) => i18n.changeLanguage(l));
                  }}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer',
                    active
                      ? 'bg-emerald-50 text-slate-900 dark:bg-emerald-500/15 dark:text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <FlagIcon lang={lng} size={24} />
                  <span className="flex-1">{NATIVE_NAME[lng]}</span>
                  {active && <Check className="h-4 w-4 text-emerald-500" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
