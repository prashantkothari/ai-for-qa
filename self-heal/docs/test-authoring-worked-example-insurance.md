# Worked Example (filled) — Auto-Insurance Quote Pricing Change

## Why this example
A **medium-complexity, business-critical** change: insurance pricing = money + regulatory exposure +
branching rules + boundaries + state. If the pipeline from
[`test-authoring-agent-buildplan.md`](test-authoring-agent-buildplan.md) handles this cleanly, it
handles most SaaS features. This doc **mocks the full execution** — every stage filled with real
content — then reviews input→strategy→output so we can verify the format before formalizing it.

**The change under test (the input we were "handed"):**
> *Auto-insurance online quote flow — new pricing rules at the Quote step:*
> 1. **Young-driver surcharge:** primary driver **under 25** → **+40%** on base premium.
> 2. **Multi-vehicle discount:** **2+ vehicles** on the policy → **−15%**.
> 3. **Minimum premium floor:** final annual premium **never below $300**.
> *Must reflect in the bindable premium shown to the customer and passed to checkout.*

---

## STAGE 1 — INTAKE (structured form, filled)
The QA submits the *same shape* every time — no free prompt.

| Field | Value |
|---|---|
| **Change type** | Backend logic (pricing rules) + UI display touchpoint |
| **Component / area** | Quote engine · Quote summary screen · Checkout handoff |
| **User story** | "As a customer, I get an accurate premium reflecting my age, vehicle count, and the price floor, so I can bind a correct policy." |
| **Acceptance criteria** | AC1 driver <25 → +40% surcharge · AC2 ≥2 vehicles → −15% · AC3 final ≥ $300 floor · AC4 premium shown = premium bound |
| **Platform target** | Web (SaaS) + Mobile app |
| **Env notes** | Rates must match filed regulatory rate tables; currency USD; premiums rounded to cent |
| **Out of scope (stated)** | Payment processing internals, login, policy documents generation |

**Agent's clarifying question raised at intake** *(abstain-over-guess):*
> *"Order of operations is unspecified: is the −15% multi-vehicle discount applied **before or after**
> the +40% young-driver surcharge? The two orders give different premiums. → needs product decision."*
> Product answers: **surcharge first, then discount, then floor.** (Now an explicit oracle input.)

---

## STAGE 2 — CLASSIFY (change type + blast radius)
- **Type:** Backend business-rule change with a UI display dependency. *Not* an infra/schema change.
- **Blast radius:** quote calculation, quote→checkout premium handoff, any cached/quoted premiums,
  regulatory rate reporting. **Nearby at-risk behavior:** existing single-driver / single-vehicle
  quotes (regression), renewal re-quotes.
- **What NOT to author:** login, payment gateway internals, PDF policy docs (out of scope) — the agent
  explicitly suppresses these instead of padding the set.

---

## STAGE 3 — STRATEGY SELECTION (deterministic bundle + rationale)
Derived from the change-type rules table — *not* invented by the LLM:

| Technique (from landscape) | Why it's in the bundle here |
|---|---|
| **Decision table** | 3 interacting rules (age band × vehicle count × floor) → enumerate combinations |
| **Boundary-value analysis** | age 24/25 cutoff, vehicles 1/2, premium near $300 floor |
| **Property invariants** | "final premium ≥ $300 always", "more risk ⇒ never cheaper" (monotonicity) |
| **Pairwise** | combine age-band × vehicle-count × base-premium-band without full explosion |
| **Differential (regression)** | old engine vs new for unaffected quotes → must be unchanged |
| **State / handoff** | premium shown at Quote == premium at Checkout (AC4) |
| **Platform packs** | Web: multi-tab/refresh recalculation · Mobile: offline quote, backgrounding mid-quote |

**What the QA signs off on (the editable test plan):**
> "Cover the rule decision-table rows, boundaries on age/vehicles/floor, 2 pricing invariants, the
> quote→checkout consistency, and regression on unaffected quotes. Add mobile offline + web refresh.
> Will NOT re-test payment or login."

---

## STAGE 4 — BRAINSTORM (lens panel output — raw, pre-dedup)
- **Rule-Lawyer:** every row of {age<25?} × {vehicles≥2?} × {below floor?}.
- **Boundary-Hunter:** age 24 vs 25; vehicles 1 vs 2; premium landing at $299.99 vs $300.00.
- **Adversary:** age = 0 / negative / 200; 999 vehicles; base premium = $0; tampered client-side premium.
- **Confused user:** add a 2nd vehicle then remove it (discount must revert); change DOB after quote.
- **Ops/SRE:** rate-table service down mid-quote; stale cached premium after rule deploy.
- **Regression-Keeper:** a 40-yr-old single-vehicle quote must be byte-identical to pre-change.

---

## STAGE 5 — COVERAGE CRITIC (gaps found → added)
Adversarial "what's missing / which case has no oracle?" pass flagged:
- ❗ **Order-of-operations case missing** → added Case for surcharge-then-discount vs the (wrong) reverse.
- ❗ **Floor-after-discount interaction** → a young-driver + multi-vehicle quote that *would* dip below $300.
- ❗ **AC4 (shown == bound) had no explicit case** → added.
- ❗ **Rounding oracle undefined** at half-cent → raised as a second product question (abstain).
Loop re-runs until critic is quiet.

---

## STAGE 6 — TEST DATA SYNTHESIS (classes → boundaries → pairwise)
Deterministic libs produce values; LLM only labels classes + oracles. Base premium fixed at **$600/yr**
for worked math (surcharge → ×1.40; discount → ×0.85; then floor $300).

**Equivalence classes**
- Age: `<25 (surcharge)` | `≥25 (none)` — boundary at 24/25
- Vehicles: `1 (no discount)` | `≥2 (discount)` — boundary at 1/2
- Floor: `above floor` | `at/below floor after math`

**Pairwise data table (age-band × vehicles × base band) with computed oracle**

| # | Age | Vehicles | Base | Calc (surcharge→discount→floor) | **Expected premium** |
|---|---|---|---|---|---|
| D1 | 30 | 1 | $600 | none | **$600.00** |
| D2 | 22 | 1 | $600 | ×1.40 | **$840.00** |
| D3 | 30 | 2 | $600 | ×0.85 | **$510.00** |
| D4 | 22 | 2 | $600 | ×1.40 ×0.85 | **$714.00** |
| D5 | 24 | 1 | $600 | ×1.40 (24 is "under 25") | **$840.00** |
| D6 | 25 | 1 | $600 | none (25 not under 25) | **$600.00** |
| D7 | 30 | 2 | $300 | ×0.85 = $255 → **floor** | **$300.00** |
| D8 | 22 | 2 | $250 | ×1.40×0.85 = $297.50 → **floor** | **$300.00** |

**Nasty-data rows:** age `-1 / 0 / 200`, vehicles `0 / 999`, base `$0 / negative`, client-tampered premium.

---

## STAGE 7 — OUTPUT ARTIFACT (filled, in the Scenario→Case→Data schema)
This is the right-pane deliverable format. Sample (abridged to the representative set):

```
SCENARIO S1 — Young-driver surcharge applied correctly
  changeRef: AC1 | technique: decision-table+BVA | risk: HIGH | oracleType: value
  ├─ C1  Under-25 primary driver, single vehicle
  │     pre: policy w/ 1 vehicle; base $600
  │     steps: set primary driver DOB → age 22; request quote
  │     data: D2            expectedOracle: premium == $840.00        tracesTo: AC1
  ├─ C2  Boundary — age exactly 24 (still surcharged)
  │     data: D5            expectedOracle: premium == $840.00        tracesTo: AC1
  └─ C3  Boundary — age exactly 25 (NOT surcharged)
        data: D6            expectedOracle: premium == $600.00        tracesTo: AC1

SCENARIO S2 — Multi-vehicle discount
  changeRef: AC2 | technique: decision-table+BVA | risk: HIGH | oracleType: value
  ├─ C4  2 vehicles → 15% off            data: D3   oracle: premium == $510.00   tracesTo: AC2
  ├─ C5  Boundary — 1 vehicle, no discount data: D1  oracle: premium == $600.00   tracesTo: AC2
  └─ C6  Add 2nd vehicle then remove it → discount reverts
        oracle: premium returns to $600.00 (no sticky discount)      tracesTo: AC2

SCENARIO S3 — Rule interaction + minimum floor
  changeRef: AC1+AC2+AC3 | technique: decision-table+property | risk: CRITICAL | oracleType: value+invariant
  ├─ C7  Surcharge THEN discount (order enforced)   data: D4  oracle: premium == $714.00  tracesTo: AC1,AC2
  ├─ C8  Discount pushes below floor → clamps to $300 data: D7 oracle: premium == $300.00  tracesTo: AC3
  ├─ C9  Young+multi still floored at $300           data: D8  oracle: premium == $300.00  tracesTo: AC3
  └─ C10 INVARIANT: premium ≥ $300 for ALL generated inputs (property-based, 500 samples)  tracesTo: AC3

SCENARIO S4 — Quote↔Checkout consistency (AC4)
  ├─ C11 Premium shown at Quote == premium at Checkout handoff
        oracle: quote.premium == checkout.premium (exact)            tracesTo: AC4

SCENARIO S5 — Negative / adversarial
  ├─ C12 Age = -1 / 0 / 200        oracle: validation error, NO quote produced      risk: HIGH
  ├─ C13 Vehicles = 0              oracle: rejected — policy needs ≥1 vehicle
  └─ C14 Client-tampered premium sent to checkout  oracle: server recomputes, rejects tampered value

SCENARIO S6 — Regression (differential)
  └─ C15 30-yr-old, 1 vehicle, $600  oracle: new engine == old engine (unchanged)   tracesTo: regression

SCENARIO S7 — Platform
  ├─ C16 [Web] refresh mid-quote → premium recomputes identically, no stale value
  └─ C17 [Mobile] app backgrounded during quote → on resume premium intact / re-fetched, not corrupted

FLAGGED (abstain, not fabricated):
  Q1 rounding rule at half-cent — undefined by spec → product decision needed
```

---

## STAGE 8 — Coverage & traceability summary (auto-generated)
| Acceptance criterion | Cases | Covered? |
|---|---|---|
| AC1 young-driver surcharge | C1,C2,C3 | ✅ (+ boundaries) |
| AC2 multi-vehicle discount | C4,C5,C6 | ✅ (+ revert) |
| AC3 minimum floor | C8,C9,C10 | ✅ (+ invariant) |
| AC4 shown == bound | C11 | ✅ |
| Regression (nearby) | C15 | ✅ |
| Platform (web/mobile) | C16,C17 | ✅ |
| **Open (flagged)** | Q1 rounding | ⚠️ needs product |

Dimensions hit: positive · boundary (both sides) · negative · rule-interaction · invariant · state ·
consistency · regression · platform · adversarial. **No fabricated coverage; one honest open question.**

---

## Review checkpoints — verify input→output *before* formalizing
1. **Input scenarios** — is the intake form capturing everything needed? *(Here: change-type, ACs,
   platform, out-of-scope, and it correctly surfaced the order-of-operations ambiguity as a question.)*
2. **Strategy pick** — is the bundle right and defensible? *(Decision-table + BVA + property + differential
   + platform packs — matches a money/rules change; correctly excludes payment internals.)*
3. **Output format** — is the Scenario→Case→Data schema usable, traceable, and exportable? *(Each case
   has an explicit oracle + tracesTo; coverage table auto-rolls-up; abstentions are visible.)*

**Confirmation:** the pipeline **does** cover a medium-complexity, business-critical insurance flow —
including the parts naive LLM prompting misses: the **order-of-operations ambiguity** (raised as a
question, not guessed), the **floor×discount interaction** (C8/C9), the **shown==bound** consistency,
and **regression on unaffected quotes**. Numbers above are **worked/asserted from the stated rules**
(not measured from a live system) — tagged accordingly per the no-fabrication rule.

---

## Mock of the *actual flows* (so we're sure what's coming our way)
End-user journeys the cases exercise:
- **Web quote-to-bind:** enter DOB + vehicle(s) → see premium on Quote screen → proceed to Checkout →
  premium must match (C11) → bind. *Risk points:* recompute on edit (C6), refresh (C16), tamper (C14).
- **Mobile quote:** same, plus offline/backgrounding (C17) and re-fetch on resume.
- **Renewal re-quote (regression):** existing policy re-priced under new rules → old unaffected profiles
  unchanged (C15); newly-eligible profiles now surcharged/discounted correctly.

---

## What to formalize next (once this sample is signed off)
1. Freeze the **intake form fields** and the **Scenario→Case→Data schema** exactly as shown.
2. Turn STAGE 3's bundle selection into the **deterministic change-type → technique lookup table**.
3. Add this filled example to the **golden set** (buildplan §3) as a scored reference for eval.
4. Codify the **abstain/flag** behavior (Q1-style) as a first-class output, not an edge case.
5. Run the **consistency test**: regenerate this same input N times → confirm the coverage skeleton (S1–S7)
   is stable across runs/users before rollout.
