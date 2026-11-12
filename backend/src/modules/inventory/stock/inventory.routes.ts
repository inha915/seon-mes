import { Router } from 'express';
import { parse } from '../../../lib/validate.js';
import {
  itemStockSchema,
  listItemStock,
  listLotStock,
  listTransactions,
  lotStockSchema,
  transactionListSchema,
} from './inventory.service.js';

export const inventoryRouter = Router();

inventoryRouter.get('/items', async (req, res) => {
  res.json(await listItemStock(parse(itemStockSchema, req.query)));
});

inventoryRouter.get('/lots', async (req, res) => {
  res.json(await listLotStock(parse(lotStockSchema, req.query)));
});

inventoryRouter.get('/transactions', async (req, res) => {
  res.json(await listTransactions(parse(transactionListSchema, req.query)));
});
