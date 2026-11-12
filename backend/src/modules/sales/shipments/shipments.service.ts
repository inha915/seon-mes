import { z } from 'zod';
import { InventoryTxType, SalesOrderStatus, type Prisma, type User } from '@prisma/client';
import { prisma } from '../../../db.js';
import { AppError, ErrorCode, notFound } from '../../../lib/errors.js';
import { dateOnly, num, paging, toDbDate, type Paged } from '../../../lib/format.js';
import { DocPrefix, nextDocumentNo } from '../../../lib/sequence.js';
import { decrementLot, insufficientStock, shortageOf, type Shortage } from '../../../lib/stock.js';
import { zDate, zId, zOptionalQuery, zOptionalText, zPagination } from '../../../lib/validate.js';

export const shipmentCreateSchema = z.object({
  salesOrderId: zId,
  shipDate: zDate,
  note: zOptionalText,
  lines: z.array(z.object({ lotId: zId, qty: z.coerce.number().int().positive() })).min(1).max(50),
});

export const shipmentListSchema = z.object({
  q: zOptionalQuery,
  from: zDate.optional(),
  to: zDate.optional(),
  ...zPagination,
});

const include = {
  salesOrder: { include: { customer: true, item: true } },
  lines: { include: { lot: true }, orderBy: { id: 'asc' } },
  createdBy: true,
} as const satisfies Prisma.ShipmentInclude;

type Row = Prisma.ShipmentGetPayload<{ include: typeof include }>;
export type ShipmentDto = ReturnType<typeof toDto>;

function toDto(s: Row) {
  return {
    id: s.id,
    shipmentNo: s.shipmentNo,
    shipDate: dateOnly(s.shipDate),
    qty: s.qty,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    createdByName: s.createdBy?.name ?? null,
    salesOrder: {
      id: s.salesOrder.id,
      orderNo: s.salesOrder.orderNo,
      customerName: s.salesOrder.customer.name,
      item: { code: s.salesOrder.item.code, name: s.salesOrder.item.name, unit: s.salesOrder.item.unit },
    },
    lines: s.lines.map((l) => ({ lotId: l.lotId, lotNo: l.lot.lotNo, qty: num(l.qty) })),
  };
}

export async function listShipments(input: z.output<typeof shipmentListSchema>): Promise<Paged<ShipmentDto>> {
  const where: Prisma.ShipmentWhereInput = {
    ...(input.from || input.to
      ? {
          shipDate: {
            ...(input.from ? { gte: toDbDate(input.from) } : {}),
            ...(input.to ? { lte: toDbDate(input.to) } : {}),
          },
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            { shipmentNo: { contains: input.q, mode: 'insensitive' } },
            { salesOrder: { orderNo: { contains: input.q, mode: 'insensitive' } } },
            { salesOrder: { customer: { name: { contains: input.q, mode: 'insensitive' } } } },
            { lines: { some: { lot: { lotNo: { contains: input.q, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include,
      orderBy: [{ shipDate: 'desc' }, { id: 'desc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.shipment.count({ where }),
  ]);
  return { items: rows.map(toDto), total, page: input.page, pageSize: input.pageSize };
}

/**
 * 출하 (단일 트랜잭션)
 *  1. 수주 행 잠금(SELECT ... FOR UPDATE) — 같은 수주의 동시 출하가 잔량을 넘지 않도록 직렬화
 *  2. 잔량·LOT 품목·재고 확인 (부족 LOT 는 모두 모아 INSUFFICIENT_STOCK)
 *  3. 완제품 LOT 조건부 차감 + 출하 LOT 기록 + 수불(SHIPMENT)
 *  4. 수주 상태 갱신 (부분 출하 / 출하 완료)
 */
export async function createShipment(input: z.output<typeof shipmentCreateSchema>, user: User): Promise<ShipmentDto> {
  const lotIds = input.lines.map((l) => l.lotId);
  if (new Set(lotIds).size !== lotIds.length) {
    throw new AppError(400, ErrorCode.DUPLICATE_LOT_LINE, 'Same lot appears more than once');
  }
  const totalQty = input.lines.reduce((s, l) => s + l.qty, 0);

  const id = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM sales_orders WHERE id = ${input.salesOrderId} FOR UPDATE`;
      const so = await tx.salesOrder.findUnique({
        where: { id: input.salesOrderId },
        include: { shipments: { select: { qty: true } } },
      });
      if (!so) throw notFound('salesOrder', input.salesOrderId);
      if (so.status === SalesOrderStatus.SHIPPED) {
        throw new AppError(409, ErrorCode.SALES_ORDER_CLOSED, 'Sales order already shipped', { orderNo: so.orderNo });
      }
      const shipped = so.shipments.reduce((s, x) => s + x.qty, 0);
      const remaining = so.qty - shipped;
      if (totalQty > remaining) {
        throw new AppError(409, ErrorCode.SHIPMENT_EXCEEDS_ORDER, 'Shipment exceeds remaining order quantity', {
          orderNo: so.orderNo,
          remainingQty: remaining,
          requestedQty: totalQty,
        });
      }

      const lots = await tx.lot.findMany({ where: { id: { in: lotIds } }, include: { item: true } });
      const lotById = new Map(lots.map((l) => [l.id, l]));
      const shortages: Shortage[] = [];
      for (const line of input.lines) {
        const lot = lotById.get(line.lotId);
        if (!lot) throw notFound('lot', line.lotId);
        if (lot.itemId !== so.itemId) {
          throw new AppError(400, ErrorCode.LOT_ITEM_MISMATCH, 'Lot item differs from the sales order item', {
            lotNo: lot.lotNo,
            itemCode: lot.item.code,
          });
        }
        if (num(lot.qty) < line.qty) shortages.push(shortageOf(lot, line.qty, num(lot.qty)));
      }
      if (shortages.length > 0) throw insufficientStock(shortages);

      const shipment = await tx.shipment.create({
        data: {
          shipmentNo: await nextDocumentNo(tx, DocPrefix.SHIPMENT, input.shipDate),
          salesOrderId: so.id,
          shipDate: toDbDate(input.shipDate),
          qty: totalQty,
          note: input.note,
          createdById: user.id,
        },
      });

      for (const line of [...input.lines].sort((a, b) => a.lotId - b.lotId)) {
        const lot = lotById.get(line.lotId)!;
        const balance = await decrementLot(tx, line.lotId, line.qty);
        if (balance === null) {
          const current = await tx.lot.findUniqueOrThrow({ where: { id: line.lotId } });
          throw insufficientStock([shortageOf(lot, line.qty, num(current.qty))]);
        }
        await tx.shipmentLine.create({ data: { shipmentId: shipment.id, lotId: line.lotId, qty: line.qty } });
        await tx.inventoryTransaction.create({
          data: {
            type: InventoryTxType.SHIPMENT,
            itemId: lot.itemId,
            lotId: line.lotId,
            qty: -line.qty,
            balanceAfter: balance,
            shipmentId: shipment.id,
          },
        });
      }

      await tx.salesOrder.update({
        where: { id: so.id },
        data: { status: shipped + totalQty >= so.qty ? SalesOrderStatus.SHIPPED : SalesOrderStatus.PARTIALLY_SHIPPED },
      });
      return shipment.id;
    },
    { timeout: 15_000, maxWait: 10_000 },
  );
  return toDto(await prisma.shipment.findUniqueOrThrow({ where: { id }, include }));
}
