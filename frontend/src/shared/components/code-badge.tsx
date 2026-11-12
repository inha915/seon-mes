import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/shared/ui/badge';
import { codeKey, codeTone, type CodeGroup } from '@/shared/codes';
import { cn } from '@/shared/lib/utils';

/** 고정 코드 → 번역 문구 배지 (색은 shared/codes.ts 의 tone) */
export function CodeBadge({ group, value, className }: { group: CodeGroup; value: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant={codeTone(group, value)} className={className} data-code={value}>
      {t(codeKey(group, value), { defaultValue: value })}
    </Badge>
  );
}

/** 코드 → 번역 문구 (배지 없이 텍스트로 쓸 때, 예: 단위) */
export function useCodeLabel(group: CodeGroup) {
  const { t } = useTranslation();
  return (value: string) => t(codeKey(group, value), { defaultValue: value });
}

/** 코드값 텍스트 (품번·LOT·문서번호 — 원문 그대로, 고정폭) */
export function CodeText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('code-text', className)}>{children}</span>;
}

/** 품번 + 품명 2줄 셀 */
export function ItemCell({ code, name }: { code: string; name: string }) {
  return (
    <div className="leading-tight">
      <div className="code-text">{code}</div>
      <div className="sub-text">{name}</div>
    </div>
  );
}

/** LOT 번호 → LOT 추적 화면 링크 */
export function LotLink({ lotNo, className }: { lotNo: string; className?: string }) {
  return (
    <Link to="/inventory/lot-trace" search={{ lotNo }} className={cn('code-link', className)}>
      {lotNo}
    </Link>
  );
}
