# Test Authoring & Scenario-Generation Landscape

## Context
Goal: improve test-authoring / scenario generation so that, given a user story or use case, the
system produces a *comprehensive* set — positive, negative, edge, boundary, adversarial, etc. This
doc maps the market's testing paradigms (the "hypothesis / antithesis / formal-methods" family and
beyond), what each is good at, and then defines what a *good test-case set* looks like and how to
generate one from a user story. Scope is comprehensive (not just UI): code-level, system-level, and
QA-design techniques.

---

## 1. The two axes everything sits on
Every testing technique is really answering two separate questions. Confusing them is why the space
looks messy.

- **Input strategy** — *where do the test inputs come from?* (hand-picked examples → random →
  coverage-guided search → generated from a spec/model → hostile fault injection)
- **Oracle strategy** — *how do you know the output is correct?*

> **What is an "oracle"?** Plainly: **the thing that decides pass/fail** — your verification lever.
> It answers "how do I know this output is right?" It can be:
> - a **hard-coded expected value** — `assert result == 42`
> - a **property** that must always hold — `output is always sorted`
> - a **relation between two runs** — `f(x) == f(mirror(x))`
> - a **reference implementation** to diff against — `new_impl(x) == old_impl(x)`
> - or just **"it didn't crash"** (crash-only).
>
> The **"oracle problem"** = for most real inputs you *don't* have a precomputed right answer, so you
> need one of the cleverer oracles above. Half the paradigms below are really just clever oracles.

---

## 2. The paradigm map

### A. Specification-based / classic QA design (deterministic, human-authored)
The traditional test-design techniques — still the backbone of a "good set" and the vocabulary an
LLM generator should emit.
- **Equivalence Partitioning** — group inputs that behave the same; test one per class.
- **Boundary Value Analysis (BVA)** — test at/just-inside/just-outside limits (min, min−1, max, max+1, empty, zero, off-by-one).
- **Decision Tables** — enumerate combinations of conditions → expected actions (rules/business logic).
- **State-Transition testing** — model states + events; cover valid and invalid transitions.
- **Cause-Effect graphing** — inputs (causes) mapped to outputs (effects).
- **Pairwise / Combinatorial (n-wise) testing** — most bugs come from ≤2-parameter interactions; cover all pairs instead of the full cartesian explosion. Tools: PICT, ACTS, AllPairs.
- **Use-case / scenario testing** — end-to-end flows following actor goals.
*Good at:* readability, requirement traceability, negative/boundary cases. *Weak at:* deep logic bugs, concurrency, the unknown-unknowns.

### B. Property-based testing (PBT) — "hypothesis"
Assert *properties* that must hold for **all** inputs; the framework generates hundreds of random
inputs and **shrinks** any failure to a minimal counterexample.
- Tools: **Hypothesis** (Python), **QuickCheck** (Haskell), **fast-check** (JS/TS), **jqwik** (Java), **PropEr/proptest**.
- Property patterns: round-trip (encode∘decode = id), invariants, idempotence, commutativity, "never crashes", model-oracle (compare to a simple reference implementation).
*Good at:* edge cases you didn't think of; strong for pure logic, parsers, serializers, data structures.

### C. Metamorphic testing (MT)
A specialization of PBT that **solves the oracle problem via relations between runs**, not absolute
answers. If you can't say what `f(x)` should be, you often *can* say how `f(x)` relates to
`f(transform(x))`.
- Example metamorphic relations (MRs): `sin(x) == sin(π−x)`; a search for "car" must return ⊇ results of "red car"; shuffling input rows shouldn't change a sum; adding a synonym shouldn't flip a classifier.
*Good at:* ML models, search/ranking, numeric/scientific code, anything with no ground-truth oracle. Rising fast for LLM/AI-system testing.

### D. Fuzzing
Throw malformed/random/mutated inputs and watch for crashes, hangs, leaks, assertion failures.
- **Mutation-based** (mutate seed corpus) vs **generation-based** (build from a grammar).
- **Coverage-guided** fuzzers evolve inputs toward new code paths: **AFL/AFL++**, **libFuzzer**, **Honggfuzz**; **go-fuzz**, Jazzer (JVM), Atheris (Python).
*Good at:* security/robustness, crash bugs, untrusted-input parsers. Oracle is usually just "didn't crash" (+ sanitizers: ASan/UBSan).

### E. Fault injection / chaos / deterministic simulation — "antithesis"
Don't just vary inputs — vary the **environment**: kill nodes, drop/delay packets, corrupt disk,
skew clocks, exhaust memory. Verify the system upholds its guarantees anyway.
- **Chaos engineering** (production-ish): Chaos Monkey / Gremlin / LitmusChaos.
- **Jepsen** — the standard for finding distributed-systems / consistency bugs.
- **Antithesis** — autonomous platform: a *deterministic hypervisor* runs your whole stack in a simulated, hostile world (network blips, faults, fuzzed inputs), searches for a property violation, and — the key trick — any bug is **perfectly reproducible via a random seed**. It fuses PBT + fuzzing + fault injection + **Deterministic Simulation Testing (DST)**.
- **DST** as a discipline (FoundationDB, TigerBeetle) — make time/IO/scheduling deterministic so concurrency bugs replay 1:1.
*Good at:* distributed systems, concurrency, resilience, "does it survive the real world."

### F. Formal methods & symbolic techniques
Prove properties or exhaustively search the state space instead of sampling it.
- **Model checking**: **TLA+/TLC**, **Alloy**, SPIN — verify a *design/spec* against invariants and liveness; finds protocol/concurrency bugs before code exists.
- **Symbolic / concolic execution**: **KLEE**, SAGE, CBMC, angr — treat inputs as symbols, solve constraints to hit every path and auto-derive the exact inputs that trigger each branch/edge case.
- **SMT-backed contracts / deductive verification**: Dafny, Frama-C.
*Good at:* the hardest edge cases and the highest-assurance guarantees. *Cost:* expertise + effort; usually reserved for critical cores.

### G. Model-based testing (MBT)
Build an abstract model (often a state machine) of expected behavior; **auto-generate** test cases
(paths) from it. Tools: GraphWalker, fMBT. *Good at:* systematic coverage of workflows/UI flows,
regression suites, and mapping directly to state-transition scenarios.

### H. Contract & integration-boundary testing
Verify that services agree on their interface. **Consumer-driven contracts**: **Pact**; **Spring
Cloud Contract**; schema/OpenAPI validation; **Dredd**. *Good at:* microservices, preventing
integration drift.

### I. Differential (back-to-back) testing
Run the same input through two implementations (or old vs. new version) and diff outputs. Used for
compilers (Csmith), browsers, and as a regression oracle. *Good at:* when a reference implementation
exists.

### J. Mutation testing — *testing your tests*
Inject small faults ("mutants") into the code; a good suite should **kill** them. Measures suite
strength beyond line coverage. Tools: Stryker, PIT, mutmut, Cosmic Ray. *Use:* audit the quality of
a generated test set.

### K. Snapshot / golden / approval testing
Capture current output as the expected baseline; flag any diff. Tools: Jest snapshots, ApprovalTests.
*Good at:* cheap regression detection for large/complex outputs. *Weak at:* validating *correctness*
(only detects *change*).

### L. LLM / agentic generation (the 2025 layer)
LLMs translate a user story / PRD / Jira ticket / acceptance criteria into high-level scenarios
(happy / negative / edge / boundary) and then into steps or automation code. Best current practice
uses the LLM as a **generator on top of the techniques above** (e.g., prompt it to apply BVA +
equivalence partitioning + pairwise), not as a freeform guesser — and pairs it with a real oracle
(PBT/metamorphic/differential) so generated cases are *checkable*, not just plausible. Emerging:
self-healing selectors, feedback-driven iterative generation, requirements→property auto-formalization.

---

## 2b. See each type in one line (visual cheat-sheet)
Same running example where possible — a **login form** (`email`, `password`) or a **`total(cart)`**
function — so you can feel the difference.

| Paradigm | What it does, in one concrete example |
|---|---|
| **Spec-based (BVA)** | Password field min 8 / max 64 → test lengths **7, 8, 64, 65**. |
| **Spec-based (equivalence)** | Emails split into *valid* / *missing @* / *empty* → one test each, not 100. |
| **Spec-based (pairwise)** | Flags `remember-me × 2FA × role(admin/user)` → cover all *pairs* in ~4 tests, not 8. |
| **Decision table** | `if premium AND >$100 → free shipping` → enumerate all true/false rows → expected outcome. |
| **State-transition** | `logged-out → logging-in → logged-in → locked` → test each valid arrow **and** an illegal one (login while already locked). |
| **Property-based (Hypothesis)** | Generate 500 random carts → assert **`total(cart) >= 0`** always, and shrink any failure to the smallest breaking cart. |
| **Metamorphic** | No "correct" search result, but: results for **"red shoes" ⊆ results for "shoes"** must hold. |
| **Fuzzing** | Feed the login API 10k random/garbage byte strings → assert **it never 500s or crashes**. |
| **Fault injection (Antithesis/chaos)** | Mid-checkout, **kill the payment node / drop the network** → assert no double-charge, order stays consistent. |
| **Formal (TLA+ / symbolic)** | Model the auth protocol → prove **"no user ever reaches `logged-in` without a valid token"** for *all* interleavings. |
| **Model-based (MBT)** | Draw the checkout state machine → tool **auto-generates** every path through it as test cases. |
| **Contract (Pact)** | Frontend expects `{ token: string }` from `/login` → fail the build if the API drops or renames that field. |
| **Differential** | Run same input through **v1 and v2** of the pricing engine → flag any output that differs. |
| **Mutation testing** | Change `>=` to `>` in the code → a *good* suite has a test that now **fails** (mutant killed). |
| **Snapshot/golden** | Save today's rendered invoice HTML → alert if a future run **differs** from the saved baseline. |
| **LLM/agentic** | Paste the user story → model emits happy/negative/edge scenarios *applying the techniques above*. |

---

## 2c. Same cheat-sheet, one domain only — payment/checkout
§2b mixes examples across login/cart/checkout to keep each row self-contained. Here's the same table
with **one running example — card payment at checkout** — so the *difference between techniques* is
easier to feel than the difference in subject matter. Plain language, no formulas.

| Paradigm | What it does — with a payment example |
|---|---|
| **Spec-based (boundaries)** | Card charge min $1, max $10,000 → test at **$0.99, $1, $10,000, $10,001**. Just-inside and just-outside the limit. |
| **Spec-based (equivalence)** | Group cards into **valid / expired / wrong CVV / blocked**. Test one card per group — not 100 valid cards. |
| **Spec-based (pairwise)** | Combine **card type × currency × 3DS on/off**. Instead of every combination, cover all *pairs* — catches most bugs in a fraction of the tests. |
| **Decision table** | Rules like *"if amount > $500 AND new device → require OTP."* Write every true/false row of conditions and the expected outcome. |
| **State-transition** | Payment goes `pending → authorized → captured → refunded`. Test each valid step **plus one illegal one** (e.g. refund before capture). |
| **Property-based (Hypothesis)** | Feed 500 random carts and check a rule that must always hold: **charged amount = sum of items + tax − discount, never negative**. If broken, the tool shrinks to the smallest failing cart. |
| **Metamorphic** | When you don't know the "right" price, use a relation: **splitting a $100 payment into $60 + $40 must total exactly $100**. Or, adding a free item shouldn't change the total. |
| **Fuzzing** | Send 10,000 random/garbage payloads to the payment API → assert **it never crashes or leaks card data**, no matter what junk comes in. |
| **Fault injection (chaos)** | Mid-payment, **kill the payment gateway or drop the network** → assert no double charge, no half-completed order, cart stays consistent. |
| **Formal (TLA+ / symbolic)** | Prove mathematically that **"a customer is never charged twice for the same order"** — for *every* possible timing, not just tested ones. |
| **Model-based (MBT)** | Draw the checkout state machine (cart → address → pay → confirm) → the tool **auto-generates every path** through it as test cases. |
| **Contract (Pact)** | Frontend expects `{ status: "paid", txnId: string }` from the payment API → **build fails if the API renames or drops that field**. Prevents "it worked in staging" bugs. |
| **Differential** | Run the same order through the **old and new pricing engine** side by side → **flag any total that differs**. |
| **Mutation testing** | Change `if amount >= limit` to `if amount > limit` in the code → a *good* test suite has a test that now fails, proving it would catch that bug. |
| **Snapshot / golden** | Save today's receipt PDF → **alert if a future run produces a different one**. Catches unintended changes (but only detects change, not correctness). |
| **LLM / agentic** | Paste the user story "customer pays with saved card" → model emits happy/negative/edge scenarios *by applying the techniques above*, not by guessing. |

---

## 3. How to pick a strategy (and the "would UI use mutation?" question)

**First, separate two things people conflate:**
- **Scenario / coverage techniques** — how you *generate* the test cases (BVA, equivalence, pairwise, metamorphic, fuzzing, fault injection…).
- **Suite-quality techniques** — how you *grade the tests you already wrote*. **Mutation testing is this one.**

So: *"for UI, would we pick mutation?"* — **No, not to generate UI scenarios.** For UI you generate
with happy/negative/state/BVA/pairwise. Mutation testing is something you *optionally run afterward*
on any suite (UI included) to check the tests actually catch bugs. It's a grader, not a generator.

**Decision heuristics for generation:**
1. **Do I have a clear expected answer?** → yes: spec-based (BVA, decision tables, pairwise). No → keep going.
2. **Is it pure logic / a function with invariants?** → property-based.
3. **Is there no ground truth (ML, search, ranking, numeric)?** → metamorphic relations.
4. **Is the input untrusted / could be malformed?** → fuzzing.
5. **Does it span nodes / concurrency / must survive failure?** → fault injection / chaos / DST.
6. **Is it a critical protocol needing proof, not sampling?** → formal methods.
7. **Is it a service boundary?** → contract testing.
Most real features need a **bundle** (see §5), not one technique.

### Pick the technique by *what oracle you can afford*
| Situation | Best-fit paradigm |
|---|---|
| Clear expected outputs, business rules | Specification-based (BVA, decision tables, pairwise) |
| Pure logic, no obvious oracle, want edge discovery | Property-based + shrinking |
| No ground truth (ML, search, ranking, numeric) | Metamorphic |
| Untrusted input, security, crashes | Coverage-guided fuzzing |
| Distributed / concurrent / resilience | Fault injection, Jepsen, DST / Antithesis |
| Critical protocol/algorithm, need proof | Formal methods (TLA+, symbolic execution) |
| Service boundaries | Contract testing |
| Reference impl exists / regressions | Differential + snapshot |
| Audit suite quality | Mutation testing |

---

## 4. What a *good test-case set* looks like
Not "many tests" — **coverage across independent dimensions** with a checkable oracle for each.

1. **Positive / happy path** — primary success scenario(s) per acceptance criterion.
2. **Alternate valid paths** — legitimate variations, optional fields, permission tiers.
3. **Negative** — invalid input, wrong type/format, missing required fields, unauthorized action, business-rule violations; assert graceful, *specific* failure (right error, no partial state).
4. **Boundary / BVA** — min, min−1, max, max+1, zero, empty, one, off-by-one, length/precision limits, first/last.
5. **Equivalence classes** — one representative per behavior class (avoid redundant tests).
6. **Combinatorial** — pairwise coverage of interacting parameters/flags/states.
7. **State / sequence** — valid and *invalid* transitions, out-of-order actions, double-submit, back-button, resume.
8. **Data-variation** — nulls, unicode/emoji, very long strings, locale/timezone/number formats, injection payloads, duplicates.
9. **Environmental / non-functional** — timeouts, retries, concurrency/race, network loss, permissions, rate limits, idempotency; performance & security where relevant.
10. **Error-recovery** — partial failure, rollback, retry-safety, idempotent replays.

Quality attributes of the *set*:
- **Traceable** — each case maps to an acceptance criterion / requirement (and gaps are visible).
- **Independent & atomic** — one reason to fail; no hidden ordering dependencies.
- **Right oracle** — each case asserts something checkable (value, property, relation, or "no crash"), not just "it ran."
- **Minimal & non-redundant** — equivalence partitioning keeps it small; pairwise tames the explosion.
- **Prioritized by risk** — depth follows blast-radius, not uniform coverage.
- **Verified strength** — mutation score / coverage confirms the set actually catches faults.

### Worked example — a *good* set for one user story
**User story:** *"As a user, I can redeem a discount coupon at checkout. Coupons have a code, a
percentage (1–50%), an expiry date, and a minimum cart value of $20. Each coupon is single-use."*

A good set isn't 40 random tests — it's ~1 case per dimension, each with concrete **test data** and an
explicit **oracle (pass/fail check)**:

| # | Dimension | Test data | Expected oracle (pass/fail) |
|---|---|---|---|
| 1 | Positive / happy | valid code `SAVE20`, 20% off, cart `$100`, not expired, not used | Discount applied, total = **$80** |
| 2 | Alternate valid | max legal percentage `50%`, cart `$100` | total = **$50** |
| 3 | Boundary (min cart) | cart = **exactly $20** | Coupon **accepted** (min is inclusive) |
| 4 | Boundary (just below) | cart = **$19.99** | **Rejected** — "minimum cart $20" |
| 5 | Boundary (percent) | percent = `0%` and `51%` | Both **rejected** as invalid coupon config |
| 6 | Negative (bad code) | code `NOPE123` (doesn't exist) | **Rejected** — "invalid code", total unchanged |
| 7 | Negative (expired) | valid code, expiry = **yesterday** | **Rejected** — "coupon expired" |
| 8 | State / single-use | apply `SAVE20` **twice** | 1st succeeds, **2nd rejected** — "already used" |
| 9 | Data-variation | code `save20` (lowercase), ` SAVE20 ` (spaces), unicode | Handled per spec (case/trim rule) consistently |
| 10 | Equivalence | one representative each: valid / expired / used / below-min | No redundant duplicates of same class |
| 11 | Concurrency (non-func.) | same single-use coupon applied in **two simultaneous** checkouts | **Only one** succeeds — no double redemption |
| 12 | Error-recovery | payment fails **after** coupon applied | Coupon marked **unused again** (safe rollback) |

Why this is "good": every acceptance criterion is traced (percent range, expiry, min-cart,
single-use), boundaries are hit on **both sides** (#3/#4), each row has a *checkable* oracle (a number
or a specific error — not "it works"), classes aren't duplicated (#10), and it reaches past the happy
path into concurrency and rollback (#11/#12) where the real bugs live.

---

## 5. A story-type → scenario generator (the practical model)
The system should first **classify the user story**, then apply the matching technique bundle. Sketch:

- **CRUD / form / data-entry** → BVA + equivalence + negative (validation) + duplicate/idempotency + authz.
- **Business-rule / pricing / eligibility** → decision tables + pairwise over conditions + boundary on thresholds.
- **Workflow / multi-step / stateful** → state-transition + MBT paths + invalid-order + resume/interrupt.
- **Search / ranking / recommendation / ML** → metamorphic relations + monotonicity + subset/superset invariants.
- **Integration / API / microservice** → contract tests + schema validation + error-code matrix + timeout/retry.
- **Parser / import / file upload / untrusted input** → fuzzing + property round-trips + malformed-data corpus.
- **Distributed / concurrent / real-time** → fault injection + idempotency + race/ordering + partition tolerance.
- **UI / E2E flow** → happy + negative + state (back/refresh/double-click) + responsive/locale + self-healing selectors.

Output contract per generated case: `id, story-ref, category (positive/negative/edge/…), technique,
preconditions, inputs, steps, expected-oracle, risk`.

---

## 6. Tooling — integrate all of them? No. Compose, emit, and ingest.
Short answer to *"do we integrate GraphWalker for MBT, Cosmic Ray for mutation, etc.?"*: **you do not
run every engine yourself.** Split the tools into three roles and only *embed* the first:

- **① Embed (authoring-time, in-process)** — libraries that *produce inputs/data* while the agent
  reasons. These are deterministic and don't hallucinate, so they run inside the copilot:
  - Fake/realistic data: **Faker**, **mimesis**
  - Pairwise/combinatorial: **PICT**, **ACTS**, AllPairs
  - Property/strategy generators: **Hypothesis**, **fast-check** (as data-strategy engines)
  - A curated **boundary + nasty-data catalog** (nulls, unicode, huge, locale, injection)
- **② Emit (export targets)** — the agent *writes specs/configs* for downstream engines; it doesn't
  execute them:
  - **GraphWalker / fMBT** ← emit the state-model for MBT path generation
  - **Pact / OpenAPI** ← emit contract definitions
  - **k6 / Locust / JMeter** ← emit load scripts (infra/perf)
  - **Jepsen / Antithesis / chaos configs** ← emit fault scenarios
  - **Gherkin + TestRail / Xray / Zephyr** ← emit the human/automation test cases
- **③ Ingest (feedback signals)** — the agent *reads results* from these to learn (see the agent doc):
  - **Mutation testing** (**Stryker**, **PIT**, **Cosmic Ray**, mutmut) → suite-strength grade
  - CI/test-run outcomes, flakiness, coverage, escaped-defect reports

**Ideal stack, layered:**
```
Intake:     git/PR API · Jira · Figma
Reasoning:  LLM + orchestration + the panel/critic loop
Data-gen:   Faker/mimesis · PICT/ACTS (pairwise) · Hypothesis strategies · boundary catalog   [EMBED]
Emit:       Gherkin · TestRail/Xray/Zephyr · GraphWalker model · Pact · k6 · chaos config      [EMIT]
Feedback:   Stryker/PIT/Cosmic Ray · CI results · escaped defects  →  learning loop             [INGEST]
```
**Adopt incrementally:** start with *one* export (Gherkin + a single TMS) + Faker + PICT pairwise.
Add mutation-as-audit and MBT export later. Don't build a mega-integration up front — be a **composer**
that plugs into best-of-breed engines, not a re-implementation of them.

---

## 7. Opinionated recommendations (my take on the landscape)
Where I'd actually spend effort, given most teams' starting point:
1. **The common failure is over-indexing on happy-path + snapshot tests.** They pass forever and catch
   little. Highest-ROI additions for most teams: **pairwise** (kills combination bugs cheaply),
   **boundary-value discipline on every field**, and **one metamorphic or fault-injection pass** for
   the no-oracle / resilience gaps.
2. **Mutation score is the honest coverage metric — not line coverage.** Line coverage says code ran;
   mutation says a test would *notice* if it broke. Use it to grade sets, sparingly (it's slow).
3. **Go oracle-first, everywhere.** A test without a specific pass/fail check is theatre. Make the
   oracle the first thing authored, not an afterthought.
4. **Match the paradigm to the oracle you can afford** (the §3 table), not to fashion. No ground truth →
   metamorphic; untrusted input → fuzzing; distributed → fault injection. Don't force PBT where a plain
   decision table is clearer.
5. **Buy/compose, don't build.** Property-based, fuzzing, MBT, mutation, chaos are all mature OSS/commercial
   engines. The scarce, buildable value is the **reasoning that decides *what* to test** — not another runner.
6. **Formal methods: reserve for the critical core.** TLA+/symbolic execution pays off on protocols,
   money, and concurrency — overkill for CRUD.

---

## Sources
- [How Antithesis works](https://antithesis.com/docs/introduction/how_antithesis_works/) · [Fault injection](https://antithesis.com/docs/environment/fault_injection/) · [Deterministic Simulation Testing](https://antithesis.com/docs/resources/deterministic_simulation_testing/)
- [SE Radio: Will Wilson on Deterministic Simulation Testing](https://se-radio.net/2025/09/se-radio-685-will-wilson-on-deterministic-simulation-testing/) · [Autonomous testing of etcd's robustness (CNCF)](https://www.cncf.io/blog/2025/09/25/autonomous-testing-of-etcds-robustness/)
- [Metamorphic testing (Wikipedia)](https://en.wikipedia.org/wiki/Metamorphic_testing) · [Property-based tools for metamorphic testing](https://arxiv.org/pdf/2211.12003) · [Acceptance/use of metamorphic testing among OSS devs (2025)](https://www.tandfonline.com/doi/full/10.1080/23311916.2025.2522652)
- [From Prompts to Properties: LLM code gen with PBT (FSE'25)](https://dl.acm.org/doi/10.1145/3696630.3728702) · [A Tool for Test Case Scenario Generation Using LLMs](https://arxiv.org/pdf/2406.07021) · [LLM-Driven High-Level Test Case Generation](https://www.emergentmind.com/papers/2503.17998)
- [LLM-Powered Test Case Generation (Frugal Testing)](https://www.frugaltesting.com/blog/llm-powered-test-case-generation-enhancing-coverage-and-efficiency) · [How LLMs are reshaping QA in 2025 (CloudQA)](https://cloudqa.io/how-llms-are-reshaping-qa-in-2025/)
