# Track Finder question review

Status: review draft, 20 October 2026. No scoring implementation or database changes.
Source: the project's `Track Finder Quiz Design Review.md`, section 5.

## Intended format

20 questions: four sections, each containing three individual 1–5 ratings and two scenarios. Section weights: Interests 30%, Strengths 15%, Working style 20%, Career goals 35%.

Theme keys: DATA (evidence), BUILD (software building), FINANCE (financial systems), CIVIC (public/environmental outcomes), RELIABLE (dependability), PEOPLE (stakeholders).

## Question mapping

Scenario cells show primary / supporting theme. A–D identify draft options, not permanent display positions. Shuffle display order once per attempt while preserving stable option IDs.

| ID | Rating theme or scenario A; B; C; D |
|---|---|
| I1 | DATA |
| I2 | DATA/CIVIC; BUILD/PEOPLE; FINANCE/PEOPLE; CIVIC/DATA |
| I3 | BUILD |
| I4 | DATA/RELIABLE; BUILD/RELIABLE; FINANCE/PEOPLE; CIVIC/DATA |
| I5 | CIVIC |
| S1 | DATA |
| S2 | DATA/RELIABLE; BUILD/RELIABLE; FINANCE/RELIABLE; CIVIC/PEOPLE |
| S3 | PEOPLE |
| S4 | DATA/RELIABLE; BUILD/RELIABLE; FINANCE/RELIABLE; CIVIC/PEOPLE |
| S5 | RELIABLE |
| W1 | DATA |
| W2 | DATA/RELIABLE; BUILD/PEOPLE; FINANCE/RELIABLE; CIVIC/PEOPLE |
| W3 | RELIABLE |
| W4 | DATA/PEOPLE; BUILD/RELIABLE; FINANCE/RELIABLE; CIVIC/PEOPLE |
| W5 | PEOPLE |
| C1 | BUILD |
| C2 | DATA/PEOPLE; BUILD/PEOPLE; FINANCE/PEOPLE; CIVIC/PEOPLE |
| C3 | FINANCE |
| C4 | DATA/PEOPLE; BUILD/RELIABLE; FINANCE/RELIABLE; CIVIC/DATA |
| C5 | CIVIC |

## Audit findings

- Structure matches the agreed 12 ratings and 8 scenarios, alternating rating/scenario/rating/scenario/rating in each section.
- Each scenario offers all four domain primary themes once. Across scenarios each primary appears eight times.
- Rating coverage is unequal: DATA 3, BUILD 2, FINANCE 1, CIVIC 2, RELIABLE 2, PEOPLE 2. FINANCE has no direct interest rating in the Interests section. This does not prove biased outcomes, but warrants sensitivity checks before accepting percentages.
- Scenario supporting themes are RELIABLE 14, PEOPLE 14, DATA 3, CIVIC 1, BUILD 0, FINANCE 0. These generic themes intentionally cross domains; frequency alone is not a reason to force equal counts. Their cumulative effect must be checked against track profiles.
- S2 and S4 have identical mappings and similar decision structures. Consider revising S4 after student feedback; repeated answers may add little evidence.
- I3/C1 and I5/C5 overlap between present interests and future goals. Keep provisionally, then check whether students distinguish them during the pilot.
- A five-minute completion time is a target requiring measurement.

## Proposed wording corrections

1. Keep E as “None of these appeal to me yet” in interest, working-style and career scenarios.
2. For S2 and S4, use E: “I’m not sure which I could contribute to yet.” These questions ask about current confidence, so an interest-based E is misleading. Like the existing E, this supplies no informative scenario evidence.
3. Replace C4's “Which internship task would you open first?” with “Which internship task would you most like to try?” This measures preference more directly.

These corrections are proposals for student review, not silent changes to a published rubric.

## Backend changes needed later

The existing question model stores option labels and direct track weights. It needs stable question/option identities and a rubric version to support the proposed theme model. The controller must distinguish rating 3 (answered, no evidence), E (unanswered) and Skip (unanswered), enforce the agreed section requirements, and return useful validation errors. Existing attempt records must remain interpretable; do not reseed or migrate the shared database during this review.

The exact numeric scoring profiles remain provisional. The assignment's AI-use boundary requires students to own the final business logic and validation. This document is a review aid, not evidence that the rubric has been validated by students or track experts.

## Next chunk

Review the wording corrections and unequal theme coverage, then work through scoring examples before implementing the schema or calculation.
