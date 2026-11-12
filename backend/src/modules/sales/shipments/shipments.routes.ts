import { Router } from 'express';
import { currentUser } from '../../../lib/current-user.js';
import { parse } from '../../../lib/validate.js';
import { createShipment, listShipments, shipmentCreateSchema, shipmentListSchema } from './shipments.service.js';

export const shipmentsRouter = Router();

shipmentsRouter.get('/', async (req, res) => {
  res.json(await listShipments(parse(shipmentListSchema, req.query)));
});

shipmentsRouter.post('/', async (req, res) => {
  res.status(201).json(await createShipment(parse(shipmentCreateSchema, req.body), await currentUser(req)));
});
