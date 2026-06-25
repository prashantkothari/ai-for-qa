# context.md — shared context for ALL sessions (read this first)

> Single entry point so every session/chip starts aligned. The **full source of truth** is the
> Inferences Ledger at `~/.claude/plans/i-would-like-you-buzzing-goblet.md` (sections + ledger I/R/J/K).
> This file is the 2-minute orientation; the ledger is the detail.

## Who / why
- **User:** Prashant Kothari (prashant.kothari@testsigma.com), Testsigma.
- **Project:** a **self-healing locator + diagnosis** system for QA test automation. When a recorded
  test step's locator breaks (UI drift across releases/locales/A-B), decide *why* it failed and either
  **heal deterministically** or **fail with a named, actionable reason** — never a silent wrong guess.

## The one-line thesis
**Deterministic, explainable, false-heal-0 UI self-healing + diagnosis, with human-in-the-loop
anchor-strengthening.** It sits *under* a test runner (Playwright/Momentic) and *beside* system-chaos
tools (Antithesis). Differentiator vs ML self-healers: deterministic + auditable, not a black box.

## Non-negotiable rules (carry into every session)
1. **false-heal = 0 is the gating metric.** A heal to the wrong element (test passes on a broken app)
   is catastrophic; a correct **abstain with a named reason is a deliverable**, not a failure.
2. **No fabrication.** No % without a labelled set. Tag every number `measured / simulated / proxy / asserted`.
   A true 66–80% beats a fabricated 95%.
3. **Keep `selfheal-core.js` PRISTINE** (the measured Phase-0.5 matcher). Build in the pipeline/tools layer.
4. **Deterministic-first; LLM/vision only for the residue** (nameless icons, flow-change, full redesign).

## Current status (3 layers)
- **L1 safety/diagnosis — BUILT + PROVEN LIVE.** 0 false-heals across 51 real-Gong cells; named
  diagnosis on every non-heal.
- **L2 heal capability — deterministic matching levers BUILT** (row-text context, div-soup container,
  ordinal twins, pointer-root widener; search-and-pick spec'd). **GAP: the live runtime**
  (`selfheal-runtime.js`) for verify-by-effect / temporal / search-and-pick execution.
- **L3 cross-tenant moat — not started (P3).**
- **Suites green:** core `selfheal-tests.html` 14/14 · `self-heal/tests/adversarial-validation.html` 22/22.

## The loop (see `self-heal/docs/ARCHITECTURE.md`)
study → locate → record → intent → execute → diagnose → heal → learn, with **HITL** (record-time
anchor-strengthen + execute-time adjudicate) and an **LLM/vision gate** for the residue.

## Environment / how to run (IMPORTANT — no Node here)
- **No Node / no Playwright in this env.** Executor = **Chrome MCP** (connected browser) + a static
  server: `python3 static-server.py` (port 8765). Open test HTML in the browser; run `runAll()` /
  `runAdversarial()`. Cross-origin apps: stash DOM in `window.name` → navigate to a same-origin harness.
- Two sessions share one browser → **drive your own tab** (`tabs_create_mcp`).

## Key files
- `selfheal-core.js` — matcher core (pristine). `self-heal/pipeline/*` — diagnosis-first pipeline.
- `self-heal/tools/` — `app-observer.js` (scan), `hitl-overlay.js` (HITL), `*-e2e-*` (E2E harnesses).
- `self-heal/docs/` — `ARCHITECTURE.md`, `FAILURE-TAXONOMY.md`, `APPS-OBSERVATION.md`,
  `GONG-E2E-RUN.md`, `GONG-SELF-HEAL-ASSESSMENT.md`, `CANDIDATE-COVERAGE.md`, `PILOT-RESULTS.md`.

## Active workstreams (chips)
- Amplitude charts E2E v2 (HITL + extensive auto-gen cases + property-fuzz) — plan §14.
- (done) React-handler coverage → `CANDIDATE-COVERAGE.md`; Gong E2E → `GONG-E2E-RUN.md`.

## Open blockers
- **D1** — real Pattern-A failure DOMs (for a natural heal-RATE number). Still unprovided.
- **P2 runtime** — gates verify-by-effect, temporal, search-and-pick execution.

## Doc discipline
Append durable conclusions to the ledger (K-series) with a source tag; keep this file current when
status/goals change. Don't restate the ledger here — point to it.
