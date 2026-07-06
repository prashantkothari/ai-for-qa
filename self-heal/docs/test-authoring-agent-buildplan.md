# Test-Authoring Agent — First Plan of Action (Builder View)

## Context
Goal: build a **platform** (not a chatbot) that a QA team uses to generate **scenarios + cases + test
data** for changes across **SaaS web, mobile, desktop, and local apps**. It should *reason about the
customer's environment* and produce good coverage — reliably. Companion docs:
[`test-authoring-landscape.md`](test-authoring-landscape.md) (paradigms + ideal stack) and
[`test-authoring-agent-strategy.md`](test-authoring-agent-strategy.md) (reasoning loop, data/tuning,
learning loop).

Three real pains this plan must answer:
1. **Raw GPT/Claude under-covers** — freeform prompting misses whole dimensions.
2. **Non-determinism** — different people, different prompts → different tests every run. Unusable as a platform.
3. **We must be able to *verify* generation quality** — across platforms — not just trust it.

---

## 1. The reframe: the product is the *scaffolding*, not the model
A raw LLM is a creative writer — high variance, plausible-but-incomplete. To make it a **platform**,
you wrap it so variance is bounded to *phrasing*, never to *coverage*. Four constraints do 80% of the work:

| Constraint | Kills which pain | How |
|---|---|---|
| **Fixed input schema** (structured intake, not a free prompt) | non-determinism | everyone submits the *same shape*: change-type, story, acceptance criteria, platform, env |
| **Deterministic technique-bundle selection** | under-coverage | change-type → bundle via a **rules table** (not LLM whim) — see strategy doc §3 & §9 |
| **Enforced output schema + golden coverage checklist** | under-coverage + variance | LLM *fills a template* against a per-change-type checklist; can't skip dimensions |
| **Deterministic libs own the data values** | hallucination | Faker/PICT/Hypothesis generate values; LLM only picks classes & oracles (strategy doc §9) |

Result: two QAs submitting the same change get **the same coverage skeleton**, differing only in wording.
Add **low temperature + a fixed prompt template + content-hashed case IDs** → reruns *diff* instead of
regenerate.

> This is the whole trick: **the LLM proposes, the scaffolding disposes.** Prompt+schema+checklist+eval
> beats fine-tuning as a first move — and it's buildable in weeks, not quarters.

---

## 2. The smart 80/20 — what to build first, what to defer
**Build now (the 20% that delivers 80%):**
1. **Structured intake** — a form/API: change-type, user story, acceptance criteria, platform target, env notes.
2. **Change classifier + deterministic bundle mapping** — even rule-assisted; unlocks *what* & *what-not* to author.
3. **Templated generation** — LLM fills a schema-constrained template per the coverage checklist; low temp.
4. **Data generation via libs** — Faker/mimesis + PICT pairwise + a boundary/nasty-data catalog.
5. **Coverage critic pass** — one adversarial "what's missing / which case has no oracle?" loop.
6. **Editable structured output + export** — to Gherkin + one TMS (TestRail/Xray/Zephyr).
7. **Eval harness** (§3) — built *alongside*, not after. It's how you prove the thing works.

**Defer (tempting but not the 20%):**
- Conversational/chat expert agent (they explicitly don't need it).
- Multi-agent orchestration platform, cross-tenant "common brain", fine-tuning.
- Integrating *every* engine (GraphWalker/Cosmic Ray/Jepsen) — emit/ingest later (landscape §6).
- Auto-execution of tests. Author first; run later.

**Rule of thumb:** if a feature doesn't either (a) increase coverage, (b) increase consistency, or
(c) let you measure quality — it's not in the first cut.

---

## 3. Verify quality FIRST — the eval harness is the foundation, not an afterthought
You can't ship a generator you can't measure. Build the eval harness in parallel with generation (it
also directly serves this project's false-heal=0 / no-fabrication discipline).

**a. Golden set.** 20–50 real changes (spanning the platforms + change-types) with **expert-authored
"good" case sets**. This is your ground truth. Curate with senior QA.

**b. Scoring rubric (tag every number `measured/proxy/asserted`):**
- **Coverage recall** — of the dimensions/acceptance-criteria the expert covered, what % did we hit? *(the headline metric)*
- **Oracle-present rate** — % of generated cases with a real pass/fail check (target ~100%).
- **Traceability** — % cases mapped to an acceptance criterion; % criteria with ≥1 case.
- **Redundancy** — % near-duplicate cases (lower is better; equivalence/pairwise should keep it low).
- **Hallucination rate** — % cases referencing non-existent fields/behavior (target ~0).
- **QA accept/edit/reject rate** — the north-star once live: what fraction ships unedited.

**c. Escaped-defect backtest.** Take past prod bugs → check if the generator produces a case that would
catch each. This is the most honest quality signal (strategy doc §9–§10).

**d. Consistency test.** Run the *same* input N times and across different users' phrasings → measure
coverage-set variance. Platform is only "consistent enough" when the *coverage skeleton* is stable
(wording may vary). This directly tests pain #2.

**Gate:** don't scale rollout until coverage-recall + oracle-rate clear a chosen bar on the golden set.

---

## 4. Cross-platform (web/mobile/desktop/local) — one core + dimension packs
Don't build four generators. **~80% of scenario *logic* is platform-agnostic** (rules, boundaries,
negatives, state). Platform is a **modifier layer** that adds platform-specific dimensions:

| Platform | Extra dimension pack the agent layers on |
|---|---|
| **Web (SaaS)** | responsive/breakpoints, browsers, locale, session/multi-tab, back/refresh |
| **Mobile** | gestures, orientation, OS permissions, offline/poor-network, interrupts (call/notification), battery, deep links |
| **Desktop** | window/resize/multi-monitor, file-system access, OS integration, keyboard shortcuts, install/update |
| **Local / installed** | install/upgrade/rollback, offline-first, local data & migration, licensing, resource limits |

Build: **platform-agnostic core generator + toggleable dimension packs**. The intake's "platform" field
switches packs on. This keeps one reasoning engine and makes adding a platform a *data* change, not code.
(The environment-specific *locators/execution* live downstream — the agent authors scenarios, not selectors.)

---

## 5. Handling "many people, different tests every time" — concretely
This is a governance + determinism problem, solved by:
- **Single structured intake** — no free-text-only prompts; the shape is fixed for everyone.
- **Versioned, shared prompt templates + taxonomy** — nobody hand-writes generation prompts; they're
  platform assets, changed via review, not per-user.
- **Deterministic bundle + checklist** — coverage is derived from change-type rules, identical across users.
- **Content-hashed case IDs + rerun-diffing** — same input → same IDs; changes show as *deltas*, not fresh dumps.
- **Low temperature + seed** — bounds phrasing variance.
- **Review/approval workflow** — generated set → QA edits → approved baseline stored; the *baseline* is
  the artifact of record, so drift between runs is visible and controlled.

---

## 6. Suggested sequencing (milestones)
- **M0 — Contract & golden set (week 1–2):** define the case/scenario/data schema (strategy doc §6),
  the change-type taxonomy + bundle table, and curate 20–50 golden changes with expert case sets.
- **M1 — Deterministic core (week 3–5):** structured intake → classifier → templated schema-constrained
  generation → data libs → coverage critic. One platform (web) end-to-end.
- **M2 — Eval harness + gate (parallel with M1):** rubric scoring, consistency test, escaped-defect
  backtest. Prove coverage-recall/oracle-rate meet the bar.
- **M3 — Platform packs + export (week 6–7):** add mobile/desktop/local dimension packs; export to Gherkin + one TMS.
- **M4 — Pilot with real QA (week 8+):** measure accept/edit/reject; feed edits back as the first learning signal.
- **Later:** learning loop / cross-tenant brain (strategy doc §10), MBT/mutation emit-&-ingest (landscape §6).

---

## 6b. Coverage-critic rulebook (learned from the insurance sample review)
The critic pass (§2.5) shouldn't be a vague "what's missing?" — it's a **checklist of firing rules**.
These came out of reviewing the insurance sample set; encode them so the *generator* self-catches, not
just a human reviewer. Each rule = a condition → a required case (or a flag).

1. **No orphan-oracle.** A case may not *assert* an oracle that depends on an open abstain. → force
   `abstain` or **dual-branch candidate oracles** ("if rule=X → A; if rule=Y → B").
2. **Interaction coverage.** If ≥2 fields/flags on a screen interact → require **pairwise**, not just
   single-variable BVA.
3. **Sibling completeness.** If a screen has N input fields, every field gets its own class set — don't
   test one and pin the rest to a fixed profile.
4. **Cross-field consistency.** Any two captured fields with a real-world relationship (age↔horizon,
   income↔budget, history↔replacement) → require a consistency case.
5. **Journey coverage.** For multi-screen flows → require ≥1 **end-to-end data-flow**, one
   **back-navigation**, and one **abandon→resume** case (MBT).
6. **Platform packs fire.** Mobile/desktop/local target → require **session/offline/resume + fault-injection**
   cases (timeout, network drop, backgrounding, backend-down).
7. **Backend boundary.** If the screen calls a service → require **contract + error-response + version-pinning
   + idempotency** cases.
8. **Affordability / money.** Any flow producing a price/premium → require a **budget/affordability
   suitability** case.
9. **Method-coverage checklist.** For the change-type's bundle, verify each applicable paradigm is present;
   flag missing **pairwise / metamorphic / fault-injection / API / MBT** for stateful+mobile+backend flows.
10. **Persona spread.** Don't test one profile (the "Set 24" trap) → require a **persona set** that drives
    the flow down *different* rule branches.
11. **Every abstain is actionable.** Each open question carries its candidate oracles per resolution, so it
    unblocks instantly (not just a question).

A generated set that can't tick these gets flagged *before* it reaches the QA — this is most of the
"raw LLM under-covers" gap, closed mechanically.

---

## 7. First concrete action this week
1. Lock the **output schema** (Scenario → Case → DataVariation, strategy doc §6) — everything hangs off it.
2. Draft the **change-type → technique-bundle table** as an actual lookup (strategy doc §9), + platform packs (§4).
3. Curate **10 golden changes** across platforms with expert case sets — enough to stand up the eval harness.
4. Build a **thin vertical slice**: one web change → structured intake → templated generation → schema
   output → coverage-recall score against its golden set. Prove the loop and the metric before broadening.
