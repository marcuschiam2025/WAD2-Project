import Plan, { MAX_PLANS, MAX_LOA_TERMS, INTERNSHIP_CODE } from './models/Plan.js'
import Module from './models/Module.js'
import Major from './models/Major.js'
import Track from './models/Track.js'
import Requirement from './models/Requirement.js'
import BidCart from '../bidding/models/BidCart.js'
import { checkPlan as checkRequirements, effectiveCode } from './utils/requirementChecker.js'
import { httpError } from '../../middleware/errorHandler.js'

// Fields a student is allowed to send when creating or editing a plan
const EDITABLE = ['name', 'majorId', 'tracks', 'currentSem', 'semesters']

// A semester id looks like Y2S1 (year 1-9, semester 1 or 2)
const SEM_ID = /^Y([1-9])S([12])$/

// ---------------------------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------------------------

// Find a plan by id, but only if it belongs to the signed-in student
async function findOwnPlan(req) {
  const plan = await Plan.findOne({ _id: req.params.id, user: req.user._id })
  if (!plan) {
    throw httpError(404, 'Plan not found')
  }
  return plan
}

// "Y2S1" -> "Y2 · S1"
function semLabel(id) {
  return id.replace(SEM_ID, 'Y$1 · S$2')
}

// An empty 4-year roadmap: Y1S1, Y1S2, ..., Y4S2
function defaultSemesters() {
  const semesters = []
  for (let year = 1; year <= 4; year++) {
    for (let sem = 1; sem <= 2; sem++) {
      const id = `Y${year}S${sem}`
      semesters.push({ id: id, label: semLabel(id), modules: [] })
    }
  }
  return semesters
}

// Copy only the editable fields out of the request body
function pickEditable(body) {
  const data = {}
  for (const field of EDITABLE) {
    if (body[field] !== undefined) {
      data[field] = body[field]
    }
  }
  return data
}

// Rejects plans the planner UI could never produce: bad semester ids, duplicates, a module placed twice
function validate({ tracks, currentSem, semesters }) {
  // Tracks: an array of at most 2 different codes
  if (tracks) {
    const notArray = !Array.isArray(tracks)
    const tooMany = tracks.length > 2
    const hasDuplicate = new Set(tracks).size !== tracks.length
    if (notArray || tooMany || hasDuplicate) {
      throw httpError(400, 'tracks must be up to 2 different track codes')
    }
  }

  // Nothing else to check if the semesters aren't being changed
  if (!semesters) {
    return
  }
  if (!Array.isArray(semesters) || semesters.length === 0) {
    throw httpError(400, 'semesters must be a non-empty array')
  }

  // At most 2 leave-of-absence terms per plan
  const loaTerms = semesters.filter((semester) => semester?.loa)
  if (loaTerms.length > MAX_LOA_TERMS) {
    throw httpError(400, `A plan can have at most ${MAX_LOA_TERMS} LOA terms`)
  }

  const seenSemesters = new Set()
  const seenModules = new Set()

  for (const semester of semesters) {
    const id = semester?.id ?? ''

    if (!SEM_ID.test(id)) {
      throw httpError(400, `Invalid semester id "${semester?.id}" (expected e.g. Y2S1)`)
    }
    if (seenSemesters.has(id)) {
      throw httpError(400, `Semester ${id} appears twice`)
    }
    seenSemesters.add(id)

    // Fill in the display label if the frontend didn't send one
    if (!semester.label) {
      semester.label = semLabel(id)
    }

    // Each module may only be placed once in the whole plan
    for (const entry of semester.modules ?? []) {
      const code = effectiveCode(String(entry))

      // An LOA term holds no classes, only an internship
      if (semester.loa && code !== INTERNSHIP_CODE) {
        throw httpError(400, `${id} is an LOA term: only ${INTERNSHIP_CODE} can be placed in it`)
      }

      if (seenModules.has(code)) {
        throw httpError(400, `${code} is placed in more than one semester`)
      }
      seenModules.add(code)
    }
  }

  if (currentSem && !seenSemesters.has(currentSem)) {
    throw httpError(400, `currentSem ${currentSem} is not one of the plan's semesters`)
  }
}

// The major and tracks must exist in the catalogue: tracks are codes of the plan's major (BA, SMCT, ...)
async function validateRefs({ majorId, tracks }) {
  const trackCodes = tracks ?? []

  if (!majorId) {
    if (trackCodes.length > 0) {
      throw httpError(400, 'Set majorId before choosing tracks')
    }
    return
  }

  const majorExists = await Major.exists({ _id: majorId })
  if (!majorExists) {
    throw httpError(400, `Unknown major ${majorId}`)
  }

  // Which of the requested track codes really belong to this major?
  const knownCodes = await Track.find({ majorId: majorId, trackCode: { $in: trackCodes } }).distinct('trackCode')
  const unknownCodes = trackCodes.filter((code) => !knownCodes.includes(code))
  if (unknownCodes.length > 0) {
    throw httpError(400, `${unknownCodes.join(', ')} is not a track of ${majorId}`)
  }
}

// The student's major as a catalogue id. Their profile holds either the id (BSC-IS_AY2025)
// or the major's name (Information Systems), in which case we pick the curriculum for their intake.
async function defaultMajorId(user) {
  if (!user.major) {
    return null
  }

  const isAlreadyAnId = await Major.exists({ _id: user.major })
  if (isAlreadyAnId) {
    return user.major
  }

  // Newest curriculum first
  const candidates = await Major.find({ name: user.major }).sort({ intakeFrom: -1 })
  if (candidates.length === 0) {
    return null
  }

  for (const major of candidates) {
    if (!user.intakeYear || major.intakeFrom <= user.intakeYear) {
      return major._id
    }
  }
  // Their intake is older than every curriculum we have: use the oldest one
  return candidates[candidates.length - 1]._id
}

// ---------------------------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------------------------

// GET /api/plans
export async function listPlans(req, res) {
  const plans = await Plan.find({ user: req.user._id }).sort({ createdAt: 1 })
  res.json(plans)
}

// POST /api/plans — max 3 per student. Anything left out defaults from the student's profile.
export async function createPlan(req, res) {
  const count = await Plan.countDocuments({ user: req.user._id })
  if (count >= MAX_PLANS) {
    throw httpError(409, `You can create up to ${MAX_PLANS} plans. Delete one first.`)
  }

  const data = pickEditable(req.body)

  // Fill in defaults for anything the frontend didn't send
  if (data.semesters === undefined) {
    data.semesters = defaultSemesters()
  }
  if (data.majorId === undefined) {
    data.majorId = await defaultMajorId(req.user)
  }
  if (data.tracks === undefined) {
    data.tracks = data.majorId ? (req.user.tracks ?? []) : []
  }
  if (data.currentSem === undefined) {
    // Start of the student's current year, if the roadmap has it; otherwise the first semester
    const yearStart = `Y${req.user.yearOfStudy}S1`
    const hasYearStart = data.semesters.some((semester) => semester.id === yearStart)
    data.currentSem = hasYearStart ? yearStart : data.semesters[0]?.id
  }
  if (data.name === undefined) {
    data.name = `Plan ${count + 1}`
  }

  validate(data)
  await validateRefs(data)

  const plan = await Plan.create({ ...data, user: req.user._id })
  res.status(201).json(plan)
}

// GET /api/plans/:id
export async function getPlan(req, res) {
  const plan = await findOwnPlan(req)
  res.json(plan)
}

// PUT /api/plans/:id — save the whole plan after drag-and-drop edits
export async function updatePlan(req, res) {
  const plan = await findOwnPlan(req)
  const data = pickEditable(req.body)

  // Validate the plan as it will look after the update
  validate({
    tracks: data.tracks,
    semesters: data.semesters ?? plan.semesters.map((semester) => semester.toObject()),
    currentSem: data.currentSem ?? plan.currentSem,
  })

  // Only look up the major and tracks again if one of them is changing
  if (data.majorId !== undefined || data.tracks !== undefined) {
    await validateRefs({
      majorId: data.majorId ?? plan.majorId,
      tracks: data.tracks ?? plan.tracks,
    })
  }

  Object.assign(plan, data)
  await plan.save()
  res.json(plan)
}

// DELETE /api/plans/:id — a student always keeps at least one plan; the rest are renumbered Plan 1...n
export async function deletePlan(req, res) {
  const plan = await findOwnPlan(req)

  const count = await Plan.countDocuments({ user: req.user._id })
  if (count <= 1) {
    throw httpError(409, 'You need at least one plan')
  }

  // Delete the plan's bid carts first, so a failure here can't leave carts without a plan
  await BidCart.deleteMany({ plan: plan._id })
  await plan.deleteOne()

  // Rename the remaining plans so they read Plan 1, Plan 2, ... again
  const remaining = await Plan.find({ user: req.user._id }).sort({ createdAt: 1 })
  for (let i = 0; i < remaining.length; i++) {
    await Plan.updateOne({ _id: remaining[i]._id }, { name: `Plan ${i + 1}` })
  }

  res.status(204).end()
}

// GET /api/plans/:id/check — progress per graduation requirement, what's outstanding, and prereq warnings
export async function checkPlan(req, res) {
  const plan = await findOwnPlan(req)

  // 1. The plan's major, which must have graduation requirements
  let major = null
  if (plan.majorId) {
    major = await Major.findById(plan.majorId).lean()
  }
  if (!major) {
    throw httpError(409, 'This plan has no major yet. Set majorId first.')
  }
  if (!major.requirementsAvailable) {
    throw httpError(409, `Graduation requirements for ${major.name} aren't available yet`)
  }

  // 2. The plan's tracks, and the requirements of the major and those tracks
  const trackDocs = await Track.find({ majorId: major._id, trackCode: { $in: plan.tracks } }).lean()
  const ownerIds = [major._id]
  for (const track of trackDocs) {
    ownerIds.push(track._id)
  }
  const requirements = await Requirement.find({ ownerId: { $in: ownerIds } }).lean()

  const majorRequirements = requirements.filter((requirement) => requirement.ownerId === major._id)

  // Keep the tracks in the plan's order: the first one is the track that counts
  const tracks = []
  for (const code of plan.tracks) {
    const track = trackDocs.find((t) => t.trackCode === code)
    if (track) {
      tracks.push({
        trackCode: track.trackCode,
        requirements: requirements.filter((requirement) => requirement.ownerId === track._id),
      })
    }
  }

  // 3. The whole module catalogue, looked up by code (descriptions aren't needed)
  const modules = await Module.find({}, { description: 0 }).lean()
  const catalogue = {}
  for (const mod of modules) {
    catalogue[mod._id] = mod
  }

  // 4. Run the checker and send its result
  const result = checkRequirements(plan, {
    major: major,
    requirements: majorRequirements,
    tracks: tracks,
    catalogue: catalogue,
    exempted: req.user.exempted ?? [], // from the student's profile; counted as cleared
  })
  res.json(result)
}
