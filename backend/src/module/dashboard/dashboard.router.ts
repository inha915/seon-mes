import { Router } from 'express'
import * as controller from './dashboard.controller.js'

const router = Router()

router.get('/', controller.get)

export default router
