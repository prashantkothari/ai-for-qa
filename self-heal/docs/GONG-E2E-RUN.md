# GONG-E2E-RUN.md — full loop proven end-to-end on REAL Gong DOM

`measured · live · 2026-06-24` · Gong call-share viewer, **Outline** tab
(`https://us-37530.app.gong.io/e/c-share/?tkn=…`, "First demo - internal").

Proves the assembled pipeline **record → drift → match → heal → diagnose → report** against a real,
captured Gong SPA DOM. This is **assembly of already-measured pieces**, not new matcher logic. The
matcher core (`selfheal-core.js`) was **not touched** (pristine Phase-0.5; suites still green — see §7).

> **What this measures (and what it does NOT).** Only **round-trip** (same DOM) and **synthetic
> drift** (restyle / localize, via `live-inspector.js` `mutate()`) are available in-session — there is
> no *natural* Gong drift to observe. So every number below measures the **MECHANISM** (does the
> assembled loop locate / heal / abstain / diagnose correctly on real markup), **NOT a natural heal
> rate**. All cells are tagged `measured` on synthetic regimes. Ground truth = a `data-oracle` mark on
> the recorded element (survives cloning + mutation). The gating metric is **false-heal**.

---

## 0. Pre-registered falsification (fixed BEFORE the run)

- **false-heal ceiling = 0.** A heal to any element other than the `data-oracle`-marked one, in *any*
  case × *any* regime, **fails the run** (Ledger I2: a wrong heal that passes the test is the
  catastrophic outcome; correct abstain is a deliverable, not a failure).
- A `correct-heal` requires `best.el`'s `data-oracle` == the recorded id. Anything else healing = false-heal.
- `abstain`/`fail` on a genuinely ambiguous or nameless control is **success**, not a miss.
- Localization (text-reversal) **must not** produce a false-heal — context that depended on text is
  expected to collapse to `abstain`, never to a wrong guess.

**Result: ceiling held. false-heal = 0 across every case × regime in both runs (0 / 51 heal-eligible cells).**

---

## 1. Method (env-constrained — Ledger K14/K18)

No Node / no Playwright. The local executor is **Chrome MCP + `static-server.py` (port 8765)**, the
project's established path. Driven in an **own tab** (a second session shares the browser).

The real Gong DOM is cross-origin **https** and ~4.4 MB, so it can neither load our http://localhost
modules (mixed-content block) nor be transcribed. The transfer channel used:

1. In the Gong tab: stash the (pruned) live DOM into **`window.name`** — it survives same-tab
   cross-origin navigation.
2. Navigate the *same* tab to the harness on the static server
   (`self-heal/tools/gong-e2e-harness.html`) → now **same-origin**, so the real modules load via
   `<script src>` exactly like `tests/adversarial-validation.html`.
3. The harness parses `window.name`, points the runner at it, and runs the full pipeline.

**Reuse map (verbatim, unmodified):** `captureStep`, `descFromStep`, `matchStep`, `WEB.extract`,
`WEB.actionable`, `bestLocator`, `verifyEffect` (core) · `captureContext`, `disambiguateByContext`,
`containerOf`, `rowTextOf` (`candidate-generation.js`) · `diagnoseFailure` (`change-diagnosis.js`) ·
`report` (`failure-reporter.js`) · `verify`/`decide` (`outcome-verification.js`) · `mutate`/`parseHTML`
(ported from `live-inspector.js`). Orchestration only lives in the new
**`self-heal/tools/gong-e2e-runner.js`** + harness (tools layer; core untouched).

**Pipeline per case per regime:** `matchStep` → if non-heal, `disambiguateByContext` → `WEB.actionable`
gate → `diagnoseFailure` → `report`.

**Two honest scoping notes (load-bearing):**
- **Candidate pool / cross-viewport.** Gong renders **desktop + mobile DOM trees simultaneously**
  (~15 000 `[role]`-bearing nodes; every control has a hidden twin). Run-1 ran on the full tree;
  **Run-2/3** scope to the **visible viewport** (drop hidden candidates by `getBoundingClientRect`)
  — i.e. exactly the set a real runner's `resolveScope(visibleOnly)` sees. Non-interactive structural
  `role`s on giant containers were trimmed for tractability; `containerOf`'s semantic row-roles
  (`listitem` etc.) were **kept** so per-section context survives.
- **Gate is layout-free here.** The pipeline runs on a detached `DOMParser` doc (no layout →
  `getBoundingClientRect` = 0), so `WEB.actionable` is called with `gate:false`. The gate is validated
  on *real* layout in the adversarial suite (overlay → `STATE_ISSUE`, Ledger K15/K16), not re-proven here.
- **verify-by-effect is modelled.** No live click is issued (shared browser, side-effecting media
  controls). Each heal records the *expected* effect (`domChange`/`urlChange`) + `verifyConfidence`;
  the three-way rule (`outcome-verification.decide`) is exercised in logic, **not** executed live.

---

## 2. Test cases (recorded from the live Outline DOM)

9 recorded steps spanning the regimes the plan asked for (`captureStep` + `captureContext` per step).
Gong has **0 testid and no stable ids** (only React-hashed `tab-:r…`) — so the "stable anchor" regime
is **honestly absent**; the strongest real anchor on this page is `role+name` (recordability ≈ 0%,
re-confirming K23/K27).

| case | target | regime | locator tier | flag |
|---|---|---|---|---|
| C1 | tab **"Outline"** | role+name (+ hashed id) | `role+name` | weak-identity |
| C2 | tab **"Highlights"** | role+name (+ hashed id) | `role+name` | weak-identity |
| C3 | button **"Copy all"** | name-only, ~unique | `role+name` | weak-identity |
| C4 | per-section **"Copy"** @ *Product Overview* | ambiguous ×32 (Clue-2) | `role+name` | weak-identity |
| C5 | per-section **"Copy"** @ *Agentic Approach* | ambiguous ×32 (Clue-2) | `role+name` | weak-identity |
| C6 | per-section **"Copy"** @ *Ad Hoc Generation* | ambiguous ×32 (Clue-2) | `role+name` | weak-identity |
| C7 | **"Play at 44:42"** | ambiguous ×8 (twin context) | `role+name` | weak-identity |
| C8 | **nameless** speaker-segment icon | nameless, identical context | `none` | no-anchor |
| C9 | nameless play icon (distinct context) | nameless | — | **not present in visible set** |

C9 (a `styles-module` play icon) was **not found** in the visible-scoped DOM (honest miss — it was
either hover-gated or in the hidden tree). Reported as missing, not silently dropped.

---

## 3. Run-1 — full tree (cross-viewport twins present)  `measured · synthetic`

Scope = the entire captured DOM, both viewports. **Every control has an identical hidden twin**
(`recCount = 2` for uniques, etc.), so the matcher correctly **cannot** choose desktop-vs-mobile, and
`disambiguateByContext` finds identical row-text on both → cannot break the tie.

| regime | correct-heal | false-heal | abstain | fail |
|---|---|---|---|---|
| round-trip | 0 | **0** | 9 | 0 |
| restyle | 0 | **0** | 9 | 0 |
| localize | 0 | **0** | 9 | 0 |

**Read:** 9/9 abstain, every one diagnosed `AMBIGUITY`. This is the **safety property on the worst
case** — a page that duplicates its entire control set still yields **zero false-heals**; the loop
degrades to honest "ambiguous, cannot disambiguate" (the K26 cross-viewport residue, generalised).

---

## 4. Run-3 — visible-viewport scope (what a runner sees)  `measured · synthetic` — the definitive run

Scope = visible controls only (hidden mobile tree dropped; semantic `listitem` row-containers kept).
640 candidates, 8 cases present (C9 absent).

| regime | correct-heal | false-heal | abstain | fail |
|---|---|---|---|---|
| **round-trip** | **4** | **0** | 4 | 0 |
| **restyle** (hashed class/id reshuffle) | **4** | **0** | 4 | 0 |
| **localize** (text-reversal) | 0 | **0** | 8 | 0 |

### Per-case (round-trip / restyle / localize)

| case | base `matchStep` | where the locator "failed" | `disambiguateByContext` fired? | round-trip | restyle | localize | diagnosis |
|---|---|---|---|---|---|---|---|
| C1 Outline tab | abstain `ambiguous` | 2 *visible* tab bars (dup header) → margin tie; both share identical tab-bar row-text → context can't separate | no (`via`≠context) | abstain | abstain | abstain | AMBIGUITY |
| C2 Highlights tab | abstain `ambiguous` | same as C1 (twin tab bar) | no | abstain | abstain | abstain | AMBIGUITY |
| **C3 Copy all** | abstain `ambiguous` | the 32 "Copy" buttons fuzzy-match "Copy all" at 0.85 (shared token + substring) → crowd the margin | **YES** (`via:context`, ctxMargin **0.83**) | **correct-heal** | **correct-heal** | abstain | DRIFT |
| **C4 Copy @ Product Overview** | abstain `ambiguous` | 32 identical "Copy" → exact margin tie | **YES** (`via:context`, ctxMargin **0.81**) | **correct-heal** | **correct-heal** | abstain | DRIFT |
| **C5 Copy @ Agentic Approach** | abstain `ambiguous` | 32 identical "Copy" | **YES** (`via:context`, ctxMargin **0.79**) | **correct-heal** | **correct-heal** | abstain | DRIFT |
| **C6 Copy @ Ad Hoc Generation** | abstain `ambiguous` | 32 identical "Copy" | **YES** (`via:context`, ctxMargin **0.77**) | **correct-heal** | **correct-heal** | abstain | DRIFT |
| C7 Play at 44:42 | abstain `ambiguous` | 8 instances; container row-text does **not** cleanly distinguish a single winner (twins) | no (context tried, didn't clear floor+margin) | abstain | abstain | abstain | AMBIGUITY |
| C8 nameless icon | abstain `ambiguous` | no name (descriptor = role+tag only); 69 nameless peers share identical container text | no | abstain | abstain | abstain | AMBIGUITY |

### What each column proves

- **`disambiguateByContext` fired (`via:context`) on C3–C6** — converting a `matchStep` **abstain** into a
  **correct-heal** using the recorded container row-text (Clue-2, K13/K19), on real Gong markup. The
  per-section `listitem` text (`"Product Overview…"`, `"Agentic Approach…"`, `"Ad Hoc Generation…"`) is
  the out-of-`scoreEx` signal that breaks the 32-way "Copy" tie. C3 "Copy all" heals because its own
  (tab-panel-level) container text is unique versus the section texts of the crowding "Copy" buttons.
- **restyle = round-trip** (4 heal / 0 false): hashed class/id reshuffle is correctly ignored
  (low-stability signals), text-bearing context survives → identical outcome. Confirms the matcher
  heals through cosmetic drift.
- **localize collapses all 4 context-heals to `abstain`, with 0 false-heal** — exactly the
  pre-registered safety expectation: when the row-text itself is translated/reversed, the recorded
  context no longer matches, so the deterministic disambiguator **declines to guess** rather than
  healing to a wrong section. Text-based context is genuinely defeated by localization; abstaining is
  the correct, safe behavior (the residue routes to the LLM gate, I26 — not to a false-heal).
- **C1/C2/C7/C8 correctly abstain** — duplicate tab bars, the "Play" twin set, and the nameless
  speaker-segment icons are the genuine **ambiguous / visual residue** (no anchor, no distinguishing
  text). They diagnose `AMBIGUITY`, which the reporter renders as *"ABSTAINED — multiple identical
  candidates. Add a container/row hint to disambiguate."*

### verify-by-effect (modelled — not executed)
For the 4 heals the recorded expectation is `domChange` (Copy → clipboard/DOM), `verifyConfidence = MEDIUM`;
no live click was issued (shared browser), so the three-way verdict is **not** machine-confirmed here.
On a real runtime (`selfheal-runtime.js`, P2) these heals would be snapshot→click→observe verified.

---

## 5. Aggregate (Run-3, the runner's-eye view)

- **correct-heal: 8** (4 round-trip + 4 restyle) — all via deterministic context disambiguation.
- **correct-abstain: 16** (C1/C2/C7/C8 × 3 regimes + the 4 localize collapses).
- **false-heal: 0 / 24** — pre-registered ceiling **held**.
- **fail: 0**, **missing: 1** (C9).
- Diagnosis categories assigned on every non-heal: `AMBIGUITY` (all). No silent stops.

Combined with Run-1 (worst case): **0 false-heals across 51 heal-eligible cells** (27 + 24).

---

## 6. Honest read

1. **The full loop works on real Gong DOM.** record (`captureStep`+`captureContext`) → drift
   (`mutate`) → match (`matchStep`) → heal (`disambiguateByContext`) → diagnose (`diagnoseFailure`) →
   report (`report`) executed end-to-end, and `disambiguateByContext` measurably converted
   abstain→correct-heal on 4 real repeating-list controls (C3–C6) — the headline K27 claim
   (Outline = dense repeating list, row-text-distinguishable) **reproduced live**.
2. **Safety is the proven property; this is not a heal-*rate*.** With only round-trip + synthetic
   drift there is no natural-drift denominator. The deliverable is: *the mechanism heals what it
   should, abstains on the residue, and — across 51 cells and two scoping regimes — produced **zero
   false-heals**.* A correct abstain on C1/C2/C7/C8 is a success per the diagnosis-first thesis (I2).
3. **Localization is the cleanest safety demonstration.** Reversing all text turned every
   context-heal into an abstain (4→0 heals) **without a single false-heal** — the disambiguator does
   not manufacture a match when its signal is gone.
4. **Gong remains the anchor-poor worst case (K23/K27 confirmed live):** 0 testid, no stable id,
   ~0% recordability; every win here is `role+name` + container row-text, and the nameless/twin
   residue (C7/C8 + the whole cross-viewport Run-1) is genuinely beyond deterministic reach → the
   LLM/visual gate (I26), correctly **not** force-healed.
5. **Cross-viewport duplication is real and matters:** Gong ships desktop+mobile DOM at once, so
   un-scoped matching sees universal twins (Run-1 → 9/9 abstain). Scoping to the visible viewport
   (what `resolveScope(visibleOnly)` does live) is necessary and honest; it is where the heals appear.

### Caveats
- Single page, single capture; synthetic drift only (mechanism, not field heal-rate).
- Pipeline ran on a serialized `DOMParser` doc → `WEB.actionable` gate is layout-free here (validated
  separately, K15/K16); verify-by-effect is modelled, not executed.
- Visible-viewport scoping + structural-role trimming were applied for tractability on a 15k-node SPA;
  `containerOf`'s semantic row-roles were preserved so per-section context is faithful.
- C9 absent from the visible set (1 of 9 cases) — reported, not hidden.

---

## 7. Suite status (core kept pristine)

Re-run in-browser via the static server immediately after this E2E:

- **`selfheal-tests.html` (core `runAll`): 14 / 14 green.**
- **`self-heal/tests/adversarial-validation.html` (`runAdversarial`): 20 / 20 green.**

`selfheal-core.js` unchanged (no diff). New artifacts live in the tools layer only:
`self-heal/tools/gong-e2e-runner.js`, `self-heal/tools/gong-e2e-harness.html`.
