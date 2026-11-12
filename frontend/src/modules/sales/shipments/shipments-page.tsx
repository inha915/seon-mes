import { useNavigate } from '@tanstack/react-router';
import { Truck, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CodeBadge, CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid, type GridColumn } from '@/shared/components/data-grid';
import { DescriptionList } from '@/shared/components/description-list';
import { FormField } from '@/shared/components/form-field';
import { Panel } from '@/shared/components/panel';
import { EmptyState, FormErrorAlert, LoadingBlock } from '@/shared/components/query-state';
import { Screen, SplitLayout } from '@/shared/components/screen';
import { DateRangeField, SearchField, SearchPanel } from '@/shared/components/search-panel';
import { ShortagePanel } from '@/shared/components/shortage-panel';
import { ApiError } from '@/shared/lib/api';
import { useFormat } from '@/shared/lib/format';
import { cn, todayLocal } from '@/shared/lib/utils';
import type { Shortage } from '@/shared/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-select';
import { useOpenSalesOrders, useSalesOrder } from '../orders/api';
import type { SalesOrderDetail, Shipment } from '../types';
import { useCreateShipment, useShipments } from './api';

const PAGE_SIZE = 12;

export function ShipmentsPage({ salesOrderId }: { salesOrderId?: number }) {
  const { t } = useTranslation();
  return (
    <Screen title={t('shipments.title')} description={t('shipments.description')}>
      <SplitLayout sideWidth={420} side={<ShipmentForm salesOrderId={salesOrderId} />}>
        <ShipmentHistory />
      </SplitLayout>
    </Screen>
  );
}

function ShipmentForm({ salesOrderId }: { salesOrderId?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const orders = useOpenSalesOrders();
  const detail = useSalesOrder(salesOrderId);

  return (
    <Panel title={t('shipments.formTitle')} icon={<Truck />}>
      <div className="space-y-3">
        <FormField label={t('fields.salesOrder')} htmlFor="sh-order" required>
          <NativeSelect
            id="sh-order"
            value={salesOrderId ? String(salesOrderId) : ''}
            onChange={(e) =>
              void navigate({ to: '/sales/shipments', search: { salesOrderId: e.target.value ? Number(e.target.value) : undefined } })
            }
          >
            <option value="">{t('common.selectPlaceholder')}</option>
            {orders.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNo} · {o.customer.name} · {o.item.code} ({o.remainingQty})
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {!salesOrderId ? (
          <EmptyState icon={<Truck />}>{t('shipments.selectOrder')}</EmptyState>
        ) : detail.isPending ? (
          <LoadingBlock />
        ) : detail.data ? (
          <ShipmentLines key={detail.data.id + ':' + detail.data.shippedQty} so={detail.data} />
        ) : null}
      </div>
    </Panel>
  );
}

function ShipmentLines({ so }: { so: SalesOrderDetail }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const unit = unitLabel(so.item.unit);
  const mutation = useCreateShipment();
  const [shipDate, setShipDate] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [qtyByLot, setQtyByLot] = useState<Record<number, string>>({});
  const [touched, setTouched] = useState(false);

  const parse = (v: string | undefined) => (v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : v?.trim() ? NaN : 0);
  const lines = so.availableLots.map((l) => ({ lot: l, qty: parse(qtyByLot[l.id]) }));
  const total = lines.reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0), 0);
  const invalid = lines.some((l) => !Number.isFinite(l.qty));
  const clientShortages: Shortage[] = lines
    .filter((l) => Number.isFinite(l.qty) && l.qty > l.lot.qty)
    .map((l) => ({ lotId: l.lot.id, lotNo: l.lot.lotNo, itemCode: so.item.code, requestedQty: l.qty, availableQty: l.lot.qty, shortageQty: l.qty - l.lot.qty }));
  const exceeds = total > so.remainingQty;
  const serverShortages =
    mutation.error instanceof ApiError && mutation.error.code === 'INSUFFICIENT_STOCK'
      ? ((mutation.error.details?.shortages as Shortage[] | undefined) ?? [])
      : [];

  const autoAllocate = () => {
    let remaining = so.remainingQty;
    const next: Record<number, string> = {};
    for (const lot of so.availableLots) {
      const take = Math.min(Math.floor(lot.qty), Math.max(remaining, 0));
      next[lot.id] = take > 0 ? String(take) : '';
      remaining -= take;
    }
    setQtyByLot(next);
  };

  const submit = () => {
    setTouched(true);
    if (invalid || total <= 0 || exceeds || clientShortages.length > 0) return;
    mutation.mutate(
      { salesOrderId: so.id, shipDate, note: note || undefined, lines: lines.filter((l) => l.qty > 0).map((l) => ({ lotId: l.lot.id, qty: l.qty })) },
      {
        onSuccess: (s) => {
          toast.success(t('toast.shipmentCreated', { shipmentNo: s.shipmentNo }));
          setQtyByLot({});
          setNote('');
          setTouched(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3" data-testid="shipment-form">
      <DescriptionList
        items={[
          { label: t('fields.customer'), value: so.customer.name },
          { label: t('fields.finishedGood'), value: <ItemCell code={so.item.code} name={so.item.name} /> },
          { label: t('fields.status'), value: <CodeBadge group="salesOrderStatus" value={so.status} /> },
          {
            label: t('fields.remainingQty'),
            value: (
              <span className="font-semibold tabular-nums" data-testid="remaining-qty">
                {fmt.number(so.remainingQty)} {unit}
              </span>
            ),
          },
        ]}
      />
      <div className="rounded-md border">
        <div className="panel-header">
          <h3 className="panel-title">{t('shipments.lotsTitle')}</h3>
          <Button type="button" variant="outline" size="sm" onClick={autoAllocate} disabled={so.availableLots.length === 0}>
            <Wand2 /> {t('shipments.autoAllocate')}
          </Button>
        </div>
        {so.availableLots.length === 0 ? (
          <p className="px-3 py-5 text-center text-[13px] text-muted-foreground">{t('shipments.noLots')}</p>
        ) : (
          <table className="grid-table">
            <thead>
              <tr>
                <th>{t('fields.lotNo')}</th>
                <th className="text-right">{t('fields.lotStock')}</th>
                <th className="text-right">{t('fields.shipQty')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ lot, qty }) => (
                <tr key={lot.id}>
                  <td>
                    <LotLink lotNo={lot.lotNo} />
                    <div className="sub-text">{fmt.dateTime(lot.producedAt)}</div>
                  </td>
                  <td className="num">{fmt.number(lot.qty)}</td>
                  <td className="text-right">
                    <Input
                      inputMode="numeric"
                      aria-label={`${t('fields.shipQty')} ${lot.lotNo}`}
                      data-testid={`ship-qty-${lot.lotNo}`}
                      className="ml-auto h-7 w-24 text-right"
                      aria-invalid={!Number.isFinite(qty) || qty > lot.qty}
                      value={qtyByLot[lot.id] ?? ''}
                      onChange={(e) => setQtyByLot({ ...qtyByLot, [lot.id]: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-between border-t px-3 py-2 text-[13px]">
          <span className="text-muted-foreground">{t('shipments.total')}</span>
          <b className={cn('tabular-nums', exceeds && 'text-destructive')}>
            {fmt.number(total)} / {fmt.number(so.remainingQty)} {unit}
          </b>
        </div>
      </div>
      {touched && invalid && <p className="text-[12px] text-destructive">{t('validation.integer')}</p>}
      {touched && !invalid && total <= 0 && <p className="text-[12px] text-destructive">{t('validation.atLeastOneLot')}</p>}
      {exceeds && <p className="text-[12px] text-destructive">{t('errors.SHIPMENT_EXCEEDS_ORDER', { orderNo: so.orderNo, remainingQty: so.remainingQty, requestedQty: total })}</p>}
      <ShortagePanel shortages={clientShortages} source="client" />
      {clientShortages.length === 0 && <ShortagePanel shortages={serverShortages} source="server" note={t('shipments.shortageNote')} />}
      {mutation.error && serverShortages.length === 0 && <FormErrorAlert error={mutation.error} />}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('fields.shipDate')} htmlFor="sh-date" required>
          <Input id="sh-date" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
        </FormField>
        <FormField label={t('fields.note')} htmlFor="sh-note">
          <Input id="sh-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>
      <Button className="w-full" onClick={submit} disabled={mutation.isPending || clientShortages.length > 0 || exceeds} data-testid="submit-shipment">
        {mutation.isPending ? t('common.saving') : t('shipments.submit')}
      </Button>
    </div>
  );
}

type Filter = { q: string; from: string; to: string };
const EMPTY: Filter = { q: '', from: '', to: '' };

function ShipmentHistory() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const query = useShipments({ q: filter.q || undefined, from: filter.from || undefined, to: filter.to || undefined, page, pageSize: PAGE_SIZE });

  const columns: GridColumn<Shipment>[] = [
    { key: 'date', header: t('fields.shipDate'), cell: (s) => fmt.date(s.shipDate) },
    { key: 'no', header: t('fields.shipmentNo'), cell: (s) => <CodeText>{s.shipmentNo}</CodeText> },
    { key: 'order', header: t('fields.orderNo'), cell: (s) => <CodeText>{s.salesOrder.orderNo}</CodeText> },
    { key: 'customer', header: t('fields.customer'), cell: (s) => s.salesOrder.customerName },
    { key: 'item', header: t('fields.finishedGood'), wrap: true, cell: (s) => <ItemCell code={s.salesOrder.item.code} name={s.salesOrder.item.name} /> },
    { key: 'qty', header: t('fields.shipQty'), align: 'right', cell: (s) => `${fmt.number(s.qty)} ${unitLabel(s.salesOrder.item.unit)}` },
    {
      key: 'lots',
      header: t('fields.shippedLots'),
      cell: (s) =>
        s.lines.map((l) => (
          <div key={l.lotId} className="whitespace-nowrap">
            <LotLink lotNo={l.lotNo} /> <span className="tabular-nums text-muted-foreground">{fmt.number(l.qty)}</span>
          </div>
        )),
    },
    { key: 'by', header: t('fields.createdBy'), cell: (s) => s.createdByName ?? '-' },
  ];

  return (
    <Panel title={t('shipments.historyTitle')} bodyClassName="p-0">
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
        <DateRangeField label={t('fields.shipDate')} from={draft.from} to={draft.to} onChange={(r) => setDraft({ ...draft, ...r })} />
        <SearchField label={t('common.keyword')}>
          <Input className="w-52" placeholder={t('shipments.searchPlaceholder')} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </SearchField>
      </SearchPanel>
      <DataGrid
        columns={columns}
        rows={query.data?.items}
        rowKey={(s) => s.id}
        query={query}
        pagination={query.data && { page, pageSize: PAGE_SIZE, total: query.data.total, onPageChange: setPage }}
      />
    </Panel>
  );
}
