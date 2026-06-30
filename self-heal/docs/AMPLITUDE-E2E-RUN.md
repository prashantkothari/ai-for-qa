# AMPLITUDE-E2E-RUN.md — full loop on REAL Amplitude chart-builder, v2 (lessons-incorporated + HITL)

`measured · live · 2026-06-25` · Amplitude **chart-builder** (`app.amplitude.com/analytics/testsigma/chart/new/…`),
Data-Table / Retention views with the **Events picker portal open** at capture.

v2 of [`GONG-E2E-RUN.md`](GONG-E2E-RUN.md). Same thesis — **assembly of already-measured pieces, NOT
new matcher logic; core (`selfheal-core.js`) stays PRISTINE** (verified: `git diff selfheal-core.js`
empty; suites 14/14 + 22/22 after the run, §7) — but with the **6 Gong lessons (K35) baked in** and
three capabilities the plan (§14) asked for: **auto-generated + stratified cases**, **property-based
drift fuzzing** (5 mutators × 40 cases = 240 cells), and **search-and-pick** for role-less portals,
plus a **live in-browser HITL overlay** (record-time + execute-time cards).

> **What this measures (and what it does NOT).** Only **round-trip** (same DOM) and **synthetic
> drift** (5 seeded mutators) are available in-session — there is no *natural* Amplitude drift to
> observe. Every number below measures the **MECHANISM** (does the assembled loop locate / heal /
> abstain / diagnose correctly, and is it *property-invariant* under drift), **NOT a natural heal
> rate.** All cells are `measured` on `synthetic`/`round-trip` regimes. Ground truth = a `data-oracle`
> mark on the recorded element (survives DOMParser cloning + every mutator). The gating metric is
> **false-heal**.

---

## 0. Pre-registered falsification (fixed BEFORE the run)

- **false-heal ceiling = 0.** A heal to any genuinely-distinguishable element other than the recorded
  target, in *any* case × *any* of the 5 drift regimes, **fails the run** (Ledger I2).
- The **property-based invariant** asserted per cell: **correct-heal OR abstain — NEVER false-heal.**
- A pre-registered **expected outcome** (heal / abstain) per `(stratum, regime)` is the secondary
  signal; divergence from it is reported honestly, not engineered away.
- **Byte-identical twins** (provably indistinguishable; only position separates them — K34) are scored
  **outcome-equivalent**: healing to any member of the recorded twin-set = correct, because the oracle
  itself cannot justify calling one byte-identical sibling "wrong". Every other case is scored
  **strictly** against the oracle. `false-heal` ⇒ healed to a genuinely **distinguishable** non-target.

**Result: ceiling HELD. false-heal = 0 across every case × regime — 0 / 240 cells.**

---

## 1. Method (env-constrained — Ledger K14/K18, same transfer trick as Gong)

No Node / no Playwright. Executor = **Chrome MCP + `static-server.py` (port 8765)**, own tab; a second
session shares the browser. Amplitude is cross-origin **https** (mixed-content blocks loading our
http://localhost modules), so the **window.name transfer trick** is used:

1. In the Amplitude tab (`amplitude-stash.js`): **content-settle gate** (poll testid count until
   stable — lesson 1), **viewport-tag** every in-viewport candidate `data-vp="1"` (lesson 2), serialize
   `documentElement.outerHTML` into **`window.name`** (survives same-tab cross-origin nav).
2. Navigate the *same* tab to `amplitude-e2e-harness.html` on the static server → **same-origin**, real
   modules load via `<script src>` exactly like `tests/adversarial-validation.html`.
3. The harness parses `window.name` into a detached DOMParser doc and runs the pipeline.

**Capture state:** content-settled in **2 polls**, **142 viewport-tagged** candidates, **118 testids**,
**1.16 MB** stashed, **Events picker portal open** (1 portal, 1 search input).

**Reuse map (verbatim, unmodified):** `captureStep`, `descFromStep`, `matchStep`,
`WEB.extract/actionable/candidates`, `bestLocator`, `verifyEffect` (core) · `captureContext`,
`disambiguateByContext` (incl. **ordinal** fallback, K34), `containerOf`, `rowTextOf`
(`candidate-generation.js`) · `diagnoseFailure` (`change-diagnosis.js`) · `report`
(`failure-reporter.js`) · `verify`/`decide`/`CONFIDENCE` (`outcome-verification.js`) · `mutate`/
`parseHTML` (ported from `live-inspector.js`, same mechanics as the Gong runner). New code lives in the
**tools layer only**: `amplitude-e2e-runner.js`, `amplitude-e2e-harness.html`, `amplitude-stash.js`,
`hitl-overlay.js`, `hitl-live-demo.js`.

**Pipeline per cell:** `matchStep` → if non-heal, `disambiguateByContext` (row-text → ordinal) → for
role-less **portal options**, the **search-and-pick** lane (detect portal search `<input>`, model
type→filter→lone-result) → `WEB.actionable` gate → `diagnoseFailure` → `report`.

**Two honest scoping notes (load-bearing, same as Gong):**
- **Gate is layout-free here.** Pipeline runs on a detached DOMParser doc (no layout →
  `getBoundingClientRect`=0) → `WEB.actionable` called with `gate:false`. The gate is validated on real
  layout in the adversarial suite (overlay→STATE_ISSUE, K15/K16), not re-proven here.
- **verify-by-effect is modelled.** No live click issued (shared browser, side-effecting controls).
  Each heal records the expected effect + `verifyConfidence`; the three-way rule
  (`outcome-verification.decide`) is exercised in logic, not executed live (`ranLive:false`).

---

## 2. The 6 Gong lessons (K35) — baked in and where

| # | Lesson (Gong) | How it shows up here | Evidence |
|---|---|---|---|
| 1 | content-settle gate before capture | `amplitude-stash.js` polls testid count until stable | settled in **2 polls** |
| 2 | viewport-scoped candidates only | stash tags `data-vp`; runner `scopeViewport()` restricts the universe | **142** tagged (vs 466 raw) |
| 3 | recordability is per-view (K29) | measured + reported per-view, never averaged | **48%** this (portal-open) view; **63%** closed chart-builder |
| 4 | flag-driven HITL at record time | `captureStep.flag` → `__hitl.show({kind:'record'})` | **25** record cards fired |
| 5 | capture-time flakiness is the real risk | content-settle + viewport-scope are the mitigation | 0 mis-captures this run |
| 6 | HITL is the heal-rate unlock | record + execute cards render existing signals, live | overlay + live demo, §6 |

---

## 3. Auto-generated + stratified cases (plan §14.2 — Momentic `explore`-borrowed)

Instead of 9 hand-picked steps, the runner **enumerates every viewport-scoped candidate**, buckets by
regime, and caps per stratum → **40 recorded cases** (`captureStep`+`captureContext` each, expected
outcome pre-registered). Raw bucket sizes before capping: portal-option 30 · testid-unique 45 ·
name-only-unique 44 · twin-identical 24 · nameless-icon 21 · twin-distinct 2.

| stratum | n (capped) | regime archetype | anchor reality |
|---|---|---|---|
| **testid-unique** | 10 | Amplitude's strength (K29) | `testid` — strongest |
| **name-only-unique** | 8 | role+name / id-fragment, unique | weak but unique |
| **twin-distinct** | 2 | repeating, distinct container text (Clue-2) | row-text disambiguates |
| **twin-identical** | 8 | identical config-block twins (K30) | only ordinal can separate |
| **portal-option** | 6 | role-less option leaves in an open portal (K32/K33) | search-and-pick |
| **nameless-icon** | 6 | no name, no anchor | genuine residue (expect abstain) |

---

## 4. The run — 40 cases × 6 regimes = 240 cells  `measured · synthetic`

Regimes: `round-trip` · `restyle` (hashed class/id reshuffle) · `localize` (text reversal) ·
`attr-shuffle` (style/title/class-token churn) · `reorder` (shuffle twin-set member order — the
**adversarial test of the ordinal guard**) · `add-remove-twin` (clone an extra twin → count changes).

### 4.1 Per-regime tally

| regime | correct-heal | false-heal | abstain | fail |
|---|---|---|---|---|
| round-trip | 36 | **0** | 4 | 0 |
| restyle | 35 | **0** | 5 | 0 |
| localize | 19 | **0** | 21 | 0 |
| attr-shuffle | 35 | **0** | 5 | 0 |
| reorder | 35 | **0** | 5 | 0 |
| add-remove-twin | 35 | **0** | 5 | 0 |
| **total** | **195** | **0 / 240** | 45 | 0 |

### 4.2 Per-case matrix  (`H`=correct-heal · `.`=abstain · `X`=false-heal — none occurred)

Regime order: `round-trip · restyle · localize · attr-shuffle · reorder · add-remove-twin`

| case | stratum | locTier | flag | bi | outcomes | via | anchor |
|---|---|---|---|---|---|---|---|
| TID1–TID10 | testid-unique | testid | — | 0 | `HHHHHH` | — | e.g. `chart-type`, `*-nav-items` |
| NMO1 | name-only-unique | role+name | weak-identity | 0 | `HH.HHH` | — | "Create new" |
| NMO2 | name-only-unique | role+name | weak-identity | 0 | `HH.HHH` | ordinal | "Create" |
| NMO3–NMO6 | name-only-unique | id-fragment | ambiguous | 0 | `HH.HHH` | — | "Agents", "All Content", … |
| NMO7 | name-only-unique | role+name | weak-identity | 0 | `HH.HHH` | — | "Unpin Product Analytics" |
| NMO8 | name-only-unique | id-fragment | ambiguous | 0 | `HH.HHH` | — | "Marketing Analytics" |
| **TWD1** | twin-distinct | id-fragment | ambiguous | 0 | `......` | — | "Users" — row-text == name → safe abstain |
| **TWD2** | twin-distinct | testid | — | 0 | `HHHHHH` | — | `chart-header-count-by-dropdown` |
| **TWI1, TWI3** | twin-identical | testid | — | 1 | `HHHHHH` | — | `undefined-filter-{0,1}-remove` (distinct testids) |
| **TWI2, TWI4, TWI6** | twin-identical | role+name | weak-identity | 1 | `HHHHHH` | ordinal | "is" (=) ×3 — ordinal heals position |
| **TWI5** | twin-identical | role+name | weak-identity | 1 | `HH.HHH` | ordinal | "+ Filter by" — localize abstains (safe, §4.4) |
| **TWI7, TWI8** | twin-identical | testid | — | 1 | `HHHHHH` | — | `hanging-segment-0-add-filter`, `input` |
| **POR1–POR6** | portal-option | role+name | weak-identity | 0 | `HH.HHH` | search-and-pick | Events picker options |
| **NMI1** | nameless-icon | none | no-anchor | 0 | `H.....` | ordinal | round-trip-only ordinal heal |
| **NMI2** | nameless-icon | none | no-anchor | 0 | `HH.HHH` | context | container row-text heals |
| **NMI3–NMI5** | nameless-icon | none | no-anchor | 0 | `......` | — | `presentation`, 62 peers → safe abstain |
| **NMI6** | nameless-icon | none | no-anchor | 0 | `HHHHHH` | — | unique `treegrid` → heals on role/structure |

### 4.3 What each regime proves
- **testid-unique heals ALL 6 regimes — including `localize`.** A `data-testid` is an **attribute**, not
  text, so text-reversal can't touch it. **This is the structural advantage over Gong** (Gong had 0
  testid → every win was role+name + context, all of which `localize` defeats). 10/10 TID + 4/8 TWI
  (the testid'd twins) + TWD2 ride straight through localization.
- **restyle = attr-shuffle = round-trip** (35/36 heal, 0 false): hashed class/id/style churn is
  correctly ignored (low-stability signals). Confirms the matcher heals through cosmetic drift.
- **localize collapses every text-only heal to abstain (0 false)** — name-only, row-text-context, and
  search-and-pick all fail **safe** when their text signal is translated away. 36→19 heals, **0
  false-heal** — the pre-registered safety expectation, reproduced on a second, richer app.
- **reorder + add-remove-twin: byte-identical twins still heal (outcome-equivalent), 0 false.** Under
  `reorder` the ordinal lands on a *different physical* byte-identical sibling — scored correct because
  the siblings are provably indistinguishable (K34). The `add-remove-twin` count-change is caught by the
  ordinal guard for the cases where it matters (TWI5 abstains), proving the guard's boundary works.

### 4.4 search-and-pick (K33) — modelled, the Amplitude-specific lever Gong didn't need
The Events portal is a role-less option list (K32: `0` `role=option`, options are `div` leaves) **with a
search `<input>`**. The search-and-pick lane models: type the recorded target → filter the option set →
if exactly one remains, that's the pick. **Measured (modelled, `ranLive:false`):** all 6 POR cases
collapsed **n₀=87 options → n₁=1** via the search input and healed correct on round-trip/restyle/attr/
reorder/add-remove. Under **localize** the typed (recorded) target no longer matches the reversed option
text → **no collapse → safe abstain** (this is the correct fail-safe, not a miss). Execution
(type→filter→click) is **P2 runtime**; the collapse + search-input detector are what's exercised here.

### 4.5 verify-by-effect (modelled)
Each heal recorded its expected effect (`domChange`) + `verifyConfidence`; no live click issued. The
three-way `decide()` rule is exercised in logic (`PASSED_WARNING` for unverifiable), **not** machine-
confirmed. Real round-trip verification needs `selfheal-runtime.js` (P2).

---

## 5. Pre-registration corrections (honest — the predictor was refined, not the data)

The **first** run's naive pre-registration diverged on **47/240** cells. Analysis showed every
divergence was **SAFE** (never a false-heal) and pointed at 3 errors in the *prediction*, which were
corrected; the **outcomes themselves never changed** (deterministic). After correcting the predictor,
divergence dropped to **19/240, all SAFE**:

| correction | what the naive pre-reg got wrong | refined rule |
|---|---|---|
| testid survives localize | predicted testid-unique would abstain on localize | testid-unique → heal **all** regimes |
| search-and-pick fails safe on localize | predicted portal-option heals on localize | portal-option → abstain on localize |
| byte-identical twins = outcome-equivalent | predicted twin-identical abstains on reorder/localize/add-remove | twin-identical → heal all (any sibling correct, K34) |

**Remaining 19 divergences (all safe), by stratum:**
- **nameless-icon ×12 → correct-heal where abstain was the conservative default.** These are nameless
  controls that are **structurally unique** (unique `treegrid`; or healed by ordinal/context). Honest
  finding: *nameless ≠ unhealable when the control is structurally unique* — a bonus, scored to the
  right oracle, not predicted by the safe default.
- **twin-distinct ×6 → mostly safe abstain (TWD1 "Users": row-text == name → no extra signal → abstain
  in every regime).** One (`TWD2`, testid'd) heals under localize. Both safe.
- **twin-identical ×1 → TWI5 "+ Filter by" abstains under localize** (ordinal's peer re-query keys on the
  recorded role+name; localization changes the name → 0 peers match → guard declines → safe abstain).

**Net:** 0 false-heal; every "mismatch" is the system being *more conservative* than predicted, or
healing a *uniquely-identifiable* control the safe default didn't credit. None is a safety failure.

---

## 6. HITL — live in-browser overlay (plan §14.4, the user's ask)

`self-heal/tools/hitl-overlay.js` — a fixed-position panel, standalone (no core dependency, cross-origin
injectable; productization path = bookmarklet → content-script extension). Renders **only signals the
pipeline already emits** (I2 contract: heal confidently OR hand a named, actionable card).

- **Record-time card** (fires on `captureStep.flag` ∈ no-anchor/ambiguous/weak-identity): shows
  descriptor + container row-text + suggested anchor; buttons **[Confirm row identifies it · Strengthen
  anchor (note testid) · Pick viewport · Caption icon · Skip]**. **25 fired** in the sweep.
- **Execute-time card** (fires on abstain AMBIGUITY/REMOVAL · first context-heal · verify "unverified"):
  shows `diagnoseFailure` category + `failure-reporter` message + a **real candidate list** (each with
  its container row-text); buttons **[Pick candidate N · Confirm heal · Adjudicate-skip]**. **5 fired.**
- **Loop mechanism:** button onclick → `window.__hitl.decision`; runner awaits it (interactive) or
  auto-resolves + logs (sweep). Every decision is appended to `window.__hitl.log` as **ground truth**
  (feeds the P2 learning loop).

### 6.1 The "which control?" fix (live demo) — `hitl-live-demo.js`
The window.name trick navigates the capture tab away from the app, so cards rendered on the harness page
are **unanchorable** (a `presentation ""` card means nothing). Fix: render the human-facing cards **in
the live app tab** and **highlight the real element** (outline + scroll-into-view + label) as each card
shows. Demonstrated live this session against the running chart-builder:
- A **record-time** card on the "Any Active Event" twin — real control highlighted; user clicked through
  all four actions (Confirm row / Strengthen anchor / Pick viewport / Skip) — **12 decisions logged**.
- An **execute-time** AMBIGUITY card on the "+ Filter by" byte-identical twins — control highlighted,
  candidate list rendered (ordinal #0 = Starting-event block, #1 = Segment-by block).

This realizes the I2 contract live: every card is anchored to a visible, named control.

### 6.2 "Which control needs input?" — frozen DOM-clone thumbnail (robust to app drift)
The `window.name` transfer trick navigates the capture tab away from the app, and a live SPA also
re-navigates on its own (observed: the chart-builder appended `?sharingId=…` mid-session, wiping
injected globals — lesson 5). So a card must identify its control **even when the app isn't visible or
has changed**. The handling, shipped in both `hitl-overlay.js` and `hitl-live-demo.js`:
- **Record-time freeze:** at capture, `containerOf(el).outerHTML` is stored on the step (`thumbHTML`).
- **Card embeds a frozen DOM-clone preview:** the card renders that clone (ids neutralized, scaled,
  `pointer-events:none`). Rendered in the **live app tab** the clone inherits the app's stylesheets →
  it looks like the real control; rendered on the harness it still shows the markup/text. Either way the
  human sees *a picture of the exact control*, frozen at capture, immune to later app re-renders.
- **Live highlight when available; honest fallback when not:** if the element can still be re-located
  it's boxed on the page; if the app moved on and it can't be found, the card says so and shows the
  frozen preview instead of silently boxing the wrong element.
- A bitmap screenshot was deliberately avoided (needs a library / cross-origin perms); the same-document
  DOM clone is lighter, faithful, and cross-origin-safe. **Verified live** on the running chart-builder:
  the "Any Active Event" card showed the frozen clone + live highlight together after the app had
  re-navigated. All 30 sweep cards (25 record + 5 execute) carry a `thumbHTML`.

---

## 7. Suite status (core kept PRISTINE)

Re-run in-browser via the static server immediately after this E2E:
- **`selfheal-tests.html` (`runAll`): 14 / 14 web green; mobile `runMobile`: 4 / 4 green.**
- **`self-heal/tests/adversarial-validation.html` (`runAdversarial`): 22 / 22 green — all green.**
- **`selfheal-core.js` unchanged** (`git diff selfheal-core.js` empty). New artifacts live in the tools
  layer only.

---

## 8. Honest read — heal reach vs Gong (expected higher; it is)

| dimension | Gong (Outline) | Amplitude (chart-builder) |
|---|---|---|
| recordability (strong-anchor %) | ~0% | **48%** portal-open view · **63%** closed (K29) |
| testid present | 0 | **118** in view |
| heals under `localize` | 0 (all text-based) | **19** — every testid'd case (testid survives translation) |
| portal options | invisible / N/A | **operable via search-and-pick** (n₀87→n₁1, modelled) |
| identical-twin config blocks | "Play" twins (abstain) | **healed via ordinal** (byte-identical, K34) |
| **false-heal** | **0 / 51** | **0 / 240** |

1. **The full loop works on real Amplitude DOM**, auto-generating + stratifying 40 cases and fuzzing
   them across 6 regimes (240 cells) with **zero false-heals** — the pre-registered ceiling.
2. **Heal reach is materially higher than Gong, and for a structural reason:** Amplitude's chart-builder
   is testid-rich, and **testids survive localization** — so the one regime that zeroed Gong's heals
   (text reversal) still heals every anchored Amplitude case. Plus **search-and-pick** makes the
   role-less portal pickers *operable* even though their options aren't locatable elements (K33:
   operability ≠ element-locatability).
3. **Safety is identical and total:** 0 false-heal across 240 cells and 5 distinct drift modes,
   including the adversarial `reorder`/`add-remove-twin` that specifically attack the ordinal lever. The
   byte-identical-twin heals are scored **outcome-equivalent** and labelled as such — the one place where
   "correct-heal" ≠ "exact recorded node", honestly flagged.
4. **This is mechanism, not a natural heal-rate.** Synthetic + round-trip drift only; no natural
   Amplitude redesign was observed. The gate + verify are layout-free / modelled (P2 runtime to execute
   live). The honest deliverable is: *the assembled loop heals what it should, abstains on the residue,
   operates the portals via search, surfaces every fragile/ambiguous decision as a named HITL card —
   and produced **zero false-heals**.*

### Caveats
- Single capture, one app view; synthetic drift only (mechanism, not field heal-rate).
- `WEB.actionable` gate layout-free here (validated separately, K15/K16); verify-by-effect modelled.
- search-and-pick **collapse is modelled** (`ranLive:false`); live type→filter→click needs P2 runtime.
- byte-identical-twin heals scored **outcome-equivalent** (K34) — stated wherever it applies.
- recordability is **per-view** (K29): 48% with the portal open (role-less option divs dilute the
  denominator); the closed chart-builder measured 63%.
