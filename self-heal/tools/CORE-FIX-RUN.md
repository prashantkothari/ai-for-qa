# CORE-FIX-RUN.md — selfheal-core.js false-heal fix (`measured · live · 2026-07-02`)

A genuine false-heal in the core matcher, discovered as a side-effect of S9's own false-heal regression
check (`self-heal/pipeline/LEVERS-RUN.md`), fixed here. This is the one file the project normally keeps
pristine — this is a deliberate, narrow exception to fix a real bug in it, not a feature addition.

## The bug
```
capture the nameless "eye" icon (S0's deliberately anchorless fixture control — no testid/id/name)
  → remove it from the DOM entirely
  → matchStep(doc, step, {gate:true})
  → verdict:'heal', resolves to the "Continue with Google" SSO button, margin:0.187 (clears TH.margin=0.12)
```
Root cause (traced, not estimated): the recorded descriptor carries zero identifying signal — only
role/tag/type/cls/inForm/formAction, all DURA-weighted as *durable* but none of them *identifying*. With
the true target gone, the remaining candidates are scored purely on this generic context, and the SSO
button (conf 0.9467) happens to score comfortably clear of the runner-up submit button (conf 0.76) —
manufacturing a wide **relative** margin between two candidates that are both, in absolute terms, unrelated
to the recorded control. The margin check alone can't tell "genuinely re-located" from "won by elimination
among strangers."

## Fix: `noAnchorVeto()` — single source of truth
Added as a top-level function in `selfheal-core.js`, exported on `SELFHEAL`. Any descriptor with
`step.flag === 'no-anchor'` (zero real anchor at record time — set by the existing `bestLocator()`/
`flagOf()` machinery) can never resolve to `'heal'` on score+margin alone — it is forced to `abstain` with
a dedicated diagnosis (`'no-anchor'`, not the pre-existing `'no-identity'` — see below). Unconditional
w.r.t. `opts.gate` (this is a correctness invariant, not an interactability check).

## First pass found real problems in its own code review (2 independent passes) — not shipped as-is
1. **Bypassable**: `self-heal/pipeline/candidate-widening.js`'s `matchStepWidened()` duplicates
   matchStep's scope→rank→verdict pipeline and called `verdict()` directly — the exact same false-heal was
   still fully reachable through S9's widening lever, completely unpatched by the first pass.
   **Fixed**: `candidate-widening.js` now imports and calls the SAME `noAnchorVeto()` right after computing
   its own `vd`, so widening (which only ever makes the risk worse — more unrelated candidates to
   spuriously win by elimination) can't reopen the hole.
2. **Pre-empted search-and-pick.js's own, more nuanced safety check**: `search-and-pick.js`'s Phase 2
   deliberately gets a raw ranking (`{gate:false}`) then applies its own stricter check (auto-accept only
   if the WIDENED winner's own current locator tier is testid/stable-id). The first-pass fix considered
   carving out an exception for this path — and **correctly rejected that idea** with concrete evidence:
   the wrongly-healed SSO button in the original bug case DOES carry its own real, non-hashed id (`sso`,
   tier `stable-id`) — so exempting search-and-pick's tier-check path would let the exact same bug back in
   through it. The veto stays unconditional; search-and-pick's "score+anchor-tier" auto-accept is
   correctly understood to be unsafe specifically for no-anchor-recorded steps (there's no recorded anchor
   VALUE to verify the current winner against — "the winner has some real id" says nothing about whether
   it's the SAME control when nothing was recorded to compare it to).
3. **Wrong diagnosis label**: the first pass reused `'no-identity'`, already meaning "no candidate cleared
   the identity floor" (genuine removal) in `change-diagnosis.js`. This veto's case is different — a
   candidate DID clear threshold, and is rejected on policy grounds. Reusing the label would tell a QA
   engineer "likely feature removed" for a control that was never removed.
   **Fixed**: dedicated `diagnosis:'no-anchor'` → `change-diagnosis.js` maps it to `category: 'AMBIGUITY'`
   with an accurate, actionable reason: "...likely a coincidental match among generically similar controls,
   not a verified re-location; add a stable anchor (data-testid recommended) at record time."
4. **Unquantified blanket change**: measured, not asserted — the fix was checked against every no-anchor
   case in the existing benchmark corpus (`F-T3-pristine`'s eye icon, payment `C5`'s gear icon). **Both
   were already expected to abstain (AMBIGUITY) before this fix, not heal — 0/2 regress.** A dedicated
   test case (below, test (e)) also proves a genuinely-unique no-anchor control (the ONLY candidate on the
   page, no elimination possible) now abstains instead of healing — an accepted, honestly-reported cost
   (false-heal=0 outweighs heal-rate per project rule), not a silent side effect.

## Gate: `self-heal/tools/core-fix-tests.html` → `window.__CORE_FIX_TESTS` → **5/5 pass**
(a) removed nameless icon no longer false-heals, carries the correct `no-anchor` diagnosis · (b) the SAME
control pristine (not removed) still correctly abstains AMBIGUITY, unchanged · (c) a normal anchored heal
(T1 submit button under restyle) still heals correctly — the fix didn't raise the bar for real anchors ·
(d) the SAME bug run through `candidate-widening.js`'s `matchStepWidened()` also no longer false-heals
(bypass closed) · (e) measured tradeoff: a genuinely-unique no-anchor control now abstains too (documented
cost, 0/2 corpus regressions).

## Full regression sweep (re-run independently in the master worktree, not just trusted from the agent)
| gate | result |
|---|---|
| S1 `schemas/tests.html` | 24/24 corpus + 6/6 false-heal-primitive — unchanged |
| S2 `brain/tests.html` | 16/16 — unchanged |
| S3 `report/tests.html` | 33/33 — unchanged |
| S4 `benchmark/eval-gate.html` | **14/14** (new `F-T3-removed` regression case included), false-heal **0**, 0 regressions |
| S5 `shell/shell.html` | 12/12 (original) + 8/8 (S8 ladder) — unchanged |
| S9 `pipeline/lever-tests.html` | **6/8** — up from 5/8; **5c and 5d (the actual false-heal regression checks) now PASS**; the 2 remaining failures (tests 3 and 4, both `temporal-wait` timing) are the SAME pre-documented Chrome background-tab timer-throttling artifact from `LEVERS-RUN.md` (test 3's detail shows `verdict:'heal'` — it found the element correctly, just at `elapsedMs:2032` vs. its strict `<2000` bound — not a logic break) |

## Process note
The background agent that built this fix stalled twice (once mid-first-pass, once mid-review-response) and
its own status claims were not trusted either time — every result in this file was independently re-run in
the master worktree before being accepted. A cache gotcha during verification: `location.reload(true)` is
a no-op in modern Chrome (the force-reload param was deprecated years ago) and silently served a stale
`selfheal-core.js` missing the fix on the first verification attempt — a real hard reload (Cmd+Shift+R) was
required each time.

## Honest bounds
This closes the specific "removed, zero-signal descriptor, wins by elimination" false-heal shape. It does
not attempt a broader audit of every heal-threshold edge case in the matcher — this was a targeted fix for
one confirmed, reproduced bug, not a general threshold re-tuning.
