# Pilot scoring review

20 October 2026. Numerical design audit only; no application logic changed.

## Method

Evaluated the proposed rubric in the root `Track Finder Quiz Design Review.md`: rating evidence -1, -0.5, omitted, +0.5, +1; scenario primary +1, supporting +0.25, other themes 0; per-section theme means; proposed track profiles; section weights 30/15/20/35.

For attainable bounds, enumerated every valid section response pattern: each rating skipped or 1–5, each scenario omitted or one of four informative options. E and Skip are equivalent for scoring and eligibility. Required at least three answered questions and one informative scenario in every section. Overall extrema combine independent section extrema using positive section weights. These are arithmetic bounds under this exact draft, not empirical calibration.

## Results

| Track | Lowest attainable overall score | Highest attainable overall score |
|---|---:|---:|
| BA | 40.78 | 80.13 |
| PD | 39.88 | 78.44 |
| FT | 39.94 | 77.45 |
| SMT | 38.67 | 76.98 |

A score described as 0–100 absolute alignment actually occupies a narrower, track-dependent interval. The mandatory positive scenarios and neutral observations compress the range. BA also has a higher ceiling than FT or SMT. This does not by itself prove ranking bias, but makes equal displayed percentages difficult to interpret consistently.

## Directional examples

Each example chooses the indicated primary domain in all eight scenarios, answers 5 on ratings directly mapped to that domain, and answers 3 on other ratings. All attempts meet completion requirements.

| Scenario direction | BA | PD | FT | SMT |
|---|---:|---:|---:|---:|
| DATA | 74.03 | 57.22 | 59.31 | 60.31 |
| BUILD | 56.52 | 72.50 | 59.83 | 57.41 |
| FINANCE | 56.55 | 55.00 | 69.73 | 52.47 |
| CIVIC | 58.66 | 54.41 | 51.55 | 70.03 |

Each intended track ranks first in these four constructed examples. This is a useful sanity check, not validation of the quiz.

With every rating answered 1 and every scenario choosing DATA, BA still scores 59.84. With every rating answered 3 and the same scenarios, BA scores 74.03. Omission of uncertain evidence and positive scenario evidence explain this difference. Do not interpret 3 as a neutral numeric answer or describe these results as probabilities.

## Recommendation for the next design chunk

Do not implement the current formula as a validated absolute percentage. Retain the agreed questions and six themes provisionally, then redesign evidence aggregation before publishing numeric scores.

Compare two student-owned options:

1. Keep relative scenario choices as preference evidence, use ratings as absolute interest/confidence evidence, and present the result as a rubric-based exploration index. Explain that scenarios do not establish dislike of unselected domains.
2. If absolute interest percentages are essential, collect comparable independent ratings for each domain. Keep scenarios for explanations or a separate preference view, rather than allowing one chosen option to establish neutral interest in all other themes. This requires revisiting question coverage and possibly the five-minute target.

Do not merely stretch each track's observed theoretical range to 0–100: that would make the endpoints reachable without establishing that the revised numbers measure absolute alignment.

No survey, predictive validity, statistical confidence or student testing is claimed. Students should own the final scoring decisions and implementation in line with the assignment brief.
