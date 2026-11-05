# BidMaxxer

A collaborative track finder, What-If degree planner and BOSS bidding simulator for SMU students (IS216 Web Application Development II, Section G2, Team bidmaxxer).

## Links

- **Deployed application (first page):** `<DEPLOYED_APP_URL>`
- **Git repository:** `<GIT_REPO_URL>`
- **Presentation video (YouTube):** `<YOUTUBE_VIDEO_URL>`

## Login details

Sign-in is Google only, and only `@smu.edu.sg` accounts are accepted (staff accounts need admin access, see step 6).

| Role | Username / email | Password |
| --- | --- | --- |
| Student | `<STUDENT_EMAIL>` | `<STUDENT_PASSWORD>` |
| Admin (optional) | `<ADMIN_EMAIL>` | `<ADMIN_PASSWORD>` |

## 1. Set up the application

**Prerequisites:** Node.js 24.x, pnpm 12.x (`npm install -g pnpm`), and a MongoDB database (local, or MongoDB Atlas). You also need a Firebase project with Google sign-in turned on, and a Google Gemini API key for the quiz explanations.

1. Unzip the submitted files (or clone `<GIT_REPO_URL>`) and open a terminal in the project folder.
2. Install the backend:
   ```bash
   cd backend
   pnpm install
   ```
3. Create `backend/.env` and fill in your own values:
   ```env
   PORT=4000
   MONGODB_URI=<YOUR_MONGODB_CONNECTION_STRING>
   CLIENT_ORIGIN=http://localhost:5173

   # Firebase Admin service account (Firebase Console > Project settings > Service accounts)
   FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
   FIREBASE_CLIENT_EMAIL=<YOUR_FIREBASE_CLIENT_EMAIL>
   FIREBASE_PRIVATE_KEY="<YOUR_FIREBASE_PRIVATE_KEY>"

   # Google Gemini (Google AI Studio > Create API key)
   GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>

   # Optional: pin the current bidding round (otherwise the latest catalogue term is previewed)
   # BIDDING_TERM=2026-27_T2
   # BIDDING_ROUND=1A
   # BIDDING_ROUND_CLOSES_AT=2026-11-06T10:00:00+08:00
   ```
4. Load the course catalogue, class sections, bid history and bidding windows into the database:
   ```bash
   pnpm seed
   ```
   (For a remote database such as Atlas, run `pnpm seed --remote`.)
5. Install the frontend:
   ```bash
   cd ../frontend
   pnpm install
   ```
   Create `frontend/.env.local` with your Firebase web app settings:
   ```env
   VITE_FIREBASE_API_KEY=<YOUR_FIREBASE_WEB_API_KEY>
   VITE_FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
   VITE_FIREBASE_AUTH_DOMAIN=<YOUR_FIREBASE_PROJECT_ID>.firebaseapp.com
   ```
   In the Firebase Console, check that `localhost` is listed under Authentication > Settings > Authorized domains.
6. (Optional) Make an account a staff admin, to open the admin portal at `/admin`:
   ```bash
   cd ../backend
   pnpm grant-admin --uid <FIREBASE_USER_UID> --operator "<YOUR_NAME>"
   ```

## 2. Run the application

Use two terminals.

```bash
# Terminal 1: backend API on http://localhost:4000/api
cd backend
pnpm dev

# Terminal 2: frontend on http://localhost:5173
cd frontend
pnpm dev
```

Open **http://localhost:5173**. The first page is the landing page, and `/api` requests are proxied to the backend automatically. Sign in with the student account above.

For a production build of the frontend: `cd frontend && pnpm build`.

## 3. Test the application

**Check the frontend builds:**
```bash
cd frontend
pnpm build
```

**End-to-end tests (Playwright)** from the project root, with the backend and frontend both running:
```bash
pnpm install
pnpm exec playwright install      # first run only: downloads the browsers
pnpm exec playwright test
pnpm exec playwright show-report  # open the last report
```
Test cases are in `tests/`. `<LIST_THE_END_TO_END_TEST_CASES_HERE>`

**Other test scripts** (optional): the files in `frontend/tests/` run with the Node test runner:
```bash
cd frontend
node --test tests/*.test.mjs
```

**Manual walk-through** (what the end-to-end tests should cover):
1. Sign in with the student account.
2. Track Quiz: answer the 20 questions and open the results.
3. What-If Planner: drag a module into a semester.
4. Bidding Planner: pick sections, enter bids and save the plan.
5. Collab Rooms: create a room, vote on a section, and (as the room admin) lock it.
