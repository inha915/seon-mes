import { ItemType, type InventoryTxType } from '@prisma/client';
import { prisma } from '../../../db.js';
import { notFound } from '../../../lib/errors.js';
import { dateOnly, num } from '../../../lib/format.js';

type ReceiptRef = {
  id: number;
  receiptNo: string;
  receiptDate: string;
  qty: number;
  supplierLotNo: string | null;
  partner: { id: number; code: string; name: string };
};

export type LotTraceDto = {
  lot: {
    id: number;
    lotNo: string;
    qty: number;
    initialQty: number;
    createdAt: string;
    item: { id: number; code: string; name: string; type: ItemType; unit: string };
  };
  /** 완제품 LOT: 이 LOT 를 만든 생산실적과 작업지시 */
  production: {
    resultId: number;
    resultNo: string;
    goodQty: number;
    defectQty: number;
    confirmedAt: string;
    workOrder: { id: number; workOrderNo: string; plannedQty: number; workDate: string };
  } | null;
  /** 완제품 LOT: 투입된 원자재 LOT 와 각 LOT 의 최초 입고 내역 (역추적) */
  materials: {
    lot: { id: number; lotNo: string; qty: number; initialQty: number };
    item: { id: number; code: string; name: string; unit: string };
    consumedQty: number;
    receipt: ReceiptRef | null;
  }[];
  /** 원자재 LOT: 최초 입고 내역 */
  receipt: ReceiptRef | null;
  /** 원자재 LOT: 이 LOT 를 사용한 생산실적 (정추적) */
  usedIn: {
    resultId: number;
    resultNo: string;
    confirmedAt: string;
    consumedQty: number;
    workOrder: { id: number; workOrderNo: string };
    item: { code: string; name: string };
    finishedLotNo: string | null;
  }[];
  /** 완제품 LOT: 고객 출하 내역 (정추적) */
  shipments: {
    shipmentId: number;
    shipmentNo: string;
    shipDate: string;
    qty: number;
    salesOrder: { id: number; orderNo: string };
    customer: { code: string; name: string };
  }[];
  transactions: {
    id: number;
    type: InventoryTxType;
    qty: number;
    balanceAfter: number;
    occurredAt: string;
  }[];
};

const receiptRef = (r: {
  id: number;
  receiptNo: string;
  receiptDate: Date;
  qty: unknown;
  supplierLotNo: string | null;
  partner: { id: number; code: string; name: string };
}): ReceiptRef => ({
  id: r.id,
  receiptNo: r.receiptNo,
  receiptDate: dateOnly(r.receiptDate),
  qty: Number(r.qty),
  supplierLotNo: r.supplierLotNo,
  partner: { id: r.partner.id, code: r.partner.code, name: r.partner.name },
});

/** LOT 상세 + 추적: 완제품이면 역추적(원자재·입고까지)과 출하처, 원자재면 입고 내역과 사용처를 반환합니다. */
export async function traceLot(lotNo: string): Promise<LotTraceDto> {
  const lot = await prisma.lot.findUnique({
    where: { lotNo },
    include: {
      item: true,
      receipt: { include: { partner: true } },
      productionResult: {
        include: {
          workOrder: true,
          consumptions: {
            include: { lot: { include: { item: true, receipt: { include: { partner: true } } } } },
            orderBy: { id: 'asc' },
          },
        },
      },
      consumptions: {
        include: { productionResult: { include: { workOrder: { include: { item: true } }, finishedLot: true } } },
        orderBy: { id: 'asc' },
      },
      shipmentLines: {
        include: { shipment: { include: { salesOrder: { include: { customer: true } } } } },
        orderBy: { id: 'asc' },
      },
      transactions: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!lot) throw notFound('lot', lotNo);

  const pr = lot.productionResult;
  return {
    lot: {
      id: lot.id,
      lotNo: lot.lotNo,
      qty: num(lot.qty),
      initialQty: num(lot.initialQty),
      createdAt: lot.createdAt.toISOString(),
      item: { id: lot.item.id, code: lot.item.code, name: lot.item.name, type: lot.item.type, unit: lot.item.unit },
    },
    production: pr
      ? {
          resultId: pr.id,
          resultNo: pr.resultNo,
          goodQty: pr.goodQty,
          defectQty: pr.defectQty,
          confirmedAt: pr.confirmedAt.toISOString(),
          workOrder: {
            id: pr.workOrder.id,
            workOrderNo: pr.workOrder.workOrderNo,
            plannedQty: pr.workOrder.plannedQty,
            workDate: dateOnly(pr.workOrder.workDate),
          },
        }
      : null,
    materials: pr
      ? pr.consumptions.map((c) => ({
          lot: { id: c.lot.id, lotNo: c.lot.lotNo, qty: num(c.lot.qty), initialQty: num(c.lot.initialQty) },
          item: { id: c.lot.item.id, code: c.lot.item.code, name: c.lot.item.name, unit: c.lot.item.unit },
          consumedQty: num(c.qty),
          receipt: c.lot.receipt ? receiptRef(c.lot.receipt) : null,
        }))
      : [],
    receipt: lot.receipt ? receiptRef(lot.receipt) : null,
    usedIn:
      lot.item.type === ItemType.RAW
        ? lot.consumptions.map((c) => ({
            resultId: c.productionResult.id,
            resultNo: c.productionResult.resultNo,
            confirmedAt: c.productionResult.confirmedAt.toISOString(),
            consumedQty: num(c.qty),
            workOrder: { id: c.productionResult.workOrder.id, workOrderNo: c.productionResult.workOrder.workOrderNo },
            item: { code: c.productionResult.workOrder.item.code, name: c.productionResult.workOrder.item.name },
            finishedLotNo: c.productionResult.finishedLot?.lotNo ?? null,
          }))
        : [],
    shipments: lot.shipmentLines.map((l) => ({
      shipmentId: l.shipment.id,
      shipmentNo: l.shipment.shipmentNo,
      shipDate: dateOnly(l.shipment.shipDate),
      qty: num(l.qty),
      salesOrder: { id: l.shipment.salesOrder.id, orderNo: l.shipment.salesOrder.orderNo },
      customer: { code: l.shipment.salesOrder.customer.code, name: l.shipment.salesOrder.customer.name },
    })),
    transactions: lot.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      qty: num(t.qty),
      balanceAfter: num(t.balanceAfter),
      occurredAt: t.occurredAt.toISOString(),
    })),
  };
}
