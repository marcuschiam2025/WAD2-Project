# WAD2-Project: BidMaxxer

Collaborative track explorer, What-If degree planner and BOSS bidding simulator for SMU students.
Developed for **SMU IS216: Web Application Development II (AY2026/2027 T1, Section G2, Team bidmaxxer)**.

BidMaxxer is a web application designed to assist SMU students with academic planning and course bidding.
It provides tools for exploring potential specializations, planning degree pathways, and coordinating course selections with peers, particularly during the BOSS bidding periods.

The application serves as a unified platform where students can:

- Discover suitable academic tracks aligned with their interests and aptitudes via the **Track Finder Quiz**.
- Plan their degree progression with the **What-If Planner**, creating and comparing multiple graduation scenarios side by side.
- Coordinate course selections with peers through **Collaborative Plan Rooms**, enabling group decision-making and section alignment.
- Prepare strategically for course bidding using the **BOSS Bidding Planner** (active for the upcoming semester while bidding is ongoing), which allows them to:
  - Plan upcoming semester timetables with dynamic updates from a simulated BOSS API (seeded with real AY2026/27 Term 2 data to circumvent proprietary API constraints).
  - Detect schedule clashes automatically, receiving real-time warnings for conflicting lesson times and examination slots.
  - Simulate bidding rounds using the **Reference Bid Simulator** to estimate the required e$ budget needed to secure desired modules based on historical bid benchmarks.
- Finalize their academic schedules through a **Calendar Export** directly to Google Calendar or downloading `.ics` files.

### Team Members & Roles
| Name | Email ID | Role | Key Responsibilities |
| --- | --- | --- | --- |
| **Vignesh Sundararaj** | `vignesh.s.2024` | Frontend 1 & Project Coordinator | Design system & Figma tokens, app shell layout & navigation, landing page, sign-in & onboarding, Track Finder quiz flow & results view, stand-ups & project tracking. |
| **Ng Min Xie** | `minxie.ng.2025` | Frontend 2 (Planner & Plan Rooms) | Multi-track What-If planner (term grid, drag-and-drop, LOA/Exchange terms, CU progress bars), side-by-side plan compare, collaborative plan room interfaces & comments. |
| **Ong Jun Hong** | `junhong.ong.2025` | Frontend 3 (Bidding Simulator) | Section picker, weekly timetable grid with clash detection, bid cart with e$ budget bar, Safe/Competitive/At-Risk badges, co-bidding view & Google Calendar export UI. |
| **Marcus Chiam Hao Yi** | `marcuschiam.2025` | Backend 1 (Catalogue, Quiz & AI) | Catalogue schemas & seed pipelines, quiz scoring algorithm, module recommender, Gemini LLM track explanation service (`services/gemini.js`), unit tests. |
| **Noah Gan** | `noah.gan.2025` | Backend 2 (Auth, Plans & Rooms) | Firebase Auth token verification, user profile API, What-If plans CRUD, degree requirement & prerequisite checker engine, collaborative plan rooms & notification system. |
| **Chew Kuo Kai Regen** | `regen.chew.2025` | Backend 3 (Bidding API, Deployment) | BOSS bidding API, section timetable clash checking, reference bid algorithm (median ± 1 SD), Google Calendar export, Vercel deployment & database configuration. |

---

## Tech Stack Overview

- **Frontend**: Vue 3 (`<script setup>`) + Vite, Tailwind CSS v4, Pinia (state management), Vue Router 4, Motion animations, Chart.js.
- **Backend**: Node.js (v24) + Express 5 REST API, MongoDB Atlas via Mongoose 8, Firebase Admin SDK for auth token verification, Google Gemini REST API.
- **Testing**: Node.js built-in test runner (`node --test`) for backend & frontend unit/integration tests; Playwright for end-to-end browser tests.
- **Deployment**: Vercel Serverless Functions (`vercel.json`, `backend/vercel.js`).

---

## Service Architecture & Interactions

![Service Architecture & Data Interactions](docs/assets/service-interactions.svg)


---

## Business Flow: Happy Path

![Business Flow: Happy Path](docs/assets/happy-path-flow.svg)

---

## Installation & Setup Guide

### Prerequisites
- **Node.js**: `v24.x` (both `backend/` and `frontend/` declare `"engines": { "node": "24.x" }`; check with `node -v`).
- **pnpm**: `v12.x` (the root `package.json` pins `pnpm@12.16.1`) installed globally:
  ```bash
  npm install -g pnpm
  ```
  > [!TIP]
  > **Windows PowerShell Users**: If running `pnpm` results in `pnpm.ps1 cannot be loaded because running scripts is disabled on this system`, either:
  > 1. Run commands with `pnpm.cmd` (e.g. `pnpm.cmd install`, `pnpm.cmd dev`), OR
  > 2. Open PowerShell as Administrator and run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

---

### Step 1: Backend Installation & Setup

1. **Navigate to the backend directory and install dependencies**:
   ```bash
   cd backend
   pnpm install
   ```

2. **Configure backend environment variables**:
   Create `backend/.env` with the following:
   ```env
   PORT=4000
   MONGODB_URI=mongodb://127.0.0.1:27017/bidmaxxer
   CLIENT_ORIGIN=http://localhost:5173

   # Firebase Admin Service Account (Firebase Console → Project settings → Service accounts → Generate new private key)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

   # Optional official bidding schedule. Leave blank to preview the latest catalogue term.
   # Term format: 2026-27_T1. The closing time must include a timezone.
   BIDDING_TERM=
   BIDDING_ROUND=
   BIDDING_ROUND_CLOSES_AT=

   # Google Gemini API Key (Google AI Studio → Create API Key)
   GEMINI_API_KEY=AIzaSy...
   # Optional: override the default Gemini model (gemini-3.8-flash)
   # GEMINI_MODEL=
   ```
   `CLIENT_ORIGIN` accepts a comma-separated list of allowed frontend origins.

3. **Seed the database**:
   Populate MongoDB with the course catalogue, degree requirements, tracks, class sections, and historical bid outcomes:
   ```bash
   pnpm seed
   ```

4. **(Optional) Provision an Admin User**:
   To test the staff admin portal at `/admin`:
   ```bash
   pnpm grant-admin --uid <YOUR_FIREBASE_USER_UID> --operator "Your Name"
   ```

5. **Start the backend development server**:
   ```bash
   pnpm dev
   ```
   *The API will start at `http://localhost:4000/api` with hot-reloading (`node --watch`).*

---

### Step 2: Frontend Installation & Setup

1. **Navigate to the frontend directory and install dependencies**:
   ```bash
   cd ../frontend
   pnpm install
   ```

2. **Configure frontend environment variables**:
   Create `frontend/.env.local` with your public Firebase Web settings:
   ```env
   # From Firebase Console → Project settings → General → Your apps (Web app)
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   # Optional; development uses the Vite /api proxy
   # VITE_API_URL=http://localhost:4000/api
   ```
   > [!IMPORTANT]
   > In the **Firebase Console → Authentication → Settings → Authorized Domains**, ensure `localhost` is listed.

3. **Start the frontend development server**:
   ```bash
   pnpm dev
   ```
   *The application will open on `http://localhost:5173`. Requests to `/api/*` are automatically proxied to the backend on `:4000` via Vite.*

---

### Step 3: Running Tests & Verification

```bash
# 1. Run Backend Unit & Integration Tests (28 *.test.js files, co-located with the code they test)
cd backend
pnpm test

# 2. Run Frontend Store, Component & Utility Tests (60 test files in frontend/tests)
cd ../frontend
pnpm test
pnpm build

# 3. Run End-to-End Playwright Tests (from project root). Playwright is configured; tests/example.spec.js is still Playwright's
#    sample spec, so replace it with specs for the app's main user journeys
cd ..
pnpm install                      # installs @playwright/test from the root package.json
pnpm exec playwright install      # first run only: downloads the browser binaries
pnpm exec playwright test
```

---

## Project Folder Structure

Click each section below to toggle and inspect the detailed file tree:

<details open>
<summary><b>Project Root & Monorepo Configuration</b></summary>

```
WAD2-Project/
├── .gitignore                    # Git ignore file for node_modules, .env, and build artifacts
├── .vercelignore                 # Excludes test runners and local data from Vercel deployments
├── package.json                  # Root monorepo workspace file with Playwright test dependencies
├── playwright.config.js          # Playwright E2E browser test configuration
├── pnpm-lock.yaml                # Monorepo unified dependency lockfile
├── vercel.json                   # Vercel serverless deployment routing & rewrites
└── README.md                     # Comprehensive project documentation
```
</details>

<details>
<summary><b>docs/: Architecture, Status & Specifications</b></summary>

```
docs/
└── assets/                       # Visual architecture & workflow SVG diagram assets
    ├── service-interactions.svg  # Rendered service architecture & data interactions diagram
    └── happy-path-flow.svg       # Rendered business happy path flow diagram
```
</details>

<details open>
<summary><b>backend/: Node.js + Express 5 REST API</b></summary>

```
backend/
├── server.js                     # Server entry point: connects to MongoDB Atlas and starts HTTP server
├── app.js                        # Express app: CORS, JSON parsing, logging, router mounting & error handling
├── vercel.js                     # Serverless adapter for Vercel production hosting
├── package.json                  # Backend dependencies, engine constraints & pnpm scripts
├── patches/                      # pnpm dependency patch (jwks-rsa@4.1.0)
│
├── config/                       # Infrastructure configuration
│   ├── db.js                     # Mongoose connection helper (reads MONGODB_URI)
│   └── firebase.js               # Firebase Admin SDK initialization & token verifier
│
├── middleware/                   # Shared Express middleware
│   ├── auth.js                   # Wires requireAuth to Firebase Admin + User model; re-exports requireAdmin
│   ├── admin.js                  # Admin guard (requireAdmin) verifying staff privileges
│   ├── authentication.js         # requireAuth factory: Bearer token check, @smu.edu.sg / provisioned staff gate, user upsert
│   └── errorHandler.js           # Centralized HTTP error handler & uniform JSON error formatting
│
├── routes/
│   └── index.js                  # Root API router: mounts all feature sub-routers under /api
│
├── services/                     # External service integrations
│   └── gemini.js                 # Google Gemini API client for AI track explanation generation
│
├── data/                         # Seed datasets for SMU curriculum & BOSS bidding
│   ├── schools.json              # SMU schools metadata
│   ├── majors.json               # Information Systems & related majors
│   ├── tracks.json               # Track definitions (BA, CS, FT, SC, etc.)
│   ├── requirements.json         # Degree graduation requirements per intake year
│   ├── modules.json              # Course catalogue with prerequisites, corequisites & CU values
│   ├── sections.json             # Class sections, venues, instructors & meeting schedules
│   ├── bidding_windows.json      # BOSS bidding round windows & dates
│   ├── bidhistories.json         # Historical bid statistics by module and round
│   └── sectionbidresults.json    # Detailed section-level past bid outcome distribution
│
├── scripts/                      # Administrative and ETL CLI tools
│   ├── seed.js                   # Master database seeder for fresh deployments
│   ├── build-catalogue.js        # Compiles raw curriculum records into database seed format
│   ├── build-sections.js         # Generates section timetable fixtures
│   ├── build-bid-history.js      # Calculates historical median, mean, and SD from raw bid logs
│   ├── import-exams.js           # Ingests official exam schedules from Excel/CSV tables
│   ├── grant-admin.js            # CLI utility to safely grant admin privileges to a user UID
│   ├── repair-plan-index.js      # Database migration for legacy plan compound index schemas
│   ├── add-is-ay2023.cjs         # Adds the IS AY2023 curriculum to an existing database (dry run by default)
│   ├── migrations/               # Schema migration helpers
│   └── utils/                    # CSV / HTML table parsers & exam import helpers
│
└── features/                     # Modular, domain-driven feature vertical slices
    ├── auth/                     # User authentication & profile management
    │   ├── users.routes.js       # Routes for /api/users
    │   ├── users.controller.js   # Profile retrieval, onboard data updates & admin checks
    │   ├── models/User.js        # Mongoose schema for user accounts, roles & degree settings
    │   └── utils/profile.js      # Profile validation & completed course helper utilities
    │
    ├── planning/                 # Degree planning & What-If graduation roadmap
    │   ├── plans.routes.js       # Routes for /api/plans
    │   ├── plans.controller.js   # Plan CRUD (limit 3) & requirement validation check
    │   ├── modules.routes.js     # Public /api/modules catalogue endpoints
    │   ├── modules.controller.js
    │   ├── majors.routes.js      # Public /api/majors endpoints
    │   ├── majors.controller.js
    │   ├── models/               # Mongoose schemas: Plan, Module, Track, Major, Requirement
    │   └── utils/                # Prerequisite/corequisite engine (requirementChecker.js, requisites.js)
    │
    ├── quiz/                     # Track Finder quiz & scoring engine
    │   ├── quiz.routes.js        # Routes for /api/quiz/v2
    │   ├── quiz.v2.controller.js # v2 quiz question listing & submission evaluation
    │   ├── quiz.v2.recommendations.js # Generates recommended starter module baskets
    │   ├── quiz.v2.explanation.js # LLM explanation generator powered by Gemini
    │   ├── quiz.v2.storage.js    # Transactional submission persistence & history pruning
    │   ├── content/              # Rubric (rubric.v2.js), 20-question inventory (questions.v2-draft.json) & module list
    │   ├── models/               # QuizAttempt, QuizSubmission, QuizHistoryLock
    │   └── utils/                # Scoring math, track weightings, scenario analysis & explanations
    │
    ├── bidding/                  # BOSS bidding simulator & timetable clash engine
    │   ├── bidding.routes.js     # Routes for /api/bidding
    │   ├── bidding.controller.js # Section search, cart persistence, round info & validation
    │   ├── section.repository.js # Section query & filtering abstraction
    │   ├── models/               # BidCart, Section, BidHistory, SectionBidResult, BiddingWindow, BiddingSettings
    │   └── utils/                # Clash detection, reference bid, past-result matching, cart validation, weightage
    │
    ├── parties/                  # Collaborative plan rooms (social bidding & planning)
    │   ├── parties.routes.js     # Routes for /api/parties
    │   ├── parties.controller.js # Room creation, invite codes, voting, section picks, locking & short-polling
    │   ├── parties.middleware.js # Room member/owner/unlocked authorization guards
    │   ├── models/Party.js       # Mongoose schema for collaborative rooms, members & ballots
    │   └── utils/                # Vote decision summary, member eligibility & bidding cart handoff
    │
    ├── calendar/                 # Academic timetable calendar export
    │   ├── calendar.routes.js    # Routes for /api/calendar
    │   └── calendar.controller.js# Google Calendar API v3 event generation
    │
    ├── notifications/            # User notification alerts (Week 12 update)
    │   ├── notifications.routes.js # Routes for /api/notifications
    │   ├── notifications.controller.js # Unread count, listing & mark-as-read actions
    │   └── model/notification.js # Notification Mongoose schema
    │
    └── admin/                    # Staff admin portal & catalogue maintenance
        ├── admin.routes.js       # Routes for /api/admin
        ├── *.controller.js       # HTTP handlers: curricula, modules, sections, rounds
        ├── *.service.js          # Validation & persistence for curricula, modules, sections, rounds
        ├── module-lifecycle.js   # Module archive / restore / safe-delete rules
        ├── changes.js            # auditedChange: runs a write and its audit entry in one transaction
        ├── audit.service.js      # Transaction-bound audit logger for data mutations
        ├── bootstrap.js          # grantAdmin logic used by scripts/grant-admin.js
        └── models/AuditEntry.js  # Audit log Mongoose schema
```
Backend tests (`*.test.js`) live next to the files they cover and are picked up by `node --test`.
</details>

<details open>
<summary><b>frontend/: Vue 3 + Tailwind CSS Client</b></summary>

```
frontend/
├── index.html                    # HTML entry document
├── vite.config.js                # Vite bundler configuration (@ and @core aliases, dev API proxy)
├── jsconfig.json                 # IDE path mapping aliases
├── package.json                  # Frontend scripts & dependencies
│
├── public/                       # Static browser assets (favicon.svg)
│
├── src/                          # Vue 3 application source code
│   ├── main.js                   # Application bootstrap (mounts Pinia, Vue Router)
│   ├── App.vue                   # Root application shell & layout router-view
│   ├── style.css                 # Global Tailwind CSS v4 design tokens, theme & fonts
│   ├── motion.js                 # Motion animation presets
│   ├── semesterTones.js          # Color tokens for semester chips
│   ├── trackLabels.js            # Track code to human-readable label resolver
│   │
│   ├── assets/                   # Exported Figma vector icons & illustrations
│   │   ├── bidmaxxer_logo.png    # Brand logo
│   │   ├── figma/                # Navigation, action & state icons
│   │   ├── v2/                   # Updated design system icons
│   │   └── exploring/ jumping/ pointingUp/ sitting/ swinging/ thinking/  # Mascot pose illustrations
│   │
│   ├── views/                    # Top-level screen views (mapped to Vue Router routes)
│   │   ├── LandingView.vue       # Public hero landing page
│   │   ├── SignInView.vue        # Google authentication screen
│   │   ├── OnboardingView.vue    # Student profile setup (school, degree, intake, completed CUs)
│   │   ├── DashboardView.vue     # Student dashboard (current term schedule, alerts, quick links)
│   │   ├── QuizView.vue          # Track Finder introduction & quiz history
│   │   ├── QuizAttemptView.vue   # Interactive 20-question quiz with progress bar & save/resume
│   │   ├── QuizResultsView.vue   # Quiz results (percentage fit, recommended starter baskets, AI explanation)
│   │   ├── PlannerView.vue       # Multi-track What-If planner (8-semester grid, drag-and-drop, CU checklist)
│   │   ├── BiddingView.vue       # BOSS bidding simulator (section picker, timetable grid, bid cart)
│   │   ├── FinalisedPlansView.vue# Saved bidding plans & timetable exports
│   │   ├── RoomsView.vue         # Collaborative plan rooms directory & join modal
│   │   ├── RoomCreateView.vue    # Create new plan room with shared target module
│   │   ├── RoomDetailView.vue    # Live room dashboard (members, section voting, co-bidding timetable)
│   │   ├── ProfileView.vue       # Student profile details, completed modules & credit balance
│   │   ├── SettingsView.vue      # Account preferences, Google Calendar connection & data controls
│   │   └── AdminView.vue         # Staff portal: module, section, round & curriculum management
│   │
│   ├── components/               # Reusable Vue components
│   │   ├── AssistantFace.vue     # AI assistant mascot face whose eyes follow the cursor
│   │   ├── BidSidebar.vue        # Bidding cart panel with e$ allocation & budget progress
│   │   ├── DegreeChecklist.vue   # Live graduation requirement progress breakdown
│   │   ├── DegreeChecklistRow.vue# Individual requirement bucket progress row
│   │   ├── DegreeForm.vue        # Degree details form used in onboarding & profile
│   │   ├── ExamSchedule.vue      # Final exam schedule table with clash warning badges
│   │   ├── JumpingTeam.vue       # Decorative group of five friends, each jumping on hover (Collab Rooms)
│   │   ├── ModuleSearchBox.vue   # Searchable module autocomplete input
│   │   ├── QuizAssistant.vue     # Read-only AI explanation drawer / docked panel on quiz results
│   │   ├── SemesterChip.vue      # Semester indicator chip with status badge
│   │   ├── TimetableGrid.vue     # 5-day / 6-day weekly class timetable visual grid
│   │   ├── TimetableModuleCard.vue # Interactive section card inside timetable slots
│   │   ├── TodoList.vue          # Student personal to-do list widget
│   │   ├── TrackScoreChart.vue   # Chart.js radar / bar visualization of track fit %
│   │   │
│   │   ├── admin/                # Staff administrative management components
│   │   │   ├── CurriculumEditor.vue # Edit degree requirements & track module lists
│   │   │   ├── ModuleEditor.vue     # Create, edit, archive & restore catalogue modules
│   │   │   ├── RoundEditor.vue      # Configure BOSS bidding round dates & windows
│   │   │   └── SectionEditor.vue    # Manage sections, class times, instructors & exam slots
│   │   │
│   │   ├── layout/               # Structural layout components
│   │   │   ├── AppNavBar.vue     # Authenticated top navigation bar with unread alerts
│   │   │   ├── BackButton.vue    # Contextual back navigation button
│   │   │   ├── BrandLogo.vue     # BidMaxxer vector branding logo
│   │   │   └── PageHeader.vue    # Standardized page title header with actions slot
│   │   │
│   │   ├── modals/               # Modal dialogs & notification drawers
│   │   │   ├── AlertModal.vue    # Generic alert confirmation dialog
│   │   │   ├── BidLimitModal.vue # Too many modules in the bid cart; choose one to remove
│   │   │   ├── DeletePlanModal.vue # Confirm deletion of What-If degree plan
│   │   │   ├── NoticeRow.vue     # Prerequisite warning item row
│   │   │   ├── PlanLimitModal.vue# Maximum 3 plans limit warning dialog
│   │   │   ├── PlanSettingsModal.vue # Configure track selection (Track 1 / Track 2) for a plan
│   │   │   ├── PrereqWarningModal.vue # Prerequisite & corequisite violation explanation modal
│   │   │   ├── SemesterFullModal.vue # Semester course unit overload warning modal
│   │   │   └── TermNotOfferedModal.vue # A one-term module dropped in the other term; offers the next semester that has it
│   │   │
│   │   ├── rooms/                # Collaborative plan room components
│   │   │   ├── RoomBidHistory.vue   # Historical bid outcomes for the room's module
│   │   │   ├── RoomBidSimulator.vue # Room-level co-bidding coordination view
│   │   │   ├── RoomMembers.vue      # Room member list with owner/admin indicators
│   │   │   ├── RoomResults.vue      # Aggregated voting outcome & consensus section
│   │   │   ├── RoomSectionCalendar.vue # Visual timetable overlay of friends' chosen sections
│   │   │   └── RoomVotingPanel.vue  # Section preference voting ballot
│   │   │
│   │   └── ui/                   # Design-system primitive components
│   │       ├── BaseButton.vue    # Button with variants (primary, secondary, danger, ghost)
│   │       ├── BaseModal.vue     # Accessible backdrop modal container
│   │       ├── SelectField.vue   # Form select dropdown field
│   │       ├── SelectMenu.vue    # Custom floating selection menu
│   │       ├── StatusPill.vue    # Status pill badge (Safe, Competitive, At-Risk)
│   │       ├── ToggleSwitch.vue  # Accessible boolean toggle switch
│   │       └── UserAvatar.vue    # Student avatar circle with initials/photo
│   │
│   └── core/                     # Shared core business logic (aliased as @core/*)
│       ├── data/                 # Client fallback data & default constants
│       │   ├── bidding.js        # Bidding round sample models & fallbacks
│       │   ├── biddingWindows.js # Every BOSS bidding window of the term (shown in Singapore time)
│       │   ├── catalogue.js      # Curated module & track seed fallbacks
│       │   └── degree.js         # Default SMU degree requirement buckets
│       │
│       ├── router/               # Routing configuration
│       │   ├── index.js          # Route definitions & navigation guards
│       │   └── access.js         # Role & onboarding access gatekeeper
│       │
│       ├── services/             # API & authentication clients
│       │   ├── api.js            # Central fetch client with token refresh & error handling
│       │   └── firebase.js       # Firebase client SDK initialization & auth helpers
│       │
│       ├── stores/               # Pinia reactive state stores
│       │   ├── user.js           # User session, profile, completed CUs & role
│       │   ├── quiz.js           # Track Finder questions, answers & results state
│       │   ├── planner.js        # What-If degree plans, term grids & basket state
│       │   ├── bidding.js        # BOSS bidding cart, section filters & budget state
│       │   ├── rooms.js          # Plan rooms state, polling sync & member ballots
│       │   ├── todos.js          # User personal to-do tasks state
│       │   ├── catalogue.js      # Cached modules, tracks & requirements catalogue
│       │   ├── calendarExport.js # Google Calendar export flow state
│       │   └── theme.js          # Light / dark theme preference
│       │
│       └── utils/                # Client computation utilities
│           ├── biddingWindows.js # Bidding window open / closed / upcoming status
│           ├── clash.js          # Timetable slot & exam overlap calculation
│           ├── curriculumChecklist.js # Graduation requirement audit calculations
│           ├── curriculumLayout.js    # Degree checklist layout categorizer
│           ├── dashboardSchedule.js   # Dashboard timetable event organizer
│           ├── degreeChecklist.js     # Credit count & exemption evaluator
│           ├── balance.js        # Parses and validates the e$ balance a student types
│           ├── ics.js            # iCalendar (.ics) format file generator
│           ├── money.js          # Currency & e$ bid formatting helpers
│           ├── roomBoard.js      # Collaborative room consensus algorithms
│           ├── roomCalendar.js   # Room member timetable overlay builder
│           ├── roomEligibility.js # Which sections a room member can still vote for
│           ├── roomInvite.js     # Shareable /rooms?join=CODE invite links
│           └── roundTime.js      # Bidding round deadline & countdown formatter
│
└── tests/                        # Frontend unit & integration test suites (60 test files)
    ├── academic-warnings.test.mjs
    ├── admin-access.test.mjs
    ├── api-unreachable.test.mjs
    ├── archived-sections.test.mjs
    ├── auth.test.mjs
    ├── basket.test.mjs
    ├── bid-estimates.test.mjs
    ├── bid-input.test.mjs
    ├── bid-total-display.test.mjs
    ├── bidding-budget.test.mjs
    ├── bidding-cart-loading.test.mjs
    ├── bidding-limit.test.mjs
    ├── bidding-live.test.mjs
    ├── bidding-round-status.test.mjs
    ├── bidding-windows.test.mjs
    ├── calendar-export-session.test.mjs
    ├── calendar-token.test.mjs
    ├── calendar.test.mjs
    ├── credit-balance.test.mjs
    ├── curriculum-checklist.test.mjs
    ├── curriculum-coverage.test.mjs
    ├── curriculum-layout.test.mjs
    ├── curriculum-scope.test.mjs
    ├── curriculum-tracks.test.mjs
    ├── dashboard-schedule.test.mjs
    ├── exam-uncertainty.test.mjs
    ├── intake-curriculum.test.mjs
    ├── navbar-notifications.test.mjs
    ├── notification-read.test.mjs
    ├── plan-curriculum-recovery.test.mjs
    ├── plan-management.test.mjs
    ├── plan-profile-merge.test.mjs
    ├── plan-settings-track.test.mjs
    ├── planner-handoff.test.mjs
    ├── planner-loa.test.mjs
    ├── profile-loa.test.mjs
    ├── quiz-history-score.test.mjs
    ├── quiz-load-retry.test.mjs
    ├── quiz-required-answers.test.mjs
    ├── quiz-session.test.mjs
    ├── room-auto-bidding.test.mjs
    ├── room-bidding.test.mjs
    ├── room-calendar.test.mjs
    ├── room-invite.test.mjs
    ├── room-management.test.mjs
    ├── room-owner-leave.test.mjs
    ├── room-votes.test.mjs
    ├── rooms-live.test.mjs
    ├── round-time.test.mjs
    ├── settings.test.mjs
    ├── todos.test.mjs
    └── unavailable-sections.test.mjs
```
</details>

<details>
<summary><b>tests/ & playwright/: End-to-End Testing</b></summary>

```
WAD2-Project/
├── playwright/
│   └── .auth/user.json           # Cached authentication state for automated runs (git-ignored, created locally)
└── tests/
    └── example.spec.js           # Playwright's sample spec: a placeholder to replace with the app's end-to-end specs
```
</details>

---

## API Endpoints Reference (all mounted under `/api`)

All endpoints except `/health` and the public catalogue routes require a valid Firebase ID token in the `Authorization: Bearer <token>` header.

### 1. Health & Public Catalogue
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Service health probe (`{ ok: true }`). |
| `GET` | `/modules` | Public | Search catalogue (`?track=BA&category=track&q=...`). |
| `GET` | `/modules/:code` | Public | Get module details, prerequisites & corequisites. |
| `GET` | `/majors` | Public | List SMU majors. |
| `GET` | `/majors/:id` | Public | Get major curriculum structure. |
| `GET` | `/majors/:id/requirements` | Public | Get the major's core & major rules, plus each track with its own rules. |

### 2. User Profile & Onboarding
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/users/me` | Student | Get authenticated user profile, completed modules & planner basket. |
| `PATCH` | `/users/me` | Student | Update profile, completed/exempted CUs, degree, and planner basket. |

### 3. Track Finder Quiz & AI Explainer
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/quiz/v2/questions` | Student | List 20-question v2 Track Finder quiz (weights hidden). |
| `POST` | `/quiz/v2/attempts` | Student | Submit v2 quiz attempt → calculated percentile fit per track. |
| `GET` | `/quiz/v2/attempts` | Student | Retrieve user's v2 quiz attempt history. |
| `GET` | `/quiz/v2/attempts/:id/recommendations` | Student | Top-2 track starter baskets filtered by met prerequisites. |
| `GET` | `/quiz/v2/attempts/:id/explanation` | Student | Generates plain-language "Why this track" AI explanation via Google Gemini API. |

### 4. What-If Degree Planner
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/plans` | Student | List all degree plans belonging to user (max 3 plans). |
| `POST` | `/plans` | Student | Create a new degree plan (enforces 3-plan limit; returns 409 if exceeded). |
| `PUT` | `/plans/:id` | Student | Update semester terms, courses, tracks, or LOA/Exchange status. |
| `DELETE` | `/plans/:id` | Student | Delete a degree plan. |
| `GET` | `/plans/:id/check` | Student | Audit plan against graduation requirements (CU counts, prerequisites, corequisites). |

### 5. BOSS Bidding Simulator
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/bidding/sections` | Student | Get available class sections for a module (`?module=IS216&term=...`). |
| `GET` | `/bidding/round` | Student | Retrieve active BOSS bidding round configuration & window deadlines. |
| `GET` | `/bidding/windows` | Student | List every bidding window of the term (round, window number, opening and closing times). |
| `GET` | `/bidding/history/:module` | Student | Past 3 terms of historical bid results (`?round=1A`). |
| `GET` | `/bidding/reference/:module` | Student | Reference bid estimate based on past median ± 1 SD (Safe, Competitive, At-Risk). |
| `GET` | `/bidding/reference-bid` | Student | Reference bid for a specific section (`?sectionId=...`). |
| `GET` | `/bidding/weightage/:module` | Student | Course bidding weightage indicators. |
| `GET` | `/bidding/plans` | Student | Saved bidding carts for the current catalogue term (`?term=...`). |
| `GET` | `/bidding/cart` | Student | Fetch current user's active bid cart and allocated e$ credits. |
| `PUT` | `/bidding/cart` | Student | Save bid cart allocations; returns any detected timetable clashes. |
| `DELETE` | `/bidding/cart/:code` | Student | Remove a module from the active bid cart. |
| `GET` | `/bidding/co-bids/:partyId` | Student | Aggregated view of which room members are bidding for which sections. |

### 6. Collaborative Plan Rooms (Parties)
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/parties` | Student | List plan rooms the authenticated student belongs to. |
| `POST` | `/parties` | Student | Create a collaborative plan room for a target module. |
| `POST` | `/parties/join` | Student | Join an existing room using an invite code (`{ inviteCode }`). |
| `GET` | `/parties/:id` | Member | Get room details, module info, member list & consensus status. |
| `DELETE` | `/parties/:id` | Owner | Delete plan room (owner only). |
| `DELETE` | `/parties/:id/members/me` | Member | Leave a plan room. |
| `PUT` | `/parties/:id/owner` | Owner | Hand the party-admin role to another member (`{ userId }`). |
| `POST` | `/parties/:id/ban` | Owner | Remove/ban a member from the room (owner only). |
| `DELETE` | `/parties/:id/ban/:userId` | Owner | Lift a ban so the user can rejoin with the invite code (no frontend UI yet). |
| `PUT` | `/parties/:id/votes` | Member | Submit section preference votes for the room's module. |
| `DELETE` | `/parties/:id/votes` | Member | Clear section votes. |
| `PUT` | `/parties/:id/my-section` | Member | Confirm personal section commitment for co-bidding coordination. |
| `DELETE` | `/parties/:id/my-section` | Member | Clear personal section commitment. |
| `GET` | `/parties/:id/sections` | Member | Get summary of all member section votes and confirmed selections. |
| `POST` | `/parties/:id/lock` | Owner | Lock the room on a section `{ sectionId }` once everyone has voted. |
| `DELETE` | `/parties/:id/lock` | Owner | Unlock the room so votes and sections can change again. |

### 7. Timetable Calendar Export
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/calendar/export` | Student | Export final class timetable directly to Google Calendar API v3 using OAuth token. |

### 8. Notifications
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/notifications` | Student | List user notifications, 20 per page (`?before=<id>` cursor). |
| `PATCH` | `/notifications/read-all` | Student | Mark all notifications as read. |
| `PATCH` | `/notifications/:id/read` | Student | Mark a specific notification as read. |

### 9. Staff Admin Portal
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/admin` | Admin | Verify staff permissions and return operator identity. |
| `GET` | `/admin/audit` | Admin | Paginated audit trail log (`?before=OBJECT_ID`). |
| `GET` | `/admin/modules` | Admin | List all modules including archived records. |
| `POST` | `/admin/modules` | Admin | Create a new module (audited transaction). |
| `GET` | `/admin/modules/:code` | Admin | Get complete module metadata and prerequisite groups. |
| `PUT` | `/admin/modules/:code` | Admin | Update module details with revision checking. |
| `POST` | `/admin/modules/:code/archive` | Admin | Archive module (soft delete). |
| `POST` | `/admin/modules/:code/restore` | Admin | Restore archived module. |
| `DELETE` | `/admin/modules/:code` | Admin | Permanently delete module if not referenced. |
| `GET` | `/admin/sections` | Admin | List sections with meeting times and exam schedules. |
| `POST` | `/admin/sections` | Admin | Create class section with instructor and schedule slots. |
| `PUT` | `/admin/sections/:term/:code/:section` | Admin | Update section details and final exam times. |
| `POST` | `/admin/sections/:term/:code/:section/archive` | Admin | Archive section. |
| `POST` | `/admin/sections/:term/:code/:section/restore` | Admin | Restore section. |
| `GET` | `/admin/curricula` | Admin | List degree tracks and requirement sets. |
| `GET` | `/admin/curricula/:id` | Admin | Get specific curriculum structure. |
| `PUT` | `/admin/curricula/:id/tracks/:record` | Admin | Update track configuration and allowed electives. |
| `PUT` | `/admin/curricula/:id/requirements/:record` | Admin | Update graduation requirement rules and credit caps. |
| `GET` | `/admin/bidding-round` | Admin | Get current active bidding round and deadlines. |
| `PUT` | `/admin/bidding-round` | Admin | Update bidding round window dates and active status. |


---

## Operational Procedures & Administration

### Provisioning an Admin User
Admin privileges are granted strictly via the secure CLI tool:
```bash
cd backend
pnpm grant-admin --uid <FIREBASE_USER_UID> --operator "Staff Name"
```
The target must be an enabled, verified Google account already registered in Firebase Authentication.
The script sets `role: 'admin'` on the user in MongoDB and records an entry in the transaction audit log.

### Legacy Plan Index Repair
If an older Atlas database still has the legacy unique index `userId_1_slot_1` on the `degreePlans` collection:
```bash
cd backend
# Dry run inspection
node --env-file=.env scripts/repair-plan-index.js
# Apply index migration
node --env-file=.env scripts/repair-plan-index.js --apply
```

### Final Exam Ingestion
Import semester final exam schedules into section records:
```bash
cd backend
pnpm import-exams <exam-schedule.xls> --dry-run   # preview only, writes nothing
pnpm import-exams <exam-schedule.xls>             # local MongoDB
pnpm import-exams <exam-schedule.xls> --remote    # required when MONGODB_URI is not a local database
```
Several files can be passed at once. Staff-entered exams are never overwritten.
Exams with an explicit end time are stored with `finalExam.endVerified: true`.
Exams without a confirmed end time are treated as unconfirmed: clash detection then only flags them against exams on the same date with the same start time.
