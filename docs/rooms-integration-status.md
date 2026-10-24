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

## Next chunk

Connect voting, shared-section reads, member updates and accepted sections. The old local voting/admin controls are not exposed in the connected UI. The old votes route temporarily redirects to the room detail screen. Joining with a second real account still needs an interactive multi-user check.
