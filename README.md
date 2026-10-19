# WAD2-Project — BidMaxxer

Collaborative track explorer, What-If degree planner and BOSS bidding simulator for SMU students.

- `frontend/` — Vue 3 + Vite, Tailwind CSS v4, Vue Router and Pinia. Built from the Figma file (`Screens` page).
- `backend/` — Node.js + Express 5 REST API with MongoDB (Mongoose) and Firebase Auth token verification.
  It also holds the router, stores, API client and sample data that the frontend imports (see [Folder structure](#folder-structure)).

## Getting started

```bash
# terminal 1 — API on http://localhost:4000/api
cd backend
npm install
cp .env.example .env   # fill in MONGODB_URI and the Firebase service account
npm run seed           # loads seed/data/*.json (tracks, modules, quiz, sections, bid history)
npm run dev

# terminal 2 — app on http://localhost:5173 (/api is proxied to the backend on :4000)
cd frontend
npm install
npm run dev            # npm run build for a production build
```

For local work without Firebase, set `AUTH_DEV_BYPASS=true` in `backend/.env` and send an
`x-dev-uid: some.name.2024` header. The bypass is ignored when `NODE_ENV=production`.

The Pinia stores currently run on the sample data in `backend/data`, so the UI works without the API.
Each store has `TODO(Backend n)` comments marking where to call `backend/services/api.js` instead.

## Folder structure

```
frontend/
├── vite.config.js         # @ and @backend aliases, dev proxy, access to ../backend
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
    └── views/             # one file per screen

backend/
├── server.js              # Express app: CORS, JSON, /api routes, error handling
├── config/                # db.js (Mongo connection), firebase.js (Firebase Admin)
├── middleware/            # auth.js (verify ID token → req.user), errorHandler.js
├── models/                # Mongoose schemas
│   ├── User.js            # profile, completed modules, basket, consents
│   ├── Track.js           # track requirements per intake
│   ├── Module.js          # catalogue: prereqs, coreqs, category, tags
│   ├── QuizQuestion.js    # Track Finder questions with per-answer track weights
│   ├── QuizAttempt.js     # scored attempts (latest 2 kept)
│   ├── Plan.js            # What-If plans (max 3 per student)
│   ├── Room.js            # plan rooms: members, invite code, votes, comments
│   ├── Section.js         # BOSS class sections (day + session slot)
│   ├── BidHistory.js      # historical median / min bids per term and round
│   └── BidCart.js         # a student's bids for a term (min e$ 10)
├── routes/                # one API router per feature, mounted in routes/index.js
├── utils/                 # pure logic, unit-testable: trackScoring, requirementChecker, referenceBid, clash
├── seed/                  # seed.js + data/*.json
│
│   # Browser code used by the Vue frontend (imported as @backend/... — not run by Express)
├── router/                # Vue Router page routes + sign-in guard
├── stores/                # Pinia stores: user, quiz, planner, bidding, rooms
├── services/api.js        # fetch client for the API endpoints below
├── data/                  # sample catalogue / quiz / bidding / room data
└── utils/ics.js           # .ics export for the finalised timetable
```

### How the frontend imports from `backend/`

Frontend code imports the browser files in `backend/` with the `@backend` alias, e.g.
`import { useUserStore } from '@backend/stores/user'`. `frontend/vite.config.js` sets up the alias,
lets the dev server read `../backend`, and dedupes `vue`, `vue-router` and `pinia` so those files use
`frontend/node_modules`. Run `npm install` in `frontend/` even if you only edit those files.

Note that `backend/router/` is page navigation for the Vue app, while `backend/routes/` is the Express API.

## API endpoints (all under `/api`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/tracks`, `/tracks/:code` | public, `?intake=2023` |
| GET | `/modules`, `/modules/:code` | public, `?track=BA&category=track&q=` |
| GET / PATCH | `/users/me` | profile setup, completed modules, basket, consents |
| GET | `/quiz/questions` | weights hidden from the client |
| POST | `/quiz/attempts` | `{ answers }` → scored % fit per track |
| GET | `/quiz/attempts`, `/quiz/attempts/:id/recommendations` | up to 3 modules for each of the top 2 tracks |
| GET / POST | `/plans` | max 3 plans → 409 |
| GET / PUT / DELETE | `/plans/:id` | |
| GET | `/plans/:id/check` | CU per requirement bucket + prereq/coreq warnings |
| GET / POST | `/rooms` | create with `memberEmails`; invitees missing prereqs come back in `blocked` |
| POST | `/rooms/join` | `{ inviteCode }`; 403 with `missing` prereqs |
| GET | `/rooms/:id`, `/rooms/:id/updates?since=` | `updates` returns 204 when nothing changed (short polling) |
| PUT / GET | `/rooms/:id/votes` | slot votes for the room's module |
| POST | `/rooms/:id/finalise`, `/rooms/:id/ban` | owner only |
| PUT | `/rooms/:id/plans` | share What-If plans with the room |
| POST | `/rooms/:id/comments` | |
| DELETE | `/rooms/:id/members/me` | leave room |
| GET | `/bidding/sections?module=`, `/bidding/history/:module?round=` | |
| GET | `/bidding/reference/:module?amount=&round=` | Safe / Competitive / At risk vs median ± 1 SD |
| GET / PUT | `/bidding/cart` | PUT returns any timetable `clashes` |
| GET | `/bidding/co-bids/:roomId` | which room members bid for which section |
| POST | `/calendar/export` | `{ accessToken, sectionIds, termStart }` → Google Calendar API v3 |
