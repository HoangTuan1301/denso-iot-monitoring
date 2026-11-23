/**
 * @file i18n/index.ts
 * @description Khung đa ngôn ngữ (Tiếng Việt / English / 日本語) dùng i18next + react-i18next.
 * - Ngôn ngữ được ghi nhớ trong localStorage và đặt vào <html lang>.
 * - Thêm chuỗi mới: khai báo cùng một key trong cả 3 file locales/*.json, rồi dùng t('nhom.key').
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './locales/vi.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

export const SUPPORTED_LANGUAGES = ['vi', 'en', 'ja'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'denso_iot_lang';

function readSavedLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) return saved as AppLanguage;
  } catch {
    /* localStorage có thể bị chặn */
  }
  return 'vi';
}

/** Mã locale cho Intl (định dạng số, ngày giờ) theo ngôn ngữ đang chọn. */
export const INTL_LOCALE: Record<AppLanguage, string> = { vi: 'vi-VN', en: 'en-US', ja: 'ja-JP' };

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en }, ja: { translation: ja } },
  lng: readSavedLanguage(),
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  returnNull: false,
});

const applyHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
applyHtmlLang(i18n.language);

i18n.on('languageChanged', (lng) => {
  applyHtmlLang(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* bỏ qua */
  }
});

export default i18n;
