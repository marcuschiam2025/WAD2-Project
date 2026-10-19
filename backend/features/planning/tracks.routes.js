import { Router } from 'express'
import * as tracks from './tracks.controller.js'

const router = Router()

router.get('/', tracks.listTracks)
router.get('/:code', tracks.getTrack)

export default router
