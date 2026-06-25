# Self-heal — test → learn → build feedback loop

A short skeleton for every working session. Replaces ad-hoc "let me try this" with a repeatable cycle so the work stays cumulative and honest.

## The loop (6 steps)

```
       ┌──────────────┐    ┌────────────┐    ┌──────────────┐
       │ 1 RECORD     │ ─► │ 2 DRIFT    │ ─► │ 3 MEASURE    │
       │  on a real   │    │  natural   │    │  heal /      │
       │  rendered    │    │  + synth   │    │  abstain /   │
       │  page        │    │  on clone  │    │  false-heal  │
       └──────────────┘    └────────────┘    └──────┬───────┘
              ▲                                     │
              │                                     ▼
       ┌──────┴───────┐    ┌────────────┐    ┌──────────────┐
       │ 6 RE-MEASURE │ ◄─ │ 5 SMALLEST │ ◄─ │ 4 DIAGNOSE   │
       │  same fixture│    │  FIX (one  │    │  name WHY    │
       │  before/after│    │  thing)    │    │  it failed   │
       └──────────────┘    └────────────┘    └──────────────┘
```

## Per-step — artifact, metric, "done"

| # | step | artifact | metric | "done" means |
|---|---|---|---|---|
| 1 | **Record** | live-inspector scan → per-element descriptors + page scorecard | recordability %, anchor mix, duplicates count | scorecard captured, top examples saved |
| 2 | **Drift** | mutated clone (synthetic) + ideally a *natural* drift (locale / wayback / a/b) | drift type named (restyle / localize / cross-version / cross-platform) | both kinds attempted; natural takes precedence for headline numbers |
| 3 | **Measure** | tally — correct-heal · abstain · fail · **false-heal** | numbers + per-anchor breakdown | reported as a table, never a single % |
| 4 | **Diagnose** | named reasons from `diagnose()` for every non-heal | % non-heals with a named reason (target 100) | each failure mapped to one of: not-ready, ambiguous, no-identity, blocked-by-overlay, off-screen, env-fault |
| 5 | **Fix** | a single PR-shaped change (one line, one signal, one threshold) | predicted vs measured impact | change is minimal and reversible |
| 6 | **Re-measure** | same fixture, before/after row in the metrics table | delta on (a) correct-heal (b) false-heal | **done iff false-heal did not rise** |

## Honesty rules (carried from Phase 0/0.5)

1. **No percentage without a labelled test set** behind it.
2. **Always report false-heal**, not just heal-rate.
3. **Mark every result `measured` or `simulated`.** Synthetic drift is for iteration; natural drift is for claims.
4. **Anchor pre-selection is bias** — random samples over top-N for headline numbers; top-N only for narrative examples.
5. **A failing fix is information**, not a sunk cost — *don't add AI to mask a deterministic miss*; either fix the core or narrow the scope.

## Where each artifact lives

- **Inspector / record:** `live-inspector.js` (injectable on any page; emits scorecard + drift verdicts).
- **Core matcher:** `selfheal-core.js` (descriptor, scoring, gate, scope, diagnose, verify).
- **Hermetic tests + metrics:** `selfheal-tests.html` / `selfheal-tests.js` (18/18 green, before/after tables).
- **Plans:** `self-healing-PLAN.md` (the why), `PHASE1-tasks.md` (the granular what), this file (the how).
- **Per-session record:** append a row to `PHASE1-tasks.md`'s Results table with before / after / false-heal — that's the running log.
