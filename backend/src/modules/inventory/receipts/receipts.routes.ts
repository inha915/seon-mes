import { Router } from 'express';
import { parse } from '../../../lib/validate.js';
import { createReceipt, listReceipts, receiptCreateSchema, receiptListSchema } from './receipts.service.js';

export const receiptsRouter = Router();

receiptsRouter.get('/', async (req, res) => {
  res.json(await listReceipts(parse(receiptListSchema, req.query)));
});

receiptsRouter.post('/', async (req, res) => {
  res.status(201).json(await createReceipt(parse(receiptCreateSchema, req.body)));
});
