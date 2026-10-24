# Authentication integration implementation plan

Goal: reuse the existing Firebase backend and connect real Vue sign-in and persisted student profiles.
Architecture: Firebase browser auth owns identity; API fetch obtains fresh ID tokens through an injected provider. MongoDB owns student profile/roles. Restore identity before route guards; do not trust the old local mock sign-in flag. Use existing feature branch/check-out as agreed with the user.

- [ ] Configure ignored local environment files from the supplied file; never print or commit secrets.
- [ ] Add Firebase web SDK and an auth adapter with observer/popup/sign-out operations.
- [ ] Test profile normalization and completed/exempted-module derivation before implementation.
- [ ] Extend backend profile schema/update validation to persist the existing degree form, intake, semester, balance, exemptions and completion flags. Preserve admin protection.
- [ ] Replace mock user store, restore before navigation and obtain current tokens for requests.
- [ ] Make degree form save asynchronously with errors; connect sign-in/sign-out UI.
- [ ] Reset private stores on session changes and guard pending requests.
- [ ] Verify unit/model/API tests and frontend build. Start configured local backend and check health/test page; real interactive Google login requires the student to choose their account.
- [ ] Document integration limits and save a checkpoint on the feature branch; do not merge unverified auth into dev.

Next slices: persistent recommendation basket/planner handoff; planner correctness/comparison; shared rooms; finalisation/Calendar; repeatable end-to-end testing and submission readiness.

## Checkpoint

- Merged `origin/backend` into `feat/auth-integration` (merge `284278e`).
- Configured ignored local backend/frontend environment files; installed Firebase browser SDK.
- Connected real Google sign-in, initial identity restoration, current ID tokens, async profile saves and sign-out.
- Added persisted intake/semester/exemption/balance/onboarding fields and server-side completed-module derivation.
- Cleared private planner, bidding and room state on account changes; guarded late plan/cart/profile responses.
- Replaced initial fictional plans/room memberships with empty account state. Plan screens wait for actual backend data.
- Actual MongoDB/Firebase startup succeeded; health returned 200 and unauthenticated profile returned 401.
- User completed Google sign-in; browser reached `/onboarding` on 24 October 2026.
- Latest verification: 52 backend tests pass, one opt-in replica-set test skipped; two frontend tests pass; Vite build passes.
- Still awaiting the user's real onboarding save/refresh check. No claim yet that the full project is complete.
- Rooms are not wired to `/parties` yet. Bidding still uses some sample catalogue/round data. Basket writes and quiz-to-basket action are next.

### First real setup verification and repair

The user's setup save succeeded, but first-plan creation failed with MongoDB 11000.
Atlas retained the obsolete unique index `degreePlans.userId_1_slot_1`, while the
current model uses `user` and no `slot`. Both missing legacy values collided with
an existing plan. Read-only inspection confirmed zero documents containing either
legacy field. Added a guarded, dry-run-by-default migration and three regression
tests, then applied the targeted index removal. No plan documents were removed.
Retried the dashboard successfully and refreshed it: identity, profile balance,
module progress and the saved plan restored. Latest backend suite: 55 pass, 1 skip.
