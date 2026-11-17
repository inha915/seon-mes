import { Router } from 'express'
import * as controller from './approval.controller.js'

const router = Router()

router.get('/', controller.getList)
router.post('/', controller.create)
router.get('/:id', controller.getDetail)
router.post('/:id/approve', controller.approve)
router.post('/:id/reject', controller.reject)
router.post('/:id/cancel', controller.cancel)

export default router
