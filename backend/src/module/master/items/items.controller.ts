import type { Request, Response } from 'express'
import { zId } from '../../../lib/zod.js'
import { parse } from '../../../middleware/validate.js'
import {
  bomUpdateSchema,
  createItem,
  getItem,
  itemCreateSchema,
  itemListSchema,
  listItems,
  replaceBom,
} from './items.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listItems(parse(itemListSchema, req.query)))
}

export const create = async (req: Request, res: Response) => {
  res.status(201).json(await createItem(parse(itemCreateSchema, req.body)))
}

export const getDetail = async (req: Request, res: Response) => {
  res.json(await getItem(parse(zId, req.params.id)))
}

export const updateBom = async (req: Request, res: Response) => {
  res.json(
    await replaceBom(
      parse(zId, req.params.id),
      parse(bomUpdateSchema, req.body),
    ),
  )
}
