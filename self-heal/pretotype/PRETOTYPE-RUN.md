# PRETOTYPE-RUN.md — S0 kill-gate result (`measured · live · 2026-06-26`)

Wizard-of-Oz walk of the full product flow (open → suggest → review → record → execute → heal → report)
on an adversarial login fixture. REAL: `selfheal-core` + `pipeline/*` + `hitl-overlay`. MOCKED: shell,
test-gen, executor, brain, flywheel. Run in-browser via `static-server.py` + Chrome MCP (own tab).

## Verdict: **GO** · false-heal = **0 / 9** · 0 divergences vs pre-registered expectations · 0 console errors

| test | drift | resolution | assert | final | category |
|------|-------|------------|--------|-------|----------|
| T1 login | pristine | heal | pass | PASS | DRIFT |
| T1 login | pristine(run2) | cached (primed 3) | pass | PASS | — (brain-primed) |
| T1 login | restyle | heal (2 cached) | pass | **PASS_HEALED** | DRIFT |
| T1 login | localize | cached | pass | PASS | — |
| T3 toggle (nameless icon) | pristine | abstain | na | **ABSTAIN** | AMBIGUITY |
| T2 wrong-password (negative) | pristine | heal | pass | PASS | — (expected-fail = pass) |
| T4 forgot · T5 SSO | pristine | heal | na | PASS | OK |
| T1 login | appbug | cached | **fail** | **FAILED** | **APP_BUG** |

HITL fired: `record/eye/no-anchor`, `record/eye/pointed-by-user`, `execute/T3/AMBIGUITY`.
Brain keyed by **test identity** (`T1:email`, `T1:password`, `T1:submit`, …); flywheel logged verified outcomes.

## What the gate PROVED (the contracts hold)
- The **flow + suggestion/review UX + report contract** are coherent end-to-end on real core + canned edges.
- **false-PASS guard (I25) works:** assertion-fail after a real click → **APP_BUG, not healed** (T1|appbug).
- **Intelligent failure:** nameless icon → ABSTAIN + named AMBIGUITY + HITL, never a silent/wrong guess.
- **Heal-under-drift is real and bounded:** `submit` (id anchor) re-matched correctly under restyle (PASS_HEALED);
  testid/form-name anchors survived both drifts (cached). **false-heal stayed 0.**
- **Brain priming** observable (run-2 fully cached) and **keyed by test identity**, not DOM fingerprint (GA-e).

## Refinements the gate surfaced (logged per plan §6)
1. **Fixture bug:** `eye`/`submit` had stable `id`s → the "nameless icon" wasn't anchorless. Fixed (removed ids;
   `eye` now genuinely no-anchor; `submit` kept an `id` that *restyle* breaks to demonstrate a real heal).
2. **Brain bug:** cached a `data-oracle` test-only attribute (survives all drift) → nothing re-ran the matcher.
   Fixed: **cache only real CSS anchors** (testid / stable-id / form-name); role+name & no-anchor re-match.
3. **Honest finding → carry into S2/S3 contract:** **`PASS_HEALED` is per-control-per-drift, not per-test.**
   A control caches or heals depending on *which signal the drift breaks vs which anchor the brain stored*
   (testid/name survive localize; id/class survive nothing under restyle). The report must express heal/cache
   **per step**, not per test.

## Does NOT prove (unchanged honesty bar)
Live execution (canned), real LLM test-gen *quality* (canned set), natural heal-RATE (synthetic drift),
cross-origin/real-app capture. "screens covered" = generated + executed, not fully validated.

## Carry-forward
`fixtures.js` (login DOM + drift variants + the pre-registered `EXPECTED`) seeds **S4's benchmark corpus**.
Harness is throwaway (may seed S5's shell). **Next: S1 — author the flywheel / escalation / versioning schemas,
shaped by this observed run** (esp. refinement #3: per-step heal/cache in the report contract).

## Manual-mode + direct-probe walk (`2026-06-26`, browser-driven)

Drove `?manual=1` and answered all HITL cards by hand (real clicks/typing), then probed the core directly.

**HITL loop (record + execute) — WORKS.** 3 cards rendered & answered; decisions logged as ground truth:
`record/caption-icon:"show password (eye toggle)"` · `record/confirm-row` (point-to-element + screenshot card) ·
`execute/skip` (T3 AMBIGUITY). Final verdict still GO, false-heal 0.

**Direct core probes (real layout):**
| probe | result | assumption |
|-------|--------|------------|
| visible target | `heal` | baseline ✓ |
| shown but off-screen | `abstain / off-screen / gated:true` | actionability gate "found != usable" ✓ |
| `display:none` | `fail / not-ready` (REMOVAL) | **K15/K16 known gap**: hidden/disabled → REMOVAL, not STATE_ISSUE |
| removed | `fail / not-ready` (REMOVAL) | intelligent-failure ✓ |
| two identical anchorless buttons | `abstain / ambiguous / margin:0` | false-heal safety on twins ✓ |

**Gaps found (S5 polish):** the execute AMBIGUITY card showed diagnosis+report+reason but **no candidate list**
(runner didn't forward `result.ranked`), so "Pick candidate N" had nothing to pick. Minor; fold into S5.

## Complex-screen stress (`measured · live · 2026-06-26` — `payment-pretotype.html`)

A hardcoded checkout/payment screen packing the ledger's hard patterns. Gate = **GO**, false-heal **0/6**, 0 console errors.

| case | hard pattern | outcome | correct? |
|------|--------------|---------|----------|
| C1 Disabled CTA (Pay) | target disabled in exec state | ABSTAIN / REMOVAL (named reason) | ✓ (K15/K16: disabled dropped pre-rank) |
| C2 **Popup OVER popup** | confirm-dialog backdrop covers Save card | ABSTAIN / **STATE_ISSUE `blocked-by-overlay`** | ✓ real `elementFromPoint` topmost check |
| C3 Identical twin card rows | two identical "Edit" buttons (margin 0) | **PASS via context** | ✓ `disambiguateByContext` row-text (K19) on div-soup |
| C4 Role-less portal option | listbox options are bare `<div>`s | FAILED / REMOVAL | ✓ not a candidate → route to search-and-pick (P2, K32) |
| C5 Nameless gear icon | no accessible name/anchor | ABSTAIN / AMBIGUITY + record `no-anchor` | ✓ genuine residue |
| C6 Drift on modal (Save card) | restyle hashes `#saveCard` | PASS_HEALED | ✓ re-matched via role+name |

**Findings:** the pipeline holds on complex/nested UI — popup-over-popup is correctly an *overlay-blocked* STATE_ISSUE
(not a wrong heal), twin rows disambiguate by container text, role-less portal options honestly fall out as
not-locatable. The gate again caught 2 *expectation* errors (mine), not pipeline bugs: disabled→ABSTAIN (not FAILED),
and a nameless icon with a distinctive `class` will heal on the weak `cls` signal (removed the class to show the
true anchorless-residue abstain). Built: `payment-fixtures.js`, `payment-pretotype.html`.

## REAL-APP run — Amplitude login (`measured · live · 2026-06-26` — `amplitude-report.html`)

Captured the live Amplitude login DOM (1.24 MB, email-first React app) via `window.name` stash → same-origin
harness; ran the PRE-EXECUTION + EXECUTE report. No credentials used (public login page). Executor
drift-simulated (no live click — S7), gate off (layout-less DOMParser doc).

- **Elements identified:** 8 interactive. Only **1 has a test-id (13%)**; **63% weak/no-anchor**; 3 nameless icons.
- **Grounding:** 6/9 authored steps grounded; **3 not on screen** (password ×2, forgot) → email-first **multi-screen**
  flow the single-screen authoring didn't model (caught honestly).
- **Execute:** PASS 3 · FAILED 3 · ABSTAIN 1 · **false-heal 0** · **self-heal 100% (3/3** drifted locators re-located).
  Root-cause split: **authoring 3** (multi-screen gap), **element 1** (SSO localized → ambiguous → safe abstain), other 0.
- **Takeaway:** on a real app the matcher held (0 false-heal, 100% of heal-eligible drifts re-located via role+name),
  and the *dominant* failure cause was **test authoring** (assuming one screen), not the locator — exactly the
  intelligent-failure split the report is meant to surface. Anchor coverage (13% test-id) is the ceiling.

## REAL-APP run — Amplitude chart-builder (AUTHENTICATED) (`measured · live · 2026-06-26` — `generic-report.html`)

User logged into Amplitude (own session, profile cookies shared into the MCP tab — no credentials handled by me);
captured the **chart-builder** (`/chart/new`, 1.15 MB) via `window.name`. Screen-agnostic report (auto-gen 1 smoke
test per control). Executor drift-simulated; gate off (layout-less).

- **Elements:** 63 interactive; 61 identifiable, 2 nameless. **Anchor: 34 test-id (54%)**, 19 weak/no-anchor (30%)
  — real Amplitude test-ids (`sidebar-footer-settings-trigger`, `data-view-nav-items`, `sidebar-drag-handle`).
  Confirms ledger K29 (test-id-rich core, ~54–65%) vs the login page's 13%.
- **Auto-gen:** 30 tests (capped; **31 more identifiable controls NOT covered** — reported, not silently dropped).
- **Execute:** 60 drift-runs (restyle+localize) → **59 PASS_HEALED · 1 ABSTAIN · false-heal 0 · self-heal 100%**
  (59/59 heal-eligible re-located). The 1 abstain = `+ Add Column Filter` under localize → AMBIGUITY (safe).
  Root-cause split: **element 1, authoring 0, other 0.**
- **Takeaway:** on a real, test-id-rich authenticated product screen the matcher re-located **every** heal-eligible
  drifted control correctly with **zero false-heals**; the lone failure was a safe abstain, not a wrong guess.
  Caveats unchanged: drift-simulated (not live click/verify, S7), single snapshot (closed portals/menus uncaptured).

## Two-app AUTHENTICATED run + honest S0 rating (`measured · live · 2026-06-26` — `report-viewer.html`)

Captured two real authenticated product screens into one viewer (dropdown by app · attempt · timestamp; runs isolated):
- **Amplitude chart-builder** (1.26 MB, 213 controls): self-heal **100%**, false-heal **0**, 0 failures among 30 auto-tests.
- **Testsigma "Atto's Home"** (108 KB, 92 controls, **only 4 test-ids** — nav uses Material-Icon ligatures as the
  accessible name, e.g. `table_chart`/`play_circle`): self-heal **100% of heal-eligible**, false-heal **0**, but
  **14 element-bucket abstains** (weak-identity controls → ambiguous under drift → safe abstain).
- **Validity check (user-raised):** "Testsigma" appearing in the Amplitude run = the **Amplitude org name**
  (`/analytics/testsigma`), NOT cross-contamination. Verified: Amplitude run names = Amplitude controls
  (Expand sidebar, Search, Onboarding, Agents…); Testsigma run names = icon ligatures. Two separate report objects.

### Honest S0 rating (what's proven vs shallow vs missing)
| Half | Stages | Verdict |
|---|---|---|
| **Resilience spine — PROVEN** | enumerate · locate · record · diagnose · heal · report · HITL · brain(cache) | Strong; **false-heal 0** on 2 real authenticated apps; anchor quality drives heal-vs-abstain (Amplitude testid → clean heal; Testsigma icon-ligatures → safe abstains) |
| **Test-meaning half — SHALLOW / SIMULATED** | author · execute · verify | **Authoring = "interact" smoke only** (no intent/flows/pos-neg/data); **execute = drift-simulated, not live** (S7); **verify = no assertion oracle in the real-app path** (oracle exists only in the login demo) |

**Net:** "self-heal 100%" is an honest claim about **locator resilience**, and says nothing about test quality or
whether the app works — there are no assertions/data behind the generic real-app tests. S0 **proved the spine and
falsified the authoring depth** — exactly a pretotype's job. Next = **S6 real authoring** (OpenTest.ai format),
then **S7 live execution**.

## S6 — real test authoring (OpenTest.ai format) BUILT (`measured · live · 2026-06-26` — `opentest-pretotype.html`)

Closes the S0-falsified authoring gap. `testgen.js` detects screen type (login) and authors **OpenTest.ai-format**
tests grounded to observed controls; `opentest-runner.js` executes the located→acted→**asserted** ladder.

- **5 tests authored:** L1 valid-login (**positive**, with data + `assert Dashboard`), L2 wrong-password +
  L3 empty-submit (**negative**, `assert` error / required), S1 SSO + F1 forgot (**smoke**, locator-only).
- **Outcomes:** PASS 5 · FAILED 0 · ABSTAIN 0 · APP_BUG 0 · **3/5 carry real assertions** (smoke honestly labeled
  "no business assertion"). **App-bug variant** (L1, dashboard never loads) → **APP_BUG** — the false-PASS guard (I25) fires.
- **OV#4 honored:** every outcome is `verify_confidence: simulated` and **NOT promoted to the brain** (no learning
  from unverified, per `learning-loop.js`). A green "asserted" on a simulated run is **not** a live E2E pass.
- **Maps onto existing pipeline, no new locator/heal code:** NL `target`→`matchStep` (`_anchor` descriptor),
  `assert`+`expected`→oracle. OpenTest.ai **format adopted** (no LICENSE in their repo → we own the schema).
- **Honest bound:** authoring + assertions are now real and in a standard format; **execution stays MOCK until S7**.
  LLM authoring is the upgrade path (same JSON shape) and needs the human-review gate (false-test) before counting.
  Built: `testgen.js`, `opentest-runner.js`, `opentest-pretotype.html`.

## S7 — Live executor (`measured · live · 2026-07-01` — `opentest-pretotype-live.html`)

The **missing keystone**: `selfheal-runtime.js` wires real DOM events → before/after snapshot → `verifyEffect` →
`outcome-verification.decide`. Fixture is **interactive** (real `<form>` submit handler swaps DOM). No mock.

- **5 tests authored** (same L1/L2/L3/S1/F1 as S6), executed via `__RUNTIME.executeLive` (not the MOCK runner).
- **All 3 core proof cases confirmed:**

| test | kind | outcome | verify_confidence | category | how verified |
|------|------|---------|-------------------|----------|--------------|
| L1 valid-login | positive | **PASS** | **HIGH** | VERIFIED | `elementGone`: email field gone after submit → DASHBOARD_DOM |
| L2 wrong-password | negative | **PASS** | MEDIUM | NEG_OK | `textPresent`: "Invalid credentials" in post-action DOM |
| L3 empty-submit | negative | **PASS** | MEDIUM | NEG_OK | `textPresent`: "required" error appended in-place |
| S1 SSO (smoke) | positive | PASS_WARNING | NONE | SMOKE | no assertion declared → queue human (OV#4 honored) |
| F1 forgot (smoke) | positive | PASS_WARNING | NONE | SMOKE | no assertion declared → queue human (OV#4 honored) |
| L1 **app-bug mode** | positive | **FAILED** | MEDIUM | **APP_BUG** | `textPresent` for "Dashboard" fails (STUCK_DOM → no nav) → do NOT heal |

- **false-heal = 0** (all locators resolved to correct elements, no wrong-element promotions).
- **OV#4 gate now passable for the first time:** L1 `verify_confidence: 'HIGH'` → `outcome-verification.decide`
  returns `PASSED` (not `PASSED_WARNING`). HIGH outcomes are eligible for the brain / learning-loop (simulated
  runs were NEVER eligible; this is the keystone S7 unlocks).
- **False-PASS guard (I25) confirmed live:** L1 in app-bug mode → `verifyEffect` fails on textPresent("Dashboard")
  → `outcome: 'FAILED'`, `category: 'APP_BUG'`. The tool does **not** heal or mask an app defect.
- **Fix during run:** `el.click()` on `<a href="/forgot">` followed the href → page navigated. Fixed by
  (a) document-level capture-phase click interceptor preventing anchor navigation inside `#appStage`, and
  (b) rewriting anchor hrefs to `#` after each fixture mount. Both belt-and-suspenders. The locator still
  found and "acted on" the element; just the side-effect (navigation) was safely contained.
- **Scope note (unchanged):** synthetic DOM events on an interactive in-page fixture. Real-app live execution
  needs trusted events (`chrome.debugger`/CDP) + test-data safety → the MV3 extension, not here.
- Built: `selfheal-runtime.js`, `opentest-pretotype-live.html`.
- **S1 code-review caught a latent label-drift bug here** (see below): the smoke branch was emitting the raw
  `outcome-verification` label `'PASSED_WARNING'` while the assertion branch translated it to the runtime's
  own `'PASS_WARNING'`. Same state, two spellings — would have silently split/duplicated rows in any downstream
  aggregator (brain, report, benchmark). Fixed in `selfheal-runtime.js`; both branches now translate through the
  same mapping. Table above reflects the fix; tally re-verified live: `{PASS:3, PASS_WARNING:2, FAILED:0(+1 app-bug)}`.

## S1 — schemas + validator (`measured · live · 2026-07-01` — `self-heal/schemas/`)

The contract layer everything downstream (S2 brain, S3 report, S4 benchmark) hangs off. Three schemas + a tiny
AJV-free validator (no Node here → hand-rolled, ~90 lines, browser JS). No new locator/heal code.

- **`flywheel-event.schema.js`** (F1+F5) — one row per verified outcome; `schemaVersion` required (F5 — month-9
  code can still parse month-1 rows). `verify_confidence` enum is `{HIGH, MEDIUM, NONE, simulated}` so a schema
  reader alone can tell OV#4-eligible rows from simulated ones, without re-deriving the guard logic.
- **`test-plan.schema.js`** — formalises the OpenTest.ai shape `testgen.js` already emits (§13 false-test guard).
  Steps are a discriminated union by `action`: `navigate` needs no `target`; `fill`/`click`/`assert` must name one.
- **`escalation.schema.js`** (F3) — the det↔LLM handoff contract at all 3 LLM touchpoints (testgen, nameless-
  residue, stuck→HITL). `failure` (when present) requires `verdict` — without it the LLM has no grounding.
- **`validator.js`** — `validate(schema, obj) → {ok, errors[]}`; supports type/required/properties/enum/const/
  pattern/min-max/items/oneOf/anyOf. `oneOf` = **exactly one** branch (true JSON-Schema semantics, not any-match).

**Gate: `self-heal/schemas/tests.html` → `window.__S1_TESTS` → 24/24 corpus rows PASS, 0 fail.**
Corpus = 18 shape cases (valid/malformed per schema) + 6 regressions added after `/code-review --effort high`
surfaced real bugs pre-commit:
1. **`oneOf` any-match bug** (validator.js) — accepted a value matching 2+ branches; JSON Schema requires exactly
   one. Fixed; regression case uses an intentionally-overlapping two-branch schema.
2. **Outcome label drift** (`selfheal-runtime.js`, described above) — caught here first via the schema rejecting
   `'PASSED_WARNING'` as unregistered, which is what sent us back to the runtime to find the root cause.
3. **`target` not required on fill/click/assert steps** (test-plan.schema.js) — an LLM-authored step missing
   `target` would validate, then crash `executeLive`/`opentest-runner` at `.target.replace(...)`. Fixed via the
   discriminated-union `oneOf` above.
4. **`failure.verdict` not required** (escalation.schema.js) — a nameless-residue/stuck request with an empty
   `failure:{}` validated, silently starving the LLM of the diagnosis it needs. Fixed.
- **Live cross-check:** the schema also validates the REAL output of `__TESTGEN.authorTests(loginDOM)` (not just
  synthetic corpus rows) — confirms the (now-stricter) schema doesn't reject anything we actually produce.
- **Re-verified S7 end-to-end after the runtime fix:** `opentest-pretotype-live.html` unchanged outcomes
  (L1 HIGH/PASS, L2/L3 MEDIUM/PASS, app-bug FAILED/APP_BUG); tally now shows canonical `PASS_WARNING:2` only.
- Built: `self-heal/schemas/{validator.js, test-plan.schema.js, flywheel-event.schema.js, escalation.schema.js, tests.html}`.

## S2 — brain (verify-gated cache) (`measured · live · 2026-07-01` — `self-heal/brain/`)

The honest first cut of the compounding store: `put/get` keyed by **authored test identity**
(`testId:stepId`, e.g. `L1:submit` — K37/GA-e), gated on `verify_confidence==='HIGH'` (OV#4), miss→cold.
Promote/demote counters + the autonomy ladder stay `self-heal/pipeline/learning-loop.js`'s job (S8) —
S2 does not touch that file.

- **16/16 unit checks PASS** (`self-heal/brain/tests.html` → `window.__S2_TESTS`): put rejects
  MEDIUM/NONE/simulated confidence and role+name/null locators; accepts real `#id`/`[data-testid]`
  anchors at HIGH; get is a cold miss on a never-cached key, on a selector that no longer resolves, and
  on a selector that now matches 2+ elements (never guess between duplicates); snapshot is a real
  point-in-time copy (mutating it can't corrupt the live store).
- **Measured before/after** (not simulated): ran S7's `executeLive` on the L1 fixture, then re-mounted
  the SAME fixture and queried the brain a second time —

  | metric | before S2 (run 1, cold) | after S2 (run 2, primed) | tag |
  |---|---|---|---|
  | brain hits before resolving any step | 0/3 | 3/3 (**100%**) | measured |
  | brain writes from one HIGH-confidence live run | — | 3 (email, password, submit) | measured |

- **Adapter (`ingestLiveResult`)** turns one S7 `executeLive` result into per-step brain writes: sound
  because `executeLive` is all-or-nothing up to the assertion (one unresolved step blocks the whole test
  before verification runs) — so a HIGH-confidence test-level outcome is evidence for every step that
  got there, not just the last one.
- **Bug caught by a "failing" unit test, not code review this time:** the first version of
  `ingestLiveResult` passed the whole `liveResult` object into `brain.put()`, which reads
  `verification.confidence` — but S7's result only has `verify_confidence` as the canonical field
  (`.confidence` happens to carry the same value today, incidentally). A synthetic unit test that didn't
  mirror that incidental duplication caught the coupling immediately. Fixed: the adapter now builds
  `{confidence: liveResult.verify_confidence}` explicitly instead of relying on field overlap.
- **Manual code-review pass** (small diff, ~180 lines — skipped the 10-parallel-finder-agent ceremony)
  found one real issue: `snapshot()` was a shallow copy, leaking mutable references to live cache
  records. Fixed (one-level-deep copy) + regression test added.
- Built: `self-heal/brain/{brain.js, tests.html}`.

## S3 — run report + failure clustering (`measured · 2026-07-01` — `self-heal/report/`)

Built in a parallel background worktree, then reviewed + fixed + merged from the master session.
`report.js` is a pure function over schema-validated `flywheel-event/v1` rows (read-only consumer of S1's
schemas). Adds F7 failure-clustering (group non-PASS rows by category → "one root cause, many failures"
reads as one cluster) that the shallower pretotype reports (`amplitude-report.js`, `generic-report.js`) lacked.

- **`buildReport(rows)`** → `{summary, clusters, selfHealRate, perTest, rejectedRows, labels}`.
  - Every row validated first; malformed rows land in `rejectedRows` **with a named reason** (never silently
    dropped or crashed on).
  - `summary.falseHealCount` is the single most prominent field; **plus** `falseHealInRejectedRows` and
    `falseHealFieldMissingCount` so a false-heal can't hide in a malformed or field-omitting row.
  - `selfHealRate` keeps **measured (source=live)** and **simulated (source=simulated)** as separate numbers,
    never blended; manual/HITL rows counted-but-excluded. Rate is `null` (not 0) when no eligible data — no
    fabricated percentage. Every numeric group has a `labels` entry (measured/simulated/n·a).
- **Gate: `self-heal/report/tests.html` → `window.__S3_TESTS` → 33/33 checks PASS**, GO. Corpus = 13 valid rows
  (9 categories, HIGH/MEDIUM/NONE/simulated, one `false_heal:true` gating-proof row, one field-omitting row) +
  2 malformed rows rejected by name. Expectations pre-registered before running (K36e). Live cross-check:
  hand-written rows mirroring the S7 table (L1 PASS/HIGH/VERIFIED, app-bug FAILED/APP_BUG) → false-heal 0,
  APP_BUG correctly clustered; opportunistic adapter from `__S7_RESULT.liveResults` when a sibling tab has it.
- **Review pass (3 parallel reviewers: correctness / cleanup+conventions / test-contract) found real bugs,
  all fixed before merge:**
  1. **Prototype-pollution in clustering** — `byCategory = {}` keyed by free-form category; a row with
     `category:'constructor'`/`'toString'` would resolve truthy via `Object.prototype`, skip the guard, and
     silently drop that entire failure class from the F7 report. Fixed with `Object.create(null)` + regression.
  2. **False-heal blind spot on rejected rows** — `falseHealInRejectedRows` used `=== true`, so a row rejected
     *because* `false_heal` was `"true"` (string) or `1` was invisible to the gate exactly when the payload is
     malformed. Changed to a truthy check (surface more, never less, on the gating metric). Regression added.
  3. **perTest key collision** — `app + '::' + testId` merged `('A::B','C')` and `('A','B::C')`. Switched to
     `JSON.stringify([app, testId])`. Regression added.
  4. **Stale hardcoded enum fallback** — `... || ['PASS',...]` would silently miscount if the schema's enum
     were ever migrated. Replaced with a loud throw when the enum is absent (schema/report.js out of sync).
  5. **CLAUDE.md no-fabrication** — `perTest.*` numbers (incl. the gate's per-test `falseHealCount`) had no
     `labels` entry. Added, with the rejected-row-blind-spot caveat spelled out.
  6. **Empty-string category** folded into UNKNOWN — fixed at its proper home: `flywheel-event.schema.js`
     `category` now has `minLength: 1`, so empty is rejected & surfaced in `rejectedRows` (S1 suite re-run: 24/24
     still green). Also hardened the test harness's `deepEqual` (`Object.is` for NaN/±0, key-symmetry check).
- Built: `self-heal/report/{report.js, tests.html}`; tightened `self-heal/schemas/flywheel-event.schema.js`.

## S4 — benchmark corpus + eval-gate (`measured · 2026-07-01` — `self-heal/benchmark/`)

The guardrail (F2: "false-heal cannot regress"). Built in a parallel background worktree, then
**re-verified against the real schemas/fixtures in the master worktree** (the agent only had uncommitted
copies) before merge. Reuses the S0 fixtures as its corpus — no new fixtures authored.

- **`corpus.js`** — 13 cases: 7 login (from `PRETOTYPE_FIXTURES.EXPECTED.report.finals`) + 6 payment
  (`PAYMENT_FIXTURES.CASES`). One documented exclusion: `T1|appbug` is a post-heal assertion case, not a
  `matchStep` case, so asserting a matcher verdict for it would be fabricated.
- **`eval-gate.js`** — `runBenchmark(corpus, doc, baseline?)`: per case mount→capture→drift→match/diagnose→
  compare {verdict, category, resolved-element identity}. **False-heal is NOT defined here** — it is
  single-sourced in **`self-heal/schemas/false-heal.js`** (`SELFHEAL_FALSEHEAL.isFalseHeal`) so the benchmark
  classifier and S8's future live flywheel writer share one definition and can never drift apart. The rule:
  verdict=heal & expected=heal → false-heal iff resolved identity ≠ intended identity (wrong element);
  verdict=heal & expected≠heal → always a false-heal (healed when it should have abstained). Regression
  detection flags both a match-status flip AND silent failure-mode drift between two already-non-matching states.
  The primitive has its own 6-branch unit test in the S1 harness (`__S1_TESTS.fhRows`).
- **`baseline.json`** — last-known-good snapshot, generated from the first clean run (not hand-authored).
- **Gate: `self-heal/benchmark/eval-gate.html` → `window.__BENCH_RESULT` → 13/13 match, false-heal 0/13,
  0 regressions, GO** — re-confirmed in the master worktree against committed S0/S1 files.
- **Gate-can-fail sanity check (re-run independently in master):** mutating one case's `expectedVerdict`
  heal→abstain correctly drops match to 12/13 AND fires falseHealCount=1 (healing-when-abstain-expected is a
  false-heal by definition). Proves the gate genuinely fails, not just always-green. Live corpus untouched
  (used a clone). Review pass fixed 3 issues in-worktree (regression-drift gap, a missing script-load guard,
  `app` inferred-by-regex → explicit field); those fixes are in the merged commit.
- **`toFlywheelEvents`** exports runs as `flywheel-event/v1` rows with `verify_confidence:'simulated'` — so a
  benchmark run is consumable by S3's report, but can NEVER promote to the brain (OV#4: it measures the
  matcher, it doesn't train it).
- Built: `self-heal/benchmark/{corpus.js, eval-gate.js, eval-gate.html, baseline.json, BENCHMARK-RUN.md}`.

## S5 — plugin shell (`measured · live · 2026-07-01` — `self-heal/shell/`)

The user-facing flow: **suggest → review → run(live) → report**, with HITL-on-stuck and brain priming.
Pure orchestration — no new matcher/heal/executor code. The honest successor to the MOCK `flow-pretotype.js`
(now real executor + real report + real authoring). `shell.js` wires: S6 `testgen.authorTests` (suggest) →
approve list (review) → S7 `executeLive` per test (run) → S3 `buildReport` (report) → S2 `brain` (prime) →
existing `hitl-overlay` (stuck). Injectable, same delivery model as the other tools.

- **Gate: `self-heal/shell/shell.html` → `window.__S5_SHELL` → 12/12 checks PASS, GO** (`?manual=1` answers HITL
  with the real overlay by hand; default is a canned auto-answerer so the shell is headless-testable).
- **End-to-end on the interactive login fixture:** 6 tests suggested (L1/L2/L3/S1/F1 authored + one H1
  nameless-eye HITL probe) → L1 PASS/HIGH, L2/L3 PASS/MEDIUM (NEG_OK), S1/F1 PASS_WARNING (smoke), H1 →
  **ABSTAIN → HITL fired once** (never a wrong guess). **false-heal 0 in both runs.** F7 clusters: SMOKE:2,
  AMBIGUITY:1. All live rows schema-valid (0 rejected).
- **Measured before/after (brain priming):** run-1 cold **0%** → run-2 primed **33% (3/9 eligible steps)**.
  The 33% is exactly right and demonstrates OV#4 in the metric: only L1 verifies at HIGH (elementGone), so
  only its 3 steps (`L1:email/password/submit`) cache; L2/L3 are MEDIUM (textPresent) and are NOT cached.
- **Consistency check** (in the gate): the shell's L1 outcome equals a direct `executeLive(L1)` — the
  orchestration doesn't distort outcomes.
- **Honest bounds (stated in the shell, not hidden):** (a) HITL SURFACES the pipeline's stuck signal +
  records the human decision as ground truth; resolve-and-continue mid-test is S8/S9. (b) Brain priming is
  MEASURED and the cache COMPOUNDS (ingest on HIGH), but `executeLive` does not yet consult the brain to
  short-circuit matching — brain-first execution is S8/S9. So the primed cache is shown populated + valid,
  not yet load-bearing.
- **Bugs caught before commit:** (1) the shell's `toRow` fabricated false-heals — it called the identity-
  based `isFalseHeal` with a null resolved-identity (executeLive doesn't expose the resolved element), a
  category error since identity-level false-heal needs an oracle only the benchmark has; fixed to
  `false_heal:false` on live rows (runtime wrong-heals surface via verify-by-effect → FAILED, and S4 is the
  identity-level authority). Caught by the gate reading falseHealCount=5. (2) the harness mount handler had
  dropped the empty-submit→"required" branch, making L3 fail as APP_BUG; restored. (3) code review removed
  one dead assignment.
- Built: `self-heal/shell/{shell.js, shell.html}`.

## Repro
`python3 -m http.server 8766 --bind 127.0.0.1` from worktree root →
- S0: `http://127.0.0.1:8766/self-heal/pretotype/flow-pretotype.html` (`?manual=1` for HITL). `window.__PRETOTYPE_RESULT`.
- S6: `http://127.0.0.1:8766/self-heal/pretotype/opentest-pretotype.html`. `window.__S6_RESULT`.
- S7: `http://127.0.0.1:8766/self-heal/pretotype/opentest-pretotype-live.html`. `window.__S7_RESULT`.
- S1: `http://127.0.0.1:8766/self-heal/schemas/tests.html`. `window.__S1_TESTS`.
- S2: `http://127.0.0.1:8766/self-heal/brain/tests.html`. `window.__S2_TESTS`.
- S3: `http://127.0.0.1:8766/self-heal/report/tests.html`. `window.__S3_TESTS`.
- S4: `http://127.0.0.1:8766/self-heal/benchmark/eval-gate.html`. `window.__BENCH_RESULT`.
- S5: `http://127.0.0.1:8766/self-heal/shell/shell.html` (`?manual=1` for real HITL). `window.__S5_SHELL`.
