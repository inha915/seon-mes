import { z } from 'zod'
import {
  InventoryTxType,
  ItemType,
  Prisma,
  WorkOrderStatus,
} from '@prisma/client'
import { prisma, type Tx } from '../../../db.js'
import {
  AppError,
  ErrorCode,
  notFound,
  uniqueViolationTarget,
} from '../../../lib/errors.js'
import { num, paging, todayString, type Paged } from '../../../lib/format.js'
import { DocPrefix, nextDocumentNo } from '../../../lib/sequence.js'
import {
  decrementLot,
  insufficientStock,
  round3,
  shortageOf,
  type Shortage,
} from '../../../lib/stock.js'
import { zId, zOptionalText, zPagination, zQty } from '../../../lib/zod.js'

export const confirmProductionSchema = z.object({
  workOrderId: zId,
  goodQty: z.coerce.number().int().min(0).max(1_000_000),
  defectQty: z.coerce.number().int().min(0).max(1_000_000),
  note: zOptionalText,
  consumptions: z
    .array(z.object({ lotId: zId, qty: zQty }))
    .min(1)
    .max(50),
})

export type ConfirmProductionInput = z.output<typeof confirmProductionSchema>

const alreadyConfirmed = (workOrderNo: string) =>
  new AppError(
    409,
    ErrorCode.WORK_ORDER_ALREADY_CONFIRMED,
    'Work order already confirmed',
    { workOrderNo },
  )

export function validateProductionInput(input: ConfirmProductionInput) {
  if (input.goodQty + input.defectQty <= 0) {
    throw new AppError(
      400,
      ErrorCode.INVALID_PRODUCTION_QTY,
      'Good + defect quantity must be positive',
    )
  }
  const lotIds = input.consumptions.map((c) => c.lotId)
  if (new Set(lotIds).size !== lotIds.length) {
    throw new AppError(
      400,
      ErrorCode.DUPLICATE_LOT_LINE,
      'Same lot appears more than once',
    )
  }
}

// 저장 전에 확인만 한다. 결재 요청할 때도 같은 검사를 돌린다
export async function precheckProduction(
  tx: Pick<Tx, 'workOrder' | 'lot'>,
  input: ConfirmProductionInput,
) {
  validateProductionInput(input)
  const lotIds = input.consumptions.map((c) => c.lotId)
  const wo = await tx.workOrder.findUnique({
    where: { id: input.workOrderId },
    include: { item: { include: { bomLines: true } } },
  })
  if (!wo) throw notFound('workOrder', input.workOrderId)
  if (wo.status !== WorkOrderStatus.PLANNED)
    throw alreadyConfirmed(wo.workOrderNo)

  // 투입 LOT 검증: 존재 여부, 원자재 여부, 해당 완제품 BOM 구성품 여부
  const lots = await tx.lot.findMany({
    where: { id: { in: lotIds } },
    include: { item: true },
  })
  const lotById = new Map(lots.map((l) => [l.id, l]))
  const bomComponentIds = new Set(wo.item.bomLines.map((b) => b.componentId))
  for (const c of input.consumptions) {
    const lot = lotById.get(c.lotId)
    if (!lot) throw notFound('lot', c.lotId)
    if (lot.item.type !== ItemType.RAW || !bomComponentIds.has(lot.itemId)) {
      throw new AppError(
        400,
        ErrorCode.LOT_NOT_IN_BOM,
        'Lot is not a BOM component of this work order',
        {
          lotNo: lot.lotNo,
          itemCode: lot.item.code,
        },
      )
    }
  }

  // 사전 재고 확인: 부족한 LOT 를 모두 모아 한 번에 알려줍니다.
  const shortages: Shortage[] = []
  for (const c of input.consumptions) {
    const lot = lotById.get(c.lotId)!
    const available = num(lot.qty)
    if (available < c.qty) {
      shortages.push(shortageOf(lot, c.qty, available))
    }
  }
  if (shortages.length > 0) throw insufficientStock(shortages)
  return { wo, lotById }
}

/*
 * 실적 확정. 바깥 트랜잭션 안에서 호출해야 한다.
 * 직접 확정이랑 결재 승인이 같이 쓰고, 중간에 하나라도 실패하면 전부 롤백된다.
 */
export async function confirmProductionTx(
  tx: Tx,
  input: ConfirmProductionInput,
): Promise<number> {
  const { wo, lotById } = await precheckProduction(tx, input)

  // 작업지시 선점. 동시에 확정하면 뒤 요청은 count 0
  const now = new Date()
  const claimed = await tx.workOrder.updateMany({
    where: { id: wo.id, status: WorkOrderStatus.PLANNED },
    data: { status: WorkOrderStatus.COMPLETED, completedAt: now },
  })
  if (claimed.count === 0) throw alreadyConfirmed(wo.workOrderNo)

  // 2. 생산실적 저장
  const today = todayString(now)
  const result = await tx.productionResult.create({
    data: {
      resultNo: await nextDocumentNo(tx, DocPrefix.PRODUCTION_RESULT, today),
      workOrderId: wo.id,
      goodQty: input.goodQty,
      defectQty: input.defectQty,
      note: input.note,
      confirmedAt: now,
    },
  })

  // LOT id 순서로 차감해야 데드락이 안 난다
  const ordered = [...input.consumptions].sort((a, b) => a.lotId - b.lotId)
  for (const c of ordered) {
    const lot = lotById.get(c.lotId)!
    const balance = await decrementLot(tx, c.lotId, c.qty)
    if (balance === null) {
      // 사전 확인 이후 다른 트랜잭션이 먼저 차감한 경우
      const current = await tx.lot.findUniqueOrThrow({ where: { id: c.lotId } })
      const available = num(current.qty)
      throw insufficientStock([shortageOf(lot, c.qty, available)])
    }
    await tx.materialConsumption.create({
      data: { productionResultId: result.id, lotId: c.lotId, qty: c.qty },
    })
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
    })
  }

  // 양품 0 이면 완제품 LOT 는 만들지 않음
  if (input.goodQty > 0) {
    const finishedLot = await tx.lot.create({
      data: {
        lotNo: await nextDocumentNo(tx, DocPrefix.FINISHED_LOT, today),
        itemId: wo.itemId,
        initialQty: input.goodQty,
        qty: input.goodQty,
      },
    })
    await tx.productionResult.update({
      where: { id: result.id },
      data: { finishedLotId: finishedLot.id },
    })
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
    })
  }
  return result.id
}

export const CONFIRM_TX_OPTIONS = { timeout: 15_000, maxWait: 10_000 } as const

export async function mapConfirmError(
  err: unknown,
  workOrderId: number,
): Promise<unknown> {
  // 동시 확정 경합에서 UNIQUE(work_order_id) 에 걸린 경우
  const target = uniqueViolationTarget(err)
  if (target && target.some((t) => t.includes('work_order_id'))) {
    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } })
    return alreadyConfirmed(wo?.workOrderNo ?? String(workOrderId))
  }
  // 조건부 UPDATE 로 막히지만 혹시 CHECK 에 걸리면 재고 부족으로 처리
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    String(err.message).includes('lots_qty_non_negative')
  ) {
    return insufficientStock([])
  }
  return err
}

export async function confirmProduction(input: ConfirmProductionInput) {
  validateProductionInput(input)
  try {
    const resultId = await prisma.$transaction(
      (tx) => confirmProductionTx(tx, input),
      CONFIRM_TX_OPTIONS,
    )
    return getProductionResult(resultId)
  } catch (err) {
    throw await mapConfirmError(err, input.workOrderId)
  }
}

const resultInclude = {
  workOrder: { include: { item: true } },
  finishedLot: true,
  consumptions: {
    include: { lot: { include: { item: true } } },
    orderBy: { id: 'asc' },
  },
} as const satisfies Prisma.ProductionResultInclude

type ResultRow = Prisma.ProductionResultGetPayload<{
  include: typeof resultInclude
}>

export type ProductionResultDto = ReturnType<typeof toResultDto>

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
      item: {
        id: r.workOrder.item.id,
        code: r.workOrder.item.code,
        name: r.workOrder.item.name,
        unit: r.workOrder.item.unit,
      },
    },
    finishedLot: r.finishedLot
      ? {
          id: r.finishedLot.id,
          lotNo: r.finishedLot.lotNo,
          qty: num(r.finishedLot.initialQty),
        }
      : null,
    consumptions: r.consumptions.map((c) => ({
      lotId: c.lotId,
      lotNo: c.lot.lotNo,
      itemCode: c.lot.item.code,
      itemName: c.lot.item.name,
      unit: c.lot.item.unit,
      qty: num(c.qty),
    })),
  }
}

export async function getProductionResult(
  id: number,
): Promise<ProductionResultDto> {
  const r = await prisma.productionResult.findUnique({
    where: { id },
    include: resultInclude,
  })
  if (!r) throw notFound('productionResult', id)
  return toResultDto(r)
}

export const productionListSchema = z.object({ ...zPagination })

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
  ])
  return {
    items: rows.map(toResultDto),
    total,
    page: input.page,
    pageSize: input.pageSize,
  }
}
