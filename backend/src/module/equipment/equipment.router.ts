import { Router } from 'express'
import * as controller from './equipment.controller.js'

const router = Router()

router.get('/', controller.getList)
router.post('/', controller.create)
router.get('/:id', controller.getDetail)
router.post('/:id/logs', controller.addLog)

export default router
