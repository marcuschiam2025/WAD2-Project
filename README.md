# WAD2-Project — BidMaxxer

Collaborative track explorer, What-If degree planner and BOSS bidding simulator for SMU students.

- `frontend/` — Vue 3 + Vite, Tailwind CSS v4, Vue Router and Pinia. Built from the Figma file (`Screens` page).
- `backend/` — Node.js + Express 5 REST API with MongoDB (Mongoose) and Firebase Auth token verification.

## Getting started

```bash
# terminal 1 — API on http://localhost:4000/api
cd backend
pnpm install           # run this first after cloning; uses pnpm-lock.yaml for exact versions
cp .env.example .env   # fill in MONGODB_URI and the Firebase service account
pnpm dev

# terminal 2 — app on http://localhost:5173 (/api is proxied to the backend on :4000)
cd frontend
pnpm install           # run this first after cloning
cp .env.example .env.local # add the public Firebase Web app settings
pnpm dev               # pnpm build for a production build
```

Google sign-in is connected on `/signin`. Add the Firebase Web app settings to `frontend/.env.local`
(from Firebase Console → Project settings → Your apps), then restart Vite. The web API key,
auth domain and project ID are public app configuration; **never put the Admin private key or MongoDB URI in a frontend file**.
Add `localhost` to Firebase Authentication's authorized domains when testing locally.

The backend verifies each Firebase ID token and accepts SMU accounts. MongoDB stores the profile,
intake year, completed/exempted modules, semester history, balance and onboarding status.
New users start with `role: 'student'`; trusted maintainers assign `role: 'admin'` directly in MongoDB.
Clients cannot edit role or Firebase identity. API requests obtain a current ID token from the Firebase SDK.

`http://localhost:4000/test` remains a development-only auth diagnostic page. It is not served in production.

Quiz results and plans use the authenticated backend. Recommended modules can be added to the
student's shared planner basket; basket additions, removals and placement changes are saved to MongoDB
with visible save/retry states. Semester edits save in order; the import action waits
for saves and passes the selected plan ID to bidding. Only API-provided sections become bidding choices. Plans and private bidding caches clear on account changes;
late responses from the previous account are discarded. Rooms still require backend integration, and bidding still
contains sample catalogue/round fallbacks: those flows are not yet complete.

Verification:

```bash
cd backend
pnpm test
# In frontend/:
pnpm test
pnpm build
```

One backend quiz persistence test is opt-in and needs a disposable MongoDB replica set; see the quiz test documentation.
For a manual auth check: sign in, finish setup, refresh and verify the saved profile, then sign out and confirm protected routes return to sign-in.

## Folder structure

```
frontend/
├── vite.config.js         # @ and @core aliases, dev proxy to the API
├── jsconfig.json          # same aliases for the editor
└── src/
    ├── main.js / App.vue  # app shell; nav bar shows on routes with meta.layout = 'app'
    ├── style.css          # design tokens from Figma (@theme) + text styles
    ├── assets/            # logo + icons exported from Figma
    ├── components/
    │   ├── layout/        # AppNavBar, PageHeader, BrandLogo, BackButton
    │   ├── ui/            # BaseButton, BaseBadge, BaseModal, SelectField, ToggleSwitch, …
    │   ├── modals/        # prereq warning, plan limit, module detail, import plans, prereq ban
    │   ├── rooms/         # invite card, members card, slot picker
    │   └── ModuleChip, BasketModule, TimetableGrid, TimetableModuleCard, TrackMatchRow, RoomCard, BidSidebar
    ├── views/             # one file per screen
    └── core/              # imported as @core/...
        ├── router/        # Vue Router page routes + sign-in guard
        ├── stores/        # Pinia stores: user, quiz, planner, bidding, rooms
        ├── services/api.js  # fetch client for the API endpoints below
        ├── data/          # sample catalogue / quiz / bidding / room data
        └── utils/         # ics export + client-side copies of clash, scoring, requirement checks

backend/
├── server.js              # entry point: connects to MongoDB, starts the server
├── app.js                 # Express app: CORS, JSON, /api routes, error handling
├── config/                # db.js (Mongo connection), firebase.js (Firebase Admin)
├── middleware/            # auth.js (requireAuth, requireAdmin), errorHandler.js (shared by every feature)
├── test-page/             # TEMPORARY login test page served at /test
├── routes/index.js        # mounts every feature's routes under /api
└── features/              # one folder per feature: *.routes.js → *.controller.js → models/
    ├── auth/              # users routes/controller, User model (findOrCreate on first login, role)
    ├── planning/          # modules, tracks, majors, What-If plans (max 3) + utils/requirementChecker
    ├── quiz/              # Track Finder questions, attempts, recommendations + utils/trackScoring
    ├── bidding/           # BOSS sections, bid history, bid cart, cart clash check + utils/referenceBid, clash
    ├── parties/           # parties of classmates: members, invite code, slot votes and comments
    └── calendar/          # timetable export (Google for now; Microsoft/Outlook planned, not confirmed)
```

Note that `frontend/src/core/router/` is page navigation for the Vue app, while `backend/routes/` and `backend/features/*/*.routes.js` are the Express API.

## API endpoints (all under `/api`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/tracks`, `/tracks/:code` | public, `?intake=2023` |
| GET | `/modules`, `/modules/:code` | public, `?track=BA&category=track&q=` |
| GET | `/majors`, `/majors/:id` | public |
| GET / PATCH | `/users/me` | profile setup, completed modules, basket, consents |
| GET | `/users/admin-check` | admins only, for testing `requireAdmin` |
| GET | `/quiz/questions` | weights hidden from the client |
| POST | `/quiz/attempts` | `{ answers }` → scored % fit per track |
| GET | `/quiz/attempts`, `/quiz/attempts/:id/recommendations` | up to 3 modules for each of the top 2 tracks |
| GET / POST | `/plans` | max 3 plans → 409 |
| GET / PUT / DELETE | `/plans/:id` | |
| GET | `/plans/:id/check` | CU per requirement bucket + prereq/coreq warnings |
| GET / POST | `/parties` | create with `memberEmails`; invitees missing prereqs come back in `blocked` |
| POST | `/parties/join` | `{ inviteCode }`; 403 with `missing` prereqs |
| GET | `/parties/:id`, `/parties/:id/updates?since=` | `updates` returns 204 when nothing changed (short polling) |
| PUT / GET | `/parties/:id/votes` | slot votes for the party's module |
| POST | `/parties/:id/finalise`, `/parties/:id/ban` | owner only |
| POST | `/parties/:id/comments` | |
| DELETE | `/parties/:id/members/me` | leave party |
| GET | `/bidding/sections?module=`, `/bidding/history/:module?round=` | |
| GET | `/bidding/reference/:module?amount=&round=` | Safe / Competitive / At risk vs median ± 1 SD |
| GET / PUT | `/bidding/cart` | PUT returns any timetable `clashes` |
| POST | `/bidding/validate-cart` | `{ sectionIds }` → duplicate module, class time and exam clashes |
| GET | `/bidding/co-bids/:partyId` | which party members bid for which section |
| GET | `/bidding/plans?term=…` | Current user’s saved bid carts with section details and missing-data warnings |
| POST | `/calendar/export` | `{ accessToken, sectionIds, termStart, weeks }` → Google Calendar API v3; requires separate calendar permission |

### Legacy plan index repair

If an older Atlas database still has the unique `degreePlans.userId_1_slot_1` index,
creating plans can fail with `Duplicate value`: the current schema uses `user` and has no `slot`.
From `backend/`, inspect with `node --env-file=.env scripts/repair-plan-index.js`, then
apply with `node --env-file=.env scripts/repair-plan-index.js --apply`.
The repair removes only that exact obsolete index, preserves documents and current indexes,
and refuses to proceed if documents still contain the legacy fields. Run once per database;
it is safe to rerun. Do not use a blanket index synchronization against a shared database.

### Saved bidding plans and calendar downloads

The saved plans screen displays persisted bid carts for the catalogue term, not confirmed BOSS allocations. Calendar downloads use every weekly meeting and require the first teaching Monday and number of consecutive weeks. Recess weeks, holidays and exams are not added or removed automatically. The frontend downloads an `.ics` file; Firebase sign-in alone does not grant Google Calendar access.

### Collab Rooms — first integration chunk

Party creation asks only for party name and module code from the shared catalogue. The signed-in creator is the party admin (the existing backend `owner` field). Invitations use the server-issued code; existing codes remain supported. Rooms do not import What-If plans, and the former plan-sharing route is removed. Room listing, creation, joining, member refresh and leaving use `/api/parties`. Section voting now reads the shared catalogue, saves member ballots and refreshes results every 10 seconds. The first saved ballot fixes the room term. Admin acceptance and member-management controls are not connected yet.
