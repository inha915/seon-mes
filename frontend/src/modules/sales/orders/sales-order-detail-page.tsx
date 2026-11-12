import { Link } from '@tanstack/react-router';
import { ArrowLeft, ListChecks, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CodeBadge, CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid } from '@/shared/components/data-grid';
import { DescriptionList, StatBox } from '@/shared/components/description-list';
import { Panel } from '@/shared/components/panel';
import { QueryBoundary } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { useFormat } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import type { SalesOrderDetail } from '../types';
import { useSalesOrder } from './api';

export function SalesOrderDetailPage({ salesOrderId }: { salesOrderId: number }) {
  const { t } = useTranslation();
  const query = useSalesOrder(salesOrderId);
  const so = query.data;

  return (
    <Screen
      title={t('salesOrders.detailTitle')}
      description={so ? `${so.orderNo} · ${so.customer.name}` : undefined}
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/sales/orders">
              <ArrowLeft /> {t('common.backToList')}
            </Link>
          </Button>
          {so && so.status !== 'SHIPPED' && (
            <>
              <Button asChild variant="outline">
                <Link to="/production/work-orders" search={{ salesOrderId: so.id }}>
                  <ListChecks /> {t('salesOrders.createWorkOrder')}
                </Link>
              </Button>
              <Button asChild>
                <Link to="/sales/shipments" search={{ salesOrderId: so.id }}>
                  <Truck /> {t('salesOrders.ship')}
                </Link>
              </Button>
            </>
          )}
        </>
      }
    >
      <Panel>
        <QueryBoundary query={query}>{(data) => <Detail so={data} />}</QueryBoundary>
      </Panel>
    </Screen>
  );
}

function Detail({ so }: { so: SalesOrderDetail }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const unit = unitLabel(so.item.unit);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-6">
        <DescriptionList
          cols={2}
          items={[
            { label: t('fields.orderNo'), value: <CodeText className="font-semibold">{so.orderNo}</CodeText> },
            { label: t('fields.status'), value: <CodeBadge group="salesOrderStatus" value={so.status} /> },
            { label: t('fields.customer'), value: `${so.customer.code} · ${so.customer.name}` },
            { label: t('fields.finishedGood'), value: <ItemCell code={so.item.code} name={so.item.name} /> },
            { label: t('fields.orderDate'), value: fmt.date(so.orderDate) },
            { label: t('fields.dueDate'), value: fmt.date(so.dueDate) },
            { label: t('fields.note'), value: so.note ?? '-', wide: true },
          ]}
        />
        <div className="grid grid-cols-3 gap-2 self-start">
          <StatBox label={t('fields.orderQty')} value={`${fmt.number(so.qty)} ${unit}`} />
          <StatBox label={t('fields.shippedQty')} value={`${fmt.number(so.shippedQty)} ${unit}`} />
          <StatBox label={t('fields.remainingQty')} value={`${fmt.number(so.remainingQty)} ${unit}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border">
          <div className="panel-header">
            <h3 className="panel-title">{t('salesOrders.workOrders')}</h3>
          </div>
          <DataGrid
            columns={[
              {
                key: 'no',
                header: t('fields.workOrderNo'),
                cell: (w) => (
                  <Link to="/production/work-orders/$workOrderId" params={{ workOrderId: String(w.id) }} className="code-link">
                    {w.workOrderNo}
                  </Link>
                ),
              },
              { key: 'qty', header: t('fields.plannedQty'), align: 'right', cell: (w) => fmt.number(w.plannedQty) },
              { key: 'status', header: t('fields.status'), cell: (w) => <CodeBadge group="workOrderStatus" value={w.status} /> },
            ]}
            rows={so.workOrders}
            rowKey={(w) => w.id}
            emptyMessage={t('salesOrders.noWorkOrders')}
          />
        </div>
        <div className="rounded-md border">
          <div className="panel-header">
            <h3 className="panel-title">{t('salesOrders.availableLots')}</h3>
          </div>
          <DataGrid
            columns={[
              { key: 'lot', header: t('fields.lotNo'), cell: (l) => <LotLink lotNo={l.lotNo} /> },
              { key: 'wo', header: t('fields.workOrderNo'), cell: (l) => <CodeText>{l.workOrderNo ?? '-'}</CodeText> },
              { key: 'qty', header: t('fields.lotStock'), align: 'right', cell: (l) => `${fmt.number(l.qty)} ${unit}` },
            ]}
            rows={so.availableLots}
            rowKey={(l) => l.id}
            emptyMessage={t('shipments.noLots')}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <div className="panel-header">
          <h3 className="panel-title">{t('salesOrders.shipmentHistory')}</h3>
        </div>
        <DataGrid
          columns={[
            { key: 'no', header: t('fields.shipmentNo'), cell: (s) => <CodeText>{s.shipmentNo}</CodeText> },
            { key: 'date', header: t('fields.shipDate'), cell: (s) => fmt.date(s.shipDate) },
            { key: 'qty', header: t('fields.shipQty'), align: 'right', cell: (s) => `${fmt.number(s.qty)} ${unit}` },
            {
              key: 'lots',
              header: t('fields.shippedLots'),
              wrap: true,
              cell: (s) =>
                s.lines.map((l) => (
                  <span key={l.lotId} className="mr-3 inline-block">
                    <LotLink lotNo={l.lotNo} /> <span className="tabular-nums">{fmt.number(l.qty)}</span>
                  </span>
                )),
            },
            { key: 'by', header: t('fields.createdBy'), cell: (s) => s.createdByName ?? '-' },
          ]}
          rows={so.shipments}
          rowKey={(s) => s.id}
          emptyMessage={t('salesOrders.noShipments')}
        />
      </div>
    </div>
  );
}
