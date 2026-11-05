import mongoose from 'mongoose';
import QuizAttempt from './models/QuizAttempt.js';
import { buildExplanationPrompt, leadingResults, EXPLANATION_VERSION } from './utils/explainResultV2.js';
import { generateJson, geminiModel } from '../../services/gemini.js';

const FAILURES = {
  AI_UNAVAILABLE: { status: 503, retryable: false },
  AI_BUSY: { status: 503, retryable: true },
  AI_TIMEOUT: { status: 504, retryable: true },
  AI_FAILED: { status: 502, retryable: true },
};

export function createExplanationV2(
  findAttempt = (filter) => QuizAttempt.findOne(filter),
  saveExplanation = (id, aiExplanation) => QuizAttempt.updateOne({ _id: id }, { $set: { aiExplanation } }),
  generate = generateJson,
  model = geminiModel,
) {
  return async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ error: 'Invalid attempt ID', code: 'INVALID_ATTEMPT_ID' });
    }
    const attempt = await findAttempt({ _id: req.params.id, user: req.user._id });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found', code: 'QUIZ_ATTEMPT_NOT_FOUND' });
    if (!attempt.resultSnapshot) {
      return res
        .status(409)
        .json({ error: 'Retake the current quiz for an explanation', code: 'LEGACY_QUIZ_ATTEMPT' });
    }
    res.set('Cache-Control', 'no-store');
    // Results never change after submission, so one explanation per attempt is enough, unless the prompt has changed since
    if (attempt.aiExplanation?.version === EXPLANATION_VERSION) return res.json(attempt.aiExplanation);

    let output;
    try {
      output = await generate(buildExplanationPrompt(attempt));
    } catch (error) {
      const failure = FAILURES[error.code];
      if (!failure) throw error;
      console.error(`Quiz explanation failed for ${attempt._id}: ${error.message}`);
      return res
        .status(failure.status)
        .json({ error: 'AI explanation is unavailable', code: error.code, retryable: failure.retryable });
    }

    // Keep one entry per leading track, in rank order, whether there is one leading track or two
    const byTrack = new Map(
      (Array.isArray(output?.tracks) ? output.tracks : [])
        .filter((t) => typeof t?.reasoning === 'string' && t.reasoning.trim())
        .map((t) => [t.track, t]),
    );
    const tracks = leadingResults(attempt)
      .map((r) => byTrack.get(r.track))
      .filter(Boolean);
    if (typeof output?.summary !== 'string' || !output.summary.trim() || !tracks.length) {
      console.error(`Quiz explanation for ${attempt._id} did not match the schema`);
      return res
        .status(502)
        .json({ error: 'AI explanation is unavailable', code: 'AI_FAILED', retryable: true });
    }

    const aiExplanation = {
      summary: output.summary.trim(),
      tracks: tracks.map(({ track, reasoning }) => ({ track, reasoning: reasoning.trim() })),
      model: model(),
      version: EXPLANATION_VERSION,
      generatedAt: new Date().toISOString(),
    };
    await saveExplanation(attempt._id, aiExplanation);
    return res.json(aiExplanation);
  };
}

export const explanationV2 = createExplanationV2();
