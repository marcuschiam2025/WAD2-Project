# BidMaxxer

A track finder, What-If degree planner and BOSS bidding simulator for SMU students, built for IS216 Web Application Development II.

## Links

- **Deployed application:** `<DEPLOYED_APP_URL>`
- **Git repository:** https://github.com/marcuschiam2025/WAD2-Project
- **Presentation video:** `<YOUTUBE_VIDEO_URL>`

## Login details

Sign-in is with Google only, and only `@smu.edu.sg` accounts are accepted. The admin portal also needs an account with admin access (see [Admin access](#admin-access)).

| Role             | Username / email  | Password             |
| ---------------- | ----------------- | -------------------- |
| Student          | `<STUDENT_EMAIL>` | `<STUDENT_PASSWORD>` |
| Admin (optional) | `<ADMIN_EMAIL>`   | `<ADMIN_PASSWORD>`   |

## Features

- **Track Quiz:** answer a short quiz to find the Information Systems track that suits you, with an AI-written explanation of the result.
- **What-If Planner:** drag modules into semesters and check progress against graduation requirements and prerequisites.
- **Bidding Planner:** pick sections, spot timetable clashes, plan e$ bids and compare them with past results.
- **Collab Rooms:** plan with friends by voting on sections and locking in a choice.
- **Calendar export:** add your timetable to Google Calendar or download an `.ics` file.
- **Admin portal:** staff can manage modules, sections, curricula and the active bidding round.

## Tech stack

| Area     | Technologies                                                     |
| -------- | ---------------------------------------------------------------- |
| Frontend | Vue 3, Vite, Tailwind CSS 4, Pinia, Vue Router, Chart.js, Motion |
| Backend  | Node.js 24, Express 5, Mongoose                                  |
| Database | MongoDB                                                          |
| Services | Firebase Authentication, Google Gemini                           |
| Hosting  | Vercel                                                           |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 24.x
- [pnpm](https://pnpm.io/) 12.x (`npm install -g pnpm`)
- A MongoDB database. Use [MongoDB Atlas](https://www.mongodb.com/atlas), or a local replica set: admin changes use transactions, which a standalone local server doesn't support.
- A [Firebase](https://console.firebase.google.com/) project with Google sign-in enabled and `localhost` under Authentication > Settings > Authorized domains.
- A [Gemini API key](https://aistudio.google.com/) (optional): without one, everything except the quiz's AI explanation still works.

### Installation

```bash
git clone https://github.com/marcuschiam2025/WAD2-Project.git
cd WAD2-Project

cd backend && pnpm install
cd ../frontend && pnpm install
```

### Environment variables

Create `backend/.env`:

```env
PORT=4000
MONGODB_URI=<YOUR_MONGODB_CONNECTION_STRING>
CLIENT_ORIGIN=http://localhost:5173

# Firebase Console > Project settings > Service accounts
FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
FIREBASE_CLIENT_EMAIL=<YOUR_FIREBASE_CLIENT_EMAIL>
FIREBASE_PRIVATE_KEY="<YOUR_FIREBASE_PRIVATE_KEY>"

# Optional: AI explanations for quiz results
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>

# Optional: pin the bidding round (otherwise it follows the bidding schedule)
# BIDDING_TERM=2026-27_T2
# BIDDING_ROUND=1A
# BIDDING_ROUND_CLOSES_AT=2026-11-06T10:00:00+08:00
```

Create `frontend/.env.local` with your Firebase web app settings:

```env
VITE_FIREBASE_API_KEY=<YOUR_FIREBASE_WEB_API_KEY>
VITE_FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
VITE_FIREBASE_AUTH_DOMAIN=<YOUR_FIREBASE_PROJECT_ID>.firebaseapp.com
```

### Load the data

Run this once on a new database to load the course catalogue, class sections, bid history and bidding windows:

```bash
cd backend
pnpm seed            # local database
pnpm seed --remote   # any other database, such as Atlas
```

> **Warning:** seeding replaces all of that data, including any exam schedules and staff edits. Student data is not touched. Don't run it on a live database unless you mean to, and run `pnpm import-exams` afterwards to restore exams.

`pnpm seed` doesn't load `backend/data/sectionbidresults.json`, so section-level bid comparisons have no history on a new database until that file is imported separately.

### Run the app

Use two terminals:

```bash
# Terminal 1: API on http://localhost:4000/api
cd backend
pnpm dev

# Terminal 2: app on http://localhost:5173
cd frontend
pnpm dev
```

Open http://localhost:5173. In development, Vite forwards `/api` requests to the backend.

### Admin access

Sign in once, then grant your account admin access using its Firebase user UID. The portal is at `/admin`.

```bash
cd backend
pnpm grant-admin --uid <FIREBASE_USER_UID> --operator "<YOUR_NAME>"
```

## Scripts

**Backend** (run in `backend/`)

| Command                                                       | What it does                                       |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm dev`                                                    | Start the API and restart it on file changes       |
| `pnpm start`                                                  | Start the API                                      |
| `pnpm seed`                                                   | Replace the catalogue data (see the warning above) |
| `pnpm import-exams <file.xls> [--remote] [--dry-run]`         | Import BOSS exam schedules                         |
| `pnpm grant-admin --uid <uid> --operator "<name>"`            | Give an account admin access                       |
| `pnpm build-catalogue`, `build-sections`, `build-bid-history` | Rebuild `data/*.json` from SMU and BOSS exports    |

**Frontend** (run in `frontend/`)

| Command        | What it does                 |
| -------------- | ---------------------------- |
| `pnpm dev`     | Start the development server |
| `pnpm build`   | Build for production         |
| `pnpm preview` | Preview the production build |

## Testing

Playwright is set up for end-to-end tests, but there are no test cases yet. Add them to a `tests/` folder in the project root, then run them from the root with the backend and frontend both running:

```bash
pnpm install
pnpm exec playwright install   # first run only: downloads the browsers
pnpm exec playwright test
```

## Project structure

```text
WAD2-Project/
├── backend/
│   ├── config/       # Database and Firebase connections
│   ├── data/         # Catalogue data loaded by pnpm seed
│   ├── features/     # API by feature: admin, auth, bidding, calendar, notifications, parties, planning, quiz
│   ├── middleware/   # Authentication, admin checks and error handling
│   ├── routes/       # Mounts each feature under /api
│   ├── scripts/      # Seeding, data builds and admin tools
│   ├── services/     # Gemini client
│   ├── app.js        # Express app
│   ├── server.js     # Local entry point
│   └── vercel.js     # Vercel entry point
├── frontend/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── core/     # Router, stores, API client, data and utilities
│       └── views/    # One per page
├── playwright.config.js
└── vercel.json       # Deploys the frontend and backend together
```

## Deployment

The project deploys to Vercel as two services, set up in `vercel.json`: requests to `/api` go to the backend and everything else goes to the frontend.

1. Add every variable from [Environment variables](#environment-variables) in Vercel, leaving out `PORT` and setting `CLIENT_ORIGIN` to your deployed URL.
2. Add your deployed domain to Firebase under Authentication > Settings > Authorized domains.
3. In MongoDB Atlas, allow connections from Vercel under Network Access.
