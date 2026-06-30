# Plan — Implementation reference doc for the learning brain + loop (P1 slice)

> ⚠️ **SUPERSEDED BODY.** The sections immediately below describe the original atlas-recognition P1 and are kept for history. The authoritative plan is **`# MASTER PLAN v2 — Diagnosis-First, Data-Grounded`** at the END of this file, derived from the Inferences Ledger (I/R/J). Read v2 first.

## Context

The strategy plan (`ok-make-a-new-vectorized-reddy.md`) sets the P1 direction: a small **learning brain** (`atlas.json`, 7 seed patterns) consumed by a **learning loop** (perceive → decide → act → learn). Before writing code you want an executable reference pinning down what the agent can perceive, where it's blind, how it learns, plus pseudocode + tests + scenarios keyed to the *real* `selfheal-core.js` APIs.

This round produces **one new companion doc** — `IMPLEMENTATION-REFERENCE.md`. **No code, no live app runs yet.**

**This version is post-redteam.** An adversarial review found three blockers and several majors in the first draft; they are corrected below, and the corrections *narrow what P1 honestly claims*. The headline change: **P1 proves PERCEPTION (recognition), not healing or learning.** The "retry under recipe" and "warm/passing-stats" paths are vapor or inert without a runtime, so they are **deferred to P2 by name**, not faked in P1.

Grounding facts (verified against source):
- `matchStep(doc, step, opts) → {verdict, diagnosis, best, margin, gated?}`; `scoreEx(ex, desc)`; `verdict(ranked) → {v, best, margin}`; `TH = {heal:0.62, margin:0.12, abstain:0.45}`. `rank(doc, desc, adapter)` ranks **all** `adapter.candidates(doc)` by `scoreEx` — **there is no "score against a CSS selector" API.**
- `WEB.extract(el, doc)` → 11-signal "ex": `role, tag, name, nameAttr, type, autocomplete, testid, id, cls, inForm, formAction`.
- **`buildFromEx` (core lines 44-50) PRUNES** every null/empty signal and every signal lacking a `DEF` weight. Verified. A no-name icon button has `name`, `inForm`, `formAction` **dropped** from its descriptor.
- `descFromStep` (core) already exists and yields a **descriptor** (`{signals:{k:{value,stability}}}`), not an ex. Inspector-local `buildDescriptor` is NOT a core export (core exports `buildFromEx`).
- `live-inspector.js`: console-pasted IIFE, `__SELFHEAL_INSPECT.scan()`; no localStorage, no UI buttons; matchStep not yet called; live scan has the **full 11-signal ex** in hand (`extract(el, document)`).
- Test base = **17** tests (verified: 17 `test(` calls), loaded via `window.SELFHEAL`.

---

## Redteam corrections folded in (what changed and why)

| # | Finding | Correction in this plan |
|---|---|---|
| B1 | `exFromStepDescriptor` runs on a *lossy* descriptor; `icon_only`/`name_max_len` are pruned away | **Classification happens at PERCEIVE on the live full-signal `ex`** (inspector has all 11). The recorded-descriptor path is acknowledged lossy and is *not* the primary classify site. Match criteria use only signals that survive (`role`, `testid`, `name` when present). `icon_only` is derived **at scan time** from the live element, never from a recorded descriptor. |
| B2 | `rankUnderRecipe` is vapor — no API scores against a selector hint | **Deleted from P1.** The retry-under-recipe path requires either a real runtime or a descriptor-from-recipe builder; both are **P2**. P1's `matchStepWithAtlas` only *annotates* a non-heal result with `pattern_id` (recognition), it does **not** produce a heal. |
| B3 | Warm/passing-stats path is inert — nothing reaches `min_observations` without runtime | **Stated plainly.** P1 records **observations** (classification counts), not verified successes. `stats.successes` is **not** bumped from static markup. The passing-stats→heal branch is **P2**, tested there against runtime, not fixtures here. |
| M1 | "learning" = a counter; nothing compounds in P1 | Section 3 explicitly separates **mechanism wiring** (P1) from **learning** (P2). P1's honest claim: "we can perceive and name patterns, and log how often we see them." |
| M3 | "recognition ≥30%" circular/unfalsifiable | Recognition redefined as **correct classification vs. a pre-registered hand-labeled ground truth**, reported as **precision + recall**, threshold pre-registered *before* the run in a `RECOGNITION-FALSIFICATION.md` stub. |
| M4 | `flagCandidate` "ambiguous" undefined for a lone ex | Trigger redefined: flag when `bestLocator(ex).tier === 'none'` (anchorless) **AND** `classifyElement(ex) === null`. Computable from one ex. |
| Parent #1 | child dropped the A0 paper-sim kill-gate | **A0 restored as Section 0** and as the gate that precedes any live-app probing. |
| Parent #3 / OV#4 | pre-recording inferred outcomes contaminates the gate | P1 does not write inferred outcomes into `successes`. Observation log carries `verify_confidence` field (always low/"inferred" in P1) so P2 can filter. |

---

## 80/20 cut — what gets built this round

The deliverable is `IMPLEMENTATION-REFERENCE.md`. The 20% of sections that carry 80% of the value (the corrected core + the kill-gate + the on-ramp to apps):

**IN (the 80/20 core):**
- **§0 A0 paper-sim stub** — the kill-gate; nothing proceeds without it.
- **§1 Perception table** (11 signals, which survive `buildFromEx`) — cheap, high-clarity.
- **§4 Brain mockup** with the **real sparse descriptor** beside each pattern — the corrected heart of the redteam fix.
- **§6 Pseudocode** — recognition-only functions (`classifyElement`, `matchesCriteria`, `matchStepWithAtlas`-annotate, `recordObservation`, `flagCandidate`) against real APIs.
- **§7 Test examples** — literal `test/ok/eq`, base 17 → ≥21, ≥1 gate-on, no atlas-heal test.
- **§9 App briefs + ground-truth protocol** — the on-ramp answering "can we analyse apps."

**FOLDED/TRIMMED (the long tail, compressed to a paragraph each, not dropped):**
- §2 Gaps + §3 wiring-vs-learning → merged into one short "blind spots & honest limits" note.
- §5 loop diagram → one mermaid block, no prose.
- §8 scenarios → keep only #2 (anchorless icon, where brain adds signal) and #3 (duplicate-row, where it honestly can't); drop the rest.
- §10 falsification → folded into §9 as the pre-registration paragraph.

This keeps the doc scannable and ships the redteam-corrected substance first.

## Alignment with parent plan (`ok-make-a-new-vectorized-reddy.md`)

The redteam corrections are expressed as **behavioral rules on the parent's exact APIs**, not renames — so P1.2–P1.6 and P2 in the parent stay verbatim-executable.

| Parent item | Kept verbatim | Behavioral rule added (redteam) |
|---|---|---|
| P1.2 `stats:{successes, failures, seen_on}`, `min_observations:5` | **schema unchanged** | add optional `observations` counter alongside; P1 writes only `observations`/`seen_on`, never `successes`/`failures` (no runtime truth) |
| P1.3 `classifyElement(ex, atlas)` | name + signature | runs on the **live full-signal ex** (perceive-time), never a lossy recorded descriptor (B1) |
| P1.3 `matchStepWithAtlas(doc, step, atlas)` | name; `opts` added as optional 4th arg (superset, non-breaking) | **both parent branches kept**; the warm "retry with recipe" branch is **dormant in P1** — unreachable because nothing reaches `min_observations` without runtime, and recipe-execution itself is the P2 mechanism (B2/B3). Cold path = parent's "abstain *with* pattern_id recorded." |
| P1.3 `recordOutcome(atlas, patternId, success)` | name + signature | P1 callers pass a `verify_confidence`; `successes`/`failures` bump only above threshold — in P1 that's never (inferred markup), so it accumulates `observations` only (OV#4 contamination guard) |
| P1.3 `flagCandidate(atlas, ex)` | name + signature | trigger defined: `bestLocator(ex).tier==='none' && classifyElement(ex)==null` (M4) |
| P1.5 recognition ≥ 30% | **threshold unchanged** | measured as precision **and** recall vs a pre-registered hand-labeled ground truth, not "a criteria fired" (M3) |
| P1.6 4 tests: `classifyElement`, `matchStepWithAtlas-low-stats-abstains`, `matchStepWithAtlas-passing-stats-retries`, `recordOutcome-persists` | **all 4 names kept** | `-passing-stats-retries` asserts the warm **branch is entered** (pattern_id set / retry attempted), not that a heal lands (heal execution is P2) |
| P1.6 "keep 18/18 green" | target kept | **factual correction:** the suite currently has **17** `test(` calls (verified); trust the live run, not the round number |
| Artifacts | `atlas.json`, `A0-paper-simulation.md`, `AMPLITUDE-RUN.md` kept verbatim | my §10 falsification stub folds **into** `AMPLITUDE-RUN.md`'s pre-registration header, not a separate file |

No parent P2 item is contradicted: `selfheal-runtime.js`, runner-up retry, corpus, FALSIFICATION.md, per-tenant store, bookmarklet all remain P2 exactly as written — the dormant warm branch is the seam they plug into.

## Companion doc structure — `IMPLEMENTATION-REFERENCE.md`

### Section 0 — A0 paper simulation (the kill-gate, comes FIRST)
Restates parent P1.1. Pencil + spreadsheet over Gap-2's 11 labels: project outcome under (a) runner-up retry, (b) atlas-aware *recognition* (not heal), (c) one calibration tweak. **Artifact stub:** `A0-paper-simulation.md`. **Rule:** no live-app probing until A0 is filled and shows *some* lever is plausible. If no lever clears the parent's 20% useful_replay bar on paper, the brain direction is parked.

### Section 1 — Perception: what the agent sees today
Table of the 11 signals, source in `WEB.extract`, `DEF` stability weight, and — critically — **which survive `buildFromEx` pruning**. Honest statement: the sensorium is **accessibility + identity markup only**. No pixels, no web geometry, no author intent, no runtime.

### Section 2 — Gaps: what it is blind to
Each tied to a parent lever: no author intent → Clue-3 (OV#2); no visual → P3+; **no real runtime outcome in P1** → P2 `selfheal-runtime.js`; cross-origin memory loss → Download stopgap / per-tenant P2; cold-start → `min_observations`; noisy verify → `verify_confidence` (OV#4); **signal-loss on recorded descriptors** (B1) → classify at perceive, not replay.

### Section 3 — Learning vs. wiring (honest split)
- **What P1 wires (mechanism):** perceive→classify→log→flag→persist. The counter that moves is `stats.observations`. The only behavioral effect of the counter in P1 is gate open/closed for a path that **doesn't run until P2**.
- **What P1 does NOT do:** improve any selector, change `DEF`/`DURA` weights (explicitly UNCALIBRATED), or heal anything. "Compounding moat" is a P2+ claim.
- Real call sites: Perceive=`WEB.extract`; Decide=`matchStep` then `matchStepWithAtlas` annotation; Act=**none in P1**; Learn=`flagCandidate` + `recordObservation` (not `recordOutcome`-success).

### Section 4 — Brain mockup (`atlas.json`) — with the REAL sparse descriptor shown
Pattern literal, criteria restricted to survivable signals:
```json
{ "version": 1, "patterns": [{
    "id": "modal-close-x",
    "match": { "role": ["button"], "name_any": ["close","dismiss","×","✕","x"],
               "name_absent_ok": true },
    "classify_at": "perceive",
    "recipe_P2": { "strategy": "role+name-or-aria", "selector_hint": "[aria-label*=close i]" },
    "gotchas": ["may match cookie-banner X","portaled outside modal root"],
    "stats": { "successes": 0, "failures": 0, "seen_on": [], "observations": 0 },
    "min_observations": 5 }],
  "candidate_patterns": [] }
```
Beside it, the **actual descriptor that survives `buildFromEx`** for that element (showing `name`/`inForm`/`formAction` pruned to nothing) — proving why classification must run on the live `ex`, not the recorded descriptor. All 7 seeds specified this way. Note `recipe_P2` is parked, not used in P1.

### Section 5 — Loop diagram (textual + mermaid)
perceive→decide→learn cycle (no "act" node in P1; shown greyed as P2). Each node annotated with the real function and the atlas as consulted/updated store.

### Section 6 — Pseudocode per P1 function (against real APIs)
```
# Parent's both-branch shape; warm branch DORMANT in P1.
function matchStepWithAtlas(doc, step, atlas, opts):
    base = matchStep(doc, step, opts)              # real API, unchanged
    if base.verdict == 'heal' or base.best == null: return base
    ex  = base.best.ex                             # live ex (full 11 signals), NOT the recorded descriptor (B1)
    cls = classifyElement(ex, atlas)
    if cls == null: return base
    pat = atlas.patterns.find(p => p.id == cls.patternId)
    if pat.stats.successes >= pat.min_observations:           # WARM branch — unreachable in P1 (B3)
        # P2: rankUnderRecipe(doc, pat.recipe_P2, step) executes the heal here.
        return { ...base, pattern_id: cls.patternId, retry_attempted: true }   # P1: mark entry only
    return { ...base, pattern_id: cls.patternId, pattern_conf: cls.confidence } # COLD: abstain w/ pattern_id

function classifyElement(ex, atlas):               # operates on a LIVE ex
    for pat in atlas.patterns:
        if matchesCriteria(ex, pat.match): return { patternId: pat.id, confidence: criteriaStrength(ex, pat.match) }
    return null

function matchesCriteria(ex, m):                   # only survivable signals
    if m.role and ex.role not in m.role: return false
    if m.name_any:
        if ex.name == null: return m.name_absent_ok === true     # absent handled explicitly (B1)
        return any(fuzzy(ex.name, w) > 0 for w in m.name_any)     # reuse core fuzzy
    return true

function recordOutcome(atlas, patternId, success, verify_confidence): # parent API; pure → atlas'
    clone; bump stats.observations; push origin to seen_on (deduped, PII-stripped)
    if verify_confidence >= TH_VERIFY: bump success ? stats.successes : stats.failures
    # P1 always passes inferred/low verify_confidence → successes/failures stay 0 (B3, OV#4)
    return clone

function flagCandidate(atlas, ex):                 # pure → atlas'
    if bestLocator(ex).tier === 'none' AND classifyElement(ex, atlas) == null:
        push compactSignature(ex) to candidate_patterns (deduped); return clone
    return atlas
```
Plus loop-closure pseudocode for `live-inspector.js`: on each scanned element → `classifyElement(ex)` (live ex) → log → `recordOutcome(.., verify_confidence:'inferred')` / `flagCandidate` → serialize atlas to `localStorage` + "Download atlas.json" button.

### Section 7 — Test examples (literal `test/ok/eq`; parent's 4 names; base verified 17, target ≥ 21)
```
test('classifyElement: aria-label Close button → modal-close-x', () => {
  const doc = parse(`<button aria-label="Close">✕</button>`);
  const ex  = S.WEB.extract(doc.querySelector('button'), doc);   // full live ex (B1)
  eq(S.classifyElement(ex, ATLAS_FIXTURE).patternId, 'modal-close-x');
});
test('matchStepWithAtlas-low-stats-abstains: cold → abstain WITH pattern_id', () => {
  const r = S.matchStepWithAtlas(doc, step, COLD_ATLAS, {gate:true});   // gate ON (m2)
  ok(r.verdict !== 'heal'); eq(r.pattern_id, 'modal-close-x');
});
test('matchStepWithAtlas-passing-stats-retries: warm → retry branch ENTERED (not heal in P1)', () => {
  const r = S.matchStepWithAtlas(doc, step, WARM_ATLAS, {gate:true});
  ok(r.retry_attempted === true);            // asserts branch entry; heal execution is P2 (B2/B3)
  eq(r.pattern_id, 'modal-close-x');
});
test('recordOutcome-persists: observation counted, pure, successes untouched in P1', () => {
  const a2 = S.recordOutcome(ATLAS_FIXTURE, 'modal-close-x', true, /*verify_conf*/'inferred');
  eq(a2.patterns[0].stats.observations, ATLAS_FIXTURE.patterns[0].stats.observations + 1);
  eq(a2.patterns[0].stats.successes,    ATLAS_FIXTURE.patterns[0].stats.successes);   // unchanged (B3)
  ok(a2 !== ATLAS_FIXTURE);
});
```
At least one test runs **gate:true** (m2). The `WARM_ATLAS` fixture exists only to prove branch-entry logic — explicitly **not** a heal claim.

### Section 8 — Scenarios (perceive→decide→learn, atlas delta shown)
1. **Modal close recognized** — strong descriptor; matchStep likely *already heals*; brain annotates only. Honest note: brain adds nothing when the matcher already wins.
2. **Anchorless icon button, no name** — matchStep abstains; brain classifies as `icon-only-no-name`; annotates + observation logged. *This is where the brain has signal the matcher lacked.*
3. **Duplicate row action** — matcher abstains 'ambiguous'; a CSS hint would return N matches too, so brain **cannot** disambiguate → honest abstain, observation only (M2 made explicit).
4. **Unknown anchorless element** → `flagCandidate` parks it.
5. **Cross-origin** — amplitude→testsigma atlas continuity is **manual** (download/upload) in P1 (m3).

### Section 9 — Target-app perception briefs (analysis-ready, gated behind A0)
For **Amplitude, Testsigma, GitHub, Amazon/Wikipedia**: expected-perceivable, known gotchas (Amplitude calendar/portal/dual-nav; Testsigma own test-ids; GitHub Gap-2 continuity; Amazon/Wikipedia i18n), and the **ground-truth labelling protocol** (M3): hand-label each sampled interactive's true pattern *before* running classify, then report precision + recall. Probe recipe = `__SELFHEAL_INSPECT.scan()` via Chrome MCP. **Explicitly gated:** runs only after Section 0 (A0) is filled.

### Section 10 — `RECOGNITION-FALSIFICATION.md` stub
Pre-registers, before any run: recognition = correct-classify vs ground truth; precision floor + recall floor; the denominator definition ("visible interactives" = `candidates(doc).filter(isShown)`); and the rule that broadening criteria to inflate recall is disclosed. The parent defers FALSIFICATION to P2; this stub pulls *only the recognition metric's* pre-registration into P1 because the P1 deliverable threshold depends on it.

---

## Answer to "can we begin analysing a few apps?"

**Yes — with the existing inspector, but ordered correctly.** Recognition needs no brain code; `live-inspector.js` already extracts full descriptors. But per the parent's epistemic gate and redteam finding #1, the order is:
1. (this round) write `IMPLEMENTATION-REFERENCE.md` incl. §0 A0 stub + §10 falsification stub.
2. fill **A0 paper simulation** — the kill-gate.
3. only then point the inspector via Chrome MCP at the four apps, using the §9 ground-truth protocol → precision + recall.
4. only then implement brain functions, informed by real patterns.

Live-app probing does **not** front-run A0.

---

## Critical files

- **New** `/Users/prashant.kothari/Documents/claude/IMPLEMENTATION-REFERENCE.md` — sections 0–10 above (the only artifact this round).
- **Read-only references** (quoted, not modified): `selfheal-core.js` (APIs incl. verified `buildFromEx` pruning), `live-inspector.js` (loop hook + full-ex scan site), `selfheal-tests.js`/`.html` (idiom, base=17), `ok-make-a-new-vectorized-reddy.md` (parent).
- No source, no `atlas.json`, no live runs this round.

## Verification

1. `IMPLEMENTATION-REFERENCE.md` exists with sections 0–10.
2. **A0 (§0) precedes §9 app briefs**, and §9 is explicitly gated behind A0 (parent contradiction #1 resolved).
3. No pseudocode references a "score-against-selector" API; `rankUnderRecipe`/warm-heal path appear only as **P2, named and parked** (B2/B3 resolved).
4. §4 shows the **real sparse descriptor** post-`buildFromEx`, and classification is shown on the live `ex`, not the recorded descriptor (B1 resolved).
5. `recordObservation` (not success-bumping) and `flagCandidate` trigger = `bestLocator.tier==='none' && classify==null` (M1/M4 resolved).
6. Recognition defined as precision+recall vs pre-registered ground truth; §10 stub present (M3 resolved).
7. Test examples use literal `test/ok/eq`, base count stated as **17**, ≥1 test runs `gate:true`, no atlas-heal test in P1 (m2/m4 resolved).

---

# Inferences Ledger

> Durable, distilled conclusions only — no reasoning, no chat. Single reference for the diagnosis-first direction.
> Sources: `Plan Feedback.pdf` (flowchart + change-table), `Locator Diagnosis and Self-heal Notes.pdf` (30-case taxonomy), `Locator Diagnosis and Self-heal Notes (1).pdf` (Diagnostic-First strategy). Tag = source.

## A. Direction (architecture)

- **I1** [strategy] The P1 brain is a **failure-mode diagnoser**, not a pattern-recognizer. Classify *why* a step failed, then route; heal only the healable subset. Pattern atlas is demoted to a feeder + disambiguation aid.
- **I2** [strategy] **Intelligent failure > risky healing.** A correct fail/abstain with a named reason is a deliverable, not a non-result. False-heal (wrong element, test passes) is the catastrophic outcome.
- **I3** [taxonomy+strategy] **Only DRIFT (and, with runtime, TEMPORAL) are healable** — ~40% of failures. The other ~60% (REMOVAL, AMBIGUITY, FLOW_CHANGE, STATE_ISSUE, UNKNOWN) require intelligent failure, never a heal.
- **I4** [synthesis] Diagnosis is **mostly free**: derivable from outputs `matchStep` already produces (ranked candidates, conf, margin, candidate count, `actionable()`). It is a routing layer over existing signals, not new perception.
- **I5** [synthesis] The REMOVAL ↔ drifted-beyond-recognition boundary is **undecidable by signal** but **degrades safely** — both collapse to "no confident candidate → do not heal." The fuzzy boundary self-resolves to correct behavior.

## B. Failure-mode taxonomy (the 7 categories)

- **I6** [taxonomy] Categories + correct behavior: `DRIFT`→re-locate by signal · `REMOVAL`→fail-fast · `AMBIGUITY`→abstain · `FLOW_CHANGE`→fail-fast · `STATE_ISSUE`→report not-interactable · `TEMPORAL`→wait+retry then heal/fail · `UNKNOWN`→fail-fast.
- **I7** [taxonomy] Computability today: AMBIGUITY = ≥2 candidates, margin<0.12 · REMOVAL/no-identity = best conf below abstain floor · DRIFT = one candidate clears threshold+margin · STATE_ISSUE = identity matches but `actionable()` fails · TEMPORAL & FLOW_CHANGE = **need runtime/intent → P2**.
- **I8** [taxonomy] The 30 cases sort: signal-healable (Q1,Q3,Q4,Q6,Q7,Q8,Q13,Q23,Q24) — already handled by our container-agnostic matcher · must-not-heal (Q2,Q10,Q11,Q14,Q15,Q16,Q17,Q18,Q30) · state/temporal (Q5,Q12,Q28,Q29) · ambiguity-needs-container (Q19,Q20, AirPods).

## C. Validations of existing work

- **I9** [taxonomy Q23] The 11-signal framework is endorsed as framework-agnostic (survives React→Vue).
- **I10** [taxonomy Q24] Never depend on CSS classes — most volatile signal. Confirms our hashed-`cls` penalty (0.08).
- **I11** [feedback-table] `verify_confidence` filtering on observations is required — **already built** in the post-redteam plan (`recordOutcome` only bumps successes/failures above threshold). Convergence.

## D. Adopted refinements (from feedback table)

- **I12** [feedback-table] Recognition/diagnosis is measured on the **non-trivial subset** (elements `matchStep` cannot already heal), never inflated by trivially-anchored elements.
- **I13** [feedback-table] **Pattern collisions** must be resolved: `classifyElement` must not return first-match-by-array-order; collect all matches, pick highest criteria strength, log ties.
- **I14** [feedback-table] Pattern source = **induced from real diagnosed failures**, not hand-enumerated. The 7 seeds are starter format examples only; `flagCandidate` is the induction queue.

## E. Open parameters (asserted, NOT yet grounded — treat as hypotheses)

- **I15** [strategy] Cost asymmetry "false-heal ≈ 16× false-negative" and "heal threshold ≈ 94% confidence" are **asserted, not derived**. Cannot be honestly applied to UNCALIBRATED scores (DEF weights are heuristic). Adopt the *asymmetric-cost framing* as routing rules now; defer any numeric threshold to P2 calibration.
- **I16** [strategy] Promote/demote policy "3-5 successes ↑, 1-2 false-positives ↓" needs runtime-verified outcomes to be meaningful (P1 has none). It is a P2 learning-policy hypothesis.
- **I17** [strategy] The 7-category **% distribution** (DRIFT 30-40%, etc.) is asserted from unstated data; treat as a hypothesis to be measured against Gap-2 + live app runs, not a fact.

## F. Deferred-to-P2 (named)

- **I18** TEMPORAL wait-retry, FLOW_CHANGE detection, selector-uniqueness validation, inter-rater reliability on ground truth, cost-threshold calibration, promote/demote learning policy, Clue-2 container disambiguation.

## G. Redteam findings (no-BS pass on diagnosis-first)

- **R1** [blocker] Diagnosis risks being **theater over the same matcher** — boundaries use the same uncalibrated conf/margin. Must demonstrate ≥1 case where `diagnoseFailure` changes the *decision* vs `matchStep`, not just the label, before building detectors.
- **R2** [blocker] "Correctly fail 60%" metric **rewards doing nothing** — Gap-2's 0/11 heal becomes "100% correct diagnosis" while healing zero. Success metric must reward `useful_replay`, not correct refusal.
- **R10** [blocker] Diagnosis-first can pass safety and **fail the A0 useful_replay gate** — DRIFT is the subset the matcher already heals; diagnosis adds 0 heal rate. **Run A0 before committing.** Diagnosis routes to the heal levers (runner-up retry, Clue-2/3); it is not one.
- **R3** [major] FLOW_CHANGE is **not separable from REMOVAL without intent** (AI-complete). Collapse REMOVAL+FLOW_CHANGE+UNKNOWN into one "cannot-heal, best-guess reason" bucket in P1/P2.
- **R8** [major] **Scope creep**: every failure is {heal, don't-heal}; the 7 categories are reporting metadata. Build a 2-way gate + reason-string, NOT 7 detectors. This is where refine tips into bloat.
- **R5** [major] "16× cost → 94% threshold" is **numerology on uncalibrated scores** (our threshold is a 0.62 score, not a probability). Calibrate or drop the number.
- **R9** [major] Artifacts now **contradict**: parent + `IMPLEMENTATION-REFERENCE.md` are atlas/recognition-centric; this ledger is diagnosis-first. Restructure the reference doc or the "single reference" is inconsistent.
- **R4** [minor] TEMPORAL imports **nondeterminism + brittle "loading indicator" heuristic**; keep it P2-only, don't pad the P1 taxonomy.
- **R6** [minor] Promote/demote (3-5↑/1-2↓) is **inert in P1**, and a contamination trap if wired to inferred outcomes (OV#4). Numbers arbitrary without a base rate.
- **R7** [minor] AirPods flagship example **heals nothing** (ABSTAIN) — the value prop is *intelligent failure*, so "self-healing" oversells. Name it honestly.
- **R-survives** What holds up: the 2-way diagnostic gate + named-reason string (R8), the explainability/autonomy posture, the induction queue (I14), deterministic framing over ML-matching.

## H. From operational pipeline (doc 2) + 10 ideas (doc 3)

- **I19** [doc2] Operational pipeline: Predict(0)→Diagnose(1)→Generate(2)→Validate(3)→Act/Report(4)→Verify(5)→Learn(6). Maps onto existing core (diagnose→`diagnose()`, generate→`rank()`, validate→`actionable()`+uniqueness, verify→`verifyEffect()`) — orchestration + 2 new generators, NOT a rewrite.
- **I20** [doc2] Step 0 Predict (pre-step context validation) sidesteps REMOVAL-vs-DRIFT undecidability (R3) by asserting recorded CONTEXT EXPECTATIONS (in-form, on-route, preceding-step-created-target) before acting; abort if gone. Needs new record-time metadata; only catches cleanly-checkable preconditions.
- **I21** [doc2/doc3-6] Temporal Locality: bound candidate search to DOM subtree near last-interacted element (spatial/interaction-history prior). NEW signal beyond the 11; first lever that raises heal RATE not just safety. Runtime-dependent.
- **I22** [doc2/doc3-5] Healing by Elimination: disambiguate via negative constraints (not-in-row-X, not-disabled, not-link, name≠cancel). The answer for anchorless icons (weak positive, clear negative signals) and duplicate rows.
- **I23** [doc2] Cost gate `conf*FN_COST > (1-conf)*FP_COST` is sound decision theory but needs conf to be a CALIBRATED probability; `scoreEx` is not. Formula = P2-post-calibration target; in P1 degrades to "raise threshold conservatively" (no 94% claim). (R5 persists.)
- **I24** [doc2] Step 5 Verify three-way outcome = strongest safety rule: verify-fails→FAILED · verify-impossible→PASSED+WARNING · unverified→human review, never auto-promote. Implements `verifyEffect`+`verify_confidence`+OV#4. Runtime (P2).
- **I25** [doc3-3] Assertion semantics as routing signal: locator-not-found→heal · assertion-fail-after-successful-click→do NOT heal (app bug) · timeout→ambiguous. NEW discriminating signal (NOT from conf/margin → defeats R1 for this path); needs runner to expose error type.
- **I26** [doc3-8] An LLM healer is ALREADY IN PROD. Reframe: the deterministic diagnosis layer is the cheap, explainable FIRST-PASS GATE that routes only genuinely-ambiguous cases to the expensive LLM — not a from-scratch healer.
- **I27** [doc3-10] Atlas's real role = cross-tenant OUTCOME AGGREGATION (federated, anonymized signal-profiles+outcomes, never DOM/URL/user-data) — not per-user pattern-recognition. The compounding moat (P3+); rehabilitates the atlas's purpose.
- **I28** [synthesis] THREE separable layers, different timelines/evidence bars: **L1** deterministic safety/diagnosis [P1/P2] · **L2** new heal-capability (temporal-locality + elimination + interaction-context + verify) [P2 runtime] · **L3** cross-tenant moat [P3+]. Separate = refining; conflate = bloat.
- **I29** [synthesis] Step 0 context assertions + Idea 3 assertion semantics are buildable only inside Testsigma's RUNNER (record-time + framework error types), NOT the standalone console inspector. The P1 lab cannot demonstrate them.

## I. Redteam status updates (after docs 2 & 3)

- **R1 → softened**: defeated for context/assertion/temporal-locality signals (genuinely new, not conf/margin-derived; I20/I21/I25); stands only for category boundaries drawn purely on conf/margin.
- **R3 → softened**: partially separable via Step 0 context assertions + assertion semantics (I20, I25), at the cost of new record-time metadata.
- **R2/R10 → heal-rate levers now concrete** (I21, I22, I25); A0 must project these, not just runner-up retry.
- **R5 → unchanged**: cost-gate calibration gap persists across all four docs (I23). "94%/16×" still asserted, not derived.

## J. Real production failure data (POC report — 1000 failures, 9 patterns)

- **J1** [POC] Real distribution: A stale/broken-locators = **665 (66.5%)** dominates everything. AI-Agent scope = A+B+C+G = 744 (74.4%); Engineering = D,E,F,H,I = 256 (25.6%). **Our addressable core is Pattern A; B/C/G secondary.**
- **J2** [POC] Real healable share (~66% locator drift) is **far higher than the docs' theoretical ~40% DRIFT** — diagnosis-first docs UNDERSOLD healing. Strongly implies A0's >20% useful_replay gate is clearable on Pattern A alone. (Caveat J8.)
- **J3** [POC] **LLM-dependency reality check:** of the "AI capabilities," only the TRUE-semantic/visual residue of the ~380 needs an LLM/vision. Whitespace-tolerant (~30), malformed-XPath rewriter (~47), drift detection/proactive scan (~57), overlay/keyboard detection (~42), auto-dismiss OS dialogs (~30), screen-state/animation validator (~12) are ALL deterministic (~218 total). Capability tables overstate LLM need.
- **J4** [POC] Deterministic **fuzzy name matching already covers the token-overlap subset** of "exact-text XPath fails after copy change" ("Add to Cart"→"Add to Bag"). Only zero-token-overlap rephrase/translation/icon-only needs semantic/vision → route only that residue to the prod LLM (I26).
- **J5** [POC] Pattern I (opaque errors / exception-swallowing, 11.1%) **blinds the diagnosis layer**; assertion-semantics routing (I25) DEPENDS on the engine surfacing real error types. Fixing Pattern I is a prerequisite, not a parallel track.
- **J6** [POC] Volume is **tenant-concentrated** (Tenant 49342 ≈ 380+47). A few tenants' locator hygiene dominates the 1000 → an upstream locator/test-id advisor (parent P2) may beat runtime healing in ROI for them.
- **J7** [POC] **Scope-out:** D (engine bugs), E (session lifecycle), F (network), H (add-on bugs) are NOT healing problems — engineering fixes. Correct auto-healer behavior = detect + attribute + report (intelligent failure), never heal.
- **J8** [POC] "Routed to AI Agent" = remediation INTENT, not measured heal SUCCESS. A0 must still measure actual heal success on a Pattern-A sample before claiming the rate.
- **J9** [synthesis] Deterministic capability → code mapping: whitespace→normalize in name/text extraction · malformed-XPath→static validity check (new) · drift/proactive→Step 0 re-extract+compare (I20) · overlay/dialog→actionability-gate extension + known-OS-dialog pattern table · animation→TEMPORAL wait-for-stable (I21) · semantic residue→prod LLM gate (I26).

---

# MASTER PLAN v2 — Diagnosis-First, Data-Grounded

> Authoritative. Supersedes the original body above. Every claim traces to a ledger tag (I/R/J). Derived from 4 strategy docs + 1 production POC (1000 real failures).

## 0. Governing principles (non-negotiable)

- **Data-driven only — no fabrication.** No % without a labelled set behind it. Mark every number `measured` / `simulated` / `proxy` / `asserted`. Always report **false-heal**. **A true 66% beats a fabricated 90%** — partial honest coverage is acceptable, invented coverage is not. Lab fixtures standing in for tenant data are labelled **proxy**, never reported as the real 665.
- **Deterministic-first; LLM is the last resort** for the semantic residue only (I26, J3/J4). Most "AI capabilities" in the POC are deterministic (J3).
- **Intelligent failure > risky heal** (I2). Correct fail/abstain with a named reason is a deliverable.
- **Scope:** own Pattern A (+ B, C, G) = 74.4% (J1). **Scope-OUT D/E/F/H/I** — engineering/infra fixes, never heal (J7). Pattern I (opaque errors) is a **prerequisite dependency**, not our build (J5).

## 1. Reconciled architecture — 3 layers (I28)

| Layer | What | Owns (POC patterns) | Timeline | Can we validate in the lab? |
|---|---|---|---|---|
| **L1 — Safety / diagnosis** | predict → diagnose → route → report; the cheap explainable gate in front of the prod LLM (I26) | A (diagnose), B/C/G (detect) | **P1** | Yes — on Gap-2 + proxy fixtures |
| **L2 — Heal capability** | temporal-locality + elimination + verify-by-effect (I21/I22/I24) | A (heal), B (gesture) | **P2** (needs runtime/runner) | Partial — needs `selfheal-runtime.js` |
| **L3 — Cross-tenant moat** | federated outcome aggregation (I27) | all (stats) | **P3+** | No — needs multi-tenant data |

## 2. 80/20 — what 20% of build captures 80% of the value

Grounded in J1 (A = 66.5%). **GRILLED (see §9): "66.5% is healable" is NOT supported** — A is a locator-*class* (drift + removal + brittleness conflated); routed-to-AI is intent, not proven healability (J8). The healable fraction is **unmeasured and unmeasurable without D1 (real DOMs)**. So the 20%/80% claim is a **hypothesis pending PR-0 + D1**, not a fact. The candidate 20%: diagnosis-reporting + deterministic Pattern-A healers (whitespace, malformed) — but their *reach into the real 380* is unknown (GA4).

## 3. Session-wise PR backlog (1 PR ≈ 1 session)

**Each PR's Definition of Done folds in tasks #4a/4b/5/6 — see §4.**

### P1 — lab-buildable, deterministic, no runtime/LLM

- **PR-0 · Measure-first (the kill-gate; = A0 reframed).** Assemble a Pattern-A **proxy** corpus (Gap-2 + app-scanned copy-change / whitespace / malformed-XPath fixtures). Measure: current `matchStep` heal/abstain/false-heal, AND the deterministic-vs-semantic residue split within copy-change (J4). *No new code — measurement only.* **Gate:** if <20% of Pattern A is deterministically healable on proxies, rethink before building. Grounds J2/J4/J8. **Metric:** heal/abstain/false-heal table + residue %. **Tests:** corpus loader sanity.
- **PR-1 · Diagnosis REPORTING layer (not a gate in P1).** `diagnoseFailure(doc, step)` → `{category, reason}`. **GRILLED (§9 GA1/GA2):** `matchStep` already returns a diagnosis (`not-ready`/`no-identity`/`ambiguous`) and does **not** expose `ranked`/count. So in P1 this is a **relabeling/reporting** layer (maps internal diagnosis → 7-category business vocabulary + human reason), with **decision-divergence ≈ 0** — it changes no decisions until record-time/runtime signals exist (R1 confirmed). Honest P1 value = better failure *reports* (the intelligent-failure deliverable, I2), not better decisions. Requires exposing `rank()` output (small core change) only if category needs candidate count beyond `margin`. 2-way decision stays with `matchStep`; categories are metadata (R8). **Metric:** report-category accuracy vs hand-labelled Gap-2; **measured decision-divergence vs `matchStep` (expected ≈0 in P1 — report it honestly, don't engineer it to look non-zero).** **Tests:** one per category mapping.
- **PR-2 · Whitespace-tolerant matching.** Normalize whitespace in name/text extraction (J9). Deterministic, addresses the ~30 class. **Metric:** before/after heal on whitespace fixtures. **Tests:** trailing/internal/non-breaking-space.
- **PR-3 · Malformed-locator detector + intelligent-failure report.** Static validity check for impossible / self-concatenated XPath (~47 class, J9). Output is a **report, not a heal**. **Metric:** detection precision/recall; report-quality. **Tests:** malformed fixtures + a valid-locator negative control.
- **PR-4 · Proactive drift detection (Step 0 lite).** Re-extract signals + compare to recorded before run; flag drift (I20, ~57 class). **Metric:** drift precision/recall on a fixture. **Tests:** renamed/re-labelled fixtures.

### P2 — runtime / runner-dependent

- **PR-5 · `selfheal-runtime.js` + verify-by-effect three-way (I24).** snapshot→perform→observe→verify; verify-fails→FAILED, verify-impossible→PASSED+WARNING, unverified→human-review. **OSS check (4b): evaluate Playwright.** **Metric:** wrong-heal caught %.
- **PR-6 · Temporal-locality + elimination generators (I21/I22).** The first real heal-RATE levers. **Metric:** heal-rate uplift on duplicate-row/anchorless corpus; **false-heal must not rise.**
- **PR-7 · Assertion-semantics routing (I25).** locator-not-found→heal · assertion-fail-after-click→don't heal (app bug) · timeout→ambiguous. **Dependency: Pattern I fix (J5) — engine must surface error types.** **Metric:** mis-heals prevented on assertion-fail cases.
- **PR-8 · Mobile gesture gate (overlay/dialog detect + auto-dismiss + screen-state).** Deterministic but runtime; ~42+~30+~12 classes (J9). **Metric:** gestures unblocked; false-dismiss rate.

### P3+ — moat
- Federated outcome store (I27) · upstream locator/test-id advisor (J6) · semantic/visual **LLM gate for the residue only** (I26/J4).

## 4. Cross-cutting: Definition of Done per PR (folds #4a, #4b, #5, #6)

Every PR is not "done" until ALL hold:
1. **(#4a) Pseudocode** present in `IMPLEMENTATION-REFERENCE.md` before code is written.
2. Code complete; exported on `SELFHEAL` (dual-mode), matching existing idiom.
3. **(#4b) Code review via the `/code-review` skill on the diff** → real output captured. Where the PR touches a candidate dependency, an **OSS-vs-local check** (fuse.js / Playwright / pixelmatch per parent's table) with a real reason, not speculation.
4. **(#5) Tests added; full suite green** — state the real count (currently **17**; don't round). ≥1 test exercises the failure/gate path.
5. **(#6) Before/after metric row** in `PHASE1-tasks.md` Results table, each number labelled `measured`/`simulated`/`proxy`/`asserted`.
6. **The gate:** false-heal did **not** rise. A PR that raises false-heal is not done, regardless of heal-rate gain.

## 5. Metrics framework (#6) — what we measure at every step

Per-PR before/after on a fixed corpus, reusing the `FEEDBACK-LOOP.md` 6-step cycle and `PHASE1-tasks.md` table format. Core metrics, always together (never a lone %): **correct-heal · abstain · false-heal · diagnosis-accuracy · residue-size.** Headline numbers require a **labelled** set; proxy corpora are labelled proxy.

## 6. Final refine redteam (#2 — no-BS pass on THIS v2 plan)

- **FR1 [major]** P1's real-heal numbers depend on Pattern-A DOM fixtures we may **not have** — the real 665 are tenant data. PR-2/PR-3 metrics are **proxy**, not the real distribution. Honest, but must be labelled and not over-claimed.
- **FR2 [major]** **Validation-corpus mismatch:** Gap-2 is web, n=11, public; the POC 66.5% is **mobile-heavy** (swipes, iOS dialogs). Our matcher is web-DOM; the iOS adapter is stub-tested on one tree. Validating L1 on Gap-2 does **not** validate the mobile share. Need a mobile proxy corpus or explicit "web-only evidence" labelling.
- **FR3 [minor]** #4b ("code review by diff skill") needs code to exist → it is a **per-PR build-time task**, not runnable now. Sequenced into the DoD, not pre-build.
- **FR4 [major]** #6 before/after needs a baseline; for Pattern A we have the POC count (665) but **not the DOMs** → "before" = `matchStep` on proxies only. Cannot claim before/after on the real 665. Label proxy.
- **FR5 [blocker→mitigated]** 80/20 assumes most of A is deterministic — **unproven until PR-0 measures the split.** Mitigation: PR-0 is measurement-first and gates the build PRs. If the residue is mostly true-semantic, P1 value shrinks and L2/LLM moves up.
- **FR6 [dependency]** Pattern I (opaque errors) is an **engineering prerequisite we don't own** (J5). If exception-swallowing isn't fixed, PR-7 (assertion routing) is blind. Track as external dependency, not assumption.
- **R-survives:** the deterministic-first thesis, the 3-layer separation, intelligent-failure framing, and the measurement-first sequencing all hold.

## 7. Open dependencies / decisions for the user

- **D1 (data access) — BLOCKER, not just unknown (GA5):** Can we get a sample of real Pattern-A failure DOMs (sanitised) from the POC tenants? Without it, PR-0 measures our *own synthetic proxies* (circular — measures fixture design, not reality), and **no P1 number reflects the real 665.** Everything is proxy (FR1/FR4). This gates whether the data-driven mandate is even achievable in P1.
- **D2 (mobile evidence):** Is web-only L1 validation acceptable for now, or do we need a mobile proxy corpus before claiming the 66.5% (FR2)?
- **D3 (Pattern I):** Is the engine exception-swallowing fix on the engineering roadmap (FR6)? PR-7 depends on it.

## 8. Verification (end-to-end, when built)

1. `IMPLEMENTATION-REFERENCE.md` restructured to v2 (diagnosis gate first, atlas demoted to L3 outcome-store); R9 resolved.
2. PR-0 corpus + measurement table exists; the deterministic-healable % is **measured on proxies** and clears (or fails) the 20% gate — honestly reported either way.
3. Each shipped PR satisfies the §4 Definition of Done (pseudocode + `/code-review` output + green suite with real count + before/after row + false-heal-didn't-rise).
4. Every number in every artifact is tagged `measured`/`simulated`/`proxy`/`asserted`. No untagged %.
5. Scope-out (D/E/F/H/I) honoured — no heal attempted on engine/infra patterns.

## 9. Grilled assumptions — VERIFIED against source & data (2026-06-23)

Each load-bearing assumption was checked, not asserted. Verdict = what survived.

| # | Assumption (as written) | Verification | Verdict |
|---|---|---|---|
| **GA1** | Diagnosis gate is "built on existing `matchStep` outputs" (I19) | `matchStep` returns only `{verdict, best, margin, diagnosis}` — **NOT `ranked` or candidate count** (core L205 computes `ranked` internally, discards it) | **FALSE as stated.** Needs `rank()` exposed or `matchStep` extended for full category routing. PR-1 rescoped. |
| **GA2** | The diagnosis gate adds decision value (R1 "falsification test") | `matchStep` **already** returns `not-ready`/`no-identity`/`ambiguous`. A P1 mapping to 7-category vocab changes no decisions. | **R1 CONFIRMED for P1.** PR-1 demoted to a *reporting* layer; decision-divergence ≈ 0 until record-time/runtime signals. |
| **GA3** | Suite is "18/18 (14 web + 4 mobile)" (PHASE1) | `grep -c "test("` = **17** (web `runAll`); `expect(` = **4** (mobile `runMobile`). 14+4≠17. | **PHASE1 count is wrong.** Real = 17 web + 4 mobile. DoD uses live run, never the rounded number. |
| **GA4** | Fuzzy already covers copy-change name drift (J4) | "Add to Cart"→"Add to Bag": Jaccard = 2/4 = 0.5 → unique target scores ~0.87 (heals); but 3 identical → margin 0 → **abstain** | **HALF-TRUE.** Fuzzy covers *unique-target* copy change only. Multi-candidate (table/list) copy change still abstains → needs L2 (temporal-locality/elimination), not fuzzy. The ~380's deterministic reach is **unknown**, not "mostly covered." |
| **GA5** | PR-0 measures the deterministic-vs-semantic split (the kill-gate) | PR-0 corpus = our **own synthetic proxies** → measures fixture design, not the real 665 (same homework-grading flaw as the old recognition metric) | **CIRCULAR without D1.** D1 elevated to BLOCKER. PR-0 on proxies is directional only, explicitly labelled. |
| **GA6** | "66.5% of failures (Pattern A) is healable" (J2/§2) | POC label = "stale/broken locators = drift + brittleness"; conflates DRIFT + REMOVAL; routed-to-AI = intent not proof (J8) | **UNSUPPORTED.** 66.5% = locator-*class*; healable fraction unmeasured/unmeasurable w/o D1. §2 corrected to "hypothesis." |
| **GA7** | Malformed-XPath detection is deterministic/static (PR-3, J9) | Syntactic contradictions (e.g. `[@id='x'][@id='y']`) are static; "valid-but-never-matches" depends on the DOM | **PARTIAL.** Static-contradiction = deterministic (P1); valid-but-no-match = runtime (P2). PR-3 split accordingly. |
| **GA8** | Existing core fns are exported & callable (`rank`,`diagnose`,`verdict`,`matchStep`) | Confirmed in `SELFHEAL` export (core L221) | **TRUE.** But `diagnose(ranked, vd)` needs `ranked` — see GA1. |

**Net effect of the grill:** P1's honest deliverable shrinks to (a) a **failure-reporting** layer (not a decision gate), (b) two **narrow deterministic healers** (whitespace; static-malformed-XPath) whose real-world reach is unmeasured, and (c) a **measurement PR that is circular until D1**. The heal-RATE story (the 66%) is **entirely contingent on D1 + L2 runtime** — none of it is demonstrable in P1 alone. This is the no-fabrication truth: **P1 proves reporting + 2 micro-healers; it does NOT prove the 66%.**

---

# 10. D1 UNBLOCK PLAN — get real Pattern-A data (chosen next track)

**Decision:** unblock D1 first; without real DOMs every number is proxy and PR-0 is circular (GA5).

## 10.1 Known capture formats (verified in-repo)
- **Mobile = Appium XCUITest page-source XML** (`ios_pagesource.xml`): tree of `type/name/label/value/enabled/visible/x,y,w,h`. Real evidence: the nav close button is `name="      "` — a **whitespace-only locator**, the ~30 whitespace-class failure (J9) captured in the wild. `IOS` adapter already parses this.
- **Web = DOM HTML** (`outerHTML`, as Gap-2 used). `WEB` adapter already parses this.

## 10.2 Minimal record we need per Pattern-A failure (the precise ask)
```
{ failure_id, platform: web|ios|android,
  recorded:   { locator, descriptor(11 signals as captured) },   // = our captureStep / step.target
  dom_at_failure: <sanitized web DOM subtree | Appium XML>,        // the state where it failed
  ground_truth:   { true_target_ref | "removed" },                // hand-labelled — enables correct-heal vs false-heal vs correct-abstain
  sub_cause:      copy-change|whitespace|malformed|renamed|removed|unknown,  // for stratification
  tenant_hash }                                                   // anonymized — for J6 concentration check
```
Ground truth is **mandatory** — without it we can measure "did we heal" but not "did we heal *correctly*" (false-heal is the gating metric).

## 10.3 Sanitization policy (privacy — extends I27)
- **KEEP:** tree structure; role/type/tag; identifiers (testid, accessibilityId, id); geometry; enabled/visible; name **when it is an identifier**.
- **STRIP/TOKENIZE:** free-text `label`/`value`/textContent that may be PII → replace with a token that **preserves length AND whitespace** (trailing-space is itself a failure cause — GA/J9 — must survive sanitization); URLs → keep path shape, drop host/params; any user/patient data.
- Rationale: matching validation needs candidate elements' signals + structure, so we keep the skeleton but scrub the text. This is stricter than I27's "signal-profiles only" because we need the surrounding candidates to score against.

## 10.4 Sampling (honest, not precise)
Stratified: **n ≈ 30–50 per platform**, balanced across sub-causes AND across the **top tenants** (not all Tenant 49342, per J6). Goal = honest proportions with wide CIs, not a precise rate. Mobile included because 66.5% is mobile-heavy (FR2).

## 10.5 In-repo scaffolding — buildable NOW on existing artifacts (de-risks the wait)
While data access is pursued, build + validate the **intake pipeline** against the artifacts we already have (`ios_pagesource.xml`, Gap-2):
- `corpus/schema.md` — the 10.2 record format.
- `sanitize(domOrXml, platform) → sanitized` — deterministic; tested on `ios_pagesource.xml` (must preserve the `"      "` whitespace) + a synthetic web fixture. **DoD §4 applies.**
- `loadCorpus()` + a PR-0 measurement runner → emits the heal/abstain/false-heal × sub-cause table.
- The moment a sanitized sample lands → PR-0 runs and produces the **first real number**.

## 10.6 External dependencies — ONLY the user/Testsigma can answer
- **Q-D1a (decision-changing):** Does Testsigma capture **DOM / page-source at failure**, or **screenshots only**? If screenshots-only → the deterministic matcher can't run on real failures and the whole web approach pivots to vision (mobile XML still works).
- **Q-D1b:** Access path + sanitization sign-off — who owns the failure artifacts; can we pull a sanitized ~30–50 sample?
- **Q-D1c:** Can someone who knows the apps provide **ground-truth labels** (true target / removed), or must we infer? **(Answered: tenant labels NO — see K5 workarounds.)**

---

# 11. Refinement after the iOS POC source (`iOS_Swipe_Routing_Analysis.pdf`)

## Ledger K — the full source dataset
- **K1** [POC-full] The 1000 failures are **ALL iOS Native SWIPE runs** (14 tenants), NOT web. Pattern A locators are **XPath over the XCUITest tree** → D1 data = **Appium page-source XML** (= `ios_pagesource.xml` format). The **`IOS` adapter + Gap-3 tests are the relevant engine, not `WEB`.** We have ZERO web failure data; web Pattern-A is separate + unmeasured (sharpens FR2 → D2 is now primary).
- **K2** [POC-full] The report's OWN split: **Phase-1 "no AI model needed"** = drift DETECTION (pre-run XPath/accID resolution, ~665 *prevention*) + cascade attribution (logic) + overlay detection (rule-based). **Phase-2 "requires AI model"** = semantic/visual runtime matching, est. **"resolves the MAJORITY of Pattern A (~500+)."**
- **K3** [reconciliation — corrects J3/J4] Deterministic **DETECTION** is strong (most of 665 as prevention + narrow heal classes). Deterministic **HEALING** is narrow (whitespace ~30, malformed ~47, unique-target name-drift). Domain estimate: **majority of runtime heals need semantic/vision (L2/L3).** "Deterministic-first captures 80%" is TRUE for detection, **FALSE for healing.**
- **K4** [POC-full] Pattern A is **swipe-context**: many are swipe-until-visible with **off-screen** targets (ties to Pattern C + bug D-2 Infinity-coordinate). Heal must work within scroll/swipe (element may be off-screen) — more than static-tree matching; connects to our actionability off-screen gate (Gap-3 D-2).
- **K5** [D1 — answers Q-D1c] Tenant labels = NO, but **not fatal**: (a) XCUITest XML is human-readable → **self-label a 20–30 sample** from tree + step intent; (b) **post-fix corrected locator** (later passing run), if stored, = automatic ground truth. Without either, **false-heal is unmeasurable** (the gating metric).
- **K6** [D1] Partial ground truth already exists: POC's pattern A–I + sub-cause + tenant labels = **category-level** truth → enables **diagnosis-accuracy** measurement even without element-level truth.
- **K7** [validation] The report's Phase-1 "no model" list (drift detection, cascade attribution, overlay detection) **independently validates our L1 detection/diagnosis-first approach.**

## Plan deltas (apply to MASTER PLAN v2)
- **80/20 reframed (supersedes §2):** the deterministic 20% that captures most *value* = **drift DETECTION + intelligent failure reporting over the 665** (flag/diagnose, no model), NOT runtime healing. Runtime semantic heal of the majority is **model-dependent → L2/L3**, explicitly deferred. Lead with detect/diagnose; heal only the narrow deterministic classes.
- **PR reorder (P1):** promote **PR-4 (pre-run drift detection / staleness scan)** to lead P1 value (covers 665 as prevention, no model, validated by K2/K7). Keep PR-1 (reporting), PR-2 (whitespace), PR-3 (static-malformed) as the narrow deterministic heal slice. All on the **`IOS` adapter / XCUITest XML**, not WEB (K1).
- **D1 intake (supersedes §10.1 target):** primary format = **XCUITest page-source XML**; reuse `IOS` adapter + `ios_pagesource.xml` as the sanitizer/loader test artifact. Web DOM intake deprioritized (no data).
- **Ground-truth plan (supersedes §10.2 mandatory-label):** self-label a 20–30 XML sample (K5a) + request post-fix locators (K5b); measure diagnosis-accuracy via POC category labels now (K6). State plainly: **without element labels, we report heal-attempted + diagnosis-accuracy, NOT false-heal.**
- **D2 status:** mobile is now the PRIMARY (and only) real-data platform; web evidence is absent, not optional.

## Ledger K (cont.) — deterministic healing ceiling (corrects K3)
- **K8** [user-challenge + VERIFIED, corrects K3] Deterministic HEALING reach is **far larger than K3 conceded.** Verified arithmetic on existing `scoreEx`: a fully name-drifted **form input** (role+tag+nameAttr+type+inForm+formAction match, name=0) scores **0.898**; a plain **button** (role+tag only, name=0) scores **0.737** — both already clear the 0.62 heal floor. So the matcher already heals through total text change; what makes it abstain is **margin (ambiguity), not the threshold** (confirms `PHASE1-tasks.md:100`).
- **K9** [reframe] Healing is therefore mostly a **disambiguation/margin** problem, NOT a "recognize the element" (vision) problem. The deterministic levers that break the tie — **elimination (Idea 5), interaction-context (Idea 6), structural position (Idea 2)** — need no LLM. "The submit button in this form" heals deterministically even when its text is fully rewritten/translated. The POC's "~500+ needs semantic/visual" assumed name-matching is the only deterministic tool — a limitation of the *current* matcher, not of deterministic healing.
- **K10** [honest bound] Do NOT swap the POC's unmeasured "majority-semantic" for an unmeasured "80%-deterministic." Verified claim: deterministic ceiling is **structurally higher than name-fuzzy-only implies**; true vision/LLM residue = only where **structure AND text AND interaction-context ALL fail at once** (icon-only + redesigned + no anchor). The exact split (80/20 vs 60/40) is what **D1 measures** — D1-first still holds.
- **K11** [caveat] Deterministic heal levers need **runtime** (interaction history, record-time structural snapshots) and **available stable anchors** — scarce in hashed-class SPAs / deep XCUITest trees (Idea 2's own challenge). Bigger reach, still L2/runtime, still app-dependent.

## Plan delta (supersedes the §11 80/20 reframe)
- **L2 deterministic heal toolkit (the real bulk of healing):** margin/disambiguation via **elimination (I22) + interaction-context/temporal-locality (I21) + structural-position diff (Idea 2 — UN-PARK it) + fuller role/type/form-context scoring.** Vision/LLM is the small residue (K10), not the majority.
- **80/20 (final):** deterministic = detection/diagnosis (L1) **+ disambiguation-based healing (L2)**; both no-model. The 20% that wins = the disambiguation levers, because the matcher already clears the heal floor and only margin blocks it (K8). LLM is last-resort residue.
- **Build-order implication:** the elimination + interaction-context generators (PR-6) rise in value — they are the deterministic heal majority, not a niche. Structural-diff added as a P2 generator. Still gated on D1 to size the residue honestly.

## Ledger K (cont.) — implementation reality check (corrects the elimination PR)
- **K12** [CODE-VERIFIED, corrects the first candidate-generation attempt] `eliminate()`'s constraints (disabled / dismissive-name / out-of-form) are **REDUNDANT with the matcher** on the default path: `resolveScope` (core L178) pre-filters disabled; `name` + `inForm` are already scored signals (`DEF`), so on a *genuine tie* they are EQUAL and cannot break it. Net: `eliminate` delivers **SAFETY** (correct abstain on identical) but **NO heal uplift** on realistic ties. R1/GA2 confirmed *in code*, not just on paper.
- **K13** [correction] The genuinely-additive deterministic disambiguators are signals **NOT in `scoreEx` and NOT pre-filtered**: **container, sibling/descendant text** (the row's distinguishing text — the AirPods "which column" answer), and **ordinal/position**. These require **record-time capture** (`captureStep` records `container:null, ordinal:null`). So deterministic disambiguation that *adds heals* is a **Clue-2 capture+match task → P2-shaped**, not a trivial P1 runtime filter. Revises K8/K9's "cheap P1 deterministic heal": the cheap part is safety; the heal-adding part needs capture.
- **K14** [env] Verification is **blocked headlessly in this environment** (no node; preview-runtime sandbox blocks python stdlib import; no browser driver). The hermetic suite (`self-heal/tests/adversarial-validation.html`) runs **in-browser only** — served at `http://127.0.0.1:8765/...` via a Bash-launched static server. Pass/fail is therefore **user-verified in-browser**, not machine-verified by the agent. No "tests pass" claim is made without that run.

## Plan delta (corrects the candidate-generation PR)
- **Next real lever (replaces the trivial filter):** extend **capture** to record `sibling-text` + `ordinal` (deterministic Clue-2), and match on them at replay to break ties. Keep `eliminate` only as (a) a safety filter and (b) the `scopeVisible:false` disabled-drop edge — honestly labelled, not sold as heal uplift.
- **Module status correction:** `candidate-generation.js` `eliminate`/`disambiguate` = **SAFETY-preserving, heal-neutral** until sibling-text/ordinal capture exists. Do not report heal uplift from it.

## Ledger K (cont.) — two gaps surfaced by real in-browser verification
- **K15** [CODE-VERIFIED] `resolveScope` (core L178, `visibleOnly` path) filters `isShown && isEnabled` BEFORE ranking. Consequence: a **disabled element is dropped pre-rank → diagnosed as REMOVAL (not-found)**, not STATE_ISSUE. To diagnose STATE_ISSUE vs REMOVAL correctly, the *diagnosis* path must scope WITHOUT the enabled filter (e.g. `scopeVisible:false`) so found-but-blocked is distinguishable from absent.
- **K16** [CODE-VERIFIED, gap] `WEB.actionable` (core L82–90) checks shown / size / in-viewport / topmost — **but NOT `enabled`** (unlike `IOS.actionable` L115 which does). So on web, a disabled-but-visible match passes the gate → reported as a heal (DRIFT). Net: "disabled" on web is **never** STATE_ISSUE — it's either REMOVAL (scope-filtered) or DRIFT (gate-passed). Documented as a known gap; the 1-line fix (add `isEnabled` to `WEB.actionable`) is a deliberate core change, deferred.
- **K17** [VERIFIED RESULTS, in-browser via Chrome MCP, 2026-06-24] Core suite `runAll()` = **14/14** (web; pristine core intact after revert — the earlier "17" was a `grep` over-count). New `self-heal/tests/adversarial-validation.html` = **15/15**, `falseHeal_identical = 0` (`measured`). **Honest read of this slice:** it validates SAFETY (correct abstain on identical) + surfaced gaps K12/K15/K16; it delivers **NO heal-rate uplift** (K12). The heal-adding lever remains sibling-text/ordinal capture (K13).
- **K18** [env note] Verification ran via **Chrome MCP injection** against a Bash-launched static server (`static-server.py`, port 8765) — the project's established path. `preview_start` is unusable here (its python runtime sandbox blocks stdlib import).
- **K19** [BUILT + VERIFIED — the genuine deterministic disambiguator] `disambiguateByContext` (in `candidate-generation.js`) breaks a margin tie using **recorded container row-text** (Clue-2) — a signal NOT in `scoreEx`. `captureContext(el)` records `{rowText, ordinal, count}` at capture time (`step.context`). **Measured before/after (in-browser, Chrome MCP):** AirPods 3× identical "Add to Bag" → BEFORE `matchStep` abstains (0 heal), AFTER heals the correct column via row-text (**1 correct-heal**); `false-heal = 0` held (identical-row + no-context cases stay abstain). Suite now **18/18**. This is the first **heal-ADDING** deterministic lever (vs `eliminate`'s heal-neutral safety, K12). Thresholds `CTX={floor:0.30,margin:0.15}` are **heuristic/UNCALIBRATED** (flagged, not derived).
- **K20** [scope] `disambiguateByContext` proves K8/K9 mechanically: deterministic disambiguation by out-of-`scoreEx` context (row-text) converts abstain→correct-heal safely. `ordinal` captured but NOT auto-used (fragile per the source doc — documented last resort). Remaining residue for vision/LLM = ties where row-text ALSO fails to distinguish (genuinely identical contexts).
- **K33** [MEASURED · Amplitude portals → strategy] Consistent across 3 portals: option items are role-less/non-pointer/no-testid; only the container has a testid. The big property/event PICKERS (the most test-critical controls — you can't build a chart without them) are the same shape at scale. **BUT every Amplitude portal has a Search input** → two interaction/heal patterns emerge: **(1) Search-and-pick [preferred]** — the search `<input>` IS an anchorable candidate; type the target → list filters to one → click the lone result (collapses N→1, sidesteps role-less options). **(2) Container-scoped text-click [fallback]** — find container by testid, match option by text, click clickable ancestor. Add both to the strategy; search-and-pick is the robust default for searchable menus.
- **K32** [MEASURED · Amplitude open portal — live capture] An open Amplitude menu is a `div[role=listbox]` whose option items are **role-less, non-`pointer` leaf `div`/`span`s → 0 detectable candidates** (no `role=option`/`testid`, cursor≠pointer). We capture the container, not the options. **The `cursor:pointer` widener (resolved K28 chip / `CANDIDATE-COVERAGE.md`) does NOT generalize here** — Amplitude doesn't set `pointer` on option leaves → needs `role=option` detection (absent) or a parent-click-target heuristic. Confirms portal menu OPTIONS are a real, unsolved coverage gap on this app.
- **K31** [MEASURED · Amplitude] Portaled menus (Saved, Build-with-AI) are **toggle-stateful + timing-sensitive**: click-then-scan-in-a-later-call misses them (menu closes during the round-trip). Reliable capture = open → await-mount → scan-before-close in ONE tick (TEMPORAL/reveal → P2 runtime). Items may also be role-less divs (K28). Static AND naive-interaction scans undercount portal-driven flows.
- **K30** [MEASURED · Amplitude — the ambiguity taxonomy] TWO regimes: (a) *distinct-content* repeats (Gong Outline per-section) → row-text disambiguates (95%); (b) *identical-content* repeats (Amplitude segments/funnel steps: `All Users 67.1%`×2, `Any Active Event`×2, `More Options`×2 — all `distinct:1`) → row-text FAILS → **ordinal/position is the ONLY deterministic lever**. Config-builder UIs are full of identical-twin ambiguity → strongest case to activate the captured-but-unused `ordinal` fallback (currently `disambiguateByContext` would correctly abstain on these).
- **K29** [MEASURED · Amplitude chart-builder] **Recordability varies hugely by VIEW within one app — corrects K23's "low everywhere".** Chart-builder = **60–65%** (testid 70–75 of 124–145) vs Amplitude billing 13% vs Gong 0%. Core product surface is testid-rich; peripheral pages aren't. The testing-relevant views may be far more healable than the peripheral-page sweep implied.
- **K28** [MEASURED · Gong full flow — coverage gap] **React-handler `<div>` clickables are invisible** to both the observer and core `WEB.candidates` (selector = a/button/input/role/[onclick]/[tabindex]). Gong's Slides cards (repeating scrubber units) barely register because their click is a JS onClick with no `role`/`onclick` attr. DOM click handlers aren't introspectable → a partly-inherent SPA coverage limit; heuristics (cursor:pointer, focusable) only approximate. Affects the candidate set itself (can't heal what isn't a candidate). Spun off as a parallel task.
- **K29** [RESOLVED — HYBRID: ship opt-in widener + document inherent limit · `self-heal/docs/CANDIDATE-COVERAGE.md`] Resolved K28. **Measured** the precision/recall tradeoff with an asymmetric oracle (expensive React-fiber/`onclick`/Vue introspection = ground truth; cheap CSS/attr signals = detectors under test) on a live Flipkart product grid: **roleless onClick gap = 73% of all clickable nodes.** Raw `cursor:pointer` = recall 0.90 / **precision 0.08** (1462 false-pos — floods, because cursor:pointer is *inherited* down the subtree). **pointer-root** (outermost pointer; parent not pointer) = recall 0.30 / **precision 0.65** — an **8× precision gain**, the decisive lever. Two inherent caps: affordance≠handler (precision tops ~65%), and **delegation collapse** (`gapTruthOutermost=1` → onClick not per-element attributable even WITH fiber access). **Shipped** `pipeline/candidate-widening.js` (OFF by default, core PRISTINE): `widenCandidates`/`matchStepWidened`, pointer-root + tabindex + aria affordance, guards (inline/backdrop/native-wrapper). **Verified in-browser:** widener **10/10**, core **14/14**, adversarial **20/20** all green. Stays opt-in because the matcher's gating metric is false-heal==0 and ~1-in-3 widened candidates is a non-target (fronted by actionability gate + verify-by-effect).
- **K27** [MEASURED · Gong full flow, all 5 tabs — `APPS-OBSERVATION.md`] Disambiguator value is **concentrated in repeating-list views**: Outline = 132 dup sets, **95% distinguishable** (post div-soup fix); Highlights 44%; Transcript/Call Info/Slides ~5 ties each, 0% — and identical across those three = the persistent app shell, not tab content. **recordability ~0–5% on EVERY tab** → Gong has no stable anchors anywhere (re-confirms K23: anchor coverage is the ceiling). Honest profile of one full real flow: deterministic disambiguation pays off big on dense list views, little on sparse/media views.
- **K26** [FIXED + MEASURED — containerOf div-soup detection, validates the K25 fix on a real SPA] Upgraded `containerOf` (both `candidate-generation.js` and `app-observer.js`) to fall back to the nearest *repeating-sibling* ancestor (≥2 same-tag siblings each holding an interactive control) when no semantic row exists. **Lab:** `divSoup_contextHeal` regression test green; suite **20/20**. **Live Gong (Outline):** 5 of top 8 duplicate sets now row-text-distinguishable (was ~0) — `Copy`×32→32 distinct, timing spans, `Play at 46:02`×6→distinct. **Residue cleanly characterized:** 69 truly-nameless icon buttons (collapse→1, genuine visual/ordinal/LLM tail) + cross-viewport desktop/mobile dupes (8→4 distinct, correct abstain). The disambiguator now works on div-soup, not just `<td>`.
- **K25** [MEASURED · Gong deep-scan — corrects K23, the disambiguator's real boundary] `disambiguateByContext` **FAILS on div-soup SPAs.** Gong Outline: biggest duplicate set = 69 nameless buttons, all collapse to `distinctRowTexts:1` because `containerOf` only recognizes semantic row containers (`tr/li/td/section`, `role=row`) — div-based layouts climb to a shared ancestor. The AirPods lab test passed only because it used `<td>`. **Real reach is markup-dependent:** works on semantic table/list (IRCTC/Amplitude ~50%), fails on div-soup. Fix = better container detection (nearest *structurally-repeating* ancestor, or nearest ancestor carrying distinguishing text) — a P2 improvement to the lever, not the semantic-tag heuristic.
- **K24** [MEASURED · Gong deep-scan — corrects the whole sweep] Static visible-only scan **massively undercounts SPAs**: Gong strict-visible 247 vs laid-out (incl. hover-hidden) **673 = 63% missed**; duplicate sets 0→**133**. For test resilience the hover-gated controls DO count (tests hover to reach them). **All K23 sweep counts are heavy lower bounds**; honest measurement must count laid-out controls or interact first. (Surfaced by the user's hover observation on Gong's Outline tab.)
- **K23** [MEASURED · live · 6 apps, 2026-06-24 — `self-heal/docs/APPS-OBSERVATION.md`] Multi-app sweep (Wikipedia, Gong, Claude, IRCTC, Keka, Amplitude). **Dominant finding: strong-anchor coverage is LOW everywhere — 0–17% (median ~13%)**; most controls are name-only → confirms the parent thesis that **upstream test-id/anchor coverage is the #1 heal-rate lever, above any matcher cleverness**. Ambiguity (where `disambiguateByContext` applies) = 0–20%, real but modest, concentrated on data/table views. Row-text-distinguishes% where ties exist: Wikipedia 11% vs IRCTC/Amplitude 50% — directionally supports "table apps > content," but tied-set n is tiny (1–2/app) → directional NOT statistical. Gong = 78% anchorless (icon-only media) = the genuine visual/LLM residue. Caveats: SPA single-snapshot → lower bounds (lazy/portaled menus uncounted); one page per app.
- **K22** [reference — testers.ai QA report] testers.ai is a broad QA *auditor* (deterministic a11y/perf/SEO audits + LLM content judgment + AI-persona flow exploration), answering "what's wrong with this page." Distinct from our self-heal (test resilience / locator-drift diagnosis), which sits *underneath* a runner. Two takeaways: (1) **accessibility quality ≈ self-healability** — their "missing label/alt", "no descriptive name" findings are exactly our anchor signals; a page that fails a11y is anchorless → hard to heal. Our `app-observer` `anchorMix` already measures this. (2) Their "Fix-prompt for coding agent" output validates `failure-reporter.js`'s named-category + actionable-remediation shape. Their persona/flow exploration = the P2 runtime layer.
- **K21** [CODE-REVIEW — `/code-review` high, 3 finder agents + verify; findings FIXED + re-verified 19/19 in-browser] The review caught a **CRITICAL false-heal hole** in my own new code: `disambiguateByContext` had **no identity floor** → a *removed* target's low-conf junk band could be context-healed on row-text alone. **Fixed:** require `ranked[0].conf >= TH.heal` before any context heal (regression test `identityFloor_blocksFalseHeal` added). Also fixed: (2) replaced `S.fuzzy` on long row-text with **token-Jaccard** (fuzzy's substring boost manufactures coincidental row matches — the exact bug the core fix killed for short names); (3) module-load guard hardened to prefer `window.SELFHEAL` so an AMD/bundler `require` can't hijack browser load; (4) `margin` kept in identity units + separate `contextMargin` (was two scales on one field); (5) `DISMISS_NAME` word-boundaried (was matching "Feedback"/"Background"); (6) extracted shared `rankAndTie` helper (was copy-pasted scope+rank between the two disambiguators). **Lesson:** building + adversarially reviewing caught a gating-metric (false-heal) bug that paper design missed — the verify discipline paid off twice this session (K12 then K21).

- **K34** [BUILT + VERIFIED — backlog #1, the ordinal fallback (C2/K30)] `disambiguateByContext` now falls back to **ordinal/position** when row-text can't separate identical-content twins (Amplitude funnel-step/segment shape). **Safety guards (false-heal protection):** fires ONLY when (a) the tied candidates are **byte-identical by row-text** (`genuineTwins` — provably indistinguishable, so position is the sole signal and any choice is outcome-equivalent), (b) the duplicate **set count is unchanged** vs capture (structurally stable → position trustworthy), (c) sig (role+name) unchanged, (d) identity floor passes. Else abstains. **Verified in-browser 22/22** (`ordinal_identicalTwin` heals the recorded position; count-changed 2→3 abstains; no-context abstains). **Residual risk (documented, narrow):** if `containerOf` *falsely* collapses two genuinely-different elements to identical row-text AND they reorder, ordinal could mis-heal — bounded by the byte-identical guard + count-match, not absolute-zero. Preferred order: row-text (context) → ordinal (twins) → abstain.

---

# 12. Multi-app evidence → consolidated strategy & re-ranked backlog (from K23–K33)

Turns the Gong + Amplitude observations into evidence-backed, prioritized action. Every claim cites a measured K-tag.

## 12.1 Evidence-backed conclusions
- **C1 — Anchor coverage is the dominant ceiling, AND it's view-dependent (K23, K29).** Peripheral pages 0–17%, but the *testing-relevant core* (Amplitude chart-builder) hits **65%**. So upstream test-id advocacy stays the #1 lever, AND the real opportunity is better than the raw average where it matters. Stop quoting "low everywhere" — quote per-view.
- **C2 — Disambiguation has two regimes (K27, K30).** *Distinct-content* repeats → `disambiguateByContext` (row-text) works (Gong Outline 95%) — BUILT. *Identical-content* repeats (config blocks / funnel steps) → row-text correctly abstains; **only ordinal/position can heal them** — the captured-but-unused `ordinal` is the missing lever.
- **C3 — Modern-SPA coverage gaps are real and partly inherent (K28, K32).** React-handler `<div>` clickables (no role/onclick) and portal options (role-less, non-pointer, no testid) aren't standard candidates. The `cursor:pointer` widener (resolved chip, `CANDIDATE-COVERAGE.md`, 0.65 precision) helps on some apps but **does NOT generalize to Amplitude** (no pointer on options).
- **C4 — But role-less portals are still *operable* via search (K33).** Every Amplitude portal has a search `<input>` (anchorable) → **search-and-pick** sidesteps role-less options entirely. Operability ≠ element-locatability.
- **C5 — Measurement methodology corrected (K24, K31).** Static visible-only undercounts SPAs ~2.7× (hover-gated); portals are toggle/timing-sensitive. Default to **laid-out scanning** (done) + one-tick portal capture.

## 12.2 New pipeline patterns to add (L2 — the heal/interaction layer)
| pattern | regime it solves | status | effort |
|---|---|---|---|
| **ordinal fallback** in `disambiguateByContext` | identical-content twins (C2) | capture exists (`captureContext.ordinal`), matching unused | small — lab-buildable now |
| **search-and-pick** | role-less searchable portals (C3/C4) | specّd; needs runtime (type→filter→click) | P2 (runtime) — spec now |
| **container-scoped text-click** | role-less portals w/o search (C3) | spec'd | P2 (runtime) |
| **pointer-root widener** | React-handler div clickables (C3) | BUILT (chip → `CANDIDATE-COVERAGE.md`); markup-dependent | integrate guarded; measure per-app |

## 12.3 Re-ranked backlog (evidence-backed)
1. ✅ **DONE (K34) — `ordinal` fallback activated** (C2). Fires only on byte-identical twins + unchanged set count + identity floor (false-heal-protective). Verified 22/22 in-browser. Residual: `containerOf`-false-collapse + reorder (narrow, documented).
2. **Spec `search-and-pick`** as the primary portal-interaction pattern (C4) — highest-leverage for Amplitude-class apps; implementation waits on the P2 runtime but the spec + the "is there a search input?" detector are buildable now.
3. **Laid-out scanning** as the measurement default (C5) — DONE in `app-observer`.
4. **Per-view recordability** in reporting (C1) — stop averaging across peripheral + core; report per-view.
5. (P2) runtime (`selfheal-runtime.js`) — unlocks search-and-pick, container-text-click, verify-by-effect.
6. (P2) integrate pointer-root widener with guards (C3); measure precision per app (don't assume it generalizes).

## 12.4 Strategy corrections to fold up
- The MASTER-PLAN-v2 "anchor coverage low everywhere" → **view-dependent** (C1).
- `disambiguateByContext` reach: distinct-content (works) vs identical-content (abstains → ordinal) vs role-less portals (search-and-pick). Document the regime map so it's not over- or under-sold.
- Honest residue after all deterministic levers: truly-nameless icons with no distinguishing context (Gong's 69) → genuine visual/LLM tail (P3).

---

# 13. Gong E2E proof → compounded learnings + objective status (K35)

Sources: `GONG-E2E-RUN.md`, `GONG-SELF-HEAL-ASSESSMENT.md`, `CANDIDATE-COVERAGE.md` (the two spun-off chips, both completed).

## 13.1 Proven LIVE this session (not just unit tests)
- Full loop **record→drift→match→heal→diagnose→report ran on REAL Gong DOM**, assembling the existing pieces (core untouched/pristine; suites 14/14 + 22/22).
- **SAFETY OBJECTIVE ACHIEVED + PROVEN LIVE: 0 false-heals across 51 heal-eligible cells** (2 scoping regimes × 3 drift modes). Localization correctly collapses every context-heal → abstain (0 false-heal). This was the primary gate (I2). ✅
- `disambiguateByContext` converted abstain→correct-heal on **4 real repeating-list controls** (per-section "Copy") via container row-text — K27 reproduced live.
- Mechanism flakiness **0%** (deterministic). The real flakiness is **capture-time** (SPA async render, cross-viewport twins).

## 13.2 THE compounding insight — HITL is the heal-rate unlock (not more matcher cleverness)
The system **already emits the exact signals a human-in-the-loop UI needs**; surfacing them is the highest-leverage next step because it attacks the DOMINANT lever (anchor coverage, K23) **at the source**:
- **Record-time HITL** — fires on the `flag` `captureStep` already emits (`no-anchor`/`ambiguous`/`weak-identity`; fired **9/9** on Gong). Nudge the author to: add a testid (the #1 lever), confirm the container-row disambiguator (what made C3–C6 heal), pick the viewport, caption nameless icons (Clue-3), confirm content-settled. **Converts "safely abstains a lot" → "heals a lot because the author left it an anchor."**
- **Execute-time HITL** — route by `diagnoseFailure` category: `DRIFT`-via-context → one-click confirm first time then auto-trust (P2 learning); `AMBIGUITY`/`REMOVAL` → adjudication queue (the `failure-reporter` card IS the work item); verify "unverified" (`PASSED_WARNING`) → human review, never auto-promote (becomes P2 ground-truth).
- **Principle (I2):** heal confidently OR hand a named, actionable reason — never silent stop, never silent guess. HITL is the rendering of that contract. **This promotes HITL from a deferred idea to the next first-class workstream.**

## 13.3 New capture-time requirements (from Gong's real flakiness)
- **Content-settle gate** before capture (SPA async render captured the wrong/un-rendered tab **twice** → 0 buttons).
- **Viewport-scoped capture** (Gong ships desktop+mobile DOM simultaneously → universal twins → un-scoped capture abstains on everything).

## 13.4 Objective status — the 3 layers
- **L1 safety/diagnosis: BUILT + PROVEN LIVE** (0 false-heal on real DOM; named diagnosis on every non-heal). ✅ near-done.
- **L2 heal-capability: deterministic matching levers BUILT + verified** (context row-text, div-soup `containerOf`, ordinal twins, pointer-root widener) on synthetic+round-trip drift + live Gong. **GAP: the live RUNTIME (`selfheal-runtime.js`) is NOT built** — it gates verify-by-effect (modelled only), temporal/wait, and **search-and-pick execution** (the Amplitude portal lever). 
- **L3 cross-tenant moat: not started** (P3).
- **Near:** safety + deterministic mechanism (proven). **Far:** natural-drift heal *RATE* — gated by **D1 real data** (still blocked) + **P2 runtime**, and reach is **anchor-gated** → the lever is HITL + upstream anchors, NOT more matcher work.

## 13.5 Re-ranked next (post-Gong)
1. **Spec record-time HITL checkpoint** — highest leverage; surfaces existing `flag`/`diagnose` signals; attacks anchor coverage at source. Spec buildable now.
2. **P2 runtime (`selfheal-runtime.js`)** — unlocks search-and-pick, verify-by-effect, temporal/wait; every remaining heal lever waits on it.
3. **D1 real data** — still the blocker for a natural heal-RATE number.
4. **Capture-time content-settle + viewport-scope gates** (kill the only observed flakiness).

---

# 14. Amplitude-charts E2E v2 — session plan (lessons-incorporated, HITL, extensive cases)

**Context / why:** the Gong E2E proved the loop + safety but had only 9 hand-picked cases and no HITL. This session re-runs the full loop on **Amplitude charts** (testid-rich core, identical-twin config blocks, role-less search-portals — a richer, *different* shape than Gong) with: (a) all 6 Gong lessons baked in, (b) **extensive AUTO-GENERATED cases**, (c) a real **in-browser HITL popup**, (d) **property-based drift fuzzing** (Antithesis-borrowed), (e) **search-and-pick** for portals (K33). Runs as a spun-off session driving its **own Chrome tab**; the user clicks tabs/menus live.

## 14.1 Lessons baked in (from §13 / K35)
- **Content-settle gate** before every capture (SPA async render bug). **Viewport-scoped** candidates only (cross-viewport twins). **Recordability per-view** (chart-builder ~65%, K29). **Flag-driven HITL** at record time (the flag fires → ask the human). **Safety-first**: false-heal=0 is the pre-registered ceiling; localize must collapse to abstain.

## 14.2 Extensive test cases — AUTO-GENERATE, don't hand-pick (Momentic `explore`-borrowed)
Instead of 9 hand-picked steps: **enumerate every visible + interaction-revealed control** (the `app-observer` already does this) → each becomes a candidate recorded step (`captureStep`+`captureContext`). Then **stratify to guarantee regime coverage** (target ~30–50 cases):
- testid-anchored core controls (Amplitude's strength) · name-only-unique · **identical-twin config blocks** (segments/funnel steps → ordinal, K30) · **portal options** (Events/property pickers → search-and-pick, K33) · nameless icons (expect abstain).
Label each with its expected outcome **before** running (heal-via-X / abstain) = pre-registered ground truth.

## 14.3 Property-based drift fuzzing (Antithesis-borrowed) — the coverage multiplier
For each generated case, run **K seeded mutations** (restyle, localize, attribute-shuffle, **reorder**, add/remove-twin) and assert the **invariant**: *correct-heal OR abstain — NEVER false-heal.* cases × mutations = hundreds of falsifiable cells from ~40 cases. Deterministic + reproducible (seeded), matching our 0%-mechanism-flakiness property. This is "extensive" done rigorously, not by hand.

## 14.4 HITL — in-browser popup (the user's ask), buildable now
**New `self-heal/tools/hitl-overlay.js`** — a fixed-position panel injected into the page via Chrome MCP (no extension needed for the POC; productization = bookmarklet → extension per parent P2/P3). Two card types, both rendering signals the pipeline ALREADY emits (§13.2):
- **Record-time card** (fires on `captureStep.flag` ∈ no-anchor/ambiguous/weak-identity): shows descriptor + container row-text + suggested anchor; buttons **[Confirm row identifies it · Strengthen anchor (note a testid) · Pick viewport · Caption icon (Clue-3) · Skip]**.
- **Execute-time card** (fires on abstain AMBIGUITY/REMOVAL · first context-heal · verify "unverified"): shows `diagnoseFailure` category + `failure-reporter` message + candidate list; buttons **[Pick candidate N · Confirm heal · Adjudicate-skip]**.
- **Loop mechanism:** button onclick writes `window.__hitl.decision`; the runner awaits it (poll/Promise). The user's choice is recorded as ground-truth → feeds the (P2) learning loop. This realizes the I2 contract live: heal-confidently OR hand a named card; never silent.

## 14.5 Search-and-pick (K33) for Amplitude portals
For role-less portal options: detect the portal's search `<input>` (anchorable) → type the target → list filters to one → click the lone result (HITL-confirm first time). Container-scoped-text-click as fallback when no search. This is the Amplitude-specific heal lever Gong didn't need.

## 14.6 Competitor synthesis (folded in)
- **Momentic** → auto-test-gen-by-exploration (14.2) + confidence-logged heal-suggestion = our execute-time HITL (14.4). We differentiate as **deterministic/explainable**, not ML-black-box.
- **Antithesis** → property-based drift fuzzing (14.3) + reproducibility as our core value; they do system/backend chaos, we do UI resilience (complementary).
- **OpenTest/Autonoma** → baseline (keyword-driven OSS) / code-as-source-of-truth axis; little to borrow on heal.
- **Positioning:** deterministic, explainable, false-heal-0 UI self-heal + HITL anchor-strengthening — sits *under* a runner, *beside* Antithesis.

## 14.7 Deliverables & verification
- `AMPLITUDE-E2E-RUN.md` — auto-generated case inventory, per-case × per-mutation outcomes, false-heal=0 pre-registered ceiling, HITL decisions log, search-and-pick results.
- `self-heal/tools/hitl-overlay.js` + an Amplitude runner/harness (tools layer; **core stays pristine**).
- Keep core 14/14 + adversarial 22/22 green. Tag every number measured/synthetic. Honest read on heal reach vs Gong (expect higher — testid-rich + search-and-pick).

## 14.8 Run model (DECIDED)
**Spun-off session** (own Chrome tab). The chip injects the HITL overlay + runs the auto-gen / property-fuzz / search-and-pick pipeline; the **user drives that tab** (clicks Amplitude tabs/menus, answers HITL popups). This planning/observation thread stays separate. The chip works off the current code (ordinal + div-soup container + search-and-pick spec all present); core stays pristine.

## 14.9 Honest scoping caveats (carry into the chip)
- Big session — internally PHASE it: (A) explore+auto-generate+stratify cases + inject HITL overlay + capture with content-settle/viewport-scope; (B) run pipeline + property-fuzz + search-and-pick + HITL adjudication; (C) report. Don't try all at once silently.
- Same env limits as Gong: no Node/Playwright → Chrome MCP executor; verify-by-effect modelled unless a live click is safe; portals timing/toggle-sensitive (one-tick capture).
- Shared browser: two sessions → drive a distinct tab; coordinate so the user's clicks and the chip's injection don't collide.

---

# 15. Analyzer 2.0 alignment — updated approach + test design (K36)

Source: Testsigma production docs `Analyzer_NO_SUCH_ELEMENT_Resolution_Flow_v0.3.pdf` + `analyzer_root_cause_field_spec.pdf`.

- **K36** [production convergence — ENHANCES, does NOT diverge] The production Analyzer 2.0 NSE flow independently converges with our lab thesis (diagnosis-first, evidence-based, never-default, asymmetric-cost, tiered autonomy, semantic-gate). Routing spine: **Q1 page-identity → Q2 element-presence → Q3 earlier-divergence.** It **solves 3 of our gaps**: TEMPORAL via **network-logs**; FLOW_CHANGE-vs-PREREQUISITE via **per-prior-step fingerprint walk** (fixes R3); a **page-identity front gate** (the Step-0 idea). We **contribute** what it lacks: the Q2 disambiguation levers (= their "tighten by neighborhood"), an **explicit false-heal=0 metric**, and **actionability in the validation gate** (answers their OQ-2: gate must re-attempt the action, not just confirm identity). **Cautions (refinements, not divergence):** VLM is on the critical path of 42% of failures → keep it **gated + cached** (deterministic-first); **reinforce the Element Registry only on VERIFIED outcomes** (OV#4 contamination guard). Their **OQ-3 labeled tables (Q1/Q2/Q3 a–e) = a ready-made validation set.**

## 15.1 Updated approach (map, don't rebuild)
Reorganize top-level control flow to mirror the Analyzer; plug our components in; core stays pristine:
```
THROW → normalize + evidence bundle
 → Q1 same page?  [NEW: page-fingerprint gate (URL-template+title+a11y-hash+landmarks+auth); network-log still-loading→Timeout; VLM tie-break only]
     SAME    → Q2 element here?  [OURS: matchStep → disambiguateByContext (context/ordinal/search-and-pick) → WEB.actionable]
                 → Locator-Changed (T0/T1) · Element-Not-Found (T2) · Not-Interactable
     DIVERGED→ Q3 earlier drift?  [NEW: per-prior-step fingerprint walk]
                 → Flow-Change (T2) · Prerequisite (T1)
 → tier (T0 auto / T1 confirm / T2 advisory / T3 escalate) → validation gate (identity + ACTIONABILITY) → commit + analyzer_root_cause + failure-card
```
Reuse: `matchStep`, `disambiguateByContext`, `WEB.actionable`, `diagnoseFailure`, `failure-reporter`. Net-new: Q1 fingerprint module · Q3 walk · network-log signal · tier router · `analyzer_root_cause` output. Vocabulary to adopt: **T0–T3**, **Q1/Q2/Q3**, **analyzer_root_cause enum** (Locator-Changed / Element-Not-Found / Flow-Change / Prerequisite / Timeout / UNIDENTIFIED).

## 15.2 How to test it (the chip's job)
1. Build the **OQ-3 labeled set (~15 cases: Q1-a..e, Q2-a..e, Q3-a..e)** as hermetic fixtures (recorded baseline + drifted runtime + expected verdict) — extend `adversarial-validation.html`. Assert **verdict == label AND false-heal == 0**.
2. **Property-fuzz** each (restyle/localize/reorder) → invariant: correct-verdict-or-escalate, never false-heal.
3. **Live SPA check** (Gong/Amplitude via Chrome MCP): capture real page fingerprints + network signals → test Q1/still-loading against **SPA noise** (the one place their fingerprint approach is unproven).
4. Emit each case as an **`analyzer_root_cause`** value → the measured funnel.
- **Pass bar:** labeled set resolves to the right verdict; false-heal 0; Q1 survives real-SPA noise. Core 14/14 + adversarial suite green.

---

# 16. Execution-time Lifecycle + Validation-Agent specs — alignment (K37)

Source: production `Execution_Time_Locator_Lifecycle_Spec.pdf` + `Element_Detail_Validation_Agent_Spec.pdf`.

- **K37** [production locator system — STRONGLY ENHANCES, does NOT diverge] These define the runtime substrate our heal logic lives inside; they confirm our hardest principles (notably: the legacy attribute-rebuild was deprecated for **~90% false positives** — our false-heal-0 thesis, with a production number; Gen-AI heals were never persisted due to **~3% FP** until validated). Architecture order: **Analyzer Gateway (diagnose Q1/Q2/Q3) → Lifecycle auto-heal (pool + page-state)** — our lab spans both. Key model shifts to adopt: heal = a **locator POOL with lifecycle** (not single-best); ordering by **execution-history (passed→untested→failed) + quality tiebreak, NOT rank**; **top-three-agree consensus gate** (find-only, 3 candidates must resolve to same element before acting); **per-source cap 5/25** for diversity; **page-state-aware heal 7a/7b/7c** (= Analyzer Q1 = our diagnosis, triangulated); conservative learning (`consecutive_pass≥3`→auto-promote, `was_primary` freezes flip-floppers, persist only validated). Validation-agent (UI/HITL) and auto-heal-agent (autonomous) = **one capability split by intervention mode** — our `hitl-overlay` is the validation-agent. **Sharpened scope:** deterministic matching = disambiguate/validate FOUND candidates; **never re-anchor a LOST element** (→ visual/agent).

## 16.1 Updated approach (composes with §15 Analyzer)
```
THROW → Analyzer Gateway [Q1/Q2/Q3 diagnose] → if heal-eligible →
  Lifecycle pool-heal:
   entry: auto-healed → primary-retry → pool (≤25; ≤5/source; passed→untested→failed + Good→Weak→Fragile)
   GATE: top-three-agree (find-only) + actionability → first validated acts
   whole-pool-fail → page-state 7a precondition / 7b regenerate-on-new-DOM / 7c visual-reanchor (never blind-rebuild)
   write-back: counts, consecutive_pass≥3→auto-promote, was_primary freeze, source tag, persist VALIDATED only
```
Our pieces map in: `disambiguateByContext`/ordinal = "tighten pool to one"; `WEB.actionable` = part of the gate; false-heal=0 governs all. Net-new vs §15: pool model + top-three-agree gate + per-source cap + promotion/demotion state + the page-state heal router (7a/b/c).

## 16.2 How to test (extends the §15.2 analyzer harness)
- **Pool ordering**: fixture pool (varied history/quality) → assert auto-healed→primary→pool sequence; passed→untested→failed; quality tiebreak; rank ignored.
- **Top-three-agree gate**: agree→act, disagree→abstain; **false-heal=0 on disagreement**.
- **Page-state 7a/7b/7c**: reuse Analyzer Q1 fixtures → correct branch; 7a no-new-locator; 7c→visual route; never blind-rebuild a lost element.
- **Promotion/demotion**: `consecutive_pass≥3`→auto-replace; failure resets streak; `was_primary` freezes a flip-flopper.
- **Per-source cap 5/25** diversity; **sink-and-skip + counter-driven deletion** (never on one failure).
- **Invariants**: never act without top-three-agreement; never deterministically re-anchor a lost element; false-heal=0 throughout. Core 14/14 + suites green.

## 16.3 Open items they flag (we share)
Their O6 (DOM-query mechanism) gates page-state classification; counter-reset policy; the promote state-machine reconciling "healed becomes working DB row" vs "backup 3-pass replaces primary" — must not conflict (same care we apply).

---

# 15. Amplitude E2E v2 — DONE (K36)  `measured · live · 2026-06-25` · `self-heal/docs/AMPLITUDE-E2E-RUN.md`

- **K36 [BUILT + PROVEN LIVE]** Full loop ran on real Amplitude chart-builder: **40 auto-generated +
  stratified cases × 6 regimes = 240 cells, false-heal = 0/240** (pre-registered ceiling held). Core
  PRISTINE (`git diff` empty); suites **14/14 web + 4/4 mobile + 22/22 adversarial** green after.
  New tools-layer artifacts: `amplitude-e2e-runner.js`, `amplitude-e2e-harness.html`, `amplitude-stash.js`,
  `hitl-overlay.js`, `hitl-live-demo.js`. All 6 Gong lessons baked in (content-settle 2 polls,
  viewport-scope 142 tagged, recordability per-view, flag-driven HITL, capture-settle, HITL unlock).
- **K36a [heal reach > Gong, structural reason]** testid is an ATTRIBUTE → **survives `localize`** →
  every testid'd case heals through text-reversal (the regime that zeroed Gong's heals). 19 localize
  heals vs Gong's 0. recordability **63% closed / 48% portal-open** (per-view, K29 confirmed).
- **K36b [search-and-pick works, modelled]** role-less Events portal (K32: 0 `role=option`) + search
  input → search-and-pick collapsed **n₀87→n₁1** on all 6 portal cases; localize → no collapse → safe
  abstain. Live execution = P2 runtime; collapse + detector exercised here (`ranLive:false`).
- **K36c [property-based fuzzing — Antithesis]** 5 seeded mutators (restyle/localize/attr-shuffle/
  **reorder**/add-remove-twin). `reorder`/`add-remove-twin` adversarially test the ordinal lever (K34);
  byte-identical twins scored **outcome-equivalent** (any sibling = correct) — the one place "correct-heal"
  ≠ exact node, flagged. Guard boundary proven (TWI5 abstains under localize/count-change).
- **K36d [HITL — the "which control?" fix]** Cards on the harness page are unanchorable (window.name nav
  leaves the app). Fix shipped (`hitl-live-demo.js`): render cards **in the live app tab + highlight the
  real element** (outline+scrollIntoView+label). User drove both card types live (record: 12 decisions;
  execute: AMBIGUITY + candidate list on "+ Filter by" twins). Decisions → `window.__hitl.log` = ground truth.
- **K36e [pre-registration honesty]** naive pre-reg diverged 47/240 → corrected predictor (testid-survives-
  localize · search-and-pick-fails-safe-on-localize · twins-outcome-equivalent) → **19/240, all SAFE**
  (over-conservative or uniquely-identifiable-nameless heals; never a false-heal). Outcomes never changed
  (deterministic); only the predictor was refined.
- **Honest bound (unchanged from Gong):** synthetic + round-trip drift only → MECHANISM, not a natural
  heal-rate. Gate layout-free, verify modelled → live execution gated on P2 runtime (`selfheal-runtime.js`).
