import { z } from 'zod';
import { InventoryTxType, ItemType, PartnerType, type Prisma } from '@prisma/client';
import { assertPartnerRole } from '../../master/partners/partners.service.js';
import { prisma } from '../../../db.js';
import { AppError, ErrorCode, notFound } from '../../../lib/errors.js';
import { dateOnly, num, paging, toDbDate, type Paged } from '../../../lib/format.js';
import { DocPrefix, nextDocumentNo } from '../../../lib/sequence.js';
import { zDate, zId, zOptionalQuery, zOptionalText, zPagination, zQty } from '../../../lib/validate.js';

export const receiptCreateSchema = z.object({
  partnerId: zId,
  itemId: zId,
  receiptDate: zDate,
  qty: zQty,
  supplierLotNo: zOptionalText,
  note: zOptionalText,
});

export const receiptListSchema = z.object({
  q: zOptionalQuery,
  from: zDate.optional(),
  to: zDate.optional(),
  ...zPagination,
});

export type ReceiptDto = {
  id: number;
  receiptNo: string;
  receiptDate: string;
  qty: number;
  supplierLotNo: string | null;
  note: string | null;
  createdAt: string;
  partner: { id: number; code: string; name: string };
  item: { id: number; code: string; name: string; unit: string };
  lot: { id: number; lotNo: string; qty: number };
};

const receiptInclude = { partner: true, item: true, lot: true } as const;
type ReceiptRow = Prisma.ReceiptGetPayload<{ include: typeof receiptInclude }>;

export function toReceiptDto(r: ReceiptRow): ReceiptDto {
  return {
    id: r.id,
    receiptNo: r.receiptNo,
    receiptDate: dateOnly(r.receiptDate),
    qty: num(r.qty),
    supplierLotNo: r.supplierLotNo,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    partner: { id: r.partner.id, code: r.partner.code, name: r.partner.name },
    item: { id: r.item.id, code: r.item.code, name: r.item.name, unit: r.item.unit },
    lot: { id: r.lot.id, lotNo: r.lot.lotNo, qty: num(r.lot.qty) },
  };
}

export async function listReceipts(input: z.output<typeof receiptListSchema>): Promise<Paged<ReceiptDto>> {
  const where: Prisma.ReceiptWhereInput = {
    ...(input.from || input.to
      ? {
          receiptDate: {
            ...(input.from ? { gte: toDbDate(input.from) } : {}),
            ...(input.to ? { lte: toDbDate(input.to) } : {}),
          },
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            { receiptNo: { contains: input.q, mode: 'insensitive' } },
            { lot: { lotNo: { contains: input.q, mode: 'insensitive' } } },
            { item: { code: { contains: input.q, mode: 'insensitive' } } },
            { item: { name: { contains: input.q, mode: 'insensitive' } } },
            { partner: { name: { contains: input.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: receiptInclude,
      orderBy: [{ receiptDate: 'desc' }, { id: 'desc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.receipt.count({ where }),
  ]);
  return { items: rows.map(toReceiptDto), total, page: input.page, pageSize: input.pageSize };
}

/**
 * 원자재 입고: 입고 등록 + 내부 LOT 발급 + 수불 이력(MATERIAL_RECEIPT)을 하나의 트랜잭션으로 처리합니다.
 */
export async function createReceipt(input: z.output<typeof receiptCreateSchema>): Promise<ReceiptDto> {
  const created = await prisma.$transaction(async (tx) => {
    const [partner, item] = await Promise.all([
      tx.partner.findUnique({ where: { id: input.partnerId } }),
      tx.item.findUnique({ where: { id: input.itemId } }),
    ]);
    if (!partner) throw notFound('partner', input.partnerId);
    assertPartnerRole(partner, PartnerType.SUPPLIER);
    if (!item) throw notFound('item', input.itemId);
    if (item.type !== ItemType.RAW) {
      throw new AppError(400, ErrorCode.INVALID_ITEM_TYPE, 'Only raw materials can be received', {
        itemCode: item.code,
        expected: ItemType.RAW,
      });
    }

    const lotNo = await nextDocumentNo(tx, DocPrefix.RAW_LOT, input.receiptDate);
    const receiptNo = await nextDocumentNo(tx, DocPrefix.RECEIPT, input.receiptDate);

    const lot = await tx.lot.create({
      data: { lotNo, itemId: item.id, initialQty: input.qty, qty: input.qty },
    });
    const receipt = await tx.receipt.create({
      data: {
        receiptNo,
        partnerId: partner.id,
        itemId: item.id,
        lotId: lot.id,
        receiptDate: toDbDate(input.receiptDate),
        qty: input.qty,
        supplierLotNo: input.supplierLotNo,
        note: input.note,
      },
      include: receiptInclude,
    });
    await tx.inventoryTransaction.create({
      data: {
        type: InventoryTxType.MATERIAL_RECEIPT,
        itemId: item.id,
        lotId: lot.id,
        qty: input.qty,
        balanceAfter: input.qty,
        receiptId: receipt.id,
      },
    });
    return receipt;
  });
  return toReceiptDto(created);
}
