import type { Prisma } from '@prisma/client'
import type { Tx } from '../db.js'
import { AppError, ErrorCode } from './errors.js'
import { num } from './format.js'

export type Shortage = {
  lotId: number
  lotNo: string
  itemCode: string
  requestedQty: number
  availableQty: number
  shortageQty: number
}

export const round3 = (v: number) => Math.round(v * 1000) / 1000

export const insufficientStock = (shortages: Shortage[]) =>
  new AppError(409, ErrorCode.INSUFFICIENT_STOCK, 'Insufficient lot stock', {
    shortages,
  })

export const shortageOf = (
  lot: { id: number; lotNo: string; item: { code: string } },
  requestedQty: number,
  availableQty: number,
): Shortage => ({
  lotId: lot.id,
  lotNo: lot.lotNo,
  itemCode: lot.item.code,
  requestedQty,
  availableQty,
  shortageQty: round3(requestedQty - availableQty),
})

/*
 * qty >= 차감량 조건을 WHERE 에 넣어서 차감한다.
 * 같은 LOT 를 동시에 차감하면 뒤 트랜잭션은 앞 트랜잭션이 끝날 때까지 기다렸다가
 * 바뀐 값으로 조건을 다시 보기 때문에 음수가 되지 않는다. (부족하면 null)
 * 생산 투입, 출하 둘 다 이걸 쓴다.
 */
export async function decrementLot(
  tx: Tx,
  lotId: number,
  qty: number,
): Promise<number | null> {
  const rows = await tx.$queryRaw<{ qty: Prisma.Decimal }[]>`
    UPDATE lots SET qty = qty - ${qty}::numeric
    WHERE id = ${lotId} AND qty >= ${qty}::numeric
    RETURNING qty`
  return rows[0] ? num(rows[0].qty) : null
}
