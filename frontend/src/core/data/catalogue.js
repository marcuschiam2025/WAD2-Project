// The track list (codes match the backend: BA, SMCT, FT, PD) and lookups over the module catalogue,
// which is loaded into liveModules from GET /api/modules (see stores/catalogue.js).
import { reactive } from 'vue'

// code -> backend Module ({ _id, title, cu, categories, prerequisites, corequisites, ... }), empty while offline
export const liveModules = reactive({})

export const tracks = [
  {
    code: 'BA',
    name: 'Business Analytics',
    short: 'Business Analytics',
    blurb:
      'BA leans on statistics, visualisation and turning results into business recommendations.',
  },
  {
    code: 'SMCT',
    name: 'Smart-City Management & Technology',
    short: 'Smart-City',
    blurb: 'SMCT applies sensing, geospatial analytics and systems thinking to urban problems.',
  },
  {
    code: 'FT',
    name: 'Financial Technology',
    short: 'Fintech',
    blurb: 'FT applies software and analytics to payments, banking and financial services.',
  },
  {
    code: 'PD',
    name: 'Product Development',
    short: 'Product Development',
    blurb: 'PD centres on understanding users and shipping software products end to end.',
  },
]

export function moduleName(code) {
  return liveModules[code]?.title ?? code
}

// Tracks only an older curriculum has, so they stay out of the list above that new students choose from
const olderTrackNames = { DCS: 'Digitalisation & Cloud Solutions' }

export function trackName(code) {
  return tracks.find((t) => t.code === code)?.name ?? olderTrackNames[code] ?? code
}
