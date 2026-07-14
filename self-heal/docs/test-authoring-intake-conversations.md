# Test-Authoring Agent — Intake Conversations (Rich-Artifact)

## Why this doc
Companion to [`test-authoring-agent-strategy.md`](test-authoring-agent-strategy.md),
[`test-authoring-agent-buildplan.md`](test-authoring-agent-buildplan.md) (esp. §6b coverage-critic
rulebook), and [`test-authoring-layers-logging-metrics.md`](test-authoring-layers-logging-metrics.md).
Where the worked examples show what the *artifact* pane fills up with, this doc shows what the *chat*
pane should feel like at **intake time — when the QA drops in a rich artifact** (a diff, a PRD, a Jira
ticket + spec).

The point: when the artifact is rich, world-class intake **shifts from interrogation to
confirmation**. The agent should surface what it already inferred, ask only what it can't infer, and
raise spec silences as abstain probes — not chatbot-survey the user for 15 fields it could have read.

Two scenarios below apply the 8-category intake framework end-to-end. Honesty tags per project rule:
snippets in the artifacts are marked `illustrative` — plausible but not measured from a live system.

---

## The 8-category intake framework (recap)

1. **Change fingerprint** — UI / backend / data / contract / infra / mix; diff present; delta vs full; what's NOT changing.
2. **Business intent & blast radius** — money/regulated? worst-case failure? sign-off/audit?
3. **Actors & personas** — who else can trigger; authz matrix (who CAN'T); persona spread.
4. **Oracle availability** — how do we know output is right? Ref impl / spec / log / DB state? Invariants? Where is spec silent? *(proactive abstain probe)*
5. **State, journey, environment** — multi-step, save/resume, concurrent, feature-flag, timeouts.
6. **Cross-layer & observability** — layers touched (UI/API/DB/external), audit/decision log, rule/rate versioning, idempotency.
7. **Data & privacy** — real/synthetic, PII masking, regulatory formats (NRIC/PAN/tax IDs), reusable data profiles.
8. **Governance & history** — existing tests to reuse, escaped defects, priority tier, manual vs automation-ready.

Confidence tags used below: `inferred` (agent read it from the artifact) · `assumed` (plausible default,
not stated) · `asserted` (product/user confirmed) · `unknown` (needs decision) · `abstain-candidate`
(spec silent — flag rather than guess).

---

# SCENARIO A — PAYMENTS · Instant P2P transfer with a new daily-limit rule

## Setup

**What the QA pasted:**
> *"AIA-P2P-812: Instant P2P transfer, new daily limit rule, Web + iOS. PR + PRD attached."*

**Artifact provided (`illustrative`):**

*PR diff — backend Java handler (extract):*

```java
// PaymentsTransferHandler.java
@PostMapping("/v2/transfers/p2p")
public ResponseEntity<TransferResult> transfer(@RequestBody TransferReq req,
                                               @AuthenticationPrincipal User caller) {
  var rolling = limitStore.rollingSince(caller.id, Duration.ofHours(24));
  var cap    = caller.kycTier == KycTier.VERIFIED ? verifiedCap : baseCap; // baseCap = $1000
  if (rolling.plus(req.amount()).isGreaterThan(cap)) {
    return ResponseEntity.status(429)
       .body(TransferResult.error("DAILY_LIMIT_EXCEEDED", cap.minus(rolling)));
  }
  ...
}
```

*PR diff — iOS SwiftUI screen (extract):*

```swift
// P2PTransferView.swift
if case .exceeded(let remaining) = viewModel.state {
  ErrorBanner("You've reached your daily limit. \(remaining.formatted()) available in 24h.")
}
```

*PRD excerpt (extract):*

> **Daily-limit rule.** A rolling 24-hour cap applies **per sender**. Default cap is **$1,000**.
> KYC-verified users get an elevated cap (see KYC-tier table, filed separately). Enforcement is
> **server-side**; a rejected transfer returns **HTTP 429** with error code
> `DAILY_LIMIT_EXCEEDED` and a `remaining` amount for the client to render. Behavior across timezone
> boundaries and partial-cap failures under concurrent requests is out of scope for this ticket.

---

## Agent — Understood so far

> Reading the diff + PRD; here's what I've pulled together before I ask anything.

**Change fingerprint** *(cat 1)*
- Mixed: **backend rule change** (new limit enforcement in `PaymentsTransferHandler`) + **UI display** (iOS `ErrorBanner`) — `inferred` from the diff hunks.
- Web is named in the story but I see **no Web diff** in the PR — `unknown`; possible the Web client picks up 429 handling for free, or it ships separately.
- What is **not** changing: the transfer happy-path, KYC-tier itself, the `verifiedCap` value (referenced but not defined here) — `inferred`.

**Business intent & blast radius** *(cat 2)*
- Money-moving, per-user cap → **regulated / high blast radius** — `inferred`. Worst case: the cap silently fails open under load and a user drains beyond the cap.
- Rolling 24h is a compliance surface (not just UX) — `assumed` given "server-side enforced" language in the PRD.

**Actors & personas** *(cat 3)*
- Two persona bands the diff cares about: **base user** (`baseCap = $1,000`) and **KYC-verified** (higher cap) — `inferred`.
- Authz-negative not addressed in diff: unauthenticated / suspended / frozen accounts — `unknown`.

**Oracle availability** *(cat 4)*
- Strong oracles: **HTTP status 429** + error code **`DAILY_LIMIT_EXCEEDED`** + **`remaining` amount** — `inferred` directly from the handler.
- **abstain-candidate:** PRD explicitly punts on (a) **timezone/rolling-window semantics** (is "24h" wall-clock UTC, sender's local TZ, or truly rolling ms-precision?), and (b) **partial-cap under concurrency** (two simultaneous transfers each within cap but together over it).

**State, journey, environment** *(cat 5)*
- **Rolling 24-hour** window is inherently temporal → time-travel / clock-skew testable — `inferred`.
- Retry / double-submit / offline queue (iOS-typical) not mentioned in PRD — `unknown`.

**Cross-layer & observability** *(cat 6)*
- Layers touched: **iOS UI → API → limit-store (DB or cache?)** — `inferred`. `limitStore.rollingSince` implies persistent state that must be queryable for oracles.
- No audit-log line visible in the diff for a rejected transfer — `unknown`; per **coverage-critic Rule 12** this is worth confirming (rule-bearing rejections should log a decision row).

**Data & privacy** *(cat 7)*
- Real money → **PII + financial**. Test data must be synthetic accounts with realistic KYC-tier flags — `assumed`.

**Governance & history** *(cat 8)*
- No existing test-suite reference in the ticket — `unknown`. Escaped-defect history for this handler — `unknown`. Priority tier — inferring **P0/P1** given money + regulated, but not `asserted`.

---

## Agent — Before I proceed

> Five questions. Two of these are confirmation of inferences (correct me if I'm wrong); the others
> unblock things I genuinely can't read from the artifact.

**Q1 · Cat 1 (Change fingerprint) — Platform scope**
The story says *Web + iOS* but I only see an **iOS + backend** diff. If Web is truly in-scope, my
mobile pack fires and my web pack sits idle — that's a big downstream difference.
- ⬜ **iOS + backend only, Web ships later** *(no web pack this cycle)*
- ⬜ **Web + iOS + backend, Web diff is on another PR** *(fire both platform packs)*
- ⬜ Your call

**Q2 · Cat 4 (Oracle availability) — abstain probe on rolling-window semantics**
The PRD says rolling 24h but doesn't pin the semantics. This changes whether I author a
**timezone-boundary** case, a **DST** case, and how a "23h 59m ago" transfer counts.
- ⬜ **Server UTC, ms-precision rolling** *(I'll author DST + TZ-drift + off-by-1ms cases)*
- ⬜ **Sender-local calendar day** *(different case set — TZ boundary crossings dominate)*
- ⬜ **Flag as open — I'll ship abstains with candidate oracles per resolution** *(coverage-critic Rule 11)*

**Q3 · Cat 4 + Cat 6 (Oracle + Cross-layer) — abstain probe on concurrency**
PRD says partial-cap under concurrency is "out of scope for this ticket." I'd normally still author
a **race** case — the money says so. But you might explicitly not want it in this batch.
- ⬜ **Include it anyway (property-based invariant: Σ accepted transfers ≤ cap always)** *(recommended)*
- ⬜ **Respect the out-of-scope and mark it as a known gap in the coverage report**
- ⬜ Your call

**Q4 · Cat 6 (Cross-layer & observability) — audit-log presence**
Money-moving reject should leave a decision-log row (Rule 12 cross-layer). I don't see one in the
diff. Two possibilities and my case set differs by which:
- ⬜ **Audit log already exists upstream via an interceptor** *(I add an L4 audit-completeness case)*
- ⬜ **No audit log today** *(I raise this as a testability finding, not a test — per the "if oracle can't be checked from a log, that's itself a finding" rule in layers doc §3a)*
- ⬜ Your call

**Q5 · Cat 8 (Governance & history) — priority + reuse**
I'm assuming **P0/P1** given money + regulated. Also: is there an existing P2P test file I should
extend, or is this greenfield? Answering "extend" changes my export to delta-diff mode, not fresh.
- ⬜ **P0, extend `PaymentsTransferSpec` in the existing suite**
- ⬜ **P0, greenfield — nothing to reuse**
- ⬜ **P1, greenfield**
- ⬜ Your call

---

## User answers

- **Q1:** *"Web + iOS. Web diff is on PR #814 — same rule, thinner UI."* → both platform packs fire.
- **Q2:** *"Flag as open. Backend team is deciding this Thursday."* → abstain with dual-branch candidate oracles.
- **Q3:** *"Include it. If a race can drain the cap, I want to know now."* → property invariant fires.
- **Q4:** *"Actually you're wrong — the interceptor logs successes but **not** 429 rejects today. That's a real gap."* → not a test; a testability finding raised back to product.
- **Q5:** *"P0, extend `PaymentsTransferSpec`. Nick's the reviewer."* → delta-diff export.

Note: **Q4 correction** is more valuable than most of the explicit answers — the agent's inference was
wrong, and the correction directly reshapes the coverage report (a Rule 12 finding is now first-class).

---

## Result — updated understood-so-far + what happens next

**Confirmed:** iOS + Web + backend; P0; extend existing spec; concurrency in-scope; audit-log gap
raised as a finding, not a test.
**Open (abstain, dual-branch):** rolling-window TZ semantics — decision expected Thursday. Cases will
ship with both candidate oracles, resolved instantly on answer (Rule 11).

**Technique bundle** *(strategy §3, §5)*
- Decision table on `(kyc_tier × amount-vs-remaining)` — including the 429 branch.
- **BVA** on the rolling threshold: `remaining = 0.01`, `remaining = 0`, `remaining = -0.01`.
- **Property invariant:** `Σ(accepted amounts within any 24h window) ≤ cap` — Hypothesis / fast-check.
- **Contract test:** 429 body shape (`error_code`, `remaining`) — pinned so iOS + Web stay in sync.
- **Fault-injection:** limit-store slow / unavailable → does the handler fail-closed?
- **Mobile pack:** iOS retry on flaky network, backgrounding mid-transfer, offline queue interaction.
- **Web pack:** multi-tab double-submit, refresh mid-transfer.
- **Cross-layer L1 / L4 / L5:** shown-in-iOS = sent-in-API = stored-in-limitStore = shown-back-in-history.

**Coverage-critic rules firing** *(buildplan §6b)*
- **Rule 2** — interaction coverage (`kyc_tier × amount × rolling_state` — pairwise, not one-at-a-time).
- **Rule 6** — platform packs fire (iOS + Web both selected).
- **Rule 7** — backend boundary (contract + error-response + idempotency).
- **Rule 8** — money → affordability/suitability (here: cap-suitability = never accept beyond cap).
- **Rule 11** — every abstain actionable (TZ semantics carries dual oracles).
- **Rule 12** — cross-layer (shown=sent=stored=shown-back **and** audit-log gap raised).

**Sample scenarios queued for Draft**
1. **P-S1 — Base user, cumulative crosses cap mid-day** *(oracle: 429 + `DAILY_LIMIT_EXCEEDED` + `remaining = 0.00`; L1 shown-in-iOS matches API body)*.
2. **P-S2 — Concurrent double-submit within cap, sum over cap** *(property oracle: Σ ≤ cap; at most one 201, at least one 429)*.
3. **P-S3 — Verified user promoted mid-window** *(oracle: post-promotion request uses `verifiedCap`; DB shows tier change ts before request ts — abstain-candidate on whether prior consumed amount carries over)*.

**Open abstains going into Draft**
- Rolling-window TZ semantics *(dual oracle prepped)*.
- Tier-promotion mid-window carry-over *(surfaced during scenario draft; second product question).*
- Audit-log for 429 rejects *(raised as testability finding, not test).*

---

---

# SCENARIO B — INSURANCE ADVISORY · AIA-4421 mid-FHR dependent recalc

## Setup

**What the QA pasted:**
> *"AIA-4421: recalc needs coverage when a new dependent is added mid-FHR. Mobile-first (iPOS+).
> Jira + spec page attached."*

**Artifact provided (`illustrative`):**

*Jira ticket AIA-4421 (extract):*

> **Summary:** During a Financial Health Review, when the advisor adds a new dependent on the
> *About You* screen after Priorities & Needs has been visited, needs coverage must **recalculate**
> across **TPD, Critical Illness, and Disability Income** without the advisor having to re-enter
> those screens.
>
> **Acceptance criteria:**
> - AC1: Adding a dependent triggers a needs recalc for **TPD, CI, Disability**.
> - AC2: The recalc respects the **current Investment Risk profile band** (Conservative → Aggressive).
> - AC3: An **audit-log entry** is written: `dependent_added`, dependent details, new needs values,
>   `rule_version`, `rate_version`, advisor id.
> - AC4: If the FHR is in the **Investment Risk** stage or later, the advisor is notified that
>   needs figures have changed and prompted to confirm before continuing.
>
> **Out of scope:** removing dependents (separate ticket AIA-4422). Cross-quote propagation.
>
> **Platform:** iPOS+ (iPad-first). Web parity to follow.

*Linked spec page (extract):*

> **Recalc formula:** `needsCoverage(need_type, dependents, income, horizon, risk_band)` — filed rate
> table `needs-rate-v2026.2`. Rounding: nearest S$100. Existing dependents' contributions are
> **preserved**; new dependent adds an additive delta. If the resulting need exceeds the current
> **suitability envelope** (defined by risk band × income multiple), the plan surfaces a
> *suitability warning* but does not block progress.

---

## Agent — Understood so far

> This one I can read a lot of. Confirming before I ask.

**Change fingerprint** *(cat 1)*
- Mixed: **backend rule** (recalc across 3 need types) + **UI notify/prompt** on Investment Risk+ stages + **audit-log write** — `inferred` from AC1/AC3/AC4.
- What is **not** changing: existing dependents' contributions (spec explicit), the rate table itself, dependent *removal* (AIA-4422 owns it) — `inferred`.

**Business intent & blast radius** *(cat 2)*
- Advisory + money + regulated (needs-based selling / suitability). Worst case: wrong needs number persisted → mis-sale → compliance breach — `inferred` given the audit-log AC.
- Multi-screen, stateful; blast radius touches **Needs Analysis, Selected Plans, Insurance History, Replacement & Switching** (they read needs) — `inferred` from the insurance sample-set flow map.

**Actors & personas** *(cat 3)*
- Primary actor: **advisor** (mid-FHR, has a draft quotation open). No customer-facing surface here — `inferred`.
- Persona spread needed *across the recalc*: dependents 0→1, 1→2, 2→3; risk bands Conservative / Balanced / Aggressive; income bands (below/at/above suitability envelope) — `assumed` per Rule 10 (avoid Set-24 trap).

**Oracle availability** *(cat 4)*
- Strong: new needs values are **derivable** from `needsCoverage()` inputs + rate table `needs-rate-v2026.2` → **calculable oracle**, not just "advances to next screen" — `inferred`.
- Audit-log oracle: one row with named fields + versions — `inferred` from AC3, maps to layers-doc **L4/L5** exactly.
- **abstain-candidate:** spec says "additive delta" for new dependent — but is there a **cap** on total needs (e.g. multiplier of income)? Spec mentions a *suitability envelope* as a warning, not a cap. Behavior when envelope exceeded is defined; behavior when envelope exceeded *and* advisor confirms is not.
- **abstain-candidate #2:** what if the advisor **navigates back** to Priorities & Needs and manually re-adjusts *after* the auto-recalc? Which value wins?

**State, journey, environment** *(cat 5)*
- Multi-screen, mid-journey state change → **MBT + back-nav + abandon/resume** apply (Rule 5) — `inferred`.
- iPOS+ = iPad → **offline / backgrounding / app-suspend mid-recalc** matters (Rule 6) — `inferred`.
- Feature flag? — `unknown`.

**Cross-layer & observability** *(cat 6)*
- UI (About You form) → API (recalc service, `needsCoverage`) → DB (needs row update + audit_log row + rate_version stamp).
- Rule 12 fires strongly: **shown = sent = stored = shown-back** across Needs Analysis and Selected Plans, plus **audit-log completeness** and **rule/rate version stamping** — `inferred` from AC3.

**Data & privacy** *(cat 7)*
- Dependent PII (NRIC, DOB, relationship). Regulatory formats: NRIC format checksum. Test data must be **synthetic-but-format-valid** — `assumed` per project rule ("libs generate values, LLM doesn't").
- The Set-24 profile trap is exactly the risk here — `inferred` from the sample-set doc.

**Governance & history** *(cat 8)*
- I can reuse structure from the insurance sample set (Sub-flow B: Needs Analysis) — `inferred`.
- Escaped-defect history for this exact area — `unknown`. Priority — inferring **P1** (regulated but not customer-facing production traffic) — `assumed`.

---

## Agent — Before I proceed

**Q1 · Cat 4 (Oracle) — abstain probe on suitability-envelope-exceeded + advisor-confirm**
Spec says exceeding the envelope surfaces a warning but doesn't block. It's silent on the
**post-confirm** state: does the persisted need value keep the exceeded number, get clamped, or
require a re-justification note?
- ⬜ **Keep exceeded value; audit-log the confirm** *(candidate oracle A)*
- ⬜ **Clamp to envelope ceiling** *(candidate oracle B)*
- ⬜ **Flag as abstain — carry both oracles into Draft, resolve when product answers** *(recommended, Rule 11)*

**Q2 · Cat 5 (State/journey) — back-nav-after-recalc conflict**
If the advisor manually edits Priorities & Needs after the auto-recalc runs, whose value wins?
- ⬜ **Manual edit wins; audit both events**
- ⬜ **Auto-recalc re-runs and overrides**
- ⬜ **Flag as abstain — Rule 5 says I need a back-navigation case anyway; happy to author both branches**

**Q3 · Cat 3 (Persona spread) — how wide do you want the fan?**
Rule 10 says don't fall into a single-profile trap. I can fan across:
- dependents `0→1, 1→2, 2→3`
- risk bands `Conservative / Balanced / Aggressive`
- income position `below / at / above envelope`
That's 3×3×3 = 27; pairwise reduces to ~9. Full grid, pairwise, or curated?
- ⬜ **Pairwise (recommended)** *(9-ish cases, interaction-complete)*
- ⬜ **Full grid** *(27 cases; overkill unless compliance wants it)*
- ⬜ **Curated 4** *(one per risk band + one envelope-exceeded — fast, less rigorous)*

**Q4 · Cat 6 (Cross-layer) — confirm audit-log shape**
AC3 lists the fields. I'm going to author an **L4 audit-log completeness** case that asserts every
listed field is present, non-null, and `rate_version = "needs-rate-v2026.2"`. Also plan an **L5
version-stamp** case (draft rate mid-change scenario). Anything I'm missing on the log shape?
- ⬜ **Ship as described**
- ⬜ **Add `correlation_id` — we've been burned before by not being able to trace UI→API→DB for a single recalc**
- ⬜ Your call

**Q5 · Cat 8 (Governance & history) — escaped defects + priority**
Any past prod bugs in the FHR recalc area I should bias lenses toward?
- ⬜ **Yes — [describe]** *(will strengthen the corresponding lens, per strategy §10)*
- ⬜ **No known escapes**
- ⬜ **Not sure — proceed with defaults**

---

## User answers

- **Q1:** *"Flag as abstain. Compliance is meeting on this next week."* → dual candidate oracles carried.
- **Q2:** *"Manual edit wins. Audit both."* → deterministic; back-nav case written with that oracle.
- **Q3:** *"Pairwise, but also add a Conservative + envelope-exceeded case — that's the one we've historically underinvested in."* → pairwise + one asserted curated add.
- **Q4:** *"Add `correlation_id` — you're right, we've been burned."* → correlation_id becomes a required audit-log field in the oracle. (This is also a small correction: the agent proposed the base fields; the QA added a load-bearing one.)
- **Q5:** *"Yes — 6 months back, a recalc on 3rd dependent didn't refresh Selected Plans until the advisor tapped Next twice. Post-mortem tagged it 'stale UI after recalc.'"* → biases toward L1 shown-back oracle + a state-transition case for "recalc happened, but user hasn't navigated yet."

Two useful corrections here: **Q4** (the QA added `correlation_id` as load-bearing) and **Q5**
(historical escape reshapes the L1 lens weight). Neither would have surfaced from the artifact
alone — which is exactly why a rich-artifact intake still asks category-8 questions.

---

## Result — updated understood-so-far + what happens next

**Confirmed:** iPOS+ primary, Web parity later; pairwise + one asserted curated add; manual-edit-wins on
back-nav; audit-log oracle includes `correlation_id`; L1 shown-back lens weighted up because of the
prior 3rd-dependent escape.
**Open (abstain, dual-branch):** suitability-envelope-exceeded post-confirm behavior — resolves at
compliance meeting.

**Technique bundle** *(strategy §3, §5)*
- **Decision table** on `(dependents-delta × risk-band × envelope-position)`.
- **BVA** on the envelope boundary (need = envelope − S$100 / = envelope / = envelope + S$100).
- **Property invariants:** existing dependents' contributions preserved (identity property); recalc is
  **idempotent** (running twice with the same input → same output, same single audit row per event).
- **Pairwise** across the 3×3×3 factor space → ~9 cases.
- **MBT (state/journey):** enter recalc mid-flow at Priorities & Needs, at Investment Risk, at Selected
  Plans → different UI notify behavior per AC4. Include the "recalc happened, user hasn't navigated"
  case surfaced by the Q5 escape.
- **Mobile pack:** app backgrounded during recalc; iPad suspend/resume; offline (should the recalc be
  local or server-authoritative? — likely a second abstain).
- **Cross-layer L1/L4/L5:** shown-back on Needs Analysis + Selected Plans; audit-log completeness
  (including `correlation_id`); rate/rule version stamped in DB.

**Coverage-critic rules firing** *(buildplan §6b)*
- **Rule 1** — no orphan-oracle: envelope-exceeded case carries dual candidate oracles.
- **Rule 4** — cross-field consistency: dependents ↔ income ↔ horizon → a consistency case.
- **Rule 5** — journey coverage: back-nav after recalc + abandon/resume mid-recalc.
- **Rule 6** — platform packs: iPad backgrounding + offline.
- **Rule 8** — money/affordability: envelope suitability case.
- **Rule 10** — persona spread: pairwise + curated add (explicitly avoiding Set-24 trap).
- **Rule 11** — every abstain actionable.
- **Rule 12** — cross-layer: L1 shown=sent=stored=shown-back + L4 audit-log with `correlation_id` + L5 rate-version pin.

**Sample scenarios queued for Draft**
1. **I-S1 — Balanced band, dependents 1→2, need remains inside envelope** *(oracle: `needsCoverage(...)` recomputed value, rounded to nearest S$100, matches API + DB + Needs Analysis UI + Selected Plans UI; audit row with all AC3 fields + `correlation_id`; `rate_version = "needs-rate-v2026.2"`)*.
2. **I-S2 — Conservative band, dependents 2→3, need crosses envelope ceiling** *(dual-oracle abstain: keep-exceeded vs clamp; audit-log present under both; suitability warning visible under both)*.
3. **I-S3 — Recalc happens at Selected Plans stage; advisor doesn't navigate; then taps Next** *(oracle from Q5 escape: Selected Plans UI reflects new figures before the second tap; L1 shown-back oracle checks DOM/API/DB triple)*.

**Open abstains going into Draft**
- Envelope-exceeded post-confirm value semantics *(dual oracle prepped)*.
- Offline recalc — local approximation or server-authoritative? *(second question surfaced during draft)*.

---

# Reflection — the rich-artifact intake pattern

Simulating both scenarios end-to-end, a few things emerged more clearly than the framework alone
suggested.

1. **Tone is confirmatory, not interrogative.** With a rich artifact, "Understood so far" carries
   most of the water; the questions read like a senior QA checking their read on Slack, not a form.
   The 8 categories still all get touched — but 3–4 of them via *inference the user can correct*, not
   via *questions the user must answer*.

2. **Questions concentrate in categories 4 (Oracle) and 8 (Governance/history), plus one abstain
   probe.** Diffs and PRDs are strong on *what the code does* and weak on *where the spec is silent*
   and *what has escaped before* — that's exactly the gap questions should close. Categories 1, 2, 3,
   5, 6, 7 largely inferred; 4 and 8 largely asked.

3. **Corrections are as valuable as answers.** In Scenario A the QA corrected the audit-log
   inference (there is no 429 audit row today); in Scenario B they added `correlation_id` to the
   audit oracle. Both directly changed downstream authoring in ways an explicit-question-only intake
   would have missed. **The "Understood so far" block is a correction surface, not just a status
   summary — that's its highest-value job.**

4. **Every question visibly moves a downstream lever.** "Web + iOS?" fires two platform packs.
   "TZ semantics?" fires DST/rolling cases. "Pairwise or curated?" changes the fan size. If a
   question doesn't move a downstream lever, it doesn't belong at intake — it belongs in Draft or
   later.

5. **Abstain probes are the highest-value question type.** Both scenarios had a category-4
   ambiguity (TZ semantics; envelope-exceeded post-confirm) that the artifact structurally could
   not resolve. Surfacing them at intake — with **dual candidate oracles ready to ship** (Rule 11) —
   turned each into an *actionable* abstain instead of a blocker. This is the single move that
   distinguishes reasoning-loop intake from chatbot intake.

6. **Category 3 (persona spread) needs an explicit chip.** Left implicit, agents drift into the
   Set-24 trap. A "pairwise / full grid / curated N" chip at intake is small but load-bearing —
   Rule 10 is easier to enforce with the QA's answer on record than by the critic catching it later.

7. **Surprises from simulating this out:**
   - **Cat 6 (Cross-layer)** benefits more from a rich artifact than any other category — the diff
     tells you which layers are touched, and Rule 12 basically writes itself. This is the category
     where "asked" questions are the least valuable and "inferred + confirm" is most efficient.
   - **Cat 8 (History) resists artifact-inference completely.** No artifact contains "we've been
     burned by X." That's the one place a chatbot-style question is unavoidable — but it's *worth*
     asking every time, because the payoff (Scenario B Q5) reshapes lens weights.
   - The **~3–5 questions target held** in both scenarios (5 each), and could realistically drop to
     3 in Scenario B if the QA's escape history were in a linked defects corpus — which is exactly
     the strategy §10 learning-loop payoff.
   - Rich artifacts don't just reduce question *count* — they change question *type*. Poor-artifact
     intake asks "what does this do?"; rich-artifact intake asks "what does the spec **not** say?"
     That shift is the whole point.
