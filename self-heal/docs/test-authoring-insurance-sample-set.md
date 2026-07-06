# Insurance Sample Set — AIA iPOS+ Advisory & Quotation Flow

## Why this flow
A **high-complexity, heavily-regulated** end-to-end journey: financial advisory + insurance quotation =
money + suitability/replacement regulation + deeply branching rules + long stateful workflow + a single
mandatory "test data profile" that the current scripted suite loops over (**Set 24**). If our reasoned
pipeline (from [`test-authoring-agent-strategy.md`](test-authoring-agent-strategy.md) and
[`test-authoring-agent-buildplan.md`](test-authoring-agent-buildplan.md)) can out-cover a real,
complex, regulated flow like this — not just the mocked auto-pricing example in
[`test-authoring-worked-example-insurance.md`](test-authoring-worked-example-insurance.md) — it handles
most enterprise QA.

This doc is a **side-by-side**: for four representative sub-flows it shows what the **example-based /
current scripted approach** produces (one linear happy path over Set 24) versus what **our reasoned
pipeline** produces (positive / negative / boundary / edge / state / regulatory scenarios, each with a
technique, a data variation, and an explicit oracle, plus traceability).

**Honesty tags (per CLAUDE.md / `context.md` no-fabrication rule):** every number here is
`asserted` (worked from the stated flow/rules, or a plausible product threshold used for illustration)
— **none are `measured`** from a live iPOS+ system. Where a threshold or rule is genuinely undefined by
what we can see, it is **`abstained` and raised as a question**, not fabricated into an oracle.

---

## The flow under test (the input we were "handed")

**Journey:** AIA iPOS+ financial advisory + quotation.
Sign In (iPOS+) → App Version Verification → Create New Contact → AIA Quotation list → Create New SQS
Quotation → Start New Application → **FHR (Financial Health Review)**:
Getting Started → About You → **Priorities & Needs** (TPD, Critical Illness, Disability Income,
Retirement Age) → Current Portfolio → Your Finances → Your Budget → **Needs Analysis (Add Goal ×3)** →
**Investment Risk** (risk profile assessment) → Selected Plans → Insurance History →
**Replacement & Switching** (Reduced Investment in DIP / Existing DIP) → Client Details → Plan Details.

**How the current suite tests it:** one scripted linear pass, driven entirely by a single fixed profile
(**Set 24**). Same person, same numbers, same choices, every run. It proves the *golden path renders and
submits* — it does not probe rules, boundaries, bad data, invalid state, or regulatory obligations.

**Change type (classifier output, strategy doc §2):** this is a **workflow / multi-step / stateful**
journey carrying **backend business rules** (needs-analysis math, risk scoring, replacement suitability)
with a **regulatory overlay** (needs-based selling, suitability, replacement justification, disclosure).
Bundle (strategy doc §3, §5): **state-transition + decision-table + BVA/equivalence + property
invariants + pairwise + a regulatory/compliance lens + platform (mobile) pack.**

**Clarifying questions raised at intake (abstain-over-guess — full list in the Abstain Register):**
underinsurance / coverage-gap thresholds, DIP replacement suitability criteria, and risk-profile→plan
gating rules are **not specified** by the flow alone and must come from product/compliance before their
oracles can be authored.

---

## The four representative sub-flows

| # | Sub-flow | Dominant technique | Regulatory dimension |
|---|---|---|---|
| A | **Priorities & Needs — TPD** | decision-table + BVA | needs-based selling, disclosure |
| B | **Needs Analysis — Add Goal** | property invariants + BVA + state | needs-based selling, suitability |
| C | **Investment Risk — profile assessment** | decision-table + BVA + state | suitability, product gating |
| D | **Replacement & Switching — DIP** | decision-table + state + differential | replacement/switching justification, disclosure |

Output schema is the Scenario→Case→Data contract from strategy doc §6: **ID | Scenario | Category |
Technique | Preconditions | Input / Data Variation | Steps | Expected Oracle | Traces To**. Categories:
`positive · alt-valid · negative · boundary · edge · state · regulatory · property`.

---

## SUB-FLOW A — Priorities & Needs: TPD (Total & Permanent Disability)

### (a) Example-based / current scripted approach
> One case. Advisor opens Priorities & Needs, toggles **TPD = needed**, enters the Set 24 TPD coverage
> amount, sets the other needs (Critical Illness, Disability Income, Retirement Age) to their Set 24
> values, taps Next. **Oracle:** screen advances to Current Portfolio without error. One profile, one
> path, no rule/boundary/negative/regulatory coverage.

### (b) Our reasoned pipeline

| ID | Scenario | Category | Technique | Preconditions | Input / Data Variation | Steps | Expected Oracle | Traces To |
|---|---|---|---|---|---|---|---|---|
| A1 | TPD flagged as needed, valid coverage | positive | decision-table | On Priorities & Needs; contact created | `A-DV1` (TPD on, mid-range sum) | Toggle TPD on → enter sum → Next | Need recorded; TPD carried into Needs Analysis + Selected Plans; advances | AC-PN1, needs-based-selling |
| A2 | TPD not needed (opt-out) | alt-valid | decision-table | as A1 | `A-DV2` (TPD off) | Toggle TPD off → Next | No TPD need created; no TPD plan surfaces downstream; advances | AC-PN1 |
| A3 | Coverage = minimum allowed | boundary | BVA | as A1 | `A-DV3` (sum = min) | Enter min sum → Next | Accepted (min inclusive **[assert]** — see Q-A1) | AC-PN2 |
| A4 | Coverage = just below minimum | boundary | BVA | as A1 | `A-DV4` (min − 1) | Enter sum → Next | Rejected with specific "below minimum" message; no advance | AC-PN2 |
| A5 | Coverage = maximum allowed | boundary | BVA | as A1 | `A-DV5` (sum = max) | Enter max sum → Next | Accepted (max inclusive **[assert]**) | AC-PN2 |
| A6 | Coverage = just above maximum | boundary | BVA | as A1 | `A-DV6` (max + 1) | Enter sum → Next | Rejected; specific over-limit message | AC-PN2 |
| A7 | TPD needed but coverage left blank | negative | equivalence | as A1 | `A-DV7` (empty) | Toggle TPD on → leave sum blank → Next | Blocked; "coverage required" field error; no advance | AC-PN2 |
| A8 | Non-numeric / malformed amount | negative | equivalence | as A1 | `A-DV8` (text, symbols) | Enter `"abc"` / `"$$$"` → Next | Rejected or sanitized per spec; never stored as-is; no crash | AC-PN2, data-var |
| A9 | Zero / negative coverage | negative | BVA | as A1 | `A-DV9` (0, −1) | Enter 0 then −1 → Next | Both rejected as invalid coverage | AC-PN2 |
| A10 | Toggle TPD on→off→on (state revert) | state | state-transition | as A1 | `A-DV1` then off then on | On, enter sum, off, on again | Prior sum not silently retained as a "phantom" need; state consistent | AC-PN1 |
| A11 | Coverage well below computed need (underinsurance) | regulatory | decision-table | Need computed downstream exceeds entered TPD sum | `A-DV10` (sum ≪ need) | Enter low sum → proceed to Needs Analysis | **ABSTAIN — Q-A2:** must the tool warn/justify an underinsurance gap? Threshold undefined → no fabricated oracle | needs-based-selling, suitability |
| A12 | Recommend TPD sum with no needs basis | regulatory | rule-lawyer | TPD flagged, but no need/goal justifies it | `A-DV11` | Flag TPD, add no supporting rationale | Principle `[assert]`: needs-based selling requires a documented need behind coverage. **ABSTAIN — Q-A3 (dual-branch):** *does iPOS+ enforce this in-tool?* *if yes →* blocks/flags missing justification; *if no →* advises manual advisor check | needs-based-selling, disclosure |

**Data-variation sub-table — TPD coverage amount**

| Class | Values (`asserted`) | Expected result |
|---|---|---|
| Valid — mid | `A-DV1` = S$500,000 | Accepted |
| Valid — off | `A-DV2` = TPD toggled off (no sum) | No need created |
| Boundary — min | `A-DV3` = min (e.g. S$10,000 **[assert]**) | Accepted (inclusive — Q-A1) |
| Boundary — min−1 | `A-DV4` = min − S$1 | Rejected |
| Boundary — max | `A-DV5` = max (e.g. S$5,000,000 **[assert]**) | Accepted (inclusive) |
| Boundary — max+1 | `A-DV6` = max + S$1 | Rejected |
| Invalid — empty | `A-DV7` = "" | Field-required error |
| Nasty — non-numeric | `A-DV8` = `"abc"`, `"1,000,00"`, emoji, `"1e9"` | Rejected / sanitized, no crash |
| Invalid — zero/neg | `A-DV9` = 0, −1 | Rejected |
| Semantic — underinsured | `A-DV10` = S$50,000 vs computed need S$800,000 | Regulatory flag (Q-A2) |
| Semantic — unjustified | `A-DV11` = sum with no supporting need | Regulatory flag (Q-A2) |

---

## SUB-FLOW B — Needs Analysis: Add Goal (×3)

### (a) Example-based / current scripted approach
> Three cases, but really one shape ×3: tap **Add Goal**, pick the Set 24 goal type, enter the Set 24
> target amount / horizon, save; repeat twice more with Set 24's second and third goals. **Oracle:** three
> goal rows appear; screen advances. No boundary on amount/horizon, no invalid-goal handling, no
> delete/edit state, no check that the summed need feeds the recommendation.

### (b) Our reasoned pipeline

| ID | Scenario | Category | Technique | Preconditions | Input / Data Variation | Steps | Expected Oracle | Traces To |
|---|---|---|---|---|---|---|---|---|
| B1 | Add one valid goal | positive | use-case | On Needs Analysis | `B-DV1` | Add Goal → type + target + horizon → Save | Goal row created with entered values; contributes to computed need | AC-NA1 |
| B2 | Add three distinct goals (Set-24 parity) | positive | use-case | as B1 | `B-DV1,2,3` | Add 3 goals | 3 rows; total need = Σ goals **[assert additive]** (see Q-B1) | AC-NA1 |
| B3 | Target = minimum allowed | boundary | BVA | as B1 | `B-DV4` (target=min) | Add Goal → min target → Save | Accepted (min inclusive **[assert]**) | AC-NA2 |
| B4 | Target = just below minimum | boundary | BVA | as B1 | `B-DV5` (min−1) | Save | Rejected; specific error | AC-NA2 |
| B5 | Horizon = 0 years / today | boundary | BVA | as B1 | `B-DV6` (horizon 0) | Save | **ABSTAIN — Q-B2:** is a same-year goal valid? Undefined → flag | AC-NA2 |
| B6 | Horizon beyond retirement age | edge | BVA | Retirement Age set upstream (Priorities & Needs) | `B-DV7` (horizon > (retire−current age)) | Save | **[assert]** Should reconcile with retirement age; flag inconsistency (Q-B3) | AC-NA2, suitability |
| B7 | Empty required field | negative | equivalence | as B1 | `B-DV8` (blank target) | Save with blank | Blocked; field-required error | AC-NA2 |
| B8 | Non-numeric / huge / precision target | negative | equivalence | as B1 | `B-DV9` (text, 1e12, decimals) | Save | Rejected / sanitized; no overflow; no crash | AC-NA2, data-var |
| B9 | Duplicate goal (same type twice) | edge | rule-lawyer | as B1 | `B-DV10` (two identical) | Add same goal twice | **ABSTAIN — Q-B4:** merge, sum, or reject duplicates? Undefined → flag | AC-NA1 |
| B10 | Add goal then delete it | state | state-transition | one goal exists | `B-DV1` then delete | Add → Save → delete row | Row removed; total need decreases by exactly that goal (no sticky contribution) | AC-NA1 |
| B11 | Edit a saved goal's target | state | state-transition | one goal exists | `B-DV1`→edit to `B-DV4` | Edit target → Save | Row + total need recompute; old value not retained | AC-NA1 |
| B12 | Zero goals then proceed | negative | equivalence | none added | `B-DV11` (0 goals) | Add Goal count = 0 → Next | **[assert]** Either allowed with zero need or blocked — see Q-B5; no silent nonzero need | AC-NA1 |
| B13 | INVARIANT: total need never negative, always = Σ active goals | property | property-based | any goal set | 200 generated goal sets (Faker/Hypothesis) | Add/edit/delete random goals | **Runnable now:** `total_need ≥ 0` and recomputes exactly on every add/edit/delete (no drift/sticky value). **Pending Q-B1:** the aggregation (`plain sum` vs `PV-adjusted`) is parameterised — swap the formula once resolved | AC-NA1 |
| B14 | Goal need drives recommended coverage | regulatory | rule-lawyer | goals + Priorities set | `B-DV1,2,3` | Complete Needs Analysis → view Selected Plans | **[assert]** Recommended coverage traces to summed need (needs-based selling); flag if plan ignores need | needs-based-selling, suitability |

**Data-variation sub-table — Goal target & horizon**

| Class | Values (`asserted`) | Expected result |
|---|---|---|
| Valid goal 1 | `B-DV1` = Education, S$200,000, 10 yrs | Accepted |
| Valid goal 2 | `B-DV2` = Retirement income, S$1,000,000, 25 yrs | Accepted |
| Valid goal 3 | `B-DV3` = Home, S$300,000, 5 yrs | Accepted |
| Boundary — min target | `B-DV4` = min (S$1,000 **[assert]**) | Accepted (inclusive) |
| Boundary — min−1 | `B-DV5` = min − S$1 | Rejected |
| Boundary — horizon 0 | `B-DV6` = 0 yrs | ABSTAIN (Q-B2) |
| Edge — horizon > retirement | `B-DV7` = 40 yrs when retire−age = 20 | Inconsistency flag (Q-B3) |
| Invalid — empty | `B-DV8` = "" | Field-required error |
| Nasty — numeric | `B-DV9` = `"abc"`, `1e12`, `"−5"`, 3-dp cents | Rejected / sanitized, no crash |
| Edge — duplicate | `B-DV10` = two identical goals | ABSTAIN (Q-B4) |
| Edge — none | `B-DV11` = 0 goals | ABSTAIN (Q-B5) |

---

## SUB-FLOW C — Investment Risk: profile assessment

### (a) Example-based / current scripted approach
> One case. Advisor answers each risk-questionnaire item with the Set 24 selections, submits. **Oracle:**
> a risk profile label (e.g. "Balanced") appears and the screen advances. Only one answer combination is
> ever exercised; no other profile band is produced, no boundary between bands is checked, no
> inconsistency handling, no downstream gating check.

### (b) Our reasoned pipeline

| ID | Scenario | Category | Technique | Preconditions | Input / Data Variation | Steps | Expected Oracle | Traces To |
|---|---|---|---|---|---|---|---|---|
| C1 | Lowest-risk answers → Conservative | positive | decision-table | On Investment Risk | `C-DV1` (all low) | Answer all min → Submit | Profile = most conservative band; label + score consistent | AC-IR1 |
| C2 | Set-24 answers → its band | positive | decision-table | as C1 | `C-DV2` (Set 24) | Answer Set 24 → Submit | Same profile as scripted run (regression parity) | AC-IR1, regression |
| C3 | Highest-risk answers → Aggressive | positive | decision-table | as C1 | `C-DV3` (all max) | Answer all max → Submit | Profile = most aggressive band | AC-IR1 |
| C4 | Score at band boundary (lower edge) | boundary | BVA | as C1 | `C-DV4` (score = band cutoff) | Answer to hit cutoff → Submit | Lands in the band the cutoff belongs to **[assert inclusive]** — see Q-C1 | AC-IR2 |
| C5 | Score one point below boundary | boundary | BVA | as C1 | `C-DV5` (cutoff − 1) | Submit | Lands in the lower band (no off-by-one drift) | AC-IR2 |
| C6 | All bands reachable (coverage) | alt-valid | decision-table | as C1 | `C-DV6` (per-band sets) | Submit one set per band | Every defined profile band is producible; none unreachable/duplicated | AC-IR1 |
| C7 | Submit with unanswered question | negative | equivalence | as C1 | `C-DV7` (one blank) | Leave 1 item → Submit | Blocked; "all questions required"; no partial score | AC-IR2 |
| C8 | Change answers → re-score | state | state-transition | profile computed | `C-DV1`→`C-DV3` | Submit low, go back, change to high, resubmit | Profile updates to new band; stale profile not retained downstream | AC-IR1 |
| C9 | Contradictory answers (low-tolerance + high-goal) | edge | rule-lawyer | as C1 | `C-DV8` (inconsistent) | Submit conflicting answers | **ABSTAIN — Q-C2:** does iPOS+ flag internal inconsistency? Undefined → flag, no oracle | AC-IR2, suitability |
| C10 | INVARIANT: monotonic — riskier answers never yield a *less* aggressive profile | property | property-based | any answers | 200 generated answer sets | Perturb one answer up | For all: profile band is `≥` prior band (monotonic) | AC-IR1 |
| C11 | Profile gates eligible plans (suitability) | regulatory | rule-lawyer | profile computed | `C-DV1` (conservative) | Proceed to Selected Plans | **[assert]** Plans offered must suit the profile (no high-risk product to a Conservative client) — **ABSTAIN Q-C3** on exact gating rule | AC-IR3, suitability |
| C12 | Profile ↔ selected plan mismatch override | regulatory | state | conservative profile, aggressive plan chosen | `C-DV1` + risky plan | Force-select an unsuitable plan | **[assert]** Requires justification / warning for suitability override; flag if silently allowed | suitability, disclosure |

**Data-variation sub-table — risk questionnaire answers → score/band**

| Class | Values (`asserted`) | Expected result |
|---|---|---|
| Valid — all low | `C-DV1` | Most conservative band |
| Valid — Set 24 | `C-DV2` = scripted selections | Set 24's band (parity) |
| Valid — all high | `C-DV3` | Most aggressive band |
| Boundary — at cutoff | `C-DV4` = score exactly on a band edge | Band per inclusivity rule (Q-C1) |
| Boundary — cutoff−1 | `C-DV5` | Lower band |
| Coverage — per band | `C-DV6` = one answer set per defined band | Each band reachable once |
| Invalid — incomplete | `C-DV7` = one item blank | Submit blocked |
| Edge — contradictory | `C-DV8` = low risk-tolerance + aggressive-return goal | Inconsistency handling (Q-C2) |

---

## SUB-FLOW D — Replacement & Switching: DIP (Reduced Investment / Existing DIP)

### (a) Example-based / current scripted approach
> One case. Advisor indicates the Set 24 stance on Reduced Investment in DIP / Existing DIP, enters the
> Set 24 values, taps Next. **Oracle:** section accepts input and advances. The single most
> compliance-sensitive screen in the journey — replacement/switching — is exercised as a form fill,
> with no coverage of the "replacement triggered" branch, disclosure requirements, or suitability of the
> switch.

### (b) Our reasoned pipeline

| ID | Scenario | Category | Technique | Preconditions | Input / Data Variation | Steps | Expected Oracle | Traces To |
|---|---|---|---|---|---|---|---|---|
| D1 | No existing DIP → no replacement | positive | decision-table | On Replacement & Switching | `D-DV1` (no existing DIP) | Indicate none → Next | No replacement branch triggered; no disclosure forms required; advances | AC-RS1 |
| D2 | Existing DIP, no reduction/switch | alt-valid | decision-table | as D1 | `D-DV2` (existing, unchanged) | Declare existing, no change → Next | Recorded; no replacement obligations triggered | AC-RS1 |
| D3 | Reduced investment in existing DIP | regulatory | decision-table | existing DIP present | `D-DV3` (reduce amount) | Declare reduction → enter values → Next | Reduction recorded. **ABSTAIN — Q-D1 (dual-branch):** *if reduction triggers replacement path →* justification required before advance; *if not →* advances without it. Do not assert until resolved | AC-RS1, replacement-justification |
| D4 | Full switch: surrender existing → new DIP | positive | decision-table | existing DIP present | `D-DV4` (switch) | Declare switch → Next | **[assert]** Replacement flagged; disclosure + suitability justification mandatory before proceeding | AC-RS2, replacement-justification, disclosure |
| D5 | Reduction amount = boundary (full vs partial) | boundary | BVA | existing DIP | `D-DV5` (reduce = full balance) | Enter full-balance reduction | Treated as full switch, not partial (no gap at 100%) — **[assert]**, see Q-D2 | AC-RS1 |
| D6 | Reduction > existing balance | negative | BVA | existing DIP | `D-DV6` (reduce > balance) | Enter over-reduction → Next | Rejected; can't reduce more than held | AC-RS2 |
| D7 | Replacement declared but justification blank | regulatory | rule-lawyer | switch/reduction declared | `D-DV7` (no rationale) | Declare switch → leave justification empty → Next | **[assert]** Blocked — replacement requires documented justification (regulatory); no advance | replacement-justification, disclosure |
| D8 | Replacement declared but disclosure not acknowledged | regulatory | rule-lawyer | switch declared | `D-DV8` (disclosure unticked) | Attempt Next without disclosure ack | **[assert]** Blocked until required disclosures acknowledged | disclosure |
| D9 | Declare switch → revert to "no switch" | state | state-transition | switch declared | `D-DV4` then `D-DV1` | Declare switch, then change to none | Replacement obligations + justification/disclosure requirements cleared; no orphaned mandatory flags | AC-RS1 |
| D10 | Inconsistent: Insurance History shows DIP, here says none | edge | differential | Insurance History captured a DIP upstream | `D-DV9` (contradicts history) | Declare "no existing DIP" | **[assert]** Cross-section consistency check should flag contradiction — **ABSTAIN Q-D3** on whether iPOS+ enforces it | AC-RS1, suitability |
| D11 | Switch to objectively worse terms (suitability) | regulatory | rule-lawyer | switch declared | `D-DV10` (new DIP worse) | Declare switch to inferior product | **ABSTAIN — Q-D4:** suitability criteria for "is this switch in the client's interest?" undefined → flag, do not fabricate a pass/fail | suitability, replacement-justification |
| D12 | Regression parity with Set 24 | regression | differential | Set 24 stance | `D-DV11` (Set 24) | Enter Set 24 values → Next | Behaves identically to current scripted run | regression |

**Data-variation sub-table — DIP replacement/switching**

| Class | Values (`asserted`) | Expected result |
|---|---|---|
| Valid — none | `D-DV1` = no existing DIP | No replacement branch |
| Valid — existing, unchanged | `D-DV2` | Recorded, no obligation |
| Valid — reduction | `D-DV3` = reduce S$50k of S$200k | Justification path (Q-D1) |
| Valid — full switch | `D-DV4` = surrender + new DIP | Replacement + disclosure + suitability |
| Boundary — reduce = balance | `D-DV5` = reduce 100% | Treated as full switch (Q-D2) |
| Invalid — over-reduce | `D-DV6` = reduce S$250k of S$200k | Rejected |
| Regulatory — no justification | `D-DV7` = switch, rationale blank | Blocked (justification required) |
| Regulatory — no disclosure | `D-DV8` = switch, disclosure unticked | Blocked (disclosure required) |
| Edge — contradicts history | `D-DV9` = "none" vs history DIP | Consistency flag (Q-D3) |
| Semantic — unsuitable switch | `D-DV10` = switch to worse terms | ABSTAIN (Q-D4) |
| Regression — Set 24 | `D-DV11` = scripted values | Parity |

---

## Regulatory / compliance dimensions (insurance-advisory specific)

These are cross-cutting oracles that the scripted suite never checks, and that a general-purpose LLM
generator will not surface unless explicitly prompted with an insurance-advisory regulatory lens. They
map to standard financial-advisory obligations (needs-based selling, suitability, replacement, and
disclosure), applied here to the iPOS+ FHR journey.

| Dimension | What it demands of the flow | Where it lands in this set |
|---|---|---|
| **Needs-based selling** | Every recommended coverage must trace to a documented need/goal | A11, A12, B14 |
| **Suitability** | Recommendation must fit the client's risk profile, finances, and horizon | B6, C11, C12, D10, D11 |
| **Replacement / switching justification** | Replacing/reducing an existing policy (DIP) requires a documented, client-benefit justification | D3, D4, D7, D11 |
| **Disclosure** | Client must be shown/acknowledge required disclosures before proceeding, esp. on replacement | D4, D8; A12 (basis of advice) |
| **Traceability / audit** | The advice trail (need → analysis → risk → plan → replacement) must be internally consistent | B13, C10, D10 (invariants + cross-section checks) |

**Why this matters for the pipeline:** these are exactly the cases where **abstain-with-a-named-reason
is the deliverable** (mirrors the project's false-heal=0 discipline). The tool must *flag* a suitability
or replacement obligation and, where the rule is undefined, *raise a question to product/compliance*
rather than assert a pass/fail it cannot justify.

---

## Abstain Register (open questions — do NOT fabricate oracles)

| Q-ID | Sub-flow | Ambiguity | Why we abstain | Needed from |
|---|---|---|---|---|
| Q-A1 | A (TPD) | Is the coverage min/max **inclusive**? | Boundary oracle flips on inclusivity | Product spec |
| Q-A2 | A (TPD) | **Underinsurance threshold** — when is a coverage gap large enough to warn/block? | No number = no honest oracle | Product / compliance |
| Q-A3 | A (TPD) | Does iPOS+ **enforce needs-basis in-tool** (block unjustified coverage) or leave it to the advisor? | Enforcement vs advisory changes the oracle | Product / compliance |
| Q-B1 | B (Goals) | Is total need a **plain sum** or **present-value adjusted** across horizons? | Changes B2/B13 oracle | Product spec |
| Q-B2 | B (Goals) | Is a **0-year / same-year** goal horizon valid? | Boundary undefined | Product spec |
| Q-B3 | B (Goals) | Should goal horizon be **reconciled against retirement age**? | Cross-field rule undefined | Product spec |
| Q-B4 | B (Goals) | **Duplicate goals** — merge, sum, or reject? | Behavior undefined | Product spec |
| Q-B5 | B (Goals) | Is proceeding with **zero goals** allowed? | Gating undefined | Product spec |
| Q-C1 | C (Risk) | Are band **cutoffs inclusive** (which band owns the boundary score)? | Off-by-one oracle | Product spec |
| Q-C2 | C (Risk) | Does iPOS+ flag **internally contradictory** risk answers? | Behavior undefined | Product / compliance |
| Q-C3 | C (Risk) | Exact **profile→eligible-plan gating** rule | Suitability oracle undefined | Compliance |
| Q-D1 | D (DIP) | Does a **reduction** (not just full switch) trigger the replacement justification path? | Rule undefined | Compliance |
| Q-D2 | D (DIP) | Is a **100% reduction** classified as a full switch? | Boundary classification undefined | Product spec |
| Q-D3 | D (DIP) | Does iPOS+ enforce **cross-section consistency** (Insurance History ↔ Replacement)? | Behavior undefined | Product spec |
| Q-D4 | D (DIP) | **Suitability criteria** for whether a switch is in the client's interest | Core regulatory judgment, no encoded rule | Compliance |

---

## Coverage & traceability summary (side-by-side)

| Dimension | Scripted (Set 24) | Reasoned pipeline |
|---|---|---|
| Positive / happy | ✅ (1 per sub-flow) | ✅ |
| Alternate valid | ❌ | ✅ (A2, C6, D2) |
| Boundary (both sides) | ❌ | ✅ (A3–A6, B3–B5, C4–C5, D5) |
| Negative / invalid | ❌ | ✅ (A7–A9, B7–B8, C7, D6) |
| Nasty data | ❌ | ✅ (A8, B8) |
| State / transitions | ❌ | ✅ (A10, B10–B11, C8, D9) |
| Property invariants | ❌ | ✅ (B13, C10) |
| Regulatory / compliance | ❌ | ✅ (A11–A12, B14, C11–C12, D3–D4, D7–D8, D11) |
| Cross-section consistency | ❌ | ✅ (D10) |
| Regression parity | implicit (it *is* Set 24) | ✅ explicit (C2, D12) |
| Open questions surfaced | ❌ (none — guesses or ignores) | ✅ 14 abstains raised, not fabricated |

**Case count:** scripted ≈ **6 linear cases** (1 per sub-flow, +2 extra Add-Goal repeats) over a single
profile. Reasoned pipeline: **~49 authored cases** across 4 sub-flows (A: 12, B: 14, C: 12, D: 12 —
minus the shared regression rows) spanning 8 categories, each with an explicit oracle **or** an explicit
abstain, plus **14 open regulatory/spec questions** raised for product/compliance.

All numeric thresholds above are **`asserted`** (worked/illustrative), **not `measured`** from a live
iPOS+ system; every genuinely-undefined rule is **`abstained`** in the register rather than fabricated.

---

## Revision R1 — contradiction fixes, missing methods & wider data

### R1.1 — Assert/abstain contradictions fixed (correctness in our own output)
Rule adopted: **a case may not assert an oracle that depends on an open abstain.** It must either abstain
too, or carry **dual-branch candidate oracles** ("if rule = X → oracle A; if rule = Y → oracle B") so it
becomes instantly runnable the moment product answers — turning the Abstain Register into *actionable*
work, not just a question list. Applied to **D3** (was asserting the very thing Q-D1 abstains on), **A12**
(now asserts only the principle; enforcement split into new **Q-A3**), and **B13** (runnable-now part
separated from the Q-B1-parameterised aggregation).

### R1.2 — Method-coverage audit (were all paradigms used?)
The R0 set was spec-based-heavy. R1 adds the missing paradigms below.

| Method | R0 | R1 additions |
|---|---|---|
| Equivalence · Boundary · Decision-table · State-transition · Use-case | ✅ | — |
| Property-based | ✅ (B13, C10) | + metamorphic relations |
| Differential / regression | ✅ | — |
| **Pairwise / combinatorial** | ❌ | **E-block** (needs interaction; goal type×amount×horizon) |
| **Metamorphic** | ⚠️ (C10 only) | **E4–E5** (reorder-invariance, scaling relations) |
| **Model-based / journey (MBT)** | ❌ | **F-block** (end-to-end wizard paths) |
| **Fuzzing / injection** | ⚠️ (nasty data) | **data scenarios §R1.4** (free-text fuzz, injection) |
| **Fault injection / chaos** | ❌ | **G-block** (network, backend-down, save-fail) |
| **API / contract** | ❌ | **H-block** (service contract, error, version, idempotency) |
| **Session (mgmt + exploratory)** | ❌ | **G1/G4** + exploratory charters note |
| **Behavioural / persona** | ❌ | **§R1.3 persona profiles** + BDD note |
| **Formal methods** | ❌ | candidate flagged (risk-band table exhaustiveness / wizard state-model check) — not authored |
| **Mutation testing** | ❌ (it's an audit) | run *after* authoring to grade this set (buildplan §3) |

### R1.3 — New cases (representative)

**E — Cross-field & combinatorial (pairwise + affordability)**

| ID | Scenario | Category | Technique | Input / Data | Expected Oracle | Traces To |
|---|---|---|---|---|---|---|
| E1 | 4 needs on/off × amounts interaction | positive | pairwise | `E-DV1` (pairwise set over TPD/CI/DI/Retirement) | Each combination sizes total need correctly; no combo crashes or double-counts | AC-PN1 |
| E2 | Recommended premium vs stated budget | regulatory | decision-table | budget $X, recommended $Y | **ABSTAIN — Q-E1 (dual-branch):** *if Y > budget →* affordability/suitability flag; *else →* proceeds. Threshold undefined | suitability (affordability) |
| E3 | Age × goal horizon × retirement consistency | edge | pairwise | `E-DV2` (conflicting triples) | Cross-field inconsistency flagged (ties B6/Q-B3) | suitability |
| E4 | Metamorphic: reorder goals ⇒ same total need | property | metamorphic | same goals, shuffled order | `total_need(order₁) == total_need(order₂)` | AC-NA1 |
| E5 | Metamorphic: scale one goal up ⇒ need never decreases | property | metamorphic | goal target ↑ | recommended need is monotonic non-decreasing | AC-NA1 |

**F — End-to-end journey (MBT / state across screens)**

| ID | Scenario | Category | Technique | Expected Oracle |
|---|---|---|---|---|
| F1 | Full FHR happy path → data carries to Plan Details | positive | MBT | Every entered value (About You → Plan Details) reappears/derives correctly at the end; no loss/mutation |
| F2 | Back-navigate across screens | state | MBT | Prior entries preserved or cleanly rederived; no stale/orphaned data |
| F3 | Abandon mid-flow → resume | state | MBT | Draft restored to exact prior step & values (or explicit "session expired" — see G1) |
| F4 | Auto-generated valid wizard paths | positive | MBT | N generated valid paths each complete & submit consistently (model-based path coverage) |

**G — Session / platform / fault injection (mobile)**

| ID | Scenario | Category | Technique | Expected Oracle |
|---|---|---|---|---|
| G1 | Session timeout mid-FHR | negative | fault-injection | Re-auth required; draft preserved or explicit, non-silent data-loss message |
| G2 | Network drop during recommendation calc | edge | fault-injection | Graceful retry; **no partial/corrupt quote**, no fabricated premium |
| G3 | Backend rate-table service down | negative | fault-injection | Fail-safe; blocks quote; never shows a stale/guessed premium |
| G4 | App backgrounded / killed mid-flow | state | fault-injection | On resume, state intact or safe re-entry — no corruption |
| G5 | App version mismatch (Version Verification step) | edge | rule-lawyer | Forced update / block; **never quote on stale rate rules** (regulatory) |

**H — API / contract (backend boundary)**

| ID | Scenario | Category | Technique | Expected Oracle |
|---|---|---|---|---|
| H1 | Quotation-service response contract | positive | contract (Pact) | Expected fields present & typed; consumer breaks the build if schema drifts |
| H2 | Malformed / slow backend response | negative | contract + fuzzing | Handled as user-safe error; no crash, no NaN premium |
| H3 | Rate-table version pinning | regulatory | contract | Quote uses the current *filed* rate version; mismatch flagged (audit) |
| H4 | Double-submit of quotation | negative | idempotency | No duplicate quotation/policy created |

### R1.4 — Wider data scenarios to design (the "what else" list)
Beyond single illustrative values per class, generate data for:
- **Temporal / date:** DOB leap-year (29-Feb), age computed *at quote date* vs today, back-dating, timezone; goal horizon dates.
- **Identity / PII (SG/AIA):** NRIC / FIN / passport formats + **checksum validity**, masking, duplicate-contact-by-NRIC.
- **Currency / locale:** thousands separators (`1,000,00` malformed), decimals, negative-sign styles, rounding, precision (>2 dp).
- **Security payloads:** SQL/script/XSS **injection** in free-text (contact name, goal name).
- **Whitespace / encoding:** leading/trailing spaces, unicode, emoji, RTL, zero-width chars.
- **Volume / stress:** many goals, max dependents, very large sums, long strings.
- **Persistence / staleness:** draft resumed after an app update; cached rate tables post-deploy.
- **Backend response shapes:** version mismatch, timeout, 5xx, truncated/partial JSON.
- **Cross-section consistency:** Insurance History ↔ Replacement (D10); retirement age ↔ goal horizon (B6/E3).

### R1.5 — Behavioural / persona data profiles (replace the single Set 24)
Author reusable **persona profiles** (like Set 24, but a set) that drive the *same* flow to *different* rule
branches — the behavioural lens:
- **Young Single** (surcharge bands, low liabilities) · **Family Breadwinner** (high need, multiple goals) ·
  **Near-Retirement** (short horizons, retirement-age edge) · **High-Net-Worth** (sum-assured caps) ·
  **Existing-Policyholder** (triggers Replacement & Switching / DIP paths).
Each persona = a data profile the pipeline reuses across sub-flows; together they exercise branches Set 24 never touches.

### R1.6 — Still open (deliberately not authored)
- **Formal methods** on the risk-band decision table (exhaustive band mapping) and the FHR wizard state model — flagged as a candidate for the *critical core*, not authored here (cost vs. value; buildplan §7).
- **Mutation testing** — run *after* this set is real to confirm it would catch a flipped band cutoff / inverted rule.
- **Authorization** — advisor-vs-other-advisor's client, supervisor review — out of the four sub-flows' scope; note for the wider suite.

---

## What to do with this next
1. Add this to the **golden set** (buildplan §3) as a *regulated, stateful, mobile* reference change —
   it stresses dimensions the auto-pricing worked example does not (long workflow, cross-section
   consistency, replacement/disclosure regulation).
2. Turn the **Abstain Register** into the first insurance-domain **spec-QA loop** output: 14 questions
   back to product/compliance is a deliverable in its own right.
3. Freeze the four sub-flows' **coverage skeletons** and run the **consistency test** (buildplan §3d):
   regenerate N times → confirm the same skeleton (A1–A12 / B1–B14 / C1–C12 / D1–D12) recurs before
   trusting the generator on this flow.
