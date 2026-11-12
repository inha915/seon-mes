import { Router } from 'express';
import { parse } from '../../../lib/validate.js';
import { createPartner, listPartners, partnerCreateSchema, partnerListSchema } from './partners.service.js';

export const partnersRouter = Router();

partnersRouter.get('/', async (req, res) => {
  res.json(await listPartners(parse(partnerListSchema, req.query)));
});

partnersRouter.post('/', async (req, res) => {
  res.status(201).json(await createPartner(parse(partnerCreateSchema, req.body)));
});
