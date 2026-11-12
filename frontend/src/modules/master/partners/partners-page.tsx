import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
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
import { codeText, optionalText, requiredText } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import type { Partner } from '../types';
import { useCreatePartner, usePartners } from './api';

const PAGE_SIZE = 15;
type Filter = { q: string; role: '' | 'SUPPLIER' | 'CUSTOMER' };
const EMPTY: Filter = { q: '', role: '' };

export function PartnersPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const query = usePartners({ q: filter.q || undefined, role: filter.role || undefined, page, pageSize: PAGE_SIZE });

  const columns: GridColumn<Partner>[] = [
    { key: 'code', header: t('fields.code'), cell: (p) => <CodeText>{p.code}</CodeText> },
    { key: 'name', header: t('fields.partnerName'), cell: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'type', header: t('fields.partnerType'), cell: (p) => <CodeBadge group="partnerType" value={p.type} /> },
    { key: 'biz', header: t('fields.businessNo'), cell: (p) => p.businessNo ?? '-' },
    { key: 'contact', header: t('fields.contactName'), cell: (p) => p.contactName ?? '-' },
    { key: 'phone', header: t('fields.phone'), cell: (p) => p.phone ?? '-' },
    { key: 'receipts', header: t('partners.receiptCount'), align: 'right', cell: (p) => fmt.number(p.receiptCount) },
    { key: 'orders', header: t('partners.salesOrderCount'), align: 'right', cell: (p) => fmt.number(p.salesOrderCount) },
    { key: 'created', header: t('common.createdAt'), cell: (p) => <span className="text-muted-foreground">{fmt.dateTime(p.createdAt)}</span> },
  ];

  return (
    <Screen
      title={t('partners.title')}
      description={t('partners.description')}
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus /> {t('partners.create')}
        </Button>
      }
    >
      <Panel bodyClassName="p-0">
        <SearchPanel
          onSearch={() => {
            setPage(1);
            setFilter({ ...draft, q: draft.q.trim() });
          }}
          onReset={() => {
            setDraft(EMPTY);
            setFilter(EMPTY);
            setPage(1);
          }}
        >
          <SearchField label={t('fields.partnerType')}>
            <NativeSelect className="w-32" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Filter['role'] })}>
              <option value="">{t('common.all')}</option>
              <option value="SUPPLIER">{t('codes.partnerType.SUPPLIER')}</option>
              <option value="CUSTOMER">{t('codes.partnerType.CUSTOMER')}</option>
            </NativeSelect>
          </SearchField>
          <SearchField label={t('common.keyword')}>
            <Input className="w-64" placeholder={t('partners.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </SearchField>
        </SearchPanel>
        <DataGrid
          columns={columns}
          rows={query.data?.items}
          rowKey={(p) => p.id}
          query={query}
          emptyMessage={filter.q ? undefined : t('partners.empty')}
          pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
        />
      </Panel>
      <PartnerDialog open={open} onOpenChange={setOpen} />
    </Screen>
  );
}

const partnerSchema = z.object({
  code: codeText(),
  name: requiredText(100),
  type: z.enum(['SUPPLIER', 'CUSTOMER', 'BOTH']),
  businessNo: optionalText(30),
  contactName: optionalText(50),
  phone: optionalText(30),
});
type PartnerForm = z.input<typeof partnerSchema>;

function PartnerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const mutation = useCreatePartner();
  const form = useForm<PartnerForm, unknown, z.output<typeof partnerSchema>>({
    resolver: zodResolver(partnerSchema),
    defaultValues: { code: '', name: '', type: 'SUPPLIER', businessNo: '', contactName: '', phone: '' },
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
          <DialogTitle>{t('partners.create')}</DialogTitle>
          <DialogDescription>{t('partners.createDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate(values, {
              onSuccess: (p) => {
                toast.success(t('toast.partnerCreated', { name: p.name }));
                close(false);
              },
            }),
          )}
        >
          <FormGrid cols={2}>
            <FormField label={t('fields.code')} htmlFor="p-code" required error={errors.code?.message}>
              <Input id="p-code" placeholder="SUP-004" aria-invalid={!!errors.code} {...form.register('code')} />
            </FormField>
            <FormField label={t('fields.partnerType')} htmlFor="p-type" required>
              <NativeSelect id="p-type" {...form.register('type')}>
                {codeValues('partnerType').map((v) => (
                  <option key={v} value={v}>
                    {t(codeKey('partnerType', v))}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('fields.partnerName')} htmlFor="p-name" required error={errors.name?.message} className="col-span-2">
              <Input id="p-name" aria-invalid={!!errors.name} {...form.register('name')} />
            </FormField>
            <FormField label={t('fields.businessNo')} htmlFor="p-biz" error={errors.businessNo?.message}>
              <Input id="p-biz" placeholder="000-00-00000" {...form.register('businessNo')} />
            </FormField>
            <FormField label={t('fields.contactName')} htmlFor="p-contact" error={errors.contactName?.message}>
              <Input id="p-contact" {...form.register('contactName')} />
            </FormField>
            <FormField label={t('fields.phone')} htmlFor="p-phone" error={errors.phone?.message} className="col-span-2">
              <Input id="p-phone" {...form.register('phone')} />
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
