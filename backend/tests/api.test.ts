import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { createFixture, resetDb, type Fixture } from './helpers.js';

const app = createApp();
let f: Fixture;

beforeEach(async () => {
  await resetDb();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('HTTP API', () => {
  it('입고 등록 시 LOT 를 발급하고 재고·수불 이력에 반영한다', async () => {
    const res = await request(app)
      .post('/api/receipts')
      .send({ partnerId: f.partner.id, itemId: f.steel.id, receiptDate: '2026-11-12', qty: 100 })
      .expect(201);
    expect(res.body.lot.lotNo).toBe('RM-20261112-001');

    const lots = await request(app).get('/api/inventory/lots').query({ lotNo: 'RM-20261112' }).expect(200);
    expect(lots.body.items[0]).toMatchObject({ lotNo: 'RM-20261112-001', qty: 100 });

    const txs = await request(app).get('/api/inventory/transactions').expect(200);
    expect(txs.body.items[0]).toMatchObject({ type: 'MATERIAL_RECEIPT', qty: 100, balanceAfter: 100 });
  });

  it('요청값 검증 실패는 VALIDATION_ERROR 코드와 필드 경로를 반환한다', async () => {
    const res = await request(app).post('/api/receipts').send({ partnerId: f.partner.id, qty: -1 }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['itemId', 'receiptDate', 'qty']));
  });

  it('완제품은 입고할 수 없다 (INVALID_ITEM_TYPE)', async () => {
    const res = await request(app)
      .post('/api/receipts')
      .send({ partnerId: f.partner.id, itemId: f.bracket.id, receiptDate: '2026-11-12', qty: 1 })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_ITEM_TYPE');
  });

  it('중복 품번은 DUPLICATE_CODE', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ code: 'mat-t-steel', name: '중복', type: 'RAW', unit: 'SHEET' })
      .expect(409);
    expect(res.body.error).toMatchObject({ code: 'DUPLICATE_CODE', details: { code: 'MAT-T-STEEL' } });
  });

  it('없는 LOT 조회는 NOT_FOUND', async () => {
    const res = await request(app).get('/api/lots/FG-00000000-000').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('재고 부족 응답에는 부족 LOT 번호와 수량이 포함된다 (결재 요청 단계에서 사전 검증)', async () => {
    const receipt = await request(app)
      .post('/api/receipts')
      .send({ partnerId: f.partner.id, itemId: f.steel.id, receiptDate: '2026-11-12', qty: 10 })
      .expect(201);
    const wo = await request(app)
      .post('/api/work-orders')
      .send({ itemId: f.bracket.id, plannedQty: 20, workDate: '2026-11-12' })
      .expect(201);
    const res = await request(app)
      .post('/api/approvals')
      .set('X-User-Id', String(f.operator.id))
      .send({ workOrderId: wo.body.id, goodQty: 20, defectQty: 0, consumptions: [{ lotId: receipt.body.lot.id, qty: 20 }] })
      .expect(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details.shortages[0]).toMatchObject({
      lotNo: 'RM-20261112-001',
      requestedQty: 20,
      availableQty: 10,
      shortageQty: 10,
    });
  });

  it('생산실적 결재가 켜져 있으면 직접 확정은 APPROVAL_REQUIRED, 끄면 직접 확정된다', async () => {
    const receipt = await request(app)
      .post('/api/receipts')
      .send({ partnerId: f.partner.id, itemId: f.steel.id, receiptDate: '2026-11-12', qty: 10 })
      .expect(201);
    const wo = await request(app)
      .post('/api/work-orders')
      .send({ itemId: f.bracket.id, plannedQty: 5, workDate: '2026-11-12' })
      .expect(201);
    const body = { workOrderId: wo.body.id, goodQty: 5, defectQty: 0, consumptions: [{ lotId: receipt.body.lot.id, qty: 5 }] };
    const blocked = await request(app).post('/api/production-results').send(body).expect(409);
    expect(blocked.body.error.code).toBe('APPROVAL_REQUIRED');

    // 설정 변경은 관리자만
    await request(app).put('/api/settings').set('X-User-Id', String(f.operator.id)).send({ productionApprovalRequired: false }).expect(403);
    const admin = await prisma.user.create({ data: { employeeNo: 'T009', name: '관리자', department: '전산', role: 'ADMIN' } });
    await request(app).put('/api/settings').set('X-User-Id', String(admin.id)).send({ productionApprovalRequired: false }).expect(200);
    const ok = await request(app).post('/api/production-results').send(body).expect(201);
    expect(ok.body.finishedLot.qty).toBe(5);
  });

  it('고객사 전용 거래처로는 원자재를 입고할 수 없다 (INVALID_PARTNER_TYPE)', async () => {
    const res = await request(app)
      .post('/api/receipts')
      .send({ partnerId: f.customer.id, itemId: f.steel.id, receiptDate: '2026-11-12', qty: 1 })
      .expect(400);
    expect(res.body.error).toMatchObject({ code: 'INVALID_PARTNER_TYPE', details: { partnerCode: 'CUS-T01' } });
  });

  it('대시보드는 실제 데이터로 집계한다', async () => {
    await request(app)
      .post('/api/work-orders')
      .send({ itemId: f.bracket.id, plannedQty: 20, workDate: '2026-11-12' })
      .expect(201);
    const res = await request(app).get('/api/dashboard').expect(200);
    expect(res.body.openWorkOrderCount).toBe(1);
    expect(res.body.todayProduction).toMatchObject({ goodQty: 0, defectQty: 0 });
  });
});
