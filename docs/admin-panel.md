# Admin panel — foundation

Branch: `feat/admin-catalogue`. This chunk provides protected staff access,
`/admin`, paginated change history, an audited transaction helper and revision
filters for subsequent catalogue editors. Module/schedule/curriculum/bidding
editors are not implemented yet. No existing academic data is migrated.

## Provision the demo admin

Use a dedicated real Google account, not the shared Firebase project owner.
Do not put passwords or service-account keys in this document or Git.

1. Sign in once through the normal application's Google button using that account.
   Non-SMU sign-in will be rejected by the backend until provisioned, but Firebase
   Authentication registers the Google identity during the popup flow.
2. In the correct Firebase project's Authentication > Users, find that account
   and copy its UID. Confirm the identity uses Google and its email is verified.
3. With the existing backend `.env` configured, run from `backend/`:

   ```sh
   pnpm grant-admin --uid FIREBASE_UID --operator "Your name"
   ```

4. Sign in again. Staff land on `/admin` without student degree onboarding.

The command verifies the Firebase identity, writes `role: admin` against that
exact UID in MongoDB, and records a `grant-admin` audit entry in the same
transaction. It requires a transaction-capable MongoDB deployment (Atlas or a
replica set). It does not create Google accounts or accept passwords. No role
assignment endpoint is exposed. Normal non-SMU accounts remain blocked, and
profile updates cannot assign roles. The operator label is supplied by the
trusted CLI operator; it is not a separately authenticated staff identity.

## API

All routes require a valid Firebase token and the current MongoDB admin role:

- `GET /api/admin`: verify staff access.
- `GET /api/admin/audit?before=OBJECT_ID`: newest 25 audit summaries; `next` is
  the next cursor, or null. Full before/after snapshots remain stored but are
  not returned by the summary endpoint.

No audit editing or deletion API is provided.

## Contract for subsequent catalogue writes

- Whitelist editable fields in the feature controller; never spread request
  bodies into database updates or audit records.
- Call `auditedChange` with the authenticated `req.user`. All mutation reads and
  writes must use the supplied transaction session. Callbacks must be safe for
  MongoDB transaction retries. An audit failure must abort the mutation.
- For edits, require the revision the editor loaded, match `revisionFilter(id,
  revision)` in the write and increment revision atomically. Legacy records with
  no revision start at zero. An unmatched edit must return 409 and ask the user
  to reload; never automatically overwrite their colleague's changes.
- Add archive fields and dependency checks with the relevant editor chunk.
  This foundation does not yet change public catalogue filtering or schemas.
- Audit snapshots must contain only the relevant academic fields. Never include
  tokens, credentials or whole student profiles.
- Existing destructive catalogue seeding must not be used after staff editing
  begins; replace it or add an explicit protection gate in the catalogue chunk.

## Verification limits

Unit and local HTTP tests cover access denial, controlled provisioning checks,
audit-session propagation/error handling, history pagination and revision filter
semantics. They do not establish real Firebase sign-in or MongoDB rollback.
Those checks require the chosen demo identity and a transaction-capable test
MongoDB database. Do not provision an account or change the shared database just
to run a unit test.
