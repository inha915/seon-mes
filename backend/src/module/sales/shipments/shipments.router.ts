import { Router } from 'express'
import * as controller from './shipments.controller.js'

const router = Router()

router.get('/', controller.getList)
router.post('/', controller.create)

export default router
