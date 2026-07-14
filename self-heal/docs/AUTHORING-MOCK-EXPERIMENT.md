# Authoring — Mock Experiment + Pre-Execution Prep

**Scope:** RFP work is set aside. This doc focuses on **test authoring**, the **taxonomy** and **graph** work that must exist **before** execution can happen, and three worked mock examples (two closed-source apps, one OSS terminal app) that stress the framework.

---

## 1. Where we stand vs prior work

Two prior plans already cover parts of authoring:

- [from-test-authoring-perspective-structured-nest.md](../../.claude/plans/from-test-authoring-perspective-structured-nest.md) — the **8-step reasoning chain** (change surface → worst-credible failure → actor matrix → states → oracle → data → bug history → second-order), a pre-committed **scoring rubric**, two head-to-head examples (payments, insurance), and **domain data packs** (retail, manufacturing, healthcare, banking). Deliverable is `WHY-REASONED-AUTHORING.md` — **planned, not shipped** in this branch.
- [prioritise-top-changes-80-20-encapsulated-pike.md](../../.claude/plans/prioritise-top-changes-80-20-encapsulated-pike.md) — a **stakeholder mockup** with the governed-agent loop (Observe → Diagnose → Propose → Approve → Act → Verify), drawer insights, smart CTAs, "learn from bug" flow, conversational authoring bar. Lives on the `festive-almeida-f988bb` branch — **not on this branch**.

Existing code in this branch: [self-heal/pretotype/testgen.js](../pretotype/testgen.js) (226 lines) — S6 authoring in OpenTest.ai format, grounded to real DOM controls, positive + negative + `openQuestions`. Only wired for **login flows** today (email / password / submit / SSO / forgot). This is a foothold, not a general authoring engine.

**A third, sibling-session build exists — cross-referenced, not merged.** Worktree `ecstatic-gould-a165ef`
(branch `claude/test-authoring-expertise-69bc62`, uncommitted as of this writing) independently built
out the `WHY-REASONED-AUTHORING.md` deliverable named above, as a live interactive pretotype:
`self-heal/pretotype/reasoned-authoring.html` + `.js` (deterministic, rule-based, no LLM in the loop).
It implements the 8-step reasoning chain against 3 hardcoded scenario bundles (payments / insurance /
CRUD), scores every authored case with the pre-committed rubric (defect power · oracle strength ·
traceability · data realism · non-redundancy, 0–2 each), and introduces a layered oracle model
(**L1** screen/flow · **L2-invariant** formula-free relations · **L2-behavioral** cross-state/cross-
layer properties · **L3** exact value bound to a versioned, approved rule) plus a **domain pack**
schema (`CoreEntities`/`Rule`/`Assumption`/`Derived`/`Invariant`/`TestOracle`/`BugClass`/
`FieldDataDistribution`) and a first-week intake checklist.

That work is **complementary to, not overlapping with**, the coverage-model layer in this doc — the two
answer different questions:

| | Sibling build (`WHY-REASONED-AUTHORING.md` + `reasoned-authoring.js`) | This doc's coverage-model layer |
|---|---|---|
| Answers | *Is the asserted value correct?* | *Can we locate the right element and observe a symbolic condition?* |
| Graph/structure | Rule → Assumption → Derived value → bound `TestOracle` (business-logic graph) | Element registry → screen-transition graph → service-dependency graph (UI/execution graph) |
| Refusal mechanism | "held" cells with a free-text `holdReason` string | `REFUSAL` objects with a **closed** `REFUSE_REASON` enum (§2.2) |
| Maturity | Rich, self-scored, honestly self-critiques its own open gaps (baselines still `simulated`, not `measured`) | Schema + validator gate proven (18/18), one real domain port (`testgen-v2.js`) measured against `testgen.js` |

**One concrete, actionable convergence point if these two threads ever merge:** swap the sibling
build's free-text `holdReason` for this doc's closed `REFUSE_REASON` taxonomy (`self-heal/schemas/
coverage-taxonomies.js`). A closed enum makes "held" reasons aggregable and reportable across a whole
portfolio of authored tests, not just readable one case at a time — the same upgrade this doc made
going from `testgen.js`'s free-form `openQuestions[]` to named `REFUSAL` objects (§7, "Refusals with a
named, closed-taxonomy reason: 0 → 2").

Everything else in that sibling build — the L1/L2/L3 layered model, the rubric, the domain pack, the
§8.5 "just put it in a system prompt" counterargument — stands on its own merits and is out of scope to
duplicate here. Read it directly at that worktree's `self-heal/docs/WHY-REASONED-AUTHORING.md` if it
gets committed to a shared branch; until then it's that session's in-progress work.

**Verdict — we improve upon prior work, we do not restart.** What our framework adds on top of the two prior plans and `testgen.js`:

| From our framework | Not in prior plans / code |
|---|---|
| Formal **coverage grid** (behaviour × data × environment × role) as a first-class artefact per statement | Prior work has the reasoning chain but no grid to check off. |
| **Service-dependency graph overlay** for cross-service test discovery | Prior plans mention "second-order interactions" abstractly; no graph. |
| **Symbolized oracle** (WebTestPilot Step shape → element registry + pre/post-conditions) | `testgen.js` has `expected` as NL text; no symbol layer. Pike wireframes have "expected value" but not symbolized. |
| **Per-screen element registry** as a persisted artefact | Not present. `testgen.js` captures `_anchor` per step; there's no per-screen roll-up. |
| **Traceability walk** (spec line → statement → cell → test → evidence) as a shipped structure | Prior plans imply traceability; nothing structured. |
| **Named refuse-with-reasons** as a **taxonomy** (not just `openQuestions`) | `testgen.js` has `openQuestions[]` free-form. |
| **Cross-app pattern library** (login, booking, payment, TUI-prompt) | Only login handled today. |

Bug history as intake, scoring rubric, and domain data packs — those we take **from** the prior plans, not build fresh.

---

## 2. What must exist BEFORE execution — graph + taxonomy prep

Execution here means: an agent runs an authored test on a live app, matches elements, decides pass/fail, and reports named failures. Below is what has to be authored, catalogued, or built beforehand.

### 2.1 Graphs required — and NOT required

| Graph | Required before execution? | Purpose | Format |
|---|---|---|---|
| **Per-screen element registry** | **Yes.** Non-negotiable. | Maps every element the test will act on to a stable symbol name. The symbol is what pre/post-conditions reference. Without it, we're back to "the LLM says it passed." | JSON table per screen: `{ "book_button": <descriptor>, "total_price": <descriptor>, ... }`. |
| **Statement → screen(s) map** | **Yes.** | A test derived from a spec statement has to know which screens it will visit. Otherwise element lookups can't be scoped. | JSON: `{ "S-4": ["listing", "checkout", "confirmation"] }` |
| **Screen-transition graph** | **Yes for multi-step tests. No for single-screen assertions.** | Answers: "from screen A, what user actions land on which next screen?" Multi-step tests compose across screens; the transition graph tells you what's reachable and how. | Directed graph: `{ from, action, to, condition? }`. Small — one edge per user action that changes screens. |
| **Service-dependency graph** | **Yes if the app is service-backed.** Optional for single-tier apps. | Answers: "when I inject a fault on service X, which flows are affected?" This is the source of cross-service tests (Uber lesson: 13/23 real risks were low-priority-service → critical-flow cascades). | Directed graph: `{ from_service, to_service, tag: critical|supporting|external }`. Customer-supplied for real apps; we ship the schema. |
| **Data-dependency graph** | **Yes for stateful tests.** | Step N's data may depend on step M's output (order-id from step 2 becomes the assertion target in step 5). Without this, "expected" cannot reference prior state. | Per-test: `{ step_id → produces[], step_id → consumes[] }`. Local to the test, not a global graph. |
| **Requirement → test traceability walk** | **Yes, but tiny.** | Auditor answer to "which requirement does test T-123 cover, and if line 78 of the spec changes, which tests must be re-reviewed?" | JSON adjacency list. In-code. No DB. |

**Explicitly NOT required in v1:** knowledge graphs, embedding indexes over the whole app, screen-image graphs, or any graph library. Every graph above is a small JSON adjacency structure.

### 2.2 Taxonomies required — enumerated

Small, closed vocabularies. Each is a JSON file plus a doc entry.

| Taxonomy | Values (illustrative — refine per app) | Purpose |
|---|---|---|
| **Element type** | `button` · `input` · `select` · `link` · `label` · `list-item` · `image` · `icon-only` · `container` · `text` · `overlay` · `tui-prompt` · `tui-menu-item` · `tui-cursor` | Symbolizer output. Every element in the registry has one type. Drives which actions are legal on it. |
| **Action** | `navigate` · `click` · `fill` · `select` · `hover` · `wait-for` · `key` · `assert-visible` · `assert-hidden` · `assert-equals` · `assert-matches` · `read` | The verbs a test step can invoke. Closed set → no free-form actions → no silent hallucinations. |
| **Oracle condition** | `presence` · `absence` · `equals` · `matches` · `contains` · `in-range` · `count-equals` · `count-at-least` · `ordered` · `not-changed` · `changed` · `unset` | Post-condition primitives. `expected: after clicking book_button, reservation_id is set AND we are on confirmation screen` decomposes to `unset(reservation_id) → set(reservation_id)` + `presence(screen==confirmation)`. |
| **Gap type** | `missing-cell` · `missing-cross-service` · `missing-negative` · `missing-boundary` · `missing-locale` · `missing-role` · `missing-network-condition` · `missing-recovery-path` | What kind of missing test are we flagging? Each buyer-visible in the report. |
| **Refuse reason** | `ambiguous-spec` · `externally-gated` · `data-not-known` · `pre-condition-unresolvable` · `element-not-found` · `permission-not-simulatable` · `oracle-underdetermined` · `flaky-signal-insufficient` | Named refusals. `testgen.js` has `openQuestions[]`; we upgrade to this closed set. |
| **Screen state** | `initial` · `mid-flow` · `blocking-modal` · `error-state` · `loading` · `resumed` · `logged-out` · `permission-denied` | State axis of the coverage grid. |
| **Data class** | `valid` · `boundary-low` · `boundary-high` · `just-over` · `malformed` · `empty` · `null` · `unicode-name` · `expired` · `duplicate` · `adversarial` | Data axis of the coverage grid. |
| **Environment** | `web-desktop` · `web-mobile` · `tui` · `en-US` · `ja-JP` · `de-DE` · `slow-3G` · `offline-recover` · `logged-in` · `guest` | Environment axis. |
| **Service tag** | `critical` · `supporting` · `external` · `unknown` | For the service dependency graph. |

**Prep effort for a NEW app:** author the per-screen element registry (one JSON file per screen) + statement → screen map + a small transition graph (typically <20 edges for a flow) + a service graph if customer-supplied. Nothing else is app-specific — the taxonomies above are shared.

---

## 3. Mock experiment #1 — Airbnb "Book a listing"

Closed-source, complex web, service-backed. Full walk-through.

### 3.1 Spec statements (from a synthetic BRD — labelled `asserted`)

| ID | Text | Source |
|---|---|---|
| S-1 | Guest picks check-in and check-out dates on the listing page | Spec §3.2 line 14 |
| S-2 | Total price recalculates when dates change | Spec §3.2 line 17 |
| S-3 | Booking button is disabled if host has blocked those dates | Spec §3.4 line 41 |
| S-4 | Payment supports card, PayPal, Apple Pay | Spec §4.1 line 62 |
| S-5 | Reservation is confirmed only after payment provider returns 2xx | Spec §4.3 line 78 |
| S-6 | Host receives notification within 60 seconds | Spec §5.1 line 91 |

### 3.2 Statement → screen map
```
S-1, S-2, S-3  →  listing_page
S-4            →  checkout_page
S-5            →  checkout_page + confirmation_page
S-6            →  (server-side; no UI screen — see §3.6)
```

### 3.3 Per-screen element registry (excerpts, `listing_page`)

```json
{
  "check_in_field":       { "type": "input",    "role": "textbox", "name_hint": "Check in" },
  "check_out_field":      { "type": "input",    "role": "textbox", "name_hint": "Check out" },
  "total_price_amount":   { "type": "text",     "name_hint": "Total" },
  "reserve_button":       { "type": "button",   "name_hint": "Reserve" },
  "host_blocked_notice":  { "type": "text",     "name_hint": "not available" }
}
```

### 3.4 Screen-transition graph (excerpt)
```
listing_page  --click(reserve_button)-->  checkout_page
checkout_page --click(pay_button)      -->  confirmation_page
checkout_page --network(payments 5xx)  -->  checkout_page[error-state]
```

### 3.5 Service-dependency graph (assumed / customer-supplied)
```
booking-service      [critical]
payments-service     [critical]
pricing-service      [supporting] --> booking-service
availability-service [supporting] --> booking-service
notifications-service[supporting] --> (external push provider [external])
```

### 3.6 Coverage grid — S-4 (payment methods)

| behaviour × data × env | Existing? | Cell tag |
|---|---|---|
| happy · card · en-US · web-desktop | Yes | covered |
| happy · Apple Pay · en-US · web-mobile | **Missing** | missing-cell |
| boundary · expired card · en-US · web-desktop | **Missing** | missing-boundary |
| negative · declined + retry · en-US · web-desktop | **Missing** | missing-negative |
| happy · card · ja-JP · web-mobile | **Missing** | missing-locale |
| happy · card · en-US · web-desktop · slow-3G | **Missing** | missing-network-condition |
| happy · card · en-US · web-desktop · payments 5xx | **Missing** | missing-cross-service |

### 3.7 An authored test — full shape

```json
{
  "id": "T-427",
  "goal": "Guest pays with a declined card; the retry attempt succeeds without a duplicate charge.",
  "statement": "S-4",
  "cells_covered": ["S-4/negative/declined-retry/en-US/web-desktop"],
  "screens": ["listing_page", "checkout_page", "confirmation_page"],
  "steps": [
    {
      "id": "T-427-01",
      "action": "navigate",
      "target": "listing_page",
      "condition": "guest logged in",
      "expectation": "presence(reserve_button)"
    },
    {
      "id": "T-427-02",
      "action": "fill",
      "target": "check_in_field",
      "value": "2026-08-14",
      "expectation": "equals(check_in_field.value, '2026-08-14')"
    },
    {
      "id": "T-427-03",
      "action": "fill",
      "target": "check_out_field",
      "value": "2026-08-17",
      "expectation": "in-range(total_price_amount, 300, 900)"
    },
    {
      "id": "T-427-04",
      "action": "click",
      "target": "reserve_button",
      "expectation": "presence(checkout_page.pay_button)"
    },
    {
      "id": "T-427-05",
      "action": "fill",
      "target": "checkout_page.card_number",
      "value": "4000 0000 0000 0002",
      "value_class": "adversarial",
      "note": "Stripe test card that always declines"
    },
    {
      "id": "T-427-06",
      "action": "click",
      "target": "checkout_page.pay_button",
      "expectation": "presence(checkout_page.error_banner) AND matches(checkout_page.error_banner.text, /declined/i) AND unset(reservation_id)"
    },
    {
      "id": "T-427-07",
      "action": "fill",
      "target": "checkout_page.card_number",
      "value": "4242 4242 4242 4242",
      "value_class": "valid"
    },
    {
      "id": "T-427-08",
      "action": "click",
      "target": "checkout_page.pay_button",
      "expectation": "presence(confirmation_page.reservation_id) AND count-equals(payment_provider.charge_events, 1)"
    }
  ],
  "traceability": {
    "spec_line": "BRD §4.3 line 78",
    "statement": "S-4",
    "evidence_bundle": "E-427"
  }
}
```

**Key discipline in this test:** step 6's expectation *names* what should be true — error visible, reservation NOT set. Step 8's expectation *names* what must be true across a service boundary — exactly one charge event, not two. These are symbolized conditions, checkable, not "did it look right."

### 3.8 A generated test-goal (Q17 equivalent)

> **Test goal G-427a** — For 45 min, exercise Airbnb booking on **mobile in ja-JP**, focused on **payments under bad network** (slow-3G) with declined-then-retry. Target cells: S-4/Apple-Pay/ja-JP, S-4/negative/declined-retry/slow-3G. Capture: DOM, network log, screenshot at every navigation.

### 3.9 Refuse-with-reasons (deliverables, not failures)

- **S-3 refusal** — `ambiguous-spec` — Spec says "host has blocked dates" but doesn't define how far in advance a block can occur. **Clarifying question raised.**
- **S-6 refusal** — `externally-gated` — Depends on a third-party push service we can't fault-inject. Cell marked "not coverable by us."
- **S-4 / Apple Pay** — `pre-condition-unresolvable` — Apple Pay wallet only available on iOS Safari with a paired device; we cannot simulate the wallet response deterministically in the current runtime. Marked, not attempted.

---

## 4. Mock experiment #2 — Stripe Checkout

Closed-source, high-risk, mature payments UX. Compressed walkthrough — only the differences from Airbnb.

### 4.1 What's different from Airbnb
Stripe Checkout is a **hosted single-screen flow with strong native validation**. Coverage complexity is *within* the screen (many boundary values, many currencies, many card networks), not across screens.

### 4.2 Statements (illustrative)
- S-1: Card number validated for Luhn checksum on blur.
- S-2: 3DS challenge triggered for cards flagged for SCA.
- S-3: Idempotency-key prevents duplicate charge on repeat submit.
- S-4: Radar rules can decline before authorisation attempt.

### 4.3 Per-screen element registry (`checkout_screen`)
```json
{
  "card_number":     { "type": "input" },
  "expiry":          { "type": "input" },
  "cvc":             { "type": "input" },
  "pay_button":      { "type": "button" },
  "error_field":     { "type": "text" },
  "threeds_iframe":  { "type": "container" },
  "idempotency_key": { "type": "input", "hidden": true }
}
```

### 4.4 The coverage grid problem here is DATA
Card number is one field but the data axis is dense: valid Visa · valid Mastercard · valid Amex · Luhn-fail · expired · 3DS-required · declined · insufficient-funds · fraud-hold · lost-stolen · velocity-limit-exceeded. Stripe publishes test cards for each — reuse them as the data pack.

### 4.5 An authored test using our shape

```json
{
  "id": "T-STRIPE-01",
  "goal": "3DS-required card completes only after successful challenge; no duplicate charge on repeat submit.",
  "statement": "S-2 + S-3",
  "cells_covered": ["S-2/valid/3ds-required", "S-3/repeat-submit/idempotency-key"],
  "screens": ["checkout_screen", "threeds_iframe", "confirmation"],
  "steps": [
    { "action": "fill", "target": "card_number", "value": "4000 0027 6000 3184", "value_class": "3ds-required" },
    { "action": "fill", "target": "expiry", "value": "12/34" },
    { "action": "fill", "target": "cvc", "value": "123" },
    { "action": "read",   "target": "idempotency_key", "produces": "key1" },
    { "action": "click", "target": "pay_button",
      "expectation": "presence(threeds_iframe)" },
    { "action": "click", "target": "threeds_iframe.complete_challenge",
      "expectation": "presence(confirmation.charge_id)" },
    { "action": "navigate", "target": "checkout_screen[retry]" },
    { "action": "read",   "target": "idempotency_key", "produces": "key2",
      "expectation": "equals(key1, key2)" },
    { "action": "click", "target": "pay_button",
      "expectation": "count-equals(payment_provider.charge_events, 1)" }
  ]
}
```

### 4.6 Refuse-with-reasons
- **Radar rules (S-4)** — `permission-not-simulatable` — We can't set Radar rules from the checkout screen; requires backend access.
- **Off-session merchant-initiated transactions** — `oracle-underdetermined` — Spec doesn't say whether we should show a success or a pending state during async processing. Clarifying question.

---

## 5. Mock experiment #3 — opencode (OSS TUI stress test)

**Purpose:** stress-test the framework against a **non-visual UI** — a terminal application. If the concept works here, the abstraction is durable.

`opencode` is a terminal AI coding agent. Interaction happens through stdout screens and stdin prompts. The framework must adapt to:
- "Screen" = the current terminal buffer state.
- "Elements" = visible text regions, prompts, and cursor positions.
- "Actions" = key presses, text input, ctrl-modifiers, no clicks.

### 5.1 Statements (illustrative)
- S-1: User can invoke `/help` and see a list of available commands.
- S-2: A file-write action shows a confirmation prompt before writing.
- S-3: Aborting a run (Ctrl-C) leaves the workspace in a clean state.

### 5.2 Per-screen element registry — TUI variant
```json
{
  "prompt_line":      { "type": "tui-prompt",     "match": "regex:^>\\s" },
  "command_menu":     { "type": "tui-menu-item",  "match": "list-under:'Available commands'" },
  "confirm_prompt":   { "type": "tui-prompt",     "match": "contains:'Write file? [y/N]'" },
  "cursor":           { "type": "tui-cursor" },
  "output_pane":      { "type": "container" }
}
```

Key adaptation: element lookup is by **regex/text-region matching in the terminal buffer**, not DOM query. Rest of the framework — statements, cells, oracle, refusals — carries over unchanged.

### 5.3 Screen-transition graph — TUI
```
prompt_line  --type('/help') + enter--> command_menu
prompt_line  --type('edit foo.txt') + enter--> confirm_prompt
confirm_prompt --key('n')--> prompt_line
confirm_prompt --key('y')--> file_written
```

### 5.4 An authored test

```json
{
  "id": "T-OPENCODE-01",
  "goal": "Aborting a file-write with 'n' leaves the workspace untouched.",
  "statement": "S-2",
  "cells_covered": ["S-2/negative/abort-write"],
  "screens": ["prompt_line", "confirm_prompt"],
  "steps": [
    { "action": "read", "target": "workspace_hash", "produces": "hash_before" },
    { "action": "fill", "target": "prompt_line", "value": "edit README.md; add TODO note" },
    { "action": "key",  "value": "enter",
      "expectation": "presence(confirm_prompt)" },
    { "action": "key",  "value": "n",
      "expectation": "presence(prompt_line) AND absence(confirm_prompt)" },
    { "action": "read", "target": "workspace_hash", "produces": "hash_after",
      "expectation": "equals(hash_before, hash_after)" }
  ]
}
```

The oracle is symbolic here too — `hash_before` vs `hash_after`, presence/absence of prompts. Terminal or web, the discipline is identical.

### 5.5 Refuse-with-reasons unique to TUI
- **Colour-based signals** — `oracle-underdetermined` — If a test relies on "the output turned red," we refuse unless the terminal palette is deterministic in the run env. Named.
- **Timing-dependent progress bars** — `flaky-signal-insufficient` — Percentage numbers change per run; refuse to assert on exact values.

---

## 6. Cross-app patterns and improvements

Running the same framework across three very different apps surfaces where it's strong and where it needs work.

### 6.1 What generalized cleanly
- **The three-field Step shape** (`condition`, `action`, `expectation`) — works verbatim for Airbnb, Stripe, and TUI. Adopted directly from WebTestPilot.
- **Coverage grid** — same axes (behaviour × data × env), only the values in each axis change per domain.
- **Symbolized oracle** — pre/post-conditions in the closed condition-taxonomy hold across web and TUI.
- **Refuse-with-reason taxonomy** — the same eight named reasons cover all three apps.

### 6.2 What needed adaptation
- **Element type list** — needed `tui-prompt`, `tui-menu-item`, `tui-cursor` for opencode. Now added to the taxonomy (§2.2).
- **Element matcher** — DOM query for web; buffer-region regex for TUI. Both plug into the same `element_registry` structure.
- **Screen boundaries** — well-defined pages on the web; ambiguous on TUIs (the buffer is one continuous scroll). Convention: a "screen" is a stable prompt state, not a viewport.

### 6.3 What broke / needed a rethink
- **Value chaining across steps** — `produces` / `consumes` was implicit in the original plan; explicit in the mocks above. Add to the **data-dependency graph** section formally.
- **Cross-service assertions** (`count-equals(payment_provider.charge_events, 1)`) — need a way to *observe* the service, not just the UI. This is a real gap; realistic tests need service telemetry access, which is a customer-supplied capability.
- **Value classes** on inputs (`value_class: "3ds-required"`) — turned out to be crucial. Added to the schema.

### 6.4 Improvements to fold into the framework

| Improvement | Motivation | Where to land |
|---|---|---|
| Add `value_class` field to every `fill` step | Stripe test-card taxonomy showed data axis is as important as behaviour axis | `coverage-model.schema.js` |
| Add `produces` / `consumes` per step + a per-test data-dependency mini-graph | Cross-step assertions (idempotency, workspace hash) require it | `coverage-model.schema.js` + doc |
| Add `service_observations[]` slot on a step | Cross-service oracles (`count-equals(charge_events, 1)`) need a way to consult service state | Schema — but flagged as customer-input dependency |
| Extend element type taxonomy for TUI | opencode showed the web-only list was too narrow | §2.2 above (done in this doc) |
| Element matcher is a **strategy**, not a fixed rule | DOM vs terminal buffer vs (future) native/mobile | Registry schema gets an optional `matcher_strategy` field |
| Screen boundary is defined by **stable-prompt or stable-URL**, not viewport | TUI + SPA both blur viewport boundaries | Convention doc |

---

## 7. Delta measurement — how do we know it's better?

The question "does our framework produce better tests than `testgen.js` alone or a naive LLM?" needs a fair comparison. The prior plan's scoring rubric is the right instrument. Reused here with adaptations for our specific artefact shape:

### 7.1 Per-test score (0–2 per dimension)

- **Defect power** — names a specific bug this test would catch; "verify it works" = 0. Our tests carry `goal` — a well-written goal points to a defect class.
- **Oracle strength** — 2 if all `expectation` clauses use the closed condition taxonomy; 1 if some are still NL; 0 if `expected` is a paragraph.
- **Traceability** — 2 if the test carries `statement`, `cells_covered`, and `traceability.spec_line`. 0 if none.
- **Data realism** — 2 if `value_class` is named and the value is domain-realistic (Stripe test card, real date, ja-JP unicode name). 0 if `test123`.
- **Non-redundancy** — 2 if `cells_covered` names cells not already in any other test in the set. 0 if fully redundant.

### 7.2 Set-level score

- **Coverage-grid fill** — count of cells covered vs total cells enumerated, per statement. Report numerator and denominator; no bare %.
- **Refusal accuracy** — count of refusals whose named reason is in the closed taxonomy (§2.2 refuse-reason). Free-text refusals score lower than named ones.
- **Retrospective bug catch** — take one real past bug (or a defect archetype where no bug log exists), and check: would the naive-baseline set have caught it? Would our set? Named yes/no per bug.

### 7.3 Baseline for the comparison

The honest baseline is **`testgen.js`'s current login-flow output** — that's what we ship today. For the three mocks above, `testgen.js` produces nothing (no matcher for booking, checkout, or TUI). So the delta on new domains is `0 → the mock set`.

For a comparison-that-can-be-scored, run `testgen.js` on the **login screen** of each app (Airbnb login, Stripe dashboard login, opencode auth prompt) and compare its output against the same login screen authored with our framework. Same input, different discipline. This is the fair head-to-head — narrow, but real.

### 7.4 What to measure BEFORE and AFTER

| Metric | Before (testgen.js today, login only) | After (framework applied) | How measured |
|---|---|---|---|
| Tests authored per screen | 4 (positive, wrong-password, forgot, SSO) | grid-count for that screen | count |
| Oracle strength (avg 0–2) | ~1 (NL `expected`) | ~2 (symbolic conditions) | rubric |
| Refusals with named reason | 0 (only free-form `openQuestions`) | count of taxonomy-named refusals | count |
| Coverage-grid fill | not measured (no grid) | filled_cells / total_cells | count |
| Cross-service tests authored | 0 | count with `count-equals(service.X, N)` | count |
| Retrospective bug catch | pick one past login-flow bug and score | same bug scored against new tests | yes/no per bug |

Numbers below any of these get tagged `measured` / `asserted` / `simulated` per the repo's non-fabrication rule.

---

## 8. Suggested next steps (authoring track, execution-adjacent)

Framed as concrete artefacts, in order.

1. **Land the taxonomies as JSON files under `self-heal/schemas/`** — element type, action, oracle condition, gap type, refuse reason, screen state, data class, environment, service tag. Small files, closed vocabularies. **Cost: ~½ day.** Enables everything below.

2. **Author `coverage-model.schema.js`** — the grid + statement + test shape from the mocks above, as a JSON Schema with a validator. **Cost: ~1 day.** Uses `self-heal/schemas/validator.js`.

3. **Port `testgen.js` login authoring to the new shape** — same output content, new structure (`condition/action/expectation`, `expectation` uses the closed condition taxonomy). Keeps `testgen.js` shipping, but under the new discipline. **Cost: ~1 day.** Regression: existing tests must stay green.

4. **Author a per-screen element registry for one Amplitude screen and one Gong screen** — reusing the already-scanned data in `self-heal/docs/APPS-OBSERVATION.md` and `AMPLITUDE-E2E-RUN.md`. Feeds the oracle work. **Cost: ~1 day.**

5. **One end-to-end mock authored in the new shape** — Airbnb `T-427` above, but on the actual Airbnb site under Chrome MCP (record-only, no execution needed). Proves the shape survives a real DOM. **Cost: ~1 day.**

6. **Doc: `PRE-EXECUTION-CHECKLIST.md`** — one-pager listing exactly what needs to exist for an app before execution runs. §2 of this doc, distilled. **Cost: ~½ day.**

Steps 1–3 are the critical path. 4–6 solidify the story.

---

## Files referenced

- Prior plans: [from-test-authoring-perspective-structured-nest.md](../../.claude/plans/from-test-authoring-perspective-structured-nest.md), [prioritise-top-changes-80-20-encapsulated-pike.md](../../.claude/plans/prioritise-top-changes-80-20-encapsulated-pike.md), [regarding-the-screens-at-glittery-token.md](../../.claude/plans/regarding-the-screens-at-glittery-token.md).
- Existing code: [self-heal/pretotype/testgen.js](../pretotype/testgen.js), [selfheal-core.js](../../selfheal-core.js).
- Prior docs: [ARCHITECTURE.md](ARCHITECTURE.md), [FAILURE-TAXONOMY.md](FAILURE-TAXONOMY.md), [CANDIDATE-COVERAGE.md](CANDIDATE-COVERAGE.md), [APPS-OBSERVATION.md](APPS-OBSERVATION.md).
- External: WebTestPilot ([code-philia/WebTestPilot](https://github.com/code-philia/WebTestPilot), CC-BY-4.0) — Step shape and BugReport pattern lifted. Uber DragonCrawl (blog) — precision@N metric. Uber chaos paper (arXiv 2602.06223) — cross-service failure pattern. QTypist (arXiv 2212.04732) — text-input-as-coverage-barrier. LELANTE (arXiv 2504.20896) — the silent 27% gap. WebTestPilot paper (arXiv 2602.11724) — the symbolized oracle.
