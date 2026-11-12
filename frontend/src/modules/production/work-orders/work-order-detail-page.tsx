import { Link } from '@tanstack/react-router';
import { ArrowLeft, Factory, GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CodeBadge, CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid } from '@/shared/components/data-grid';
import { DescriptionList, StatBox } from '@/shared/components/description-list';
import { Panel } from '@/shared/components/panel';
import { EmptyState, QueryBoundary } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { useFormat } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import type { WorkOrderDetail } from '../types';
import { useWorkOrder } from './api';

export function WorkOrderDetailPage({ workOrderId }: { workOrderId: number }) {
  const { t } = useTranslation();
  const query = useWorkOrder(workOrderId);
  const wo = query.data;

  return (
    <Screen
      title={t('workOrders.detailTitle')}
      description={wo ? `${wo.workOrderNo} · ${wo.item.code} ${wo.item.name}` : undefined}
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/production/work-orders">
              <ArrowLeft /> {t('common.backToList')}
            </Link>
          </Button>
          {wo?.status === 'PLANNED' && !wo.pendingApproval && (
            <Button asChild>
              <Link to="/production/results" search={{ workOrderId: wo.id }}>
                <Factory /> {t('workOrders.enterResult')}
              </Link>
            </Button>
          )}
        </>
      }
    >
      <QueryBoundary query={query}>{(data) => <Detail wo={data} />}</QueryBoundary>
    </Screen>
  );
}

function Detail({ wo }: { wo: WorkOrderDetail }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');

  return (
    <div className="grid grid-cols-2 items-start gap-4">
      <Panel
        title={t('workOrders.infoTitle')}
        actions={
          <span className="flex gap-1">
            <CodeBadge group="workOrderStatus" value={wo.status} />
            {wo.pendingApproval && <Badge variant="info">{t('workOrders.pendingApproval')}</Badge>}
          </span>
        }
      >
        <DescriptionList
          items={[
            { label: t('fields.workOrderNo'), value: <CodeText className="font-semibold">{wo.workOrderNo}</CodeText> },
            { label: t('fields.finishedGood'), value: <ItemCell code={wo.item.code} name={wo.item.name} /> },
            { label: t('fields.plannedQty'), value: `${fmt.number(wo.plannedQty)} ${unitLabel(wo.item.unit)}` },
            { label: t('fields.workDate'), value: fmt.date(wo.workDate) },
            {
              label: t('fields.salesOrder'),
              value: wo.salesOrder ? (
                <Link to="/sales/orders/$salesOrderId" params={{ salesOrderId: String(wo.salesOrder.id) }} className="code-link">
                  {wo.salesOrder.orderNo}
                </Link>
              ) : (
                '-'
              ),
            },
            {
              label: t('fields.equipment'),
              value: wo.equipment ? (
                <Link to="/equipment/equipments/$equipmentId" params={{ equipmentId: String(wo.equipment.id) }} className="code-link">
                  {wo.equipment.code} · {wo.equipment.name}
                </Link>
              ) : (
                '-'
              ),
            },
            { label: t('workOrders.process'), value: t('workOrders.processFlow') },
            {
              label: t('workOrders.approval'),
              value: wo.pendingApproval ? (
                <Link to="/approval/inbox" className="code-link">
                  {wo.pendingApproval.requestNo} ({wo.pendingApproval.requesterName})
                </Link>
              ) : (
                '-'
              ),
            },
            { label: t('fields.note'), value: wo.note ?? '-' },
            { label: t('common.createdAt'), value: fmt.dateTime(wo.createdAt) },
          ]}
        />
      </Panel>

      <Panel title={t('workOrders.requirementTitle')} bodyClassName="p-0">
        <DataGrid
          columns={[
            { key: 'mat', header: t('fields.rawMaterial'), wrap: true, cell: (r) => <ItemCell code={r.componentCode} name={r.componentName} /> },
            { key: 'per', header: t('fields.qtyPer'), align: 'right', cell: (r) => fmt.number(r.qtyPer) },
            { key: 'req', header: t('fields.requiredQty'), align: 'right', cell: (r) => <b>{`${fmt.number(r.requiredQty)} ${unitLabel(r.unit)}`}</b> },
            { key: 'stock', header: t('fields.stockQty'), align: 'right', cell: (r) => fmt.number(r.stockQty) },
          ]}
          rows={wo.requirements}
          rowKey={(r) => r.componentId}
        />
      </Panel>

      <Panel
        className="col-span-2"
        title={t('workOrders.resultTitle')}
        actions={
          wo.result?.finishedLotNo && (
            <Button asChild variant="outline" size="sm">
              <Link to="/inventory/lot-trace" search={{ lotNo: wo.result.finishedLotNo }}>
                <GitBranch /> {t('workOrders.traceFinishedLot')}
              </Link>
            </Button>
          )
        }
      >
        {!wo.result ? (
          <EmptyState>{t('workOrders.noResultYet')}</EmptyState>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
              <StatBox label={t('fields.resultNo')} value={<CodeText>{wo.result.resultNo}</CodeText>} />
              <StatBox label={t('fields.goodQty')} value={fmt.number(wo.result.goodQty)} />
              <StatBox label={t('fields.defectQty')} value={<span className="text-destructive">{fmt.number(wo.result.defectQty)}</span>} />
              <StatBox
                label={t('fields.finishedLotNo')}
                value={wo.result.finishedLotNo ? <LotLink lotNo={wo.result.finishedLotNo} /> : <span className="text-muted-foreground">{t('production.noFinishedLot')}</span>}
              />
              <StatBox label={t('fields.confirmedAt')} value={fmt.dateTime(wo.result.confirmedAt)} />
            </div>
            <div className="rounded-md border">
              <DataGrid
                columns={[
                  { key: 'lot', header: t('fields.inputLotNo'), cell: (c) => <LotLink lotNo={c.lotNo} /> },
                  { key: 'mat', header: t('fields.rawMaterial'), cell: (c) => <ItemCell code={c.itemCode} name={c.itemName} /> },
                  { key: 'qty', header: t('fields.actualUsage'), align: 'right', cell: (c) => `${fmt.number(c.qty)} ${unitLabel(c.unit)}` },
                ]}
                rows={wo.consumptions}
                rowKey={(c) => c.lotId}
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
