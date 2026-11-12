/**
 * 세온산업 MES 데모 시드 (모든 거래처·품목·실적은 가상 데이터)
 *
 * - 몇 번을 다시 실행해도 같은 데모 데이터가 중복 생성되지 않습니다(idempotent).
 *   · 거래처/품목은 code 기준 upsert, BOM 은 (완제품, 원자재) 기준 upsert
 *   · 완료 사례와 대기 작업지시는 고정 번호(*-SEED-*)가 이미 있으면 건너뜁니다.
 * - 기본 데모용 원자재(MAT-SPCC12 냉연강판)는 재고 0 으로 시작합니다.
 *   화면에서 "강판 100장 입고 → 브라켓 20개 작업지시 → ..." 흐름을 처음부터 진행할 수 있습니다.
 * - 바로 조회해 볼 수 있는 완료 사례는 별도 품목/LOT(MAT-SAPH23 → PRD-BRK200, FG-SEED-0001)로 만듭니다.
 *   수주(SO-SEED-0001) → 작업지시 → 결재 승인(AP-SEED-0001) → 생산 → 20개 출하(SH-SEED-0001)까지 연결됩니다.
 * - 사용자(작업자·팀장·관리자), 고객사, 설비도 함께 등록합니다.
 */
import {
  ApprovalDocType,
  ApprovalStatus,
  EquipmentLogType,
  EquipmentProcess,
  EquipmentStatus,
  InventoryTxType,
  ItemType,
  PartnerType,
  PrismaClient,
  SalesOrderStatus,
  UserRole,
  WorkOrderStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const partners = [
  { code: 'SUP-001', name: '대성철강(가상)', businessNo: '123-45-00001', contactName: '김구매', phone: '031-000-0001' },
  { code: 'SUP-002', name: '한빛금속(가상)', businessNo: '123-45-00002', contactName: '이영업', phone: '032-000-0002' },
  { code: 'SUP-003', name: '유진스틸(가상)', businessNo: '123-45-00003', contactName: '박담당', phone: '041-000-0003' },
  { code: 'CUS-001', name: '한결모터스(가상)', businessNo: '234-56-00001', contactName: '정구매', phone: '052-000-1001' },
  { code: 'CUS-002', name: '대양오토(가상)', businessNo: '234-56-00002', contactName: '최자재', phone: '055-000-1002' },
].map((p) => ({ ...p, type: p.code.startsWith('CUS') ? PartnerType.CUSTOMER : PartnerType.SUPPLIER }));

/** 사용자 (데모용, 로그인 없이 헤더에서 전환) */
const users = [
  { employeeNo: 'S1001', name: '김민준', department: '생산1팀', role: UserRole.OPERATOR },
  { employeeNo: 'S2001', name: '이서연', department: '생산1팀', role: UserRole.MANAGER },
  { employeeNo: 'S9001', name: '박지훈', department: '전산팀', role: UserRole.ADMIN },
];

const equipments = [
  { code: 'CT-01', name: '파이버 레이저 절단기 1호', process: EquipmentProcess.CUTTING, status: EquipmentStatus.RUNNING, location: 'A동 1라인' },
  { code: 'PR-01', name: '800톤 프레스 1호', process: EquipmentProcess.PRESSING, status: EquipmentStatus.RUNNING, location: 'A동 2라인' },
  { code: 'PR-02', name: '500톤 프레스 2호', process: EquipmentProcess.PRESSING, status: EquipmentStatus.MAINTENANCE, location: 'A동 3라인' },
  { code: 'QC-01', name: '3차원 측정기', process: EquipmentProcess.INSPECTION, status: EquipmentStatus.IDLE, location: '품질실' },
];

const items = [
  { code: 'MAT-SPCC12', name: '냉연강판 SPCC 1.2t', type: ItemType.RAW, unit: 'SHEET', spec: '1.2t × 1,000 × 2,000 mm' },
  { code: 'MAT-SAPH23', name: '열연강판 SAPH440 2.3t', type: ItemType.RAW, unit: 'SHEET', spec: '2.3t × 1,219 × 2,438 mm' },
  { code: 'MAT-SGCC08', name: '아연도금강판 SGCC 0.8t', type: ItemType.RAW, unit: 'SHEET', spec: '0.8t × 1,219 × 2,438 mm' },
  { code: 'PRD-BRK100', name: '프런트 서스펜션 브라켓', type: ItemType.FINISHED, unit: 'EA', spec: '절단 → 프레스 성형 → 검사' },
  { code: 'PRD-BRK200', name: '리어 범퍼 마운팅 브라켓', type: ItemType.FINISHED, unit: 'EA', spec: '절단 → 프레스 성형 → 검사' },
  { code: 'PRD-PLT300', name: '배터리 트레이 보강판', type: ItemType.FINISHED, unit: 'EA', spec: '절단 → 프레스 성형 → 검사' },
];

/** 완제품 1개당 원자재 기준 소요량 */
const boms = [
  { parent: 'PRD-BRK100', component: 'MAT-SPCC12', qtyPer: 1 },
  { parent: 'PRD-BRK200', component: 'MAT-SAPH23', qtyPer: 0.5 },
  { parent: 'PRD-PLT300', component: 'MAT-SGCC08', qtyPer: 0.25 },
];

const daysAgo = (n: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};
/** 로컬 날짜 → DATE 컬럼용 UTC 자정 */
const asDbDate = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

async function main() {
  // 1) 거래처·품목 (code 기준 upsert)
  const partnerByCode = new Map<string, number>();
  for (const p of partners) {
    const row = await prisma.partner.upsert({ where: { code: p.code }, update: p, create: p });
    partnerByCode.set(p.code, row.id);
  }
  const itemByCode = new Map<string, number>();
  for (const it of items) {
    const row = await prisma.item.upsert({ where: { code: it.code }, update: it, create: it });
    itemByCode.set(it.code, row.id);
  }

  const userByNo = new Map<string, number>();
  for (const u of users) {
    const row = await prisma.user.upsert({ where: { employeeNo: u.employeeNo }, update: u, create: u });
    userByNo.set(u.employeeNo, row.id);
  }
  // 설비: 상태는 화면에서 바뀔 수 있으므로 최초 생성 시에만 설정
  const equipmentByCode = new Map<string, number>();
  for (const e of equipments) {
    const { status, ...info } = e;
    const row = await prisma.equipment.upsert({
      where: { code: e.code },
      update: info,
      create: {
        ...e,
        installedAt: asDbDate(daysAgo(900)),
        logs: { create: { type: EquipmentLogType.STATUS_CHANGE, toStatus: status, note: 'REGISTERED', userId: userByNo.get('S9001') } },
      },
    });
    equipmentByCode.set(e.code, row.id);
  }

  // 2) BOM ((완제품, 원자재) 기준 upsert)
  for (const b of boms) {
    const parentId = itemByCode.get(b.parent)!;
    const componentId = itemByCode.get(b.component)!;
    await prisma.bomLine.upsert({
      where: { parentId_componentId: { parentId, componentId } },
      update: { qtyPer: b.qtyPer },
      create: { parentId, componentId, qtyPer: b.qtyPer },
    });
  }

  // 3) 완료 사례: 열연강판 50장 입고 → 리어 브라켓 40개 지시 → 강판 20장 투입 → 양품 38·불량 2
  const seededCase = await prisma.lot.findUnique({ where: { lotNo: 'FG-SEED-0001' } });
  if (seededCase) {
    console.log('· 완료 사례(FG-SEED-0001)가 이미 있어 건너뜁니다.');
  } else {
    await prisma.$transaction(async (tx) => {
      const rawItemId = itemByCode.get('MAT-SAPH23')!;
      const fgItemId = itemByCode.get('PRD-BRK200')!;
      const receivedAt = daysAgo(3, 10);
      const confirmedAt = daysAgo(1, 16);

      const rawLot = await tx.lot.create({
        data: { lotNo: 'RM-SEED-0001', itemId: rawItemId, initialQty: 50, qty: 30, createdAt: receivedAt },
      });
      const receipt = await tx.receipt.create({
        data: {
          receiptNo: 'RC-SEED-0001',
          partnerId: partnerByCode.get('SUP-002')!,
          itemId: rawItemId,
          lotId: rawLot.id,
          receiptDate: asDbDate(receivedAt),
          qty: 50,
          supplierLotNo: 'HB-2311-A07',
          note: '시드 완료 사례',
          createdAt: receivedAt,
        },
      });
      await tx.inventoryTransaction.create({
        data: {
          type: InventoryTxType.MATERIAL_RECEIPT,
          itemId: rawItemId,
          lotId: rawLot.id,
          qty: 50,
          balanceAfter: 50,
          receiptId: receipt.id,
          occurredAt: receivedAt,
        },
      });

      const wo = await tx.workOrder.create({
        data: {
          workOrderNo: 'WO-SEED-0001',
          itemId: fgItemId,
          plannedQty: 40,
          workDate: asDbDate(confirmedAt),
          status: WorkOrderStatus.COMPLETED,
          completedAt: confirmedAt,
          note: '시드 완료 사례',
          createdAt: daysAgo(2, 8),
        },
      });
      const fgLot = await tx.lot.create({
        data: { lotNo: 'FG-SEED-0001', itemId: fgItemId, initialQty: 38, qty: 38, createdAt: confirmedAt },
      });
      const result = await tx.productionResult.create({
        data: {
          resultNo: 'PR-SEED-0001',
          workOrderId: wo.id,
          goodQty: 38,
          defectQty: 2,
          finishedLotId: fgLot.id,
          note: '프레스 성형 버(burr) 불량 2개',
          confirmedAt,
        },
      });
      await tx.materialConsumption.create({
        data: { productionResultId: result.id, lotId: rawLot.id, qty: 20 },
      });
      await tx.inventoryTransaction.createMany({
        data: [
          {
            type: InventoryTxType.PRODUCTION_ISSUE,
            itemId: rawItemId,
            lotId: rawLot.id,
            qty: -20,
            balanceAfter: 30,
            productionResultId: result.id,
            occurredAt: confirmedAt,
          },
          {
            type: InventoryTxType.PRODUCTION_RECEIPT,
            itemId: fgItemId,
            lotId: fgLot.id,
            qty: 38,
            balanceAfter: 38,
            productionResultId: result.id,
            occurredAt: confirmedAt,
          },
        ],
      });
    });
    console.log('· 완료 사례 생성: RM-SEED-0001 → WO-SEED-0001 → FG-SEED-0001');
  }

  // 4) 대기 작업지시 사례: 아연도금강판 200장 입고 + 보강판 100개 작업지시 (미확정)
  const seededOpen = await prisma.workOrder.findUnique({ where: { workOrderNo: 'WO-SEED-0002' } });
  if (seededOpen) {
    console.log('· 대기 작업지시(WO-SEED-0002)가 이미 있어 건너뜁니다.');
  } else {
    await prisma.$transaction(async (tx) => {
      const rawItemId = itemByCode.get('MAT-SGCC08')!;
      const receivedAt = daysAgo(2, 14);
      const rawLot = await tx.lot.create({
        data: { lotNo: 'RM-SEED-0002', itemId: rawItemId, initialQty: 200, qty: 200, createdAt: receivedAt },
      });
      const receipt = await tx.receipt.create({
        data: {
          receiptNo: 'RC-SEED-0002',
          partnerId: partnerByCode.get('SUP-003')!,
          itemId: rawItemId,
          lotId: rawLot.id,
          receiptDate: asDbDate(receivedAt),
          qty: 200,
          supplierLotNo: 'YJ-2311-118',
          createdAt: receivedAt,
        },
      });
      await tx.inventoryTransaction.create({
        data: {
          type: InventoryTxType.MATERIAL_RECEIPT,
          itemId: rawItemId,
          lotId: rawLot.id,
          qty: 200,
          balanceAfter: 200,
          receiptId: receipt.id,
          occurredAt: receivedAt,
        },
      });
      await tx.workOrder.create({
        data: {
          workOrderNo: 'WO-SEED-0002',
          itemId: itemByCode.get('PRD-PLT300')!,
          plannedQty: 100,
          workDate: asDbDate(daysAgo(-1)),
          note: '시드 대기 작업지시',
        },
      });
    });
    console.log('· 대기 작업지시 생성: RM-SEED-0002, WO-SEED-0002');
  }

  // 5) 영업 완료 사례: 한결모터스 리어 브라켓 38개 수주 → WO-SEED-0001 생산 → 20개 출하 (FG-SEED-0001 잔량 18)
  const seededSo = await prisma.salesOrder.findUnique({ where: { orderNo: 'SO-SEED-0001' } });
  const seedWo = await prisma.workOrder.findUnique({ where: { workOrderNo: 'WO-SEED-0001' } });
  const seedFg = await prisma.lot.findUnique({ where: { lotNo: 'FG-SEED-0001' } });
  if (seededSo) {
    console.log('· 수주·출하 사례(SO-SEED-0001)가 이미 있어 건너뜁니다.');
  } else if (seedWo && seedFg && Number(seedFg.qty) >= 20) {
    await prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.create({
        data: {
          orderNo: 'SO-SEED-0001',
          customerId: partnerByCode.get('CUS-001')!,
          itemId: itemByCode.get('PRD-BRK200')!,
          qty: 38,
          orderDate: asDbDate(daysAgo(4)),
          dueDate: asDbDate(daysAgo(-3)),
          status: SalesOrderStatus.PARTIALLY_SHIPPED,
          note: '시드 수주 사례',
          createdAt: daysAgo(4),
        },
      });
      await tx.workOrder.update({
        where: { id: seedWo.id },
        data: { salesOrderId: so.id, equipmentId: equipmentByCode.get('PR-01') },
      });
      const shippedAt = daysAgo(0, 9);
      const shipment = await tx.shipment.create({
        data: {
          shipmentNo: 'SH-SEED-0001',
          salesOrderId: so.id,
          shipDate: asDbDate(shippedAt),
          qty: 20,
          note: '1차 납품',
          createdById: userByNo.get('S1001'),
          createdAt: shippedAt,
          lines: { create: { lotId: seedFg.id, qty: 20 } },
        },
      });
      const after = await tx.lot.update({ where: { id: seedFg.id }, data: { qty: { decrement: 20 } } });
      await tx.inventoryTransaction.create({
        data: {
          type: InventoryTxType.SHIPMENT,
          itemId: seedFg.itemId,
          lotId: seedFg.id,
          qty: -20,
          balanceAfter: after.qty,
          shipmentId: shipment.id,
          occurredAt: shippedAt,
        },
      });
    });
    console.log('· 수주·출하 사례 생성: SO-SEED-0001 → WO-SEED-0001 → SH-SEED-0001 (20개 출하)');
  }

  // 6) 결재 완료 사례: WO-SEED-0001 생산실적 결재 (김민준 요청 → 이서연 승인)
  const seedResult = await prisma.productionResult.findUnique({ where: { resultNo: 'PR-SEED-0001' }, include: { consumptions: true } });
  if (await prisma.approvalRequest.findUnique({ where: { requestNo: 'AP-SEED-0001' } })) {
    console.log('· 결재 사례(AP-SEED-0001)가 이미 있어 건너뜁니다.');
  } else if (seedWo && seedResult) {
    await prisma.approvalRequest.create({
      data: {
        requestNo: 'AP-SEED-0001',
        docType: ApprovalDocType.PRODUCTION_RESULT,
        workOrderId: seedWo.id,
        payload: {
          workOrderId: seedWo.id,
          goodQty: seedResult.goodQty,
          defectQty: seedResult.defectQty,
          note: seedResult.note,
          consumptions: seedResult.consumptions.map((c) => ({ lotId: c.lotId, qty: Number(c.qty) })),
        },
        status: ApprovalStatus.APPROVED,
        requesterId: userByNo.get('S1001')!,
        approverId: userByNo.get('S2001')!,
        comment: '불량 사유 확인 완료',
        requestedAt: new Date(seedResult.confirmedAt.getTime() - 60 * 60 * 1000),
        decidedAt: seedResult.confirmedAt,
        productionResultId: seedResult.id,
      },
    });
    console.log('· 결재 사례 생성: AP-SEED-0001 (승인)');
  }

  // 7) 기본 데모용 접수 수주: 대양오토 프런트 브라켓 18개 (화면에서 작업지시 생성부터 진행)
  if (!(await prisma.salesOrder.findUnique({ where: { orderNo: 'SO-SEED-0002' } }))) {
    await prisma.salesOrder.create({
      data: {
        orderNo: 'SO-SEED-0002',
        customerId: partnerByCode.get('CUS-002')!,
        itemId: itemByCode.get('PRD-BRK100')!,
        qty: 18,
        orderDate: asDbDate(daysAgo(1)),
        dueDate: asDbDate(daysAgo(-5)),
        note: '기본 데모 수주',
      },
    });
    console.log('· 데모 수주 생성: SO-SEED-0002 (접수)');
  }
  const seedOpenWo = await prisma.workOrder.findUnique({ where: { workOrderNo: 'WO-SEED-0002' } });
  if (seedOpenWo && !seedOpenWo.equipmentId) {
    await prisma.workOrder.update({ where: { id: seedOpenWo.id }, data: { equipmentId: equipmentByCode.get('PR-01') } });
  }

  const counts = {
    partners: await prisma.partner.count(),
    items: await prisma.item.count(),
    bomLines: await prisma.bomLine.count(),
    lots: await prisma.lot.count(),
    workOrders: await prisma.workOrder.count(),
    salesOrders: await prisma.salesOrder.count(),
    users: await prisma.user.count(),
    equipments: await prisma.equipment.count(),
  };
  console.log('✔ 시드 완료', counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
