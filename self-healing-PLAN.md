# Self-healing element identification — grounded plan & honest status

**Purpose:** a reviewable, non-fabricated plan. Separates what is *measured* from what is *assumed*, and defines how to prove the approach on real apps before building anything heavy.

---

## 0. Terminology (settle it)
- **Element identification** — the goal: find the intended element at replay after the UI changed.
- **Descriptor** — the artifact: the bundle of signals captured at record time. ("Fingerprint" = informal synonym. Use *descriptor*.)
- **Matcher** — scores live candidates against the descriptor; returns heal / abstain / fail.
- **Agent loop** — gate (page ready? blocked?) → match → verify-by-effect → learn.

The product = descriptor + matcher + agent loop.

---

## 1. Honest status (what is real vs simulated)

**Real (measured on real inputs)**
- Real markup capture: GitHub (curl), Testsigma TMS (live Chrome).
- Matcher + verdicts exist as working code; logic cross-checked in Python.
- Live findings on TMS: 0 test-ids on CTAs; Radix dynamic ids with stable suffix (`*-trigger-TEST_CASE`); accessible names polluted by icon ligatures + count badges.
- Failure taxonomy from the 1,000-failure iOS swipe report: only ~66% is find-layer; rest is infra/timing/engine — out of scope for any locator.

**Prototype (real code, NOT validated at scale)**
- Stability ratings (heuristic defaults) + a simple learning rule.
- "Predicted robustness" formula (durability-weighted) — uncalibrated.
- Heal/abstain/fail thresholds (0.62 / 0.12 margin / 0.45).

**Simulated / never run (do NOT cite as results)**
- All heal percentages (90/97/100) — from author-defined mutations or hand-built trees, not field drift.
- Visual / pHash signal — never computed.
- Record-time AI intent — never generated.
- "Accuracy rises over time" — mechanic shown, never measured on a corpus.

**Now demonstrated at the markup level (Phase 0.5, Appendix C — measured, not argued)**
- **Cross-platform web+mobile** — the same descriptor + matcher ran on a real Appium iOS XCUITest tree (accessibilityId = the mobile test-id); the motivating localization-with-stable-id heal works on mobile. Still: no live device, synthetic drift, iOS-only, n small.
- **Honest random-sample heal-rate** and **human-labelled cross-version heal-rate** now exist (and are much lower than the prior top-N demos — see Appendix C). The **false-heal≈0** safety property held everywhere except 2 substring-fuzzy artifacts, now fixed.

**Reviewer rule:** treat every % in prior demos as *plausible, unproven* until reproduced on the labeled corpus below.

---

## 2. What we build (scoped)

**MVP — deterministic core (no AI, no ML):**
1. **Capture** a descriptor from the accessibility tree + DOM:
   - role, accessible name (cleaned: strip icon fonts / aria-hidden / count badges),
   - form-field name, type, autocomplete, in-form + form action,
   - **stable id fragment** (detect dynamic prefixes: `radix-`, `_r_…_`, `:r…:`, long hex; keep the meaningful suffix),
   - test-id if present (strongest signal),
   - per-signal stability rating.
2. **Match**: weighted-consensus scorer + thresholds → heal / abstain / fail.
3. **Actionability gate**: visible, on-screen, hittable, not covered (hit-test) — "found ≠ usable."
4. **Heal + verify-by-effect**: act, confirm the expected effect happened, persist the new locator, log the outcome.
5. **Abstain/diagnose**: name the state (not-ready / blocked-by-overlay / ambiguous / no-identity / env-fault) — never silent-fail.

**Deferred (only after the core clears its bar):**
- P1: visual/pHash signal; record-time AI intent; calibrate stability from real outcomes.
- P2: Clue 2 context graph (neighbours/landmarks) for repeated/ambiguous elements; mobile (Appium page-source → descriptor adapter); cross-platform unification.

---

## 3. How we prove it (the part that kills fabrication)

### 3.1 Corpus (Phase 0)
Capture rendered-DOM snapshots from a diverse set:
- e-commerce (Amazon), travel (IRCTC/MMT), gov, a SaaS app (TMS), a content site.
- frameworks: React, Angular, Vue, web components / shadow DOM.
- include multi-locale, responsive, logged-in/out variants.

Capture via the bookmarklet / DevTools "Copy outerHTML" (rendered DOM, NOT view-source).

### 3.2 Two kinds of change — need both
- **Synthetic** (Chrome inspect / scripted DOM edits): restyle, relocate, relabel, restructure, drop id, add duplicate, virtualize. Fast iteration. *Weakness: self-authored → partly circular.*
- **Natural drift** (the real proof): the SAME app at two genuine points —
  - multi-locale (amazon.com vs amazon.de; IRCTC Hindi vs English),
  - cross-version (Wayback Machine before/after a redesign),
  - responsive (desktop vs mobile width),
  - A/B / logged-in vs out.

Validate headline claims on **natural drift**, not synthetic.

### 3.3 Metrics (define targets BEFORE testing)
On a **labeled** set (where the true element is known):
- **correct-heal rate** — healed to the right element.
- **false-heal rate** — healed to the WRONG element. *The metric that matters. Target ≈ 0.*
- **abstain rate** — declined when unsure (good, not a failure).
- **silent-fail rate** — acted/passed wrongly with no flag. *Must be 0.*
- **calibration** — when confidence says X%, correctness ≈ X%.

Proposed initial bar (adjust on review): on restyle + localize natural drift, ≥ 80% correct-heal, **< 1% false-heal**, remainder abstains.

### 3.4 Calibrate
Tune stability weights + thresholds against the labeled outcomes to push correct-heal up while holding false-heal near zero. Plot the calibration curve.

---

## 4. Phased plan
- **Phase 0 — Corpus & harness** (this is where real grounding starts): collect snapshots; build the labeled before/after pairs; wire the workbench to batch-score and report the metrics above.
- **Phase 1 — Deterministic core**: capture (with fragment-id + clean-name fixes), match, gate, abstain. Measure on synthetic, then natural drift.
- **Phase 2 — Calibrate + verify-by-effect**: tune to the metrics; add outcome logging; learning rule validated on real drift.
- **Phase 3 (only if core passes)**: visual signal, AI intent, mobile adapter, context graph.

---

## 5. Honesty rules for this project
1. No percentage is reported without a labeled test set behind it.
2. Always report **false-heal rate**, not just heal rate.
3. Mark every result **measured** or **simulated**.
4. Synthetic mutations are for iteration; **natural drift** is for claims.
5. If the deterministic core can't hit near-zero false-heal on real drift, do **not** add AI to mask it — fix the core or narrow the scope.

---

## 6. Open questions / what we still don't know
- Real correct-heal and false-heal rates on natural drift — **unknown** (never measured).
- Whether stability weights generalize across apps/frameworks, or must be per-app.
- How much the visual/AI lane actually rescues vs adds noise — **unmeasured**.
- Mobile (Appium tree) parity — **untested**.
- Performance/latency budget at replay — **unscoped**.

---

## Appendix A — Phase 0 first MEASURED results (2026-06-19)

Method: captured descriptors from the **live** DOM of real SaaS apps (logged-in, via Chrome), cloned the page, applied a synthetic redesign to the clone, re-ran the matcher against ground-truth-marked targets. **Synthetic mutation on real markup** — not yet natural drift.

Two redesigns tested: (1) **restyle+structure** = regenerate ALL classes + churn dynamic id prefixes (keep suffix) + wrap/restructure (text kept); (2) **localization** = the same PLUS reverse every text/label (kills the name signal, keeps test-ids).

| App (framework) | controls | test-id % | stable-id % | good-name % | restyle: heal / abstain / **false-heal** | localize: heal / abstain / **false-heal** |
|---|---|---|---|---|---|---|
| Amplitude (React) | 32 | 9% | 13% | 100% | 12 / 0 / **0** | 4 / 8 / **0** |
| Keka (Angular) | 39 | 0% | 5% | 92% | 5 / 7 / **0** | 1 / 11 / **0** |
| Testsigma TMS (Next.js) | 41 | 0% on CTAs | tabs only (Radix suffix) | names icon-polluted | (profiled, not mutation-tested) | — |

**Totals across the two mutation-tested apps (48 heal decisions):** 22 correct-heal · 26 abstain · **0 false-heal** · **0 silent-fail**.

### What is proven (measured)
- **False-heal rate = 0 / 48.** The system never clicked the wrong element — it degraded to *abstain* (incl. on the 3 duplicate "Add Response" buttons in Keka). This is the core safety property.
- **Silent-fail = 0.** Every non-heal was an explicit abstain.
- **Heal rate is gated by signal hygiene, not by the matcher.** Amplitude's test-id'd controls survived even localization; name-only controls abstained. Keka (0% test-ids) abstained heavily.
- **The margin check works:** Amplitude connectors all scored ~74% under localization but abstained because they were indistinguishable (margin ≈ 0).

### What is NOT proven (honesty)
- **Synthetic, not natural drift.** Localization = text reversal (a harsh, uniform worst case; real i18n shares some tokens → real heal likely higher). Restyle kept text; real redesigns often change both.
- **Targets = top-12 by predicted robustness, not a random sample** → biased toward healable; a random sample would show MORE abstains (lower heal rate). The robust finding is false-heal = 0, not the heal rate.
- Thresholds (.62 / .12 margin / .45) chosen a priori, **uncalibrated**.
- Visual + AI lanes **not tested** — they are the rescue for the abstain residue.

### Natural-drift result — amazon.com (EN) → amazon.de (German), 2026-06-19
Captured 7 nav/chrome descriptors on amazon.com, matched against the live **German** amazon.de DOM (locale `de-de`, 540 candidates). REAL localization, not synthetic.
- **Full descriptor (incl. stable id): 7/7 correct · 0 false-heal.** German text fully changed ("Cart"→"Einkaufswagen", "Returns & Orders"→"Bestellungen", "Search Amazon"→"Amazon.de durchsuchen") yet every element healed — id + role + stable class carried it; the demoted name signal didn't drag it down.
- **Id-suppressed (role + name + class only): 1/7 heal · 6 abstain · 0 false-heal.** With no stable id and the text localized away, only the search box healed (unique role + stable form-field name `field-keywords`); the other six **abstained rather than guess** — the exact 380-failure scenario, handled safely.
- Takeaway: across a real locale change, false-heal stayed 0; heal succeeds when a non-text anchor exists (id / unique role / stable attribute) and abstains when it does not.

### Cross-version drift — today's descriptors → amazon.com **2016** (Wayback), 2026-06-19
Matched today's 7 Amazon descriptors against the live 2016 snapshot (410 candidates) — a real ~9-year redesign. NOTE: ground truth auto-verified only where the id persisted; the id changed for 4/7 elements, so this is a *partial* oracle (rigorous cross-version testing needs human-labelled ground truth).
- **Full descriptor:** 2 confirmed-correct (search, cart — ids survived 9 yrs; cart 99% via id+class), **4 safe-abstain** (account / all-menu / orders / logo — ids changed → declined to guess), 1 unverified-heal (searchGo matched a no-id element — can't auto-confirm). **0 confirmed false-heal.**
- **Id-suppressed (stress variant):** more aggressive — 1 correct, 2 unverified-heals (all-menu → `a-autoid-0-announce` looks like a genuine mis-heal), 4 abstain.
- **Honest lessons:** (1) ids are NOT eternal even at Amazon — 4/7 changed in 9 years; the descriptor's safety came from **abstaining when the anchor changed**, not from healing everything. (2) Cross-version drift is harder than cross-locale. (3) The no-anchor path *can* mis-heal across a big redesign → anchors (id / test-id / stable attr) matter, and abstain thresholds must stay conservative. (4) The id-as-oracle breaks when ids change → need human labels for rigorous cross-version numbers.

**Cumulative across all Phase-0 tests:** the **full descriptor produced 0 confirmed false-heals** (synthetic + locale + cross-version). The id-suppressed stress variant produced ≥1 likely mis-heal across the 9-year redesign — expected, and exactly why anchors + conservative abstain thresholds matter. Heal *rate* tracks anchor availability; the safety property holds for the recommended (full-descriptor) approach.

### Actionable
- **Test-id coverage is the bottleneck, quantified:** Amplitude 9%, Keka 0%, TMS 0% on CTAs. This single upstream fix would convert most localization-abstains into heals.
- The deterministic core clears its most important bar (near-zero false-heal) on real markup across React + Angular.

## Appendix B — Auto-recorder "recordability" scan across live SaaS (2026-06-19)

Framed for the auto-recorder: for every interactive control, compute best locator + uniqueness + afforded action + confidence. Per-screen recordability = % of controls with a *unique* strong anchor (test-id/id/id-fragment) or a *unique* role+name.

| App / screen | controls | recordable % | strong (testid/id, unique) | ambiguous (not unique) | key gotcha (measured) |
|---|---|---|---|---|---|
| **Jira** (Atlaskit) for-you | 55 | **89%** | 29 (mostly test-id) | 5 | duplicate controls — "Create board" ×3, "View all spaces" ×2 |
| **Amplitude** dashboard | 70 | **79%** | 44 | 15 | left nav rendered **twice** (same id ×2, collapsed+expanded) |
| Amplitude connectors (earlier) | — | role+name carries | 9% test-id | — | localized text → abstains (see Appendix A) |
| **Keka** (Angular) | 39 | low | **0% test-id** | many | no anchors → heavy abstain |
| Amplitude **calendar** | 61 day cells | ~0% identifiable | 0 | **every day-number ×2 (two months), zero aria/title/id/testid** → "June 19" not uniquely locatable |
| Amplitude **create menu** | 8 items | role+text only | 0 | `role=option`, no id/aria, **portaled away from trigger**, hover-reveal |

### What the auto-recorder MUST do (requirements this surfaced)
1. **Per-element understanding pass** = best locator + uniqueness + action (type/select/toggle/click/navigate) + confidence. (This scan is that pass.)
2. **Detect & resolve duplicates — the #1 real gotcha.** SaaS apps render controls twice/thrice (Amplitude nav ×2, Jira "Create board" ×3). The recorder must scope to the **visible/interactable** instance at record time (offsetParent/viewport), or it records a locator that hits the wrong (hidden) copy. This is the most common "works-in-record / fails-in-replay" cause.
3. **Capture the reveal path for portaled/nested UI.** Menus, dropdowns, calendar live in portals (no DOM ancestor link to trigger) and are hover/click-revealed → record the open sequence + scope to the open overlay; the target doesn't exist until revealed.
4. **Flag low-identity controls — don't silently record fragile positional locators.** Calendar cells, icon-only buttons, repeated rows have no unique anchor → flag for human/visual fallback, and surface the upstream fix (aria-label / test-id).
5. **Store a multi-signal descriptor + action + value + reveal-path + scope per step** (not one locator) so replay can heal.

### Verdict for auto-recording complex UI
- **Good test-id coverage (Jira 89%, Amplitude dash 79%) → auto-recording highly viable.**
- **Poor coverage (Keka 0%, Amplitude connectors 9%) → leans on role+name → fragile to localization/duplicates → needs human review + upstream test-id push.**
- **The hard 10–20% everywhere = duplicates (scope-to-visible), portaled menus (reveal-path), ambiguous cells (flag/visual).** Solvable, but each needs explicit handling — they will NOT "just work."

## Appendix C — Phase 0.5: closing the three go/no-go gaps (2026-06-19)

All three run **live via Chrome / real captured markup**, scored with the verbatim workbench matcher (now consolidated in `selfheal-core.js`). Reproducible: seeded sampling, fixed thresholds (.62 / .12 margin / .45).

### Gap 1 — Random-sample heal-rate (the honest rate vs the optimistic top-N)
App: live `github.com/microsoft/vscode` (logged-out, fully rendered, 455 interactive candidates). Method: seeded-random sample of *visible* controls (NOT top-N by robustness), clean oracle (`data-oracle` tag = ground truth), two synthetic drifts on the real markup — **restyle+structure** (regenerate all classes, churn dynamic-id prefixes keeping the suffix; text kept) and **localization** (the above + per-word char-reversal of all visible text/labels — kills the name signal, keeps test-ids/ids/form-names).

Random-sample anchor mix (N=120, ~43% of the 281 visible controls): **name-only 76% · no-identity 16% · strong anchor (testid/stable-id/id-fragment) ~8%.** This is the reality the Appendix-A top-12 selection hid.

| matcher | drift | correct-heal | abstain | fail | **false-heal** |
|---|---|---|---|---|---|
| current | restyle+structure | 43 (35.8%) | 77 | 0 | **0** |
| current | localization | 11 (9.2%) | 107 | 0 | **2** |
| hardened-fuzzy | restyle+structure | 48 (40.0%) | 72 | 0 | **0** |
| hardened-fuzzy | localization | 11 (9.2%) | 109 | 0 | **0** |

- **Honest heal-rate is far below the top-N demo:** ~36% (restyle) / 9% (localize) random vs ~46% top-12 (Appendix A). The dominant outcome on a random sample is **abstain** (64% / 89%) — the safe degradation. Per-element, heal tracks anchor availability (the ~8% anchored controls heal even through localization; name-only heals only if text survives and is distinctive; no-identity always abstains).
- **The random sample surfaced 2 false-heals the top-N hid.** Dissected at signal level: `fuzzy()` returned 0.85 for *any* substring containment, so the reversal "Docs"→"scoD" (a substring of "vscode") manufactured a name match; with a link's role+tag baseline already at 0.737 (above the 0.62 heal threshold), only the 0.12 margin stood between abstain and a wrong heal. The specific collisions are reversal artifacts (real i18n wouldn't produce them) — but the weakness is real.
- **One-line calibrated fix, measured before/after:** gate the substring boost on a pre-existing token overlap (`selfheal-core.js fuzzy`). False-heals 2→**0**, *and* correct-heal 35.8%→**40%** (the fix also stopped inflating WRONG candidates, which had been compressing true elements' margins). → first Phase-1 work item.

### Gap 2 — Human-labelled cross-version pair (a trustworthy cross-version number)
Real ~13-year redesign: descriptors recorded on **GitHub 2013** (Wayback `20130531`, server-rendered real DOM), replayed against **live 2026** github.com (logged-out, 120 visible controls). 11 functionally-recognizable controls; **ground truth assigned by hand** (the id-oracle is useless here — almost nothing carried an id/test-id in 2013), deliberately balanced: 5 still exist, 5 removed from the page, 1 transformed.

| outcome | n | which |
|---|---|---|
| correct-heal | 0 | — |
| **false-heal** | **0** | incl. resisting every "Explore GitHub X" distractor for the removed `/explore` |
| silent-fail | 0 | — |
| correct-abstain | 6 | the 5 removed functions + search (text-input → button-dialog; recorded element gone) |
| missed-heal (safe) | 5 | the 5 surviving functions abstained instead of healing |

Decomposition of the 5 misses (signal-level):
- **2 are correct-by-design abstains** — sign-in & signup-cta: the true element won/tied at rank #1, but it is **duplicated** on the 2026 page (header+mobile / hero+footer) → margin 0 → abstain is the *right* call. Needs Clue-2 container scope (deferred P2), not a matcher fix.
- **1 needs Clue-3** — logo: its only signal (name) drifted "Github"→"Homepage" and now collides with 33 other "GitHub …" links; the true logo fell to **rank #34**. Deterministically unhealable; needs the record-time visual/AI caption.
- **2 near-misses** — signup-email (true elem rank #2 @0.526) and pricing (rank #2 @0.545), throttled by drifted auxiliary signals (changed `nameAttr`+input type; stale 2013 `inForm`/`formAction`). A Phase-2 calibration question, not a safety issue.

Takeaway: across a real cross-version redesign with **~0 test-ids**, deterministic **heal ≈ 0%** but **false-heal = 0%** (safe). This is the honest, human-labelled correction to Appendix A's Amazon-2016 result (whose id-oracle broke). It maps the entire cross-version residue onto the already-deferred levers: **test-id coverage upstream · Clue-2 for duplicates · Clue-3 for full name-drift.** Caveat: n=11, one app, one redesign, single labeler — illustrative, not statistical.

### Gap 3 — One Appium mobile screen, adapted to the descriptor (cross-platform, demonstrated)
Real Appium **iOS XCUITest page-source** (app "Confirm Rx™", Bluetooth-Pairing screen; 14 interactive candidates after adaptation). Built the **XCUITest→descriptor adapter** (`selfheal-core.js IOS`): `type`→role, the developer **accessibilityId**→`testid` (the mobile anchor), `label`/`value`→accessible `name` (what localizes), `enabled`/`visible`/box→actionability gate. Same matcher, same thresholds as web. Drift is **synthetic on the real tree** (no live device, no before/after mobile pair available).

| scenario | anchored targets (×3) | no-id icon button | false-heal |
|---|---|---|---|
| A · original (round-trip) | 3/3 heal correct (conf 1.0) | abstain (tied) | 0 |
| B · localize label, **keep accessibilityId** | **3/3 heal via accessibilityId** (conf 0.825) | abstain | 0 |
| C · drop accessibilityId **and** localize | 3/3 **safe abstain** (conf 0.491) | abstain | 0 |

- **B is the motivating iOS case, demonstrated:** the visible label is localized away ("Pair Now"→reversed) yet every anchored control heals because the accessibilityId carried it — the exact "Privacy e sicurezza → Privacy" 380-failure rescue, now on real mobile markup.
- **Actionability gate works on mobile:** the `visible="false"` `PairDevice_KeepImage` is flagged **not-usable** even with its identity intact, while the visible Pair-Now button passes ("found ≠ usable"; guards the iOS-swipe D-2 off-screen case).
- Upgrades cross-platform from *argued* to **demonstrated at the markup level.** Android UIAutomator maps identically (resource-id→testid, class→role, text/content-desc→name) but was not run. Caveats: no live device/session; synthetic worst-case (reversal) drift, not natural; n=3 anchored+1; iOS only; accessibilityId inferred from raw source (a real client reads it explicitly).

### Cumulative honest position after Phase 0.5
- **Safety (false-heal≈0) holds** on the recommended full-descriptor path across synthetic + locale + cross-version + mobile — the one exception (2 web localization false-heals) was a substring-fuzzy artifact, now fixed (→0) at no heal cost.
- **The honest heal-RATE is much lower than every prior demo** once you (a) sample randomly and (b) test real cross-version drift: ~36% synthetic restyle, ~9% harsh localization, **~0% on a real 13-year redesign with no test-ids** — while staying safe by abstaining.
- The levers are quantified and unchanged: **test-id/accessibilityId coverage** is the dominant driver; **Clue-2 (duplicates)** and **Clue-3 (full name-drift)** are the named residue. **Go for Phase 1:** the safety bar is met; the heal-rate ceiling is set by anchors, not the matcher.

## 7. Next session

Phase 0 **and** Phase 0.5 are **done** (Appendices A/B/C). Phase 0.5 closed the three go/no-go gaps with measured results: an honest random-sample heal-rate (Gap 1), a human-labelled cross-version number (Gap 2), and a real-mobile cross-platform demonstration (Gap 3). **Decision: go** — safety (false-heal≈0) is met; the heal-rate ceiling is set by anchor availability, not the matcher; the residue maps cleanly onto already-deferred work. `selfheal-core.js` is the validated seed (matcher + web/iOS adapters + the calibrated fuzzy fix).

**Phase 1 build — implement the §9 recorded-step schema as real code** (`capture → scope-to-visible → reveal → match → actionability gate → verify-by-effect → abstain/diagnose`), measured on the corpus. **Build underway — see [PHASE1-tasks.md](PHASE1-tasks.md): granular plan, 18/18 tests green, before/after metric per step, and the honest dev take (incl. what the green checks do *not* prove).** Ordered work items, each tied to a Phase-0.5 finding:

1. **Recorded-step writer (capture).** Emit the §9 schema per step from a live page: descriptor (multi-signal + per-signal stability), `bestLocator` + `uniqueAtRecord` + `confidence` (predicted robustness), action/value, and the `flag` for low-identity controls. Reuse `selfheal-core WEB.extract`/`buildFromEx`. — *the artifact every later stage consumes.*
2. **Ship the hardened fuzzy.** Already validated (false-heal 2→0, heal 35.8%→40%). Land `selfheal-core.fuzzy` as the name comparator. — *Gap 1.*
3. **`scope.visibleOnly` (the duplicate fix).** Resolve to the interactable instance (offsetParent + in-viewport; mobile visible+enabled) *before* matching; Clue-2 container only as fallback. — *Gap 2's 2 correct-by-design abstains (sign-in, cta) and Appendix B's nav×2 / "Create board"×3.*
4. **Actionability gate at replay.** Web: visible + finite box + topmost-at-point (hit-test). Mobile: enabled + visible + finite box. Prototyped in `selfheal-core` (`WEB.actionable`/`IOS.actionable`); wire as a hard pre-act check. — *Gap 3 gate; iOS-swipe D-2.*
5. **verify-by-effect.** After acting, confirm the declared effect (urlChange/domChange/textPresent/elementGone) before persisting the healed locator; on mismatch, roll back to abstain. — *turns a step into a checkable fact; catches the rare wrong-heal.*
6. **abstain/diagnose taxonomy.** Emit a named state (not-ready / blocked-by-overlay / ambiguous / no-identity / env-fault) — never silent-fail. — *every Phase-0.5 non-heal was already an explicit abstain; formalize it.*
7. **Batch harness + metrics.** Wire the workbench to score correct-heal / false-heal / abstain / silent-fail / calibration across the labeled corpus (web random samples + the human-labelled cross-version pair + the iOS screen), so every later change is measured. — *prerequisite for Phase 2 calibration.*

Still deferred (unchanged): Clue-3 visual/pHash + record-time AI caption (rescues logo-style full name-drift), Clue-2 context graph (duplicate disambiguation beyond visible-scoping), an Android UIAutomator run, latency budget. **Weight/threshold calibration stays Phase 2** — Phase 1 keeps the a-priori thresholds so its numbers remain comparable to Phase 0/0.5.

**Structural flag for Phase 2 (surfaced by Gap 1):** for the ~76% of controls that are name-only, the role+tag baseline alone reaches ~0.737 — *above* the 0.62 heal threshold — so the 0.12 margin is the **only** thing preventing a wrong heal. Calibration should ensure undistinguished role+tag cannot by itself clear the heal floor (e.g. require ≥1 distinguishing signal, or raise the floor for low-signal descriptors). This is why the substring-fuzzy artifact became a false-heal rather than an abstain.
