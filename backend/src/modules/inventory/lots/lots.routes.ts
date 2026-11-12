import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../../../lib/validate.js';
import { traceLot } from './lots.service.js';

export const lotsRouter = Router();

lotsRouter.get('/:lotNo', async (req, res) => {
  const lotNo = parse(z.string().trim().min(1).max(50), req.params.lotNo).toUpperCase();
  res.json(await traceLot(lotNo));
});
