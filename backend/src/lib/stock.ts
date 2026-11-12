import type { Prisma } from '@prisma/client';
import type { Tx } from '../db.js';
import { AppError, ErrorCode } from './errors.js';
import { num } from './format.js';

/** 재고 부족 상세 (API 응답 details.shortages 의 원소) */
export type Shortage = {
  lotId: number;
  lotNo: string;
  itemCode: string;
  requestedQty: number;
  availableQty: number;
  shortageQty: number;
};

export const round3 = (v: number) => Math.round(v * 1000) / 1000;

export const insufficientStock = (shortages: Shortage[]) =>
  new AppError(409, ErrorCode.INSUFFICIENT_STOCK, 'Insufficient lot stock', { shortages });

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
});

/**
 * 조건부 차감: 현재고가 요청 수량 이상일 때만 차감하고 차감 후 잔량을 돌려줍니다 (부족하면 null).
 * READ COMMITTED 에서 동시에 같은 LOT 를 갱신하면 뒤의 UPDATE 는 앞 트랜잭션 종료까지 대기한 뒤
 * 최신 값으로 WHERE 조건을 다시 평가하므로, 여러 트랜잭션이 같은 LOT 를 동시에 써도 음수가 되지 않습니다.
 * (lots_qty_non_negative CHECK 제약이 최종 안전장치입니다.)
 * 생산 투입(원자재)과 출하(완제품)가 같은 함수를 씁니다.
 */
export async function decrementLot(tx: Tx, lotId: number, qty: number): Promise<number | null> {
  const rows = await tx.$queryRaw<{ qty: Prisma.Decimal }[]>`
    UPDATE lots SET qty = qty - ${qty}::numeric
    WHERE id = ${lotId} AND qty >= ${qty}::numeric
    RETURNING qty`;
  return rows[0] ? num(rows[0].qty) : null;
}
