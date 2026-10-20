const themeNames = {
  DATA: 'evidence and data', BUILD: 'building and iteration', FINANCE: 'financial systems',
  CIVIC: 'civic and environmental impact', RELIABLE: 'reliability and risk', PEOPLE: 'people and stakeholders',
}
const trackNames = { BA: 'Business Analytics', PD: 'Product Development', FT: 'Financial Technology', SMT: 'Smart-City Management & Technology' }

// A curated exploration shortlist, not an enrolment or prerequisite checker.
// Theme tags are editorial and explainable; no LLM or external inference call.
export function recommendExplorationModules(attempt, catalogue, { completedModules = [], intakeYear } = {}) {
  const base = {
    catalogueVersion: catalogue.catalogueVersion,
    retrievedAt: catalogue.retrievedAt,
    intakeFrom: catalogue.intakeFrom,
    intakeStatus: Number.isInteger(intakeYear) ? intakeYear < catalogue.intakeFrom ? 'unsupported' : 'within-guide' : 'unconfirmed',
    eligibilityStatus: 'unverified',
    sourceUrl: catalogue.sourceUrl,
  }
  if (base.intakeStatus === 'unsupported') return { ...base, groups: [] }
  const completed = new Set(completedModules.map((code) => code.trim().toUpperCase()))
  const themes = attempt.resultSnapshot?.themeRatings ?? {}
  const groups = attempt.results.slice(0, 2).map(({ track }) => {
    const candidates = catalogue.modules.filter((module) => module.tracks.includes(track) && !completed.has(module.code))
    const ranked = candidates.map((module, order) => {
      const observed = module.themeTags.map((theme) => ({ theme, index: themes[theme]?.index }))
        .filter(({ index }) => Number.isFinite(index))
      const relevance = observed.length ? observed.reduce((sum, { index }) => sum + index, 0) / observed.length : null
      const strongest = [...observed].sort((a, b) => b.index - a.index)[0]
      return {
        module, order, relevance,
        reason: strongest?.index >= 75
          ? `Connects with your ${themeNames[strongest.theme]} ratings.`
          : `Listed in SMU’s ${trackNames[track]} track.`,
      }
    }).sort((a, b) => (b.relevance ?? -1) - (a.relevance ?? -1) || a.order - b.order)
    return {
      track,
      modules: ranked.slice(0, 3).map(({ module, reason }) => ({
        code: module.code, name: module.name, summary: module.summary, tracks: module.tracks,
        sourceUrl: module.sourceUrl, reason,
        prerequisiteStatus: 'unverified', offeringStatus: 'unverified',
      })),
    }
  })
  return { ...base, groups }
}
