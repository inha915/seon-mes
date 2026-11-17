import { z } from 'zod'
import { PartnerType, type Prisma } from '@prisma/client'
import { prisma } from '../../../db.js'
import {
  AppError,
  ErrorCode,
  uniqueViolationTarget,
} from '../../../lib/errors.js'
import { paging, type Paged } from '../../../lib/format.js'
import { zOptionalQuery, zOptionalText, zPagination } from '../../../lib/zod.js'

export const partnerCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(100),
  type: z.enum(PartnerType).default(PartnerType.SUPPLIER),
  businessNo: zOptionalText,
  contactName: zOptionalText,
  phone: zOptionalText,
})

export const partnerListSchema = z.object({
  q: zOptionalQuery,
  role: z.enum([PartnerType.SUPPLIER, PartnerType.CUSTOMER]).optional(),
  ...zPagination,
})

export type PartnerDto = {
  id: number
  code: string
  name: string
  type: PartnerType
  businessNo: string | null
  contactName: string | null
  phone: string | null
  createdAt: string
  receiptCount: number
  salesOrderCount: number
}

export const partnerRoleWhere = (
  role: PartnerType,
): Prisma.PartnerWhereInput => ({
  type: { in: [role, PartnerType.BOTH] },
})

export async function listPartners(
  input: z.output<typeof partnerListSchema>,
): Promise<Paged<PartnerDto>> {
  const where: Prisma.PartnerWhereInput = {
    ...(input.role ? partnerRoleWhere(input.role) : {}),
    ...(input.q
      ? {
          OR: [
            { code: { contains: input.q, mode: 'insensitive' } },
            { name: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { _count: { select: { receipts: true, salesOrders: true } } },
      ...paging(input.page, input.pageSize),
    }),
    prisma.partner.count({ where }),
  ])
  return {
    items: rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      type: p.type,
      businessNo: p.businessNo,
      contactName: p.contactName,
      phone: p.phone,
      createdAt: p.createdAt.toISOString(),
      receiptCount: p._count.receipts,
      salesOrderCount: p._count.salesOrders,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  }
}

export async function createPartner(
  input: z.output<typeof partnerCreateSchema>,
) {
  try {
    return await prisma.partner.create({
      data: { ...input, code: input.code.toUpperCase() },
    })
  } catch (err) {
    if (uniqueViolationTarget(err)) {
      throw new AppError(
        409,
        ErrorCode.DUPLICATE_CODE,
        'Partner code already exists',
        {
          code: input.code.toUpperCase(),
        },
      )
    }
    throw err
  }
}

export function assertPartnerRole(
  partner: { code: string; type: PartnerType },
  role: PartnerType,
) {
  if (partner.type !== role && partner.type !== PartnerType.BOTH) {
    throw new AppError(
      400,
      ErrorCode.INVALID_PARTNER_TYPE,
      'Partner type not allowed',
      {
        partnerCode: partner.code,
        expected: role,
      },
    )
  }
}
