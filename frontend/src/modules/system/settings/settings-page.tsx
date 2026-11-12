import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert, QueryBoundary } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { useCurrentUser } from '@/shared/hooks/use-current-user';
import { cn } from '@/shared/lib/utils';
import { AdminOnlyNotice } from '../users/users-page';
import { useSettings, useUpdateSettings } from './api';

export function SettingsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useCurrentUser();
  const query = useSettings();
  const mutation = useUpdateSettings();

  return (
    <Screen title={t('settings.title')} description={t('settings.description')}>
      {!isAdmin && <AdminOnlyNotice />}
      <Panel title={t('settings.productionGroup')} icon={<Settings2 />} className="max-w-3xl">
        <QueryBoundary query={query}>
          {(s) => (
            <div className="space-y-3">
              <SettingRow
                label={t('settings.productionApprovalRequired')}
                description={t('settings.productionApprovalRequiredHelp')}
                checked={s.productionApprovalRequired}
                disabled={!isAdmin || mutation.isPending}
                onChange={(v) =>
                  mutation.mutate({ productionApprovalRequired: v }, { onSuccess: () => toast.success(t('toast.settingsSaved')) })
                }
                testId="setting-approval"
              />
              <FormErrorAlert error={mutation.error} />
            </div>
          )}
        </QueryBoundary>
      </Panel>
    </Screen>
  );
}

function SettingRow({
  label,
  description,
  checked,
  disabled,
  onChange,
  testId,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-md border px-4 py-3">
      <div>
        <div className="text-[13.5px] font-semibold">{label}</div>
        <p className="sub-text mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-5.5' : 'left-0.5')} />
      </button>
    </div>
  );
}
