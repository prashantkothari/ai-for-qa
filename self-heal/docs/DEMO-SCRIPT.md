# DEMO-SCRIPT.md — QA Agent panel, 10-minute walkthrough (P2 build)

> Audience: someone who hasn't seen the panel before. Goal: author → break the app → watch it
> heal-or-honestly-abstain → prove the safety net is real, not asserted.
> Numbers here are the ones measured live during the P2 build session (2026-07-03) — see the ledger
> (`~/.claude/plans/i-would-like-you-buzzing-goblet.md`, §19, K39-K45) for the full detail and tags.

## Setup (before the room fills up)

```bash
python3 static-server.py     # serves the repo root on :8765 — use whatever free port your worktree has
```

Open `self-heal/panel/panel.html` in Chrome. You should see: a fixture on the left ("Host app"), the
QA Agent panel on the right with 5 tabs (chat / review / runs / report / safety).

**If anything looks broken:** the panel's `<script>` tags are cache-busted with `?v=N` — bump N and
hard-reload if you've just pulled new code. Same for `panel.css` (has its own `?v=`, learned the hard
way — see ledger K42).

---

## 1. Author (chat tab) — 1 min

Type: `author a test for this form`. The agent studies the mounted fixture (no LLM — deterministic
verb parsing + DOM-shape detection) and drops you into **Review** with a scenario draft grouped
Happy / Negative / Edge-Risk.

**Talking point:** three archetypes ship — forms (P1), **tables/lists** and **nav/menus** (P2 Session
4). Switch the "which fixture" dropdown next to the chat input to `Orders table` or `Dashboard nav` and
re-run `author a test for this table` / `...this nav` to show the other two live.

## 2. Review — data variants — 1 min

Expand any case with a fill step (e.g. the contact form's `F1`). You'll see an inline **DATA VARIANTS**
table: empty / boundary / long / unicode / format-invalid, all seeded from one PRNG
(`self-heal/panel/datagen.js`). Click **▶ run N variants** — each one executes live. Click **replay
seed** on a failed variant: the panel regenerates the value from the stored seed and confirms it's
byte-identical before re-running (same seed → same variant, not a re-roll).

## 3. Runs — break the app, watch it heal or honestly abstain — 3 min

Switch to **Runs**. Pick a drift from the dropdown (`restyle` is the safe crowd-pleaser — it hashes
every class/id) and click **▶ step**. Narration shows each located/acted step; the left pane highlights
the resolved element.

**The tables archetype is the sharpest demo of the row-text lever (K19/K27):** author against the
Orders table, run the "Cancel order for Alice Chen" case. All three rows share an identical "Cancel"
label — margin 0 by name alone. The step list will show `via: context` on the Cancel click: the
matcher broke the tie using the row's OWN text (the customer name), and ONLY Alice Chen's row flips to
Cancelled. That's the false-heal shape this archetype exists to catch, caught correctly.

**Now genuinely break it:** author the contact form again, pick drift `remove Message (→ REMOVAL/
ABSTAIN)`, step through. Watch it try **temporal-wait** (a real ~2s bounded wait — the panel isn't
frozen, it's actually polling) then **search-and-pick** (widens the scope), then abstains with a named,
lever-aware reason. **Zero false-heal, by construction** — it never guesses when the target is
genuinely gone.

Scroll down to the **BRAIN / LADDER** panel: run the SAME test 5 times (queue `F1,F1,F1,F1,F1,F1`,
step through all 6) — successes climb 1→5 on runs 1-5 (matcher-served), then run 6 shows every step
served from the **brain** at tier **L2**. That's the promotion ladder working live, not asserted.

## 4. Report — the gating metric — 1 min

Switch to **Report**. The headline number is **false-heal**, not pass-rate — that's deliberate. A
correct abstain-with-a-named-reason counts as a deliverable, never a failure. The heal-rate widget only
appears when there's a real measured denominator (never a fabricated "0% (0/0)").

Scroll to **Export (T6.2)**: pick a test, click **generate Playwright stub** — see it produce real
`page.locator('#cName').fill(...)` calls from the recorded anchors. Say out loud: *this is text
generation, tagged `asserted` — there's no Node in this environment to run or type-check it. That
honesty is the point, not a gap to apologize for.*

## 5. Safety — the falsifiability proof — 2 min

Switch to **Safety**. Click **▶ run eval-gate corpus** — the SAME 14-case benchmark as
`self-heal/benchmark/eval-gate.html` runs in-panel: **false-heal 0/14, match 14/14, regressions 0**.

Click **▶ mutate ×10** — the live counter climbs (`N mutations · false-heals: 0`, green) across four
seeded drift regimes (restyle/localize/reorder/**twin** — the last two are new this session).

**The moment that matters:** click **⚠ corrupt next verdict (demo)**, then **▶ mutate once**. The
counter flips to **RED** (`false-heals: 1`) and the offending row is clearly labelled "SIMULATED — demo
fault injection." Say: *this proves the counter is a live measurement I can falsify on demand, not a
hardcoded green checkmark.*

## 6. (If there's time) Amplitude — a real production app — 2 min

Not click-through-able live in the demo (needs an authenticated tab + injected modules — see
`self-heal/docs/AMPLITUDE-E2E-RUN.md` for the technique), but worth narrating with the numbers: the SAME
nav-archetype shape was run against `app.amplitude.com`'s real chart-builder, read-only, zero writes.
3/3 chart-type tab switches (Funnel/Retention/Journeys) resolved via real, strong `data-testid` anchors.
An immediate check failed on all 3 (Amplitude's SPA updates the URL asynchronously); the SAME bounded
wait-then-verify shape used in the fixtures confirmed all 3 within 1.2-1.8s. **False-heal 0/3, measured
live, 2026-07-03** — this is not a fixture-only trick.

---

## Honest close (say this out loud, don't skip it)

- Every number above is **measured** against synthetic drift or a live-but-unbroken real app — never a
  real, organically-occurring test failure. **D1** (real failure DOMs) is still the standing blocker for
  a genuine correct-heal/false-heal rate on non-synthetic drift.
- This build is on branch `claude/wizardly-varahamihira-3569aa`, **not merged to main**.
- Deliberately deferred: Playwright/Testsigma installable packaging (the Export button is the seed, not
  the package), write-actions on real apps (needs a test-data safety policy), multi-screen flows.

## Dry-run checklist (run this before the actual demo)

- [ ] `python3 static-server.py` running, panel loads with no console errors
- [ ] chat → author (contact form) → review → runs → step through F1 clean PASS
- [ ] chat → author (orders table) → row-text `via:context` heal visible
- [ ] chat → author (nav dashboard) → view-switch PASS at HIGH confidence
- [ ] `remove-target` drift → temporal-wait + search-and-pick both tried → honest ABSTAIN/FAILED
- [ ] run same test 5x → ladder promotion to L2 visible on run 6
- [ ] Safety → eval-gate 14/14, 0 false-heal, 0 regressions
- [ ] Safety → mutate ×10 clean green → corrupt-next → RED demo works
- [ ] Report → export JSON + Playwright stub both produce sane output
- [ ] core `selfheal-tests.html` 14/14, adversarial `adversarial-validation.html` 22/22
