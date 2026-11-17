import type { Request, Response } from 'express'
import { z } from 'zod'
import { parse } from '../../../middleware/validate.js'
import { traceLot } from './lots.service.js'

export const getTrace = async (req: Request, res: Response) => {
  const lotNo = parse(z.string().trim().min(1).max(50), req.params.lotNo)
  res.json(await traceLot(lotNo.toUpperCase()))
}
