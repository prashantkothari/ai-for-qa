# Test-Authoring Agent — Strategy & Reasoning Logic

## Context
Design for a **QA copilot** that helps a QA engineer author tests when product/eng ship a change.
The change can be **UI**, **backend-only**, **infra**, **data/schema**, or **contract/API**. The agent
must help the QA (1) **decide a test strategy**, (2) **brainstorm + edit scenarios**, and (3)
**generate test-data variations** — collaboratively, not as a one-shot generator.

Mental model for framing (UI is *not* the focus here): a **2-pane, Claude-artifact-style view** —
**left = chat** (reasoning, brainstorm, decisions), **right = an editable artifact** holding scenarios,
cases, and data variations. This doc is about **how the brainstorming should be agentised**, and the
data/logic that makes the two panes stay in sync.

Companion reference for the paradigms/techniques named below:
[`test-authoring-landscape.md`](test-authoring-landscape.md).

---

## 1. The core insight — it's a *reasoning loop*, not a generator
A naive tool does `change → prompt → list of test cases`. That fabricates coverage and ignores the
QA's judgment. The copilot should instead run an explicit loop the QA can steer at every step:

```
INTAKE → CLASSIFY change → SCOPE blast-radius → SELECT strategy bundle
   → BRAINSTORM scenarios → CRITIQUE coverage (adversarial) → SYNTHESIZE test data
   → SYNC to artifact → (QA edits) → RECONCILE → repeat
```

Two principles carried over from this project's ethos (they're the differentiator):
- **No fabricated coverage.** Every scenario must declare its **oracle** (pass/fail check) and its
  **source** (which acceptance criterion / diff hunk / risk it covers). No oracle → flagged, not shipped.
- **Abstain with a named reason is a deliverable.** If the agent can't infer the expected behavior
  (e.g. spec silent on an edge), it says *"undefined by spec — needs product decision"* rather than
  inventing an assertion. A well-labelled gap is worth more than a confident-but-wrong case.

---

## 2. The intake is everything — classify the change first
Strategy selection is driven by **what kind of change** it is and **what surface it can break** — not
by the feature in the abstract. This is the agent's first and most valuable move.

| Change type | Primary signal to read | What actually changes → what to test |
|---|---|---|
| **UI** | mockups, component diff, story | interaction/state/layout/locale; new visual flows; a11y; **rarely new business rules** |
| **Backend-only** | API/handler diff, logic | business rules, validation, data transforms, error codes; **UI cases often unchanged → don't regen them** |
| **Infra** | deploy/config/scaling/network | **non-functional**: latency, retries, failover, capacity, config drift — *not* new functional cases |
| **Data / schema** | migration, model change | migration correctness, backfill, null/default handling, backward compat of old rows |
| **Contract / API** | OpenAPI/proto diff | consumer breakage, field add/remove/rename, versioning, error-shape stability |

**Agent behavior:** ask for (or ingest) the *artifact of the change itself* — the diff / PR / ticket /
mockup — and infer the type. If it can't tell UI-vs-backend impact, it **asks one sharp question**
rather than guessing. Classification then unlocks the right strategy bundle (§3) and, crucially, tells
it **what NOT to author** (a backend-only change shouldn't spawn 20 fresh UI cases).

---

## 3. Strategy selection — map change → risk surface → technique bundle
The agent proposes a **bundle** (with rationale the QA can accept/override), pulling from the landscape:

- **UI change** → happy + negative + **state-transition** (back/refresh/double-click) + BVA on inputs + locale/responsive + a11y. *Optional later:* MBT paths for complex flows.
- **Backend-only** → **decision tables** for rules + **BVA/equivalence** on inputs + error-code matrix + **property-based** invariants + idempotency. Reuse existing UI cases as regression, don't recreate.
- **Infra** → **fault injection / chaos** (kill node, drop packets, clock skew) + load/latency + retry/timeout + config-rollback + "does it survive the real world".
- **Data/schema** → **differential** (old vs new query results) + migration up/down + null/default/boundary rows + backward-compat of pre-migration data.
- **Contract/API** → **contract tests (Pact-style)** + schema validation + versioning/deprecation + error-shape stability.

Output of this step is not tests yet — it's a **short, editable "test plan" the QA signs off on**: *"For
this backend rule change I'll cover decision-table rows, boundary values on the threshold, the error
matrix, and 2 property invariants. I will NOT re-author the checkout UI flow."*

---

## 4. Brainstorm as a **panel of lenses**, not one voice
The strongest idea for the brainstorm engine: don't ask one model "list test cases." Run **parallel
persona/lens agents**, each blind to the others, then dedup and merge. Each lens surfaces cases the
others structurally miss:

- **The Rule-Lawyer** — every branch of the spec / acceptance criteria (decision-table completeness).
- **The Boundary-Hunter** — min/max/off-by-one/empty/zero/overflow on every field.
- **The Adversary** — malicious/malformed input, authz bypass, injection, race/double-submit.
- **The Lazy/Confused User** — wrong order, back button, refresh, partial input, retries.
- **The Ops/SRE** — timeouts, downstream down, rate limit, partial failure, rollback.
- **The Regression-Keeper** — what *nearby* existing behavior could this change break? (blast-radius).

Then a **Coverage Critic** (adversarial pass) asks *"what dimension is missing, which case has no
oracle, which acceptance criterion has zero cases?"* — and that gap list becomes the next brainstorm
round. Loop until the critic goes quiet (the "loop-until-dry" pattern). This is how you get
*comprehensive* rather than *plausible*.

---

## 5. Test-data as **generators**, not hand-typed fixtures
Don't emit static values — emit **equivalence classes + a boundary catalog + a generator spec**, then
materialize concrete rows on demand. This is the property-based mindset applied to data:

- For each field, the agent derives: **valid classes**, **invalid classes**, **boundaries**, and
  **nasty data** (null, empty, unicode/emoji, huge, locale, injection, whitespace, duplicate).
- It uses **pairwise** to combine fields so the data set stays small but interaction-complete.
- "Give me 5 more variations of the expired-coupon case" → agent perturbs along one axis at a time and
  labels *which class each row represents* (so the QA sees coverage, not a random dump).
- Each generated row carries its **expected oracle** — the value or the specific error — inline.

---

## 6. The artifact is **structured state**, and edits round-trip both ways
The right pane isn't a text blob — it's a typed object the agent can reason over and the QA can edit,
with a **bidirectional sync contract**:

```
Scenario  { id, title, changeRef, category, technique, riskLevel, oracleType, status }
  └─ Case { id, preconditions, steps, inputs→dataRef, expectedOracle, tracesTo[criteria] }
       └─ DataVariation { id, class(valid/invalid/boundary/nasty), values, expectedResult }
```

- **Chat → artifact:** brainstorm/critic output writes/updates structured nodes (never a blind full
  regen — it **diffs and merges**, preserving the QA's manual edits).
- **Artifact → chat:** when the QA edits a case, the agent **reconciles** — re-checks its oracle, warns
  if an acceptance criterion is now uncovered, offers to propagate the change to sibling data rows.
- **Traceability is live:** a coverage bar shows *criteria covered / total*, and every case links back
  to the change hunk or criterion it exists for — so **gaps are visible, not silent**.
- **Deltas over regens:** re-running on an updated change produces a *diff* ("3 new cases for the new
  field, 1 stale case to retire"), not a fresh list that nukes prior work.

---

## 7. Ideas I'd bring that aren't in the brief ("think different")
1. **Author against the diff, not the story.** Ingest the actual PR/mockup and reason about *what
   changed*, so the agent proposes **delta cases + a regression-selection set** (what nearby behavior
   is now at risk) instead of re-testing the whole feature. This is the single biggest QA time-saver.
2. **Oracle-first prompting.** Force every scenario to declare its pass/fail check *before* steps. No
   oracle → it can't be authored, only flagged. Kills "it works"-style non-tests at the source.
3. **Confidence + abstention labels.** Each case tagged `measured/asserted/assumed/undefined-by-spec`.
   Undefined ones become **questions for product**, not fabricated assertions (mirrors this project's
   false-heal=0 discipline).
4. **A "why no test here?" negative-space view.** The agent explicitly lists surfaces it *chose not*
   to cover and why (out of scope, unchanged, covered by existing suite) — coverage you can defend.
5. **Learn from escapes.** Feed past production defects / escaped bugs in; the agent biases brainstorm
   lenses toward historically weak areas and can say *"we've been bitten by timezone bugs here before."*
6. **Change-type gating.** Hard rule: infra change → propose chaos/non-functional, **suppress** new
   functional-UI authoring unless the QA explicitly asks. Prevents noise and mis-targeted effort.
7. **Minimization pass.** After brainstorm, run equivalence + pairwise reduction so the artifact is the
   *smallest set that preserves coverage* — comprehensiveness without bloat.
8. **Risk-weighted depth.** The agent proposes *how deep* to go per area from blast-radius (payment =
   deep incl. concurrency/rollback; tooltip copy = shallow), instead of uniform effort everywhere.
9. **Suite-strength check as a closing move.** Offer a **mutation-testing-style self-audit** ("would
   these cases actually catch a flipped `>=`?") to grade the set before hand-off — generation ≠ quality.
10. **Two-way spec pressure.** When brainstorming reveals the spec is ambiguous, the agent drafts the
    **clarifying question back to product** as a first-class output — QA authoring becomes a spec-QA loop.

---

## 8. Minimal agent architecture (how §1–§7 wire together)
- **Classifier** — change-type + blast-radius from diff/ticket/mockup. (§2)
- **Strategist** — picks technique bundle + proposes editable test plan. (§3)
- **Brainstorm panel** — parallel lens agents. (§4)
- **Coverage critic** — adversarial gap-finder, loops to brainstorm. (§4)
- **Data synthesizer** — classes/boundaries/pairwise generators. (§5)
- **Reconciler** — bidirectional artifact sync, delta-diff, traceability. (§6)
- **Governor** — enforces oracle-first, confidence labels, abstention. (§1, §7)

Chat pane = Strategist + panel + critic thinking out loud and taking QA steering.
Artifact pane = Reconciler's structured, editable state with a live coverage/traceability view.

---

## 9. Data, fine-tuning & labeling — and the "raw LLM makes stuff up" problem
**The key architectural decision:** don't ask the LLM to *invent data values* — it will hallucinate
(a "valid" credit-card that fails Luhn, an email that isn't). **Split the labor:**

- **Deterministic OSS libs do the mechanical data generation** — and they *cannot* hallucinate:
  **Faker/mimesis** (format-valid fakes), **PICT/ACTS** (pairwise combos), **Hypothesis/fast-check**
  (boundary + random strategies), a curated **boundary/nasty-data catalog**.
- **The LLM does the *semantic* judgment** the libs can't: read the story, decide *which* equivalence
  classes matter, name scenarios, infer the **oracle**, spot coverage gaps, classify the change.

So the LLM's job is to **orchestrate and call the tools**, not to be the random-number generator. This
also means you **fine-tune for judgment, not for data** — raw values come from libs, tuning is spent on:

| What to fine-tune / label | Dataset needed | Why not just prompt? |
|---|---|---|
| **Change → type + blast-radius** classification | (diff/ticket → labeled type + risk surface) | consistency; domain-specific signals |
| **Scenario → correct oracle** inference | (case → its pass/fail check) pairs | biggest hallucination risk area |
| **Coverage-gap detection** | (case set → what's missing) from reviewed sets | judgment, needs examples of "good vs thin" |
| **Domain vocabulary / format** | tenant's existing cases & specs (RAG first, tune later) | terminology + house style |

**Data examples to collect (in priority order):**
1. **(change/story → good test-case set)** pairs — from existing test repos, curated by senior QA. The gold set.
2. **(scenario → oracle)** pairs — teaches checkable assertions vs "it works".
3. **Escaped-defect corpus** — `(prod bug → the test that would've caught it → which lens/technique)`. Highest signal.
4. **Negative examples** — fabricated/wrong/redundant cases *labeled as bad* — trains the Governor + Critic to reject.

**Sequencing:** start with **strong prompting + RAG** over the tenant's own specs/cases/defects (no
tuning). Fine-tune only the narrow judgment tasks above once you have labeled data. Reserve any tuning
for **consistency and domain fit**, never for factual data generation (libs own that).

### Beyond UI / DB / mutation — the full change-type → technique map
The brief mentioned UI, DB, and mutation, but there are more change types, each needing a *different*
scenario bundle. The agent should recognize all of these:

| Change type | Scenario/technique bundle to generate |
|---|---|
| **UI** | happy + negative + state (back/refresh/double-submit) + BVA + locale/responsive + a11y |
| **Backend logic** | decision tables + BVA/equivalence + error-code matrix + property invariants + idempotency |
| **DB / schema / migration** | differential (old vs new) + up/down migration + null/default/boundary rows + backward-compat |
| **Infra / config** | fault injection + latency/retry/timeout + capacity/load + config-rollback |
| **Contract / API** | contract tests + schema validation + versioning/deprecation + error-shape stability |
| **Performance / scaling** | load/soak/spike + latency SLOs + resource limits + degradation behavior |
| **Security / auth** | authz matrix + injection/fuzzing + session/token + privilege escalation |
| **Feature-flag / rollout** | flag on/off/partial + interaction with other flags + fallback path |
| **ML / model change** | metamorphic relations + fairness/bias + drift + confidence thresholds |
| **Batch / ETL / pipeline** | idempotent reruns + partial-batch failure + late/duplicate data + ordering |
| **3rd-party integration** | downstream-down + slow/malformed response + retry + contract drift |

(Mutation testing is *not* a change type — it's a suite-quality audit; see landscape §6.)

---

## 10. The learning loop — a two-tier "common brain" for SaaS
Goal: get smarter across every tenant **without leaking one tenant's data into another**. Two layers:

- **Tenant-private layer** — each tenant's specs, cases, edits, and defects. Used via RAG for *their*
  authoring only. **Never crosses the boundary.** This is their competitive/confidential surface.
- **Shared "common brain"** — learns **abstracted patterns and heuristics**, not raw data:
  *"auth changes tend to need concurrency tests", "date fields need timezone cases", "coupon logic
  historically leaks single-use bugs."* Federated-style: patterns generalize, records don't travel.

**Signals the loop learns from:**
1. **Escaped defects** — a bug that reached prod = a *missing* test. Back-attribute: which lens/technique
   *should* have caught it → strengthen that lens next time. (Highest-value signal.)
2. **QA edits/rejections** — cases the QA deletes or rewrites = negative signal on the generator.
   Cases kept unchanged = positive.
3. **Execution outcomes** — always-passing / flaky cases = low information value; deprioritize their shape.
4. **Coverage↔escape correlation** — which dimensions, when covered, actually reduce escapes.

**Loop mechanics:** `capture signal → attribute to a technique/lens → update
(retrieval index, prompts, or fine-tune) → measure (did escape rate drop? did QA edit less?)`, run
against an **offline eval harness** (held-out change→case sets) so you don't regress. This mirrors this
project's discipline: measure real deltas, don't assert improvement.

**Guardrails:**
- **Privacy:** the common brain stores patterns/embeddings-of-patterns, not tenant records; PII scrubbed
  before any shared learning. Per-tenant opt-out.
- **No overfit to one tenant:** weight contributions so a large tenant's domain doesn't skew heuristics
  for everyone.
- **Abstain over fabricate:** if a heuristic's confidence is low for a tenant's domain, surface it as a
  *suggestion*, not an auto-added case (false-heal=0 mindset applied to authoring).

---

## Open questions for the QA persona (worth deciding before build)
- What change artifacts can we realistically ingest — PR diffs? Jira only? Figma? (drives the Classifier)
- Is there an existing test-case repo to dedup/regression-select against? (drives §7.1)
- Do we have escaped-defect history to learn from? (drives §7.5)
- Export target — TestRail / Xray / Zephyr / plain Gherkin? (drives the artifact schema in §6)
