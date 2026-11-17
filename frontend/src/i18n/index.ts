import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ko from './locales/ko.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'ko', label: '한국어', locale: 'ko-KR' },
  { code: 'en', label: 'English', locale: 'en-US' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'ko'
export const LANGUAGE_STORAGE_KEY = 'seon-mes.language'

export const resources = {
  ko: { translation: ko },
  en: { translation: en },
} as const

export function localeOf(language: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === language)?.locale ?? 'ko-KR'
}

function readStoredLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored))
      return stored as LanguageCode
  } catch {
    /* localStorage 를 쓸 수 없는 환경이면 기본 언어 */
  }
  return DEFAULT_LANGUAGE
}

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  interpolation: { escapeValue: false },
  returnNull: false,
})

// 언어 변경 시 저장 + html lang 갱신
const syncLanguage = (lng: string) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  } catch {
    /* 무시 */
  }
}
syncLanguage(i18n.language)
i18n.on('languageChanged', syncLanguage)

export default i18n
