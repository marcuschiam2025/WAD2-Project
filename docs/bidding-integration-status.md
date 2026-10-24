# Bidding integration — 24 October 2026

## Implemented

- Shared MongoDB sections (`moduleCode`, `termKey`, `sectionCode`, `classSlots`, `finalExam`) and legacy sections are read through an adapter without rewriting source records.
- Shared section IDs include their term. Every weekly meeting is retained; cards and details show actual meeting times. Saturday and Sunday are supported.
- Class and structured exam clashes use exact overlapping intervals. Back-to-back classes are allowed.
- Cart reads/writes/deletes require ownership of the selected degree plan. Saves validate section/module/term, duplicate modules, numeric minimum bids, total balance and clashes.
- Frontend saves show success only after the request completes; edits made during saving require another save.
- With no bid history, the default is the minimum bid, not a fabricated recommendation.
- No countdown or future bidding schedule is fabricated. Configure `BIDDING_TERM`, `BIDDING_ROUND` and `BIDDING_ROUND_CLOSES_AT` in the backend environment when the official schedule is known. Otherwise the latest catalogue term is explicitly a preview.

## Verification

- Backend: 62 passing tests, one existing disposable-replica-set test skipped.
- Frontend: five passing store/integration tests; production build passes.
- Read-only live catalogue check: terms `2026-27_T2` and `2026-27_T1`; latest term contains IS216 G1.
- Browser: user's saved plan remains selected; missing IS444 section data is reported and no deadline is invented.

## Remaining

- IS444 is not offered in the currently available latest-term section records. A real saved-cart reload using that module cannot be verified until its actual sections exist. Automated tests cover cart payloads and save validation.
- The preview term is catalogue availability, not a claim that it matches the student's intended bidding semester. Set the official term before a real demonstration of that semester.
- Historical bids remain unavailable; no probability of allocation is claimed.
- Finalised plans, calendar export and collaboration-room integration still need their own implementation/verification pass. Calendar's old section lookup has not yet been migrated to the new canonical IDs.
- These changes are on the feature branch; they have not been merged to dev.
