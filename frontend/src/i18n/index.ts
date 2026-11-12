import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ko from './locales/ko.json';

/**
 * 지원 언어 목록. 새 언어를 추가할 때는
 *  1) locales/<code>.json 을 ko.json 과 같은 키 구조로 추가하고
 *  2) 아래 SUPPORTED_LANGUAGES 와 resources 에 등록한 뒤
 *  3) npm run i18n:check 로 키 누락을 확인합니다.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'ko', label: '한국어', locale: 'ko-KR' },
  { code: 'en', label: 'English', locale: 'en-US' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'ko';
export const LANGUAGE_STORAGE_KEY = 'seon-mes.language';

export const resources = {
  ko: { translation: ko },
  en: { translation: en },
} as const;

export function localeOf(language: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === language)?.locale ?? 'ko-KR';
}

function readStoredLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored as LanguageCode;
  } catch {
    /* localStorage 를 쓸 수 없는 환경이면 기본 언어 */
  }
  return DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  interpolation: { escapeValue: false },
  returnNull: false,
});

// 언어가 바뀌면 저장하고 <html lang> 을 맞춥니다. (화면/입력값은 리마운트 없이 유지됩니다)
const syncLanguage = (lng: string) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* 무시 */
  }
};
syncLanguage(i18n.language);
i18n.on('languageChanged', syncLanguage);

export default i18n;
