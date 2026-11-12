import { z } from 'zod';
import { InventoryTxType, ItemType, Prisma, WorkOrderStatus } from '@prisma/client';
import { prisma, type Tx } from '../../../db.js';
import { AppError, ErrorCode, notFound, uniqueViolationTarget } from '../../../lib/errors.js';
import { num, paging, todayString, type Paged } from '../../../lib/format.js';
import { DocPrefix, nextDocumentNo } from '../../../lib/sequence.js';
import { decrementLot, insufficientStock, round3, shortageOf, type Shortage } from '../../../lib/stock.js';
import { zId, zOptionalText, zPagination, zQty } from '../../../lib/validate.js';

export const confirmProductionSchema = z.object({
  workOrderId: zId,
  goodQty: z.coerce.number().int().min(0).max(1_000_000),
  defectQty: z.coerce.number().int().min(0).max(1_000_000),
  note: zOptionalText,
  consumptions: z.array(z.object({ lotId: zId, qty: zQty })).min(1).max(50),
});

export type ConfirmProductionInput = z.output<typeof confirmProductionSchema>;

const alreadyConfirmed = (workOrderNo: string) =>
  new AppError(409, ErrorCode.WORK_ORDER_ALREADY_CONFIRMED, 'Work order already confirmed', { workOrderNo });

/**
 * 생산실적 확정 (단일 트랜잭션)
 *  1. 작업지시 상태 PLANNED → COMPLETED 선점 (조건부 UPDATE, 행 잠금)
 *  2. 생산실적 저장 (work_order_id UNIQUE 로 중복 확정 2차 방어)
 *  3. 원자재 LOT 별 실제 사용량 차감 + 사용 이력 + 수불(PRODUCTION_ISSUE)
 *  4. 양품 > 0 이면 완제품 LOT 발급 + 수불(PRODUCTION_RECEIPT)
 * 어느 단계든 실패하면 전체가 롤백되어 부분 저장이 남지 않습니다.
 */
/** 입력값 자체 검증 (DB 조회 없이 판단 가능한 규칙) */
export function validateProductionInput(input: ConfirmProductionInput) {
  if (input.goodQty + input.defectQty <= 0) {
    throw new AppError(400, ErrorCode.INVALID_PRODUCTION_QTY, 'Good + defect quantity must be positive');
  }
  const lotIds = input.consumptions.map((c) => c.lotId);
  if (new Set(lotIds).size !== lotIds.length) {
    throw new AppError(400, ErrorCode.DUPLICATE_LOT_LINE, 'Same lot appears more than once');
  }
}

/**
 * 사전 검증 — 작업지시 상태, 투입 LOT(존재·원자재·BOM 구성품), 재고 부족을 확인합니다. 데이터는 바꾸지 않습니다.
 * 결재 요청 시점에도 같은 검증을 실행해 잘못된 실적이 결재함에 올라가지 않게 합니다.
 */
export async function precheckProduction(tx: Pick<Tx, 'workOrder' | 'lot'>, input: ConfirmProductionInput) {
  validateProductionInput(input);
  const lotIds = input.consumptions.map((c) => c.lotId);
  const wo = await tx.workOrder.findUnique({
    where: { id: input.workOrderId },
    include: { item: { include: { bomLines: true } } },
  });
  if (!wo) throw notFound('workOrder', input.workOrderId);
  if (wo.status !== WorkOrderStatus.PLANNED) throw alreadyConfirmed(wo.workOrderNo);

  // 투입 LOT 검증: 존재 여부, 원자재 여부, 해당 완제품 BOM 구성품 여부
  const lots = await tx.lot.findMany({ where: { id: { in: lotIds } }, include: { item: true } });
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const bomComponentIds = new Set(wo.item.bomLines.map((b) => b.componentId));
  for (const c of input.consumptions) {
    const lot = lotById.get(c.lotId);
    if (!lot) throw notFound('lot', c.lotId);
    if (lot.item.type !== ItemType.RAW || !bomComponentIds.has(lot.itemId)) {
      throw new AppError(400, ErrorCode.LOT_NOT_IN_BOM, 'Lot is not a BOM component of this work order', {
        lotNo: lot.lotNo,
        itemCode: lot.item.code,
      });
    }
  }

  // 사전 재고 확인: 부족한 LOT 를 모두 모아 한 번에 알려줍니다.
  const shortages: Shortage[] = [];
  for (const c of input.consumptions) {
    const lot = lotById.get(c.lotId)!;
    const available = num(lot.qty);
    if (available < c.qty) {
      shortages.push(shortageOf(lot, c.qty, available));
    }
  }
  if (shortages.length > 0) throw insufficientStock(shortages);
  return { wo, lotById };
}

/**
 * 확정 본문 — 호출한 쪽의 트랜잭션 안에서 실행됩니다.
 * 직접 확정(confirmProduction)과 결재 승인(approveRequest)이 같은 코드를 사용하며,
 * 결재 승인에서는 결재 상태 변경과 이 확정이 하나의 트랜잭션으로 묶입니다.
 * @returns 생성된 생산실적 id
 */
export async function confirmProductionTx(tx: Tx, input: ConfirmProductionInput): Promise<number> {
  const { wo, lotById } = await precheckProduction(tx, input);

  // 1. 작업지시 선점: 동시에 같은 작업지시를 확정하면 뒤 요청은 count 0 이 됩니다.
  const now = new Date();
  const claimed = await tx.workOrder.updateMany({
    where: { id: wo.id, status: WorkOrderStatus.PLANNED },
    data: { status: WorkOrderStatus.COMPLETED, completedAt: now },
  });
  if (claimed.count === 0) throw alreadyConfirmed(wo.workOrderNo);

  // 2. 생산실적 저장
  const today = todayString(now);
  const result = await tx.productionResult.create({
    data: {
      resultNo: await nextDocumentNo(tx, DocPrefix.PRODUCTION_RESULT, today),
      workOrderId: wo.id,
      goodQty: input.goodQty,
      defectQty: input.defectQty,
      note: input.note,
      confirmedAt: now,
    },
  });

  // 3. 원자재 차감 — LOT id 순서로 잠가 교착 상태를 피합니다.
  const ordered = [...input.consumptions].sort((a, b) => a.lotId - b.lotId);
  for (const c of ordered) {
    const lot = lotById.get(c.lotId)!;
    const balance = await decrementLot(tx, c.lotId, c.qty);
    if (balance === null) {
      // 사전 확인 이후 다른 트랜잭션이 먼저 차감한 경우
      const current = await tx.lot.findUniqueOrThrow({ where: { id: c.lotId } });
      const available = num(current.qty);
      throw insufficientStock([shortageOf(lot, c.qty, available)]);
    }
    await tx.materialConsumption.create({
      data: { productionResultId: result.id, lotId: c.lotId, qty: c.qty },
    });
    await tx.inventoryTransaction.create({
      data: {
        type: InventoryTxType.PRODUCTION_ISSUE,
        itemId: lot.itemId,
        lotId: c.lotId,
        qty: -c.qty,
        balanceAfter: balance,
        productionResultId: result.id,
        occurredAt: now,
      },
    });
  }

  // 4. 완제품 입고 (양품만). 양품 0 이면 LOT 를 발급하지 않습니다.
  if (input.goodQty > 0) {
    const finishedLot = await tx.lot.create({
      data: {
        lotNo: await nextDocumentNo(tx, DocPrefix.FINISHED_LOT, today),
        itemId: wo.itemId,
        initialQty: input.goodQty,
        qty: input.goodQty,
      },
    });
    await tx.productionResult.update({
      where: { id: result.id },
      data: { finishedLotId: finishedLot.id },
    });
    await tx.inventoryTransaction.create({
      data: {
        type: InventoryTxType.PRODUCTION_RECEIPT,
        itemId: wo.itemId,
        lotId: finishedLot.id,
        qty: input.goodQty,
        balanceAfter: input.goodQty,
        productionResultId: result.id,
        occurredAt: now,
      },
    });
  }
  return result.id;
}

export const CONFIRM_TX_OPTIONS = { timeout: 15_000, maxWait: 10_000 } as const;

/** 트랜잭션 오류를 업무 오류 코드로 변환 */
export async function mapConfirmError(err: unknown, workOrderId: number): Promise<unknown> {
  // 동시 확정 경합에서 UNIQUE(work_order_id) 에 걸린 경우
  const target = uniqueViolationTarget(err);
  if (target && target.some((t) => t.includes('work_order_id'))) {
    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
    return alreadyConfirmed(wo?.workOrderNo ?? String(workOrderId));
  }
  // CHECK(qty >= 0) 위반은 이론상 조건부 UPDATE 로 막히지만, 발생하면 재고 부족으로 응답합니다.
  if (err instanceof Prisma.PrismaClientKnownRequestError && String(err.message).includes('lots_qty_non_negative')) {
    return insufficientStock([]);
  }
  return err;
}

/** 직접 확정 (시스템 설정에서 생산실적 결재를 끈 경우) */
export async function confirmProduction(input: ConfirmProductionInput) {
  validateProductionInput(input);
  try {
    const resultId = await prisma.$transaction((tx) => confirmProductionTx(tx, input), CONFIRM_TX_OPTIONS);
    return getProductionResult(resultId);
  } catch (err) {
    throw await mapConfirmError(err, input.workOrderId);
  }
}

const resultInclude = {
  workOrder: { include: { item: true } },
  finishedLot: true,
  consumptions: { include: { lot: { include: { item: true } } }, orderBy: { id: 'asc' } },
} as const satisfies Prisma.ProductionResultInclude;

type ResultRow = Prisma.ProductionResultGetPayload<{ include: typeof resultInclude }>;

export type ProductionResultDto = ReturnType<typeof toResultDto>;

function toResultDto(r: ResultRow) {
  return {
    id: r.id,
    resultNo: r.resultNo,
    goodQty: r.goodQty,
    defectQty: r.defectQty,
    note: r.note,
    confirmedAt: r.confirmedAt.toISOString(),
    workOrder: {
      id: r.workOrder.id,
      workOrderNo: r.workOrder.workOrderNo,
      plannedQty: r.workOrder.plannedQty,
      item: { id: r.workOrder.item.id, code: r.workOrder.item.code, name: r.workOrder.item.name, unit: r.workOrder.item.unit },
    },
    finishedLot: r.finishedLot ? { id: r.finishedLot.id, lotNo: r.finishedLot.lotNo, qty: num(r.finishedLot.initialQty) } : null,
    consumptions: r.consumptions.map((c) => ({
      lotId: c.lotId,
      lotNo: c.lot.lotNo,
      itemCode: c.lot.item.code,
      itemName: c.lot.item.name,
      unit: c.lot.item.unit,
      qty: num(c.qty),
    })),
  };
}

export async function getProductionResult(id: number): Promise<ProductionResultDto> {
  const r = await prisma.productionResult.findUnique({ where: { id }, include: resultInclude });
  if (!r) throw notFound('productionResult', id);
  return toResultDto(r);
}

export const productionListSchema = z.object({ ...zPagination });

export async function listProductionResults(
  input: z.output<typeof productionListSchema>,
): Promise<Paged<ProductionResultDto>> {
  const [rows, total] = await Promise.all([
    prisma.productionResult.findMany({
      include: resultInclude,
      orderBy: { confirmedAt: 'desc' },
      ...paging(input.page, input.pageSize),
    }),
    prisma.productionResult.count(),
  ]);
  return { items: rows.map(toResultDto), total, page: input.page, pageSize: input.pageSize };
}
