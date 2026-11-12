import { z } from 'zod';
import { ItemType, PartnerType, SalesOrderStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../../db.js';
import { AppError, ErrorCode, notFound } from '../../../lib/errors.js';
import { dateOnly, num, paging, toDbDate, type Paged } from '../../../lib/format.js';
import { DocPrefix, nextDocumentNo } from '../../../lib/sequence.js';
import { zDate, zId, zOptionalQuery, zOptionalText, zPagination } from '../../../lib/validate.js';
import { assertPartnerRole } from '../../master/partners/partners.service.js';

export const salesOrderCreateSchema = z
  .object({
    customerId: zId,
    itemId: zId,
    qty: z.coerce.number().int().positive().max(1_000_000),
    orderDate: zDate,
    dueDate: zDate,
    note: zOptionalText,
  })
  .refine((v) => v.dueDate >= v.orderDate, { path: ['dueDate'], message: 'due_before_order' });

export const salesOrderListSchema = z.object({
  q: zOptionalQuery,
  status: z.enum(SalesOrderStatus).optional(),
  from: zDate.optional(),
  to: zDate.optional(),
  ...zPagination,
});

const include = {
  customer: true,
  item: true,
  workOrders: { select: { id: true, workOrderNo: true, status: true, plannedQty: true } },
  shipments: { select: { qty: true } },
} as const satisfies Prisma.SalesOrderInclude;

type Row = Prisma.SalesOrderGetPayload<{ include: typeof include }>;

export type SalesOrderDto = ReturnType<typeof toDto>;

function toDto(o: Row) {
  const shippedQty = o.shipments.reduce((s, x) => s + x.qty, 0);
  return {
    id: o.id,
    orderNo: o.orderNo,
    orderDate: dateOnly(o.orderDate),
    dueDate: dateOnly(o.dueDate),
    qty: o.qty,
    shippedQty,
    remainingQty: o.qty - shippedQty,
    status: o.status,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
    customer: { id: o.customer.id, code: o.customer.code, name: o.customer.name },
    item: { id: o.item.id, code: o.item.code, name: o.item.name, unit: o.item.unit },
    workOrders: o.workOrders,
    plannedQty: o.workOrders.reduce((s, w) => s + w.plannedQty, 0),
  };
}

export async function listSalesOrders(input: z.output<typeof salesOrderListSchema>): Promise<Paged<SalesOrderDto>> {
  const where: Prisma.SalesOrderWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.from || input.to
      ? {
          dueDate: {
            ...(input.from ? { gte: toDbDate(input.from) } : {}),
            ...(input.to ? { lte: toDbDate(input.to) } : {}),
          },
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            { orderNo: { contains: input.q, mode: 'insensitive' } },
            { customer: { name: { contains: input.q, mode: 'insensitive' } } },
            { item: { code: { contains: input.q, mode: 'insensitive' } } },
            { item: { name: { contains: input.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { id: 'desc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.salesOrder.count({ where }),
  ]);
  return { items: rows.map(toDto), total, page: input.page, pageSize: input.pageSize };
}

export async function createSalesOrder(input: z.output<typeof salesOrderCreateSchema>): Promise<SalesOrderDto> {
  const created = await prisma.$transaction(async (tx) => {
    const [customer, item] = await Promise.all([
      tx.partner.findUnique({ where: { id: input.customerId } }),
      tx.item.findUnique({ where: { id: input.itemId } }),
    ]);
    if (!customer) throw notFound('partner', input.customerId);
    assertPartnerRole(customer, PartnerType.CUSTOMER);
    if (!item) throw notFound('item', input.itemId);
    if (item.type !== ItemType.FINISHED) {
      throw new AppError(400, ErrorCode.INVALID_ITEM_TYPE, 'Sales orders require a finished good', {
        itemCode: item.code,
        expected: ItemType.FINISHED,
      });
    }
    return tx.salesOrder.create({
      data: {
        orderNo: await nextDocumentNo(tx, DocPrefix.SALES_ORDER, input.orderDate),
        customerId: customer.id,
        itemId: item.id,
        qty: input.qty,
        orderDate: toDbDate(input.orderDate),
        dueDate: toDbDate(input.dueDate),
        note: input.note,
      },
      include,
    });
  });
  return toDto(created);
}

/** 수주 상세: 출하 가능한 완제품 LOT(선입선출 순)와 출하 이력 포함 */
export async function getSalesOrder(id: number) {
  const o = await prisma.salesOrder.findUnique({ where: { id }, include });
  if (!o) throw notFound('salesOrder', id);
  const [lots, shipments] = await Promise.all([
    prisma.lot.findMany({
      where: { itemId: o.itemId, qty: { gt: 0 } },
      include: { productionResult: { include: { workOrder: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.shipment.findMany({
      where: { salesOrderId: id },
      include: { lines: { include: { lot: true } }, createdBy: true },
      orderBy: [{ shipDate: 'desc' }, { id: 'desc' }],
    }),
  ]);
  return {
    ...toDto(o),
    availableLots: lots.map((l) => ({
      id: l.id,
      lotNo: l.lotNo,
      qty: num(l.qty),
      producedAt: l.createdAt.toISOString(),
      workOrderNo: l.productionResult?.workOrder.workOrderNo ?? null,
    })),
    shipments: shipments.map((s) => ({
      id: s.id,
      shipmentNo: s.shipmentNo,
      shipDate: dateOnly(s.shipDate),
      qty: s.qty,
      createdByName: s.createdBy?.name ?? null,
      lines: s.lines.map((l) => ({ lotId: l.lotId, lotNo: l.lot.lotNo, qty: num(l.qty) })),
    })),
  };
}
