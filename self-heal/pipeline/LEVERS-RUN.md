# LEVERS-RUN.md — S9 search-and-pick + temporal-wait levers (`measured · live · 2026-07-01`)

Built in a parallel background worktree that stalled before it could start its own test server (never
executed once). Copied into the master worktree and run for the first time here.

## Deliverables
- **`search-and-pick.js`** — widens the search scope beyond the recorded container for AMBIGUITY/some
  REMOVAL cases. Safe auto-accept only on an exact strong-anchor match (testid/stable-id) in the wider
  scope, or a score-based winner whose OWN locator tier is testid/stable-id (extra safety gate beyond the
  core's normal heal threshold, since widening raises false-heal risk). 2+ tied anchors or a weak-only match
  → `abstain`, never a guess. `verdict:'heal'` from this lever is still subject to downstream verifyEffect.
- **`temporal-wait.js`** — bounded retry-on-not-ready for the TEMPORAL category. Schedule `[100,250,500,1000]`,
  hard cap 2000ms default; every `setTimeout` has a concrete delay, the returned Promise always resolves
  (never rejects/hangs) once a heal is found or the schedule/cap is exhausted.
- Both are standalone/additive — consume only `selfheal-core.js`'s public API, touch no other file.

## Gate: `self-heal/pipeline/lever-tests.html` → `window.__S9_TESTS` → **5/8 pass**

3 failures investigated individually; neither is a defect in the two new lever modules themselves.

### Test 4 (temporal-wait bounded-timeout) — environment artifact, not a logic bug
Instrumented the exact retry loop with per-tick timestamps: a `setTimeout(..., 100ms)` scheduled at t=0
did not fire until **t≈896ms**. This is Chrome's background/inactive-tab timer throttling, not a defect —
confirmed by direct-timing `matchStep` itself (0–2ms per call, not the bottleneck) and by re-running after
a fresh navigation (same result, consistent with automation not holding true OS-level foreground focus).
**The bounded-retry logic is architecturally sound** — it always terminates via the cap check before
scheduling each retry, it never hangs — the wall-clock in this specific browser-automation environment
just exceeds nominal `setTimeout` delays. Not fixed (there is nothing to fix in the module); documented
as a known test-environment caveat. A real user's foregrounded tab would not see this severity of throttling.

### Tests 5c/5d (false-heal regression on a genuine REMOVAL case) — PRE-EXISTING CORE GAP, confirmed
**This is a real, measured finding, independent of S9's new code.** Isolated by calling `matchStep` (the
already-shipped core matcher) directly, with zero lever code involved:

```
captureStep(eye)  →  remove eye from DOM  →  matchStep(doc, step, {gate:true})
  → verdict: 'heal', resolvedOracle: 'sso', margin: 0.187   (clears the heal threshold)
```

The nameless "eye" icon (S0's genuinely-anchorless fixture control — no name, no anchor) is captured, then
removed entirely. The core matcher, when asked to re-resolve that descriptor with the icon gone, heals to
the **"Continue with Google" SSO button** instead of abstaining/failing — because among the *remaining*
candidates, SSO is the next-closest-scoring anchorless button and clears the margin threshold on its own,
even though it is a completely different, wrong control. This reproduces identically whether called through
`search-and-pick.js`'s Phase 1 (which correctly and by design trusts the core's own verdict on the narrow/
recorded scope — mirroring `matchStep`'s contract) or through bare `matchStep` with no lever involved at all.

**This is NOT a regression introduced by S9.** `search-and-pick.js` behaved exactly as documented (Phase 1:
"try the recorded scope first — no widening needed if it already heals"). The false-heal is in
`selfheal-core.js` itself, which this session is forbidden from modifying (and which is out of scope for
S9's brief). **Flagging this to the user directly as a new, measured false-heal-shaped finding** — a
genuinely-anchorless control, once removed, can heal to an unrelated same-shape control elsewhere in the
same scope. Recommend a dedicated follow-up session against `selfheal-core.js`'s heal-threshold/margin logic
for the "target removed, nothing else is a close tie, but something clears the absolute threshold anyway"
case — distinct from the already-handled "tied candidates" AMBIGUITY case this fixture was originally built
to prove (S0's PRETOTYPE-RUN.md: pristine nameless-icon → ABSTAIN/AMBIGUITY; this is the REMOVAL variant of
the same control, not previously exercised).

## Passing checks (5/8)
1. search-and-pick heals via testid found outside the recorded container (safe auto-accept, strong-anchor).
2. search-and-pick abstains on 2+ tied anchorless matches in the wider scope (no arbitrary pick).
3. temporal-wait finds a delayed-render element (retries>0, elapsedMs tracks the real injection delay).
5a. search-and-pick never false-heals on fixtures.js's own pristine AMBIGUOUS case (eye icon, not removed).
5b. temporal-wait never false-heals on the same pristine AMBIGUOUS case.

## Honest bounds
Standalone modules — nothing currently imports them; a future wiring session integrates them into the live
executor (deliberately not done here, to avoid file conflicts with S8's simultaneous runtime/shell wiring).
