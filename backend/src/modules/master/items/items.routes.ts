import { Router } from 'express';
import { parse, zId } from '../../../lib/validate.js';
import {
  bomUpdateSchema,
  createItem,
  getItem,
  itemCreateSchema,
  itemListSchema,
  listItems,
  replaceBom,
} from './items.service.js';

export const itemsRouter = Router();

itemsRouter.get('/', async (req, res) => {
  res.json(await listItems(parse(itemListSchema, req.query)));
});

itemsRouter.post('/', async (req, res) => {
  res.status(201).json(await createItem(parse(itemCreateSchema, req.body)));
});

itemsRouter.get('/:id', async (req, res) => {
  res.json(await getItem(parse(zId, req.params.id)));
});

itemsRouter.put('/:id/bom', async (req, res) => {
  res.json(await replaceBom(parse(zId, req.params.id), parse(bomUpdateSchema, req.body)));
});
