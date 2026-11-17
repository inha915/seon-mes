import type { Request, Response } from 'express'
import { UserRole } from '@prisma/client'
import { assertRole, currentUser, userRef } from '../../../lib/currentUser.js'
import { zId } from '../../../lib/zod.js'
import { parse } from '../../../middleware/validate.js'
import {
  createUser,
  listUsers,
  updateUser,
  userCreateSchema,
  userListSchema,
  userUpdateSchema,
} from './users.service.js'

export const getList = async (req: Request, res: Response) => {
  res.json(await listUsers(parse(userListSchema, req.query)))
}

// 헤더 X-User-Id 기준 현재 사용자
export const getMe = async (req: Request, res: Response) => {
  res.json(userRef(await currentUser(req)))
}

export const create = async (req: Request, res: Response) => {
  assertRole(await currentUser(req), [UserRole.ADMIN])
  res.status(201).json(await createUser(parse(userCreateSchema, req.body)))
}

export const update = async (req: Request, res: Response) => {
  assertRole(await currentUser(req), [UserRole.ADMIN])
  res.json(
    await updateUser(
      parse(zId, req.params.id),
      parse(userUpdateSchema, req.body),
    ),
  )
}
