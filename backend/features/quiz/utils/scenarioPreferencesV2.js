import { SECTION_WEIGHTS, SCENARIO_MAPPINGS, SUPPORTING_THEME_WEIGHT, TRACK_PROFILES } from '../content/rubric.v2.js'

const support = (profile, [primary, supporting]) => profile[primary] + SUPPORTING_THEME_WEIGHT * profile[supporting]

/** Receives canonical validated responses; requires a scenario in every section. */
export function calculateScenarioPreferences(responses) {
  const byQuestion = new Map(responses.map(({ questionId, optionId }) => [questionId, optionId]))
  const sections = Object.fromEntries(Object.keys(SECTION_WEIGHTS).map((section) => [section, []]))
  for (const [questionId, mapping] of Object.entries(SCENARIO_MAPPINGS)) {
    if (!byQuestion.has(questionId)) throw new TypeError(`Missing validated response: ${questionId}`)
    const optionId = byQuestion.get(questionId)
    if (optionId === null) continue
    if (!Object.hasOwn(mapping.options, optionId)) throw new TypeError(`Invalid scenario option: ${questionId}`)
    sections[mapping.section].push({ mapping, optionId })
  }
  for (const [section, observations] of Object.entries(sections)) {
    if (!observations.length) throw new TypeError(`Missing informative scenario: ${section}`)
  }

  return Object.entries(TRACK_PROFILES).map(([track, profile]) => {
    const sectionPreferenceIndices = {}
    for (const [section, observations] of Object.entries(sections)) {
      // Compare chosen support with the best possible support for the SAME
      // answered scenarios. Omitted scenarios do not add zero observations.
      const observed = observations.reduce((sum, { mapping, optionId }) => sum + support(profile, mapping.options[optionId]), 0)
      const attainable = observations.reduce((sum, { mapping }) => sum + Math.max(...Object.values(mapping.options).map((themes) => support(profile, themes))), 0)
      sectionPreferenceIndices[section] = 100 * observed / attainable
    }
    const scenarioPreferenceIndex = Object.entries(SECTION_WEIGHTS)
      .reduce((sum, [section, weight]) => sum + sectionPreferenceIndices[section] * weight, 0) / 100
    return { track, scenarioPreferenceIndex, sectionPreferenceIndices }
  })
}
