import { Router } from 'express';
import { currentUser } from '../../lib/current-user.js';
import { parse, zId } from '../../lib/validate.js';
import {
  addEquipmentLog,
  createEquipment,
  equipmentCreateSchema,
  equipmentListSchema,
  equipmentLogSchema,
  getEquipment,
  listEquipments,
} from './equipment.service.js';

export const equipmentRouter = Router();

equipmentRouter.get('/', async (req, res) => {
  res.json(await listEquipments(parse(equipmentListSchema, req.query)));
});

equipmentRouter.post('/', async (req, res) => {
  res.status(201).json(await createEquipment(parse(equipmentCreateSchema, req.body), await currentUser(req)));
});

equipmentRouter.get('/:id', async (req, res) => {
  res.json(await getEquipment(parse(zId, req.params.id)));
});

equipmentRouter.post('/:id/logs', async (req, res) => {
  res
    .status(201)
    .json(await addEquipmentLog(parse(zId, req.params.id), parse(equipmentLogSchema, req.body), await currentUser(req)));
});
