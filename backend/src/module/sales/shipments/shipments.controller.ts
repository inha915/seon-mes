import type { Request, Response } from 'express'
import { currentUser } from '../../../lib/currentUser.js'
import { parse } from '../../../middleware/validate.js'
import {
  createShipment,
  listShipments,
  shipmentCreateSchema,
  shipmentListSchema,
} from './shipments.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listShipments(parse(shipmentListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  const user = await currentUser(req)
  res
    .status(201)
    .json(await createShipment(parse(shipmentCreateSchema, req.body), user))
}
