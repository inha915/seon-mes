import type { Request, Response } from 'express'
import { getDashboard } from './dashboard.service.js'

export const get = async (_req: Request, res: Response) => {
  res.json(await getDashboard())
}
