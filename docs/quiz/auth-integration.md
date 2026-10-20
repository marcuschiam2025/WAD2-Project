# Quiz authentication integration check

20 October 2026.

## Verified

- The parent API router applies requireAuth before quiz routes.
- Production authentication verifies a Firebase ID token and resolves the database user by Firebase UID. Quiz writes, history and module exploration use req.user._id rather than a client-provided user ID.
- The frontend sign-in currently toggles a mock flag; Firebase client sign-in is not implemented. No Firebase browser SDK is installed. api.js has a setToken hook, but the sign-in flow does not call it.
- The local preview uses AUTH_DEV_BYPASS=true and defaults to one development identity. Changing the mock profile does not create a separate backend account.

## Session fix

Quiz state clears on sign-out or profile-email change. In-flight history/submission responses from a previous session are discarded. Sign-out also clears the API token. Existing tab-local drafts remain scoped to the profile email; this is a prototype draft key, not an authenticated account ID.

Verification: frontend session regression test passed; frontend production build passed; seven local MongoDB integration checks passed, including user isolation. These checks do not prove real Google sign-in works.

## Handoff to authentication feature

Use the group's existing Firebase project and configuration once confirmed. Implement Google sign-in and auth-state restoration, provide a fresh Firebase ID token for API requests, and clear user-specific state on identity changes. Prefer Firebase UID for the draft key once the real identity is available. Keep service-account private keys on the backend only.

Before shared deployment, disable AUTH_DEV_BYPASS and test with two real student accounts: each sees only its own latest two attempts, cannot access another account's module suggestions by attempt ID, and cannot retrieve protected data after sign-out. Verify expired-token refresh and page reload as part of that flow.

Run the frontend regression test from frontend:

```sh
node --test tests/quiz-session.test.mjs
```
