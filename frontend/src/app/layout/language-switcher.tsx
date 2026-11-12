import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '@/i18n';

/**
 * 한국어 / English 전환. i18n.changeLanguage 만 호출하므로 라우트와 폼 상태는 그대로 유지되고,
 * 선택한 언어는 i18n 초기화 코드에서 localStorage 에 저장됩니다.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? SUPPORTED_LANGUAGES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('language.label')} data-testid="language-switcher">
          <Languages />
          {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current.code} onValueChange={(code) => void i18n.changeLanguage(code)}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <DropdownMenuRadioItem key={lang.code} value={lang.code} data-testid={`language-${lang.code}`}>
              {lang.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
