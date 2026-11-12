import { z } from 'zod';
import { InventoryTxType, ItemType, type Prisma } from '@prisma/client';
import { prisma } from '../../../db.js';
import { dateOnly, dayRange as dateRange, num, paging, type Paged } from '../../../lib/format.js';
import { zDate, zOptionalQuery, zPagination } from '../../../lib/validate.js';

const zBoolQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

// ---------------------------------------------------------------------------
// 품목별 현재고
// ---------------------------------------------------------------------------
export const itemStockSchema = z.object({
  q: zOptionalQuery,
  type: z.enum(ItemType).optional(),
  ...zPagination,
});

export async function listItemStock(input: z.output<typeof itemStockSchema>) {
  const where: Prisma.ItemWhereInput = {
    ...(input.type ? { type: input.type } : {}),
    ...(input.q
      ? {
          OR: [
            { code: { contains: input.q, mode: 'insensitive' } },
            { name: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.item.findMany({ where, orderBy: [{ type: 'asc' }, { code: 'asc' }], ...paging(input.page, input.pageSize) }),
    prisma.item.count({ where }),
  ]);
  const ids = items.map((i) => i.id);
  const sums = await prisma.lot.groupBy({
    by: ['itemId'],
    where: { itemId: { in: ids } },
    _sum: { qty: true },
  });
  const lotCounts = await prisma.lot.groupBy({
    by: ['itemId'],
    where: { itemId: { in: ids }, qty: { gt: 0 } },
    _count: { _all: true },
  });
  const sumMap = new Map(sums.map((s) => [s.itemId, num(s._sum.qty)]));
  const countMap = new Map(lotCounts.map((s) => [s.itemId, s._count._all]));
  return {
    items: items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      type: i.type,
      unit: i.unit,
      stockQty: sumMap.get(i.id) ?? 0,
      activeLotCount: countMap.get(i.id) ?? 0,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

// ---------------------------------------------------------------------------
// LOT 별 현재고
// ---------------------------------------------------------------------------
export const lotStockSchema = z.object({
  q: zOptionalQuery, // 품번·품명
  lotNo: zOptionalQuery,
  type: z.enum(ItemType).optional(),
  itemId: z.coerce.number().int().positive().optional(),
  from: zDate.optional(),
  to: zDate.optional(),
  includeEmpty: zBoolQuery,
  ...zPagination,
});

export type LotStockDto = {
  id: number;
  lotNo: string;
  qty: number;
  initialQty: number;
  createdAt: string;
  item: { id: number; code: string; name: string; type: ItemType; unit: string };
  source: { kind: 'RECEIPT'; receiptNo: string; receiptDate: string; partnerName: string } | { kind: 'PRODUCTION'; workOrderNo: string; workOrderId: number } | null;
};

export async function listLotStock(input: z.output<typeof lotStockSchema>): Promise<Paged<LotStockDto>> {
  const created = dateRange(input.from, input.to);
  const where: Prisma.LotWhereInput = {
    ...(input.includeEmpty ? {} : { qty: { gt: 0 } }),
    ...(input.lotNo ? { lotNo: { contains: input.lotNo, mode: 'insensitive' } } : {}),
    ...(input.itemId ? { itemId: input.itemId } : {}),
    ...(created ? { createdAt: created } : {}),
    item: {
      ...(input.type ? { type: input.type } : {}),
      ...(input.q
        ? {
            OR: [
              { code: { contains: input.q, mode: 'insensitive' } },
              { name: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  };
  const [rows, total] = await Promise.all([
    prisma.lot.findMany({
      where,
      include: {
        item: true,
        receipt: { include: { partner: true } },
        productionResult: { include: { workOrder: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.lot.count({ where }),
  ]);
  return {
    items: rows.map((l) => ({
      id: l.id,
      lotNo: l.lotNo,
      qty: num(l.qty),
      initialQty: num(l.initialQty),
      createdAt: l.createdAt.toISOString(),
      item: { id: l.item.id, code: l.item.code, name: l.item.name, type: l.item.type, unit: l.item.unit },
      source: l.receipt
        ? {
            kind: 'RECEIPT' as const,
            receiptNo: l.receipt.receiptNo,
            receiptDate: dateOnly(l.receipt.receiptDate),
            partnerName: l.receipt.partner.name,
          }
        : l.productionResult
          ? {
              kind: 'PRODUCTION' as const,
              workOrderNo: l.productionResult.workOrder.workOrderNo,
              workOrderId: l.productionResult.workOrder.id,
            }
          : null,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

// ---------------------------------------------------------------------------
// 수불 이력
// ---------------------------------------------------------------------------
export const transactionListSchema = z.object({
  q: zOptionalQuery, // 품번·품명
  lotNo: zOptionalQuery,
  type: z.enum(InventoryTxType).optional(),
  from: zDate.optional(),
  to: zDate.optional(),
  ...zPagination,
});

export type TransactionDto = {
  id: number;
  type: InventoryTxType;
  qty: number;
  balanceAfter: number;
  occurredAt: string;
  item: { id: number; code: string; name: string; unit: string };
  lot: { id: number; lotNo: string };
  reference:
    | { kind: 'RECEIPT'; no: string }
    | { kind: 'PRODUCTION'; no: string; workOrderNo: string; workOrderId: number }
    | { kind: 'SHIPMENT'; no: string; orderNo: string; customerName: string }
    | null;
};

export async function listTransactions(input: z.output<typeof transactionListSchema>): Promise<Paged<TransactionDto>> {
  const occurred = dateRange(input.from, input.to);
  const where: Prisma.InventoryTransactionWhereInput = {
    ...(input.type ? { type: input.type } : {}),
    ...(occurred ? { occurredAt: occurred } : {}),
    ...(input.lotNo ? { lot: { lotNo: { contains: input.lotNo, mode: 'insensitive' } } } : {}),
    ...(input.q
      ? {
          item: {
            OR: [
              { code: { contains: input.q, mode: 'insensitive' } },
              { name: { contains: input.q, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        item: true,
        lot: true,
        receipt: true,
        productionResult: { include: { workOrder: true } },
        shipment: { include: { salesOrder: { include: { customer: true } } } },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);
  return {
    items: rows.map((t) => ({
      id: t.id,
      type: t.type,
      qty: num(t.qty),
      balanceAfter: num(t.balanceAfter),
      occurredAt: t.occurredAt.toISOString(),
      item: { id: t.item.id, code: t.item.code, name: t.item.name, unit: t.item.unit },
      lot: { id: t.lot.id, lotNo: t.lot.lotNo },
      reference: t.receipt
        ? { kind: 'RECEIPT' as const, no: t.receipt.receiptNo }
        : t.productionResult
          ? {
              kind: 'PRODUCTION' as const,
              no: t.productionResult.resultNo,
              workOrderNo: t.productionResult.workOrder.workOrderNo,
              workOrderId: t.productionResult.workOrder.id,
            }
          : t.shipment
            ? {
                kind: 'SHIPMENT' as const,
                no: t.shipment.shipmentNo,
                orderNo: t.shipment.salesOrder.orderNo,
                customerName: t.shipment.salesOrder.customer.name,
              }
            : null,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}
