import { ApprovalStatus, SalesOrderStatus, WorkOrderStatus } from '@prisma/client';
import { prisma } from '../../db.js';
import { dateOnly, dayRange, todayString } from '../../lib/format.js';
import { listReceipts } from '../inventory/receipts/receipts.service.js';

/** 대시보드: 실제 DB 데이터로 생산·영업·결재·설비 현황을 집계합니다. */
export async function getDashboard() {
  const today = todayString();
  const todayRange = dayRange(today, today)!;

  const [
    openOrders,
    openCount,
    todayAgg,
    todayResultCount,
    recentReceipts,
    stockLots,
    pendingApprovals,
    openSalesOrders,
    dueSalesOrders,
    equipmentGroups,
  ] = await Promise.all([
    prisma.workOrder.findMany({
      where: { status: WorkOrderStatus.PLANNED },
      include: { item: true, equipment: true },
      orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
      take: 8,
    }),
    prisma.workOrder.count({ where: { status: WorkOrderStatus.PLANNED } }),
    prisma.productionResult.aggregate({
      where: { confirmedAt: todayRange },
      _sum: { goodQty: true, defectQty: true },
    }),
    prisma.productionResult.count({ where: { confirmedAt: todayRange } }),
    listReceipts({ q: undefined, page: 1, pageSize: 5 }),
    prisma.lot.count({ where: { qty: { gt: 0 } } }),
    prisma.approvalRequest.count({ where: { status: ApprovalStatus.PENDING } }),
    prisma.salesOrder.count({ where: { status: { not: SalesOrderStatus.SHIPPED } } }),
    prisma.salesOrder.findMany({
      where: { status: { not: SalesOrderStatus.SHIPPED } },
      include: { customer: true, item: true, shipments: { select: { qty: true } } },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: 5,
    }),
    prisma.equipment.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const good = todayAgg._sum.goodQty ?? 0;
  const defect = todayAgg._sum.defectQty ?? 0;
  return {
    today,
    openWorkOrderCount: openCount,
    openWorkOrders: openOrders.map((wo) => ({
      id: wo.id,
      workOrderNo: wo.workOrderNo,
      workDate: dateOnly(wo.workDate),
      plannedQty: wo.plannedQty,
      status: wo.status,
      equipmentCode: wo.equipment?.code ?? null,
      item: { id: wo.item.id, code: wo.item.code, name: wo.item.name, unit: wo.item.unit },
    })),
    todayProduction: {
      resultCount: todayResultCount,
      goodQty: good,
      defectQty: defect,
      defectRate: good + defect > 0 ? Math.round((defect / (good + defect)) * 1000) / 10 : null,
    },
    activeLotCount: stockLots,
    pendingApprovalCount: pendingApprovals,
    openSalesOrderCount: openSalesOrders,
    dueSalesOrders: dueSalesOrders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      dueDate: dateOnly(o.dueDate),
      status: o.status,
      qty: o.qty,
      shippedQty: o.shipments.reduce((s, x) => s + x.qty, 0),
      customerName: o.customer.name,
      item: { code: o.item.code, name: o.item.name, unit: o.item.unit },
    })),
    equipmentStatus: Object.fromEntries(equipmentGroups.map((g) => [g.status, g._count._all])) as Record<string, number>,
    recentReceipts: recentReceipts.items,
  };
}
