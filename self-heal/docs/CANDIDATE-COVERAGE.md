# CANDIDATE-COVERAGE.md — widening the candidate set for roleless click targets (Ledger K28)

Purpose: evaluate, **measure**, and resolve the K28 coverage gap — the matcher cannot heal what
isn't a candidate, and core `WEB.candidates` (`input,button,a,select,textarea,[role]`) is blind to
**roleless, attribute-less React-handler `<div>`s** (Gong Slides cards, product-grid cards). These
have a JS onClick but no `role`, no `onclick` attr, no `tabindex`.

**Outcome: a HYBRID.** We ship a guarded, **opt-in** widener in the pipeline layer
(`pipeline/candidate-widening.js`) — core stays pristine — AND document why widening must stay
opt-in: clickability is not DOM-introspectable, so the precision ceiling is inherent (~65% on a real
grid). This is `measured`, not argued from first principles.

---

## 1. The heuristics evaluated (deterministic, framework-agnostic)

| signal | idea | verdict |
|---|---|---|
| `cursor:pointer` (raw) | explicit click affordance | **rejected** — floods (it is *inherited* down the whole subtree) |
| **pointer-root** | outermost `cursor:pointer` (parent not pointer) | **kept** — dedups the subtree, 8× precision over raw |
| `aria-*` presence | a11y-annotated custom control | kept (cheap, high-precision when present; often absent) |
| focusable-roleless (`tabindex>=0`) | keyboard-reachable custom control | kept (rare on the gap, but precise) |
| `data-*` click hints | `data-action`/`data-index`/… | **rejected as a signal** — present but not on the click target (precision 0 on Flipkart) |

The decisive insight (found in the data, not the design): **`cursor:pointer` is an inherited CSS
property.** Every descendant of a clickable card — its text, price, image, padding wrappers —
computes `cursor:pointer` too. So raw `cursor:pointer` returns the whole subtree (precision ~8%). The
genuine target is the **outermost** pointer element, i.e. the one whose parent is *not* pointer
("pointer-root"). That single refinement is the precision lever.

---

## 2. Measurement method (the honest part)

We measure precision/recall with an **asymmetric oracle**:

- **Ground truth** ("is this really a click target?") comes from EXPENSIVE, framework-coupled
  introspection: React fiber props (`__reactProps$*`.`onClick`/`onClickCapture`), DOM `.onclick`/
  `[onclick]`, Vue invoker caches (`_vei`). This is **not** something the matcher could use at heal
  time — it is version-specific, framework-specific, and absent in Appium/cross-platform. It is only
  a *measurement* oracle.
- **The detectors under test** are CHEAP, deterministic CSS/attr signals (above). The question:
  *how well do the cheap signals approximate the expensive oracle, and at what false-positive cost?*

Tool: [`self-heal/tools/candidate-coverage-probe.js`](../tools/candidate-coverage-probe.js) — injected
via Chrome MCP, emits **counts only** (privacy, per I27). Restricted to `onClick`/`onClickCapture`
(not `onMouseDown`/`onPointerDown`, which React attaches for ripples/hover/drag — handler noise, not
navigation; the restriction changed Flipkart's gap-truth only 142→139, so the count is dominated by
*real* nested onClick).

---

## 3. Results (`measured · live · 2026-06-24`)

### Flipkart laptop search — a real React product grid (the Gong-Slides analog)

`laidOut 2273 · native-interactive 125 · onClick-bearing 192 · **roleless onClick gap = 139 (73% of all clickable nodes)**`

| detector | recall (of 139 gap targets) | precision | flagged | false-pos |
|---|---|---|---|---|
| `cursor:pointer` (raw) | **0.90** | **0.08** | 1587 | **1462** |
| **pointer-root** | 0.30 | **0.65** | 63 | 22 |
| **guarded widener** (shipped) | 0.27 | **0.65** | 57 | 20 |
| `aria-*` | 0 | — | 0 | — |
| focusable-roleless | 0 | — | 0 | — |

- Raw `cursor:pointer` recovers 90% of the gap but at **8% precision** — 1462 false candidates per
  page. Injecting that into the matcher would manufacture ties and false-heals. **Unusable as-is.**
- **pointer-root is an 8× precision gain** (0.08 → 0.65) for a recall cost (0.90 → 0.30). The 0.30 is
  pessimistic: it counts *all* handler nodes including redundant nested ones; pointer-root targets
  the outermost discrete card, which is what a recorded step actually points at.
- Flipkart uses neither `aria-*` nor `tabindex` on its cards → those signals contribute nothing here
  (they help on a11y-conscious apps; see below).

### React shopping-cart demo — an a11y-clean app

`onClick-bearing 18 · **roleless gap = 1 (≈0%)**`. A well-built React app uses native `<button>`/`<a>`
for its cards, so there is essentially **no gap to widen.** This mirrors the K23/K27 thesis: coverage
is an app-quality property. Widening pays off precisely where anchor coverage is worst.

---

## 4. The inherent limit (why this stays opt-in, honestly)

Two `measured` facts cap deterministic widening:

1. **Affordance ≠ handler.** `cursor:pointer`/`aria-*`/`tabindex` are *hints* a dev may or may not
   apply, and apply to non-targets (hover rows, styled labels). Precision tops out ~65% on a real
   grid: **~1 in 3 widened candidates is not a genuine click target.**

2. **Delegation collapses introspection.** On Flipkart, the count of *outermost* onClick nodes
   (`gapTruthOutermost`) is **1** — the app routes clicks through a single high-level handler and
   dispatches on `event.target`. So genuine onClick is **not even per-element attributable with full
   fiber access.** No DOM-side heuristic — cheap or expensive — can recover per-card click intent
   that the framework never bound per-card. This is the hard floor K28 anticipated: *DOM click
   handlers aren't introspectable, and delegation means they're often not even per-element.*

Because the validated matcher's gating metric is **false-heal == 0**, polluting the *default*
candidate path with a 35%-false-positive set is unacceptable. Widening is therefore an **explicit
opt-in lever**, fronted by two existing backstops: the core actionability gate (`WEB.actionable`) and
verify-by-effect (a click into a non-target produces no DOM/URL change → flagged wrong-heal).

---

## 5. What shipped

[`pipeline/candidate-widening.js`](../pipeline/candidate-widening.js) — OFF by default, core untouched:

- `widenCandidates(doc)` → core `WEB.candidates` **plus** accepted roleless targets. Accept rule:
  affordance is **pointer-root OR `tabindex>=0` OR `aria-*`** (raw `cursor:pointer` alone rejected);
  guards drop inline styled text (`display:inline`), icon-glyph specks (`area<24`), page-sized
  backdrops (`area>½ viewport`), and lone wrappers around a native control (kept only for ≥3-sibling
  card grids). Layout-safe: in detached DOMParser docs (no layout) only attribute hints fire.
- `matchStepWidened(doc, step, opts)` — mirrors core `matchStep`'s contract (scope → rank → verdict →
  gate → diagnose) over the widened set, reusing core scoring/verdict/gate verbatim. Result carries
  `{widened:true, widenedAdded:n}`.

**Hermetic tests:** [`tests/candidate-widening.html`](../tests/candidate-widening.html) — **10/10
green.** Proves: the gap is real (core sees 0 cards); the widener finds the 3 pointer-root cards and
**not** their inherited-pointer children; rejects backdrop / inline text / native-wrapper; accepts
focusable + aria roleless; **heals** to a roleless card core can't even rank; and **SAFETY** —
identical roleless decoys stay abstain (false-heal == 0) and widening never mutates the DOM.

**Regression:** core **14/14**, adversarial **20/20**, widener **10/10** — all `verified` in-browser
via the static server + Chrome MCP (2026-06-24). `selfheal-core.js` unchanged.

---

## 6. Honest caveats

- **Two pages, one snapshot each.** Flipkart is one (strong) real grid; the demo is one clean app.
  Precision/recall are directional for the *class* of app, not a population estimate.
- **Oracle is React/Vue/DOM-only.** Vanilla `addEventListener('click')` handlers are invisible to the
  oracle (no introspectable record) → gap-truth is a **lower bound**; real coverage gap may be larger.
- **The widener's recall is bounded by the affordance the app actually emits.** On apps that set
  neither pointer, aria, nor tabindex on custom controls, even the widener recovers little — that
  residue is the genuine visual/LLM tail (consistent with Gong's 69 nameless icon buttons, K26).
