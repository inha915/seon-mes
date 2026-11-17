import { Router } from 'express'
import * as controller from './sales-orders.controller.js'

const router = Router()

router.get('/', controller.getList)
router.post('/', controller.create)
router.get('/:id', controller.getDetail)

export default router
