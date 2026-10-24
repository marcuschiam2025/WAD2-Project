# Admin panel — foundation

Branch: `feat/admin-catalogue`. This chunk provides protected staff access,
`/admin`, paginated change history, an audited transaction helper and revision
filters for subsequent catalogue editors. The module create/edit editor is now implemented (see below). Archive/restore and guarded deletion are also implemented. The section create/edit editor is also implemented. Section archive/restore is implemented too. Curriculum and bidding editors
remain pending. No existing academic data is migrated.

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

## Module editor — first editor chunk

- `/admin` now includes search (50 records per page), module creation and editing.
- Editable fields: title, CU, school/department, description, prerequisite and
  corequisite AND/OR groups, exclusions, track-course count rule, requisite notes,
  catalogue tags and known offering terms. Codes are immutable after creation.
- Staff review the complete form before confirming. Unknown module/school
  references, self-references, unexpected fields and stale revisions are rejected.
- Admin-only endpoints: `GET /api/admin/modules?q=&after=`,
  `GET /api/admin/modules/:code`, `POST /api/admin/modules` and
  `PUT /api/admin/modules/:code`. POST uses `code`; PUT requires `revision`.
  PUT is a complete replacement of editable fields, not a partial patch.
- Module writes and audit snapshots share one MongoDB transaction. Existing
  student plans and curriculum membership are not rewritten. Students reload
  the catalogue to receive changed details; open tabs do not yet auto-refresh.
- The destructive seed command refuses to run if academic staff audit entries
  exist, including on a remote database with `--remote`.
- Schedules, curriculum editors and bidding-round configuration remain
  subsequent chunks. Module lifecycle controls are described below.
- The demo admin has been provisioned; the user confirmed staff sign-in and
  module create/edit persistence worked. Unit tests do not establish transaction rollback on
  the shared Atlas database. No live academic records were changed for testing.

Latest automated verification: 85 backend tests passed, one integration test
skipped; all 13 frontend tests passed and the production build passed. The dedicated demo admin was subsequently provisioned through the audited CLI.


## Archive, restore and guarded deletion

- Admin UI actions use a separate confirmation panel and the loaded revision.
  Permanent deletion additionally requires typing the module code.
- `POST /api/admin/modules/:code/archive`, `POST .../:code/restore` and
  `DELETE /api/admin/modules/:code` require `{ revision }` and admin authorization.
- Archive hides modules from normal module search, new room creation and fresh
  quiz recommendations. Existing degree plans, curriculum checks, rooms and carts
  retain their records. Archive does not cancel class sections or invalidate an
  existing bid cart. Open student tabs must reload to receive catalogue changes.
- Whole-catalogue reads can use `includeArchived=true` so existing academic
  records retain their titles and requirement information. Individual detail
  reads remain available for archived modules. Checklist discovery excludes new
  archived candidates while retaining already-placed records.
- Delete requires an archived module with an admin `create` audit entry. Original
  seeded modules can only be archived. Known dependencies are checked in the
  mutation transaction: other requisites, curriculum requirements, sections,
  degree plans (including exchange mappings), carts, bid history, rooms, student
  profiles/baskets and stored quiz recommendation fields. Errors/timeouts abort
  deletion. Audit history is retained after deletion.
- Dependency queries describe the current application schema; MongoDB has no
  cross-collection foreign keys. Snapshot checks are not a global lock against
  concurrent student writes or external scripts. Original catalogue data should
  be archived rather than deleted; do not bypass the application with raw writes.
- Latest automated verification: 86 backend passed, one database integration test
  skipped; all 13 frontend tests and production build passed. Dependency queries
  were validated through read-only MongoDB calls. Live archive/restore/delete
  interactions remain for user review; no modules were changed by those checks.

## Sections and schedules — create/edit chunk

- `/admin` includes a section editor. Load by module code and academic term;
  create sections or edit existing ones. Module, term and section code are fixed
  after creation. New sections require an active catalogue module.
- Instructor, optional capacity, up to 14 weekly meetings (including weekends),
  venues, and an optional final exam date/time/venue are editable. Times are
  Singapore local time. Exam dates are stored at Singapore midnight.
- The service rejects invalid dates, reversed/invalid time ranges, overlapping
  weekly meetings within one section, unexpected fields and stale revisions.
  It does not validate instructor/venue availability across different sections.
- `GET /api/admin/sections?module=IS216&term=2026-27_T2`,
  `POST /api/admin/sections`, and
  `PUT /api/admin/sections/:term/:code/:section` are admin-only.
  Updates require the revision loaded by the editor.
- Native collection writes use validated shared timetable fields and the existing
  MongoDB transaction/audit helper. They bypass the incompatible legacy Section
  Mongoose write schema. The live collection already has a unique index on
  moduleCode/termKey/sectionCode. New records also use a deterministic canonical ID.
- Legacy rows are read through the existing adapter. On save, their MongoDB ID
  and any legacy public sectionId remain unchanged; exact shared meetings/exam
  fields are added. Existing saved ballots and cart links therefore retain IDs.
  Legacy exam text must be converted to structured exam details before saving.
- Existing student choices are not silently changed or cancelled. Students must
  refresh their timetable and review clashes; normal cart save validation uses
  current schedules. Open tabs do not receive a live push notification.
- Section archive/delete and bidding-round configuration remain separate chunks.
- Verification: 88 backend tests passed, one database integration test skipped;
  all 13 frontend tests and the production build passed. Read-only live checks
  confirmed the IS216 editor response and collection indexes. No shared timetable
  records were mutated for testing. User create/edit/reload review is pending.

## Section archive and restore

- The user confirmed section create/edit/reload worked; that reviewed chunk was
  pushed as `e0e911f` on `feat/admin-catalogue`.
- Admin section forms now expose archive/restore with a confirmation panel.
  Both actions require the loaded revision and share the audit transaction.
  Restoring requires the parent module to be active. No section hard-delete
  endpoint is exposed.
- `POST /api/admin/sections/:term/:code/:section/archive` and `.../restore`
  accept `{ revision }`. The record, timetable, section ID, votes and carts remain
  stored. Normal schedule edits preserve the archived flag.
- Active room voting, leader confirmation and room-to-bidding handoff exclude
  archived sections. Stored ballots are untouched; unavailable picks are shown
  in the existing warning. Restoring makes retained votes count again and can
  make a retained confirmation eligible again. Students should review decisions.
- Student bidding responses include archive flags so a saved archived selection
  remains visible. It is not silently replaced with another section. Archived
  alternatives cannot be newly selected. New cart saves and validation reject
  archived sections; students must switch or remove them. Saved comparison views
  retain the course and block calendar export until the cart is reviewed.
- Repository reads by saved IDs retain archived records for historical rendering;
  active discovery excludes them. Student tabs must reload to receive changes.
- Archive versus a simultaneous student save is not protected by a global
  cross-collection lock: an existing cart may remain saved and later become
  archived. Subsequent validation rejects it; no BOSS allocation is performed.
- Automated tests cover role/revision guards, restoration eligibility, retained
  section IDs, backend bid rejection, historical visibility and frontend swap/save
  behaviour. No live timetable records were archived or restored during testing.

## Existing track and curriculum editor (local review)

The Tracks & Curricula tab loads records for one existing major/intake. Staff can edit track names, descriptions and source metadata, and existing track `all`/`chooseN` requirements (module membership, course count and credit target). Backend writes validate ownership, known module references and revision, and share the audit transaction. Newly adding archived modules is blocked.

Core/major requirements and unsupported track rule types are read-only, enforced in the API as well as the form. The planner's core checklist still uses a fixed template; connect it to curriculum records before enabling core/major editing. Track course slots now derive from the rule's module count or choose-N value rather than its credit target.

This chunk does not create/delete tracks or rules, copy new intakes, change quiz scoring taxonomy, or configure bidding rounds. Existing plan placements are retained; students reload to receive updated requirements. Quiz track labels remain part of the fixed quiz rubric. Browser save/reload review remains pending; automated verification passed (92 backend tests, one skipped; 14 frontend tests; production build).

### Curriculum isolation prerequisite

The planner now selects track lists and module classifications using the active plan's persisted `majorId`. Loading a second curriculum no longer overwrites a first curriculum's same-named track. Complete requirement bundles are cached by curriculum for the upcoming core/major checklist integration. Unknown/unloaded curricula return no track rules rather than another intake's rules. The remaining static core checklist is unchanged. Verified with a two-intake regression, all 15 frontend tests and a production build.

## Live core/major checklist integration (current local review)

This supersedes the read-only limitation above. Plans with a loaded curriculum now build requirement rows from that curriculum's MongoDB definitions, including all/choose-N lists, tagged baskets, category electives and non-credit flags. The checklist reports requirements rather than pretending every credit target is a fixed number of courses. Course options use the same stored membership, tags and categories. Unknown/unloaded live curricula show an unavailable message instead of a completion claim. The static checklist remains only for plans without a live curriculum/offline sample mode.

Core/major edits are now enabled alongside track edits, with existing backend ownership, reference validation, revision and audit protection. The backend checker now requires listed-course coverage/choose-N counts in addition to CU. Students must reload after staff changes. Exemptions, manual internship/exposure completion, exchange exposure, and internship placements during LOA are retained in the local checklist. The server CU summary still has its existing separate handling of profile exemptions/manual completion; this change does not consolidate those engines or replace static course-progression advice shown elsewhere.

Verified: 93 backend tests passed, one integration test skipped; 18 frontend tests passed and production build passed. Read-only browser review confirmed MongoDB core records load into enabled fields; no curriculum data was changed during this chunk. Student planner browser review remains pending.

### Checklist presentation review

The live checklist heading is Degree Requirements. Incomplete requirements use neutral Partial/Incomplete badges instead of semester recommendations. The summary says still incomplete, and does not describe partially filled requirements as absent from the plan. Browser inspection confirmed the new heading, progress labels and removed recommendation legend. All 19 frontend tests and production build passed. The user requested pushing this chunk before the additional manual course-placement test.

## Active bidding-round editor (local review)

Bidding round tab configures one active term, round name and closing time. Terms come from existing section records; add sections before selecting a new term. Times are entered/reviewed explicitly in Singapore time and stored as UTC instants. Past closing times are allowed with a review notice. Staff-saved MongoDB settings take precedence over environment settings; without a staff record the original environment/catalogue fallback remains.

GET/PUT `/api/admin/bidding-round` require the existing admin guard. Writes validate the term, round label, calendar date and explicit timezone; use revision checks and the same audit transaction as the settings change. The singleton `_id` prevents multiple active records. GET `/api/bidding/round` reads these settings, so student reloads use the new round and section term. Existing carts retain their term identities. Dates remain a planning reference, not a BOSS submission gateway; saving personal plans is not blocked by the deadline.

This chunk does not introduce round-history CRUD, a new-term wizard, opening times or actual bid submission. Server-configured values remain until the first staff save; subsequent staff edits replace active settings. Admin users receive a review step and unsaved-change protection. No live round settings were written during development. Manual save/reload and student display review are pending.

Verification: 95 backend tests passed, one skipped; 20 frontend tests passed; production build passed. Coverage includes authorization, stale saves, transaction/audit wiring, term validation, date rollover rejection, saved-setting precedence, and Singapore time conversion.

### Active round review completed

The user confirmed admin save/reload persistence and the final test passed. A read-only live MongoDB/service check also confirmed the student round service returns the saved staff term, round and identical UTC closing instant. User approved pushing the chunk.
