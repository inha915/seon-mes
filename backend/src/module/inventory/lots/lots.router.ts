import { Router } from 'express'
import * as controller from './lots.controller.js'

const router = Router()

router.get('/:lotNo', controller.getTrace)

export default router
