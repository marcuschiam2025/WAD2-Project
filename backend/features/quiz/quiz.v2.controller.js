import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import QuizAttempt from './models/QuizAttempt.js';
import { validateSubmissionV2 } from './utils/validateSubmissionV2.js';
import { scoreQuizV2 } from './utils/scoreQuizV2.js';
import * as rubric from './content/rubric.v2.js';
import { persistSubmissionV2 } from './quiz.v2.storage.js';

// Preview content is file-backed until the team publishes a rubric. No seeding
// or connection to the shared question collection is required for this route.
const content = JSON.parse(
  await readFile(new URL('./content/questions.v2-draft.json', import.meta.url), 'utf8'),
);

function publicAttempt(attempt) {
  return {
    id: String(attempt._id),
    rubricVersion: attempt.rubricVersion,
    createdAt: attempt.createdAt,
    responses: attempt.responses,
    ...attempt.resultSnapshot,
  };
}

// Dependency injection lets controller checks run without touching MongoDB.
export function createSubmitAttemptV2(persist = persistSubmissionV2) {
  return async function submitAttemptV2(req, res) {
    const validated = validateSubmissionV2(req.body, content);
    if (!validated.ok) {
      return res
        .status(validated.status)
        .json({ error: 'Quiz submission is not valid', code: validated.code, issues: validated.issues });
    }
    const result = scoreQuizV2(validated.responses);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ rubricVersion: validated.rubricVersion, responses: validated.responses }))
      .digest('hex');
    const answerLabels = validated.responses.map(({ questionId, optionId }) => {
      const question = content.questions.find((q) => q.id === questionId);
      return {
        questionId,
        prompt: question.prompt,
        optionId,
        label: optionId === null ? null : question.options.find((o) => o.id === optionId).label,
      };
    });
    const resultSnapshot = { ...result, sectionCoverage: validated.sectionCoverage, answerLabels };
    const outcome = await persist({
      user: req.user._id,
      submissionId: validated.submissionId,
      fingerprint,
      document: {
        rubricVersion: validated.rubricVersion,
        responses: validated.responses,
        results: result.results,
        rankingBasis: result.rankingBasis,
        themeCoverage: result.themeCoverage,
        resultSnapshot,
        rubricSnapshot: { questions: content.questions, ...rubric },
      },
    });
    if (!outcome.attempt)
      return res.status(outcome.status).json({
        error:
          outcome.code === 'QUIZ_RESULT_EXPIRED'
            ? 'This result is no longer in your latest two attempts'
            : 'Submission ID was already used for different answers',
        code: outcome.code,
      });
    return res.status(outcome.status).json(publicAttempt(outcome.attempt));
  };
}

export const submitAttemptV2 = createSubmitAttemptV2();

export async function listAttemptsV2(req, res) {
  const attempts = await QuizAttempt.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 }).limit(2);
  res.set('Cache-Control', 'no-store');
  // Legacy results keep their original interpretation instead of being rescored.
  res.json(
    attempts.map((attempt) =>
      attempt.resultSnapshot
        ? publicAttempt(attempt)
        : {
            id: String(attempt._id),
            rubricVersion: 'legacy-v1',
            createdAt: attempt.createdAt,
            answers: attempt.answers,
            results: attempt.results,
          },
    ),
  );
}

// GET /api/quiz/v2/questions: authenticated by the existing parent router.
export function listQuestionsV2(req, res) {
  if (req.query.rubricVersion !== undefined && req.query.rubricVersion !== content.rubricVersion) {
    return res.status(409).json({
      error: 'Requested quiz version is not available',
      code: 'QUIZ_VERSION_UNAVAILABLE',
      availableRubricVersion: content.rubricVersion,
    });
  }

  // Allowlist public fields so future internal metadata cannot leak to clients.
  const questions = content.questions.map(({ id, section, order, type, prompt, options }) => ({
    id,
    section,
    order,
    type,
    prompt,
    options: options.map(({ id: optionId, label }) => ({ id: optionId, label })),
  }));

  res.set('Cache-Control', 'no-store');
  return res.json({ rubricVersion: content.rubricVersion, questions });
}
