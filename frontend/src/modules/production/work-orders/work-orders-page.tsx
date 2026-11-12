import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ClipboardPlus, Factory } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { CodeBadge, CodeText, ItemCell, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { FormField, FormGrid } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { FormErrorAlert } from '@/shared/components/query-state';
import { Screen, SplitLayout } from '@/shared/components/screen';
import { SearchField, SearchPanel } from '@/shared/components/search-panel';
import { codeKey } from '@/shared/codes';
import { optionalText, positiveInt, requiredDate, requiredSelect } from '@/shared/lib/form-schema';
import { useFormat } from '@/shared/lib/format';
import { todayLocal } from '@/shared/lib/utils';
import type { WorkOrderStatus } from '@/shared/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import { useEquipmentOptions } from '../../equipment/api';
import { useItemOptions } from '../../master/items/api';
import { useOpenSalesOrders } from '../../sales/orders/api';
import type { WorkOrder } from '../types';
import { useCreateWorkOrder, useWorkOrders } from './api';

const PAGE_SIZE = 12;
const UNAVAILABLE = ['BREAKDOWN', 'MAINTENANCE'];

export function WorkOrdersPage({ salesOrderId }: { salesOrderId?: number }) {
  const { t } = useTranslation();
  return (
    <Screen title={t('workOrders.title')} description={t('workOrders.description')}>
      <SplitLayout side={<WorkOrderForm salesOrderId={salesOrderId} />}>
        <WorkOrderList />
      </SplitLayout>
    </Screen>
  );
}

const schema = z.object({
  salesOrderId: z.string(),
  itemId: requiredSelect(),
  plannedQty: positiveInt(),
  workDate: requiredDate(),
  equipmentId: z.string(),
  note: optionalText(500),
});
type Form = z.input<typeof schema>;

function WorkOrderForm({ salesOrderId }: { salesOrderId?: number }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const finished = useItemOptions('FINISHED');
  const orders = useOpenSalesOrders();
  const equipments = useEquipmentOptions();
  const mutation = useCreateWorkOrder();
  const form = useForm<Form, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { salesOrderId: salesOrderId ? String(salesOrderId) : '', itemId: '', plannedQty: '', workDate: todayLocal(), equipmentId: '', note: '' },
  });
  const { errors } = form.formState;
  const selectedOrderId = form.watch('salesOrderId');
  const selectedOrder = orders.data?.find((o) => String(o.id) === selectedOrderId);
  const item = finished.data?.find((i) => String(i.id) === form.watch('itemId'));
  const planned = Number(form.watch('plannedQty'));
  const plannedValid = Number.isInteger(planned) && planned > 0;

  // 수주를 고르면 품목과 남은 수량을 채웁니다.
  useEffect(() => {
    if (!selectedOrder) return;
    form.setValue('itemId', String(selectedOrder.item.id), { shouldValidate: true });
    const left = Math.max(selectedOrder.qty - selectedOrder.plannedQty, 0);
    if (!form.getValues('plannedQty') && left > 0) form.setValue('plannedQty', String(left));
  }, [selectedOrder, form]);

  return (
    <Panel title={t('workOrders.formTitle')} icon={<ClipboardPlus />}>
      <form
        onSubmit={form.handleSubmit((v) =>
          mutation.mutate(
            {
              itemId: v.itemId,
              plannedQty: v.plannedQty,
              workDate: v.workDate,
              note: v.note || undefined,
              salesOrderId: v.salesOrderId ? Number(v.salesOrderId) : null,
              equipmentId: v.equipmentId ? Number(v.equipmentId) : null,
            },
            {
              onSuccess: (wo) => {
                toast.success(t('toast.workOrderCreated', { workOrderNo: wo.workOrderNo }));
                form.reset({ ...form.getValues(), salesOrderId: '', plannedQty: '', note: '' });
              },
            },
          ),
        )}
      >
        <FormGrid cols={2}>
          <FormField label={t('fields.salesOrder')} htmlFor="w-so" hint={t('workOrders.salesOrderHint')} className="col-span-2">
            <NativeSelect id="w-so" {...form.register('salesOrderId')}>
              <option value="">{t('workOrders.noSalesOrder')}</option>
              {orders.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNo} · {o.customer.name} · {o.item.code} {fmt.number(o.qty)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.finishedGood')} htmlFor="w-item" required error={errors.itemId?.message} className="col-span-2">
            <NativeSelect id="w-item" aria-invalid={!!errors.itemId} disabled={!!selectedOrder} {...form.register('itemId')}>
              <option value="">{finished.isPending ? t('common.loading') : t('common.selectPlaceholder')}</option>
              {finished.data?.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.code} · {it.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.plannedQty')} htmlFor="w-qty" required error={errors.plannedQty?.message}>
            <Input id="w-qty" inputMode="numeric" className="text-right" aria-invalid={!!errors.plannedQty} {...form.register('plannedQty')} />
          </FormField>
          <FormField label={t('fields.workDate')} htmlFor="w-date" required error={errors.workDate?.message}>
            <Input id="w-date" type="date" {...form.register('workDate')} />
          </FormField>
          <FormField label={t('fields.equipment')} htmlFor="w-eq" hint={t('workOrders.equipmentHint')} className="col-span-2">
            <NativeSelect id="w-eq" {...form.register('equipmentId')}>
              <option value="">{t('workOrders.noEquipment')}</option>
              {equipments.data?.map((e) => (
                <option key={e.id} value={e.id} disabled={UNAVAILABLE.includes(e.status)}>
                  {e.code} · {e.name} ({t(codeKey('equipmentStatus', e.status))})
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('fields.note')} htmlFor="w-note" error={errors.note?.message} className="col-span-2">
            <Input id="w-note" {...form.register('note')} />
          </FormField>
        </FormGrid>

        {/* BOM 기준 예상 소요량 미리보기 */}
        <div className="mt-3 rounded-md border">
          <div className="panel-header">
            <h3 className="panel-title">{t('workOrders.requirementPreview')}</h3>
          </div>
          {!item ? (
            <p className="px-3 py-3 text-[12.5px] text-muted-foreground">{t('workOrders.selectItemFirst')}</p>
          ) : item.bomLines.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-destructive">{t('errors.BOM_NOT_DEFINED', { itemCode: item.code })}</p>
          ) : (
            <table className="grid-table">
              <tbody>
                {item.bomLines.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-normal">
                      <ItemCell code={l.componentCode} name={l.componentName} />
                    </td>
                    <td className="num text-muted-foreground">× {fmt.number(l.qtyPer)}</td>
                    <td className="num font-semibold">
                      {plannedValid ? fmt.number(Math.round(l.qtyPer * planned * 1000) / 1000) : '-'} {unitLabel(l.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-3 space-y-3">
          <FormErrorAlert error={mutation.error} />
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('workOrders.submit')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

type Filter = { q: string; status: WorkOrderStatus | '' };
const EMPTY: Filter = { q: '', status: '' };

function WorkOrderList() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const query = useWorkOrders({ q: filter.q || undefined, status: filter.status || undefined, page, pageSize: PAGE_SIZE });

  const columns: GridColumn<WorkOrder>[] = [
    {
      key: 'no',
      header: t('fields.workOrderNo'),
      cell: (wo) => (
        <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(wo.id) }} className="code-link">
          {wo.workOrderNo}
        </Link>
      ),
    },
    { key: 'date', header: t('fields.workDate'), cell: (wo) => fmt.date(wo.workDate) },
    { key: 'item', header: t('fields.finishedGood'), wrap: true, cell: (wo) => <ItemCell code={wo.item.code} name={wo.item.name} /> },
    { key: 'qty', header: t('fields.plannedQty'), align: 'right', cell: (wo) => `${fmt.number(wo.plannedQty)} ${unitLabel(wo.item.unit)}` },
    { key: 'so', header: t('fields.salesOrder'), cell: (wo) => (wo.salesOrder ? <CodeText>{wo.salesOrder.orderNo}</CodeText> : '-') },
    { key: 'eq', header: t('fields.equipment'), cell: (wo) => (wo.equipment ? <CodeText>{wo.equipment.code}</CodeText> : '-') },
    {
      key: 'status',
      header: t('fields.status'),
      cell: (wo) => (
        <span className="flex items-center gap-1">
          <CodeBadge group="workOrderStatus" value={wo.status} />
          {wo.pendingApproval && <Badge variant="info">{t('workOrders.pendingApproval')}</Badge>}
        </span>
      ),
    },
    {
      key: 'result',
      header: t('fields.goodDefect'),
      align: 'right',
      cell: (wo) =>
        wo.result ? (
          <>
            {fmt.number(wo.result.goodQty)} / <span className="text-destructive">{fmt.number(wo.result.defectQty)}</span>
          </>
        ) : (
          '-'
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (wo) =>
        wo.status === 'PLANNED' &&
        !wo.pendingApproval && (
          <Button asChild variant="outline" size="sm">
            <Link to="/production/results" search={{ workOrderId: wo.id }}>
              <Factory /> {t('workOrders.enterResult')}
            </Link>
          </Button>
        ),
    },
  ];

  return (
    <Panel title={t('workOrders.listTitle')} bodyClassName="p-0">
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
            <option value="PLANNED">{t('codes.workOrderStatus.PLANNED')}</option>
            <option value="COMPLETED">{t('codes.workOrderStatus.COMPLETED')}</option>
          </NativeSelect>
        </SearchField>
        <SearchField label={t('common.keyword')}>
          <Input className="w-56" placeholder={t('workOrders.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </SearchField>
      </SearchPanel>
      <DataGrid
        columns={columns}
        rows={query.data?.items}
        rowKey={(wo) => wo.id}
        query={query}
        pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
      />
    </Panel>
  );
}
