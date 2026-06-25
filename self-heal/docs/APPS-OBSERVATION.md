# APPS-OBSERVATION.md — live multi-app measurement (NOT brain-building)

Purpose: measure the real failure surface across apps to ground decisions in data (proxy for D1).
**This is measurement, not a learned brain** (the brain stays P3, per Ledger K-series).

Tool: `self-heal/tools/app-observer.js` — self-contained, injected via Chrome MCP into each app.
**Privacy:** only counts/percentages + (attempted) host leave the page; no element text or user data.
Every row is `measured · live · <date>`.

## What the metrics mean
- **recordability_pct** — strong-anchor coverage (testid/stable-id/id-fragment). The heal-rate ceiling.
- **ambiguousPct** — % of visible interactives in tied (role+name) sets → where the matcher abstains
  and disambiguation is needed.
- **rowTextDistinguishablePct** — of those tied sets, how many container row-text could SAFELY
  disambiguate → the real-world applicability of `disambiguateByContext` (Ledger K19). **The headline number.**

## Hypothesis (pre-registered before the sweep)
Row-text disambiguation applicability varies by app shape:
- **Low** on link-heavy content pages (inline duplicates, no row containers).
- **High** on table/list/dashboard apps (the AirPods shape — duplicates sit in distinct rows/cells).
Recorded here honestly whether or not it holds.

## Observations

| # | app (as named) | shape | visible | recordability% | anchorless% | ambiguous% | **rowText-distinguish%** | note |
|---|---|---|---|---|---|---|---|---|
| 0 | Wikipedia Main_Page | content / link-heavy | 275 | 0% | 4% | 8% | **11%** | baseline; inline link dupes don't sit in rows → low applicability |
| 1 | Gong (call share) | media / call viewer | 89→**247** | 0% | **78%** | 0%→**?** | — | static scan; see CORRECTION below — undercounted by 63% |
| 1b | Gong (Outline, laid-out scan) | media / call viewer | **673** | 0% | n/a | **133 dup sets** | **fails (div-soup)** | hover-hidden controls counted; biggest set = 69 nameless buttons, row-text collapses (containerOf finds no semantic row) |
| 2 | Claude (customize) | settings | 29 | 17% | 7% | 0% | — | clean labeled settings; mostly name-only, few testids |
| 3 | IRCTC (train search) | booking / form | 76 | 5% | 3% | 8% | **50%** | name-only dominant; half of ties row-text-distinguishable |
| 4 | Keka (dashboard) | HRMS dashboard | 21 | 14% | 0% | 0% | — | sparse at rest (likely lazy widgets → lower bound) |
| 5 | Amplitude (billing) | analytics / settings | 30 | 13% | 0% | 20% | **50%** | highest ambiguity; half of ties row-text-distinguishable |

`measured · live · 2026-06-24` (single page per app, single snapshot).

## Running read (n=6, honest)

**1. The dominant finding — strong-anchor coverage is LOW everywhere: 0–17% (median ~13%).**
Even modern apps (Amplitude 13%, Claude 17%) sit far below half. Most controls are **name-only** → healing
leans on the `name` signal and breaks on copy/locale drift. **This confirms the parent plan's core thesis:
test-id/anchor coverage upstream is the dominant heal-rate lever — above any matcher cleverness.**

**2. Ambiguity (where disambiguation is needed) is real but modest: 0–20%.**
Data/table-ish views have ties (Amplitude 20%, IRCTC/Wikipedia 8%); sparse pages have none. So
`disambiguateByContext` matters on data-heavy views, not universally.

**3. Row-text-distinguishes %, where ties exist: Wikipedia 11% vs IRCTC 50% vs Amplitude 50%.**
Directionally supports the hypothesis (app/table views > content), i.e. on real app views ~half of ties
ARE deterministically resolvable by container row-text. **Caveat: tied-set counts are tiny (1–2 per app)
→ directional, NOT statistical.**

**4. Gong is the worst-case residue: 78% anchorless.** Icon-only media controls, no anchors, no names →
neither anchor nor row-text helps; this is the genuine visual/LLM residue.

## CORRECTION (Gong deep-scan — surfaced by the user's hover observation)
Re-scanning Gong's Outline tab counting **laid-out** controls (box present, ignoring opacity/visibility
— i.e. including hover-gated controls) vs **strict-visible**:
- strict-visible **247** → laid-out **673** = **426 (63%) hover/visually-hidden** controls my sweep missed.
- duplicate sets: static ~0 → laid-out **133**. The biggest = **69 nameless buttons** (per-section play/jump controls).
- **`disambiguateByContext` FAILS on these:** all 69 collapse to one row-text (`distinctRowTexts:1`) because
  `containerOf` only recognizes semantic row containers (`tr/li/td/section`, `role=row`); Gong is **div-soup**,
  so it climbs to a shared ancestor. The AirPods lab test passed only because it used `<td>` containers.

**POST-FIX (div-soup container detection, K25→fixed):** re-measured Gong Outline with `containerOf`
upgraded to find the nearest *repeating-sibling* unit. **5 of the top 8 duplicate sets are now
row-text-distinguishable** (was ~0): `Copy`×32 → 32 distinct, timing spans ×11/×9 → distinct,
`Play at 46:02`×6 → distinct. Residue: **69 truly-nameless icon buttons** (collapse to 1 → genuine
visual/ordinal/LLM tail) and **cross-viewport duplicates** (`Play at 44:42` ×8 → 4 distinct =
desktop+mobile copies → correctly abstain). Lab regression test (`divSoup_contextHeal`) green; suite 20/20.

**Two corrections to the sweep's conclusions:**
1. **All SPA counts are heavy lower bounds** (Gong ×2.7). The honest interactive surface — the one tests
   actually touch — includes hover-gated controls. Future scans must count laid-out controls OR interact first.
2. **`disambiguateByContext`'s real reach is markup-dependent:** works on semantic table/list markup
   (IRCTC/Amplitude ~50%), **fails on div-soup** (Gong). Fixing it needs a better container detector
   (nearest *structurally-repeating* ancestor / nearest ancestor with distinguishing text), not semantic tags.

## Gong — full-flow profile (all 5 tabs, laid-out scan + div-soup containerOf) `measured · live · 2026-06-24`

| tab | laid-out | recordability | anchorless | dup sets | distinguishable% |
|---|---|---|---|---|---|
| Highlights | 118 | 0% | 72 | 9 | 44% |
| **Outline** | **673** | 5% | 69 | **132** | **95%** |
| Transcript | 162 | 1% | 70 | 5 | 0% |
| Call Info | 91 | 0% | 69 | 5 | 0% |
| Slides | 97 | 0% | 69 | 5 | 0% |

**Reads:**
1. **Disambiguator value is concentrated in repeating-list views** — Outline 95% of 132 sets; sparse/media tabs
   have ~5 ties, *identical* across Transcript/Call Info/Slides → that's the persistent app shell, not tab content.
2. **Coverage gap:** Slides cards (repeating units w/ scrubbers) barely register — they're React-handler `<div>`s
   (JS onClick, no `role`/`onclick` attr) which neither the observer nor core `WEB.candidates` can see. Click
   handlers aren't DOM-introspectable → a partly-inherent SPA coverage limit. (Spun off as a parallel task;
   **RESOLVED in `CANDIDATE-COVERAGE.md`** — opt-in pointer-root widener, measured precision/recall on a live
   product grid: gap = 73% of clickables, raw cursor:pointer 0.08 precision vs pointer-root **0.65**.)
3. **Recordability ~0–5% on every tab** — Gong has essentially no stable anchors anywhere; anchor coverage is the ceiling (re-confirms K23).

## Amplitude — chart builder deep-dive (interaction-driven) `measured · live · 2026-06-24`

| state | laid-out | recordability | dup sets | distinguishable% | notable |
|---|---|---|---|---|---|
| funnel chart (baseline) | 124 | **65%** | 3 | 0% | testid 70 of 124 |
| + Add Segment | 142 | 60% | **12** | 0% | new identical-twin ties |

**Three findings:**
1. **Recordability varies hugely by VIEW within one app — not uniformly low (corrects K23).** Amplitude
   chart-builder = **60–65%** (testid 70–75), vs Amplitude *billing* 13%, vs Gong 0%. The core product
   surface is heavily test-id-instrumented; peripheral pages aren't. The views that matter for testing may
   be far more healable than the peripheral-page sweep suggested.
2. **TWO ambiguity regimes (measured):**
   - *Distinct-content* repeats (Gong Outline per-section) → row-text disambiguates (95%).
   - *Identical-content* repeats (Amplitude segments / funnel steps: `row::"All Users 67.1%"`×2,
     `div::"Any Active Event"`×2, `button::"More Options"`×2 — all `distinct:1`) → row-text **FAILS** →
     **ordinal/position is the only deterministic lever.** Config-builder UIs are full of identical-twin
     ambiguity → strongest case yet for activating the captured-but-unused `ordinal`.
3. **Portaled menus are toggle-stateful + timing-sensitive.** "Saved"/"Build-with-AI" menus close in the
   round-trip between a click call and a scan call → click-then-scan-later misses them entirely. Reliable
   capture needs open → await-mount → scan-before-close in one tick (TEMPORAL/reveal; P2 runtime).
4. **Portal options are role-less (measured across 3 portals):** `div[role=listbox]` with options that have
   NO role/testid/`cursor:pointer` — only the container has a testid. The big property/event PICKERS (most
   test-critical controls) are the same shape. The `cursor:pointer` widener does NOT generalize here.
   **→ Interaction strategy (since every Amplitude portal has a Search box):**
   - **Search-and-pick [preferred]:** the search `<input>` is anchorable → type target → list filters to one → click result (N→1, sidesteps role-less options).
   - **Container-scoped text-click [fallback]:** find container by testid → match option by text → click clickable ancestor.

## Honest caveats
- **SPA undercount (confirmed large):** static visible-only scan misses hover/lazy/portaled controls — Gong
  showed a 63% miss. Treat all sweep counts as lower bounds.
- **One page per app**, not a crawl; **tiny tied-set n** on the static scan → row-text% was directional.
- Counts only; no content extracted (privacy).
