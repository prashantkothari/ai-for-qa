/* self-heal/brain/brain.js — S2: the compounding store's honest first cut — a verify-gated CACHE.
 *
 * Keyed by AUTHORED TEST IDENTITY (testId + ':' + stepId, e.g. "L1:submit" — K37/GA-e), NOT DOM
 * fingerprint, so drift across releases doesn't cold-start the key itself.
 *
 * OV#4 guard enforced HERE (not delegated to learning-loop.js): put() only accepts confidence 'HIGH'.
 * Everything else (MEDIUM/NONE/simulated) is a no-op — those outcomes are logged to the flywheel
 * (self-heal/schemas/flywheel-event.schema.js) but never promoted into the cache.
 *
 * Honest scope boundary: this is P1's CACHE (put/get, miss->cold, never a wrong reuse). The promote/
 * demote counters + autonomy ladder (successes>=5 up, failures>=2 down) are self-heal/pipeline/
 * learning-loop.js's job — that stays a documented stub until S8. S2 does not touch it.
 *
 * Real-anchor-only rule (the S0 fixture-bug lesson): only cache a locator that is a real CSS anchor
 * (testid/#id/id-fragment/form-name — starts with '[' or '#'). role+name locators ("role=...[name=...]")
 * and test-only attributes are NEVER cached — they re-run the matcher every time.
 */
(function (root) {
  const key = (testId, stepId) => testId + ':' + stepId;
  const isRealAnchor = sel => !!sel && /^[\[#]/.test(sel);

  function makeBrain(seed) {
    const data = Object.assign({}, seed);

    // get(testId, stepId, doc?) -> {el, locator} on a unique live hit, else null (cold miss).
    // A key-miss OR a selector that no longer resolves to exactly one element are BOTH cold misses —
    // never guess between duplicates, never return a stale/gone element.
    function get(testId, stepId, doc) {
      const rec = data[key(testId, stepId)];
      if (!rec) return null;
      try {
        const hits = (doc || document).querySelectorAll(rec.locator);
        if (hits.length === 1) return { el: hits[0], locator: rec.locator };
      } catch (e) { /* malformed/unsupported selector -> treat as a miss, not a throw */ }
      return null;
    }

    // put(testId, stepId, locator, verification) -> true if written, false if rejected (and why is
    // implicit: caller can inspect verification.confidence / locator shape themselves if they need a reason).
    function put(testId, stepId, locator, verification) {
      if (!verification || verification.confidence !== 'HIGH') return false;   // OV#4 guard
      if (!isRealAnchor(locator)) return false;                                 // real-anchor-only rule
      data[key(testId, stepId)] = { locator, confidence: verification.confidence };
      return true;
    }

    // deep-enough copy: records are flat {locator, confidence} — a shallow Object.assign would leak
    // live references, letting a caller mutate a "point-in-time" snapshot's record and corrupt the store.
    function snapshot() {
      const out = {};
      Object.keys(data).forEach(k => { out[k] = Object.assign({}, data[k]); });
      return out;
    }

    return { get, put, snapshot };
  }

  // ---- adapter: turn one S7 executeLive() result into brain writes for every step that was
  // located+acted during a HIGH-confidence-verified run. Sound because executeLive is all-or-nothing
  // up to the assertion (a single unresolved step blocks the whole test before verification ever
  // happens) — so a HIGH-confidence outcome is evidence for every step that got there, not just the last one.
  function ingestLiveResult(brain, test, liveResult) {
    let written = 0;
    if (!liveResult || liveResult.verify_confidence !== 'HIGH') return written;
    // build the verification object explicitly from the canonical field — do NOT pass liveResult
    // straight through to put() and rely on it also happening to carry a same-valued .confidence key.
    const verification = { confidence: liveResult.verify_confidence };
    test.steps.forEach((st, i) => {
      const row = liveResult.steps[i];
      if (row && row.located && st._anchor && st._anchor.stepId) {
        const ok = brain.put(test.id, st._anchor.stepId, st._anchor.target && st._anchor.target.bestLocator, verification);
        if (ok) written++;
      }
    });
    return written;
  }

  const API = { makeBrain, ingestLiveResult, key, isRealAnchor };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_BRAIN = API;
})(typeof window !== 'undefined' ? window : globalThis);
