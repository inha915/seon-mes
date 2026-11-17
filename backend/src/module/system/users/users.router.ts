import { Router } from 'express'
import * as controller from './users.controller.js'

const router = Router()

router.get('/', controller.getList)
router.get('/me', controller.getMe)
router.post('/', controller.create)
router.patch('/:id', controller.update)

export default router
