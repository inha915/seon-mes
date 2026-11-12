import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeBadge } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { FormField, FormGrid } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { SearchField, SearchPanel } from '@/shared/components/search-panel';
import { codeKey, codeValues } from '@/shared/codes';
import { codeText, optionalText, requiredText } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import type { EquipmentProcess, EquipmentStatus } from '@/shared/types';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import { useCreateEquipment, useEquipments } from './api';
import type { Equipment } from './types';

const PAGE_SIZE = 15;
type Filter = { q: string; process: EquipmentProcess | ''; status: EquipmentStatus | '' };
const EMPTY: Filter = { q: '', process: '', status: '' };

export function EquipmentPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const query = useEquipments({
    q: filter.q || undefined,
    process: filter.process || undefined,
    status: filter.status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: GridColumn<Equipment>[] = [
    {
      key: 'code',
      header: t('fields.equipmentCode'),
      cell: (e) => (
        <Link to="/equipment/equipments/$equipmentId" params={{ equipmentId: String(e.id) }} className="code-link">
          {e.code}
        </Link>
      ),
    },
    { key: 'name', header: t('fields.equipmentName'), cell: (e) => <span className="font-medium">{e.name}</span> },
    { key: 'process', header: t('fields.process'), cell: (e) => <CodeBadge group="equipmentProcess" value={e.process} /> },
    { key: 'status', header: t('fields.status'), cell: (e) => <CodeBadge group="equipmentStatus" value={e.status} /> },
    { key: 'loc', header: t('fields.location'), cell: (e) => e.location ?? '-' },
    { key: 'installed', header: t('fields.installedAt'), cell: (e) => fmt.date(e.installedAt) },
    { key: 'wo', header: t('equipment.openWorkOrders'), align: 'right', cell: (e) => fmt.number(e.openWorkOrderCount) },
  ];

  return (
    <Screen
      title={t('equipment.title')}
      description={t('equipment.description')}
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus /> {t('equipment.create')}
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
          <SearchField label={t('fields.process')}>
            <NativeSelect className="w-32" value={draft.process} onChange={(e) => setDraft({ ...draft, process: e.target.value as Filter['process'] })}>
              <option value="">{t('common.all')}</option>
              {codeValues('equipmentProcess').map((v) => (
                <option key={v} value={v}>
                  {t(codeKey('equipmentProcess', v))}
                </option>
              ))}
            </NativeSelect>
          </SearchField>
          <SearchField label={t('fields.status')}>
            <NativeSelect className="w-28" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Filter['status'] })}>
              <option value="">{t('common.all')}</option>
              {codeValues('equipmentStatus').map((v) => (
                <option key={v} value={v}>
                  {t(codeKey('equipmentStatus', v))}
                </option>
              ))}
            </NativeSelect>
          </SearchField>
          <SearchField label={t('common.keyword')}>
            <Input className="w-56" placeholder={t('equipment.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </SearchField>
        </SearchPanel>
        <DataGrid
          columns={columns}
          rows={query.data?.items}
          rowKey={(e) => e.id}
          query={query}
          pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
        />
      </Panel>
      <EquipmentDialog open={open} onOpenChange={setOpen} />
    </Screen>
  );
}

const schema = z.object({
  code: codeText(),
  name: requiredText(100),
  process: z.enum(['CUTTING', 'PRESSING', 'INSPECTION']),
  status: z.enum(['RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN']),
  location: optionalText(100),
  installedAt: z.string(),
  note: optionalText(500),
});
type Form = z.input<typeof schema>;

function EquipmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const mutation = useCreateEquipment();
  const form = useForm<Form, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', process: 'PRESSING', status: 'IDLE', location: '', installedAt: '', note: '' },
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
          <DialogTitle>{t('equipment.create')}</DialogTitle>
          <DialogDescription>{t('equipment.createDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) =>
            mutation.mutate(
              { ...v, installedAt: v.installedAt || null, location: v.location || undefined, note: v.note || undefined },
              {
                onSuccess: (e) => {
                  toast.success(t('toast.equipmentCreated', { code: e.code }));
                  close(false);
                },
              },
            ),
          )}
        >
          <FormGrid cols={2}>
            <FormField label={t('fields.equipmentCode')} htmlFor="e-code" required error={errors.code?.message}>
              <Input id="e-code" placeholder="PR-03" aria-invalid={!!errors.code} {...form.register('code')} />
            </FormField>
            <FormField label={t('fields.equipmentName')} htmlFor="e-name" required error={errors.name?.message}>
              <Input id="e-name" aria-invalid={!!errors.name} {...form.register('name')} />
            </FormField>
            <FormField label={t('fields.process')} htmlFor="e-process" required>
              <NativeSelect id="e-process" {...form.register('process')}>
                {codeValues('equipmentProcess').map((v) => (
                  <option key={v} value={v}>
                    {t(codeKey('equipmentProcess', v))}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('fields.status')} htmlFor="e-status" required>
              <NativeSelect id="e-status" {...form.register('status')}>
                {codeValues('equipmentStatus').map((v) => (
                  <option key={v} value={v}>
                    {t(codeKey('equipmentStatus', v))}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('fields.location')} htmlFor="e-loc" error={errors.location?.message}>
              <Input id="e-loc" {...form.register('location')} />
            </FormField>
            <FormField label={t('fields.installedAt')} htmlFor="e-inst">
              <Input id="e-inst" type="date" {...form.register('installedAt')} />
            </FormField>
            <FormField label={t('fields.note')} htmlFor="e-note" className="col-span-2">
              <Input id="e-note" {...form.register('note')} />
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
