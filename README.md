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
npm install
npm run dev            # npm run build for a production build
```

For local work without Firebase, set `AUTH_DEV_BYPASS=true` in `backend/.env` and send an
`x-dev-uid: some.name.2024` header. The bypass is ignored when `NODE_ENV=production`.

The Pinia stores currently run on the sample data in `frontend/src/data`, so the UI works without the API.
Each store has `TODO(Backend n)` comments marking where to call `frontend/src/services/api.js` instead.

## Folder structure

```
frontend/
├── vite.config.js         # @ alias, dev proxy to the API
├── jsconfig.json          # same alias for the editor
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
    ├── router/            # Vue Router page routes + sign-in guard
    ├── stores/            # Pinia stores: user, quiz, planner, bidding, rooms
    ├── services/api.js    # fetch client for the API endpoints below
    ├── data/              # sample catalogue / quiz / bidding / room data
    └── utils/ics.js       # .ics export for the finalised timetable

backend/
├── server.js              # entry point: connects to MongoDB, starts the server
├── app.js                 # Express app: CORS, JSON, /api routes, error handling
├── config/                # db.js (Mongo connection), firebase.js (Firebase Admin)
├── middleware/            # errorHandler.js (shared by every feature)
├── routes/index.js        # mounts every feature's routes under /api
└── features/              # one folder per feature: *.routes.js → *.controller.js → models/
    ├── auth/              # Firebase sign-in: auth.middleware.js (verify ID token → req.user), users, User model
    ├── planning/          # modules, tracks, majors, What-If plans (max 3) + utils/requirementChecker
    ├── quiz/              # Track Finder questions, attempts, recommendations + utils/trackScoring
    ├── bidding/           # BOSS sections, bid history, bid cart, cart clash check + utils/referenceBid, clash
    ├── parties/           # parties of classmates: members, invite code, slot votes, shared plans, comments
    └── calendar/          # timetable export (Google for now; Microsoft/Outlook planned, not confirmed)
```

Note that `frontend/src/router/` is page navigation for the Vue app, while `backend/routes/` and `backend/features/*/*.routes.js` are the Express API.

## API endpoints (all under `/api`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/tracks`, `/tracks/:code` | public, `?intake=2023` |
| GET | `/modules`, `/modules/:code` | public, `?track=BA&category=track&q=` |
| GET | `/majors`, `/majors/:id` | public |
| GET / PATCH | `/users/me` | profile setup, completed modules, basket, consents |
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
| PUT | `/parties/:id/plans` | share What-If plans with the party |
| POST | `/parties/:id/comments` | |
| DELETE | `/parties/:id/members/me` | leave party |
| GET | `/bidding/sections?module=`, `/bidding/history/:module?round=` | |
| GET | `/bidding/reference/:module?amount=&round=` | Safe / Competitive / At risk vs median ± 1 SD |
| GET / PUT | `/bidding/cart` | PUT returns any timetable `clashes` |
| POST | `/bidding/validate-cart` | `{ sectionIds }` → duplicate module, class time and exam clashes |
| GET | `/bidding/co-bids/:partyId` | which party members bid for which section |
| POST | `/calendar/export` | `{ accessToken, sectionIds, termStart }` → Google Calendar API v3 |
