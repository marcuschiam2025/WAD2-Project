import { Router } from 'express'
import * as modules from './modules.controller.js'

const router = Router()

router.get('/', modules.listModules)
router.get('/:code', modules.getModule)

export default router
