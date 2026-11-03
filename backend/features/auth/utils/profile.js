const MARKED_DONE_OPTIONS = ['internship', 'community', 'exposure']

// ---------------------------------------------------------------------------
// True for { ... }, false for null, arrays, strings, numbers
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Checks a semester label like 'Y2S1' and turns it into a number so semesters can be compared:
// Y1S1 = 3, Y1S2 = 4, Y2S1 = 5, Y2S2 = 6, ...
function semesterNumber(label) {
  const valid = typeof label === 'string' && /^Y[1-5]S[12]$/.test(label)
  if (!valid) throw new Error('Choose a valid semester')

  const year = Number(label[1]) // 'Y2S1' → 2
  const sem = Number(label[3])  // 'Y2S1' → 1
  return year * 2 + sem
}

// Checks a list of module codes and tidies it: trimmed, uppercase, no duplicates
function cleanCodes(list) {
  if (!Array.isArray(list)) throw new Error('Expected a list of module codes')

  const result = []
  for (const code of list) {
    if (typeof code !== 'string' || code.trim() === '') throw new Error('Expected a list of module codes')
    const tidy = code.trim().toUpperCase()
    if (!result.includes(tidy)) result.push(tidy)
  }
  return result
}

// Non-empty text, with spaces trimmed from both ends
function checkText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Invalid ${name}`)
  return value.trim()
}

// A whole number between min and max
function checkWholeNumber(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`)
  return value
}

// Modules from every semester BEFORE the current one, plus exemptions.
// The current semester is left out because those modules are still in progress.
function buildCompletedModules(currentSem, takenBySem, exempted) {
  // From the database, takenBySem is a Map; from a request, it's a plain object. Use one form.
  const semesters = takenBySem instanceof Map ? Object.fromEntries(takenBySem) : takenBySem
  const current = semesterNumber(currentSem)

  const modules = []
  for (const semester of Object.keys(semesters)) {
    if (semesterNumber(semester) < current) {
      modules.push(...semesters[semester])
    }
  }
  modules.push(...exempted)
  return cleanCodes(modules)
}


// ---------------------------------------------------------------------------
// The main function
// body    = what the student sent
// current = their user document as it is now
// Returns only the fields that should be saved.
// ---------------------------------------------------------------------------
export function profileUpdate(body, current = {}) {
  if (!isPlainObject(body)) throw new Error('Expected profile details')
  const result = {}

  // Check Text (Non-empty text, with spaces trimmed from both ends)
  if (body.name !== undefined) result.name = checkText(body.name, 'name')
  if (body.major !== undefined) result.major = checkText(body.major, 'major')

  // Whole numbers
  if (body.intakeYear !== undefined) result.intakeYear = checkWholeNumber(body.intakeYear, 'intakeYear', 2000, 2100)
  if (body.yearOfStudy !== undefined) result.yearOfStudy = checkWholeNumber(body.yearOfStudy, 'yearOfStudy', 1, 5)
  if (body.freeExemptions !== undefined) result.freeExemptions = checkWholeNumber(body.freeExemptions, 'freeExemptions', 0, 6)

  // e$ balance: a number, not negative - rounds to 2dp
  if (body.balance !== undefined) {
  if (typeof body.balance !== 'number' || body.balance < 0) {
    throw new Error('Balance must be a number that is 0 or more')
  }
  result.balance = Math.round(body.balance * 100) / 100   // keep 2 decimal places
}

  // Finished onboarding?
  if (body.onboarded !== undefined) {
    if (typeof body.onboarded !== 'boolean') throw new Error('Invalid onboarding status')
    result.onboarded = body.onboarded
  }

  // Lists of module codes
  if (body.tracks !== undefined) result.tracks = cleanCodes(body.tracks)
  if (body.basket !== undefined) result.basket = cleanCodes(body.basket)
  if (body.exempted !== undefined) result.exempted = cleanCodes(body.exempted)
  if (body.completedModules !== undefined) result.completedModules = cleanCodes(body.completedModules)

  // Non-course requirements the student has ticked off
  if (body.markedDone !== undefined) {
    if (!Array.isArray(body.markedDone)) throw new Error('Invalid completion flag')
    const done = []
    for (const item of body.markedDone) {
      if (!MARKED_DONE_OPTIONS.includes(item)) throw new Error('Invalid completion flag')
      if (!done.includes(item)) done.push(item)
    }
    result.markedDone = done
  }

  // Current semester; the year of study always follows from it
  if (body.currentSem !== undefined) {
    semesterNumber(body.currentSem) // throws if it isn't a valid label
    result.currentSem = body.currentSem
    result.yearOfStudy = Number(body.currentSem[1])
  }

  // Modules taken, per semester: { Y1S1: [...], Y1S2: [...] }
  if (body.takenBySem !== undefined) {
    if (!isPlainObject(body.takenBySem)) throw new Error('Invalid semester modules')
    result.takenBySem = {}
    for (const semester of Object.keys(body.takenBySem)) {
      semesterNumber(semester) // throws if the label is invalid
      result.takenBySem[semester] = cleanCodes(body.takenBySem[semester])
    }
  }

  // Calendar export permissions not used
  // if (body.consents !== undefined) {
  //   if (!isPlainObject(body.consents)) throw new Error('Invalid consents')
  //   const saved = current.consents || {}
  //   result.consents = { gmail: saved.gmail === true, outlook: saved.outlook === true }
  //   for (const provider of ['gmail', 'outlook']) {
  //     const value = body.consents[provider]
  //     if (value !== undefined) {
  //       if (typeof value !== 'boolean') throw new Error('Invalid consent')
  //       result.consents[provider] = value
  //     }
  //   }
  // }

  // Rebuild completedModules whenever something it depends on was sent
  const semester = result.currentSem || current.currentSem 
  const dependsOnChanged =
    body.currentSem !== undefined ||
    body.takenBySem !== undefined ||
    body.exempted !== undefined ||
    body.completedModules !== undefined
  if (semester && dependsOnChanged) { //if there is a change, save the changes
    const takenBySem = result.takenBySem || current.takenBySem || {}
    const exempted = result.exempted || current.exempted || []
    result.completedModules = buildCompletedModules(semester, takenBySem, exempted)
  }

  return result
}