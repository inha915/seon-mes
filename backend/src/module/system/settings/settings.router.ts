import { Router } from 'express'
import * as controller from './settings.controller.js'

const router = Router()

router.get('/', controller.get)
router.put('/', controller.update)

export default router
