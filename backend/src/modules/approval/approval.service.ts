import { z } from 'zod';
import { ApprovalDocType, ApprovalStatus, type Prisma, type User } from '@prisma/client';
import { prisma } from '../../db.js';
import { APPROVER_ROLES, assertRole, userRef } from '../../lib/current-user.js';
import { AppError, ErrorCode, notFound, uniqueViolationTarget } from '../../lib/errors.js';
import { num, paging, todayString, type Paged } from '../../lib/format.js';
import { DocPrefix, nextDocumentNo } from '../../lib/sequence.js';
import { zOptionalQuery, zOptionalText, zPagination } from '../../lib/validate.js';
import {
  CONFIRM_TX_OPTIONS,
  confirmProductionSchema,
  confirmProductionTx,
  getProductionResult,
  mapConfirmError,
  precheckProduction,
  type ConfirmProductionInput,
} from '../production/results/production.service.js';

export const approvalListSchema = z.object({
  q: zOptionalQuery,
  status: z.enum(ApprovalStatus).optional(),
  ...zPagination,
});

export const approvalCreateSchema = confirmProductionSchema;
export const approvalDecisionSchema = z.object({ comment: zOptionalText });

const include = {
  workOrder: { include: { item: true } },
  requester: true,
  approver: true,
  productionResult: { include: { finishedLot: true } },
} as const satisfies Prisma.ApprovalRequestInclude;

type Row = Prisma.ApprovalRequestGetPayload<{ include: typeof include }>;
export type ApprovalDto = Awaited<ReturnType<typeof toDto>>;

/** 결재 문서 표시용: 투입 LOT 번호를 함께 보여줍니다. */
async function toDto(r: Row) {
  const payload = r.payload as unknown as ConfirmProductionInput;
  const lots = await prisma.lot.findMany({
    where: { id: { in: payload.consumptions.map((c) => c.lotId) } },
    include: { item: true },
  });
  const lotById = new Map(lots.map((l) => [l.id, l]));
  return {
    id: r.id,
    requestNo: r.requestNo,
    docType: r.docType,
    status: r.status,
    comment: r.comment,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    requester: userRef(r.requester),
    approver: r.approver ? userRef(r.approver) : null,
    workOrder: {
      id: r.workOrder.id,
      workOrderNo: r.workOrder.workOrderNo,
      plannedQty: r.workOrder.plannedQty,
      status: r.workOrder.status,
      item: { code: r.workOrder.item.code, name: r.workOrder.item.name, unit: r.workOrder.item.unit },
    },
    content: {
      goodQty: payload.goodQty,
      defectQty: payload.defectQty,
      note: payload.note ?? null,
      consumptions: payload.consumptions.map((c) => {
        const lot = lotById.get(c.lotId);
        return {
          lotId: c.lotId,
          lotNo: lot?.lotNo ?? String(c.lotId),
          itemCode: lot?.item.code ?? '',
          unit: lot?.item.unit ?? '',
          qty: c.qty,
          currentQty: lot ? num(lot.qty) : 0,
        };
      }),
    },
    result: r.productionResult
      ? {
          id: r.productionResult.id,
          resultNo: r.productionResult.resultNo,
          finishedLotNo: r.productionResult.finishedLot?.lotNo ?? null,
        }
      : null,
  };
}

export async function listApprovals(input: z.output<typeof approvalListSchema>): Promise<Paged<ApprovalDto>> {
  const where: Prisma.ApprovalRequestWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { requestNo: { contains: input.q, mode: 'insensitive' } },
            { workOrder: { workOrderNo: { contains: input.q, mode: 'insensitive' } } },
            { requester: { name: { contains: input.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include,
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }, { id: 'desc' }],
      ...paging(input.page, input.pageSize),
    }),
    prisma.approvalRequest.count({ where }),
  ]);
  return { items: await Promise.all(rows.map(toDto)), total, page: input.page, pageSize: input.pageSize };
}

export async function getApproval(id: number) {
  const r = await prisma.approvalRequest.findUnique({ where: { id }, include });
  if (!r) throw notFound('approval', id);
  return toDto(r);
}

export const countPendingApprovals = () => prisma.approvalRequest.count({ where: { status: ApprovalStatus.PENDING } });

/**
 * 생산실적 결재 요청. 확정과 같은 사전 검증(precheck)을 통과해야 결재함에 올라갑니다.
 * 작업지시당 대기 요청은 하나만 — 서비스 검사 + 부분 UNIQUE 인덱스(경합 시 P2002)로 이중 방어합니다.
 */
export async function requestApproval(input: ConfirmProductionInput, user: User) {
  try {
    const id = await prisma.$transaction(async (tx) => {
      const { wo } = await precheckProduction(tx, input);
      const pending = await tx.approvalRequest.findFirst({
        where: { workOrderId: wo.id, status: ApprovalStatus.PENDING },
      });
      if (pending) {
        throw new AppError(409, ErrorCode.APPROVAL_ALREADY_PENDING, 'Approval already pending', {
          workOrderNo: wo.workOrderNo,
          requestNo: pending.requestNo,
        });
      }
      const created = await tx.approvalRequest.create({
        data: {
          requestNo: await nextDocumentNo(tx, DocPrefix.APPROVAL, todayString()),
          docType: ApprovalDocType.PRODUCTION_RESULT,
          workOrderId: wo.id,
          payload: input as unknown as Prisma.InputJsonValue,
          requesterId: user.id,
        },
      });
      return created.id;
    });
    return getApproval(id);
  } catch (err) {
    if (uniqueViolationTarget(err)) {
      const wo = await prisma.workOrder.findUnique({ where: { id: input.workOrderId } });
      throw new AppError(409, ErrorCode.APPROVAL_ALREADY_PENDING, 'Approval already pending', {
        workOrderNo: wo?.workOrderNo ?? String(input.workOrderId),
      });
    }
    throw err;
  }
}

const alreadyDecided = (r: { requestNo: string; status: ApprovalStatus }) =>
  new AppError(409, ErrorCode.APPROVAL_ALREADY_DECIDED, 'Approval already decided', {
    requestNo: r.requestNo,
    status: r.status,
  });

/**
 * 승인 = 결재 상태 변경 + 생산실적 확정을 하나의 트랜잭션으로 실행.
 * 승인 시점에 재고가 부족하거나 작업지시가 이미 확정됐다면 전체가 롤백되어 결재는 PENDING 으로 남습니다.
 */
export async function approveRequest(id: number, comment: string | null, user: User) {
  assertRole(user, APPROVER_ROLES);
  const request = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!request) throw notFound('approval', id);
  if (request.status !== ApprovalStatus.PENDING) throw alreadyDecided(request);
  const payload = request.payload as unknown as ConfirmProductionInput;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.approvalRequest.updateMany({
        where: { id, status: ApprovalStatus.PENDING },
        data: { status: ApprovalStatus.APPROVED, approverId: user.id, comment, decidedAt: new Date() },
      });
      if (claimed.count === 0) throw alreadyDecided({ ...request, status: ApprovalStatus.APPROVED });
      const resultId = await confirmProductionTx(tx, payload);
      await tx.approvalRequest.update({ where: { id }, data: { productionResultId: resultId } });
    }, CONFIRM_TX_OPTIONS);
  } catch (err) {
    throw await mapConfirmError(err, payload.workOrderId);
  }
  return getApproval(id);
}

async function decide(id: number, status: 'REJECTED' | 'CANCELLED', comment: string | null, user: User) {
  const request = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!request) throw notFound('approval', id);
  if (status === ApprovalStatus.REJECTED) assertRole(user, APPROVER_ROLES);
  if (status === ApprovalStatus.CANCELLED && request.requesterId !== user.id) {
    throw new AppError(403, ErrorCode.FORBIDDEN_ROLE, 'Only the requester can cancel', { role: user.role, required: [] });
  }
  const updated = await prisma.approvalRequest.updateMany({
    where: { id, status: ApprovalStatus.PENDING },
    data: { status, comment, decidedAt: new Date(), ...(status === ApprovalStatus.REJECTED ? { approverId: user.id } : {}) },
  });
  if (updated.count === 0) throw alreadyDecided(request);
  return getApproval(id);
}

export const rejectRequest = (id: number, comment: string | null, user: User) => decide(id, 'REJECTED', comment, user);
export const cancelRequest = (id: number, user: User) => decide(id, 'CANCELLED', null, user);

export { getProductionResult };
