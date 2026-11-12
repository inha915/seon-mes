import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeBadge, CodeText } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { FormField, FormGrid } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { SearchField, SearchPanel } from '@/shared/components/search-panel';
import { codeKey, codeValues } from '@/shared/codes';
import { useCurrentUser } from '@/shared/hooks/use-current-user';
import { codeText, requiredText } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import type { UserRole } from '@/shared/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import type { User } from '../types';
import { useCreateUser, useUpdateUser, useUsers } from './api';

const PAGE_SIZE = 15;

export function UsersPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { isAdmin } = useCurrentUser();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const query = useUsers({ q: q || undefined, page, pageSize: PAGE_SIZE });
  const update = useUpdateUser();

  const columns: GridColumn<User>[] = [
    { key: 'no', header: t('fields.employeeNo'), cell: (u) => <CodeText>{u.employeeNo}</CodeText> },
    { key: 'name', header: t('fields.userName'), cell: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'dept', header: t('fields.department'), cell: (u) => u.department },
    {
      key: 'role',
      header: t('fields.role'),
      cell: (u) =>
        isAdmin ? (
          <NativeSelect
            className="w-28"
            aria-label={`${t('fields.role')} ${u.name}`}
            value={u.role}
            onChange={(e) => update.mutate({ id: u.id, role: e.target.value as UserRole }, { onSuccess: () => toast.success(t('toast.userUpdated', { name: u.name })) })}
          >
            {codeValues('userRole').map((r) => (
              <option key={r} value={r}>
                {t(codeKey('userRole', r))}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <CodeBadge group="userRole" value={u.role} />
        ),
    },
    {
      key: 'active',
      header: t('fields.active'),
      cell: (u) =>
        isAdmin ? (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={u.active}
              onChange={(e) => update.mutate({ id: u.id, active: e.target.checked }, { onSuccess: () => toast.success(t('toast.userUpdated', { name: u.name })) })}
            />
            {u.active ? t('common.yes') : t('common.no')}
          </label>
        ) : (
          <Badge variant={u.active ? 'success' : 'secondary'}>{u.active ? t('common.yes') : t('common.no')}</Badge>
        ),
    },
    { key: 'created', header: t('common.createdAt'), cell: (u) => <span className="text-muted-foreground">{fmt.dateTime(u.createdAt)}</span> },
  ];

  return (
    <Screen
      title={t('users.title')}
      description={t('users.description')}
      actions={
        <Button onClick={() => setOpen(true)} disabled={!isAdmin}>
          <Plus /> {t('users.create')}
        </Button>
      }
    >
      {!isAdmin && <AdminOnlyNotice />}
      <Panel bodyClassName="p-0">
        <SearchPanel
          onSearch={() => {
            setPage(1);
            setQ(draft.trim());
          }}
          onReset={() => {
            setDraft('');
            setQ('');
            setPage(1);
          }}
        >
          <SearchField label={t('common.keyword')}>
            <Input className="w-64" placeholder={t('users.searchPlaceholder')} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </SearchField>
        </SearchPanel>
        <FormErrorAlert error={update.error} />
        <DataGrid
          columns={columns}
          rows={query.data?.items}
          rowKey={(u) => u.id}
          query={query}
          pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
        />
      </Panel>
      <UserDialog open={open} onOpenChange={setOpen} />
    </Screen>
  );
}

export function AdminOnlyNotice() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[13px] text-warning-foreground">
      <ShieldAlert className="size-4" /> {t('system.adminOnly')}
    </div>
  );
}

const schema = z.object({
  employeeNo: codeText(),
  name: requiredText(50),
  department: requiredText(50),
  role: z.enum(['OPERATOR', 'MANAGER', 'ADMIN']),
});
type Form = z.input<typeof schema>;

function UserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const mutation = useCreateUser();
  const form = useForm<Form, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { employeeNo: '', name: '', department: '', role: 'OPERATOR' },
  });
  const { errors } = form.formState;
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      form.reset();
      mutation.reset();
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('users.create')}</DialogTitle>
          <DialogDescription>{t('users.createDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) =>
            mutation.mutate(v, {
              onSuccess: (u) => {
                toast.success(t('toast.userCreated', { name: u.name }));
                close(false);
              },
            }),
          )}
        >
          <FormGrid cols={2}>
            <FormField label={t('fields.employeeNo')} htmlFor="u-no" required error={errors.employeeNo?.message}>
              <Input id="u-no" placeholder="S1002" aria-invalid={!!errors.employeeNo} {...form.register('employeeNo')} />
            </FormField>
            <FormField label={t('fields.userName')} htmlFor="u-name" required error={errors.name?.message}>
              <Input id="u-name" aria-invalid={!!errors.name} {...form.register('name')} />
            </FormField>
            <FormField label={t('fields.department')} htmlFor="u-dept" required error={errors.department?.message}>
              <Input id="u-dept" aria-invalid={!!errors.department} {...form.register('department')} />
            </FormField>
            <FormField label={t('fields.role')} htmlFor="u-role" required>
              <NativeSelect id="u-role" {...form.register('role')}>
                {codeValues('userRole').map((r) => (
                  <option key={r} value={r}>
                    {t(codeKey('userRole', r))}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="col-span-2">
              <FormErrorAlert error={mutation.error} />
            </div>
          </FormGrid>
          <DialogFooter className="mt-3">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
