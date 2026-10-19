import { Router } from 'express'
import * as majors from './majors.controller.js'

const router = Router()

router.get('/', majors.listMajors)
router.get('/:id', majors.getMajor)

export default router
