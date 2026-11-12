import type { Request } from 'express';
import { UserRole, type User } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError, ErrorCode, notFound } from './errors.js';

/**
 * 현재 사용자 (데모용).
 * 로그인 기능은 범위에서 제외했기 때문에 프론트 헤더의 사용자 전환 메뉴가 보내는 X-User-Id 로 판단합니다.
 * 헤더가 없으면 첫 번째 활성 사용자(작업자)를 사용합니다. 인증이 아니라 결재 권한·작성자 기록용입니다.
 */
export async function currentUser(req: Request): Promise<User> {
  const raw = req.header('x-user-id');
  const id = raw ? Number(raw) : NaN;
  if (Number.isInteger(id) && id > 0) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.active) throw notFound('user', id);
    return user;
  }
  const fallback = await prisma.user.findFirst({ where: { active: true }, orderBy: { id: 'asc' } });
  if (!fallback) throw notFound('user', 'default');
  return fallback;
}

export function assertRole(user: User, roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new AppError(403, ErrorCode.FORBIDDEN_ROLE, 'User role not permitted', {
      role: user.role,
      required: roles,
    });
  }
}

export const APPROVER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.ADMIN];

export const userRef = (u: { id: number; name: string; department: string; role: UserRole }) => ({
  id: u.id,
  name: u.name,
  department: u.department,
  role: u.role,
});
