import { z } from 'zod';
import { UserRole, type Prisma } from '@prisma/client';
import { prisma } from '../../../db.js';
import { AppError, ErrorCode, notFound, uniqueViolationTarget } from '../../../lib/errors.js';
import { paging, type Paged } from '../../../lib/format.js';
import { zOptionalQuery, zPagination } from '../../../lib/validate.js';

export const userCreateSchema = z.object({
  employeeNo: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(50),
  department: z.string().trim().min(1).max(50),
  role: z.enum(UserRole),
});

export const userUpdateSchema = z
  .object({
    role: z.enum(UserRole),
    active: z.boolean(),
  })
  .partial();

export const userListSchema = z.object({
  q: zOptionalQuery,
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  ...zPagination,
});

export type UserDto = {
  id: number;
  employeeNo: string;
  name: string;
  department: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
};

const toDto = (u: Prisma.UserGetPayload<object>): UserDto => ({
  id: u.id,
  employeeNo: u.employeeNo,
  name: u.name,
  department: u.department,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt.toISOString(),
});

export async function listUsers(input: z.output<typeof userListSchema>): Promise<Paged<UserDto>> {
  const where: Prisma.UserWhereInput = {
    ...(input.activeOnly ? { active: true } : {}),
    ...(input.q
      ? {
          OR: [
            { employeeNo: { contains: input.q, mode: 'insensitive' } },
            { name: { contains: input.q, mode: 'insensitive' } },
            { department: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { employeeNo: 'asc' }, ...paging(input.page, input.pageSize) }),
    prisma.user.count({ where }),
  ]);
  return { items: rows.map(toDto), total, page: input.page, pageSize: input.pageSize };
}

export async function createUser(input: z.output<typeof userCreateSchema>): Promise<UserDto> {
  const employeeNo = input.employeeNo.toUpperCase();
  try {
    return toDto(await prisma.user.create({ data: { ...input, employeeNo } }));
  } catch (err) {
    if (uniqueViolationTarget(err)) {
      throw new AppError(409, ErrorCode.DUPLICATE_CODE, 'Employee number already exists', { code: employeeNo });
    }
    throw err;
  }
}

export async function updateUser(id: number, input: z.output<typeof userUpdateSchema>): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('user', id);
  return toDto(await prisma.user.update({ where: { id }, data: input }));
}
