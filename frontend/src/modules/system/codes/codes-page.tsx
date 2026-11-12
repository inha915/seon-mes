import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeBadge, CodeText } from '@/shared/components/code-badge';
import { DataGrid } from '@/shared/components/data-grid';
import { Panel } from '@/shared/components/panel';
import { Screen } from '@/shared/components/screen';
import { CODE_GROUPS, codeKey, codeValues, type CodeGroup } from '@/shared/codes';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { cn } from '@/shared/lib/utils';
import i18n from '@/i18n';

const GROUPS = Object.keys(CODE_GROUPS) as CodeGroup[];

/**
 * 공통코드 조회 — shared/codes.ts 레지스트리와 번역 리소스를 그대로 보여줍니다.
 * DB·API 는 고정 코드만 다루고, 화면 문구는 언어별 번역 파일에서 관리한다는 설계를 확인할 수 있습니다.
 */
export function CodesPage() {
  const { t } = useTranslation();
  const [group, setGroup] = useState<CodeGroup>(GROUPS[0]!);
  const rows = codeValues(group).map((code) => ({ code }));

  return (
    <Screen title={t('codesPage.title')} description={t('codesPage.description')}>
      <div className="grid grid-cols-[260px_minmax(0,1fr)] items-start gap-4">
        <Panel title={t('codesPage.groups')} bodyClassName="p-1.5">
          <ul>
            {GROUPS.map((g) => (
              <li key={g}>
                <button
                  type="button"
                  onClick={() => setGroup(g)}
                  className={cn(
                    'flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-grid-row-hover',
                    g === group && 'bg-grid-row-selected font-semibold',
                  )}
                >
                  <span>{t(`codes.${g}._name`)}</span>
                  <CodeText className="text-muted-foreground">{g}</CodeText>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`${t(`codes.${group}._name`)} (${group})`} bodyClassName="p-0">
          <DataGrid
            columns={[
              { key: 'code', header: t('codesPage.code'), cell: (r) => <CodeText className="font-semibold">{r.code}</CodeText> },
              { key: 'badge', header: t('codesPage.display'), cell: (r) => <CodeBadge group={group} value={r.code} /> },
              ...SUPPORTED_LANGUAGES.map((lang) => ({
                key: lang.code,
                header: `${t('codesPage.label')} (${lang.label})`,
                cell: (r: { code: string }) => i18n.getFixedT(lang.code)(codeKey(group, r.code)),
              })),
              { key: 'key', header: t('codesPage.i18nKey'), cell: (r) => <CodeText className="text-muted-foreground">{codeKey(group, r.code)}</CodeText> },
            ]}
            rows={rows}
            rowKey={(r) => r.code}
          />
        </Panel>
      </div>
    </Screen>
  );
}
