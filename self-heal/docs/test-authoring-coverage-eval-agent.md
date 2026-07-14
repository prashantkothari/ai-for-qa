# Test-Authoring — Independent Coverage / Eval Agent

## Context
The authoring agent generates a Scenario→Case→Data set from a change (strategy doc §1, §6). It runs
its own in-loop coverage-critic self-check against the 12-rule rulebook in
[`test-authoring-agent-buildplan.md`](test-authoring-agent-buildplan.md) §6b. That self-check is
**cheap and mechanical** but suffers a known failure mode: **correlated blind spots**. If the same
model, prompt, and context missed a rule during authoring, re-asking that same pass "did you follow
all 12 rules?" tends to miss it again — the checklist runs, the box gets ticked, the case still isn't
there. Self-grading by the author is like proof-reading your own writing: you read what you intended
to write.

This doc specifies the **second, architecturally-independent pass**: the **Coverage / Eval Agent**.
It does not help author. It does not accept the authored set on faith. It **audits** the set as an
artifact against the same 12 rules (§6b) plus the eval rubric ([`buildplan §3`](test-authoring-agent-buildplan.md))
and the effectiveness scorecard in
[`test-authoring-layers-logging-metrics.md`](test-authoring-layers-logging-metrics.md) §4.

Named for clarity in the rest of this doc:
- **Authoring pass** = the pipeline that produced the set (strategy §8 components).
- **Eval Agent** = this doc's subject.

> **Companion doc note.** [`buildplan §6b`](test-authoring-agent-buildplan.md) explicitly states the
> rulebook is the single shared source of truth for both passes and must not be forked. This doc
> uses the same 12 rules verbatim; if the rulebook evolves, both passes update together.

---

## 1. Inputs / outputs contract

### 1a. Inputs (the artifact under audit)
The Eval Agent takes a **frozen bundle**, not a live workspace:

| Input | Shape | Source |
|---|---|---|
| **Change artifact** | diff / PR / ticket / mockup + acceptance criteria, plus the classifier's output (change-type, blast-radius, platform) | intake → classifier (strategy §2) |
| **Authored set** | full Scenario→Case→DataVariation tree per strategy §6 schema | authoring pass output |
| **Abstain Register** | open questions the authoring pass raised, each with candidate oracles per resolution | authoring pass output (rule 11) |
| **Provenance sidecar** | per-case: which technique/lens produced it, prompt+seed, confidence tag (`measured/asserted/simulated/proxy/abstained`), which §6b rule it claims to satisfy | generator provenance log ([`layers-logging §3c`](test-authoring-layers-logging-metrics.md)) |
| **Tenant context (RAG-only, read-only)** | past cases, escaped-defect corpus, existing regression suite — for redundancy and escape-catch checks | tenant-private layer (strategy §10) |
| **Golden entry (if applicable)** | expert case set for this change, if the change is in the golden set | curated set (buildplan §3a) |

The Eval Agent **does not receive**: the authoring pass's in-loop critic output, or the authoring
model's chain-of-thought. Independence requires it re-derive expectations from the *change*, not
inherit them from the *authoring trace*.

### 1b. Outputs (the coverage report)
A structured, machine-readable report. **All numbers tagged `measured / simulated / proxy /
asserted / abstained`** per CLAUDE.md.

```
CoverageReport {
  set_id, change_ref, eval_run_id, eval_agent_version, rulebook_version,
  scores: {                     // buildplan §3b + layers-logging §4 leading indicators
    coverage_recall:      { value, tag, denominator_source },
    oracle_present_rate:  { value, tag },
    traceability:         { ac_with_case_pct, case_with_ac_pct, tag },
    redundancy:           { near_duplicate_pct, tag, clustering_method },
    hallucination_rate:   { value, tag, evidence_refs },
    dual_branch_integrity:{ value, tag },              // §6b.1
    method_coverage:      { value, tag, missing_paradigms[] }, // §6b.9
    consistency:          { skeleton_variance, tag, n_runs },  // buildplan §3d, if applicable
  },
  rule_audit: [                 // one entry per §6b rule 1..12
    { rule_id, status: pass|warn|fail|not_applicable,
      evidence[], missing_cases[], severity }
  ],
  gap_list: [                   // prioritised, actionable
    { severity, rule_id, description, expected_case_shape,
      suggested_technique, traces_to_ac, blocks_release: bool }
  ],
  escaped_defect_backtest: [    // release-gate only; empty per-change
    { defect_id, would_be_caught_by_case_id|null, rationale }
  ],
  gate_decision: { verdict: ready|blocked|warn, blocking_findings[], warnings[] }
}
```

Rendered surfaces (parallel-session UI mockup work): a coverage report tab on the set, a
per-rule pass/fail strip, and a gap list that becomes the next authoring-round input.

---

## 2. The independent-enumeration technique

**The core question this agent must answer differently than the authoring pass:** not *"did you
tick each of the 12 rules?"* but *"given the change, what cases **should** exist — and where is
each one in the authored set?"* The audit is a **diff of expected vs. actual**, not a re-check.

Four mechanisms enforce independence:

### 2a. Re-derive expectations from the change, blind to the authored set
Step 1 of the eval runs **before** the authored set is loaded. Given only the change artifact +
ACs + classifier output, the agent independently produces an **Expected Coverage Manifest**:

```
ExpectedCoverageManifest {
  change_type, blast_radius, platform_pack,
  technique_bundle_required[],       // strategy §3 mapping, re-derived
  per_ac_expected_dimensions[],      // for each AC: which of the 10 dimensions apply
  cross_layer_requirements[],        // §6b.12 → L1/L4/L5 obligations from layers-logging §2
  regulatory_lens_requirements[],    // if flow carries money/suitability/replacement/PII
  platform_dimension_pack[],         // buildplan §4 packs
  abstain_expectations[],            // where the *spec* itself is silent → these SHOULD be abstains
}
```

Only **after** the manifest is committed (hashed, stored) does the agent load the authored set
and diff. This is the same trick a scientist uses to avoid confirmation bias — write the
prediction down before opening the results.

### 2b. Adversarial framing — "prove this set is incomplete"
The prompt/system message inverts the authoring stance. The authoring pass is told *"generate
comprehensive coverage"* (a goal it can plausibly self-declare met). The Eval Agent is told:
*"Assume this set is incomplete. Your job is to find the missing case. If you cannot find one,
justify it explicitly per rule."* Asymmetric burden of proof. This is the strategy doc's
"loop-until-dry" pattern (§4) applied as a gate, not a brainstorm helper.

### 2c. Panel of lenses — same lenses as brainstorm, but re-tasked
Re-use the brainstorm panel (strategy §4 — Rule-Lawyer, Boundary-Hunter, Adversary, Lazy/Confused
User, Ops/SRE, Regression-Keeper) but with **inverted tasking**:

| Lens | Authoring task | Eval task |
|---|---|---|
| Rule-Lawyer | enumerate spec branches | *find a spec branch with zero authored cases* |
| Boundary-Hunter | list boundaries | *find a numeric input whose min/max/inclusivity isn't tested* |
| Adversary | malicious inputs | *find an injection/authz vector not present in negatives* |
| Lazy/Confused User | wrong-order, refresh | *find a state transition not exercised* |
| Ops/SRE | timeouts, downstream-down | *find a fault-injection dimension the platform pack requires but the set omits* |
| Regression-Keeper | blast-radius | *find a nearby unchanged behaviour a QA-signed regression would have caught* |

Each lens runs blind to the others' outputs; findings are deduped at the end (classic
loop-until-dry panel). This directly matches the "perspective-diverse verify" pattern.

### 2d. Independence hygiene
- **Different model/temperature.** If authoring uses model *M<sub>a</sub>* at temp *T<sub>a</sub>*, eval uses
  *M<sub>e</sub>* (a different family or a different snapshot) at a lower temp. `asserted` — pending measurement
  once we have both models pluggable, but the principle is decorrelated model errors.
- **No shared prompt tokens.** Eval's system prompt is written to be adversarial to the authoring
  prompt's shape; they must not share phrasing.
- **No sight of the authoring pass's self-check output.** Eval sees the artifact and the
  provenance sidecar's *what*, never the authoring critic's *"I already checked X"*.
- **Golden set held out.** For changes that appear in the golden set, the authoring pass may or
  may not have been trained/tuned on similar examples; the Eval Agent's manifest is derived from
  the change itself, not from any golden lookup, so the audit stays fair.

---

## 3. Rule-by-rule audit logic

For each of the 12 §6b rules, the Eval Agent runs a **concrete check** on the artifact. Sketches:

| Rule | Concrete audit check | Severity default |
|---|---|---|
| **1. No orphan-oracle** | For every case: parse its oracle. Cross-reference every rule/threshold it depends on against the Abstain Register. If any dependency is `open` and the case is `asserted` (not dual-branch, not itself abstained) → **fail**. (This is the R1 fix from [`insurance-sample-set §R1.1`](test-authoring-insurance-sample-set.md).) | **blocking** |
| **2. Interaction coverage** | From the change surface, extract fields/flags on any shared screen. If ≥2 interact (co-referenced in a rule, or same submit), verify at least one **pairwise** case exists. Absence of a pairwise-technique-tagged case whose data varies ≥2 fields → **fail**. | high |
| **3. Sibling completeness** | For every input field on the changed screen(s), verify a per-field class set exists (valid + invalid + boundary). A field tested only under a fixed "profile" → **fail** (the Set-24 trap). | high |
| **4. Cross-field consistency** | Walk the manifest's known real-world relationships (age↔horizon, income↔budget, etc., either inferred or from a domain lexicon). For each such pair present in the change, require a consistency case. Missing → **fail**. | high |
| **5. Journey coverage** | If change is multi-screen (classifier signal): require ≥1 end-to-end data-flow, ≥1 back-navigation, ≥1 abandon-and-resume. Missing any → **fail**. | high |
| **6. Platform packs fire** | Given `platform_pack` in manifest, require session/offline/resume + fault-injection cases if mobile/desktop/local. Missing pack → **fail**. | high |
| **7. Backend boundary** | If change touches a service (diff shows API handler, or UI calls a documented endpoint), require: contract + error-response + version-pin + idempotency. Missing any → **fail** per missing quadrant. | high |
| **8. Affordability / money** | If flow produces a price/premium/quote/total: require a budget/affordability suitability case. Missing → **fail** for regulated domains, **warn** otherwise. | high (regulated) / medium |
| **9. Method-coverage checklist** | For the change's technique bundle (strategy §3, §9 map), enumerate paradigms. For each paradigm marked applicable, verify ≥1 provenance-tagged case exists. Missing paradigm → **fail** per paradigm (matches the R1.2 table in `insurance-sample-set`). | high |
| **10. Persona spread** | Cluster the authored data variations by profile. If all variations reduce to one profile shape → **fail** (the Set-24 trap again, at the data layer). Require variations that drive *different* rule branches. | high |
| **11. Every abstain is actionable** | For every entry in the Abstain Register, verify it carries **candidate oracles per resolution** (dual-branch or per-branch). A bare question with no candidate branches → **fail**. | high |
| **12. Cross-layer consistency** | If change touches >1 layer (UI + API + DB) per classifier: require (a) shown=sent=stored=shown-back per [`layers-logging §2 L1`](test-authoring-layers-logging-metrics.md), (b) audit/decision-log-completeness (L4) if rule-bearing, (c) version-stamp (L5) if depends on a versioned rule/rate table. Missing any of the applicable clauses → **fail**. | **blocking** for regulated / rule-bearing; high otherwise |

Each check emits `{ rule_id, status, evidence[], missing_cases[] }`. `missing_cases[]` is
**shaped**: it names the expected category, technique, and oracle skeleton — enough for the
authoring pass to fill in without re-running classification.

**Beyond the 12 rules — cross-cutting scorecard checks** (also produced by the eval agent, but
they aren't rules-firing, they're numeric):

- **Hallucination scan.** Every referenced field, endpoint, error code, screen name → check
  against the change artifact / codebase / OpenAPI schema. Unmatched reference = a hallucination
  finding, tagged with the specific case.
- **Redundancy clustering.** Embedding + rule-hash cluster of cases; clusters of size >1 with
  matching (technique, oracle-shape, data-class) → redundancy finding.
- **Traceability.** Every case has `tracesTo[criteria]`; every criterion has ≥1 case.

---

## 4. Golden-set + escaped-defect integration (release gate, not per-change)

Per-change, the Eval Agent runs sections 2–3. But the **release gate** additionally runs two
suite-level backtests, drawing from buildplan §3a and §3c:

### 4a. Golden-set replay (buildplan §3a)
On a schedule (per release candidate, per rulebook change, per authoring-model change):
1. Take each of the 20–50 golden changes.
2. Run **authoring** on the change (no expert set visible).
3. Run **Eval Agent** on the authored set.
4. Compute **coverage recall** vs. the expert set (headline metric).
5. Emit a scorecard: recall, oracle-rate, traceability, hallucination, method-coverage, consistency.

Gate: release blocks if the composite scorecard regresses vs. the previous release baseline, or
falls below the chosen bar (bar is `asserted` until we have field data — buildplan §3 leaves the
threshold to be set).

### 4b. Escaped-defect backtest (buildplan §3c)
For each entry in the escaped-defect corpus:
1. Reconstruct the change that shipped the defect (diff + AC at the time).
2. Run **authoring**, then **Eval Agent**.
3. Check: does the authored set contain a case whose oracle would fail on the defect's inputs?
4. If not: attribute to a §6b rule or a missing paradigm; that becomes the next learning-loop
   signal (strategy §10).

Gate: release blocks if catch-rate on the escaped-defect corpus falls below the last release's
rate. This is the most honest quality signal ([`buildplan §3`](test-authoring-agent-buildplan.md)
calls it out explicitly).

### 4c. Consistency test (buildplan §3d)
Also at release-gate cadence: run authoring N times on the same input (varied phrasings) and run
Eval on each output. The **coverage skeleton variance** (buildplan §3d) is the reported metric,
not phrasing variance.

Per-change eval runs are cheap (single change, single audit). Release-gate runs are expensive
(fan-out over golden set + escaped-defect corpus + N-run consistency). Both use the exact same
Eval Agent — the difference is the input set.

---

## 5. Severity / gating model

Not all gaps are equal. The Eval Agent tags every finding with a severity; the gate uses
severity to decide `ready | blocked | warn`.

| Severity | Meaning | Rules / conditions that default here | Gate effect |
|---|---|---|---|
| **Blocking** | Set is unsafe/misleading to ship; will produce false confidence or contradicts the project's honesty rules. | Rule 1 (orphan-oracle); Rule 12 for regulated / rule-bearing flows; any case with **no oracle at all**; hallucination rate > 0 with any case referencing a non-existent field; escaped-defect corpus regression | **Set cannot be marked Ready.** Authoring must fix. |
| **High** | Real coverage gap that a competent QA would flag in review. | Rules 2–11 defaults, method-coverage < 100% of *applicable* paradigms, missing regulatory case, missing cross-layer L1/L4/L5 where applicable but not regulated, missing golden-set dimension | **Warn + gate is configurable per tenant.** Default: blocks release-set promotion, does not block per-change draft. |
| **Medium** | Improves the set but omission is defensible. | Missing a boundary on a low-risk field, missing a persona variation where flow doesn't branch on persona, redundancy > threshold | **Warn only.** Surfaces in the report and the next authoring round. |
| **Low** | Stylistic / consistency. | Wording variance across sibling cases, ordering, ID collisions, non-optimal data-class labels | **Info.** Fed to the learning loop but not surfaced as a blocker. |

**Composite gate decision:**
- Any **blocking** finding → `blocked`.
- Zero blocking, any **high** → `warn` per-change, `blocked` at release-gate.
- Only **medium/low** → `ready` (with warnings attached).

**Overrides.** A QA can override a `high` with a documented reason (recorded in the report,
surfaces in the learning loop). A `blocking` cannot be overridden by authoring or QA — it
requires either fixing the set or, if the rule is wrong for this context, amending the
rulebook (which forces both passes to update; §6b's no-fork discipline).

**Tie to the UI Runs/Release status model** (parallel session): a set's status is
`Draft → Ready ← blocked-by-eval → Signed-off → In-Runs`. The Eval Agent's `gate_decision`
is what flips `Draft → Ready` or holds it. `In-Runs` (execution) is downstream and outside this
agent's remit.

---

## 6. Relationship to mutation testing

The [landscape doc](test-authoring-landscape.md) is explicit that mutation testing is a
**suite-quality auditor**, not a coverage generator (§3, §6). It answers a different question
than this agent:

| | Coverage / Eval Agent (this doc) | Mutation testing |
|---|---|---|
| Question | *"Did you author the right cases for this change?"* | *"Would the cases you authored actually catch a bug?"* |
| Input | authored set + change artifact | authored set + **executable code** (must be running) |
| Method | independent enumeration vs. §6b rules + rubric | inject faults (`>=` → `>`, invert boolean, etc.), run tests, measure kill rate |
| Failure mode caught | missing case, wrong oracle, orphan oracle, unbalanced coverage | oracle is present but too weak to distinguish correct from mutated behaviour |
| When it runs | at authoring time (per-change) + release gate (golden + escaped) | *after* authoring, *after* execution wiring exists |
| Output | gap list + coverage scorecard | mutation score (% killed) + surviving-mutant list |

**They are complementary and sequential.** A set can pass the Eval Agent (all rules satisfied,
scorecard green) and still have weak oracles that mutation testing would expose — e.g. a case
that asserts "total > 0" when it should assert "total = 42". Conversely, a set could have a
high mutation score on the cases it has, yet be missing the case that would exercise the
regulatory branch — which is exactly what the Eval Agent catches.

Practical placement:
1. Authoring pass → Eval Agent → **gate 1: coverage** (this doc).
2. Cases wired to execution → Mutation testing → **gate 2: strength** (landscape §6).
3. Release → Escaped-defect backtest closes the loop (strategy §10).

Buildplan §3 lists mutation score as a **lagging** indicator; this doc's rule audit + scorecard
are the **leading** indicators. Don't conflate them.

---

## 7. Where it sits architecturally

The Eval Agent is a **separate stage in the pipeline**, invoked *after* authoring completes and
*before* the set can be marked Ready. Explicitly:

```
Intake → Classifier → Strategist → Brainstorm Panel → Data Synth → Reconciler → (Authoring Self-Check)
                                                                                      │
                                                                                      ▼
                                                                                [Set draft frozen]
                                                                                      │
                                                                                      ▼
                                                                               ┌──── Eval Agent ────┐
                                                                               │  §2 manifest       │
                                                                               │  §3 rule audit     │
                                                                               │  scorecard         │
                                                                               │  gate_decision     │
                                                                               └────────┬───────────┘
                                                                                        │
                                                     ready ◄──────────────────┬─────────┼─────────┐
                                                                              │         │         │
                                                                            warn      blocked   ready
                                                                              │         │         │
                                                                              ▼         ▼         ▼
                                                                       (surface     (back to    (Set: Ready → Sign-off → Runs)
                                                                        warnings,    authoring
                                                                        allow        with gap
                                                                        promote)     list)
```

Key properties of this placement:
- **Separate process, separate model, separate prompt** — architectural independence (§2d).
- **Reads a frozen artifact** — no shared state with authoring during eval.
- **Emits structured output only** — the report is machine-readable so the authoring pass can
  consume `gap_list` directly as its next round's input (loop-until-dry meets loop-until-eval-green).
- **Rulebook is imported, not embedded** — both passes point at the same §6b source of truth.
- **Ties into the Release/Runs UI status model** (parallel session): the report drives the
  set's status transition. A Ready set carries its most recent Eval report as an artifact so
  QA sign-off happens against a specific, versioned audit — not an implicit trust.

---

## 8. Honesty tags on this doc's own claims

Per CLAUDE.md/context.md no-fabrication rule:

- All rule numbers (1–12) and section references (§6b, §3, §4, L1–L10) — **asserted**, sourced
  directly from the companion docs at their current revision.
- Severity defaults per rule — **asserted** (design proposal), to be tuned by measured effect
  on release quality once we have field runs.
- Independence via different-model / different-temperature — **asserted**; empirical
  decorrelation of eval and authoring models is **not yet measured** and is a first-cut eval
  we should run on the golden set.
- Scorecard targets (~100% oracle-rate, ~0 hallucination) — **asserted** as goals; buildplan §3
  leaves the coverage-recall gate to be set from field data.
- Numbers like "20–50 golden changes" — **asserted**, quoting buildplan §3a.

Nothing in this doc is `measured` yet; the whole agent is a design spec, not a running system.
The first measurement to make, once the agent is built: on the golden set, does adding the
Eval-Agent pass raise coverage-recall vs. authoring-alone by a real, non-trivial margin? That
is the deliverable that justifies its existence.

---

## 9. First concrete build steps

1. **Freeze the report schema** (§1b) — everything downstream (UI, learning loop, gate logic)
   binds to it.
2. **Implement the Expected Coverage Manifest generator** (§2a) — this is the piece that
   makes independence real; without it, the agent collapses into a self-check.
3. **Wire one rule end-to-end** (Rule 1, no-orphan-oracle) against the insurance sample set
   (R0 → R1 fixed A12/B13/D3 — this is the ground-truth test case for the audit logic).
4. **Add rules 12, 9, 11** next — highest-leverage: cross-layer, method-coverage, actionable
   abstains. These three together prevent most of what the insurance R0 set got wrong.
5. **Stand up the release-gate loop** (§4) against the 10 initial golden changes from
   buildplan §7 before extending to the full 20–50.
6. **Measure** — is `coverage_recall(with_eval) − coverage_recall(without_eval)` positive and
   statistically real on the golden set? If not, the agent isn't earning its keep and we
   revisit §2's independence mechanisms before adding more rules.
