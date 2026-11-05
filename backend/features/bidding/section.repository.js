import Section from './models/Section.js';
import BiddingSettings from './models/BiddingSettings.js';
import BiddingWindow from './models/BiddingWindow.js';
import { canonicalTerm, termLabel, normalizeSection } from './utils/sectionData.js';

// Native reads retain fields from both catalogue schemas. This adapter never rewrites records.
export async function availableTerms(session) {
  const [old, shared] = await Promise.all([
    Section.collection.distinct('term', {}, { session }),
    Section.collection.distinct('termKey', {}, { session }),
  ]);
  return [...new Set([...old, ...shared].filter(Boolean).map(canonicalTerm))].sort().reverse();
}
export async function loadSections({ term, modules, ids, includeArchived = !!ids } = {}) {
  const and = [];
  if (!includeArchived) and.push({ archived: { $ne: true } });
  if (term) {
    const key = canonicalTerm(term);
    and.push({ $or: [{ term: key }, { term: termLabel(key) }, { termKey: key }] });
  }
  if (modules?.length) and.push({ $or: [{ module: { $in: modules } }, { moduleCode: { $in: modules } }] });
  if (ids) {
    const shared = ids
      .filter((id) => id.includes(':'))
      .map((id) => {
        const [termKey, moduleCode, sectionCode, ...rest] = id.split(':');
        if (rest.length || !sectionCode) throw new Error('Invalid section ID');
        return { termKey, moduleCode, sectionCode };
      });
    and.push({ $or: [{ sectionId: { $in: ids } }, ...shared] });
  }
  const rows = await Section.collection.find(and.length ? { $and: and } : {}).toArray();
  return rows
    .map(normalizeSection)
    .sort((a, b) => a.module.localeCompare(b.module) || a.section.localeCompare(b.section));
}
export async function roundSettings(
  env = process.env,
  readSettings = () => BiddingSettings.findById('active').lean(),
) {
  const [terms, saved] = await Promise.all([availableTerms(), readSettings()]);
  const now = new Date();

  // 1. Admin override, but only while it hasn't closed yet
  if (saved && new Date(saved.closesAt) > now) {
    return {
      term: saved.term,
      round: saved.round,
      closesAt: new Date(saved.closesAt).toISOString(),
      availableTerms: terms,
      configured: true,
      source: 'staff',
    };
  }

  // 2. Official schedule: the window open now, otherwise the next one
  let window = await BiddingWindow.findCurrent(now);
  if (!window) {
    window = await BiddingWindow.findNext(now);
  }
  if (window) {
    return {
      term: canonicalTerm(window.term),
      round: window.round,
      window: window.window,
      opensAt: window.opensAt.toISOString(),
      closesAt: window.closesAt.toISOString(),
      isOpen: window.opensAt <= now, // false = the next window, not open yet
      availableTerms: terms,
      configured: true,
      source: 'schedule',
    };
  }

  // 3. Environment variables / catalogue (unchanged)
  const term = env.BIDDING_TERM ? canonicalTerm(env.BIDDING_TERM) : (terms[0] ?? null);
  const closesAt = env.BIDDING_ROUND_CLOSES_AT ? new Date(env.BIDDING_ROUND_CLOSES_AT) : null;
  if (closesAt && !Number.isFinite(closesAt.getTime())) throw new Error('Invalid BIDDING_ROUND_CLOSES_AT');
  return {
    term,
    round: env.BIDDING_ROUND || null,
    closesAt: closesAt?.toISOString() ?? null,
    availableTerms: terms,
    configured: !!env.BIDDING_TERM,
    source: env.BIDDING_TERM ? 'configured' : 'catalogue',
  };
}
