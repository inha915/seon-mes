import { Router } from 'express';
import { parse, zId } from '../../../lib/validate.js';
import {
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
  workOrderCreateSchema,
  workOrderListSchema,
} from './work-orders.service.js';

export const workOrdersRouter = Router();

workOrdersRouter.get('/', async (req, res) => {
  res.json(await listWorkOrders(parse(workOrderListSchema, req.query)));
});

workOrdersRouter.post('/', async (req, res) => {
  res.status(201).json(await createWorkOrder(parse(workOrderCreateSchema, req.body)));
});

workOrdersRouter.get('/:id', async (req, res) => {
  res.json(await getWorkOrder(parse(zId, req.params.id)));
});
