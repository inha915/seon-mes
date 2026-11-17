import type { Request, Response } from 'express'
import { AppError, ErrorCode } from '../../../lib/errors.js'
import { zId } from '../../../lib/zod.js'
import { parse } from '../../../middleware/validate.js'
import { getSettings } from '../../system/settings/settings.service.js'
import {
  confirmProduction,
  confirmProductionSchema,
  getProductionResult,
  listProductionResults,
  productionListSchema,
} from './production.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listProductionResults(parse(productionListSchema, req.query)))
}

// 결재를 끈 경우에만 직접 확정. 켜져 있으면 /api/approvals 로 요청해야 한다.
export const confirm = async (req: Request, res: Response) => {
  const input = parse(confirmProductionSchema, req.body)
  const { productionApprovalRequired } = await getSettings()
  if (productionApprovalRequired) {
    throw new AppError(
      409,
      ErrorCode.APPROVAL_REQUIRED,
      'Production results require approval',
    )
  }
  res.status(201).json(await confirmProduction(input))
}

export const getDetail = async (req: Request, res: Response) => {
  res.json(await getProductionResult(parse(zId, req.params.id)))
}
