import { Router } from 'express'
import * as controller from './production.controller.js'

const router = Router()

router.get('/', controller.getList)
router.post('/', controller.confirm)
router.get('/:id', controller.getDetail)

export default router
