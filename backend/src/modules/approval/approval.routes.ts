import { Router } from 'express';
import { currentUser } from '../../lib/current-user.js';
import { parse, zId } from '../../lib/validate.js';
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
} from './approval.service.js';

export const approvalRouter = Router();

approvalRouter.get('/', async (req, res) => {
  res.json(await listApprovals(parse(approvalListSchema, req.query)));
});

approvalRouter.post('/', async (req, res) => {
  res.status(201).json(await requestApproval(parse(approvalCreateSchema, req.body), await currentUser(req)));
});

approvalRouter.get('/:id', async (req, res) => {
  res.json(await getApproval(parse(zId, req.params.id)));
});

approvalRouter.post('/:id/approve', async (req, res) => {
  const { comment } = parse(approvalDecisionSchema, req.body ?? {});
  res.json(await approveRequest(parse(zId, req.params.id), comment, await currentUser(req)));
});

approvalRouter.post('/:id/reject', async (req, res) => {
  const { comment } = parse(approvalDecisionSchema, req.body ?? {});
  res.json(await rejectRequest(parse(zId, req.params.id), comment, await currentUser(req)));
});

approvalRouter.post('/:id/cancel', async (req, res) => {
  res.json(await cancelRequest(parse(zId, req.params.id), await currentUser(req)));
});
