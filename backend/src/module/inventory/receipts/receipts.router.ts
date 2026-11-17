import { Router } from 'express'
import * as controller from './receipts.controller.js'

const router = Router()

router.get('/', controller.getList)
router.post('/', controller.create)

export default router
