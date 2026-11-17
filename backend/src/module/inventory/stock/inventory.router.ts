import { Router } from 'express'
import * as controller from './inventory.controller.js'

const router = Router()

router.get('/items', controller.getItemStock)
router.get('/lots', controller.getLotStock)
router.get('/transactions', controller.getTransactions)

export default router
