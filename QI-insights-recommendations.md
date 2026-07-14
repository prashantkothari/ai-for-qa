# Quality Intelligence — Insights Layer Recommendations
_Testsigma · draft for review · 2026-07-07_

## Purpose

Answer four things:
1. What is the market doing about Quality Intelligence (QI)?
2. Where do the existing Phase 1 docs (5-metric model + 17 event funnels) need to adapt?
3. What insights actually improve a QA/Eng Manager's day-to-day?
4. Which AI use cases matter, and in what order?

Plus a validated structure for the metric catalog (org / release / test-case tiers, with corrections) and a red-team of the current model.

---

## 1. Market scan (2025–26)

### Category state
- **Tricentis owns the term "Quality Intelligence"** after acquiring SeaLights (2024). Their stack: multi-stage coverage (unit + API + E2E + manual in one view), **Test Gap Analysis on changed code** ("Modified Code Coverage Gap"), test-impact analysis, coverage-grounded quality gates that block untested changes, ML release-risk. Repositioned in 2025 as "agentic quality engineering" via MCP servers.
- **Gartner shipped the first-ever Magic Quadrant for AI-Augmented Software Testing Tools (2025)** — Leaders: Tricentis, OpenText, Keysight. The Peer Insights category has already been renamed to "Agentic Software Quality Assurance Platforms."
- Tricentis' 2025 Quality Transformation Report: **63% of orgs ship code without full testing; 81% report >$500K/yr defect cost**. This is the marketing spine of the category — AI code velocity has made QI/quality gates the bottleneck control point.

### Two disconnected stacks (the moat opportunity)
| Stack | Vendors | Insights they surface |
|---|---|---|
| **CI-side / dev-facing** | Launchable (CloudBees Smart Tests), Datadog Test Optimization, Trunk Flaky, BuildPulse | Predictive test selection (BMW: −50% machine-hours, −90% duration), flaky detection + auto-quarantine + **AI auto-fix** (Datadog Bits AI), machine-hour waste. **30–70% of failures in mature suites are flakes.** |
| **QA-manager-facing** | Katalon TestOps, Tricentis qTest, TestRail, Allure TestOps | Release-readiness dashboards, quality gates, requirements coverage %, defect/run trends, high-risk-module highlighting, top-risk tests. |

Only Tricentis (via SeaLights) credibly bridges both. That bridge is our opening.

### Other notable vendors
- **mabl — Auto TFA (Jun 2025):** autonomous failure triage + root-cause summaries + fix recommendations; 85% maintenance-reduction claim via multi-model self-healing.
- **QA Wolf:** managed service — sells outcomes ("80% E2E coverage in weeks, zero flakes, ~3-min pass/fail signal"), not dashboards.
- **Meticulous:** deterministic session-replay on every PR — implicit "risk coverage" from real user traffic; kills flakes by determinism.
- **Momentic, Functionize, Applitools:** authoring economics / self-healing / visual AI — thin on QI.
- **Digital.ai, LinearB, Typo:** DORA-adjacent (change failure rate, MTTR, and DORA 2025's new **rework rate** — added explicitly because AI-generated code raises downstream quality risk).

### Canonical metric list (from the market, by persona)

**Org / QA-manager / exec**
- Defect escape rate (QA-found vs customer-found), defect density, cost of quality
- Automation coverage % + automation ROI (industry claims 250–600% by vertical)
- MTTD/MTTR of defects and of broken tests; team throughput
- DORA-adjacent: change failure rate, **rework rate (new in DORA 2025)**, MTTR

**Release**
- Release-readiness composite (~/100)
- Quality gates: pass-rate thresholds, defect severity distribution, coverage thresholds; **SeaLights-style gates on untested changed code** (Sonar-quality-gate analog for tests)
- Requirements coverage vs code coverage vs **risk coverage** (three distinct axes vendors increasingly triangulate)
- Modified-code coverage gap; escaped defects per release

**Test-case / suite**
- Flakiness score / flake rate, test health, pass/fail trend
- Suite duration, machine-hours, parallelisation efficiency
- Test impact (which tests exercise changed code), redundant/never-failing tests
- Maintenance burden (heals per test, broken-locator rate)

### AI use cases seen in market
1. Predictive test selection / TIA — Launchable, SeaLights
2. Flaky detection + auto-quarantine + **AI auto-fix** — Datadog, Trunk
3. Root-cause clustering of failures — mabl, Functionize (research: 90%+ of failures collapse into 5–7 recurring patterns)
4. Coverage-gap discovery on changed code — SeaLights
5. Release-risk prediction — Digital.ai, SeaLights, Katalon
6. **NL "ask your quality data" copilots — underbuilt everywhere** (generation copilots exist; conversational analytics does not) — clear white space
7. Self-healing + maintenance analytics — mabl, Functionize, Momentic

---

## 2. GenAI-era coverage: what QI must learn

GenAI changes the metric *shape*, not just the target. Two dimensions:

### 2a. Testing GenAI-powered apps (chatbots, copilots, agentic features)

Binary pass/fail breaks down. QI needs a new **AI-Quality metric family**:

| Metric | Why it matters |
|---|---|
| **LLM-as-judge score** trend lines (G-Eval style) | Rubric-based scoring per prompt/feature/model version |
| **pass^k, not pass@k** | pass@k = passes ≥1 in k runs (overstates); pass^k = passes *all* k runs (the real number for customer-facing agents). A 75%/trial agent: pass@3 = 98%, **pass^3 = 42%**. |
| **Judge reliability** | Judge–human agreement + judge variance across reruns; judges are themselves non-deterministic |
| **Drift vs. model version** | Silent provider updates → ~35% error-rate jumps observed within 6 months on unchanged models |
| **Safety panel** | Hallucination rate, toxicity, bias, jailbreak/red-team pass rate |
| **Cost + latency per interaction** | Quality-adjacent (judge quality vs. eval spend) |
| **Trajectory / tool-call metrics** for agents | Tool-selection accuracy, step efficiency, task-completion vs. trajectory correctness |

**Vendor landscape.** Eval-execution is held by LLMOps startups (DeepEval, Promptfoo, Braintrust, LangSmith, Arize/Galileo). Among mainstream QA vendors, **only LambdaTest/TestMu has shipped a real GenAI-app eval product** (agent-to-agent testing with hallucination/bias/effectiveness metrics). Tricentis, Katalon, mabl focus on agentic *authoring*, not eval metrics.

**Play for Testsigma:** don't rebuild evals — **ingest results from DeepEval/Promptfoo/Braintrust and be the cross-suite analytics/trend layer** (same position QI holds vs. test runners today). Add AI-Quality as a first-class metric family alongside the current 5.

### 2b. Platform breadth (SaaS + desktop + GenAI)

- QI today is web/SaaS-first. Desktop is legacy-tool territory (TestComplete, Ranorex, Eggplant) — none has a modern QI layer.
- **Computer-use agents change this**: Claude Sonnet 4.6 ~72% on OSWorld; OpenAI shipped macOS automation. Vision-driven execution makes Windows/macOS coverage feasible without OS-specific object engines. ~70% reliability still requires human-in-loop.
- **Implication:** design the QI event schema so desktop runs (screenshot evidence, per-step agent confidence, retry count) are first-class; pass^k / consistency metrics apply doubly to computer-use-driven tests.

### Additions this triggers
1. A **6th metric family: AI Quality** — pass^k, judge score, safety panel, drift-vs-baseline — surfaced at all three tiers. **Not** a component of the Release Readiness composite on day 1 (uncalibrated weights); visible beside it.
2. An **execution-context dimension** on every metric: `{web | mobile | desktop | genai-eval}` — so managers can slice "release readiness for the desktop surface" or "AI-quality trend for the copilot feature" without a schema rewrite later.

---

## 3. Gap analysis vs the two docs

The Phase 1 model is **strong and differentiated** — Confidence as a trust-modifier with flakiness + commitment-fulfillment is genuinely better than market pass-rate dashboards; AI-discovered gaps in the Coverage denominator is more honest than requirements-coverage. But there are important adaptations:

1. **Add an outcome metric: Defect Escape Rate.** All 5 current metrics are pre-release / leading. The manager's #1 real question is *"did quality actually improve?"* — escaped defects per release, tagged back to sprint, closes the loop and validates the Release Gate itself ("gates that said GO but escaped defects" = gate calibration).
2. **Add changed-code / test-gap awareness.** Today Coverage is gap-list-based. Market leader signal (SeaLights) is untested *changed* code. Even a proxy — stories/commits in sprint with zero linked accepted tests — makes Coverage risk-weighted, not just scenario-weighted.
3. **Add trend/velocity views.** Docs define point-in-time metrics; user asks "how is coverage improving release-wise." Persist per-sprint snapshots of all metrics; render release-over-release trends + gate-verdict history.
4. **Automation ROI / productivity insights are missing** but are the QA-manager's core "is this tool helping?" question. Funnels 3–5 + 15 already carry the raw events — surface: time-to-automate, % suite automated, maintenance/heal burden, AI cost per accepted test.
5. **Flakiness deserves its own surface**, not just a Confidence penalty: a flaky-test list with score, quarantine suggestion, trend (market table-stakes: Datadog/Trunk/Katalon).
6. **BLOCKED=FAIL** is defensible but report BLOCKED count separately (a blocked env is an ops problem, not a code problem).
7. **CONDITIONAL-GO needs a defined sign-off workflow with named-reason capture** (funnel 10 implies this — make it explicit).

---

## 4. Red-team of the current model (must-fix items)

An adversarial review surfaced these. Every one has a concrete fix.

| # | Attack | Severity | Fix |
|---|---|---|---|
| 1 | **Coverage denominator is self-referential.** `accepted/(accepted+pending AI gaps)` measures agreement with the agent, not product coverage. Weak agent → flattering 100%. Flooding agent → craters, no risk change. **Bulk-reject before review → coverage inflates** (rejects leave the denominator). | **HIGH** | Require a reason on every rejection; show rejection-rate beside coverage. Rename honestly to **"AI Gap Closure."** Make changed-code coverage the primary axis, not a Phase-2 nice-to-have. |
| 2 | **Coverage is non-monotonic across agent versions.** A model/prompt upgrade re-scans → denominator shifts → release-over-release trend reflects agent noise. First VP question: "why did coverage drop 20 pts?" — "we retrained the gap finder" kills credibility. | **HIGH** | Version-pin the denominator per release snapshot; annotate agent-update events on trend lines. Never compare across agent versions without a UI footnote. |
| 3 | **Cross-machine disagreement ≠ flaky.** Passing on Chrome / failing on Safari is *exactly the platform bug the matrix exists to find*. Marking it flaky penalises the team for finding it → incentive to shrink the matrix. Goodhart in one move. | **HIGH** | **Flaky = non-deterministic same environment, cross-run.** Consistent cross-machine divergence routes to a defect workflow, not a flakiness penalty. Requires ≥2 runs per machine — state this as an explicit data requirement. |
| 4 | **Confidence is a black box.** Priority-weighted × flakiness-filtered × plan-scoped → a manager seeing 71→64 can't act. And scoping to "topmost generated plan" means generating a deep plan you never run tanks Confidence (or never generating one flatters it → **gaming by not planning**). | **HIGH** | Mandatory waterfall breakdown ("−12: 40 P1 units unexecuted; −5: 8 flaky units — here they are") + top-3 recommended actions. Scope is an explicit, user-visible commitment, not silently inferred. |
| 5 | **Named-tester metrics are an adoption landmine.** Surveillance optics, gaming (shallow high-volume scenarios, rubber-stamp reviews), EU works-council blockers. **The measured testers decide renewal.** | **HIGH** | Phase 1 ships **team-aggregate + private self-view only.** Named-individual views opt-in per workspace later, with visible policy. |
| 6 | **Release Readiness 0–100 with arbitrary weights won't be trusted.** Every vendor's composite is distrusted for exactly this reason. False precision. | **HIGH** | **Lead with the Gate's rule trace** ("NO-GO: 14 P1 units unexecuted; Payments coverage < threshold"), not the scalar. If the composite ships: configurable weights, always-visible component breakdown, and **log every GO-that-escaped from day 1** for future calibration. |
| 7 | **"Latest execution wins" invites pass-rate laundering** — rerun failing units until green before the gate. Combined with BLOCKED=FAIL, teams learn to rerun blocked/failing units right before the gate. Oldest QA game. | **MED** | Surface rerun count + **first-attempt pass rate** alongside final pass rate. Flag fail→pass flips without a code/test change (also a flakiness signal, consistent with fix #3). |
| 8 | **Metrics assume AI-feature adoption.** All denominators derive from AI-generated artifacts. A legacy-suite enterprise using AI lightly gets empty metrics — precisely the enterprise accounts with the most existing tests. | **MED** | Define degraded-mode behaviour: metrics must work on manually-authored suites with AI components as enhancers. |
| 9 | **Escape-rate auto-attribution is vaporware as scoped.** Prod incident → sprint/test-gap linkage needs Jira integration, component→suite mapping, and a causality model — none exist in the 17 funnels. | **MED** | Honest MVP: manual "tag this Jira bug to release + gap/test" flow + one killer report — **"gate said GO, N escaped defects tagged"**. Auto-attribution stays Later with explicit dependencies. |
| 10 | **No "why did this number change" explainability spec.** Managers screenshot a dashboard once and never return without click-through-to-evidence + since-last-snapshot delta explanation. Single biggest adoption failure mode for quality dashboards. | **HIGH for adoption** | **"Every metric is clickable to its evidence set + has a since-last-snapshot delta explanation"** = Phase 1 acceptance criterion, not UI polish. |
| 11 | **Jira linkage missing from day-1 scope.** QA managers live in Jira. Also a prerequisite for changed-code coverage and escape tagging. | **MED** | Minimal Jira read integration (linked stories, linked bugs) in Phase 1. |
| 12 | **Nested-plan containment is asserted, not real.** Smoke⊂Feature⊂Regression assumes strict subset containment; real suites violate this constantly. When containment breaks, Confidence's scope math silently double-counts or orphans units. | **LOW/MED** | Validate containment at plan-generation time; surface violations; define metric behaviour for non-nested plans explicitly. |

**Two things to fix before any design review:** (a) the Coverage denominator (#1, #2 — flagship metric, most gameable), and (b) shipping named-tester metrics (#5 — can poison adoption org-wide). Lead the Readiness story with the auditable **Gate rule trace**, not the composite.

---

## 5. Recommended 3-tier metric structure (validated with corrections)

The user's proposed 3 tiers (manager / release / test-case) are right, with two corrections:
- **Split test-case tier** into **tester-facing** (individual/team productivity) and **test-asset health** (flakiness, staleness) — they answer different questions.
- **Manager tier is trend + ROI**, not live-ops (that's release tier).

### Tier 1 — QA Manager / Org (trend + ROI)
| Insight | Feeds from | Notes |
|---|---|---|
| Coverage trend across releases | Snapshot of Coverage metric per sprint close | With agent-version annotations (red-team #2) |
| **Escape rate trend** | Manual Jira tag (MVP) → auto later | The single missing outcome metric |
| Automation coverage % + ROI | Funnels 3–5 | % suite automated, time-to-automate, hours saved |
| **AI acceptance rate** (tool efficacy) | Funnel 3 | % of AI-authored tests accepted directly vs. modified vs. rejected |
| **AI cost per accepted test** | Funnel 15 | The "is Testsigma worth it" number |
| Flaky-debt trend | Funnel 5 + rerun events | Count + trend of quarantined tests |
| MTTR-of-failing-tests | Funnel 11 | `test_case.status.update_required_flag` age |
| Team throughput | Funnel 1 | Sprints closed, gaps addressed |
| **AI-Quality trend** (if customer tests GenAI apps) | External eval-tool ingest | Judge score + pass^k + safety panel |

### Tier 2 — Release / Sprint (the existing 5-metric model, corrected)
- **Release Gate rule trace** (the *primary* release-decision surface — auditable, per red-team #6)
- Coverage (renamed **AI Gap Closure** + a parallel **Changed-Code Coverage** proxy)
- Pass Rate (with **rerun count + first-attempt pass rate** shown, per red-team #7)
- Confidence (with **mandatory waterfall breakdown**, per red-team #4)
- Release Readiness 0–100 (component breakdown always visible, weights workspace-configurable, per red-team #6)
- Burndown of pending gaps
- Untested-changed-stories list (per red-team #11)
- **"What changed since last verdict"** delta panel (per red-team #10)
- CONDITIONAL-GO sign-off workflow with named-reason capture (funnel 10)
- Execution-context slice: web / mobile / desktop / genai-eval (§2b)

### Tier 3a — Tester / Team (Phase 1 = team-aggregate + private self-view only)
- Scenarios authored & accepted — **breadth** (modules touched), **depth** (edge/boundary vs happy-path — derivable from plan-tier membership: smoke → deep-regression)
- Review turnaround
- Gap-closure contribution
- ⚠ Named-individual views are Phase 2, opt-in per workspace (red-team #5)

### Tier 3b — Test-asset health
- Flakiness score (per fixed definition, red-team #3) + last-10-run trend
- Heal/maintenance count
- Machine-level pass matrix (the platform-bug view red-team #3 unlocked)
- Staleness (update_required_flag age)
- Never-fails / redundancy candidates
- Rerun history (feeds red-team #7)

---

## 6. AI use cases — roadmap

**Now (data already in the 17 funnels — ship in Phase 1):**
- Coverage-gap discovery (core; already there)
- **Flaky detection + auto-quarantine suggestion** (per the fixed definition — same-env cross-run)
- **Failure root-cause clustering** — 5–7 recurring patterns cover 90%+ of failures
- Auto-triage of plan-execution failures (funnel 8)
- AI cost-per-outcome analytics (funnel 15)

**Next (Phase 2):**
- **Risk-based test selection** — the pragmatic answer to "topmost executed" scope gaps: run the subset relevant to the change
- **Release-risk prediction** — trained on gate-verdict + escape-tag history
- **Anomaly detection on metric trends** — sudden pass-rate / duration shifts
- **Auto-drafted sprint quality summary reports** (funnel 13)
- **AI-Quality metric family ingest** — DeepEval / Promptfoo / Braintrust connectors

**Later (differentiation white space):**
- **NL "ask your quality data" copilot** over the event store — the market's clearest gap
- **Escaped-defect auto-attribution** — prod incident → sprint / test-gap linkage
- **Gate self-calibration** — tune thresholds from escape outcomes
- **Agentic test maintenance** — auto-fix flaky / broken tests (mabl / Datadog-style)
- **Desktop QI via computer-use agents** — with pass^k as the reliability metric

---

## 7. Phase 1 scope proposal

**Ship:**
- Release-Gate rule trace as the primary release surface
- Renamed "AI Gap Closure" + changed-code proxy + Jira read integration
- Confidence with mandatory waterfall + user-visible scope commitment
- Fixed flakiness definition (same-env cross-run); flaky list + quarantine suggestion
- First-attempt pass rate + rerun count surfaced beside final pass rate
- Tier-1 manager dashboard: coverage trend, AI acceptance rate, AI cost per accepted test, automation ROI, flaky-debt, MTTR-of-tests
- Tier-3b test-asset health page
- Tier-3a **team-aggregate + private self-view only**
- Manual Jira-bug-to-release tag flow + the "GO-but-escaped" report
- Click-through-to-evidence + since-last-snapshot delta on every metric

**Explicitly deferred (with reason):**
- Release Readiness composite as primary lead (uncalibrated weights)
- Named-individual tester metrics (adoption risk)
- AI-Quality metric family (needs partner integrations)
- Escaped-defect auto-attribution (vaporware without Jira + component map)
- Gate self-calibration (needs escape history)

**Phase 1 acceptance criteria to encode now:**
1. Every metric clicks through to its evidence set.
2. Every metric shows a since-last-snapshot delta explanation.
3. Every rejected AI gap has a captured reason.
4. Every release snapshot pins its agent version.
5. Every GO gate verdict is logged for later escape-calibration.
6. Metrics degrade gracefully on manually-authored suites (no AI usage assumed).
