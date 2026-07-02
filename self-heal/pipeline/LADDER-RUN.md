# LADDER-RUN.md — S8 autonomy ladder + brain-first wiring (`measured · live · 2026-07-01`)

Built in a parallel background worktree; reviewed, one design bug found and fixed, then independently
re-verified live in the master worktree before merge (background agent process exited mid-verification,
so its own claimed results were not trusted — everything below was re-run from scratch by the master session).

## Design (self-heal/pipeline/learning-loop.js)
Two tiers only, deliberately conservative:
- **L1 (cold/default)** — brain miss, or <5 successes-since-reset. Real matcher + verify-by-effect always run.
- **L2 (trusted)** — >=5 consecutive HIGH-confidence PASS outcomes, 0 failures since reset. The executor
  may skip re-matching (act directly on the brain's cached, live-reverified locator) — **verify-by-effect is
  NEVER skipped**, only re-matching is. That's the false-heal firewall staying intact regardless of tier.
- **No L3** (skip verify-by-effect too): no second independent oracle exists in this codebase to justify it
  as safe. Documented as a deliberate stopping point, not an oversight.
- **Promote at 5, demote at 1** (deliberately asymmetric vs. the old stub comment's "failures>=2" — demote
  fast, promote slow; false-heal=0 costs nothing to protect via a slower promotion curve).
- **OV#4 guard**: only a HIGH-confidence PASS promotes; a FAILED outcome always demotes+evicts regardless
  of confidence (a failure is a failure signal even at lower verification confidence).

## Bug found in review, fixed before commit: APP_BUG was demoting correct locators
The background agent's `shell.js` wiring called `ladder.record(testId, stepId, res.outcome, ...)` using the
**test-level** outcome for every acted step. A test failing with `category: 'APP_BUG'` (assertion failed
after a fully correct locate+act — S7's false-PASS-guard scenario) would demote+evict every step's cache
entry even though the locator was never wrong — collapsing the I25 distinction (located ≠ acted ≠ asserted)
this whole project is built around. **Fixed**: `shell.js`'s ladder-advance block now skips (treats as
neutral, same as PASS_WARNING/ABSTAIN) whenever `res.category === 'APP_BUG'`.

**Live-verified the fix directly** (not just re-running the existing gate, since the existing L1/L2/L3/S1/F1
suite never hits an APP_BUG outcome): built a probe session, promoted L1 to tier L2 over 5 real runs, then
forced a 6th run into app-bug mode (STUCK_DOM — submit never navigates). Result: `bugRunCategory: 'APP_BUG'`,
`bugRunLocatedAllSteps: true` (proving it wasn't a locator failure), **`tierAfterAllStillL2: true` and
`brainStillCachedAfterAppBug: true`** — the fix holds. `FIX_VERIFIED: true`.

## Gates (all re-run fresh in the master worktree after merge)
| gate | result |
|---|---|
| `self-heal/schemas/tests.html` (S1) | 24/24 corpus + 6/6 false-heal-primitive, live cross-check OK — unchanged |
| `self-heal/brain/tests.html` (S2) | 16/16, hit-rate 100% — unchanged |
| `self-heal/shell/shell.html` (S5 original checks) | 12/12 — unchanged |
| `self-heal/shell/shell.html` (S8 new ladder checks) | **8/8**, false-heal 0 across all 6 runs |

New S8 ladder checks confirm: L1's steps reach tier L2 after exactly 5 HIGH-confidence successes; run6
serves at least one step from the brain (brain-first is load-bearing, not just measured); run6 still
verifies by effect at HIGH confidence (verification never skipped); false-heal stays 0 even brain-first;
a `servedTally` makes brain-vs-matcher serving observable; non-HIGH-confidence tests (L2/L3/S1/F1) never
promote past L1 (OV#4 holds); the flywheel log accumulates one row per test per run across all 6 runs
(process-lifetime only — no durability backend, stated not hidden); a direct demotion probe confirms 1
failure evicts + resets to cold.

## Honest bounds
Flywheel log is in-memory, process-lifetime — disappears when the tab/process ends; no durability backend
built (out of scope). The ladder is single-process — cross-tenant federation (Ledger I27, P3) is untouched.
