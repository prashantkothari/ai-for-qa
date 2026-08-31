# Next-Gen Test Authoring — Framework & Strategy

> Deliverable of the 2026-07-15 architecture review. Companion artifact: the architecture & gaps
> page (functional-block map). Scope per the review brief: (1) authoring framework, (2) authoring
> engine behind the test-gen UI, (3) locator + healing designed in at authoring time.
> Out of scope: cloud execution grids (BrowserStack-style) — executor stays Chrome MCP.
> All claims below about what exists are from a full-code sweep on 2026-07-15; tags follow the
> project rule: `measured / simulated / proxy / asserted`.

## 1. Where we actually stand (verified, not assumed)

The review confirmed the suspected split, but with an important nuance: **almost every part the
authoring engine needs already exists as working, tested code — it just isn't assembled behind
the authoring UI.**

| Capability | Exists? | Where | State |
|---|---|---|---|
| Authoring UI (screens) | Yes | `testcraft-authoring-agent-mockup.html`, `self-heal/ui/test-authoring-mockup*.html` (v1–v4), `test-detail-mockup*.html` | Frontend-only, inline mock data, zero engine imports |
| TC generation engine | Partial | `self-heal/pretotype/testgen.js` (mock generator emitting real `test-plan.schema.js` plans) | Working pretotype, mocked knowledge |
| TC schema | Yes | `self-heal/schemas/test-plan.schema.js` (action-discriminated steps), `coverage-model.schema.js`, `coverage-taxonomies.js` | Working, validated by `schemas/validator.js` |
| Coverage rulebook | Yes (doc) | `docs/test-authoring-agent-buildplan.md` §6b — the 12 rules (orphan-oracle … Rule 12 cross-layer) | Doc-only; not executable |
| Independent coverage/eval agent | Yes (doc) | `docs/test-authoring-coverage-eval-agent.md` (pre-registered Expected Coverage Manifest → diff) | Doc-only |
| Intake conversation design | Yes (doc) | `docs/test-authoring-intake-conversations.md` (8 categories, payments + insurance worked) | Doc-only |
| Locator capture at element level | Yes | `selfheal-core.js` `captureStep()` — §9 descriptor, `bestLocator` tier, `flagOf` (no-anchor/ambiguous/weak-identity) | Working, measured (18/18 core tests) |
| Healing + diagnosis | Yes | `self-heal/pipeline/*` — match → disambiguate → diagnose → report; false-heal 0/13 measured (benchmark, live Chrome 2026-07-01) | Working; levers `search-and-pick.js`/`temporal-wait.js` built but unwired |
| HITL anchor-strengthening | Yes | `self-heal/tools/hitl-overlay.js` (`__hitl.show()`), `descriptor-workbench.html` `learn()` flow | Working surface |
| Execution slice | Partial | `pretotype/selfheal-runtime.js` `executeLive` on synthetic-event fixtures; panel/shell orchestrate it | Verify-by-effect is modelled, not a real act→observe round-trip |
| Learning | Partial | `brain/brain.js` + `pipeline/learning-loop.js` (verify-gated cache, L1→L2 ladder) | In-memory only; no durable cross-run store |
| LLM handoff contract | Yes | `schemas/escalation.schema.js` (3 escalation points: testgen, nameless-icon residue, stuck→HITL) | Schema only |

**The strategic conclusion:** this is a *wiring and assembly* problem plus two genuinely new
modules (rulebook engine, intake engine) — not a green-field build.

## 2. The thesis

**Authoring is where healing is won.** Every self-healing system that bolts healing onto
execution fights with weak locators recorded carelessly. Our differentiator: the §9 descriptor,
the anchor-tier flag, and HITL strengthening all fire **at authoring time**, so every generated
test case ships with (a) a multi-signal descriptor, (b) a named anchor tier, (c) a record-time
flag that forces weak targets to be strengthened by the human *before* the test ever runs.
False-heal=0 stays the gate; an authored step whose target can only be flagged `no-anchor` is a
**named authoring deliverable** ("this element needs a testid"), not a silent liability.

## 3. Target architecture — the authoring engine

Three new browser-side modules (new directory `self-heal/authoring/`, per the keep-core-pristine
rule), each consuming what already exists:

### 3.1 `intake-engine.js` — capture user input
Implements `docs/test-authoring-intake-conversations.md` as code:
- Input: artifacts the user provides (spec text, screen HTML/URL via Chrome MCP, prior TCs) +
  the 8-category intake state machine.
- Behavior: builds an "Understood so far" inference block, asks only the questions the artifact
  can't answer (confirmation, not interrogation), records corrections.
- Output: a **Coverage Manifest** conforming to `coverage-model.schema.js` (element registry,
  transition edges, spec statements, named refusals). LLM calls go through
  `escalation.schema.js` request/response contracts — this is escalation point 1 (testgen).

### 3.2 `rulebook.js` — the 12-rule critic, executable
The §6b rulebook as deterministic checks over (manifest, generated set): each rule returns
pass / fail-with-named-gap / not-applicable-with-reason. Rules 1 and 12 blocking, per the
eval-agent doc. This single module is shared by the in-loop self-check **and** the independent
eval agent (the doc's non-fork rule), the eval agent differing only in prompt/temperature and
its pre-registered Expected Coverage Manifest.

### 3.3 `authoring-engine.js` — generation + binding
- Consumes the manifest, generates TCs into `test-plan.schema.js` (grow `testgen.js` from mock
  to manifest-driven; keep its schema output identical so `executeLive`, panel, and shell keep
  working unchanged).
- **Locator binding at pick time:** when the user (or the agent, walking the live page over
  Chrome MCP) identifies a step target, call `SELFHEAL.captureStep(el, doc)` against the live
  DOM. The full §9 step object — descriptor, bestLocator, scope, actionability, verify,
  flag — is embedded in the TC. `verify` (urlChange / textPresent / elementGone / domChange)
  is authored here too, which is what makes execute-time healing *verifiable* rather than hopeful.
- **HITL strengthening loop:** any step whose flag is `no-anchor` / `ambiguous` /
  `weak-identity` surfaces an `hitl-overlay` card in the authoring UI: pick the right element,
  add a distinguishing anchor, or accept a named abstain. This is the `descriptor-workbench.html`
  `learn()` flow, productized.
- Persistence: authored plans are JSON (schema-validated) in `localStorage` + export/import
  file — no backend needed in this environment.

### 3.4 UI wiring
The v4 authoring mockup (`ui/test-authoring-mockup-v4.html`) becomes the shell: replace its ~23
inline data blocks with calls into the three modules, exactly the way `panel/panel.js` already
script-tags and reuses the runtime stack ("reuse, never rebuild"). Test-runs and dashboard
screens stay frontend-only for now (accepted scope).

## 4. Healing linkage — designed in, not bolted on

Execution (Chrome MCP tab, `executeLive` grown from the pretotype runtime) consumes the same
§9 steps the authoring engine emitted:

1. **Resolve:** `matchStep()` — scope → rank → verdict → no-anchor veto → actionability gate.
2. **Heal or abstain:** deterministic disambiguation (row-text / ordinal) already measured;
   wire the two built-but-unwired levers — `search-and-pick.js` (scope widening) and
   `temporal-wait.js` (bounded retry) — as ladder rungs *below* the veto, never above it.
3. **Verify:** the authored `verify` clause turns into a real act→observe round-trip (the P2
   runtime gap). Chrome MCP can do this today: act, re-read page, evaluate `verifyEffect`.
4. **Learn:** HIGH-confidence verified outcomes only → `brain.js` put (OV#4 guard), ladder
   promote/demote, `flywheel-event/v1` rows appended to a durable JSON log (download or
   localStorage) so learning finally survives across sessions. Heal outcomes also flow **back
   to authoring**: a healed step proposes a descriptor update as a diff the human approves —
   the self-learning loop the theme asks for, kept auditable.

## 5. Phased build plan (Chrome MCP only, no Node)

| Phase | Build | Gate (all `measured`) |
|---|---|---|
| **A1 — Engine behind the UI** | `authoring/` modules 3.1–3.3 with manifest-driven testgen; wire v4 mockup; schema-validate everything; rulebook self-check on every generated set | A generated payments set (the worked scenario A) passes rulebook with 0 orphan-oracles; every abstain named |
| **A2 — Live capture + HITL** | Chrome MCP pick-time `captureStep` on a real app tab; hitl-overlay strengthening for flagged steps; authored plans carry real descriptors | 100% of authored steps have a descriptor + tier; 0 unflagged `no-anchor` steps ship |
| **A3 — Execute + verify for real** | Grow `selfheal-runtime.js` to act→observe over Chrome MCP; wire search-and-pick + temporal-wait; real `verifyEffect` | Re-run the 13-case benchmark shape live: false-heal = 0, regressions = 0 vs `baseline.json` |
| **A4 — Durable learning + eval agent** | Persistent flywheel log + brain seed/restore; independent coverage/eval agent (same rulebook, pre-registered manifest, blind pass) | Eval agent reproduces the R0→R1 insurance-set gap findings (A12/B13/D3) without being shown them |

**Standing rules carried through:** false-heal = 0 gates every phase; abstain-with-named-reason
is a deliverable; `selfheal-core.js` stays pristine (everything above is additive in
`self-heal/authoring/` + existing pipeline/tools); no number without a labelled set.

## 6. Known risks / honest bounds

- Rulebook rules 2–10 vary in mechanizability; some (persona spread, journey completeness) will
  be LLM-assisted checks, which must emit `asserted` findings until a labelled eval set exists.
- Chrome MCP as the sole executor means no parallelism and no cross-browser claims — fine for
  this phase, stated openly.
- Brain persistence via localStorage/file is single-user; the L3 cross-tenant moat remains P3.
- D1 (real Pattern-A failure DOMs) still blocks a natural heal-*rate* number; nothing in this
  plan fabricates one.
