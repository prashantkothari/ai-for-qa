# ARCHITECTURE.md — the autonomous self-heal loop + OSS pattern map

Tech-architecture reference for the self-heal system. Two parts: **(1)** the ideal end-to-end loop
(study → locate → record → intent → execute → diagnose → heal → learn), **(2)** which OSS tools/patterns
to borrow for each stage. Design stance (§4): **borrow patterns/gists, adopt tools only where
reimplementing is wasteful** — aim a *basic good flow at ~80%*, route the hard 20% to LLM/HITL.

---

## 1. The ideal autonomous loop

```mermaid
flowchart LR
  STUDY["1 · STUDY<br/>autonomously explore flows<br/>(enumerate controls)"] --> LOCATE
  LOCATE["2 · LOCATE<br/>candidates + 11-signal descriptor"] --> RECORD
  RECORD["3 · RECORD<br/>captureStep + captureContext + flag"] --> INTENT
  INTENT["4 · INTENT<br/>author/AI one-line 'why'"] --> EXECUTE
  EXECUTE["5 · EXECUTE<br/>act via driver · search-and-pick"] --> DIAGNOSE
  DIAGNOSE["6 · DIAGNOSE<br/>why it failed (7-category)"] --> HEAL
  HEAL["7 · HEAL<br/>context / ordinal / widener + gate"] --> VERIFY
  VERIFY["verify-by-effect<br/>(3-way outcome)"] --> LEARN
  LEARN["8 · LEARN<br/>verified outcomes · cross-tenant"] -.feeds.-> STUDY
  RECORD -. "weak / ambiguous flag" .-> HITL{{"HITL popup"}}
  HEAL -. "abstain · 1st-heal · unverified" .-> HITL
  DIAGNOSE -. "residue: nameless / flow-change / visual" .-> LLM[["LLM / vision gate"]]
  HITL -. "author decision = ground truth" .-> LEARN
  LLM -. "caption / pick" .-> HEAL
```

### Stage → our component → status → OSS pattern borrowed

| # | Stage | What it does | Our component (file) | Status | OSS pattern (borrow) |
|---|---|---|---|---|---|
| 1 | **STUDY** | autonomously walk the app, enumerate every visible+revealed control | `tools/app-observer.js` | ✅ built | **Swarm (useswarm.co) / Propolis** — AI-persona flow-exploration (pattern, not dep) |
| 2 | **LOCATE** | extract 11 signals, score candidates, rank | `selfheal-core.js` (`WEB.extract`, `scoreEx`, `rank`) | ✅ proven | **Momentic** intent + multi-layer fallback (pattern); **axe-core** a11y-signal logic (gist) |
| 3 | **RECORD** | write a recorded step: descriptor + container context + fragility flag | `captureStep`, `captureContext` | ✅ built | **OpenTest** declarative YAML keyword step format (gist); **Momentic `explore`** auto-gen cases (pattern) |
| 4 | **INTENT** | capture author's one-line "why" (survives full redesign) | — (Clue-3, deferred) | ◻ P2/P3 | **Momentic** intent-based; **Vision-LLM** caption for nameless icons |
| 5 | **EXECUTE** | perform the action; for role-less menus → search-and-pick | `selfheal-runtime.js` (P2); search-and-pick (K33) | ◻ P2 (needs runtime) | **Playwright** — ADOPT wholesale (auto-wait + locators); Selenium/Appium baseline (OpenTest) |
| 6 | **DIAGNOSE** | name *why* a step failed: DRIFT/REMOVAL/AMBIGUITY/STATE/TEMPORAL/FLOW_CHANGE/UNKNOWN | `change-diagnosis.js`, core `diagnose` | ✅ built | **Antithesis** fault-classification mindset (gist) |
| 7 | **HEAL** | break ties deterministically: row-text → ordinal → widener; gate; else abstain | `candidate-generation.js` (`disambiguateByContext` etc.) | ✅ proven (K19/K26/K34) | **Momentic** confidence-logged heal-suggestion (→ our HITL) |
| — | **VERIFY** | confirm the declared effect happened (3-way: pass / fail / unverified→human) | `outcome-verification.js`, core `verifyEffect` | ◑ modelled (live = P2) | **Antithesis** reproducible replay (gist) |
| 8 | **LEARN** | only from HIGH-confidence verified outcomes; cross-tenant aggregation | `learning-loop.js` (P2/P3 stub) | ◻ P2/P3 | **Momentic** feedback loop; cross-tenant moat (I27) |
| ⟂ | **HITL** | record-time anchor-strengthening + execute-time adjudication | `tools/hitl-overlay.js` (v2) | ◻ building | the heal-rate unlock (K35) |
| ⟂ | **LLM/vision gate** | the deterministic residue: nameless icons, flow-change, full visual redesign | — | ◻ P3 | hosted Vision-LLM (adopt API, don't train) |

---

## 2. OSS / competitor map — what each is good for

| Tool | What it is | Borrow for | Borrow GIST or ADOPT TOOL? |
|---|---|---|---|
| **Momentic** ([self-heal guide](https://momentic.ai/blog/self-healing-test-automation-guide)) | AI low-code E2E; intent locating, multi-layer fallback, ML self-heal w/ confidence + suggest-fix, `explore` auto-test-gen | LOCATE, RECORD (auto-gen), HEAL (suggest=HITL) | **gist** — we stay deterministic/explainable, not ML-black-box |
| **Antithesis** ([antithesis.com](https://antithesis.com/)) | deterministic simulation, property-based testing, fault-injection, reproducible replay | EXECUTE/LEARN — property-based drift fuzzing; determinism as core value | **gist** — they do backend/system chaos; we do UI resilience (complementary) |
| **OpenTest** ([getopentest.org](https://getopentest.org/)) | OSS keyword-driven (YAML) on Selenium/Appium; embed JS | RECORD — readable declarative step format; EXECUTE baseline | **gist** (format) + the Selenium/Appium driver if not Playwright |
| **Swarm** ([useswarm.co](https://www.useswarm.co/)) | AI-**persona** UX testing — runs personas through your product, surfaces friction/drop-offs + actionable code-fixes; browser/CLI/**MCP-server**, pushes to Jira/Linear/GitHub | STUDY (persona flow-exploration); HEAL output (actionable-fix = our HITL card) | **gist** — a UX *auditor* (distinct from our locator-resilience, cf. testers.ai K22); borrow the persona-explore + MCP-delivery + actionable-fix pattern |
| **Propolis** ([producthunt](https://www.producthunt.com/products/propolis)) | AI swarms that explore all product flows like real users, adapt to changes | STUDY — autonomous explore-all-flows | **gist** — = our Phase-A auto-test-gen |
| **Swarms.ai / OpenAI Swarm** ([github](https://github.com/openai/swarm)) | multi-agent orchestration frameworks | STUDY orchestration — fan-out explorer agents | **gist** — we already orchestrate via chips/workflows |
| **Playwright** | modern browser driver: auto-wait, locators, trace | EXECUTE runtime | **ADOPT wholesale** (P2) — reimplementing a driver is wasteful |
| **axe-core** | accessibility engine | LOCATE — accessible-name/role logic | **gist** (logic, ~50 LOC) not the dep |
| **Vision-LLM** (Claude/GPT-V) | image→intent | INTENT, residue HEAL | **adopt hosted API** — don't train |

---

## 3. Recommended stack (the 80/20)

- **Build-local (deterministic, our value-add — keep as ~gists):** descriptor extraction, scoring/matching, diagnosis taxonomy, disambiguation (context/ordinal/widener), search-and-pick, HITL overlay, property-based drift fuzzing. *Why: these are small, must be deterministic + explainable + false-heal-0; generic libs would re-introduce bugs (e.g., the substring-fuzzy false-heal).* 
- **Adopt wholesale (where reimplementing is wasteful):** **Playwright** as the EXECUTE runtime (auto-wait, locators, trace) — the one big dep worth taking; **hosted Vision-LLM** for the INTENT + residue gate.
- **Borrow the format/pattern (no dep):** OpenTest's declarative YAML step format; Momentic's auto-test-gen-by-exploration; Antithesis's property-based + reproducible-replay discipline; Swarms/Propolis's fan-out explorer pattern.

**Target:** a basic good flow at **~80%** — deterministic heal on the structured/anchored majority, **0 false-heals**, and the hard 20% (nameless icons, flow-change, full visual redesign) **routed to LLM/HITL, never force-healed**. Matches the project ethos: *a true 66–80% beats a fabricated 95%.*

---

## 4. Honest stance — "patterns/gists, not whole libraries"

**Agreed, with one split.** Most of this system's value is *deterministic, explainable matching + diagnosis*, which is exactly what you should NOT outsource to a heavy/opaque lib — borrow the **gist** (the algorithm), keep it small and ours. But two things are wasteful to reimplement and should be **adopted wholesale**: a **browser driver** (Playwright — auto-wait/locators/trace are years of work) and a **vision LLM** (hosted API). Everything else = patterns. This keeps the dependency surface tiny, the behavior deterministic/auditable, and the false-heal gate intact — while not wasting effort rebuilding a driver or a vision model. The 80% flow is reachable with the gists we already have + Playwright for execution + an LLM gate for the residue.
