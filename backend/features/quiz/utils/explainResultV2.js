import { THEMES, TRACK_PROFILES } from '../content/rubric.v2.js'

// Bump when the prompt changes enough that saved explanations should be written again
export const EXPLANATION_VERSION = 2

// Matches quizTrackNames in frontend/src/core/stores/quiz.js
export const TRACK_NAMES = {
  BA: 'Business Analytics',
  PD: 'Product Development',
  FT: 'Financial Technology',
  SMT: 'Smart-City Management & Technology',
}

const THEME_NAMES = {
  DATA: 'working with data and evidence',
  BUILD: 'building and iterating on products',
  FINANCE: 'finance and financial systems',
  CIVIC: 'cities, public services and civic impact',
  RELIABLE: 'reliable, careful work and managing risk',
  PEOPLE: 'working with people and stakeholders',
}

const SYSTEM = `You are a friendly university course advisor explaining an Information Systems track-finder quiz result to the student who took it.
Write the way a thoughtful advisor talks: warm, natural, second person ("you"), with varied sentences. Help the student recognise themselves in the explanation.
Rules:
- Never mention numbers, scores, percentages, ranks or ratings out of anything. Describe strengths and leanings in words.
- Paraphrase what the student chose in your own words; do not quote question or answer text, and do not list answers one by one.
- Weave the student's interests and choices into a story about what draws them to each track.
- Use only the data given. Do not invent modules, careers, statistics or facts about the student.
- The result is a guide to explore, not a prediction of ability or success. Never say the student will succeed or fail.
- There may be one or two leading tracks. Write exactly one "tracks" entry per leading track, never for any other track.
- If the two leading tracks are tied or close, say both are worth exploring.
- If there is one leading track, explain why it stands out without inventing a second one.
- If the result is provisional, gently say so because some ratings were missing.
- summary: 2-3 sentences on the overall picture. Each track reasoning: 2-4 sentences on why that track suits them.`

export const EXPLANATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    tracks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { track: { type: 'STRING' }, reasoning: { type: 'STRING' } },
        required: ['track', 'reasoning'],
      },
    },
  },
  required: ['summary', 'tracks'],
}

// Words instead of numbers, so the model has nothing to quote. 50 means no lean either way.
const fit = (score) => typeof score !== 'number' ? 'unknown' : score >= 70 ? 'strong fit' : score >= 58 ? 'good fit' : score > 42 ? 'some fit' : 'weak fit'
// Same cut-offs as themeLevel in frontend/src/core/stores/quiz.js
const level = (index) => typeof index !== 'number' ? 'not enough answers' : index >= 67 ? 'high' : index >= 34 ? 'medium' : 'low'

function drivenBy({ ratingAlignmentIndex: rating, scenarioPreferenceIndex: scenario }) {
  if (typeof rating !== 'number' || typeof scenario !== 'number') return 'scenario choices'
  if (scenario - rating >= 10) return 'mostly the scenario choices'
  if (rating - scenario >= 10) return 'mostly the self-ratings'
  return 'both the self-ratings and the scenario choices'
}

// The themes a track values most, from the rubric's weights
const keyThemes = (track) => Object.entries(TRACK_PROFILES[track] ?? {})
  .filter(([, weight]) => weight >= 15).sort((a, b) => b[1] - a[1]).map(([theme]) => THEME_NAMES[theme])

const savedResults = (attempt) => attempt.resultSnapshot?.results ?? attempt.results ?? []

// The one or two tracks the explanation covers, in rank order. The prompt and the controller's filter both use this,
// so they always agree on which tracks Gemini may write about.
export function leadingResults(attempt) {
  return savedResults(attempt).slice(0, 2)
}

function closeness(leading) {
  if (leading.length < 2) return 'one clear leading track'
  if (leading[0].rank === leading[1].rank) return 'tied'
  return leading[0].alignmentIndex - leading[1].alignmentIndex <= 5 ? 'very close' : 'the first leads clearly'
}

// Builds the Gemini request from the saved result only; rubricSnapshot and user data are never sent.
export function buildExplanationPrompt(attempt) {
  const snapshot = attempt.resultSnapshot
  const results = savedResults(attempt)
  const leading = leadingResults(attempt)
  const leadingSet = new Set(leading)
  const data = {
    provisional: (snapshot.rankingBasis ?? attempt.rankingBasis) === 'scenario-provisional',
    leadingTracks: leading.map((r) => ({
      track: r.track,
      name: TRACK_NAMES[r.track] ?? r.track,
      fit: fit(r.alignmentIndex),
      basedOn: drivenBy(r),
      valuesMost: keyThemes(r.track),
    })),
    howTheLeadersCompare: closeness(leading),
    otherTracks: results.filter((r) => !leadingSet.has(r)).map((r) => ({ name: TRACK_NAMES[r.track] ?? r.track, fit: fit(r.alignmentIndex) })),
    studentInterestLevels: Object.fromEntries(THEMES.map((theme) => [THEME_NAMES[theme], level(snapshot.themeRatings?.[theme]?.index)])),
    studentChoices: (snapshot.answerLabels ?? []).filter((a) => a.label).map((a) => `${a.prompt} → ${a.label}`),
  }
  const ask = leading.length === 1
    ? `Explain why ${data.leadingTracks[0].name} (track code ${leading[0].track}) suits this student. Return exactly one entry in "tracks".`
    : `Explain why ${data.leadingTracks.map((t) => `${t.name} (track code ${t.track})`).join(' and ')} suit this student. Return exactly two entries in "tracks", one for each.`
  const prompt = `${ask} Use the track code in each entry's "track" field.

${JSON.stringify(data)}`
  return { system: SYSTEM, prompt, schema: EXPLANATION_SCHEMA }
}
