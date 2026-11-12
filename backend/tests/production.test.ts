import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { ErrorCode } from '../src/lib/errors.js';
import { traceLot } from '../src/modules/inventory/lots/lots.service.js';
import { confirmProduction } from '../src/modules/production/results/production.service.js';
import { getWorkOrder } from '../src/modules/production/work-orders/work-orders.service.js';
import { createFixture, expectAppError, lotQty, order, receive, resetDb, type Fixture } from './helpers.js';

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('생산실적 확정 — 기본 데모 시나리오', () => {
  it('강판 100장 입고 → 브라켓 20개 지시 → 20장 투입, 양품 18·불량 2 → 잔량 80, 완제품 18, 역추적', async () => {
    const receipt = await receive(f, 100);
    expect(receipt.lot.lotNo).toMatch(/^RM-20261112-\d{3}$/);
    expect(receipt.lot.qty).toBe(100);

    const wo = await order(f, 20);
    expect(wo.status).toBe('PLANNED');
    expect(wo.requirements[0]?.requiredQty).toBe(20); // BOM 기준 예상 소요량

    const result = await confirmProduction({
      workOrderId: wo.id,
      goodQty: 18,
      defectQty: 2,
      note: null,
      consumptions: [{ lotId: receipt.lot.id, qty: 20 }],
    });

    expect(await lotQty(receipt.lot.id)).toBe(80);
    expect(result.finishedLot?.lotNo).toMatch(/^FG-\d{8}-\d{3}$/);
    expect(result.finishedLot?.qty).toBe(18);

    const detail = await getWorkOrder(wo.id);
    expect(detail.status).toBe('COMPLETED');
    expect(detail.result?.goodQty).toBe(18);

    const txs = await prisma.inventoryTransaction.findMany({ orderBy: { id: 'asc' } });
    expect(txs.map((t) => [t.type, Number(t.qty), Number(t.balanceAfter)])).toEqual([
      ['MATERIAL_RECEIPT', 100, 100],
      ['PRODUCTION_ISSUE', -20, 80],
      ['PRODUCTION_RECEIPT', 18, 18],
    ]);

    // 완제품 LOT → 작업지시 → 생산실적 → 투입 원자재 LOT → 최초 입고
    const trace = await traceLot(result.finishedLot!.lotNo);
    expect(trace.production?.workOrder.workOrderNo).toBe(wo.workOrderNo);
    expect(trace.production?.resultNo).toBe(result.resultNo);
    expect(trace.materials).toHaveLength(1);
    expect(trace.materials[0]?.lot.lotNo).toBe(receipt.lot.lotNo);
    expect(trace.materials[0]?.consumedQty).toBe(20);
    expect(trace.materials[0]?.receipt?.receiptNo).toBe(receipt.receiptNo);
    expect(trace.materials[0]?.receipt?.partner.code).toBe('SUP-T01');
  });

  it('양품 0·불량만 발생하면 실적과 원자재 사용 이력은 남고 완제품 LOT 는 발급하지 않는다', async () => {
    const receipt = await receive(f, 10);
    const wo = await order(f, 5);
    const result = await confirmProduction({
      workOrderId: wo.id,
      goodQty: 0,
      defectQty: 5,
      note: null,
      consumptions: [{ lotId: receipt.lot.id, qty: 5 }],
    });
    expect(result.finishedLot).toBeNull();
    expect(result.consumptions).toHaveLength(1);
    expect(await lotQty(receipt.lot.id)).toBe(5);
    expect(await prisma.lot.count({ where: { itemId: f.bracket.id } })).toBe(0);
    const types = (await prisma.inventoryTransaction.findMany()).map((t) => t.type).sort();
    expect(types).toEqual(['MATERIAL_RECEIPT', 'PRODUCTION_ISSUE']);
  });
});

describe('생산실적 확정 — 재고 부족', () => {
  it('부족한 LOT 와 수량을 모두 반환하고 아무것도 저장하지 않는다', async () => {
    const lotA = await receive(f, 10);
    const lotB = await receive(f, 5);
    const lotC = await receive(f, 50);
    const wo = await order(f, 20);

    const err = await expectAppError(
      confirmProduction({
        workOrderId: wo.id,
        goodQty: 20,
        defectQty: 0,
        note: null,
        consumptions: [
          { lotId: lotA.lot.id, qty: 12 },
          { lotId: lotB.lot.id, qty: 8 },
          { lotId: lotC.lot.id, qty: 1 },
        ],
      }),
    );
    expect(err.code).toBe(ErrorCode.INSUFFICIENT_STOCK);
    expect(err.details?.shortages).toEqual([
      expect.objectContaining({ lotNo: lotA.lot.lotNo, requestedQty: 12, availableQty: 10, shortageQty: 2 }),
      expect.objectContaining({ lotNo: lotB.lot.lotNo, requestedQty: 8, availableQty: 5, shortageQty: 3 }),
    ]);

    // 부분 저장 없음
    expect(await prisma.productionResult.count()).toBe(0);
    expect(await prisma.materialConsumption.count()).toBe(0);
    expect(await prisma.inventoryTransaction.count({ where: { type: { not: 'MATERIAL_RECEIPT' } } })).toBe(0);
    expect(await lotQty(lotA.lot.id)).toBe(10);
    expect(await lotQty(lotC.lot.id)).toBe(50);
    expect((await getWorkOrder(wo.id)).status).toBe('PLANNED');
  });

  it('BOM 구성품이 아닌 원자재 LOT 는 투입할 수 없다', async () => {
    const coilLot = await receive(f, 100, f.coil.id);
    const wo = await order(f, 10);
    const err = await expectAppError(
      confirmProduction({
        workOrderId: wo.id,
        goodQty: 10,
        defectQty: 0,
        note: null,
        consumptions: [{ lotId: coilLot.lot.id, qty: 10 }],
      }),
    );
    expect(err.code).toBe(ErrorCode.LOT_NOT_IN_BOM);
    expect(err.details?.lotNo).toBe(coilLot.lot.lotNo);
  });
});

describe('생산실적 확정 — 중복 확정', () => {
  it('이미 확정된 작업지시를 다시 확정하면 WORK_ORDER_ALREADY_CONFIRMED', async () => {
    const receipt = await receive(f, 100);
    const wo = await order(f, 10);
    const input = {
      workOrderId: wo.id,
      goodQty: 10,
      defectQty: 0,
      note: null,
      consumptions: [{ lotId: receipt.lot.id, qty: 10 }],
    };
    await confirmProduction(input);
    const err = await expectAppError(confirmProduction(input));
    expect(err.code).toBe(ErrorCode.WORK_ORDER_ALREADY_CONFIRMED);
    expect(await lotQty(receipt.lot.id)).toBe(90);
  });

  it('같은 작업지시를 동시에 5번 확정해도 1건만 성공하고 재고는 한 번만 차감된다', async () => {
    const receipt = await receive(f, 100);
    const wo = await order(f, 10);
    const input = {
      workOrderId: wo.id,
      goodQty: 10,
      defectQty: 0,
      note: null,
      consumptions: [{ lotId: receipt.lot.id, qty: 10 }],
    };
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => confirmProduction(input)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed.every((r) => r.reason?.code === ErrorCode.WORK_ORDER_ALREADY_CONFIRMED)).toBe(true);
    expect(await prisma.productionResult.count()).toBe(1);
    expect(await lotQty(receipt.lot.id)).toBe(90);
  });

  it('DB 제약: production_results.work_order_id 는 UNIQUE 다', async () => {
    const receipt = await receive(f, 100);
    const wo = await order(f, 10);
    await confirmProduction({
      workOrderId: wo.id,
      goodQty: 10,
      defectQty: 0,
      note: null,
      consumptions: [{ lotId: receipt.lot.id, qty: 10 }],
    });
    // 서비스 검증을 우회해 직접 INSERT 해도 DB 가 막는다
    await expect(
      prisma.productionResult.create({
        data: { resultNo: 'PR-BYPASS', workOrderId: wo.id, goodQty: 1, defectQty: 0 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('생산실적 확정 — 같은 LOT 동시 차감', () => {
  it('서로 다른 작업지시 6건이 100장 LOT 에서 30장씩 동시에 차감해도 재고가 음수가 되지 않는다', async () => {
    const receipt = await receive(f, 100);
    const orders = await Promise.all(Array.from({ length: 6 }, () => order(f, 30)));

    const results = await Promise.allSettled(
      orders.map((wo) =>
        confirmProduction({
          workOrderId: wo.id,
          goodQty: 30,
          defectQty: 0,
          note: null,
          consumptions: [{ lotId: receipt.lot.id, qty: 30 }],
        }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    expect(ok).toHaveLength(3); // 30 × 3 = 90 ≤ 100
    expect(failed).toHaveLength(3);
    expect(failed.every((r) => r.reason?.code === ErrorCode.INSUFFICIENT_STOCK)).toBe(true);
    expect(await lotQty(receipt.lot.id)).toBe(10);

    // 실패한 작업지시는 PLANNED 로 남고, 사용 이력 합계가 실제 차감량과 일치한다
    expect(await prisma.workOrder.count({ where: { status: 'PLANNED' } })).toBe(3);
    const consumed = await prisma.materialConsumption.aggregate({ _sum: { qty: true } });
    expect(Number(consumed._sum.qty)).toBe(90);
    const issued = await prisma.inventoryTransaction.aggregate({
      where: { type: 'PRODUCTION_ISSUE' },
      _sum: { qty: true },
    });
    expect(Number(issued._sum.qty)).toBe(-90);
  });

  it('DB 제약: lots.qty 는 CHECK(qty >= 0) 로 음수가 될 수 없다', async () => {
    const receipt = await receive(f, 5);
    await expect(
      prisma.$executeRaw`UPDATE lots SET qty = qty - 10 WHERE id = ${receipt.lot.id}`,
    ).rejects.toThrow(/lots_qty_non_negative/);
    expect(await lotQty(receipt.lot.id)).toBe(5);
  });
});
