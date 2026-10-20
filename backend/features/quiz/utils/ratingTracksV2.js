import { calculateThemeRating } from './ratingIndexV2.js'
import { THEMES, SECTION_WEIGHTS, RATING_MAPPINGS, TRACK_PROFILES } from '../content/rubric.v2.js'

/** Receives canonical responses from validateSubmissionV2, not a request body. */
export function calculateRatingTracks(responses) {
  const byQuestion = new Map(responses.map(({ questionId, optionId }) => [questionId, optionId]))
  const observations = Object.fromEntries(THEMES.map((theme) => [theme, []]))

  for (const [questionId, mapping] of Object.entries(RATING_MAPPINGS)) {
    if (!byQuestion.has(questionId)) throw new TypeError(`Missing validated response: ${questionId}`)
    const optionId = byQuestion.get(questionId)
    if (optionId !== null && !['1', '2', '3', '4', '5'].includes(optionId)) {
      throw new TypeError(`Invalid rating option: ${questionId}`)
    }
    observations[mapping.theme].push({
      value: optionId === null ? null : Number(optionId),
      weight: SECTION_WEIGHTS[mapping.section],
    })
  }

  const themeRatings = Object.fromEntries(
    THEMES.map((theme) => [theme, calculateThemeRating(observations[theme])]),
  )
  const themeCoverage = Object.fromEntries(THEMES.map((theme) => [theme, themeRatings[theme].informativeCount]))
  const missingThemes = THEMES.filter((theme) => themeRatings[theme].index === null)
  if (missingThemes.length) {
    return {
      themeRatings,
      themeCoverage,
      missingThemes,
      // No rating ranking exists. The later scenario stage supplies the ranks.
      results: Object.keys(TRACK_PROFILES).map((track) => ({ track, alignmentIndex: null })),
    }
  }

  const results = Object.entries(TRACK_PROFILES).map(([track, profile]) => ({
    track,
    alignmentIndex: THEMES.reduce((sum, theme) => sum + themeRatings[theme].index * profile[theme], 0) / 100,
  })).sort((a, b) => b.alignmentIndex - a.alignmentIndex)

  results.forEach((result, index) => {
    result.rank = index > 0 && result.alignmentIndex === results[index - 1].alignmentIndex
      ? results[index - 1].rank
      : index + 1
  })

  return { themeRatings, themeCoverage, missingThemes, results }
}
