# Connected quiz preview

20 October 2026. Frontend quiz now calls the v2 backend endpoints. Existing mock sign-in remains unchanged; real Firebase sign-in integration belongs to the authentication feature.

Open http://localhost:5173/quiz. The current local API on port 4000 uses development authentication and an isolated `bidmaxxer_quiz_preview` database on a loopback MongoDB replica set at port 27961. No `.env` was created or shared database accessed. These are running processes, so the preview API/database must be restarted if stopped or after reboot. The temporary database directory is recorded in this chat's tool output; it is not a production data store.

## Verified in the browser

- All 20 questions load through the real API.
- Rating options have individual 1–5 labels; scenario options shuffle once per attempt with E last.
- An answer and its scenario display order survive reload in the same tab.
- A completed rating attempt saves and displays four tracks, six theme indices and separate scenario indices.
- Results reload from server history.
- Choosing E for both Interests scenarios yields a section error and a Review Interests link.
- Correcting one scenario permits submission; all-Unsure ratings produce provisional results without fabricated alignment indices.
- The history screen displays the two saved test results.

Production frontend build and 28 unit checks passed at the Git checkpoint. These checks do not establish the scoring rubric's empirical validity or complete production authentication.

## Current limits

- Drafts use sessionStorage, scoped to the mock profile email. They resume in this tab, not across devices. Server-side account drafts remain future work.
- The preview's development authentication identifies a local development user, not the person named in the frontend's mock profile. Use real auth before a shared deployment.
- Results show up to three exploratory modules for each of the top two tracks, drawn from 12 verified official SMU courses. See module-sources.md. Prerequisites and current offerings are unverified; planner integration remains future work.
- Backend and frontend changes are separated into commits on `backend/feature/quiz`. Coordinate the frontend commit with the frontend teammate before merging.

## Restarting a local preview

Use a dedicated temporary MongoDB data directory and start `mongod` with port 27961, replica set name `quizTest` and bind address 127.0.0.1. Initialise it once using the replica-set configuration in `quiz.v2.storage.integration.test.js`, or use the existing preview's initialised data directory. Do not point the integration test at a shared server.

For the API, from backend run this loopback-only preview launcher (no `.env` required):

```sh
MONGODB_URI='mongodb://127.0.0.1:27961/bidmaxxer_quiz_preview?replicaSet=quizTest' AUTH_DEV_BYPASS=true node --input-type=module <<'JS'
import { connectDB } from './config/db.js'
import app from './app.js'
await connectDB()
app.listen(4000, 'localhost', () => console.log('Preview API ready'))
JS
```

From frontend run `pnpm dev` in a separate terminal. Keep all three processes running. The API preview launcher does not auto-restart after backend edits; restart it to load backend changes. Vite continues to update frontend changes automatically.
