import type { Request, Response } from 'express'
import { parse } from '../../../middleware/validate.js'
import {
  itemStockSchema,
  listItemStock,
  listLotStock,
  listTransactions,
  lotStockSchema,
  transactionListSchema,
} from './inventory.service.js'

export const getItemStock = async (req: Request, res: Response) => {
  res.json(await listItemStock(parse(itemStockSchema, req.query)))
}

export const getLotStock = async (req: Request, res: Response) => {
  res.json(await listLotStock(parse(lotStockSchema, req.query)))
}

export const getTransactions = async (req: Request, res: Response) => {
  res.json(await listTransactions(parse(transactionListSchema, req.query)))
}
