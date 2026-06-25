# Phase 1 — granular task plan, tests & before/after metrics

**Goal:** implement the spec §9 recorded-step pipeline as real, tested code:
`capture → scope-to-visible → reveal → match → actionability gate → verify-by-effect → abstain/diagnose`.

**Ground rules (carry Phase 0/0.5 honesty):**
- Every step ships with (a) a test that *runs and passes* and (b) a **before/after metric** on a fixed fixture corpus.
- Thresholds stay a-priori (`.62 / .12 margin / .45`) — calibration is Phase 2, so numbers stay comparable.
- **false-heal is the metric that matters.** No step is "done" if it raises false-heal.
- Mark every number **measured** (hermetic test) or **live** (run against a real site/gist, reproducible-ish).

**Run model (no Node in this env):** tests run in-browser. Layout-dependent logic (visibility/overlap/hit-test) runs against fixtures injected into a live `document`; pure logic runs against `DOMParser` docs. `selfheal-tests.html` is the openable report; `selfheal-tests.js` is the runnable source verified this session via Chrome injection.

Legend: ◑ built (no dedicated test yet) · ✅ built + tested + measured.

**STATUS (2026-06-22): 18/18 tests green (14 web + 4 mobile). All before/after metrics improved or held. One item partial (T3.2 container scope).** Run: `python3 -m http.server` then open `selfheal-tests.html` (or see the Results table below).

---

## E0 — Test & metrics harness (infrastructure)
- **T0.1** ✅ `selfheal-tests.js`: tiny assert/group runner; `runAll()` returns `{passed, failed, cases[], metrics{}}`. `selfheal-tests.html` loads `selfheal-core.js` + tests and renders green/red + metric tables.
  - *AC:* `runAll()` returns a structured result; HTML shows per-case pass/fail and every before/after table.
- **T0.2** ✅ Fixture corpus.
  - Synthetic (precise, hermetic): `DUP_HIDDEN` (visible + display:none twins), `OVERLAY` (button under a fixed cookie banner), `OFFSCREEN` (finite box off-viewport), `WRONG_HEAL` (act with no resulting effect), `LOCALIZE_PAIR` (anchored + name-only, text reversible), `SUBSTRING_TRAP` (the `vscode`/reversed-`Docs`=`scoD` repro).
  - Real (live): iOS XCUITest gist (Gap 3), live `github.com` header (Gap 1-style mini-corpus).
  - *AC:* each fixture parses; real fixtures fetch/observe at run time.

## E1 — Capture (the §9 step writer)
- **T1.1** ✅ `captureStep(el, doc)` emits the full §9 object (descriptor+stability, action, value, target, scope, reveal, framePath, actionability, verify, flag).
  - *AC:* every required §9 key present; descriptor carries per-signal stability; `flag` ∈ {null, weak-identity, no-anchor, ambiguous}.
  - *Test:* `capture-schema`, `capture-flag`. *Metric:* **schema-field coverage %** (before: n/a → after: 100% of §9 keys) and **flag correctness** on anchored vs no-anchor fixtures.
- **T1.2** ✅ `bestLocator` + `uniqueAtRecord` + `confidence`.
  - *AC:* picks strongest available (testid > stable-id > id-fragment > unique role+name); `uniqueAtRecord` reflects DOM uniqueness; `confidence = round(predicted(desc)*100)`.
  - *Test:* `bestlocator-pick`. *Metric:* locator-strength distribution over a fixture (count by anchor tier).

## E2 — Hardened fuzzy (Gap-1 fix)
- **T2.1** ✅ Substring boost gated on pre-existing token overlap (shipped in `selfheal-core.fuzzy`).
  - *AC:* `fuzzy('scoD','vscode') === 0` (was 0.85); `fuzzy('Sign in','Sign in to GitHub') > 0` preserved.
  - *Test:* `fuzzy-unit`, `substring-trap`. *Metric (before/after):* on `LOCALIZE_PAIR`+`SUBSTRING_TRAP` and **live github.com** — **false-heal** and **correct-heal** with orig vs hardened fuzzy.

## E3 — scope.visibleOnly (duplicate fix)
- **T3.1** ✅ `resolveScope` filters candidates to the interactable instance (offsetParent/in-viewport + enabled) before matching.
  - *AC:* the `display:none` twin is excluded; the visible twin heals.
  - *Test:* `scope-dup`. *Metric (before/after):* verdict on `DUP_HIDDEN` — before (abstain, margin≈0) → after (correct-heal); **false-heal stays 0**.
- **T3.2** ◑ Optional `container` (Clue-2) narrowing as fallback when >1 visible twin. **Built** (`resolveScope` honours `opts.container`) but **no dedicated test/metric this round** — real both-visible duplicates need a richer fixture set; deferred to the next pass.
  - *AC:* narrows to the named region; outside-region twins dropped.

## E4 — Actionability gate (found ≠ usable)
- **T4.1** ✅ Web gate: visible + finite box + topmost-at-point (hit-test).
  - *AC:* `OVERLAY` and `OFFSCREEN` are blocked though identity matches.
  - *Test:* `gate-overlay`, `gate-offscreen`. *Metric (before/after):* **% found-but-unusable correctly blocked** (before 0 → after 100).
- **T4.2** ✅ Mobile gate: enabled + visible + finite box (iOS).
  - *AC:* `visible="false"` element blocked; visible button passes.
  - *Test:* `gate-ios`. *Metric:* blocked-correctly on the real iOS tree.

## E5 — verify-by-effect
- **T5.1** ✅ `verifyEffect(before, after, expect)` for `urlChange | domChange | textPresent | elementGone`.
  - *AC:* passes when the declared effect occurs; fails (→ roll back to abstain) when it doesn't.
  - *Test:* `verify-pass`, `verify-catch`. *Metric (before/after):* **wrong-heal caught %** on `WRONG_HEAL` (before 0 → after 100).

## E6 — abstain / diagnose taxonomy
- **T6.1** ✅ `diagnose()` returns a named state: `not-ready | blocked-by-overlay | ambiguous | no-identity | env-fault` — never silent.
  - *AC:* each fixture maps to the right state.
  - *Test:* `diagnose-cases`. *Metric (before/after):* **% of non-heals carrying a specific (non-generic) reason** (before 0 → after 100).

## E7 — Corpus integration metrics (live, reproducible-ish)
- **T7.1** ✅ Live heal-rate before/after on `github.com` (orig vs hardened fuzzy) — reproduce Gap-1.
- **T7.2** ✅ iOS adapter on the real gist — reproduce Gap-3 A/B/C.

---

## Results table (measured 2026-06-22; 18/18 tests green)
| step | test(s) | metric | before | after | note |
|---|---|---|---|---|---|
| E1 capture | capture-schema · bestlocator-pick | §9 schema coverage | 0% | **100%** | measured |
| E1 capture | capture-flag | flag correctness | 0% | **100%** | measured |
| E2 fuzzy | substring-trap | false-heal on trap | 1 | **0** | measured (hermetic) |
| E2 fuzzy | margin-recovery | correct-heal recovered | 0 | **1** | measured (restyle-type drift) |
| E2 fuzzy | **LIVE** github.com 8-seed sweep (N=120) | total false-heals | **9 (in 6/8 samples)** | **0 (0/8)** | live; correct-heal 61→61 (no loss) |
| E3 scope | scope-dup | heal on visible+hidden twin | abstain (0) | **heal (1)** | measured; false-heal stays 0 |
| E4 gate (web) | gate-overlay · gate-offscreen | found-but-unusable blocked | 0% | **100%** | measured |
| E4 gate (mobile) | M.gate | identified-but-invisible blocked | 0% | **100%** | measured (real iOS tree) |
| E5 verify | verify-pass · verify-catch | wrong-heal caught | 0 | **1** | logic only (modeled state) |
| E6 diagnose | diagnose-cases | non-heals with a named reason | 0% | **100%** | measured |
| E7.2 mobile | M.A / M.B / M.C | heal via accessibilityId after localize | n/a | **A 3/3 · B 3/3 · C abstain (0 false-heal)** | real iOS tree, synthetic drift |

**Suite:** 14 web + 4 mobile = **18 passing**. The harness caught **3 real bugs in my own code** mid-build (wrong `no-anchor` expectation, off-screen mislabelled as overlay, `{v,b}` vs `{v,best}` destructure) — evidence the tests bite.

## Honest dev take
**What I'd stand behind:**
- The deterministic core is sound and the **safety property holds** (false-heal 0 across every test after the fuzzy fix). The fuzzy fix is the strongest result: validated 3 ways (hermetic trigger, an 8-seed live sweep showing the bug is *common* — 6/8 samples — not a fluke, and zero heal-rate cost), from a 1-line principled change.
- capture (§9 writer), the actionability gate, scope-to-visible, and the diagnose taxonomy all do what they claim and are cheap, low-risk wins. Cross-platform is real: the **same** scoring core drives web and mobile.

**What these green checks do NOT prove (the part to be honest about):**
1. **Mechanisms, not field behaviour.** Tests run on synthetic/small fixtures + one real iOS tree under *synthetic* drift. The only natural drift measured remains Gap 2 (manual, n=11). Green ≠ "heals a high fraction of real breakages."
2. **`verify-by-effect` is logic-only** — tested on *modelled* before/after state objects, not a real act→observe round-trip. The end-to-end (perform action, snapshot DOM/URL, compare) needs a live driver and is **not** built.
3. **`reveal` / `framePath` (portaled menus, iframes) are schema-only** — no runtime implementation or test. They need live interaction; honestly deferred.
4. **scope-visible only handles `display:none` twins.** Real duplicates (both visible, `aria-hidden`, `inert`, off-viewport) are messier; **T3.2 container scope is built but untested**.
5. **Not CI-ready.** No Node here; tests run in a real browser via a static server. The hit-test gate needs a real layout engine (jsdom won't do `elementFromPoint`), so CI needs Playwright/Puppeteer — a follow-up.
6. **Thresholds still uncalibrated**, and the **structural flag stands**: name-only controls (the ~76% majority) clear the heal floor on role+tag alone (0.737 > 0.62), so margin is the sole guard. The fuzzy fix removed one symptom; the root calibration is untouched (Phase 2).
7. **iOS `accessibilityId` is inferred heuristically** (identifier-shape); a real Appium client reads it explicitly. **No Android UIAutomator run** (mapping claimed identical, unproven).

**The honest bottom line:** the engine is correct and safe, and the high-value/low-risk pipeline pieces are built and measured. But real-world heal *rate* is still bounded by things outside this code — **test-id/accessibilityId coverage upstream** (the dominant lever), **duplicate disambiguation when both copies are visible** (Clue-2, unbuilt), **full name-drift** (Clue-3 visual/AI, unbuilt), and **runtime integration** (reveal, real verify-by-effect, a live actionability driver) that can't be unit-tested without a browser/device harness. Next highest-leverage step is **not** more matcher work — it's a Playwright-backed harness that runs the labeled corpus end-to-end (real act→verify) so heal *rate* (not just safety) becomes measurable.
