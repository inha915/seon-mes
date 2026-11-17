import type { Request, Response } from 'express'
import { parse } from '../../../middleware/validate.js'
import {
  createReceipt,
  listReceipts,
  receiptCreateSchema,
  receiptListSchema,
} from './receipts.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listReceipts(parse(receiptListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  res
    .status(201)
    .json(await createReceipt(parse(receiptCreateSchema, req.body)))
}
