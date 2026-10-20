# Local persistence verification

20 October 2026. MongoDB 7.0.28, disposable single-node replica set `quizTest`, loopback port 27961. No project `.env` or shared database credentials were used. Each run creates a uniquely named test database and drops that database in its cleanup block.

Final run: 30 checks passed, zero failures/skips (23 unit checks, six database subtests and their parent test).

Database scenarios:

- Creation returns 201; identical retry returns 200 and the same attempt ID.
- A retry key reused for different content returns 409.
- After three submissions only the latest two results remain; replaying the evicted result returns 410.
- Four simultaneous identical requests create one attempt and one receipt.
- Six simultaneous different requests, starting with one existing result, leave two results and seven minimal receipts.
- Invalid document validation leaves history intact and creates no receipt.
- Users can independently use the same retry key.
- Saved snapshots survive a database read; internal rubric snapshots are excluded by default.

## Re-run

Start a disposable local mongod with `--port 27961 --replSet quizTest --bind_ip 127.0.0.1` and a fresh temporary `--dbpath`. From backend run:

```sh
RUN_QUIZ_DB_TESTS=1 node --test features/quiz/quiz.v2.storage.integration.test.js features/quiz/quiz.v2.controller.test.js features/quiz/utils/validateSubmissionV2.test.js features/quiz/utils/ratingIndexV2.test.js features/quiz/utils/ratingTracksV2.test.js features/quiz/utils/scoreQuizV2.test.js
```

The integration test skips without the explicit flag. It uses a hard-coded local URI and never reads MONGODB_URI. Shut down the temporary server after testing.

Remaining: actual authenticated HTTP/browser integration, team database replica-set compatibility, frontend connection, legacy submission concurrency transition, and human validation of the pilot scoring rubric.
