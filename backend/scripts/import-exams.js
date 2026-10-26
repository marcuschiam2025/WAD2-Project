// Adds final exams from BOSS exam schedule exports to the sections already in MongoDB.
// BOSS schedules exams per course, so every section of a course gets the same finalExam.
//   - "EXAM" rows set finalExam { date, start, end }. BOSS gives no end time, so exams are taken
//     to last EXAM_HOURS hours.
//   - "NO EXAM" rows set finalExam to null, which the app shows as "No final exam".
//   - Courses missing from the file are left alone, and show as "Exam not yet announced".
// Exams entered by staff in the admin panel (examSource "admin") are never overwritten.
// Usage: pnpm import-exams <exam-schedule.xls> [more terms…]            (local MongoDB only)
//        pnpm import-exams <exam-schedule.xls> --remote                 (any MONGODB_URI, e.g. Atlas)
//        pnpm import-exams <exam-schedule.xls> --dry-run                (show what would change)
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { parseHtmlTable } from './utils/parseHtmlTable.js'

const filePaths = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const dryRun = process.argv.includes('--dry-run')
if (filePaths.length === 0) {
  console.error('Usage: pnpm import-exams <exam-schedule.xls> [more terms…] [--remote] [--dry-run]')
  process.exit(1)
}

// Safety check: only write to a remote database (like Atlas) when --remote is passed
const uri = process.env.MONGODB_URI ?? ''
const isLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(uri)
if (!isLocal && !dryRun && !process.argv.includes('--remote')) {
  console.error('MONGODB_URI is not a local database. Re-run with --remote to update its sections.')
  process.exit(1)
}

const EXAM_HOURS = 2

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

// "2026-27 Term 2 / 1" → "2026-27_T2"
function toTermKey(text) {
  const match = text.match(/^(20\d\d-\d\d) Term (\d)/)
  return match ? `${match[1]}_T${match[2]}` : null
}

// "2026-27_T2" → "AY26/27 T2", the label catalogue sections are stored with
function termLabel(key) {
  return `AY${key.slice(2, 4)}/${key.slice(5, 7)} T${key.at(-1)}`
}

// "20/04/2027" → "2027-04-20"
function toIsoDate(text) {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

// "8:30AM" → "08:30", "1:00PM" → "13:00"
function to24Hour(text) {
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

function addHours(time, hours) {
  const [h, m] = time.split(':').map(Number)
  const minutes = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59) // stay on the same day
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------------------------
// Read every exam schedule into one entry per term + course
// ---------------------------------------------------------------------------------------------

// "2026-27_T2|IS442" → { termKey, module, exams: [{ date, start, end }], noExam }
const courses = new Map()

for (const filePath of filePaths) {
  const [header, ...rows] = parseHtmlTable(readFileSync(filePath, 'utf8'))
  const col = {}
  header.forEach((name, i) => (col[name] = i))

  let skipped = 0
  for (const row of rows) {
    const termKey = toTermKey(row[col['Term / Session']] ?? '')
    const module = (row[col['Course Code']] ?? '').trim()
    if (!termKey || !module) {
      skipped++
      continue
    }

    const key = `${termKey}|${module}`
    if (!courses.has(key)) courses.set(key, { termKey, module, exams: [], noExam: false })
    const course = courses.get(key)

    if (row[col['Pattern']] === 'NO EXAM') {
      course.noExam = true
      continue
    }
    const date = toIsoDate(row[col['Exam Date']] ?? '')
    const start = to24Hour(row[col['Start Time']] ?? '')
    if (!date || !start) {
      skipped++
      continue
    }
    course.exams.push({ date, start, end: addHours(start, EXAM_HOURS) })
  }
  console.log(`${filePath}: ${rows.length} rows${skipped ? `, ${skipped} unreadable rows skipped` : ''}`)
}

// ---------------------------------------------------------------------------------------------
// Update the sections of each course
// ---------------------------------------------------------------------------------------------

await connectDB(uri)
const sections = mongoose.connection.db.collection('sections')

const counts = { exam: 0, noExam: 0, sections: 0, notInDatabase: 0 }
const ambiguous = []

for (const course of courses.values()) {
  // A course with several different exam times (e.g. split papers) is left for staff to enter
  const times = new Set(course.exams.map((exam) => `${exam.date} ${exam.start}`))
  if (times.size > 1 || (times.size === 1 && course.noExam)) {
    ambiguous.push(`${course.module} (${course.termKey}): ${[...times].join(', ')}${course.noExam ? ', NO EXAM' : ''}`)
    continue
  }

  // Catalogue rows store module + term label; older admin rows store moduleCode + termKey
  const filter = {
    $and: [
      { $or: [{ term: termLabel(course.termKey) }, { term: course.termKey }, { termKey: course.termKey }] },
      { $or: [{ module: course.module }, { moduleCode: course.module }] },
      { examSource: { $ne: 'admin' } },
    ],
  }

  let finalExam = null
  if (course.exams.length) {
    const exam = course.exams[0]
    finalExam = { date: new Date(`${exam.date}T00:00:00+08:00`), start: exam.start, end: exam.end }
  }

  const matched = dryRun
    ? await sections.countDocuments(filter)
    : (await sections.updateMany(filter, { $set: { finalExam, examSource: 'boss' } })).matchedCount
  if (!matched) {
    counts.notInDatabase++
    continue
  }
  counts.sections += matched
  if (finalExam) counts.exam++
  else counts.noExam++
}

console.log(`${dryRun ? 'Dry run, nothing written. Would update' : 'Updated'} ${counts.sections} sections:`)
console.log(`  ${counts.exam} courses with a final exam, ${counts.noExam} with no final exam`)
console.log(`  ${counts.notInDatabase} courses in the schedule have no sections in the database (other terms, or not offered)`)
if (ambiguous.length) {
  console.log(`  ${ambiguous.length} courses with several exam times were skipped; enter them in the admin panel:`)
  for (const line of ambiguous) console.log(`    ${line}`)
}

await mongoose.disconnect()
