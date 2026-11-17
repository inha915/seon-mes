import type { Request, Response } from 'express'
import { currentUser } from '../../lib/currentUser.js'
import { zId } from '../../lib/zod.js'
import { parse } from '../../middleware/validate.js'
import {
  approvalCreateSchema,
  approvalDecisionSchema,
  approvalListSchema,
  approveRequest,
  cancelRequest,
  getApproval,
  listApprovals,
  rejectRequest,
  requestApproval,
} from './approval.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listApprovals(parse(approvalListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  const user = await currentUser(req)
  res
    .status(201)
    .json(await requestApproval(parse(approvalCreateSchema, req.body), user))
}

export const getDetail = async (req: Request, res: Response) => {
  res.json(await getApproval(parse(zId, req.params.id)))
}

export const approve = async (req: Request, res: Response) => {
  const { comment } = parse(approvalDecisionSchema, req.body ?? {})
  const user = await currentUser(req)
  res.json(await approveRequest(parse(zId, req.params.id), comment, user))
}

export const reject = async (req: Request, res: Response) => {
  const { comment } = parse(approvalDecisionSchema, req.body ?? {})
  const user = await currentUser(req)
  res.json(await rejectRequest(parse(zId, req.params.id), comment, user))
}

export const cancel = async (req: Request, res: Response) => {
  const user = await currentUser(req)
  res.json(await cancelRequest(parse(zId, req.params.id), user))
}
