import type { Request, Response } from 'express'
import { UserRole } from '@prisma/client'
import { assertRole, currentUser } from '../../../lib/currentUser.js'
import { parse } from '../../../middleware/validate.js'
import {
  getSettings,
  settingsUpdateSchema,
  updateSettings,
} from './settings.service.js'

export const get = async (_req: Request, res: Response) => {
  res.json(await getSettings())
}

export const update = async (req: Request, res: Response) => {
  assertRole(await currentUser(req), [UserRole.ADMIN])
  res.json(await updateSettings(parse(settingsUpdateSchema, req.body)))
}
