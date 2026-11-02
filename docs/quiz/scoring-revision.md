# Pilot scoring design

> **Current rules: quiz version v2.1 (2 November 2026), described in [the section at the end](#quiz-version-v21-2-november-2026).** It replaces the ranking and result rules in sections 3-5 and the Unsure scale in section 2. Team review of v2.1 is still pending. The approved v2-draft design is kept below as the record of what was decided on 20 October.

Approved by Min Xie on 20 October 2026. Supersedes the earlier numeric formula. Approval establishes the pilot design, not empirical validation. No runtime scoring implementation or shared database changes yet.

## 1. Preserve the agreed quiz structure

Keep 20 questions, four sections, three ratings and two scenarios per section, the six themes, BA/PD/FT/SMT, individual rating scales, and the existing section completion rules. Keep unlimited retakes and the latest two completed results.

## 2. Balance direct rating coverage

Change W1 from another DATA rating to a FINANCE rating:

> I enjoy working through how money moves through a service and the rules that shape each step.

Use the working-style scale: 1 Strongly unlike me; 2 Somewhat unlike me; 3 Unsure; 4 Somewhat like me; 5 Very like me.

Then the direct ratings become:

| Theme | Rating questions |
|---|---|
| DATA | I1, S1 |
| BUILD | I3, C1 |
| FINANCE | W1, C3 |
| CIVIC | I5, C5 |
| RELIABLE | S5, W3 |
| PEOPLE | S3, W5 |

This balances counts, not psychological validity. FINANCE still mixes working preference and career interest; DATA mixes interest and confidence. Explain these distinctions and review the question bank with real students.

Also apply the proposed E wording for S2/S4 and clearer C4 wording in `question-review.md`.

## 3. Separate two kinds of evidence

### Ratings: independently reported alignment

Proposed rating values: 1 = 0, 2 = 25, 3 = no observation, 4 = 75, 5 = 100. The gap at 50 is intentional because the agreed midpoint means Unsure, not neutral interest. Skips are also no observation.

Calculate each theme's rating index from its informative ratings, weighting them by their section weights and dividing by the sum of the weights actually observed for that theme. For example, DATA with I1=5 and S1=2 gives `(100×30 + 25×15)/(30+15) = 75`.

Do not assign 50 to a missing theme. Record whether a theme has zero, one or two informative ratings. These are self-reports, and confidence ratings do not measure ability.

### Scenarios: comparative preferences

Keep primary and supporting theme mappings provisionally. For each selected A–D option, record primary support 1 and supporting support 0.25. Other themes receive no support for that choice; this is not a negative or neutral measurement of their absolute interest. E and Skip contribute no scenario evidence.

Calculate a separate scenario preference index using the fixed track profiles and section weights, normalised against the best attainable scenario support for that track in each section. Average the informative scenarios within their section. This index describes preference within offered choices, not an absolute interest percentage.

The scenario mappings and track profiles still need human content review. Showing their arithmetic separately does not validate them.

## 4. Track results and incomplete evidence

When all six themes have at least one informative rating, compute each track's rating alignment index as the weighted mean of its six rating theme values using the existing proposed track profile. All tracks then share the same complete theme evidence. This index can theoretically range from 0 to 100 without scenario observations pulling it toward the middle.

Label it **Quiz alignment index · /100**, with the explanation: “A weighted summary of your reported interests, confidence and working preferences. It is not a probability of success or a measured ability.” A percent symbol alone would overstate the measurement.

For the pilot, rank tracks by this complete rating index. Show scenario preferences separately as supporting or conflicting evidence; do not silently combine them with a new arbitrary 70/30 split. Exact rating ties share rank; use scenario evidence to explain the tie, not secretly break it.

If any theme has no informative rating, do not calculate the complete rating index. Let the student finish under the existing completion rules, show a clearly labelled provisional scenario-based ordering of tracks to explore, and list the themes without rating evidence. Offer return links to their existing rating questions. Never force a guessed rating or block completion with a new requirement.

Approved result behaviour: some valid completed attempts will have no numerical rating index. The UI must support this state.

## 5. Worked checks

| Rating evidence | Expected result |
|---|---|
| Every rating 5 | Every theme and track rating index is 100; tracks tie, scenarios explain comparative preferences |
| Every rating 1 | Every theme and track rating index is 0; recommend exploration without claiming a positive match |
| Every rating 3, valid scenarios | No rating index; provisional scenario ordering and missing-evidence explanation |
| One informative rating for each theme | Rating index available; show lower coverage than two per theme |
| Both ratings for one theme unsure/skipped | No complete rating index; preserve remaining evidence |

Section weights now affect observations within each theme, rather than imposing exactly 30/15/20/35 on the final track score. That is an explicit departure from the earlier overall formula. Preserving those exact global weights would require redesigning rating coverage across all sections; do not claim both designs are equivalent.

## 6. Review decision before code

Recommended pilot: adopt the balanced ratings, separate scenario evidence, complete-evidence rating index, and provisional results for missing themes. Accept the revised interpretation of section weights explicitly. If exact global section weights or a percentage for every valid attempt are essential, revisit question structure instead of hiding these trade-offs in the formula.

The assignment brief's AI-use boundary still applies: this is a conceptual review aid. Students must critique and own the final business logic, implementation and validation.

## Quiz version v2.1 (2 November 2026)

### What changed from v2-draft

| Topic | v2-draft | v2.1 |
|---|---|---|
| Ranking | The 12 ratings; scenarios only as context | All 20 questions, with ratings and scenarios counted equally |
| Unsure rating | Option 3, which supplied no evidence | Removed. Ratings offer 1, 2, 4 and 5 |
| Blank answers | Allowed, with at least three answers per section | Refused. Every question needs an answer |
| Provisional results | When a theme had no informative rating | No longer happen for new attempts |
| Scores shown | Rating alignment and scenario preference | One match score per track. Rating themes show High (67+), Medium (34-66) or Low (under 34), and those cut-offs are a judgment call |
| Exact ties | Shared rank; list order chose the top two | Shared rank; a tie across the top two is shuffled once and saved |

Scenario option E ("None of these" or "I'm not sure") stays. It counts as an answer but supplies no evidence, and each section still needs one other scenario choice. The six themes, questions, rating values, section weights, scenario mappings and track profiles are unchanged. Attempts already saved keep their original scores, and their results page invites a retake.

### How the match score is calculated

The code is in `backend/features/quiz/utils/blendedScoreV2.js` and `scoreQuizV2.js`. The example below is one real attempt run through that code:

- **Ratings:** I1=5, S1=4, I3=2, C1=2, W1=4, C3=2, I5=1, C5=1, S5=4, W3=4, S3=4, W5=2.
- **Scenarios:** I2=a, I4=a, S2=a, S4=b, W2=a, W4=c, C2=a, C4=b.

| Step | DATA | BUILD | FINANCE | CIVIC | RELIABLE | PEOPLE |
|---|---:|---:|---:|---:|---:|---:|
| 1. Theme rating | 91.67 | 25 | 43.18 | 0 | 75 | 46.43 |
| 2. Rating minus the student's average (46.88) | 44.79 | -21.88 | -3.70 | -46.88 | 28.12 | -0.45 |
| 3. Scenario support | 62.50 | 25 | 12.50 | 3.13 | 18.75 | 3.13 |
| 4. Support minus its average (20.83) | 41.67 | 4.17 | -8.33 | -17.71 | -2.08 | -17.71 |
| 5. Combined: 0.5 x step 2 + 0.375 x step 4 | 38.02 | -9.38 | -4.97 | -30.08 | 13.28 | -6.87 |

1. **Theme rating.** Ratings convert to 1=0, 2=25, 4=75, 5=100. Each theme is the section-weighted mean of its two ratings, as in v2-draft.
2. **Centre the ratings.** Subtracting the student's own average leaves their pattern, so generous and harsh raters with the same pattern get the same score.
3. **Scenario support.** Each chosen option gives its primary theme 100 and its supporting theme 25. Each theme's support is then averaged over the scenarios answered. Option E is left out.
4. **Centre the support**, for the same reason as step 2.
5. **Combine.** `BLEND_SCENARIO_SHARE` (0.5) splits the weight equally. `SCENARIO_SCALE` (0.75) then reduces the scenario side to 0.5 x 0.75 = 0.375, because one-of-four choices swing further than ratings.
6. **Compare with each track.** Each track profile becomes a contrast: subtract its average weight, then scale it to length 1, so that no track can reach further than another. The track's raw score is the sum over themes of contrast x combined evidence.
7. **Convert to 0-100.** `score = 50 + 50 x raw / REACH`, limited to 0-100. `REACH` is 80.96, the furthest any track can get from neutral, worked out from the rubric when the server starts. Every track uses the same `REACH`, so this step cannot change the ranking. 50 means no lean either way.

| Track | Raw | Match score | Rank |
|---|---:|---:|---:|
| BA | 41.34 | 75.53 | 1 |
| FT | 19.16 | 61.83 | 2 |
| PD | -1.41 | 49.13 | 3 |
| SMT | -20.26 | 37.48 | 4 |

### Ties

Scores within 0.000000001 count as equal and share a rank. The results page and module suggestions use the first two tracks, so a tie that runs past second place is shuffled at random: three or four tied at the top, or a tie for second place. Two tracks tied at the top both fit and are left in place. The order is saved with the attempt, so it does not change when the result is viewed again.

### Why not average the two old indices

A plain 50/50 average of the rating and scenario indices is simpler, but it is unfair. On 100,000 simulated random attempts it chose FT 34.0% and PD 15.3% of the time, because the scenario index has very different floors per track. The v2.1 score chose BA 27.9%, PD 20.5%, FT 26.5% and SMT 25.0%. PD remains somewhat under an even share, down from 22.9% with ratings alone.

### Evidence and limits

All of this comes from simulated students with a known best track. It is a consistency check, not validation.

| Simulated students | Ratings only, top 1 | v2.1, top 1 |
|---|---:|---:|
| Clear scenario answers | 77.1% | 91.9% |
| Moderately clear scenario answers | 77.4% | 88.1% |
| Vague scenario answers | 77.5% | 81.1% |
| Vague, rates everything high | 65.6% | 74.0% |
| Vague, very noisy ratings | 65.6% | 73.8% |
| Scenario answers are pure noise | 76.9% | 71.0% |

- The simulated students were built so that scenario answers reflect real preferences, which favours v2.1. The last row shows the cost if real students answer scenarios carelessly.
- The 0.5 and 0.75 settings and the track profiles are judgment calls. No real student has been tested.
- Top scores are lower than the old scale suggested. Simulated students' top scores had medians of 61-74, and random answers had a median of 61.
- On random answers, the top two tracks were within 5 points 41.9% of the time, and the page tells those students to explore both.

The next step is a test with real students: have 20-30 seniors who have already chosen a track take the quiz, then tune the settings and profiles from those results.
