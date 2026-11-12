import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ClipboardPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeBadge, ItemCell, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { FormField, FormGrid } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert } from '@/shared/components/query-state';
import { Screen, SplitLayout } from '@/shared/components/screen';
import { DateRangeField, SearchField, SearchPanel } from '@/shared/components/search-panel';
import { codeKey, codeValues } from '@/shared/codes';
import { optionalText, positiveInt, requiredDate, requiredSelect } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import { todayLocal } from '@/shared/lib/utils';
import type { SalesOrderStatus } from '@/shared/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import { useItemOptions } from '../../master/items/api';
import { usePartnerOptions } from '../../master/partners/api';
import type { SalesOrder } from '../types';
import { useCreateSalesOrder, useSalesOrders } from './api';

const PAGE_SIZE = 12;

export function SalesOrdersPage() {
  const { t } = useTranslation();
  return (
    <Screen title={t('salesOrders.title')} description={t('salesOrders.description')}>
      <SplitLayout side={<SalesOrderForm />}>
        <SalesOrderList />
      </SplitLayout>
    </Screen>
  );
}

const schema = z
  .object({
    customerId: requiredSelect(),
    itemId: requiredSelect(),
    qty: positiveInt(),
    orderDate: requiredDate(),
    dueDate: requiredDate(),
    note: optionalText(500),
  })
  .refine((v) => v.dueDate >= v.orderDate, { path: ['dueDate'], error: 'validation.dueBeforeOrder' });
type Form = z.input<typeof schema>;

function SalesOrderForm() {
  const { t } = useTranslation();
  const customers = usePartnerOptions('CUSTOMER');
  const items = useItemOptions('FINISHED');
  const mutation = useCreateSalesOrder();
  const form = useForm<Form, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: '', itemId: '', qty: '', orderDate: todayLocal(), dueDate: todayLocal(), note: '' },
  });
  const { errors } = form.formState;

  return (
    <Panel title={t('salesOrders.formTitle')} icon={<ClipboardPlus />}>
      <form
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate(values, {
            onSuccess: (so) => {
              toast.success(t('toast.salesOrderCreated', { orderNo: so.orderNo }));
              form.reset({ ...form.getValues(), qty: '', note: '' });
            },
          }),
        )}
      >
        <FormGrid cols={2}>
          <FormField label={t('fields.customer')} htmlFor="so-customer" required error={errors.customerId?.message} className="col-span-2">
            <NativeSelect id="so-customer" aria-invalid={!!errors.customerId} {...form.register('customerId')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.finishedGood')} htmlFor="so-item" required error={errors.itemId?.message} className="col-span-2">
            <NativeSelect id="so-item" aria-invalid={!!errors.itemId} {...form.register('itemId')}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {items.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} · {i.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.orderQty')} htmlFor="so-qty" required error={errors.qty?.message} className="col-span-2">
            <Input id="so-qty" inputMode="numeric" className="text-right" aria-invalid={!!errors.qty} {...form.register('qty')} />
          </FormField>
          <FormField label={t('fields.orderDate')} htmlFor="so-date" required error={errors.orderDate?.message}>
            <Input id="so-date" type="date" {...form.register('orderDate')} />
          </FormField>
          <FormField label={t('fields.dueDate')} htmlFor="so-due" required error={errors.dueDate?.message}>
            <Input id="so-due" type="date" aria-invalid={!!errors.dueDate} {...form.register('dueDate')} />
          </FormField>
          <FormField label={t('fields.note')} htmlFor="so-note" error={errors.note?.message} className="col-span-2">
            <Input id="so-note" {...form.register('note')} />
          </FormField>
        </FormGrid>
        <div className="mt-3 space-y-3">
          <FormErrorAlert error={mutation.error} />
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('salesOrders.submit')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

type Filter = { q: string; status: SalesOrderStatus | ''; from: string; to: string };
const EMPTY: Filter = { q: '', status: '', from: '', to: '' };

function SalesOrderList() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const query = useSalesOrders({
    q: filter.q || undefined,
    status: filter.status || undefined,
    from: filter.from || undefined,
    to: filter.to || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: GridColumn<SalesOrder>[] = [
    {
      key: 'no',
      header: t('fields.orderNo'),
      cell: (o) => (
        <Link to="/sales/orders/$salesOrderId" params={{ salesOrderId: String(o.id) }} className="code-link">
          {o.orderNo}
        </Link>
      ),
    },
    { key: 'customer', header: t('fields.customer'), cell: (o) => o.customer.name },
    { key: 'item', header: t('fields.finishedGood'), wrap: true, cell: (o) => <ItemCell code={o.item.code} name={o.item.name} /> },
    { key: 'qty', header: t('fields.orderQty'), align: 'right', cell: (o) => `${fmt.number(o.qty)} ${unitLabel(o.item.unit)}` },
    { key: 'shipped', header: t('fields.shippedQty'), align: 'right', cell: (o) => fmt.number(o.shippedQty) },
    { key: 'due', header: t('fields.dueDate'), cell: (o) => fmt.date(o.dueDate) },
    { key: 'status', header: t('fields.status'), cell: (o) => <CodeBadge group="salesOrderStatus" value={o.status} /> },
    {
      key: 'wo',
      header: t('salesOrders.workOrders'),
      cell: (o) =>
        o.workOrders.length > 0 ? (
          <span className="tabular-nums">
            {o.workOrders.length} · {fmt.number(o.plannedQty)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <Panel title={t('salesOrders.listTitle')} bodyClassName="p-0">
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
        <SearchField label={t('fields.status')}>
          <NativeSelect className="w-32" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Filter['status'] })}>
            <option value="">{t('common.all')}</option>
            {codeValues('salesOrderStatus').map((s) => (
              <option key={s} value={s}>
                {t(codeKey('salesOrderStatus', s))}
              </option>
            ))}
          </NativeSelect>
        </SearchField>
        <DateRangeField label={t('fields.dueDate')} from={draft.from} to={draft.to} onChange={(r) => setDraft({ ...draft, ...r })} />
        <SearchField label={t('common.keyword')}>
          <Input className="w-52" placeholder={t('salesOrders.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </SearchField>
      </SearchPanel>
      <DataGrid
        columns={columns}
        rows={query.data?.items}
        rowKey={(o) => o.id}
        query={query}
        pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
      />
    </Panel>
  );
}
