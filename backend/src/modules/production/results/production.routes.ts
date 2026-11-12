import { Router } from 'express';
import { AppError, ErrorCode } from '../../../lib/errors.js';
import { parse, zId } from '../../../lib/validate.js';
import { getSettings } from '../../system/settings/settings.service.js';
import {
  confirmProduction,
  confirmProductionSchema,
  getProductionResult,
  listProductionResults,
  productionListSchema,
} from './production.service.js';

export const productionRouter = Router();

productionRouter.get('/', async (req, res) => {
  res.json(await listProductionResults(parse(productionListSchema, req.query)));
});

/** 직접 확정 — 시스템 설정에서 생산실적 결재를 끈 경우에만 허용 (켜져 있으면 /api/approvals 로 결재 요청) */
productionRouter.post('/', async (req, res) => {
  const input = parse(confirmProductionSchema, req.body);
  if ((await getSettings()).productionApprovalRequired) {
    throw new AppError(409, ErrorCode.APPROVAL_REQUIRED, 'Production results require approval');
  }
  res.status(201).json(await confirmProduction(input));
});

productionRouter.get('/:id', async (req, res) => {
  res.json(await getProductionResult(parse(zId, req.params.id)));
});
