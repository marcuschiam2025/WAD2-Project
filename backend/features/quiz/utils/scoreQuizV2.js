import { calculateRatingTracks } from './ratingTracksV2.js';
import { calculateScenarioPreferences } from './scenarioPreferencesV2.js';
import { calculateMatchScores } from './blendedScoreV2.js';

// Scores this close are the same score; the gap is floating-point noise
const sameScore = (a, b) => Math.abs(a.alignmentIndex - b.alignmentIndex) < 1e-9;

// The results page and module suggestions show the first two tracks. If a tie runs across that cut-off, list order would
// always favour the same track, so the tied tracks are shuffled. Two tracks tied at the top both fit, so they stay put.
export function shuffleTieAcrossCutoff(results, random) {
  if (results.length < 3 || !sameScore(results[1], results[2])) return;
  const tied = results.flatMap((result, index) => (sameScore(result, results[1]) ? [index] : []));
  for (let i = tied.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const [a, b] = [tied[i], tied[j]];
    [results[a], results[b]] = [results[b], results[a]];
  }
}

// Call only after validateSubmissionV2 succeeds. This has no storage side effects. The order it returns is saved with the
// attempt, so a random tie-break stays the same every time the result is viewed.
export function scoreQuizV2(responses, random = Math.random) {
  const ratings = calculateRatingTracks(responses);
  if (ratings.missingThemes.length)
    throw new TypeError(`Missing ratings for: ${ratings.missingThemes.join(', ')}`);
  const scenarios = new Map(calculateScenarioPreferences(responses).map((result) => [result.track, result]));
  const match = calculateMatchScores(ratings.themeRatings, responses);
  const results = ratings.results
    .map(({ track, alignmentIndex }) => ({
      ...scenarios.get(track),
      track,
      ratingAlignmentIndex: alignmentIndex,
      alignmentIndex: match[track],
    }))
    .sort((a, b) => b.alignmentIndex - a.alignmentIndex);

  shuffleTieAcrossCutoff(results, random);
  results.forEach((result, index) => {
    result.rank = index > 0 && sameScore(result, results[index - 1]) ? results[index - 1].rank : index + 1;
  });

  return { ...ratings, rankingBasis: 'blended', results };
}
