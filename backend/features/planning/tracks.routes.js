import { Router } from 'express'
import * as tracks from './tracks.controller.js'

const router = Router()

router.get('/', tracks.listTracks)
router.get('/:id', tracks.getTrack)

export default router
