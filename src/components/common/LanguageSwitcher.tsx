/**
 * @file LanguageSwitcher.tsx
 * @description Nút chọn ngôn ngữ VI / EN / 日本語 (ghi nhớ lựa chọn trong trình duyệt).
 */
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../../i18n';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'vi') as AppLanguage;

  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      className="flex items-center rounded-lg border border-factory-border bg-slate-100 dark:bg-factory-surface p-0.5 gap-0.5 select-none"
    >
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            aria-pressed={active}
            onClick={() => i18n.changeLanguage(lng)}
            className={[
              'rounded-md font-semibold transition-colors cursor-pointer leading-none',
              compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]',
              active
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            ].join(' ')}
          >
            {t(`lang.${lng}`)}
          </button>
        );
      })}
    </div>
  );
}
