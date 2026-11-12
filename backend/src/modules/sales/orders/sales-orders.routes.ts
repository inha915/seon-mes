import { Router } from 'express';
import { parse, zId } from '../../../lib/validate.js';
import {
  createSalesOrder,
  getSalesOrder,
  listSalesOrders,
  salesOrderCreateSchema,
  salesOrderListSchema,
} from './sales-orders.service.js';

export const salesOrdersRouter = Router();

salesOrdersRouter.get('/', async (req, res) => {
  res.json(await listSalesOrders(parse(salesOrderListSchema, req.query)));
});

salesOrdersRouter.post('/', async (req, res) => {
  res.status(201).json(await createSalesOrder(parse(salesOrderCreateSchema, req.body)));
});

salesOrdersRouter.get('/:id', async (req, res) => {
  res.json(await getSalesOrder(parse(zId, req.params.id)));
});
