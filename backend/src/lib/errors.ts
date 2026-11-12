import { Prisma } from '@prisma/client';

/**
 * API 오류 코드. 프론트엔드는 이 코드를 번역 키(errors.<CODE>)로 매핑합니다.
 * 메시지는 개발자용 영문 설명이며 화면에 직접 노출하지 않습니다.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_CODE: 'DUPLICATE_CODE',
  INVALID_ITEM_TYPE: 'INVALID_ITEM_TYPE',
  INVALID_BOM: 'INVALID_BOM',
  BOM_NOT_DEFINED: 'BOM_NOT_DEFINED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  WORK_ORDER_ALREADY_CONFIRMED: 'WORK_ORDER_ALREADY_CONFIRMED',
  LOT_NOT_IN_BOM: 'LOT_NOT_IN_BOM',
  DUPLICATE_LOT_LINE: 'DUPLICATE_LOT_LINE',
  INVALID_PRODUCTION_QTY: 'INVALID_PRODUCTION_QTY',
  INVALID_PARTNER_TYPE: 'INVALID_PARTNER_TYPE',
  // 영업
  SHIPMENT_EXCEEDS_ORDER: 'SHIPMENT_EXCEEDS_ORDER',
  SALES_ORDER_CLOSED: 'SALES_ORDER_CLOSED',
  LOT_ITEM_MISMATCH: 'LOT_ITEM_MISMATCH',
  // 결재
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVAL_ALREADY_PENDING: 'APPROVAL_ALREADY_PENDING',
  APPROVAL_ALREADY_DECIDED: 'APPROVAL_ALREADY_DECIDED',
  FORBIDDEN_ROLE: 'FORBIDDEN_ROLE',
  // 설비
  EQUIPMENT_UNAVAILABLE: 'EQUIPMENT_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (resource: string, key: string | number) =>
  new AppError(404, ErrorCode.NOT_FOUND, `${resource} not found: ${key}`, { resource, key });

/** Prisma 고유 제약 위반(P2002) 여부와 대상 컬럼 */
export function uniqueViolationTarget(err: unknown): string[] | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = err.meta?.target;
    if (Array.isArray(target)) return target.map(String);
    if (typeof target === 'string') return [target];
    return [];
  }
  return null;
}
