import { z } from 'zod';
import { EquipmentLogType, EquipmentProcess, EquipmentStatus, type Prisma, type User } from '@prisma/client';
import { prisma } from '../../db.js';
import { AppError, ErrorCode, notFound, uniqueViolationTarget } from '../../lib/errors.js';
import { dateOnly, paging, toDbDate, type Paged } from '../../lib/format.js';
import { zDate, zOptionalQuery, zOptionalText, zPagination } from '../../lib/validate.js';

export const equipmentCreateSchema = z.object({
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_.-]+$/),
  name: z.string().trim().min(1).max(100),
  process: z.enum(EquipmentProcess),
  status: z.enum(EquipmentStatus).default(EquipmentStatus.IDLE),
  location: zOptionalText,
  installedAt: zDate.optional().nullable(),
  note: zOptionalText,
});

export const equipmentListSchema = z.object({
  q: zOptionalQuery,
  process: z.enum(EquipmentProcess).optional(),
  status: z.enum(EquipmentStatus).optional(),
  ...zPagination,
});

/** 상태 변경 또는 점검·수리 기록. 상태 변경은 STATUS_CHANGE 이력으로 자동 기록됩니다. */
export const equipmentLogSchema = z.object({
  type: z.enum(EquipmentLogType),
  toStatus: z.enum(EquipmentStatus).optional(),
  note: zOptionalText,
});

const logInclude = { user: true } as const;

export type EquipmentDto = {
  id: number;
  code: string;
  name: string;
  process: EquipmentProcess;
  status: EquipmentStatus;
  location: string | null;
  installedAt: string | null;
  note: string | null;
  createdAt: string;
  openWorkOrderCount: number;
};

type EquipmentRow = Prisma.EquipmentGetPayload<{ include: { _count: { select: { workOrders: true } } } }>;

function toDto(e: EquipmentRow, openWorkOrderCount: number): EquipmentDto {
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    process: e.process,
    status: e.status,
    location: e.location,
    installedAt: e.installedAt ? dateOnly(e.installedAt) : null,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    openWorkOrderCount,
  };
}

async function openCounts(ids: number[]) {
  const groups = await prisma.workOrder.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: ids }, status: 'PLANNED' },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.equipmentId, g._count._all]));
}

export async function listEquipments(input: z.output<typeof equipmentListSchema>): Promise<Paged<EquipmentDto>> {
  const where: Prisma.EquipmentWhereInput = {
    ...(input.process ? { process: input.process } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { code: { contains: input.q, mode: 'insensitive' } },
            { name: { contains: input.q, mode: 'insensitive' } },
            { location: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      include: { _count: { select: { workOrders: true } } },
      orderBy: [{ process: 'asc' }, { code: 'asc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.equipment.count({ where }),
  ]);
  const counts = await openCounts(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toDto(r, counts.get(r.id) ?? 0)),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function createEquipment(input: z.output<typeof equipmentCreateSchema>, user: User) {
  const code = input.code.toUpperCase();
  try {
    const created = await prisma.equipment.create({
      data: {
        ...input,
        code,
        installedAt: input.installedAt ? toDbDate(input.installedAt) : null,
        logs: { create: { type: EquipmentLogType.STATUS_CHANGE, toStatus: input.status, note: 'REGISTERED', userId: user.id } },
      },
    });
    return getEquipment(created.id);
  } catch (err) {
    if (uniqueViolationTarget(err)) {
      throw new AppError(409, ErrorCode.DUPLICATE_CODE, 'Equipment code already exists', { code });
    }
    throw err;
  }
}

export async function getEquipment(id: number) {
  const e = await prisma.equipment.findUnique({
    where: { id },
    include: {
      _count: { select: { workOrders: true } },
      logs: { include: logInclude, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 50 },
      workOrders: { include: { item: true }, orderBy: [{ workDate: 'desc' }, { id: 'desc' }], take: 20 },
    },
  });
  if (!e) throw notFound('equipment', id);
  const counts = await openCounts([id]);
  return {
    ...toDto(e, counts.get(id) ?? 0),
    logs: e.logs.map((l) => ({
      id: l.id,
      type: l.type,
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      note: l.note,
      userName: l.user?.name ?? null,
      occurredAt: l.occurredAt.toISOString(),
    })),
    workOrders: e.workOrders.map((w) => ({
      id: w.id,
      workOrderNo: w.workOrderNo,
      workDate: dateOnly(w.workDate),
      status: w.status,
      plannedQty: w.plannedQty,
      item: { code: w.item.code, name: w.item.name },
    })),
  };
}

/**
 * 설비 이력 등록. toStatus 가 있으면 상태를 바꾸고 이전/이후 상태를 함께 남깁니다.
 * (상태 변경과 이력 기록은 한 트랜잭션)
 */
export async function addEquipmentLog(id: number, input: z.output<typeof equipmentLogSchema>, user: User) {
  await prisma.$transaction(async (tx) => {
    const e = await tx.equipment.findUnique({ where: { id } });
    if (!e) throw notFound('equipment', id);
    const changing = input.toStatus && input.toStatus !== e.status;
    if (changing) await tx.equipment.update({ where: { id }, data: { status: input.toStatus } });
    await tx.equipmentLog.create({
      data: {
        equipmentId: id,
        type: input.type,
        fromStatus: changing ? e.status : null,
        toStatus: changing ? input.toStatus : null,
        note: input.note,
        userId: user.id,
      },
    });
  });
  return getEquipment(id);
}
