# WAD2-Project — BidMaxxer

Collaborative track explorer, What-If degree planner and BOSS bidding simulator for SMU students.
Developed for **SMU IS216 — Web Application Development II (AY2025/2026 T1, Section G2, Team bidmaxxer)**.

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
- **Node.js**: `v20.x` or `v24.x` LTS recommended (`node -v`).
- **pnpm**: `v10.x` or `v12.x` installed globally:
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
   ```bash
   cp .env.example .env
   ```
   Open `backend/.env` and configure the following:
   ```env
   PORT=4000
   MONGODB_URI=mongodb://127.0.0.1:27017/bidmaxxer
   CLIENT_ORIGIN=http://localhost:5173

   # Firebase Admin Service Account (Firebase Console → Project settings → Service accounts → Generate new private key)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

   # Firebase Web API Key (Firebase Console → Project settings → General → Web API Key)
   FIREBASE_WEB_API_KEY=AIzaSy...

   # Google Gemini API Key (Google AI Studio → Create API Key)
   GEMINI_API_KEY=AIzaSy...
   ```

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
   ```bash
   cp .env.example .env.local
   ```
   Open `frontend/.env.local` and configure your public Firebase Web settings:
   ```env
   # From Firebase Console → Project settings → General → Your apps (Web app)
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
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
# 1. Run Backend Unit & Integration Tests
cd backend
pnpm test

# 2. Run Frontend Store, Component & Utility Tests (66 test suites)
cd ../frontend
pnpm test
pnpm build

# 3. Run End-to-End Playwright Tests (from project root)
cd ..
pnpm exec playwright test
```

---

## Project Folder Structure

Click each section below to toggle and inspect the detailed file tree:

<details open>
<summary><b>📁 Project Root & Monorepo Configuration</b></summary>

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
<summary><b>📁 docs/ — Architecture, Status & Specifications</b></summary>

```
docs/
├── assets/                       # Visual architecture & workflow SVG diagram assets
│   ├── service-interactions.svg  # Rendered service architecture & data interactions diagram
│   └── happy-path-flow.svg       # Rendered business happy path flow diagram
├── admin-panel.md                # Staff admin panel contract, audit trail & permissions
├── bidding-integration-status.md # BOSS bidding backend & timetable integration specs
├── rooms-integration-status.md   # Collaborative plan rooms protocol & ballot syncing
├── vercel-deployment.md          # Production deployment guidelines for Vercel + MongoDB Atlas
├── quiz/                         # Track Finder scoring design, API contracts & rubrics
│   ├── api-contract.md
│   ├── auth-integration.md
│   ├── browser-preview.md
│   ├── database-verification.md
│   ├── module-sources.md
│   ├── question-review.md
│   ├── scoring-review.md
│   └── scoring-revision.md
└── superpowers/plans/            # Historical feature implementation design plans
    ├── 2026-10-24-auth-integration.md
    ├── 2026-10-24-planner-bidding-handoff.md
    └── 2026-10-24-quiz-planner-basket.md
```
</details>

<details open>
<summary><b>📁 backend/ — Node.js + Express 5 REST API</b></summary>

```
backend/
├── server.js                     # Server entry point: connects to MongoDB Atlas and starts HTTP server
├── app.js                        # Express app: CORS, JSON parsing, logging, router mounting & error handling
├── vercel.js                     # Serverless adapter for Vercel production hosting
├── package.json                  # Backend dependencies, engine constraints & npm scripts
│
├── config/                       # Infrastructure configuration
│   ├── db.js                     # Mongoose connection manager with reconnect & replica set support
│   └── firebase.js               # Firebase Admin SDK initialization & token verifier
│
├── middleware/                   # Shared Express middleware
│   ├── auth.js                   # Firebase token verification (requireAuth) & student role check
│   ├── admin.js                  # Admin guard (requireAdmin) verifying staff privileges
│   ├── authentication.js         # Low-level JWT bearer token extraction
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
│   └── migrations/               # Schema migration helpers
│
├── test-page/                    # Development auth diagnostic interface
│   ├── index.html                # Static diagnostic client UI
│   └── testPage.routes.js        # Routes serving /test in non-production environments
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
    │   ├── tracks.routes.js      # Public /api/tracks endpoints
    │   ├── tracks.controller.js
    │   ├── majors.routes.js      # Public /api/majors endpoints
    │   ├── majors.controller.js
    │   ├── models/               # Mongoose schemas: Plan, Module, Track, Major, Requirement
    │   └── utils/                # Prerequisite/corequisite engine (requirementChecker.js, requisites.js)
    │
    ├── quiz/                     # Track Finder quiz & scoring engine
    │   ├── quiz.routes.js        # Routes for /api/quiz (v1 and v2)
    │   ├── quiz.controller.js    # v1 quiz endpoints
    │   ├── quiz.v2.controller.js # v2 quiz question listing & submission evaluation
    │   ├── quiz.v2.recommendations.js # Generates recommended starter module baskets
    │   ├── quiz.v2.explanation.js # LLM explanation generator powered by Gemini
    │   ├── content/              # Rubrics & 20-question inventory (questions.v2-draft.json)
    │   ├── models/               # QuizAttempt, QuizSubmission, QuizQuestion, QuizHistoryLock
    │   └── utils/                # Scoring math, track weightings, scenario analysis & explanations
    │
    ├── bidding/                  # BOSS bidding simulator & timetable clash engine
    │   ├── bidding.routes.js     # Routes for /api/bidding
    │   ├── bidding.controller.js # Section search, cart persistence, round info & validation
    │   ├── section.repository.js # Section query & filtering abstraction
    │   ├── models/               # BidCart, Section, BidHistory, BiddingWindow, BiddingSettings
    │   └── utils/                # Clash detection (time & exam), reference bid calculation, cart validation
    │
    ├── parties/                  # Collaborative plan rooms (social bidding & planning)
    │   ├── parties.routes.js     # Routes for /api/parties
    │   ├── parties.controller.js # Room creation, invite codes, voting, section picks & short-polling
    │   ├── parties.middleware.js # Room member/owner authorization guards
    │   ├── models/Party.js       # Mongoose schema for collaborative rooms, members & ballots
    │   └── utils/                # Ballots aggregation, member eligibility & bidding cart handoff
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
        ├── curricula.controller.js # Track & degree requirement rule editor
        ├── modules.controller.js # Module CRUD, archive, restore & safe deletion
        ├── sections.controller.js# Section CRUD, schedule builder & archive/restore
        ├── rounds.controller.js  # Bidding round window & round date controls
        ├── audit.service.js      # Transaction-bound audit logger for data mutations
        └── models/AuditEntry.js  # Audit log Mongoose schema
```
</details>

<details open>
<summary><b>📁 frontend/ — Vue 3 + Tailwind CSS Client</b></summary>

```
frontend/
├── index.html                    # HTML entry document
├── vite.config.js                # Vite bundler configuration (@ and @core aliases, dev API proxy)
├── jsconfig.json                 # IDE path mapping aliases
├── package.json                  # Frontend scripts & dependencies
│
├── public/                       # Static browser assets (favicons, manifest)
├── details/                      # Reference documents & curriculum progression spreadsheets
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
│   │   ├── figma/                # Navigation, action & state icons
│   │   └── v2/                   # Updated design system icons
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
│   │   ├── BidSidebar.vue        # Bidding cart panel with e$ allocation & budget progress
│   │   ├── DegreeChecklist.vue   # Live graduation requirement progress breakdown
│   │   ├── DegreeChecklistRow.vue# Individual requirement bucket progress row
│   │   ├── DegreeForm.vue        # Degree details form used in onboarding & profile
│   │   ├── ExamSchedule.vue      # Final exam schedule table with clash warning badges
│   │   ├── ModuleSearchBox.vue   # Searchable module autocomplete input
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
│   │   │   ├── DeletePlanModal.vue # Confirm deletion of What-If degree plan
│   │   │   ├── NoticeRow.vue     # Prerequisite warning item row
│   │   │   ├── PlanLimitModal.vue# Maximum 3 plans limit warning dialog
│   │   │   ├── PlanSettingsModal.vue # Configure track selection (Track 1 / Track 2) for a plan
│   │   │   ├── PrereqWarningModal.vue # Prerequisite & corequisite violation explanation modal
│   │   │   └── SemesterFullModal.vue # Semester course unit overload warning modal
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
│       │   └── calendarExport.js # Google Calendar export flow state
│       │
│       └── utils/                # Client computation utilities
│           ├── clash.js          # Timetable slot & exam overlap calculation
│           ├── curriculumChecklist.js # Graduation requirement audit calculations
│           ├── curriculumLayout.js    # Degree checklist layout categorizer
│           ├── dashboardSchedule.js   # Dashboard timetable event organizer
│           ├── degreeChecklist.js     # Credit count & exemption evaluator
│           ├── ics.js            # iCalendar (.ics) format file generator
│           ├── money.js          # Currency & e$ bid formatting helpers
│           ├── roomBoard.js      # Collaborative room consensus algorithms
│           ├── roomCalendar.js   # Room member timetable overlay builder
│           └── roundTime.js      # Bidding round deadline & countdown formatter
│
└── tests/                        # Frontend unit & integration test suites (66 tests)
    ├── academic-warnings.test.mjs
    ├── admin-access.test.mjs
    ├── api-unreachable.test.mjs
    ├── archived-sections.test.mjs
    ├── auth.test.mjs
    ├── basket.test.mjs
    ├── bid-estimates.test.mjs
    ├── bid-total-display.test.mjs
    ├── bidding-live.test.mjs
    ├── calendar-export-session.test.mjs
    ├── calendar-token.test.mjs
    ├── calendar.test.mjs
    ├── credit-balance.test.mjs
    ├── curriculum-checklist.test.mjs
    ├── curriculum-layout.test.mjs
    ├── curriculum-scope.test.mjs
    ├── dashboard-schedule.test.mjs
    ├── exam-uncertainty.test.mjs
    ├── intake-curriculum.test.mjs
    ├── plan-curriculum-recovery.test.mjs
    ├── plan-management.test.mjs
    ├── plan-profile-merge.test.mjs
    ├── plan-settings-track.test.mjs
    ├── planner-handoff.test.mjs
    ├── quiz-history-score.test.mjs
    ├── quiz-required-answers.test.mjs
    ├── quiz-session.test.mjs
    ├── room-auto-bidding.test.mjs
    ├── room-bidding.test.mjs
    ├── room-calendar.test.mjs
    ├── room-management.test.mjs
    ├── room-votes.test.mjs
    ├── rooms-live.test.mjs
    ├── round-time.test.mjs
    ├── settings.test.mjs
    ├── todos.test.mjs
    └── unavailable-sections.test.mjs
```
</details>

<details>
<summary><b>📁 tests/ & playwright/ — End-to-End Testing</b></summary>

```
WAD2-Project/
├── playwright/
│   └── .auth/user.json           # Cached authentication state for automated runs
└── tests/
    └── example.spec.js           # Playwright smoke test verifying page rendering & routes
```
</details>

---

## API Endpoints Reference (all mounted under `/api`)

All endpoints except the public catalogue routes require a valid Firebase ID token in the `Authorization: Bearer <token>` header.

### 1. Health & Public Catalogue
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Service health probe (`{ ok: true }`). |
| `GET` | `/tracks` | Public | List tracks (`?intake=2024`). |
| `GET` | `/tracks/:id` | Public | Get track details and required/elective module lists. |
| `GET` | `/modules` | Public | Search catalogue (`?track=BA&category=track&q=...`). |
| `GET` | `/modules/:code` | Public | Get module details, prerequisites & corequisites. |
| `GET` | `/majors` | Public | List SMU majors. |
| `GET` | `/majors/:id` | Public | Get major curriculum structure. |

### 2. User Profile & Onboarding
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/users/me` | Student | Get authenticated user profile, completed modules & planner basket. |
| `PATCH` | `/users/me` | Student | Update profile, completed/exempted CUs, degree, and planner basket. |
| `GET` | `/users/admin-check` | Admin | Verify staff administrative privileges. |

### 3. Track Finder Quiz & AI Explainer
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/quiz/questions` | Student | List v1 quiz questions. |
| `POST` | `/quiz/attempts` | Student | Submit v1 quiz answers `{ answers }` → scored % fit per track. |
| `GET` | `/quiz/attempts` | Student | List user's past quiz attempts. |
| `GET` | `/quiz/attempts/:id/recommendations` | Student | Get recommended module starter basket for top tracks. |
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
| `GET` | `/plans/:id` | Student | Retrieve specific degree plan terms and module placements. |
| `PUT` | `/plans/:id` | Student | Update semester terms, courses, tracks, or LOA/Exchange status. |
| `DELETE` | `/plans/:id` | Student | Delete a degree plan. |
| `GET` | `/plans/:id/check` | Student | Audit plan against graduation requirements (CU counts, prerequisites, corequisites). |

### 5. BOSS Bidding Simulator
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/bidding/sections` | Student | Get available class sections for a module (`?module=IS216&term=...`). |
| `GET` | `/bidding/round` | Student | Retrieve active BOSS bidding round configuration & window deadlines. |
| `GET` | `/bidding/history/:module` | Student | Past 3 terms of historical bid results (`?round=1A`). |
| `GET` | `/bidding/reference/:module` | Student | Reference bid estimate based on past median ± 1 SD (Safe, Competitive, At-Risk). |
| `GET` | `/bidding/reference-bid` | Student | Reference bid for a specific section (`?sectionId=...`). |
| `GET` | `/bidding/weightage/:module` | Student | Course bidding weightage indicators. |
| `GET` | `/bidding/plans` | Student | Saved bidding carts for the current catalogue term (`?term=...`). |
| `GET` | `/bidding/cart` | Student | Fetch current user's active bid cart and allocated e$ credits. |
| `PUT` | `/bidding/cart` | Student | Save bid cart allocations; returns any detected timetable clashes. |
| `DELETE` | `/bidding/cart/:code` | Student | Remove a module from the active bid cart. |
| `POST` | `/bidding/validate-cart` | Student | Validate section list for time clashes, exam clashes, and duplicate courses. |
| `GET` | `/bidding/co-bids/:partyId` | Student | Aggregated view of which room members are bidding for which sections. |

### 6. Collaborative Plan Rooms (Parties)
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/parties` | Student | List plan rooms the authenticated student belongs to. |
| `POST` | `/parties` | Student | Create a collaborative plan room for a target module. |
| `POST` | `/parties/join` | Student | Join an existing room using an invite code (`{ inviteCode }`). |
| `GET` | `/parties/:id` | Member | Get room details, module info, member list & consensus status. |
| `DELETE` | `/parties/:id` | Owner | Delete plan room (owner only). |
| `GET` | `/parties/:id/updates` | Member | Short-polling endpoint (`?since=...`); returns `204 No Content` if unchanged. |
| `DELETE` | `/parties/:id/members/me` | Member | Leave a plan room. |
| `POST` | `/parties/:id/ban` | Owner | Remove/ban a member from the room (owner only). |
| `PUT` | `/parties/:id/votes` | Member | Submit section preference votes for the room's module. |
| `DELETE` | `/parties/:id/votes` | Member | Clear section votes. |
| `PUT` | `/parties/:id/my-section` | Member | Confirm personal section commitment for co-bidding coordination. |
| `DELETE` | `/parties/:id/my-section` | Member | Clear personal section commitment. |
| `GET` | `/parties/:id/sections` | Member | Get summary of all member section votes and confirmed selections. |

### 7. Timetable Calendar Export
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/calendar/export` | Student | Export final class timetable directly to Google Calendar API v3 using OAuth token. |

### 8. Notifications
| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/notifications` | Student | List user notifications (invites, room updates, bidding alerts). |
| `GET` | `/notifications/unread-count` | Student | Get total count of unread notifications. |
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
The script validates the Firebase identity, sets `role: 'admin'` in MongoDB, and records an entry in the transaction audit log.

### Legacy Plan Index Repair
If an older Atlas database contains the legacy unique index `degreePlans.userId_1_slot_1`:
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
pnpm import-exams <exam-schedule.xls> --dry-run
pnpm import-exams <exam-schedule.xls> --remote
```
Explicit exam end times are marked `finalExam.endVerified: true`.
Missing end times are flagged as unconfirmed and default to a 2-hour window during clash detection.
