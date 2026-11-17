import type { Request, Response } from 'express'
import { zId } from '../../../lib/zod.js'
import { parse } from '../../../middleware/validate.js'
import {
  createSalesOrder,
  getSalesOrder,
  listSalesOrders,
  salesOrderCreateSchema,
  salesOrderListSchema,
} from './sales-orders.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listSalesOrders(parse(salesOrderListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  res
    .status(201)
    .json(await createSalesOrder(parse(salesOrderCreateSchema, req.body)))
}

export const getDetail = async (req: Request, res: Response) => {
  res.json(await getSalesOrder(parse(zId, req.params.id)))
}
