# Approved pilot scoring design

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
