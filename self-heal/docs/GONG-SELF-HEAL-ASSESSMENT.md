# GONG-SELF-HEAL-ASSESSMENT.md — step-back: did self-locating + healing hold up on a hard app?

`2026-06-24` · Companion/step-back to [`GONG-E2E-RUN.md`](GONG-E2E-RUN.md). Synthesis only — every
number traces to the measured E2E run (record→drift→match→heal→diagnose→report) on the live Gong
call-share viewer, Outline tab. No new measurement; nothing fabricated.

## TL;DR verdict

**Self-locating + healing on Gong = "degrades safely, heals a narrow structured subset."**
- ✅ **Safety held perfectly:** 0 false-heals across 51 heal-eligible cells (2 scoping regimes × 3 drift
  modes). The catastrophic outcome (heal to the wrong element, test passes) never happened.
- ✅ **Healing worked where structure exists:** 4 of 8 executed controls healed — *all* via deterministic
  context disambiguation (`disambiguateByContext`) on repeating-list controls with distinct container text.
- ⚠️ **Healing did NOT generalize across Gong**, and that is the honest finding: Gong has **0 stable
  anchors** (no testid, no stable id, ~0% recordability), renders **desktop+mobile DOM at once** (universal
  twins), and leans on **nameless icon controls** + **React-`onClick` `<div>`s** the matcher can't even see.
  Everything outside the structured-list subset **correctly abstained** rather than guessing.

So: the approach is *trustworthy* on Gong (never lies), but its *heal yield* on Gong is low and
concentrated — because Gong starves it of anchors. The lever is upstream anchor hygiene, not matcher cleverness
(re-confirms the parent thesis, Ledger K23/K27).

---

## 1. Use cases targeted (the test regimes)

We exercised the loop against the three regimes the environment allows (no natural drift available
in-session → mechanism test, not field heal-rate):

| # | Use case | What it stresses | Why it matters |
|---|---|---|---|
| U1 | **Round-trip** (same DOM) | Can we re-find the recorded element at all? Disambiguation among live duplicates. | Baseline locate + the duplicate-resolution problem (Gong is duplicate-dense). |
| U2 | **Restyle drift** (hashed class/id reshuffle) | Resilience to cosmetic/CSS-in-JS churn. | The #1 real failure class (locator drift); Gong is 100% hashed classes. |
| U3 | **Localize drift** (text reversal) | Resilience to copy-change / i18n; does text-based context *fail safe*? | The boundary of deterministic healing → where the LLM/visual residue begins. |
| — | *Temporal / flow-change / state* | NOT testable (needs runtime). | Deferred to P2 (`selfheal-runtime.js`). |

---

## 2. Components learnt from the Gong UI (perception)

From `WEB.candidates` + the observer on the live Outline tab:

| Component class | Count (Outline) | Anchor reality | Locatable? |
|---|---|---|---|
| Total `[role]`/control nodes (both viewports) | **~15,016** | — | inflated by hidden mobile tree |
| Visible interactive controls | **~640–891** | — | the real surface |
| **Stable-id / testid controls** | **0** | none exist | ❌ no strong anchor anywhere |
| Hashed React ids (`tab-:r…`) | 45 | hashed → low stability | weak |
| **Name-only controls** | ~508 | role+name only | heals if name is unique |
| Tabs (`role=tab`: Highlights/Outline/Transcript/Call Info/Slides) | 5 (×2 viewports) | role+name | weak-identity, twinned |
| Per-section **"Copy"** buttons | **32** | ambiguous (identical name) | ✅ via container row-text |
| **"Copy all"** | 1 | name-only, crowded by "Copy" (fuzzy 0.85) | ✅ via context |
| **"Play at <ts>"** controls | 4–8 per ts | ambiguous, twinned | ⚠️ context insufficient |
| Per-section containers (`role=listitem`) | **32** | the Clue-2 disambiguator | ✅ distinct text |
| **Nameless icon buttons** (speaker-segment, player ctrls) | ~70 | no name, no anchor | ❌ visual/LLM residue |
| React-`onClick` `<div>` clickables (Slides scrubbers) | unknown | **invisible to candidates** | ❌ not introspectable (K28) |

**Headline:** the only thing the matcher can anchor on in Gong is `role+name` + container row-text.
Recordability (strong-anchor %) ≈ **0%**.

---

## 3. Test cases generated (recorded steps)

9 recorded steps via `captureStep` + `captureContext`, spanning the regimes the plan required:

| case | target | regime archetype | locator tier | record-time flag |
|---|---|---|---|---|
| C1 | tab "Outline" | role+name unique-ish | role+name | weak-identity |
| C2 | tab "Highlights" | role+name unique-ish | role+name | weak-identity |
| C3 | "Copy all" | name-only (crowded) | role+name | weak-identity |
| C4 | "Copy" @ Product Overview | ambiguous ×32 (Clue-2) | role+name | weak-identity |
| C5 | "Copy" @ Agentic Approach | ambiguous ×32 (Clue-2) | role+name | weak-identity |
| C6 | "Copy" @ Ad Hoc Generation | ambiguous ×32 (Clue-2) | role+name | weak-identity |
| C7 | "Play at 44:42" | ambiguous ×8 (twin context) | role+name | weak-identity |
| C8 | nameless speaker-segment icon | nameless residue | none | **no-anchor** |
| C9 | nameless play icon (distinct ctx) | nameless | — | — |

Note: **every generated case carries a record-time `flag`** (weak-identity / no-anchor) — i.e. the
system *flagged its own fragility at record time on 9/9 controls*. That flag is the first
human-in-the-loop signal (§8).

---

## 4. Tests executed vs not

| | count | cases |
|---|---|---|
| **Generated** | 9 | C1–C9 |
| **Executed** (× 3 regimes = 24 cells, run-3) | **8** | C1–C8 |
| **NOT executed** | **1** | C9 (not present in the visible-scoped DOM) |
| Cells run total (run-1 full tree + run-3 visible) | **51** | — |

Executed outcomes (run-3, visible-viewport = a real runner's view):

| regime | correct-heal | false-heal | correct-abstain | fail |
|---|---|---|---|---|
| round-trip | 4 (C3–C6, all via context) | **0** | 4 (C1,C2,C7,C8) | 0 |
| restyle | 4 (C3–C6, all via context) | **0** | 4 | 0 |
| localize | 0 | **0** | 8 | 0 |

---

## 5. Test flakiness rate

**Mechanism flakiness = 0%.** The loop is deterministic by construction: fixed thresholds
(`TH.heal 0.62 / margin 0.12`), seeded mutators (`rng(777)` restyle, `rng(888)` localize), pure
functions over a static DOM snapshot. Re-running the suites is bit-identical — verified: core
**14/14** and adversarial **20/20** reproduced green immediately after the E2E.

**But capture-time (environment) flakiness is a real, observed risk — not in the matcher, in the
harness around it:**
- **SPA async render:** clicking "Outline" then snapshotting *immediately* captured the wrong (un-rendered)
  tab — observed **twice** this session (0 Copy buttons captured). A naive recorder would record flaky
  steps here. → mitigated by an explicit "wait until target content present" gate before capture.
- **Cross-viewport non-determinism:** which of the desktop/mobile twins is "visible" depends on window
  width at capture; un-scoped capture yields universal twins (run-1 → 9/9 abstain).

**Honest framing:** 0% flaky *given a correct, content-settled, viewport-scoped capture*; the flakiness
risk lives entirely in **getting that capture**, which is exactly where a human-in-the-loop checkpoint pays off (§8).

---

## 6. Coverage written-but-not-executable

| Written / intended | Executable now? | Status |
|---|---|---|
| C1–C8 across 3 drift regimes | ✅ yes | executed |
| C9 (nameless play icon) | ❌ no | absent from visible DOM |
| `WEB.actionable` gate on **real layout** | ❌ no (ran on detached DOMParser doc → no layout) | validated separately (overlay→STATE_ISSUE, K15/K16) |
| **verify-by-effect** (snapshot→click→observe) | ❌ no (modelled only) | no live click issued (shared browser); needs runtime |
| Slides/Highlights **React-`onClick` `<div>`** controls | ❌ no | not in candidate set (K28) |
| Natural-drift heal rate (real Gong redesign) | ❌ no | no natural drift in-session; synthetic only |
| Temporal / flow-change / state-issue cases | ❌ no | need a runner (P2) |

---

## 7. Root cause for non-coverage

| Gap | Root cause | Owner / fix |
|---|---|---|
| C9 + nameless icons (C8) can't heal | **No name, no anchor** → descriptor = role+tag only; container text non-distinct → genuine visual residue | Upstream `aria-label`/testid; else LLM/vision gate (I26) |
| 0 strong-anchor heals; everything is role+name | **Gong ships 0 testid / no stable id** (~0% recordability) | Upstream test-id advisor (parent P2) — the dominant lever |
| Universal twins → un-scoped abstain (run-1) | **Desktop+mobile DOM rendered simultaneously** | Viewport-scoped capture (`resolveScope(visibleOnly)`) |
| C3/C4–C6 needed context to heal at all | **Repeating controls + similar names** ("Copy" fuzzy-matches "Copy all" 0.85) crowd the margin | `disambiguateByContext` (works here) |
| Localize → all context-heals drop to abstain | **Text-based context can't survive translation** | Correct fail-safe; route residue to LLM, never guess |
| Slides scrubbers invisible | **React `onClick` on `<div>` not DOM-introspectable** (K28) | Partly inherent SPA limit; heuristics only approximate |
| Gate + verify not executed | **No runtime (no Node/Playwright); detached parse has no layout; no live click in shared browser** | `selfheal-runtime.js` (P2) |
| Capture flakiness | **SPA async render + viewport ambiguity** | Content-settle + viewport gate at record time |

**One-line root cause:** *Gong is anchor-poor and structurally duplicated*; the matcher's ceiling is
the app's anchor quality, so coverage gaps are overwhelmingly **upstream/markup**, not matcher defects.

---

## 8. Where to put the human in the loop (HITL)

The system already produces the exact signals a HITL UI needs — it just needs surfacing. Two
checkpoints, mapped to existing outputs:

### A. Record-time HITL (highest leverage — prevents flaky/fragile tests at the source)
Triggered by the `flag` `captureStep` already emits (`no-anchor` / `ambiguous` / `weak-identity`).
On Gong this fired on **9/9** controls — so the recorder should **always** offer a confirmation step here:

1. **Weak/absent anchor → ask the author to strengthen it.** "This control has no stable id
   (recordability 0%). Add a `data-testid`, or confirm name + context." (The single biggest heal-rate lever.)
2. **Ambiguous (duplicate) control → confirm the disambiguator.** Show the captured **container row-text**
   (Clue-2) and ask "is *Product Overview* the row that identifies this Copy?" — turns a silent guess into
   an author-approved anchor. (This is what made C3–C6 heal.)
3. **Cross-viewport / nameless → human picks or labels.** "We see desktop + mobile copies — record which?"
   and "this icon has no name — caption it (Clue-3 intent)." Catches the C7/C8/C9 residue at the source.
4. **Content-settle confirmation:** "the target's tab/panel is rendered — proceed?" (kills the capture
   flakiness in §5).

### B. Execute-time HITL (adjudicate the residue — never auto-promote a risky heal)
The pipeline's `diagnoseFailure` + `failure-reporter.report` output IS the HITL surface; route by category:

1. **`DRIFT` via `via:context` (first-time):** auto-heal, but **show the heal for one-click confirm** the
   first time a context-heal is used for a step (it heals on row-text alone — cheap to verify, expensive
   to get wrong). After N confirmations, auto-trust (P2 learning).
2. **`AMBIGUITY` / `REMOVAL` abstain → human adjudication queue.** The reporter already emits an actionable
   message ("multiple identical candidates — add a row hint"); that card is the human's work item.
3. **Verify-by-effect "unverified" (`PASSED_WARNING`) → human review.** `outcome-verification.decide`
   already returns this three-way state (I24/OV#4): a heal that can't be effect-verified must **never**
   auto-promote — it queues for a human, who confirms or rejects (and that becomes ground-truth, feeding P2).
4. **Residue (nameless / localized / `onClick`-div) → escalate to LLM/vision gate, then human spot-check.**

**Design principle (Ledger I2):** the deterministic layer's job is to **heal confidently or hand the
human a named, actionable reason** — never a silent stop and never a silent guess. The HITL UI is the
rendering of that contract: record-time it strengthens anchors before fragility is baked in; execute-time
it adjudicates exactly the abstains/unverified-heals the system already flags.

---

## 9. Bottom line

For a deliberately hard app, the honest scorecard is: **trust = excellent (0 false-heal), reach =
narrow and structure-dependent (4/8, all via context), coverage gaps = mostly upstream (anchors,
cross-viewport, React-div clickables, no runtime).** Gong validates the *safety* thesis strongly and
shows the *heal-rate* thesis is gated by anchor hygiene — which is precisely where a record-time
human-in-the-loop checkpoint, plus an execute-time adjudication queue, convert the system from
"safely abstains a lot on Gong" into "heals a lot because the author was nudged to leave it something to anchor on."
