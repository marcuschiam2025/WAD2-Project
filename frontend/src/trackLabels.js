// Compact track names used in plan tabs ("Plan 1 · BA + Smart-City"), matching the V2 designs.
// TODO(backend): drop this once the track catalogue carries its own tab label.
import { tracks } from '@core/data/catalogue'

const tags = { BA: 'BA', SMCT: 'Smart-City', FT: 'Fintech', PD: 'Product Dev' }

export const trackTag = (code) => tags[code] ?? tracks.find((t) => t.code === code)?.short ?? code

export const planLabel = (plan) => `${plan.name} · ${plan.tracks.map(trackTag).join(' + ')}`
