import { calculateRatingTracks } from './ratingTracksV2.js'
import { calculateScenarioPreferences } from './scenarioPreferencesV2.js'

// Call only after validateSubmissionV2 succeeds. This has no storage side effects.
export function scoreQuizV2(responses) {
  const ratings = calculateRatingTracks(responses)
  const scenarios = new Map(calculateScenarioPreferences(responses).map((result) => [result.track, result]))
  const provisional = ratings.missingThemes.length > 0
  const rankingBasis = provisional ? 'scenario-provisional' : 'rating'
  const results = ratings.results.map((rating) => ({ ...rating, ...scenarios.get(rating.track) }))

  if (provisional) {
    results.sort((a, b) => b.scenarioPreferenceIndex - a.scenarioPreferenceIndex)
    results.forEach((result, index) => {
      result.rank = index > 0 && result.scenarioPreferenceIndex === results[index - 1].scenarioPreferenceIndex
        ? results[index - 1].rank
        : index + 1
    })
  }

  return { ...ratings, rankingBasis, results }
}
