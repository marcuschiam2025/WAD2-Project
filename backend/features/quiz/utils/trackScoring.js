// Track Finder scoring: weighted sum of the chosen options, normalised to % fit
// against the best score each track could have reached. Pure function — unit test me.

const weightOf = (option, track) =>
  option.weights instanceof Map ? (option.weights.get(track) ?? 0) : (option.weights?.[track] ?? 0)

const tracksIn = (option) =>
  option.weights instanceof Map ? [...option.weights.keys()] : Object.keys(option.weights ?? {})

/**
 * @param {Array<{ options: Array<{ weights: Map|Object }> }>} questions in quiz order
 * @param {Array<number|null>} answers chosen option index per question
 * @returns {Array<{ track: string, pct: number }>} best match first
 */
export function scoreQuiz(questions, answers) {
  const totals = {}
  const max = {}

  questions.forEach((q, i) => {
    const tracks = new Set(q.options.flatMap(tracksIn))
    tracks.forEach((t) => {
      max[t] = (max[t] ?? 0) + Math.max(...q.options.map((o) => weightOf(o, t)))
    })
    const picked = q.options[answers[i]]
    if (!picked) return
    tracksIn(picked).forEach((t) => {
      totals[t] = (totals[t] ?? 0) + weightOf(picked, t)
    })
  })

  return Object.keys(max)
    .map((track) => ({ track, pct: max[track] ? Math.round(((totals[track] ?? 0) / max[track]) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)
}

/**
 * When the top two tracks both score highly, check whether a double track still fits.
 * @returns {{ fits: boolean, cuNeeded: number, cuAvailable: number }}
 */
export function checkDoubleTrack({ extraCu, remainingTerms, maxCuPerTerm = 5, plannedCu = 0 }) {
  const cuAvailable = remainingTerms * maxCuPerTerm - plannedCu
  return { fits: extraCu <= cuAvailable, cuNeeded: extraCu, cuAvailable }
}
