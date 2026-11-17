import { Router } from 'express'
import * as controller from './items.controller.js'

const router = Router()

router.get('/', controller.getList)
router.post('/', controller.create)
router.get('/:id', controller.getDetail)
router.put('/:id/bom', controller.updateBom)

export default router
