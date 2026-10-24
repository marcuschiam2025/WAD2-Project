# Quiz v2 API contract — implementation status

The existing endpoints remain available. The new authenticated GET `/api/quiz/v2/questions` serves file-backed `v2-draft` preview content. POST and GET `/api/quiz/v2/attempts` are now wired for submission and history. On 20 October 2026, 30 checks passed, including six persistence scenarios against a disposable local MongoDB 7 replica set. This verifies local persistence, not the team's configured database or a browser journey. Nothing has been deployed.

## Content

`backend/features/quiz/content/questions.v2-draft.json` contains the revised student-facing content. It has no theme mappings or scoring weights and is not imported by the running server. `v2-draft` is unpublished; freeze a release version only after team review. IDs A–D are stored as lower-case stable option IDs, independent of shuffled display letters. E remains last.

GET `/api/quiz/v2/questions` returns `rubricVersion` and `questions` with stable IDs, section, order, type, prompt and options. It excludes the content file's editorial `status` field and all internal mappings. An optional `rubricVersion=v2-draft` query checks the version; an unavailable version returns 409 and `QUIZ_VERSION_UNAVAILABLE`. The endpoint inherits the existing quiz authentication. It does not publish or seed database content, shuffle options, or accept v2 submissions. The original GET `/api/quiz/questions` is unchanged.

## Submission

POST `/api/quiz/v2/attempts` accepts:

```json
{
  "rubricVersion": "v2-draft",
  "submissionId": "client-generated-unique-id",
  "answers": [
    { "questionId": "I1", "optionId": "5" },
    { "questionId": "I2", "optionId": "b" },
    { "questionId": "I3", "optionId": null }
  ]
}
```

This is an abbreviated shape example, not an eligible completed attempt. Send one entry per question; null means Skip. Rating option `3` counts as answered but supplies no rating evidence. Scenario option `e` supplies no evidence and counts as unanswered. Each section requires three answered questions, including at least one informative scenario. Unknown/duplicate question IDs, invalid options and unsupported versions must be rejected. A repeated submissionId for the same user must not create another result.

## Result states

Completed responses need `id`, `rubricVersion`, `createdAt`, `rankingBasis`, `themeCoverage`, saved answers and a saved results snapshot. Every track result includes `track`, `rank`, nullable `alignmentIndex`, and a separate `scenarioPreferenceIndex`.

- `rankingBasis: rating`: all six themes have informative ratings; rank using the rating alignment index. Exact ties share rank. Scenario evidence provides context, not a hidden tiebreaker.
- `rankingBasis: scenario-provisional`: one or more themes lack informative ratings; every alignmentIndex is null. Use the scenario preference ordering, identify missing themes, and explain that the result is provisional.

Never substitute zero for a null index. Never label either index as a success probability. Keep the scenario index separate from the alignment index.

GET `/api/quiz/v2/attempts` returns the latest two completed attempts, newest first, including legacy attempts with `rubricVersion: legacy-v1`. Unlimited retakes remain allowed. Snapshots preserve the original v2 results and answer labels; private rubric snapshots are excluded from queries by default and from v2 responses. Draft persistence needs a separate contract before implementation; drafts do not count toward the two completed attempts.

New v2 submissions transactionally save the result, receipt and history pruning. This requires MongoDB Atlas or another replica set; standalone MongoDB cannot support this saving path. No nontransactional fallback is provided. A per-user history lock serialises v2 writes. Legacy writes do not participate in that lock; retire or adapt legacy submission before allowing mixed clients to submit concurrently.

A retry of the same user/submissionId and canonical answers returns the saved result with 200, while initial creation returns 201. Reusing the ID for different answers returns 409. Retrying an evicted result returns 410 rather than recreating it. Minimal receipt metadata (user, key, request fingerprint and result ID) persists beyond the two-result history to enforce this behaviour; it contains no answer content. Operational retention for these receipts needs team review before production.

## Errors and compatibility

### Module exploration endpoint

GET `/api/quiz/v2/attempts/:id/recommendations` now returns `catalogueVersion`, `retrievedAt`, `intakeFrom`, `intakeStatus`, `eligibilityStatus`, `sourceUrl`, and `groups: [{ track, modules }]`. Each course includes code, name, summary, official source URL, verified track-list membership, reason, and explicit unverified prerequisite/offering statuses. This is a separate official-source exploration shortlist; see `module-sources.md`. It does not assert enrolment eligibility or alter the planner catalogue. Legacy attempts return 409, unknown/unowned attempts 404, and malformed IDs 400.

Validation errors should contain a stable error code and affected question/section IDs, so the frontend can navigate to the issue. Use 400 for malformed requests, 422 for unmet completion requirements, and 409 for a stale rubric or reused submissionId with different answers. Preserve existing authentication and user ownership checks.

The existing module recommendation controller expects `attempt.results[].track` and uses its order for the top two. Preserve those fields/order or update the adapter in the same integration change. It must accept provisional ranking and shared ranks; a top-two layout must acknowledge a tie extending past the second position. Shared catalogue FT records need verification before module recommendations are claimed to support FT. Do not rewrite the module recommender in this chunk.

Old attempts contain numeric option positions and `pct`; preserve a legacy rendering path or explicitly version their adapter. Do not reinterpret old numeric answers as the new stable IDs.


24 October: v2 module exploration now uses the shared MongoDB catalogue. Response adds `catalogueSource`, `catalogueStatus`; per-course `prerequisiteStatus` distinguishes recorded-prerequisites-met from manual-review. See module-sources.md for scope and deployment requirements.
