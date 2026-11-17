import type { Request, Response } from 'express'
import { currentUser } from '../../lib/currentUser.js'
import { zId } from '../../lib/zod.js'
import { parse } from '../../middleware/validate.js'
import {
  addEquipmentLog,
  createEquipment,
  equipmentCreateSchema,
  equipmentListSchema,
  equipmentLogSchema,
  getEquipment,
  listEquipments,
} from './equipment.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listEquipments(parse(equipmentListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  const user = await currentUser(req)
  res
    .status(201)
    .json(await createEquipment(parse(equipmentCreateSchema, req.body), user))
}

export const getDetail = async (req: Request, res: Response) => {
  res.json(await getEquipment(parse(zId, req.params.id)))
}

export const addLog = async (req: Request, res: Response) => {
  const user = await currentUser(req)
  const id = parse(zId, req.params.id)
  res
    .status(201)
    .json(await addEquipmentLog(id, parse(equipmentLogSchema, req.body), user))
}
