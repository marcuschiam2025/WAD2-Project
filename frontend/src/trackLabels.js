// Compact track names used in plan tabs ("Plan 1 · BA + Smart-City"), matching the V2 designs.
// TODO(backend): drop this once the track catalogue carries its own tab label.
import { tracks } from '@core/data/catalogue';

const tags = { BA: 'BA', SMCT: 'Smart-City', FT: 'Fintech', PD: 'Product Dev', DCS: 'Digital & Cloud' };

export const trackTag = (code) => tags[code] ?? tracks.find((t) => t.code === code)?.short ?? code;

// A plan with no track yet is just its name, with no trailing separator
export const planLabel = (plan) =>
  plan.tracks?.length ? `${plan.name} · ${plan.tracks.map(trackTag).join(' + ')}` : plan.name;
