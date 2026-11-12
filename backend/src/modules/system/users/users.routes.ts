import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { assertRole, currentUser, userRef } from '../../../lib/current-user.js';
import { parse, zId } from '../../../lib/validate.js';
import { createUser, listUsers, updateUser, userCreateSchema, userListSchema, userUpdateSchema } from './users.service.js';

export const usersRouter = Router();

usersRouter.get('/', async (req, res) => {
  res.json(await listUsers(parse(userListSchema, req.query)));
});

/** 현재 사용자 (헤더 X-User-Id 기준) */
usersRouter.get('/me', async (req, res) => {
  res.json(userRef(await currentUser(req)));
});

usersRouter.post('/', async (req, res) => {
  assertRole(await currentUser(req), [UserRole.ADMIN]);
  res.status(201).json(await createUser(parse(userCreateSchema, req.body)));
});

usersRouter.patch('/:id', async (req, res) => {
  assertRole(await currentUser(req), [UserRole.ADMIN]);
  res.json(await updateUser(parse(zId, req.params.id), parse(userUpdateSchema, req.body)));
});
