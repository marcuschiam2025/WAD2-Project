import { THEMES, TRACK_PROFILES, SCENARIO_MAPPINGS, SUPPORTING_THEME_WEIGHT, BLEND_SCENARIO_SHARE, SCENARIO_SCALE } from '../content/rubric.v2.js'

const TRACKS = Object.keys(TRACK_PROFILES)
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
const dot = (weights, evidence) => THEMES.reduce((sum, theme) => sum + weights[theme] * evidence[theme], 0)

// Each profile as a unit-length contrast. Averaging the raw indices favoured Fintech and Smart-City, whose profiles
// have the most extreme scenario floors; this gives every track the same reach.
const CONTRASTS = Object.fromEntries(TRACKS.map((track) => {
  const profile = TRACK_PROFILES[track]
  const average = mean(THEMES.map((theme) => profile[theme]))
  const length = Math.hypot(...THEMES.map((theme) => profile[theme] - average))
  return [track, Object.fromEntries(THEMES.map((theme) => [theme, (profile[theme] - average) / length]))]
}))

const centre = (evidence) => {
  const average = mean(THEMES.map((theme) => evidence[theme]))
  return Object.fromEntries(THEMES.map((theme) => [theme, evidence[theme] - average]))
}

// How much one scenario option supports each theme, on the same 0-100 scale as a rating
function optionSupport([primary, supporting]) {
  return Object.fromEntries(THEMES.map((theme) => [theme, theme === primary ? 100 : theme === supporting ? 100 * SUPPORTING_THEME_WEIGHT : 0]))
}

const RATING_SHARE = 1 - BLEND_SCENARIO_SHARE
const SCENARIO_SHARE = BLEND_SCENARIO_SHARE * SCENARIO_SCALE

// The furthest any track can get from neutral. The score is linear, so the extreme sits at a corner: each theme rated
// 0 or 100, and each scenario on its strongest option. Dividing every track by this one value keeps the ranking intact.
const REACH = (() => {
  const scenarioOptions = Object.values(SCENARIO_MAPPINGS).map((mapping) => Object.values(mapping.options).map((themes) => centre(optionSupport(themes))))
  let reach = 0
  for (const contrast of Object.values(CONTRASTS)) {
    const values = scenarioOptions.map((options) => options.map((option) => dot(contrast, option)))
    const best = mean(values.map((question) => Math.max(...question)))
    const worst = mean(values.map((question) => Math.min(...question)))
    for (let corner = 0; corner < 2 ** THEMES.length; corner++) {
      const rated = centre(Object.fromEntries(THEMES.map((theme, index) => [theme, corner & (1 << index) ? 100 : 0])))
      const ratingPart = RATING_SHARE * dot(contrast, rated)
      reach = Math.max(reach, Math.abs(ratingPart + SCENARIO_SHARE * best), Math.abs(ratingPart + SCENARIO_SHARE * worst))
    }
  }
  return reach
})()

/**
 * The match score: ratings and scenarios combined, per track. 50 means no lean towards or away from the track, and a
 * higher score means the answers fit it better. Ratings are compared with the student's own average, so the same pattern
 * scores the same whether they rate generously or not.
 * @param themeRatings { DATA: { index }, ... } with every theme present
 * @param responses    canonical validated responses
 * @returns { BA: score, PD: score, FT: score, SMT: score }
 */
export function calculateMatchScores(themeRatings, responses) {
  const rated = centre(Object.fromEntries(THEMES.map((theme) => [theme, themeRatings[theme].index])))
  const chosen = responses.filter(({ questionId, optionId }) => questionId in SCENARIO_MAPPINGS && optionId !== null && optionId !== 'e')
  const support = chosen.map(({ questionId, optionId }) => optionSupport(SCENARIO_MAPPINGS[questionId].options[optionId]))
  const scenarios = centre(Object.fromEntries(THEMES.map((theme) => [theme, mean(support.map((option) => option[theme]))])))
  const evidence = Object.fromEntries(THEMES.map((theme) => [theme, RATING_SHARE * rated[theme] + SCENARIO_SHARE * scenarios[theme]]))
  // Answering "None of these" on some scenarios can edge past the all-answered reach, so keep the score on the scale
  return Object.fromEntries(TRACKS.map((track) => [track, Math.max(0, Math.min(100, 50 + 50 * dot(CONTRASTS[track], evidence) / REACH))]))
}
