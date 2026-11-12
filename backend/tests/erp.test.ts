import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { EquipmentLogType, EquipmentProcess, EquipmentStatus } from '@prisma/client';
import { prisma } from '../src/db.js';
import { ErrorCode } from '../src/lib/errors.js';
import { approveRequest, cancelRequest, rejectRequest, requestApproval } from '../src/modules/approval/approval.service.js';
import { addEquipmentLog, createEquipment } from '../src/modules/equipment/equipment.service.js';
import { traceLot } from '../src/modules/inventory/lots/lots.service.js';
import { confirmProduction } from '../src/modules/production/results/production.service.js';
import { getWorkOrder } from '../src/modules/production/work-orders/work-orders.service.js';
import { createSalesOrder, getSalesOrder } from '../src/modules/sales/orders/sales-orders.service.js';
import { createShipment } from '../src/modules/sales/shipments/shipments.service.js';
import { createFixture, expectAppError, lotQty, order, receive, resetDb, type Fixture } from './helpers.js';

let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const resultInput = (workOrderId: number, lotId: number, qty: number, good = qty, defect = 0) => ({
  workOrderId,
  goodQty: good,
  defectQty: defect,
  note: null,
  consumptions: [{ lotId, qty }],
});

describe('결재 — 생산실적 확정 전 결재', () => {
  it('작업자가 요청하고 팀장이 승인하면 확정 트랜잭션이 실행된다', async () => {
    const r = await receive(f, 100);
    const wo = await order(f, 20);
    const req = await requestApproval(resultInput(wo.id, r.lot.id, 20, 18, 2), f.operator);
    expect(req.status).toBe('PENDING');
    expect(req.requestNo).toMatch(/^AP-\d{8}-\d{3}$/);
    // 요청만으로는 재고가 바뀌지 않는다
    expect(await lotQty(r.lot.id)).toBe(100);
    expect((await getWorkOrder(wo.id)).pendingApproval?.requestNo).toBe(req.requestNo);

    const denied = await expectAppError(approveRequest(req.id, null, f.operator));
    expect(denied.code).toBe(ErrorCode.FORBIDDEN_ROLE);

    const approved = await approveRequest(req.id, '확인', f.manager);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approver?.name).toBe('팀장');
    expect(approved.result?.finishedLotNo).toMatch(/^FG-/);
    expect(await lotQty(r.lot.id)).toBe(80);
    expect((await getWorkOrder(wo.id)).status).toBe('COMPLETED');

    const again = await expectAppError(approveRequest(req.id, null, f.manager));
    expect(again.code).toBe(ErrorCode.APPROVAL_ALREADY_DECIDED);
  });

  it('작업지시당 결재 대기는 하나만 — 동시에 3번 요청해도 1건만 생성된다', async () => {
    const r = await receive(f, 100);
    const wo = await order(f, 10);
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => requestApproval(resultInput(wo.id, r.lot.id, 10), f.operator)),
    );
    const ok = results.filter((x) => x.status === 'fulfilled');
    const failed = results.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed.every((x) => x.reason?.code === ErrorCode.APPROVAL_ALREADY_PENDING)).toBe(true);
    expect(await prisma.approvalRequest.count({ where: { status: 'PENDING' } })).toBe(1);
  });

  it('승인 시점에 재고가 부족하면 전체 롤백 — 결재는 대기로 남고 실적은 생기지 않는다', async () => {
    const r = await receive(f, 30);
    const woA = await order(f, 20);
    const woB = await order(f, 20);
    const req = await requestApproval(resultInput(woA.id, r.lot.id, 20), f.operator); // 요청 시점엔 충분
    await confirmProduction(resultInput(woB.id, r.lot.id, 20)); // 다른 작업지시가 먼저 20장 사용 → 잔량 10

    const err = await expectAppError(approveRequest(req.id, null, f.manager));
    expect(err.code).toBe(ErrorCode.INSUFFICIENT_STOCK);
    expect(err.details?.shortages).toEqual([expect.objectContaining({ requestedQty: 20, availableQty: 10, shortageQty: 10 })]);

    const after = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(after.status).toBe('PENDING');
    expect(after.approverId).toBeNull();
    expect((await getWorkOrder(woA.id)).status).toBe('PLANNED');
    expect(await lotQty(r.lot.id)).toBe(10);
  });

  it('반려하면 작업지시는 작업대기로 남고 다시 요청할 수 있다. 취소는 요청자만 가능', async () => {
    const r = await receive(f, 100);
    const wo = await order(f, 10);
    const first = await requestApproval(resultInput(wo.id, r.lot.id, 10), f.operator);
    const rejected = await rejectRequest(first.id, '사용량 재확인', f.manager);
    expect(rejected.status).toBe('REJECTED');
    expect((await getWorkOrder(wo.id)).status).toBe('PLANNED');

    const second = await requestApproval(resultInput(wo.id, r.lot.id, 9, 9), f.operator);
    const notMine = await expectAppError(cancelRequest(second.id, f.manager));
    expect(notMine.code).toBe(ErrorCode.FORBIDDEN_ROLE);
    expect((await cancelRequest(second.id, f.operator)).status).toBe('CANCELLED');
  });
});

describe('영업 — 수주·출하', () => {
  const makeOrder = (qty: number) =>
    createSalesOrder({ customerId: f.customer.id, itemId: f.bracket.id, qty, orderDate: '2026-11-12', dueDate: '2026-11-20', note: null });

  it('공급사 전용 거래처로는 수주할 수 없다', async () => {
    const err = await expectAppError(
      createSalesOrder({ customerId: f.partner.id, itemId: f.bracket.id, qty: 1, orderDate: '2026-11-12', dueDate: '2026-11-12', note: null }),
    );
    expect(err.code).toBe(ErrorCode.INVALID_PARTNER_TYPE);
  });

  it('수주 → 작업지시 → 생산 → 부분 출하 → 출하 완료, 수불(SHIPMENT)과 LOT 정추적', async () => {
    const so = await makeOrder(18);
    expect(so.status).toBe('OPEN');
    const r = await receive(f, 100);
    const wo = await order(f, 20, { salesOrderId: so.id });
    expect((await getSalesOrder(so.id)).status).toBe('IN_PRODUCTION');
    const result = await confirmProduction(resultInput(wo.id, r.lot.id, 20, 18, 2));
    const fgLot = result.finishedLot!;

    const s1 = await createShipment({ salesOrderId: so.id, shipDate: '2026-11-13', note: null, lines: [{ lotId: fgLot.id, qty: 10 }] }, f.operator);
    expect(s1.shipmentNo).toMatch(/^SH-20261113-\d{3}$/);
    expect(await lotQty(fgLot.id)).toBe(8);
    let detail = await getSalesOrder(so.id);
    expect(detail).toMatchObject({ status: 'PARTIALLY_SHIPPED', shippedQty: 10, remainingQty: 8 });

    const over = await expectAppError(
      createShipment({ salesOrderId: so.id, shipDate: '2026-11-13', note: null, lines: [{ lotId: fgLot.id, qty: 9 }] }, f.operator),
    );
    expect(over.code).toBe(ErrorCode.SHIPMENT_EXCEEDS_ORDER);
    expect(over.details).toMatchObject({ remainingQty: 8, requestedQty: 9 });

    await createShipment({ salesOrderId: so.id, shipDate: '2026-11-14', note: null, lines: [{ lotId: fgLot.id, qty: 8 }] }, f.operator);
    detail = await getSalesOrder(so.id);
    expect(detail).toMatchObject({ status: 'SHIPPED', shippedQty: 18, remainingQty: 0 });
    expect(await lotQty(fgLot.id)).toBe(0);

    const closed = await expectAppError(
      createShipment({ salesOrderId: so.id, shipDate: '2026-11-14', note: null, lines: [{ lotId: fgLot.id, qty: 1 }] }, f.operator),
    );
    expect(closed.code).toBe(ErrorCode.SALES_ORDER_CLOSED);

    const txs = await prisma.inventoryTransaction.findMany({ where: { type: 'SHIPMENT' }, orderBy: { id: 'asc' } });
    expect(txs.map((t) => [Number(t.qty), Number(t.balanceAfter)])).toEqual([[-10, 8], [-8, 0]]);

    const trace = await traceLot(fgLot.lotNo);
    expect(trace.shipments.map((s) => s.qty)).toEqual([10, 8]);
    expect(trace.shipments[0]?.customer.code).toBe('CUS-T01');
  });

  it('같은 수주에 동시 출하 4건(각 10개, 수주 25개)이 와도 잔량을 넘지 않는다', async () => {
    const so = await makeOrder(25);
    const r = await receive(f, 100);
    const wo = await order(f, 50);
    const fg = (await confirmProduction(resultInput(wo.id, r.lot.id, 50))).finishedLot!;
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map(() =>
        createShipment({ salesOrderId: so.id, shipDate: '2026-11-13', note: null, lines: [{ lotId: fg.id, qty: 10 }] }, f.operator),
      ),
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    expect(ok).toBe(2); // 10 + 10 = 20 ≤ 25, 세 번째부터 잔량 5 초과
    expect((await getSalesOrder(so.id)).shippedQty).toBe(20);
    expect(await lotQty(fg.id)).toBe(30);
  });

  it('수주 품목이 아닌 LOT 는 출하할 수 없다', async () => {
    const so = await makeOrder(5);
    const raw = await receive(f, 10);
    const err = await expectAppError(
      createShipment({ salesOrderId: so.id, shipDate: '2026-11-13', note: null, lines: [{ lotId: raw.lot.id, qty: 5 }] }, f.operator),
    );
    expect(err.code).toBe(ErrorCode.LOT_ITEM_MISMATCH);
  });
});

describe('설비', () => {
  it('고장 설비는 작업지시에 지정할 수 없고, 상태 변경은 이력으로 남는다', async () => {
    const eq = await createEquipment(
      { code: 'PR-T01', name: '테스트 프레스', process: EquipmentProcess.PRESSING, status: EquipmentStatus.RUNNING, location: null, installedAt: null, note: null },
      f.manager,
    );
    const broken = await addEquipmentLog(eq.id, { type: EquipmentLogType.STATUS_CHANGE, toStatus: EquipmentStatus.BREAKDOWN, note: '유압 누유' }, f.operator);
    expect(broken.status).toBe('BREAKDOWN');
    expect(broken.logs[0]).toMatchObject({ fromStatus: 'RUNNING', toStatus: 'BREAKDOWN', note: '유압 누유', userName: '작업자' });

    const err = await expectAppError(order(f, 10, { equipmentId: eq.id }));
    expect(err.code).toBe(ErrorCode.EQUIPMENT_UNAVAILABLE);
    expect(err.details).toMatchObject({ equipmentCode: 'PR-T01', status: 'BREAKDOWN' });

    await addEquipmentLog(eq.id, { type: EquipmentLogType.REPAIR, toStatus: EquipmentStatus.IDLE, note: '실린더 교체' }, f.operator);
    const wo = await order(f, 10, { equipmentId: eq.id });
    expect(wo.equipment?.code).toBe('PR-T01');
  });
});
