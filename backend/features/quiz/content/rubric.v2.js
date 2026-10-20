// Approved pilot assumptions, not empirically calibrated track predictions.
// This module is server-only. Never include it in the public question response.
export const RUBRIC_VERSION = 'v2-draft'

export const THEMES = ['DATA', 'BUILD', 'FINANCE', 'CIVIC', 'RELIABLE', 'PEOPLE']

export const SECTION_WEIGHTS = {
  interests: 30,
  strengths: 15,
  'working-style': 20,
  'career-goals': 35,
}

export const RATING_MAPPINGS = {
  I1: { theme: 'DATA', section: 'interests' },
  I3: { theme: 'BUILD', section: 'interests' },
  I5: { theme: 'CIVIC', section: 'interests' },
  S1: { theme: 'DATA', section: 'strengths' },
  S3: { theme: 'PEOPLE', section: 'strengths' },
  S5: { theme: 'RELIABLE', section: 'strengths' },
  W1: { theme: 'FINANCE', section: 'working-style' },
  W3: { theme: 'RELIABLE', section: 'working-style' },
  W5: { theme: 'PEOPLE', section: 'working-style' },
  C1: { theme: 'BUILD', section: 'career-goals' },
  C3: { theme: 'FINANCE', section: 'career-goals' },
  C5: { theme: 'CIVIC', section: 'career-goals' },
}

// Each option maps to [primary, supporting] theme. IDs stay fixed when the UI
// shuffles display positions; E is deliberately absent because it is unscored.
export const SCENARIO_MAPPINGS = {
  I2: { section: 'interests', options: { a: ['DATA', 'CIVIC'], b: ['BUILD', 'PEOPLE'], c: ['FINANCE', 'PEOPLE'], d: ['CIVIC', 'DATA'] } },
  I4: { section: 'interests', options: { a: ['DATA', 'RELIABLE'], b: ['BUILD', 'RELIABLE'], c: ['FINANCE', 'PEOPLE'], d: ['CIVIC', 'DATA'] } },
  S2: { section: 'strengths', options: { a: ['DATA', 'RELIABLE'], b: ['BUILD', 'RELIABLE'], c: ['FINANCE', 'RELIABLE'], d: ['CIVIC', 'PEOPLE'] } },
  S4: { section: 'strengths', options: { a: ['DATA', 'RELIABLE'], b: ['BUILD', 'RELIABLE'], c: ['FINANCE', 'RELIABLE'], d: ['CIVIC', 'PEOPLE'] } },
  W2: { section: 'working-style', options: { a: ['DATA', 'RELIABLE'], b: ['BUILD', 'PEOPLE'], c: ['FINANCE', 'RELIABLE'], d: ['CIVIC', 'PEOPLE'] } },
  W4: { section: 'working-style', options: { a: ['DATA', 'PEOPLE'], b: ['BUILD', 'RELIABLE'], c: ['FINANCE', 'RELIABLE'], d: ['CIVIC', 'PEOPLE'] } },
  C2: { section: 'career-goals', options: { a: ['DATA', 'PEOPLE'], b: ['BUILD', 'PEOPLE'], c: ['FINANCE', 'PEOPLE'], d: ['CIVIC', 'PEOPLE'] } },
  C4: { section: 'career-goals', options: { a: ['DATA', 'PEOPLE'], b: ['BUILD', 'RELIABLE'], c: ['FINANCE', 'RELIABLE'], d: ['CIVIC', 'DATA'] } },
}

export const SUPPORTING_THEME_WEIGHT = 0.25

// Keys also establish stable display order for equal scores, not a tiebreaker.
export const TRACK_PROFILES = {
  BA: { DATA: 45, BUILD: 10, FINANCE: 10, CIVIC: 10, RELIABLE: 10, PEOPLE: 15 },
  PD: { DATA: 10, BUILD: 40, FINANCE: 5, CIVIC: 5, RELIABLE: 20, PEOPLE: 20 },
  FT: { DATA: 15, BUILD: 15, FINANCE: 35, CIVIC: 0, RELIABLE: 25, PEOPLE: 10 },
  SMT: { DATA: 15, BUILD: 10, FINANCE: 0, CIVIC: 35, RELIABLE: 15, PEOPLE: 25 },
}
