import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { DescriptionList } from '@/shared/components/description-list';
import { FormField, FormGrid } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert } from '@/shared/components/query-state';
import { Screen, SplitLayout } from '@/shared/components/screen';
import { DateRangeField, SearchField, SearchPanel } from '@/shared/components/search-panel';
import { optionalText, positiveNumber, requiredDate, requiredSelect } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import { todayLocal } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import { Textarea } from '@/shared/ui/textarea';
import { useItemOptions } from '../../master/items/api';
import { usePartnerOptions } from '../../master/partners/api';
import type { Receipt } from '../types';
import { useCreateReceipt, useReceipts } from './api';

const PAGE_SIZE = 12;

export function ReceiptsPage() {
  const { t } = useTranslation();
  return (
    <Screen title={t('receipts.title')} description={t('receipts.description')}>
      <SplitLayout side={<ReceiptForm />}>
        <ReceiptHistory />
      </SplitLayout>
    </Screen>
  );
}

const schema = z.object({
  partnerId: requiredSelect(),
  receiptDate: requiredDate(),
  itemId: requiredSelect(),
  qty: positiveNumber(),
  supplierLotNo: optionalText(50),
  note: optionalText(500),
});
type Form = z.input<typeof schema>;

function ReceiptForm() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const suppliers = usePartnerOptions('SUPPLIER');
  const rawItems = useItemOptions('RAW');
  const mutation = useCreateReceipt();
  const [last, setLast] = useState<Receipt | null>(null);
  const form = useForm<Form, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { partnerId: '', receiptDate: todayLocal(), itemId: '', qty: '', supplierLotNo: '', note: '' },
  });
  const { errors } = form.formState;
  const selectedItem = rawItems.data?.find((i) => String(i.id) === form.watch('itemId'));

  return (
    <>
      <Panel title={t('receipts.formTitle')} icon={<PackagePlus />}>
        <form
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate(values, {
              onSuccess: (receipt) => {
                setLast(receipt);
                toast.success(t('toast.receiptCreated', { lotNo: receipt.lot.lotNo }));
                form.reset({ ...form.getValues(), qty: '', supplierLotNo: '', note: '' });
              },
            }),
          )}
        >
          <FormGrid>
            <FormField label={t('fields.supplier')} htmlFor="r-partner" required error={errors.partnerId?.message}>
              <NativeSelect id="r-partner" aria-invalid={!!errors.partnerId} {...form.register('partnerId')}>
                <option value="">{suppliers.isPending ? t('common.loading') : t('common.selectPlaceholder')}</option>
                {suppliers.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('fields.receiptDate')} htmlFor="r-date" required error={errors.receiptDate?.message}>
              <Input id="r-date" type="date" {...form.register('receiptDate')} />
            </FormField>
            <FormField label={t('fields.rawMaterial')} htmlFor="r-item" required error={errors.itemId?.message}>
              <NativeSelect id="r-item" aria-invalid={!!errors.itemId} {...form.register('itemId')}>
                <option value="">{rawItems.isPending ? t('common.loading') : t('common.selectPlaceholder')}</option>
                {rawItems.data?.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} · {it.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label={t('fields.receiptQty')}
              htmlFor="r-qty"
              required
              error={errors.qty?.message}
              hint={selectedItem ? t('receipts.currentStock', { qty: fmt.number(selectedItem.stockQty), unit: unitLabel(selectedItem.unit) }) : undefined}
            >
              <div className="flex items-center gap-2">
                <Input id="r-qty" inputMode="decimal" className="text-right" aria-invalid={!!errors.qty} {...form.register('qty')} />
                <span className="w-10 shrink-0 text-[13px] text-muted-foreground">{selectedItem ? unitLabel(selectedItem.unit) : ''}</span>
              </div>
            </FormField>
            <FormField label={t('fields.supplierLotNo')} htmlFor="r-slot" error={errors.supplierLotNo?.message} hint={t('receipts.supplierLotHint')}>
              <Input id="r-slot" {...form.register('supplierLotNo')} />
            </FormField>
            <FormField label={t('fields.note')} htmlFor="r-note" error={errors.note?.message}>
              <Textarea id="r-note" rows={2} {...form.register('note')} />
            </FormField>
          </FormGrid>
          <div className="mt-3 space-y-3">
            <FormErrorAlert error={mutation.error} />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('receipts.submit')}
            </Button>
          </div>
        </form>
      </Panel>

      {last && (
        <Panel title={<span className="text-success">{t('receipts.issuedLot')}</span>} icon={<CheckCircle2 />} data-testid="receipt-result" className="border-success/30">
          <DescriptionList
            items={[
              { label: t('fields.lotNo'), value: <LotLink lotNo={last.lot.lotNo} className="font-semibold" /> },
              { label: t('fields.receiptNo'), value: <CodeText>{last.receiptNo}</CodeText> },
              { label: t('fields.item'), value: <ItemCell code={last.item.code} name={last.item.name} /> },
              { label: t('fields.qty'), value: `${fmt.number(last.qty)} ${unitLabel(last.item.unit)}` },
            ]}
          />
        </Panel>
      )}
    </>
  );
}

type Filter = { q: string; from: string; to: string };
const EMPTY: Filter = { q: '', from: '', to: '' };

function ReceiptHistory() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const query = useReceipts({ q: filter.q || undefined, from: filter.from || undefined, to: filter.to || undefined, page, pageSize: PAGE_SIZE });

  const columns: GridColumn<Receipt>[] = [
    { key: 'date', header: t('fields.receiptDate'), cell: (r) => fmt.date(r.receiptDate) },
    { key: 'no', header: t('fields.receiptNo'), cell: (r) => <CodeText>{r.receiptNo}</CodeText> },
    { key: 'lot', header: t('fields.lotNo'), cell: (r) => <LotLink lotNo={r.lot.lotNo} /> },
    { key: 'partner', header: t('fields.supplier'), cell: (r) => r.partner.name },
    { key: 'item', header: t('fields.item'), wrap: true, cell: (r) => <ItemCell code={r.item.code} name={r.item.name} /> },
    { key: 'qty', header: t('fields.receiptQty'), align: 'right', cell: (r) => `${fmt.number(r.qty)} ${unitLabel(r.item.unit)}` },
    { key: 'stock', header: t('fields.lotStock'), align: 'right', cell: (r) => fmt.number(r.lot.qty) },
    { key: 'slot', header: t('fields.supplierLotNo'), cell: (r) => <CodeText className="text-muted-foreground">{r.supplierLotNo ?? '-'}</CodeText> },
  ];

  return (
    <Panel title={t('receipts.historyTitle')} bodyClassName="p-0">
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
        <DateRangeField label={t('fields.receiptDate')} from={draft.from} to={draft.to} onChange={(r) => setDraft({ ...draft, ...r })} />
        <SearchField label={t('common.keyword')}>
          <Input className="w-52" placeholder={t('receipts.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </SearchField>
      </SearchPanel>
      <DataGrid
        columns={columns}
        rows={query.data?.items}
        rowKey={(r) => r.id}
        query={query}
        pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
      />
    </Panel>
  );
}
