# Persisted semester placement and bidding handoff

- Serialize plan autosaves, send immutable snapshots, and drain edits made during requests.
- Show plan saving/errors; retry a failed save without discarding edits.
- Before opening bidding, await plan and basket saves, then pass the selected plan ID in the URL.
- On the bidding page, use that plan ID (including after refreshing).
- Add a keyboard/touch semester selector to basket modules alongside drag and drop.
- Accept only sections returned by the backend as bidding choices. Empty results remove sample
  choices and show which planned modules have no section data for the selected term.

## Database finding

Read-only inspection of shared Atlas data on 24 October 2026 found seven section records using
`moduleCode`, `termKey`, `sectionCode`, `classSlots`, `finalExam`, etc. Existing bidding code
expects `module`, `term`, `sectionId`, `day`, `slot`. Records inspected use `2026-27_T1`,
while the existing API round defaults to `AY24/25 T2`. Some courses meet twice weekly for
90 minutes. No bid-history records exist in the expected `bidhistories` collection.
Do not rewrite these records into the older single-session model. A compatible data adapter,
term configuration and multi-session timetable/clash support are needed in the next slice.
This slice verifies the plan handoff and truthful unavailable-data state, not a completed bidding cart.

## Verified checkpoint

- Four frontend store tests pass, including ordered immutable plan writes, basket removal,
  reload restoration and exclusion of sample-only sections. Vite production build passes.
- In the signed-in browser, placed the previously saved IS444 in Y2S2 using the new
  semester selector. Refreshed: IS444 remained in Y2S2 and no longer appeared in the basket.
- Imported to bidding: URL retained that exact plan ID and the page showed Plan 1/Y2S2.
- No matching sections exist for IS444 in the configured old term, so the page reports
  unavailable data. The module remains saved in the user's plan for review.
- Remaining for the next slice: map the shared multi-session section schema, choose a
  configured round/term, remove the fabricated future countdown fallback, wire valid carts,
  validate plan ownership in cart endpoints, and verify real section selection/cart persistence.
