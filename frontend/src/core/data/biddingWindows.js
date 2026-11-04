// Every BOSS bidding window of a term. Times are the instants the backend stores (UTC), shown in Singapore time.
// TODO(backend): replace with GET /api/bidding/windows. The data already exists server-side (the bidding_windows
// collection) but nothing serves it yet; /api/bidding/round only returns the round that is open now.
// `inferred` marks a window whose open and close times the school calendar does not list.
export const BIDDING_WINDOWS = [
  { term: '2026-27_T2', round: '1A', window: 1, opensAt: '2026-10-30T09:00:00Z', closesAt: '2026-11-02T02:00:00Z' },
  { term: '2026-27_T2', round: '1A', window: 2, opensAt: '2026-11-02T09:00:00Z', closesAt: '2026-11-04T02:00:00Z' },
  { term: '2026-27_T2', round: '1A', window: 3, opensAt: '2026-11-04T09:00:00Z', closesAt: '2026-11-06T02:00:00Z', inferred: true },
  { term: '2026-27_T2', round: '1B', window: 1, opensAt: '2026-11-06T09:00:00Z', closesAt: '2026-11-10T02:00:00Z' },
  { term: '2026-27_T2', round: '1B', window: 2, opensAt: '2026-11-10T09:00:00Z', closesAt: '2026-11-12T02:00:00Z' },
  { term: '2026-27_T2', round: '2', window: 1, opensAt: '2027-01-11T02:00:00Z', closesAt: '2027-01-13T02:00:00Z' },
  { term: '2026-27_T2', round: '2', window: 2, opensAt: '2027-01-13T09:00:00Z', closesAt: '2027-01-15T02:00:00Z' },
  { term: '2026-27_T2', round: '2', window: 3, opensAt: '2027-01-15T09:00:00Z', closesAt: '2027-01-18T02:00:00Z' },
  { term: '2026-27_T2', round: '2A', window: 1, opensAt: '2027-01-18T09:00:00Z', closesAt: '2027-01-20T02:00:00Z' },
  { term: '2026-27_T2', round: '2A', window: 2, opensAt: '2027-01-20T09:00:00Z', closesAt: '2027-01-22T02:00:00Z' },
  { term: '2026-27_T2', round: '2A', window: 3, opensAt: '2027-01-22T09:00:00Z', closesAt: '2027-01-25T02:00:00Z' },
]
