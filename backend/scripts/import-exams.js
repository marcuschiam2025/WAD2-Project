// Import BOSS exam schedules without inventing missing end times.
// Only explicit NO EXAM rows clear exams. Invalid or conflicting courses retain existing data.
// Staff-entered exams are protected; --dry-run never writes.
// Usage: pnpm import-exams <exam-schedule.xls> [more files...] [--remote] [--dry-run]
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { parseHtmlTable } from './utils/parseHtmlTable.js';
import { buildExamImport } from './utils/examImport.js';

const filePaths = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
if (!filePaths.length) {
  console.error('Usage: pnpm import-exams <exam-schedule.xls> [more files...] [--remote] [--dry-run]');
  process.exit(1);
}
const uri = process.env.MONGODB_URI ?? '';
const isLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/.test(uri);
if (!isLocal && !dryRun && !process.argv.includes('--remote')) {
  console.error('MONGODB_URI is not a local database. Re-run with --remote to update its sections.');
  process.exit(1);
}

// Validate every file before connecting or writing, including required headers and all dates/times.
const tables = filePaths.map((filePath) => {
  const table = parseHtmlTable(readFileSync(filePath, 'utf8'));
  console.log(`${filePath}: ${Math.max(0, table.length - 1)} rows`);
  return table;
});
const { updates, issues } = buildExamImport(tables);
for (const issue of issues) console.log(`Skipped: ${issue}`);

await connectDB(uri);
try {
  const sections = mongoose.connection.db.collection('sections');
  const counts = { exam: 0, partial: 0, noExam: 0, sections: 0, unmatched: 0 };
  for (const { filter, update } of updates) {
    const matched = dryRun
      ? await sections.countDocuments(filter)
      : (await sections.updateMany(filter, update)).matchedCount;
    if (!matched) {
      counts.unmatched++;
      continue;
    }
    counts.sections += matched;
    const exam = update.$set.finalExam;
    if (!exam) counts.noExam++;
    else if (exam.endVerified) counts.exam++;
    else counts.partial++;
  }
  console.log(
    `${dryRun ? 'Dry run, nothing written. Would update' : 'Updated'} ${counts.sections} sections:`,
  );
  console.log(
    `  ${counts.exam} courses with verified end times, ${counts.partial} with end times unconfirmed, ${counts.noExam} with no final exam`,
  );
  console.log(
    `  ${counts.unmatched} courses had no writable matching sections (missing catalogue rows, protected staff edits or already verified ends)`,
  );
} finally {
  await mongoose.disconnect();
}
