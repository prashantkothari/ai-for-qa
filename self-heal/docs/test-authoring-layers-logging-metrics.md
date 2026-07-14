# Layered Scenarios, Logging & Effectiveness — Test Authoring

## Context
Test cases so far describe *what the user does*. But a single user action ripples through **three
layers** — **User (UI/journey) → App (API/services) → DB (persistence/state)** — and most escaped
defects hide *between* layers (the UI showed X, the DB stored Y). This doc: (1) mocks one action across
all three layers with **sample data** to surface *what else* needs testing, (2) defines **what must be
logged** to make those tests diagnosable and the advice auditable, and (3) defines **how we measure the
effectiveness of the authoring itself**. Builds on the eval rubric in
[`test-authoring-agent-buildplan.md`](test-authoring-agent-buildplan.md) §3 and the insurance sample in
[`test-authoring-insurance-sample-set.md`](test-authoring-insurance-sample-set.md).

---

## 1. One action, three layers — a worked trace (sample data)

**Persona (`Family Breadwinner` profile):** Advisor `ADV-8821`, Contact NRIC `S1234567D`, age 38,
income S$96,000, 2 dependents, mortgage S$420,000. Quotation `SQS-000734`, rate-table `v2026.2`.
**Action under trace:** *Needs Analysis → Add Goal → Education, S$200,000, 12 years.*

| Layer | What happens (sample data) |
|---|---|
| **User (UI)** | Tap **Add Goal** → type=`Education`, target=`200,000`, horizon=`12` → **Save**. UI shows a goal row + updated "Total need: S$X". |
| **App (API)** | `POST /quotation/SQS-000734/goals` `{type:"EDU", target:200000, horizonYears:12}` → needs-calc service runs (PV assumptions, rate `v2026.2`) → `201 {goalId:"G-3", pvNeed:172400, totalNeed:1394800}`. |
| **DB (state)** | `INSERT goals(quote_id, goal_id, type, target, horizon, pv_need, created_by, ts)`; `UPDATE quotation SET total_need=1394800`; `INSERT audit_log(event:"goal_added", inputs, rule_version:"needs-2.3", rate_version:"v2026.2", advisor:"ADV-8821", ts)`. |

**Reading it top-to-bottom is where new tests appear** — the value that per-screen cases miss.

---

## 2. What ELSE this surfaces to test (the cross-layer gaps)

| # | Cross-layer test | Why it only appears across layers | Sample oracle |
|---|---|---|---|
| L1 | **Shown = sent = stored = shown-back** | UI `200,000`, API `200000`, DB `200000`, summary re-render must all agree | all four equal; no locale/rounding drift |
| L2 | **Calculation integrity** | PV/`totalNeed` computed in App, displayed in UI, persisted in DB | `pvNeed`, `totalNeed` identical across API resp, DB row, UI |
| L3 | **Atomic total-need update** | delete/edit a goal → App recompute → DB update | `total_need` = Σ active goals after every op; no stale value |
| L4 | **Audit-log completeness** | every advice decision must be logged for compliance | one `audit_log` row per rule-bearing action, with rule+rate version |
| L5 | **Rate/rule version stamping** | quote must pin the *filed* rate version | DB quote carries `rate_version`; changing rates mid-draft flagged |
| L6 | **Idempotency** | double-tap / retry Save | one `goals` row, not two; `totalNeed` counted once |
| L7 | **Referential integrity** | delete goal | no orphan rows; dependent recommendations recomputed |
| L8 | **Draft persistence** | advisor exits mid-FHR, returns | draft `SQS-000734` restored to exact step + values |
| L9 | **Concurrency** | same draft open on two devices | last-write rule defined; no silent overwrite / corruption |
| L10 | **Migration / back-compat** | schema change ships, old draft reopened | pre-migration draft still loads & computes correctly |

These map straight onto the R1 method blocks in the insurance doc (API/contract, MBT journey,
fault-injection, property invariants) — the layered view is *why* those blocks exist.

---

## 3. What needs to be logged

Two audiences: the **app** must log to be auditable + testable; the **test run** must log to be
diagnosable + reproducible; and the **generator** must log provenance to be improvable.

### 3a. App / product logging (observability that makes it testable & compliant)
| Log | Fields (sample) | Enables |
|---|---|---|
| **Decision log** | action, inputs, outputs, `rule_version`, `rate_version`, advisor, `ts`, `correlation_id` | L4/L5 oracles + regulatory audit trail |
| **Calc log** | formula id, inputs, intermediate PV, result | L2 calculation-integrity checks |
| **State transition** | screen from→to, draft id, save/resume events | L8 draft-persistence tests |
| **Error/fault** | service, error code, retry count, user-facing message shown | G-block fault-injection oracles |
| **Rule/rate version registry** | which versions were live at quote time | L5 + reproducing a past quote exactly |

> Rule of thumb: **if a case's oracle can't be checked from a log or the DB, the app isn't observable
> enough — that's itself a finding.** Testability is a product requirement, not an afterthought.

### 3b. Test-run logging (diagnosable + reproducible failures)
| Log | Fields | Enables |
|---|---|---|
| **Run header** | run_id, release/sprint, platform (web/mobile), build, env, seed | repro + the Release/Runs UI |
| **Case result** | case_id, data_profile, expected vs **actual**, pass/fail/blocked | the List-view status column |
| **Evidence** | API req/resp captured, DB snapshot, UI DOM/screenshot at failure | root-cause without re-running |
| **Correlation** | `correlation_id` linking the test action → the app's decision log | cross-layer failures traced end-to-end |
| **Repro** | seed / data-profile id / exact inputs | deterministic re-run (Antithesis-style) |

### 3c. Generator provenance (so authoring can improve)
Log, per generated case: the **technique/lens** that produced it, the **prompt + seed**, a
**confidence tag** (`asserted / measured / abstained`), and **which coverage-critic rule** (buildplan
§6b) it satisfies. This is what lets the learning loop (strategy §10) attribute an escaped defect to a
missing lens.

---

## 4. How we measure effectiveness of the authoring (the scorecard)

Separate **authoring** quality (are these the right cases?) from **execution** results (did they pass?).
Effectiveness = **leading indicators** (measurable at authoring time) + **lagging indicators** (proven
in the field). Tag every number `measured / proxy / asserted`.

### Leading — measurable now, against the golden set
| Metric | Definition | Target |
|---|---|---|
| **Coverage recall** | of dimensions/ACs an expert covered, % we hit | headline — set a bar |
| **AC traceability** | % ACs with ≥1 case; % cases traced to an AC | ~100% |
| **Oracle-present rate** | % cases with a real pass/fail check (or explicit abstain) | ~100% |
| **Dual-branch integrity** | % abstain-dependent cases that are dual-branch, not asserted (buildplan §6b.1) | 100% |
| **Method-coverage** | % of the change-type's applicable paradigms represented (§6b.9) | 100% of applicable |
| **Redundancy** | % near-duplicate cases (equivalence/pairwise should suppress) | low |
| **Hallucination rate** | % cases referencing non-existent fields/behavior | ~0 |
| **Consistency** | variance of the coverage *skeleton* across N runs / different users | stable skeleton |

### Lagging — proven over releases
| Metric | Definition | Signal |
|---|---|---|
| **Escaped-defect catch** | of past prod bugs, % a generated case would have caught (backtest) | the honest one |
| **Escape rate trend** | prod defects per release in areas the tool authored | should fall |
| **Mutation score** | % injected faults the authored set kills (run post-authoring) | suite strength |
| **QA accept/edit/reject** | fraction shipped unedited; edit-distance on the rest | human trust |
| **Abstain quality** | % abstains product confirms were genuinely undefined (not laziness) + resolution turnaround | judgment calibration |
| **Time / cost to author** | wall-clock + tokens per change | ROI |

**Composite:** a release-over-release **scorecard** — leading metrics gate whether a set ships;
lagging metrics validate the leading ones actually predict field quality. If coverage-recall is high
but escapes don't fall, the *golden set or rubric is wrong* — fix the measure, not just the output.

---

## 5. Next
1. Instrument the app decision/calc/audit logs first — **without them, L1–L5 oracles aren't checkable**
   (testability is a prerequisite, not a test).
2. Add `correlation_id` end-to-end so a failed case links straight to the app's decision log.
3. Stand up the leading-metric scorecard on the golden set (buildplan §3) before scaling generation.
4. Backtest escaped defects to calibrate that coverage-recall actually predicts fewer escapes.
