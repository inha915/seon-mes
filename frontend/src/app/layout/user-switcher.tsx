import { ChevronDown, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { CodeBadge } from '@/shared/components/code-badge';
import { useCurrentUser } from '@/shared/hooks/use-current-user';

/**
 * 사용자 전환 (데모용). 로그인 기능은 범위에서 제외했으며,
 * 결재 승인처럼 역할이 필요한 기능을 시연하기 위해 헤더에서 사용자를 바꿉니다.
 */
export function UserSwitcher() {
  const { t } = useTranslation();
  const { user, users, switchUser } = useCurrentUser();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('user.switch')} data-testid="user-switcher">
          <UserRound />
          {user ? (
            <>
              {user.name}
              <span className="text-muted-foreground">· {user.department}</span>
            </>
          ) : (
            t('common.loading')
          )}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <div className="px-2 py-1 text-[11.5px] text-muted-foreground">{t('user.demoNotice')}</div>
        <DropdownMenuRadioGroup value={user ? String(user.id) : undefined} onValueChange={(v) => switchUser(Number(v))}>
          {users.map((u) => (
            <DropdownMenuRadioItem key={u.id} value={String(u.id)} data-testid={`user-${u.employeeNo}`}>
              <span className="flex-1">
                {u.name} <span className="text-muted-foreground">· {u.department}</span>
              </span>
              <CodeBadge group="userRole" value={u.role} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
