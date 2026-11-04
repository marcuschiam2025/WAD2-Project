# Shared catalogue integration — 24 October 2026

The v2 recommendation endpoint now reads the same MongoDB `tracks`, `requirements` and `modules` collections used by planning. The historical 12-course file below supplies optional editorial theme tags only. Course titles, descriptions, membership and prerequisites come from MongoDB; there is no fallback course list if the database is empty or a query fails.

- Curriculum is explicitly `BSC-IS_AY2025`; an earlier known intake receives no recommendations. Unknown intake is labelled unconfirmed in the API, not inferred from year of study.
- Quiz `SMT` maps to catalogue `SMCT` for lookup and back to `SMT` in the response. Quiz scoring and saved results are unchanged.
- Only the top two saved tracks are queried; completed courses, unmet recorded prerequisite groups and mutually exclusive completed courses are excluded.
- Corequisites, course-count prerequisites and free-text rules are marked for manual review. Current offerings and full enrolment eligibility remain unverified.
- Complete prerequisite information comes from the backend user record, not the frontend's mock profile. Until real profile persistence is connected, recommendations reflect only that backend record.
- Up to three courses per track are ranked by known editorial theme tags, with shared requirement order as a stable fallback for untagged courses. Tags do not change quiz scores.

Verification: 48 backend tests passed (one opt-in persistence suite skipped), frontend session test and production build passed. The real Mongoose loaders were also checked with all three seeded collections in a disposable local MongoDB database, covering BA/SMT and PD/FT. No Atlas credentials or shared data were used. A live browser submission has not been rerun because the preview API is stopped.

The destination environment must have its shared catalogue seeded using the team's normal setup. This change does not seed or overwrite a shared database.

---

## Historical curated-source notes

# Module exploration: source and behaviour

Retrieved 20 October 2026 from the official [SMU IS curriculum](https://computing.smu.edu.sg/bsc-information-systems/curriculum), explicitly labelled **For Intake AY2025 onwards**. The interactive track lists and individual course-description popups were read; the initial static page contains only sample courses.

## Data

`backend/features/quiz/content/modules.ay2025.json` is a curated shortlist of 12 unique courses, with official codes, titles, membership in the four supported track lists, course-description summaries and individual source anchors. Each track has at least three candidates. Some courses occur in multiple lists: IS217 and SMT481 appear in BA and SMT.

Summaries paraphrase the course popups. The six-theme tags are project editorial interpretations of those descriptions, not official SMU classifications. The shortlist is not the complete catalogue, and order is not an official recommendation or prerequisite sequence.

The public popups read did not establish prerequisites or current term offerings. Those fields are null, and the API explicitly reports them as unverified. Curriculum membership does not imply the student is eligible, that a course is offered next term, or that it satisfies every requirement for that student's intake. SMU directs current students to OASIS/Course Offerings/BOSS for current details.

## Known differences from the prototype catalogue

- Official IS442 is **Object Oriented Programming**; the frontend sample catalogue names it Enterprise Solution Delivery.
- The official current PD list includes IS458, previously placed under DCS in sample data.
- FT uses its own verified course list, rather than renaming existing DCS records.

The exploration dataset is therefore separate from the shared planner catalogue. No seeding, migrations, automatic basket insertion or planner requirement changes were performed. Reconcile codes, titles and intake-specific requirements with the planner owner before enabling Add to planner.

## Selection

GET `/api/quiz/v2/attempts/:id/recommendations` looks up the saved attempt **for the signed-in user**, then:

1. Uses the first two saved track results, preserving the quiz's ordering. Equal ranks are still acknowledged by the result page; these cards are not proof of a unique top two.
2. Filters to courses verified in each track list and excludes codes recorded as completed in the backend user profile. The sample frontend planner is not treated as an academic transcript.
3. Orders candidates by the mean available rating indices for their editorial theme tags. With no evidence for a candidate's tags, uses curated order after candidates with evidence. This heuristic is provisional and requires student review.
4. Returns up to three courses per track. No LLM is involved. Module relevance does not alter quiz scores or ranks.
5. Gives a factual explanation. A personal connection is mentioned only when an observed tagged rating index is at least 75; otherwise it says the course is listed in the track. This threshold is an editorial explanation rule, not an eligibility cutoff.

An intake before 2024 returns no suggestions from this guide. Missing intake is explicitly unconfirmed; the UI labels the guide AY2024 onwards. Even an intake within scope is not an eligibility confirmation. No separate admission-course or timetable checks are implemented.

The frontend displays short summaries and official links on the two track cards. Reasons are collapsed under Why these modules, alongside the existing collapsed analysis. Recommendation failures do not hide saved quiz results and have a separate retry control. Recommendations are computed from the current catalogue version, not frozen into historical quiz result snapshots; the response includes catalogueVersion and retrievedAt.

## Verification

28 backend unit checks passed, including catalogue consistency, leading-two selection, completed-course filtering, missing evidence, unsupported intake, and user-scoped endpoint lookup. Production frontend build passed. The live local preview displayed three course suggestions under each of the user's leading PD and SMT cards. No team/shared database was accessed.
