import { zodResolver } from '@hookform/resolvers/zod';
import { ListTree, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm, type Control, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeBadge, CodeText, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { FormField } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { SearchField, SearchPanel } from '@/shared/components/search-panel';
import { codeText, optionalText, positiveNumber, requiredSelect, requiredText } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import type { ItemType } from '@/shared/types';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import type { Item } from '../types';
import { UNIT_CODES, useCreateItem, useItemOptions, useItems, useReplaceBom } from './api';
import { BomLinesEditor, type BomLinesForm } from './bom-lines-editor';

const PAGE_SIZE = 15;

const bomLinesSchema = z
  .array(z.object({ componentId: requiredSelect(), qtyPer: positiveNumber() }))
  .refine((lines) => new Set(lines.map((l) => l.componentId)).size === lines.length, {
    error: 'validation.duplicateComponent',
  });

type Filter = { q: string; type: ItemType | '' };
const EMPTY: Filter = { q: '', type: '' };

export function ItemsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [bomItem, setBomItem] = useState<Item | null>(null);
  const query = useItems({ q: filter.q || undefined, type: filter.type || undefined, page, pageSize: PAGE_SIZE });

  const columns: GridColumn<Item>[] = [
    { key: 'type', header: t('fields.type'), cell: (i) => <CodeBadge group="itemType" value={i.type} /> },
    { key: 'code', header: t('fields.itemCode'), cell: (i) => <CodeText>{i.code}</CodeText> },
    { key: 'name', header: t('fields.itemName'), cell: (i) => <span className="font-medium">{i.name}</span> },
    { key: 'spec', header: t('fields.spec'), cell: (i) => <span className="text-muted-foreground">{i.spec ?? '-'}</span> },
    { key: 'unit', header: t('fields.unit'), cell: (i) => unitLabel(i.unit) },
    { key: 'stock', header: t('fields.stockQty'), align: 'right', cell: (i) => fmt.number(i.stockQty) },
    {
      key: 'bom',
      header: t('items.bomColumn'),
      wrap: true,
      cell: (i) =>
        i.type !== 'FINISHED' ? (
          <span className="text-muted-foreground">-</span>
        ) : i.bomLines.length > 0 ? (
          <ul className="space-y-0.5 text-[12.5px]">
            {i.bomLines.map((l) => (
              <li key={l.id}>
                <CodeText>{l.componentCode}</CodeText> {l.componentName} × <b className="tabular-nums">{fmt.number(l.qtyPer)}</b> {unitLabel(l.unit)}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[12.5px] text-destructive">{t('items.bomMissing')}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) =>
        i.type === 'FINISHED' && (
          <Button variant="outline" size="sm" onClick={() => setBomItem(i)}>
            <ListTree /> {t('items.editBom')}
          </Button>
        ),
    },
  ];

  return (
    <Screen
      title={t('items.title')}
      description={t('items.description')}
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> {t('items.create')}
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
          <SearchField label={t('fields.type')}>
            <NativeSelect className="w-36" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Filter['type'] })}>
              <option value="">{t('common.all')}</option>
              <option value="RAW">{t('codes.itemType.RAW')}</option>
              <option value="FINISHED">{t('codes.itemType.FINISHED')}</option>
            </NativeSelect>
          </SearchField>
          <SearchField label={t('common.keyword')}>
            <Input className="w-64" placeholder={t('items.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </SearchField>
        </SearchPanel>
        <DataGrid
          columns={columns}
          rows={query.data?.items}
          rowKey={(i) => i.id}
          query={query}
          pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
        />
      </Panel>
      <ItemCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      {bomItem && <BomDialog item={bomItem} onClose={() => setBomItem(null)} />}
    </Screen>
  );
}

const itemSchema = z
  .object({
    type: z.enum(['RAW', 'FINISHED']),
    code: codeText(),
    name: requiredText(100),
    unit: z.enum(UNIT_CODES as ['EA', 'SHEET', 'KG', 'M', 'SET']),
    spec: optionalText(200),
    bomLines: bomLinesSchema,
  });
type ItemForm = z.input<typeof itemSchema>;

function ItemCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const unitLabel = useCodeLabel('unit');
  const mutation = useCreateItem();
  const rawItems = useItemOptions('RAW');
  const form = useForm<ItemForm, unknown, z.output<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { type: 'RAW', code: '', name: '', unit: 'EA', spec: '', bomLines: [] },
  });
  const { errors } = form.formState;
  const type = form.watch('type');

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      form.reset();
      mutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('items.create')}</DialogTitle>
          <DialogDescription>{t('items.createDescription')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate(
              { ...values, bomLines: values.type === 'FINISHED' ? values.bomLines : [] },
              {
                onSuccess: (item) => {
                  toast.success(t('toast.itemCreated', { code: item.code }));
                  close(false);
                },
              },
            ),
          )}
        >
          <FormField label={t('fields.type')} htmlFor="i-type" required>
            <NativeSelect id="i-type" {...form.register('type')}>
              <option value="RAW">{t('codes.itemType.RAW')}</option>
              <option value="FINISHED">{t('codes.itemType.FINISHED')}</option>
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.unit')} htmlFor="i-unit" required error={errors.unit?.message}>
            <NativeSelect id="i-unit" {...form.register('unit')}>
              {UNIT_CODES.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)} ({u})
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.itemCode')} htmlFor="i-code" required error={errors.code?.message}>
            <Input id="i-code" placeholder={type === 'RAW' ? 'MAT-XXXX' : 'PRD-XXXX'} aria-invalid={!!errors.code} {...form.register('code')} />
          </FormField>
          <FormField label={t('fields.itemName')} htmlFor="i-name" required error={errors.name?.message}>
            <Input id="i-name" aria-invalid={!!errors.name} {...form.register('name')} />
          </FormField>
          <FormField label={t('fields.spec')} htmlFor="i-spec" error={errors.spec?.message} className="col-span-2">
            <Input id="i-spec" {...form.register('spec')} />
          </FormField>
          {type === 'FINISHED' && (
            <div className="col-span-2">
              <BomLinesEditor
                control={form.control as unknown as Control<BomLinesForm>}
                register={form.register as unknown as UseFormRegister<BomLinesForm>}
                errors={errors.bomLines}
                rawItems={rawItems.data ?? []}
              />
            </div>
          )}
          <div className="col-span-2">
            <FormErrorAlert error={mutation.error} />
          </div>
          <DialogFooter className="col-span-2">
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

const bomSchema = z.object({ bomLines: bomLinesSchema });

function BomDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { t } = useTranslation();
  const mutation = useReplaceBom();
  const rawItems = useItemOptions('RAW');
  const form = useForm<z.input<typeof bomSchema>, unknown, z.output<typeof bomSchema>>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      bomLines: item.bomLines.map((l) => ({ componentId: String(l.componentId), qtyPer: String(l.qtyPer) })),
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('items.editBomTitle')}</DialogTitle>
          <DialogDescription>
            <span className="code-text">{item.code}</span> {item.name} — {t('items.bomHint')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate(
              { itemId: item.id, lines: values.bomLines },
              {
                onSuccess: () => {
                  toast.success(t('toast.bomSaved', { code: item.code }));
                  onClose();
                },
              },
            ),
          )}
        >
          <BomLinesEditor
            control={form.control as unknown as Control<BomLinesForm>}
            register={form.register as unknown as UseFormRegister<BomLinesForm>}
            errors={form.formState.errors.bomLines}
            rawItems={rawItems.data ?? []}
          />
          <FormErrorAlert error={mutation.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
