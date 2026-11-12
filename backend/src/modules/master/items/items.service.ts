import { z } from 'zod';
import { ItemType } from '@prisma/client';
import { prisma } from '../../../db.js';
import { AppError, ErrorCode, notFound, uniqueViolationTarget } from '../../../lib/errors.js';
import { num, paging, type Paged } from '../../../lib/format.js';
import { zId, zOptionalQuery, zOptionalText, zPagination, zQty } from '../../../lib/validate.js';

/** 단위 코드. 화면 표시명은 프론트 번역 리소스(units.*)에서 관리합니다. */
export const UNIT_CODES = ['EA', 'SHEET', 'KG', 'M', 'SET'] as const;

const bomLinesSchema = z
  .array(z.object({ componentId: zId, qtyPer: zQty }))
  .max(50);

export const itemCreateSchema = z.object({
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9_.-]+$/),
  name: z.string().trim().min(1).max(100),
  type: z.enum(ItemType),
  unit: z.enum(UNIT_CODES),
  spec: zOptionalText,
  bomLines: bomLinesSchema.optional(),
});

export const bomUpdateSchema = z.object({ lines: bomLinesSchema });

export const itemListSchema = z.object({
  q: zOptionalQuery,
  type: z.enum(ItemType).optional(),
  ...zPagination,
});

export type ItemDto = {
  id: number;
  code: string;
  name: string;
  type: ItemType;
  unit: string;
  spec: string | null;
  createdAt: string;
  stockQty: number;
  bomLines: { id: number; componentId: number; componentCode: string; componentName: string; unit: string; qtyPer: number }[];
};

const itemInclude = {
  bomLines: { include: { component: true }, orderBy: { id: 'asc' as const } },
} as const;

async function stockByItem(itemIds: number[]): Promise<Map<number, number>> {
  if (itemIds.length === 0) return new Map();
  const groups = await prisma.lot.groupBy({
    by: ['itemId'],
    where: { itemId: { in: itemIds } },
    _sum: { qty: true },
  });
  return new Map(groups.map((g) => [g.itemId, num(g._sum.qty)]));
}

type ItemWithBom = Awaited<ReturnType<typeof findItemWithBom>>;
const findItemWithBom = (id: number) =>
  prisma.item.findUnique({ where: { id }, include: itemInclude });

function toItemDto(item: NonNullable<ItemWithBom>, stockQty: number): ItemDto {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    type: item.type,
    unit: item.unit,
    spec: item.spec,
    createdAt: item.createdAt.toISOString(),
    stockQty,
    bomLines: item.bomLines.map((l) => ({
      id: l.id,
      componentId: l.componentId,
      componentCode: l.component.code,
      componentName: l.component.name,
      unit: l.component.unit,
      qtyPer: num(l.qtyPer),
    })),
  };
}

export async function listItems(input: z.output<typeof itemListSchema>): Promise<Paged<ItemDto>> {
  const where = {
    ...(input.type ? { type: input.type } : {}),
    ...(input.q
      ? {
          OR: [
            { code: { contains: input.q, mode: 'insensitive' as const } },
            { name: { contains: input.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: itemInclude,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.item.count({ where }),
  ]);
  const stock = await stockByItem(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toItemDto(r, stock.get(r.id) ?? 0)),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getItem(id: number): Promise<ItemDto> {
  const item = await findItemWithBom(id);
  if (!item) throw notFound('item', id);
  const stock = await stockByItem([id]);
  return toItemDto(item, stock.get(id) ?? 0);
}

/** BOM 규칙: 완제품만 BOM 을 가지며, 구성품은 원자재여야 하고 중복될 수 없습니다. */
async function assertValidBom(parentType: ItemType, lines: { componentId: number }[]) {
  if (lines.length === 0) return;
  if (parentType !== ItemType.FINISHED) {
    throw new AppError(400, ErrorCode.INVALID_BOM, 'Only finished goods can have a BOM', {
      reason: 'PARENT_NOT_FINISHED',
    });
  }
  const ids = lines.map((l) => l.componentId);
  if (new Set(ids).size !== ids.length) {
    throw new AppError(400, ErrorCode.INVALID_BOM, 'Duplicate BOM component', { reason: 'DUPLICATE_COMPONENT' });
  }
  const components = await prisma.item.findMany({ where: { id: { in: ids } } });
  if (components.length !== ids.length) {
    throw new AppError(400, ErrorCode.INVALID_BOM, 'BOM component not found', { reason: 'COMPONENT_NOT_FOUND' });
  }
  const notRaw = components.find((c) => c.type !== ItemType.RAW);
  if (notRaw) {
    throw new AppError(400, ErrorCode.INVALID_BOM, 'BOM component must be a raw material', {
      reason: 'COMPONENT_NOT_RAW',
      itemCode: notRaw.code,
    });
  }
}

export async function createItem(input: z.output<typeof itemCreateSchema>): Promise<ItemDto> {
  const lines = input.bomLines ?? [];
  await assertValidBom(input.type, lines);
  const code = input.code.toUpperCase();
  try {
    const item = await prisma.item.create({
      data: {
        code,
        name: input.name,
        type: input.type,
        unit: input.unit,
        spec: input.spec,
        bomLines: { create: lines.map((l) => ({ componentId: l.componentId, qtyPer: l.qtyPer })) },
      },
    });
    return getItem(item.id);
  } catch (err) {
    if (uniqueViolationTarget(err)) {
      throw new AppError(409, ErrorCode.DUPLICATE_CODE, 'Item code already exists', { code });
    }
    throw err;
  }
}

/** BOM 전체 교체 (삭제 후 재등록을 하나의 트랜잭션으로) */
export async function replaceBom(itemId: number, input: z.output<typeof bomUpdateSchema>): Promise<ItemDto> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw notFound('item', itemId);
  if (input.lines.length > 0) await assertValidBom(item.type, input.lines);
  if (input.lines.some((l) => l.componentId === itemId)) {
    throw new AppError(400, ErrorCode.INVALID_BOM, 'Item cannot reference itself', { reason: 'SELF_REFERENCE' });
  }
  await prisma.$transaction([
    prisma.bomLine.deleteMany({ where: { parentId: itemId } }),
    prisma.bomLine.createMany({
      data: input.lines.map((l) => ({ parentId: itemId, componentId: l.componentId, qtyPer: l.qtyPer })),
    }),
  ]);
  return getItem(itemId);
}
