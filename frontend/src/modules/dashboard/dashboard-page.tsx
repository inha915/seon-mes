import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BadgeCheck, Boxes, ClipboardList, Cog, PackageCheck, ShoppingCart, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CodeBadge, CodeText, ItemCell, LotLink, useCodeLabel } from '@/shared/components/code-badge';
import { DataGrid } from '@/shared/components/data-grid';
import { KpiCard } from '@/shared/components/kpi-card';
import { Panel } from '@/shared/components/panel';
import { ErrorState } from '@/shared/components/query-state';
import { Screen } from '@/shared/components/screen';
import { codeValues } from '@/shared/codes';
import { api } from '@/shared/lib/api';
import { useFormat } from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/query';
import type { Receipt } from '../inventory/types';
import type { EquipmentStatus, SalesOrderStatus, WorkOrderStatus } from '@/shared/types';

interface Dashboard {
  today: string;
  openWorkOrderCount: number;
  openWorkOrders: {
    id: number;
    workOrderNo: string;
    workDate: string;
    plannedQty: number;
    status: WorkOrderStatus;
    equipmentCode: string | null;
    item: { id: number; code: string; name: string; unit: string };
  }[];
  todayProduction: { resultCount: number; goodQty: number; defectQty: number; defectRate: number | null };
  activeLotCount: number;
  pendingApprovalCount: number;
  openSalesOrderCount: number;
  dueSalesOrders: {
    id: number;
    orderNo: string;
    dueDate: string;
    status: SalesOrderStatus;
    qty: number;
    shippedQty: number;
    customerName: string;
    item: { code: string; name: string; unit: string };
  }[];
  equipmentStatus: Partial<Record<EquipmentStatus, number>>;
  recentReceipts: Receipt[];
}

export function DashboardPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const unitLabel = useCodeLabel('unit');
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.get<Dashboard>('/dashboard') });
  const d = query.data;
  const eqTotal = d ? Object.values(d.equipmentStatus).reduce((s, n) => s + (n ?? 0), 0) : 0;

  if (query.isError) {
    return (
      <Screen title={t('dashboard.title')}>
        <Panel>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen title={t('dashboard.title')} description={d ? t('dashboard.description', { date: fmt.date(d.today) }) : undefined}>
      <div className="grid grid-cols-6 gap-3">
        <KpiCard icon={<ClipboardList />} label={t('dashboard.openWorkOrders')} value={d && fmt.number(d.openWorkOrderCount)} to="/production/work-orders" />
        <KpiCard icon={<PackageCheck />} tone="success" label={t('dashboard.todayGood')} value={d && fmt.number(d.todayProduction.goodQty)} />
        <KpiCard
          icon={<TriangleAlert />}
          tone="destructive"
          label={t('dashboard.todayDefect')}
          value={d && fmt.number(d.todayProduction.defectQty)}
          sub={d && d.todayProduction.defectRate !== null ? t('dashboard.defectRate', { rate: fmt.percent(d.todayProduction.defectRate) }) : undefined}
        />
        <KpiCard icon={<BadgeCheck />} tone="warning" label={t('dashboard.pendingApprovals')} value={d && fmt.number(d.pendingApprovalCount)} to="/approval/inbox" testId="kpi-approvals" />
        <KpiCard icon={<ShoppingCart />} tone="info" label={t('dashboard.openSalesOrders')} value={d && fmt.number(d.openSalesOrderCount)} to="/sales/orders" />
        <KpiCard
          icon={<Cog />}
          label={t('dashboard.equipmentRunning')}
          value={d && `${fmt.number(d.equipmentStatus.RUNNING ?? 0)} / ${fmt.number(eqTotal)}`}
          to="/equipment/equipments"
        />
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        <Panel
          title={t('dashboard.openWorkOrderList')}
          icon={<ClipboardList />}
          actions={
            <Link to="/production/work-orders" className="text-[12.5px] text-link hover:underline">
              {t('common.viewAll')}
            </Link>
          }
          bodyClassName="p-0"
        >
          <DataGrid
            columns={[
              {
                key: 'no',
                header: t('fields.workOrderNo'),
                cell: (wo) => (
                  <Link to="/production/results" search={{ workOrderId: wo.id }} className="code-link">
                    {wo.workOrderNo}
                  </Link>
                ),
              },
              { key: 'date', header: t('fields.workDate'), cell: (wo) => fmt.date(wo.workDate) },
              { key: 'item', header: t('fields.finishedGood'), cell: (wo) => <ItemCell code={wo.item.code} name={wo.item.name} /> },
              { key: 'eq', header: t('fields.equipment'), cell: (wo) => <CodeText>{wo.equipmentCode ?? '-'}</CodeText> },
              { key: 'qty', header: t('fields.plannedQty'), align: 'right', cell: (wo) => `${fmt.number(wo.plannedQty)} ${unitLabel(wo.item.unit)}` },
            ]}
            rows={d?.openWorkOrders}
            rowKey={(wo) => wo.id}
            query={query}
            skeletonRows={3}
            emptyMessage={t('dashboard.noOpenWorkOrders')}
          />
        </Panel>

        <Panel
          title={t('dashboard.dueSalesOrders')}
          icon={<ShoppingCart />}
          actions={
            <Link to="/sales/orders" className="text-[12.5px] text-link hover:underline">
              {t('common.viewAll')}
            </Link>
          }
          bodyClassName="p-0"
        >
          <DataGrid
            columns={[
              {
                key: 'no',
                header: t('fields.orderNo'),
                cell: (o) => (
                  <Link to="/sales/orders/$salesOrderId" params={{ salesOrderId: String(o.id) }} className="code-link">
                    {o.orderNo}
                  </Link>
                ),
              },
              { key: 'due', header: t('fields.dueDate'), cell: (o) => fmt.date(o.dueDate) },
              { key: 'customer', header: t('fields.customer'), cell: (o) => o.customerName },
              { key: 'item', header: t('fields.finishedGood'), cell: (o) => <CodeText>{o.item.code}</CodeText> },
              { key: 'qty', header: t('dashboard.shippedOfOrdered'), align: 'right', cell: (o) => `${fmt.number(o.shippedQty)} / ${fmt.number(o.qty)}` },
              { key: 'status', header: t('fields.status'), cell: (o) => <CodeBadge group="salesOrderStatus" value={o.status} /> },
            ]}
            rows={d?.dueSalesOrders}
            rowKey={(o) => o.id}
            query={query}
            skeletonRows={3}
            emptyMessage={t('dashboard.noSalesOrders')}
          />
        </Panel>

        <Panel
          title={t('dashboard.recentReceipts')}
          icon={<Boxes />}
          actions={
            <Link to="/inventory/receipts" className="text-[12.5px] text-link hover:underline">
              {t('common.viewAll')}
            </Link>
          }
          bodyClassName="p-0"
        >
          <DataGrid
            columns={[
              { key: 'date', header: t('fields.receiptDate'), cell: (r) => fmt.date(r.receiptDate) },
              { key: 'lot', header: t('fields.lotNo'), cell: (r) => <LotLink lotNo={r.lot.lotNo} /> },
              { key: 'partner', header: t('fields.supplier'), cell: (r) => r.partner.name },
              { key: 'item', header: t('fields.item'), cell: (r) => <CodeText>{r.item.code}</CodeText> },
              { key: 'qty', header: t('fields.qty'), align: 'right', cell: (r) => `${fmt.number(r.qty)} ${unitLabel(r.item.unit)}` },
            ]}
            rows={d?.recentReceipts}
            rowKey={(r) => r.id}
            query={query}
            skeletonRows={3}
            emptyMessage={t('dashboard.noReceipts')}
          />
        </Panel>

        <Panel title={t('dashboard.equipmentStatus')} icon={<Cog />}>
          <div className="grid grid-cols-4 gap-2">
            {codeValues('equipmentStatus').map((s) => (
              <Link key={s} to="/equipment/equipments" className="rounded-md border px-3 py-2 transition-colors hover:border-primary/40">
                <CodeBadge group="equipmentStatus" value={s} />
                <div className="mt-1 text-2xl font-bold tabular-nums">{d ? fmt.number(d.equipmentStatus[s] ?? 0) : '-'}</div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
