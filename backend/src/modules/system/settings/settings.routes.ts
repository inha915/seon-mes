import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { assertRole, currentUser } from '../../../lib/current-user.js';
import { parse } from '../../../lib/validate.js';
import { getSettings, settingsUpdateSchema, updateSettings } from './settings.service.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  res.json(await getSettings());
});

settingsRouter.put('/', async (req, res) => {
  assertRole(await currentUser(req), [UserRole.ADMIN]);
  res.json(await updateSettings(parse(settingsUpdateSchema, req.body)));
});
