# Quiz recommendations to planner basket

## Scope

Add an explicit action on each recommended module in the top two quiz tracks.
Save selections to the existing authenticated `PATCH /api/users/me` basket field.
The basket belongs to the student and is shared across their three What-If plans;
adding a module does not place it in a semester or change a selected track.

## Implementation

- Planner owns a serial save queue for all basket changes (quiz, search, removal,
  clearing and placement back into or out of the basket).
- Snapshot writes occur in order; edits during a request cause a following write.
- Show saving/error states; retain local edits on failure and allow an explicit retry.
- Show "In planner basket" on results only after saves complete successfully.
- Restore the basket from the authenticated profile on load, without an unnecessary write.
- Ignore previous-account responses and clear pending state when identity changes.
- Keep profile/degree fields intact: basket saves update only the basket locally.

## Verification

Automated store test covers duplicate clicks, overlapping changes, failed save and
retry, stale responses after account switching, and restoration in a fresh Pinia app.
Manual check: complete quiz → add recommended module → open planner → refresh →
confirm same module in basket. The student completed their own quiz. Added IS444 through the recommendation button,
opened the planner and refreshed: IS444 and its shared-catalogue title remained
in the basket with no save error. Left that one module for review; no semester placement
or track change was performed. Frontend: three tests pass and the production build passes.
