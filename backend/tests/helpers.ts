import { ItemType, PartnerType, UserRole } from '@prisma/client';
import { prisma } from '../src/db.js';
import { AppError } from '../src/lib/errors.js';
import { createItem } from '../src/modules/master/items/items.service.js';
import { createPartner } from '../src/modules/master/partners/partners.service.js';
import { createReceipt } from '../src/modules/inventory/receipts/receipts.service.js';
import { createWorkOrder } from '../src/modules/production/work-orders/work-orders.service.js';

export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE approval_requests, shipment_lines, shipments, inventory_transactions, material_consumptions,
      production_results, work_orders, sales_orders, receipts, lots, bom_lines, items, partners,
      equipment_logs, equipments, users, system_settings, document_sequences
    RESTART IDENTITY CASCADE`);
}

/** 기본 데모와 같은 구성: 공급사·고객사, 강판(원자재), 브라켓(완제품, BOM 강판 1장), 작업자·팀장 */
export async function createFixture() {
  const partner = await createPartner({
    code: 'SUP-T01',
    name: '테스트철강(가상)',
    type: PartnerType.SUPPLIER,
    businessNo: null,
    contactName: null,
    phone: null,
  });
  const customer = await createPartner({
    code: 'CUS-T01',
    name: '테스트모터스(가상)',
    type: PartnerType.CUSTOMER,
    businessNo: null,
    contactName: null,
    phone: null,
  });
  const steel = await createItem({ code: 'MAT-T-STEEL', name: '테스트 강판', type: ItemType.RAW, unit: 'SHEET', spec: null });
  const coil = await createItem({ code: 'MAT-T-COIL', name: '테스트 코일', type: ItemType.RAW, unit: 'KG', spec: null });
  const bracket = await createItem({
    code: 'PRD-T-BRK',
    name: '테스트 브라켓',
    type: ItemType.FINISHED,
    unit: 'EA',
    spec: null,
    bomLines: [{ componentId: steel.id, qtyPer: 1 }],
  });
  const operator = await prisma.user.create({
    data: { employeeNo: 'T001', name: '작업자', department: '생산1팀', role: UserRole.OPERATOR },
  });
  const manager = await prisma.user.create({
    data: { employeeNo: 'T002', name: '팀장', department: '생산1팀', role: UserRole.MANAGER },
  });
  return { partner, customer, steel, coil, bracket, operator, manager };
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>;

export const receive = (f: Fixture, qty: number, itemId = f.steel.id) =>
  createReceipt({
    partnerId: f.partner.id,
    itemId,
    receiptDate: '2026-11-12',
    qty,
    supplierLotNo: null,
    note: null,
  });

export const order = (f: Fixture, plannedQty: number, extra: { salesOrderId?: number; equipmentId?: number } = {}) =>
  createWorkOrder({ itemId: f.bracket.id, plannedQty, workDate: '2026-11-12', note: null, ...extra });

/** 비동기 호출이 AppError 로 실패하면 그 오류를 반환합니다. */
export async function expectAppError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('Expected AppError but promise resolved');
}

export const lotQty = async (lotId: number) =>
  Number((await prisma.lot.findUniqueOrThrow({ where: { id: lotId } })).qty);
