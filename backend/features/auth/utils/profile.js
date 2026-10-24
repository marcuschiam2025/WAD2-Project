// Only profile fields may be changed by a student. Identity and role come from the server.
const semesterIndex = (id) => {
  if (typeof id !== 'string' || !/^Y[1-5]S[12]$/.test(id)) throw new Error('Choose a valid semester')
  return Number(id[1]) * 2 + Number(id[3])
}
const codes = (value) => {
  if (!Array.isArray(value) || value.some(code => typeof code !== 'string' || !code.trim())) throw new Error('Expected a list of module codes')
  return [...new Set(value.map(code => code.trim().toUpperCase()))]
}
export function profileUpdate(body, current = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected profile details')
  const result = {}
  for (const key of ['name', 'major']) if (body[key] !== undefined) {
    if (typeof body[key] !== 'string' || !body[key].trim()) throw new Error(`Invalid ${key}`)
    result[key] = body[key].trim()
  }
  for (const [key, min, max] of [['intakeYear', 2000, 2100], ['yearOfStudy', 1, 5], ['freeExemptions', 0, 6]]) {
    if (body[key] !== undefined) {
      if (!Number.isInteger(body[key]) || body[key] < min || body[key] > max) throw new Error(`Invalid ${key}`)
      result[key] = body[key]
    }
  }
  if (body.balance !== undefined) {
    if (typeof body.balance !== 'number' || !Number.isFinite(body.balance) || body.balance < 0) throw new Error('Invalid balance')
    result.balance = body.balance
  }
  if (body.onboarded !== undefined) {
    if (typeof body.onboarded !== 'boolean') throw new Error('Invalid onboarding status')
    result.onboarded = body.onboarded
  }
  for (const key of ['tracks', 'basket', 'exempted', 'completedModules']) {
    if (body[key] !== undefined) result[key] = codes(body[key])
  }
  if (body.markedDone !== undefined) {
    const allowed = ['internship', 'community', 'exposure']
    if (!Array.isArray(body.markedDone) || body.markedDone.some(id => !allowed.includes(id))) throw new Error('Invalid completion flag')
    result.markedDone = [...new Set(body.markedDone)]
  }
  if (body.currentSem !== undefined) {
    semesterIndex(body.currentSem)
    result.currentSem = body.currentSem
    result.yearOfStudy = Number(body.currentSem[1])
  }
  if (body.takenBySem !== undefined) {
    if (!body.takenBySem || typeof body.takenBySem !== 'object' || Array.isArray(body.takenBySem)) throw new Error('Invalid semester modules')
    result.takenBySem = Object.fromEntries(Object.entries(body.takenBySem).map(([semester, modules]) => {
      semesterIndex(semester)
      return [semester, codes(modules)]
    }))
  }
  if (body.consents !== undefined) {
    if (!body.consents || typeof body.consents !== 'object' || Array.isArray(body.consents)) throw new Error('Invalid consents')
    result.consents = { gmail: current.consents?.gmail ?? false, outlook: current.consents?.outlook ?? false }
    for (const key of ['gmail', 'outlook']) if (body.consents[key] !== undefined) {
      if (typeof body.consents[key] !== 'boolean') throw new Error('Invalid consent')
      result.consents[key] = body.consents[key]
    }
  }
  const sem = result.currentSem ?? current.currentSem
  if (sem && ['currentSem', 'takenBySem', 'exempted', 'completedModules'].some(key => body[key] !== undefined)) {
    const stored = result.takenBySem ?? current.takenBySem ?? {}
    const entries = stored instanceof Map ? [...stored.entries()] : Object.entries(stored)
    result.completedModules = [...new Set([
      ...entries.filter(([id]) => semesterIndex(id) < semesterIndex(sem)).flatMap(([, modules]) => codes(modules)),
      ...codes(result.exempted ?? current.exempted ?? []),
    ])]
  }
  return result
}
