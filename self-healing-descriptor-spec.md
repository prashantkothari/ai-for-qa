# Self-healing locators — v1 spec

**Audience:** test-engine team · **Status:** proposal · **Goal:** make recorded tests survive UI redesigns without re-recording.

---

## 1. The problem

Today we save **one clue** per element — a CSS selector or an XPath. When the screen changes (new CSS classes, moved button, translated text), that one clue stops matching and the test fails — even though the element is still on the screen. Re-recording is manual and never-ending.

## 2. The idea (one line)

Stop saving a locator. At record time, save **several independent facts** about the element. At replay, score every candidate on the page against those facts and pick the best — but only if we're confident. One broken fact can't sink the match.

We call the saved bundle a **descriptor**.

## 3. What we capture at record time

### Clue 1 — what the element *is* (free from the platform)

The browser already builds an "accessibility view" of every element: its **role** (button, textbox…), its **name** (the label a screen reader reads), its type, its state. iOS and Android build the exact same thing. We record *that*, not the CSS class — because it describes what the element is, and that survives restyling. Bonus: it's the **same shape on web and mobile**, so one descriptor works everywhere.

Fields we store: `role`, accessible `name`, the form field `name`, `type`, `autocomplete`, which form it's in, and (mobile) the `accessibilityId`.

### Clue 3 — extra anchors, computed once by AI at record time

Three things, captured **once** when the element is recorded:

1. **A plain-English description** of what the element is — e.g. *"primary Sign in button of the login form."* This describes *function*, which redesigns almost never change.
2. **A small picture of the element** (a crop) plus a fingerprint of that picture. This is completely independent of the HTML — it survives even a full framework rewrite.
3. **A stable-vs-fragile rating for each clue.** We probe at record time: a class like `css-1a2b3c` or a screen position rates *fragile*; role, field name, accessibility id rate *stable*. The matcher trusts stable clues more.

> **Why AI at record time, not replay time:** it runs once per element — cheap and repeatable. Replay stays fast and predictable, with no AI call on every run. This is the key design choice.

**Descriptor example (the GitHub "Sign in" button):**
```json
{
  "intent": "Primary 'Sign in' button of the login form",
  "identity": { "role": "button", "name": "Sign in", "fieldName": "commit", "type": "submit", "inForm": "/session" },
  "picture": "<crop + fingerprint>",
  "stability": { "role": 0.9, "name": 0.5, "fieldName": 0.85, "type": 0.85, "inForm": 0.8, "cssClass": 0.1 }
}
```

## 4. How replay works

1. List the candidate elements on the page.
2. **Score** each one against the descriptor. Every clue adds points, weighted by its stability rating.
3. Look at the top candidate and decide:
   - **Confident + clear winner** → use it, and **update the saved locator** to the new page (heals once, not every run).
   - **Confident but two candidates tie** → **abstain** (don't guess).
   - **Not confident** → **fail loudly** with a real reason.
4. **Before acting, check the element is actually usable** — visible, on screen, real coordinates. If not, don't act. *Found is not the same as usable.*

## 5. Examples — honest

These are real results from a working prototype run on GitHub's actual login HTML and the iOS swipe failure data.

| Change to the page | Old way (one selector) | New way (descriptor) |
|---|---|---|
| CSS classes regenerated | ❌ breaks | ✅ heals (100%) |
| Text translated to German | ❌/survives | ✅ heals (90%) |
| Stable `id` removed | ❌ breaks | ✅ heals via role + field name + autocomplete (89%) |
| iOS: *"Privacy e sicurezza" → "Privacy"* (a real 380-failure case) | ❌ breaks | ✅ heals (97%) — **no dev change needed** |
| A duplicate button is added | ❌ silently picks one | ⚠️ **abstains** — refuses to guess |
| All identity stripped from the element | ❌ breaks | 🔴 **fails (36%)** — nothing reliable left to match |
| Element scrolled off-screen (no real coordinates) | "still matches" 😬 | 🟠 **blocked** — identity matched, but it's not usable |

The bottom three are the point: when it can't be sure, it **abstains or fails openly** instead of clicking the wrong thing. A loud skip is safe; a confident wrong click is not.

## 6. What this does NOT fix (set expectations)

From the 1,000-failure swipe report, this only addresses the **stale-locator family (~66%)**, and only the part of it that still has a surviving stable signal. It does **nothing** for lost driver sessions, device-cloud drops, app crashes, engine bugs, or "screen not ready" timing — those are different layers and no find-time trick touches them. Self-healing is one lane, not the whole road.

## 7. Build scope

- **P0 — no AI needed.** Clue 1 descriptor + stability rating + the matcher + the usable-element check + heal-and-save + abstain. This alone covers the green rows above.
- **P1 — Clue 3.** Add the record-time AI description and the element picture/fingerprint as a last-resort signal. This is what can rescue some of the "fails" and "abstains" (e.g. a visually distinctive button with no other identity).

## 8. P2 — Clue 2: capture the element's neighbours

Later, also record the element's **surroundings** as a small map: the label next to it, the section it sits in, the siblings around it. This lets us say *"the Add-to-cart button inside **this** product card"* and tell apart repeated rows that look identical on their own (the case where today the new way correctly abstains). We defer it to P2 because it adds matching complexity, and the P0/P1 clues already handle the large majority of cases.

## 9. Recorded-step schema (what the auto-recorder stores per step)

Grounded in the live findings (duplicate-rendered controls, portaled hover-menus, label-less calendars). Each step = a descriptor + the action + how to disambiguate + how to reveal + how to verify.

```jsonc
{
  "stepId": "s_07",
  "intent": "Open the Create menu",          // Clue 3: record-time AI caption — most redesign-proof signal
  "action": "click",                          // type | click | select | toggle | navigate | hover | scroll-to | swipe
  "value": null,                              // text to type / option to select; null for click etc.

  "target": {
    "descriptor": {                           // Clue 1 identity + Clue 3, each signal carries a stability 0-1
      "testid":     { "v": "create-button",  "st": 0.95 },
      "role":       { "v": "button",         "st": 0.90 },
      "idFragment": { "v": "-trigger-CREATE","st": 0.85 },   // stable suffix of a dynamic (Radix/Angular) id
      "name":       { "v": "Create",         "st": 0.50 },   // accessible name; demoted (localizes)
      "type":       { "v": "button",         "st": 0.70 },
      "cls":        { "v": "shroptionAKbMBA1","st": 0.08 },  // hashed → near-zero trust
      "visual":     "phash:9f3a… (record-time crop)"         // Clue 3 backstop for no-identity cases
    },
    "bestLocator": "[data-testid='create-button']",  // fast-path anchor chosen at record
    "uniqueAtRecord": true,
    "confidence": 95                          // predicted robustness 0-100
  },

  "scope": {                                  // THE DUPLICATE FIX (Amplitude nav ×2, Jira "Create board" ×3)
    "visibleOnly": true,                      // resolve to the interactable instance (offsetParent + in-viewport)
    "container": {                            // optional Clue 2: narrow to a region/parent first
      "descriptor": { "role": {"v":"navigation","st":0.8}, "name": {"v":"Primary","st":0.6} }
    },
    "ordinal": null                           // last resort: index — ONLY if order is declared stable
  },

  "reveal": [                                 // make the target EXIST before locating (portaled / hover-gated UI)
    { "action": "hover", "ref": "[data-testid='create-button']" },
    { "action": "click", "ref": "role=option name='Chart'" }
  ],
  "framePath": [],                            // iframe chain to enter first, e.g. ["#outer","iframe[name=pay]"]

  "actionability": {                          // pre-act gate at replay — "found != usable"
    "requireVisible": true,
    "requireTopmostAtPoint": true,            // hit-test → guards against cookie/consent overlay on top
    "requireFiniteBox": true                  // guards off-screen / infinite-coords (iOS swipe bug D-2)
  },

  "verify": {                                 // post-act effect check → confirms a heal, catches a WRONG heal
    "type": "domChange",                      // urlChange | domChange | textPresent | elementGone
    "expect": "a [role=menu] becomes visible"
  },

  "flag": null                                // null | ambiguous | weak-identity | no-anchor | needs-review
}                                             //   calendar day cell → "no-anchor" (recorded ordinally; flag for review)
```

**Why each block exists (one line, all measured this session):**
- `descriptor` + stability → heals across restyle/locale (0 confirmed false-heals in testing).
- `bestLocator` + `confidence` → fast deterministic path; confidence drives heal vs abstain.
- `scope.visibleOnly` → the #1 record-vs-replay bug: duplicate-rendered controls (nav ×2, "Create board" ×3).
- `reveal` + `framePath` → portaled/hover-gated UI and iframes: the target doesn't exist until revealed, and DOM ancestry is broken across a portal/iframe boundary.
- `actionability` → never act into a non-usable element (overlay on top / off-screen).
- `verify` → turns the stored step into a *checkable fact*; catches the rare wrong-heal at replay.
- `flag` → never silently store a fragile locator (calendar/icon/repeated) — surface it for human/visual fallback.
