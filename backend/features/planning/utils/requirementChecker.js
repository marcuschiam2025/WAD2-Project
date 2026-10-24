// Requirement + prerequisite checker for a What-If plan, driven by the requirements collection.
// Pure function (no database calls) — see requirementChecker.test.js.
import { unmetGroups } from './requisites.js'

// Exchange mappings are stored as "CS412 → IS460"; the SMU code is on the right.
export function effectiveCode(entry) {
  return entry.split('→').pop().trim()
}

// Requirements are filled most-specific first, so a course never lands in a broad bucket
// (free electives) while a specific one (a track's list) still needs it.
// Each pass is a test that says whether a requirement belongs to that pass.
const PASSES = [
  (requirement) => requirement.rule === 'all',
  (requirement) => requirement.rule === 'chooseN',
  (requirement) => requirement.rule === 'basket',
  (requirement) => requirement.rule === 'anyFromCategory' && !requirement.categories?.includes('ANY'),
  (requirement) => requirement.rule === 'anyFromCategory' && requirement.categories?.includes('ANY'),
]

// Core rules come first, then major rules, then track rules
const LEVEL_ORDER = ['core', 'major', 'track']

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

// Can this module count towards this requirement?
function matches(requirement, mod) {
  if (requirement.rule === 'all' || requirement.rule === 'chooseN') {
    // Must be one of the listed courses
    return requirement.modules?.includes(mod._id) ?? false
  }

  if (requirement.rule === 'basket' || requirement.rule === 'flag') {
    // Must carry the requirement's tag, e.g. CORE:MANAGING
    return mod.fulfils?.includes(requirement.tag) ?? false
  }

  if (requirement.rule === 'anyFromCategory') {
    // ANY = any course at all
    if (requirement.categories?.includes('ANY')) {
      return true
    }
    // Otherwise the module must be in one of the listed categories, e.g. IS or IS_TRACK
    for (const category of requirement.categories ?? []) {
      if (mod.categories?.includes(category)) {
        return true
      }
    }
    return false
  }

  return false
}

// The short form of a module we send back to the frontend
function brief(mod) {
  return { code: mod._id, title: mod.title }
}

// Total CU of a list of placements
function sumCu(placements, catalogue) {
  let total = 0
  for (const placement of placements) {
    total += catalogue[placement.code].cu ?? 1
  }
  return total
}

// Sort requirements: core, then major, then track; within a level by their `order`
function sortRequirements(requirements) {
  const sorted = [...requirements]
  sorted.sort((a, b) => {
    const levelDifference = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
    if (levelDifference !== 0) {
      return levelDifference
    }
    return (a.order ?? 0) - (b.order ?? 0)
  })
  return sorted
}

// What is left to take for a requirement, given the courses already placed anywhere in the plan.
// Returns null when nothing is left.
function outstandingFor(requirement, cuLeft, placed, catalogue) {
  const isFlag = requirement.rule === 'flag'

  // Flags pass cuLeft 0 (met) or 1 (not met); other rules pass the CU still needed
  if (isFlag && cuLeft === 0) {
    return null
  }
  if (!isFlag && cuLeft <= 0) {
    return null
  }

  // Codes that aren't placed yet and exist in the catalogue, in their short form
  function notPlacedYet(codes) {
    const result = []
    for (const code of codes) {
      if (!placed.has(code) && catalogue[code]) {
        result.push(brief(catalogue[code]))
      }
    }
    return result
  }

  const outstanding = { cu: isFlag ? 0 : cuLeft }

  if (requirement.rule === 'all') {
    // Every listed course is required
    outstanding.mustTake = notPlacedYet(requirement.modules)
  } else if (requirement.rule === 'chooseN') {
    // Pick from the listed courses
    outstanding.chooseFrom = notPlacedYet(requirement.modules)
  } else if (requirement.categories?.includes('ANY')) {
    // Free electives: any course will do, so don't list 1,000+ courses
    outstanding.anyCourse = true
  } else {
    // Baskets, flags and IS electives: every catalogue course that would count
    outstanding.chooseFrom = []
    for (const mod of Object.values(catalogue)) {
      if (!placed.has(mod._id) && matches(requirement, mod)) {
        outstanding.chooseFrom.push(brief(mod))
      }
    }
  }

  return outstanding
}

// ---------------------------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------------------------

/**
 * @param plan       { currentSem, semesters: [{ id, loa, modules: string[] }] }
 * @param context    {
 *   major:        { _id },
 *   requirements: core + major requirements of the plan's major,
 *   tracks:       [{ trackCode, requirements }] in the plan's order — the first is the track that counts,
 *                 any second one is an optional extra whose courses still count as electives,
 *   catalogue:    modules by code,
 * }
 */
export function checkPlan(plan, { major, requirements, tracks = [], catalogue }) {
  // Leave-of-absence terms are included: they can hold an internship
  const semesters = plan.semesters
  const currentIndex = semesters.findIndex((semester) => semester.id === plan.currentSem)

  // ----- 1. Every placed course, and where it sits -----
  const placements = []
  for (let i = 0; i < semesters.length; i++) {
    const semester = semesters[i]
    for (const entry of semester.modules) {
      placements.push({
        code: effectiveCode(entry),
        at: i, // position of the semester in the plan
        semester: semester.id,
        status: i < currentIndex ? 'done' : 'planned', // semesters before the current one are completed
      })
    }
  }

  const positionOf = {} // module code -> semester position
  const placed = new Set() // every placed module code
  const unknownModules = [] // placed codes that aren't in the catalogue
  for (const placement of placements) {
    positionOf[placement.code] = placement.at
    placed.add(placement.code)
    if (!catalogue[placement.code]) {
      unknownModules.push(placement.code)
    }
  }

  // ----- 2. Prerequisite / corequisite / exclusion warnings (current and future semesters only) -----
  const warnings = []
  for (const placement of placements) {
    const mod = catalogue[placement.code]
    if (!mod || placement.status === 'done') {
      continue
    }
    const here = placement.at

    // Prerequisites must sit in an earlier semester
    const prereqs = unmetGroups(mod.prerequisites, (code) => positionOf[code] !== undefined && positionOf[code] < here)

    // Corequisites may sit in the same semester or an earlier one
    const coreqs = unmetGroups(mod.corequisites, (code) => positionOf[code] !== undefined && positionOf[code] <= here)

    // Courses it can't be taken together with
    const exclusions = []
    for (const code of mod.mutuallyExclusive ?? []) {
      if (placed.has(code)) {
        exclusions.push(code)
      }
    }

    // Rules like "2 track courses before this one"
    const rules = []
    for (const rule of mod.prerequisiteRules ?? []) {
      let count = 0
      for (const other of placements) {
        const otherModule = catalogue[other.code]
        if (other.at >= here || !otherModule) {
          continue
        }
        if (rule.countFrom !== 'TRACK' || otherModule.categories?.includes('IS_TRACK')) {
          count++
        }
      }
      if (count < rule.n) {
        const what = rule.countFrom === 'TRACK' ? 'track courses' : 'courses'
        rules.push(`${rule.n} ${what} before this one`)
      }
    }

    // A course that hasn't run in about 2 years may have been retired
    const notOffered = mod.offeredRecently === false

    const hasProblem = prereqs.length > 0 || coreqs.length > 0 || exclusions.length > 0 || rules.length > 0 || notOffered
    if (hasProblem) {
      const warning = { module: placement.code, semester: placement.semester, prereqs, coreqs, exclusions, rules }
      if (notOffered) {
        warning.notOffered = { lastOffered: mod.lastOffered ?? null }
      }
      warnings.push(warning)
    }
  }

  // ----- 3. Allocate each placed course to one requirement -----
  const mainTrack = tracks[0]
  const extraTracks = tracks.slice(1)

  // Requirements that use courses up: the major's (except non-credit flags) and the main track's
  const counted = requirements.filter((requirement) => requirement.rule !== 'flag')
  if (mainTrack) {
    counted.push(...mainTrack.requirements)
  }

  const allocated = {} // requirement id -> placements counted towards it
  for (const requirement of counted) {
    allocated[requirement._id] = []
  }

  // Courses not counted towards anything yet (unknown codes can't count)
  let unallocated = placements.filter((placement) => catalogue[placement.code])

  for (const belongsToPass of PASSES) {
    const passRequirements = counted.filter(belongsToPass)
    const stillUnallocated = []

    for (const placement of unallocated) {
      const mod = catalogue[placement.code]
      // The first requirement in this pass that the course matches and that still has room
      const target = passRequirements.find(
        (requirement) => matches(requirement, mod) && sumCu(allocated[requirement._id], catalogue) < requirement.cuRequired,
      )
      if (target) {
        allocated[target._id].push(placement)
      } else {
        stillUnallocated.push(placement)
      }
    }

    unallocated = stillUnallocated
  }

  // Flags and extra tracks don't use courses up: they look at every placed course
  function allMatching(requirement) {
    return placements.filter((placement) => catalogue[placement.code] && matches(requirement, catalogue[placement.code]))
  }

  // ----- 4. Describe each requirement's progress -----
  function describe(requirement, owner, taken) {
    const cuDone = sumCu(taken.filter((placement) => placement.status === 'done'), catalogue)
    const cuPlanned = sumCu(taken, catalogue) // done + planned

    let status
    let cuLeft
    if (requirement.rule === 'flag') {
      // Non-credit: met by any one matching course, or automatically
      const met = requirement.autoFulfilled || taken.length > 0
      if (!met) {
        status = 'outstanding'
      } else if (requirement.autoFulfilled || cuDone > 0) {
        status = 'done'
      } else {
        status = 'planned'
      }
      cuLeft = met ? 0 : 1
    } else {
      if (cuDone >= requirement.cuRequired) {
        status = 'done'
      } else if (cuPlanned >= requirement.cuRequired) {
        status = 'planned'
      } else {
        status = 'outstanding'
      }
      cuLeft = requirement.cuRequired - cuPlanned
    }

    const modules = []
    for (const placement of taken) {
      modules.push({ ...brief(catalogue[placement.code]), status: placement.status, semester: placement.semester })
    }

    return {
      id: requirement._id,
      level: requirement.level,
      owner: owner,
      heading: requirement.heading,
      label: requirement.label,
      rule: requirement.rule,
      countsToward: requirement.countsToward,
      cuRequired: requirement.cuRequired,
      cuDone: cuDone,
      cuPlanned: cuPlanned,
      status: status,
      modules: modules,
      outstanding: outstandingFor(requirement, cuLeft, placed, catalogue),
    }
  }

  const results = []
  for (const requirement of sortRequirements(requirements)) {
    const taken = requirement.rule === 'flag' ? allMatching(requirement) : allocated[requirement._id]
    results.push(describe(requirement, requirement.level, taken))
  }
  if (mainTrack) {
    for (const requirement of sortRequirements(mainTrack.requirements)) {
      results.push(describe(requirement, mainTrack.trackCode, allocated[requirement._id]))
    }
  }

  // An extra track only shows how far along it is; it never takes courses away from the main plan
  const extraTrackResults = []
  for (const track of extraTracks) {
    const trackResults = []
    for (const requirement of sortRequirements(track.requirements)) {
      const limit = requirement.n ?? requirement.cuRequired
      const taken = allMatching(requirement).slice(0, limit)
      trackResults.push(describe(requirement, track.trackCode, taken))
    }
    extraTrackResults.push({ trackCode: track.trackCode, requirements: trackResults })
  }

  // ----- 5. Totals and the outstanding list -----
  let doneCu = 0
  let plannedCu = 0
  let sumRequired = 0
  for (const result of results) {
    if (result.rule === 'flag') {
      continue // non-credit
    }
    // Extra courses in one requirement don't count towards another, so cap each at what it needs
    doneCu += Math.min(result.cuDone, result.cuRequired)
    plannedCu += Math.min(result.cuPlanned, result.cuRequired)
    sumRequired += result.cuRequired
  }

  const outstanding = []
  for (const result of results) {
    if (result.status === 'outstanding') {
      outstanding.push({
        requirement: result.id,
        heading: result.heading,
        label: result.label,
        owner: result.owner,
        ...result.outstanding,
      })
    }
  }

  return {
    majorId: major._id,
    requiredCu: sumRequired, // requirements left out of the check (e.g. community service) don't count
    doneCu: doneCu,
    plannedCu: plannedCu,
    requirements: results,
    extraTracks: extraTrackResults,
    outstanding: outstanding,
    warnings: warnings,
    unallocated: unallocated.map((placement) => placement.code),
    unknownModules: unknownModules,
    onTrack: warnings.length === 0,
  }
}
