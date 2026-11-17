import type { Request, Response } from 'express'
import { zId } from '../../../lib/zod.js'
import { parse } from '../../../middleware/validate.js'
import {
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
  workOrderCreateSchema,
  workOrderListSchema,
} from './work-orders.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listWorkOrders(parse(workOrderListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  res
    .status(201)
    .json(await createWorkOrder(parse(workOrderCreateSchema, req.body)))
}

export const getDetail = async (req: Request, res: Response) => {
  res.json(await getWorkOrder(parse(zId, req.params.id)))
}
