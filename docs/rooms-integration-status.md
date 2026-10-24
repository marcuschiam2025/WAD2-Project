# Collab Rooms — part 1

## Agreed scope

- Admin enters only party name and module code.
- Creator is the party admin; internally this uses the existing backend `owner` field.
- No What-If plan imports into rooms. The old plan-sharing route has been removed; historical imported-plan data is excluded from reads.

## Connected

- List rooms and members from `/api/parties`.
- Search the shared module catalogue when creating a party.
- Create a room, receive a server-generated invite code and join by code.
- Read existing six-character invite codes as well as older four-character codes.
- Refresh membership and leave through the backend.
- Show request failures; clear private state on account changes and discard late responses.
- Enforce join capacity in the MongoDB write, including concurrent-join safety and duplicate-membership prevention.

## Verification

- 67 backend tests pass; one existing disposable-replica-set test is skipped.
- All eight frontend tests pass; production build passes.
- Live browser creation: `IS216 Integration Check`, room `6adc890336f2a8429f85fd64`. Creator displays as party admin.
- Full refresh preserved the created room and admin membership. Joining by its invite code returned the same room with one member, without duplication.
- This check room is retained for review. No other student was added or messaged.

## Part 2 — section voting

- The room detail screen reads real module sections and vote counts through `GET /api/parties/:id/votes`.
- Every weekly meeting, venue and final exam is displayed. No sample alternatives or bid statistics are used.
- `PUT /api/parties/:id/votes` replaces the current member's ballot atomically, preserving other members' ballots. Saving no selections clears the vote.
- The first saved ballot pins the room's catalogue term. Later votes must belong to that term and module.
- Vote counts exclude people who are no longer members. Failed saves retain confirmed choices and show an error. Account changes discard stale responses.
- The visible screen polls results every 10 seconds, without overwriting unsaved edits.
- Browser verification in the retained integration-check room: saved IS216 G1, reloaded and confirmed the checkbox and count; cleared the test ballot and verified the count returned to zero. No section was accepted or added to bidding.
- Current verification: 68 backend tests pass, one existing replica-set test skipped; nine frontend tests pass; production build passes.

## Next chunk

Connect admin acceptance and the bidding handoff, then member-management controls. The old votes URL redirects to the room detail screen where voting now lives. A second real account is still needed for interactive multi-user verification; membership, term validation and exclusion of former members are covered by automated tests.

## Calendar restored

- Room detail voting now includes a weekly calendar backed by the same live
  section rows and saved ballots. The room layout is wider to fit the calendar.
- Every meeting of a section is shown, including weekend classes. Selecting any
  meeting toggles that section's single ballot ID across all its meetings.
- Exact meeting ranges form rows; alternatives stack in a cell instead of
  covering one another. The rows are not a proportional time scale.
- Vote counts and names remain visible; full section details and exams are
  available below the calendar. Saving, clearing, polling and reload behaviour
  use the existing backend integration.
- Verified: all 11 frontend tests and production build pass. Live signed-in
  browser review is pending; the current browser is on the sign-in page.
