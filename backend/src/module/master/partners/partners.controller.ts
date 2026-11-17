import type { Request, Response } from 'express'
import { parse } from '../../../middleware/validate.js'
import {
  createPartner,
  listPartners,
  partnerCreateSchema,
  partnerListSchema,
} from './partners.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listPartners(parse(partnerListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  res
    .status(201)
    .json(await createPartner(parse(partnerCreateSchema, req.body)))
}
