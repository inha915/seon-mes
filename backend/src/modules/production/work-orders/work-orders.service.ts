import { z } from 'zod';
import {
  ApprovalStatus,
  EquipmentStatus,
  ItemType,
  SalesOrderStatus,
  WorkOrderStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../../db.js';
import { AppError, ErrorCode, notFound } from '../../../lib/errors.js';
import { dateOnly, num, paging, toDbDate, type Paged } from '../../../lib/format.js';
import { DocPrefix, nextDocumentNo } from '../../../lib/sequence.js';
import { zDate, zId, zOptionalQuery, zOptionalText, zPagination } from '../../../lib/validate.js';

export const workOrderCreateSchema = z.object({
  itemId: zId,
  plannedQty: z.coerce.number().int().positive().max(1_000_000),
  workDate: zDate,
  salesOrderId: zId.optional().nullable(),
  equipmentId: zId.optional().nullable(),
  note: zOptionalText,
});

export const workOrderListSchema = z.object({
  q: zOptionalQuery,
  status: z.enum(WorkOrderStatus).optional(),
  salesOrderId: z.coerce.number().int().positive().optional(),
  ...zPagination,
});

/** 작업지시에 지정할 수 없는 설비 상태 */
export const UNAVAILABLE_EQUIPMENT: EquipmentStatus[] = [EquipmentStatus.BREAKDOWN, EquipmentStatus.MAINTENANCE];

const round3 = (v: number) => Math.round(v * 1000) / 1000;

const workOrderInclude = {
  item: { include: { bomLines: { include: { component: true }, orderBy: { id: 'asc' } } } },
  productionResult: { include: { finishedLot: true } },
  salesOrder: { include: { customer: true } },
  equipment: true,
  approvals: { where: { status: ApprovalStatus.PENDING }, include: { requester: true } },
} as const satisfies Prisma.WorkOrderInclude;

type WorkOrderRow = Prisma.WorkOrderGetPayload<{ include: typeof workOrderInclude }>;

export type RequirementDto = {
  componentId: number;
  componentCode: string;
  componentName: string;
  unit: string;
  qtyPer: number;
  /** BOM 기준 예상 소요량 = 계획 수량 × 기준 소요량 */
  requiredQty: number;
};

export type WorkOrderDto = ReturnType<typeof toWorkOrderDto>;

function toWorkOrderDto(wo: WorkOrderRow) {
  const pending = wo.approvals[0];
  return {
    id: wo.id,
    workOrderNo: wo.workOrderNo,
    workDate: dateOnly(wo.workDate),
    plannedQty: wo.plannedQty,
    status: wo.status,
    note: wo.note,
    createdAt: wo.createdAt.toISOString(),
    completedAt: wo.completedAt?.toISOString() ?? null,
    item: { id: wo.item.id, code: wo.item.code, name: wo.item.name, unit: wo.item.unit },
    salesOrder: wo.salesOrder
      ? { id: wo.salesOrder.id, orderNo: wo.salesOrder.orderNo, customerName: wo.salesOrder.customer.name }
      : null,
    equipment: wo.equipment
      ? { id: wo.equipment.id, code: wo.equipment.code, name: wo.equipment.name, status: wo.equipment.status }
      : null,
    pendingApproval: pending
      ? { id: pending.id, requestNo: pending.requestNo, requesterName: pending.requester.name, requestedAt: pending.requestedAt.toISOString() }
      : null,
    requirements: wo.item.bomLines.map(
      (l): RequirementDto => ({
        componentId: l.componentId,
        componentCode: l.component.code,
        componentName: l.component.name,
        unit: l.component.unit,
        qtyPer: num(l.qtyPer),
        requiredQty: round3(num(l.qtyPer) * wo.plannedQty),
      }),
    ),
    result: wo.productionResult
      ? {
          id: wo.productionResult.id,
          resultNo: wo.productionResult.resultNo,
          goodQty: wo.productionResult.goodQty,
          defectQty: wo.productionResult.defectQty,
          confirmedAt: wo.productionResult.confirmedAt.toISOString(),
          finishedLotNo: wo.productionResult.finishedLot?.lotNo ?? null,
        }
      : null,
  };
}

export async function listWorkOrders(input: z.output<typeof workOrderListSchema>): Promise<Paged<WorkOrderDto>> {
  const where: Prisma.WorkOrderWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.salesOrderId ? { salesOrderId: input.salesOrderId } : {}),
    ...(input.q
      ? {
          OR: [
            { workOrderNo: { contains: input.q, mode: 'insensitive' } },
            { item: { code: { contains: input.q, mode: 'insensitive' } } },
            { item: { name: { contains: input.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: workOrderInclude,
      // 미완료 작업을 먼저, 그 안에서는 작업일 순
      orderBy: [{ status: 'asc' }, { workDate: 'desc' }, { id: 'desc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.workOrder.count({ where }),
  ]);
  return { items: rows.map(toWorkOrderDto), total, page: input.page, pageSize: input.pageSize };
}

/**
 * 작업지시 등록
 * - 완제품 + BOM 필수
 * - 수주 연계 시 수주 품목과 일치해야 하며, 접수(OPEN) 수주는 생산중(IN_PRODUCTION)으로 바뀝니다.
 * - 설비 지정 시 고장·정비 중 설비는 지정할 수 없습니다.
 */
export async function createWorkOrder(input: z.output<typeof workOrderCreateSchema>): Promise<WorkOrderDto> {
  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: input.itemId }, include: { bomLines: true } });
    if (!item) throw notFound('item', input.itemId);
    if (item.type !== ItemType.FINISHED) {
      throw new AppError(400, ErrorCode.INVALID_ITEM_TYPE, 'Work orders require a finished good', {
        itemCode: item.code,
        expected: ItemType.FINISHED,
      });
    }
    if (item.bomLines.length === 0) {
      throw new AppError(400, ErrorCode.BOM_NOT_DEFINED, 'Item has no BOM', { itemCode: item.code });
    }

    if (input.salesOrderId) {
      const so = await tx.salesOrder.findUnique({ where: { id: input.salesOrderId } });
      if (!so) throw notFound('salesOrder', input.salesOrderId);
      if (so.itemId !== item.id) {
        throw new AppError(400, ErrorCode.LOT_ITEM_MISMATCH, 'Sales order item differs', {
          orderNo: so.orderNo,
          itemCode: item.code,
        });
      }
      if (so.status === SalesOrderStatus.SHIPPED) {
        throw new AppError(409, ErrorCode.SALES_ORDER_CLOSED, 'Sales order already shipped', { orderNo: so.orderNo });
      }
      if (so.status === SalesOrderStatus.OPEN) {
        await tx.salesOrder.update({ where: { id: so.id }, data: { status: SalesOrderStatus.IN_PRODUCTION } });
      }
    }

    if (input.equipmentId) {
      const eq = await tx.equipment.findUnique({ where: { id: input.equipmentId } });
      if (!eq) throw notFound('equipment', input.equipmentId);
      if (UNAVAILABLE_EQUIPMENT.includes(eq.status)) {
        throw new AppError(409, ErrorCode.EQUIPMENT_UNAVAILABLE, 'Equipment is not available', {
          equipmentCode: eq.code,
          status: eq.status,
        });
      }
    }

    const workOrderNo = await nextDocumentNo(tx, DocPrefix.WORK_ORDER, input.workDate);
    return tx.workOrder.create({
      data: {
        workOrderNo,
        itemId: item.id,
        plannedQty: input.plannedQty,
        workDate: toDbDate(input.workDate),
        salesOrderId: input.salesOrderId ?? null,
        equipmentId: input.equipmentId ?? null,
        note: input.note,
      },
      include: workOrderInclude,
    });
  });
  return toWorkOrderDto(created);
}

export type WorkOrderDetailDto = Omit<WorkOrderDto, 'requirements'> & {
  requirements: (RequirementDto & {
    stockQty: number;
    /** 생산실적 입력용: 현재고가 있는 원자재 LOT (선입선출 순) */
    availableLots: { id: number; lotNo: string; qty: number; receiptDate: string | null; partnerName: string | null }[];
  })[];
  consumptions: {
    lotId: number;
    lotNo: string;
    itemCode: string;
    itemName: string;
    unit: string;
    qty: number;
  }[];
};

export async function getWorkOrder(id: number): Promise<WorkOrderDetailDto> {
  const wo = await prisma.workOrder.findUnique({ where: { id }, include: workOrderInclude });
  if (!wo) throw notFound('workOrder', id);
  const base = toWorkOrderDto(wo);

  const componentIds = base.requirements.map((r) => r.componentId);
  const lots = await prisma.lot.findMany({
    where: { itemId: { in: componentIds }, qty: { gt: 0 } },
    include: { receipt: { include: { partner: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const consumptions = wo.productionResult
    ? await prisma.materialConsumption.findMany({
        where: { productionResultId: wo.productionResult.id },
        include: { lot: { include: { item: true } } },
        orderBy: { id: 'asc' },
      })
    : [];

  return {
    ...base,
    requirements: base.requirements.map((r) => {
      const own = lots.filter((l) => l.itemId === r.componentId);
      return {
        ...r,
        stockQty: round3(own.reduce((sum, l) => sum + num(l.qty), 0)),
        availableLots: own.map((l) => ({
          id: l.id,
          lotNo: l.lotNo,
          qty: num(l.qty),
          receiptDate: l.receipt ? dateOnly(l.receipt.receiptDate) : null,
          partnerName: l.receipt?.partner.name ?? null,
        })),
      };
    }),
    consumptions: consumptions.map((c) => ({
      lotId: c.lotId,
      lotNo: c.lot.lotNo,
      itemCode: c.lot.item.code,
      itemName: c.lot.item.name,
      unit: c.lot.item.unit,
      qty: num(c.qty),
    })),
  };
}
