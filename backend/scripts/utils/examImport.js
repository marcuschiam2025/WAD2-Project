import { canonicalTerm, termLabel } from '../../features/bidding/utils/sectionData.js'

const requiredColumns = ['Term / Session', 'Course Code', 'Pattern', 'Exam Date', 'Start Time']
function dateValue(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/.exec(text)
  if (!match) return null
  const value = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
function timeValue(text) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(text)
  if (!match) return null
  let hours = Number(match[1])
  if (Number(match[2]) > 59 || (match[3] ? hours < 1 || hours > 12 : hours > 23)) return null
  if (match[3]) hours = hours % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

// Build validated writes before connecting to MongoDB. An unreadable or conflicting course is left untouched.
export function buildExamImport(tables) {
  const courses = new Map(), issues = [], updates = []
  for (const [header = [], ...rows] of tables) {
    const columns = Object.fromEntries(header.map((name, i) => [name.trim(), i]))
    for (const name of requiredColumns) if (columns[name] === undefined) throw new Error(`Missing exam schedule column: ${name}`)
    for (const row of rows) {
      if (row.every(value => !value.trim())) continue
      const field = name => (row[columns[name]] ?? '').trim()
      const term = /^(20\d{2}-\d{2})\s+Term\s+([1-3])(?:\s*\/.*)?$/i.exec(field('Term / Session'))
      let termKey
      try { termKey = canonicalTerm(term ? `${term[1]}_T${term[2]}` : null) } catch { issues.push('Unreadable academic term; row skipped'); continue }
      const module = field('Course Code').toUpperCase()
      if (!/^[A-Z][A-Z0-9._-]{1,39}$/.test(module)) { issues.push(`Unreadable course code in ${termKey}; row skipped`); continue }
      const key = `${termKey}|${module}`
      if (!courses.has(key)) courses.set(key, { termKey, module, exams: [], noExam: false, invalid: false })
      const course = courses.get(key), pattern = field('Pattern').toUpperCase()
      if (pattern === 'NO EXAM') { course.noExam = true; continue }
      const date = dateValue(field('Exam Date')), start = timeValue(field('Start Time'))
      const endText = field('End Time'), end = endText ? timeValue(endText) : null
      if (pattern !== 'EXAM' || !date || !start || (endText && (!end || end <= start))) { course.invalid = true; continue }
      course.exams.push({ date, start, end })
    }
  }
  for (const course of courses.values()) {
    const starts = new Set(course.exams.map(exam => `${exam.date} ${exam.start}`))
    const ends = new Set(course.exams.map(exam => exam.end).filter(Boolean))
    if (course.invalid || starts.size > 1 || ends.size > 1 || (course.noExam && starts.size)) {
      issues.push(`${course.module} (${course.termKey}): unreadable or conflicting exam details; existing data retained`)
      continue
    }
    if (!course.noExam && !course.exams.length) continue
    const exam = course.exams.find(exam => exam.end) ?? course.exams[0]
    const finalExam = course.noExam ? null : { date: new Date(`${exam.date}T00:00:00+08:00`), start: exam.start, end: exam.end, endVerified: !!exam.end }
    const filter = { $and: [
      { $or: [{ term: termLabel(course.termKey) }, { term: course.termKey }, { termKey: course.termKey }] },
      { $or: [{ module: course.module }, { moduleCode: course.module }] },
      { examSource: { $ne: 'admin' } },
    ] }
    // A partial export must not erase a previously verified end for the same date and start.
    if (finalExam && !finalExam.endVerified) filter.$and.push({ $nor: [{ 'finalExam.date': finalExam.date, 'finalExam.start': finalExam.start, 'finalExam.endVerified': true }] })
    updates.push({ module: course.module, termKey: course.termKey, filter, update: { $set: { finalExam, examSource: 'boss' } } })
  }
  return { updates, issues }
}
